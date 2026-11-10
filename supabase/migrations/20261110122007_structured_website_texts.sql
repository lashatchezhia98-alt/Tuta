create table if not exists public.website_texts (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9._-]{1,119}$'),
  page text not null check (char_length(page) between 1 and 180),
  section text not null check (char_length(section) between 1 and 100),
  ka_text text not null check (char_length(ka_text) between 1 and 3500),
  en_text text not null check (char_length(en_text) between 1 and 3500),
  ka_style jsonb not null default '{"fontSize":16,"color":"#1E1B2E"}'::jsonb check (
    jsonb_typeof(ka_style) = 'object'
    and coalesce(ka_style->>'color', '') ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'
    and case
      when coalesce(ka_style->>'fontSize', '') ~ '^[0-9]+(\.[0-9]+)?$'
        then (ka_style->>'fontSize')::numeric between 12 and 56
      else false
    end
  ),
  en_style jsonb not null default '{"fontSize":16,"color":"#1E1B2E"}'::jsonb check (
    jsonb_typeof(en_style) = 'object'
    and coalesce(en_style->>'color', '') ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'
    and case
      when coalesce(en_style->>'fontSize', '') ~ '^[0-9]+(\.[0-9]+)?$'
        then (en_style->>'fontSize')::numeric between 12 and 56
      else false
    end
  ),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.website_texts enable row level security;
revoke all on public.website_texts from public, anon, authenticated;
grant select, insert, update, delete on public.website_texts to service_role;

create index if not exists website_texts_published_page_idx
  on public.website_texts (published, page, section);
