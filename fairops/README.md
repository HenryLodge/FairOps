# FairOps — Next.js app

This folder is the **Next.js 16** application for FairOps. All commands and deployment use this directory as the project root.

## Quick start

```bash
npm install
npm run dev
```

Open [https://fair-ops.vercel.app](https://fair-ops.vercel.app). You must configure environment variables (Supabase, Auth0, Gemini, Solana) in `.env.local` before the app works fully. See the [repository README](../README.md) for full setup and deployment.

## Scripts

- `npm run dev` — Development server
- `npm run build` — Production build
- `npm run start` — Run production build locally
- `npm run lint` — Run ESLint

## Deploy

When deploying (e.g. Vercel), set the **Root Directory** to `fairops` so the build uses this `package.json` and Next.js is detected correctly.
