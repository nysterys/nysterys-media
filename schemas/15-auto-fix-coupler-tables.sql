-- ============================================================
-- 15-auto-fix-coupler-tables.sql
-- Creates a PostgreSQL event trigger that fires automatically
-- whenever any tiktok_* table is created (i.e. after Coupler
-- drops and recreates it). Reapplies RLS and refreshes views
-- without any manual intervention.
--
-- Run once in Supabase SQL Editor. Never needs to be run again.
-- ============================================================

-- ============================================================
-- The function that does the actual fixing
-- Called by the event trigger after every CREATE TABLE
-- ============================================================
create or replace function public.handle_coupler_table_recreation()
returns event_trigger
language plpgsql
security definer
as $$
declare
  obj record;
  tbl text;
  is_tiktok_table boolean := false;
begin
  -- Check if any of the newly created objects are tiktok_ tables
  for obj in select * from pg_event_trigger_ddl_commands()
  loop
    if obj.object_type = 'table' and obj.schema_name = 'public'
       and obj.object_identity like 'public.tiktok_%' then
      is_tiktok_table := true;
    end if;
  end loop;

  -- Only proceed if a tiktok_ table was involved
  if not is_tiktok_table then
    return;
  end if;

  -- Small delay to ensure Coupler has finished writing all tables
  -- before we try to recreate views that union multiple tables
  perform pg_sleep(0.1);

  -- --------------------------------------------------------
  -- Reapply RLS on all 12 raw tables (safe even if some
  -- don't exist yet — errors are caught per-table)
  -- --------------------------------------------------------
  declare
    tables text[] := array[
      'tiktok_profile_insights_kym', 'tiktok_profile_insights_mys',
      'tiktok_audience_gender_kym',  'tiktok_audience_gender_mys',
      'tiktok_audience_country_kym', 'tiktok_audience_country_mys',
      'tiktok_audience_hourly_kym',  'tiktok_audience_hourly_mys',
      'tiktok_video_insights_kym',   'tiktok_video_insights_mys',
      'tiktok_video_countries_kym',  'tiktok_video_countries_mys'
    ];
  begin
    foreach tbl in array tables loop
      begin
        execute format('alter table public.%I enable row level security;', tbl);
        execute format('drop policy if exists "admin_all" on public.%I;', tbl);
        execute format('drop policy if exists "creator_own" on public.%I;', tbl);
        execute format(
          'create policy "admin_all" on public.%I
           for all using (public.get_my_role() = ''admin'');',
          tbl
        );
        execute format(
          'create policy "creator_own" on public.%I
           for select using (
             exists (
               select 1 from public.tiktok_accounts ta
               where ta.tiktok_username = %I.account__username
                 and ta.profile_id = auth.uid()
             )
           );',
          tbl, tbl
        );
      exception when others then
        -- Table may not exist yet; skip silently
        null;
      end;
    end loop;
  end;

  -- --------------------------------------------------------
  -- Recreate views (they break when underlying tables are
  -- dropped and recreated by Coupler)
  -- Each view is wrapped in its own block so one failure
  -- does not abort the rest.
  -- --------------------------------------------------------

  -- Audience Gender
  begin
    execute $view$
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
    $view$;
    execute 'grant select on public.tiktok_audience_gender_view to authenticated;';
  exception when others then null;
  end;

  -- Audience Country
  begin
    execute $view$
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
    $view$;
    execute 'grant select on public.tiktok_audience_country_view to authenticated;';
  exception when others then null;
  end;

  -- Audience Hourly
  begin
    execute $view$
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
    $view$;
    execute 'grant select on public.tiktok_audience_hourly_view to authenticated;';
  exception when others then null;
  end;

  -- Video Insights
  begin
    execute $view$
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
          video__average_view_time, video__duration,
          video__views_at_100__rate, performance__reach,
          video__embed_url, video__share_url
        from public.tiktok_video_insights_mys
      ) t
      order by tiktok_username, video_id, create_time desc;
    $view$;
    execute 'grant select on public.tiktok_video_insights_view to authenticated;';
  exception when others then null;
  end;

  -- Video Countries
  begin
    execute $view$
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
    $view$;
    execute 'grant select on public.tiktok_video_countries_view to authenticated;';
  exception when others then null;
  end;

  -- Campaign deliverables with stats (depends on tiktok_video_insights_view)
  begin
    execute $view$
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
          then round(((tvi.total_like + tvi.total_comment + tvi.total_share)::numeric
               / tvi.total_play) * 100, 2)
          else null
        end as engagement_rate
      from public.campaign_deliverables cd
      left join public.tiktok_video_insights_view tvi
        on tvi.video_id = public.extract_tiktok_video_id(cd.post_url);
    $view$;
    execute 'grant select on public.campaign_deliverables_with_stats to authenticated;';
  exception when others then null;
  end;

end;
$$;

-- ============================================================
-- Create the event trigger
-- Fires on CREATE TABLE anywhere in the database
-- ============================================================
drop event trigger if exists coupler_table_recreation_trigger;

create event trigger coupler_table_recreation_trigger
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS')
  execute function public.handle_coupler_table_recreation();
