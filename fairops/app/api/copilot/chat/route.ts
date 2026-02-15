import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { genai, CHAT_MODEL, buildChatSystemPrompt, type ChatEventContext } from '@/lib/gemini';
import { NextResponse } from 'next/server';

const MAX_HISTORY = 20;

/**
 * GET /api/copilot/chat?eventId=...
 * Returns chat history for the event. Requires organizer role.
 */
export async function GET(request: Request) {
  try {
    const { auth } = await getSessionForApi();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!auth.roles.includes('organizer')) {
      return NextResponse.json(
        { error: 'Organizer role required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId query parameter is required' },
        { status: 400 }
      );
    }

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, organizer_id')
      .eq('id', eventId)
      .single();

    if (!event || event.organizer_id !== auth.user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: rows } = await supabaseAdmin
      .from('copilot_messages')
      .select('id, role, content, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    const messages = (rows ?? []).map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      created_at: r.created_at,
    }));

    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[chat GET] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load chat' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/copilot/chat
 * Body: { eventId: string, message: string }
 * Sends user message, gets assistant reply via Gemini, persists both, returns reply.
 */
export async function POST(request: Request) {
  try {
    const { auth } = await getSessionForApi();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!auth.roles.includes('organizer')) {
      return NextResponse.json(
        { error: 'Organizer role required' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { eventId, message } = body as { eventId?: string; message?: string };

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      );
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'message is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();

    const [eventResult, vendorsResult, layoutResult] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select('id, name, date, location, expected_attendance, organizer_id')
        .eq('id', eventId)
        .single(),
      supabaseAdmin
        .from('vendors')
        .select('vendor_type, status')
        .eq('event_id', eventId),
      supabaseAdmin
        .from('layouts')
        .select('id')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (eventResult.error || !eventResult.data) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventResult.data;
    if (event.organizer_id !== auth.user.sub) {
      return NextResponse.json(
        { error: 'Not authorized to use chat for this event' },
        { status: 403 }
      );
    }

    const vendors = vendorsResult.data ?? [];
    const approved = vendors.filter((v) => v.status === 'approved').length;
    const pending = vendors.filter((v) => v.status === 'pending').length;
    const typeCounts: Record<string, number> = {};
    vendors.forEach((v) => {
      if (v.status === 'approved') {
        typeCounts[v.vendor_type] = (typeCounts[v.vendor_type] ?? 0) + 1;
      }
    });
    const vendorSummary = Object.entries(typeCounts)
      .map(([t, n]) => `${n} ${t}`)
      .join(', ') || undefined;

    const chatCtx: ChatEventContext = {
      name: event.name,
      date: event.date,
      location: event.location,
      expected_attendance: event.expected_attendance ?? null,
      totalVendors: vendors.length,
      approved,
      pending,
      layoutStatus: layoutResult.data ? 'generated' : 'none',
      vendorSummary,
    };

    const { data: historyRows } = await supabaseAdmin
      .from('copilot_messages')
      .select('role, content')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    const recent = (historyRows ?? []).slice(-MAX_HISTORY);
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = recent.map(
      (r) => ({
        role: r.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: r.content }],
      })
    );
    contents.push({ role: 'user', parts: [{ text: trimmedMessage }] });

    const systemPrompt = buildChatSystemPrompt(chatCtx);

    const response = await genai.models.generateContent({
      model: CHAT_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    const textPart = response.candidates?.[0]?.content?.parts?.find(
      (p): p is { text: string } => 'text' in p && typeof (p as { text?: string }).text === 'string'
    );
    const reply = textPart?.text?.trim() ?? '';

    if (!reply) {
      console.warn('[chat POST] Gemini returned empty reply');
      return NextResponse.json(
        { error: 'Assistant did not return a reply. Please try again.' },
        { status: 502 }
      );
    }

    const userInsert = await supabaseAdmin
      .from('copilot_messages')
      .insert({
        event_id: eventId,
        role: 'user',
        content: trimmedMessage,
      })
      .select('id')
      .single();

    const assistantInsert = await supabaseAdmin
      .from('copilot_messages')
      .insert({
        event_id: eventId,
        role: 'assistant',
        content: reply,
      })
      .select('id')
      .single();

    if (userInsert.error) console.error('[chat POST] user insert error:', userInsert.error);
    if (assistantInsert.error) console.error('[chat POST] assistant insert error:', assistantInsert.error);

    const messageId = assistantInsert.data?.id ?? null;

    return NextResponse.json({
      reply,
      messageId: messageId ?? null,
    });
  } catch (err) {
    console.error('[chat POST] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send message' },
      { status: 500 }
    );
  }
}
