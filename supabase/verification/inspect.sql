-- Read-only checks via DIRECT Supabase MCP only. First verify get_project_url returns https://lewlduoqmsdnmxfichus.supabase.co.
-- No get_project/account administration, hosted CLI or dashboard fallback.
select current_database() as database_name, version() as postgres_version;
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private') and c.relkind='r' order by 1,2;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_catalog.pg_policies where schemaname in ('public','private') order by 1,2,3;
select conrelid::regclass::text as relation_name,conname,contype,pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint where connamespace in ('public'::regnamespace,'private'::regnamespace) order by 1,2;
select n.nspname,p.proname,p.prosecdef,p.proconfig,p.proacl
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') order by 1,2;
select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role') order by 1,2,3,4;
select count(*) as companies_seeded from public.companies;
select count(*) as active_markets from public.directory_markets where status='active';
select c.code as category_code,count(s.id) as services from public.categories c
left join public.services s on s.category_id=c.id group by c.code order by c.code;
