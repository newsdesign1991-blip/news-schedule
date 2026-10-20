/* [모듈] js/app-mode.js — 근무표 앱(설치판, desktop/ Electron, html.nd-app) 전용 제목줄 | dashboard.html 메인 스크립트 맨 끝. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// 앱은 윈도 기본 제목줄을 숨기고(desktop/main.js titleBarStyle hidden — 최소화·최대화·닫기만 오른쪽 끝에 겹쳐 그림) 이 제목줄(#nd-titlebar)을 씀:
// 왼쪽 앱 이름 · 관리자면 [근무표 작성소] · 관리자 탭(#admin-area .admin-tabs 를 그대로 옮겨 옴 — showAdminTab·탭 숨김 규칙 그대로), 일반 직원이면 [알림 설정] ·
// 오른쪽 끝 날짜·라이트/다크 버튼(위쪽 떠 있는 머리줄 header 에서 옮겨 옴 — 앱에선 header 를 숨김, 이름 인사는 없앰). 빈 곳을 끌면 창이 움직임.
// 높이는 desktop/main.js TITLEBAR_H(44)와 같게. 색은 테마(밝기)에 맞춰 ndApp.setTitleBar 로 창 버튼 색도 맞춤.
function _ndTitlebarInit(){
  if(!ND_APP||document.getElementById('nd-titlebar')) return;
  const bar=document.createElement('div'); bar.id='nd-titlebar';
  bar.innerHTML='<div class="ndt-brand"><img src="icon-192.png" alt=""><span>근무표</span></div>'
    +'<nav class="ndt-nav" aria-label="앱 메뉴"><button class="ndt-ws" type="button" onclick="showView(\'workshop\')">근무표 작성소</button><span class="ndt-sep" aria-hidden="true"></span></nav>'
    +'<nav class="ndt-user" aria-label="내 메뉴"><button type="button" onclick="openNotifySheet()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>알림 설정</button></nav>';
  const tabs=document.querySelector('#admin-area .admin-tabs'), nav=bar.querySelector('.ndt-nav');
  if(tabs){
    nav.appendChild(tabs);
    // 작성소에서 관리자 탭을 누르면 관리자 화면으로(탭 버튼의 showAdminTab 다음에), 반쯤 가려진 탭이면 다 보이게 밀어 줌
    tabs.addEventListener('click',e=>{ const t=e.target.closest('.admin-tab'); if(!t) return; if(currentView!=='admin') showView('admin'); _ndNavReveal(t); });
  }
  // 관리자 탭이 제목줄보다 길면(기본 창 1560px에서도 넘침 — 스크롤바는 숨김) 보통 마우스 휠(세로)로도 옆으로 넘김. 가로 휠·터치패드는 원래대로
  nav.addEventListener('wheel',e=>{
    if(e.ctrlKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX)) return;
    const max=nav.scrollWidth-nav.clientWidth; if(max<=0) return;
    const to=Math.max(0,Math.min(max,nav.scrollLeft+e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?nav.clientWidth:1)));
    if(Math.abs(to-nav.scrollLeft)<1) return;   // 끝까지 갔으면 휠은 원래대로(소수점 scrollLeft 감안)
    e.preventDefault(); nav.scrollLeft=to;
  },{ passive:false });
  const right=document.createElement('div'); right.className='ndt-right';
  if(window.ndApp?.wiseLogin){
    const wb=document.createElement('button'); wb.type='button'; wb.className='ndt-wise'; wb.id='ndt-wise'; wb.onclick=ndWiseLogin;
    right.appendChild(wb);
  }
  ['header-date','theme-toggle'].forEach(id=>{ const el=document.getElementById(id); if(el) right.appendChild(el); });
  // 관리자 모드 나가기(관리자일 때만 보임) — 빨간 관리자 띠(앱에선 숨김)의 로그아웃 대신
  const ex=document.createElement('button'); ex.type='button'; ex.className='ndt-exit'; ex.textContent='관리자 나가기'; ex.onclick=ndAdminExit;
  right.appendChild(ex);
  if(window.ndApp?.updateCheck){
    const t=document.createElement('button'); t.type='button'; t.className='ndt-tool'; t.title='앱 정보·업데이트'; t.setAttribute('aria-label','앱 정보·업데이트');
    t.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
    t.onclick=e=>{ e.stopPropagation(); _ndToolToggle(t); };
    right.appendChild(t);
  }
  // 알림함 종(js/alarms.js, 원래 이름 바에 있음)은 렌치 바로 왼쪽
  const al=document.getElementById('hdr-alarm'); if(al) right.insertBefore(al, right.querySelector('.ndt-tool'));
  bar.appendChild(right);
  document.body.prepend(bar);
  _ndWiseState(null);   // 문서에 붙인 뒤에(getElementById)
  window.ndApp?.onWiseState?.(on=>_ndWiseState(on));   // 앱이 10분마다 WISE 로그인을 이어 주다 끊긴 걸 알면(desktop/wise-fetch.js wiseKeepAlive)
  _ndTitlebarSync();
  new MutationObserver(_ndTitlebarColors).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  _ndTitlebarColors();
}
// 지금 화면 표시(작성소면 [근무표 작성소]가, 관리자면 그 탭이 켜짐, 다른 화면이면 둘 다 꺼짐)·로그인 여부(일반 직원 메뉴) — showView·_updateUserHeader 끝에서 부름
function _ndTitlebarSync(){
  const bar=document.getElementById('nd-titlebar'); if(!bar) return;
  bar.classList.toggle('logged', !!(typeof currentUser!=='undefined'&&currentUser&&!currentUser.adminRole));
  bar.classList.toggle('wise-ok', _ndWiseAllowed());   // WISE 로그인 버튼: 관리자 + 직원A(10-17)
  // 사이드바 아래 '계정 정보' 자리에 로그인한 사람 이름
  const acc=document.querySelector('#side-nav .snav-bottom .snav-btn[onclick="openAccountSheet()"] span');
  if(acc){ if(!acc.dataset.orig) acc.dataset.orig=acc.textContent; acc.textContent=(typeof currentUser!=='undefined'&&currentUser&&currentUser.name)||acc.dataset.orig; }
  bar.classList.toggle('on-ws', currentView==='workshop'); bar.classList.toggle('on-admin', currentView==='admin');
  if(currentView==='admin') requestAnimationFrame(()=>_ndNavReveal(bar.querySelector('.ndt-nav .admin-tab.active')));   // 마스터는 오른쪽 끝 [설정]으로 열림
  if(_ndWiseAllowed()) _ndWiseCheckOnce();
}
// 제목줄 탭 줄에서 그 탭이 잘려 있으면 다 보이게 가로로 밀기(양옆 24px 여유)
function _ndNavReveal(el){
  const nav=el&&el.closest('.ndt-nav'); if(!nav||nav.scrollWidth<=nav.clientWidth) return;
  const n=nav.getBoundingClientRect(), r=el.getBoundingClientRect(), pad=24;
  if(!r.width) return;
  if(r.left<n.left+pad) nav.scrollLeft-=n.left+pad-r.left;
  else if(r.right>n.right-pad) nav.scrollLeft+=r.right-(n.right-pad);
}
// 관리자 모드 나가기: 직원으로 들어와 관리자 모드를 켠 경우 → 직원 화면(홈), 관리자 계정으로 들어온 경우 → 로그인 화면
function ndAdminExit(){
  const standalone=!!(typeof currentUser!=='undefined'&&currentUser&&currentUser.adminRole);
  adminLogout();
  if(!standalone) showView('home');
  _ndTitlebarSync();
}
// WISE 로그인 버튼 표시: true = 연결됨(초록 점), false = 로그인 필요, null = 모름(처음)
let _ndWiseOn=null, _ndWiseChecked=false;
function _ndWiseState(on){
  _ndWiseOn=on; const b=document.getElementById('ndt-wise'); if(!b) return;
  b.classList.toggle('on', on===true);
  b.innerHTML='<span class="ndw-dot" aria-hidden="true"></span>'+(on===true?'WISE 연결됨':'WISE 로그인');
  b.title=on===true?'WISE에 로그인돼 있어요 — 누르면 오늘의 식사를 새로 받아요':'WISE에 로그인하면 휴가·오늘의 식사를 저절로 받아요';
}
// WISE 로그인 버튼을 보일 사람: 관리자 모드 또는 직원A(직원B는 WISE 를 안 씀)
function _ndWiseAllowed(){
  if(typeof isAdmin!=='undefined'&&isAdmin) return true;
  return _wtAllowed();
}
// 버튼이 보이는 사람이면 한 번 숨은 창으로 확인(로그인 창은 안 띄움)
function _ndWiseCheckOnce(){
  if(_ndWiseChecked||!_ndWiseAllowed()) return;
  // 앱 1.2.2~: 저장된 로그인(쿠키)으로 바로 표시 — 숨은 WISE 화면을 열지 않음. 서버가 끊었으면 30초 뒤 이어 주기(wiseKeepAlive)가 '로그인'으로 바꿈(10-20)
  if(window.ndApp?.wiseInfo){ _ndWiseChecked=true; window.ndApp.wiseInfo().then(i=>{ if(i) _ndWiseState(i.connected===false?false:!!i.loggedIn); }).catch(()=>{}); return; }
  if(!window.ndApp?.wiseCheck) return;
  _ndWiseChecked=true;
  window.ndApp.wiseCheck().then(r=>{ if(r&&r.loggedIn!==null&&r.loggedIn!==undefined) _ndWiseState(!!r.loggedIn); }).catch(()=>{});
}
async function ndWiseLogin(){
  const b=document.getElementById('ndt-wise'); if(!b||b.disabled) return;
  if(_ndWiseOn&&window.ndApp?.wiseInfo){ _ndWisePop(b); return; }   // 연결됨 → 누구로·언제 로그인했는지 + 로그아웃(10-20)
  b.disabled=true; b.innerHTML='<span class="ndw-dot" aria-hidden="true"></span>'+(_ndWiseOn?'식단 받는 중…':'WISE 창에서 로그인…');
  try{
    const r=await window.ndApp.wiseLogin();
    if(r&&r.ok){ _ndWiseState(true); if(!r.already) toast('WISE에 로그인했어요. 오늘의 식사를 받아요.','success');
      if(typeof _mealAppAuto==='function'){ b.innerHTML='<span class="ndw-dot" aria-hidden="true"></span>식단 받는 중…'; await _mealAppAuto(true); } }
    else { _ndWiseState(false); if(r&&r.reason==='busy') toast('WISE에서 다른 일을 하는 중이에요. 잠시 뒤 다시 눌러 주세요.',''); }
  }catch(e){ _ndWiseState(false); }
  finally{ b.disabled=false; _ndWiseState(_ndWiseOn); }
}
// ── WISE 로그인 정보·로그아웃(10-20 요청) — 제목줄 'WISE 연결됨' 창과 계정 정보 오른쪽에 같은 내용 ──
function _wiAgo(iso){ const t=Date.parse(iso||''); if(!t) return ''; const m=Math.round((Date.now()-t)/60000); return m<1?'방금':m<60?`${m}분 전`:m<1440?`${Math.floor(m/60)}시간 전`:`${Math.floor(m/1440)}일 전`; }
function _wiWhen(iso){ const t=Date.parse(iso||''); if(!t) return '기록 없음'; const d=new Date(t); return `${d.getMonth()+1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} · ${_wiAgo(iso)}`; }
function ndWiseInfoHTML(i, inPop){
  const row=(k,v)=>`<div class="wiq-row"><span>${k}</span><b>${_wiEsc(v||'-')}</b></div>`;
  return `<div class="wiq">
    <div class="wiq-head"><span class="wiq-badge" aria-hidden="true">W</span><div><b>WISE 연결됨</b><small>앱을 껐다 켜도 로그인이 이어져요</small></div></div>
    <div class="wiq-rows">${row('이름',i.name)}${row('부서',[i.dept,i.company].filter(Boolean).join(' · '))}${row('아이디',i.id)}${row('로그인',_wiWhen(i.at))}</div>
    <div class="wiq-btns">${inPop?'<button type="button" class="wiq-meal" onclick="_ndWiseMeal(this)">오늘의 식사 새로 받기</button>':''}<button type="button" class="wiq-out" onclick="ndWiseLogout(this)">WISE 로그아웃</button></div>
  </div>`;
}
async function _ndWisePop(btn){
  let pop=document.getElementById('ndt-pop');
  if(pop){ const same=pop.dataset.kind==='wise'; pop.remove(); if(same) return; }
  pop=document.createElement('div'); pop.id='ndt-pop'; pop.dataset.kind='wise'; pop.setAttribute('role','dialog'); pop.setAttribute('aria-label','WISE 로그인 정보');
  pop.innerHTML='<div class="ndp-status">WISE 정보 읽는 중…</div>';
  document.body.appendChild(pop);
  const r=btn.getBoundingClientRect(); pop.style.top=(r.bottom+6)+'px'; pop.style.right=Math.max(8,innerWidth-r.right-60)+'px';
  setTimeout(()=>document.addEventListener('mousedown',function off(e){ if(!pop.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){ pop.remove(); document.removeEventListener('mousedown',off); } }),0);
  const i=await window.ndApp.wiseInfo().catch(()=>null);
  if(!pop.isConnected) return;
  if(!i||!i.loggedIn){ pop.remove(); _ndWiseState(false); toast('WISE 로그인이 끊겼어요. [WISE 로그인]을 눌러 다시 로그인해 주세요.',''); return; }
  pop.innerHTML=ndWiseInfoHTML(i,true);
}
async function _ndWiseMeal(b){
  b.disabled=true; b.textContent='식단 받는 중…';
  try{ if(typeof _mealAppAuto==='function') await _mealAppAuto(true); toast('오늘의 식사를 새로 받았어요.','success'); }catch(e){}
  document.getElementById('ndt-pop')?.remove();
}
// 한 번 더 눌러야 로그아웃(잘못 눌러 끊기지 않게)
async function ndWiseLogout(b){
  if(!b.dataset.sure){ b.dataset.sure='1'; b.textContent='한 번 더 누르면 로그아웃'; b.classList.add('sure'); setTimeout(()=>{ if(b.isConnected){ delete b.dataset.sure; b.textContent='WISE 로그아웃'; b.classList.remove('sure'); } },4000); return; }
  b.disabled=true; b.textContent='로그아웃하는 중…';
  const r=await window.ndApp.wiseLogout().catch(e=>({ ok:false, error:e.message }));
  if(r&&r.ok){ _ndWiseState(false); document.getElementById('ndt-pop')?.remove(); document.getElementById('acc-wise')?.remove(); document.getElementById('sheet-panel')?.classList.remove('acc-split'); toast('WISE에서 로그아웃했어요.','success'); }
  else { b.disabled=false; b.textContent='WISE 로그아웃'; delete b.dataset.sure; toast((r&&r.error)||'로그아웃하지 못했어요.','error'); }
}
// 계정 정보 시트 오른쪽(앱에서 WISE 로그인돼 있을 때만 — js/login-ui.js openAccountSheet 가 부름)
async function ndAccountWise(){
  if(!ND_APP||!window.ndApp?.wiseInfo) return;
  const i=await window.ndApp.wiseInfo().catch(()=>null);
  const body=document.getElementById('sheet-body'), panel=document.getElementById('sheet-panel');
  if(!i||!i.loggedIn||!body||!panel||document.getElementById('sheet-title')?.textContent!=='계정 정보'||document.getElementById('acc-wise')) return;
  const left=document.createElement('div'); left.className='acc-main'; while(body.firstChild) left.appendChild(body.firstChild);
  const right=document.createElement('div'); right.id='acc-wise'; right.className='acc-wise'; right.innerHTML=ndWiseInfoHTML(i,false);
  body.appendChild(left); body.appendChild(right); panel.classList.add('acc-split');
}
// ── WISE 근무시간 입력(이번 주 내 근무 칩) — 정근 12:00–21:00 · 당직 21:00–익일 10:00(N). 당직은 당직 날·다음날 어느 칩이든 당직 시작일이 근무일자(10-17 요청) ──
// 대휴: 휴일에 4시간 이상 일한 몫만 고르게 — 근무일자 몫 = 당일대휴, 자정 넘은 다음날 몫 = 익일대휴
//   예) 금 당직 → 토 00–10시 10h → 익일대휴 / 일 당직 → 일 21–24시 3h·월은 평일 → 대휴 없음 / 휴일 정근 → 당일대휴
const WT_REG={ kind:'reg', label:'정근', start:'12:00', end:'21:00', content:'뉴스그래픽 제작', key:'nd_wt_content' };
const WT_DJ={ kind:'dj', label:'당직', start:'21:00', end:'10:00', content:'뉴스그래픽 제작 / 당직근무', key:'nd_wt_content_dj' };
// 정근 = VW·CG 근무·데스크·8진·XR·PROJECT·SPORTS. 조근·오전데·일근·뉴.오·휴가는 아직 안 됨
function _wtRegular(sid, ds){
  if(typeof isOnLeave==='function'&&isOnLeave(sid,ds)) return false;
  const e=(data.schedule||{})[ds]; if(!e) return false;
  if(e.danjik===sid||e.morningDesk===sid||e.satMorning===sid||e.ilgeun===sid||e.newsOh===sid||e.newsOh2===sid) return false;
  if(typeof getDanjikExitStaff==='function'&&getDanjikExitStaff(ds)===sid) return false;
  if(e.jogeunSubs&&Object.values(e.jogeunSubs).includes(sid)) return false;
  if((e.jogeunExtra||[]).includes(sid)) return false;
  const me=staffById(sid); if(me&&String(deptOn(me,ds)||'')==='조근'&&isWeekdayForm(ds)&&!(e.restWorkers||[]).includes(sid)) return false;
  return (e.vw?.workers||[]).includes(sid)||e.vw?.desk===sid||(e.cg?.workers||[]).includes(sid)||e.cg?.desk===sid||e.cg?.desk8===sid||e.cg?.desk5===sid
    ||[e.weekday8jin,e.weekend8jin,e.weekday8jin2,e.weekend8jin2].includes(sid)||(e.xr||[]).includes(sid)||(e.project||[]).includes(sid)||(e.sports||[]).includes(sid);
}
// 그 칩 날짜의 근무 → { ...WT_REG|WT_DJ, base:근무일자 } | null
function _wtShift(sid, ds){
  if(((data.schedule||{})[ds]||{}).danjik===sid) return { ...WT_DJ, base:ds };
  if(typeof getDanjikExitStaff==='function'&&getDanjikExitStaff(ds)===sid) return { ...WT_DJ, base:addDays(ds,-1) };   // 당직 다음날(퇴근) 칩 → 전날이 근무일자
  return _wtRegular(sid,ds)?{ ...WT_REG, base:ds }:null;
}
// 휴일에 일한 시간 { same:근무일자 몫, next:자정 넘은 다음날 몫 } (휴게 빼지 않은 시각 차)
// 휴일 = 토·일·공휴일(ndIsOffDay, js/holiday-work.js) — 평일 틀 공휴일(성탄절 등)도 대휴 대상
function _wtHolHours(base, start, end){
  const m=t=>+t.slice(0,2)*60+ +t.slice(3), s=m(start), e=m(end), nx=e<=s;
  return { same:ndIsOffDay(base)?((nx?1440:e)-s)/60:0, next:nx&&ndIsOffDay(addDays(base,1))?e/60:0 };
}
// WISE 근무시간 입력을 쓸 사람: 로그인한 직원A 본인(직원B는 WISE 를 안 씀 — 관리자 모드여도 본인 기준)
function _wtAllowed(){
  const u=typeof currentUser!=='undefined'&&currentUser, s=u&&u.staffId&&staffById(u.staffId);
  return !!(s&&s.employmentType!=='freelancer');
}
// 최재영으로 로그인하면 이번 주 다른 날 칩도 열림(확인용 — 10-17 요청). 정근·당직 아닌 날도 창은 보여 줌
function _wtTester(){ const me=currentUser&&currentUser.staffId&&staffById(currentUser.staffId); return !!(me&&String(me.name||'').replace(/\s/g,'')==='최재영'); }
// 'HH:MM' 맞추기 — '1230'·'12:30'·'9:00' → '12:30'/'09:00', 틀리면 ''
function _wtHM(v){ const m=String(v||'').trim().match(/^(\d{1,2}):?(\d{2})$/); if(!m) return ''; const h=+m[1], mi=+m[2]; return h<24&&mi<60?`${String(h).padStart(2,'0')}:${m[2]}`:''; }
let _wtSt={ sh:null, cache:{}, pend:{}, dh:{ same:{ month:'', sel:'' }, next:{ month:'', sel:'' } } };
function _wtMD(ds){ const d=new Date(ds+'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`; }
function _wtTimeEdit(on){ const p=document.getElementById('wt-pop'), sh=_wtSt.sh; if(!p||!sh) return; p.querySelector('.wt-time-view').hidden=on; p.querySelector('.wt-time-edit').hidden=!on;
  if(on) p.querySelector('#wt-s').focus(); else { p.querySelector('#wt-s').value=sh.start; p.querySelector('#wt-e').value=sh.end; p.querySelector('#wt-r').value='00:00'; } _wtTimeSync(); }
// 시각이 바뀌면: 익일 표시 + 대휴(당일·익일) 칸을 휴일 4시간 기준으로 보이기/숨기기
function _wtTimeSync(){
  const p=document.getElementById('wt-pop'), sh=_wtSt.sh; if(!p||!sh) return;
  const s=_wtHM(p.querySelector('#wt-s').value), e=_wtHM(p.querySelector('#wt-e').value);
  p.querySelector('.wt-time-edit .wt-next').hidden=!(s&&e&&e<=s);
  if(!s||!e||s===e) return;
  const h=_wtHolHours(sh.base,s,e), day={ same:sh.base, next:addDays(sh.base,1) };
  ['same','next'].forEach(k=>{ const b=p.querySelector(`.wt-dhb[data-k="${k}"]`); if(!b) return; b.hidden=h[k]<4;
    b.querySelector('.wt-dh-why').textContent=h[k]>=4?`${_wtMD(day[k])} 휴일 ${+h[k].toFixed(1)}시간 근무`:''; });
}
function ndWorkTimeOpen(ds){
  const sid=currentUser&&currentUser.staffId; if(!sid||!window.ndApp?.wiseWorkTime||!_wtAllowed()) return;
  const found=_wtShift(sid,ds), tester=_wtTester();
  if(!found&&!tester){ toast('지금은 정근(12:00–21:00)·당직(21:00–익일 10:00)인 날만 WISE 근무시간을 자동으로 넣을 수 있어요.',''); return; }
  const sh=found||{ ...WT_REG, base:ds }, base=sh.base;
  document.getElementById('wt-pop')?.remove();
  _wtSt={ sh, cache:_wtSt.cache||{}, pend:{}, dh:{ same:{ month:base.slice(0,7), sel:'' }, next:{ month:addDays(base,1).slice(0,7), sel:'' } } };
  const d=new Date(base+'T00:00:00'), hol=ndIsOffDay(base), nx=sh.end<=sh.start, get=(k,v)=>{ try{ return localStorage.getItem(k)||v; }catch(e){ return v; } };
  const hm=(id,v,lbl)=>`<input class="form-input" id="${id}" value="${v}" maxlength="5" inputmode="numeric" aria-label="${lbl}" oninput="_wtTimeSync()" onblur="this.value=_wtHM(this.value)||this.value;_wtTimeSync()">`;
  const dhb=(k,lbl)=>`<div class="wt-dhb" data-k="${k}" hidden><div class="wt-row wt-dh"><span>${lbl}</span><div class="wt-seg"><label><input type="radio" name="wt-dh-${k}" value="no" checked onchange="_wtCalShow('${k}',false)">사용 안 함 <small>휴일수당 정산</small></label><label><input type="radio" name="wt-dh-${k}" value="use" onchange="_wtCalShow('${k}',true)">사용 <small>아래 휴가달력에서 날짜 고르기</small></label><small class="wt-dh-why"></small></div></div><div class="wt-cal" id="wt-cal-${k}" hidden></div></div>`;
  const el=document.createElement('div'); el.id='wt-pop'; el.className='wt-pop';
  el.innerHTML=`<div class="wt-card" role="dialog" aria-modal="true" aria-labelledby="wt-t">
    <div class="wt-head" id="wt-t">WISE 근무시간 입력</div>
    <div class="wt-body">
      <div class="wt-row"><span>근무일자</span><b>${d.getMonth()+1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})${hol?' <em class="wt-hol">휴일</em>':' <em class="wt-wd">평일</em>'}${sh.kind==='dj'?' <em class="wt-dj">당직</em>':''}${base!==ds?' <small>당직 시작한 날 기준</small>':''}</b></div>
      ${found?'':'<p class="wt-warn">이날은 정근·당직이 아니에요(확인용으로 열림). 시간을 맞게 바꿔서 넣어 주세요.</p>'}
      <div class="wt-row wt-time-view"><span>근무시간</span><b>${sh.start} – ${sh.end}${nx?' <em class="wt-next">익일 N</em>':''} <small>${sh.label} · 휴게 00:00</small></b><button type="button" class="wt-chg" onclick="_wtTimeEdit(true)">바꾸기</button></div>
      <div class="wt-row wt-time-edit" hidden><span>근무시간</span><div class="wt-hm">${hm('wt-s',sh.start,'시작 시각')}<i>–</i>${hm('wt-e',sh.end,'끝 시각')}<em class="wt-next"${nx?'':' hidden'}>익일</em><small>휴게</small><input class="form-input" id="wt-r" value="00:00" maxlength="5" inputmode="numeric" aria-label="휴게 시간" onblur="this.value=_wtHM(this.value)||this.value"><button type="button" class="wt-chg" onclick="_wtTimeEdit(false)">${sh.label}으로</button></div></div>
      <label class="wt-row"><span>근무장소</span><input class="form-input" id="wt-place" maxlength="40" value="${_wiEsc(get('nd_wt_place','목동 5층'))}"></label>
      <label class="wt-row"><span>근무내용</span><input class="form-input" id="wt-content" maxlength="40" value="${_wiEsc(get(sh.key,sh.content))}"></label>
      ${dhb('same','당일대휴')}${dhb('next','익일대휴')}
      <p class="wt-note"><b>채우고 결재</b>는 WISE 창 없이 결재 확인까지 끝내요. <b>채우기만</b>은 WISE 창에 채워 두고, 확인한 뒤 직접 결재해요.</p>
      <div class="wt-prog" id="wt-prog" hidden><i></i></div>
      <p class="wt-status" id="wt-status" role="status"></p>
    </div>
    <div class="wt-foot"><button type="button" class="wt-cancel">취소</button><button type="button" class="wt-fill">채우기만</button><button type="button" class="wt-go">채우고 결재</button></div>
  </div>`;
  document.body.appendChild(el);
  _wtTimeSync();
  const close=()=>el.remove(), st=el.querySelector('#wt-status');
  el.querySelector('.wt-cancel').onclick=close;
  el.addEventListener('click',e=>{ if(e.target===el) close(); });
  const run=async submit=>{
    const place=el.querySelector('#wt-place').value.trim(), content=el.querySelector('#wt-content').value.trim();
    const start=_wtHM(el.querySelector('#wt-s').value), end=_wtHM(el.querySelector('#wt-e').value), rest=_wtHM(el.querySelector('#wt-r').value);
    if(!start||!end||!rest){ st.textContent='시각은 12:00처럼 넣어 주세요.'; return; }
    if(start===end){ st.textContent='시작과 끝 시각이 같아요.'; return; }
    _wtTimeSync();
    const dh={};
    for(const k of ['same','next']){ const b=el.querySelector(`.wt-dhb[data-k="${k}"]`); if(!b||b.hidden){ dh[k]=null; continue; }
      const use=b.querySelector('input[type=radio]:checked')?.value==='use';
      if(use&&!_wtSt.dh[k].sel){ st.textContent=`${k==='same'?'당일':'익일'}대휴 쓸 날짜를 휴가달력에서 골라 주세요.`; return; }
      dh[k]=use?{ use:true, date:_wtSt.dh[k].sel }:{ use:false }; }
    try{ localStorage.setItem('nd_wt_place',place); localStorage.setItem(sh.key,content); }catch(e){}
    el.querySelectorAll('.wt-foot button').forEach(b=>b.disabled=true);
    const pg=el.querySelector('#wt-prog'); pg.hidden=false; pg.querySelector('i').style.width='4%';
    const off=window.ndApp.onWiseStatus?.(o=>{ st.textContent=o.t||''; if(typeof o.p==='number') pg.querySelector('i').style.width=Math.max(4,Math.min(100,o.p))+'%'; });
    try{
      const r=await window.ndApp.wiseWorkTime({ date:base, start, end, next:end<start, rest, place, content, daehyu:dh.same, daehyuNext:dh.next, submit });
      if(r&&r.ok){ close(); toast(r.submitted?'WISE 근무시간 입력을 결재까지 마쳤어요.':'WISE 근무시간을 채웠어요. WISE 창에서 확인하고 결재해 주세요.','success'); }
      else { pg.hidden=true; st.textContent=(r&&r.error)||'WISE 근무시간을 넣지 못했어요.'; el.querySelectorAll('.wt-foot button').forEach(b=>b.disabled=false); if(r&&r.reason==='login') _ndWiseState(false); }
    }catch(e){ st.textContent='WISE 근무시간을 넣지 못했어요: '+e.message; el.querySelectorAll('.wt-foot button').forEach(b=>b.disabled=false); }
    finally{ try{ off&&off(); }catch(e){} }
  };
  el.querySelector('.wt-fill').onclick=()=>run(false);
  el.querySelector('.wt-go').onclick=()=>run(true);
  el.querySelector('.wt-go').focus();
}
// 대휴 '사용' — WISE 휴가달력(그 사람이 미리 넣어 둔 대체휴가 등)을 확인 창 안에 보여 주고 날짜를 고름(desktop/wise-fetch.js wiseLeaveCal). k = 'same'(당일) | 'next'(익일)
function _wtCalShow(k,on){ const c=document.getElementById('wt-cal-'+k); if(!c) return; c.hidden=!on; if(on) _wtCalLoad(k,_wtSt.dh[k].month); }
function _wtCalGet(month){   // 같은 달은 한 번만 물어봄(당일·익일 칸이 같이 열려도)
  if(_wtSt.cache[month]) return Promise.resolve({ ok:true, items:_wtSt.cache[month] });
  if(!_wtSt.pend[month]) _wtSt.pend[month]=window.ndApp.wiseLeaveCal(month).catch(e=>({ ok:false, error:e.message })).then(r=>{ delete _wtSt.pend[month]; if(r&&r.ok) _wtSt.cache[month]=r.items||{}; return r; });
  return _wtSt.pend[month];
}
async function _wtCalLoad(k,month){
  const c=document.getElementById('wt-cal-'+k); if(!c) return;
  const S=_wtSt.dh[k]; S.month=month;
  if(!_wtSt.cache[month]){
    c.innerHTML=_wtCalHead(k,month)+'<div class="wt-cal-msg">WISE 휴가달력 불러오는 중…</div>';
    const r=await _wtCalGet(month);
    if(!document.getElementById('wt-cal-'+k)||S.month!==month) return;
    if(!r||!r.ok){ c.innerHTML=_wtCalHead(k,month)+`<div class="wt-cal-msg">${r&&r.reason==='login'?'WISE에 로그인돼 있지 않아요. 위쪽 [WISE 로그인] 후 다시 열어 주세요.':_wiEsc((r&&r.error)||'휴가달력을 불러오지 못했어요.')}</div>`; return; }
  }
  const items=_wtSt.cache[month], tdy=typeof _mealToday==='function'?_mealToday():'';
  const [yy,mm]=month.split('-').map(Number), first=new Date(yy,mm-1,1), days=[];
  for(let i=0;i<42;i++){ const t=new Date(yy,mm-1,1-first.getDay()+i), ds=toDateStr(t.getFullYear(),t.getMonth()+1,t.getDate()); if(i>=35&&t.getMonth()!==mm-1) break; days.push({ ds, out:t.getMonth()!==mm-1, items:items[ds]||[] }); }
  c.innerHTML=_wtCalHead(k,month)+'<div class="wt-cal-grid">'+['일','월','화','수','목','금','토'].map((w,i)=>`<b class="${i===0?'sun':i===6?'sat':''}">${w}</b>`).join('')
    +days.map(x=>{ const dow=new Date(x.ds+'T00:00:00').getDay(); return `<button type="button" class="wt-day${x.out?' out':''}${x.ds===S.sel?' sel':''}${x.ds===tdy?' today':''}${dow===0?' sun':dow===6?' sat':''}" onclick="_wtCalPick('${k}','${x.ds}')"><span>${+x.ds.slice(8)}</span>${x.items.map(t=>`<em>${_wiEsc(t)}</em>`).join('')}</button>`; }).join('')+'</div>'
    +`<div class="wt-cal-sel">${S.sel?`${k==='same'?'당일':'익일'}대휴 쓸 날: <b>${+S.sel.slice(5,7)}월 ${+S.sel.slice(8)}일</b>`:'대휴 쓸 날짜를 눌러 고르세요'}</div>`;
}
function _wtCalHead(k,month){ return `<div class="wt-cal-h"><button type="button" onclick="_wtCalMove('${k}',-1)" aria-label="이전 달">‹</button><b>${+month.slice(0,4)}년 ${+month.slice(5)}월</b><button type="button" onclick="_wtCalMove('${k}',1)" aria-label="다음 달">›</button><small>WISE 휴가달력</small></div>`; }
function _wtCalMove(k,n){ const [y,m]=_wtSt.dh[k].month.split('-').map(Number), d=new Date(y,m-1+n,1); _wtCalLoad(k,`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }
function _wtCalPick(k,ds){ _wtSt.dh[k].sel=ds; _wtCalLoad(k,_wtSt.dh[k].month); }
// 알림 미리보기 버튼 묶음(앱에서만) — 알림 설정 시트(js/login-ui.js)·관리자 알림 제어 탭(js/admin.js)에 넣음
function ndPreviewHTML(){
  if(!window.ndApp?.previewAlert) return '';
  return '<div class="nd-prev"><div class="nd-prev-t">알림 미리보기 <small>이 PC에만 띄워요 · 서버로 보내지 않음</small></div>'
    +'<div class="nd-prev-b"><button type="button" onclick="ndPreviewAlert(\'card\')">일반 알림</button>'
    +'<button type="button" class="p8" onclick="ndPreviewAlert(\'8jin\')">8진 알림</button>'
    +'<button type="button" class="pn" onclick="ndPreviewAlert(\'newsoh\')">오뉴스 진행 알림</button></div></div>';
}
function ndPreviewAlert(kind){
  window.ndApp?.previewAlert?.({ kind, name:(typeof currentUser!=='undefined'&&currentUser&&!currentUser.adminRole&&currentUser.name)||'' });
}
// 렌치 카드: 앱 버전 · [업데이트 확인] → 새 판이면 [지금 업데이트](설치 뒤 앱이 다시 켜짐) · [화면 새로고침](사이트 최신)
function _ndToolToggle(btn){
  let pop=document.getElementById('ndt-pop');
  if(pop){ const other=pop.dataset.kind==='wise'; pop.remove(); if(!other) return; }   // WISE 정보 창이 떠 있었으면 닫고 렌치 창을 엶
  pop=document.createElement('div'); pop.id='ndt-pop'; pop.setAttribute('role','dialog'); pop.setAttribute('aria-label','앱 정보');
  pop.innerHTML='<div class="ndp-head"><img src="icon-192.png" alt=""><div><b>근무표 앱</b><small id="ndp-ver">버전 확인 중…</small></div></div>'
    +'<div class="ndp-status" id="ndp-status">화면·기능은 근무표가 바뀌면 저절로 최신이 됩니다. 앱 자체 업데이트는 아래에서 확인하세요.</div>'
    +'<div class="ndp-btns"><button type="button" class="ndp-main" id="ndp-check">업데이트 확인</button><button type="button" id="ndp-reload">화면 새로고침</button></div>'
    +'<button type="button" class="ndp-tour" onclick="_ndTourFromMenu()">사용법 다시 보기</button>';
  document.body.appendChild(pop);
  const r=btn.getBoundingClientRect(); pop.style.top=(r.bottom+6)+'px'; pop.style.right=Math.max(8,innerWidth-r.right)+'px';
  window.ndApp.version?.().then(v=>{ const el=document.getElementById('ndp-ver'); if(el) el.textContent='버전 '+v; });
  document.getElementById('ndp-reload').onclick=()=>location.reload();
  const st=document.getElementById('ndp-status'), main=document.getElementById('ndp-check');
  main.onclick=async()=>{
    main.disabled=true; main.textContent='확인 중…';
    const u=await window.ndApp.updateCheck().catch(e=>({error:e.message}));
    main.disabled=false;
    _ndUpdMark(u);
    if(!u||u.error){ st.textContent=(u&&u.error)||'확인하지 못했습니다.'; main.textContent='다시 확인'; return; }
    if(!u.available){ st.textContent=`최신 버전입니다 (${u.current}).`; main.textContent='다시 확인'; return; }
    showAvail(u);
  };
  // 새 버전이 있다는 걸 이미 알면(저절로 확인 — _ndUpdWatch) 열자마자 [지금 업데이트]
  const showAvail=(u)=>{
    st.innerHTML=`새 버전 <b>${_wiEsc(u.latest)}</b>이 있어요 (지금 ${_wiEsc(u.current)}).`+(u.notes&&u.notes.length?'<ul>'+u.notes.map(n=>'<li>'+_wiEsc(n)+'</li>').join('')+'</ul>':'');
    main.textContent='지금 업데이트';
    main.onclick=async()=>{
      main.disabled=true; main.textContent='받는 중…';
      // 받는 진행(앱 1.2.0 다음 판부터 — 없으면 '받는 중…'만): 받기 % → 업데이트 창 여는 중
      const off=window.ndApp.onUpdateProgress?.(p=>{
        if(!main.isConnected) return;
        if(p.phase==='copy'&&p.total>0) main.textContent='받는 중… '+Math.min(100,Math.floor(p.got*100/p.total))+'%';
        else if(p.phase==='helper') main.textContent='업데이트 창 여는 중…';
      });
      const r2=await window.ndApp.updateInstall().catch(e=>({ok:false,error:e.message}));
      if(typeof off==='function') off();
      if(r2&&r2.ok){ st.textContent=r2.ui?'업데이트 창에서 설치해요. 앱은 곧 닫히고 새 버전이 켜져요.':'설치를 시작했어요. 곧 앱이 닫히고 새 버전이 켜집니다.'; main.textContent='설치 중…'; }
      else { st.textContent=(r2&&r2.error)||'업데이트하지 못했습니다.'; main.disabled=false; main.textContent='다시 시도'; }
    };
  };
  if(_ndUpd&&_ndUpd.available) showAvail(_ndUpd);
  setTimeout(()=>document.addEventListener('mousedown',function off(e){ if(!pop.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){ pop.remove(); document.removeEventListener('mousedown',off); } }),0);
}
// 앱 업데이트 저절로 확인(10-20 요청): 켜고 20초 뒤, 그 뒤 30분마다 공유 폴더 latest.json — 새 버전이면 렌치가 빨갛게 깜빡임(누르면 바로 [지금 업데이트])
let _ndUpd=null;
function _ndUpdMark(u){
  if(u&&!u.error) _ndUpd=u;
  const t=document.querySelector('#nd-titlebar .ndt-tool'); if(!t) return;
  const on=!!(_ndUpd&&_ndUpd.available);
  t.classList.toggle('upd',on);
  t.title=on?`새 버전 ${_ndUpd.latest}이 있어요 — 눌러서 업데이트`:'앱 정보·업데이트';
  t.setAttribute('aria-label',t.title);
}
async function _ndUpdWatch(){
  if(!ND_APP||!window.ndApp?.updateCheck) return;
  try{ _ndUpdMark(await window.ndApp.updateCheck()); }catch(e){ /* 사내망 밖 등 — 다음에 */ }
}
if(ND_APP){ setTimeout(_ndUpdWatch,20000); setInterval(_ndUpdWatch,30*60e3); }
// 창 버튼(최소화·최대화·닫기) 바탕·글자색을 제목줄과 같게
function _ndTitlebarColors(){
  const bar=document.getElementById('nd-titlebar'); if(!bar||!window.ndApp?.setTitleBar) return;
  const hex=c=>{ const m=String(c).match(/\d+(\.\d+)?/g)||[]; return '#'+m.slice(0,3).map(n=>Math.round(+n).toString(16).padStart(2,'0')).join(''); };
  const cs=getComputedStyle(bar);
  window.ndApp.setTitleBar({ color:hex(cs.backgroundColor), symbolColor:hex(cs.color) });
}
_ndTitlebarInit();

