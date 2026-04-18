# NYSTERYS MEDIA — FRESH INSTALL GUIDE
*Complete rebuild from zero. Follow every step in order.*
*Estimated time: 2-3 hours*

---

## WHAT YOU WILL BUILD

1. Supabase database with all tables, RLS policies, functions, and triggers
2. GitHub Pages repo serving both the public site and the Creator Hub
3. Coupler.io TikTok analytics sync pipeline
4. Three user accounts (Patrick admin, Kym creator, Mys creator)

---

## PREREQUISITES

- Node.js 18+ and npm installed locally
- Git installed + GitHub account with access to `nysterys/nysterys-media`
- Supabase account (free tier works)
- Coupler.io account with TikTok Business connected
- GitHub Pages enabled on the repo (Settings → Pages → Deploy from branch `main`, folder `/` root)

---

## STEP 1 — CLONE THE REPO

```bash
git clone https://github.com/nysterys/nysterys-media.git ~/Downloads/nysterys-media
cd ~/Downloads/nysterys-media
```

---

## STEP 2 — SUPABASE PROJECT

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Note your project URL and anon key (Dashboard → Settings → API)
3. Update these in `hub-src/.env.production` (create from `.env.example`):

```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

Also update the hardcoded URL and key in `hub-src/src/lib/supabase.js` to match.

---

## STEP 3 — DATABASE SETUP

Go to **Supabase Dashboard → SQL Editor**.

### Part 1: Core schema (run first)

Run the entire contents of `schemas/SCHEMA.sql`. This creates:
- All core tables
- All RLS policies
- All functions and triggers
- Storage bucket references
- Platform rewards tables
- `payment_methods` table

**If you get an error** about views referencing tables that don't exist yet (the TikTok analytics union views), that is expected — skip to Part 2 below after the first Coupler sync.

### Part 2: Seed reference data

```sql
-- Platforms
insert into public.platforms (name) values
  ('TikTok'), ('Instagram'), ('YouTube'), ('Facebook'), ('X/Twitter')
on conflict do nothing;

-- Deliverable types
insert into public.deliverable_types (name) values
  ('Post'), ('Story'), ('Reel'), ('Short'), ('Live'), ('Review'), ('UGC Video')
on conflict do nothing;

-- Payment methods
insert into public.payment_methods (name, sort_order) values
  ('PayPal', 1), ('Wire', 2), ('ACH', 3), ('Check', 4),
  ('Zelle', 5), ('Direct Deposit', 6)
on conflict (name) do nothing;

-- TikTok Creator Rewards program (or add via UI later)
insert into public.platform_rewards_programs (name, payout_day, description)
select 'Creator Rewards', 15,
  'TikTok Creator Rewards Program — pays 15th of following month'
where exists (select 1 from public.platforms where name = 'TikTok');
```

### Part 3: Fix nullable constraints for rewards (REQUIRED)

The original schema has `NOT NULL` on `invoice_id` and `campaign_id` in `creator_payouts`, which blocks rewards payouts. Run this:

```sql
alter table public.creator_payouts
  alter column invoice_id drop not null,
  alter column campaign_id drop not null;

alter table public.invoices
  alter column campaign_id drop not null;

alter table public.creator_payouts
  add column if not exists reward_entry_id uuid
  references public.platform_reward_entries(id) on delete set null;

alter table public.invoices
  add column if not exists reward_entry_id uuid
  references public.platform_reward_entries(id) on delete set null;
```

---

## STEP 4 — SUPABASE AUTH SETTINGS

**Dashboard → Authentication → Settings:**
- Disable public signups (invite only)
- Minimum password length: 12
- Enable email confirmation
- Site URL: `https://nysterys.com/hub/`
- Add redirect URL: `https://nysterys.com/hub/`

---

## STEP 5 — SUPABASE STORAGE BUCKETS

**Dashboard → Storage** — create two private buckets:
1. `payment-receipts` — Private
2. `campaign-files` — Private

---

## STEP 6 — CREATE USERS

**Dashboard → Authentication → Users** — create three users:
1. Patrick (admin)
2. Kym (creator)
3. Mys (creator)

Then set their roles in SQL:

```sql
-- Patrick
update public.profiles
set full_name = 'Patrick Nijsters', role = 'admin'
where id = (select id from auth.users where email = 'patricks-email@example.com');

-- Kym
update public.profiles
set full_name = 'Kym', creator_name = 'Kym', role = 'creator'
where id = (select id from auth.users where email = 'kyms-email@example.com');

-- Mys
update public.profiles
set full_name = 'Mys', creator_name = 'Mys', role = 'creator'
where id = (select id from auth.users where email = 'mys-email@example.com');
```

---

## STEP 7 — REGISTER TIKTOK ACCOUNTS

Via admin UI (Setup → TikTok Accounts), or via SQL:

```sql
insert into public.tiktok_accounts (profile_id, tiktok_username, display_name, is_active)
values
  ((select id from profiles where creator_name = 'Kym'), 'kymchi_n_crackers', 'Kym', true),
  ((select id from profiles where creator_name = 'Mys'), 'mysthegreat', 'Mys', true);
```

---

## STEP 8 — COUPLER.IO SETUP

Configure 6 importers per creator (12 total). For each importer:

**Source:** TikTok Analytics  
**Destination:** Supabase → your project

