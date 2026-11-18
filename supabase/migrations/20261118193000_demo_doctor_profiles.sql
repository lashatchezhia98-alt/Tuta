begin;
create table public.doctor_demo_profiles (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  specialty text not null check (length(specialty) between 1 and 120),
  bio text not null default '' check (length(bio) <= 2000),
  photo_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.doctor_demo_profiles enable row level security;
revoke all on public.doctor_demo_profiles from public, anon, authenticated;
grant all on public.doctor_demo_profiles to service_role;
insert into public.doctor_demo_profiles(first_name,last_name,specialty,bio,photo_url) values
('ანა','დემო','მეან-გინეკოლოგია','სატესტო დემო პროფილია. ეს პიროვნება ექიმი არ არის და კონსულტაციას არ ატარებს.','/demo-doctors/ana.svg'),
('მარი','დემო','ოჯახის მედიცინა','სატესტო დემო პროფილია. ეს პიროვნება ექიმი არ არის და კონსულტაციას არ ატარებს.','/demo-doctors/mari.svg'),
('ელენე','დემო','ენდოკრინოლოგია','სატესტო დემო პროფილია. ეს პიროვნება ექიმი არ არის და კონსულტაციას არ ატარებს.','/demo-doctors/elene.svg');
commit;
