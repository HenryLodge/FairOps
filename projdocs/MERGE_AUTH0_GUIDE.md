# Merge Guide: Auth0 Branch + Main (Features)

Use this doc when merging the Auth0 integration branch with the branch that has dashboard, events API, and vendors API. Resolve conflicts file-by-file as below so both Auth0 and existing features are preserved.

---

## Order of operations

1. Agree on merge order (see **Merge strategy** below).
2. Run the merge (e.g. merge Auth0 branch into `main`, or into an integration branch).
3. Resolve conflicts using the **Per-file resolution** section for each conflicted file.
4. Run **Post-merge checks**.

---

## Merge strategy

**Option A – Merge partner's Auth0 branch into your branch (or main), then resolve once**

- One of you creates a branch (e.g. `integration/auth0-and-features`).
- Merge the Auth0 branch into it (or into `main` first, then you merge main into your branch).
- Resolve conflicts once using this guide.
- Both of you then work from the same post-merge branch/main.

**Option B – Partner merges to main first; you merge main into your branch and resolve**

- Partner merges Auth0 to `main`.
- You merge `main` into your feature branch, resolve conflicts per this guide, then push (or merge your branch into `main`).

---

## Per-file resolution

### fairops/app/page.tsx

| | |
|---|---|
| **Take from Auth0 branch** | Session check, read roles from `localhost:3000/roles`, redirect to `/dashboard` (organizer) or `/vendor` (vendor), and unauthenticated view with `<LoginButton />`. |
| **Keep from our branch** | "Lot Boss" branding and any unauthenticated CTA. |
| **Final result** | Keep Auth0 session + role redirect logic. Keep "Lot Boss" as the title/heading on the unauthenticated view. Use Auth0's `<LoginButton />` (or link to `/auth/login`). Partner's structure and auth, our product name and copy for logged-out users. |

### fairops/app/layout.tsx

| | |
|---|---|
| **Take from Auth0 branch** | `<Auth0Provider>` wrap and any Auth0-specific setup. |
| **Keep from our branch** | Geist fonts and current metadata. |
| **Final result** | Use Auth0's layout (with Auth0Provider). Add back Geist font setup and `metadata` (e.g. title "Lot Boss" or "FairOps") if desired, so both Auth0 and our app shell are present. |

### fairops/app/globals.css

| | |
|---|---|
| **Take from Auth0 branch** | Full dark theme and any Auth0-related styles (buttons, profile, etc.). |
| **Keep from our branch** | Tailwind theme variables and any dashboard-specific vars (e.g. `--font-geist-sans` if used). |
| **Final result** | Start from Auth0's `globals.css`. Then re-add any Tailwind `@theme` or variables the dashboard/layout rely on (from current `fairops/app/globals.css`). If there are no critical custom variables, taking Auth0's file as-is is fine. |

### fairops/app/dashboard/page.tsx

| | |
|---|---|
| **Take from Auth0 branch** | `requireRole("organizer")` and any profile/role badge and placeholder content. |
| **Keep from our branch** | `<DashboardContent />` (events, stat cards, map, etc.). |
| **Final result** | Keep `requireRole("organizer")` at the top (from Auth0). Render existing dashboard content: `<DashboardContent />`. Optionally keep profile/role badge from Auth0 above or beside the dashboard. Do **not** keep the Auth0 placeholder text instead of `<DashboardContent />`. |

### fairops/package.json

| | |
|---|---|
| **Final result** | Merge `dependencies` and `devDependencies` so both Auth0 and our deps are present. We have `@supabase/supabase-js`, `lucide-react`, etc.; partner adds `@auth0/nextjs-auth0`. No need to remove anything; only add what's missing. Manually merge the `dependencies` object if needed. |

### .gitignore

| | |
|---|---|
| **Final result** | Ensure `.env` and `.env.*` (or equivalent) are ignored. Either version is fine; pick one and move on. |

---

## Post-merge checks

After resolving all conflicts:

1. Run `npm install` in `fairops` (so Auth0 and all existing deps are installed).
2. Ensure env vars are documented: Auth0 vars (from partner) plus existing Supabase (and any other) vars. Use `.env.example` or this guide so both of you have the same env shape.
3. Hit `/` unauthenticated: see "Lot Boss" and login.
4. Log in as organizer: redirect to `/dashboard` and see the dashboard (DashboardContent) with events/stats.
5. Log in as vendor: redirect to `/vendor` and see partner's vendor placeholder (vendor application UI can be added there later).
6. Optionally call `GET /api/test` with a logged-in session to confirm Auth0 in APIs. Events/Vendors APIs can stay without auth until session checks are added later.

---

## Pre-merge reminders (our side)

- Avoid further changes to `app/page.tsx`, `app/layout.tsx`, and `app/globals.css` until after the merge.
- Dashboard content stays in `components/dashboard/DashboardContent.tsx`; do not create files at `lib/auth.ts`, `lib/auth0.ts`, `middleware.ts`, `app/vendor/page.tsx`, or `app/api/test/route.ts` before the merge (partner adds those).

Share this guide with your partner so you both resolve the same way.
