-- ============================================================
-- CREATOR HUB - Full Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'creator')),
  creator_name text, -- 'Kym' or 'Mys' if role = creator
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PLATFORMS (admin-managed, extensible)
-- ============================================================
create table public.platforms (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique, -- TikTok, Instagram, YouTube, X, etc.
  icon_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Seed default platforms
insert into public.platforms (name) values
  ('TikTok'),
  ('Instagram'),
  ('YouTube'),
  ('X (Twitter)'),
  ('Facebook');

-- ============================================================
-- DELIVERABLE TYPES (admin-managed, extensible)
-- ============================================================
create table public.deliverable_types (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique, -- Post, Story, Reel, Short, Bundle, etc.
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Seed default deliverable types
insert into public.deliverable_types (name, description) values
  ('Post', 'Standard feed post'),
  ('Story', 'Ephemeral story content'),
  ('Reel / Short', 'Short-form video content'),
  ('Live', 'Live stream session'),
  ('Bundle', 'Multi-format package deal');

-- ============================================================
-- AGENCIES / LABELS (admin-managed)
-- ============================================================
create table public.agencies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  contact_name text,
  email text,
  phone text,
  payment_terms text default 'Net 30', -- Net 15, Net 30, Net 60, Upon Receipt
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CAMPAIGNS (one per deal, tied to one creator)
-- ============================================================
create table public.campaigns (
  id uuid default uuid_generate_v4() primary key,
  agency_id uuid references public.agencies(id) on delete set null,
  creator_profile_id uuid references public.profiles(id) on delete set null,
  
  -- Deal info
  campaign_name text not null,
  brand_name text not null,
  brief text, -- full campaign brief / instructions
  
  -- Financials
  contracted_rate numeric(10,2),
  currency text default 'USD',
  rush_premium numeric(10,2) default 0, -- tracked separately
  is_rush boolean default false,
  
  -- Dates
  deal_signed_date date,
  campaign_start_date date,
  campaign_end_date date,
  
  -- Exclusivity & rights
  exclusivity_start date,
  exclusivity_end date,
  usage_rights_notes text,
  
  -- Status
  status text default 'Negotiating' check (status in (
    'Negotiating', 'Confirmed', 'Active', 'Completed', 'Cancelled'
  )),
  
  -- Admin notes (visible to all)
  admin_notes text,
  
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CAMPAIGN PLATFORM DELIVERABLES
-- One row per platform covered under the campaign
-- ============================================================
create table public.campaign_deliverables (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  platform_id uuid references public.platforms(id) on delete set null,
  deliverable_type_id uuid references public.deliverable_types(id) on delete set null,
  
  -- What's required
  deliverable_details text, -- specific instructions for this platform
  quantity int default 1, -- number of posts on this platform
  
  -- Contracted posting date
  contracted_post_date date,
  
  -- Actual post
  post_url text,
  actual_post_date date,
  posted_by uuid references public.profiles(id),
  posted_at timestamptz,
  
  -- Draft workflow status (latest status, full history in revisions table)
  draft_status text default 'Not Started' check (draft_status in (
    'Not Started', 'Draft Submitted', 'Revisions Requested', 'Approved', 'Posted'
  )),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- REVISION ROUNDS (per deliverable, multiple rounds supported)
-- ============================================================
create table public.revision_rounds (
  id uuid default uuid_generate_v4() primary key,
  deliverable_id uuid references public.campaign_deliverables(id) on delete cascade not null,
  
  round_number int not null, -- 1, 2, 3...
  
  -- Submission
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  draft_url text,
  draft_notes text,
  
  -- Agency response
  agency_decision text check (agency_decision in (
    'Pending', 'Approved', 'Revisions Requested'
  )) default 'Pending',
  agency_response_date date,
  agency_feedback text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- INVOICES & PAYMENTS (one per campaign)
-- ============================================================
create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null unique,
  
  invoice_number text,
  invoice_date date,
  invoice_amount numeric(10,2),
  
  payment_status text default 'Not Invoiced' check (payment_status in (
    'Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue', 'Disputed'
  )),
  
  payment_received_date date,
  payment_method text, -- PayPal, Wire, Check, etc.
  payment_notes text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- COMMENTS (per campaign, visible to all)
-- ============================================================
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  
  body text not null,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.platforms enable row level security;
alter table public.deliverable_types enable row level security;
alter table public.agencies enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_deliverables enable row level security;
alter table public.revision_rounds enable row level security;
alter table public.invoices enable row level security;
alter table public.comments enable row level security;

-- Helper function: get current user role
create or replace function public.get_my_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer;

-- Helper function: get current user's creator_name
create or replace function public.get_my_creator_name()
returns text as $$
  select creator_name from public.profiles where id = auth.uid();
$$ language sql security definer;

-- PROFILES policies
create policy "Users can view own profile" on public.profiles
  for select using (id = auth.uid() or public.get_my_role() = 'admin');

create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());

create policy "Admin can insert profiles" on public.profiles
  for insert with check (public.get_my_role() = 'admin');

-- PLATFORMS policies (all authenticated can read, only admin can write)
create policy "All authenticated can read platforms" on public.platforms
  for select using (auth.uid() is not null);

create policy "Admin can manage platforms" on public.platforms
  for all using (public.get_my_role() = 'admin');

-- DELIVERABLE TYPES policies
create policy "All authenticated can read deliverable types" on public.deliverable_types
  for select using (auth.uid() is not null);

create policy "Admin can manage deliverable types" on public.deliverable_types
  for all using (public.get_my_role() = 'admin');

-- AGENCIES policies (all can read, only admin can write)
create policy "All authenticated can read agencies" on public.agencies
  for select using (auth.uid() is not null);

create policy "Admin can manage agencies" on public.agencies
  for all using (public.get_my_role() = 'admin');

-- CAMPAIGNS policies
create policy "Admin can see all campaigns" on public.campaigns
  for select using (public.get_my_role() = 'admin');

create policy "Creators see own campaigns" on public.campaigns
  for select using (
    public.get_my_role() = 'creator' and creator_profile_id = auth.uid()
  );

create policy "Admin can manage all campaigns" on public.campaigns
  for all using (public.get_my_role() = 'admin');

-- CAMPAIGN DELIVERABLES policies
create policy "Admin can see all deliverables" on public.campaign_deliverables
  for select using (public.get_my_role() = 'admin');

create policy "Creators see own deliverables" on public.campaign_deliverables
  for select using (
    public.get_my_role() = 'creator' and
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.creator_profile_id = auth.uid()
    )
  );

create policy "Admin can manage deliverables" on public.campaign_deliverables
  for all using (public.get_my_role() = 'admin');

create policy "Creators can update own deliverables" on public.campaign_deliverables
  for update using (
    public.get_my_role() = 'creator' and
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.creator_profile_id = auth.uid()
    )
  );

-- REVISION ROUNDS policies
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

-- INVOICES policies
create policy "Admin can see all invoices" on public.invoices
  for select using (public.get_my_role() = 'admin');

create policy "Creators can see own invoices" on public.invoices
  for select using (
    public.get_my_role() = 'creator' and
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.creator_profile_id = auth.uid()
    )
  );

create policy "Admin can manage invoices" on public.invoices
  for all using (public.get_my_role() = 'admin');

-- COMMENTS policies
create policy "All authenticated can read comments on own campaigns" on public.comments
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

-- ============================================================
-- TRIGGERS: updated_at auto-update
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger handle_updated_at before update on public.agencies
  for each row execute function public.handle_updated_at();
create trigger handle_updated_at before update on public.campaigns
  for each row execute function public.handle_updated_at();
create trigger handle_updated_at before update on public.campaign_deliverables
  for each row execute function public.handle_updated_at();
create trigger handle_updated_at before update on public.revision_rounds
  for each row execute function public.handle_updated_at();
create trigger handle_updated_at before update on public.invoices
  for each row execute function public.handle_updated_at();
create trigger handle_updated_at before update on public.comments
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
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
