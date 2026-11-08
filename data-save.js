// Serialize this device's saves; the database rejects stale revisions from every writer.
let ndSaveQueue=[],ndSaving=false;
// 예전 판이 쌓아 둔 nd_unsaved_<시각> 사본(읽는 곳 없음, 하나가 문서 전체) 정리 — 가장 최근 것만 nd_unsaved_last로 남김
try{const old=Object.keys(localStorage).filter(k=>/^nd_unsaved_\d+$/.test(k)).sort();if(old.length){const last=localStorage.getItem(old.at(-1));old.forEach(k=>localStorage.removeItem(k));if(last&&localStorage.getItem('nd_unsaved_last')===null)localStorage.setItem('nd_unsaved_last',last)}}catch{}
function ndQueueSave(snapshot){
 return new Promise(resolve=>{ndSaveQueue.push({snapshot:structuredClone(snapshot),resolve});ndDrainSaves()});
}
async function ndDrainSaves(){
 if(ndSaving)return;ndSaving=true;
 try{while(ndSaveQueue.length){
  const item=ndSaveQueue.shift(),base=item.snapshot._dataRevision||0;
  try{
   const r=await ndPatchMain('',{payload:item.snapshot});   // 응답은 수정시각·저장 번호만(예전엔 문서 전체)
   if(!r.saved)throw Error(r.rows?.message||'서버에 저장하지 못했습니다.');
   const revision=r.saved.payload._dataRevision;
   for(const queued of ndSaveQueue)if((queued.snapshot._dataRevision||0)===base)queued.snapshot._dataRevision=revision;
   if((data._dataRevision||0)===base)data._dataRevision=revision;
   _ndUpdatedAt=r.saved.updated_at;_ndSaveLocal();item.resolve(true);   // 기기 저장 공간이 차도 서버 저장은 성공으로
  }catch(e){
   // 못 올린 변경은 키 하나에 덮어씀(예전엔 실패마다 문서 전체를 새 키로 쌓아 저장 공간이 찼음)
   try{localStorage.setItem('nd_unsaved_last',JSON.stringify(ndSaveQueue.at(-1)?.snapshot||item.snapshot))}catch{}
   item.resolve(false);for(const queued of ndSaveQueue)queued.resolve(false);ndSaveQueue=[];
   const dialog=document.createElement('div');dialog.className='nd-modal';dialog.id='nd-save-conflict';
   dialog.innerHTML='<div class="nd-pop employee-dialog" role="alertdialog" aria-modal="true"><div class="employee-head"><h2>저장되지 않았습니다</h2></div><div class="employee-form"><p>다른 사용자가 먼저 저장했거나 연결이 끊겼습니다. 다른 사람의 변경을 덮어쓰지 않았으며, 내 변경 내용은 이 기기에 보관했습니다.</p><p>최신 내용을 불러온 뒤 변경 사항을 다시 확인해 주세요.</p><button class="btn btn-primary">최신 내용 불러오기</button></div></div>';
   dialog.querySelector('button').onclick=async()=>{if(await _reloadRemoteData())dialog.remove();else toast('연결을 확인한 후 다시 시도해 주세요.','error')};
   if(!document.getElementById(dialog.id))document.body.appendChild(dialog);
   break;
  }
 }}finally{ndSaving=false}
}
// 투표·공지(공감·댓글)처럼 서버 최신본에 '일부만' 병합 저장한 뒤 부름. base = 병합 전 서버 리비전, saved = PATCH 응답 행.
// 내 기기 데이터가 병합 전 서버와 같은 리비전(=최신)이었고 저장 대기도 없으면 → 새 리비전·수정시각을 그대로 따라감(다음 saveData가 거부되지 않음).
// 아니면(내 기기가 뒤처짐) 리비전은 그대로 두고 전체를 서버 최신으로 다시 불러옴(_reloadRemoteData는 저장 중이면 스스로 건너뜀)
// 병합할 대상이 이미 없어(mutate가 false) 쓰지 않고 끝날 때: 방금 받은 서버본 섹션으로 맞추는 것도 같은 조건에서만(apply).
// 저장 대기 중이거나 내 기기 리비전이 다르면 섹션을 덮지 않고(내가 방금 올린 공지가 지워지는 등 방지) 전체 다시 불러오기
function ndAdoptGoneSnapshot(base,apply){
 const pend=ndSaving||ndSaveQueue.length||(typeof _lrHasPending==='function'&&_lrHasPending());
 if(!pend&&(data._dataRevision||0)===(base||0)){apply();try{localStorage.setItem(STORE_KEY,JSON.stringify(data))}catch{}}
 else if(typeof _reloadRemoteData==='function')setTimeout(()=>{_reloadRemoteData(_ndSrv.ua)},0);   // 방금 받은·저장한 서버 사본이 있으면 그걸로(다시 안 받음)
}
// apply = 저장한 섹션을 data 에 반영하는 함수 — 따라갈 때만 부름(11-08 점검: 늦게 온 응답이 그새 받은 더 새 섹션을 옛 내용으로 덮고, 다음 관리자 저장이 남의 공감을 지우던 것)
function ndAdoptMergedSave(base,saved,apply){
 if(!saved||!saved.payload)return;
 const pend=ndSaving||ndSaveQueue.length||(typeof _lrHasPending==='function'&&_lrHasPending());
 if(!pend&&(data._dataRevision||0)===(base||0)){if(apply)apply();data._dataRevision=saved.payload._dataRevision;if(saved.updated_at)_ndUpdatedAt=saved.updated_at;}
 else if(pend)_ndReloadWhenIdle();
 else if(typeof _reloadRemoteData==='function')setTimeout(()=>{_reloadRemoteData(_ndSrv.ua)},0);   // 방금 받은·저장한 서버 사본이 있으면 그걸로(다시 안 받음)
}
// 저장 중이라 미룬 다시 불러오기 — 저장 대기가 비면(1초마다 확인, 2분까지). 저장 충돌 창이 떠 있으면 그 창(최신 내용 불러오기)에 맡김
let _ndReloadLater=0;
function _ndReloadWhenIdle(){
 if(_ndReloadLater)return;
 let n=0;
 const go=()=>{
  if((typeof document!=='undefined'&&document.getElementById('nd-save-conflict'))||++n>120){_ndReloadLater=0;return;}
  if(ndSaving||ndSaveQueue.length||(typeof _lrHasPending==='function'&&_lrHasPending())){_ndReloadLater=setTimeout(go,1000);return;}
  _ndReloadLater=0;if(typeof _reloadRemoteData==='function')_reloadRemoteData(_ndSrv.ua);
 };
 _ndReloadLater=setTimeout(go,1000);
}

