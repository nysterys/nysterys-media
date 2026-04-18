# NYSTERYS MEDIA CREATOR HUB — MASTER REFERENCE
*Last updated: April 2026. Read this entire document before starting work.*

---

## WHAT THIS IS

A private internal portal for Patrick Nijsters managing influencer campaigns for his daughters:
- **Kym** — TikTok: `kymchi_n_crackers`, ~228K followers
- **Mys** — TikTok: `mysthegreat`, ~1.4M followers

Three users: Patrick (admin), Kym (creator), Mys (creator).

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | React 18, Create React App |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Analytics sync | Coupler.io → Supabase |
| Hosting | GitHub Pages at `nysterys.com/hub/` |
| Repo | `nysterys/nysterys-media` (GitHub) |

**Key credentials (non-secret — anon key only):**
- Supabase URL: `https://rnntuxabccnphfvvvaks.supabase.co`
- Supabase anon key: `sb_publishable_uTUIIpWaYYgke_5rtyhUnw_0lMfHI3c`
- Admin user ID: `3e8c9d32-600e-4144-8ad8-cb828b1bcae2`

---

## REPO STRUCTURE

```
nysterys-media/
├── hub/                          ← GitHub Pages deploy target (built files)
│   ├── index.html
│   ├── asset-manifest.json
│   └── static/js/main.{hash}.js
├── hub-src/                      ← React source
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css               ← All styles including .markdown-preview
│   │   ├── utils/
│   │   │   └── format.js         ← SHARED safe date/number formatting + validation
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   │   ├── CampaignsView.js      ← Main campaign dashboard (2400+ lines)
│   │   │   │   ├── PaymentsView.js       ← Payments (agency invoices + payouts)
│   │   │   │   ├── AnalyticsView.js      ← TikTok analytics dashboard
│   │   │   │   ├── AgenciesView.js
│   │   │   │   ├── AdminOverview.js
│   │   │   │   ├── UsersView.js
│   │   │   │   ├── PlatformsView.js
│   │   │   │   ├── DeliverablesTypesView.js
│   │   │   │   ├── TikTokAccountsView.js
│   │   │   │   └── PaymentDestinationsView.js
│   │   │   ├── creator/
│   │   │   │   ├── CreatorCampaigns.js
│   │   │   │   ├── CreatorPayments.js
│   │   │   │   ├── CreatorAnalytics.js
│   │   │   │   └── CreatorOverview.js
│   │   │   └── shared/
│   │   │       ├── Badge.js
│   │   │       ├── Charts.js             ← SparkLine, BarChart, HBar, DonutChart, StatTile, ChartCard
│   │   │       ├── Comments.js
│   │   │       └── Sidebar.js
│   │   ├── hooks/useAuth.js
│   │   ├── lib/supabase.js
│   │   └── pages/
│   │       ├── AdminDashboard.js
│   │       ├── CreatorDashboard.js
│   │       └── LoginPage.js
│   └── package.json
├── schemas/
│   └── SCHEMA.sql                ← SINGLE consolidated schema (use this, ignore old numbered files)
├── kym.jpg                       ← Must always be included
├── mys.jpg                       ← Must always be included
└── index.html                    ← Main nysterys.com site
```

---

## STANDARD DEPLOY COMMAND

```bash
cd hub-src && npm run build && cd ..
cp hub-src/build/index.html hub/index.html
cp hub-src/build/asset-manifest.json hub/asset-manifest.json
rm -rf hub/static && cp -r hub-src/build/static hub/static
git add -A hub/ hub-src/src/[changed files]
git commit -m "description"
git push
```

**CRITICAL:** Always copy `index.html` and `asset-manifest.json` explicitly. The `hub/` dir must exactly match `hub-src/build/`. After push, verify with:
```bash
curl -I https://nysterys.com/hub/static/js/main.{newhash}.js
# Must return HTTP/2 200
```

If GitHub Pages CDN is slow (returns 404), wait 2 minutes and try again.

---

## DATABASE SETUP (FRESH START)

**`schemas/SCHEMA.sql`** is the single source of truth. Run in two steps:

**Step 1 — Core tables** (run immediately on fresh DB):
Paste the entire `SCHEMA.sql` file up to and including "PART 1" into Supabase SQL Editor and run.

**Step 2 — Coupler views** (run after first Coupler sync):
Run the "PART 2" and "PART 3" sections of `SCHEMA.sql` after Coupler.io has synced at least once (so the `_kym` and `_mys` tables exist).

**Storage buckets** (create manually in Supabase Dashboard → Storage):
- `payment-receipts` — private, admin read/write
- `campaign-files` — private, admin read/write

