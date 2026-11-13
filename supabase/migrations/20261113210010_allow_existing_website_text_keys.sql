-- Existing website-copy IDs are case-sensitive and include camelCase segments.
alter table public.website_texts
  drop constraint website_texts_key_check,
  add constraint website_texts_key_check
    check (key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$');
