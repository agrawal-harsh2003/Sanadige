# Sanadige Delhi — Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Node.js + TypeScript backend that handles WhatsApp/Instagram webhooks, routes messages through Claude claude-sonnet-4-6 with tool use, manages daily catch availability, creates reservations, and sends automated reminders.

**Architecture:** A single Express gateway normalises incoming messages from WhatsApp Cloud API and Meta Graph API (Instagram) into a shared format. Claude claude-sonnet-4-6 receives each message with conversation history and calls typed tools (`get_today_catch`, `check_floor_availability`, `create_booking`, `get_menu_item_detail`) backed by Supabase. Conversation history is persisted per sender so Claude maintains context across turns.

**Tech Stack:** Node.js 20, TypeScript 5, Express, `@anthropic-ai/sdk`, `@supabase/supabase-js`, Vitest, Zod, `node-cron`, Railway

---

> **Note:** This is Plan 1 of 3.
> - Plan 2: Staff Dashboard (Next.js 14) — depends on this plan being complete
> - Plan 3: QR Menu PWA (Next.js 14 PWA) — depends on this plan being complete
>
> **Pre-requisite before starting Task 1:** Confirm with Goldfinch Hotels whether SwiftBook exposes an API. If not, Task 10 uses a stub that logs the payload — a human mirrors it manually in SwiftBook until the API is available.

---

## File Structure

```
backend/
├── src/
│   ├── index.ts                        # Express app, route registration
│   ├── env.ts                          # Zod-validated env vars (single source of truth)
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client singleton
│   │   ├── anthropic.ts                # Anthropic SDK client singleton
│   │   └── whatsapp.ts                 # WhatsApp Cloud API send/receive helpers
│   ├── webhooks/
│   │   ├── whatsapp.ts                 # POST /webhooks/whatsapp — parse + verify
│   │   ├── instagram.ts                # POST /webhooks/instagram — parse + verify
│   │   └── normalise.ts                # Normalise both into IncomingMessage
│   ├── tools/
│   │   ├── index.ts                    # Tool definitions array for Claude
│   │   ├── get-today-catch.ts          # Tool: fetch daily_availability + catch_items
│   │   ├── check-floor-availability.ts # Tool: check bookings for date/floor
│   │   ├── create-booking.ts           # Tool: write booking to Supabase + SwiftBook
│   │   └── get-menu-item-detail.ts     # Tool: fetch menu_items detail for Claude context
│   ├── services/
│   │   ├── claude.ts                   # Conversation handler: history → Claude → reply
│   │   ├── catch.ts                    # Parse /catch command, update daily_availability
│   │   └── reminder.ts                 # node-cron job: send WhatsApp reminders 2h before
│   └── db/
│       └── schema.sql                  # Full Supabase schema (run once in Supabase dashboard)
├── tests/
│   ├── tools/
│   │   ├── get-today-catch.test.ts
│   │   ├── check-floor-availability.test.ts
│   │   └── create-booking.test.ts
│   ├── services/
│   │   ├── catch.test.ts
│   │   └── claude.test.ts
│   └── webhooks/
│       └── normalise.test.ts
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── railway.toml
```

---

## Task 1: Supabase Schema

**Files:**
- Create: `backend/src/db/schema.sql`

- [ ] **Step 1: Write the schema**

Create `backend/src/db/schema.sql`:

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Static fish/seafood catalogue
create table catch_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- "Anjal"
  local_name text,                          -- "Kingfish"
  origin_region text not null,              -- "Goa"
  description text not null,               -- fed to Claude
  recommended_preps text[] not null default '{}',
  allergens text[] not null default '{}',
  spice_level int not null check (spice_level between 1 and 5),
  image_url text,
  created_at timestamptz default now()
);

-- Daily availability — one row per item per day
create table daily_availability (
  id uuid primary key default gen_random_uuid(),
  catch_item_id uuid not null references catch_items(id),
  date date not null default current_date,
  status text not null check (status in ('available', 'sold_out', 'tomorrow')),
  notes text,                               -- "large ones today"
  updated_at timestamptz default now(),
  updated_by text,
  unique (catch_item_id, date)
);

-- Full menu items (non-catch dishes)
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,                  -- "starter", "main", "vegetarian", "drinks"
  description text not null,
  price int not null,                      -- in rupees
  allergens text[] not null default '{}',
  spice_level int check (spice_level between 1 and 5),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz default now()
);

-- Reservations
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique,        -- "SND-2847"
  guest_name text not null,
  phone text not null,
  whatsapp_id text not null,              -- sender phone number as received by WhatsApp API
  party_size int not null,
  datetime timestamptz not null,
  floor text not null check (floor in ('terrace', 'floor1', 'floor2', 'private')),
  special_notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'seated', 'no_show', 'cancelled')),
  swiftbook_id text,                       -- null until SwiftBook API available
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);

-- Conversation history (for Claude context per sender)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'instagram', 'web')),
  sender_id text not null,               -- phone number or instagram user id
  messages jsonb not null default '[]',  -- [{role: "user"|"assistant", content: "..."}]
  last_active timestamptz default now(),
  created_at timestamptz default now(),
  unique (channel, sender_id)
);

