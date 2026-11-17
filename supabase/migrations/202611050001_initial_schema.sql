create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.directions (
  slug text primary key,
  name text not null,
  is_active boolean not null default true,
  sort_order smallint not null unique
);

create table public.programs (
  slug text primary key,
  direction_slug text not null references public.directions (slug) on update cascade on delete restrict,
  name text not null,
  duration_label text not null,
  price_uah integer not null check (price_uah > 0),
  is_active boolean not null default true,
  sort_order smallint not null,
  unique (direction_slug, sort_order)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  program_slug text not null references public.programs (slug) on update cascade on delete restrict,
  city text not null,
  venue text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer not null check (capacity > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'completed')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (status <> 'published' or length(trim(venue)) > 0)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  program_slug text not null references public.programs (slug) on update cascade on delete restrict,
  city text not null,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  phone text not null check (length(trim(phone)) between 5 and 40),
  promo_code text check (promo_code is null or length(promo_code) <= 64),
  payment_preference text not null check (payment_preference in ('deposit', 'full')),
  status text not null default 'submitted'
    check (status in ('submitted', 'contacted', 'confirmed', 'deposit_paid', 'paid', 'cancelled', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_public_schedule_idx on public.events (starts_at, city) where status = 'published';
create index events_program_idx on public.events (program_slug, starts_at);
create index applications_event_status_idx on public.applications (event_id, status);
create index applications_created_at_idx on public.applications (created_at desc);

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

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_admin
  );
$$;

alter table public.profiles enable row level security;
alter table public.directions enable row level security;
alter table public.programs enable row level security;
alter table public.events enable row level security;
alter table public.applications enable row level security;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Public can read active directions"
on public.directions for select to anon, authenticated
using (is_active or (select public.is_admin()));

create policy "Admins can manage directions"
on public.directions for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Public can read active programs"
on public.programs for select to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.directions d
    where d.slug = direction_slug and d.is_active
  )
  or (select public.is_admin())
);

create policy "Admins can manage programs"
on public.programs for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Public can read published events"
on public.events for select to anon, authenticated
using (status = 'published' or (select public.is_admin()));

create policy "Admins can manage events"
on public.events for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can read applications"
on public.applications for select to authenticated
using ((select public.is_admin()));

create policy "Admins can update applications"
on public.applications for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace function public.list_public_events(
  p_city text default null,
  p_direction text default null
)
returns table (
  event_id uuid,
  program_slug text,
  direction_slug text,
  direction_name text,
  program_name text,
  city text,
  venue text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  seats_available integer,
  price_uah integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    p.slug,
    d.slug,
    d.name,
    p.name,
    e.city,
    e.venue,
    e.starts_at,
    e.ends_at,
    e.capacity,
    greatest(
      e.capacity - (
        select count(*)::integer
        from public.applications a
        where a.event_id = e.id
          and a.status in ('confirmed', 'deposit_paid', 'paid')
      ),
      0
    )::integer,
    p.price_uah
  from public.events e
  join public.programs p on p.slug = e.program_slug and p.is_active
  join public.directions d on d.slug = p.direction_slug and d.is_active
  where e.status = 'published'
    and (p_city is null or e.city = p_city)
    and (p_direction is null or d.slug = p_direction)
  order by e.starts_at asc;
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.list_public_events(text, text) from public;
grant execute on function public.is_admin() to anon;
grant execute on function public.list_public_events(text, text) to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.directions, public.programs to anon, authenticated;
grant select (
  id,
  program_slug,
  city,
  venue,
  starts_at,
  ends_at,
  capacity,
  status,
  created_at,
  updated_at
) on public.events to authenticated;
grant select on public.profiles to authenticated;
grant insert, update, delete on public.directions, public.programs, public.events to authenticated;
grant select, update on public.applications to authenticated;

insert into public.directions (slug, name, sort_order) values
  ('carbine', 'Карабін', 1),
  ('medicine', 'Тактична медицина', 2),
  ('bootcamp', 'Bootcamp', 3),
  ('pistol', 'Курс пістолет', 4),
  ('open-storm', 'Open Storm Battle', 5),
  ('killhouse-cqb', 'Killhouse CQB', 6);

insert into public.programs (slug, direction_slug, name, duration_label, price_uah, sort_order) values
  ('carbine-1', 'carbine', 'Карабін 1.0', '6 годин', 4950, 1),
  ('carbine-2', 'carbine', 'Карабін 2.0', '5 годин', 5500, 2),
  ('carbine-intensive', 'carbine', 'Карабін Інтенсив', '5 годин', 5950, 3),
  ('cqb-intensive', 'carbine', 'CQB Інтенсив', '8 годин', 6500, 4),
  ('anti-drone', 'carbine', 'Курс Антидрон', '5 годин', 4800, 5),
  ('night-shooting', 'carbine', 'Нічні стрільби', '4 години', 7500, 6),
  ('tccc-asm', 'medicine', 'Дводенний TCCC-ASM', '2 дні · без ночівлі · 09:00–18:00', 4200, 1),
  ('medicine-simulation', 'medicine', 'ТакМед Симуляція', '1 день · 09:00–17:00', 2500, 2),
  ('bootcamp-1', 'bootcamp', 'BootCamp 1.0', '2 дні · старт 07:50 · оборона позиції та злагодження', 6500, 1),
  ('bootcamp-2', 'bootcamp', 'BootCamp 2.0', '2 дні · старт 12:00 · після BootCamp 1.0', 7500, 2),
  ('pistol-1', 'pistol', 'Базовий курс пістолета', '2 етапи · перше заняття 6–8 годин + стрільбище', 6000, 1),
  ('storm-own', 'open-storm', 'Квиток — власне спорядження', '1 день · лише квиток · спорядження своє', 1000, 1),
  ('storm-minimum', 'open-storm', 'Мінімум — базове спорядження без форми', '1 день · квиток і базовий прокат · без форми та захисту тіла', 2000, 2),
  ('storm-optimal', 'open-storm', 'Оптимальний — базове спорядження, форма й захист', '1 день · базовий прокат, форма, наколінники та налокітники', 2350, 3),
  ('storm-maximum', 'open-storm', 'Максимум — повний комплект зі шоломом', '1 день · базовий прокат, форма, захист, плитоноска та шолом', 2700, 4),
  ('cqb-optimal', 'killhouse-cqb', 'Пакет Оптимальний CQB', '4–6 годин', 1500, 1);
