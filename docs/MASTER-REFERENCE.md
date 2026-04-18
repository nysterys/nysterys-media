# NYSTERYS MEDIA — MASTER REFERENCE
*Read this entire document before starting any work in a new Claude session.*
*Last updated: April 2026*

---

## WHAT THIS IS

Two things in one GitHub repo (`nysterys/nysterys-media`), both served by GitHub Pages:

1. **Public site** — `nysterys.com/` — static HTML/CSS/JS, no build step
2. **Creator Hub** — `nysterys.com/hub/` — private internal portal, React app

The Creator Hub has three users: Patrick (admin/manager), Kym (creator), Mys (creator).
Mys is a teenager. No em-dashes anywhere. No TikTok Shop affiliate work for either creator.

---

## PEOPLE

| Person | Role | TikTok | Followers |
|---|---|---|---|
| Patrick Nijsters | Admin / Manager | — | — |
| Kym | Creator | `@kymchi_n_crackers` | ~228K |
| Mys | Creator | `@mysthegreat` | ~1.4M |

---

## TECH STACK

| Layer | Technology |
|---|---|
| Public site | Vanilla HTML/CSS/JS, no framework |
| Hub frontend | React 18, Create React App |
| Hub backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Analytics sync | Coupler.io → Supabase (12 importers) |
| Hosting | GitHub Pages (both public site and hub) |
| Local repo path | `~/Downloads/nysterys-media/` |

**Supabase credentials (anon key — safe to commit):**
- URL: `https://rnntuxabccnphfvvvaks.supabase.co`
- Anon key: `sb_publishable_uTUIIpWaYYgke_5rtyhUnw_0lMfHI3c`
- Admin user ID: `3e8c9d32-600e-4144-8ad8-cb828b1bcae2`

---

## REPO STRUCTURE

```
nysterys-media/                   ← repo root = nysterys.com/
├── index.html                    ← public site homepage
├── global.css                    ← shared styles for public site
├── utils.js                      ← shared JS utilities (email obfuscation etc.)
├── icons.js                      ← shared SVG icon definitions
├── data.json                     ← creator stats, roster data (source of truth for public site)
├── creator.html                  ← individual creator page
├── media-kit.html
├── rate-card.html
├── privacy.html
├── robots.txt / sitemap.xml / CNAME / favicon.ico
├── kym.jpg / mys.jpg             ← must always be in repo root
│
├── hub/                          ← nysterys.com/hub/ (GitHub Pages deploy target)
│   ├── index.html                ← NEVER edit directly — always build from hub-src
│   ├── asset-manifest.json
│   ├── favicon.ico
│   └── static/
│
├── hub-src/                      ← React source (all hub editing happens here)
│   ├── .env.production           ← NOT in git — contains Supabase keys
│   ├── .env.example              ← Template for .env.production
│   ├── package.json
│   └── src/
│       ├── App.js                ← Root: AuthProvider → role-based routing
│       ├── App.css               ← ALL styles (global, components, mobile responsive)
│       ├── index.js
│       ├── lib/supabase.js       ← Supabase client + password reset flag
│       ├── hooks/useAuth.js      ← AuthContext, useAuth hook
│       ├── utils/format.js       ← Shared safe formatting + validation utilities
│       ├── pages/
│       │   ├── LoginPage.js      ← Login, password reset, lockout logic
│       │   ├── AdminDashboard.js ← Admin router (switch-case)
│       │   └── CreatorDashboard.js ← Creator router (always-mounted display:block/none)
│       └── components/
│           ├── admin/
│           │   ├── AdminOverview.js
│           │   ├── CampaignsView.js        ← ~2500 lines, main campaign management
│           │   ├── CalendarView.js
│           │   ├── PaymentsView.js
│           │   ├── RewardsView.js
│           │   ├── AnalyticsView.js
│           │   ├── AgenciesView.js
│           │   ├── PlatformsView.js
│           │   ├── DeliverablesTypesView.js
│           │   ├── PaymentDestinationsView.js
│           │   ├── PaymentMethodsView.js   ← Setup view for invoice payment methods
│           │   ├── TikTokAccountsView.js
│           │   └── UsersView.js
│           ├── creator/
│           │   ├── CreatorOverview.js
│           │   ├── CreatorCampaigns.js
│           │   ├── CreatorCalendar.js
│           │   ├── CreatorPayments.js
│           │   └── CreatorAnalytics.js
│           └── shared/
│               ├── Badge.js
│               ├── Charts.js
│               ├── Comments.js
│               └── Sidebar.js
│
├── schemas/
│   └── SCHEMA.sql                ← SINGLE consolidated schema — use this for fresh DB setup
│
└── docs/
    ├── MASTER-REFERENCE.md       ← THIS FILE
    └── FRESH-INSTALL.md          ← Step-by-step setup from zero
```