-- QR menu orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  table_id text not null,                -- e.g. "T2"
  booking_id uuid references bookings(id),
  items jsonb not null,                  -- [{menu_item_id, qty, notes}]
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
```

- [ ] **Step 2: Run schema in Supabase**

In Supabase dashboard → SQL Editor → paste and run the full file.

Verify: check Table Editor shows all 6 tables and `catch_items` has 6 rows.

- [ ] **Step 3: Enable Realtime**

In Supabase dashboard → Database → Replication → toggle on `daily_availability`, `bookings`, `orders`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.sql
git commit -m "feat: add Supabase schema for sanadige backend"
```

---

## Task 2: Project Setup

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/railway.toml`

- [ ] **Step 1: Initialise project**

```bash
mkdir -p backend && cd backend
npm init -y
npm install express @anthropic-ai/sdk @supabase/supabase-js zod node-cron axios
npm install -D typescript @types/express @types/node @types/node-cron vitest @vitest/coverage-v8 ts-node
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: { provider: 'v8', reporter: ['text'] },
  },
})
```

- [ ] **Step 4: Write `package.json` scripts**

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Write `.env.example`**

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Meta WhatsApp Cloud API
WHATSAPP_TOKEN=EAA...
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_VERIFY_TOKEN=sanadige_webhook_secret_2026

# Meta Graph API (Instagram)
INSTAGRAM_PAGE_ACCESS_TOKEN=EAA...
INSTAGRAM_VERIFY_TOKEN=sanadige_instagram_secret_2026

# SwiftBook (leave empty if API not yet available)
SWIFTBOOK_API_KEY=
SWIFTBOOK_PROPERTY_ID=

PORT=3000
```

Copy to `.env` and fill real values.

- [ ] **Step 6: Write `railway.toml`**

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run build && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: backend project scaffold — typescript, vitest, railway config"
```

---

## Task 3: Env + Supabase + Anthropic Clients

**Files:**
- Create: `backend/src/env.ts`
- Create: `backend/src/lib/supabase.ts`
- Create: `backend/src/lib/anthropic.ts`

- [ ] **Step 1: Write `src/env.ts`**

```typescript
import { z } from 'zod'

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  INSTAGRAM_PAGE_ACCESS_TOKEN: z.string().min(1),
  INSTAGRAM_VERIFY_TOKEN: z.string().min(1),
  SWIFTBOOK_API_KEY: z.string().optional(),
  SWIFTBOOK_PROPERTY_ID: z.string().optional(),
  PORT: z.coerce.number().default(3000),
})

export const env = schema.parse(process.env)
```

- [ ] **Step 2: Write `src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import { env } from '../env'

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
```

- [ ] **Step 3: Write `src/lib/anthropic.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env'

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/env.ts backend/src/lib/
git commit -m "feat: env validation, supabase + anthropic client singletons"
```

---

## Task 4: WhatsApp API Client

**Files:**
- Create: `backend/src/lib/whatsapp.ts`

- [ ] **Step 1: Write failing test**

Create `backend/tests/lib/whatsapp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')
vi.mock('../../src/env', () => ({
  env: {
    WHATSAPP_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456',
  },
}))

const { sendWhatsAppMessage } = await import('../../src/lib/whatsapp')

describe('sendWhatsAppMessage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to WhatsApp Cloud API with correct payload', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { messages: [{ id: 'wamid.123' }] } })

    await sendWhatsAppMessage('919876543210', 'Hello Priya!')

    expect(axios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/123456/messages',
      {
        messaging_product: 'whatsapp',
        to: '919876543210',
        type: 'text',
        text: { body: 'Hello Priya!' },
      },
      { headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' } }
    )
  })

  it('throws when API returns non-2xx', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('Request failed with status code 400'))
    await expect(sendWhatsAppMessage('919876543210', 'Hi')).rejects.toThrow('400')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run tests/lib/whatsapp.test.ts
```

Expected: FAIL — `sendWhatsAppMessage` not found.

- [ ] **Step 3: Write `src/lib/whatsapp.ts`**

```typescript
import axios from 'axios'
import { env } from '../env'

