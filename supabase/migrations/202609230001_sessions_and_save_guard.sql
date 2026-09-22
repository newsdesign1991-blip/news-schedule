create table if not exists public.nd_admin_sessions (
 token_hash text primary key, mode text not null check(mode in ('admin','master')),
 credential_hash text not null, expires_at timestamptz not null
);
alter table public.nd_admin_sessions enable row level security;
revoke all on public.nd_admin_sessions from anon,authenticated;
grant all on public.nd_admin_sessions to service_role;
-- Every writer, including older apps and server functions, must submit the version read.
create or replace function public.nd_guard_data_revision() returns trigger
language plpgsql set search_path=public as $$
begin
 if old.id='main' then
  if coalesce((new.payload->>'_dataRevision')::bigint,0) <> coalesce((old.payload->>'_dataRevision')::bigint,0) then
   raise exception '다른 사용자의 변경이 있습니다. 최신 내용을 확인한 후 다시 저장하세요.' using errcode='40001';
  end if;
  new.payload=jsonb_set(new.payload,'{_dataRevision}',to_jsonb(coalesce((old.payload->>'_dataRevision')::bigint,0)+1));
  new.updated_at=clock_timestamp();
 end if;
 return new;
end $$;
drop trigger if exists nd_guard_data_revision on public.nd_data;
create trigger nd_guard_data_revision before update on public.nd_data for each row execute function public.nd_guard_data_revision();
-- Bootstrap the guard without changing any schedules or staff information.
update public.nd_data set payload=payload where id='main' and not(payload ? '_dataRevision');
-- The user cancelled push delivery in favour of an in-app acknowledgement.
insert into public.nd_login_upgrade_notice(campaign,result)
values('password-login-20260922','{"cancelled":true,"sent":0,"reason":"User requested in-app notice instead"}'::jsonb)
on conflict(campaign) do nothing;
