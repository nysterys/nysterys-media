# NYSTERYS MEDIA CREATOR HUB — FRESH INSTALL GUIDE
*Complete setup from zero. Follow every step in order.*

---

## PREREQUISITES

- Node.js 18+ and npm
- Git + GitHub access to `nysterys/nysterys-media`
- Supabase account with project already created
- Coupler.io account with TikTok connected
- GitHub Pages enabled on the repo (Settings → Pages → Deploy from branch `main`, folder `/hub`)

---

## STEP 1 — CLONE THE REPO

```bash
git clone https://github.com/nysterys/nysterys-media.git ~/Downloads/nysterys-media
cd ~/Downloads/nysterys-media
```

---

## STEP 2 — SUPABASE DATABASE SETUP

Go to **Supabase Dashboard → SQL Editor** and run `schemas/SCHEMA.sql` in two parts.

### Part 1: Core tables (run first)

Run everything in SCHEMA.sql from the top down through the section marked `-- PART 2 (run after first Coupler sync)`. This creates:
- All core tables (profiles, platforms, agencies, campaigns, etc.)
- All RLS policies
- All functions and triggers
- The `payment-receipts` and `campaign-files` storage references

### Part 2: Analytics views (run AFTER first Coupler sync)

After Coupler.io has done at least one sync (so the `tiktok_*_kym` and `tiktok_*_mys` tables exist), run the rest of SCHEMA.sql which creates:
- Union views (`tiktok_video_insights_view`, etc.)
- The `campaign_deliverables_with_stats` view
- The event trigger that auto-repairs views when Coupler Replace-mode syncs drop and recreate tables

### Rewards schema (run once after core setup)

If the rewards tables don't exist yet (they're at the bottom of SCHEMA.sql), run:

```sql
-- Check if already exists
select count(*) from information_schema.tables
where table_name = 'platform_rewards_programs';
```

If 0, run the PLATFORM REWARDS section at the bottom of SCHEMA.sql.

### Creator mark-complete policy

If not already in the schema, run:

```sql
create policy "Creators can mark own campaigns complete" on public.campaigns
  for update
  using (public.get_my_role() = 'creator' and creator_profile_id = auth.uid())
  with check (public.get_my_role() = 'creator' and creator_profile_id = auth.uid() and status = 'Completed');
```

---

## STEP 3 — SUPABASE AUTH SETTINGS

In **Supabase Dashboard → Authentication → Settings**:
- Disable public signups (invite only — users must be created manually)
- Minimum password length: 12
- Enable email confirmation
- Enable leaked password protection
- Set your site URL to: `https://nysterys.com/hub/`
- Add redirect URL: `https://nysterys.com/hub/`

---

## STEP 4 — SUPABASE STORAGE BUCKETS

In **Supabase Dashboard → Storage**, create two private buckets:

1. `payment-receipts` — Private
2. `campaign-files` — Private

No public access. The app generates signed URLs for viewing.

---

## STEP 5 — CREATE USERS

In **Supabase Dashboard → Authentication → Users**, create three users:

1. **Patrick (admin)**: email, strong password
2. **Kym (creator)**: email, strong password
3. **Mys (creator)**: email, strong password

Then in **SQL Editor**, set their roles and names in the `profiles` table:

```sql
-- Patrick
update public.profiles
set full_name = 'Patrick Nijsters', role = 'admin'
where email = 'patricks-email@example.com';

-- Kym
update public.profiles
set full_name = 'Kym', creator_name = 'Kym', role = 'creator'
where email = 'kyms-email@example.com';

-- Mys
update public.profiles
set full_name = 'Mys', creator_name = 'Mys', role = 'creator'
where email = 'mys-email@example.com';
```

---

## STEP 6 — SEED REFERENCE DATA

In **SQL Editor**, insert the base reference data:

```sql
-- Platforms
insert into public.platforms (name) values
  ('TikTok'), ('Instagram'), ('YouTube'), ('Facebook'), ('X/Twitter')
on conflict do nothing;

-- Deliverable types
insert into public.deliverable_types (name) values
  ('Post'), ('Story'), ('Reel'), ('Short'), ('Live'), ('Review'), ('UGC Video')
on conflict do nothing;

-- TikTok reward program (optional — can do via UI)
insert into public.platform_rewards_programs (name, payout_day, description)
select 'Creator Rewards', 15, 'TikTok Creator Rewards Program — pays 15th of following month'
where exists (select 1 from public.platforms where name = 'TikTok');
```

---

## STEP 7 — REGISTER TIKTOK ACCOUNTS

Via the admin UI (Setup → TikTok Accounts), or via SQL:

```sql
insert into public.tiktok_accounts (profile_id, tiktok_username, display_name, is_active)
values
  ((select id from profiles where creator_name = 'Kym'), 'kymchi_n_crackers', 'Kym', true),
  ((select id from profiles where creator_name = 'Mys'), 'mysthegreat', 'Mys', true);
```

---

## STEP 8 — COUPLER.IO SETUP

