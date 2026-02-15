-- Add default_booth_fee (lamports) to events for Solana escrow booth fee.
-- Run this in Supabase SQL Editor if you see "column events.default_booth_fee does not exist".
ALTER TABLE events ADD COLUMN IF NOT EXISTS default_booth_fee BIGINT;
