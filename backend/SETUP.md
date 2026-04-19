# Setup Guide — Sanadige Delhi Backend

Complete step-by-step instructions to go from zero to a live running backend. Follow every section in order.

---

## Prerequisites

Before starting, make sure you have:

- Node.js 20 or higher (`node --version`)
- npm 9 or higher (`npm --version`)
- An AWS account — [aws.amazon.com](https://aws.amazon.com) (account must be fully activated — add payment method and complete identity verification)
- A Supabase account — [supabase.com](https://supabase.com)
- An Anthropic account with API access — [console.anthropic.com](https://console.anthropic.com)
- A Meta Developer account — [developers.facebook.com](https://developers.facebook.com)
- A phone number that can receive WhatsApp messages (for testing)

---

## Step 1 — Clone and install dependencies

```bash
cd backend
npm install
```

Expected output: packages installed with no errors.

---

## Step 2 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose a name (e.g. `sanadige-delhi`), set a strong database password, select region **Mumbai (ap-south-1)** for lowest latency. (SanadigeDelhi@1)
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
5. You should see "Success. No rows returned." — this means all tables, indexes, and seed data were created.

**Verify the tables were created:**

Go to **Table Editor** (left sidebar). You should see: `catch_items`, `daily_availability`, `menu_items`, `bookings`, `conversations`, `staff`, `orders`.

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

Choose any secret string for webhook verification (e.g. `sanadige_webhook_secret_2026`). This is NOT a Meta-provided value — you make it up. Save it as `WHATSAPP_VERIFY_TOKEN`. You will enter this same string in the Meta webhook config in Step 11.

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

# Staff (optional — primary manager, auto-seeded on startup)
MANAGER_PHONE=919XXXXXXXXX

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
Test Files  8 passed (8)
     Tests  29 passed (29)
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

## Step 10 — Launch an EC2 instance

**Before starting:** In the AWS Console, set the region selector (top-right) to **Asia Pacific (Mumbai) — ap-south-1**.

### 10a — Create a key pair

You need a key pair to SSH into your server.

1. In the AWS Console, search for **EC2** and open it.
2. In the left sidebar, click **Key Pairs** (under Network & Security).
3. Click **Create key pair**.
4. Set:
   - **Name:** `sanadige-key`
   - **Key pair type:** RSA
   - **Private key file format:** `.pem` (Mac/Linux) or `.ppk` (Windows/PuTTY)
5. Click **Create key pair**. The `.pem` file downloads automatically — **save it somewhere safe**, you cannot download it again.
6. On Mac/Linux, restrict its permissions:
   ```bash
   chmod 400 ~/Downloads/sanadige-key.pem
   ```

### 10b — Launch the instance

1. In the EC2 left sidebar, click **Instances** → **Launch instances**.
2. **Name:** `sanadige-backend`
3. **AMI (operating system):** Select **Ubuntu Server 22.04 LTS** (Free tier eligible)
4. **Instance type:** `t2.micro` (Free tier — 750 hours/month free for 12 months)
5. **Key pair:** Select `sanadige-key`
6. **Network settings:** Click **Edit** and configure the security group:
   - Keep the default SSH rule (port 22, source: Anywhere)
   - Click **Add security group rule** and add:
     - Type: Custom TCP | Port: 3000 | Source: Anywhere (0.0.0.0/0)
     - This is the port the Node.js app listens on
7. **Storage:** Keep the default 8 GB (free tier includes 30 GB, you can leave it at 8).
8. Click **Launch instance**.

Wait about 60 seconds for the instance to reach **Running** state.

### 10c — Get a static IP address (Elastic IP)

By default, EC2 public IPs change every time the instance restarts. An Elastic IP is a static IP that stays the same — you need this for the Meta webhook URL.

1. In the EC2 left sidebar, click **Elastic IPs** (under Network & Security).
2. Click **Allocate Elastic IP address** → **Allocate**.
3. Select the newly created Elastic IP → click **Actions** → **Associate Elastic IP address**.
4. Under **Instance**, select your `sanadige-backend` instance.
5. Click **Associate**.

Copy the Elastic IP — you will use it as `YOUR_SERVER_IP` in all commands below.

---

## Step 11 — Set up the server

### 11a — Connect via SSH

```bash
ssh -i ~/Downloads/sanadige-key.pem ubuntu@YOUR_SERVER_IP
```

You should see a welcome message: `Welcome to Ubuntu 22.04 LTS`. You are now inside your server.

### 11b — Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v20.x.x
```

### 11c — Install git and clone the repository

```bash
sudo apt-get install -y git
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git sanadige
cd sanadige/backend
```

Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME` with your actual repository details. If the repository is private, you will need to authenticate with a GitHub personal access token.

### 11d — Install dependencies and build

```bash
npm install
npm run build
```

Expected output: TypeScript compiles with no errors, `dist/` directory is created.

### 11e — Create the environment file

```bash
nano .env
```

Paste in the following and fill in your real values:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

ANTHROPIC_API_KEY=sk-ant-api03-...

WHATSAPP_TOKEN=EAAxxxxxxx...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=sanadige_webhook_secret_2026

INSTAGRAM_PAGE_ACCESS_TOKEN=EAAxxxxxxx...
INSTAGRAM_VERIFY_TOKEN=sanadige_instagram_secret_2026

MANAGER_PHONE=919XXXXXXXXX

PORT=3000
```

Save and exit: press `Ctrl+X`, then `Y`, then `Enter`.

### 11f — Test the server runs

```bash
node dist/index.js
```

Expected output:
```
Sanadige backend running on :3000
```

Press `Ctrl+C` to stop it. If you see a ZodError, check that all required env vars are filled in `.env`.

### 11g — Install PM2 and keep the server running permanently

PM2 is a process manager that keeps Node.js apps running after you disconnect from SSH, and restarts them automatically if they crash.

```bash
sudo npm install -g pm2
pm2 start dist/index.js --name sanadige-backend
pm2 status   # should show sanadige-backend as "online"
```

**Make PM2 start on server reboot:**

```bash
pm2 startup
```

This prints a command starting with `sudo env PATH=...`. **Copy and run that exact command** — it registers PM2 with systemd so it restarts on reboot.

Then save the current process list:

```bash
pm2 save
```

### 11h — Verify the server is running

From your local machine:

```bash
curl http://YOUR_SERVER_IP:3000/health
# {"ok":true,"ts":"2026-04-..."}
```

### 11i — Set up HTTPS with nginx and Certbot

Meta requires an HTTPS webhook URL. You need a domain name pointing to your server first (set up the custom domain in 11j before running these steps).

Install nginx as a reverse proxy:

```bash
sudo apt-get install -y nginx
```

Create a config file for your site:

```bash
sudo nano /etc/nginx/sites-available/sanadige
```

Paste this (replace `api.sanadige.in` with your domain):

```nginx
server {
    listen 80;
    server_name api.sanadige.in;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Save and exit (`Ctrl+X`, `Y`, `Enter`), then enable the config:

```bash
sudo ln -s /etc/nginx/sites-available/sanadige /etc/nginx/sites-enabled/
sudo nginx -t          # should print "syntax is ok"
sudo systemctl restart nginx
```

Install Certbot to get a free SSL certificate:

```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d api.sanadige.in
```

Follow the prompts — enter your email, agree to terms. Certbot automatically modifies your nginx config to handle HTTPS and sets up auto-renewal. When complete, your backend is reachable at `https://api.sanadige.in`.

**Verify:**
```bash
curl https://api.sanadige.in/health
# {"ok":true,"ts":"2026-04-..."}
```

### 11j — Point your domain to the server

Before running Certbot, add an A record at your DNS provider:

| Type | Name | Value |
|------|------|-------|
| A | `api` | `YOUR_SERVER_IP` (the Elastic IP) |

DNS propagation takes 1–30 minutes. You can check with:
```bash
nslookup api.sanadige.in
```

Once it resolves to your Elastic IP, run the Certbot step (11i) above.

---

## Step 12 — Register the WhatsApp webhook with Meta

1. Go to [developers.facebook.com](https://developers.facebook.com) → Your App → **WhatsApp → Configuration** (left sidebar).
2. Under **Webhook**, click **Edit**.
3. Enter:
   - **Callback URL**: `https://abcdefghij.ap-south-1.awsapprunner.com/webhooks/whatsapp`
   - **Verify token**: the same value as `WHATSAPP_VERIFY_TOKEN`
4. Click **Verify and Save**. Meta will send a GET request to your server; your server will respond with the challenge. If verification fails, check that the deployment is running and the token matches exactly.
5. Under **Webhook fields**, click **Manage** and subscribe to: **messages** ✓
6. Click **Done**.

---

## Step 13 — Register the Instagram webhook with Meta

1. Go to your Meta App → **Instagram → Webhooks** (left sidebar).
2. Click **Add Callback URL**.
3. Enter:
   - **Callback URL**: `https://abcdefghij.ap-south-1.awsapprunner.com/webhooks/instagram`
   - **Verify token**: the same value as `INSTAGRAM_VERIFY_TOKEN`
4. Click **Verify and Save**.
5. Subscribe to the **messages** field.

---

## Step 14 — Test WhatsApp end-to-end

1. Open WhatsApp on your phone.
2. Send a message to the Sanadige WhatsApp Business number: `Is the Anjal in today?`
3. You should receive a Claude-generated reply within a few seconds.

If you do not receive a reply:

- Check PM2 logs: SSH into the server and run `pm2 logs sanadige-backend --lines 100`
- Check that your phone number is added as a test recipient in the Meta Developer console (for test numbers, Meta restricts which numbers can receive messages)
- Check the Supabase dashboard → Table Editor → `conversations` to see if the message was stored

---

## Step 15 — Test the chef catch command

Send the following from the manager's WhatsApp number (the one set as `MANAGER_PHONE`):

```
/catch today
✅ Anjal – Goan
✅ Mud Crab – live today
❌ Lobster – not today
```

The bot should reply: `✓ Catch updated — 3 items set for today.`

Verify in Supabase → Table Editor → `daily_availability` that the rows were created or updated.

---

## Step 16 — Seed the menu_items table (optional but recommended)

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

## Redeployment (after code changes)

SSH into the server, pull the latest code, rebuild, and restart:

```bash
ssh -i ~/Downloads/sanadige-key.pem ubuntu@YOUR_SERVER_IP
cd sanadige/backend
git pull
npm install
npm run build
pm2 restart sanadige-backend
```

PM2 restarts the process with zero manual intervention. Traffic has a brief interruption (a few seconds) while the process restarts — acceptable for a staff operations tool.

---

## Troubleshooting

### Server won't start: ZodError

One or more env vars are missing. The error will list exactly which ones. Check the `--set-env-vars` flag in your deploy command.

### Meta webhook verification fails (403)

- Confirm the service is live (`curl /health`)
- Confirm the verify token in Meta's dashboard matches `WHATSAPP_VERIFY_TOKEN` exactly (case-sensitive)

### WhatsApp message received but no reply sent

Check the live logs on the server:

```bash
ssh -i ~/Downloads/sanadige-key.pem ubuntu@YOUR_SERVER_IP
pm2 logs sanadige-backend --lines 100
```

Common causes:

- `ANTHROPIC_API_KEY` is wrong or rate-limited
- `WHATSAPP_TOKEN` has expired (Meta tokens expire — regenerate in the developer console, then update `.env` on the server and run `pm2 restart sanadige-backend`)

### Updating env vars after deployment

SSH in, edit the `.env` file, and restart:

```bash
ssh -i ~/Downloads/sanadige-key.pem ubuntu@YOUR_SERVER_IP
cd sanadige/backend
nano .env
# make your changes, save with Ctrl+X → Y → Enter
pm2 restart sanadige-backend
```

### Supabase error: row-level security

The backend uses the `service_role` key which bypasses RLS. If you see permission errors, verify you used `SUPABASE_SERVICE_ROLE_KEY` (not the `anon` key).

### Reminders not sending

The reminder cron runs every 10 minutes. Check:

1. PM2 logs: `pm2 logs sanadige-backend --lines 200` — look for `[Reminder job]` entries
2. That bookings in the `bookings` table have `status = 'confirmed'` and `reminder_sent_at IS NULL`
3. That the booking `datetime` is within 1h50m–2h from now (IST)
4. That PM2 is running: `pm2 status` — the process should show as `online`. If it shows `stopped`, run `pm2 start sanadige-backend`

---

## Going to production

Before going live with real customers:

1. **Upgrade WhatsApp from test number to production** — submit your app for Meta review at [developers.facebook.com](https://developers.facebook.com). This unlocks sending to all numbers (not just test recipients).
2. **Rotate your verify tokens** — use strong random strings, not memorable words.
3. **Attach a custom domain** — `api.sanadige.in` (see Step 11f).
4. **Upgrade Supabase to Pro** (~$25/month) — enables daily backups, point-in-time recovery, and prevents the free tier from pausing after inactivity.
5. **Set up Supabase Row Level Security (RLS)** on the `bookings` and `conversations` tables if you add any client-side access.
6. **Monitor Claude API costs** — check [console.anthropic.com](https://console.anthropic.com) usage. Prompt caching is enabled by default and reduces costs by ~80% per repeated system prompt call.
7. **Set up server monitoring** — install a free uptime monitor like [UptimeRobot](https://uptimerobot.com) pointed at `https://api.sanadige.in/health`. It will alert you by email or SMS if the server goes down.
