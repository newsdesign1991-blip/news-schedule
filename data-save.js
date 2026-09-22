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