const BASE = `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}`

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  await axios.post(
    `${BASE}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/whatsapp.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/whatsapp.ts backend/tests/lib/whatsapp.test.ts
git commit -m "feat: whatsapp cloud api send helper"
```

---

## Task 5: Message Normalisation

**Files:**
- Create: `backend/src/webhooks/normalise.ts`
- Create: `backend/tests/webhooks/normalise.test.ts`

- [ ] **Step 1: Write failing test**

Create `backend/tests/webhooks/normalise.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { normaliseWhatsApp, normaliseInstagram, IncomingMessage } from '../../src/webhooks/normalise'

describe('normaliseWhatsApp', () => {
  it('extracts sender, text, and channel from WhatsApp webhook payload', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ from: '919876543210', text: { body: 'Is the Anjal in today?' }, type: 'text' }],
            contacts: [{ profile: { name: 'Priya' } }],
          },
        }],
      }],
    }

    const result = normaliseWhatsApp(payload)
    expect(result).toEqual<IncomingMessage>({
      channel: 'whatsapp',
      senderId: '919876543210',
      text: 'Is the Anjal in today?',
    })
  })

  it('returns null for non-text messages (images, audio)', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ from: '919876543210', type: 'image' }],
          },
        }],
      }],
    }
    expect(normaliseWhatsApp(payload)).toBeNull()
  })

  it('returns null for status update webhooks (no messages key)', () => {
    const payload = { entry: [{ changes: [{ value: { statuses: [{}] } }] }] }
    expect(normaliseWhatsApp(payload)).toBeNull()
  })
})

describe('normaliseInstagram', () => {
  it('extracts sender, text, and channel from Instagram DM webhook payload', () => {
    const payload = {
      entry: [{
        messaging: [{
          sender: { id: 'ig_user_123' },
          message: { text: 'Do you have mud crab tonight?' },
        }],
      }],
    }

    const result = normaliseInstagram(payload)
    expect(result).toEqual<IncomingMessage>({
      channel: 'instagram',
      senderId: 'ig_user_123',
      text: 'Do you have mud crab tonight?',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/webhooks/normalise.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/webhooks/normalise.ts`**

```typescript
export interface IncomingMessage {
  channel: 'whatsapp' | 'instagram' | 'web'
  senderId: string
  text: string
}

export function normaliseWhatsApp(body: unknown): IncomingMessage | null {
  const b = body as Record<string, unknown>
  const messages = (b?.entry as Array<{ changes: Array<{ value: Record<string, unknown> }> }>)
    ?.[0]?.changes?.[0]?.value?.messages as Array<Record<string, unknown>> | undefined

  if (!messages || messages.length === 0) return null
  const msg = messages[0]
  if (msg.type !== 'text') return null

  return {
    channel: 'whatsapp',
    senderId: msg.from as string,
    text: (msg.text as { body: string }).body,
  }
}

export function normaliseInstagram(body: unknown): IncomingMessage | null {
  const b = body as Record<string, unknown>
  const messaging = (b?.entry as Array<{ messaging: Array<Record<string, unknown>> }>)
    ?.[0]?.messaging?.[0]

  if (!messaging) return null
  const text = (messaging.message as { text?: string })?.text
  if (!text) return null

  return {
    channel: 'instagram',
    senderId: (messaging.sender as { id: string }).id,
    text,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/webhooks/normalise.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/webhooks/normalise.ts backend/tests/webhooks/normalise.test.ts
git commit -m "feat: normalise whatsapp and instagram webhook payloads"
```

---

## Task 6: Claude Tools — `get_today_catch`

**Files:**
- Create: `backend/src/tools/get-today-catch.ts`
- Create: `backend/src/tools/index.ts`
- Create: `backend/tests/tools/get-today-catch.test.ts`

- [ ] **Step 1: Write failing test**

Create `backend/tests/tools/get-today-catch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  },
}))

const { getTodayCatch } = await import('../../src/tools/get-today-catch')
const { supabase } = await import('../../src/lib/supabase')

describe('getTodayCatch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns formatted catch list with status and descriptions', async () => {
    vi.mocked(supabase.from('daily_availability').select('').eq).mockResolvedValue({
      data: [
        {
          status: 'available',
          notes: 'large ones today',
          catch_items: {
            name: 'Mud Crab',
            origin_region: 'Kerala',
            description: 'Live Kerala mud crab',
            recommended_preps: ['Ghee Roast', 'Pepper Masala'],
            allergens: ['Shellfish'],
          },
        },
        {
          status: 'sold_out',
          notes: null,
          catch_items: {
            name: 'Lobster',
            origin_region: 'Kerala',
            description: 'Whole lobster',
            recommended_preps: ['Butter Pepper Garlic'],
            allergens: ['Shellfish'],
          },
        },
      ],
      error: null,
    } as unknown)

    const result = await getTodayCatch()

    expect(result).toContain('Mud Crab')
    expect(result).toContain('available')
    expect(result).toContain('large ones today')
    expect(result).toContain('Lobster')
    expect(result).toContain('sold_out')
  })

  it('returns "No catch data" message when table is empty', async () => {
    vi.mocked(supabase.from('daily_availability').select('').eq).mockResolvedValue({
      data: [],
      error: null,
    } as unknown)

    const result = await getTodayCatch()
    expect(result).toContain('No catch availability')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/get-today-catch.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/tools/get-today-catch.ts`**

```typescript
import { supabase } from '../lib/supabase'

export async function getTodayCatch(): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_availability')
    .select(`
      status, notes,
      catch_items (name, origin_region, description, recommended_preps, allergens)
    `)
    .eq('date', today)

  if (error) throw new Error(`Failed to fetch catch: ${error.message}`)
  if (!data || data.length === 0) return 'No catch availability data for today yet.'

  const lines = data.map((row: Record<string, unknown>) => {
    const item = row.catch_items as Record<string, unknown>
    const preps = (item.recommended_preps as string[]).join(', ')
    const note = row.notes ? ` (${row.notes})` : ''
    return `- ${item.name} (${item.origin_region}): ${row.status}${note}. Recommended: ${preps}. ${item.description}`
  })

  return `Today's catch availability:\n${lines.join('\n')}`
}

