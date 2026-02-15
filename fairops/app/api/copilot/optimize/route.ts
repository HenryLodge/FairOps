import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { genai, IMAGE_MODEL, buildLayoutPrompt } from '@/lib/gemini';
import { boundsToMetrics, type VenueMetrics } from '@/lib/venueBounds';
import { NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Build a short venue-shape summary from stored drawn_shapes for the AI prompt. */
function venueShapeSummary(drawnShapes: unknown): string | null {
  if (!Array.isArray(drawnShapes) || drawnShapes.length === 0) return null;
  if (drawnShapes.length > 1) return 'Multiple shapes';
  const first = drawnShapes[0];
  if (first && typeof first === 'object' && 'type' in first) {
    const type = String((first as { type?: string }).type).toLowerCase();
    if (type === 'rectangle') return 'Rectangle';
    if (type === 'polygon') {
      const latlngs = (first as { latlngs?: unknown[] }).latlngs;
      const n = Array.isArray(latlngs) ? latlngs.length : 0;
      return n > 0 ? `Polygon (${n} points)` : 'Polygon';
    }
    if (type === 'circle') return 'Circle';
    if (type === 'polyline') return 'Polyline';
    return type || 'Custom shape';
  }
  return 'Custom shape';
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
    // #region agent log
    const eventSelectColumns = 'name, date, location, expected_attendance, venue_width, venue_height, venue_bounds, venue_metrics, drawn_shapes, attractions, organizer_id';
    fetch('http://127.0.0.1:7242/ingest/fc0146e8-54ca-4e93-b0ea-604c51eefa37', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'optimize/route.ts:select', message: 'Event select columns', data: { eventId, columns: eventSelectColumns }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fc0146e8-54ca-4e93-b0ea-604c51eefa37', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'optimize/route.ts:eventError', message: 'Event fetch error', data: { code: eventResult.error?.code, message: eventResult.error?.message, details: eventResult.error?.details }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
      // #endregion
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

    /* ---------- 4. Resolve metrics (stored or computed) and venue shape summary ---------- */
    const metrics = resolveMetrics(event.venue_metrics, event.venue_bounds);
    const venueShape = venueShapeSummary(event.drawn_shapes);

    /* ---------- 5. Build prompt ---------- */
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
      venueShape,
    );

    console.log('[optimize] Calling Gemini model:', IMAGE_MODEL);

    /* ---------- 6. Call Gemini ---------- */
    const response = await genai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    /* ---------- 7. Parse response parts ---------- */
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

    /* ---------- 8. Parse reasoning + safety notes ---------- */
    const { reasoning, safetyNotes } = parseTextResponse(textContent);

    /* ---------- 9. Deactivate existing active layouts ---------- */
    await supabaseAdmin
      .from('layouts')
      .update({ is_active: false })
      .eq('event_id', eventId)
      .eq('is_active', true);

    /* ---------- 10. Insert new layout ---------- */
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

    /* ---------- 11. Return result ---------- */
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
