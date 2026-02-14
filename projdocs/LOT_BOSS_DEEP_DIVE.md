# Lot Boss — Deep-Dive Architecture Guide

## How the Whole System Fits Together

Before diving into individual features, you need to understand how data flows through the app. Every feature touches the same core loop:

```
USER (browser)
  │
  ├── Auth0 SDK ──→ Auth0 servers ──→ JWT token returned to browser
  │
  ├── Next.js Pages ──→ Render UI based on role (organizer vs vendor)
  │
  ├── Next.js API Routes ──→ Your backend logic (lives in /app/api/)
  │       │
  │       ├── Checks JWT on every request (Auth0 middleware)
  │       ├── Reads/writes to Supabase (your database)
  │       ├── Calls Gemini API (for AI features)
  │       └── Builds Solana transactions (for payments)
  │
  └── Solana (wallet transactions happen client-side via Phantom)
```

The critical thing to understand: **Next.js API routes ARE your backend**. There's no separate server. When your React component needs data, it calls `/api/events` which is a file sitting in your project at `/app/api/events/route.js`. That file runs on the server, talks to Supabase, and returns JSON. Same machine, same deploy, same codebase.

---

## The Database Layer (Supabase)

Everything starts here. Before you write any UI or API code, you need to understand what data you're storing and how it connects.

### Schema Design

```sql
-- The main event (one per hackathon demo)
CREATE TABLE events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id  TEXT NOT NULL,          -- Auth0 user ID (e.g., "auth0|abc123")
  name          TEXT NOT NULL,
  date          DATE NOT NULL,
  location      TEXT NOT NULL,
  expected_attendance INTEGER,
  venue_width   INTEGER,                -- grid units for layout
  venue_height  INTEGER,                -- grid units for layout
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors who apply to be at the event
CREATE TABLE vendors (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id       TEXT,                   -- Auth0 user ID (null until they sign up)
  booth_name    TEXT NOT NULL,
  vendor_type   TEXT NOT NULL,          -- 'food', 'game', 'merch', 'ride'
  description   TEXT,
  space_needed  INTEGER DEFAULT 1,      -- grid units
  power_needed  BOOLEAN DEFAULT FALSE,
  status        TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  booth_fee     BIGINT,                 -- in lamports (SOL smallest unit)
  payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'paid', 'confirmed'
  payment_tx    TEXT,                   -- Solana transaction signature
  wallet_address TEXT,                  -- vendor's Solana wallet
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated layouts
CREATE TABLE layouts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  layout_data   JSONB NOT NULL,         -- the grid with vendor placements
  reasoning     TEXT,                   -- Gemini's explanation
  is_active     BOOLEAN DEFAULT FALSE,  -- which layout is currently selected
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Copilot chat history (optional, nice for demo)
CREATE TABLE copilot_messages (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,           -- 'user' or 'assistant'
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### How Supabase Works in Your Code

Supabase gives you two ways to talk to your database:

**Client-side (in React components):** You *can* query Supabase directly from the browser using their JS client. Supabase has Row Level Security (RLS) to protect data. But for this hackathon, I'd recommend keeping database calls in your API routes for simplicity — less RLS configuration to worry about.

**Server-side (in API routes):** This is the cleaner approach. Your API route creates a Supabase client with the service role key (full access), does the query, and returns the result.

```js
// lib/supabase.js — create this once, import everywhere
import { createClient } from '@supabase/supabase-js';