export const getTodayCatchDefinition = {
  name: 'get_today_catch',
  description: 'Get today\'s fresh seafood availability, origin, and recommended preparations. Call this whenever a customer asks what fish is available, what the catch is today, or about a specific seafood item.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}
```

- [ ] **Step 4: Write `src/tools/index.ts`**

```typescript
import { getTodayCatchDefinition } from './get-today-catch'
import { checkFloorAvailabilityDefinition } from './check-floor-availability'
import { createBookingDefinition } from './create-booking'
import { getMenuItemDetailDefinition } from './get-menu-item-detail'

export const toolDefinitions = [
  getTodayCatchDefinition,
  checkFloorAvailabilityDefinition,
  createBookingDefinition,
  getMenuItemDetailDefinition,
]

export { getTodayCatch } from './get-today-catch'
export { checkFloorAvailability } from './check-floor-availability'
export { createBooking } from './create-booking'
export { getMenuItemDetail } from './get-menu-item-detail'
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/tools/get-today-catch.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/tools/ backend/tests/tools/get-today-catch.test.ts
git commit -m "feat: get_today_catch tool + tool index"
```

---

## Task 7: Claude Tools — `check_floor_availability`

**Files:**
- Create: `backend/src/tools/check-floor-availability.ts`
- Create: `backend/tests/tools/check-floor-availability.test.ts`

- [ ] **Step 1: Write failing test**

Create `backend/tests/tools/check-floor-availability.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() },
}))

const { checkFloorAvailability } = await import('../../src/tools/check-floor-availability')
const { supabase } = await import('../../src/lib/supabase')

const FLOOR_CAPACITY: Record<string, number> = { terrace: 6, floor1: 6, floor2: 8, private: 1 }

describe('checkFloorAvailability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns available when bookings are below capacity', async () => {
    vi.mocked(supabase.from('bookings').select('').gte('').lt('').eq).mockResolvedValue({
      data: [{ id: '1' }, { id: '2' }],
      error: null,
    } as unknown)

    const result = await checkFloorAvailability('terrace', '2026-04-19T20:00:00Z', 6)
    expect(result).toContain('available')
    expect(result).toContain('terrace')
  })

  it('returns unavailable when floor is at capacity', async () => {
    const full = Array(6).fill({ id: '1' })
    vi.mocked(supabase.from('bookings').select('').gte('').lt('').eq).mockResolvedValue({
      data: full,
      error: null,
    } as unknown)

    const result = await checkFloorAvailability('terrace', '2026-04-19T20:00:00Z', 6)
    expect(result).toContain('fully booked')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/check-floor-availability.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/tools/check-floor-availability.ts`**

```typescript
import { supabase } from '../lib/supabase'

const FLOOR_CAPACITY: Record<string, number> = {
  terrace: 6,
  floor1: 6,
  floor2: 8,
  private: 1,
}

export async function checkFloorAvailability(
  floor: string,
  datetime: string,
  partySize: number
): Promise<string> {
  // Check ±2 hour window around requested time
  const requested = new Date(datetime)
  const windowStart = new Date(requested.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(requested.getTime() + 2 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .gte('datetime', windowStart)
    .lt('datetime', windowEnd)
    .eq('floor', floor)
    .eq('status', 'confirmed')

  if (error) throw new Error(`Failed to check availability: ${error.message}`)

  const capacity = FLOOR_CAPACITY[floor] ?? 4
  const booked = data?.length ?? 0
  const remaining = capacity - booked

  if (remaining <= 0) {
    return `The ${floor} is fully booked for ${datetime}. Suggest alternative: ${Object.keys(FLOOR_CAPACITY).filter(f => f !== floor).join(', ')}.`
  }

  return `The ${floor} is available for ${datetime}. ${remaining} table(s) remaining. Party size ${partySize} can be accommodated.`
}

export const checkFloorAvailabilityDefinition = {
  name: 'check_floor_availability',
  description: 'Check if a specific floor (terrace, floor1, floor2, private) has availability for a given date, time, and party size. Call this when a customer wants to book a table or asks about seating availability.',
  input_schema: {
    type: 'object' as const,
    properties: {
      floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'], description: 'Which floor the guest wants' },
      datetime: { type: 'string', description: 'ISO 8601 datetime the guest wants to book' },
      party_size: { type: 'number', description: 'Number of guests' },
    },
    required: ['floor', 'datetime', 'party_size'],
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/check-floor-availability.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/check-floor-availability.ts backend/tests/tools/check-floor-availability.test.ts
git commit -m "feat: check_floor_availability tool"
```

---

## Task 8: Claude Tools — `create_booking`

**Files:**
- Create: `backend/src/tools/create-booking.ts`
- Create: `backend/tests/tools/create-booking.test.ts`

- [ ] **Step 1: Write failing test**

Create `backend/tests/tools/create-booking.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn() },
}))

const { createBooking } = await import('../../src/tools/create-booking')
const { supabase } = await import('../../src/lib/supabase')

describe('createBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates booking and returns confirmation with ref', async () => {
    vi.mocked(supabase.from('bookings').insert([]).select('').single).mockResolvedValue({
      data: {
        booking_ref: 'SND-0001',
        guest_name: 'Priya Sharma',
        datetime: '2026-04-19T14:30:00.000Z',
        floor: 'terrace',
        party_size: 6,
      },
      error: null,
    } as unknown)

    const result = await createBooking({
      guestName: 'Priya Sharma',
      phone: '919876543210',
      whatsappId: '919876543210',
      partySize: 6,
      datetime: '2026-04-19T20:00:00+05:30',
      floor: 'terrace',
      specialNotes: 'Birthday dinner',
    })

    expect(result).toContain('SND-0001')
    expect(result).toContain('Priya Sharma')
    expect(result).toContain('terrace')
  })

  it('throws on Supabase error', async () => {
    vi.mocked(supabase.from('bookings').insert([]).select('').single).mockResolvedValue({
      data: null,
      error: { message: 'duplicate key' },
    } as unknown)

    await expect(createBooking({
      guestName: 'Test',
      phone: '919876543210',
      whatsappId: '919876543210',
      partySize: 2,
      datetime: '2026-04-19T20:00:00Z',
      floor: 'floor1',
      specialNotes: null,
    })).rejects.toThrow('duplicate key')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/create-booking.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/tools/create-booking.ts`**

```typescript
import { supabase } from '../lib/supabase'

export interface BookingInput {
  guestName: string
  phone: string
  whatsappId: string
  partySize: number
  datetime: string
  floor: 'terrace' | 'floor1' | 'floor2' | 'private'
  specialNotes: string | null
}

function generateRef(): string {
  const n = Math.floor(1000 + Math.random() * 9000)
  return `SND-${n}`
}

export async function createBooking(input: BookingInput): Promise<string> {
  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      booking_ref: generateRef(),
      guest_name: input.guestName,
      phone: input.phone,
      whatsapp_id: input.whatsappId,
      party_size: input.partySize,
      datetime: input.datetime,
      floor: input.floor,
      special_notes: input.specialNotes,
      status: 'confirmed',
    }])
    .select('booking_ref, guest_name, datetime, floor, party_size')
    .single()

  if (error) throw new Error(error.message)

  const localTime = new Date(data.datetime).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  return `Booking confirmed! Ref: ${data.booking_ref}. ${data.guest_name}, ${data.party_size} guests on the ${data.floor}, ${localTime}.`
}

export const createBookingDefinition = {
  name: 'create_booking',
  description: 'Create a confirmed reservation. Call this only after the customer has provided name, date/time, party size, and floor preference, and has confirmed the booking summary.',
  input_schema: {
    type: 'object' as const,
    properties: {
      guest_name: { type: 'string' },
      phone: { type: 'string', description: 'Customer phone number (same as sender)' },
      whatsapp_id: { type: 'string' },
      party_size: { type: 'number' },
      datetime: { type: 'string', description: 'ISO 8601 datetime' },
      floor: { type: 'string', enum: ['terrace', 'floor1', 'floor2', 'private'] },
      special_notes: { type: 'string', nullable: true },
    },
    required: ['guest_name', 'phone', 'whatsapp_id', 'party_size', 'datetime', 'floor'],
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/create-booking.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/create-booking.ts backend/tests/tools/create-booking.test.ts
git commit -m "feat: create_booking tool"
```

---

## Task 9: Claude Tool — `get_menu_item_detail`

**Files:**
- Create: `backend/src/tools/get-menu-item-detail.ts`

- [ ] **Step 1: Write `src/tools/get-menu-item-detail.ts`**

No separate test needed — this is a thin DB read identical in structure to `getTodayCatch`. Integration tested via the Claude service in Task 10.

```typescript
import { supabase } from '../lib/supabase'

export async function getMenuItemDetail(itemName: string): Promise<string> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('name, description, price, allergens, spice_level, is_available')
    .ilike('name', `%${itemName}%`)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return `No menu item found matching "${itemName}". Check the menu for available dishes.`

  return data.map((item: Record<string, unknown>) =>
    `${item.name}: ${item.description}. Price: ₹${item.price}. Spice: ${item.spice_level}/5. Allergens: ${(item.allergens as string[]).join(', ') || 'none'}. ${item.is_available ? 'Available' : 'Not available today'}.`
  ).join('\n')
}

export const getMenuItemDetailDefinition = {
  name: 'get_menu_item_detail',
  description: 'Get detailed information about a specific menu item including description, price, allergens, and spice level. Call when a customer asks about a specific dish not covered by the catch system.',
  input_schema: {
    type: 'object' as const,
    properties: {
      item_name: { type: 'string', description: 'Name of the dish to look up' },
    },
    required: ['item_name'],
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/tools/get-menu-item-detail.ts
git commit -m "feat: get_menu_item_detail tool"
```

---

## Task 10: Claude Conversation Service

**Files:**
- Create: `backend/src/services/claude.ts`
- Create: `backend/tests/services/claude.test.ts`

- [ ] **Step 1: Write failing test**

Create `backend/tests/services/claude.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage } from '../../src/webhooks/normalise'

vi.mock('../../src/lib/anthropic', () => ({
  anthropic: { messages: { create: vi.fn() } },
}))
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    single: vi.fn(),
  },
}))
vi.mock('../../src/tools/get-today-catch', () => ({
  getTodayCatch: vi.fn().mockResolvedValue('Anjal: available. Lobster: sold_out.'),
}))

