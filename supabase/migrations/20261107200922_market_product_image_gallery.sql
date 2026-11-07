alter table public.market_products
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

update public.market_products
set image_urls = case
  when left(image_url, 13) = 'tuta-gallery:' then substring(image_url from 14)::jsonb
  else jsonb_build_array(image_url)
end,
image_url = case
  when left(image_url, 13) = 'tuta-gallery:' then (substring(image_url from 14)::jsonb ->> 0)
  else image_url
end
where image_url is not null
  and image_url <> ''
  and image_urls = '[]'::jsonb;
