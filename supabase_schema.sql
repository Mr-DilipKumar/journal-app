-- =======================================================
-- JOURNAL APP — SUPABASE DATABASE SCHEMA & RLS POLICIES
-- =======================================================
-- Run this in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Note: The app also automatically syncs directly to your account
-- metadata even before this table is created!
-- =======================================================

-- 1. Create the entries table
create table if not exists public.entries (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled reflection',
  content text default '',
  date date not null default current_date,
  journal text default 'Personal',
  favorite boolean default false,
  mood text default 'neutral',
  weather text default '',
  location text default '',
  tags jsonb default '[]'::jsonb,
  photos jsonb default '[]'::jsonb,
  audio text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS) to ensure users can only access their own entries
alter table public.entries enable row level security;

-- 3. RLS Policies for secure per-user access
drop policy if exists "Users can view own entries" on public.entries;
create policy "Users can view own entries"
  on public.entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own entries" on public.entries;
create policy "Users can insert own entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own entries" on public.entries;
create policy "Users can update own entries"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own entries" on public.entries;
create policy "Users can delete own entries"
  on public.entries for delete
  using (auth.uid() = user_id);

-- 4. Fast lookup index on user_id and date
create index if not exists entries_user_date_idx on public.entries(user_id, date desc);