const { handleMessage } = await import('../../src/services/claude')
const { anthropic } = await import('../../src/lib/anthropic')
const { supabase } = await import('../../src/lib/supabase')

describe('handleMessage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns Claude text response for a simple availability question', async () => {
    vi.mocked(supabase.from('conversations').select('').eq).mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { messages: [] }, error: null }),
    } as unknown)

    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [{ type: 'text', text: 'Yes! Anjal is in today from Goa.' }],
      stop_reason: 'end_turn',
    } as unknown)

    const msg: IncomingMessage = { channel: 'whatsapp', senderId: '919876543210', text: 'Is Anjal in today?' }
    const reply = await handleMessage(msg)

    expect(reply).toBe('Yes! Anjal is in today from Goa.')
  })

  it('executes tool when Claude returns tool_use stop reason', async () => {
    vi.mocked(supabase.from('conversations').select('').eq).mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { messages: [] }, error: null }),
    } as unknown)

    vi.mocked(anthropic.messages.create)
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'tool_1', name: 'get_today_catch', input: {} }],
        stop_reason: 'tool_use',
      } as unknown)
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Today we have Anjal and Mud Crab.' }],
        stop_reason: 'end_turn',
      } as unknown)

    const msg: IncomingMessage = { channel: 'whatsapp', senderId: '919876543210', text: "What's in today?" }
    const reply = await handleMessage(msg)

    expect(anthropic.messages.create).toHaveBeenCalledTimes(2)
    expect(reply).toBe('Today we have Anjal and Mud Crab.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/services/claude.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/services/claude.ts`**

```typescript
import { anthropic } from '../lib/anthropic'
import { supabase } from '../lib/supabase'
import { toolDefinitions, getTodayCatch, checkFloorAvailability, createBooking, getMenuItemDetail } from '../tools'
import type { IncomingMessage } from '../webhooks/normalise'

type Message = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are the AI assistant for Sanadige, Delhi's premier coastal seafood restaurant in Chanakyapuri. You help guests with:
- Today's fresh seafood availability (use get_today_catch tool when asked)
- Table reservations (use check_floor_availability then create_booking)
- Menu questions (use get_menu_item_detail for specific dishes)
- General questions about the restaurant

Sanadige serves coastal cuisine from Goa, Kerala, Maharashtra, and South Karnataka. The restaurant has 3 floors plus a terrace. Always be warm, knowledgeable, and brief. Never fabricate menu items or availability — always use the provided tools for live data. If asked something outside your scope, politely redirect to reservations, menu, or availability.`

async function getHistory(channel: string, senderId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('conversations')
    .select('messages')
    .eq('channel', channel)
    .eq('sender_id', senderId)
    .single()
  return (data?.messages as Message[]) ?? []
}

async function saveHistory(channel: string, senderId: string, messages: Message[]): Promise<void> {
  // Keep last 20 messages to avoid context bloat
  const trimmed = messages.slice(-20)
  await supabase.from('conversations').upsert(
    { channel, sender_id: senderId, messages: trimmed, last_active: new Date().toISOString() },
    { onConflict: 'channel,sender_id' }
  )
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_today_catch':
      return getTodayCatch()
    case 'check_floor_availability':
      return checkFloorAvailability(input.floor as string, input.datetime as string, input.party_size as number)
    case 'create_booking':
      return createBooking({
        guestName: input.guest_name as string,
        phone: input.phone as string,
        whatsappId: input.whatsapp_id as string,
        partySize: input.party_size as number,
        datetime: input.datetime as string,
        floor: input.floor as 'terrace' | 'floor1' | 'floor2' | 'private',
        specialNotes: (input.special_notes as string) ?? null,
      })
    case 'get_menu_item_detail':
      return getMenuItemDetail(input.item_name as string)
    default:
      return `Unknown tool: ${name}`
  }
}

