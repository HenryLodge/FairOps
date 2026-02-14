# Lot Boss — Product Requirements Document

## Product Overview

**One-liner:** An AI-powered operations platform that replaces spreadsheets and cash handshakes for carnival, fair, and festival organizers.

**What it does:** A single dashboard where a carnival organizer can manage vendor applications, generate AI-optimized booth layouts, chat with an AI operations copilot, and collect vendor booth payments on Solana — all scoped to one event.

**Who it's for:** Carnival and fair organizers who currently manage vendor placement with spreadsheets, collect booth fees in cash or checks, and plan layouts by hand on paper maps.

**Why it matters:** The outdoor event industry is a $30B+ market running on decades-old workflows. Vendor placement directly impacts revenue (food near entrances = more impulse buys), safety (blocked fire lanes = liability), and attendee experience. There's no modern tooling for this.

---

## Scope

This is a **hackathon MVP** — one organizer, one event, demonstrating the full loop from vendor application through AI-optimized layout to on-chain payment. It is NOT a multi-tenant SaaS. Everything is scoped to a single event for demo purposes.

### What's In Scope
- Single event creation and management
- Vendor application submission and organizer review (approve/reject)
- AI-generated booth layout with placement reasoning and safety flags
- AI copilot chat with full event context
- Solana devnet booth fee payments with on-chain verification
- Auth0 role-based access (organizer view vs vendor view)

### What's Out of Scope
- Multi-event support / event listing
- Revenue splits or complex smart contracts
- Real-time collaborative editing
- Mobile-optimized layouts
- Email notifications
- File uploads (vendor logos, permits, etc.)
- Public-facing event pages for attendees

---

## User Roles

### Organizer
The primary user. Runs the carnival/fair. Logs in and sees the management dashboard.

**Can do:**
- Create and edit the event (name, date, location, attendance, venue dimensions)
- View all vendor applications
- Approve or reject vendor applications (sets booth fee on approval)
- Trigger AI layout optimization
- Refine layouts with natural language feedback
- Chat with the AI copilot about operations questions
- View payment status for all vendors
- See Solana Explorer links for confirmed transactions

**Cannot do:**
- Submit vendor applications
- Make payments

### Vendor
A booth operator who wants a spot at the fair. Logs in and sees the vendor portal.

**Can do:**
- Submit a vendor application (booth name, type, space needs, power, description)
- View their application status (pending / approved / rejected)
- See their assigned booth location and fee (after approval)
- Connect Phantom wallet and pay booth fee in SOL
- View their payment confirmation and transaction receipt

**Cannot do:**
- See other vendors' applications or payment details
- Access the layout optimizer or copilot
- Approve/reject anyone

---

## Features

### Feature 1: Authentication & Role-Based Access

**What the user sees:**
- A login button that redirects to Auth0's hosted login page
- After login, the app checks the user's role in their JWT and routes them to either the Organizer Dashboard or Vendor Portal
- If no role is assigned, they see a "Contact the organizer" message

**Technical requirements:**
- Auth0 Single Page Application with `@auth0/auth0-react` SDK
- Two Auth0 roles: `organizer` and `vendor`
- Custom Auth0 Post Login Action that injects roles into the JWT under namespace `https://lotboss.com/roles`
- Backend JWT verification on every API route using `jose` library
- `verifyAuth()` helper that extracts userId and roles from the token
- `requireRole()` helper that throws 403 if the user lacks the required role

**Acceptance criteria:**
- [ ] User can log in via Auth0 and be redirected back to the app
- [ ] Organizer sees the dashboard; vendor sees the portal — same login page, different views
- [ ] API routes return 401 without a valid JWT
- [ ] API routes return 403 when a vendor tries to access organizer-only endpoints

---

### Feature 2: Event Setup & Dashboard

**What the user sees:**
- Event creation form: name, date, location, expected attendance, venue dimensions (width × height in grid units), description
- After creation, the organizer lands on the main dashboard
- Dashboard displays four stat cards at the top: vendor count, revenue collected, layout status, safety flags
- Below the stats: vendor applications list, AI layout grid, AI reasoning panel, payment tracker

