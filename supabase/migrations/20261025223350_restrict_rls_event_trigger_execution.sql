-- The ensure_rls event trigger runs on DDL; API clients do not need to invoke
-- its SECURITY DEFINER function directly.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