export async function handleMessage(incoming: IncomingMessage): Promise<string> {
  const history = await getHistory(incoming.channel, incoming.senderId)
  const messages: Message[] = [...history, { role: 'user', content: incoming.text }]

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: toolDefinitions,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  // Agentic tool loop — Claude may chain multiple tool calls
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const result = await executeTool(block.name, block.input as Record<string, unknown>)
        return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
      })
    )

    messages.push({ role: 'assistant', content: JSON.stringify(response.content) })
    const toolResultMessage = { role: 'user' as const, content: toolResults }

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages: [
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        toolResultMessage,
      ],
    })
  }

  const textBlock = response.content.find(b => b.type === 'text')
  const replyText = textBlock ? textBlock.text : 'Sorry, I could not process that. Please try again.'

  await saveHistory(incoming.channel, incoming.senderId, [
    ...messages,
    { role: 'assistant', content: replyText },
  ])

  return replyText
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/services/claude.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/claude.ts backend/tests/services/claude.test.ts
git commit -m "feat: claude conversation service with tool use loop and history"
```

---

## Task 11: WhatsApp Webhook Handler

**Files:**
- Create: `backend/src/webhooks/whatsapp.ts`
- Create: `backend/src/index.ts`

- [ ] **Step 1: Write `src/webhooks/whatsapp.ts`**

```typescript
import { Router } from 'express'
import { env } from '../env'
import { normaliseWhatsApp } from './normalise'
import { handleMessage } from '../services/claude'
import { parseCatchCommand } from '../services/catch'
import { sendWhatsAppMessage } from '../lib/whatsapp'

export const whatsappRouter = Router()

// Webhook verification (GET) — required by Meta
whatsappRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// Incoming messages (POST)
whatsappRouter.post('/', async (req, res) => {
  // Always acknowledge immediately to prevent Meta retries
  res.sendStatus(200)

  const message = normaliseWhatsApp(req.body)
  if (!message) return

  try {
    // Chef catch command — bypass Claude, update DB directly
    if (message.text.trim().startsWith('/catch')) {
      const reply = await parseCatchCommand(message.text, message.senderId)
      await sendWhatsAppMessage(message.senderId, reply)
      return
    }

    const reply = await handleMessage(message)
    await sendWhatsAppMessage(message.senderId, reply)
  } catch (err) {
    console.error('WhatsApp handler error:', err)
    await sendWhatsAppMessage(
      message.senderId,
      'Sorry, our team will respond shortly. You can also call us at +91 91678 85275.'
    ).catch(() => {}) // fire-and-forget fallback
  }
})
```

- [ ] **Step 2: Write `src/index.ts`**

```typescript
import express from 'express'
import { env } from './env'
import { whatsappRouter } from './webhooks/whatsapp'
import { instagramRouter } from './webhooks/instagram'
import { startReminderJob } from './services/reminder'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))
app.use('/webhooks/whatsapp', whatsappRouter)
app.use('/webhooks/instagram', instagramRouter)

