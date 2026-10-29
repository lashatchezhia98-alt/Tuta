-- Transactional access-control check. No health record is kept by this test.
begin;

do $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', (select id from auth.users where is_anonymous is false limit 1),
    'role', 'authenticated', 'is_anonymous', false
  )::text, true);
end;
$$;

set local role authenticated;

insert into public.health_state (user_id, payload)
values (auth.uid(), '{"version":1,"lang":"ka","name":"","cycleLength":28,"periods":[{"start":"2026-10-01","duration":5}],"logs":[]}');

update public.health_state
set payload = jsonb_set(payload, '{cycleLength}', '29'),
    revision = revision + 1
where user_id = auth.uid() and revision = 1;

select
  (select count(*) = 1 from public.health_state where user_id = auth.uid()
    and revision = 2 and payload->>'cycleLength' = '29') as owner_can_read_and_update,
  (select count(*) = 0 from public.health_state where user_id <> auth.uid()) as no_other_records_visible;

do $$
begin
  if not exists(select 1 from public.health_state
    where user_id = auth.uid() and revision = 2
      and payload->>'cycleLength' = '29') then
    raise exception 'Owner could not update health state';
  end if;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);

select count(*) = 0 as other_member_cannot_read from public.health_state;

rollback;
