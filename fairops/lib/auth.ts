import { auth0 } from "./auth0";
import { redirect } from "next/navigation";

/**
 * Namespace used for custom claims added via Auth0 Post Login Action.
 * Must match the namespace configured in your Auth0 Action.
 */
const CLAIMS_NAMESPACE = "localhost:3000";

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
  const roles: AppRole[] =
    (user[`${CLAIMS_NAMESPACE}/roles`] as AppRole[] | undefined) ?? [];

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
