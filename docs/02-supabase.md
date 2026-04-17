# 02 — Supabase Reference

Complete reference for the database, auth configuration, and ongoing administration.

---

## Connection details

Find these in Supabase Dashboard → **Settings** → **API**:

| Item | Where to find it |
|------|-----------------|
| Project URL | Settings → API → Project URL |
| Anon / public key | Settings → API → Project API keys → anon public |
| Service role key | Settings → API → Project API keys → service_role |
| Database host | Settings → Database → Connection string |
| Database password | Set during project creation |

> **The anon key is safe to use in the browser.** It is not a secret — Supabase's Row Level Security (RLS) controls what it can access. Anyone with the anon key can only do what an unauthenticated user is allowed to do, which with your policies is nothing.
>
> **The service_role key bypasses RLS entirely.** Never put it in the app. Use it only in Coupler.io's PostgreSQL connection (which runs server-side).

---

## Database schema overview

Four schemas, run in order:

### `01-schema.sql` — Core
Creates: `profiles`, `platforms`, `deliverable_types`, `agencies`, `campaigns`, `campaign_deliverables`, `revision_rounds`, `invoices`, `comments`

Seeds: Default platforms (TikTok, Instagram, YouTube, X, Facebook) and deliverable types (Post, Story, Reel/Short, Live, Bundle)

### `02-schema-tiktok.sql` — TikTok Analytics
Creates: `tiktok_accounts`, `tiktok_profile_insights`, `tiktok_audience_gender`, `tiktok_audience_country`, `tiktok_audience_hourly`, `tiktok_video_insights`, `tiktok_video_countries`

Also creates: `campaign_deliverables_with_stats` view (auto-joins campaign posts to TikTok video data via video ID extracted from post URL)

### `03-schema-payouts.sql` — Payments
Extends: `invoices` table (adds `you_received`, `amount_received`, `processing_fee` columns)

Creates: `payment_destinations`, `creator_payouts`, `payout_splits`, `campaign_payout_summary` view

### `04-schema-security.sql` — Security Hardening
Fixes: RLS column ambiguity bugs in TikTok tables, role escalation vulnerability in profiles, payout summary view security

Creates: `audit_log` table (append-only, admin-readable)

---

## Row Level Security model

Every table has RLS enabled. The enforcement logic:

```
Admin (role = 'admin')  → can read and write everything
Creator (role = 'creator') → can only read/write their own data
Anonymous (not logged in) → can access nothing
```

The `get_my_role()` function determines the current user's role by querying the `profiles` table. It defaults to `'anonymous'` if no profile exists, preventing any edge-case access.

---

## Auth configuration checklist

These settings live in Supabase Dashboard → **Authentication** → **Settings**:

| Setting | Required value |
|---------|---------------|
| Enable sign ups | OFF |
| Confirm email | ON |
| Minimum password length | 12 |
| Leaked password protection | ON |
| Secure email change | ON |
| Site URL | `https://nysterys.com/hub/` |
| Redirect URLs | `https://nysterys.com/hub/` |

These settings under **Authentication → URL Configuration**:

| Setting | Required value |
|---------|---------------|
| Site URL | `https://nysterys.com/hub/` |
| Redirect URLs | `https://nysterys.com/hub/` |

> The standalone "Allowed Origins" CORS field was removed from the Supabase dashboard. CORS is now handled automatically for authenticated requests, which covers all usage in this app.

---

## Managing users

**Inviting a new user:**
1. Authentication → Users → Invite User
2. Enter their email
3. They receive an invite email with a link to set their password
4. After they sign in once, go to Table Editor → profiles
5. Set their `role` and `creator_name`

**Removing a user:**
1. Authentication → Users → find the user → Delete
2. Their profile row cascades automatically (foreign key cascade)
3. Their campaigns remain but `creator_profile_id` is set to null

**Resetting a password:**
- Users can self-serve via the "Forgot password?" link on the login page
- Or: Authentication → Users → find user → Send Password Reset

**Changing a user's role:**
- Table Editor → profiles → find row → edit `role` field
- Valid values: `admin`, `creator`
- Never edit the `role` field in the app — use the Supabase dashboard for this

---

## Audit log

The `audit_log` table records sensitive operations. It is append-only (no update or delete policies exist by design).

To review recent activity:
```sql
select actor_email, action, table_name, created_at
from public.audit_log
order by created_at desc
limit 50;
```

Currently the audit log captures login/logout events via the Supabase Auth hooks. Application-level audit entries (invoice updates, payout changes) can be added to individual components by inserting a row to `audit_log` after any write operation.

---

## Coupler.io PostgreSQL connection

When configuring Coupler.io to write TikTok data into Supabase, use these connection settings:

| Field | Value |
|-------|-------|
| Host | `db.YOUR-PROJECT-ID.supabase.co` |
| Port | `5432` |
| Database | `postgres` |
| Username | `postgres` |
| Password | Your **service_role** key (not your database password) |
| SSL | Required / Enabled |

Find your project ID in the Project URL: `https://PROJECT-ID.supabase.co`

---

## Useful SQL queries

**Check which creators have TikTok accounts linked:**
```sql
select p.creator_name, ta.tiktok_username, ta.is_active
from public.tiktok_accounts ta
join public.profiles p on p.id = ta.profile_id;
```

**Campaign payment status summary:**
```sql
select campaign_name, creator_name, agency_payment_status,
       you_received, payout_status
from public.campaign_payout_summary
order by invoice_date desc;
```

**All active campaigns:**
```sql
select c.campaign_name, c.brand_name, p.creator_name, c.status
from public.campaigns c
join public.profiles p on p.id = c.creator_profile_id
where c.status in ('Confirmed', 'Active')
order by c.campaign_start_date;
```

**Check payout splits pending clearance:**
```sql
select c.campaign_name, pd.name as destination,
       ps.amount, ps.split_status, ps.sent_date
from public.payout_splits ps
join public.creator_payouts po on po.id = ps.payout_id
join public.campaigns c on c.id = po.campaign_id
join public.payment_destinations pd on pd.id = ps.destination_id
where ps.split_status in ('Pending', 'Sent')
order by ps.created_at;
```
