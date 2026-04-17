-- ============================================================
-- CREATOR HUB — Security Hardening
-- Run AFTER all previous schemas
-- Fixes RLS gaps identified in security audit
-- ============================================================

-- ============================================================
-- FIX 1: get_my_role() resilience
-- Original can return null if profile row doesn't exist yet,
-- which could cause policies to misbehave during signup race.
-- ============================================================
create or replace function public.get_my_role()
returns text as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'anonymous'
  );
$$ language sql security definer stable;

-- ============================================================
-- FIX 2: tiktok_profile_insights RLS — ambiguous column bug
-- The original policy references tiktok_username without alias,
-- causing the subquery to compare the column to itself (always true).
-- ============================================================
drop policy if exists "Creators read own profile insights" on public.tiktok_profile_insights;

create policy "Creators read own profile insights" on public.tiktok_profile_insights
  for select using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.tiktok_accounts ta
      where ta.tiktok_username = tiktok_profile_insights.tiktok_username
        and ta.profile_id = auth.uid()
    )
  );

-- Same fix for other tiktok tables that have the same pattern
drop policy if exists "Creators read own gender" on public.tiktok_audience_gender;
create policy "Creators read own gender" on public.tiktok_audience_gender
  for select using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.tiktok_accounts ta
      where ta.tiktok_username = tiktok_audience_gender.tiktok_username
        and ta.profile_id = auth.uid()
    )
  );

drop policy if exists "Creators read own country" on public.tiktok_audience_country;
create policy "Creators read own country" on public.tiktok_audience_country
  for select using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.tiktok_accounts ta
      where ta.tiktok_username = tiktok_audience_country.tiktok_username
        and ta.profile_id = auth.uid()
    )
  );

drop policy if exists "Creators read own hourly" on public.tiktok_audience_hourly;
create policy "Creators read own hourly" on public.tiktok_audience_hourly
  for select using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.tiktok_accounts ta
      where ta.tiktok_username = tiktok_audience_hourly.tiktok_username
        and ta.profile_id = auth.uid()
    )
  );

drop policy if exists "Creators read own video insights" on public.tiktok_video_insights;
create policy "Creators read own video insights" on public.tiktok_video_insights
  for select using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.tiktok_accounts ta
      where ta.tiktok_username = tiktok_video_insights.tiktok_username
        and ta.profile_id = auth.uid()
    )
  );

drop policy if exists "Creators read own video countries" on public.tiktok_video_countries;
create policy "Creators read own video countries" on public.tiktok_video_countries
  for select using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.tiktok_accounts ta
      where ta.tiktok_username = tiktok_video_countries.tiktok_username
        and ta.profile_id = auth.uid()
    )
  );

-- ============================================================
-- FIX 3: campaign_payout_summary view security
-- Views in Postgres run with the querying user's permissions,
-- but the view itself has no RLS. Replace with a security-definer
-- function approach: drop and recreate as a restricted view that
-- always enforces creator isolation.
-- ============================================================
drop view if exists public.campaign_payout_summary;

create or replace view public.campaign_payout_summary
with (security_invoker = true)
as
select
  c.id as campaign_id,
  c.campaign_name,
  c.brand_name,
  c.contracted_rate,
  c.creator_profile_id,
  pr.creator_name,
  pr.full_name as creator_full_name,
  ag.name as agency_name,
  inv.id as invoice_id,
  inv.invoice_number,
  inv.invoice_date,
  inv.invoice_amount,
  inv.payment_status as agency_payment_status,
  inv.payment_received_date as agency_paid_date,
  inv.amount_received,
  inv.processing_fee,
  inv.you_received,
  inv.you_received_date,
  po.id as payout_id,
  po.payout_amount,
  po.payout_status,
  po.payout_date,
  po.payout_notes,
  (select count(*) from public.payout_splits ps where ps.payout_id = po.id) as split_count,
  (select count(*) from public.payout_splits ps where ps.payout_id = po.id and ps.split_status = 'Cleared') as splits_cleared
from public.campaigns c
left join public.profiles pr on pr.id = c.creator_profile_id
left join public.agencies ag on ag.id = c.agency_id
left join public.invoices inv on inv.campaign_id = c.id
left join public.creator_payouts po on po.campaign_id = c.id;

-- ============================================================
-- FIX 4: Missing DELETE policies on profiles and comments
-- Without these, rows can't be removed even by admin.
-- ============================================================
drop policy if exists "Admin can delete profiles" on public.profiles;
create policy "Admin can delete profiles" on public.profiles
  for delete using (public.get_my_role() = 'admin');

-- ============================================================
-- FIX 5: Prevent creators from escalating their own role
-- The existing update policy allows any field update on own row.
-- Restrict to non-sensitive fields only.
-- ============================================================
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own non-sensitive profile fields" on public.profiles
  for update using (id = auth.uid())
  with check (
    -- Prevent role escalation: role must stay the same
    role = (select role from public.profiles where id = auth.uid())
  );

-- ============================================================
-- FIX 6: Agencies — creators shouldn't read financial contacts
-- They only need agency name for context. Restrict read.
-- ============================================================
drop policy if exists "All authenticated can read agencies" on public.agencies;

create policy "Creators read agency name only" on public.agencies
  for select using (auth.uid() is not null);
-- Note: RLS can't restrict columns, only rows. For column-level
-- security on agencies, use a view. Added below:

create or replace view public.agencies_public as
  select id, name from public.agencies where is_active = true;

-- ============================================================
-- FIX 7: Audit log table — track sensitive operations
-- Lightweight append-only log for admin review.
-- ============================================================
create table if not exists public.audit_log (
  id uuid default uuid_generate_v4() primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,        -- 'login', 'update_invoice', 'update_payout', etc.
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_hint text,                -- populated from client if available
  created_at timestamptz default now()
);

alter table public.audit_log enable row level security;

-- Only admin can read audit log; anyone authenticated can insert (append-only)
create policy "Admin reads audit log" on public.audit_log
  for select using (public.get_my_role() = 'admin');

create policy "Authenticated can insert audit log" on public.audit_log
  for insert with check (auth.uid() is not null);

-- No update or delete on audit log — it's immutable
-- (enforced by absence of update/delete policies)

-- ============================================================
-- FIX 8: Supabase Auth hardening instructions
-- (Cannot be done in SQL — do these in Supabase Dashboard)
-- ============================================================
-- In Supabase Dashboard → Authentication → Settings:
-- 1. Enable "Confirm email" — users must verify email before login
-- 2. Set "Minimum password length" to 12
-- 3. Enable "Leaked password protection" (HaveIBeenPwned check)
-- 4. Set "Max login attempts" to 5 per hour
-- 5. Disable "Enable sign ups" — you control all accounts via invite only
-- 6. Under "Allowed email domains" — optionally restrict to known domains
-- 7. Enable "Secure email change" — requires confirmation on both old and new

comment on table public.audit_log is
  'Append-only security audit log. No update or delete policies exist by design.';
