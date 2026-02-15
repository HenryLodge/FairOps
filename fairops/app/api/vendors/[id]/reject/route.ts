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
  _request: Request,
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

    // Refund escrowed SOL back to the vendor's wallet
    let refundTx: string | null = null;
    if (vendor.payment_status === 'escrowed' && vendor.wallet_address && vendor.booth_fee) {
      try {
        const connection = getConnection();
        const escrowKeypair = getEscrowKeypair();
        const vendorPubkey = new PublicKey(vendor.wallet_address);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: escrowKeypair.publicKey,
            toPubkey: vendorPubkey,
            lamports: Number(vendor.booth_fee),
          })
        );

        refundTx = await sendAndConfirmTransaction(connection, transaction, [escrowKeypair], {
          commitment: 'confirmed',
        });
      } catch (solErr) {
        console.error('PUT /api/vendors/[id]/reject: escrow refund failed:', solErr);
        return NextResponse.json(
          {
            error: `Escrow refund failed: ${solErr instanceof Error ? solErr.message : 'Unknown error'}`,
          },
          { status: 500 }
        );
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: 'rejected',
    };
    if (refundTx) {
      updatePayload.payment_status = 'refunded';
      updatePayload.payment_tx = refundTx;
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(updatePayload)
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
