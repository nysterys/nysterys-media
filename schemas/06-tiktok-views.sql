-- ============================================================
-- 06-tiktok-views.sql
-- Run AFTER Coupler.io has synced data at least once for both
-- creators. These views map Coupler.io's column naming to what
-- the app expects, and union Kym and Mys tables together.
-- ============================================================

-- Profile Insights (Append — dedup by date)
create or replace view public.tiktok_profile_insights_view as
select distinct on (tiktok_username, date) * from (
  select account__username as tiktok_username, report__date as date,
    engagement__total_followers as followers_count,
    engagement__followers_count_on_date as net_followers,
    engagement__likes as likes, engagement__shares as shares,
    engagement__profile_views as profile_views,
    engagement__video_views as video_views,
    engagement__comments as comments
  from public.tiktok_profile_insights_kym
  union all
  select account__username, report__date,
    engagement__total_followers, engagement__followers_count_on_date,
    engagement__likes, engagement__shares, engagement__profile_views,
    engagement__video_views, engagement__comments
  from public.tiktok_profile_insights_mys
) t
order by tiktok_username, date;

-- Audience Gender (Replace — no dedup needed)
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

-- Audience Country (Replace — no dedup needed)
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

-- Audience Hourly (Append — dedup by date + hour)
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

-- Video Insights (Append — dedup by video_id, keep most recent)
create or replace view public.tiktok_video_insights_view as
select distinct on (tiktok_username, video_id) * from (
  select account__username as tiktok_username,
    video__video_id as video_id,
    video__caption as video_title,
    video__thumbnail_url as cover_image_url,
    video__created_at as create_time,
    video__views as total_play,
    engagement__likes as total_like,
    engagement__comments as total_comment,
    engagement__shares as total_share,
    video__average_view_time as average_time_watched,
    video__duration as video_duration,
    video__views_at_100__rate as full_video_watched_rate,
    performance__reach as reach,
    video__embed_url as embed_url,
    video__share_url as share_url
  from public.tiktok_video_insights_kym
  union all
  select account__username, video__video_id, video__caption,
    video__thumbnail_url, video__created_at, video__views,
    engagement__likes, engagement__comments, engagement__shares,
    video__average_view_time, video__duration, video__views_at_100__rate,
    performance__reach, video__embed_url, video__share_url
  from public.tiktok_video_insights_mys
) t
order by tiktok_username, video_id, create_time desc;

-- Video Countries (Replace — no dedup needed)
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

-- Grant read access to authenticated users
grant select on public.tiktok_profile_insights_view to authenticated;
grant select on public.tiktok_audience_gender_view to authenticated;
grant select on public.tiktok_audience_country_view to authenticated;
grant select on public.tiktok_audience_hourly_view to authenticated;
grant select on public.tiktok_video_insights_view to authenticated;
grant select on public.tiktok_video_countries_view to authenticated;

-- Campaign deliverables with TikTok stats
-- Requires extract_tiktok_video_id() function from schema 02
create or replace view public.campaign_deliverables_with_stats as
select
  cd.*,
  tvi.video_id,
  tvi.video_title,
  tvi.cover_image_url,
  tvi.create_time as tiktok_publish_time,
  tvi.total_play as views,
  tvi.total_like as likes,
  tvi.total_comment as comments,
  tvi.total_share as shares,
  tvi.average_time_watched,
  tvi.video_duration,
  tvi.full_video_watched_rate,
  tvi.reach,
  case
    when tvi.total_play > 0
    then round(((tvi.total_like + tvi.total_comment + tvi.total_share)::numeric / tvi.total_play) * 100, 2)
    else null
  end as engagement_rate
from public.campaign_deliverables cd
left join public.tiktok_video_insights_view tvi
  on tvi.video_id = public.extract_tiktok_video_id(cd.post_url);

grant select on public.campaign_deliverables_with_stats to authenticated;