// Server-side client (used in API routes) — has full access
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // secret, never expose to browser
);
```

```js
// Example: app/api/events/route.js
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  // In reality, you'd also verify the Auth0 JWT here
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request) {
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({
      organizer_id: body.organizerId,  // from the verified JWT
      name: body.name,
      date: body.date,
      location: body.location,
      expected_attendance: body.expectedAttendance,
      venue_width: body.venueWidth,
      venue_height: body.venueHeight,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
```

### Why JSONB for Layouts?

The layout is a complex nested structure — a grid with vendor placements, zones, and metadata. Rather than trying to normalize this into relational tables (which would be a nightmare of join queries), you store the whole thing as a JSON blob:

```json
{
  "grid": [
    [null, null, "vendor_abc", "vendor_abc", null],
    [null, "vendor_def", null, null, "vendor_ghi"],
    ["entrance", null, null, null, "entrance"]
  ],
  "placements": {
    "vendor_abc": {
      "vendorId": "uuid-here",
      "boothName": "Big Mike's BBQ",
      "position": { "row": 0, "col": 2 },
      "size": { "width": 2, "height": 1 }
    }
  },
  "zones": {
    "food_zone": { "rows": [0, 1], "cols": [0, 2] },
    "kids_zone": { "rows": [3, 5], "cols": [3, 5] }
  }
}
```

PostgreSQL lets you query inside JSONB, so you can still do things like "find all layouts where vendor X is placed" if you need to. But mostly you'll just load the whole blob and render it.

---

## Feature 1: Auth0 Authentication & Role-Based Access

### What Auth0 Actually Does

Auth0 is an identity provider. Instead of building your own login system (password hashing, email verification, session management, OAuth), you delegate all of that to Auth0. Your app redirects to Auth0's login page, the user authenticates, and Auth0 redirects back with a **JWT (JSON Web Token)** — a signed string that proves who the user is and what role they have.

### The Auth Flow Step by Step

```
1. User visits your app → sees "Login" button
2. Click "Login" → Auth0 React SDK redirects to Auth0's hosted login page
3. User enters email/password (or Google/GitHub SSO) → Auth0 verifies
4. Auth0 redirects back to your app with a JWT in memory
5. Your React app stores the JWT (Auth0 SDK handles this automatically)
6. Every API call includes: Authorization: Bearer <jwt>
7. Your API route verifies the JWT signature + extracts user info/role
```

### Setting Up Auth0 (The Steps)

**In the Auth0 Dashboard:**

1. Create an "Application" → type "Single Page Application"
   - Note your `Domain` and `Client ID`
   - Set Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
   - Set Allowed Logout URLs: `http://localhost:3000`

2. Create an "API" → set an identifier like `https://lotboss.api`
   - This is your `audience` value

3. Go to "User Management → Roles" → create two roles:
   - `organizer`
   - `vendor`

4. **Critical step — add roles to the JWT.** By default, Auth0 does NOT include roles in the token. Go to "Actions → Library → Build Custom" and create a Post Login action:

```js
// Auth0 Action: "Add Roles to Token"
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://lotboss.com';
  const roles = event.authorization?.roles || [];

  // This puts roles inside the JWT so your API can read them
  api.idToken.setCustomClaim(`${namespace}/roles`, roles);
  api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
};
```

**In your Next.js app:**

```js
// app/layout.jsx — wrap your entire app
'use client';
import { Auth0Provider } from '@auth0/auth0-react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Auth0Provider
          domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN}
          clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID}
          authorizationParams={{
            redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
            audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
          }}
        >
          {children}
        </Auth0Provider>
      </body>
    </html>
  );
}
```

```js
// components/LoginButton.jsx
'use client';
import { useAuth0 } from '@auth0/auth0-react';

export function LoginButton() {
  const { loginWithRedirect, logout, isAuthenticated, user } = useAuth0();

  if (isAuthenticated) {
    return (
      <div>
        <span>Welcome, {user.name}</span>
        <button onClick={() => logout({ returnTo: window.location.origin })}>
          Log out
        </button>
      </div>
    );
  }

  return <button onClick={() => loginWithRedirect()}>Log in</button>;
}
```

### How Role-Based Access Control Works

Once the user is authenticated, you need to show different UIs based on their role and protect API routes so vendors can't do organizer-only things.

**Frontend (conditional rendering):**
```js
'use client';
import { useAuth0 } from '@auth0/auth0-react';

function Dashboard() {
  const { user } = useAuth0();
  const roles = user?.['https://lotboss.com/roles'] || [];

  if (roles.includes('organizer')) {
    return <OrganizerDashboard />;
  }
  if (roles.includes('vendor')) {
    return <VendorPortal />;
  }
  return <div>No role assigned. Contact the organizer.</div>;
}
```

**Backend (API route protection):**
```js
// lib/auth.js — reusable middleware
import { jwtVerify } from 'jose';  // lightweight JWT library

export async function verifyAuth(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('No token');

  // Auth0 publishes its public keys at this URL
  // In production, you'd cache the JWKS. For hackathon, this works:
  const JWKS_URL = `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`;

  const { payload } = await jwtVerify(token, /* JWKS verification */);
  return {
    userId: payload.sub,
    roles: payload['https://lotboss.com/roles'] || [],
  };
}

export function requireRole(user, role) {
  if (!user.roles.includes(role)) {
    throw new Error('Forbidden');
  }
}
```

```js
// app/api/vendors/approve/route.js
import { verifyAuth, requireRole } from '@/lib/auth';

export async function POST(request) {
  const user = await verifyAuth(request);
  requireRole(user, 'organizer');  // only organizers can approve

  const { vendorId } = await request.json();
  // ... update vendor status in Supabase
}
```

### What the User Experiences

- **Organizer:** Logs in → sees dashboard with event overview, vendor applications queue, layout optimizer, copilot chat, payment tracker
- **Vendor:** Logs in → sees their application status, booth assignment, payment button, event details
- Both see the same login page (Auth0 handles it), but after login, the app checks their role and routes them to different views

---

## Feature 2: Event Setup & Dashboard

### What It Is

This is the simplest feature but it's the foundation everything else depends on. The organizer creates one event, and all other features (vendor management, layout optimization, payments) are scoped to that event.

### The Data Flow

```
Organizer fills out form → POST /api/events → Insert into Supabase → Redirect to dashboard
Dashboard loads → GET /api/events/[id] → Fetch event + vendors + layout → Render overview
```

### Dashboard Components

The dashboard is a single page with several data panels:

```
┌─────────────────────────────────────────────────────────────┐
│  STARLIGHT COUNTY FAIR 2025                    [Copilot 💬] │
│  June 15-17 • Riverside Fairgrounds • 5,000 expected        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  VENDORS     │  REVENUE     │  LAYOUT      │  SAFETY        │
│  12 approved │  $4,200 SOL  │  ✓ Generated │  2 flags       │
│  3 pending   │  8 paid      │  Last: 2h ago│                │
│  2 rejected  │  4 unpaid    │              │                │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                                                             │
│  VENDOR APPLICATIONS                        [+ Invite Link] │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Big Mike's BBQ    │ Food │ 2 units │ ⚡ │ ✅ Approved │    │
│  │ Ring Toss Palace  │ Game │ 1 unit  │    │ ✅ Approved │    │
│  │ Tina's Tacos      │ Food │ 1 unit  │ ⚡ │ ⏳ Pending  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  AI LAYOUT                              [🔄 Re-optimize]    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  [BBQ] [BBQ] [    ] [Ring ] [    ]                  │    │
│  │  [    ] [Cott] [    ] [Toss ] [Merch]               │    │
│  │  [ENTER]  [    ] [    ] [    ] [ENTER]              │    │
│  └─────────────────────────────────────────────────────┘    │
│  AI says: "Placed food vendors near entrances for           │
│  impulse purchases. Ring Toss separated from..."            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### API Routes for Events

You need exactly two routes:

```
GET  /api/events/[id]     → fetch event with all related data
POST /api/events           → create a new event
PUT  /api/events/[id]     → update event details
```

The GET route should return a "fat" response with everything the dashboard needs in one call:

```js
// app/api/events/[id]/route.js
export async function GET(request, { params }) {
  const user = await verifyAuth(request);
  const { id } = params;

  // Fetch event
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  // Fetch vendors for this event
  const { data: vendors } = await supabaseAdmin
    .from('vendors')
    .select('*')
    .eq('event_id', id)
    .order('created_at');

  // Fetch active layout
  const { data: layout } = await supabaseAdmin
    .from('layouts')
    .select('*')
    .eq('event_id', id)
    .eq('is_active', true)
    .single();

  return Response.json({
    event,
    vendors,
    layout,
    stats: {
      totalVendors: vendors.length,
      approved: vendors.filter(v => v.status === 'approved').length,
      pending: vendors.filter(v => v.status === 'pending').length,
      paid: vendors.filter(v => v.payment_status === 'confirmed').length,
      totalRevenue: vendors
        .filter(v => v.payment_status === 'confirmed')
        .reduce((sum, v) => sum + (v.booth_fee || 0), 0),
    },
  });
}
```

This single API call gives your dashboard everything it needs. One fetch, one render. No waterfall of requests.

---

## Feature 3: Vendor Management

### The Workflow

```
1. Organizer creates event → gets a shareable invite link
2. Vendor clicks link → signs up via Auth0 (gets "vendor" role)
3. Vendor fills out application form → saved to vendors table
4. Organizer sees application in queue → approves/rejects
5. Approved vendor sees their booth assignment + payment button
```

### Vendor Application Form (What Vendors Submit)

```js
const applicationFields = {
  boothName: "Big Mike's BBQ",
  vendorType: "food",          // food | game | merch | ride
  description: "Award-winning pulled pork, brisket, ribs. 15 years on the fair circuit.",
  spaceNeeded: 2,              // grid units (1 = standard 10x10)
  powerNeeded: true,           // needs electrical hookup
  // These are optional but help Gemini optimize:
  specialRequirements: "Need water access for smoker. Generates significant smoke — prefer edge placement.",
};
```

### API Routes for Vendors

```
POST /api/vendors                    → vendor submits application
GET  /api/vendors?eventId=xxx        → list vendors (filtered by role)
PUT  /api/vendors/[id]/approve       → organizer approves (sets booth_fee)
PUT  /api/vendors/[id]/reject        → organizer rejects
```

Key nuance: when the organizer approves, they also set the booth fee. Different locations/sizes cost different amounts. The approval response includes the fee, and now the vendor can pay.

```js
// app/api/vendors/[id]/approve/route.js
export async function PUT(request, { params }) {
  const user = await verifyAuth(request);
  requireRole(user, 'organizer');

  const { boothFee } = await request.json(); // in lamports

  const { data, error } = await supabaseAdmin
    .from('vendors')
    .update({
      status: 'approved',
      booth_fee: boothFee,
    })
    .eq('id', params.id)
    .select()
    .single();

  return Response.json(data);
}
```

---

## Feature 4: AI Layout Optimizer (The Hero Feature)

This is where Gemini earns its place in the stack. This is the most impressive feature for the demo and the most nuanced to build well.

### How It Works Conceptually

```
1. Organizer clicks "Optimize Layout"
2. Your API route gathers ALL context: event details + every approved vendor
3. You build a detailed prompt telling Gemini exactly what to do
4. Gemini returns structured JSON with vendor placements + reasoning
5. You parse the JSON and render it as a visual grid
6. Organizer can give feedback → Gemini re-optimizes
```

### The Prompt Engineering (This Is Everything)

The quality of your layout optimizer depends entirely on how well you prompt Gemini. Here's a production-quality system prompt:

```js
// server/services/gemini.js
function buildLayoutPrompt(event, vendors) {
  return `You are Lot Boss, an expert carnival and fair layout optimizer. You have decades of experience in event operations, crowd flow management, and vendor placement strategy.

TASK: Generate an optimized vendor booth layout for the following event.

EVENT DETAILS:
- Name: ${event.name}
- Date: ${event.date}
- Location: ${event.location}
- Expected Attendance: ${event.expected_attendance} people
- Venue Grid: ${event.venue_width} columns × ${event.venue_height} rows
  (each cell = one 10ft × 10ft booth space)

APPROVED VENDORS:
${vendors.map((v, i) => `${i + 1}. "${v.booth_name}" (ID: ${v.id})
   - Type: ${v.vendor_type}
   - Space needed: ${v.space_needed} units
   - Needs power: ${v.power_needed ? 'YES' : 'no'}
   - Description: ${v.description}
   ${v.special_requirements ? `- Special requirements: ${v.special_requirements}` : ''}`).join('\n')}

LAYOUT RULES (you must follow these):
1. Entrances are always at row ${event.venue_height - 1} (bottom row), columns 0 and ${event.venue_width - 1}
2. Keep at least one clear path (empty row or column) from entrance to back for emergency access
3. Food vendors should be near entrances (impulse purchases, smells draw people in)
4. Competing vendors of the same type should NOT be adjacent
5. Rides and high-power vendors should be on the edges (power hookup access)
6. Kids-focused vendors should be grouped together, away from adult-oriented vendors
7. Each vendor occupies exactly the number of units specified in space_needed (placed horizontally)
8. Leave some cells empty — don't pack the grid 100% full

RESPOND WITH ONLY valid JSON in this exact format, no markdown, no explanation outside the JSON:
{
  "placements": [
    {
      "vendorId": "the-vendor-uuid",
      "boothName": "display name",
      "row": 0,
      "col": 2,
      "width": 2,
      "height": 1
    }
  ],
  "reasoning": [
    "Placed Big Mike's BBQ (2 units) near entrance at row 4 — food smells will draw attendees in immediately.",
    "Separated Ring Toss Palace from Balloon Darts — competing game vendors should not be adjacent.",
    "Placed Ferris wheel on the east edge — high power requirement, and serves as a visual landmark."
  ],
  "safetyNotes": [
    "Emergency lane maintained through column 3 from entrance to back.",
    "Fire extinguisher recommended near BBQ placement (row 4, col 1-2) due to open flame cooking."
  ]
}`;
}
```

### Calling Gemini from Your API Route

```js
// app/api/copilot/optimize/route.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth, requireRole } from '@/lib/auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  const user = await verifyAuth(request);
  requireRole(user, 'organizer');

  const { eventId } = await request.json();

  // 1. Gather context
  const { data: event } = await supabaseAdmin
    .from('events').select('*').eq('id', eventId).single();

  const { data: vendors } = await supabaseAdmin
    .from('vendors').select('*').eq('event_id', eventId).eq('status', 'approved');

  // 2. Build prompt
  const prompt = buildLayoutPrompt(event, vendors);

  // 3. Call Gemini
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',  // forces JSON output
    },
  });

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  // 4. Parse the JSON response
  let layoutData;
  try {
    layoutData = JSON.parse(responseText);
  } catch (e) {
    // Gemini sometimes wraps JSON in markdown backticks
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    layoutData = JSON.parse(cleaned);
  }

  // 5. Save to database
  // First, deactivate any existing active layout
  await supabaseAdmin
    .from('layouts')
    .update({ is_active: false })
    .eq('event_id', eventId);

  // Then save the new one
  const { data: layout } = await supabaseAdmin
    .from('layouts')
    .insert({
      event_id: eventId,
      layout_data: layoutData,
      reasoning: layoutData.reasoning?.join('\n'),
      is_active: true,
    })
    .select()
    .single();

  return Response.json(layout);
}
```

### Rendering the Grid on the Frontend

You don't need a canvas library. A CSS grid is perfect for a hackathon:

```jsx
// components/LayoutGrid.jsx
function LayoutGrid({ layout, venueWidth, venueHeight }) {
  const { placements, reasoning, safetyNotes } = layout.layout_data;

  // Build a 2D grid array
  const grid = Array.from({ length: venueHeight }, () =>
    Array.from({ length: venueWidth }, () => null)
  );

  // Fill in vendor placements
  placements.forEach(p => {
    for (let r = p.row; r < p.row + p.height; r++) {
      for (let c = p.col; c < p.col + p.width; c++) {
        if (r < venueHeight && c < venueWidth) {
          grid[r][c] = p;
        }
      }
    }
  });

  const typeColors = {
    food: '#FEF3C7',     // warm yellow
    game: '#DBEAFE',     // light blue
    merch: '#E0E7FF',    // light indigo
    ride: '#FCE7F3',     // light pink
  };

  return (
    <div>
      {/* The grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${venueWidth}, 80px)`,
          gridTemplateRows: `repeat(${venueHeight}, 80px)`,
          gap: '2px',
        }}
      >
        {grid.flat().map((cell, i) => (
          <div
            key={i}
            style={{
              background: cell ? typeColors[cell.vendorType] || '#E5E7EB' : '#F9FAFB',
              border: '1px solid #D1D5DB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              textAlign: 'center',
              padding: '4px',
            }}
          >
            {cell?.boothName || ''}
          </div>
        ))}
      </div>

      {/* AI Reasoning */}
      <div style={{ marginTop: '16px' }}>
        <h3>AI Reasoning</h3>
        {reasoning.map((r, i) => <p key={i}>• {r}</p>)}
      </div>

      {/* Safety Notes */}
      {safetyNotes?.length > 0 && (
        <div style={{ marginTop: '16px', color: '#DC2626' }}>
          <h3>Safety Flags</h3>
          {safetyNotes.map((n, i) => <p key={i}>⚠️ {n}</p>)}
        </div>
      )}
    </div>
  );
}
```

### Feedback Loop (If Time Permits)

The killer demo feature: organizer types "Move the BBQ closer to the entrance and put games in the back" and Gemini re-optimizes:

```js
// app/api/copilot/refine/route.js
export async function POST(request) {
  const { eventId, feedback, currentLayout } = await request.json();

  const prompt = `You previously generated this layout:
${JSON.stringify(currentLayout, null, 2)}

The organizer wants changes: "${feedback}"

Generate an updated layout that incorporates this feedback while
still following all the layout rules. Return the same JSON format.`;

  // ... call Gemini, save result, return
}
```

---

## Feature 5: AI Operations Copilot (Chat Interface)

### How It Differs from the Layout Optimizer

The layout optimizer is a structured, one-shot request → structured JSON response. The copilot is a freeform chat where the organizer can ask anything about their event. Same AI (Gemini), different interface pattern.

### The System Prompt

The copilot's power comes from injecting the full event state into every message:

```js
function buildCopilotSystemPrompt(event, vendors, layout) {
  return `You are Lot Boss Copilot, an AI assistant for carnival and fair operations.
You are helping the organizer of the following event:

EVENT: ${event.name}
DATE: ${event.date}
LOCATION: ${event.location}
EXPECTED ATTENDANCE: ${event.expected_attendance}
VENUE: ${event.venue_width}×${event.venue_height} grid

CURRENT VENDORS (${vendors.length} total):
${vendors.map(v => `- ${v.booth_name} (${v.vendor_type}) — Status: ${v.status}, Payment: ${v.payment_status}`).join('\n')}

CURRENT LAYOUT: ${layout ? 'Generated' : 'Not yet generated'}
${layout ? `Layout reasoning: ${layout.reasoning}` : ''}

You can help with:
- Operations planning (staffing, scheduling, logistics)
- Vendor mix analysis (do we have enough food vendors? too many games?)
- Health department / safety compliance questions
- Marketing copy (social media posts, vendor emails, announcements)
- Day-of timeline generation
- Budget and pricing strategy
- General event management advice

Be specific and actionable. Reference the actual vendors and event data in your answers.
Keep responses concise and practical — this is a busy organizer, not a student.`;
}
```

### Chat API Route

```js
// app/api/copilot/chat/route.js
export async function POST(request) {
  const { eventId, message, chatHistory } = await request.json();

  // Load full event context
  const { event, vendors, layout } = await loadEventContext(eventId);

  // Build messages array for Gemini
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: 'Initialize' }] },
      { role: 'model', parts: [{ text: buildCopilotSystemPrompt(event, vendors, layout) }] },
      // Include previous messages for context
      ...chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
    ],
  });

  const result = await chat.sendMessage(message);
  const response = result.response.text();

  // Save to chat history
  await supabaseAdmin.from('copilot_messages').insert([
    { event_id: eventId, role: 'user', content: message },
    { event_id: eventId, role: 'assistant', content: response },
  ]);

  return Response.json({ message: response });
}
```

### What Questions the Copilot Can Answer

With the full event context injected, the copilot can answer things like:

- "Do I have enough food vendors for 5,000 people?" → Gemini calculates vendor-to-attendee ratios
- "What am I missing for health department compliance?" → Gemini knows about handwashing stations, fire extinguishers, etc.
- "Write a vendor welcome email" → Gemini uses actual vendor names and event details
- "Create a day-of operations timeline" → Gemini generates an hour-by-hour schedule
- "What should I charge for a corner booth vs interior?" → Pricing strategy based on foot traffic

---

## Feature 6: Solana Payments

### Simplest Working Approach (Hackathon-Friendly)

Skip the smart contract. You don't need Anchor or Rust for the demo. Here's the simplest working flow:

```
1. Organizer has a receiving wallet address (saved in event record)
2. Vendor connects Phantom wallet
3. Vendor clicks "Pay Booth Fee" → builds a SOL transfer transaction
4. Phantom pops up → vendor confirms
5. Transaction lands on Solana devnet
6. Your backend verifies the transaction and updates payment status
```

### Setting Up the Solana Connection

```js
// lib/solana.js
import { Connection, clusterApiUrl } from '@solana/web3.js';

