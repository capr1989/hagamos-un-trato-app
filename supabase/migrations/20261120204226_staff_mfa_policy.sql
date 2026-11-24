-- Staged staff MFA: existing roles keep AAL1 until individual enrollment and
-- an explicitly approved activation. Roles inserted after this migration need AAL2.
alter table private.staff_roles add column mfa_required boolean not null default false;
alter table private.staff_roles alter column mfa_required set default true;

create or replace function private.has_staff_role(required_role text default null) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
   select 1 from private.staff_roles s
   where s.user_id = auth.uid() and s.status = 'active'
     and (required_role is null or s.role = required_role)
     and (not s.mfa_required or auth.jwt()->>'aal' = 'aal2')
 )
$$;

-- Returns only the caller's active staff role and enrollment requirement.
-- This lets an AAL1 staff member reach the TOTP setup screen while all
-- privileged reads and writes remain behind has_staff_role.
create function private.staff_mfa_context() returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce((
   select jsonb_build_object('role',s.role,'mfa_required',s.mfa_required)
   from private.staff_roles s where s.user_id = auth.uid() and s.status = 'active'
 ), jsonb_build_object('role',null,'mfa_required',false))
$$;
revoke all on function private.staff_mfa_context() from public, anon, authenticated;
grant execute on function private.staff_mfa_context() to authenticated;

create or replace function public.qa_staff_context() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('user_id',auth.uid()) || private.staff_mfa_context()
$$;
