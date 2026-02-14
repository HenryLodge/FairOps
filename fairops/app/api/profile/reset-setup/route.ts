import { NextResponse } from "next/server";
import { getSessionForApi } from "@/lib/auth";
import { deleteProfileByAuth0Sub } from "@/lib/profile";

/**
 * POST /api/profile/reset-setup
 *
 * Deletes the current user's profile so they can go through organizer/vendor setup again.
 * Requires authentication.
 */
export async function POST() {
  const result = await getSessionForApi();

  if (!result.auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ok = await deleteProfileByAuth0Sub(result.auth.user.sub);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to reset setup" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
