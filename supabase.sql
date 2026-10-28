-- Planerr community feed. Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- Anyone with the app can read shared adventures and post new ones; nobody can edit or delete
-- other people's posts through the app (you can moderate from the Supabase dashboard).

create table if not exists public.adventures (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  author      text check (char_length(author) <= 40),
  title       text not null check (char_length(title) between 1 and 80),
  type        text check (char_length(type) <= 20),
  region      text check (char_length(region) <= 120),
  trip_date   date,
  rating      int check (rating between 1 and 5),
  review      text check (char_length(review) <= 2000),
  tips        text check (char_length(tips) <= 1000),
  budget      numeric check (budget >= 0 and budget < 100000),
  family_ages int[] default '{}',
  photo       text check (photo is null or photo like 'https://upload.wikimedia.org/%'),
  stops       jsonb not null default '[]' check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 30),
  main_index  int default 0
);

alter table public.adventures enable row level security;

drop policy if exists "Anyone can read shared adventures" on public.adventures;
create policy "Anyone can read shared adventures" on public.adventures
  for select using (true);

drop policy if exists "Anyone can share an adventure" on public.adventures;
create policy "Anyone can share an adventure" on public.adventures
  for insert with check (true);

create index if not exists adventures_created_at_idx on public.adventures (created_at desc);
