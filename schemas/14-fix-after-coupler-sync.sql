-- ============================================================
-- 14-fix-after-coupler-sync.sql
-- Run this after EVERY Coupler.io Replace-mode sync.
-- Coupler drops and recreates tables, which:
--   1. Wipes all RLS policies on those tables
--   2. Invalidates views that reference those tables
-- This script fixes both problems.
--
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- ============================================================
-- STEP 1: Recreate views (they break when Coupler drops tables)
-- ============================================================

-- Audience Gender view
create or replace view public.tiktok_audience_gender_view as
select account__username as tiktok_username,
  audience__gender as gender,
  engagement____of_followers as percentage,
  engagement__total_followers as follower_count
from public.tiktok_audience_gender_kym
union all
select account__username, audience__gender,
  engagement____of_followers, engagement__total_followers
from public.tiktok_audience_gender_mys;

-- Audience Country view
create or replace view public.tiktok_audience_country_view as
select account__username as tiktok_username,
  audience__country as country,
  engagement____of_followers as percentage,
  engagement__total_followers as follower_count
from public.tiktok_audience_country_kym
union all
select account__username, audience__country,
  engagement____of_followers, engagement__total_followers
from public.tiktok_audience_country_mys;

-- Audience Hourly view
create or replace view public.tiktok_audience_hourly_view as
select distinct on (tiktok_username, date, hour) * from (
  select account__username as tiktok_username,
    report__date as date,
    audience__activity_hour::int as hour,
    engagement__followers_online as activity_score
  from public.tiktok_audience_hourly_kym
  union all
  select account__username, report__date,
    audience__activity_hour::int,
    engagement__followers_online
  from public.tiktok_audience_hourly_mys
) t
order by tiktok_username, date, hour;

-- Video Countries view
create or replace view public.tiktok_video_countries_view as
select account__username as tiktok_username,
  video__video_id as video_id,
  audience__country as country,
  video____of_viewers as percentage
from public.tiktok_video_countries_kym
union all
select account__username, video__video_id,
  audience__country, video____of_viewers
from public.tiktok_video_countries_mys;

-- Regrant access to authenticated users
grant select on public.tiktok_audience_gender_view to authenticated;
grant select on public.tiktok_audience_country_view to authenticated;
grant select on public.tiktok_audience_hourly_view to authenticated;
grant select on public.tiktok_video_countries_view to authenticated;

-- ============================================================
-- STEP 2: Reapply RLS policies on all 12 raw tables
-- ============================================================

do $$
declare
  tbl text;
  tables text[] := array[
    'tiktok_profile_insights_kym', 'tiktok_profile_insights_mys',
    'tiktok_audience_gender_kym', 'tiktok_audience_gender_mys',
    'tiktok_audience_country_kym', 'tiktok_audience_country_mys',
    'tiktok_audience_hourly_kym', 'tiktok_audience_hourly_mys',
    'tiktok_video_insights_kym', 'tiktok_video_insights_mys',
    'tiktok_video_countries_kym', 'tiktok_video_countries_mys'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table public.%I enable row level security;', tbl);
    execute format('drop policy if exists "admin_all" on public.%I;', tbl);
    execute format('drop policy if exists "creator_own" on public.%I;', tbl);
    execute format(
      'create policy "admin_all" on public.%I for all using (public.get_my_role() = ''admin'');',
      tbl
    );
    execute format(
      'create policy "creator_own" on public.%I for select using (
        exists (
          select 1 from public.tiktok_accounts ta
          where ta.tiktok_username = %I.account__username
            and ta.profile_id = auth.uid()
        )
      );',
      tbl, tbl
    );
  end loop;
end $$;
