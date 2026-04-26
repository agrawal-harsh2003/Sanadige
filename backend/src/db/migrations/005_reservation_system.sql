-- ============================================================
-- Migration 005: Full Reservation System Schema
-- Run in Supabase SQL editor
-- ============================================================

-- ── 1. Physical tables ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor         text NOT NULL CHECK (floor IN ('terrace','floor1','floor2','private')),
  table_number  text NOT NULL,
  capacity      integer NOT NULL,
  is_active     boolean DEFAULT true,
  UNIQUE (floor, table_number)
);

-- Seed: Terrace (6 tables, 4 seats each)
INSERT INTO tables (floor, table_number, capacity) VALUES
  ('terrace','T1',4),('terrace','T2',4),('terrace','T3',4),
  ('terrace','T4',4),('terrace','T5',4),('terrace','T6',4)
ON CONFLICT (floor, table_number) DO NOTHING;

-- Seed: Floor 1 (8 tables, mix of 2/4/6)
INSERT INTO tables (floor, table_number, capacity) VALUES
  ('floor1','F1-01',2),('floor1','F1-02',2),('floor1','F1-03',4),
  ('floor1','F1-04',4),('floor1','F1-05',4),('floor1','F1-06',4),
  ('floor1','F1-07',6),('floor1','F1-08',6)
ON CONFLICT (floor, table_number) DO NOTHING;

-- Seed: Floor 2 (7 tables)
INSERT INTO tables (floor, table_number, capacity) VALUES
  ('floor2','F2-01',2),('floor2','F2-02',2),('floor2','F2-03',4),
  ('floor2','F2-04',4),('floor2','F2-05',4),('floor2','F2-06',6),
  ('floor2','F2-07',6)
ON CONFLICT (floor, table_number) DO NOTHING;

-- Seed: Private (1 table, 12 seats)
INSERT INTO tables (floor, table_number, capacity) VALUES
  ('private','P1',12)
ON CONFLICT (floor, table_number) DO NOTHING;


-- ── 2. Guest profiles ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                 text UNIQUE NOT NULL,
  name                  text NOT NULL,
  email                 text,
  whatsapp_id           text,
  dietary_notes         text,
  seating_preference    text,
  birthday              date,
  anniversary           date,
  visit_count           integer DEFAULT 0,
  total_spend           integer DEFAULT 0, -- in paise
  tier                  text DEFAULT 'standard' CHECK (tier IN ('standard','preferred','vip')),
  tags                  text[] DEFAULT '{}',
  last_visit_at         timestamptz,
  first_visit_at        timestamptz,
  is_marketing_opted_in boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guests_phone_idx ON guests (phone);
CREATE INDEX IF NOT EXISTS guests_last_visit_idx ON guests (last_visit_at);
CREATE INDEX IF NOT EXISTS guests_tier_idx ON guests (tier);


-- ── 3. Staff notes on guests ───────────────────────────────
CREATE TABLE IF NOT EXISTS guest_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id   uuid REFERENCES guests(id) ON DELETE CASCADE,
  note       text NOT NULL,
  added_by   text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_notes_guest_id_idx ON guest_notes (guest_id);


-- ── 4. Waitlist ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id         uuid REFERENCES guests(id),
  phone            text NOT NULL,
  guest_name       text NOT NULL,
  party_size       integer NOT NULL,
  preferred_date   date NOT NULL,
  preferred_floor  text,
  notified_at      timestamptz,
  offer_expires_at timestamptz,
  status           text DEFAULT 'waiting'
                   CHECK (status IN ('waiting','offered','accepted','expired','cancelled')),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_date_status_idx ON waitlist (preferred_date, status);


-- ── 5. Service configuration ───────────────────────────────
CREATE TABLE IF NOT EXISTS service_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  date UNIQUE NOT NULL,
  cover_cap             integer DEFAULT 60,
  walkin_allocation_pct integer DEFAULT 10,
  is_closed             boolean DEFAULT false,
  notes                 text
);


-- ── 6. Marketing campaigns ─────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  segment_type text NOT NULL,
  message      text NOT NULL,
  sent_count   integer DEFAULT 0,
  status       text DEFAULT 'draft' CHECK (status IN ('draft','sent','scheduled')),
  created_by   text,
  scheduled_at timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz DEFAULT now()
);


-- ── 7. Extend bookings table ───────────────────────────────

-- New status values
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending','confirmed','waitlisted','checked_in','seated','completed','cancelled','no_show'));

-- New columns (all IF NOT EXISTS safe)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_id         uuid REFERENCES guests(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS table_id         uuid REFERENCES tables(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email            text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS occasion         text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS held_until       timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount   integer DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_status   text DEFAULT 'none'
  CHECK (deposit_status IN ('none','pending','paid','captured','refunded','partial_refund'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_payment_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at   timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at     timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_at       timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS channel          text DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp','website','phone','dineout','eazydiner','google','walkin'));

CREATE INDEX IF NOT EXISTS bookings_guest_id_idx ON bookings (guest_id);
CREATE INDEX IF NOT EXISTS bookings_channel_idx  ON bookings (channel);
CREATE INDEX IF NOT EXISTS bookings_status_datetime_idx ON bookings (status, datetime);


-- ── 8. RLS for new tables ──────────────────────────────────
ALTER TABLE guests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist      ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables        ENABLE ROW LEVEL SECURITY;

-- Dashboard (anon key) can read all
CREATE POLICY "anon can read guests"         ON guests         FOR SELECT USING (true);
CREATE POLICY "anon can read guest_notes"    ON guest_notes    FOR SELECT USING (true);
CREATE POLICY "anon can read waitlist"       ON waitlist       FOR SELECT USING (true);
CREATE POLICY "anon can read service_config" ON service_config FOR SELECT USING (true);
CREATE POLICY "anon can read campaigns"      ON campaigns      FOR SELECT USING (true);
CREATE POLICY "anon can read tables"         ON tables         FOR SELECT USING (true);

-- Only service role (backend) can write
CREATE POLICY "service role full access guests"         ON guests         FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service role full access guest_notes"    ON guest_notes    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service role full access waitlist"       ON waitlist       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service role full access service_config" ON service_config FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service role full access campaigns"      ON campaigns      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service role full access tables"         ON tables         FOR ALL USING (auth.role() = 'service_role');

-- Realtime for tables (host floor map)
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist;
