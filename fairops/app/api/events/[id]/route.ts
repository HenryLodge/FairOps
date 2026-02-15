import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string | undefined): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Invalid event id' },
        { status: 400 }
      );
    }

    const [eventResult, vendorsResult, layoutResult] = await Promise.all([
      supabaseAdmin.from('events').select('*').eq('id', id).single(),
      supabaseAdmin
        .from('vendors')
        .select('*')
        .eq('event_id', id)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('layouts')
        .select('*')
        .eq('event_id', id)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (eventResult.error) {
      if (eventResult.error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }
      console.error('GET /api/events/[id] event fetch error:', eventResult.error);
      return NextResponse.json(
        { error: eventResult.error.message },
        { status: 500 }
      );
    }

    if (vendorsResult.error) {
      console.error('GET /api/events/[id] vendors fetch error:', vendorsResult.error);
      return NextResponse.json(
        { error: vendorsResult.error.message },
        { status: 500 }
      );
    }

    if (layoutResult.error) {
      console.error('GET /api/events/[id] layout fetch error:', layoutResult.error);
      return NextResponse.json(
        { error: layoutResult.error.message },
        { status: 500 }
      );
    }

    const event = eventResult.data;
    const vendors = vendorsResult.data ?? [];
    const layout = layoutResult.data;

    const stats = {
      totalVendors: vendors.length,
      approved: vendors.filter((v) => v.status === 'approved').length,
      pending: vendors.filter((v) => v.status === 'pending').length,
      rejected: vendors.filter((v) => v.status === 'rejected').length,
      escrowed: vendors.filter((v) => v.payment_status === 'escrowed').length,
      paid: vendors.filter((v) => v.payment_status === 'confirmed').length,
      refunded: vendors.filter((v) => v.payment_status === 'refunded').length,
      totalRevenue: vendors
        .filter((v) => v.payment_status === 'confirmed')
        .reduce((sum, v) => sum + Number(v.booth_fee ?? 0), 0),
      totalEscrowed: vendors
        .filter((v) => v.payment_status === 'escrowed')
        .reduce((sum, v) => sum + Number(v.booth_fee ?? 0), 0),
      layoutStatus: layout ? 'generated' as const : 'none' as const,
      safetyFlagsCount: layout?.layout_data?.safetyNotes?.length ?? 0,
    };

    return NextResponse.json({
      event,
      vendors,
      layout: layout ?? null,
      stats,
    });
  } catch (err) {
    console.error('GET /api/events/[id] error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to fetch event',
      },
      { status: 500 }
    );
  }
}

const ALLOWED_UPDATE_KEYS = [
  'name',
  'date',
  'location',
  'expected_attendance',
  'venue_width',
  'venue_height',
  'description',
  'organizer_wallet',
  'default_booth_fee',
  'venue_lat',
  'venue_lng',
  'venue_bounds',
  'venue_metrics',
  'drawn_shapes',
  'attractions',
] as const;

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { auth } = await getSessionForApi();
    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    if (!auth.roles.includes('organizer')) {
      console.error('PUT /api/events/[id] 403: role check failed. roles=', auth.roles, 'sub=', auth.user.sub);
      return NextResponse.json(
        { error: 'Organizer role required' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Invalid event id' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('events')
      .select('id, organizer_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    if (existing.organizer_id !== auth.user.sub) {
      console.error('PUT /api/events/[id] 403: ownership check failed. organizer_id=', existing.organizer_id, 'sub=', auth.user.sub);
      return NextResponse.json(
        { error: 'Not authorized to update this event' },
        { status: 403 }
      );
    }

    const update: Record<string, unknown> = {};
    for (const key of ALLOWED_UPDATE_KEYS) {
      if (key in body && body[key] !== undefined) {
        update[key] = body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      const { data: current } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      return NextResponse.json(current);
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const message = error.message ?? String(error);
      console.error('PUT /api/events/[id] Supabase error:', error.code, message, error.details);
      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update event';
    console.error('PUT /api/events/[id] catch:', err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
