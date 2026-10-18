# 🚀 Vercel Production Deployment Guide — PG Manager

Follow this step-by-step guide to deploy your **PG Manager Web Application** to Vercel for free, accessible from any phone, tablet, or laptop worldwide.

---

## 📋 Prerequisites Checklist

Before deploying, ensure you have:
1. A **GitHub account** ([github.com](https://github.com))
2. A **Vercel account** ([vercel.com](https://vercel.com)) — you can sign in with your GitHub account
3. Your active **Supabase PostgreSQL database** (already configured and running)

---

## Step 1: Push Your Code to GitHub

Open PowerShell in `D:\PG` and run:

```powershell
# 1. Initialize Git (if not already initialized)
git init

# 2. Stage all files (.env and .env.local are protected in .gitignore)
git add .

# 3. Create your initial commit
git commit -m "feat: complete PG Manager with WhatsApp, UPI QR, backup, and P&L expenses"

# 4. Create a new private repository on GitHub (e.g., pg-manager)
# Then link your remote and push:
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/pg-manager.git
git push -u origin main
```

> **Note:** `.env` and `.env.local` are already listed in `.gitignore`, so your database passwords and encryption keys will **never** be exposed publicly.

---

## Step 2: Import Project in Vercel

1. Log in to [vercel.com](https://vercel.com).
2. Click **"Add New..."** → **"Project"**.
3. Under **"Import Git Repository"**, locate your `pg-manager` repo and click **"Import"**.
4. In the Project Configuration:
   - **Framework Preset**: `Next.js` (automatically detected)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `next build` (leave default)
   - **Output Directory**: `.next` (leave default)

---

## Step 3: Configure Environment Variables in Vercel

Before clicking "Deploy", expand the **"Environment Variables"** section in Vercel and copy the following 6 keys from your `.env.local` file:

| Variable Name | Description / Value |
| :--- | :--- |
| `DATABASE_URL` | Your Supabase IPv4 Pooler URL:<br>`postgresql://postgres.rkckuizlirpzolkbzonc:Kirattejay%4021@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` |
| `AUTH_SECRET` | 32-byte secret generated in `.env.local` |
| `AUTH_TRUST_HOST` | `true` |
| `ADMIN_EMAIL` | `kirattejay21@gmail.com` |
| `ADMIN_PASSWORD_HASH` | The bcrypt hash string for `Kirattejay@21` (found in `.env.local`) |
| `DOCUMENT_ENCRYPTION_KEY` | 64-character hex key (found in `.env.local`) |

> **Crucial for Supabase:** Keep using the **IPv4 Pooler URL** (`aws-0-ap-south-1.pooler.supabase.com:5432/postgres`) instead of direct connection. Vercel's serverless lambdas spin up on demand; the pooler prevents connection timeouts and pool exhaustion.

---

## Step 4: Click Deploy!

1. Click the **"Deploy"** button.
2. Vercel will build the Next.js 14 app in approximately 1 to 2 minutes.
3. Once completed, you will receive a production URL such as:
   `https://pg-manager-xxxx.vercel.app`

---

## Step 5: Test on Mobile & Add to Home Screen

1. Open your Vercel URL on your phone's browser (Safari on iPhone, Chrome on Android).
2. Log in using:
   - **Email:** `kirattejay21@gmail.com`
   - **Password:** `Kirattejay@21`
3. Tap **Share / Options** → **"Add to Home Screen"** to turn PG Manager into a full-screen mobile app icon on your phone!

---

## 🔄 Automatic Updates
Whenever you make future code edits and run:
```powershell
git add .
git commit -m "update: improvements"
git push
```
Vercel will automatically build and deploy the update in under 60 seconds with zero downtime!
