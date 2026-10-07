/* [모듈] js/meal.js — 홈 '오늘의 식사'(SBS 목동 식단: 조식·점심·석식) 카드 + '식단 가져오기' 창 | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것)
   데이터: nd_data id='meal' (근무표 문서 main과 별도 — 저장 번호 안 올림). 쓰기는 서버 notify 함수 mode 'meal'만.
   가져오기: WISE는 로그인 세션이 있어야 식단을 주고(앱·서버가 직접 못 읽음) 사내망에서만 열림 → 회사 PC의 WISE 창에서
   즐겨찾기(북마클릿 → 루트 meal-import.js)가 그 창의 로그인으로 '나온 데까지' 읽어 저장. 끝나면 이 창에 postMessage → 바로 다시 그림. */
const MEAL_KINDS=[['조식','조식'],['중식','점심'],['석식','석식']];   // [저장 키, 화면 이름]
const MEAL_WISE_URL='https://wise.sbs.co.kr/wise/intLoginWise.jsp';
let _mealData=null, _mealAt=0, _mealLoading=null, _mealDay=null, _mealSel=null;   // _mealDay = 보고 있는 날(null = 오늘), _mealSel = 좁은 화면 탭에서 고른 식사

function _mealToday(){ const n=new Date(); return toDateStr(n.getFullYear(), n.getMonth()+1, n.getDate()); }
function _mealShiftDs(ds, n){ const {y,m,d}=parseDateStr(ds); const x=new Date(y,m-1,d+n); return toDateStr(x.getFullYear(), x.getMonth()+1, x.getDate()); }
function _mealEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _mealMd(ds){ const p=String(ds||'').split('-'); return p.length===3?`${+p[1]}월 ${+p[2]}일`:''; }
// 메뉴 글 → 줄 목록(WISE는 보통 줄바꿈으로 구분, 한 줄에 쉼표로 3개 이상이면 쉼표로 나눔)
function _mealItems(t){
  let a=String(t||'').replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(a.length===1 && /[,，]/.test(a[0])){ const b=a[0].split(/\s*[,，]\s*/).filter(Boolean); if(b.length>=3) a=b; }
  return a;
}
// 지금 시각의 식사(오늘일 때만): 9시 전 조식, 14시 전 점심, 그 뒤 석식
function _mealNowKind(){ const h=new Date().getHours(); return h<9?'조식':h<14?'중식':'석식'; }