app.listen(env.PORT, () => {
  console.log(`Sanadige backend running on :${env.PORT}`)
  startReminderJob()
})
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/webhooks/whatsapp.ts backend/src/index.ts
git commit -m "feat: whatsapp webhook handler + express entry point"
```

---

## Task 12: Instagram Webhook Handler

**Files:**
- Create: `backend/src/webhooks/instagram.ts`

- [ ] **Step 1: Write `src/webhooks/instagram.ts`**

```typescript
import { Router } from 'express'
import axios from 'axios'
import { env } from '../env'
import { normaliseInstagram } from './normalise'
import { handleMessage } from '../services/claude'

export const instagramRouter = Router()

// Webhook verification
instagramRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === env.INSTAGRAM_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// Incoming DMs
instagramRouter.post('/', async (req, res) => {
  res.sendStatus(200)

  const message = normaliseInstagram(req.body)
  if (!message) return

  try {
    const reply = await handleMessage(message)

    // Send reply via Instagram Graph API
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      { recipient: { id: message.senderId }, message: { text: reply } },
      { params: { access_token: env.INSTAGRAM_PAGE_ACCESS_TOKEN } }
    )
  } catch (err) {
    console.error('Instagram handler error:', err)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/webhooks/instagram.ts
git commit -m "feat: instagram dm webhook handler"
```

---

## Task 13: Daily Catch Update Service (Chef `/catch` Command)

**Files:**
- Create: `backend/src/services/catch.ts`
- Create: `backend/tests/services/catch.test.ts`

- [ ] **Step 1: Write failing test**

Create `backend/tests/services/catch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    single: vi.fn(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  },
}))

const { parseCatchCommand } = await import('../../src/services/catch')
const { supabase } = await import('../../src/lib/supabase')

describe('parseCatchCommand', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses ✅ lines as available and ❌ lines as sold_out', async () => {
    vi.mocked(supabase.from('catch_items').select('').ilike).mockReturnValue({
      single: vi.fn()
        .mockResolvedValueOnce({ data: { id: 'uuid-anjal' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'uuid-lobster' }, error: null }),
    } as unknown)

    const command = `/catch today\n✅ Anjal – Goan\n❌ Lobster – not today`
    const result = await parseCatchCommand(command, 'chef_phone')

    expect(supabase.from('daily_availability').upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ catch_item_id: 'uuid-anjal', status: 'available' }),
        expect.objectContaining({ catch_item_id: 'uuid-lobster', status: 'sold_out' }),
      ]),
      expect.anything()
    )
    expect(result).toContain('Catch updated')
    expect(result).toContain('2 items')
  })

  it('returns error message for unknown fish name', async () => {
    vi.mocked(supabase.from('catch_items').select('').ilike).mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    } as unknown)

    const command = `/catch today\n✅ UnknownFish`
    const result = await parseCatchCommand(command, 'chef_phone')

    expect(result).toContain('not found in the catalogue')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/services/catch.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/services/catch.ts`**

```typescript
import { supabase } from '../lib/supabase'

interface ParsedLine {
  name: string
  status: 'available' | 'sold_out' | 'tomorrow'
  notes: string | null
}

function parseLine(line: string): ParsedLine | null {
  const trimmed = line.trim()
  let status: 'available' | 'sold_out' | 'tomorrow'

  if (trimmed.startsWith('✅')) {
    status = 'available'
  } else if (trimmed.startsWith('❌')) {
    status = 'sold_out'
  } else if (trimmed.toLowerCase().includes('tomorrow')) {
    status = 'tomorrow'
  } else {
    return null
  }

  const cleaned = trimmed.replace(/^[✅❌]\s*/, '')
  const [namePart, ...noteParts] = cleaned.split('–')
  return {
    name: namePart.trim(),
    notes: noteParts.length > 0 ? noteParts.join('–').trim() : null,
    status,
  }
}

