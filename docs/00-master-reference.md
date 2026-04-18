# Nysterys Media — Complete App Reference

This document is the single source of truth for the Nysterys Media platform. It is written for a future Claude session starting fresh, and covers everything needed to understand, maintain, extend, or rebuild the app from scratch.

---

## What this app is

A private internal portal for Patrick Nijsters (manager/admin) to manage influencer marketing campaigns for his daughters:

- **Kym** (`kymchi_n_crackers` on TikTok) — ~228K followers
- **Mys** (`mysthegreat` on TikTok) — ~1.4M followers

The platform has two parts:

1. **Public website** (`nysterys.com/`) — talent representation site for brands/agencies
2. **Creator Hub** (`nysterys.com/hub/`) — internal portal for campaign management, payments, and TikTok analytics

There are exactly three users: Patrick (admin/manager), Kym (creator), Mys (creator). Sign-ups are disabled. All accounts are created by invitation from the Supabase dashboard.

---

## Technical stack

| Layer | Technology |
|-------|-----------|
| Hosting | GitHub Pages (static, free) |
| Frontend | React 18, plain CSS, no UI library |
| Database + Auth | Supabase (free tier) |
| TikTok data sync | Coupler.io (paid subscription) |
| Domain | nysterys.com |

**GitHub repo:** `nysterys/nysterys-media` (public — required for free GitHub Pages)

**Supabase project:** `rnntuxabccnphfvvvaks.supabase.co`

---

## Repository structure

```
repo root/                    → served at nysterys.com/ by GitHub Pages
├── index.html                → public site homepage
├── creator.html              → creator profile page
├── media-kit.html            → media kit
├── rate-card.html            → rate card
├── privacy.html              → privacy policy
├── global.css                → shared styles for public site
├── data.json                 → creator stats (follower counts, etc.)
├── utils.js / icons.js       → shared utilities
├── robots.txt                → disallows /hub/ from crawlers
├── sitemap.xml
├── CNAME                     → nysterys.com

├── hub/                      → nysterys.com/hub/ (built React app, committed)
│   ├── index.html
│   └── static/js/main.*.js  → compiled app bundle

├── hub-src/                  → React source (never served)
│   ├── package.json          → homepage: "/hub"
│   ├── .env.example          → template for .env.production
│   ├── public/index.html     → CSP and security headers
│   └── src/
│       ├── lib/supabase.js   → Supabase client (detectSessionInUrl: false — critical)
│       ├── hooks/useAuth.js  → auth context and session management
│       ├── App.js            → routing (login vs admin vs creator dashboard)
│       ├── App.css           → all app styles (CSS variables, components)
│       ├── pages/
│       │   ├── LoginPage.js          → login + password reset handler
│       │   ├── AdminDashboard.js     → admin shell with sidebar nav
│       │   └── CreatorDashboard.js   → creator shell with sidebar nav
│       └── components/
│           ├── admin/
│           │   ├── AdminOverview.js          → dashboard summary
│           │   ├── CampaignsView.js          → campaign CRUD (largest file)
│           │   ├── PaymentsView.js           → invoice and payout management
│           │   ├── AnalyticsView.js          → TikTok analytics dashboard
│           │   ├── AgenciesView.js           → agency/label setup
│           │   ├── PlatformsView.js          → platform setup
│           │   ├── DeliverablesTypesView.js  → deliverable type setup
│           │   ├── PaymentDestinationsView.js → payout account setup
│           │   ├── TikTokAccountsView.js     → TikTok account linking
│           │   └── UsersView.js              → user management
│           ├── creator/
│           │   ├── CreatorOverview.js    → creator dashboard summary
│           │   ├── CreatorCampaigns.js   → creator campaign view (read-heavy)
│           │   ├── CreatorPayments.js    → creator payout view
│           │   └── CreatorAnalytics.js   → creator TikTok analytics
│           └── shared/
│               ├── Charts.js     → SparkLine, BarChart, DonutChart, HBar, StatTile
│               ├── Comments.js   → campaign comments component
│               ├── Sidebar.js    → navigation sidebar
│               └── Badge.js      → status badge component

├── schemas/                  → SQL files, run in order in Supabase SQL Editor
│   ├── 01-schema.sql         → core tables
│   ├── 02-schema-tiktok.sql  → TikTok account table (NOT the raw data tables)
│   ├── 03-schema-payouts.sql → payment tables and payout summary view
│   ├── 04-schema-security.sql → RLS fixes and audit log
│   └── 05-tiktok-views.sql   → IMPORTANT: not used (see Coupler.io section)

└── docs/                     → setup documentation
    ├── 01-setup.md
    ├── 02-supabase.md
    ├── 03-coupler.md
    ├── 04-deployment.md
    └── 05-security.md
```

