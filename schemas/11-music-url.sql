-- ============================================================
-- 11-music-url.sql
-- Adds optional music URL to campaign deliverables.
-- Run in Supabase SQL Editor.
-- ============================================================

alter table public.campaign_deliverables
  add column if not exists music_url text;
