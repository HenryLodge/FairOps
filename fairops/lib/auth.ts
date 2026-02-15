import { auth0 } from "./auth0";
import { getProfileByAuth0Sub } from "./profile";
import { redirect } from "next/navigation";

/**
 * Namespace used for custom claims added via Auth0 Post Login Action.
 * Must match the namespace configured in your Auth0 Action.
 */
const CLAIMS_NAMESPACE = "https://fair-ops.vercel.app";

async function resolveRoles(
  user: { sub: string; [key: string]: unknown }
): Promise<AppRole[]> {
  const jwtRoles: AppRole[] =
    (user[`${CLAIMS_NAMESPACE}/roles`] as AppRole[] | undefined) ??
    (user["fair-ops.vercel.app/roles"] as AppRole[] | undefined) ??
    [];
  if (jwtRoles.length > 0) return jwtRoles;
  const profile = await getProfileByAuth0Sub(user.sub);
  if (profile?.role === "organizer" || profile?.role === "vendor") {
    return [profile.role];
  }
  return [];
}

export type AppRole = "organizer" | "vendor";

export interface AuthResult {
  user: {
    sub: string;
    name?: string;
    email?: string;
    picture?: string;
    [key: string]: unknown;
  };
  roles: AppRole[];
}

/**
 * Verify that the current request has an authenticated session.
 *
 * - If authenticated, returns the user object and their roles (extracted from
 *   the custom `https://lotboss.com/roles` claim).
 * - If not authenticated, redirects to `/auth/login` (default) or a custom path.
 *
 * Usage (Server Component / Route Handler):
 * ```ts
 * const { user, roles } = await verifyAuth();
 * ```
 */
export async function verifyAuth(
  loginUrl = "/auth/login"
): Promise<AuthResult> {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    redirect(loginUrl);
  }

  const user = session.user;
  const roles = await resolveRoles(user as { sub: string; [key: string]: unknown });
  return { user: user as AuthResult["user"], roles };
}

/**
 * Require the authenticated user to have **at least one** of the specified roles.
 *
 * - Calls `verifyAuth()` first (redirects to login if unauthenticated).
 * - If the user lacks every listed role, redirects to `unauthorizedUrl`
 *   (defaults to `/`).
 *
 * Usage (Server Component / Route Handler):
 * ```ts
 * const { user, roles } = await requireRole("organizer");
 * const { user, roles } = await requireRole("organizer", "vendor");
 * ```
 */
export async function requireRole(
  ...requiredRoles: [AppRole, ...AppRole[]]
): Promise<AuthResult> {
  const auth = await verifyAuth();

  const hasRole = requiredRoles.some((role) => auth.roles.includes(role));

  if (!hasRole) {
    redirect("/");
  }

  return auth;
}

/**
 * Get session for API route handlers. Does not redirect; returns null when unauthenticated.
 * Use this in API routes and return 401/403 JSON as needed.
 */
export async function getSessionForApi(): Promise<
  | { auth: { user: { sub: string; [key: string]: unknown }; roles: string[] } }
  | { auth: null }
> {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    return { auth: null };
  }

  const user = session.user;
  const roles = await resolveRoles(user as { sub: string; [key: string]: unknown });
  return {
    auth: {
      user: user as { sub: string; [key: string]: unknown },
      roles,
    },
  };
}