---

## Supabase credentials

| Item | Value |
|------|-------|
| Project URL | `https://rnntuxabccnphfvvvaks.supabase.co` |
| Project ID | `rnntuxabccnphfvvvaks` |
| Anon key | `sb_publishable_uTUIIpWaYYgke_5rtyhUnw_0lMfHI3c` |
| Service role key | In Supabase Dashboard → Settings → API (never in app code) |
| Session pooler host | `aws-1-us-east-1.pooler.supabase.com` |
| Session pooler port | `5432` |
| Session pooler user | `postgres.rnntuxabccnphfvvvaks` |
| Admin user ID | `3e8c9d32-600e-4144-8ad8-cb828b1bcae2` (patrick@nysterys.com) |

**PostgreSQL connection for Coupler.io (use Session Pooler — direct connection is IPv6 only):**
```
Host:     aws-1-us-east-1.pooler.supabase.com
Port:     5432
Database: postgres
Username: postgres.rnntuxabccnphfvvvaks
Password: [database password set during project creation]
SSL:      Required
```

---

## Database schema

### Core tables (schema 01)

#### `profiles`
One row per user. Auto-created by trigger when a Supabase auth user is created.
```sql
id uuid (= auth.users.id, primary key)
email text
full_name text
creator_name text        -- "Kym" or "Mys" (null for admin)
role text                -- 'admin' | 'creator'
avatar_url text
created_at, updated_at timestamptz
```

#### `agencies`
Brands and labels that book campaigns.
```sql
id uuid
name text
contact_name text
contact_email text
contact_phone text
notes text
is_active boolean default true
created_at, updated_at timestamptz
```

#### `platforms`
Social platforms (TikTok, Instagram, YouTube, etc.). Pre-seeded.
```sql
id uuid
name text unique
is_active boolean default true
created_at timestamptz
```

#### `deliverable_types`
Types of content deliverables (Post, Story, Reel/Short, Live, Bundle). Pre-seeded.
```sql
id uuid
name text unique
description text
is_active boolean default true
created_at timestamptz
```

#### `campaigns`
One per brand deal. Always belongs to one creator.
```sql
id uuid
campaign_name text                          -- e.g. "Broke Records #1"
brand_name text
agency_id uuid → agencies
creator_profile_id uuid → profiles          -- which creator
created_by uuid → profiles                  -- who created it (admin)
status text  -- 'Draft'|'Confirmed'|'Active'|'Completed'|'Cancelled'
contracted_rate numeric(10,2)
campaign_start_date date
campaign_end_date date
campaign_notes text
brand_brief_url text
created_at, updated_at timestamptz
```

**Important:** campaigns has TWO foreign keys to profiles (`creator_profile_id` and `created_by`). Any Supabase JS query joining profiles must specify which FK:
```js
// CORRECT
.select('*, creator:profiles!campaigns_creator_profile_id_fkey(full_name, creator_name)')
// WRONG — causes PGRST201 ambiguity error
.select('*, creator:profiles(full_name, creator_name)')
```

#### `campaign_deliverables`
Individual content pieces within a campaign. A campaign can have multiple.
```sql
id uuid
campaign_id uuid → campaigns
platform_id uuid → platforms
deliverable_type_id uuid → deliverable_types
due_date date
post_url text                    -- TikTok URL once published (used to extract video_id for analytics)
draft_status text  -- 'Not Started'|'Draft Submitted'|'In Revision'|'Approved'|'Published'
notes text
created_at, updated_at timestamptz
```

#### `revision_rounds`
One per revision cycle on a deliverable.
```sql
id uuid
deliverable_id uuid → campaign_deliverables
round_number int
submitted_by uuid → profiles   -- FK name: revision_rounds_submitted_by_fkey
draft_url text
feedback text
agency_decision text  -- 'Approved'|'Revision Requested'|'Rejected'
decision_date date
created_at timestamptz
```

