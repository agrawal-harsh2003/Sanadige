# Sanadige — Step-by-Step Setup Guide

This guide takes you from zero to a fully running system. Follow every step in order. Nothing is assumed to be pre-configured.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Firebase Project Setup](#2-firebase-project-setup)
3. [Groq API Key](#3-groq-api-key)
4. [Meta WhatsApp Business API](#4-meta-whatsapp-business-api)
5. [Backend — Local Setup](#5-backend--local-setup)
6. [Dashboard — Local Setup](#6-dashboard--local-setup)
7. [Firestore Indexes and Rules](#7-firestore-indexes-and-rules)
8. [Seed Initial Data](#8-seed-initial-data)
9. [WhatsApp Webhook (Local Testing)](#9-whatsapp-webhook-local-testing)
10. [WhatsApp Message Template](#10-whatsapp-message-template)
11. [Deploy Backend to Production](#11-deploy-backend-to-production)
12. [Deploy Dashboard to Vercel](#12-deploy-dashboard-to-vercel)
13. [Register Production Webhook](#13-register-production-webhook)
14. [Post-Deployment Checklist](#14-post-deployment-checklist)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Prerequisites

### Accounts you need before starting

| Service                | URL                     | What for                         |
| ---------------------- | ----------------------- | -------------------------------- |
| Google account         | accounts.google.com     | Firebase                         |
| Meta developer account | developers.facebook.com | WhatsApp API                     |
| Meta Business account  | business.facebook.com   | WhatsApp Business profile        |
| Groq account           | console.groq.com        | AI assistant (free tier works)   |
| Vercel account         | vercel.com              | Dashboard hosting                |
| AWS account (optional) | aws.amazon.com          | Backend hosting (or use any VPS) |

### Software on your machine

```bash
# Verify these versions
node --version   # must be 20 or higher
npm --version    # must be 9 or higher
git --version

# Install Firebase CLI globally
npm install -g firebase-tools

# Install ngrok for local webhook testing (one-time)
# Download from https://ngrok.com/download or:
brew install ngrok/ngrok/ngrok   # macOS
```

---

## 2. Firebase Project Setup

### 2.1 Create the Firebase project

1. Go to https://console.firebase.google.com
2. Click **Add project**
3. Name it `sanadige` (or any name you want)
4. Disable Google Analytics (not needed)
5. Click **Create project**

### 2.2 Enable Firestore

1. In your project, click **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in production mode**
4. Select region: **asia-south1 (Mumbai)** — closest to Delhi
5. Click **Enable**

### 2.3 Enable Phone Authentication

This is what staff use to log in via OTP.

1. Click **Authentication** in the left sidebar
2. Click **Get started**
3. Click the **Sign-in method** tab
4. Click **Phone** in the providers list
5. Toggle **Enable** → click **Save**
6. Click **Add domain** under the **Authorized domains** section
7. Add your Vercel dashboard domain (e.g. `sanadige-dashboard.vercel.app`) — you can add it after deployment too
8. Also add `localhost` if not already there (for local testing)

### 2.4 Get the Service Account Key (for backend + dashboard server)

The service account is what lets the Express backend and Next.js server-side code write to Firestore and verify sessions — bypassing all security rules.

1. Click the gear icon ⚙️ → **Project settings**
2. Click the **Service accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** in the confirmation dialog
5. A JSON file will download — keep it safe, never commit it to git

Open the JSON file and note these three values — you will need them as env vars:

```
"project_id": "your-project-id"         → FIREBASE_PROJECT_ID
"client_email": "firebase-adminsdk-..."  → FIREBASE_CLIENT_EMAIL
"private_key": "-----BEGIN PRIVATE KEY-----\n..."  → FIREBASE_PRIVATE_KEY
```

> **Important about FIREBASE_PRIVATE_KEY**: The key contains literal `\n` characters. When you paste it into a `.env` file, keep it exactly as-is on one line with `\n` still in it (not actual newlines). The code does `.replace(/\\n/g, '\n')` at runtime. If your key has actual newlines, escape them back to `\n`.

### 2.5 Get the Web App Config (for dashboard browser-side)

This is what lets the browser-side login page talk to Firebase Phone Auth.

1. Still in **Project settings**, click the **General** tab
2. Scroll down to **Your apps**
3. Click the **</>** (web) icon to add a web app
4. Name it `sanadige-dashboard`
5. Do **not** enable Firebase Hosting (you use Vercel)
6. Click **Register app**
7. Copy the `firebaseConfig` object shown — you need:

```js
apiKey: "AIza..."          → NEXT_PUBLIC_FIREBASE_API_KEY
authDomain: "sanadige.firebaseapp.com"  → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
projectId: "sanadige"      → NEXT_PUBLIC_FIREBASE_PROJECT_ID
appId: "1:123:web:abc"     → NEXT_PUBLIC_FIREBASE_APP_ID
```

### 2.6 Log in with Firebase CLI

```bash
firebase login
# Opens browser — sign in with the same Google account
firebase projects:list
# Confirm your project appears in the list
```

---

## 3. Groq API Key

Groq powers the WhatsApp AI booking assistant. The free tier is sufficient.

1. Go to https://console.groq.com
2. Sign up / log in
3. Click **API Keys** in the left sidebar
4. Click **Create API Key**
5. Name it `sanadige-backend`
6. Copy the key — it starts with `gsk_`
7. Save it — you only see it once

This becomes `GROQ_API_KEY` in the backend.

---

## 4. Meta WhatsApp Business API

This is the most involved external service. Work through it carefully.

### 4.1 Create a Meta Developer App

1. Go to https://developers.facebook.com/apps
2. Click **Create App**
3. Select **Business** as the app type
4. Fill in:
   - App name: `Sanadige`
   - App contact email: your email
   - Business account: select or create your Meta Business account
5. Click **Create app**

### 4.2 Add WhatsApp to the App

1. In your app dashboard, find **Add products to your app**
2. Find **WhatsApp** and click **Set up**
3. You're now in the WhatsApp setup flow

### 4.3 Get Your Phone Number ID and Temporary Token

1. Click **API Setup** in the WhatsApp left sidebar
2. Under **Step 1**, you'll see a test phone number — Meta provides one for free testing
3. Note the **Phone number ID** (a long number like `123456789012345`) → `WHATSAPP_PHONE_NUMBER_ID`
4. Click **Generate token** to get the temporary access token → `WHATSAPP_TOKEN`

> **Temporary token note**: The token from the API Setup page expires in 24 hours. For production you need a permanent token — see step 4.5.

### 4.4 Add a Test Recipient

Before your app is live, you can only send messages to explicitly listed recipients.

1. Under **Step 2** on the API Setup page, click **Add phone number**
2. Enter the WhatsApp number you want to test with (e.g. your own phone)
3. A code is sent to that number — enter it to verify

### 4.5 Get a Permanent Access Token (for production)

1. Go to https://business.facebook.com/settings
2. Click **System users** in the left sidebar
3. Click **Add** → create a system user named `Sanadige Bot` with role **Admin**
4. Click on the system user → **Add assets**
5. Select **Apps** → select your `Sanadige` app → give **Full control**
6. Click **Generate new token** → select your app → check these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
7. Copy the token — this is your permanent `WHATSAPP_TOKEN`

### 4.6 Create a Verify Token

The verify token is a secret string you invent. It's used to prove to Meta that the webhook URL is yours.

```bash
# Generate a random one:
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
# Example output: a3f9c1e2b5d8f047...
```

Save this as `WHATSAPP_VERIFY_TOKEN` in your backend `.env`. You'll also enter it in the Meta dashboard when registering the webhook (Step 9 and 13).

---

## 5. Backend — Local Setup

### 5.1 Navigate to the backend

```bash
cd /path/to/sanadige/backend
```

### 5.2 Install dependencies

```bash
npm install
```

### 5.3 Create the environment file

```bash
cp .env.example .env 2>/dev/null || touch .env
```

Open `.env` and fill in every value:

```env
# ── Firebase ────────────────────────────────────────────────────────────────────
# From the service account JSON you downloaded in step 2.4
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# ── Groq AI ─────────────────────────────────────────────────────────────────────
# From step 3
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── WhatsApp Cloud API ──────────────────────────────────────────────────────────
# From step 4.3 / 4.5
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# From step 4.3 — the Phone number ID (not the phone number itself)
WHATSAPP_PHONE_NUMBER_ID=123456789012345
# The random string you created in step 4.6
WHATSAPP_VERIFY_TOKEN=a3f9c1e2b5d8f047your_random_string

# ── Initial Manager (optional but recommended) ──────────────────────────────────
# On first startup, a manager staff record is created for this number.
# Include country code, no + or spaces: e.g. 919876543210 for +91 98765 43210
MANAGER_PHONE=919876543210
MANAGER_NAME=Harsh

# ── Server ──────────────────────────────────────────────────────────────────────
PORT=3001
```

> **FIREBASE_PRIVATE_KEY formatting**: Wrap the entire key in double quotes in the `.env` file. The key from the JSON contains `\n` — leave those as literal `\n` (two characters, backslash + n), not actual line breaks. The code converts them at runtime.

### 5.4 Start the backend in development

```bash
npm run dev
```

You should see:

```
Sanadige backend running on :3001
[staff] Manager seeded from env: 919876543210
[reminder] Cron jobs started
```

### 5.5 Verify it's running

```bash
curl http://localhost:3001/health
# Expected: {"ok":true,"ts":"2026-04-27T..."}
```

---

## 6. Dashboard — Local Setup

Open a **new terminal tab** — keep the backend running.

### 6.1 Navigate to the dashboard

```bash
cd /path/to/sanadige/dashboard
```

### 6.2 Install dependencies

```bash
npm install
```

### 6.3 Create the environment file

```bash
touch .env.local
```

Open `.env.local` and fill in every value:

```env
# ── Firebase Admin SDK (server-side — same values as backend) ───────────────────
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# ── Firebase Client SDK (browser-side — from step 2.5) ─────────────────────────
# These are public — safe to expose in the browser
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# ── Session Security ────────────────────────────────────────────────────────────
# Random secret for signing session cookies — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
JWT_SECRET=your_64_character_random_base64_string_here==

# ── Backend URL ─────────────────────────────────────────────────────────────────
# In development, point to your local backend
BACKEND_URL=http://localhost:3001
# In production, use your deployed backend URL:
# BACKEND_URL=https://api.yourdomain.com
```

### 6.4 Start the dashboard in development

```bash
npm run dev
```

You should see:

```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

### 6.5 Verify the login page loads

Open http://localhost:3000/login in your browser. You should see the Sanadige OTP login form.

### 6.6 Test logging in

1. Enter the phone number you registered as manager in step 5.3 (`MANAGER_PHONE`)
2. A 6-digit OTP is sent via Firebase Phone Auth SMS
3. Enter the OTP
4. You should be redirected to `/dashboard`

> **If OTP doesn't arrive**: Make sure Phone Auth is enabled in Firebase (step 2.3) and that `localhost` is in the authorized domains list.

---

## 7. Firestore Indexes and Rules

These must be deployed before the system works in production. Run from the **root** of the repo (where `firestore.indexes.json` and `firestore.rules` live).

### 7.1 Set the active Firebase project

```bash
cd /path/to/sanadige
firebase use your-firebase-project-id
# Or: firebase use --add  (to select from list)
```

### 7.2 Deploy indexes

Composite indexes are required for queries that filter on multiple fields. Without them, queries will fail with a Firestore error pointing you to the console.

```bash
firebase deploy --only firestore:indexes
```

This takes 1–5 minutes to build. You can check progress in the Firebase console under **Firestore → Indexes**.

### 7.3 Deploy security rules

```bash
firebase deploy --only firestore:rules
```

**What the rules do**: All writes go through the backend (Admin SDK bypasses rules entirely). The dashboard reads Firestore directly only for real-time listeners — reads are allowed for authenticated Firebase users. Everything else is denied.

### 7.4 Verify rules are live

```bash
firebase firestore:indexes
# Should list all your indexes with status "READY"
```

---

## 8. Seed Initial Data

### 8.1 Manager staff record

The backend auto-seeds the manager record on first startup using `MANAGER_PHONE` and `MANAGER_NAME` from `.env`. If you started the backend in step 5.4, this already ran.

To verify it worked, check Firestore in the console:

1. Go to https://console.firebase.google.com → your project
2. Click **Firestore Database**
3. Click the `staff` collection
4. You should see a document with your phone number, name, and `role: "manager"`

If the collection is empty, restart the backend — it seeds on startup.

### 8.2 Add more staff members

Staff records are managed via WhatsApp. Message the registered business number with text `menu` → select **Staff** → **Add staff**.

Alternatively, add them directly in Firestore:

1. In the Firestore console, click **Start collection** (or click into the `staff` collection)
2. Click **Add document** (auto-generate ID)
3. Add these fields:
   - `phone` (string): `919876543210` (country code + number, no spaces or +)
   - `name` (string): `Priya`
   - `role` (string): `host` (or `manager`)
   - `created_at` (string): `2026-04-27T00:00:00.000Z`

### 8.3 Seed floor tables

Tables define the physical layout for the floor map. Seed them from the dashboard:

1. Log in as a manager
2. Go to `/dashboard/floor`
3. If no tables exist, you'll see a **"Seed Default Tables"** button
4. Click it — 24 tables are created across 4 floors (Terrace, Floor 1, Floor 2, Private)

Default layout:

- Terrace: T1–T8 (2–8 seats)
- Floor 1: F1–F8 (2–8 seats)
- Floor 2: S1–S6 (2–8 seats)
- Private: P1 (10 seats), P2 (14 seats)

To customise this, edit `dashboard/src/actions/tables.ts` → `DEFAULT_TABLES` array before seeding.

---

## 9. WhatsApp Webhook (Local Testing)

Meta needs to reach your backend to deliver WhatsApp messages. During local development, use ngrok to expose your local server.

### 9.1 Start ngrok

```bash
ngrok http 3001
```

You'll see output like:

```
Forwarding  https://a1b2c3d4.ngrok-free.app -> http://localhost:3001
```

Copy the `https://...ngrok-free.app` URL.

### 9.2 Register the webhook in Meta

1. Go to https://developers.facebook.com/apps → your app
2. Click **WhatsApp → Configuration** in the left sidebar
3. Under **Webhook**, click **Edit**
4. Fill in:
   - **Callback URL**: `https://a1b2c3d4.ngrok-free.app/webhooks/whatsapp`
   - **Verify token**: the same string you put in `WHATSAPP_VERIFY_TOKEN`
5. Click **Verify and save**
6. Meta calls your backend to verify. If verification succeeds, you'll see a green checkmark.

### 9.3 Subscribe to message events

After saving the webhook:

1. Click **Manage** next to the webhook
2. Check **messages** in the subscription list
3. Click **Done**

### 9.4 Test the webhook

Send a WhatsApp message to your test phone number. Watch the backend terminal — you should see incoming message logs.

> **ngrok free tier note**: The ngrok URL changes every time you restart ngrok. You need to re-register it in Meta each time. For persistent local testing, sign up for a free ngrok account and use a static URL.

---

## 10. WhatsApp Message Template

The booking confirmation uses an approved WhatsApp message template. You must create and get this approved by Meta before confirmation messages can be sent.

### 10.1 Create the template

1. Go to https://business.facebook.com/wa/manage/message-templates
2. Make sure you're viewing the correct WhatsApp account
3. Click **Create template**
4. Category: **Utility**
5. Name: `booking_confirmation` (must be exactly this — it's hardcoded)
6. Language: **English**

Template body (copy this exactly):

```
Hello {{1}}! 🌊

Your table at *Sanadige* is confirmed.

📅 *Date:* {{2}}
🕐 *Time:* {{3}}
👥 *Guests:* {{4}}
🪑 *Floor:* {{5}}
🔖 *Ref:* {{6}}

We look forward to welcoming you. If you need to cancel or make changes, reply *cancel* or call +91 91678 85275.

— Team Sanadige
```

Parameters:

- `{{1}}` — Guest name
- `{{2}}` — Date (e.g. "27 Apr 2026")
- `{{3}}` — Time (e.g. "08:00 PM")
- `{{4}}` — Party size (e.g. "4")
- `{{5}}` — Floor (e.g. "Terrace")
- `{{6}}` — Booking ref (e.g. "SND-AB12CD")

7. Click **Submit for review**

### 10.2 Wait for approval

Template approval typically takes a few minutes to a few hours. Status changes to **Approved** when ready.

Until approved, confirmation messages will not be sent — bookings still get created correctly in Firestore.

---

## 11. Deploy Backend to Production

Choose **Option A** (EC2 with PM2) or **Option B** (Docker). EC2 is recommended if you don't have Docker infrastructure.

---

### Option A: AWS EC2 + PM2 + nginx

#### A.1 Launch an EC2 instance

1. Log in to AWS console → EC2
2. Click **Launch instance**
3. Settings:
   - Name: `sanadige-backend`
   - AMI: **Ubuntu 24.04 LTS**
   - Instance type: **t3.micro** (free tier eligible, 1 vCPU / 1 GB RAM is enough)
   - Key pair: create a new key pair, download the `.pem` file
   - Security group: allow inbound on ports **22** (SSH), **80** (HTTP), **443** (HTTPS)
   - Region: **ap-south-1 (Mumbai)**
4. Click **Launch instance**
5. Note the public IP address

#### A.2 SSH into the server

```bash
chmod 400 /path/to/your-key.pem
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

#### A.3 Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v20.x.x
```

#### A.4 Install PM2

```bash
sudo npm install -g pm2
```

#### A.5 Install nginx

```bash
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### A.6 Clone the repository

```bash
cd ~
git clone https://github.com/your-org/sanadige.git
cd sanadige/backend
```

#### A.7 Install dependencies and build

```bash
npm install
npm run build
# Creates dist/ folder
```

#### A.8 Create the production .env

```bash
nano .env
```

Paste and fill in the same values as step 5.3, but with `PORT=3001`.

```bash
# Ctrl+O to save, Ctrl+X to exit
```

#### A.9 Start with PM2

```bash
pm2 start dist/index.js --name sanadige-backend
pm2 save
pm2 startup
# Copy and run the command it prints (starts PM2 on server reboot)
```

Verify it's running:

```bash
pm2 status
curl http://localhost:3001/health
```

#### A.10 Configure nginx as reverse proxy

```bash
sudo nano /etc/nginx/sites-available/sanadige
```

Paste this (replace `api.yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sanadige /etc/nginx/sites-enabled/
sudo nginx -t           # test config — should print "syntax is ok"
sudo systemctl reload nginx
```

#### A.11 Point your domain to the EC2 IP

In your DNS provider (Namecheap, Cloudflare, GoDaddy, etc.):

- Add an **A record**: `api.yourdomain.com` → your EC2 public IP
- Wait for DNS propagation (usually 5–30 min)

#### A.12 Enable HTTPS with Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
# Follow prompts — enter your email, agree to ToS
# When asked about redirect, choose option 2 (Redirect HTTP → HTTPS)
```

Certbot automatically edits the nginx config and sets up auto-renewal.

Verify:

```bash
curl https://api.yourdomain.com/health
# Expected: {"ok":true,...}
```

---

### Option B: Docker

If you have a server with Docker installed:

```bash
cd /path/to/sanadige/backend

# Build the image
docker build -t sanadige-backend .

# Create a .env file with production values (same as Option A step A.8)
# Then run:
docker run -d \
  --name sanadige-backend \
  --restart always \
  -p 3001:8080 \
  --env-file .env \
  sanadige-backend
```

> Note: The Dockerfile sets `EXPOSE 8080` internally, mapped to port 3001 on the host.

Then set up nginx + Certbot as in steps A.10–A.12.

---

## 12. Deploy Dashboard to Vercel

### 12.1 Push your code to GitHub

If not already done:

```bash
cd /path/to/sanadige
git add .
git commit -m "chore: initial setup"
git remote add origin https://github.com/your-org/sanadige.git
git push -u origin main
```

### 12.2 Import the project on Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository**
3. Select your GitHub repo
4. Vercel will detect it's a Next.js project

### 12.3 Configure the build

In the Vercel import dialog:

- **Root directory**: `dashboard` (important — the app is in a subdirectory)
- **Framework preset**: Next.js (auto-detected)
- **Build command**: `next build` (default)
- **Output directory**: `.next` (default)

### 12.4 Set environment variables

Click **Environment Variables** and add every variable from your local `.env.local`:

| Key                                  | Value                                  | Environment                      |
| ------------------------------------ | -------------------------------------- | -------------------------------- |
| `FIREBASE_PROJECT_ID`              | `your-project-id`                    | Production, Preview, Development |
| `FIREBASE_CLIENT_EMAIL`            | `firebase-adminsdk-...`              | Production, Preview, Development |
| `FIREBASE_PRIVATE_KEY`             | `"-----BEGIN PRIVATE KEY-----\n..."` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | `AIzaSy...`                          | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com`       | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | `your-project-id`                    | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | `1:123:web:abc`                      | Production, Preview, Development |
| `JWT_SECRET`                       | `your_random_base64_secret`          | Production, Preview, Development |
| `BACKEND_URL`                      | `https://api.yourdomain.com`         | Production                       |
| `BACKEND_URL`                      | `http://localhost:3001`              | Development                      |

> **FIREBASE_PRIVATE_KEY on Vercel**: Paste the key including the surrounding double quotes. Vercel preserves them. The `\n` characters must remain as literal `\n` — do not press Enter to create real line breaks.

### 12.5 Deploy

Click **Deploy**. The first build takes 2–3 minutes.

Once deployed you'll get a URL like `https://sanadige-dashboard.vercel.app`.

### 12.6 Add the Vercel domain to Firebase authorized domains

1. Go to Firebase console → Authentication → Settings → Authorized domains
2. Click **Add domain**
3. Enter your Vercel domain: `sanadige-dashboard.vercel.app`
4. If you have a custom domain, add that too

---

## 13. Register Production Webhook

Now that your backend is live at `https://api.yourdomain.com`, register it permanently with Meta.

1. Go to https://developers.facebook.com/apps → your app
2. Click **WhatsApp → Configuration**
3. Under **Webhook**, click **Edit**
4. Set:
   - **Callback URL**: `https://api.yourdomain.com/webhooks/whatsapp`
   - **Verify token**: same `WHATSAPP_VERIFY_TOKEN` from your backend `.env`
5. Click **Verify and save**

If verification fails, check:

- Your backend is running: `curl https://api.yourdomain.com/health`
- The verify token matches exactly in both places
- nginx is forwarding correctly

Then subscribe to message events:

1. Click **Manage** next to the webhook
2. Check **messages**
3. Click **Done**

---

## 14. Post-Deployment Checklist

Work through each item before handing over to the client.

### Backend

- [ ] `curl https://api.yourdomain.com/health` returns `{"ok":true}`
- [ ] PM2 shows `sanadige-backend` with status `online` (`pm2 status`)
- [ ] `pm2 logs sanadige-backend` shows no errors
- [ ] Manager record exists in Firestore `staff` collection

### Firebase

- [ ] Firestore indexes deployed (`firebase firestore:indexes` — all `READY`)
- [ ] Firestore rules deployed
- [ ] Phone Auth enabled
- [ ] Vercel domain added to authorized domains

### Dashboard

- [ ] Vercel deployment is live
- [ ] Login page loads at `https://sanadige-dashboard.vercel.app/login`
- [ ] OTP login works for the manager phone number
- [ ] Mission Control page loads with no errors
- [ ] Floor map → "Seed Default Tables" → 24 tables appear
- [ ] New Booking drawer works — creates a booking that appears in the list
- [ ] Analytics page loads (shows zeros until there is data)
- [ ] Settings page — save a cover cap, reload page, confirm it persists
- [ ] Marketing page loads

### WhatsApp

- [ ] Message template `booking_confirmation` is **Approved** in Meta
- [ ] Webhook registered and verified (green checkmark in Meta)
- [ ] Send "hi" to your WhatsApp business number → AI assistant replies
- [ ] Complete a full booking via WhatsApp → booking appears in dashboard → confirmation message received
- [ ] Create a booking from dashboard → confirmation message sent to guest

### Public Booking Portal

- [ ] Visit `https://sanadige-dashboard.vercel.app/book`
- [ ] Select a date → available slots appear
- [ ] Fill in details → submit → booking appears in dashboard as `pending`
- [ ] After 15 minutes without confirmation, the booking auto-cancels

---

## 15. Troubleshooting

### Backend won't start — "env validation failed"

```
ZodError: [{ path: ["FIREBASE_PRIVATE_KEY"], message: "Required" }]
```

One of the required env vars is missing or misspelled in `.env`. Check every variable against the schema in `backend/src/env.ts`. All of these are required: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GROQ_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`.

---

### "FIREBASE_PRIVATE_KEY is not valid"

The private key newlines are wrong. Try this format in `.env`:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIB...(long string)...\n-----END PRIVATE KEY-----\n"
```

The key must be in double quotes, and newlines must be `\n` (backslash-n as two characters), not actual line breaks. The code calls `.replace(/\\n/g, '\n')` to convert them at runtime.

---

### Login page shows "Session creation failed — you may not be registered as staff"

The phone number you're trying to log in with doesn't have a record in the Firestore `staff` collection. Either:

1. Add a staff record manually in Firestore (see step 8.2), or
2. Make sure `MANAGER_PHONE` in the backend `.env` matches exactly and restart the backend

---

### WhatsApp webhook verification fails (403)

The `WHATSAPP_VERIFY_TOKEN` in your backend `.env` doesn't match what you entered in the Meta dashboard. They must be identical, including case. Check for trailing spaces.

---

### OTP SMS not arriving for login

1. Check Firebase console → Authentication → Users — is the phone number showing up after attempting login?
2. Check that Phone Auth is enabled (step 2.3)
3. Check that `localhost` or your domain is in Firebase authorized domains
4. Firebase has a per-project free quota for SMS — check you haven't exceeded it

---

### WhatsApp messages not delivering

1. Check that the recipient's number was added to the test recipients list (step 4.4) — required until your app is officially live
2. Check backend logs: `pm2 logs sanadige-backend | grep whatsapp`
3. Verify your WhatsApp token hasn't expired (temporary tokens from API Setup expire in 24h — use a system user permanent token for production)

---

### Firestore queries failing with "index not found"

The error in the logs will contain a URL — open it and click **Create index** in the Firebase console. It takes 1–5 minutes to build. Alternatively, deploy all indexes at once: `firebase deploy --only firestore:indexes`.

---

### Floor map shows "No tables configured"

Click the **"Seed Default Tables"** button (manager only). If you've already seeded and still see this message, check that the Firestore `tables` collection exists and has documents with `is_active: true`.

---

### Dashboard shows stale data / doesn't update in real-time

The booking list uses a Firestore real-time listener. If the "Live" dot is grey instead of green:

1. Check browser console for Firestore errors
2. Verify the `NEXT_PUBLIC_FIREBASE_*` env vars are correct in Vercel
3. Check Firestore security rules allow authenticated reads — deploy rules if unsure: `firebase deploy --only firestore:rules`

---

### PM2 restarts frequently (backend crashing)

```bash
pm2 logs sanadige-backend --lines 50
```

Common causes:

- Missing env var (the backend crashes on startup if any required var is absent)
- Port conflict (change `PORT` in `.env` if 3001 is taken)
- Firebase initialisation error (bad service account credentials)

---

### Certbot / HTTPS not working

```bash
sudo certbot renew --dry-run
# If this fails, the domain DNS isn't pointing to your server yet
# Wait for DNS propagation and retry
```

---

## Environment Variable Reference

### Backend (`backend/.env`)

| Variable                     | Required | Description                                                  |
| ---------------------------- | -------- | ------------------------------------------------------------ |
| `FIREBASE_PROJECT_ID`      | Yes      | Firebase project ID from service account JSON                |
| `FIREBASE_CLIENT_EMAIL`    | Yes      | Service account client email                                 |
| `FIREBASE_PRIVATE_KEY`     | Yes      | Service account private key (with `\n` escaping)           |
| `GROQ_API_KEY`             | Yes      | Groq API key starting with `gsk_`                          |
| `WHATSAPP_TOKEN`           | Yes      | Meta WhatsApp Cloud API access token                         |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes      | WhatsApp phone number ID from Meta                           |
| `WHATSAPP_VERIFY_TOKEN`    | Yes      | Random secret for webhook verification                       |
| `MANAGER_PHONE`            | No       | Phone number for auto-seeded manager (country code + number) |
| `MANAGER_NAME`             | No       | Display name for auto-seeded manager (default: "Manager")    |
| `PORT`                     | No       | Server port (default: 3000)                                  |

### Dashboard (`dashboard/.env.local`)

| Variable                             | Required | Description                                          |
| ------------------------------------ | -------- | ---------------------------------------------------- |
| `FIREBASE_PROJECT_ID`              | Yes      | Same as backend                                      |
| `FIREBASE_CLIENT_EMAIL`            | Yes      | Same as backend                                      |
| `FIREBASE_PRIVATE_KEY`             | Yes      | Same as backend                                      |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | Yes      | Web app API key from Firebase console                |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes      | `your-project.firebaseapp.com`                     |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | Yes      | Same as `FIREBASE_PROJECT_ID`                      |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | Yes      | Web app ID from Firebase console                     |
| `JWT_SECRET`                       | Yes      | Random base64 string (32+ bytes) for session signing |
| `BACKEND_URL`                      | Yes      | Full URL of the Express backend (no trailing slash)  |