---

## STANDARD DEPLOY COMMAND

Run from inside `~/Downloads/nysterys-media/`:

```bash
cd hub-src && npm run build && cd .. && \
cp hub-src/build/index.html hub/index.html && \
cp hub-src/build/asset-manifest.json hub/asset-manifest.json && \
cp hub-src/build/favicon.ico hub/favicon.ico && \
rm -rf hub/static && cp -r hub-src/build/static hub/static && \
git add -A && git commit -m "description of change" && git push
```

**NEVER edit files in `hub/` directly.** Always build from `hub-src/` and copy.

---

## ADMIN DASHBOARD NAVIGATION

```
Overview    ◈
Campaigns   ◎
Calendar    ▦
Payments    ◇
Rewards     ★
Analytics   ◉
--- Setup ---
Agencies & Labels
Platforms
Deliverable Types
Payment Destinations
Payment Methods        ← invoice/payout payment method options
TikTok Accounts
Users
```

`AdminDashboard` uses `switch(activeView)` — components unmount/remount on navigation.

---

## CREATOR DASHBOARD NAVIGATION

```
My Overview  ◈
My Campaigns ◎
My Calendar  ▦
My Payments  ◇
My Analytics ◉
```

`CreatorDashboard` uses always-mounted `display:block/none` pattern to preserve state:

```jsx
const show = (view) => ({ display: activeView === view ? 'block' : 'none' });
<div style={show('campaigns')}><CreatorCampaigns ... /></div>
```

`refreshKey` state triggers re-fetches in Overview and Campaigns when campaign status changes.

---

## DATABASE TABLES

### Core tables

| Table | Purpose |
|---|---|
| `profiles` | Users (extends auth.users). `role`: admin or creator. Has `creator_name`, `full_name`, `avatar_url` |
| `platforms` | TikTok, Instagram, etc. Admin-managed, `is_active` flag |
| `deliverable_types` | Post, Story, Reel, etc. Admin-managed |
| `agencies` | Brand agencies and music labels. Has `name`, `contact_email`, `notes`, `is_active` |
| `campaigns` | One per deal. One creator per campaign. Has `campaign_name`, `brand_name`, `contracted_rate`, `is_rush`, `rush_premium`, `status`, `brief`, `admin_notes`, `campaign_start_date`, `campaign_end_date`, `deal_signed_date` |
| `campaign_deliverables` | One row per post. `draft_status`: Not Started, Draft Submitted, Revisions Requested, Approved, Posted |
| `revision_rounds` | Draft revision history per deliverable |
| `invoices` | Agency → Patrick payment. Has `campaign_id` (nullable), `reward_entry_id` (nullable), `payment_status`, `invoice_amount`, `amount_received`, `processing_fee`, `you_received`, `you_received_date`, `receipt_path` |
| `creator_payouts` | Patrick → creator. Has `campaign_id` (nullable), `reward_entry_id` (nullable), `payout_amount`, `payout_status`, `payout_date` |
| `payout_splits` | Individual splits within a payout. Has `destination_id`, `percentage`, `amount`, `split_status`, `sent_date`, `cleared_date`, `reference`, `notes` |
| `payment_destinations` | Creator bank/investment accounts. Has `name`, `account_type` (Checking/Savings/UTMA/Investment/Other), `account_last4`, `institution`, `memo` |
| `payment_methods` | Invoice payment method options (PayPal, Wire, ACH, etc.). Has `name`, `is_active`, `sort_order` |
| `campaign_files` | File attachments per campaign (Supabase Storage: `campaign-files` bucket) |
| `comments` | Per-campaign comment thread |
| `tiktok_accounts` | Maps creator profiles to TikTok usernames |
| `audit_log` | Append-only activity log |
| `platform_rewards_programs` | Reward program definitions (e.g. TikTok Creator Rewards). Has `platform_id`, `name`, `payout_day` (1-28), `is_active` |
| `platform_reward_entries` | Monthly earnings per creator per program. Has `program_id`, `profile_id`, `period_month` (date, first of month), `gross_amount`, `notes` |

