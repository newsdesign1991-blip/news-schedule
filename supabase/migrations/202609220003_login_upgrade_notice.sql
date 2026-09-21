create table if not exists public.nd_login_upgrade_notice (
 campaign text primary key,
 started_at timestamptz not null default now(),
 result jsonb
);
alter table public.nd_login_upgrade_notice enable row level security;
revoke all on public.nd_login_upgrade_notice from anon, authenticated;
grant all on public.nd_login_upgrade_notice to service_role;
