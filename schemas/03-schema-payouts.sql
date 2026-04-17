-- ============================================================
-- CREATOR HUB — Payout Schema Extension
-- Run this AFTER schema.sql (and schema_tiktok.sql if applicable)
-- ============================================================

-- ============================================================
-- EXTEND INVOICES TABLE
-- Add: amount_received (may differ from invoice_amount due to fees)
-- Add: you_received flag + date (money hit YOUR account)
-- Add: processing_fee (explains delta)
-- ============================================================
alter table public.invoices
  add column if not exists amount_received numeric(10,2),
  add column if not exists processing_fee numeric(10,2) default 0,
  add column if not exists you_received boolean default false,
  add column if not exists you_received_date date,
  add column if not exists you_received_notes text;

-- ============================================================
-- PAYMENT DESTINATIONS
-- Configured per creator. Reused across campaigns.
-- Examples: "Kym Savings", "Kym UTMA", "Mys Checking"
-- ============================================================
create table public.payment_destinations (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,

  name text not null,                -- "Savings", "UTMA", "Checking"
  account_type text not null check (account_type in (
    'Checking', 'Savings', 'UTMA', 'Investment', 'Other'
  )),
  account_last4 text,                -- last 4 digits for reference, never full number
  institution text,                  -- e.g. "Chase", "Fidelity"
  memo text,                         -- any additional routing note
  is_active boolean default true,
  sort_order int default 0,          -- display ordering

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.payment_destinations enable row level security;

create policy "Admin can manage all destinations" on public.payment_destinations
  for all using (public.get_my_role() = 'admin');

create policy "Creators can read own destinations" on public.payment_destinations
  for select using (profile_id = auth.uid());

create trigger handle_updated_at before update on public.payment_destinations
  for each row execute function public.handle_updated_at();

-- ============================================================
-- CREATOR PAYOUTS
-- One per campaign (not per invoice — campaigns always have one creator).
-- Tracks the aggregate payout YOU make to the creator.
-- ============================================================
create table public.creator_payouts (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null unique,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete set null,  -- the creator

  -- Amounts
  contracted_amount numeric(10,2),   -- what the deal said
  payout_amount numeric(10,2),       -- what you actually pay out (after any fees you absorb)
  payout_notes text,                 -- e.g. "Deducted $12 PayPal fee"

  -- Status
  payout_status text default 'Pending' check (payout_status in (
    'Pending', 'Partial', 'Paid', 'On Hold'
  )),
  payout_date date,                  -- date you initiated the payout

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.creator_payouts enable row level security;

create policy "Admin can manage all payouts" on public.creator_payouts
  for all using (public.get_my_role() = 'admin');

create policy "Creators can read own payouts" on public.creator_payouts
  for select using (profile_id = auth.uid());

create trigger handle_updated_at before update on public.creator_payouts
  for each row execute function public.handle_updated_at();

-- ============================================================
-- PAYOUT SPLITS
-- Children of creator_payouts. One row per destination.
-- Percentages must sum to 100 across all splits for a payout.
-- Each split is individually trackable.
-- ============================================================
create table public.payout_splits (
  id uuid default uuid_generate_v4() primary key,
  payout_id uuid references public.creator_payouts(id) on delete cascade not null,
  destination_id uuid references public.payment_destinations(id) on delete set null,

  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  amount numeric(10,2),              -- computed: payout_amount * percentage / 100

  -- Individual split tracking
  split_status text default 'Pending' check (split_status in (
    'Pending', 'Sent', 'Cleared', 'Failed'
  )),
  sent_date date,
  cleared_date date,
  reference text,                    -- transaction ID, check number, etc.
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.payout_splits enable row level security;

create policy "Admin can manage all splits" on public.payout_splits
  for all using (public.get_my_role() = 'admin');

create policy "Creators can read own splits" on public.payout_splits
  for select using (
    exists (
      select 1 from public.creator_payouts cp
      where cp.id = payout_id and cp.profile_id = auth.uid()
    )
  );

create trigger handle_updated_at before update on public.payout_splits
  for each row execute function public.handle_updated_at();

-- ============================================================
-- CONVENIENCE VIEW: Full payout picture per campaign
-- Used by both admin and creator views
-- ============================================================
create or replace view public.campaign_payout_summary as
select
  c.id as campaign_id,
  c.campaign_name,
  c.brand_name,
  c.contracted_rate,
  c.creator_profile_id,
  pr.creator_name,
  pr.full_name as creator_full_name,
  ag.name as agency_name,

  -- Invoice (agency → Patrick)
  inv.id as invoice_id,
  inv.invoice_number,
  inv.invoice_date,
  inv.invoice_amount,
  inv.payment_status as agency_payment_status,
  inv.payment_received_date as agency_paid_date,
  inv.amount_received,
  inv.processing_fee,
  inv.you_received,
  inv.you_received_date,

  -- Payout (Patrick → creator)
  po.id as payout_id,
  po.payout_amount,
  po.payout_status,
  po.payout_date,
  po.payout_notes,

  -- Split count and cleared count
  (select count(*) from public.payout_splits ps where ps.payout_id = po.id) as split_count,
  (select count(*) from public.payout_splits ps where ps.payout_id = po.id and ps.split_status = 'Cleared') as splits_cleared

from public.campaigns c
left join public.profiles pr on pr.id = c.creator_profile_id
left join public.agencies ag on ag.id = c.agency_id
left join public.invoices inv on inv.campaign_id = c.id
left join public.creator_payouts po on po.campaign_id = c.id;

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_payment_destinations_profile
  on public.payment_destinations(profile_id);

create index if not exists idx_creator_payouts_profile
  on public.creator_payouts(profile_id);

create index if not exists idx_creator_payouts_invoice
  on public.creator_payouts(invoice_id);

create index if not exists idx_payout_splits_payout
  on public.payout_splits(payout_id);

create index if not exists idx_payout_splits_destination
  on public.payout_splits(destination_id);
