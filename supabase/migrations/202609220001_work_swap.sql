create table if not exists public.nd_swaps (
 id uuid primary key, requester text not null, recipient text not null,
 doc jsonb not null, revision integer not null default 1,
 created_at timestamptz not null default now()
);
alter table public.nd_swaps enable row level security;
revoke all on public.nd_swaps from anon, authenticated;
create table if not exists public.nd_swap_admins (staff_id text primary key);
alter table public.nd_swap_admins enable row level security;
revoke all on public.nd_swap_admins from anon, authenticated;
create or replace function public.nd_swap_commit(p_id uuid,p_revision int,p_doc jsonb,p_version timestamptz default null,p_payload jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare r public.nd_swaps; v timestamptz;
begin
 select * into r from nd_swaps where id=p_id for update;
 if not found or r.revision<>p_revision then raise exception '신청이 변경되었습니다. 다시 확인하세요.'; end if;
 if p_payload is not null then
   select updated_at into v from nd_data where id='main' for update;
   if v is distinct from p_version then raise exception '근무표가 변경되었습니다. 새로고침 후 다시 승인하세요.'; end if;
   update nd_data set payload=p_payload,updated_at=clock_timestamp() where id='main';
 end if;
 update nd_swaps set doc=p_doc,revision=revision+1 where id=p_id;
end $$;
revoke all on function public.nd_swap_commit(uuid,int,jsonb,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.nd_swap_commit(uuid,int,jsonb,timestamptz,jsonb) to service_role;

-- Reject saves from a browser that has not yet loaded an approved exchange.
create or replace function public.nd_guard_swap_revision()
returns trigger language plpgsql set search_path=public as $$
begin
 if old.id='main' and coalesce((new.payload->>'_swapRevision')::bigint,0)<coalesce((old.payload->>'_swapRevision')::bigint,0) then
   raise exception '승인된 근무 교환이 있습니다. 새로고침 후 다시 저장하세요.';
 end if;
 return new;
end $$;
drop trigger if exists nd_guard_swap_revision on public.nd_data;
create trigger nd_guard_swap_revision before update on public.nd_data for each row execute function public.nd_guard_swap_revision();
