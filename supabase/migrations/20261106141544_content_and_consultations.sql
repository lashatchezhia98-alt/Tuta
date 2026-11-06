begin;
create table public.articles (
 id uuid primary key default gen_random_uuid(),
 title_ka text not null check(length(title_ka) between 1 and 180),
 title_en text not null default '' check(length(title_en)<=180),
 body_ka text not null check(length(body_ka) between 1 and 6000),
 body_en text not null default '' check(length(body_en)<=6000),
 category text not null check(category in ('cycle','pregnancy','nutrition','mental-health')),
 status text not null default 'draft' check(status in ('draft','published','scheduled')),
 publish_at timestamptz,
 updated_at timestamptz not null default now(),
 check(status='draft' or publish_at is not null)
);
create index articles_published_idx on public.articles(publish_at desc) where status in ('published','scheduled');
alter table public.articles enable row level security;
revoke all on public.articles from public,anon,authenticated;
grant all on public.articles to service_role;
-- Content is served through a feature-aware server endpoint. No direct public grants.

create table public.doctor_profiles (
 user_id uuid primary key references public.verified_doctors(user_id) on delete cascade,
 specialty text not null check(length(specialty) between 1 and 120),
 bio text not null default '' check(length(bio)<=2000),
 active boolean not null default false
);
create table public.consultation_slots (
 id uuid primary key default gen_random_uuid(),
 doctor_id uuid not null references public.doctor_profiles(user_id) on delete cascade,
 starts_at timestamptz not null,
 location text not null check(length(location) between 1 and 200),
 unique(doctor_id,starts_at),
 check(extract(minute from starts_at) in (0,30) and extract(second from starts_at)=0)
);
create table public.consultation_bookings (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references public.consultation_slots(id),
 patient_id uuid not null references auth.users(id) on delete cascade,
 patient_label text not null check(length(patient_label) between 1 and 100),
 status text not null default 'confirmed' check(status in ('confirmed','cancelled')),
 created_at timestamptz not null default now()
);
create unique index consultation_slot_reserved on public.consultation_bookings(slot_id) where status='confirmed';
create index consultation_patient_idx on public.consultation_bookings(patient_id,created_at desc);
create table public.consultation_threads (
 id uuid primary key default gen_random_uuid(),
 doctor_id uuid not null references public.doctor_profiles(user_id),
 patient_id uuid not null references auth.users(id) on delete cascade,
 patient_label text not null check(length(patient_label) between 1 and 100),
 created_at timestamptz not null default now(),
 unique(doctor_id,patient_id),check(doctor_id<>patient_id)
);
create index consultation_thread_patient_idx on public.consultation_threads(patient_id);
create table public.consultation_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.consultation_threads(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index consultation_messages_thread_idx on public.consultation_messages(thread_id,created_at desc);
create index consultation_messages_sender_idx on public.consultation_messages(sender_id,created_at desc);
alter table public.doctor_profiles enable row level security;
alter table public.consultation_slots enable row level security;
alter table public.consultation_bookings enable row level security;
alter table public.consultation_threads enable row level security;
alter table public.consultation_messages enable row level security;
revoke all on public.doctor_profiles,public.consultation_slots,public.consultation_bookings,public.consultation_threads,public.consultation_messages from public,anon,authenticated;
grant all on public.doctor_profiles,public.consultation_slots,public.consultation_bookings,public.consultation_threads,public.consultation_messages to service_role;
-- Only authenticated, participant-scoped server endpoints can access care data.
-- Neither site admins nor doctors are given access to health_state through these tables.
grant all on public.site_settings to service_role;
create function public.guard_consultation_message() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.consultation_threads t where t.id=new.thread_id and new.sender_id in (t.patient_id,t.doctor_id)) then
   raise exception 'Not a participant';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,0));
 if exists(select 1 from public.consultation_messages where sender_id=new.sender_id and created_at>now()-interval '2 seconds') then
   raise exception 'Rate limited';
 end if;
 return new;
end $$;
revoke all on function public.guard_consultation_message() from public,anon,authenticated;
grant execute on function public.guard_consultation_message() to service_role;
create trigger consultation_message_guard before insert on public.consultation_messages for each row execute function public.guard_consultation_message();
commit;
