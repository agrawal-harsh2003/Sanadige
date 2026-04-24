-- Add waiter to staff role constraint
alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check
  check (role in ('chef', 'host', 'manager', 'waiter'));

-- Track when post-meal feedback was sent
alter table bookings add column if not exists feedback_sent_at timestamptz default null;
