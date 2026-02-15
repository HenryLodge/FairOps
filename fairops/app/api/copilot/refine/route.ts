import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { genai, IMAGE_MODEL, buildRefinePrompt } from '@/lib/gemini';
import { NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Reuse the same text-parsing logic as the optimize route. */
function parseTextResponse(text: string): {
  reasoning: string;
  safetyNotes: string[];
} {
  let reasoning = '';
  const safetyNotes: string[] = [];

  const reasoningMatch = text.match(
    /REASONING:\s*([\s\S]*?)(?=SAFETY NOTES:|$)/i,
  );
  if (reasoningMatch) {
    reasoning = reasoningMatch[1].trim();
  }

  const safetyMatch = text.match(/SAFETY NOTES:\s*([\s\S]*)/i);
  if (safetyMatch) {
    const rawNotes = safetyMatch[1].trim().split(/\n[-•*]\s*/);
    for (const note of rawNotes) {
      const trimmed = note.trim();
      if (trimmed) safetyNotes.push(trimmed);
    }
  }

  if (!reasoning && safetyNotes.length === 0) {
    reasoning = text.trim();
  }

  return { reasoning, safetyNotes };
}

/* ------------------------------------------------------------------ */
/* POST /api/copilot/refine                                            */
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
    const { eventId, feedback } = body as {
      eventId?: string;
      feedback?: string;
    };

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 },
      );
    }
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return NextResponse.json(
        { error: 'feedback is required' },
        { status: 400 },
      );
    }

    /* ---------- 3. Fetch event (for ownership) + current active layout ---------- */
    const [eventResult, layoutResult] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select('organizer_id')
        .eq('id', eventId)
        .single(),
      supabaseAdmin
        .from('layouts')
        .select('id, layout_data, reasoning')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (eventResult.error || !eventResult.data) {
      console.error('[refine] Event lookup failed:', eventResult.error);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Verify ownership
    if (eventResult.data.organizer_id !== auth.user.sub) {
      return NextResponse.json(
        { error: 'Not authorized to refine this event' },
        { status: 403 },
      );
    }

    if (!layoutResult.data) {
      return NextResponse.json(
        { error: 'No active layout found. Generate a layout first before refining.' },
        { status: 404 },
      );
    }

    const currentLayout = layoutResult.data;
    const currentImage: string | undefined = currentLayout.layout_data?.image;
    const currentMimeType: string =
      currentLayout.layout_data?.mimeType ?? 'image/png';

    /* ---------- 4. Build multi-part prompt with image + feedback ---------- */
    const textPrompt = buildRefinePrompt(feedback.trim());

    // Build contents: attach current layout image + text feedback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [];

    if (currentImage) {
      contentParts.push({
        inlineData: {
          mimeType: currentMimeType,
          data: currentImage,
        },
      });
    }

    contentParts.push({ text: textPrompt });

    console.log('[refine] Calling Gemini model:', IMAGE_MODEL);

    /* ---------- 5. Call Gemini ---------- */
    const response = await genai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: contentParts }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    /* ---------- 6. Parse response parts ---------- */
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
      console.warn('[refine] Gemini did not return an image. Text:', textContent);
      return NextResponse.json(
        {
          error:
            'AI did not generate a refined layout image. Please try again with clearer feedback.',
        },
        { status: 502 },
      );
    }

    /* ---------- 7. Parse reasoning + safety notes ---------- */
    const { reasoning, safetyNotes } = parseTextResponse(textContent);

    /* ---------- 8. Deactivate existing active layouts ---------- */
    await supabaseAdmin
      .from('layouts')
      .update({ is_active: false })
      .eq('event_id', eventId)
      .eq('is_active', true);

    /* ---------- 9. Insert new refined layout ---------- */
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
      console.error('[refine] Failed to save layout:', insertError);
      return NextResponse.json(
        { error: 'Failed to save refined layout' },
        { status: 500 },
      );
    }

    console.log('[refine] Refined layout saved:', layout.id);

    /* ---------- 10. Return result ---------- */
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
    console.error('[refine] Unhandled error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
