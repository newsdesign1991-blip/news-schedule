/* [모듈] js/poll.js — 오늘의 투표 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 투표(오늘의 투표) =====
const POLL_COLORS=['#2563eb','#e0483c','#16a34a','#e6a817','#8b5cf6','#ef6c00','#ec4899','#64748b'];
function _pEsc(x){ return (x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _pollEnded(p){ return p && p.endAt ? (new Date(p.endAt).getTime() < Date.now()) : false; }
function _pollTooOld(p){ const c=(p&&p.createdAt)?new Date(p.createdAt).getTime():Date.now(); return c < (Date.now()-365*24*3600*1000); }
function _pollFmtEnd(endAt){ if(!endAt) return ''; const d=new Date(endAt); if(isNaN(d)) return ''; const ap=d.getHours()<12?'오전':'오후'; let h=d.getHours()%12; if(h===0)h=12; return `${d.getMonth()+1}월 ${d.getDate()}일 ${ap} ${h}:${String(d.getMinutes()).padStart(2,'0')}`; }
function _pollPurgeInPlace(polls){ const cut=Date.now()-365*24*3600*1000; for(let i=polls.length-1;i>=0;i--){ const c=polls[i].createdAt?new Date(polls[i].createdAt).getTime():Date.now(); if(c<cut) polls.splice(i,1); } }

// 홈: 진행중 투표 카드들
function renderPolls(){
  const vh=document.getElementById('view-home'); if(!vh) return;
  let host=document.getElementById('home-polls');
  const active=(data.polls||[]).filter(p=>p && !_pollEnded(p) && !_pollTooOld(p)).sort((a,b)=>((b.createdAt||'')<(a.createdAt||'')?-1:1));
  const first=!window._pollSeenInit; window._pollSeenInit=true;
  const prev=window._pollSeen||new Set();
  const nowIds=new Set(active.map(p=>p.id));
  if(!active.length){ if(host) host.remove(); window._pollSeen=nowIds; return; }
  const _lov=document.getElementById('login-overlay');
  const freshLogin=(_lov && getComputedStyle(_lov).display!=='none') || vh.classList.contains('home-enter');
  const willAnim=!freshLogin && (first || active.some(p=>!prev.has(p.id)));
  // 등장 애니가 도는 중 + 표시 목록 동일 + 새 등장 아님 → 재빌드 스킵.
  // (자동 동기화/부팅 초기 동기화가 애니 중인 카드를 무애니로 통째 다시 그려 '마지막에 툭하며 다시 생성'되던 문제 차단)
  const _rendered=window._pollRenderedIds||new Set();
  const _sameSet=(_rendered.size===nowIds.size) && Array.from(nowIds).every(function(id){return _rendered.has(id);});
  if(!willAnim && _sameSet && host && window._pollAnimUntil && Date.now()<window._pollAnimUntil){ window._pollSeen=nowIds; return; }
  const doFlip=willAnim && !first;   // 생성 시에만 아래 카드 밀어내기(부팅은 home-anim이 처리)
  // FLIP: 삽입 전 형제 위치 기록
  var flipEls=[]; var firstTop=new Map();
  if(doFlip){ flipEls=Array.prototype.filter.call(vh.children, function(c){return c.id!=='home-polls';}); flipEls.forEach(function(el){ firstTop.set(el, el.getBoundingClientRect().top); }); }
  if(!host){ host=document.createElement('div'); host.id='home-polls'; }
  if(vh.firstElementChild!==host) vh.insertBefore(host, vh.firstElementChild);   // 항상 최상단
  host.style.marginBottom='14px';
  host.innerHTML=active.map(p=>_pollCardHtml(p)).join('');
  window._pollRenderedIds=nowIds;
  if(willAnim) _pollEnterAnim(host, doFlip?flipEls:null, firstTop);
  window._pollSeen=nowIds;
  try{ if(typeof layoutHomeMasonry==='function') layoutHomeMasonry(); }catch(e){}   // 넓은 화면: 투표 등장/제거 시 다단 재배치
}
function _pollEnterAnim(host, flipEls, firstTop){
  try{
    window._pollAnimUntil=Date.now()+1350;   // 이 시간 동안은 renderPolls가 재빌드하지 않음(애니 보호)
    const EASE='cubic-bezier(.5,0,.35,1)';   // 1.3초 전체에 고르게 퍼지고 끝이 부드럽게 착지(측정으로 선정)
    const card=host.querySelector('.poll-card');
    if(card){
      card.style.transformOrigin='50% 0%';
      card.classList.add('poll-in'); setTimeout(function(){ if(card) card.classList.remove('poll-in'); }, 1360);  // 등장 끝난 뒤 glow 부드럽게 시작
      // ★ mask는 box-shadow까지 잘라내 '그림자가 사라졌다 다시 생기는(툭)' 원인이 되므로 사용하지 않음.
      //   스케일+블러+페이드로 부드럽게 커지며 등장. blur(0)은 그림자를 가리지 않음.
      //   fill:'forwards'로 끝 상태 유지 → 끝 리페인트 없음(다음 렌더에서 새 카드로 자연 정리).
      card.animate([
        { opacity:0, filter:'blur(9px)', transform:'scale(.82)' },
        { opacity:1, filter:'blur(0px)', transform:'scale(1)' }
      ], { duration:1300, easing:EASE, fill:'forwards' });
    }
    // 아래 카드: FLIP으로 부드럽게 밀림(레이아웃 점프/툭 없음)
    if(flipEls){ flipEls.forEach(function(el){ const nowTop=el.getBoundingClientRect().top; const d=firstTop.get(el)-nowTop; if(Math.abs(d)<1) return; el.animate([{transform:'translateY('+d+'px)'},{transform:'none'}],{duration:1300,easing:EASE}); }); }
  }catch(e){}
}
// 생성 팝업이 블러되며 사라짐 (이어서 투표 등장 → 자연스러운 연결)
function _pollCloseBlur(){
  const pm=document.getElementById('poll-modal'); const pc=document.getElementById('poll-modal-card');
  if(!pm) return;
  try{
    if(pc) pc.animate([{opacity:1,filter:'blur(0px)',transform:'scale(1)'},{opacity:0,filter:'blur(16px)',transform:'scale(.94)'}],{duration:420,easing:'cubic-bezier(.4,0,.5,1)',fill:'forwards'});
    pm.animate([{opacity:1},{opacity:0}],{duration:420,easing:'ease',fill:'forwards'});
  }catch(e){}
  setTimeout(function(){ pm.style.display='none'; pm.classList.remove('nd-closing'); try{ pm.getAnimations().forEach(x=>x.cancel()); if(pc) pc.getAnimations().forEach(x=>x.cancel()); }catch(_){} }, 440);
}
function _pollIsMine(p){ return !!(currentUser && p && ((p.createdById && p.createdById===currentUser.staffId) || (p.createdBy && currentUser.name && p.createdBy===currentUser.name))); }
function _pollState(p){
  if(_pollEnded(p)) return 'results';
  const myId=(currentUser&&currentUser.staffId)||null;
  const voted = myId!=null && (p.votes||{})[myId]!==undefined;
  const editing = !!(window._pollEdit && window._pollEdit[p.id]);
  return (voted && !editing) ? 'results' : 'choices';
}
function _pollChoicesHtml(p){
  const esc=_pEsc;
  const myId=(currentUser&&currentUser.staffId)||null;
  const myVote=myId!=null?(p.votes||{})[myId]:undefined;
  return `<div class="poll-choices">${(p.options||[]).map((o,i)=>{
    const c=POLL_COLORS[i%POLL_COLORS.length];
    const sel=myVote===i;
    const st=sel?`background:${c};color:#fff;border:1.5px solid ${c};`:`background:${c}1a;color:${c};border:1.5px solid ${c}70;`;
    return `<button class="poll-choice" style="${st}" onclick="_pollVote('${p.id}',${i})">${esc(o.label)}${sel?' ✓':''}</button>`;
  }).join('')}</div>`;
}
function _pollResultsHtml(p){
  const esc=_pEsc, votes=p.votes||{}, total=Object.keys(votes).length;
  const myId=(currentUser&&currentUser.staffId)||null;
  const myVote=myId!=null?votes[myId]:undefined;
  const ended=_pollEnded(p);
  const bars=(p.options||[]).map((o,i)=>{
    const c=POLL_COLORS[i%POLL_COLORS.length];
    const cnt=Object.values(votes).filter(v=>v===i).length;
    const pct=total?Math.round(cnt/total*100):0;
    const mine=myVote===i;
    return `<div class="poll-opt${mine?' mine':''} ended" style="--pc:${c};background:${c}1c;">
      <div class="poll-opt-top"><span class="poll-opt-label">${esc(o.label)}${mine?' <span class="poll-chk"><svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12.4l3.3 3.3L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>':''}</span><span class="poll-opt-cnt">${cnt}명</span></div>
      <div class="poll-bar"><div class="poll-bar-fill" data-w="${pct}" style="width:${pct}%;background:${c};"></div></div>
    </div>`;
  }).join('');
  return `<div class="poll-opts">${bars}</div>${ended?'':`<button class="poll-edit-btn" onclick="_pollEditAnswer('${p.id}')">답변 수정</button>`}`;
}
function _pollBodyHtml(p){ return _pollState(p)==='results' ? _pollResultsHtml(p) : _pollChoicesHtml(p); }
function _pollSwapBody(pollId, toResults){
  const card=document.querySelector('.poll-card[data-pid="'+pollId+'"]');
  const p=(data.polls||[]).find(x=>x.id===pollId);
  if(!card||!p){ renderPolls(); return; }
  const host=document.getElementById('home-polls'); if(host){ host.style.overflow=''; host.style.maxHeight=''; }   // stuck 스타일 해제(겹침 방지)
  const body=card.querySelector('.poll-body');
  if(!body){ renderPolls(); return; }
  const h0=body.offsetHeight;                       // 바뀌기 전 높이
  body.classList.add('poll-swap-out');
  setTimeout(function(){
    body.innerHTML = toResults ? _pollResultsHtml(p) : _pollChoicesHtml(p);
    body.classList.remove('poll-swap-out'); body.classList.add('poll-swap-in');
    body.style.height='auto'; const h1=body.offsetHeight;               // 바뀐 뒤 높이
    body.style.height=h0+'px'; body.style.overflow='hidden';
    setTimeout(function(){ body.style.transition='height .6s cubic-bezier(.16,1,.3,1)'; body.style.height=h1+'px'; }, 20);   // 부드럽게 성장 → 아래 카드 밀림
    if(toResults){ body.querySelectorAll('.poll-bar-fill').forEach(function(fl){ const w=fl.getAttribute('data-w')||'0'; fl.style.width='0%'; setTimeout(function(){ fl.style.width=w+'%'; }, 40); }); }
    const tot=card.querySelector('.poll-total'); if(tot) tot.textContent=(Object.keys(p.votes||{}).length)+'명 참여';
    setTimeout(function(){ body.style.height=''; body.style.overflow=''; body.style.transition=''; body.classList.remove('poll-swap-in'); }, 660);
  }, 210);
}
function _pollEditAnswer(pollId){ window._pollEdit=window._pollEdit||{}; window._pollEdit[pollId]=true; _pollSwapBody(pollId, false); }
function _pollRefreshResults(pollId){
  const p=(data.polls||[]).find(x=>x.id===pollId); if(!p) return;
  if(_pollState(p)!=='results') return;
  const card=document.querySelector('.poll-card[data-pid="'+pollId+'"]'); if(!card) return;
  const body=card.querySelector('.poll-body'); if(!body) return;
  const opts=body.querySelectorAll('.poll-opt'); if(!opts.length) return;
  const votes=p.votes||{}, total=Object.keys(votes).length;
  (p.options||[]).forEach(function(o,i){
    const cnt=Object.values(votes).filter(v=>v===i).length; const pct=total?Math.round(cnt/total*100):0;
    const el=opts[i]; if(!el) return;
    const ce=el.querySelector('.poll-opt-cnt'); if(ce) ce.textContent=cnt+'명';
    const fl=el.querySelector('.poll-bar-fill'); if(fl){ fl.style.width=pct+'%'; fl.setAttribute('data-w',pct); }
  });
  const tot=card.querySelector('.poll-total'); if(tot) tot.textContent=total+'명 참여';
}
function _pollCardHtml(p){
  const esc=_pEsc, total=Object.keys(p.votes||{}).length, ended=_pollEnded(p);
  const canDel=(isAdmin||isMaster||_pollIsMine(p));
  const delBtn=canDel?`<button class="poll-x" onclick="event.stopPropagation();deletePoll('${p.id}')" title="투표 삭제">✕</button>`:'';
  return `<div class="poll-card" data-pid="${p.id}">
    <div class="poll-card-hd"><span class="poll-hd-title"><svg viewBox="0 0 24 24" width="17" height="17" fill="#e0483c" style="vertical-align:-3px;margin-right:2px;"><rect x="3" y="10" width="4.2" height="10" rx="1.2"/><rect x="9.9" y="5" width="4.2" height="15" rx="1.2"/><rect x="16.8" y="13" width="4.2" height="7" rx="1.2"/></svg>오늘의 투표</span>${ended?`<span class="poll-ended-tag">종료됨</span>`:''}<span class="poll-hd-sp"></span>${delBtn}</div>
    <div class="poll-title"><span>${esc(p.title)}</span><span class="poll-end-red">${_pollFmtEnd(p.endAt)} ${ended?'종료됨':'종료'}</span></div>
    ${p.desc?`<div class="poll-desc">${esc(p.desc)}</div>`:''}
    <div class="poll-body">${_pollBodyHtml(p)}</div>
    <div class="poll-foot"><span class="poll-total">${total}명 참여</span><span class="poll-cmt-cnt"${(p.comments||[]).length?'':' hidden'}>댓글 ${(p.comments||[]).length}</span><button class="poll-detail-btn" onclick="openPollDetail('${p.id}')">자세히 보기 ›</button></div>
  </div>`;
}

// 투표 동시저장 안전화: 원격 최신본에 내 표만 병합 + updated_at 낙관적잠금 + 재시도.
// mutate가 false를 돌려주면(대상 없음) 쓰지 않고 'gone'. 성공하면 true(그 뒤 ndAdoptMergedSave로 리비전 맞춤)
async function _pollCommit(mutate){
  if (isAdminTest){ if(!Array.isArray(data.polls)) data.polls=[]; mutate(data.polls); return true; }
  const url=`${SB_URL}/rest/v1/nd_data?id=eq.main`;
  for(let attempt=0;attempt<6;attempt++){
    let remote;
    try{ const g=await fetch(`${url}&select=payload,updated_at`,{headers:SB_HEADERS}); if(!g.ok) throw new Error('GET'); const a=await g.json(); remote=a&&a[0]; }
    catch(e){ console.warn('투표 동기화 읽기 실패',e); return false; }
    if(!remote||!remote.payload) return false;
    const rp=remote.payload, base=rp._dataRevision||0;
    if(!Array.isArray(rp.polls)) rp.polls=[];
    let mr; try{ mr=mutate(rp.polls); }catch(e){ console.warn('투표 mutate 실패',e); return false; }
    if(mr===false){ ndAdoptGoneSnapshot(base, ()=>{ data.polls=rp.polls; }); return 'gone'; }   // 대상 투표가 이미 없음 → 쓰지 않음
    const nowIso=new Date().toISOString();
    try{
      const cond=remote.updated_at?`&updated_at=eq.${encodeURIComponent(remote.updated_at)}`:'';
      const pr=await fetch(`${url}${cond}`,{method:'PATCH',headers:Object.assign({},SB_HEADERS,{'Prefer':'return=representation'}),body:JSON.stringify({payload:rp,updated_at:nowIso})});
      if(!pr.ok) throw new Error('PATCH');
      const rows=await pr.json();
      if(Array.isArray(rows)&&rows.length>0){
        const saved=rows[0]; data.polls=(saved.payload&&saved.payload.polls)||rp.polls; ndAdoptMergedSave(base, saved);   // 서버 리비전 따라가기(data-save.js)
        try{ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }catch(e){}
        _localBackup(data);
        return true;
      }
    }catch(e){ console.warn('투표 동기화 쓰기 실패',e); return false; }
    await new Promise(res=>setTimeout(res, 70+attempt*110+Math.floor(Math.random()*140)));
  }
  return false;
}

function _pollVote(pollId, optIdx){
  if(!currentUser||!currentUser.staffId){ toast('이름으로 로그인 후 투표할 수 있습니다.','error'); return; }
  const p=(data.polls||[]).find(x=>x.id===pollId); if(!p){ return; }
  if(_pollEnded(p)){ toast('종료된 투표입니다.','error'); return; }
  const myId=currentUser.staffId;
  if(!p.votes) p.votes={};
  p.votes[myId]=optIdx;   // 선택 = 설정
  if(window._pollEdit) delete window._pollEdit[pollId];
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }catch(e){}
  _pollSwapBody(pollId, true);   // 버튼 블러아웃 -> 그래프 등장
  _pollCommit((polls)=>{ const q=polls.find(x=>x.id===pollId); if(!q) return false; if(!q.votes) q.votes={}; q.votes[myId]=optIdx; })
    .then(ok=>{ if(ok==='gone'){ toast('이미 삭제된 투표예요.','error'); renderPolls(); } else if(ok) _pollRefreshResults(pollId); });
}

// 지워진 투표: 그 투표의 '자세히 보기'가 열려 있을 때만 닫고(그사이 연 다른 창은 그대로) 홈 카드 다시 그림
function _pollGoneClose(pollId){ if(window._pollDetailId===pollId) closePollModal(); renderPolls(); }
// 댓글(js/nd-comments.js): 내 화면에 먼저 보이고 → 서버 최신본에 이 댓글만 넣거나 뺌(_pollCommit, 동시 저장 안전).
// 실패하면 되돌리고 false(입력했던 글은 입력칸으로 돌아감). 같은 id는 두 번 안 들어감(재시도 안전)
function _pollCmtShow(pollId, scrollToId){
  const p=(data.polls||[]).find(x=>x.id===pollId), list=(p&&p.comments)||[];
  if(typeof ndCmtRefresh==='function') ndCmtRefresh('poll', pollId, list, scrollToId);
  const cc=document.querySelector('.poll-card[data-pid="'+pollId+'"] .poll-cmt-cnt');
  if(cc){ cc.textContent='댓글 '+list.length; cc.hidden=!list.length; }
}
async function _pollCmtAdd(pollId, cmt){
  if(isAdminTest){ toast('관리자 테스트 모드에서는 댓글이 저장되지 않아요.','error'); return false; }
  const p=(data.polls||[]).find(x=>x.id===pollId); if(!p){ toast('이미 삭제된 투표예요.','error'); _pollGoneClose(pollId); return false; }
  (p.comments=p.comments||[]).push(cmt); _pollCmtShow(pollId, cmt.id);
  const res=await _pollCommit(polls=>{ const q=polls.find(x=>x.id===pollId); if(!q) return false; q.comments=q.comments||[]; if(!q.comments.some(c=>c.id===cmt.id)) q.comments.push(cmt); });
  const ok=res===true;
  if(res==='gone'){ toast('이미 삭제된 투표예요.','error'); _pollGoneClose(pollId); return false; }
  if(!ok){ const q=(data.polls||[]).find(x=>x.id===pollId); if(q&&q.comments) q.comments=q.comments.filter(c=>c.id!==cmt.id); toast('댓글을 저장하지 못했어요. 네트워크 확인 후 다시 시도하세요.','error'); }
  _pollCmtShow(pollId); return ok;
}
async function _pollCmtDel(pollId, cid){
  if(isAdminTest){ toast('관리자 테스트 모드에서는 댓글이 저장되지 않아요.','error'); return false; }
  const p=(data.polls||[]).find(x=>x.id===pollId); if(!p){ _pollGoneClose(pollId); return false; }
  const old=(p.comments||[]).find(c=>c.id===cid); if(!old || !ndCmtCanDelete(old)) return false;
  p.comments=(p.comments||[]).filter(c=>c.id!==cid); _pollCmtShow(pollId);
  const res=await _pollCommit(polls=>{ const q=polls.find(x=>x.id===pollId); if(!q || !(q.comments||[]).some(c=>c.id===cid)) return false; q.comments=q.comments.filter(c=>c.id!==cid); });
  if(res==='gone' && !(data.polls||[]).some(x=>x.id===pollId)){ toast('이미 삭제된 투표예요.','error'); _pollGoneClose(pollId); return true; }
  const ok=res===true||res==='gone';   // 'gone' = 댓글만 이미 지워짐 → 지운 것과 같음
  if(!ok){ const q=(data.polls||[]).find(x=>x.id===pollId); if(q && !(q.comments||[]).some(c=>c.id===cid)) (q.comments=q.comments||[]).push(old); toast('댓글을 지우지 못했어요. 다시 시도하세요.','error'); }
  _pollCmtShow(pollId); return ok;
}

// 자세히 보기: 항목별 배경색 밴드 + 투표자 이름
function openPollDetail(id){ const p=(data.polls||[]).find(x=>x.id===id); if(!p) return; _pollShow(_pollDetailHtml(p), ()=>{ window._pollDetailId=id; if(_pollWide()) document.getElementById('poll-modal-card')?.classList.add('pc-wide-card'); }, true); }
function _pollDetailHtml(p){
  const esc=_pEsc, votes=p.votes||{}, total=Object.keys(votes).length, ended=_pollEnded(p);
  let bands='';
  (p.options||[]).forEach((o,i)=>{
    const c=POLL_COLORS[i%POLL_COLORS.length];
    const voters=Object.keys(votes).filter(id=>votes[id]===i);
    const names=voters.map(id=>{ const st=staffById(id); return st?st.name:null; }).filter(Boolean);
    bands+=`<div class="poll-band" style="background:${c}14;">
      <div class="poll-band-hd" style="color:${c};"><span class="poll-band-dot" style="background:${c};"></span>${esc(o.label)} · ${voters.length}명</div>
      ${names.length?`<div class="poll-band-names" style="color:${c};">${names.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`:`<div class="poll-band-empty">아직 없음</div>`}
    </div>`;
  });
  const voted=new Set(Object.keys(votes));
  const nonV=(data.staff||[]).filter(st=>st.active!==false && !voted.has(st.id)).map(st=>st.name);
  const nonBand=`<div class="poll-band" style="background:var(--surface2);">
    <div class="poll-band-hd" style="color:var(--muted);"><span class="poll-band-dot" style="background:var(--muted);"></span>아직 투표 안 함 · ${nonV.length}명</div>
    ${nonV.length?`<div class="poll-band-names" style="color:var(--muted);">${nonV.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`:`<div class="poll-band-empty">모두 참여했어요</div>`}
  </div>`;
  const head=`<div class="modal-header"><div class="mh-title">${esc(p.title)}</div><button class="modal-close" onclick="closePollModal()">✕</button></div>`;
  // 넓은 화면: 왼쪽 요약(상태·마감·설명·참여율 링·항목별 막대) / 오른쪽 항목별 투표자(2열) + 아직 안 한 사람
  if(_pollWide()){
    const all=total+nonV.length, rate=all?Math.round(total/all*100):0, R=42, C=2*Math.PI*R;
    const bars=(p.options||[]).map((o,i)=>{ const c=POLL_COLORS[i%POLL_COLORS.length], n=Object.values(votes).filter(v=>v===i).length, pct=total?Math.round(n/total*100):0;
      return `<div class="pd-bar"><div class="pd-bar-top"><span><i style="background:${c};"></i>${esc(o.label)}</span><b style="color:${c};">${n}명 <small>${pct}%</small></b></div><div class="pd-bar-track"><div style="width:${pct}%;background:${c};"></div></div></div>`; }).join('');
    return head+`<div class="pd-wide">
      <div class="pd-left poll-scroll">
        <div class="pd-status${ended?' ended':''}">${ended?'종료됨':'진행 중'}</div>
        <div class="pd-meta">${_pollFmtEnd(p.endAt)} 종료${ended?'':' 예정'}</div>
        ${p.desc?`<div class="pd-desc">${esc(p.desc)}</div>`:''}
        <div class="pd-ring"><svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true"><circle cx="50" cy="50" r="${R}" fill="none" stroke="rgba(224,72,60,.12)" stroke-width="11"/><circle cx="50" cy="50" r="${R}" fill="none" stroke="#e0483c" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C*rate/100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
          <div><b>${rate}%</b><span>참여 ${total}명 / ${all}명</span></div></div>
        <div class="pd-bars">${bars}</div>
      </div>
      <div class="pd-right poll-scroll">${bands}${nonBand.replace('class="poll-band"','class="poll-band pd-non"')}${typeof ndCmtSection==='function'?`<div class="pd-cmt">${ndCmtSection('poll', p.id, p.comments)}</div>`:''}</div>
    </div>`;
  }
  return head+`
  <div class="poll-scroll" style="padding:15px 20px 20px;">
    <div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:${p.desc?'9':'13'}px;">${ended?'종료됨':'진행 중'} · ${_pollFmtEnd(p.endAt)} 종료${ended?'':' 예정'} · 총 ${total}명 참여</div>
    ${p.desc?`<div style="font-size:13px;color:var(--text);line-height:1.55;white-space:pre-wrap;margin-bottom:14px;padding-bottom:13px;border-bottom:1px solid var(--border);">${esc(p.desc)}</div>`:''}
    ${bands}${nonBand}
    ${typeof ndCmtSection==='function'?ndCmtSection('poll', p.id, p.comments):''}
  </div>`;
}

// 만들기
// morph=true: 투표 창이 이미 열려 있으면(투표↔과거 투표↔만들기 이동) 블러로 사라졌다 크기 바뀌며 또렷하게(js/nd-cal.js ndMorph). after = 새 내용이 들어간 뒤 할 일
function _pollShow(html, after, morph){ window._noticeDetailId=null; const _pm=document.getElementById('poll-modal'); const c=document.getElementById('poll-modal-card'); if(!c) return;
  const open=morph && _pm && _pm.style.display==='flex' && !_pm.classList.contains('nc-yellow') && c.childElementCount && c.getClientRects().length && typeof ndMorph==='function';
  const apply=()=>{ window._pollDetailId=null; if(_pm) _pm.classList.remove('nc-yellow','nc-morph'); c.classList.remove('pc-wide-card'); c.innerHTML=html; if(after) after(); };
  if(open){ ndMorph(c, apply); return; }
  if(c._ndMorph) c._ndMorph();   // 진행 중인 전환은 먼저 끝내고 바로 바꿈
  apply(); if(_pm) _pm.style.display='flex'; }
function closePollModal(){ _animModalClose(document.getElementById('poll-modal')); }
function _pollOptRow(val){
  return `<div class="poll-opt-row" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
    <input class="form-input poll-opt-in" maxlength="30" style="flex:1;" placeholder="선택지" value="${_pEsc(val||'')}">
    <button type="button" onclick="this.parentElement.remove()" style="flex-shrink:0;width:46px;height:46px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);cursor:pointer;font-size:18px;line-height:1;">−</button>
  </div>`;
}
function addPollOption(){ const w=document.getElementById('poll-opts-wrap'); if(w) w.insertAdjacentHTML('beforeend', _pollOptRow('')); }
function openPollCreate(){ if(!currentUser||!currentUser.staffId){ toast('이름으로 로그인 후 만들 수 있습니다.','error'); return; } _pollShow(_pollCreateHtml(), ()=>{ if(_pollWide()){ document.getElementById('poll-modal-card')?.classList.add('pc-wide-card'); _pollEndPickers(); } }, true); }
// 넓은 화면(≥1001px): 투표 만들기 좌우 2분할 — 왼쪽 종료 날짜 달력·마감 시간·조용히 / 오른쪽 제목·선택지·설명 + 버튼(css/popup-wide.css)
function _pollWide(){ return !!(window.matchMedia && matchMedia('(min-width:1001px)').matches); }
function _pollCreateHtml(){
  const head=`<div class="modal-header"><div class="mh-title">투표 만들기</div><button class="modal-close" onclick="closePollModal()">✕</button></div>`;
  const S=[`    <div class="ev-sect ev-tint">
      <label class="form-label">투표 제목</label>
      <input id="poll-title-in" class="form-input" maxlength="60" placeholder="예: 회식 참석여부">
    </div>
`,`    <div class="ev-sect">
      <label class="form-label">간단한 설명 <span style="color:var(--muted);font-weight:400;font-size:11px;">(선택)</span></label>
      <textarea id="poll-desc-in" class="form-input" rows="3" style="resize:vertical;" placeholder="투표에 대한 안내를 적어주세요"></textarea>
    </div>
`,`    <div class="ev-sect">
      <label class="form-label">종료 일시</label>
      <input type="datetime-local" id="poll-end-in" class="form-input" style="width:auto;">
    </div>
`,`    <div class="ev-sect">
      <label class="form-label">선택지 <span style="color:var(--muted);font-weight:400;font-size:11px;">(2개 이상)</span></label>
      <div id="poll-opts-wrap">${_pollOptRow('')}${_pollOptRow('')}</div>
      <button type="button" onclick="addPollOption()" style="margin-top:2px;background:rgba(224,72,60,.09);color:#e0483c;border:1px dashed rgba(224,72,60,.4);border-radius:12px;padding:9px;width:100%;font-size:13px;font-weight:700;cursor:pointer;">+ 선택지 추가</button>
    </div>
`,`    <div class="ev-sect">
      <label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13.5px;font-weight:600;color:var(--text);">
        <input type="checkbox" id="poll-silent" style="width:18px;height:18px;cursor:pointer;flex-shrink:0;">
        <span style="display:inline-flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>조용히 만들기 <span style="color:var(--muted);font-weight:400;">(전 직원 알림 안 보냄)</span></span>
      </label>
    </div>
`];   // 0 제목 · 1 설명 · 2 종료 · 3 선택지 · 4 조용히
  const act=`  <div class="p-actions">
    <button class="btn btn-primary" style="flex:1;" onclick="submitPoll()">투표 만들기</button>
    <button class="btn btn-outline" style="width:auto;padding-left:20px;padding-right:20px;" onclick="closePollModal()">취소</button>
  </div>`;
  // 넓은 화면: 왼쪽 종료 날짜 달력 + 마감 시간 직접 입력 + 조용히 / 오른쪽 제목·선택지·설명 + 버튼 (값은 숨긴 poll-end-in에 그대로 → submitPoll 그대로)
  const SW=`    <div class="ev-sect pc-when">
      <label class="form-label">종료 날짜</label>
      <input type="datetime-local" id="poll-end-in" class="form-input nd-native-src">
      <div id="poll-end-cal"></div>
      <label class="form-label pc-time-lbl">마감 시간</label>
      <div id="poll-end-time"></div>
    </div>
`;
  if(_pollWide()) return head+`<div class="pc-wide"><div class="pc-col pc-left poll-scroll">${SW}${S[4]}</div><div class="pc-col pc-right"><div class="poll-scroll">${S[0]}${S[3]}${S[1]}</div>${act}</div></div>`;
  return head+`<div class="poll-scroll">${S[0]}${S[1]}${S[2]}${S[3]}${S[4]}</div>`+act;
}
// 종료 날짜 달력·마감 시간(js/nd-cal.js) → poll-end-in 값('YYYY-MM-DDTHH:MM')으로 합침. 오늘 이전 날짜는 못 고름
function _pollEndPickers(){
  const inp=document.getElementById('poll-end-in'), ch=document.getElementById('poll-end-cal'), th=document.getElementById('poll-end-time');
  if(!inp||!ch||!th||typeof ndCal!=='function') return;
  const n=new Date(), today=toDateStr(n.getFullYear(), n.getMonth()+1, n.getDate());
  let d='', t='18:00';
  const sync=()=>{ inp.value = d&&t ? d+'T'+t : ''; };
  ndCal(ch, { get:()=>d, set:v=>{ d=v; sync(); }, min:today });
  ndTime(th, { get:()=>t, set:v=>{ t=v||''; sync(); }, optional:false, presets:['12:00','15:00','18:00','21:00','23:59'] });
}
async function submitPoll(){
  if(!currentUser||!currentUser.staffId){ toast('이름으로 로그인 후 만들 수 있습니다.','error'); return; }
  const title=(document.getElementById('poll-title-in').value||'').trim();
  const desc=(document.getElementById('poll-desc-in').value||'').trim();
  const endAt=document.getElementById('poll-end-in').value;
  const opts=Array.prototype.map.call(document.querySelectorAll('#poll-opts-wrap .poll-opt-in'), i=>i.value.trim()).filter(Boolean);
  if(!title){ toast('투표 제목을 입력하세요.','error'); return; }
  if(opts.length<2){ toast('선택지를 2개 이상 입력하세요.','error'); return; }
  if(!endAt){ toast('종료 일시를 선택하세요.','error'); return; }
  if(new Date(endAt).getTime() < Date.now()){ toast('종료 일시가 이미 지났습니다.','error'); return; }
  const poll={ id:'pl'+Date.now().toString(36)+Math.floor(Math.random()*1e5).toString(36), title, desc, options:opts.map(l=>({label:l})), votes:{}, endAt, createdAt:new Date().toISOString(), createdBy:(currentUser.name||''), createdById:(currentUser.staffId||'') };
  const ok=await _pollCommit((polls)=>{ _pollPurgeInPlace(polls); polls.unshift(poll); });
  if(!ok){ toast('저장에 실패했습니다. 네트워크 확인 후 다시 시도하세요.','error'); return; }
  const silent=!!(document.getElementById('poll-silent')&&document.getElementById('poll-silent').checked);
  _pollCloseBlur();                                     // 생성 팝업 블러아웃
  setTimeout(function(){ renderPolls(); }, 210);        // 팝업 사라지는 흐름에 이어 투표 자연스럽게 등장
  if(!silent) _sendNoticePush(`${poll.createdBy?poll.createdBy+'님이 ':''}'${title}' 투표를 올렸어요. ${_pollFmtEnd(endAt)}까지 참여해 주세요.`, '📊 새 투표', 'poll');
  setTimeout(function(){ toast(silent?'투표를 만들었습니다.':'투표를 만들고 전 직원에게 알렸습니다.','success'); }, 300);
}

// 과거 투표
function openPollPast(){ _pollShow(_pollPastHtml(), null, true); }
function _pollPastHtml(){
  const canDel=(isAdmin||isMaster);
  const past=(data.polls||[]).filter(p=>p && _pollEnded(p) && !_pollTooOld(p)).sort((a,b)=>((b.endAt||'')<(a.endAt||'')?-1:1));
  let rows;
  if(!past.length){ rows=`<div style="text-align:center;color:var(--muted);font-size:13px;padding:34px 0;">종료된 투표가 없습니다.</div>`; }
  else rows=past.map(p=>{
    const votes=p.votes||{}, total=Object.keys(votes).length;
    const counts=(p.options||[]).map((o,i)=>Object.values(votes).filter(v=>v===i).length);
    let topI=0; counts.forEach((c,i)=>{ if(c>counts[topI]) topI=i; });
    const tc=POLL_COLORS[topI%POLL_COLORS.length];
    const del=(canDel||_pollIsMine(p))?`<button onclick="event.stopPropagation();deletePoll('${p.id}')" style="flex-shrink:0;background:none;border:none;color:#e0483c;cursor:pointer;font-size:12px;font-weight:700;padding:4px 6px;">삭제</button>`:'';
    return `<div onclick="openPollDetail('${p.id}')" style="border-radius:14px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);box-shadow:0 1px 3px rgba(20,24,40,.05);cursor:pointer;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-size:14px;font-weight:800;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_pEsc(p.title)}</div>${del}
      </div>
      <div style="font-size:11.5px;color:var(--muted);font-weight:600;margin-top:4px;">${_pollFmtEnd(p.endAt)} 종료 · ${total}명 참여${total?` · 최다 <b style="color:${tc};">${_pEsc((p.options[topI]||{}).label||'')}</b>`:''}</div>
    </div>`;
  }).join('');
  return `<div class="modal-header"><div class="mh-title">과거 투표 <span class="mh-sub" style="font-size:11px;color:var(--muted);font-weight:500;margin-left:3px;">(1년 보관)</span></div><button class="modal-close" onclick="closePollModal()">✕</button></div>
  <div class="poll-scroll" style="padding:14px 18px 20px;display:flex;flex-direction:column;gap:9px;">${rows}</div>`;
}
async function deletePoll(id){
  const p=(data.polls||[]).find(x=>x.id===id);
  if(!(isAdmin||isMaster||(p&&_pollIsMine(p)))){ toast('올린 사람 또는 관리자·마스터만 삭제할 수 있습니다.','error'); return; }
  if(!confirm('이 투표를 삭제할까요? 되돌릴 수 없습니다.')) return;
  const host=document.getElementById('home-polls');
  const card=host&&host.querySelector('.poll-card[data-pid="'+id+'"]');
  const onlyOne=host&&host.querySelectorAll('.poll-card').length===1;
  if(card){
    try{
      card.animate([{opacity:1,filter:'blur(0px)',transform:'scale(1)'},{opacity:0,filter:'blur(14px)',transform:'scale(0)'}],{duration:1000,easing:'cubic-bezier(.28,0,.05,1)',fill:'forwards'});
      if(onlyOne){ const H=host.scrollHeight; host.style.overflow='hidden'; host.animate([{maxHeight:H+'px',marginBottom:'14px'},{maxHeight:'0px',marginBottom:'0px'}],{duration:1100,easing:'cubic-bezier(.28,0,.05,1)',fill:'forwards'}); }
      await new Promise(res=>setTimeout(res,820));
    }catch(e){}
  }
  const ok=await _pollCommit((polls)=>{ const i=polls.findIndex(x=>x.id===id); if(i<0) return false; polls.splice(i,1); });
  if(host){ host.style.overflow=''; host.style.maxHeight=''; }
  renderPolls();
  if(ok){ const pm=document.getElementById('poll-modal'); if(pm && pm.style.display==='flex') _pollShow(_pollPastHtml()); toast('삭제했습니다.','success'); }   // 같은 화면 다시 그리기 → 전환 효과 없이
  else toast('삭제에 실패했습니다. 다시 시도하세요.','error');
}
// 화면 폭이 1001px을 넘나들면 열린 투표 '자세히 보기'를 그 폭의 배치로 다시 그림 — 쓰던 댓글·커서는 유지
(function(){
  if(!window.matchMedia) return;
  const mq=matchMedia('(min-width:1001px)');
  const onChange=()=>{
    const id=window._pollDetailId, pm=document.getElementById('poll-modal'), c=document.getElementById('poll-modal-card');
    if(!id || !pm || pm.style.display!=='flex' || !c) return;
    const p=(data.polls||[]).find(x=>x.id===id); if(!p) return;
    const ta=c.querySelector('.ndcm textarea'), draft=ta?ta.value:'', had=ta&&document.activeElement===ta;
    c.innerHTML=_pollDetailHtml(p); c.classList.toggle('pc-wide-card', mq.matches);
    const nt=c.querySelector('.ndcm textarea'); if(nt && draft){ nt.value=draft; if(typeof ndCmtGrow==='function') ndCmtGrow(nt); } if(nt && had) nt.focus();
  };
  if(mq.addEventListener) mq.addEventListener('change', onChange); else if(mq.addListener) mq.addListener(onChange);
})();
