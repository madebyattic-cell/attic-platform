# Made by Attic — platform

## What's here so far
- Next.js app, App Router, TypeScript
- Drizzle schema (`db/schema.ts`) matching the approved data model:
  series, products, bundle_items, assets, channels, listings, customers,
  orders, order_items, metrics_daily, sync_runs
- Design tokens in `app/globals.css` (the terracotta/stone palette approved
  in chat)
- `/listings` page — real query against the schema, empty-state included

- Wix sync (`lib/sync/wix.ts`) — orders, customers, line items. Triggered
  via `/api/sync/wix`, runs nightly at 3:00am via Vercel cron.
- Gumroad sync (`lib/sync/gumroad.ts`) — sales, customers, line items.
  Triggered via `/api/sync/gumroad`, runs nightly at 3:10am.
- `db/seed/channels.ts` — seeds the four channels with their fee
  structures. Run this before either sync, or both will fail on their
  first line.

## Not built yet
- Creative Market CSV importer
- Product intake form / SEO copy generator
- Customer scoring
- Overview dashboard, Analytics page
- A pass that applies channel fees to compute true net (currently net
  = gross − discount for Wix, gross − platform fee for Gumroad; no
  processor fee subtracted yet)

## To get this running

### 1. Push to GitHub
```
git init
git add .
git commit -m "Initial scaffold"
```
Create an empty repo on github.com (no README, no .gitignore — this
already has one), then:
```
git remote add origin https://github.com/YOUR_USERNAME/attic-platform.git
git branch -M main
git push -u origin main
```

### 2. Connect to Vercel
Go to vercel.com, "Add New Project", pick this repo. Before the first
deploy, add environment variables (Settings > Environment Variables):
- `DATABASE_URL` — the Neon connection string, paste it there, never in chat
- `WIX_API_KEY`, `WIX_ACCOUNT_ID`, `WIX_SITE_ID` — once generated
- `GUMROAD_ACCESS_TOKEN` — once generated

### 3. Push the schema to Neon
Locally, with `DATABASE_URL` set in `.env.local`:
```
npx drizzle-kit push
```
This creates all the tables in Neon from `db/schema.ts`. Re-run it
any time the schema changes.

### 4. Seed the channels table
```
npm run seed:channels
```
Reads `.env.local` automatically. Populates Wix, Gumroad, Creative
Market and Behance with their fee structures. Safe to re-run — it
updates existing rows rather than duplicating them.

### 5. Test the syncs manually before trusting the cron
```
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/sync/wix
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/sync/gumroad
```
Check the response and the `sync_runs` table for errors. The Wix
line-item field mapping in particular is unverified against a live
response — see the comment at the top of `lib/sync/wix.ts`.
