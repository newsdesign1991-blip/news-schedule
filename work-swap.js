// Work-swap requests are stored independently of the schedule and committed by the server.
let swapRows=[],swapSelected=null,swapAdminPassword='',swapAdminView=false,swapBusy=false,swapLoaded=false;
let swapDeepLink=new URL(location.href).searchParams.get('swap'),swapReturnFocus=null;
const swapStatus={pending:'상대방 확인 대기',accepted:'관리자 승인 대기',approved:'승인 · 반영 완료',rejected:'상대방 거절',declined:'관리자 반려',cancelled:'신청 취소'};
const swapEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const swapName=id=>id==='@master'?'마스터':id==='@admin'?'관리자':staffById(id)?.name||'직원';
// 아이콘은 문자(‹ ＋ → ↔) 대신 앱 공통 SVG
const swapIco={back:'<svg class="swap-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',plus:'<svg class="swap-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',right:'<svg class="swap-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',swap:'<svg class="swap-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg>'};
async function swapApi(action,extra={}){
 if(!currentUser?.staffId)throw Error('로그인 후 이용해 주세요.');
 if(isAdminTest&&action!=='list')throw Error('관리자 테스트 모드에서는 변경할 수 없습니다.');
 const res=await fetch(`${SB_URL}/functions/v1/work-swap`,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({action,staffId:currentUser.staffId,token:currentUser.authToken,deviceId:_deviceId(),...(swapAdminView?{admin:true,adminPassword:swapAdminPassword}:{}),...extra})});
 const result=await res.json();if(!res.ok||result.error)throw Error(result.error||'요청을 처리하지 못했습니다.');return result;
}
function closeWorkSwap(){const modal=document.getElementById('swap-modal');modal?._stopWindowDrag?.();modal?.remove();swapSelected=null;swapAdminView=false;swapReturnFocus?.focus();}
function swapEnableWindowDrag(modal){
 modal._stopWindowDrag?.();
 const dialog=modal.querySelector('.swap-dialog'),head=modal.querySelector('.swap-head');
 const desktop=matchMedia('(min-width:1001px) and (pointer:fine)'),events=new AbortController();
 let drag=null;
 function place(x,y){
  const r=dialog.getBoundingClientRect(),gap=16;
  x=Math.max(gap,Math.min(x,innerWidth-r.width-gap));y=Math.max(gap,Math.min(y,innerHeight-r.height-gap));
  modal.dataset.windowX=String(x);modal.dataset.windowY=String(y);
  dialog.style.left=x+'px';dialog.style.top=y+'px';
 }
 function finish(){if(drag&&head.hasPointerCapture(drag.id))head.releasePointerCapture(drag.id);drag=null;head.classList.remove('swap-dragging')}
 function fit(){
  if(!desktop.matches){finish();dialog.style.left='';dialog.style.top='';delete modal.dataset.windowX;delete modal.dataset.windowY;head.removeAttribute('title');return}
  head.title='제목 부분을 드래그하여 창을 옮길 수 있습니다.';
  if(modal.dataset.windowX!==undefined)place(Number(modal.dataset.windowX),Number(modal.dataset.windowY));
 }
 head.addEventListener('pointerdown',e=>{
  if(!desktop.matches||e.button!==0||e.target.closest('button,input,select,textarea,a'))return;
  const r=dialog.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
  place(r.left,r.top);head.setPointerCapture(e.pointerId);head.classList.add('swap-dragging');e.preventDefault();
 },{signal:events.signal});
 head.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id)place(drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y)},{signal:events.signal});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])head.addEventListener(name,finish,{signal:events.signal});
 window.addEventListener('resize',fit,{signal:events.signal});desktop.addEventListener('change',fit,{signal:events.signal});
 const observer=new ResizeObserver(fit);observer.observe(dialog);
 modal._stopWindowDrag=()=>{finish();events.abort();observer.disconnect()};fit();
}
// after: 새 내용이 들어간 뒤 실행할 일(포커스·달력 그리기 등) — 전환 효과 때문에 내용 교체가 조금 늦게 일어나므로 swapShell 뒤에 바로 쓰지 말고 여기로
function swapShell(title,body,after){
 window._swapShownRows=swapRows;   // 이 화면이 그려진 기준 행(폴링이 이것과 비교 — 전환 중 건너뛴 변경도 다음에 반영)
 let modal=document.getElementById('swap-modal');if(!modal){modal=document.createElement('div');modal.id='swap-modal';modal.className='nd-modal';modal.addEventListener('click',e=>{e.stopPropagation();if(e.target===modal)e.preventDefault()});modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation()}if(e.key==='Tab'){const a=[...modal.querySelectorAll('button,input,textarea,select')].filter(x=>!x.disabled&&x.getClientRects().length);if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0]?.focus()}}});document.body.appendChild(modal)}
 const old=modal.querySelector('.swap-dialog');old?._ndMorph?.();const oldTitle=old?.querySelector('#swap-title')?.textContent;   // 진행 중인 전환은 먼저 끝냄
 if(old&&oldTitle!==title&&typeof ndMorph==='function'&&old.getClientRects().length){   // 다른 화면으로 넘어갈 때만 모핑
  ndMorph(old,()=>{old.classList.remove('swap-dialog-wide');old.querySelector('#swap-title').textContent=title;old.querySelector('.swap-body').innerHTML=body;const er=old.querySelector('#swap-error');if(er)er.textContent='';after?.()},{parts:()=>[old.querySelector('.swap-body')]});
  return;
 }
 modal.innerHTML=`<div class="nd-pop swap-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-title"><div class="swap-head modal-header schedule-dialog-head"><div><b id="swap-title">${title}</b><p class="schedule-dialog-sub">근무 배정 교환 · 상대방 수락 후 관리자 승인</p></div><button type="button" class="modal-close schedule-dialog-close" aria-label="닫기" onclick="closeWorkSwap()">✕</button></div><div class="swap-body">${body}</div><div id="swap-error" role="status" aria-live="polite"></div></div>`;
 swapEnableWindowDrag(modal);
 after?.();
}
function swapError(e){const el=document.getElementById('swap-error');if(el)el.textContent=e.message||e;else toast(e.message||String(e),'error')}
async function openWorkSwap(admin=false){
 if(!currentUser?.staffId){toast('로그인 후 이용해 주세요.','error');return}
 swapReturnFocus=document.activeElement;swapAdminView=(!!admin||!!currentUser?.adminRole)&&isAdmin;swapSelected=null;
 if(swapAdminView&&!swapAdminPassword&&!currentUser?.adminRole){swapShell('근무 교환 관리',`<form onsubmit="event.preventDefault();swapUnlock()"><p>승인 처리를 위해 관리자 비밀번호를 확인합니다.</p><input id="swap-admin-password" type="password" autocomplete="current-password" placeholder="관리자 비밀번호" required><button class="swap-primary" type="submit">확인</button></form>`,()=>document.getElementById('swap-admin-password')?.focus());return}
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
 swapShell(swapAdminView?'근무 교환 관리':'근무 교환',`${!swapAdminView?'<button class="swap-primary" onclick="swapNew()">'+swapIco.plus+'근무 교환 신청</button>':''}<div class="swap-list">${rows.map(r=>`<button class="swap-row" onclick="swapDetail('${r.id}')"><span class="swap-state" data-status="${r.status}">${swapStatus[r.status]}</span><b>${swapEsc(swapName(r.requester))}<span class="swap-sr"> ↔ </span>${swapIco.swap}${swapEsc(swapName(r.recipient))}</b><span>${r.from}<span class="swap-sr"> ↔ </span>${swapIco.swap}${r.to}</span><small>대화 ${(r.messages||[]).length}개 · 상세 보기</small></button>`).join('')||'<p class="swap-empty">근무 교환 신청이 없습니다.</p>'}</div>`);
}
function swapNew(){
 swapSelected=null;const today=_bkToday();
 if(matchMedia('(min-width:1001px)').matches)return swapNewWide(today);
 swapShell('근무 교환 신청',`<button class="swap-back" onclick="swapRenderList()">${swapIco.back}신청 목록</button><form onsubmit="event.preventDefault();swapCreate()"><div class="swap-section"><label>교환 상대<select id="swap-recipient" required><option value="">직원 선택</option>${getStaff().filter(s=>s.id!==currentUser.staffId).map(s=>`<option value="${swapEsc(s.id)}">${swapEsc(s.name)} · ${swapEsc(s.dept)}</option>`).join('')}</select></label><div class="swap-dates"><label>내 근무일<input id="swap-from" type="date" min="${today}" required></label><label>상대방 근무일<input id="swap-to" type="date" min="${today}" required></label></div><p class="swap-hint">상대방의 근무 부서와 뉴오·8진 배정까지 그대로 인계합니다. 서로 대신 근무할 날은 휴무여야 합니다. 당직·조근·일근·데스크·휴가·비번은 제외됩니다.</p></div><label>신청 메시지 <small class="swap-opt">(선택)</small><textarea id="swap-reason" maxlength="1000" rows="3" placeholder="교환 사유를 간단히 남겨 주세요."></textarea></label><button type="submit" class="swap-primary">교환 신청</button></form>`);
}
// 큰 화면(≥1001px) 신청 창: 왼쪽 교환 상대 + 펼쳐진 달력(내 근무일 → 상대방 근무일 순서로 하나씩 선택), 오른쪽 신청 메시지·신청 버튼.
// 선택값은 숨은 #swap-from/#swap-to에 넣어 swapCreate()를 그대로 사용(모바일은 기존 날짜 입력 그대로).
let swapCal=null;
const swapCalChev=d=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d<0?'M15 5l-7 7 7 7':'M9 5l7 7-7 7'}"/></svg>`;
function swapNewWide(today){
 const [y,m]=today.split('-').map(Number);swapCal={y,m,active:'from',from:'',to:'',min:today};
 swapShell('근무 교환 신청',`<button class="swap-back" onclick="swapRenderList()">${swapIco.back}신청 목록</button><form class="swap-wide" onsubmit="event.preventDefault();swapWideSubmit()"><div class="swap-section swap-wide-left"><label>교환 상대<select id="swap-recipient" required><option value="">직원 선택</option>${getStaff().filter(s=>s.id!==currentUser.staffId).map(s=>`<option value="${swapEsc(s.id)}">${swapEsc(s.name)} · ${swapEsc(s.dept)}</option>`).join('')}</select></label><div class="swap-pick" role="group" aria-label="근무일 선택"><button type="button" class="swap-pick-btn" data-k="from" onclick="swapCalField('from')"><small><i></i>내 근무일</small><b></b></button><button type="button" class="swap-pick-btn" data-k="to" onclick="swapCalField('to')"><small><i></i>상대방 근무일</small><b></b></button></div><input type="hidden" id="swap-from"><input type="hidden" id="swap-to"><div id="swap-cal" class="swap-cal"></div><p class="swap-hint">상대방의 근무 부서와 뉴오·8진 배정까지 그대로 인계합니다. 서로 대신 근무할 날은 휴무여야 합니다. 당직·조근·일근·데스크·휴가·비번은 제외됩니다.</p></div><div class="swap-wide-right"><label class="swap-wide-msg"><span>신청 메시지 <small class="swap-opt">(선택)</small></span><textarea id="swap-reason" maxlength="1000" placeholder="교환 사유를 간단히 남겨 주세요."></textarea></label><button type="submit" class="swap-primary">교환 신청</button></div></form>`,()=>{document.querySelector('#swap-modal .swap-dialog')?.classList.add('swap-dialog-wide');swapCalRender()});
}
function swapCalField(k){if(!swapCal)return;swapCal.active=k;swapCalRender()}
function swapCalNav(d){if(!swapCal)return;let y=swapCal.y,m=swapCal.m+d;if(m<1){m=12;y--}if(m>12){m=1;y++}const [my,mm]=swapCal.min.split('-').map(Number);if(y*12+m<my*12+mm)return;swapCal.y=y;swapCal.m=m;swapCalRender()}
function swapCalToday(){if(!swapCal)return;[swapCal.y,swapCal.m]=swapCal.min.split('-').map(Number);swapCalRender()}
function swapCalReset(){if(!swapCal)return;swapCal.from='';swapCal.to='';swapCal.active='from';swapCalRender()}
function swapCalPick(ds){if(!swapCal||ds<swapCal.min)return;swapCal[swapCal.active]=ds;if(swapCal.active==='from'&&!swapCal.to)swapCal.active='to';const er=document.getElementById('swap-error');if(er)er.textContent='';swapCalRender()}
function swapCalRender(){
 const c=swapCal,host=document.getElementById('swap-cal');if(!c||!host)return;
 const fa=document.activeElement,fk=host.contains(fa)&&fa.dataset?fa.dataset.f:'';   // 다시 그린 뒤 같은 버튼으로 포커스 되돌림(키보드 사용)
 document.getElementById('swap-from').value=c.from;document.getElementById('swap-to').value=c.to;
 const W='일월화수목금토',fmt=ds=>{const d=new Date(ds+'T00:00:00');return `${d.getMonth()+1}월 ${d.getDate()}일 (${W[d.getDay()]})`};
 document.querySelectorAll('#swap-modal .swap-pick-btn').forEach(b=>{const k=b.dataset.k;b.classList.toggle('on',c.active===k);b.classList.toggle('empty',!c[k]);b.setAttribute('aria-pressed',String(c.active===k));b.querySelector('b').textContent=c[k]?fmt(c[k]):'달력에서 선택'});
 const lead=new Date(c.y,c.m-1,1).getDay(),days=new Date(c.y,c.m,0).getDate(),[my,mm]=c.min.split('-').map(Number),atMin=c.y*12+c.m<=my*12+mm;
 let cells='<span></span>'.repeat(lead);
 for(let d=1;d<=days;d++){const ds=`${c.y}-${String(c.m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,past=ds<c.min;
  cells+=`<button type="button" data-f="d:${ds}" class="swap-cal-day${ds===c.from?' is-from':''}${ds===c.to?' is-to':''}${ds===c.min?' is-today':''}"${past?' disabled':''} onclick="swapCalPick('${ds}')" aria-label="${c.m}월 ${d}일${ds===c.from?' 내 근무일':''}${ds===c.to?' 상대방 근무일':''}">${d}</button>`}
 host.innerHTML=`<div class="swap-cal-head"><button type="button" data-f="title" class="swap-cal-title" onclick="swapCalToday()" title="이번 달로">${c.y}년 ${c.m}월${swapCalChev(1)}</button><div class="swap-cal-nav"><button type="button" data-f="prev" onclick="swapCalNav(-1)" aria-label="이전 달"${atMin?' disabled':''}>${swapCalChev(-1)}</button><button type="button" data-f="next" onclick="swapCalNav(1)" aria-label="다음 달">${swapCalChev(1)}</button></div></div><div class="swap-cal-week">${W.split('').map(w=>`<span>${w}</span>`).join('')}</div><div class="swap-cal-grid">${cells}</div><div class="swap-cal-foot"><button type="button" data-f="reset" class="swap-cal-reset" onclick="swapCalReset()">재설정</button><span class="swap-cal-legend"><i class="lg-from"></i>내 근무일<i class="lg-to"></i>상대방 근무일</span></div>`;
 if(fk){let t=host.querySelector('[data-f="'+fk+'"]');if(!t||t.disabled)t=fk.indexOf('d:')===0?host.querySelector('.swap-cal-day:not([disabled])'):host.querySelector('[data-f="next"]');if(t)t.focus()}
}
function swapWideSubmit(){
 if(!swapCal.from){swapCalField('from');return swapError('내 근무일을 달력에서 골라 주세요.')}
 if(!swapCal.to){swapCalField('to');return swapError('상대방 근무일을 달력에서 골라 주세요.')}
 swapCreate();
}
async function swapCreate(){if(swapBusy)return;swapBusy=true;const fields={recipient:document.getElementById('swap-recipient').value,from:document.getElementById('swap-from').value,to:document.getElementById('swap-to').value,text:document.getElementById('swap-reason').value};try{const r=await swapApi('create',fields);await swapLoad();swapDetail(r.request.id);toast('교환 신청을 보냈습니다.','success')}catch(e){swapError(e)}finally{swapBusy=false}}
function swapDetail(id){
 const r=swapRows.find(r=>r.id===id);if(!r)return;swapSelected=id;
 const sid=currentUser.staffId,seen=JSON.parse(localStorage.getItem('nd_swap_seen_'+sid)||'{}');seen[id]=r.updatedAt;localStorage.setItem('nd_swap_seen_'+sid,JSON.stringify(seen));swapBadge();
 const buttons=[];
 if(r.status==='pending'&&r.recipient===sid){buttons.push(['accept','수락'],['reject','거절'])}
 if(['pending','accepted'].includes(r.status)&&r.requester===sid)buttons.push(['cancel','신청 취소']);
 if(swapAdminView&&r.status==='accepted')buttons.push(['approve','승인하고 근무표 반영'],['decline','반려']);
 swapShell('근무 교환 상세',`<button class="swap-back" onclick="swapRenderList()">${swapIco.back}신청 목록</button><div class="swap-section"><span class="swap-state" data-status="${r.status}">${swapStatus[r.status]}</span><div class="swap-summary"><div><b>${r.from}</b><span>${swapEsc(swapName(r.requester))}<span class="swap-sr"> → </span>${swapIco.right}${swapEsc(swapName(r.recipient))}<br><strong>${swapEsc(r.fromDuty||'기존 근무 배정')} 인계</strong></span></div><div><b>${r.to}</b><span>${swapEsc(swapName(r.recipient))}<span class="swap-sr"> → </span>${swapIco.right}${swapEsc(swapName(r.requester))}<br><strong>${swapEsc(r.toDuty||'기존 근무 배정')} 인계</strong></span></div></div><p class="swap-hint">관리자가 승인해야 근무표에 반영됩니다.</p><div class="swap-actions">${buttons.map(([a,t])=>`<button ${a==='approve'||a==='accept'?'class="swap-primary"':''} onclick="swapAct('${a}')">${t}</button>`).join('')}</div></div><details><summary>처리 이력</summary>${(r.history||[]).map(h=>`<p class="swap-hint">${swapEsc(swapName(h.actor))} · ${swapStatus[h.status]} · ${new Date(h.at).toLocaleString('ko-KR')}</p>`).join('')}</details><h3>대화</h3><div id="swap-chat" aria-live="polite">${swapChatHtml(r)}</div><form onsubmit="event.preventDefault();swapChat()" class="swap-chat-form"><textarea id="swap-message" maxlength="1000" rows="2" placeholder="메시지 입력" aria-label="교환 신청 대화"></textarea><button type="submit" class="swap-primary">보내기</button></form>`);
}
function swapChatHtml(r){return (r.messages||[]).map(m=>`<div class="swap-message ${m.actor===currentUser.staffId?'mine':''}"><small>${swapEsc(swapName(m.actor))} · ${new Date(m.at).toLocaleString('ko-KR')}</small><p>${swapEsc(m.text)}</p></div>`).join('')||'<p class="swap-hint">이 신청에 대해 간단히 대화해 보세요.</p>'}
async function swapAct(action){if(swapBusy)return;const r=swapRows.find(x=>x.id===swapSelected);if(!r)return;if(['approve','decline','reject','cancel'].includes(action)&&!confirm(action==='approve'?'두 날짜의 근무 부서와 뉴오·8진 배정까지 교환하고 근무표에 반영할까요?':'이 신청을 '+({decline:'반려',reject:'거절',cancel:'취소'}[action])+'할까요?'))return;swapBusy=true;try{await swapApi(action,{id:r.id,revision:r.revision});await swapLoad();swapDetail(r.id);if(action==='approve'){await _reloadRemoteData();}toast('처리되었습니다.','success')}catch(e){swapError(e);await swapLoad().catch(()=>{})}finally{swapBusy=false}}
async function swapChat(){if(swapBusy)return;const r=swapRows.find(x=>x.id===swapSelected),input=document.getElementById('swap-message'),text=input.value.trim();if(!r||!text)return;swapBusy=true;try{await swapApi('chat',{id:r.id,revision:r.revision,text});input.value='';await swapLoad();swapDetail(r.id)}catch(e){swapError(e);await swapLoad().catch(()=>{})}finally{swapBusy=false}}
async function swapPoll(){
 if(document.hidden||!currentUser?.staffId||swapBusy)return;
 if(!isAdmin){swapAdminPassword='';swapAdminView=false}
 try{const old=swapRows,loaded=swapLoaded;await swapLoad();if(loaded&&swapRows.some(r=>r.updatedAt!==old.find(x=>x.id===r.id)?.updatedAt))toast('근무 교환에 새로운 소식이 있습니다.');
 if(loaded&&swapRows.some(r=>r.status==='approved'&&old.find(x=>x.id===r.id)?.status!=='approved'))await _reloadRemoteData();
 if(document.querySelector('#swap-modal .swap-dialog')?._ndMorph)return;   // 화면 전환 중 → 다시 그리지 않음
 if(document.querySelector('#swap-modal .swap-list')&&JSON.stringify(window._swapShownRows||old)!==JSON.stringify(swapRows))swapRenderList();   // 마지막으로 그린 목록과 비교
 if(swapSelected&&document.getElementById('swap-chat')){const r=swapRows.find(x=>x.id===swapSelected),prev=(window._swapShownRows||old).find(x=>x.id===swapSelected);if(r&&r.updatedAt!==prev?.updatedAt){const input=document.getElementById('swap-message'),draft=input?.value||'';swapDetail(r.id);if(draft)document.getElementById('swap-message').value=draft;}}
 if(swapDeepLink&&!document.getElementById('swap-modal')){if(swapRows.some(r=>r.id===swapDeepLink))swapPresent();else if(isAdmin)await openWorkSwap(true);}
 }catch{/* Keep the app usable when temporarily offline. Mutations report errors explicitly. */}
}
setInterval(swapPoll,15000);
setTimeout(swapPoll,4000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)swapPoll()});