### Key views

| View | Purpose |
|---|---|
| `campaign_payout_summary` | Joins campaigns + invoices + creator_payouts for Payments view |
| `reward_payout_summary` | Joins reward_entries + programs + invoices + payouts for Rewards view |
| `campaign_deliverables_with_stats` | Joins deliverables + TikTok video stats |
| `tiktok_profile_insights_view` | UNIONs kym + mys profile data |
| `tiktok_audience_gender_view` | UNIONs kym + mys gender data |
| `tiktok_audience_country_view` | UNIONs kym + mys country data |
| `tiktok_audience_hourly_view` | UNIONs kym + mys hourly data |
| `tiktok_video_insights_view` | UNIONs kym + mys video data |

### Storage buckets

| Bucket | Access | Purpose |
|---|---|---|
| `payment-receipts` | Private, admin only | Invoice receipts |
| `campaign-files` | Private, admin only | Campaign attachments |

---

## PAYMENT FLOW

Two completely separate payment flows. Never mix them.

### Campaign Payments
1. **Invoice tab** — Agency pays Patrick
2. **Payout tab** — Patrick pays creator (with destination splits)

`campaign_payout_summary` view joins both stages.

### Platform Rewards
Same two-stage flow but `campaign_id = NULL` and `reward_entry_id` is set.

**Invoice auto-fill behavior:**
- Invoice date = last day of period month
- Paid date = configured `payout_day` of the month following the period month

### "Other" Destination Type
When `payment_destinations.account_type = 'Other'`, shows `payout_splits.notes` instead of account type/last4.

---

## CAMPAIGN NAME AUTO-GENERATION

Format: `yyyymmdd-NN-CreatorName-Agency Name`

- Date = today
- `NN` = two-digit serial, increments per agency per day
- Creator name: spaces stripped
- Agency name: spaces preserved

---

## CALENDAR VIEW

**Admin:** Month/week toggle, creator + status filters, color-coded chips, drag-to-reschedule unposted deliverables.

**Creator:** Same visual, read-only, scoped to own campaigns.

Chip colors: grey=Planned, blue=Draft Submitted, orange=Revisions Requested, yellow-green=Approved, green=Posted.

---

## COUPLER.IO ARCHITECTURE

6 importers per creator (12 total):

| Report Type | Table Suffix | Mode |
|---|---|---|
| Profile insights | `tiktok_profile_insights_{creator}` | Append |
| Audience genders | `tiktok_audience_gender_{creator}` | Replace |
| Audience countries | `tiktok_audience_country_{creator}` | Replace |
| Audience hourly activity | `tiktok_audience_hourly_{creator}` | Append |
| Video list insights | `tiktok_video_insights_{creator}` | Append |
| Video country data | `tiktok_video_countries_{creator}` | Replace |

Creators: `kym` and `mys`. Each importer needs a static `account__username` column in the transform step (no @ symbol).

Replace-mode syncs drop and recreate tables, wiping RLS. The `coupler_table_recreation_trigger` in SCHEMA.sql auto-reapplies RLS and recreates union views after each sync.

---

## MOBILE RESPONSIVE

All `@media (max-width: 768px)` styles in `App.css`:
- Sidebar → fixed bottom tab bar
- Sign out button appears as bottom nav item (`.nav-item-signout`)
- Detail panels → full screen
- Modals → bottom sheet
- `main-content` → `padding-bottom: 70px`

