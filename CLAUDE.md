# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Nysterys Media Creator Hub — a private influencer management portal for two TikTok creators (Kym ~228K followers, Mys ~1.4M followers). The repo contains two separate applications:

1. **Public site** (repo root) — Static vanilla HTML/CSS/JS. No build step. `data.json` is the single source of truth for creator stats across all public pages.
2. **Creator Hub** (`hub-src/`) — React 18 + Supabase. Admin dashboard (Patrick) and creator dashboards (Kym, Mys).

Three users: Patrick (admin), Kym (creator), Mys (creator — teenager, keep all content age-appropriate).

## Commands

```bash
# Development
cd hub-src && npm install   # first time only
cd hub-src && npm start     # http://localhost:3000

# Build + deploy to GitHub Pages (one command)
cd ~/Downloads/nysterys-media && cd hub-src && npm run build && cd .. && \
cp hub-src/build/index.html hub/index.html && \
cp hub-src/build/asset-manifest.json hub/asset-manifest.json && \
cp hub-src/build/favicon.ico hub/favicon.ico && \
rm -rf hub/static && cp -r hub-src/build/static hub/static && \
git add -A && git commit -m "description" && git push
```

**Never edit files in `hub/` directly** — it is generated output. Always build from `hub-src/` and copy.

## Architecture

### Frontend (hub-src/src/)
- `App.js` — Root: `AuthProvider` wraps the app; role-based routing sends admins to `AdminDashboard` and creators to `CreatorDashboard`
- `hooks/useAuth.js` — Centralised auth context (`useAuth` hook)
- `App.css` — All hub styles in one file: global, component, and `@media (max-width: 768px)` mobile (sidebar becomes bottom tab bar)
- `utils/format.js` — All date/number formatting (`fmtDate`, `fmtMonth`, `fmtMoney`, etc.) — always use these, never format inline
- `lib/supabase.js` — Supabase client + `isHandlingPasswordReset` flag

**Admin views** (`components/admin/`) use a `switch(activeView)` pattern — components unmount/remount on nav.  
**Creator views** (`components/creator/`) use always-mounted `display:block/none` to preserve state; `refreshKey` triggers re-fetches.

### Database (Supabase)
Single consolidated schema: `schemas/SCHEMA.sql`. Run once in Supabase SQL Editor on a fresh project.

Key tables: `profiles` (role: admin|creator), `campaigns`, `campaign_deliverables`, `revision_rounds`, `invoices` (agency → Patrick), `creator_payouts` (Patrick → creator), `payout_splits`, `payment_destinations`, `platform_rewards_programs`, `platform_reward_entries`, `agencies`, `comments`, `audit_log`.

Key views: `campaign_payout_summary`, `reward_payout_summary`, `campaign_deliverables_with_stats`, `tiktok_profile_insights_view` and related analytics views.

**When adding columns to `campaign_deliverables`** — must `DROP` and `CREATE` the `campaign_deliverables_with_stats` view (not `CREATE OR REPLACE`), because it selects `cd.*`.

### Payment Flow
Two-stage for both campaigns and rewards:
1. Invoice: agency → Patrick (`invoices` table)
2. Payout: Patrick → creator (`creator_payouts` + `payout_splits` tables)

`campaign_id` is set for campaign payments; `reward_entry_id` is set for reward payments (the other is NULL).

## Critical Gotchas

**Date parsing** — Never use `new Date('2026-03-01')` — UTC midnight renders as the previous day in US timezones. Use: `new Date(parseInt(y), parseInt(mo) - 1, 1)`.

**Invoice queries** — Joining invoices through views fails silently. Fetch invoices directly and merge in JS by `campaign_id`.

**TikTok data** — Most recent day returns zeros for followers/net_followers from Coupler.io. Filter before rendering.

**Campaign names** are auto-generated: `yyyymmdd-NN-CreatorName-Agency Name`.

**`payout_splits.account_type = 'Other'`** — display `payout_splits.notes` instead of account type/last4.

**No em-dashes** anywhere in content. No TikTok Shop affiliate work.

## Environment

```
# hub-src/.env.production (not in git — use .env.example as template)
REACT_APP_SUPABASE_URL=https://rnntuxabccnphfvvvaks.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_uTUIIpWaYYgke_5rtyhUnw_0lMfHI3c
```

The anon key is a publishable key — safe to commit if needed. Auth: email + password, 5 failed attempts → 15-min lockout, invites only (no public signup).

## Detailed Reference

Full system documentation: `docs/MASTER-REFERENCE.md`  
Fresh install guide: `docs/FRESH-INSTALL.md`
