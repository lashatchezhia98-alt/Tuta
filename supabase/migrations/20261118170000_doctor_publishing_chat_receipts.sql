begin;
alter table public.articles
  add column author_doctor_id uuid references public.verified_doctors(user_id) on delete set null;

alter table public.consultation_messages
  add column delivered_at timestamptz,
  add column read_at timestamptz;
alter table public.consultation_threads
  add column typing_user_id uuid references auth.users(id) on delete set null,
  add column typing_at timestamptz;

commit;
