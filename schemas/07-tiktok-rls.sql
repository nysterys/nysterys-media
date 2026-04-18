-- ============================================================
-- 07-tiktok-rls.sql
-- RLS policies for the Coupler.io-created TikTok tables.
-- Run AFTER Coupler.io has created the tables (after first sync).
-- Note: Coupler.io creates tables with RLS enabled by default
-- in Supabase, but without any policies, so nothing is readable.
-- ============================================================

-- Helper: apply RLS to all 12 Coupler.io tables
-- Admin sees all, creators see only their own username

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
    -- Enable RLS (may already be on)
    execute format('alter table public.%I enable row level security;', tbl);

    -- Drop existing policies to avoid conflicts
    execute format('drop policy if exists "admin_all" on public.%I;', tbl);
    execute format('drop policy if exists "creator_own" on public.%I;', tbl);

    -- Admin can read everything
    execute format(
      'create policy "admin_all" on public.%I for all using (public.get_my_role() = ''admin'');',
      tbl
    );

    -- Creators can read rows where account__username matches their linked TikTok account
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