#### `invoices`
One per campaign (agency pays Patrick).
```sql
id uuid
campaign_id uuid → campaigns (unique — one invoice per campaign)
invoice_number text
invoice_date date
invoice_amount numeric(10,2)    -- what agency owes
payment_status text  -- 'Not Invoiced'|'Invoiced'|'Pending'|'Paid'|'Overdue'|'Disputed'
payment_received_date date
payment_method text              -- 'PayPal'|'Wire'|'Check' etc.
payment_notes text
amount_received numeric(10,2)   -- actual amount received (may differ due to fees)
processing_fee numeric(10,2)
you_received boolean             -- whether Patrick has transferred money to creator
you_received_date date
you_received_notes text
created_at, updated_at timestamptz
```

#### `comments`
Per campaign, visible to admin and the campaign's creator.
```sql
id uuid
campaign_id uuid → campaigns
author_id uuid → profiles
body text
created_at timestamptz
```

### Payout tables (schema 03)

#### `payment_destinations`
Bank accounts/destinations for creator payouts. Configured once, reused across campaigns.
```sql
id uuid
profile_id uuid → profiles       -- which creator owns this destination
name text                        -- "Savings", "UTMA", "Checking"
account_type text  -- 'Checking'|'Savings'|'UTMA'|'Investment'|'Other'
account_last4 text               -- last 4 digits only, never full account number
institution text                 -- "Chase", "Fidelity" etc.
memo text
is_active boolean default true
sort_order int
created_at, updated_at timestamptz
```

#### `creator_payouts`
One per campaign — Patrick paying the creator.
```sql
id uuid
campaign_id uuid → campaigns
profile_id uuid → profiles        -- the creator
invoice_id uuid → invoices
payout_amount numeric(10,2)
payout_status text  -- 'Pending'|'Processing'|'Sent'|'Cleared'|'Cancelled'
payout_date date
payout_notes text
created_at, updated_at timestamptz
```

#### `payout_splits`
Individual transfers within a payout (one row per destination account).
```sql
id uuid
payout_id uuid → creator_payouts
destination_id uuid → payment_destinations
amount numeric(10,2)
split_status text  -- 'Pending'|'Sent'|'Cleared'|'Failed'
sent_date date
cleared_date date
notes text
created_at, updated_at timestamptz
```

### TikTok account table (schema 02)

#### `tiktok_accounts`
Links a creator profile to their TikTok username. Used by the app to know which analytics data belongs to which creator.
```sql
id uuid
profile_id uuid → profiles
tiktok_username text unique     -- e.g. "mysthegreat", "kymchi_n_crackers"
display_name text
is_active boolean default true
created_at, updated_at timestamptz
```

### TikTok raw data tables (created by Coupler.io — NOT by schema files)

Coupler.io creates these tables automatically when it first syncs. They use double-underscore column naming. There are separate tables per creator (`_kym` and `_mys` suffix).

**Profile insights** (Append mode — daily history):
- `tiktok_profile_insights_kym`
- `tiktok_profile_insights_mys`

Columns: `account__username, report__date, engagement__total_followers, engagement__followers_count_on_date, engagement__likes, engagement__shares, engagement__profile_views, engagement__video_views, engagement__comments`

**Audience gender** (Replace mode — current snapshot):
- `tiktok_audience_gender_kym`
- `tiktok_audience_gender_mys`

Columns: `account__username, audience__gender, engagement____of_followers (decimal 0-1), engagement__total_followers`

**Audience country** (Replace mode — current snapshot):
- `tiktok_audience_country_kym`
- `tiktok_audience_country_mys`

Columns: `account__username, audience__country, engagement____of_followers (decimal 0-1), engagement__total_followers`

**Audience hourly activity** (Append mode — daily history):
- `tiktok_audience_hourly_kym`
- `tiktok_audience_hourly_mys`

Columns: `account__username, report__date, audience__activity_hour (text "0"-"23"), engagement__followers_online (bigint), engagement__total_followers`

**Video insights** (Append mode — lifetime stats per video):
- `tiktok_video_insights_kym`
- `tiktok_video_insights_mys`

Columns: `video__video_id, video__caption, video__thumbnail_url, video__created_at, video__views, engagement__likes, engagement__shares, engagement__comments, video__average_view_time, video__duration, video__views_at_100__rate, performance__reach, video__embed_url, video__share_url, account__username`

**Video countries** (Replace mode — current snapshot per video):
- `tiktok_video_countries_kym`
- `tiktok_video_countries_mys`

Columns: `video__video_id, audience__country, video____of_viewers (decimal 0-1), account__username`

