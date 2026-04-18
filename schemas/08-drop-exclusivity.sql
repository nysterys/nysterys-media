-- ============================================================
-- 08-drop-exclusivity.sql
-- Removes exclusivity period columns from campaigns table.
-- Run in Supabase SQL Editor.
-- ============================================================

alter table public.campaigns
  drop column if exists exclusivity_start,
  drop column if exists exclusivity_end;
