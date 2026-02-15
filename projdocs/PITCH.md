# FairOps — Pitch Deck

### HackBeanpot 2026

---

## The Problem

Every year, thousands of fairs, carnivals, and festivals across the country are planned using **spreadsheets, paper maps, and cash handshakes**.

- **Organizers** waste hours manually placing vendors on hand-drawn lot maps with no optimization for foot traffic, safety, or revenue.
- **Vendors** have zero transparency into payment status — they hand over cash or checks and hope for the best.
- **Safety planning** is an afterthought — emergency lanes, fire access, and crowd flow are eyeballed, not engineered.
- **Communication** between organizers and vendors is scattered across emails, texts, and phone calls.

> The carnival and fair industry generates **$30B+ annually** in North America alone, yet the operations tooling hasn't evolved past the 1990s.

---

## The Solution

**FairOps** is an AI-powered operations platform for fairs, carnivals, and festivals — think *Cursor, but for carnival layout planning.*

We combine **AI venue optimization**, **blockchain-secured payments**, and a **modern management dashboard** into one platform that replaces the clipboard and the cash box.

---

## Key Features

### 1. AI-Powered Layout Generation
- Draw your venue boundary on an interactive map — any shape, any size.
- Our **Gemini AI copilot** generates an optimized, color-coded top-down layout placing every vendor, attraction, and emergency lane.
- Considers vendor type, space requirements, power needs, foot traffic, and **safety regulations**.
- Don't like something? Refine the layout with **natural language feedback** — *"Move the food vendors closer to the entrance"* — and the AI regenerates instantly.

### 2. Solana Escrow Payments
- Vendors pay booth fees in **SOL** through a transparent on-chain escrow system.
- Funds are held in escrow until the organizer approves the vendor — **no more sketchy cash handshakes**.
- If rejected, vendors are automatically refunded. Every transaction is verifiable on-chain.
- Real-time payment status tracking: unpaid → escrowed → confirmed → refunded.

### 3. Vendor Management Portal
- Vendors apply through a dedicated portal with booth name, type, space/power needs.
- Organizers review, approve, or reject applications from a unified dashboard.
- Status badges and payment tracking at a glance.

### 4. Interactive Venue Mapping
- Powered by **Leaflet**, organizers draw venue boundaries directly on a satellite map.
- Support for rectangles, polygons, circles, and polylines.
- Set grid dimensions, orientation markers, and venue metrics.
- The drawn boundary feeds directly into AI layout generation for pixel-perfect results.

### 5. AI Operations Copilot
- A conversational assistant that knows your event inside and out.
- Ask questions like *"How many food vendors do I have?"* or *"What should I charge for booth fees?"*
- Context-aware — it knows your vendor count, layout status, attendance projections, and more.

---

## How It Works

```
Organizer creates event → Draws venue boundary on map
        ↓
Vendors apply & pay booth fee (SOL → escrow)
        ↓
Organizer approves/rejects vendors (auto-refund on reject)
        ↓
AI generates optimized layout with all approved vendors
        ↓
Organizer refines layout with natural language feedback
        ↓
Event day — everything is planned, paid, and documented
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **Maps** | Leaflet + React-Leaflet |
| **Auth** | Auth0 (multi-role: organizer / vendor) |
| **Database** | Supabase (PostgreSQL) |
| **AI** | Google Gemini (`gemini-2.5-flash-image` for layout generation, `gemini-2.0-flash` for chat) |
| **Blockchain** | Solana (devnet), Phantom Wallet, `@solana/web3.js` |
| **Rendering** | `@napi-rs/canvas` for server-side boundary image generation |

---

## Demo Flow

1. **Login** as an organizer via Auth0
2. **Create a new fair** — name, date, location, attendance, default booth fee
3. **Draw the venue boundary** on the interactive satellite map
4. **Switch to vendor view** — apply for a booth, connect Phantom wallet, pay escrow
5. **Back to organizer** — approve the vendor, watch payment confirm on-chain
6. **Hit "Optimize Layout"** — watch Gemini generate a full color-coded venue map
7. **Refine** — type *"Add an emergency exit on the north side"* and regenerate
8. **Chat with the copilot** — *"What's my total expected revenue?"*

---

## What Makes FairOps Different

| Traditional Fair Planning | FairOps |
|--------------------------|---------|
| Paper maps & whiteboards | AI-generated optimized layouts |
| Cash & check payments | Solana escrow — transparent & instant |
| Manual vendor tracking | Digital application & approval workflow |
| Safety as afterthought | AI enforces emergency lanes & spacing |
| Phone calls & emails | Unified dashboard + AI copilot |

---

## Sponsor Technology Integration

- **Auth0** — Secure multi-role authentication (organizer vs. vendor personas) with seamless login/signup flow
- **Google Gemini AI** — Powers layout generation (multimodal image output), layout refinement (image-to-image with feedback), and conversational copilot
- **Solana** — On-chain escrow payments between vendors and organizers with Phantom wallet integration

---

## Market Opportunity

- **~3,000+** county and state fairs in the US alone
- **Thousands more** festivals, carnivals, farmers markets, and pop-up events annually
- Current tools: literally spreadsheets and graph paper
- FairOps can expand to **any temporary venue** — concert festivals, food truck rallies, holiday markets, trade shows

---

## Team

**Built at HackBeanpot 2026**

---

## Future Vision

- **Multi-event management** with cross-event vendor ratings
- **Mainnet Solana** payments with real revenue splits via smart contracts
- **Real-time event monitoring** with IoT crowd density sensors
- **Vendor marketplace** — vendors browse and apply to upcoming fairs
- **Mobile app** for on-the-ground event day operations
- **Insurance & compliance** integration for automated safety certification

---

## The Ask

We're building the **operating system for the fair industry** — a market that's massive, underserved, and ready for disruption.

> **FairOps: Stop guessing. Start optimizing.**
