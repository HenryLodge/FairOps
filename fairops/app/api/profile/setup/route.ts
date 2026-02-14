import { getSessionForApi } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const ROLES = ['organizer', 'vendor'] as const;

export async function POST(request: Request) {
  try {
    const { auth } = await getSessionForApi();
    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const role = body.role;
    if (
      typeof role !== 'string' ||
      !ROLES.includes(role as (typeof ROLES)[number])
    ) {
      return NextResponse.json(
        { error: 'role is required and must be "organizer" or "vendor"' },
        { status: 400 }
      );
    }

    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim() || null : null;
    const orgName =
      typeof body.orgName === 'string' ? body.orgName.trim() || null : null;
    const businessName =
      typeof body.businessName === 'string'
        ? body.businessName.trim() || null
        : null;

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          auth0_sub: auth.user.sub,
          role,
          display_name: displayName,
          org_name: orgName,
          business_name: businessName,
          completed_at: now,
          updated_at: now,
        },
        {
          onConflict: 'auth0_sub',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('POST /api/profile/setup error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profile: data,
      redirectTo: role === 'organizer' ? '/dashboard' : '/vendor',
    });
  } catch (err) {
    console.error('POST /api/profile/setup error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to complete setup',
      },
      { status: 500 }
    );
  }
}