function _mealCacheRead(){ try{ const j=JSON.parse(localStorage.getItem('nd_meal_cache')||'null'); if(j && j.days && typeof j.days==='object') return j; }catch(e){} return null; }
// 서버에서 읽기(10분 안엔 다시 안 읽음, force면 바로). 실패하면 가진 것(이 기기 보관본) 그대로
function _mealLoad(force){
  if(_mealLoading) return force ? _mealLoading.then(()=>_mealLoad(true)) : _mealLoading;   // 강제 읽기는 진행 중이던 요청이 끝난 뒤 한 번 더
  if(!force && _mealData && _mealAt && Date.now()-_mealAt<10*60e3) return Promise.resolve(_mealData);
  _mealLoading=(async()=>{
    try{
      const r=await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.meal&select=payload`,{ headers:SB_HEADERS, cache:'no-store' });
      if(r.ok){
        const a=await r.json(); const p=(a && a[0] && a[0].payload && typeof a[0].payload==='object')?a[0].payload:{ days:{} };
        if(!p.days || typeof p.days!=='object') p.days={};
        _mealData=p; _mealAt=Date.now();
        try{ localStorage.setItem('nd_meal_cache', JSON.stringify(p)); }catch(e){}
      }
    }catch(e){}
    return _mealData;
  })().finally(()=>{ _mealLoading=null; });
  return _mealLoading;
}

// ── 카드 위치(개인 설정): 기본 = 홈 맨 아래(예전 빠른 접속 자리) / 위로 = '이번 주 내 근무' 바로 아래 ──
// 카드를 길게 누르면(PC는 오른쪽 클릭도) 작은 팝업 → '맨 위로 올리기' / '원래 자리로 내리기'. 이 기기에만 기억(localStorage nd_meal_top)
// 실제 DOM을 #my-schedule-card 뒤로 옮김 → 모바일(문서 순서)·넓은 화면 격자(order 0, 같은 order는 문서 순서)·3분할 모두 같은 자리
let _mealSlot=null;   // 원래 자리 표시(주석 노드)
function _mealTopOn(){ try{ return localStorage.getItem('nd_meal_top')==='1'; }catch(e){ return false; } }
function _mealApplyPos(){
  const card=document.getElementById('home-meal'), msc=document.getElementById('my-schedule-card'); if(!card || !msc || !card.parentNode) return;
  if(!_mealSlot){ _mealSlot=document.createComment('home-meal-slot'); card.parentNode.insertBefore(_mealSlot, card); }
  const top=_mealTopOn();
  if(top && msc.nextElementSibling!==card) msc.after(card);
  else if(!top && _mealSlot.nextSibling!==card && _mealSlot.parentNode) _mealSlot.after(card);
  card.classList.toggle('meal-top', top);
  if(!card._mealLP && typeof _bindLP==='function'){ card._mealLP=true; _bindLP(card, (x,y)=>_mealPosPop(x,y)); }   // 길게 누르기(js/notice.js)
}
// 길게 누른 자리 옆에 뜨는 작은 토스 카드(주황 머리) — 바깥 누르기·Esc·스크롤로 닫힘
function _mealPosPop(x, y){
  _mealPosClose();
  const top=_mealTopOn();
  const ic=top?'<path d="M12 5v14M6 13l6 6 6-6"/>':'<path d="M12 19V5M6 11l6-6 6 6"/>';
  const pop=document.createElement('div'); pop.id='meal-pos-pop'; pop.className='meal-pos-pop'; pop.setAttribute('role','menu'); pop.setAttribute('aria-label','오늘의 식사 위치');
  pop.innerHTML=`<div class="mpp-hd">오늘의 식사</div>
    <button type="button" role="menuitem" class="mpp-item" onclick="mealSetTop(${!top})"><span class="mpp-ic"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg></span><span class="mpp-tx"><b>${top?'원래 자리로 내리기':'맨 위로 올리기'}</b><small>${top?'홈 맨 아래':'이번 주 내 근무 바로 아래'}</small></span></button>`;
  document.body.appendChild(pop);
  const pw=pop.offsetWidth, ph=pop.offsetHeight, W=window.innerWidth, H=window.innerHeight;
  const px=(typeof x==='number')?x:W/2, py=(typeof y==='number')?y:H/2;
  pop.style.left=Math.max(10, Math.min(px-pw/2, W-pw-10))+'px';
  pop.style.top=(py+14+ph>H-10 ? Math.max(10, py-ph-14) : py+14)+'px';
  setTimeout(()=>{ document.addEventListener('pointerdown', _mealPosOutside, true); document.addEventListener('keydown', _mealPosKey, true); window.addEventListener('scroll', _mealPosClose, { passive:true, once:true }); pop.querySelector('.mpp-item')?.focus({ preventScroll:true }); }, 0);
}
function _mealPosOutside(e){ const p=document.getElementById('meal-pos-pop'); if(p && !p.contains(e.target)) _mealPosClose(); }
function _mealPosKey(e){ if(e.key==='Escape'){ e.preventDefault(); _mealPosClose(); } }
function _mealPosClose(){ const p=document.getElementById('meal-pos-pop'); if(p) p.remove(); document.removeEventListener('pointerdown', _mealPosOutside, true); document.removeEventListener('keydown', _mealPosKey, true); window.removeEventListener('scroll', _mealPosClose); }
// 위치 바꾸기 — 블러로 사라졌다가 새 자리에서 또렷하게(전환 취향), 옮긴 자리로 부드럽게 스크롤
function mealSetTop(on){
  _mealPosClose();
  const card=document.getElementById('home-meal'); if(!card) return;
  try{ localStorage.setItem('nd_meal_top', on?'1':'0'); }catch(e){ toast('이 기기에서는 위치를 기억할 수 없어요.','error'); return; }
  const reduce=!!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let out=null; if(!reduce){ try{ out=card.animate([{opacity:1,filter:'blur(0px)',transform:'none'},{opacity:0,filter:'blur(10px)',transform:'scale(.97)'}],{duration:220,easing:'cubic-bezier(.4,0,.5,1)',fill:'forwards'}); }catch(e){} }
  setTimeout(()=>{   // 애니메이션 완료를 기다리지 않음(창이 안 보일 때 멈춰도 옮겨지게)
    _mealApplyPos(); if(typeof layoutHomeMasonry==='function') layoutHomeMasonry();
    try{ if(out) out.cancel(); }catch(e){}
    try{ card.scrollIntoView({ block:'nearest', behavior:reduce?'auto':'smooth' }); }catch(e){}
    if(!reduce){ try{ card.animate([{opacity:0,filter:'blur(10px)',transform:'scale(.97)'},{opacity:1,filter:'blur(0px)',transform:'none'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'}); }catch(e){} }
    toast(on?'오늘의 식사를 맨 위로 올렸어요.':'오늘의 식사를 원래 자리로 내렸어요.','success');
  }, reduce?0:230);
}
// 홈 카드 — renderHome이 부름
function renderMeal(){
  if(!document.getElementById('meal-body')) return;
  _mealApplyPos();
  if(!_mealData) _mealData=_mealCacheRead();
  _mealPaint();
  _mealLoad().then(_mealPaint);
}
function _mealPaint(){
  const host=document.getElementById('meal-body'); if(!host) return;
  const today=_mealToday(), ds=_mealDay||today, days=(_mealData&&_mealData.days)||{};
  const keys=Object.keys(days).sort(), first=keys[0]||today, last=keys[keys.length-1]||today;
  const {m,d,date}=parseDateStr(ds);
  const rel=ds===today?'오늘':ds===_mealShiftDs(today,1)?'내일':ds===_mealShiftDs(today,-1)?'어제':'';
  const chev=dir=>`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir<0?'M15 6l-6 6 6 6':'M9 6l6 6-6 6'}"/></svg>`;
  let html=`<div class="meal-daybar"><button type="button" class="meal-nav" onclick="mealShift(-1)" data-f="prev" aria-label="이전 날"${ds<=(first<today?first:today)?' disabled':''}>${chev(-1)}</button>`+
    `<div class="meal-date">${m}월 ${d}일 (${DOW_KR[date.getDay()]})${rel?` <b>${rel}</b>`:''}</div>`+
    `<button type="button" class="meal-nav" onclick="mealShift(1)" data-f="next" aria-label="다음 날"${ds>=(last>today?last:today)?' disabled':''}>${chev(1)}</button></div>`;
  if(!_mealData || !keys.length){
    html+=`<div class="meal-empty"><div>아직 식단을 가져오지 않았어요.</div><button type="button" class="meal-empty-btn" onclick="openMealImport()">식단 가져오기</button></div>`;
  } else if(!days[ds]){
    html+=`<div class="meal-empty"><div>${ds>last?'아직 WISE에 올라오지 않은 날이에요.':'이 날은 등록된 식단이 없어요.'}</div>${ds>last?`<button type="button" class="meal-empty-btn" onclick="openMealImport()">식단 가져오기</button>`:''}</div>`;
  } else {
    const now=ds===today?_mealNowKind():'';
    const sel=_mealSel||now||'중식';   // 좁은 화면(탭)에서 보이는 식사: 고른 것 → 지금 식사 → 점심
    html+='<div class="meal-tabs" role="tablist">'+MEAL_KINDS.map(([k,name],i)=>`<button type="button" role="tab" id="meal-tab-${i}" aria-controls="meal-col-${i}" data-f="tab${i}" class="meal-tab k${i}${sel===k?' is-sel':''}" aria-selected="${sel===k}" onclick="mealTab('${k}')">${name}${now===k?'<i aria-hidden="true"></i>':''}</button>`).join('')+'</div>';
    html+='<div class="meal-grid">'+MEAL_KINDS.map(([k,name],i)=>{
      const v=days[ds][k]||{}, cs=['A','B','C'].filter(c=>v[c]);
      const body=cs.length?cs.map(c=>`<div class="meal-c">${cs.length>1?`<div class="meal-cn">코너${c}</div>`:''}<ul class="meal-t">${_mealItems(v[c]).map(x=>`<li>${_mealEsc(x)}</li>`).join('')}</ul></div>`).join('')
                           :`<div class="meal-none">운영 없음</div>`;
      return `<section class="meal-col k${i}${now===k?' is-now':''}${sel===k?' is-sel':''}" id="meal-col-${i}" role="tabpanel" aria-labelledby="meal-tab-${i}" aria-label="${name}"><div class="meal-k"><span>${name}</span>${now===k?'<em class="meal-now">지금</em>':''}</div><div class="meal-cs">${body}</div></section>`;
    }).join('')+'</div>';
  }
  const at=_mealData&&_mealData.fetchedAt?new Date(_mealData.fetchedAt):null;
  const soon=keys.length && _mealShiftDs(today,3)>last;   // 저장된 식단이 사흘 안에 끝남
  if(keys.length) html+=`<div class="meal-foot${soon?' is-soon':''}"><span>${_mealMd(last)}까지 있음</span>${at&&!isNaN(at)?`<span>${_mealAtTxt(at)} 가져옴</span>`:''}${soon?`<button type="button" onclick="openMealImport()">새로 가져오기</button>`:''}</div>`;
  if(host._mealHtml===html) return;   // 브라우저가 innerHTML을 다시 쓰면 글자가 달라져 비교가 안 맞음 → 넣은 글을 따로 기억
  const f=host.contains(document.activeElement)?document.activeElement.getAttribute('data-f'):null;   // 다시 그려도 키보드 포커스 유지
  host._mealHtml=html; host.innerHTML=html;
  if(f){ let el=host.querySelector('[data-f="'+f+'"]'); if(el && el.disabled) el=host.querySelector('[data-f="'+(f==='prev'?'next':'prev')+'"]'); if(el) el.focus(); }
}
function _mealAtTxt(at){ return `${at.getMonth()+1}월 ${at.getDate()}일 ${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`; }
function mealTab(k){ _mealSel=k; _mealPaint(); }
function mealShift(n){ const t=_mealToday(); _mealDay=_mealShiftDs(_mealDay||t, n); if(_mealDay===t) _mealDay=null; _mealSel=null; _mealPaint(); }

// ── 식단 가져오기 창 ──
function _mealBookmarklet(){
  const src=new URL('meal-import.js', location.href).href;
  return `javascript:(function(){var s=document.createElement('script');s.src='${src}?t='+Date.now();document.body.appendChild(s);})();`;
}
function openMealImport(){
  const md=document.getElementById('meal-modal'); if(!md) return;
  const bm=document.getElementById('meal-bm'); if(bm) bm.setAttribute('href', _mealBookmarklet());
  _mealImStatus();
  md.style.display='flex';
  _mealLoad(true).then(()=>{ _mealImStatus(); _mealPaint(); });
}
function closeMealImport(){ _animModalClose(document.getElementById('meal-modal')); }
function _mealImStatus(){
  const el=document.getElementById('meal-im-status'); if(!el) return;
  const keys=Object.keys((_mealData&&_mealData.days)||{}).sort();
  const at=_mealData&&_mealData.fetchedAt?new Date(_mealData.fetchedAt):null;
  el.innerHTML=keys.length
    ? `지금 저장된 식단 <b>${_mealMd(keys[0])} ~ ${_mealMd(keys[keys.length-1])}</b>${at&&!isNaN(at)?`<span>${_mealAtTxt(at)}에 가져옴</span>`:''}`
    : '아직 저장된 식단이 없어요.';
}
// 즐겨찾기용 버튼은 끌어다 놓는 것 — 여기서 누르면 안내만
function _mealBmClick(e){ e.preventDefault(); toast('이 버튼을 브라우저 즐겨찾기 막대로 끌어다 놓아 주세요.','info'); }
function mealOpenWise(){ const w=window.open(MEAL_WISE_URL, 'nd_wise'); if(!w) toast('팝업이 막혔어요. 브라우저에서 팝업을 허용해 주세요.','error'); }

// WISE 창(meal-import.js)이 끝나면 알려 줌 → 바로 다시 읽어 그림
window.addEventListener('message', e=>{
  if(e.origin!=='https://wise.sbs.co.kr') return;
  const d=e.data; if(!d || d.type!=='nd-meal') return;
  if(d.ok){
    _mealDay=null;
    _mealLoad(true).then(()=>{ _mealPaint(); _mealImStatus(); });
    toast(`목동 식단을 ${_mealMd(d.upto)||'끝'}까지 가져왔어요.`,'success');
    const md=document.getElementById('meal-modal'); if(md && md.style.display==='flex') closeMealImport();
  } else if(d.reason==='login') toast('WISE 창에서 로그인한 뒤 즐겨찾기를 다시 눌러 주세요.','info');
});
// 다른 창(WISE)에서 돌아오면 저장본이 바뀌었을 수 있음 → 오래됐으면 다시 읽기
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && document.getElementById('meal-body')){ const open=document.getElementById('meal-modal')?.style.display==='flex'; _mealLoad(open).then(()=>{ _mealPaint(); if(open) _mealImStatus(); }); } });
renderMeal();   // 첫 화면 — renderHome이 이 파일보다 먼저 불렸어도 바로 채움(데이터는 서버에서 따로 읽음)
