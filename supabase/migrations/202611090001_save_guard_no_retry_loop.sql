-- 2026-11-09: 저장 번호 검사 오류 코드를 40001 → PT409 로.
-- 40001(serialization_failure)은 PostgREST 14 가 '잠깐 겹친 것'으로 보고 같은 저장을 끝없이 다시 실행함
-- (https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)
-- → 뒤처진 기기의 저장 1번마다 서버 안에서 초당 100번씩 영원히 반복, DB CPU 90%대. PT409 는 바로 HTTP 409 로 돌려줌.
-- 검사 내용(번호가 다르면 거부, 받으면 +1·수정시각)은 그대로.
create or replace function public.nd_guard_data_revision() returns trigger
language plpgsql set search_path=public as $$
begin
 if old.id='main' then
  if coalesce((new.payload->>'_dataRevision')::bigint,0) <> coalesce((old.payload->>'_dataRevision')::bigint,0) then
   raise exception '다른 사용자의 변경이 있습니다. 최신 내용을 확인한 후 다시 저장하세요.' using errcode='PT409';
  end if;
  new.payload=jsonb_set(new.payload,'{_dataRevision}',to_jsonb(coalesce((old.payload->>'_dataRevision')::bigint,0)+1));
  new.updated_at=clock_timestamp();
 end if;
 return new;
end $$;
