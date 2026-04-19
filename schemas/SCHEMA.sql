-- ============================================================
-- NYSTERYS MEDIA CREATOR HUB — COMPLETE DATABASE SCHEMA
-- Single file. Run once on a fresh Supabase project.
-- Last updated: April 2026
--
-- EXECUTION ORDER (all in one paste into Supabase SQL Editor):
--   1. Core tables + RLS + triggers
--   2. TikTok accounts table
--   3. Payout tables
--   4. Security hardening
--   5. Coupler.io views (run AFTER first Coupler sync)
--   6. Coupler auto-fix event trigger
--
-- IMPORTANT: Steps 1-4 run immediately on a fresh DB.
-- Step 5 (views) requires Coupler.io to have synced at least
-- once so the _kym and _mys tables exist. Run step 5 separately
-- after the first Coupler sync.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- HELPER FUNCTIONS (defined early — used in RLS policies)
-- ============================================================
create or replace function public.get_my_role()
returns text as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'anonymous'
  );
$$ language sql security definer stable;

create or replace function public.get_my_creator_name()
returns text as $$
  select creator_name from public.profiles where id = auth.uid();
$$ language sql security definer;

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'creator')),
  creator_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (id = auth.uid() or public.get_my_role() = 'admin');

create policy "Users can update own non-sensitive profile fields" on public.profiles
  for update using (id = auth.uid())
  with check (role = (select role from public.profiles where id = auth.uid()));

create policy "Admin can insert profiles" on public.profiles
  for insert with check (public.get_my_role() = 'admin');

create policy "Admin can delete profiles" on public.profiles
  for delete using (public.get_my_role() = 'admin');