**Critical data notes:**
- Percentage fields (`engagement____of_followers`, `video____of_viewers`) are decimals (0.85 = 85%) — multiply by 100 in the app
- `engagement__followers_count_on_date` and `engagement__followers_online` are bigint — come through as strings in JS, must use `Number()` to convert
- `engagement__total_followers` is a static snapshot of current total, not historical — use `engagement__followers_count_on_date` for growth charts
- `audience__activity_hour` is stored as text — use `parseInt()` in JS when using as object key

### Views (created manually in Supabase SQL Editor)

These views map Coupler.io's double-underscore column names to clean names the app expects. They union both creator tables.

#### `tiktok_profile_insights_view`
```sql
select distinct on (tiktok_username, date) *
from (
  select account__username as tiktok_username, report__date as date,
    engagement__total_followers as followers_count,
    engagement__followers_count_on_date as net_followers,
    engagement__likes as likes, engagement__shares as shares,
    engagement__profile_views as profile_views,
    engagement__video_views as video_views, engagement__comments as comments
  from tiktok_profile_insights_kym
  union all
  select ... from tiktok_profile_insights_mys
) t order by tiktok_username, date;
```

#### `tiktok_audience_gender_view`
```sql
select account__username as tiktok_username, audience__gender as gender,
  engagement____of_followers as percentage, engagement__total_followers as follower_count
from tiktok_audience_gender_kym union all ... mys;
```

#### `tiktok_audience_country_view`
```sql
select account__username as tiktok_username, audience__country as country,
  engagement____of_followers as percentage, engagement__total_followers as follower_count
from tiktok_audience_country_kym union all ... mys;
```

#### `tiktok_audience_hourly_view`
```sql
select distinct on (tiktok_username, date, hour) * from (
  select account__username as tiktok_username, report__date as date,
    audience__activity_hour::int as hour, engagement__followers_online as activity_score
  from tiktok_audience_hourly_kym union all ... mys
) t order by tiktok_username, date, hour;
```

#### `tiktok_video_insights_view`
```sql
select distinct on (tiktok_username, video_id) * from (
  select account__username as tiktok_username, video__video_id as video_id,
    video__caption as video_title, video__thumbnail_url as cover_image_url,
    video__created_at as create_time, video__views as total_play,
    engagement__likes as total_like, engagement__comments as total_comment,
    engagement__shares as total_share, video__average_view_time as average_time_watched,
    video__duration as video_duration, video__views_at_100__rate as full_video_watched_rate,
    performance__reach as reach, video__embed_url as embed_url, video__share_url as share_url
  from tiktok_video_insights_kym union all ... mys
) t order by tiktok_username, video_id, create_time desc;
```

#### `tiktok_video_countries_view`
```sql
select account__username as tiktok_username, video__video_id as video_id,
  audience__country as country, video____of_viewers as percentage
from tiktok_video_countries_kym union all ... mys;
```

#### `campaign_deliverables_with_stats`
Joins campaign deliverables to TikTok video stats via video ID extracted from post URL.
```sql
select cd.*, tvi.video_id, tvi.video_title, tvi.cover_image_url,
  tvi.create_time as tiktok_publish_time, tvi.total_play as views,
  tvi.total_like as likes, tvi.total_comment as comments, tvi.total_share as shares,
  tvi.average_time_watched, tvi.video_duration, tvi.full_video_watched_rate, tvi.reach,
  case when tvi.total_play > 0
    then round(((tvi.total_like + tvi.total_comment + tvi.total_share)::numeric / tvi.total_play) * 100, 2)
    else null end as engagement_rate
from campaign_deliverables cd
left join tiktok_video_insights_view tvi
  on tvi.video_id = public.extract_tiktok_video_id(cd.post_url);
```

The `extract_tiktok_video_id()` function parses the numeric video ID from a TikTok URL like `https://www.tiktok.com/@mysthegreat/video/7234567890123456789`.

#### `campaign_payout_summary`
Used by Payments view. Joins campaigns + invoices + payouts into one denormalized view.
```sql
select c.id as campaign_id, c.campaign_name, c.brand_name, c.contracted_rate,
  c.creator_profile_id, pr.creator_name, pr.full_name as creator_full_name,
  ag.name as agency_name,
  inv.id as invoice_id, inv.invoice_number, inv.invoice_date, inv.invoice_amount,
  inv.payment_status as agency_payment_status, inv.payment_received_date as agency_paid_date,
  inv.amount_received, inv.processing_fee, inv.you_received, inv.you_received_date,
  po.id as payout_id, po.payout_amount, po.payout_status, po.payout_date, po.payout_notes,
  count(ps) as split_count, count(ps where cleared) as splits_cleared
from campaigns c
left join profiles pr on pr.id = c.creator_profile_id
left join agencies ag on ag.id = c.agency_id
left join invoices inv on inv.campaign_id = c.id
left join creator_payouts po on po.campaign_id = c.id;
```

