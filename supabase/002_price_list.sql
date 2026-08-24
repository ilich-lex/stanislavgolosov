-- golosovsv.ru: editable public price list.
-- Run in Supabase Dashboard -> SQL Editor after 001_cms_schema.sql.

create extension if not exists pgcrypto;

create table if not exists public.price_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price text not null,
  sort_order integer not null default 100,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_items_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint price_items_price_length check (char_length(btrim(price)) between 1 and 80),
  constraint price_items_sort_order_range check (sort_order between -100000 and 100000)
);

create index if not exists price_items_public_order_idx
  on public.price_items (is_published, sort_order, created_at asc);

drop trigger if exists price_items_set_updated_at on public.price_items;
create trigger price_items_set_updated_at
before update on public.price_items
for each row execute function public.set_updated_at();

alter table public.price_items enable row level security;

revoke all on table public.price_items from anon, authenticated;
grant select on table public.price_items to anon, authenticated;
grant insert, update, delete on table public.price_items to authenticated;

drop policy if exists price_items_public_read on public.price_items;
create policy price_items_public_read
on public.price_items
for select
to anon, authenticated
using (is_published = true);

drop policy if exists price_items_admin_read on public.price_items;
create policy price_items_admin_read
on public.price_items
for select
to authenticated
using ((select public.is_site_admin()));

drop policy if exists price_items_admin_insert on public.price_items;
create policy price_items_admin_insert
on public.price_items
for insert
to authenticated
with check ((select public.is_site_admin()));

drop policy if exists price_items_admin_update on public.price_items;
create policy price_items_admin_update
on public.price_items
for update
to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists price_items_admin_delete on public.price_items;
create policy price_items_admin_delete
on public.price_items
for delete
to authenticated
using ((select public.is_site_admin()));

insert into public.price_items (id, title, price, sort_order, is_featured, is_published)
values
  ('10000000-0000-4000-8000-000000000001', 'Составление ходатайств', 'от 1 500 ₽', 10, false, true),
  ('10000000-0000-4000-8000-000000000002', 'Обжалование действий приставов', 'от 2 500 ₽', 20, false, true),
  ('10000000-0000-4000-8000-000000000003', 'Отмена судебных решений', 'от 2 500 ₽', 30, false, true),
  ('10000000-0000-4000-8000-000000000004', 'Представительство в суде', 'от 5 000 ₽', 40, false, true),
  ('10000000-0000-4000-8000-000000000005', 'Защита от коллекторов', 'от 5 000 ₽', 50, false, true),
  ('10000000-0000-4000-8000-000000000006', 'Подготовка документов в суд', 'от 10 000 ₽', 60, false, true),
  ('10000000-0000-4000-8000-000000000007', 'Банкротство физических лиц', 'от 140 000 ₽', 70, true, true)
on conflict (id) do nothing;
