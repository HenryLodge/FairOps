import { Auth0Client } from '@auth0/nextjs-auth0/server';
import * as jose from 'jose';

/** Claim key the app uses for roles; must match CLAIMS_NAMESPACE + "/roles" in auth.ts and page.tsx */
export const ROLES_CLAIM = 'https://fair-ops.vercel.app/roles';

function getRolesFromPayload(payload: jose.JWTPayload): string[] {
  const roles =
    payload[ROLES_CLAIM] ??
    (payload as Record<string, unknown>)['fair-ops.vercel.app/roles'] ??
    (() => {
      for (const k of Object.keys(payload)) {
        if (k.endsWith('/roles')) {
          return (payload as Record<string, unknown>)[k];
        }
      }
      return undefined;
    })();
  return Array.isArray(roles) ? roles : [];
}

export const auth0 = new Auth0Client({
  beforeSessionSaved: async (session, idToken) => {
    if (!idToken) return session;
    try {
      const payload = jose.decodeJwt(idToken);
      session.user[ROLES_CLAIM] = getRolesFromPayload(payload);
    } catch {
      session.user[ROLES_CLAIM] = [];
    }
    return session;
  },
});