**Supabase Auth settings** (Dashboard → Authentication → Settings):
- Disable public signups (invite only)
- Minimum password length: 12
- Enable email confirmation
- Enable leaked password protection

---

## COUPLER.IO ANALYTICS ARCHITECTURE

Coupler.io syncs TikTok data directly into Supabase. Configure 6 importers per creator (12 total):

| Report Type | Supabase Table Suffix | Coupler Mode |
|---|---|---|
| Profile insights | `tiktok_profile_insights_{creator}` | **Append** |
| Profile audience genders | `tiktok_audience_gender_{creator}` | **Replace** |
| Profile audience countries | `tiktok_audience_country_{creator}` | **Replace** |
| Profile audience hourly activity | `tiktok_audience_hourly_{creator}` | **Append** |
| Video list insights | `tiktok_video_insights_{creator}` | **Append** |
| Video list top countries | `tiktok_video_countries_{creator}` | **Replace** |

Creators: `kym` and `mys`.

**IMPORTANT — Replace mode behavior:**
Coupler's Replace mode drops and recreates the table on every sync, which:
1. Wipes all RLS policies on that table
2. Invalidates views that reference it

This is handled automatically by the event trigger installed in SCHEMA.sql Part 3. It fires on every `CREATE TABLE`, detects tiktok_ tables, and reapplies RLS + recreates views. No manual intervention needed after the initial setup.

**In the Coupler transform step**, add a static column named `account__username` with the creator's TikTok handle (no @) — e.g. `kymchi_n_crackers` or `mysthegreat`. This is how data gets routed per creator.

**Gender/country percentage values:** Coupler delivers these as decimals (0–1). The app auto-detects the scale at runtime and handles both formats.

---

## KEY ARCHITECTURAL DECISIONS

### Campaign Deliverables
- Each deliverable is one post. If a campaign has 5 posts, there are 5 rows.
- `quantity > 1` deliverables get "expanded" (split into individual rows) via the Expand button.
- Campaigns cannot be marked Completed until all deliverables are Posted.
- Campaign deliverables are joined to `tiktok_video_insights_view` via `extract_tiktok_video_id(post_url)` which parses the TikTok video ID from the post URL.

### Payments (Two-stage)
1. **Invoice tab** — tracks agency paying Patrick (invoice date, amount, status, receipt)
2. **Payout tab** — tracks Patrick paying the creator (payout splits to destinations)

The `campaign_payout_summary` view joins both stages for the payments table view.

### Brief / Instructions field
Supports Markdown. Has inline preview toggle and ⤢ Expand button that opens a full-screen split editor/preview modal. The `renderMarkdown()` function in CampaignsView.js handles rendering (no external library).

### Input Validation
ALL save functions validate input before writing to DB. Validation utilities live in `hub-src/src/utils/format.js`:
- `fmtDate(d, fmt)` — safe, never throws
- `fmtMonth(ym)` — validates yyyy-MM before formatting
- `fmtMoney(n)` — handles null/NaN
- `extractMonths(rows, field)` — filters malformed dates (like `20265-03-21`)
- `isValidDateString(d)` — validates yyyy-MM-dd
- `isValidNumber(v)` — validates numeric inputs
- `isValidUrl(url)` — validates URLs
- `isValidEmail(email)` — validates email format

**Never use `format(new Date(someString))` directly.** Always use `fmtDate()` from utils.

### Links / Post URLs
All external links open in a minimal popup window (480×720, no toolbar) via the `openPopup()` helper defined in CampaignsView.js.

---

## DATABASE TABLES REFERENCE

| Table | Purpose |
|---|---|
| `profiles` | Users (extends auth.users). role: admin or creator |
| `platforms` | TikTok, Instagram, etc. (admin-managed) |
| `deliverable_types` | Post, Story, Reel, etc. (admin-managed) |
| `agencies` | Brand agencies and music labels |
| `campaigns` | One per deal, one creator per campaign |
| `campaign_deliverables` | One row per post (expanded from campaigns) |
| `revision_rounds` | Draft revision history per deliverable |
| `invoices` | Agency → Patrick payment tracking (one per campaign) |
| `campaign_files` | File attachments per campaign (stored in Supabase Storage) |
| `comments` | Per-campaign comment thread |
| `tiktok_accounts` | Maps creator profiles to TikTok usernames |
| `payment_destinations` | Creator bank/savings accounts for payouts |
| `creator_payouts` | Patrick → creator payout (one per campaign) |
| `payout_splits` | Individual splits per destination within a payout |
| `audit_log` | Append-only activity log |