// ── 웹(PC 브라우저)에서 열면 근무표 PC 앱 설치 안내(10-17 요청) ──
// 받는 파일은 이 사이트 download/NDSchedule-Install.exe — 작은 '설치 도우미'(앱은 안 담음): 회사 PC(사내망)에서 켜면 최신 근무표 앱을 찾아 받아·확인·설치
// (desktop/setup-ui, desktop/build.cjs 가 만들어 download/ 에 두고 deploy.py 가 같이 올림).
// 배포 사이트의 윈도 PC 웹은 아래 ndPcBlock 이 막고(닫기 없음), 이 작은 안내(ndAppPromo)는 막지 않는 곳(localhost·file: 확인용)에서만 예전처럼:
// 윈도 PC(마우스)만, 로그인한 뒤, 한 번 띄우면 그 창에선 다시 안 띄움, [다시 보지 않기]면 이 브라우저에선 끝. 비상 통과(?pc=1) 탭에선 안 띄움
// 받기 버튼 + 설치 3단계(안내 창·막는 화면 같이 씀)
function _apxGuideHTML(){
  return `<a class="apx-dl" href="download/NDSchedule-Install.exe" download="NDSchedule-Install.exe"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>설치 도우미 받기</a>
      <div class="apx-steps">
        <div class="apx-step"><i>1</i><div>받은 <b>NDSchedule-Install.exe</b>를 실행해요 — 브라우저가 경고하면 <b>… → 유지</b></div></div>
        <div class="apx-step"><i>2</i><div>'Windows의 PC 보호'가 뜨면 <b>추가 정보 → 실행</b></div></div>
        <div class="apx-step"><i>3</i><div>설치 도우미가 최신 근무표를 받아 설치해요 — <b>회사 PC(사내망)</b>에서만 돼요</div></div>
      </div>
      <p class="wt-note">설치는 이 PC 사용자에게만(관리자 권한 없이) 돼요. 그다음부터 업데이트는 앱 오른쪽 위 렌치에서 해요.</p>`;
}
function ndAppPromo(force){
  if(ND_APP||_ndPcBlocked||document.getElementById('apx-pop')) return;
  if(!force){
    if(_ndPcBypass) return;
    const pc=/Windows/i.test(navigator.userAgent)&&!/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)&&window.matchMedia&&matchMedia('(pointer:fine)').matches&&innerWidth>=900;
    if(!pc) return;
    try{ if(localStorage.getItem('nd_app_promo_off')==='1'||sessionStorage.getItem('nd_app_promo_seen')==='1') return; sessionStorage.setItem('nd_app_promo_seen','1'); }catch(e){}
  }
  const el=document.createElement('div'); el.id='apx-pop'; el.className='wt-pop apx-pop';
  el.innerHTML=`<div class="wt-card apx-card" role="dialog" aria-modal="true" aria-labelledby="apx-t">
    <div class="wt-head apx-head" id="apx-t"><img src="icon-192.png" alt="">근무표 PC 앱을 설치해 주세요</div>
    <div class="wt-body">
      <p class="apx-lead">PC에서는 <b>근무표 앱</b>으로 쓰면 더 편해요. 화면·데이터는 지금 웹과 똑같아요.</p>
      <ul class="apx-list">
        <li><b>PC 알림</b> — 8진·오뉴스 진행을 화면 테두리 알림으로, 근무·공지 알림도 PC로</li>
        <li><b>WISE 자동</b> — 근무 칩을 누르면 근무시간 입력, 휴가·식단도 저절로</li>
        <li><b>진입시간</b> — 오늘 8뉴스·오뉴스 시각</li>
      </ul>
      ${_apxGuideHTML()}
    </div>
    <div class="wt-foot"><button type="button" class="wt-cancel apx-off">다시 보지 않기</button><button type="button" class="wt-go apx-later">나중에</button></div>
  </div>`;
  document.body.appendChild(el);
  const close=()=>el.remove();
  el.querySelector('.apx-later').onclick=close;
  el.querySelector('.apx-off').onclick=()=>{ try{ localStorage.setItem('nd_app_promo_off','1'); }catch(e){} close(); };
  el.addEventListener('click',e=>{ if(e.target===el) close(); });
}
// ── 윈도 PC 웹은 막기(10-17 요청 '웹버전은 PC에서는 못 쓰게, 모바일에서만') ──
// 부팅하자마자(로그인 기다리지 않음) 화면 전체를 설치 안내로 덮고(로그인 화면보다 위), 아래 앱은 숨김(html.nd-pc-blocked — 포커스도 못 감). 닫기·나중에·다시 보지 않기 없음.
// 막는 곳 = 근무표 앱이 아님 + 윈도 PC(UA 'Windows NT', Mobile·Android·iPhone·iPad 아님) + 배포 사이트(localhost·127.0.0.1·file: 아님). 맥·리눅스·휴대폰·태블릿은 그대로
// 비상용: 주소 끝에 ?pc=1 → 이 탭(세션)에선 안 막음(sessionStorage nd_pc_bypass). ?pc=0 → localhost 에서도 막는 화면 미리 보기(확인용)
let _ndPcBlocked=false, _ndPcBypass=false;
function _ndPcBlockWanted(){
  try{
    if(ND_APP) return false;
    const q=new URLSearchParams(location.search).get('pc');
    if(q==='0') return true;
    _ndPcBypass=q==='1';
    try{ if(_ndPcBypass) sessionStorage.setItem('nd_pc_bypass','1'); else _ndPcBypass=sessionStorage.getItem('nd_pc_bypass')==='1'; }catch(e){}
    if(_ndPcBypass) return false;
    const ua=navigator.userAgent||'';
    if(!/Windows NT/.test(ua)||/Mobile|Android|iPhone|iPad/i.test(ua)) return false;
    return !(location.protocol==='file:'||/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname));
  }catch(e){ return false; }
}
function ndPcBlock(){
  if(_ndPcBlocked) return;
  _ndPcBlocked=true;
  document.getElementById('apx-pop')?.remove();   // 작은 안내 창이 떠 있었으면 막는 화면으로 바꿈
  // body 아래는 막는 화면(#apx-pop)만 남기고 숨김 — 나중에 붙는 로그인 화면·토스트도(css/dark.css html.nd-pc-blocked 가 display:none,
  // 여기 규칙은 css 를 못 받았을 때 대비 — 숨긴 쪽은 포커스·클릭도 안 됨)
  const css=document.createElement('style'); css.id='nd-pc-block-css';
  css.textContent='html.nd-pc-blocked body>*:not(#apx-pop):not(#nd-modfail){visibility:hidden!important;pointer-events:none!important}';
  document.head.appendChild(css);
  document.documentElement.classList.add('nd-pc-blocked');
  const el=document.createElement('div'); el.id='apx-pop'; el.className='wt-pop apx-pop apx-block';
  el.style.cssText='z-index:2147483600;background:var(--bg,#f1f4f8)';   // 불투명 전체 화면, 모듈 실패 안내(#nd-modfail)만 이보다 위
  el.innerHTML=`<div class="wt-card apx-card" role="alertdialog" aria-modal="true" aria-labelledby="pcb-t" aria-describedby="pcb-d" tabindex="-1">
    <div class="wt-head apx-head" id="pcb-t"><img src="icon-192.png" alt="">PC에서는 근무표 앱으로 써 주세요</div>
    <div class="wt-body" style="padding-bottom:20px">
      <p class="apx-lead" id="pcb-d">PC 웹에서는 근무표를 열 수 없어요. <b>근무표 앱</b>을 설치해 주세요(화면·데이터는 같아요).<br>휴대폰에서는 지금처럼 웹으로 쓸 수 있어요.</p>
      ${_apxGuideHTML()}
    </div>
  </div>`;
  document.body.appendChild(el);
  const dl=el.querySelector('.apx-dl');
  // 포커스는 이 카드 안에만(숨긴 앱 쪽으로 가면 받기 버튼으로 되돌림)
  document.addEventListener('focusin',e=>{ if(!el.contains(e.target)) try{ dl.focus({ preventScroll:true }); }catch(err){} });
  try{ dl.focus({ preventScroll:true }); }catch(e){}
}
if(_ndPcBlockWanted()) ndPcBlock();
// 로그인 화면 위에 겹치지 않게 — 이름으로 로그인한 뒤에(최대 10분 기다림). 막았거나 비상 통과면 안 띄움
if(!ND_APP&&!_ndPcBlocked&&!_ndPcBypass){ let _apxN=0; const _apxT=setInterval(()=>{ if(++_apxN>300){ clearInterval(_apxT); return; } if(typeof currentUser!=='undefined'&&currentUser&&currentUser.staffId){ clearInterval(_apxT); setTimeout(()=>ndAppPromo(false),1500); } },2000); }

