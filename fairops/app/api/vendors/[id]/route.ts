import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidUuid } from '@/lib/uuid';
import { NextResponse } from 'next/server';

const VENDOR_TYPES = ['food', 'game', 'merch', 'ride'] as const;
const ALLOWED_UPDATE_KEYS = [
  'booth_name',
  'vendor_type',
  'description',
  'space_needed',
  'power_needed',
] as const;

/**
 * PUT /api/vendors/[id] — vendor can update their own application info.
 * Only the owning vendor (user_id matches) can update; only allowed fields are persisted.
 */
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
    if (!auth.roles.includes('vendor')) {
      return NextResponse.json(
        { error: 'Vendor role required' },
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

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('vendors')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Vendor application not found' },
        { status: 404 }
      );
    }

    if (existing.user_id !== auth.user.sub) {
      return NextResponse.json(
        { error: 'Not authorized to update this application' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {};
    if (body.booth_name !== undefined) {
      const v = typeof body.booth_name === 'string' ? body.booth_name.trim() : '';
      if (!v) {
        return NextResponse.json(
          { error: 'booth_name must be a non-empty string' },
          { status: 400 }
        );
      }
      update.booth_name = v;
    }
    if (body.vendor_type !== undefined) {
      const v = body.vendor_type;
      if (
        typeof v !== 'string' ||
        !VENDOR_TYPES.includes(v as (typeof VENDOR_TYPES)[number])
      ) {
        return NextResponse.json(
          { error: 'vendor_type must be one of: food, game, merch, ride' },
          { status: 400 }
        );
      }
      update.vendor_type = v;
    }
    if (body.description !== undefined) {
      update.description =
        typeof body.description === 'string' ? body.description : null;
    }
    if (body.space_needed !== undefined) {
      const n = Number(body.space_needed);
      if (!Number.isInteger(n) || n < 1) {
        return NextResponse.json(
          { error: 'space_needed must be a positive integer' },
          { status: 400 }
        );
      }
      update.space_needed = n;
    }
    if (body.power_needed !== undefined) {
      update.power_needed = Boolean(body.power_needed);
    }

    if (Object.keys(update).length === 0) {
      const { data: current } = await supabaseAdmin
        .from('vendors')
        .select('*')
        .eq('id', id)
        .single();
      return NextResponse.json(current);
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PUT /api/vendors/[id] error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/vendors/[id] catch:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to update application',
      },
      { status: 500 }
    );
  }
}
