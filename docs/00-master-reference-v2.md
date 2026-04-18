# NYSTERYS MEDIA CREATOR HUB — MASTER REFERENCE v2
*Last updated: April 18, 2026. Read this entire document before starting any work.*

---

## WHAT THIS IS

A private internal portal for Patrick Nijsters managing influencer campaigns for his daughters:
- **Kym** — TikTok: `kymchi_n_crackers`, ~228K followers
- **Mys** — TikTok: `mysthegreat`, ~1.4M followers

Three users: Patrick (admin/manager), Kym (creator), Mys (creator). Mys is a teenager. No em-dashes in any content. No TikTok Shop affiliate work for either creator.

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | React 18, Create React App |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Analytics sync | Coupler.io → Supabase |
| Hosting | GitHub Pages at `nysterys.com/hub/` |
| Local repo | `~/Downloads/nysterys-media/` |

**Credentials (non-secret — anon key only):**
- Supabase project URL: `https://rnntuxabccnphfvvvaks.supabase.co`
- Supabase anon key: `sb_publishable_uTUIIpWaYYgke_5rtyhUnw_0lMfHI3c`
- Admin user ID: `3e8c9d32-600e-4144-8ad8-cb828b1bcae2`

---

## REPO STRUCTURE

```
nysterys-media/
├── hub/                          ← GitHub Pages deploy target (NEVER edit directly)
│   ├── index.html
│   ├── asset-manifest.json
│   └── static/
├── hub-src/                      ← React source (all editing happens here)
│   ├── .env.production           ← NOT in git — contains secrets
│   ├── public/index.html
│   ├── package.json
│   └── src/
│       ├── App.js                ← Root: AuthProvider → role-based routing
│       ├── App.css               ← ALL styles (global, components, mobile responsive)
│       ├── index.js
│       ├── lib/supabase.js       ← Supabase client + password reset flag
│       ├── hooks/useAuth.js      ← AuthContext, useAuth hook
│       ├── utils/format.js       ← SHARED safe formatting + validation utilities
│       ├── pages/
│       │   ├── LoginPage.js      ← Login, password reset, lockout logic
│       │   ├── AdminDashboard.js ← Admin router (switch-case, no always-mount)
│       │   └── CreatorDashboard.js ← Creator router (always-mounted with display:block/none)
│       └── components/
│           ├── admin/
│           │   ├── AdminOverview.js
│           │   ├── CampaignsView.js        ← ~2500 lines, main campaign management
│           │   ├── CalendarView.js         ← Month/week calendar with drag-to-reschedule
│           │   ├── PaymentsView.js         ← Agency invoices + creator payouts
│           │   ├── RewardsView.js          ← Platform rewards program tracking
│           │   ├── AnalyticsView.js        ← TikTok analytics dashboard
│           │   ├── AgenciesView.js
│           │   ├── PlatformsView.js
│           │   ├── DeliverablesTypesView.js
│           │   ├── TikTokAccountsView.js
│           │   ├── PaymentDestinationsView.js
│           │   └── UsersView.js
│           ├── creator/
│           │   ├── CreatorOverview.js      ← Needs-attention + active campaigns
│           │   ├── CreatorCampaigns.js     ← Campaign list + deliverable actions
│           │   ├── CreatorCalendar.js      ← Read-only calendar scoped to creator
│           │   ├── CreatorPayments.js      ← Campaign payouts + rewards section
│           │   └── CreatorAnalytics.js     ← Personal TikTok analytics
│           └── shared/
│               ├── Badge.js               ← Status badge component
│               ├── Charts.js              ← SparkLine, BarChart, HBar, DonutChart, StatTile, ChartCard
│               ├── Comments.js            ← Per-campaign comments (admin can delete any)
│               └── Sidebar.js             ← Nav sidebar + mobile bottom bar
├── schemas/
│   └── SCHEMA.sql                ← SINGLE consolidated schema, full source of truth
├── docs/
│   ├── 00-master-reference-v2.md ← THIS FILE
│   └── [other docs]
├── kym.jpg                       ← Must always be in repo root
├── mys.jpg                       ← Must always be in repo root
└── index.html                    ← Main nysterys.com site
```

---

## STANDARD DEPLOY COMMAND

Run from inside `~/Downloads/nysterys-media/`:

```bash
cd hub-src && npm run build && cd ..
cp hub-src/build/index.html hub/index.html
cp hub-src/build/asset-manifest.json hub/asset-manifest.json
rm -rf hub/static && cp -r hub-src/build/static hub/static
git add -A
git commit -m "description of change"
git push
```

