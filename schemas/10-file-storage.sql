-- ============================================================
-- 10-file-storage.sql
-- Adds payment receipt tracking to invoices and a campaign_files
-- table for arbitrary campaign documents.
-- Run in Supabase SQL Editor AFTER creating the two storage buckets.
-- ============================================================

-- 1. Receipt path on invoices (one file per invoice)
alter table public.invoices
  add column if not exists receipt_path text,      -- storage path: receipts/{invoice_id}/{filename}
  add column if not exists receipt_name text;      -- original filename for display

-- 2. Campaign files table (multiple files per campaign)
create table if not exists public.campaign_files (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,          -- original filename
  file_path text not null,          -- storage path: campaign-files/{campaign_id}/{uuid_filename}
  file_size bigint,                 -- bytes
  file_type text,                   -- MIME type
  created_at timestamptz default now()
);

-- RLS
alter table public.campaign_files enable row level security;

create policy "Admin can manage all campaign files" on public.campaign_files
  for all using (public.get_my_role() = 'admin');

create policy "Creators can see own campaign files" on public.campaign_files
  for select using (
    public.get_my_role() = 'creator' and
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.creator_profile_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE BUCKETS — run these separately in Supabase Dashboard
-- Storage > New bucket:
--   Name: payment-receipts   Private: YES
--   Name: campaign-files     Private: YES
--
-- Then add these RLS policies to each bucket in
-- Storage > Policies > payment-receipts / campaign-files:
--
-- INSERT: (auth.role() = 'authenticated')
-- SELECT: (auth.role() = 'authenticated')
-- DELETE: (auth.role() = 'authenticated')
-- ============================================================
