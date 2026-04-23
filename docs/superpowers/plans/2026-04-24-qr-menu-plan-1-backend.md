# QR Menu — Plan 1: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add orders API (POST/GET/PATCH), a Claude dish-chat endpoint, waiter role migration, and CORS for the menu PWA origin to the existing Express backend.

**Architecture:** Three new route files (`orders.ts`, `menu.ts`) register on the existing Express app at `sanadigapi.shopthryv.in`. A migration adds `waiter` to the `staff.role` check constraint. CORS middleware allows browser requests from `menu.sanadige.in`.

**Tech Stack:** Node.js + TypeScript, Express 5, `@supabase/supabase-js`, `@anthropic-ai/sdk`, `cors`, Vitest.

**Working directory for all commands:** `backend/`

---

## File Map

| Action | File |
|---|---|
| Create | `src/db/migrations/003_waiter_role.sql` |
| Create | `src/routes/orders.ts` |
| Create | `src/routes/menu.ts` |
| Modify | `src/index.ts` |
| Create | `tests/routes/orders.test.ts` |
| Create | `tests/routes/menu.test.ts` |

---

### Task 1: Schema migration — add waiter role

**Files:**
- Create: `backend/src/db/migrations/003_waiter_role.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/src/db/migrations/003_waiter_role.sql
alter table staff drop constraint staff_role_check;
alter table staff add constraint staff_role_check
  check (role in ('chef', 'host', 'manager', 'waiter'));
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase dashboard SQL editor for project `dbgxjcjynuqibztdjtub` and run the contents of `003_waiter_role.sql`.

Expected: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations/003_waiter_role.sql
git commit -m "feat: add waiter role to staff constraint"
```

---

### Task 2: Install cors dependency

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install**

```bash
npm install cors && npm install -D @types/cors
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('cors'); console.log('cors ok')"
```

Expected: `cors ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cors package"
```

---

### Task 3: Create orders route

**Files:**
- Create: `backend/src/routes/orders.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/routes/orders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
const selectMock = vi.fn()
const singleMock = vi.fn()
const updateMock = vi.fn()
const eqMock = vi.fn()
const gteMock = vi.fn()
const lteMock = vi.fn()
const orderMock = vi.fn()

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          insert: insertMock,
          select: vi.fn().mockReturnValue({
            gte: gteMock.mockReturnValue({
              lte: lteMock.mockReturnValue({
                order: orderMock,
                eq: eqMock,
              }),
            }),
          }),
          update: updateMock,
        }
      }
      return {}
    }),
  },
}))

const { createOrder, getOrders, updateOrderStatus } = await import('../../src/routes/orders')

describe('createOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts order and returns id', async () => {
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'order-1' }, error: null }),
      }),
    })

    const result = await createOrder({ table_id: 'T3', items: [{ menu_item_id: 'item-1', qty: 2 }] })
    expect(result).toEqual({ ok: true, id: 'order-1' })
    expect(insertMock).toHaveBeenCalledWith({
      table_id: 'T3',
      booking_id: null,
      items: [{ menu_item_id: 'item-1', qty: 2 }],
      status: 'pending',
    })
  })

  it('throws when table_id missing', async () => {
    await expect(createOrder({ table_id: '', items: [] })).rejects.toThrow('Missing table_id or items')
  })
})

describe('updateOrderStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates status to acknowledged', async () => {
    updateMock.mockReturnValue({ eq: eqMock.mockResolvedValue({ error: null }) })
    await updateOrderStatus('order-1', 'acknowledged')
    expect(updateMock).toHaveBeenCalledWith({ status: 'acknowledged' })
    expect(eqMock).toHaveBeenCalledWith('id', 'order-1')
  })

  it('throws on invalid status', async () => {
    await expect(updateOrderStatus('order-1', 'invalid')).rejects.toThrow('Invalid status')
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npm test -- tests/routes/orders.test.ts
```

Expected: FAIL — `createOrder` not found

- [ ] **Step 3: Create `src/routes/orders.ts`**