// ===== 서버 사본 · PC 공유 폴더 사본 (11-08, Supabase 무료 전송량 초과로 막힌 뒤) =====
// Supabase 는 '받아 가는 양'만 셈(올리기는 무료) → main 문서(약 640KB)를 덜 받는 게 핵심. 기록(원본)은 그대로 Supabase.
// _ndSrv = 이 기기가 아는 '서버와 같은' main 문서 글(JSON)과 수정시각(updated_at). 저장·받기에 성공할 때마다 맞춤.
//  · 공감·투표·휴가 병합 저장은 수정시각만 물어 이 사본과 같으면 전체를 다시 받지 않음(ndGetMainFresh)
//  · 근무표 PC 앱(ndApp.shareNames 에 'main' 이 있는 판)은 이 사본을 회사 공유 폴더에 두고, 다른 PC는 서버 대신 거기서 읽음(자리는 앱 안에만)
//  · 기기 저장본(nd_v3)이 서버본 그대로면 표시(nd_v3_srv = 수정시각+글 해시) → 다음 시작 때 바뀐 게 없으면 받지 않음(dashboard.html head)
// 서버본 '그대로'의 뜻: 받은 문서에 _migrateRemote(빈 칸 기본값·부서 이동 날짜) 를 거친 것 — 몇 번 거쳐도 같음
let _ndSrv={ua:null,json:null};
const ND_SRV_KEY='nd_v3_srv';
// 글 해시(cyrb53) — dashboard.html <head> 의 h53 과 같은 계산이어야 함(test-server-copy.cjs 가 확인)
function ndTextHash(s){let a=0xdeadbeef,b=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,2654435761);b=Math.imul(b^c,1597334677);}a=Math.imul(a^(a>>>16),2246822507)^Math.imul(b^(b>>>13),3266489909);b=Math.imul(b^(b>>>16),2246822507)^Math.imul(a^(a>>>13),3266489909);return (b>>>0).toString(36)+'.'+(a>>>0).toString(36)+'.'+s.length;}
function _ndMarkClean(ua,text){try{if(ua&&text)localStorage.setItem(ND_SRV_KEY,JSON.stringify({ua,h:ndTextHash(text)}));}catch{}}
function _ndSrvSet(ua,json,fromShare){
 if(!ua||!json)return;
 if(_ndSrv.ua&&_ndSrv.ua!==ua&&Date.parse(_ndSrv.ua)>Date.parse(ua))return;   // 더 옛 판은 무시
 _ndSrv={ua,json};
 if(!fromShare)_ndShareMirror();
}
// data 를 기기에 저장 — 서버 사본과 글자까지 같으면(내 편집이 안 섞임) '서버본 그대로' 표시도
function _ndSaveLocal(){
 let s=null;try{s=JSON.stringify(data);localStorage.setItem(STORE_KEY,s);}catch{return;}
 if(s===_ndSrv.json&&_ndSrv.ua&&_ndSrv.ua===_ndUpdatedAt)_ndMarkClean(_ndSrv.ua,s);
}
// 서버에서(또는 공유 폴더에서) 받은 그대로인 data(=_migrateRemote 결과)를 기기에 저장 + 표시 + 서버 사본
function _ndStoreServerCopy(ua,fromShare){
 let s=null;try{s=JSON.stringify(data);}catch{return;}
 try{localStorage.setItem(STORE_KEY,s);_ndMarkClean(ua,s);}catch{}   // 저장 공간이 차면 옛 저장본·옛 표시 그대로(둘은 여전히 짝이 맞음)
 _ndSrvSet(ua,s,fromShare);
}
// --- PC 앱 공유 폴더 사본(js/ 에는 자리를 쓰지 않음 — ndApp.shareRead/shareWrite 'main' = { ua, payload }) ---
function _ndShareOn(){try{const a=typeof window!=='undefined'&&window.ndApp;return !!(a&&Array.isArray(a.shareNames)&&a.shareNames.includes('main')&&a.shareRead&&a.shareWrite);}catch{return false;}}
let _ndMirrorBusy=false,_ndMirrorAgain=false;
async function _ndShareMirror(){
 if(!_ndShareOn())return;
 if(_ndMirrorBusy){_ndMirrorAgain=true;return;}
 _ndMirrorBusy=true;
 try{
  do{
   _ndMirrorAgain=false;
   for(let i=0;i<3;i++){
    const {ua,json}=_ndSrv;if(!ua||!json)break;
    const cur=await window.ndApp.shareRead('main');
    if(!cur||!cur.ok)break;
    const cua=cur.data&&cur.data.ua;
    if(cua&&(cua===ua||Date.parse(cua)>Date.parse(ua)))break;   // 이미 같거나 더 새 판
    const w=await window.ndApp.shareWrite('main',{ua,payload:JSON.parse(json)},cur.ver);
    if(!w||!w.conflict)break;   // 그새 다른 PC가 썼으면 다시 읽고 비교
   }
  }while(_ndMirrorAgain);
 }catch(e){}finally{_ndMirrorBusy=false;}
}
// 공유 폴더 사본이 수정시각 ua 판이면 그 문서, 아니면 null(3초 안에 답이 없으면 — 회사 밖 등 — 포기)
async function _ndShareCopy(ua){
 if(!ua||!_ndShareOn())return null;
 try{
  const r=await Promise.race([window.ndApp.shareRead('main'),new Promise(ok=>setTimeout(()=>ok(null),3000))]);
  const d=r&&r.ok&&r.data;
  return d&&d.ua===ua&&d.payload&&typeof d.payload==='object'&&!Array.isArray(d.payload)?d.payload:null;
 }catch(e){return null;}
}
// main 문서 저장(PATCH) — 응답은 수정시각·저장 번호만(예전엔 저장할 때마다 문서 전체를 돌려받음). cond = '&updated_at=eq.…' 같은 조건, req = fetch 대신 쓸 함수
// → { ok, status, rows, saved }: saved = { updated_at, payload } — payload = 보낸 문서 + 서버가 매긴 저장 번호(= 서버에 저장된 것) | null(실패·조건이 안 맞아 0줄)
let _ndSaveSel=true;
async function ndPatchMain(cond,body,req){
 const send=req||fetch,url=`${SB_URL}/rest/v1/nd_data?id=eq.main${cond||''}`;
 const opt={method:'PATCH',headers:{...SB_HEADERS,Prefer:'return=representation'},body:JSON.stringify(body)};
 let r=await send(_ndSaveSel?url+'&select=updated_at,rev:payload->_dataRevision':url,opt);
 if(r.status===400&&_ndSaveSel){   // 서버가 select 를 못 알아들으면(쓰기 전에 거절 — PGRST1xx) 예전 방식으로 한 번 더
  let j=null;try{j=await r.clone().json();}catch{}
  if(j&&/^PGRST1/.test(String(j.code||''))){_ndSaveSel=false;r=await send(url,opt);}
 }
 let rows=null;try{rows=await r.json();}catch{}
 const row=r.ok&&Array.isArray(rows)?rows[0]:null;
 let saved=null;
 if(row&&row.updated_at){
  if(row.payload&&typeof row.payload==='object')saved={updated_at:row.updated_at,payload:row.payload};   // 예전 방식 응답(문서 전체)
  else{const rev=Number(row.rev);if(row.rev!=null&&Number.isFinite(rev)){body.payload._dataRevision=rev;saved={updated_at:row.updated_at,payload:body.payload};}}
 }
 if(saved){try{_ndSrvSet(saved.updated_at,JSON.stringify(saved.payload));}catch{}}
 return {ok:r.ok,status:r.status,rows,saved};
}
// 병합 저장 전에 받는 서버 최신본 — 수정시각만 물어(수십 바이트) 이 기기 서버 사본과 같으면 그것, PC 앱은 공유 폴더 사본, 아니면 서버에서 전체.
// → { payload, updated_at } | null(행 없음). 못 읽으면 throw. 돌려주는 payload 는 새 객체(고쳐도 됨)
async function ndGetMainFresh(req){
 const send=req||fetch,url=`${SB_URL}/rest/v1/nd_data?id=eq.main`;
 if(_ndSrv.json||_ndShareOn()){
  const g=await send(url+'&select=updated_at',{headers:SB_HEADERS});
  if(!g.ok)throw Error('GET');
  const ua=(await g.json())?.[0]?.updated_at;
  if(ua&&ua===_ndSrv.ua)return {payload:JSON.parse(_ndSrv.json),updated_at:ua};
  const sp=ua?await _ndShareCopy(ua):null;
  if(sp){try{_ndSrvSet(ua,JSON.stringify(sp),true);}catch{}return {payload:sp,updated_at:ua};}
 }
 const g=await send(url+'&select=payload,updated_at',{headers:SB_HEADERS});
 if(!g.ok)throw Error('GET');
 const row=(await g.json())?.[0]||null;
 if(row&&row.payload&&row.updated_at){try{_ndSrvSet(row.updated_at,JSON.stringify(row.payload));}catch{}}
 return row;
}
