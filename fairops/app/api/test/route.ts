import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const CLAIMS_NAMESPACE = "localhost:3000";

/**
 * GET /api/test
 *
 * Protected API route that verifies the full auth pipeline end-to-end.
 *
 * - Unauthenticated → 401
 * - Authenticated   → 200 with user info and parsed roles
 */
export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = session.user;
    const roles: string[] =
      (user[`${CLAIMS_NAMESPACE}/roles`] as string[] | undefined) ?? [];

    return NextResponse.json({
      message: "Auth pipeline is working!",
      user: {
        sub: user.sub,
        name: user.name,
        email: user.email,
        picture: user.picture,
      },
      roles,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/test] Auth check failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