```typescript
import { Router } from 'express'
import { supabase } from '../lib/supabase'

export const ordersRouter = Router()

export async function createOrder(input: {
  table_id: string
  booking_id?: string
  items: { catch_item_id?: string; menu_item_id?: string; qty: number; notes?: string }[]
}): Promise<{ ok: true; id: string }> {
  if (!input.table_id || !input.items?.length) {
    throw new Error('Missing table_id or items')
  }
  const { data, error } = await supabase
    .from('orders')
    .insert({
      table_id: input.table_id,
      booking_id: input.booking_id ?? null,
      items: input.items,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return { ok: true, id: data.id }
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  if (!['acknowledged', 'served'].includes(status)) {
    throw new Error('Invalid status')
  }
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

ordersRouter.post('/', async (req, res) => {
  try {
    const result = await createOrder(req.body)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create order'
    if (msg === 'Missing table_id or items') return res.status(400).json({ ok: false, error: msg })
    console.error('[orders] POST error:', err)
    res.status(500).json({ ok: false, error: msg })
  }
})

ordersRouter.get('/', async (req, res) => {
  try {
    const { date, status } = req.query as { date?: string; status?: string }
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const d = date ?? istNow.toISOString().split('T')[0]
    const start = new Date(`${d}T00:00:00+05:30`).toISOString()
    const end = new Date(`${d}T23:59:59+05:30`).toISOString()

    let query = supabase
      .from('orders')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at')

    if (status) query = (query as ReturnType<typeof query.eq>).eq('status', status)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    res.json({ ok: true, orders: data })
  } catch (err) {
    console.error('[orders] GET error:', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch orders' })
  }
})

ordersRouter.patch('/:id/status', async (req, res) => {
  try {
    await updateOrderStatus(req.params.id, (req.body as { status: string }).status)
    res.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update order'
    if (msg === 'Invalid status') return res.status(400).json({ ok: false, error: msg })
    console.error('[orders] PATCH error:', err)
    res.status(500).json({ ok: false, error: msg })
  }
})
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npm test -- tests/routes/orders.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/routes/orders.ts tests/routes/orders.test.ts
git commit -m "feat: add orders route (POST/GET/PATCH)"
```

---

### Task 4: Create menu/ask route

**Files:**
- Create: `backend/src/routes/menu.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/routes/menu.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/anthropic', () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
}))

const { askAboutDish } = await import('../../src/routes/menu')
const { anthropic } = await import('../../src/lib/anthropic')

const mockCreate = vi.mocked(anthropic.messages.create)

const DISH = {
  name: 'Mud Crab',
  description: 'Live Kerala mud crab with dense, sweet claw meat.',
  spice_level: 4,
  allergens: ['Shellfish', 'Dairy'],
  recommended_preps: ['Ghee Roast', 'Pepper Masala'],
  price: 1200,
}

describe('askAboutDish', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns Claude reply for valid dish + message', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Yes, boneless is available on request.' }],
    } as never)

    const result = await askAboutDish(DISH, 'Can I get this boneless?')
    expect(result).toBe('Yes, boneless is available on request.')
    expect(mockCreate).toHaveBeenCalledOnce()

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[0].content).toBe('Can I get this boneless?')
    expect(JSON.stringify(callArgs.system)).toContain('Mud Crab')
  })

  it('throws when dish name is missing', async () => {
    await expect(askAboutDish({ ...DISH, name: '' }, 'hello')).rejects.toThrow('Missing dish or message')
  })

  it('throws when message is empty', async () => {
    await expect(askAboutDish(DISH, '')).rejects.toThrow('Missing dish or message')
  })

  it('falls back to default text when Claude returns no text block', async () => {
    mockCreate.mockResolvedValue({ content: [] } as never)
    const result = await askAboutDish(DISH, 'Is it spicy?')
    expect(result).toBe('Sorry, I could not answer that.')
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npm test -- tests/routes/menu.test.ts
```

Expected: FAIL — `askAboutDish` not found

- [ ] **Step 3: Create `src/routes/menu.ts`**