**Technical requirements:**
- `POST /api/events` — creates event, requires organizer role
- `GET /api/events/[id]` — returns "fat" response with event + vendors + active layout + computed stats in a single call
- `PUT /api/events/[id]` — updates event details, requires organizer role
- Stats are computed server-side from the vendors array (approved count, paid count, total revenue)
- Dashboard makes ONE API call on mount, not separate calls for each section

**Data model:**
```
events table:
  id, organizer_id, name, date, location, expected_attendance,
  venue_width, venue_height, description, created_at
```

**Acceptance criteria:**
- [ ] Organizer can create an event with all required fields
- [ ] Dashboard loads all data (event, vendors, layout, stats) in a single API call
- [ ] Stats update correctly when vendor statuses or payments change

---

### Feature 3: Vendor Management

**What the user sees:**

*Organizer side:*
- A table of vendor applications showing booth name, type, space needed, power needs, status
- Each pending vendor has "Approve" and "Reject" buttons
- On approve, a modal/input asks for the booth fee amount (in SOL)
- Approved vendors show green badge; rejected show red; pending show yellow

*Vendor side:*
- Application form with fields: booth name, vendor type (dropdown: food/game/merch/ride), description, space needed (number), power needed (checkbox)
- After submission, they see their current status
- After approval, they see their booth fee and a "Pay" button

**Technical requirements:**
- `POST /api/vendors` — submit application, requires vendor role, takes eventId + application fields
- `GET /api/vendors?eventId=xxx` — list vendors for an event (organizers see all, vendors see only their own)
- `PUT /api/vendors/[id]/approve` — organizer approves, sets booth_fee in request body (lamports)
- `PUT /api/vendors/[id]/reject` — organizer rejects

**Data model:**
```
vendors table:
  id, event_id, user_id, booth_name, vendor_type, description,
  space_needed, power_needed, status, booth_fee, payment_status,
  payment_tx, wallet_address, created_at
```

**Vendor types:** `food`, `game`, `merch`, `ride`
**Status values:** `pending`, `approved`, `rejected`
**Payment status values:** `unpaid`, `paid`, `confirmed`

**Acceptance criteria:**
- [ ] Vendor can submit an application tied to an event
- [ ] Organizer sees all applications and can approve (with fee) or reject
- [ ] Vendor sees their updated status after organizer action
- [ ] Approved vendor sees their booth fee amount

---

### Feature 4: AI Layout Optimizer (Hero Feature)

