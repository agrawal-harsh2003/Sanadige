# Setup Guide — Sanadige Delhi Backend

Complete step-by-step instructions to go from zero to a live running backend. Follow every section in order.

---

## Prerequisites

Before starting, make sure you have:

- Node.js 20 or higher (`node --version`)
- npm 9 or higher (`npm --version`)
- A Supabase account — [supabase.com](https://supabase.com)
- An Anthropic account with API access — [console.anthropic.com](https://console.anthropic.com)
- A Meta Developer account — [developers.facebook.com](https://developers.facebook.com)
- A Railway account — [railway.app](https://railway.app)
- A phone number that can receive WhatsApp messages (for testing)

---

## Step 1 — Clone and install dependencies

```bash
# Navigate to the backend directory
cd backend

# Install all dependencies
npm install
```

Expected output: packages installed with no errors.

---

## Step 2 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose a name (e.g. `sanadige-delhi`), set a strong database password, select region **Mumbai (ap-south-1)** for lowest latency.
4. Wait for the project to finish provisioning (about 60 seconds).
5. Go to **Project Settings → API**.
6. Copy the following values — you will need them in Step 5:
   - **Project URL** (looks like `https://xxxx.supabase.co`) → `SUPABASE_URL`
   - **service_role** key (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 3 — Run the database schema

1. In your Supabase project, go to **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open the file `backend/src/db/schema.sql` on your machine and copy its entire contents.
4. Paste into the SQL editor and click **Run** (or press Cmd+Enter / Ctrl+Enter).
5. You should see "Success. No rows returned." — this means all 6 tables, indexes, and seed data were created.

**Verify the tables were created:**

Go to **Table Editor** (left sidebar). You should see: `catch_items`, `daily_availability`, `menu_items`, `bookings`, `conversations`, `orders`.

**Enable Realtime** (needed for the QR menu in Plan 3, optional for now):

1. Go to **Database → Replication** in the Supabase dashboard.
2. Under "Supabase Realtime", toggle on `daily_availability`, `bookings`, and `orders`.

---

## Step 4 — Get your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com).
2. Click **API Keys** in the left sidebar.
3. Click **Create Key**, name it `sanadige-backend`.
4. Copy the key (starts with `sk-ant-`) → `ANTHROPIC_API_KEY`

Keep this key secret. It is never committed to the repository.

---

## Step 5 — Set up Meta WhatsApp Cloud API

### 5a — Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com) and sign in.
2. Click **My Apps → Create App**.
3. Select **Business** as the app type.
4. Enter app name: `Sanadige Delhi Bot`. Enter your contact email. Click **Create App**.

### 5b — Add WhatsApp to your app

1. On your app dashboard, find **WhatsApp** in the "Add products to your app" section and click **Set up**.
2. You will land on the WhatsApp Getting Started page.
3. Under "Step 1: Select phone numbers", click **Add phone number** and follow the flow to add a WhatsApp Business number. (For testing, Meta provides a free test number.)
4. Once added, copy:
   - **Access token** (at the top of the page) → `WHATSAPP_TOKEN`
   - **Phone number ID** (shown below the number) → `WHATSAPP_PHONE_NUMBER_ID`

### 5c — Set your verify token

Choose any secret string for webhook verification (e.g. `sanadige_webhook_secret_2026`). This is NOT a Meta-provided value — you make it up. Save it as `WHATSAPP_VERIFY_TOKEN`. You will enter this same string in the Meta webhook config in Step 9.

---

## Step 6 — Set up Meta Instagram Graph API

### 6a — Add Instagram to your app

1. On your Meta app dashboard, find **Instagram** in the products list and click **Set up**.
2. Under "Instagram Basic Display" or "Instagram API with Instagram Login", connect the Sanadige Instagram account (`@sanadige`).
3. Once connected, go to **Instagram → API setup** and generate a **Page Access Token** for the account.
4. Copy:
   - **Page Access Token** → `INSTAGRAM_PAGE_ACCESS_TOKEN`

### 6b — Set your Instagram verify token

Choose another secret string (e.g. `sanadige_instagram_secret_2026`). Save as `INSTAGRAM_VERIFY_TOKEN`.

---

## Step 7 — Create your .env file

In the `backend/` directory, create a file named `.env` (copy from `.env.example`):

```bash
cp .env.example .env
```

Open `.env` and fill in all values:

```bash
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...

# Meta WhatsApp Cloud API
WHATSAPP_TOKEN=EAAxxxxxxx...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=sanadige_webhook_secret_2026

# Meta Graph API (Instagram)
INSTAGRAM_PAGE_ACCESS_TOKEN=EAAxxxxxxx...
INSTAGRAM_VERIFY_TOKEN=sanadige_instagram_secret_2026

# SwiftBook (leave empty for now — fill in when API is confirmed)
SWIFTBOOK_API_KEY=
SWIFTBOOK_PROPERTY_ID=

PORT=3000
```

**Important:** Never commit `.env` to git. It is already in `.gitignore`.

---

## Step 8 — Run tests locally

```bash
cd backend
npm test
```

Expected output:
```
Test Files  7 passed (7)
     Tests  21 passed (21)
```

If any test fails, check your Node.js version (`node --version` — must be 20+) and re-run `npm install`.

---

## Step 9 — Run locally for development

```bash
npm run dev
```

The server starts on port 3000. Test the health endpoint:

```bash
curl http://localhost:3000/health
# {"ok":true,"ts":"2026-04-17T..."}
```

**Note:** The server will fail to start if any required env var is missing. The error message will tell you exactly which variable is missing.

---

## Step 10 — Deploy to Railway

### 10a — Install Railway CLI

```bash
npm install -g @railway/cli
```

### 10b — Log in to Railway

```bash
railway login
```

A browser window will open. Sign in with your Railway account.

### 10c — Create a new Railway project

```bash
cd backend
railway init
```

- When prompted for a project name, enter: `sanadige-backend`
- When asked to link to existing project, choose **Create new project**

### 10d — Deploy

```bash
railway up
```

Railway will upload the code, detect it as a Node.js project via NIXPACKS, run `npm run build && npm start`, and give you a deployment URL.

Your deployment URL will look like: `https://sanadige-backend-production.up.railway.app`

### 10e — Set environment variables in Railway

1. Go to [railway.app](https://railway.app) and open your `sanadige-backend` project.
2. Click on the service → **Variables** tab.
3. Click **New Variable** and add every variable from your `.env` file (all 11 of them).

Alternatively, use the CLI to bulk-import:

```bash
railway variables set \
  SUPABASE_URL="your-value" \
  SUPABASE_SERVICE_ROLE_KEY="your-value" \
  ANTHROPIC_API_KEY="your-value" \
  WHATSAPP_TOKEN="your-value" \
  WHATSAPP_PHONE_NUMBER_ID="your-value" \
  WHATSAPP_VERIFY_TOKEN="your-value" \
  INSTAGRAM_PAGE_ACCESS_TOKEN="your-value" \
  INSTAGRAM_VERIFY_TOKEN="your-value" \
  PORT="3000"
```

### 10f — Verify deployment

```bash
curl https://your-railway-url.railway.app/health
# {"ok":true,"ts":"2026-04-17T..."}
```

---

## Step 11 — Register the WhatsApp webhook with Meta

1. Go to [developers.facebook.com](https://developers.facebook.com) → Your App → **WhatsApp → Configuration** (left sidebar).
2. Under **Webhook**, click **Edit**.
3. Enter:
   - **Callback URL**: `https://your-railway-url.railway.app/webhooks/whatsapp`
   - **Verify token**: the same value as `WHATSAPP_VERIFY_TOKEN` in your `.env`
4. Click **Verify and Save**. Meta will send a GET request to your server; your server will respond with the challenge. If verification fails, double-check that your Railway deployment is running and the `WHATSAPP_VERIFY_TOKEN` matches exactly.
5. Under **Webhook fields**, click **Manage** and subscribe to: **messages** ✓
6. Click **Done**.

---

## Step 12 — Register the Instagram webhook with Meta

1. Go to your Meta App → **Instagram → Webhooks** (left sidebar).
2. Click **Add Callback URL**.
3. Enter:
   - **Callback URL**: `https://your-railway-url.railway.app/webhooks/instagram`
   - **Verify token**: the same value as `INSTAGRAM_VERIFY_TOKEN` in your `.env`
4. Click **Verify and Save**.
5. Subscribe to the **messages** field.

---

## Step 13 — Test WhatsApp end-to-end

1. Open WhatsApp on your phone.
2. Send a message to the Sanadige WhatsApp Business number: `Is the Anjal in today?`
3. You should receive a Claude-generated reply within a few seconds.

If you do not receive a reply:

- Check Railway logs: `railway logs` in your terminal
- Check that your phone number is added as a test recipient in the Meta Developer console (for test numbers, Meta restricts which numbers can receive messages)
- Check the Supabase dashboard → Table Editor → `conversations` to see if the message was stored

---

## Step 14 — Test the chef catch command

Send the following from a WhatsApp number that is authorised (any number works in test mode):

```
/catch today
✅ Anjal – Goan
✅ Mud Crab – live today
❌ Lobster – not today
```

The bot should reply: `✓ Catch updated — 3 items set for today.`

Verify in Supabase → Table Editor → `daily_availability` that the rows were created or updated.

---

## Step 15 — Seed the menu_items table (optional but recommended)

The `catch_items` table is pre-seeded by the schema with 6 seafood items. The `menu_items` table (starters, mains, vegetarian, drinks) needs to be populated manually.

In the Supabase SQL editor, run inserts like:

```sql
insert into menu_items (name, category, description, price, allergens, spice_level, is_available)
values
  ('Prawn Koliwada', 'Starters', 'Batter-fried prawns with green chutney', 480, array['Shellfish', 'Gluten'], 2, true),
  ('Crab Soup', 'Starters', 'Creamy crab bisque with coastal spices', 320, array['Shellfish', 'Dairy'], 2, true),
  ('Konkani Fish Curry', 'Mains', 'Catch of the day in coconut-tamarind curry, served with rice', 580, array['Fish'], 3, true),
  ('Appam', 'Mains', 'Soft rice hoppers — pair with any curry', 120, array['Gluten'], 1, true);
```

Add as many dishes as needed. The `get_menu_item_detail` tool searches by name using a partial match (`ilike`), so customers can ask "what's in the Koliwada?" and Claude will find it.

---

## Troubleshooting

### Server won't start: ZodError

One or more env vars are missing. The error will list exactly which ones. Check your `.env` file.

### Meta webhook verification fails (403)

- Confirm your Railway deployment is live (`curl /health`)
- Confirm the verify token in Meta's dashboard matches `WHATSAPP_VERIFY_TOKEN` exactly (case-sensitive)

### WhatsApp message received but no reply sent

Check Railway logs for errors. Common causes:
- `ANTHROPIC_API_KEY` is wrong or rate-limited
- `WHATSAPP_TOKEN` has expired (Meta tokens expire — regenerate in the developer console and update Railway env vars)

### Supabase error: row-level security

The backend uses the `service_role` key which bypasses RLS. If you see permission errors, verify you used `SUPABASE_SERVICE_ROLE_KEY` (not the `anon` key).

### Reminders not sending

The reminder cron runs every 10 minutes. Check:
1. Railway logs for `[Reminder job]` entries
2. That bookings in the `bookings` table have `status = 'confirmed'` and `reminder_sent_at IS NULL`
3. That the booking `datetime` is within 1h50m–2h from now (UTC)

---

## Going to production

Before going live with real customers:

1. **Upgrade WhatsApp from test number to production** — submit your app for Meta review at [developers.facebook.com](https://developers.facebook.com). This unlocks sending to all numbers (not just test recipients).
2. **Rotate your verify tokens** — use strong random strings, not memorable words.
3. **Set up Supabase Row Level Security (RLS)** on the `bookings` and `conversations` tables if you add any client-side access.
4. **Enable Supabase database backups** — go to Project Settings → Database → Backups.
5. **Set Railway to always-on** — under your service settings, disable sleep on inactivity (requires paid plan).
6. **Monitor Claude API costs** — check [console.anthropic.com](https://console.anthropic.com) usage. Prompt caching is enabled by default and reduces costs by ~80% per repeated system prompt call.
