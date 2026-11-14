begin;
create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index account_deletion_requests_time_idx on public.account_deletion_requests(requested_at);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated, service_role;
grant select, insert(user_id), delete on public.account_deletion_requests to authenticated;
grant select on public.account_deletion_requests to service_role;
create policy account_deletion_request_read on public.account_deletion_requests for select to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
create policy account_deletion_request_insert on public.account_deletion_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
create policy account_deletion_request_withdraw on public.account_deletion_requests for delete to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
commit;