---

## FORMAT UTILITIES (`utils/format.js`)

All date/number formatting goes through these. Never use `new Date(string)` directly with `format()`.

| Function | Purpose |
|---|---|
| `fmtDate(d, fmt?)` | Safe date format. Returns '—' for null/invalid |
| `fmtMonth(ym)` | Formats 'yyyy-MM' → 'April 2026' |
| `fmtMoney(n)` | '$1,234.56'. Returns '—' for null/NaN |
| `extractMonths(rows, field)` | Extracts unique yyyy-MM values |
| `isValidDateString(d)` | Validates yyyy-MM-dd |
| `isValidNumber(v)` | Returns true for empty or valid number |
| `isValidUrl(url)` | Validates URLs |
| `isValidEmail(email)` | Validates email format |

**Month filter bug (avoid):** `new Date('2026-03-01')` is UTC midnight — renders as Feb 28 in US timezones. Always use: `new Date(parseInt(y), parseInt(mo) - 1, 1)`.

---

## CHARTS LIBRARY (`shared/Charts.js`)

| Export | What it is |
|---|---|
| `SparkLine` | Line chart with optional fill area |
| `BarChart` | Vertical bar chart |
| `HBar` | Horizontal bar with label and percentage |
| `DonutChart` | Donut/pie with legend |
| `StatTile` | KPI card with optional trend arrow |
| `ChartCard` | Wrapper card with title slot |
| `fmtNum(n)` | 1.4M, 228.5K, etc. |
| `fmtSecs(s)` | '6s' or '1m 24s' |
| `fmtPct(v)` | 0–1 decimal → '12.5%' |

---

## AUTH SYSTEM

- Email + password (Supabase Auth)
- 5 failed attempts → 15-minute lockout (client-side)
- Password reset via email link
- `isHandlingPasswordReset` flag in `supabase.js` prevents redirect during reset flow
- Role-based routing: admin → AdminDashboard, creator → CreatorDashboard

---

## KEY ARCHITECTURAL DECISIONS & GOTCHAS

**`campaign_deliverables_with_stats` uses `cd.*`** — When adding columns to `campaign_deliverables`, you must DROP VIEW and CREATE VIEW (not CREATE OR REPLACE).

**Invoices fetched separately** — Joining invoices through `campaign_deliverables_with_stats` fails silently. Fetch from `invoices` table directly and merge in JS by `campaign_id`.

**`creator_payouts` and `invoices`** — `campaign_id` and `invoice_id` are nullable to support rewards payouts. `reward_entry_id` is the FK for rewards records.

**TikTok API zero values** — TikTok returns 0 for `followers_count` and `net_followers` on the most recent day before data finalizes. Filter before rendering charts.

**All external links** open in popup window (480×720) via `openPopup()` helper in CampaignsView.js.

**Markdown brief field** — Supports Markdown. Rendered by `renderMarkdown()` in CampaignsView.js (no external library).

**Video linking** — `VideoPickerSelect` fetches creator's TikTok videos filtered to campaign date window, excluding videos already assigned to other campaigns.

**Deliverable expansion** — Campaigns created with `quantity > 1` can be expanded into individual rows with the Expand button.

**Detail panel remount bug (fixed)** — In `RewardDetailPanel`, use `initialLoading` (only true on first open) vs silent background refresh. Never set a loading flag that unmounts mounted tab content — it wipes all form state.

**Bad date in DB** — Known: one invoice had `invoice_date = '20265-03-21'`. Fix: `update public.invoices set invoice_date = '2026-03-21' where invoice_date = '20265-03-21';`

---

## SORTING PATTERN

```jsx
const [sortBy, setSortBy] = useState('default_column');
const [sortDir, setSortDir] = useState('desc');

function toggleSort(col) {
  if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  else { setSortBy(col); setSortDir('asc'); }
}

function SortTh({ col, children }) {
  const active = sortBy === col;
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(col)}>
      {children}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 9 }}>
        {active && sortDir === 'desc' ? '▼' : '▲'}
      </span>
    </th>
  );
}
```