// Use devnet for development/hackathon
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// For the demo, the organizer's receiving wallet:
export const ORGANIZER_WALLET = 'your-devnet-wallet-public-key-here';
```

### Wallet Connection (Frontend)

```jsx
// app/providers.jsx — wrap your app with wallet providers
'use client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import the default styles
import '@solana/wallet-adapter-react-ui/styles.css';

const wallets = [new PhantomWalletAdapter()];

export function SolanaProviders({ children }) {
  return (
    <ConnectionProvider endpoint={clusterApiUrl('devnet')}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### The Payment Button Component

This is where the actual Solana transaction happens. It runs entirely in the browser — your backend only verifies it afterward.

```jsx
// components/PayBoothFee.jsx
'use client';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { useState } from 'react';

export function PayBoothFee({ vendor, organizerWallet, onSuccess }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [status, setStatus] = useState('idle'); // idle | sending | confirming | done | error

  const feeInSol = vendor.booth_fee / LAMPORTS_PER_SOL;

  async function handlePay() {
    if (!publicKey) return;

    try {
      setStatus('sending');

      // 1. Build the transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,                          // vendor's wallet
          toPubkey: new PublicKey(organizerWallet),       // organizer's wallet
          lamports: vendor.booth_fee,                     // amount in lamports
        })
      );

      // 2. Send it (Phantom popup appears here)
      const signature = await sendTransaction(transaction, connection);

      setStatus('confirming');

      // 3. Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // 4. Tell your backend to verify and update the database
      await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: vendor.id,
          txSignature: signature,
          walletAddress: publicKey.toString(),
        }),
      });

      setStatus('done');
      onSuccess?.();
    } catch (err) {
      console.error('Payment failed:', err);
      setStatus('error');
    }
  }

  if (!publicKey) {
    return (
      <div>
        <p>Connect your wallet to pay the booth fee</p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div>
      <p>Booth Fee: {feeInSol} SOL</p>
      <p>Wallet: {publicKey.toString().slice(0, 8)}...</p>

      {status === 'idle' && <button onClick={handlePay}>Pay Now</button>}
      {status === 'sending' && <p>Approve in Phantom...</p>}
      {status === 'confirming' && <p>Confirming on Solana...</p>}
      {status === 'done' && <p>Payment confirmed! ✓</p>}
      {status === 'error' && <button onClick={handlePay}>Retry Payment</button>}
    </div>
  );
}
```

### Backend Payment Verification

You never trust the frontend. After the vendor says "I paid", your backend verifies it on-chain:

```js
// app/api/payments/confirm/route.js
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { supabaseAdmin } from '@/lib/supabase';

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

export async function POST(request) {
  const { vendorId, txSignature, walletAddress } = await request.json();

  // 1. Fetch the vendor to know expected amount
  const { data: vendor } = await supabaseAdmin
    .from('vendors').select('*').eq('id', vendorId).single();

  // 2. Verify the transaction on Solana
  const tx = await connection.getTransaction(txSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    return Response.json({ error: 'Transaction not found' }, { status: 400 });
  }

  // 3. Verify the amount and recipient
  //    (In production, you'd parse the instructions more carefully)
  const preBalance = tx.meta.preBalances[1];   // recipient before
  const postBalance = tx.meta.postBalances[1]; // recipient after
  const transferred = postBalance - preBalance;

  if (transferred < vendor.booth_fee) {
    return Response.json({ error: 'Insufficient payment amount' }, { status: 400 });
  }

  // 4. Update the database
  const { data } = await supabaseAdmin
    .from('vendors')
    .update({
      payment_status: 'confirmed',
      payment_tx: txSignature,
      wallet_address: walletAddress,
    })
    .eq('id', vendorId)
    .select()
    .single();

  return Response.json(data);
}
```

### Getting Devnet SOL for Testing

For the demo, everyone needs fake SOL. Use the Solana faucet:

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Set to devnet
solana config set --url devnet

# Airdrop SOL to your wallet
solana airdrop 2 <your-wallet-address>
```

Or use the web faucet: https://faucet.solana.com

### Payment Dashboard (What the Organizer Sees)

The organizer's dashboard shows all payments with live Solana Explorer links:

```jsx
function PaymentTracker({ vendors }) {
  const confirmed = vendors.filter(v => v.payment_status === 'confirmed');
  const pending = vendors.filter(v => v.status === 'approved' && v.payment_status !== 'confirmed');

  return (
    <div>
      <h3>Payments</h3>
      <p>{confirmed.length} paid / {confirmed.length + pending.length} total</p>

      {vendors.filter(v => v.status === 'approved').map(v => (
        <div key={v.id}>
          <span>{v.booth_name}</span>
          <span>{v.booth_fee / 1e9} SOL</span>
          <span>{v.payment_status === 'confirmed' ? '✅' : '⏳'}</span>
          {v.payment_tx && (
            <a
              href={`https://explorer.solana.com/tx/${v.payment_tx}?cluster=devnet`}
              target="_blank"
            >
              View on Solana →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## How Everything Connects: Full Demo Walkthrough

Here's the complete flow you'd show in a demo:

```
1. ORGANIZER LOGIN
   → Auth0 login screen → JWT with "organizer" role → lands on dashboard

2. CREATE EVENT
   → Fill form: "Starlight County Fair", June 15, 5000 attendance, 8×6 grid
   → Saved to Supabase → dashboard appears (empty)

3. ADD VENDORS
   → Either invite via link, or for demo, seed 8-10 vendors directly
   → Show the application queue: approve 8, reject 2
   → Set booth fees: $100-500 SOL equivalent

4. OPTIMIZE LAYOUT (hero moment)
   → Click "Optimize with AI"
   → Loading spinner for 3-5 seconds
   → Grid appears with colored vendor placements
   → AI reasoning panel explains each decision
   → Safety flags highlighted in red

5. COPILOT CHAT
   → "Do I have enough food vendors?"
   → "Write a vendor welcome email"
   → "What am I missing for safety compliance?"
   → Gemini responds with specific, data-aware answers

6. VENDOR PAYMENT
   → Switch to vendor account (different Auth0 login)
   → Vendor sees their approved booth + fee
   → Connect Phantom → click Pay → confirm in wallet
   → Transaction confirms on Solana devnet
   → Switch back to organizer → payment shows as confirmed with Explorer link

7. FINAL SHOT
   → Dashboard overview: all vendors approved, all paid, layout optimized,
     AI copilot available — the entire fair is organized on one screen
```

---

## Critical Path: What MUST Work vs Nice-to-Have

### Must work (don't demo without these):
1. Auth0 login with two different roles showing different views
2. Gemini layout optimizer returning a visual grid with reasoning
3. One Solana payment going through and showing up on Explorer

### Nice to have (if time permits):
4. Copilot chat with event-aware responses
5. Feedback loop on layouts ("move the BBQ closer to the entrance")
6. Real-time updates (Supabase subscriptions)
7. Pretty UI (Tailwind polish, animations)

### Cut if behind:
- Revenue splits (just do simple payments)
- Chat history persistence
- Vendor self-service portal (just show organizer side)
- Mobile responsiveness
