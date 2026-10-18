# PG Management System — Production Build

A complete, production-ready web application for managing a girls' PG in India with 4 portions, 8 rooms, and 12 electricity submeters.

Built with **Next.js 14 (App Router)**, **TypeScript**, **PostgreSQL**, **Drizzle ORM**, **Tailwind CSS**, and **Decimal.js**.

---

## Confirmed Business Rules

| Rule | Confirmed Policy |
|---|---|
| **Property Structure** | 4 portions (A, B, C, D) · 2 rooms per portion (8 rooms) · 1 kitchen per portion · 12 physical submeters |
| **Submeters** | 8 room meters (`A-R1`, `A-R2`, `B-R1`, ...) + 4 kitchen meters (`A-K`, `B-K`, `C-K`, `D-K`) |
| **Billing Cycle** | **15th of month → 15th of next month** (both 15ths inclusive) |
| **Electricity Rate** | **₹10.0000 / unit** (stored in `config`, configurable in Settings) |
| **Base Rent** | **₹5,500.00** per girl per month (full rent charged, no pro-rating) |
| **Optional Food** | **₹2,500.00** per girl per month (With Food: ₹8,000 / Without Food: ₹5,500 before electricity) |
| **Room Electricity** | `(Closing − Opening) × ₹10 ÷ eligible room occupants` (2 girls = ½ each; 1 girl = full; 0 girls = closed room ₹0) |
| **Kitchen Electricity** | `(Closing − Opening) × ₹10 ÷ all active residents in that portion` |
| **Rounding Rule** | Sum of shares equals meter total exactly; remainder (±₹0.01) absorbed by last resident alphabetically |
| **Payments** | Advance payments and bill payments tracked in immutable ledger; outstanding balance calculated live |
| **Security Deposits** | Tracked in dedicated ledger table per resident; refund tracking with deduction reasons on move-out |
| **Immutability** | Finalized bills store frozen JSON snapshot (`snapshot` column) and cannot be modified |

---

## Application Structure & Pages

```
/                             → Redirects to /dashboard or /login
/login                        → Admin authentication
/dashboard                    → Live stats, current cycle bills, net outstanding, recent payments
/residents                    → All residents list, active/inactive filters, search
/residents/new                → Move-in workflow with room capacity check & deposit
/residents/[id]               → Resident profile, roommates, room change, move-out, food switcher
/rooms                        → Visual grid of 4 portions, 8 rooms, 12 meters, occupants & room closure
/meters                       → 12 submeter entry form with auto-populated previous closing readings
/billing                      → Billing cycle manager, batch draft generation, batch finalization
/billing/[cycle]/[id]         → Itemized invoice breakdown & Printable Rent Receipt view (PDF print)
/payments                     → Complete payments ledger, filter by mode, revenue summary
/payments/record              → Payment entry form with live outstanding check & bill linkage
/security-deposits            → Security deposit liability ledger (held vs. refunded)
/reports/outstanding          → Live account balances report with CSV export & print
/settings                     → Configurable rates (electricity ₹10/unit, rent ₹5500, food ₹2500) & audit log
```

---

## Quick Setup Instructions

### 1. Install Dependencies
Open a terminal in `d:\PG` and run:
```powershell
npm install
```

### 2. Configure Database & Environment
Copy `.env.example` to `.env.local`:
```powershell
Copy-Item .env.example .env.local
```

Fill in your PostgreSQL URL (e.g. from [Supabase](https://supabase.com)):
- `DATABASE_URL`: `postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres`
- `ADMIN_EMAIL`: Your login email
- `NEXTAUTH_URL`: `http://localhost:3000`

Generate keys for security:
```powershell
# For AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# For ENCRYPTION_KEY (AES-256 for resident IDs):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Generate Admin Password
```powershell
node scripts/generate-password-hash.mjs
```
Paste the generated hash into `ADMIN_PASSWORD_HASH` in `.env.local`.

### 4. Push Schema & Seed Initial Data
```powershell
# Create all tables in database
npm run db:push

# Seed 4 portions, 8 rooms, 12 meters, and default config
npm run db:seed
```

### 5. Verify Billing Formulas & Decimal Math
```powershell
node scripts/test-billing-formulas.mjs
```

### 6. Run Development Server
```powershell
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## Technology Stack

- **Framework**: Next.js 14.2 App Router (React 18, Server Components, Route Handlers)
- **Database**: PostgreSQL (via Supabase / hosted Postgres)
- **ORM**: Drizzle ORM (Type-safe SQL queries, explicit relations, and migrations)
- **Authentication**: NextAuth.js v5 (Credentials provider, 8-hour JWT sessions)
- **Financial Math**: `decimal.js` (Exact decimal arithmetic, zero IEEE 754 floating-point errors)
- **Security**: AES-256-GCM encryption for sensitive IDs, append-only audit trail
- **UI & Styling**: Tailwind CSS, Lucide Icons, Print CSS stylesheets for rent receipts
