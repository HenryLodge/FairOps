import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * List events from Supabase.
 * Auth can be added later via verifyAuth / requireRole.
 */
export async function GET() {
  try {
    const { auth } = await getSessionForApi();
    const organizerId =
      auth?.roles?.includes('organizer') ? auth.user.sub : null;

    let query = supabaseAdmin
      .from('events')
      .select('id, name, date, location, default_booth_fee')
      .order('created_at', { ascending: false })
      .limit(5);

    if (organizerId) {
      query = query.eq('organizer_id', organizerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase events fetch error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    console.error('GET /api/events error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * Create a new event. Requires name, date, location. Requires organizer role.
 */
export async function POST(request: Request) {
  try {
    const { auth } = await getSessionForApi();
    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    if (!auth.roles.includes('organizer')) {
      return NextResponse.json(
        { error: 'Organizer role required' },
        { status: 403 }
      );
    }
    const organizerId = auth.user.sub;

    const body = await request.json().catch(() => ({}));
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { name, date, location } = body as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    if (typeof date !== 'string' || !date.trim()) {
      return NextResponse.json(
        { error: 'date is required and must be an ISO date string (YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    const dateParsed = new Date(date);
    if (Number.isNaN(dateParsed.getTime())) {
      return NextResponse.json(
        { error: 'date must be a valid date string' },
        { status: 400 }
      );
    }
    if (typeof location !== 'string' || !location.trim()) {
      return NextResponse.json(
        { error: 'location is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const expected_attendance =
      typeof body.expected_attendance === 'number' &&
      Number.isInteger(body.expected_attendance)
        ? body.expected_attendance
        : null;
    const venue_width =
      typeof body.venue_width === 'number' && Number.isInteger(body.venue_width)
        ? body.venue_width
        : null;
    const venue_height =
      typeof body.venue_height === 'number' &&
      Number.isInteger(body.venue_height)
        ? body.venue_height
        : null;
    const description =
      typeof body.description === 'string' ? body.description : null;
    const organizer_wallet =
      typeof body.organizer_wallet === 'string' ? body.organizer_wallet : null;
    const default_booth_fee =
      typeof body.default_booth_fee === 'number' &&
      Number.isInteger(body.default_booth_fee) &&
      body.default_booth_fee > 0
        ? body.default_booth_fee
        : null;

    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        organizer_id: organizerId,
        name: name.trim(),
        date: date.trim().slice(0, 10),
        location: location.trim(),
        expected_attendance,
        venue_width,
        venue_height,
        description,
        organizer_wallet,
        default_booth_fee,
      })
      .select()
      .single();

    if (error) {
      console.error('POST /api/events error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/events error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to create event',
      },
      { status: 500 }
    );
  }
}