NEVER edit files in `hub/` directly. Always build from `hub-src/` and copy.

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
TikTok Accounts
Users
```

AdminDashboard uses a `switch(activeView)` — components unmount/remount on navigation (fine for admin, no state preservation needed).

---

## CREATOR DASHBOARD NAVIGATION

```
My Overview  ◈
My Campaigns ◎
My Calendar  ▦
My Payments  ◇
My Analytics ◉
```

CreatorDashboard uses always-mounted `display:block/none` pattern — all views stay mounted to preserve state and allow background refreshes. Pattern:

```jsx
const show = (view) => ({ display: activeView === view ? 'block' : 'none' });
// ...
<div style={show('campaigns')}><CreatorCampaigns ... /></div>
```

`refreshKey` state in CreatorDashboard triggers re-fetches in Overview and Campaigns when a campaign status changes (e.g. mark complete). Pass `refreshKey` to `CreatorOverview` and `onCampaignStatusChanged` to `CreatorCampaigns`.

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
| `revision_rounds` | Draft revision history per deliverable. Submitted via creator portal |
| `invoices` | Agency → Patrick payment. One per campaign OR one per reward_entry. Has `campaign_id` (nullable), `reward_entry_id` (nullable), `payment_status`, `invoice_amount`, `amount_received`, `processing_fee`, `you_received`, `you_received_date`, `receipt_path` |
| `creator_payouts` | Patrick → creator. One per campaign OR reward entry. Has `campaign_id` (nullable), `reward_entry_id` (nullable), `payout_amount`, `payout_status`, `payout_date` |
| `payout_splits` | Individual splits within a payout. Has `destination_id`, `percentage`, `amount`, `split_status`, `sent_date`, `cleared_date`, `reference`, `notes` |
| `payment_destinations` | Creator bank/investment accounts. Has `name`, `account_type` (Checking/Savings/UTMA/Investment/Other), `account_last4`, `institution`, `memo` |
| `campaign_files` | File attachments per campaign (Supabase Storage: `campaign-files` bucket) |
| `comments` | Per-campaign comment thread |
| `tiktok_accounts` | Maps creator profiles to TikTok usernames (`tiktok_username`, `is_active`) |
| `audit_log` | Append-only activity log |
| `platform_rewards_programs` | Reward program definitions (e.g. TikTok Creator Rewards). Has `platform_id`, `name`, `payout_day` (1-28), `is_active` |
| `platform_reward_entries` | Monthly earnings per creator per program. Has `program_id`, `profile_id`, `period_month` (date, first of month), `gross_amount`, `notes`. Unique on (program_id, profile_id, period_month) |

### Views
| View | Purpose |
|---|---|
| `campaign_payout_summary` | Joins campaigns + invoices + creator_payouts for Payments view |
| `reward_payout_summary` | Joins reward_entries + programs + invoices + payouts for Rewards view |
| `campaign_deliverables_with_stats` | Joins deliverables + TikTok video stats via `extract_tiktok_video_id(post_url)` |
| `tiktok_profile_insights_view` | UNIONs kym + mys profile data |
| `tiktok_audience_gender_view` | UNIONs kym + mys gender data |
| `tiktok_audience_country_view` | UNIONs kym + mys country data |
| `tiktok_audience_hourly_view` | UNIONs kym + mys hourly data |
| `tiktok_video_insights_view` | UNIONs kym + mys video data |
| `tiktok_video_countries_view` | UNIONs kym + mys video country data |
| `agencies_public` | Read-only agency name list for creators |

### Storage buckets
| Bucket | Access | Purpose |
|---|---|---|
| `payment-receipts` | Private, admin only | Invoice receipts (PDF/JPG/PNG) |
| `campaign-files` | Private, admin only | Campaign attachments |

---

## PAYMENT FLOW

Two completely separate payment flows. Never mix them in the same table or view.

### Campaign Payments
1. **Invoice tab** — Agency pays Patrick. Fields: invoice #, date, amount, status, method, receipt upload, "you received" checkbox + date + amount received + processing fee.
2. **Payout tab** — Patrick pays creator. Fields: payout amount, status, date, notes, destination splits (percentage + amount linked, per-split: status, sent date, cleared date, reference).

`campaign_payout_summary` view joins both stages.

### Platform Rewards
Same two-stage flow but `campaign_id = NULL` and `reward_entry_id` is set instead.

Admin: **Rewards view** (★). Shows month/creator/program filters, gross earned tiles, table with invoice + payout status. Detail panel has 3 tabs: Reward Entry (program, creator, period, gross amount), Invoice (platform → Patrick), Payout (Patrick → creator with splits).

Creator: Section below campaign tables in **My Payments**. Shows 3 tiles (Total Earned, Paid to Me, Pending) + table with splits and destination breakdown.

The payout_day on `platform_rewards_programs` determines the expected payment date displayed on the Invoice tab (e.g. 15 = 15th of following month).

### "Other" Destination Type
When `payment_destinations.account_type = 'Other'`, the sub-line in the payments table shows `payout_splits.notes` (falling back to `creator_payouts.payout_notes`) instead of account type/last4. This is how e.g. "iPhone 17 Pro purchase" appears under "Other Mys".

---

## CAMPAIGN NAME AUTO-GENERATION

On new campaign creation, when both Creator and Agency are selected, the name auto-generates:

Format: `yyyymmdd-NN-CreatorName-Agency Name`

- Date = today
- `NN` = two-digit serial, increments per agency per day (queries existing campaigns for same agency_id + today's date prefix)
- Creator name: spaces stripped
- Agency name: spaces preserved
- Shows "auto-generated" label in green, editable manually

---

## CALENDAR VIEW (Admin)

- Month/week toggle
- Creator filter + status filter
- Color-coded chips: grey=Planned, blue=Draft Submitted, orange=Revisions Requested, yellow-green=Approved, green=Posted
- **Drag and drop** to reschedule unposted deliverables (updates `contracted_post_date` in DB)
- Posted deliverables not draggable
- Click chip → detail popup

## CALENDAR VIEW (Creator)

Same visual, read-only, scoped to creator's own campaigns only.

---

## MARK CAMPAIGN COMPLETE (Creator)

Appears in detail panel when `c.status === 'Active'` AND all deliverables have `draft_status === 'Posted'`. Requires RLS policy:

```sql
create policy "Creators can mark own campaigns complete" on public.campaigns
  for update
  using (get_my_role() = 'creator' and creator_profile_id = auth.uid())
  with check (get_my_role() = 'creator' and creator_profile_id = auth.uid() and status = 'Completed');
