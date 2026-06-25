-- push_subs: 익명(anon) 사용자가 자신의 기기 구독을 등록/삭제할 수 있게 허용.
-- 단, SELECT는 막아 다른 사람의 구독 endpoint가 노출되지 않게 함.
-- Edge Function은 service_role로 읽으므로 RLS 영향 없음.
-- 이 푸시 알림이 안 올 때, 폰에서 알림 재허용 시 "구독 저장 실패 (HTTP 401/403)"이
-- 뜨면 이 스크립트를 Supabase SQL Editor에서 한 번 실행하세요.

alter table public.push_subs enable row level security;

drop policy if exists "anon can insert own sub" on public.push_subs;
create policy "anon can insert own sub"
  on public.push_subs for insert to anon
  with check (true);

drop policy if exists "anon can delete own sub" on public.push_subs;
create policy "anon can delete own sub"
  on public.push_subs for delete to anon
  using (true);
