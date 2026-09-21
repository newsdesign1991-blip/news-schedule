create table if not exists public.nd_employee_accounts (
 staff_id text primary key, pin text not null default '000000' check(pin ~ '^[0-9]{6}$'),
 must_change boolean not null default true, version integer not null default 1,
 updated_at timestamptz not null default now()
);
create table if not exists public.nd_employee_sessions (
 token_hash text primary key, staff_id text not null references public.nd_employee_accounts(staff_id),
 version integer not null, expires_at timestamptz not null
);
alter table public.nd_employee_accounts enable row level security;
alter table public.nd_employee_sessions enable row level security;
revoke all on public.nd_employee_accounts,public.nd_employee_sessions from anon,authenticated;
grant all on public.nd_employee_accounts,public.nd_employee_sessions to service_role;

create or replace function public.nd_employee_pin_change(p_staff text,p_version int,p_pin text,p_reset boolean default false)
returns integer language plpgsql security definer set search_path=public as $$
declare next_version integer;
begin
 if p_pin !~ '^[0-9]{6}$' or (not p_reset and p_pin='000000') or (p_reset and p_pin<>'000000') then raise exception '숫자 6자리의 새 비밀번호를 입력하세요.';end if;
 update nd_employee_accounts set pin=p_pin,must_change=p_reset,version=version+1,updated_at=now()
 where staff_id=p_staff and version=p_version returning version into next_version;
 if not found then raise exception '계정이 변경되었습니다. 다시 로그인해 주세요.';end if;
 delete from nd_employee_sessions where staff_id=p_staff;
 return next_version;
end $$;
revoke all on function public.nd_employee_pin_change(text,int,text,boolean) from public,anon,authenticated;
grant execute on function public.nd_employee_pin_change(text,int,text,boolean) to service_role;
