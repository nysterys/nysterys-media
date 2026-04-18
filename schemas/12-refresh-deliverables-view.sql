-- ============================================================
-- 12-refresh-deliverables-view.sql
-- Drops and recreates campaign_deliverables_with_stats so it
-- picks up the music_url column added in migration 11.
--
-- Must DROP first because CREATE OR REPLACE cannot change the
-- column order when new columns were added to the base table.
-- ============================================================

drop view if exists public.campaign_deliverables_with_stats;

create view public.campaign_deliverables_with_stats as
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
