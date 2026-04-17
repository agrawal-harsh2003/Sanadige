-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Static fish/seafood catalogue
create table catch_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  local_name text,
  origin_region text not null,
  description text not null,
  recommended_preps text[] not null default '{}',
  allergens text[] not null default '{}',
  spice_level int not null check (spice_level between 1 and 5),
  image_url text,
  created_at timestamptz default now()
);

-- Daily availability — one row per item per day
create table daily_availability (
  id uuid primary key default gen_random_uuid(),
  catch_item_id uuid not null references catch_items(id) on delete cascade,
  date date not null default current_date,
  status text not null check (status in ('available', 'sold_out', 'tomorrow')),
  notes text,
  updated_at timestamptz default now(),
  updated_by text,
  unique (catch_item_id, date)
);

create index on daily_availability (date);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_availability_updated_at
before update on daily_availability
for each row execute procedure set_updated_at();

-- Full menu items (non-catch dishes)
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text not null,
  price int not null,
  allergens text[] not null default '{}',
  spice_level int check (spice_level between 1 and 5),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz default now()
);

-- Reservations
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique,
  guest_name text not null,
  phone text not null,
  whatsapp_id text not null,
  party_size int not null,
  datetime timestamptz not null,
  floor text not null check (floor in ('terrace', 'floor1', 'floor2', 'private')),
  special_notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'seated', 'no_show', 'cancelled')),
  swiftbook_id text,
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);

create index on bookings (datetime, floor, status);

-- Conversation history (for Claude context per sender)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'instagram', 'web')),
  sender_id text not null,
  messages jsonb not null default '[]',
  last_active timestamptz default now(),
  created_at timestamptz default now(),
  unique (channel, sender_id)
);

-- QR menu orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  table_id text not null,
  booking_id uuid references bookings(id) on delete set null,
  items jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'served')),
  created_at timestamptz default now()
);

-- Seed catch_items with Sanadige's core seafood
insert into catch_items (name, local_name, origin_region, description, recommended_preps, allergens, spice_level) values
  ('Anjal', 'Kingfish', 'Goa', 'Fresh Goan kingfish with firm white flesh. Excellent pan-seared or in coconut-based curries. Boneless available on request.', array['Tawa Fry', 'Konkani Curry', 'Tandoor'], array['Fish'], 3),
  ('Pomfret', 'Silver Pomfret', 'Mangalore', 'Mangalorean silver pomfret with delicate flavour. Best as Bangude Masala Fry or in Coconut Curry. Whole fish or fillet.', array['Masala Fry', 'Coconut Curry', 'Stuffed Pomfret'], array['Fish'], 2),
  ('Mud Crab', 'Mud Crab', 'Kerala', 'Live Kerala mud crab with dense, sweet claw meat. Chef recommends Ghee Roast or Pepper Masala. Limited quantity daily.', array['Ghee Roast', 'Pepper Masala', 'Butter Garlic'], array['Shellfish', 'Dairy'], 4),
  ('Lobster', 'Lobster', 'Kerala', 'Whole lobster served with butter pepper garlic sauce and appam. Available in 500g and 1kg portions.', array['Butter Pepper Garlic', 'Masala Roast'], array['Shellfish', 'Dairy'], 2),
  ('Tiger Prawns', 'Tiger Prawns', 'Goa', 'Large Goan tiger prawns. Best as Prawn Sukka or Pulimunchi. Can be done in a Nellore-style if requested.', array['Sukka', 'Pulimunchi', 'Butter Garlic', 'Tempura'], array['Shellfish'], 3),
  ('Squid', 'Baby Squid', 'Goa', 'Tender Goan baby squid. Rings or whole. Great as Chilli Fry or in a Masala preparation.', array['Chilli Fry', 'Masala', 'Tempura'], array['Shellfish'], 3);

-- Enable Realtime on key tables (run in Supabase dashboard or via API)
-- alter publication supabase_realtime add table daily_availability;
-- alter publication supabase_realtime add table bookings;
-- alter publication supabase_realtime add table orders;

-- Staff directory — controls who can send admin commands via WhatsApp
create table staff (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  role text not null check (role in ('chef', 'host', 'manager')),
  added_by text,
  created_at timestamptz default now()
);
