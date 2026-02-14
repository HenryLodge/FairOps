import { supabaseAdmin } from '@/lib/supabase';
import { isValidUuid } from '@/lib/uuid';
import { NextResponse } from 'next/server';

const VENDOR_TYPES = ['food', 'game', 'merch', 'ride'] as const;
const STUB_USER_ID: string | null = null;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId') ?? undefined;
    if (!isValidUuid(eventId)) {
      return NextResponse.json(
        { error: 'Valid eventId (UUID) is required' },
        { status: 400 }
      );
    }

    const eventCheck = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();
    if (eventCheck.error || !eventCheck.data) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('GET /api/vendors error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ vendors: data ?? [] });
  } catch (err) {
    console.error('GET /api/vendors error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to list vendors',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const eventId = body.eventId;
    if (!isValidUuid(eventId)) {
      return NextResponse.json(
        { error: 'Valid eventId (UUID) is required' },
        { status: 400 }
      );
    }

    const vendorType = body.vendorType;
    if (
      typeof vendorType !== 'string' ||
      !VENDOR_TYPES.includes(vendorType as (typeof VENDOR_TYPES)[number])
    ) {
      return NextResponse.json(
        { error: 'vendorType must be one of: food, game, merch, ride' },
        { status: 400 }
      );
    }

    const boothName = body.boothName;
    if (typeof boothName !== 'string' || !boothName.trim()) {
      return NextResponse.json(
        { error: 'boothName is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const eventCheck = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();
    if (eventCheck.error || !eventCheck.data) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const description =
      typeof body.description === 'string' ? body.description : null;
    let spaceNeeded = 1;
    if (typeof body.spaceNeeded === 'number' && Number.isInteger(body.spaceNeeded) && body.spaceNeeded >= 1) {
      spaceNeeded = body.spaceNeeded;
    }
    const powerNeeded = Boolean(body.powerNeeded);

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert({
        event_id: eventId,
        user_id: STUB_USER_ID,
        booth_name: boothName.trim(),
        vendor_type: vendorType,
        description,
        space_needed: spaceNeeded,
        power_needed: powerNeeded,
      })
      .select()
      .single();

    if (error) {
      console.error('POST /api/vendors error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/vendors error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to create vendor',
      },
      { status: 500 }
    );
  }
}
