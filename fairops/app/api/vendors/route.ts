import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidUuid } from '@/lib/uuid';
import { NextResponse } from 'next/server';
import { getConnection, getEscrowPublicKey, verifyEscrowTransfer } from '@/lib/solana';

const VENDOR_TYPES = ['food', 'game', 'merch', 'ride'] as const;

export async function GET(request: Request) {
  try {
    const { auth } = await getSessionForApi();
    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get('eventId') ?? undefined;

    // Vendor "my applications": no eventId → return all applications for this vendor with event info
    if (!eventIdParam || !isValidUuid(eventIdParam)) {
      if (!auth.roles.includes('vendor')) {
        return NextResponse.json(
          { error: 'Valid eventId (UUID) is required' },
          { status: 400 }
        );
      }
      const { data: vendorRows, error: vendorError } = await supabaseAdmin
        .from('vendors')
        .select(`
          *,
          event:events(id, name, date, location)
        `)
        .eq('user_id', auth.user.sub)
        .order('created_at', { ascending: false });

      if (vendorError) {
        console.error('GET /api/vendors (mine) error:', vendorError);
        return NextResponse.json(
          { error: vendorError.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ vendors: vendorRows ?? [] });
    }

    const eventId = eventIdParam;
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

    const raw = data ?? [];
    const vendors =
      auth.roles.includes('organizer')
        ? raw
        : raw.filter((v: { user_id?: string | null }) => v.user_id === auth.user.sub);
    return NextResponse.json({ vendors });
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
    const userId = auth.user.sub;

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

    // --- Escrow payment fields ---
    const txSignature = typeof body.txSignature === 'string' ? body.txSignature : null;
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : null;
    const boothFee = typeof body.boothFee === 'number' && Number.isInteger(body.boothFee) && body.boothFee > 0
      ? body.boothFee
      : null;

    let paymentStatus = 'unpaid';
    let paymentTx: string | null = null;

    // Verify the on-chain transaction if provided
    if (txSignature && walletAddress && boothFee) {
      try {
        const connection = getConnection();
        const escrowPubkey = getEscrowPublicKey();
        await verifyEscrowTransfer(connection, {
          signature: txSignature,
          expectedLamports: boothFee,
          escrowWallet: escrowPubkey,
        });
        paymentStatus = 'escrowed';
        paymentTx = txSignature;
      } catch (verifyErr) {
        console.error('POST /api/vendors: escrow verification failed:', verifyErr);
        return NextResponse.json(
          {
            error: `Escrow verification failed: ${verifyErr instanceof Error ? verifyErr.message : 'Unknown error'}`,
          },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert({
        event_id: eventId,
        user_id: userId,
        booth_name: boothName.trim(),
        vendor_type: vendorType,
        description,
        space_needed: spaceNeeded,
        power_needed: powerNeeded,
        booth_fee: boothFee,
        payment_status: paymentStatus,
        payment_tx: paymentTx,
        wallet_address: walletAddress,
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
