-- Preserve controlled editorial state history without copying private reasons or messages.
create function private.audit_editorial_decision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare previous_decision text; previous_duplicate text;
begin
 if tg_op='UPDATE' then
   previous_decision:=old.publication_decision;
   previous_duplicate:=old.duplicate_review_status;
   if old.publication_decision is not distinct from new.publication_decision
    and old.duplicate_review_status is not distinct from new.duplicate_review_status
    and old.canonical_company_id is not distinct from new.canonical_company_id then return new; end if;
 end if;
 insert into private.audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,change_summary)
 values(auth.uid(),case when auth.uid() is null then 'system' else 'staff' end,
 'editorial_decision','private.company_editorial',new.company_id::text,
 jsonb_build_object('previous_decision',previous_decision,'decision',new.publication_decision,
 'previous_duplicate_review',previous_duplicate,'duplicate_review',new.duplicate_review_status,
 'canonical_company_id',new.canonical_company_id));
 return new;
end $$;
revoke all on function private.audit_editorial_decision() from public,anon,authenticated;
create trigger audit_editorial_decision after insert or update on private.company_editorial
 for each row execute function private.audit_editorial_decision();