Configure 6 importers per creator (12 total). For each:

**Source:** TikTok Analytics
**Destination:** Supabase → your project → table name below

| Creator | Report Type | Table Name | Mode |
|---|---|---|---|
| Kym | Profile insights | `tiktok_profile_insights_kym` | Append |
| Kym | Audience genders | `tiktok_audience_gender_kym` | Replace |
| Kym | Audience countries | `tiktok_audience_country_kym` | Replace |
| Kym | Audience hourly | `tiktok_audience_hourly_kym` | Append |
| Kym | Video insights | `tiktok_video_insights_kym` | Append |
| Kym | Video countries | `tiktok_video_countries_kym` | Replace |
| Mys | Profile insights | `tiktok_profile_insights_mys` | Append |
| ... | ... | ... | ... |

**CRITICAL — In the Coupler transform step for each importer:**
Add a static column named `account__username` with the creator's handle (no @):
- Kym: `kymchi_n_crackers`
- Mys: `mysthegreat`

Run the first sync for all 12 importers. Then run Part 2 of SCHEMA.sql (see Step 2).

---

## STEP 9 — REACT APP SETUP

```bash
cd ~/Downloads/nysterys-media/hub-src
npm install
```

Create the environment file (NEVER commit this):

```bash
cp .env.example .env.production
```

Edit `.env.production`:

```
REACT_APP_SUPABASE_URL=https://rnntuxabccnphfvvvaks.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_uTUIIpWaYYgke_5rtyhUnw_0lMfHI3c
```

Test locally:

```bash
npm start
# Opens http://localhost:3000 — login with Patrick's credentials
```

---

## STEP 10 — DEPLOY TO GITHUB PAGES

```bash
cd ~/Downloads/nysterys-media
cd hub-src && npm run build && cd ..
cp hub-src/build/index.html hub/index.html
cp hub-src/build/asset-manifest.json hub/asset-manifest.json
rm -rf hub/static && cp -r hub-src/build/static hub/static
git add -A
git commit -m "Initial deploy"
git push
```

Wait 1-2 minutes for GitHub Pages to update. Verify at: `https://nysterys.com/hub/`

---

## STEP 11 — PAYMENT DESTINATIONS

Via admin UI (Setup → Payment Destinations), add the bank/investment accounts for each creator that payouts will be split to. For example:
- Chase Savings Mys (Savings, last 4: 0099)
- Vanguard UTMA Mys (UTMA, last 4: 9875)

Use `account_type = 'Other'` for non-standard destinations — the `memo` field will show in the UI.

---

## VERIFICATION CHECKLIST

- [ ] Can log in as Patrick (admin) — sees admin dashboard
- [ ] Can log in as Kym/Mys (creator) — sees creator dashboard
- [ ] Admin can create a campaign
- [ ] Campaign name auto-generates when creator + agency selected
- [ ] TikTok analytics appear in Analytics view
- [ ] Calendar shows deliverables correctly
- [ ] Payments view shows existing campaigns
- [ ] Rewards view accessible (★ in sidebar)
- [ ] Creator can submit draft and link video
- [ ] Creator can mark campaign complete (all deliverables posted)
- [ ] Mobile: sidebar collapses to bottom nav on iPhone

---

## ONGOING OPERATIONS

### Adding a new campaign
1. Admin → Campaigns → + New Campaign
2. Select creator + agency (name auto-generates)
3. Fill brand name, rate, dates
4. Add deliverables (platform, type, contracted date)
5. Save — invoice record auto-created

### Recording agency payment received
1. Admin → Payments → click campaign row
2. Invoice tab → fill amount received, check "Money cleared", record processing fee
3. Save Invoice

### Paying out to creator
1. Admin → Payments → click campaign row
2. Payout tab → set amount, configure destination splits with %, set status as Sent/Cleared with dates

### Recording TikTok rewards
1. Admin → Rewards → + Add Entry
2. Select program (TikTok Creator Rewards), creator, period month, gross amount
3. After saving → click row → Invoice tab (record when TikTok paid you) → Payout tab (record when you paid creator)

### Rescheduling a deliverable
Admin → Calendar → drag the deliverable chip to the new date. Only unposted deliverables are draggable.

---

## TROUBLESHOOTING

**Login fails / redirect loop**
Check Supabase Auth redirect URLs include `https://nysterys.com/hub/`.

**Analytics shows no data**
Coupler sync hasn't run, or run Part 2 of SCHEMA.sql after first sync.

**"No unassigned videos" in video picker**
Campaign has no `campaign_start_date`/`campaign_end_date` set, or no TikTok videos exist within that window.

**Calendar drag-drop not working**
Check that the RLS policy on `campaign_deliverables` allows admin update. It should — admins have full access via the `Admin can manage all campaigns` policy pattern.

**Alternating rows all same color**
`App.css` needs: `tbody tr:nth-child(even) { background: var(--surface3); }`

**Month filter showing wrong month**
Use `new Date(parseInt(y), parseInt(mo) - 1, 1)` not `new Date(m + '-01')`.
