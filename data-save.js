// Serialize this device's saves; the database rejects stale revisions from every writer.
let ndSaveQueue=[],ndSaving=false;
function ndQueueSave(snapshot){
 return new Promise(resolve=>{ndSaveQueue.push({snapshot:structuredClone(snapshot),resolve});ndDrainSaves()});
}
async function ndDrainSaves(){
 if(ndSaving)return;ndSaving=true;
 try{while(ndSaveQueue.length){
  const item=ndSaveQueue.shift(),base=item.snapshot._dataRevision||0;
  try{
   const res=await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.main`,{method:'PATCH',headers:{...SB_HEADERS,Prefer:'return=representation'},body:JSON.stringify({payload:item.snapshot})});
   const rows=await res.json();if(!res.ok||!rows?.[0]?.payload)throw Error(rows.message||'서버에 저장하지 못했습니다.');
   const revision=rows[0].payload._dataRevision;
   for(const queued of ndSaveQueue)if((queued.snapshot._dataRevision||0)===base)queued.snapshot._dataRevision=revision;
   if((data._dataRevision||0)===base)data._dataRevision=revision;
   _ndUpdatedAt=rows[0].updated_at;localStorage.setItem(STORE_KEY,JSON.stringify(data));item.resolve(true);
  }catch(e){
   try{localStorage.setItem('nd_unsaved_'+Date.now(),JSON.stringify(ndSaveQueue.at(-1)?.snapshot||item.snapshot))}catch{}
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
 else if(typeof _reloadRemoteData==='function')setTimeout(()=>{_reloadRemoteData()},0);
}
function ndAdoptMergedSave(base,saved){
 if(!saved||!saved.payload)return;
 const pend=ndSaving||ndSaveQueue.length||(typeof _lrHasPending==='function'&&_lrHasPending());
 if(!pend&&(data._dataRevision||0)===(base||0)){data._dataRevision=saved.payload._dataRevision;if(saved.updated_at)_ndUpdatedAt=saved.updated_at;}
 else if(typeof _reloadRemoteData==='function')setTimeout(()=>{_reloadRemoteData()},0);
}
