import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidUuid } from '@/lib/uuid';
import { NextResponse } from 'next/server';

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
      return NextResponse.json(
        { error: 'Organizer role required' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Invalid vendor id' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Request body must include boothFee (number, lamports)' },
        { status: 400 }
      );
    }

    const boothFee = body.boothFee;
    if (
      typeof boothFee !== 'number' ||
      !Number.isInteger(boothFee) ||
      boothFee < 1
    ) {
      return NextResponse.json(
        { error: 'boothFee must be a positive integer (lamports)' },
        { status: 400 }
      );
    }

    const { data: vendor, error: fetchError } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update({
        status: 'approved',
        booth_fee: boothFee,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PUT /api/vendors/[id]/approve error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/vendors/[id]/approve error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to approve vendor',
      },
      { status: 500 }
    );
  }
}