```

---

## COUPLER.IO ARCHITECTURE

6 importers per creator (12 total):

| Report Type | Table Suffix | Coupler Mode |
|---|---|---|
| Profile insights | `tiktok_profile_insights_{creator}` | Append |
| Audience genders | `tiktok_audience_gender_{creator}` | Replace |
| Audience countries | `tiktok_audience_country_{creator}` | Replace |
| Audience hourly activity | `tiktok_audience_hourly_{creator}` | Append |
| Video list insights | `tiktok_video_insights_{creator}` | Append |
| Video country data | `tiktok_video_countries_{creator}` | Replace |

Creators: `kym` and `mys`.

In each Coupler transform step, add a static column `account__username` with the creator's TikTok handle (no @).

Replace mode drops and recreates tables, wiping RLS policies. The event trigger in SCHEMA.sql (`coupler_table_recreation_trigger`) auto-reapplies RLS + recreates union views after every sync.

Gender/country values may be 0-1 decimals or 0-100 percentages — the app auto-detects at runtime.

---

## MOBILE RESPONSIVE

All `@media (max-width: 768px)` styles in `App.css`:
- Sidebar → fixed bottom tab bar (logo/user/footer hidden, items stack horizontally)
- Sign out button appears as bottom nav item (`.nav-item-signout`, hidden on desktop via `display: none`)
- Detail panels → full screen (100vw × 100vh)
- Modals → bottom sheet (rounded top corners)
- Stats → 2-column grid
- `main-content` → `padding-bottom: 70px` to clear bottom nav
- `form-row` → stacks vertically

---

## FORMAT UTILITIES (`utils/format.js`)

ALL date/number formatting goes through these. Never use `new Date(string)` directly with `format()`.

| Function | Purpose |
|---|---|
| `fmtDate(d, fmt?)` | Safe date format. Returns '—' for null/invalid. Default fmt: 'MMM d, yyyy' |
| `fmtMonth(ym)` | Formats 'yyyy-MM' string → 'April 2026'. Validates before parsing |
| `fmtMoney(n)` | '$1,234.56'. Returns '—' for null/NaN |
| `extractMonths(rows, field)` | Extracts unique yyyy-MM values, filters malformed dates |
| `isValidDateString(d)` | Validates yyyy-MM-dd. Returns true for empty (optional fields) |
| `isValidNumber(v)` | Returns true for empty or valid number |
| `isValidUrl(url)` | Validates URLs |
| `isValidEmail(email)` | Validates email format |

### Month filter bug (avoid)
`new Date('2026-03-01')` is UTC midnight — renders as Feb 28 in US timezones.
Always use: `new Date(parseInt(y), parseInt(mo) - 1, 1)` where `[y, mo] = m.split('-')`.

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
- 5 failed attempts → 15-minute lockout (client-side, `useRef`)
- Password reset via email link (token parsed from URL hash in `LoginPage.js`)
- `isHandlingPasswordReset` flag in `supabase.js` prevents `useAuth` from redirecting during password reset flow
- Role-based routing in `App.js`: admin → AdminDashboard, creator → CreatorDashboard

---

## KEY ARCHITECTURAL DECISIONS & GOTCHAS

**`campaign_deliverables_with_stats` uses `cd.*`** — PostgreSQL snapshots the column list at creation. When adding columns to `campaign_deliverables`, you must DROP VIEW and CREATE VIEW (not CREATE OR REPLACE).

**Invoices fetched separately** — Joining invoices through `campaign_deliverables_with_stats` fails silently. Fetch invoices from `invoices` table directly and merge in JS by `campaign_id`.

**TikTok API zero values** — TikTok returns 0 for `followers_count` and `net_followers` on the most recent day before data finalizes. Filter these rows before rendering charts.

**All external links** open in popup window (480×720, no toolbar) via `openPopup()` helper in CampaignsView.js.

**Markdown brief field** — Supports Markdown. Has inline preview toggle and full-screen split editor/preview modal. Rendered by `renderMarkdown()` in CampaignsView.js (no external library).

**Video linking** — `VideoPickerSelect` component fetches the creator's TikTok videos filtered to campaign date window, excluding videos already assigned to other campaigns. Works the same in both admin and creator views.

**Deliverable expansion** — Campaigns can be created with `quantity > 1` deliverables. The Expand button splits them into individual rows so each post is tracked independently.

**Bad date in DB** — Known issue: one invoice had `invoice_date = '20265-03-21'`. Fix: `update public.invoices set invoice_date = '2026-03-21' where invoice_date = '20265-03-21';`

---

## SORTING PATTERN (used in all table views)

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
--surface3:  #1e1e1e   ← alternating table rows (tbody tr:nth-child(even))
--orange:    #ff5c00   ← primary accent (buttons, active states)
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

## COMPLETE FEATURE LIST

### Admin views
- **Overview** — KPI tiles (total contracted, received, paid to creators, pending, in-kind FMV), needs-attention table, active campaigns table, agency payments pending, creator payouts pending
- **Campaigns** — Full campaign CRUD with auto-generated names (yyyymmdd-NN-Creator-Agency), sortable columns, status + creator + agency + platform + payment + month filters, column-level filter dropdowns, detail panel with 5 tabs (Deliverables, Details, Invoice, Files, Comments), deliverable edit/delete/expand, revision rounds, video picker (date-filtered, excludes assigned), drag-reorder, mark complete, markdown brief with full-screen editor, file attachments, in-kind support
- **Calendar** — Month/week view, creator + status filters, color-coded chips, drag-to-reschedule unposted deliverables, click-to-detail popup
- **Payments** — Separate cash and in-kind tables, 6 stat tiles (Contracted, Received, Paid to Creators, Awaiting Payout, Fees Paid, In-Kind FMV), all columns sortable, invoice + payout detail panels, receipt upload, split destinations with %-to-$ linking
- **Rewards** — Platform rewards programs (TikTok Creator Rewards etc.), monthly entries per creator, invoice + payout panel identical to campaign flow, expected payout date shown from program's payout_day
- **Analytics** — Account switcher, date range filter (7d–12mo), follower growth, daily views/likes charts, gender donut, top countries, peak hours, sponsored campaign table, top videos with thumbnails
- **Setup** — Agencies, Platforms, Deliverable Types, Payment Destinations (with memo field for "Other" type), TikTok Accounts, Users

### Creator views
- **Overview** — Needs-attention grouped by campaign (clickable → campaign), active/upcoming with progress bars
- **My Campaigns** — Deduplicated platforms (TikTok ×5), Rate column, Posts progress bar, month filter, all columns sortable, mark campaign complete (when all deliverables posted), link posted video (video picker same as admin), submit draft, auto-refresh on action
- **My Calendar** — Read-only month/week calendar, status filter
- **My Payments** — Separate cash and in-kind tables, 7 stat tiles, "Other" destination shows payout notes, rewards section below with its own 3 tiles + table
- **My Analytics** — Same analytics as admin but scoped to own account

### Auth
- Login with 15-min lockout after 5 failures
- Password reset via email
- Role-based routing

---

## STARTING A NEW CHAT — QUICK CONTEXT

Tell Claude:

1. "This is the Nysterys Media Creator Hub — a React/Supabase influencer management portal for Patrick Nijsters managing Kym and Mys."
2. "The repo is at ~/Downloads/nysterys-media/. Hub source in hub-src/, built output in hub/, schema in schemas/SCHEMA.sql."
3. "Supabase URL: https://rnntuxabccnphfvvvaks.supabase.co"
4. "Read the master reference at docs/00-master-reference-v2.md before starting."
5. Describe the specific change you want.

The transcript file at `/mnt/transcripts/` in Claude's environment contains the full session history if Claude needs to look up implementation details from previous sessions.
