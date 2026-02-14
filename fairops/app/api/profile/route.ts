import { getSessionForApi } from '@/lib/auth';
import { getProfileByAuth0Sub } from '@/lib/profile';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { auth } = await getSessionForApi();
    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const profile = await getProfileByAuth0Sub(auth.user.sub);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('GET /api/profile error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to fetch profile',
      },
      { status: 500 }
    );
  }
}