| Creator | Report Type | Table Name | Mode |
|---|---|---|---|
| Kym | Profile insights | `tiktok_profile_insights_kym` | Append |
| Kym | Audience genders | `tiktok_audience_gender_kym` | Replace |
| Kym | Audience countries | `tiktok_audience_country_kym` | Replace |
| Kym | Audience hourly | `tiktok_audience_hourly_kym` | Append |
| Kym | Video insights | `tiktok_video_insights_kym` | Append |
| Kym | Video countries | `tiktok_video_countries_kym` | Replace |
| Mys | Profile insights | `tiktok_profile_insights_mys` | Append |
| Mys | Audience genders | `tiktok_audience_gender_mys` | Replace |
| Mys | Audience countries | `tiktok_audience_country_mys` | Replace |
| Mys | Audience hourly | `tiktok_audience_hourly_mys` | Append |
| Mys | Video insights | `tiktok_video_insights_mys` | Append |
| Mys | Video countries | `tiktok_video_countries_mys` | Replace |

**CRITICAL — In each Coupler transform step:**  
Add a static column named `account__username`:
- Kym importers: value = `kymchi_n_crackers`
- Mys importers: value = `mysthegreat`

Run the first sync for all 12 importers, then run Part 2 of SCHEMA.sql (the union views section).

---

## STEP 9 — REACT APP LOCAL SETUP

```bash
cd ~/Downloads/nysterys-media/hub-src
npm install
```

Create environment file:
```bash
cp .env.example .env.production
```

Edit `.env.production` with your Supabase URL and anon key.

Test locally:
```bash
npm start
# Opens http://localhost:3000
```

---

## STEP 10 — INITIAL DEPLOY

```bash
cd ~/Downloads/nysterys-media
cd hub-src && npm run build && cd ..
cp hub-src/build/index.html hub/index.html
cp hub-src/build/asset-manifest.json hub/asset-manifest.json
cp hub-src/build/favicon.ico hub/favicon.ico
rm -rf hub/static && cp -r hub-src/build/static hub/static
git add -A && git commit -m "initial deploy" && git push
```

Wait 1-2 minutes. Verify at `https://nysterys.com/hub/`.

---

## STEP 11 — PAYMENT DESTINATIONS

Via admin UI (Setup → Payment Destinations), add the bank/investment accounts for each creator. For example:
- Chase Savings Mys (Savings, last 4: 0099)
- Vanguard UTMA Mys (UTMA, last 4: 9875)
- Chase Checking Kym (Checking, last 4: XXXX)

Use `account_type = 'Other'` for non-standard destinations — the `memo` field shows in the UI instead of account type/last4.

---

## VERIFICATION CHECKLIST

- [ ] Can log in as Patrick (admin) — sees admin dashboard
- [ ] Can log in as Kym/Mys (creator) — sees creator dashboard
- [ ] Admin can create a campaign
- [ ] Campaign name auto-generates when creator + agency selected
- [ ] TikTok analytics appear in Analytics view
- [ ] Calendar shows deliverables
- [ ] Payments view shows campaigns
- [ ] Rewards view accessible (★ in sidebar)
- [ ] Rewards invoice saves without reverting
- [ ] Rewards payout saves (no 400 error)
- [ ] Payment Methods setup view populates dropdown
- [ ] Creator can submit draft and link video
- [ ] Creator can mark campaign complete (all deliverables posted)
- [ ] Favicon shows on both nysterys.com and nysterys.com/hub/
- [ ] Mobile: sidebar collapses to bottom nav

---

## ONGOING OPERATIONS

### Deploy after any code change
```bash
cd ~/Downloads/nysterys-media && cd hub-src && npm run build && cd .. && cp hub-src/build/index.html hub/index.html && cp hub-src/build/asset-manifest.json hub/asset-manifest.json && cp hub-src/build/favicon.ico hub/favicon.ico && rm -rf hub/static && cp -r hub-src/build/static hub/static && git add -A && git commit -m "description" && git push
```

### Update creator stats on public site
Edit `data.json` in the repo root → commit → push. No build needed.

### Adding a campaign
Admin → Campaigns → + New Campaign → select creator + agency → fill details → add deliverables → save.

### Recording agency payment
Admin → Payments → click campaign → Invoice tab → fill amount received → Save Invoice.

### Paying out to creator
Admin → Payments → click campaign → Payout tab → set amount → configure destination splits → Save Payout.

### Recording TikTok rewards
Admin → Rewards → + Add Entry → select program, creator, period, gross amount → save → click row → Invoice tab → Payout tab.

---

## TROUBLESHOOTING

**Login fails / redirect loop**  
Check Supabase Auth redirect URLs include `https://nysterys.com/hub/`.

**Analytics shows no data**  
Coupler sync hasn't run, or run the union views section of SCHEMA.sql after first sync.

**Rewards payout 400 error**  
Run the nullable constraint fix SQL in Step 3 Part 3.

**Rewards invoice reverts after save**  
This was a React state bug (fixed in current code). If it recurs, check that `RewardDetailPanel` uses `initialLoading` not `loading` to gate tab content rendering.

**"No unassigned videos" in video picker**  
Campaign has no `campaign_start_date`/`campaign_end_date` set, or no TikTok videos within that window.

**Calendar drag-drop not working**  
Check RLS policy on `campaign_deliverables` allows admin update.

**Alternating rows all same color**  
`App.css` needs: `tbody tr:nth-child(even) { background: var(--surface3); }`

**Month filter showing wrong month**  
Use `new Date(parseInt(y), parseInt(mo) - 1, 1)` not `new Date(m + '-01')`.

**`campaign_deliverables_with_stats` view errors after adding columns**  
Must DROP and CREATE the view (not CREATE OR REPLACE). The view uses `cd.*` which snapshots columns at creation time.
