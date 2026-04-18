-- ============================================================
-- TikTok Analytics Views
-- Maps Coupler.io's actual column names to app-expected names
-- Run in Supabase SQL Editor
-- ============================================================

-- Already created — keeping for reference:
-- create or replace view public.tiktok_profile_insights_view as ...

-- ============================================================
-- Audience Gender
-- Coupler columns: account__username, audience__gender,
--   engagement____of_followers (percentage), engagement__total_followers
-- ============================================================
create or replace view public.tiktok_audience_gender_view as
select
  account__username                    as tiktok_username,
  audience__gender                     as gender,
  engagement____of_followers           as percentage,
  engagement__total_followers          as follower_count
from public.tiktok_audience_gender;

-- ============================================================
-- Audience Country
-- Coupler columns: account__username, audience__country,
--   engagement____of_followers (percentage), engagement__total_followers
-- ============================================================
create or replace view public.tiktok_audience_country_view as
select
  account__username                    as tiktok_username,
  audience__country                    as country,
  engagement____of_followers           as percentage,
  engagement__total_followers          as follower_count
from public.tiktok_audience_country;

-- ============================================================
-- Audience Hourly Activity
-- Coupler columns: account__username, report__date,
--   audience__activity_hour, engagement__followers_online,
--   engagement__total_followers
-- ============================================================
create or replace view public.tiktok_audience_hourly_view as
select
  account__username                    as tiktok_username,
  report__date                         as date,
  audience__activity_hour::int         as hour,
  engagement__followers_online         as activity_score
from public.tiktok_audience_hourly;

-- ============================================================
-- Video Countries
-- Coupler columns: video__video_id (first col visible),
--   video__caption, video__thumbnail_url, audience__country,
--   video____of_viewers, video__embed_url, video__share_url,
--   video__created_at, account__username
-- ============================================================
create or replace view public.tiktok_video_countries_view as
select
  account__username                    as tiktok_username,
  video__video_id                      as video_id,
  audience__country                    as country,
  video____of_viewers                  as percentage
from public.tiktok_video_countries;
