-- ============================================================
-- 09-in-kind.sql
-- Adds in-kind compensation tracking to invoices table.
-- Run in Supabase SQL Editor.
-- ============================================================

alter table public.invoices
  add column if not exists is_in_kind boolean default false,
  add column if not exists in_kind_value numeric(10,2),
  add column if not exists in_kind_description text;

-- Also widen the payment_status check constraint to include 'In Kind'
alter table public.invoices
  drop constraint if exists invoices_payment_status_check;

alter table public.invoices
  add constraint invoices_payment_status_check
  check (payment_status in (
    'Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue', 'Disputed', 'In Kind'
  ));
