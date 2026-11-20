-- Test-only compatibility shim. NEVER apply to Supabase; real local Supabase already has Auth.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(coalesce(current_setting('request.jwt.claim.sub',true),current_setting('request.jwt.claims',true)::jsonb->>'sub'),'')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
grant execute on function auth.jwt() to anon,authenticated,service_role;