**What the user sees:**
- A button: "Optimize Layout with AI"
- Clicking it shows a loading state (3-8 seconds while Gemini processes)
- Results appear as a color-coded 2D grid where each cell is a booth slot
  - Food = warm yellow (#FEF3C7)
  - Games = light blue (#DBEAFE)
  - Merch = light indigo (#E0E7FF)
  - Rides = light pink (#FCE7F3)
  - Empty = light gray (#F9FAFB)
  - Entrances = marked at bottom corners
- Below the grid: AI reasoning panel listing why each vendor was placed where
- Below reasoning: safety notes highlighted in red (fire lanes, power concerns, crowd flow)
- Optional feedback: text input where organizer types changes ("move BBQ closer to entrance") and Gemini re-optimizes

**Technical requirements:**
- `POST /api/copilot/optimize` — organizer only
  1. Fetches event + approved vendors from Supabase
  2. Builds a detailed system prompt with event context, vendor details, and placement rules
  3. Calls Gemini 1.5 Pro with `responseMimeType: 'application/json'`
  4. Parses the returned JSON (with backtick-cleanup fallback)
  5. Deactivates any existing active layout for this event
  6. Saves new layout to `layouts` table with `is_active: true`
  7. Returns the layout object

- `POST /api/copilot/refine` — organizer only
  1. Takes eventId, feedback string, and current layout
  2. Builds a prompt that includes the current layout + feedback
  3. Returns an updated layout following the same JSON format

**Gemini prompt must include:**
- Event details (name, date, attendance, grid dimensions)
- Every approved vendor with: name, type, space needed, power needs, description, special requirements
- Explicit layout rules: entrance positions, emergency access lanes, food near entrances, separate competing vendors, power-heavy vendors on edges, kids zone grouping
- Exact JSON output format with placements array, reasoning array, and safetyNotes array

**Layout JSON format:**
```json
{
  "placements": [
    {
      "vendorId": "uuid",
      "boothName": "display name",
      "row": 0,
      "col": 2,
      "width": 2,
      "height": 1
    }
  ],
  "reasoning": ["string per placement decision"],
  "safetyNotes": ["string per safety concern"]
}
```

**Data model:**
```
layouts table:
  id, event_id, layout_data (JSONB), reasoning (TEXT),
  is_active (BOOLEAN), created_at
```

**Acceptance criteria:**
- [ ] Clicking "Optimize" calls Gemini and returns a valid layout within 10 seconds
- [ ] Layout renders as a color-coded grid matching venue dimensions
- [ ] Every approved vendor appears on the grid
- [ ] AI reasoning panel shows at least one reason per vendor placement
- [ ] Safety notes appear when relevant (fire concerns, blocked lanes, etc.)
- [ ] Layout is saved to database and persists on page reload
- [ ] (Stretch) Organizer can type feedback and get a refined layout

---

### Feature 5: AI Operations Copilot

**What the user sees:**
- A sliding chat panel (sidebar or modal) accessible from the dashboard
- Text input at the bottom, messages above
- Pre-built quick-action buttons: "Vendor mix analysis", "Safety checklist", "Generate vendor email", "Day-of timeline"
- AI responses reference actual event data (vendor names, counts, dates)

**Technical requirements:**
- `POST /api/copilot/chat` — organizer only
  1. Takes eventId, message string, and chatHistory array
  2. Loads full event context (event + vendors + active layout)
  3. Builds a system prompt injecting all event state
  4. Uses Gemini's `startChat()` with history for multi-turn context
  5. Returns the AI response as a string
  6. Saves both user message and AI response to copilot_messages table

**System prompt must include:**
- Full event details
- All vendors with their statuses and payment statuses
- Current layout status and reasoning (if generated)
- Explicit list of capabilities: operations planning, vendor mix analysis, compliance, marketing copy, timelines, pricing strategy

**Data model:**
```
copilot_messages table:
  id, event_id, role ('user' | 'assistant'), content, created_at
```

**Acceptance criteria:**
- [ ] Organizer can send a message and receive a context-aware response
- [ ] Response references actual vendor names and event details
- [ ] Chat maintains conversation history within the session
- [ ] Quick-action buttons populate the input with pre-written prompts
- [ ] (Stretch) Chat history persists across page reloads via database

---

### Feature 6: Solana Vendor Payments

**What the user sees:**

*Vendor side:*
- After approval, vendor sees: booth fee amount in SOL, "Connect Wallet" button (Phantom)
- After connecting, a "Pay Now" button appears with their wallet address displayed
- Clicking "Pay" opens Phantom for transaction signing
- Status updates: "Approve in Phantom..." → "Confirming on Solana..." → "Payment confirmed! ✓"
- On error, a "Retry" button appears

*Organizer side:*
- Payment tracker showing each approved vendor's payment status
- Confirmed payments show a green checkmark and a "View on Solana →" link to Solana Explorer
- Unpaid vendors show a yellow pending icon
- Total revenue collected displayed as a stat

**Technical requirements:**
- Frontend wallet integration using `@solana/wallet-adapter-react` with Phantom adapter
- Transaction built client-side: `SystemProgram.transfer()` from vendor wallet to organizer wallet
- Transaction signed by vendor via Phantom popup
- After on-chain confirmation, frontend calls `POST /api/payments/confirm`
- Backend verification:
  1. Fetches the transaction from Solana RPC by signature
  2. Checks that the transferred amount matches or exceeds the booth fee
  3. Updates vendor record: `payment_status = 'confirmed'`, saves `payment_tx` signature and `wallet_address`

**Network:** Solana devnet only. All amounts in lamports (1 SOL = 1,000,000,000 lamports).

**Acceptance criteria:**
- [ ] Vendor can connect Phantom wallet on devnet
- [ ] Vendor can pay booth fee and see the transaction confirmed
- [ ] Transaction is verifiable on Solana Explorer (devnet)
- [ ] Backend independently verifies the transaction amount on-chain
- [ ] Organizer dashboard updates to show "Paid" status with Explorer link
- [ ] Payment fails gracefully if wallet has insufficient SOL

---

## UI/UX Requirements

### Layout
- Sidebar navigation on left (dark background) with links to: Dashboard, Vendors, Layout, Copilot, Payments
- Main content area on right (light background)
- Copilot chat as a sliding panel from the right edge

### Color System
- Vendor type colors: food=#FEF3C7, game=#DBEAFE, merch=#E0E7FF, ride=#FCE7F3
- Status badges: approved=green, pending=yellow, rejected=red
- Payment badges: confirmed=green, unpaid=yellow
- Safety flags: red text with ⚠️ icon
- Primary actions: blue buttons
- Destructive actions: red buttons

### States Every Component Needs
- **Loading:** Spinner or skeleton for all async operations (especially Gemini calls which take 3-8s)
- **Empty:** Helpful message when no data exists yet ("No vendors yet — share the invite link")
- **Error:** Error message with a "Retry" button for all API failures
- **Success:** Brief confirmation (toast or inline) after mutations

### Responsive
- Not required for hackathon demo. Desktop-first, 1280px+ viewport.

---

## Demo Flow (Judging Walkthrough)

This is the exact sequence to show during the hackathon presentation:

1. **Login as organizer** → Auth0 login → lands on empty dashboard
2. **Show seeded event** → "Starlight County Fair" with 10 vendors pre-loaded
3. **Approve/reject vendors** → approve 8, reject 2, set booth fees
4. **Optimize layout** → click button → AI generates color-coded grid + reasoning + safety flags
5. **Chat with copilot** → ask "Do I have enough food vendors?" → get data-aware answer
6. **Switch to vendor account** → log out, log in as vendor → see approved booth + fee
7. **Pay booth fee** → connect Phantom → pay → see confirmation
8. **Switch back to organizer** → payment shows confirmed with Solana Explorer link
9. **Final dashboard shot** → everything in one place: vendors managed, layout optimized, payments tracked

---

## Technical Stack

| Layer        | Technology                          | Why                                           |
|-------------|--------------------------------------|-----------------------------------------------|
| Framework   | Next.js 14+ (App Router)            | Full-stack in one codebase, API routes = backend |
| Styling     | Tailwind CSS                         | Fast prototyping, no CSS files to manage       |
| Database    | Supabase (PostgreSQL)                | Zero-config Postgres, JS client, free tier     |
| Auth        | Auth0 (`@auth0/auth0-react`)         | Hackathon sponsor, handles all auth complexity |
| AI          | Google Gemini 1.5 Pro (`@google/generative-ai`) | Hackathon sponsor, structured JSON output mode |
| Blockchain  | Solana devnet (`@solana/web3.js`)    | Hackathon sponsor, fast + cheap transactions   |
| Wallet      | Phantom (`@solana/wallet-adapter-react`) | Most popular Solana wallet                   |

---

## Database Schema Summary

Four tables. All use UUID primary keys and TIMESTAMPTZ created_at.

| Table              | Purpose                      | Key Fields                                    |
|-------------------|------------------------------|-----------------------------------------------|
| events            | One event per demo           | organizer_id, name, date, venue_width/height  |
| vendors           | Vendor applications + status | event_id, booth_name, vendor_type, status, booth_fee, payment_status, payment_tx |
| layouts           | AI-generated layouts         | event_id, layout_data (JSONB), is_active      |
| copilot_messages  | Chat history                 | event_id, role, content                       |

---

## API Endpoints Summary

| Method | Endpoint                    | Auth        | Purpose                              |
|--------|-----------------------------|-------------|--------------------------------------|
| POST   | /api/events                 | Organizer   | Create event                         |
| GET    | /api/events/[id]            | Any auth'd  | Fetch event + vendors + layout + stats |
| PUT    | /api/events/[id]            | Organizer   | Update event                         |
| POST   | /api/vendors                | Vendor      | Submit application                   |
| GET    | /api/vendors?eventId=x      | Any auth'd  | List vendors (filtered by role)      |
| PUT    | /api/vendors/[id]/approve   | Organizer   | Approve + set fee                    |
| PUT    | /api/vendors/[id]/reject    | Organizer   | Reject vendor                        |
| POST   | /api/copilot/optimize       | Organizer   | Generate AI layout                   |
| POST   | /api/copilot/refine         | Organizer   | Refine layout with feedback          |
| POST   | /api/copilot/chat           | Organizer   | Send copilot message                 |
| POST   | /api/payments/confirm       | Any auth'd  | Verify Solana tx + update status     |