### Row Level Security model

Every table has RLS enabled. The `get_my_role()` function returns the current user's role.

| Role | Access |
|------|--------|
| `admin` | Read and write everything |
| `creator` | Read/write only their own data (filtered by `creator_profile_id` or `profile_id`) |
| Anonymous | Nothing |

**TikTok table RLS:** Policies join to `tiktok_accounts` on `account__username` (not `tiktok_username` — that's the view column name, not the raw table column name).

**Role escalation prevention:** The profiles update policy includes a `with check` that prevents users from changing their own `role` field. Role changes must be made in the Supabase dashboard.

---

## Auth architecture

**Key setting:** `detectSessionInUrl: false` in the Supabase client. This prevents the client from auto-consuming URL hash tokens on every page load, which was causing login failures. Password reset tokens in the URL hash are handled manually in `LoginPage.js`.

**Password reset flow:**
1. User clicks "Forgot password?" on login page
2. App calls `supabase.auth.resetPasswordForEmail()` with `redirectTo: https://nysterys.com/hub/`
3. Supabase emails a link containing `#access_token=...&type=recovery` in the URL hash
4. User clicks link, lands on `nysterys.com/hub/#access_token=...&type=recovery`
5. `LoginPage.js` detects `type=recovery` in hash, calls `supabase.auth.setSession()` with the tokens
6. `useAuth.js` has `isHandlingPasswordReset` flag to prevent SIGNED_IN event from redirecting to dashboard
7. LoginPage switches to "Set New Password" form
8. User sets password via `supabase.auth.updateUser({ password: newPassword })`
9. App signs out and redirects to login

**User creation:** Supabase invite flow hits email rate limits on free tier. Use Authentication → Users → Create new user with Auto Confirm ON, then set the password via Admin REST API curl:
```bash
curl -X PUT \
  'https://rnntuxabccnphfvvvaks.supabase.co/auth/v1/admin/users/USER_UUID' \
  -H 'apikey: SERVICE_ROLE_KEY' \
  -H 'Authorization: Bearer SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"password": "NewPassword123!"}'
```

---

## Coupler.io setup

12 data flows total — 6 report types × 2 creators. Navigate via Data flows → New data flow.

**Supabase destination connection:** Use Session Pooler settings above (not direct connection — IPv6 only).

| Report type | Destination table (Kym) | Destination table (Mys) | Import mode |
|-------------|------------------------|------------------------|-------------|
| Profile insights | `tiktok_profile_insights_kym` | `tiktok_profile_insights_mys` | Append |
| Audience gender | `tiktok_audience_gender_kym` | `tiktok_audience_gender_mys` | Replace |
| Audience country | `tiktok_audience_country_kym` | `tiktok_audience_country_mys` | Replace |
| Audience hourly | `tiktok_audience_hourly_kym` | `tiktok_audience_hourly_mys` | Append |
| Video insights | `tiktok_video_insights_kym` | `tiktok_video_insights_mys` | Append |
| Video countries | `tiktok_video_countries_kym` | `tiktok_video_countries_mys` | Replace |

**For video insights only:** TikTok doesn't include username in this report. Add a static column via the Formula tab with value `"kymchi_n_crackers"` or `"mysthegreat"` and column name `account__username`.

**Username matching:** The value in Coupler.io's `account__username` column must exactly match the `tiktok_username` field in the `tiktok_accounts` table in Supabase (case-sensitive, no @ symbol).

---

## Deployment workflow

```bash
# From repo root — run every time you update hub source code
cd hub-src && npm run build && cd ..
cp -r hub-src/build/* hub/
git add hub/
git commit -m "describe the change"
git push
```

GitHub Pages deploys within 1-3 minutes. The `hub/` folder at the repo root is committed build output — this is intentional, not a mistake.

**Environment file:** `hub-src/.env.production` is gitignored. Must be present locally to build:
```
REACT_APP_SUPABASE_URL=https://rnntuxabccnphfvvvaks.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_uTUIIpWaYYgke_5rtyhUnw_0lMfHI3c
```

**Critical:** The URL must NOT have a double `https://` — this was a past bug that caused all auth to fail silently (requests were blocked by CSP).

---

## Known issues and real-world corrections

These are things that differ from standard documentation and caused problems during setup:

1. **Supabase "Allowed Origins" CORS field** — no longer exists in the dashboard. CORS is now automatic for authenticated requests. Ignore any documentation that references this field.

2. **User creation via invite** — hits email rate limits (4/hour on free tier). Use Authentication → Users → Create new user with Auto Confirm ON instead. Set passwords via Admin REST API curl.

3. **Password hashing via SQL** — `update auth.users set encrypted_password = crypt(...)` appears to work (verify returns true) but Supabase auth rejects the result. Always use the Admin REST API to set passwords.

4. **Double `https://` in `.env.production`** — if the Supabase URL is `https://https://...`, all auth requests will be blocked by the Content Security Policy with a confusing "Invalid credentials" error. Always verify the URL in the built JS file: `grep -o "https://[a-z]*\.supabase\.co" hub/static/js/main.*.js`

5. **Supabase PKCE flow and password reset** — `detectSessionInUrl: true` (default) auto-consumes URL hash tokens on every page load, breaking auth state. Must set `detectSessionInUrl: false`. Recovery tokens in the hash must be exchanged manually via `supabase.auth.setSession()`.

6. **Campaigns query ambiguity** — campaigns table has two FK to profiles. Any Supabase JS query that joins profiles must use `profiles!campaigns_creator_profile_id_fkey` explicitly.

7. **Coupler.io UI** — completely redesigned from their documentation. Navigation: Data flows, Sources, Destinations (not "Importers"). No column rename step — handle via SQL views.

8. **Coupler.io import modes** — no Upsert option. Use Replace for snapshots, Append for history.

9. **Coupler.io PostgreSQL connection** — direct connection is IPv6 only. Must use Session Pooler. Username format is `postgres.PROJECT_ID` not just `postgres`.

10. **TikTok percentage data** — all percentage fields from Coupler.io are decimals (0.85 = 85%). Multiply by 100 in the app.

11. **Bigint columns in JS** — PostgreSQL bigint columns (follower counts, activity scores) come through as strings in the Supabase JS client. Always use `Number()` when doing arithmetic.

12. **TikTok RLS column names** — raw Coupler.io tables use `account__username`, not `tiktok_username`. RLS policies must reference `account__username`.

13. **GitHub Pages serves from repo root** — site files must be at the repo root, not in a subdirectory. The `hub/` built output also goes at the root, served as `nysterys.com/hub/`.

14. **Old build files accumulate in hub/** — run `rm -rf hub/static` before copying new build to prevent stale JS files from being served.

---

## Supabase Auth settings checklist

Authentication → URL Configuration:
- Site URL: `https://nysterys.com/hub/`
- Redirect URLs: `https://nysterys.com/hub/`

Authentication → Settings:
- Enable sign ups: OFF
- Confirm email: ON
- Minimum password length: 12
- Leaked password protection: ON
- Secure email change: ON

---

## App feature summary

**Admin (Patrick) sees:**
- Overview: all campaigns across both creators, total stats
- Campaigns: full CRUD — create deals, track deliverables, manage revisions, upload post URLs
- Payments: invoice tracking (agency → Patrick) and payout management (Patrick → creator splits)
- Analytics: TikTok dashboard for Kym and Mys — follower growth, video views, likes, audience gender/country/hourly, top videos, campaign post performance
- Setup: agencies, platforms, deliverable types, payment destinations, TikTok accounts, users

**Creators (Kym, Mys) see:**
- Overview: their own campaigns summary
- Campaigns: view their deals, submit drafts, view revision feedback, add post URLs
- Payments: view their payout history and split breakdown
- Analytics: their own TikTok stats

---

## CSS design system

Brand colors (defined in App.css):
```css
--orange:  #ff5c00   (primary accent, CTAs, active nav)
--orange2: #ff8c42   (secondary orange)
--blue:    #4d9fff   (video views charts)
--purple:  #9b59ff   (likes charts, Female gender)
--green:   #2ecc71   (success states)
--white:   #f5f5f5
--black:   #080808   (background)
--surface: #111111   (card background)
```

Font stack:
- Display: Bebas Neue (headings, logo, stats)
- Body: Inter

The logo renders as `NYS<span>T</span>ERYS` where the T is orange — matching the nysterys.com public site exactly.
