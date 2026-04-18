-- Enable UUID generation
create extension if not exists "pgcrypto";

create table if not exists staff_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index if not exists staff_otps_phone_idx on staff_otps (phone);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('catch_update','booking_new','booking_status','staff_change','whatsapp_query')),
  description text not null,
  actor_phone text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists activity_log_created_idx on activity_log (created_at desc);