```typescript
import { Router } from 'express'
import { anthropic } from '../lib/anthropic'

export const menuRouter = Router()

interface DishContext {
  name: string
  description: string
  spice_level?: number
  allergens?: string[]
  recommended_preps?: string[]
  price?: number
}

export async function askAboutDish(dish: DishContext, message: string): Promise<string> {
  if (!dish?.name || !message) throw new Error('Missing dish or message')

  const spice = dish.spice_level ? `${dish.spice_level}/5` : 'Not rated'
  const allergens = dish.allergens?.join(', ') || 'None'
  const preps = dish.recommended_preps?.join(', ') || 'Ask staff'
  const price = dish.price ? `₹${dish.price}` : 'See menu'

  const systemText = `You are answering a guest's question about a dish at Sanadige, Delhi's premier coastal seafood restaurant.

Dish: ${dish.name}
Description: ${dish.description}
Spice level: ${spice}
Allergens: ${allergens}
Preparation options: ${preps}
Price: ${price}

Answer only questions about this specific dish. Be warm, knowledgeable, and concise (2-3 sentences max). If the guest asks about boneless or other modifications, confirm it can be added as a note when ordering. If asked something unrelated to this dish, say: "I can only help with questions about ${dish.name} — ask your waiter for anything else!"`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }] as never,
    messages: [{ role: 'user', content: message }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : 'Sorry, I could not answer that.'
}

menuRouter.post('/ask', async (req, res) => {
  try {
    const { dish, message } = req.body as { dish: DishContext; message: string }
    const reply = await askAboutDish(dish, message)
    res.json({ ok: true, reply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get answer'
    if (msg === 'Missing dish or message') return res.status(400).json({ ok: false, error: msg })
    console.error('[menu] ask error:', err)
    res.status(500).json({ ok: false, error: 'Failed to get answer' })
  }
})
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npm test -- tests/routes/menu.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/routes/menu.ts tests/routes/menu.test.ts
git commit -m "feat: add menu/ask route with Claude dish chat"
```

---

### Task 5: Register routes + CORS in index.ts

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Update `src/index.ts`**

Replace the full file contents:

```typescript
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { env } from './env'
import { whatsappRouter } from './webhooks/whatsapp'
import { instagramRouter } from './webhooks/instagram'
import { authRouter } from './routes/auth'
import { bookingsRouter } from './routes/bookings'
import { ordersRouter } from './routes/orders'
import { menuRouter } from './routes/menu'
import { startReminderJob } from './services/reminder'
import { seedManagerFromEnv } from './services/staff'

const app = express()

app.use(cors({
  origin: [
    'https://menu.sanadige.in',
    'http://localhost:3001',
  ],
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type'],
}))

app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))
app.use('/auth', authRouter)
app.use('/bookings', bookingsRouter)
app.use('/orders', ordersRouter)
app.use('/menu', menuRouter)
app.use('/webhooks/whatsapp', whatsappRouter)
app.use('/webhooks/instagram', instagramRouter)

app.listen(env.PORT, async () => {
  console.log(`Sanadige backend running on :${env.PORT}`)
  await seedManagerFromEnv()
  startReminderJob()
})
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: no errors, `dist/` updated

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: register orders + menu routes, add CORS for menu PWA"
```

---

### Task 6: Deploy backend to AWS

- [ ] **Step 1: SSH into the AWS instance and pull**

```bash
# On the AWS server:
cd /path/to/Sanadige/backend
git pull origin main
npm install
npm run build
pm2 restart sanadige-backend   # or whatever process manager is used
```

- [ ] **Step 2: Smoke-test the new endpoints**

```bash
curl -X POST https://sanadigapi.shopthryv.in/orders \
  -H "Content-Type: application/json" \
  -d '{"table_id":"T1","items":[{"menu_item_id":"test","qty":1}]}'
```

Expected: `{"ok":true,"id":"..."}` (will error on invalid UUID — that's fine, confirms route is live)

```bash
curl https://sanadigapi.shopthryv.in/orders?date=2026-04-24
```

Expected: `{"ok":true,"orders":[...]}`