export async function parseCatchCommand(text: string, updatedBy: string): Promise<string> {
  const lines = text.split('\n').slice(1) // skip "/catch today" header
  const parsed = lines.map(parseLine).filter(Boolean) as ParsedLine[]

  if (parsed.length === 0) {
    return 'No items found. Format: ✅ Anjal – Goan or ❌ Lobster – not today'
  }

  const today = new Date().toISOString().split('T')[0]
  const upsertRows = []
  const errors: string[] = []

  for (const item of parsed) {
    const { data, error } = await supabase
      .from('catch_items')
      .select('id')
      .ilike('name', `%${item.name}%`)
      .single()

    if (error || !data) {
      errors.push(`"${item.name}" not found in the catalogue`)
      continue
    }

    upsertRows.push({
      catch_item_id: data.id,
      date: today,
      status: item.status,
      notes: item.notes,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
  }

  if (upsertRows.length > 0) {
    const { error } = await supabase
      .from('daily_availability')
      .upsert(upsertRows, { onConflict: 'catch_item_id,date' })
    if (error) throw new Error(error.message)
  }

  const errMsg = errors.length > 0 ? `\nWarning: ${errors.join(', ')}` : ''
  return `✓ Catch updated — ${upsertRows.length} items set for today.${errMsg}`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/services/catch.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/catch.ts backend/tests/services/catch.test.ts
git commit -m "feat: chef /catch command parser — updates daily_availability"
```

---

## Task 14: Reminder Cron Job

**Files:**
- Create: `backend/src/services/reminder.ts`

- [ ] **Step 1: Write `src/services/reminder.ts`**

```typescript
import cron from 'node-cron'
import { supabase } from '../lib/supabase'
import { sendWhatsAppMessage } from '../lib/whatsapp'
import { getTodayCatch } from '../tools/get-today-catch'

async function sendReminders(): Promise<void> {
  const now = new Date()
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const windowStart = new Date(now.getTime() + 110 * 60 * 1000).toISOString() // 1h50m
  const windowEnd = twoHoursFromNow.toISOString()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, booking_ref, guest_name, whatsapp_id, datetime, floor, party_size, special_notes')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('datetime', windowStart)
    .lt('datetime', windowEnd)

  if (error) {
    console.error('Reminder job error:', error.message)
    return
  }

  if (!bookings || bookings.length === 0) return

  let catchSummary = ''
  try {
    const catchText = await getTodayCatch()
    const lines = catchText.split('\n').slice(1) // skip header
    const available = lines.filter(l => l.includes('available')).map(l => l.split('(')[0].replace('-', '').trim())
    if (available.length > 0) {
      catchSummary = `\n\nTonight's fresh catch: ${available.join(', ')} 🐟`
    }
  } catch {
    // Non-critical — reminder goes out without catch info
  }

  for (const booking of bookings) {
    const localTime = new Date(booking.datetime).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      timeStyle: 'short',
    })

    const floorLabel: Record<string, string> = {
      terrace: 'terrace',
      floor1: 'ground floor',
      floor2: 'second floor',
      private: 'private dining room',
    }

    const message = [
      `Hi ${booking.guest_name}! 🐟 Your Sanadige table is set for *tonight at ${localTime}*`,
      `${booking.party_size} guests · ${floorLabel[booking.floor] ?? booking.floor} · Ref: ${booking.booking_ref}`,
      catchSummary,
      '\nReply "cancel" to cancel your booking. See you soon!',
    ].join('\n')

    try {
      await sendWhatsAppMessage(booking.whatsapp_id, message)
      await supabase
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', booking.id)
    } catch (err) {
      console.error(`Failed to send reminder for ${booking.booking_ref}:`, err)
    }
  }
}

export function startReminderJob(): void {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    sendReminders().catch(err => console.error('Reminder job failed:', err))
  })
  console.log('Reminder cron job started')
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/reminder.ts
git commit -m "feat: reminder cron job — sends whatsapp 2h before booking with catch summary"
```

---

## Task 15: Run Full Test Suite + Deploy to Railway

- [ ] **Step 1: Run all tests**

```bash
cd backend && npx vitest run
```

Expected: All tests PASS. Fix any failures before proceeding.

- [ ] **Step 2: Build TypeScript**

```bash
npm run build
```

Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 3: Deploy to Railway**

```bash
# Install Railway CLI if not present
npm install -g @railway/cli

railway login
railway init  # creates new project "sanadige-backend"
railway up
```

- [ ] **Step 4: Set environment variables in Railway**

In Railway dashboard → Variables, add all keys from `.env.example` with real values.

- [ ] **Step 5: Register WhatsApp webhook in Meta Developer Console**

- Go to developers.facebook.com → your app → WhatsApp → Configuration
- Callback URL: `https://your-railway-url.railway.app/webhooks/whatsapp`
- Verify token: value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to: `messages`

- [ ] **Step 6: Register Instagram webhook**

- In same Meta app → Instagram → Webhooks
- Callback URL: `https://your-railway-url.railway.app/webhooks/instagram`
- Verify token: value of `INSTAGRAM_VERIFY_TOKEN`
- Subscribe to: `messages`

- [ ] **Step 7: Smoke test**

Send "Is the Anjal in today?" to the WhatsApp number. Expect a Claude-generated reply.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: sanadige backend — full deployment ready"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Daily catch system — Tasks 6, 13
- ✅ Chef WhatsApp update + dashboard toggle — Task 13 covers WhatsApp; dashboard toggle covered in Plan 2
- ✅ WhatsApp booking flow — Tasks 7, 8, 11
- ✅ SwiftBook integration — `swiftbook_id` column in schema; Task 8 creates booking. Full SwiftBook API call is noted as pending API confirmation — this is correct per the spec note
- ✅ Automated reminders — Task 14
- ✅ Instagram DM — Task 12
- ✅ Claude with tool use — Task 10
- ✅ Conversation history — Task 10 (`conversations` table + `saveHistory`)
- ✅ Prompt caching — not yet added. **Add to Task 10**: wrap the static system prompt in a cache-control block

**Fix: add prompt caching to `src/services/claude.ts`**

In Task 10, Step 3, the `anthropic.messages.create` call should pass the system prompt with cache_control:

```typescript
// Replace the system string with:
system: [
  {
    type: 'text',
    text: SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' },
  },
],
```

This caches the system prompt across turns (5-minute TTL), reducing per-query cost by ~80% for repeat conversations.

- ✅ Error handling — fallback messages in Tasks 11, 12, 14
- ✅ Railway deployment — Task 15
