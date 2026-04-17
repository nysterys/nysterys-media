-- ============================================================
-- CREATOR HUB — TikTok Analytics Schema Extension
-- Run this AFTER the original schema.sql
-- ============================================================

-- ============================================================
-- TIKTOK ACCOUNTS
-- Maps each creator profile to their TikTok username
-- Used to filter Coupler.io data per creator
-- ============================================================
create table public.tiktok_accounts (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null unique,
  tiktok_username text not null,  -- e.g. 'mysthegreat' (no @)
  display_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tiktok_accounts enable row level security;

create policy "Admin can manage tiktok accounts" on public.tiktok_accounts
  for all using (public.get_my_role() = 'admin');

create policy "Creators can read own tiktok account" on public.tiktok_accounts
  for select using (profile_id = auth.uid());

-- ============================================================
-- TIKTOK PROFILE INSIGHTS
-- Coupler.io: Report type "Profile insights"
-- Daily profile-level stats — one row per account per day
-- Coupler.io columns (map these in transform step):
--   date, video_views, profile_views, likes, comments,
--   shares, followers_count, net_followers
-- Add a static column: tiktok_username
-- ============================================================
create table public.tiktok_profile_insights (
  id uuid default uuid_generate_v4() primary key,
  tiktok_username text not null,
  date date not null,
  video_views bigint default 0,
  profile_views bigint default 0,
  likes bigint default 0,
  comments bigint default 0,
  shares bigint default 0,
  followers_count bigint default 0,
  net_followers int default 0,
  synced_at timestamptz default now(),
  unique(tiktok_username, date)
);

alter table public.tiktok_profile_insights enable row level security;

create policy "Admin can read all profile insights" on public.tiktok_profile_insights
  for all using (public.get_my_role() = 'admin');

create policy "Creators read own profile insights" on public.tiktok_profile_insights
  for select using (
    exists (
      select 1 from public.tiktok_accounts ta
      where ta.tiktok_username = tiktok_username
      and ta.profile_id = auth.uid()
    )
  );

-- Allow Coupler.io service role to upsert (done via Supabase service key in Coupler config)
create policy "Service role full access profile insights" on public.tiktok_profile_insights
  for all using (auth.role() = 'service_role');

-- ============================================================
-- TIKTOK AUDIENCE GENDER
-- Coupler.io: Report type "Profile audience genders"
-- Columns: tiktok_username, date, gender, percentage
-- ============================================================
create table public.tiktok_audience_gender (
  id uuid default uuid_generate_v4() primary key,
  tiktok_username text not null,
  date date not null,
  gender text not null,        -- 'Male', 'Female', 'Unknown'
  percentage numeric(5,2),
  synced_at timestamptz default now(),
  unique(tiktok_username, date, gender)
);

alter table public.tiktok_audience_gender enable row level security;
create policy "Admin full access gender" on public.tiktok_audience_gender for all using (public.get_my_role() = 'admin');
create policy "Creators read own gender" on public.tiktok_audience_gender for select using (exists (select 1 from public.tiktok_accounts ta where ta.tiktok_username = tiktok_username and ta.profile_id = auth.uid()));
create policy "Service role gender" on public.tiktok_audience_gender for all using (auth.role() = 'service_role');

-- ============================================================
-- TIKTOK AUDIENCE COUNTRY
-- Coupler.io: Report type "Profile audience countries"
-- Columns: tiktok_username, date, country, percentage
-- ============================================================
create table public.tiktok_audience_country (
  id uuid default uuid_generate_v4() primary key,
  tiktok_username text not null,
  date date not null,
  country text not null,
  country_code text,
  percentage numeric(5,2),
  follower_count bigint,
  synced_at timestamptz default now(),
  unique(tiktok_username, date, country)
);

alter table public.tiktok_audience_country enable row level security;
create policy "Admin full access country" on public.tiktok_audience_country for all using (public.get_my_role() = 'admin');
create policy "Creators read own country" on public.tiktok_audience_country for select using (exists (select 1 from public.tiktok_accounts ta where ta.tiktok_username = tiktok_username and ta.profile_id = auth.uid()));
create policy "Service role country" on public.tiktok_audience_country for all using (auth.role() = 'service_role');

-- ============================================================
-- TIKTOK AUDIENCE HOURLY ACTIVITY
-- Coupler.io: Report type "Profile audience hourly activity"
-- Columns: tiktok_username, date, hour (0-23), activity_score
-- ============================================================
create table public.tiktok_audience_hourly (
  id uuid default uuid_generate_v4() primary key,
  tiktok_username text not null,
  date date not null,
  hour int not null check (hour >= 0 and hour <= 23),
  activity_score numeric(10,4),
  synced_at timestamptz default now(),
  unique(tiktok_username, date, hour)
);

alter table public.tiktok_audience_hourly enable row level security;
create policy "Admin full access hourly" on public.tiktok_audience_hourly for all using (public.get_my_role() = 'admin');
create policy "Creators read own hourly" on public.tiktok_audience_hourly for select using (exists (select 1 from public.tiktok_accounts ta where ta.tiktok_username = tiktok_username and ta.profile_id = auth.uid()));
create policy "Service role hourly" on public.tiktok_audience_hourly for all using (auth.role() = 'service_role');

-- ============================================================
-- TIKTOK VIDEO INSIGHTS
-- Coupler.io: Report type "Video list insights"
-- Lifetime per-video stats. No date filter (TikTok API limitation).
-- THE KEY JOIN TABLE: joined to campaign_deliverables via video_id
-- Coupler.io columns to map:
--   video_id, video_title, cover_image_url, create_time,
--   total_play, total_like, total_comment, total_share,
--   total_download, average_time_watched, video_duration,
--   full_video_watched_rate, reach, impressions
-- Add static column: tiktok_username
-- ============================================================
create table public.tiktok_video_insights (
  id uuid default uuid_generate_v4() primary key,
  tiktok_username text not null,
  video_id text not null,           -- TikTok video ID (last segment of URL)
  video_title text,
  cover_image_url text,
  create_time timestamptz,
  
  -- Core engagement
  total_play bigint default 0,      -- views
  total_like bigint default 0,
  total_comment bigint default 0,
  total_share bigint default 0,
  total_download bigint default 0,
  
  -- Watch metrics
  average_time_watched numeric(10,2),   -- seconds
  video_duration numeric(10,2),          -- seconds
  full_video_watched_rate numeric(7,4),  -- 0.0 to 1.0
  
  -- Reach
  reach bigint default 0,
  impressions bigint default 0,
  
  synced_at timestamptz default now(),
  unique(tiktok_username, video_id)
);

alter table public.tiktok_video_insights enable row level security;
create policy "Admin full access video insights" on public.tiktok_video_insights for all using (public.get_my_role() = 'admin');
create policy "Creators read own video insights" on public.tiktok_video_insights for select using (exists (select 1 from public.tiktok_accounts ta where ta.tiktok_username = tiktok_username and ta.profile_id = auth.uid()));
create policy "Service role video insights" on public.tiktok_video_insights for all using (auth.role() = 'service_role');

-- ============================================================
-- TIKTOK VIDEO TOP COUNTRIES
-- Coupler.io: Report type "Video list top countries"
-- Columns: tiktok_username, video_id, country, play_count, like_count
-- ============================================================
create table public.tiktok_video_countries (
  id uuid default uuid_generate_v4() primary key,
  tiktok_username text not null,
  video_id text not null,
  country text not null,
  country_code text,
  play_count bigint default 0,
  like_count bigint default 0,
  synced_at timestamptz default now(),
  unique(tiktok_username, video_id, country)
);

alter table public.tiktok_video_countries enable row level security;
create policy "Admin full access video countries" on public.tiktok_video_countries for all using (public.get_my_role() = 'admin');
create policy "Creators read own video countries" on public.tiktok_video_countries for select using (exists (select 1 from public.tiktok_accounts ta where ta.tiktok_username = tiktok_username and ta.profile_id = auth.uid()));
create policy "Service role video countries" on public.tiktok_video_countries for all using (auth.role() = 'service_role');

-- ============================================================
-- HELPER FUNCTION: Extract TikTok video ID from URL
-- Handles formats:
--   https://www.tiktok.com/@username/video/1234567890
--   https://vm.tiktok.com/SHORTCODE/
-- ============================================================
create or replace function public.extract_tiktok_video_id(url text)
returns text as $$
declare
  matches text[];
begin
  if url is null then return null; end if;
  -- Match /video/DIGITS pattern
  matches := regexp_match(url, '/video/([0-9]+)');
  if matches is not null then
    return matches[1];
  end if;
  return null;
end;
$$ language plpgsql immutable;

-- ============================================================
-- CONVENIENCE VIEW: Campaign deliverables with TikTok stats
-- Joins campaign_deliverables to tiktok_video_insights
-- via video ID extracted from post_url
-- ============================================================
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
  tvi.total_download as downloads,
  tvi.average_time_watched,
  tvi.video_duration,
  tvi.full_video_watched_rate,
  tvi.reach,
  tvi.impressions,
  tvi.synced_at as stats_last_synced,
  -- Computed engagement rate: (likes + comments + shares) / views
  case
    when tvi.total_play > 0
    then round(((tvi.total_like + tvi.total_comment + tvi.total_share)::numeric / tvi.total_play) * 100, 2)
    else null
  end as engagement_rate
from public.campaign_deliverables cd
left join public.tiktok_video_insights tvi
  on tvi.video_id = public.extract_tiktok_video_id(cd.post_url);

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index if not exists idx_tiktok_profile_insights_username_date
  on public.tiktok_profile_insights(tiktok_username, date desc);

create index if not exists idx_tiktok_video_insights_username
  on public.tiktok_video_insights(tiktok_username);

create index if not exists idx_tiktok_video_insights_video_id
  on public.tiktok_video_insights(video_id);

create index if not exists idx_tiktok_audience_gender_username_date
  on public.tiktok_audience_gender(tiktok_username, date desc);

create index if not exists idx_tiktok_audience_country_username_date
  on public.tiktok_audience_country(tiktok_username, date desc);

create index if not exists idx_tiktok_audience_hourly_username_date
  on public.tiktok_audience_hourly(tiktok_username, date desc);

-- Updated_at trigger for tiktok_accounts
create trigger handle_updated_at before update on public.tiktok_accounts
  for each row execute function public.handle_updated_at();
