-- Allow the browser anon key to read bookings (needed for Realtime subscriptions)
alter table bookings enable row level security;

-- Dashboard staff (anon key) can read all bookings
create policy "anon can read bookings"
  on bookings for select
  using (true);

-- Only the service role (backend) can insert/update/delete
create policy "service role full access"
  on bookings for all
  using (auth.role() = 'service_role');

-- Add bookings to the Supabase Realtime publication
alter publication supabase_realtime add table bookings;
