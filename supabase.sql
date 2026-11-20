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
  photo       text check (photo is null or photo like 'https://upload.wikimedia.org/%' or photo like 'https://commons.wikimedia.org/%'),
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

-- ---------- Reports (added Nov 2026; safe to run again) ----------
-- Anyone can report a post. Once 3 different phones report it, it's hidden from Explore.
-- Reports can't be read through the app; you can see them in Table Editor → adventure_reports,
-- and bring a post back by unticking "hidden" on it in Table Editor → adventures.
alter table public.adventures add column if not exists hidden boolean not null default false;

drop policy if exists "Anyone can read shared adventures" on public.adventures;
create policy "Anyone can read shared adventures" on public.adventures
  for select using (not hidden);

create table if not exists public.adventure_reports (
  adventure_id uuid not null references public.adventures (id) on delete cascade,
  reporter     text not null check (char_length(reporter) between 8 and 40),
  created_at   timestamptz not null default now(),
  primary key (adventure_id, reporter)
);

alter table public.adventure_reports enable row level security;

drop policy if exists "Anyone can report a post" on public.adventure_reports;
create policy "Anyone can report a post" on public.adventure_reports
  for insert with check (true);

create or replace function public.hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from adventure_reports where adventure_id = new.adventure_id) >= 3 then
    update adventures set hidden = true where id = new.adventure_id;
  end if;
  return new;
end $$;

drop trigger if exists hide_reported on public.adventure_reports;
create trigger hide_reported after insert on public.adventure_reports
  for each row execute function public.hide_reported();

-- ---------- Owner tools: reviewing reported posts (added Nov 2026) ----------
-- These are for YOU, in the Supabase dashboard (SQL Editor). They are NOT part of the app and
-- are all inside /* ... */ comments, so running this whole file again does nothing to them.
-- To use one: copy it (without the /* and */ lines) into a NEW query tab, and click Run.
-- The README ("Reviewing reported posts") has the same queries with step-by-step clicks.

/* 1. LIST hidden posts (newest first). Safe: only reads.
select a.id, a.title, a.region as place, a.created_at as posted_on, count(r.reporter) as reports
from public.adventures a
left join public.adventure_reports r on r.adventure_id = a.id
where a.hidden
group by a.id
order by a.created_at desc;
*/

/* 2. RESTORE a post: show it in Explore again. Replace PASTE-POST-ID-HERE with an id from query 1.
   Its reports are cleared too, so it doesn't instantly hide itself again.
begin;
delete from public.adventure_reports where adventure_id = 'PASTE-POST-ID-HERE';
update public.adventures set hidden = false where id = 'PASTE-POST-ID-HERE';
commit;
*/

/* 3. DELETE a post FOREVER (and its reports). This can't be undone.
   Replace PASTE-POST-ID-HERE with an id from query 1.
delete from public.adventures where id = 'PASTE-POST-ID-HERE';
*/

-- ---------- Visitor count (added Nov 2026) ----------
-- Each phone sends one row a day: a random id made on the phone (not linked to a name, account, location or
-- to its reports), the date, and whether Planerr is installed on the Home Screen. Phones can add rows but
-- nobody can read them through the app; only you can, in the dashboard. Safe to run again.
create table if not exists public.visits (
  device    text not null check (char_length(device) between 8 and 40),
  day       date not null,
  installed boolean not null default false,
  primary key (device, day)
);
alter table public.visits enable row level security;
drop policy if exists "Anyone can log a visit" on public.visits;
create policy "Anyone can log a visit" on public.visits
  for insert with check (day between current_date - 1 and current_date + 1);

-- ---------- Owner tools: visitor numbers ----------
-- Copy one query (without the /* and */ lines) into a NEW query tab in the SQL Editor and click Run.
-- The README ("Checking your visitor numbers") has the same queries with step-by-step clicks.

/* A. The big picture: how many people, how many came back, how many installed it.
select
  count(distinct device)                                                     as people_ever,
  count(distinct device) filter (where day >= current_date - 6)              as people_last_7_days,
  (select count(*) from (select device from public.visits group by device having count(*) >= 2) r) as came_back_at_least_once,
  (select count(*) from (select device from public.visits group by device having count(*) >= 3) r) as used_it_3_plus_days,
  count(distinct device) filter (where installed)                            as installed_on_home_screen
from public.visits;
*/

/* B. People per day, last 30 days (newest first).
select day, count(*) as people, count(*) filter (where installed) as installed
from public.visits
where day >= current_date - 29
group by day order by day desc;
*/

/* C. Do new people come back? For each week, how many were new, and how many of them returned on a later day.
with firsts as (select device, min(day) as first_day from public.visits group by device)
select date_trunc('week', f.first_day)::date as week_started,
       count(*) as new_people,
       count(*) filter (where exists (select 1 from public.visits v where v.device = f.device and v.day > f.first_day)) as came_back
from firsts f
group by 1 order by 1 desc;
*/