---

## CSS DESIGN SYSTEM

All variables in `:root` in `App.css`:

```
--black:     #080808   ← page background
--surface:   #111111   ← cards, sidebar
--surface2:  #161616   ← table headers, hover states
--surface3:  #1e1e1e   ← alternating table rows
--orange:    #ff5c00   ← primary accent
--accent:    var(--orange)
--green:     #1db954
--red:       #e74c3c
--blue:      #3498db
--white:     #ffffff
--text:      #e8e8e8
--muted:     #888888
--text-muted: #888888
--text-dim:  #555555
--border:    rgba(255,255,255,0.07)
--border2:   rgba(255,255,255,0.12)
```

Table alternating rows: `tbody tr:nth-child(even) { background: var(--surface3); }`

---

## PUBLIC SITE ARCHITECTURE

The public site is vanilla HTML/CSS/JS — no build step, GitHub Pages serves directly from repo root.

**Key files:**
- `index.html` — homepage (has inline CSS for page-specific styles + shared `global.css`)
- `global.css` — shared reset, tokens, nav, footer
- `utils.js` — `initEmail(selector)` function for email obfuscation (call on every page)
- `icons.js` — SVG icon definitions
- `data.json` — single source of truth for all creator stats, roster data, rate cards. Update this file to update stats across all public pages.
- `creator.html` — individual creator profile page (reads `data.json` via `?id=kym` or `?id=mys`)

**To update creator stats:** Edit `data.json` and commit. No build needed.

**Favicon:** `favicon.ico` at repo root serves the public site. `hub-src/public/favicon.ico` is the source; `hub/favicon.ico` serves the hub.

---

## STARTING A NEW CLAUDE CHAT

Paste this at the start:

> This is the Nysterys Media Creator Hub — a React/Supabase influencer management portal for Patrick Nijsters managing creators Kym and Mys. The repo is at `~/Downloads/nysterys-media/`. Hub source in `hub-src/`, built output in `hub/`, schema in `schemas/SCHEMA.sql`. Supabase URL: `https://rnntuxabccnphfvvvaks.supabase.co`. Read `docs/MASTER-REFERENCE.md` before starting work. [Describe the specific change you want.]

**Rules Claude must follow:**
- Never use em-dashes in any drafted content
- No TikTok Shop affiliate work for Kym or Mys
- Mys is a teenager — all content must be age-appropriate
- Always include the deploy command at the end of any code change

---

## COMPLETE FEATURE LIST

### Admin views
- **Overview** — KPI tiles, needs-attention table, active campaigns, pending payments
- **Campaigns** — Full CRUD, auto-generated names, sortable/filterable, 5-tab detail panel (Deliverables, Details, Invoice, Files, Comments), deliverable edit/delete/expand, revision rounds, video picker, drag-reorder, markdown brief, file attachments, in-kind support
- **Calendar** — Month/week, creator + status filters, color chips, drag-to-reschedule
- **Payments** — Separate cash and in-kind tables, 6 stat tiles, invoice + payout detail panels, receipt upload, split destinations
- **Rewards** — Platform rewards programs, monthly entries, invoice + payout panels, auto-fill invoice date (last day of period month) and paid date (payout_day of following month), payment method dropdown from DB
- **Analytics** — Account switcher, date range filter, follower/views/likes charts, gender donut, top countries, peak hours, top videos
- **Setup** — Agencies, Platforms, Deliverable Types, Payment Destinations, Payment Methods, TikTok Accounts, Users

### Creator views
- **Overview** — Needs-attention grouped by campaign, active/upcoming with progress bars
- **My Campaigns** — Campaign list, mark complete, link video, submit draft
- **My Calendar** — Read-only calendar
- **My Payments** — Cash + in-kind tables, 7 stat tiles, rewards section
- **My Analytics** — Scoped to own TikTok account

### Auth
- Login with 15-min lockout after 5 failures
- Password reset via email
- Role-based routing
