# FairOps — Project Story

## Inspiration

We've all been to a county fair or local festival and noticed the chaos behind the scenes — vendors arguing over booth placement, organizers juggling paper maps and spreadsheets, and payments handled with literal cash handshakes. The carnival and fair industry generates over **$30 billion annually** in North America alone, yet the operations tooling hasn't evolved past the 1990s. We thought: what if we could bring modern AI, blockchain transparency, and real-time collaboration to the people who actually run these events? That question — plus the realization that nobody has seriously tried to digitize this space — became **FairOps**: *Cursor, but for carnival layout planning.*

## What it does

FairOps is an all-in-one operations platform for fairs, carnivals, and festivals. It serves two audiences:

- **Organizers** create events, draw venue boundaries on an interactive satellite map, manage vendor applications, and generate AI-optimized booth layouts — all from a single dashboard. They can refine layouts with plain English feedback like *"Move the food trucks closer to the entrance"* and chat with an AI copilot that knows their event inside and out.

- **Vendors** apply for booth space through a dedicated portal, connect their Phantom wallet, and pay booth fees in SOL through an on-chain escrow system. Funds are held transparently until the organizer approves or rejects the application — no more hoping the check clears.

The AI doesn't just place booths randomly. It considers vendor type, space requirements, power needs, foot traffic patterns, and safety regulations — generating color-coded layouts with emergency lanes, fire access paths, and crowd-flow optimization baked in.

## How we built it

We built FairOps on **Next.js 16** with the App Router, **React 19**, and **TypeScript**, styled with **Tailwind CSS 4**. The stack breaks down into four pillars:

- **AI Layer** — Google **Gemini** powers two features: `gemini-2.5-flash-image` generates venue layout images from drawn boundaries and vendor data, while `gemini-2.0-flash` drives the conversational copilot. We render drawn venue shapes into reference images server-side using `@napi-rs/canvas`, then feed them into Gemini as multimodal input alongside detailed prompts covering every vendor, attraction, and safety constraint.

- **Blockchain Layer** — **Solana** (devnet) handles escrow payments via `@solana/web3.js` and **Phantom Wallet**. Vendors send SOL to a server-managed escrow wallet; the server verifies the transaction on-chain with retry logic. On approval, funds release to the organizer's wallet. On rejection, they auto-refund to the vendor. Every transaction is verifiable.

- **Auth & Data** — **Auth0** manages multi-role authentication (organizer vs. vendor) with JWT-based role claims and database profile fallback. **Supabase** (PostgreSQL) stores events, vendor applications, AI-generated layouts, chat history, and user profiles.

- **Maps** — **Leaflet** with `react-leaflet` and `leaflet-draw` powers the interactive venue mapper. Organizers draw polygons, rectangles, and circles on a satellite view; the app calculates real-world dimensions in meters and feeds the boundary directly into AI layout generation.

We built 13 API routes, 19 components, and 10 utility libraries — all wired together with role-based access control, per-user wallet isolation, and real-time state management.

## Challenges we ran into

- **Gemini image generation consistency** — Getting Gemini to produce pixel-accurate, properly scaled venue layouts was an iterative battle. Early outputs ignored boundary shapes, placed vendors outside the lot, or forgot emergency lanes entirely. We solved this by rendering drawn shapes into high-fidelity reference images server-side and engineering multi-part prompts that constrain the AI with exact vendor counts, dimensions, and safety rules.

- **Solana transaction verification timing** — On-chain transaction confirmation doesn't happen instantly. Our first attempts failed because the server checked the transaction before the network confirmed it. We implemented a retry mechanism (up to 5 attempts over 15 seconds) to poll for confirmation, which solved the race condition between client-side signing and server-side verification.

- **Per-user wallet isolation** — When multiple users share a browser (for demo purposes), Phantom wallet state bled between sessions. We built a custom `WalletProvider` that keys localStorage entries to the Auth0 user ID, plus a `WalletGuard` that verifies the connected public key matches the expected user — preventing cross-user wallet confusion.

- **Server-side canvas rendering** — Node.js doesn't have a native Canvas API. We needed `@napi-rs/canvas` to render venue boundary images on the server for Gemini input. Getting it working with Next.js 16's server components and edge runtime constraints required careful configuration and fallback handling.

- **Leaflet + SSR** — Leaflet assumes a browser DOM. We had to dynamically import the entire map component with `ssr: false` and handle hydration mismatches between server and client rendering.

## Accomplishments that we're proud of

- **The full AI loop works end-to-end.** You draw a boundary, add vendors, hit "Optimize Layout," and Gemini generates a realistic, color-coded venue map — then you refine it with natural language and it regenerates. It genuinely feels like having an AI coworker who understands event planning.

- **Real on-chain escrow payments.** Vendor → escrow → organizer (or refund) is fully functional on Solana devnet. Every payment is verifiable on-chain. This isn't a mock — it's a real Web3 use case that makes practical sense.

- **The interactive venue mapper.** Drawing arbitrary venue shapes on a satellite map, seeing real-time metrics in meters, and feeding that directly into AI layout generation feels polished and powerful.

- **Role-based dual-persona experience.** The same app serves organizers and vendors with completely different dashboards, permissions, and workflows — unified under one authentication system.

- **The AI copilot's contextual awareness.** It knows your vendor count, payment statuses, layout state, attendance projections, and attraction lineup. Ask it *"What should I charge for booth fees?"* and it gives a data-informed answer.

## What we learned

- **Multimodal AI is incredibly powerful but needs guardrails.** Gemini can generate impressive layout images, but only when you give it extremely specific constraints. Vague prompts produce vague outputs. The quality of our reference images and prompt engineering made all the difference.

- **Blockchain has real utility beyond speculation.** Escrow payments between strangers (organizers and vendors) is a textbook use case for on-chain transparency. The trust problem in the fair industry is real, and Solana solves it elegantly.

- **Next.js 16 + React 19 is a powerful combination** — but server components, client components, and dynamic imports need careful orchestration, especially when integrating browser-dependent libraries like Leaflet and Solana wallet adapters.

- **Building for a niche market forces clarity.** When your users are county fair organizers — not developers — every feature has to justify itself in plain terms. That constraint made us build something genuinely useful instead of technically impressive for its own sake.

## What's next for FairOps

- **Mainnet Solana payments** with real revenue splits via smart contracts — moving beyond devnet to handle actual money.
- **Vendor marketplace** where vendors browse upcoming fairs and apply across events, with cross-event ratings and reputation scores.
- **Real-time event monitoring** with IoT crowd density sensors feeding into the AI copilot for live safety alerts.
- **Mobile app** for on-the-ground operations on event day — vendor check-in, real-time layout updates, and emergency communication.
- **Multi-event management** so organizers running a circuit of fairs can manage their entire season from one dashboard.
- **Insurance and compliance integration** for automated safety certification based on AI-generated layouts and local regulations.
