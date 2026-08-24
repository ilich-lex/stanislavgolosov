-- golosovsv.ru: database schema, RLS policies and initial content.
-- Run once in Supabase Dashboard -> SQL Editor before deploying the CMS files.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null,
  label text not null default 'Пример судебной практики',
  source text not null default 'Картотека арбитражных дел',
  url text not null unique,
  sort_order integer not null default 100,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_cases_case_number_length check (char_length(btrim(case_number)) between 3 and 120),
  constraint legal_cases_label_length check (char_length(btrim(label)) between 3 and 180),
  constraint legal_cases_source_length check (char_length(btrim(source)) between 3 and 120),
  constraint legal_cases_url_length check (char_length(url) between 12 and 2048),
  constraint legal_cases_https_url check (url ~* '^https://[^[:space:]]+$'),
  constraint legal_cases_sort_order_range check (sort_order between -100000 and 100000)
);

create index if not exists legal_cases_public_order_idx
  on public.legal_cases (is_published, sort_order, created_at desc);

create table if not exists public.site_profile (
  id text primary key default 'main',
  portrait_path text,
  portrait_alt text not null default 'Юрист Станислав Голосов',
  updated_at timestamptz not null default now(),
  constraint site_profile_single_row check (id = 'main'),
  constraint site_profile_portrait_path_length check (portrait_path is null or char_length(portrait_path) between 5 and 512),
  constraint site_profile_portrait_alt_length check (char_length(btrim(portrait_alt)) between 3 and 160)
);

insert into public.site_profile (id)
values ('main')
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists legal_cases_set_updated_at on public.legal_cases;
create trigger legal_cases_set_updated_at
before update on public.legal_cases
for each row execute function public.set_updated_at();

drop trigger if exists site_profile_set_updated_at on public.site_profile;
create trigger site_profile_set_updated_at
before update on public.site_profile
for each row execute function public.set_updated_at();

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.legal_cases enable row level security;
alter table public.site_profile enable row level security;

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.legal_cases from anon, authenticated;
revoke all on table public.site_profile from anon, authenticated;

grant select on table public.admin_users to authenticated;
grant select on table public.legal_cases to anon, authenticated;
grant insert, update, delete on table public.legal_cases to authenticated;
grant select on table public.site_profile to anon, authenticated;
grant insert, update on table public.site_profile to authenticated;

drop policy if exists admin_users_read_own_whitelist on public.admin_users;
create policy admin_users_read_own_whitelist
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists legal_cases_public_read on public.legal_cases;
create policy legal_cases_public_read
on public.legal_cases
for select
to anon, authenticated
using (is_published = true);

drop policy if exists legal_cases_admin_read on public.legal_cases;
create policy legal_cases_admin_read
on public.legal_cases
for select
to authenticated
using ((select public.is_site_admin()));

drop policy if exists legal_cases_admin_insert on public.legal_cases;
create policy legal_cases_admin_insert
on public.legal_cases
for insert
to authenticated
with check ((select public.is_site_admin()));

drop policy if exists legal_cases_admin_update on public.legal_cases;
create policy legal_cases_admin_update
on public.legal_cases
for update
to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists legal_cases_admin_delete on public.legal_cases;
create policy legal_cases_admin_delete
on public.legal_cases
for delete
to authenticated
using ((select public.is_site_admin()));

drop policy if exists site_profile_public_read on public.site_profile;
create policy site_profile_public_read
on public.site_profile
for select
to anon, authenticated
using (true);

drop policy if exists site_profile_admin_insert on public.site_profile;
create policy site_profile_admin_insert
on public.site_profile
for insert
to authenticated
with check (id = 'main' and (select public.is_site_admin()));

drop policy if exists site_profile_admin_update on public.site_profile;
create policy site_profile_admin_update
on public.site_profile
for update
to authenticated
using (id = 'main' and (select public.is_site_admin()))
with check (id = 'main' and (select public.is_site_admin()));

-- Create a PUBLIC Storage bucket named site-assets before using the photo section.
-- Uploads are versioned, so UPDATE permission is intentionally not granted.
drop policy if exists site_assets_admin_upload on storage.objects;
create policy site_assets_admin_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-assets'
  and (storage.foldername(name))[1] = 'portrait'
  and (select public.is_site_admin())
);

drop policy if exists site_assets_admin_delete on storage.objects;
create policy site_assets_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-assets'
  and (storage.foldername(name))[1] = 'portrait'
  and (select public.is_site_admin())
);

insert into public.admin_users (user_id)
values ('ce3ec75a-4f08-40bc-9bcc-0d63571c5dc4')
on conflict (user_id) do nothing;

insert into public.legal_cases (case_number, label, source, url, sort_order, is_published)
values
  ('А38-5075', 'Пример судебной практики', 'Картотека арбитражных дел', 'https://kad.arbitr.ru/Card/c5ef7333-0191-4671-afa0-a3dc3cf069fd', 10, true),
  ('А50-5288/2025', 'Пример судебной практики', 'Картотека арбитражных дел', 'https://kad.arbitr.ru/Card/991e6bd1-fd62-4ce6-913d-b4b1e4a4e1ad', 20, true),
  ('А75-20839/2024', 'Пример судебной практики', 'Картотека арбитражных дел', 'https://kad.arbitr.ru/Card/5af83e6a-9fbe-4f1d-be33-37146340165c', 30, true),
  ('А24-4654/2024', 'Пример судебной практики', 'Картотека арбитражных дел', 'https://kad.arbitr.ru/Card/8244ca30-3bf6-4665-8fa5-1a1f96739676', 40, true),
  ('А67-2643/2025', 'Пример судебной практики', 'Картотека арбитражных дел', 'https://kad.arbitr.ru/Card/050a8315-6b05-431b-a5e9-4367443eb432', 50, true)
on conflict (url) do update set
  case_number = excluded.case_number,
  label = excluded.label,
  source = excluded.source,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published;
