-- Lot Boss schema: run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Creates: events, vendors, layouts, copilot_messages

-- 1. Events (one per hackathon demo)
CREATE TABLE IF NOT EXISTS events (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id        TEXT NOT NULL,
  name                TEXT NOT NULL,
  date                DATE NOT NULL,
  location            TEXT NOT NULL,
  expected_attendance INTEGER,
  venue_width         INTEGER,
  venue_height        INTEGER,
  description         TEXT,
  organizer_wallet    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vendors (applications + payment state per event)
CREATE TABLE IF NOT EXISTS vendors (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         TEXT,
  booth_name      TEXT NOT NULL,
  vendor_type     TEXT NOT NULL,
  description     TEXT,
  space_needed    INTEGER DEFAULT 1,
  power_needed    BOOLEAN DEFAULT FALSE,
  status          TEXT DEFAULT 'pending',
  booth_fee       BIGINT,
  payment_status  TEXT DEFAULT 'unpaid',
  payment_tx      TEXT,
  wallet_address  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI-generated layouts
CREATE TABLE IF NOT EXISTS layouts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  layout_data  JSONB NOT NULL,
  reasoning    TEXT,
  is_active    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Copilot chat history
CREATE TABLE IF NOT EXISTS copilot_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