create trigger handle_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'creator')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PLATFORMS (admin-managed)
-- ============================================================
create table public.platforms (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  icon_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.platforms enable row level security;

create policy "All authenticated can read platforms" on public.platforms
  for select using (auth.uid() is not null);

create policy "Admin can manage platforms" on public.platforms
  for all using (public.get_my_role() = 'admin');

insert into public.platforms (name) values
  ('TikTok'), ('Instagram'), ('YouTube'), ('X (Twitter)'), ('Facebook');

-- ============================================================
-- DELIVERABLE TYPES (admin-managed)
-- ============================================================
create table public.deliverable_types (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.deliverable_types enable row level security;

create policy "All authenticated can read deliverable types" on public.deliverable_types
  for select using (auth.uid() is not null);

create policy "Admin can manage deliverable types" on public.deliverable_types
  for all using (public.get_my_role() = 'admin');

insert into public.deliverable_types (name, description) values
  ('Post', 'Standard feed post'),
  ('Story', 'Ephemeral story content'),
  ('Reel / Short', 'Short-form video content'),
  ('Live', 'Live stream session'),
  ('Bundle', 'Multi-format package deal');

-- ============================================================
-- AGENCIES / LABELS
-- ============================================================
create table public.agencies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  contact_name text,
  email text,
  phone text,
  payment_terms text default 'Net 30',
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.agencies enable row level security;

create policy "Authenticated can read agencies" on public.agencies
  for select using (auth.uid() is not null);

create policy "Admin can manage agencies" on public.agencies
  for all using (public.get_my_role() = 'admin');

create trigger handle_updated_at before update on public.agencies
  for each row execute function public.handle_updated_at();

-- Public read-only view (agency name only, for creators)
create or replace view public.agencies_public as
  select id, name from public.agencies where is_active = true;

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table public.campaigns (
  id uuid default uuid_generate_v4() primary key,
  agency_id uuid references public.agencies(id) on delete set null,
  creator_profile_id uuid references public.profiles(id) on delete set null,
  campaign_name text not null,
  brand_name text not null,
  brief text,
  contracted_rate numeric(10,2),
  currency text default 'USD',
  rush_premium numeric(10,2) default 0,
  is_rush boolean default false,
  deal_signed_date date,
  campaign_start_date date,
  campaign_end_date date,
  usage_rights_notes text,
  status text default 'Negotiating' check (status in (
    'Negotiating', 'Confirmed', 'Active', 'Completed', 'Cancelled'
  )),
  admin_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.campaigns enable row level security;

create policy "Admin can see all campaigns" on public.campaigns
  for select using (public.get_my_role() = 'admin');

create policy "Creators see own campaigns" on public.campaigns
  for select using (
    public.get_my_role() = 'creator' and creator_profile_id = auth.uid()
  );

create policy "Admin can manage all campaigns" on public.campaigns
  for all using (public.get_my_role() = 'admin');

create policy "Creators can mark own campaigns complete" on public.campaigns
  for update
  using (
    public.get_my_role() = 'creator'
    and creator_profile_id = auth.uid()
  )
  with check (
    public.get_my_role() = 'creator'
    and creator_profile_id = auth.uid()
    and status = 'Completed'
  );

create trigger handle_updated_at before update on public.campaigns
  for each row execute function public.handle_updated_at();

-- ============================================================
-- CAMPAIGN DELIVERABLES
-- ============================================================
create table public.campaign_deliverables (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  platform_id uuid references public.platforms(id) on delete set null,
  deliverable_type_id uuid references public.deliverable_types(id) on delete set null,
  deliverable_details text,
  music_url text,
  quantity int default 1,
  contracted_post_date date,
  post_url text,
  actual_post_date date,
  posted_by uuid references public.profiles(id),
  posted_at timestamptz,
  draft_status text default 'Not Started' check (draft_status in (
    'Not Started', 'Draft Submitted', 'Revisions Requested', 'Approved', 'Posted'
  )),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.campaign_deliverables enable row level security;

create policy "Admin can see all deliverables" on public.campaign_deliverables
  for select using (public.get_my_role() = 'admin');

create policy "Creators see own deliverables" on public.campaign_deliverables
  for select using (
    public.get_my_role() = 'creator' and
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.creator_profile_id = auth.uid())
  );

create policy "Admin can manage deliverables" on public.campaign_deliverables
  for all using (public.get_my_role() = 'admin');

create policy "Creators can update own deliverables" on public.campaign_deliverables
  for update using (
    public.get_my_role() = 'creator' and
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.creator_profile_id = auth.uid())
  );

create trigger handle_updated_at before update on public.campaign_deliverables
  for each row execute function public.handle_updated_at();

-- ============================================================
-- REVISION ROUNDS
-- ============================================================
create table public.revision_rounds (
  id uuid default uuid_generate_v4() primary key,
  deliverable_id uuid references public.campaign_deliverables(id) on delete cascade not null,
  round_number int not null,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  draft_url text,
  draft_notes text,
  agency_decision text check (agency_decision in (
    'Pending', 'Approved', 'Revisions Requested'
  )) default 'Pending',
  agency_response_date date,
  agency_feedback text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.revision_rounds enable row level security;

create policy "Admin can see all revisions" on public.revision_rounds
  for select using (public.get_my_role() = 'admin');

create policy "Creators see own revisions" on public.revision_rounds
  for select using (
    public.get_my_role() = 'creator' and
    exists (
      select 1 from public.campaign_deliverables cd
      join public.campaigns c on c.id = cd.campaign_id
      where cd.id = deliverable_id and c.creator_profile_id = auth.uid()
    )
  );

create policy "Admin can manage revisions" on public.revision_rounds
  for all using (public.get_my_role() = 'admin');

create policy "Creators can insert revisions on own deliverables" on public.revision_rounds
  for insert with check (
    public.get_my_role() = 'creator' and
    exists (
      select 1 from public.campaign_deliverables cd
      join public.campaigns c on c.id = cd.campaign_id
      where cd.id = deliverable_id and c.creator_profile_id = auth.uid()
    )
  );

create trigger handle_updated_at before update on public.revision_rounds
  for each row execute function public.handle_updated_at();

-- ============================================================
-- INVOICES (one per campaign)
-- ============================================================
create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null unique,
  invoice_number text,
  invoice_date date,
  invoice_amount numeric(10,2),
  payment_status text default 'Not Invoiced' check (payment_status in (
    'Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue', 'Disputed', 'In Kind'
  )),
  payment_received_date date,
  payment_method text,
  payment_notes text,
  is_in_kind boolean default false,
  in_kind_value numeric(10,2),
  in_kind_description text,
  amount_received numeric(10,2),
  processing_fee numeric(10,2) default 0,
  you_received boolean default false,
  you_received_date date,
  you_received_notes text,
  receipt_path text,
  receipt_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.invoices enable row level security;

create policy "Admin can see all invoices" on public.invoices
  for select using (public.get_my_role() = 'admin');

create policy "Creators can see own invoices" on public.invoices
  for select using (
    public.get_my_role() = 'creator' and
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.creator_profile_id = auth.uid())
  );

create policy "Admin can manage invoices" on public.invoices
  for all using (public.get_my_role() = 'admin');

create trigger handle_updated_at before update on public.invoices
  for each row execute function public.handle_updated_at();

-- ============================================================
-- CAMPAIGN FILES (per-campaign file attachments)
-- ============================================================
create table public.campaign_files (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.campaign_files enable row level security;

create policy "Admin can manage campaign files" on public.campaign_files
  for all using (public.get_my_role() = 'admin');

create policy "Creators can read own campaign files" on public.campaign_files
  for select using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.creator_profile_id = auth.uid())
  );

-- ============================================================
-- COMMENTS (per campaign)
-- ============================================================
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "All authenticated can read comments on accessible campaigns" on public.comments
  for select using (
    public.get_my_role() = 'admin' or
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and (
        public.get_my_role() = 'admin' or c.creator_profile_id = auth.uid()
      )
    )
  );