// ── 근무표 앱 처음 켰을 때 사용법(10-17 요청): 화면을 어둡게 하고 그 버튼만 밝게 — ① 제목줄 [WISE 로그인] ② 홈 '이번 주 내 근무' 오늘 칩 ──
// 이름으로 로그인한 뒤 한 번(localStorage nd_app_tour_v1). 렌치 메뉴 [사용법 다시 보기]로 다시. WISE 못 쓰는 사람(직원B)은 WISE 단계를 건너뜀
function _tourSteps(){
  const st=[];
  const wiseOk=typeof _ndWiseAllowed==='function'&&_ndWiseAllowed();
  if(wiseOk) st.push({ sel:'#ndt-wise', title:'먼저 WISE에 연결해요', body:'위쪽 <b>[WISE 로그인]</b>을 누르면 WISE 로그인 창만 떠요. 평소처럼 로그인하면 끝 — 버튼이 초록 <b>WISE 연결됨</b>으로 바뀌고, 앱을 껐다 켜도 연결이 유지돼요.' });
  if(wiseOk&&_wtAllowed()) st.push({ sel:['#my-schedule-card .mw-day.today','#my-schedule-card .mw-day'], home:true, title:'근무 칩을 누르면 WISE 근무시간이 자동으로', body:'홈 <b>이번 주 내 근무</b>에서 오늘 칩을 누르면 근무시간 입력 창이 떠요. 정근은 <b>12:00–21:00</b>, 당직은 <b>21:00–10:00(N)</b>이 저절로 들어가고, 휴일이면 대휴도 고를 수 있어요. <b>[채우고 결재]</b>를 누르면 결재까지 — WISE 마지막 확인만 직접 눌러 주세요.' });
  st.push({ sel:'#nd-titlebar .ndt-user button', title:'PC 알림도 켜 두세요', body:'<b>알림 설정</b>에서 PC 알림을 켜면 8진·오뉴스 진행이 화면 테두리 알림으로 와요. 앱은 창을 닫아도 오른쪽 아래 트레이에서 계속 알림을 받아요.' });
  return st;
}
function _ndTourFromMenu(){ document.getElementById('ndt-pop')?.remove(); ndAppTour(true); }   // 렌치 메뉴 [사용법 다시 보기]
function ndAppTour(force){
  if(!ND_APP||document.getElementById('tour-ov')) return;
  if(!force){ try{ if(localStorage.getItem('nd_app_tour_v1')) return; }catch(e){} }
  const steps=_tourSteps(); if(!steps.length) return;
  try{ localStorage.setItem('nd_app_tour_v1','1'); }catch(e){}
  const ov=document.createElement('div'); ov.id='tour-ov'; ov.className='tour-ov';
  ov.innerHTML='<div class="tour-hole"></div><div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-t"><div class="tour-step"></div><b class="tour-title" id="tour-t"></b><p class="tour-body"></p><div class="tour-foot"><button type="button" class="tour-skip">건너뛰기</button><button type="button" class="tour-next">다음</button></div></div>';
  document.body.appendChild(ov);
  let i=0;
  const hole=ov.querySelector('.tour-hole'), card=ov.querySelector('.tour-card');
  const place=()=>{
    const s=steps[i]; let el=null; for(const q of [].concat(s.sel)){ el=[...document.querySelectorAll(q)].find(e=>e.getBoundingClientRect().width>0); if(el) break; }   // 앞의 것(오늘 칩)부터
    card.querySelector('.tour-step').textContent=`${i+1} / ${steps.length}`;
    card.querySelector('.tour-title').textContent=s.title;
    card.querySelector('.tour-body').innerHTML=s.body;
    card.querySelector('.tour-next').textContent=i===steps.length-1?'시작하기':'다음';
    if(!el){ hole.style.cssText='left:50%;top:40%;width:0;height:0'; card.style.left=Math.max(16,(innerWidth-card.offsetWidth)/2)+'px'; card.style.top=Math.max(60,innerHeight*0.3)+'px'; return; }
    el.scrollIntoView({ block:'nearest' });
    const r=el.getBoundingClientRect(), pad=6;
    hole.style.cssText=`left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px`;
    const cw=card.offsetWidth, ch=card.offsetHeight;
    let top=r.bottom+16; if(top+ch>innerHeight-12) top=Math.max(12,r.top-ch-16);
    card.style.left=Math.min(innerWidth-cw-12,Math.max(12,r.left+r.width/2-cw/2))+'px'; card.style.top=top+'px';
  };
  const go=()=>{ const s=steps[i]; if(s.home&&typeof showView==='function'&&currentView!=='home'){ showView('home'); setTimeout(place,450); } else place(); };
  const end=()=>{ ov.remove(); removeEventListener('resize',place); };
  ov.querySelector('.tour-skip').onclick=end;
  ov.querySelector('.tour-next').onclick=()=>{ if(++i>=steps.length) end(); else go(); };
  addEventListener('resize',place);
  go();
}
// 앱: 이름으로 로그인하고 화면이 그려진 뒤 처음 한 번
if(ND_APP){ let _tN=0; const _tT=setInterval(()=>{ if(++_tN>300){ clearInterval(_tT); return; } if(typeof currentUser!=='undefined'&&currentUser&&currentUser.staffId&&document.querySelector('#my-schedule-card .mw-day')){ clearInterval(_tT); setTimeout(()=>ndAppTour(false),1800); } },2000); }

