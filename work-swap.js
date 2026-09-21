// Work-swap requests are stored independently of the schedule and committed by the server.
let swapRows=[],swapSelected=null,swapAdminPassword='',swapAdminView=false,swapBusy=false,swapLoaded=false;
let swapDeepLink=new URL(location.href).searchParams.get('swap'),swapReturnFocus=null;
const swapStatus={pending:'상대방 확인 대기',accepted:'관리자 승인 대기',approved:'승인 · 반영 완료',rejected:'상대방 거절',declined:'관리자 반려',cancelled:'신청 취소'};
const swapEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const swapName=id=>staffById(id)?.name||'직원';
async function swapApi(action,extra={}){
 if(!currentUser?.staffId)throw Error('로그인 후 이용해 주세요.');
 if(isAdminTest&&action!=='list')throw Error('관리자 테스트 모드에서는 변경할 수 없습니다.');
 const res=await fetch(`${SB_URL}/functions/v1/work-swap`,{method:'POST',headers:SB_HEADERS,body:JSON.stringify({action,staffId:currentUser.staffId,deviceId:_deviceId(),...(swapAdminView?{admin:true,adminPassword:swapAdminPassword}:{}),...extra})});
 const result=await res.json();if(!res.ok||result.error)throw Error(result.error||'요청을 처리하지 못했습니다.');return result;
}
function closeWorkSwap(){document.getElementById('swap-modal')?.remove();swapSelected=null;swapAdminView=false;swapReturnFocus?.focus();}
function swapShell(title,body){
 let modal=document.getElementById('swap-modal');if(!modal){modal=document.createElement('div');modal.id='swap-modal';modal.className='nd-modal';modal.addEventListener('click',e=>{if(e.target===modal)closeWorkSwap()});modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeWorkSwap()}if(e.key==='Tab'){const a=[...modal.querySelectorAll('button,input,textarea,select')].filter(x=>!x.disabled&&x.getClientRects().length);if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0]?.focus()}}});document.body.appendChild(modal)}
 modal.innerHTML=`<div class="nd-pop swap-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-title"><div class="swap-head"><div><b id="swap-title">${title}</b><p>정근 교환 · 상대방 수락 후 관리자 승인</p></div><button aria-label="닫기" onclick="closeWorkSwap()">×</button></div><div class="swap-body">${body}</div><div id="swap-error" role="status" aria-live="polite"></div></div>`;
}
function swapError(e){const el=document.getElementById('swap-error');if(el)el.textContent=e.message||e;else toast(e.message||String(e),'error')}
async function openWorkSwap(admin=false){
 if(!currentUser?.staffId){toast('로그인 후 이용해 주세요.','error');return}
 swapReturnFocus=document.activeElement;swapAdminView=!!admin&&isAdmin;swapSelected=null;
 if(swapAdminView&&!swapAdminPassword){swapShell('근무 교환 관리',`<form onsubmit="event.preventDefault();swapUnlock()"><p>승인 처리를 위해 관리자 비밀번호를 확인합니다.</p><input id="swap-admin-password" type="password" autocomplete="current-password" placeholder="관리자 비밀번호" required><button class="swap-primary" type="submit">확인</button></form>`);document.getElementById('swap-admin-password').focus();return}
 swapShell(admin?'근무 교환 관리':'근무 교환', '<p>신청 목록을 불러오는 중입니다.</p>');
 try{await swapLoad();swapPresent()}catch(e){swapError(e)}
}
function swapPresent(){if(swapDeepLink&&swapRows.some(r=>r.id===swapDeepLink)){const id=swapDeepLink;swapClearLink();swapDetail(id)}else swapRenderList()}
function swapClearLink(){swapDeepLink=null;const url=new URL(location.href);url.searchParams.delete('swap');history.replaceState(null,'',url.pathname+url.search+url.hash)}
async function swapUnlock(){swapAdminPassword=document.getElementById('swap-admin-password').value;try{await swapLoad();await swapApi('registerAdmin');swapPresent()}catch(e){swapAdminPassword='';swapError(e)}}
async function swapLoad(){const r=await swapApi('list');swapRows=r.requests;swapLoaded=true;swapBadge();return r}
function swapBadge(){const sid=currentUser?.staffId;const seen=JSON.parse(localStorage.getItem('nd_swap_seen_'+sid)||'{}');const n=swapRows.filter(r=>(r.recipient===sid&&r.status==='pending')||(isAdmin&&swapAdminView&&r.status==='accepted')||r.updatedAt>(seen[r.id]||'')).length;document.querySelectorAll('.swap-count').forEach(e=>e.textContent=n?' '+n:'');const host=document.getElementById('swap-admin-summary');if(host)host.textContent='상대방이 수락한 신청을 확인하고 최종 승인합니다.';}
function swapRenderList(){
 swapSelected=null;
 const rows=swapAdminView?swapRows.filter(r=>r.status==='accepted').concat(swapRows.filter(r=>r.status!=='accepted')):swapRows;
 swapShell(swapAdminView?'근무 교환 관리':'근무 교환',`${!swapAdminView?'<button class="swap-primary" onclick="swapNew()">＋ 근무 교환 신청</button>':''}<div class="swap-list">${rows.map(r=>`<button class="swap-row" onclick="swapDetail('${r.id}')"><span class="swap-state" data-status="${r.status}">${swapStatus[r.status]}</span><b>${swapEsc(swapName(r.requester))} ↔ ${swapEsc(swapName(r.recipient))}</b><span>${r.from} ↔ ${r.to}</span><small>대화 ${(r.messages||[]).length}개 · 상세 보기</small></button>`).join('')||'<p class="swap-empty">근무 교환 신청이 없습니다.</p>'}</div>`);
}
function swapNew(){
 swapSelected=null;const today=_bkToday();
 swapShell('근무 교환 신청',`<button class="swap-back" onclick="swapRenderList()">‹ 신청 목록</button><form onsubmit="event.preventDefault();swapCreate()"><div class="swap-section"><label>교환 상대<select id="swap-recipient" required><option value="">직원 선택</option>${getStaff().filter(s=>s.id!==currentUser.staffId).map(s=>`<option value="${swapEsc(s.id)}">${swapEsc(s.name)} · ${swapEsc(s.dept)}</option>`).join('')}</select></label><div class="swap-dates"><label>내 정근일<input id="swap-from" type="date" min="${today}" required></label><label>상대방 정근일<input id="swap-to" type="date" min="${today}" required></label></div><p class="swap-hint">각자 정근인 날짜를 선택하세요. 서로 대신 근무할 날은 휴무여야 합니다. 당직·8진·데스크·휴가 등은 교환 대상이 아닙니다.</p></div><label>신청 메시지 (선택)<textarea id="swap-reason" maxlength="1000" rows="3" placeholder="교환 사유를 간단히 남겨 주세요."></textarea></label><button type="submit" class="swap-primary">교환 신청</button></form>`);
}
async function swapCreate(){if(swapBusy)return;swapBusy=true;const fields={recipient:document.getElementById('swap-recipient').value,from:document.getElementById('swap-from').value,to:document.getElementById('swap-to').value,text:document.getElementById('swap-reason').value};try{const r=await swapApi('create',fields);await swapLoad();swapDetail(r.request.id);toast('교환 신청을 보냈습니다.','success')}catch(e){swapError(e)}finally{swapBusy=false}}
function swapDetail(id){
 const r=swapRows.find(r=>r.id===id);if(!r)return;swapSelected=id;
 const sid=currentUser.staffId,seen=JSON.parse(localStorage.getItem('nd_swap_seen_'+sid)||'{}');seen[id]=r.updatedAt;localStorage.setItem('nd_swap_seen_'+sid,JSON.stringify(seen));swapBadge();
 const buttons=[];
 if(r.status==='pending'&&r.recipient===sid){buttons.push(['accept','수락'],['reject','거절'])}
 if(['pending','accepted'].includes(r.status)&&r.requester===sid)buttons.push(['cancel','신청 취소']);
 if(swapAdminView&&r.status==='accepted')buttons.push(['approve','승인하고 근무표 반영'],['decline','반려']);
 swapShell('근무 교환 상세',`<button class="swap-back" onclick="swapRenderList()">‹ 신청 목록</button><div class="swap-section"><span class="swap-state" data-status="${r.status}">${swapStatus[r.status]}</span><div class="swap-summary"><div><b>${r.from}</b><span>${swapEsc(swapName(r.requester))} 정근 → ${swapEsc(swapName(r.recipient))}</span></div><div><b>${r.to}</b><span>${swapEsc(swapName(r.recipient))} 정근 → ${swapEsc(swapName(r.requester))}</span></div></div><p class="swap-hint">관리자가 승인해야 근무표에 반영됩니다.</p><div class="swap-actions">${buttons.map(([a,t])=>`<button ${a==='approve'||a==='accept'?'class="swap-primary"':''} onclick="swapAct('${a}')">${t}</button>`).join('')}</div></div><details><summary>처리 이력</summary>${(r.history||[]).map(h=>`<p class="swap-hint">${swapEsc(swapName(h.actor))} · ${swapStatus[h.status]} · ${new Date(h.at).toLocaleString('ko-KR')}</p>`).join('')}</details><h3>대화</h3><div id="swap-chat" aria-live="polite">${swapChatHtml(r)}</div><form onsubmit="event.preventDefault();swapChat()" class="swap-chat-form"><textarea id="swap-message" maxlength="1000" rows="2" placeholder="메시지 입력" aria-label="교환 신청 대화"></textarea><button type="submit" class="swap-primary">보내기</button></form>`);
}
function swapChatHtml(r){return (r.messages||[]).map(m=>`<div class="swap-message ${m.actor===currentUser.staffId?'mine':''}"><small>${swapEsc(swapName(m.actor))} · ${new Date(m.at).toLocaleString('ko-KR')}</small><p>${swapEsc(m.text)}</p></div>`).join('')||'<p class="swap-hint">이 신청에 대해 간단히 대화해 보세요.</p>'}
async function swapAct(action){if(swapBusy)return;const r=swapRows.find(x=>x.id===swapSelected);if(!r)return;if(['approve','decline','reject','cancel'].includes(action)&&!confirm(action==='approve'?'두 날짜의 정근을 교환하고 근무표에 반영할까요?':'이 신청을 '+({decline:'반려',reject:'거절',cancel:'취소'}[action])+'할까요?'))return;swapBusy=true;try{await swapApi(action,{id:r.id,revision:r.revision});await swapLoad();swapDetail(r.id);if(action==='approve'){await _reloadRemoteData();}toast('처리되었습니다.','success')}catch(e){swapError(e);await swapLoad().catch(()=>{})}finally{swapBusy=false}}
async function swapChat(){if(swapBusy)return;const r=swapRows.find(x=>x.id===swapSelected),input=document.getElementById('swap-message'),text=input.value.trim();if(!r||!text)return;swapBusy=true;try{await swapApi('chat',{id:r.id,revision:r.revision,text});input.value='';await swapLoad();swapDetail(r.id)}catch(e){swapError(e);await swapLoad().catch(()=>{})}finally{swapBusy=false}}
async function swapPoll(){
 if(document.hidden||!currentUser?.staffId||swapBusy)return;
 if(!isAdmin){swapAdminPassword='';swapAdminView=false}
 try{const old=swapRows,loaded=swapLoaded;await swapLoad();if(loaded&&swapRows.some(r=>r.updatedAt!==old.find(x=>x.id===r.id)?.updatedAt))toast('근무 교환에 새로운 소식이 있습니다.');
 if(loaded&&swapRows.some(r=>r.status==='approved'&&old.find(x=>x.id===r.id)?.status!=='approved'))await _reloadRemoteData();
 if(document.querySelector('#swap-modal .swap-list')&&JSON.stringify(old)!==JSON.stringify(swapRows))swapRenderList();
 if(swapSelected&&document.getElementById('swap-chat')){const r=swapRows.find(x=>x.id===swapSelected),prev=old.find(x=>x.id===swapSelected);if(r&&r.updatedAt!==prev?.updatedAt){const input=document.getElementById('swap-message'),draft=input?.value||'';swapDetail(r.id);if(draft)document.getElementById('swap-message').value=draft;}}
 if(swapDeepLink&&!document.getElementById('swap-modal')){if(swapRows.some(r=>r.id===swapDeepLink))swapPresent();else if(isAdmin)await openWorkSwap(true);}
 }catch{/* Keep the app usable when temporarily offline. Mutations report errors explicitly. */}
}
setInterval(swapPoll,15000);
setTimeout(swapPoll,4000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)swapPoll()});
