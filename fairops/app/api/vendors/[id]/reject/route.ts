import { supabaseAdmin } from '@/lib/supabase';
import { isValidUuid } from '@/lib/uuid';
import { NextResponse } from 'next/server';

export async function PUT(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Invalid vendor id' },
        { status: 400 }
      );
    }

    const { data: vendor, error: fetchError } = await supabaseAdmin
      .from('vendors')
      .select('id')
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
      .update({ status: 'rejected' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PUT /api/vendors/[id]/reject error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/vendors/[id]/reject error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to reject vendor',
      },
      { status: 500 }
    );
  }
}
