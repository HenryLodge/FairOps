import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidUuid } from '@/lib/uuid';
import { NextResponse } from 'next/server';
import {
  getConnection,
  getEscrowKeypair,
} from '@/lib/solana';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

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

    // Fetch vendor with event info to get organizer_wallet
    const { data: vendor, error: fetchError } = await supabaseAdmin
      .from('vendors')
      .select('*, event:events(id, organizer_wallet)')
      .eq('id', id)
      .single();

    if (fetchError || !vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Release escrow funds to organizer if payment was escrowed
    let releaseTx: string | null = null;
    if (vendor.payment_status === 'escrowed' && vendor.booth_fee) {
      const eventData = vendor.event as { id: string; organizer_wallet: string | null } | null;
      const organizerWallet = eventData?.organizer_wallet;
      if (!organizerWallet) {
        return NextResponse.json(
          { error: 'Organizer wallet not configured for this event. Set it in the dashboard first.' },
          { status: 400 }
        );
      }

      try {
        const connection = getConnection();
        const escrowKeypair = getEscrowKeypair();
        const organizerPubkey = new PublicKey(organizerWallet);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: escrowKeypair.publicKey,
            toPubkey: organizerPubkey,
            lamports: Number(vendor.booth_fee),
          })
        );

        releaseTx = await sendAndConfirmTransaction(connection, transaction, [escrowKeypair], {
          commitment: 'confirmed',
        });
      } catch (solErr) {
        console.error('PUT /api/vendors/[id]/approve: escrow release failed:', solErr);
        return NextResponse.json(
          {
            error: `Escrow release failed: ${solErr instanceof Error ? solErr.message : 'Unknown error'}`,
          },
          { status: 500 }
        );
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: 'approved',
      booth_fee: boothFee,
    };
    if (releaseTx) {
      updatePayload.payment_status = 'confirmed';
      updatePayload.payment_tx = releaseTx;
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(updatePayload)
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