**Views:**
| View | Purpose |
|---|---|
| `campaign_payout_summary` | Joins campaigns + invoices + payouts for Payments view |
| `campaign_deliverables_with_stats` | Joins deliverables + TikTok video stats |
| `tiktok_profile_insights_view` | Unions kym + mys profile data |
| `tiktok_audience_gender_view` | Unions kym + mys gender data |
| `tiktok_audience_country_view` | Unions kym + mys country data |
| `tiktok_audience_hourly_view` | Unions kym + mys hourly data |
| `tiktok_video_insights_view` | Unions kym + mys video data |
| `tiktok_video_countries_view` | Unions kym + mys video country data |
| `agencies_public` | Read-only agency name list for creators |

---

## KNOWN ISSUES & GOTCHAS

1. **`campaign_deliverables_with_stats` uses `cd.*`** — PostgreSQL snapshots the column list at view creation time. When adding columns to `campaign_deliverables`, you must `DROP VIEW` and `CREATE VIEW` (not `CREATE OR REPLACE`).

2. **Invoices fetched separately** — Joining invoices through `campaign_deliverables_with_stats` fails silently in some query patterns. Fetch invoices directly from `invoices` table and merge in JS by `campaign_id`.

3. **Bad date data in DB** — One invoice had `invoice_date = '20265-03-21'` (typo). Fix: `update public.invoices set invoice_date = '2026-03-21' where invoice_date = '20265-03-21';`

4. **GitHub Pages deploy** — The `hub/index.html` and `hub/static/` must be committed together. If only `index.html` is updated without the static files, the site breaks with a 404. Always use the full deploy command above.

5. **TikTok API zero values** — TikTok sometimes returns `0` for `followers_count` and `net_followers` on the most recent day before data is finalized. The app filters out rows where either value is zero before rendering charts.

---

## STYLE RULES (STRICT)

- **Never use em-dashes (`—`) in any drafted content** for Patrick, Kym, or Mys. Use commas, colons, or parentheses instead.
- `mys.jpg` and `kym.jpg` must always be present at the repo root.
- Kym and Mys do **not** do TikTok Shop affiliate work — never suggest it.
- Mys (`@mysthegreat`) is a teenager.

---

## CHARTS LIBRARY (`shared/Charts.js`)

All chart components live in `Charts.js`. Available exports:
- `SparkLine` — line chart with optional fill
- `BarChart` — vertical bar chart
- `HBar` — horizontal bar with label
- `DonutChart` — donut/pie chart with legend
- `StatTile` — KPI card with optional trend arrow
- `ChartCard` — wrapper card with title
- `fmtNum(n)` — formats numbers (1.4M, 228.5K, etc.)
- `fmtSecs(s)` — formats seconds as "6s" or "1m 24s"
- `fmtPct(v)` — formats 0–1 decimal as percentage

---

## WHAT'S BEEN BUILT (FEATURE SUMMARY)

### Admin Views
- **Overview** — KPI summary cards, upcoming deadlines
- **Campaigns** — Full campaign management:
  - Campaign list with column sorting and filters (agency, platform, payment status)
  - Detail panel with 5 tabs: Deliverables, Details, Invoice, Files, Comments
  - Per-deliverable tracking: edit, delete, expand bundles, revision rounds
  - Video picker dropdown (links TikTok posts to deliverables)
  - Video thumbnails + stats on deliverable cards
  - Completion gate (all deliverables must be Posted before Completed)
  - Markdown editor for Brief field (full-screen split editor/preview)
  - Campaign file uploads (drag-drop, any file type)
  - Receipt upload on Invoice tab
  - In-kind compensation tracking
  - Music/sound URL per deliverable
- **Payments** — Two-stage payment tracking (agency invoice + creator payout)
  - Month filter, agency/payout/creator filters
  - Invoice panel: amounts, dates, receipt upload, in-kind flag
  - Payout panel: splits to multiple destinations, per-split status tracking
- **Analytics** — TikTok performance dashboard:
  - Account switcher (Kym / Mys)
  - Date range filter (7d to 12mo)
  - KPI tiles: followers, views, likes, comments, shares
  - Follower growth chart (filters zero values from TikTok API lag)
  - Daily video views + daily likes charts
  - Audience gender donut chart (scale auto-detected: 0–1 or 0–100)
  - Top countries bar chart
  - Peak posting hours bar chart
  - Sponsored campaign performance table (grouped by campaign, totals row, ER)
  - Top videos table (thumbnails, ER, completion bar)
- **Setup views** — Agencies, Platforms, Deliverable Types, TikTok Accounts, Payment Destinations, Users

### Creator Views
- **Overview** — Upcoming posts, recent campaigns summary
- **My Campaigns** — Read-only campaign list + deliverable status
- **My Payments** — Earnings and payout history
- **My Analytics** — Personal TikTok analytics

### Auth
- Login with lockout (5 attempts, 15 min lockout)
- Password reset via email
- Role-based routing (admin vs creator dashboard)
