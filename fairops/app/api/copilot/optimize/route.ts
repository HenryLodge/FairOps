import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { genai, IMAGE_MODEL, buildLayoutPrompt, type VenueShapeInfo } from '@/lib/gemini';
import { boundsToMetrics, type VenueMetrics } from '@/lib/venueBounds';
import { renderShapeBoundary } from '@/lib/renderShapeBoundary';
import { NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Approximate meters per degree latitude at the equator. */
const METERS_PER_DEGREE_LAT = 111_320;

/** Convert two [lat, lng] points to distance in meters. */
function latlngDistanceMeters(
  a: [number, number],
  b: [number, number],
): number {
  const dLat = (b[0] - a[0]) * METERS_PER_DEGREE_LAT;
  const avgLat = (a[0] + b[0]) / 2;
  const dLng =
    (b[1] - a[1]) * METERS_PER_DEGREE_LAT * Math.cos((avgLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Format a number as a short, readable string (no decimals for large, 1 for small). */
function fmtM(m: number): string {
  return m >= 10 ? `${Math.round(m)}` : m.toFixed(1);
}

/** Format an aspect ratio as "W:H" with one decimal. */
function fmtRatio(w: number, h: number): string {
  if (h === 0) return '1:0';
  const r = w / h;
  if (r >= 1) return `${r.toFixed(1)}:1`;
  return `1:${(1 / r).toFixed(1)}`;
}

/**
 * Build a detailed geometric description of the venue from stored drawn_shapes.
 * Returns null when no usable shape data is available.
 */
function venueShapeDescription(drawnShapes: unknown): VenueShapeInfo | null {
  if (!Array.isArray(drawnShapes) || drawnShapes.length === 0) return null;

  const descriptions: string[] = [];
  let overallAspect: { w: number; h: number } | null = null;

  for (const shape of drawnShapes) {
    if (!shape || typeof shape !== 'object' || !('type' in shape)) continue;
    const type = String((shape as { type?: string }).type).toLowerCase();

    if (type === 'rectangle') {
      const latlngs = (shape as { latlngs?: [number, number][] }).latlngs;
      if (!Array.isArray(latlngs) || latlngs.length < 2) {
        descriptions.push('Rectangle (no coordinate data)');
        continue;
      }
      const sw = latlngs[0]; // [lat, lng] south-west
      const ne = latlngs[1]; // [lat, lng] north-east
      const avgLat = (sw[0] + ne[0]) / 2;
      const heightM = Math.abs(ne[0] - sw[0]) * METERS_PER_DEGREE_LAT;
      const widthM =
        Math.abs(ne[1] - sw[1]) *
        METERS_PER_DEGREE_LAT *
        Math.cos((avgLat * Math.PI) / 180);
      const ar = fmtRatio(widthM, heightM);
      const orientation =
        widthM > heightM * 1.1
          ? 'wider than tall'
          : heightM > widthM * 1.1
            ? 'taller than wide'
            : 'roughly square';
      descriptions.push(
        `Rectangle, approximately ${fmtM(widthM)} m × ${fmtM(heightM)} m (aspect ratio ${ar}, ${orientation})`,
      );
      if (!overallAspect) overallAspect = { w: widthM, h: heightM };
    } else if (type === 'polygon') {
      const rawLatlngs = (shape as { latlngs?: unknown }).latlngs;
      const latlngs: [number, number][] = Array.isArray(rawLatlngs)
        ? (rawLatlngs as [number, number][])
        : [];
      if (latlngs.length < 3) {
        descriptions.push('Polygon (insufficient vertices)');
        continue;
      }

      // Compute bounding box
      let minLat = Infinity,
        maxLat = -Infinity,
        minLng = Infinity,
        maxLng = -Infinity;
      for (const [lat, lng] of latlngs) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      const avgLat = (minLat + maxLat) / 2;
      const bbHeightM = (maxLat - minLat) * METERS_PER_DEGREE_LAT;
      const bbWidthM =
        (maxLng - minLng) *
        METERS_PER_DEGREE_LAT *
        Math.cos((avgLat * Math.PI) / 180);

      // Normalize vertices to 0-100 relative coordinates within bounding box
      const latSpan = maxLat - minLat || 1e-9;
      const lngSpan = maxLng - minLng || 1e-9;
      const normalized = latlngs.map(([lat, lng]) => {
        // x = longitude direction (left to right), y = latitude direction (bottom to top)
        const x = Math.round(((lng - minLng) / lngSpan) * 100);
        const y = Math.round(((lat - minLat) / latSpan) * 100);
        return `(${x},${y})`;
      });

      const ar = fmtRatio(bbWidthM, bbHeightM);
      descriptions.push(
        `Irregular polygon with ${latlngs.length} vertices at relative positions (0-100 scale, origin bottom-left): ${normalized.join(', ')}. ` +
          `Bounding box approximately ${fmtM(bbWidthM)} m × ${fmtM(bbHeightM)} m (aspect ratio ${ar})`,
      );
      if (!overallAspect) overallAspect = { w: bbWidthM, h: bbHeightM };
    } else if (type === 'circle') {
      const center = (shape as { center?: [number, number] }).center;
      const radius = (shape as { radius?: number }).radius;
      if (center && typeof radius === 'number') {
        const diameterM = radius * 2;
        descriptions.push(
          `Circle, approximately ${fmtM(diameterM)} m diameter (radius ${fmtM(radius)} m)`,
        );
        if (!overallAspect) overallAspect = { w: diameterM, h: diameterM };
      } else {
        descriptions.push('Circle (no coordinate data)');
      }
    } else if (type === 'polyline') {
      const rawLatlngs = (shape as { latlngs?: unknown }).latlngs;
      const latlngs: [number, number][] = Array.isArray(rawLatlngs)
        ? (rawLatlngs as [number, number][])
        : [];
      if (latlngs.length >= 2) {
        let totalLen = 0;
        for (let i = 1; i < latlngs.length; i++) {
          totalLen += latlngDistanceMeters(latlngs[i - 1], latlngs[i]);
        }
        descriptions.push(
          `Polyline boundary, approximately ${fmtM(totalLen)} m total length with ${latlngs.length} points`,
        );
      } else {
        descriptions.push('Polyline (insufficient points)');
      }
    } else {
      descriptions.push(`Custom shape (${type})`);
    }
  }

  if (descriptions.length === 0) return null;

  return {
    text:
      descriptions.length === 1
        ? descriptions[0]
        : `Multiple shapes:\n${descriptions.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`,
    aspectRatio: overallAspect ?? { w: 1, h: 1 },
  };
}

/**
 * Use stored venue_metrics if valid; otherwise compute from venue_bounds.
 */
function resolveMetrics(
  venueMetrics: unknown,
  venueBounds: { north: number; south: number; east: number; west: number } | null | undefined,
): VenueMetrics | null {
  if (
    venueMetrics &&
    typeof venueMetrics === 'object' &&
    'widthMeters' in venueMetrics &&
    'heightMeters' in venueMetrics &&
    'areaM2' in venueMetrics
  ) {
    const m = venueMetrics as { widthMeters: number; heightMeters: number; areaM2: number };
    if (
      typeof m.widthMeters === 'number' &&
      typeof m.heightMeters === 'number' &&
      typeof m.areaM2 === 'number'
    ) {
      return m;
    }
  }
  return boundsToMetrics(venueBounds);
}

/**
 * Parse Gemini's text response into structured reasoning and safety notes.
 * Expects the model to output "REASONING:" and "SAFETY NOTES:" headers.
 */
function parseTextResponse(text: string): {
  reasoning: string;
  safetyNotes: string[];
} {
  let reasoning = '';
  const safetyNotes: string[] = [];

  // Extract reasoning section
  const reasoningMatch = text.match(
    /REASONING:\s*([\s\S]*?)(?=SAFETY NOTES:|$)/i,
  );
  if (reasoningMatch) {
    reasoning = reasoningMatch[1].trim();
  }

  // Extract safety notes section (bullet list)
  const safetyMatch = text.match(/SAFETY NOTES:\s*([\s\S]*)/i);
  if (safetyMatch) {
    const rawNotes = safetyMatch[1].trim().split(/\n[-•*]\s*/);
    for (const note of rawNotes) {
      const trimmed = note.trim();
      if (trimmed) safetyNotes.push(trimmed);
    }
  }

  // Fallback: if neither section found, treat full text as reasoning
  if (!reasoning && safetyNotes.length === 0) {
    reasoning = text.trim();
  }

  return { reasoning, safetyNotes };
}

/* ------------------------------------------------------------------ */
/* POST /api/copilot/optimize                                          */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    /* ---------- 1. Auth ---------- */
    const { auth } = await getSessionForApi();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!auth.roles.includes('organizer')) {
      return NextResponse.json(
        { error: 'Organizer role required' },
        { status: 403 },
      );
    }

    /* ---------- 2. Parse body ---------- */
    const body = await request.json();
    const { eventId } = body as { eventId?: string };

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 },
      );
    }

    /* ---------- 3. Fetch event + approved vendors ---------- */
    const eventSelectColumns = 'name, date, location, expected_attendance, venue_width, venue_height, venue_bounds, venue_metrics, drawn_shapes, attractions, organizer_id';
    const [eventResult, vendorsResult] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select(eventSelectColumns)
        .eq('id', eventId)
        .single(),
      supabaseAdmin
        .from('vendors')
        .select(
          'booth_name, vendor_type, space_needed, power_needed, description',
        )
        .eq('event_id', eventId)
        .eq('status', 'approved'),
    ]);

    if (eventResult.error || !eventResult.data) {
      console.error('[optimize] Event lookup failed:', eventResult.error);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventResult.data;

    // Verify ownership
    if (event.organizer_id !== auth.user.sub) {
      return NextResponse.json(
        { error: 'Not authorized to optimize this event' },
        { status: 403 },
      );
    }

    const vendors = vendorsResult.data ?? [];

    /* ---------- 4. Resolve metrics (stored or computed) and venue shape description ---------- */
    const metrics = resolveMetrics(event.venue_metrics, event.venue_bounds);
    const shapeDesc = venueShapeDescription(event.drawn_shapes);

    /* ---------- 5. Render reference boundary image (if shapes exist) ---------- */
    let boundaryImage: { base64: string; width: number; height: number } | null = null;
    if (shapeDesc && Array.isArray(event.drawn_shapes) && event.drawn_shapes.length > 0) {
      try {
        boundaryImage = await renderShapeBoundary(
          event.drawn_shapes,
          shapeDesc.aspectRatio,
        );
        if (boundaryImage) {
          console.log(
            `[optimize] Rendered boundary reference image: ${boundaryImage.width}×${boundaryImage.height}`,
          );
        }
      } catch (renderErr) {
        console.warn('[optimize] Failed to render boundary image, falling back to text-only:', renderErr);
      }
    }

    /* ---------- 6. Build prompt ---------- */
    const hasReferenceImage = boundaryImage !== null;
    const prompt = buildLayoutPrompt(
      {
        name: event.name,
        date: event.date,
        location: event.location,
        expected_attendance: event.expected_attendance,
        venue_width: event.venue_width,
        venue_height: event.venue_height,
      },
      vendors,
      metrics,
      event.attractions,
      shapeDesc,
      hasReferenceImage,
    );

    console.log('[optimize] Calling Gemini model:', IMAGE_MODEL, hasReferenceImage ? '(with reference image)' : '(text-only)');

    /* ---------- 7. Call Gemini (multi-part if reference image, text-only otherwise) ---------- */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any;

    if (boundaryImage) {
      // Multi-part content: reference boundary image + text prompt
      // (same pattern as the refine route)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentParts: any[] = [
        {
          inlineData: {
            mimeType: 'image/png',
            data: boundaryImage.base64,
          },
        },
        { text: prompt },
      ];
      contents = [{ role: 'user', parts: contentParts }];
    } else {
      contents = prompt;
    }

    const response = await genai.models.generateContent({
      model: IMAGE_MODEL,
      contents,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    /* ---------- 8. Parse response parts ---------- */
    let imageBase64: string | null = null;
    let imageMimeType = 'image/png';
    let textContent = '';

    const parts = response.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if (part.text) {
        textContent += part.text;
      } else if (part.inlineData) {
        imageBase64 = part.inlineData.data ?? null;
        imageMimeType = part.inlineData.mimeType ?? 'image/png';
      }
    }

    if (!imageBase64) {
      console.warn('[optimize] Gemini did not return an image. Text:', textContent);
      return NextResponse.json(
        {
          error:
            'AI did not generate a layout image. Please try again — if the issue persists, simplify the venue or add more context.',
        },
        { status: 502 },
      );
    }

    /* ---------- 9. Parse reasoning + safety notes ---------- */
    const { reasoning, safetyNotes } = parseTextResponse(textContent);

    /* ---------- 10. Deactivate existing active layouts ---------- */
    await supabaseAdmin
      .from('layouts')
      .update({ is_active: false })
      .eq('event_id', eventId)
      .eq('is_active', true);

    /* ---------- 11. Insert new layout ---------- */
    const { data: layout, error: insertError } = await supabaseAdmin
      .from('layouts')
      .insert({
        event_id: eventId,
        layout_data: {
          image: imageBase64,
          mimeType: imageMimeType,
          safetyNotes,
        },
        reasoning,
        is_active: true,
      })
      .select('id, layout_data, reasoning, is_active')
      .single();

    if (insertError) {
      console.error('[optimize] Failed to save layout:', insertError);
      return NextResponse.json(
        { error: 'Failed to save layout' },
        { status: 500 },
      );
    }

    console.log('[optimize] Layout saved successfully:', layout.id);

    /* ---------- 12. Return result ---------- */
    return NextResponse.json({
      layout: {
        id: layout.id,
        image: imageBase64,
        mimeType: imageMimeType,
        reasoning,
        safetyNotes,
      },
    });
  } catch (err) {
    console.error('[optimize] Unhandled error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
