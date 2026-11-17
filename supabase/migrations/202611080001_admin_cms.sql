alter table public.directions
  add column if not exists summary text not null default '',
  add column if not exists hero_image_url text,
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '',
  add column if not exists page_content jsonb not null default '{}'::jsonb;

alter table public.programs
  add column if not exists description text not null default '',
  add column if not exists image_url text,
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '',
  add column if not exists details jsonb not null default '{}'::jsonb;

create table public.site_pages (
  slug text primary key,
  name text not null,
  is_published boolean not null default true,
  seo_title text not null default '',
  seo_description text not null default '',
  blocks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(blocks) = 'array'),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  callsign text not null default '',
  role text not null default '',
  bio text not null default '',
  photo_url text,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

insert into public.instructors (name, callsign, role, bio, sort_order)
values
  ('Олексій', 'Психолог', 'Інструктор · ветеран «Азову»', 'Навчає тактичної взаємодії малих груп.', 1),
  ('Віталій', 'Бойко', 'Головний інструктор · ветеран «Азову»', 'Відповідає за вогневу підготовку та навчання безпечного володіння зброєю.', 2),
  ('Техно', '', 'Інструктор з вогневої підготовки', 'Допомагає цивільним опановувати військову справу.', 3);

create table public.site_theme (
  id boolean primary key default true check (id),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

insert into public.site_theme (id, settings)
values (
  true,
  '{
    "colors": {
      "background": "#08090B",
      "surface": "#121315",
      "surfaceRaised": "#16181C",
      "text": "#F1F3F7",
      "muted": "#A3A6A8",
      "brand": "#B7312C",
      "cta": "#FF5722",
      "status": "#10B981"
    },
    "fonts": {
      "heading": "JetBrains Mono",
      "body": "system-ui"
    }
  }'::jsonb
)
on conflict (id) do nothing;

create or replace function public.touch_cms_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger site_pages_touch_updated_at
before update on public.site_pages
for each row execute function public.touch_cms_record();

create trigger instructors_touch_updated_at
before update on public.instructors
for each row execute function public.touch_cms_record();

create trigger site_theme_touch_updated_at
before update on public.site_theme
for each row execute function public.touch_cms_record();

alter table public.site_pages enable row level security;
alter table public.instructors enable row level security;
alter table public.site_theme enable row level security;

create policy "Public can read published site pages"
on public.site_pages for select to anon, authenticated
using (is_published or (select public.is_admin()));

create policy "Admins can manage site pages"
on public.site_pages for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace function public.is_site_page_published(target_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select page.is_published from public.site_pages as page where page.slug = target_slug),
    true
  );
$$;

revoke all on function public.is_site_page_published(text) from public;
grant execute on function public.is_site_page_published(text) to anon, authenticated;

create policy "Public can read active instructors"
on public.instructors for select to anon, authenticated
using (is_active or (select public.is_admin()));

create policy "Admins can manage instructors"
on public.instructors for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Public can read site theme"
on public.site_theme for select to anon, authenticated
using (id);

create policy "Admins can manage site theme"
on public.site_theme for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select, insert, update, delete
on public.site_pages, public.instructors, public.site_theme
to authenticated;
grant select on public.site_pages, public.instructors, public.site_theme
to anon, authenticated;
grant update on public.directions, public.programs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read site media"
on storage.objects for select to anon, authenticated
using (bucket_id = 'site-media');

create policy "Admins can upload site media"
on storage.objects for insert to authenticated
with check (bucket_id = 'site-media' and (select public.is_admin()));

create policy "Admins can update site media"
on storage.objects for update to authenticated
using (bucket_id = 'site-media' and (select public.is_admin()))
with check (bucket_id = 'site-media' and (select public.is_admin()));

create policy "Admins can delete site media"
on storage.objects for delete to authenticated
using (bucket_id = 'site-media' and (select public.is_admin()));