create policy "All authenticated can insert comments on accessible campaigns" on public.comments
  for insert with check (
    auth.uid() is not null and
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and (
        public.get_my_role() = 'admin' or c.creator_profile_id = auth.uid()
      )
    )
  );

create policy "Users can update own comments" on public.comments
  for update using (author_id = auth.uid());

create policy "Users can delete own comments" on public.comments
  for delete using (author_id = auth.uid() or public.get_my_role() = 'admin');

create trigger handle_updated_at before update on public.comments
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TIKTOK ACCOUNTS
-- ============================================================
create table public.tiktok_accounts (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null unique,
  tiktok_username text not null,
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

create trigger handle_updated_at before update on public.tiktok_accounts
  for each row execute function public.handle_updated_at();

-- ============================================================
-- PAYMENT DESTINATIONS (per creator)
-- ============================================================
create table public.payment_destinations (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  account_type text not null check (account_type in (
    'Checking', 'Savings', 'UTMA', 'Investment', 'Other'
  )),
  account_last4 text,
  institution text,
  memo text,
  is_active boolean default true,
  sort_order int default 0,
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
-- CREATOR PAYOUTS (one per campaign)
-- ============================================================
create table public.creator_payouts (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null unique,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete set null,
  contracted_amount numeric(10,2),
  payout_amount numeric(10,2),
  payout_notes text,
  payout_status text default 'Pending' check (payout_status in (
    'Pending', 'Partial', 'Paid', 'On Hold'
  )),
  payout_date date,
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
-- PAYOUT SPLITS (children of creator_payouts)
-- ============================================================
create table public.payout_splits (
  id uuid default uuid_generate_v4() primary key,
  payout_id uuid references public.creator_payouts(id) on delete cascade not null,
  destination_id uuid references public.payment_destinations(id) on delete set null,
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  amount numeric(10,2),
  split_status text default 'Pending' check (split_status in (
    'Pending', 'Sent', 'Cleared', 'Failed'
  )),
  sent_date date,
  cleared_date date,
  reference text,
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
-- AUDIT LOG (append-only)
-- ============================================================
create table public.audit_log (
  id uuid default uuid_generate_v4() primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_hint text,
  created_at timestamptz default now()
);

alter table public.audit_log enable row level security;

create policy "Admin reads audit log" on public.audit_log
  for select using (public.get_my_role() = 'admin');

create policy "Authenticated can insert audit log" on public.audit_log
  for insert with check (auth.uid() is not null);

comment on table public.audit_log is
  'Append-only security audit log. No update or delete policies exist by design.';

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_campaigns_creator on public.campaigns(creator_profile_id);
create index if not exists idx_campaigns_agency on public.campaigns(agency_id);
create index if not exists idx_deliverables_campaign on public.campaign_deliverables(campaign_id);
create index if not exists idx_revisions_deliverable on public.revision_rounds(deliverable_id);
create index if not exists idx_invoices_campaign on public.invoices(campaign_id);
create index if not exists idx_comments_campaign on public.comments(campaign_id);
create index if not exists idx_payment_destinations_profile on public.payment_destinations(profile_id);
create index if not exists idx_creator_payouts_profile on public.creator_payouts(profile_id);
create index if not exists idx_payout_splits_payout on public.payout_splits(payout_id);
create index if not exists idx_campaign_files_campaign on public.campaign_files(campaign_id);

-- ============================================================
-- VIEWS
-- ============================================================

-- Campaign payout summary (used by Payments views)
create or replace view public.campaign_payout_summary
with (security_invoker = true) as
select
  c.id as campaign_id,
  c.campaign_name,
  c.brand_name,
  c.contracted_rate,
  c.creator_profile_id,
  pr.creator_name,
  pr.full_name as creator_full_name,
  ag.name as agency_name,
  inv.id as invoice_id,
  inv.invoice_number,
  inv.invoice_date,
  inv.invoice_amount,
  inv.payment_status as agency_payment_status,
  inv.payment_received_date as agency_paid_date,
  inv.payment_method,
  inv.amount_received,
  inv.processing_fee,
  inv.you_received,
  inv.you_received_date,
  po.id as payout_id,
  po.payout_amount,
  po.payout_status,
  po.payout_date,
  po.payout_notes,
  (select count(*) from public.payout_splits ps where ps.payout_id = po.id) as split_count,
  (select count(*) from public.payout_splits ps where ps.payout_id = po.id and ps.split_status = 'Cleared') as splits_cleared
from public.campaigns c
left join public.profiles pr on pr.id = c.creator_profile_id
left join public.agencies ag on ag.id = c.agency_id
left join public.invoices inv on inv.campaign_id = c.id
left join public.creator_payouts po on po.campaign_id = c.id;

-- ============================================================
-- TIKTOK VIDEO ID EXTRACTOR
-- ============================================================
create or replace function public.extract_tiktok_video_id(url text)
returns text as $$
declare
  matches text[];
begin
  if url is null then return null; end if;
  matches := regexp_match(url, '/video/([0-9]+)');
  if matches is not null then return matches[1]; end if;
  return null;
end;
$$ language plpgsql immutable;

-- ============================================================
-- STORAGE BUCKETS
-- Create these in Supabase Dashboard > Storage, or via API:
--   - payment-receipts (private)
--   - campaign-files (private)
-- Then add RLS policies allowing admin full access and creators
-- access to files in their own campaigns only.
-- ============================================================


-- ============================================================
-- ============================================================
-- PART 2: COUPLER.IO VIEWS
-- Run AFTER Coupler.io has synced at least once.
-- Coupler creates tables named: tiktok_*_kym and tiktok_*_mys
-- These views union them together and map column names.
-- ============================================================
-- ============================================================

-- Profile Insights (Coupler: Append mode)
create or replace view public.tiktok_profile_insights_view as
select
  tiktok_username, date, followers_count,
  followers_count - lag(followers_count) over (partition by tiktok_username order by date) as net_followers,
  likes, shares, profile_views, video_views, comments
from (
  select distinct on (tiktok_username, date)
    account__username as tiktok_username,
    report__date as date,
    engagement__followers_count_on_date as followers_count,
    engagement__likes as likes, engagement__shares as shares,
    engagement__profile_views as profile_views,
    engagement__video_views as video_views,
    engagement__comments as comments
  from (
    select * from public.tiktok_profile_insights_kym
    where engagement__followers_count_on_date > 100
    union all
    select * from public.tiktok_profile_insights_mys
    where engagement__followers_count_on_date > 100
  ) raw
  order by tiktok_username, date, engagement__followers_count_on_date desc nulls last
) deduped;

-- Audience Gender (Coupler: Append mode)
create or replace view public.tiktok_audience_gender_view as
select distinct on (tiktok_username, date, gender) * from (
  select account__username as tiktok_username,
    report__date as date,
    audience__gender as gender,
    engagement____of_followers as percentage,
    engagement__total_followers as follower_count
  from public.tiktok_audience_gender_kym
  union all
  select account__username, report__date, audience__gender,
    engagement____of_followers, engagement__total_followers
  from public.tiktok_audience_gender_mys
) t
order by tiktok_username, date, gender;

-- Audience Country (Coupler: Append mode)
create or replace view public.tiktok_audience_country_view as
select distinct on (tiktok_username, date, country) * from (
  select account__username as tiktok_username,
    report__date as date,
    audience__country as country,
    engagement____of_followers as percentage,
    engagement__total_followers as follower_count
  from public.tiktok_audience_country_kym
  union all
  select account__username, report__date, audience__country,
    engagement____of_followers, engagement__total_followers
  from public.tiktok_audience_country_mys
) t
order by tiktok_username, date, country;


-- Audience Hourly Activity (Coupler: Append mode)
create or replace view public.tiktok_audience_hourly_view as
select distinct on (tiktok_username, date, hour) * from (
  select account__username as tiktok_username,
    report__date as date,
    audience__activity_hour::int as hour,
    engagement__followers_online as activity_score
  from public.tiktok_audience_hourly_kym
  union all
  select account__username, report__date,
    audience__activity_hour::int, engagement__followers_online
  from public.tiktok_audience_hourly_mys
) t
order by tiktok_username, date, hour;

-- Video Insights (Coupler: Append mode)
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

-- Video Countries (Coupler: Replace mode)
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

-- Campaign deliverables with TikTok stats
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
    then round(((tvi.total_like + tvi.total_comment + tvi.total_share)::numeric
         / tvi.total_play) * 100, 2)
    else null
  end as engagement_rate
from public.campaign_deliverables cd
left join public.tiktok_video_insights_view tvi
  on tvi.video_id = public.extract_tiktok_video_id(cd.post_url);

-- Grant access
grant select on public.tiktok_profile_insights_view to authenticated;
grant select on public.tiktok_audience_gender_view to authenticated;
grant select on public.tiktok_audience_country_view to authenticated;
grant select on public.tiktok_audience_hourly_view to authenticated;
grant select on public.tiktok_video_insights_view to authenticated;
grant select on public.tiktok_video_countries_view to authenticated;
grant select on public.campaign_deliverables_with_stats to authenticated;

-- ============================================================
-- PART 3: COUPLER AUTO-FIX EVENT TRIGGER
-- Run once after the Coupler views above are created.
-- Automatically reapplies RLS + recreates views whenever
-- Coupler's Replace-mode sync drops and recreates tables.
-- Covers: tiktok_audience_gender, tiktok_audience_country,
--         tiktok_video_countries (all Replace mode)
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
  for obj in select * from pg_event_trigger_ddl_commands()
  loop
    if obj.object_type = 'table' and obj.schema_name = 'public'
       and obj.object_identity like 'public.tiktok_%' then
      is_tiktok_table := true;
    end if;
  end loop;

  if not is_tiktok_table then return; end if;

  perform pg_sleep(0.1);

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
          'create policy "admin_all" on public.%I for all using (public.get_my_role() = ''admin'');', tbl);
        execute format(
          'create policy "creator_own" on public.%I for select using (
            exists (select 1 from public.tiktok_accounts ta
            where ta.tiktok_username = %I.account__username and ta.profile_id = auth.uid()));',
          tbl, tbl);
      exception when others then null;
      end;
    end loop;
  end;

  begin
    execute 'drop view if exists public.tiktok_audience_gender_view;';
    execute $v$
      create view public.tiktok_audience_gender_view as
      select distinct on (tiktok_username, date, gender) * from (
        select account__username as tiktok_username, report__date as date,
          audience__gender as gender, engagement____of_followers as percentage,
          engagement__total_followers as follower_count
        from public.tiktok_audience_gender_kym
        union all
        select account__username, report__date, audience__gender,
          engagement____of_followers, engagement__total_followers
        from public.tiktok_audience_gender_mys
      ) t order by tiktok_username, date, gender;
    $v$;
    execute 'grant select on public.tiktok_audience_gender_view to authenticated;';
  exception when others then null;
  end;

  begin
    execute 'drop view if exists public.tiktok_audience_country_view;';
    execute $v$
      create view public.tiktok_audience_country_view as
      select distinct on (tiktok_username, date, country) * from (
        select account__username as tiktok_username, report__date as date,
          audience__country as country, engagement____of_followers as percentage,
          engagement__total_followers as follower_count
        from public.tiktok_audience_country_kym
        union all
        select account__username, report__date, audience__country,
          engagement____of_followers, engagement__total_followers
        from public.tiktok_audience_country_mys
      ) t order by tiktok_username, date, country;
    $v$;
    execute 'grant select on public.tiktok_audience_country_view to authenticated;';
  exception when others then null;
  end;

  begin
    execute $v$
      create or replace view public.tiktok_video_countries_view as
      select account__username as tiktok_username, video__video_id as video_id,
        audience__country as country, video____of_viewers as percentage
      from public.tiktok_video_countries_kym union all
      select account__username, video__video_id, audience__country, video____of_viewers
      from public.tiktok_video_countries_mys;
    $v$;
    execute 'grant select on public.tiktok_video_countries_view to authenticated;';
  exception when others then null;
  end;

  begin
    execute $v$
      drop view if exists public.campaign_deliverables_with_stats;
      create view public.campaign_deliverables_with_stats as
      select cd.*, tvi.video_id, tvi.video_title, tvi.cover_image_url,
        tvi.create_time as tiktok_publish_time, tvi.total_play as views,
        tvi.total_like as likes, tvi.total_comment as comments, tvi.total_share as shares,
        tvi.average_time_watched, tvi.video_duration, tvi.full_video_watched_rate, tvi.reach,
        case when tvi.total_play > 0
          then round(((tvi.total_like + tvi.total_comment + tvi.total_share)::numeric / tvi.total_play) * 100, 2)
          else null end as engagement_rate
      from public.campaign_deliverables cd
      left join public.tiktok_video_insights_view tvi
        on tvi.video_id = public.extract_tiktok_video_id(cd.post_url);
    $v$;
    execute 'grant select on public.campaign_deliverables_with_stats to authenticated;';
  exception when others then null;
  end;

end;
$$;

drop event trigger if exists coupler_table_recreation_trigger;

create event trigger coupler_table_recreation_trigger
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS')
  execute function public.handle_coupler_table_recreation();

-- ============================================================
-- PLATFORM REWARDS
-- ============================================================

-- Programs: one per platform reward scheme (e.g. TikTok Creator Rewards)
create table public.platform_rewards_programs (
  id uuid default uuid_generate_v4() primary key,
  platform_id uuid references public.platforms(id) on delete set null,
  name text not null,
  description text,
  payout_day int default 15 check (payout_day between 1 and 28), -- day of following month
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Monthly entries: one per creator per program per month
create table public.platform_reward_entries (
  id uuid default uuid_generate_v4() primary key,
  program_id uuid references public.platform_rewards_programs(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  period_month date not null, -- first of month: 2026-03-01
  gross_amount numeric(10,2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(program_id, profile_id, period_month)
);

-- Invoices for rewards: reuse invoices table with reward_entry_id
alter table public.invoices add column if not exists reward_entry_id uuid references public.platform_reward_entries(id) on delete set null;

-- Payouts for rewards: reuse creator_payouts with reward_entry_id
alter table public.creator_payouts add column if not exists reward_entry_id uuid references public.platform_reward_entries(id) on delete set null;

-- RLS
alter table public.platform_rewards_programs enable row level security;
alter table public.platform_reward_entries enable row level security;

create policy "Admin manages reward programs" on public.platform_rewards_programs
  for all using (public.get_my_role() = 'admin');
create policy "Authenticated read reward programs" on public.platform_rewards_programs
  for select using (auth.role() = 'authenticated');

create policy "Admin manages reward entries" on public.platform_reward_entries
  for all using (public.get_my_role() = 'admin');
create policy "Creators read own reward entries" on public.platform_reward_entries
  for select using (public.get_my_role() = 'creator' and profile_id = auth.uid());

-- Trigger for updated_at
create trigger handle_updated_at_reward_programs before update on public.platform_rewards_programs
  for each row execute function public.handle_updated_at();
create trigger handle_updated_at_reward_entries before update on public.platform_reward_entries
  for each row execute function public.handle_updated_at();

-- Summary view: joins entries with their invoice and payout
create or replace view public.reward_payout_summary
with (security_invoker = true) as
select
  e.id as entry_id,
  e.program_id,
  p.name as program_name,
  pl.name as platform_name,
  p.payout_day,
  e.profile_id,
  pr.creator_name,
  pr.full_name as creator_full_name,
  e.period_month,
  e.gross_amount,
  e.notes as entry_notes,
  inv.id as invoice_id,
  inv.payment_status as agency_payment_status,
  inv.payment_method,
  inv.invoice_amount,
  inv.amount_received,
  inv.processing_fee,
  inv.you_received,
  inv.you_received_date,
  inv.payment_received_date,
  po.id as payout_id,
  po.payout_status,
  po.payout_amount,
  po.payout_date,
  po.payout_notes,
  (select count(*) from public.payout_splits ps where ps.payout_id = po.id) as split_count,
  (select count(*) from public.payout_splits ps where ps.payout_id = po.id and ps.split_status = 'Cleared') as splits_cleared
from public.platform_reward_entries e
join public.platform_rewards_programs p on p.id = e.program_id
left join public.platforms pl on pl.id = p.platform_id
join public.profiles pr on pr.id = e.profile_id
left join public.invoices inv on inv.reward_entry_id = e.id
left join public.creator_payouts po on po.reward_entry_id = e.id;

grant select on public.reward_payout_summary to authenticated;
