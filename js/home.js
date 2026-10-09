/* [모듈] js/home.js — 홈 화면(테마·오늘의 근무·주간 일정 등)·넓은 화면 벽돌쌓기 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== HOME =====
function updateLeaveReqBadge() {
  const btn=document.getElementById('nav-leavereq');
  if(!btn) return;
  if(data.leaveReq?.isOpen){
    btn.innerHTML='휴가신청 <span style="display:inline-block;background:#d65a52;color:#fff;font-size:9px;border-radius:8px;padding:1px 5px;vertical-align:middle;font-weight:700;">OPEN</span>';
  } else {
    btn.textContent='휴가신청';
  }
  const fb=document.getElementById('fnav-leavereq'); if(fb) fb.classList.toggle('has-open', !!data.leaveReq?.isOpen);   // 플로팅바 휴가 탭 점 표시
}
// 라이트/다크 테마
function _applyThemeUI(){
  const dark = document.documentElement.getAttribute('data-theme')==='dark';
  const knob = document.getElementById('tt-knob');
  if (knob) knob.innerHTML = dark ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2M19.5 12h2M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5"/></svg>';
  const tt = document.getElementById('theme-toggle');
  if (tt) tt.setAttribute('aria-checked', dark ? 'true' : 'false');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f0f0f' : '#f1f4f8');
}
function toggleTheme(){
  const dark = document.documentElement.getAttribute('data-theme')==='dark';
  if (dark) { document.documentElement.removeAttribute('data-theme'); try{localStorage.setItem('nd_theme','light');}catch(e){} }
  else { document.documentElement.setAttribute('data-theme','dark'); try{localStorage.setItem('nd_theme','dark');}catch(e){} }
  _applyThemeUI();
}
// 오후 7시~9시(19:00~20:59) 동안 "오늘의 8진" 카드를 미달 카드색으로 깜빡이며 강조
function _updateDuty8Glow(){
  const el = document.getElementById('duty8-card');
  if (!el) return;
  const h = new Date().getHours();
  // 임시(미리보기용): 앱 최초 로드 시각 + 1시간 동안 8진 강조 강제 ON, 이후 자동 해제
  let _fu = +(localStorage.getItem('_duty8ForcePreview')||0);
  if (!_fu) { _fu = Date.now() + 3600000; try { localStorage.setItem('_duty8ForcePreview', String(_fu)); } catch(e){} }
  const _forced = Date.now() < _fu;
  el.classList.toggle('duty8-glow', _forced || (h >= 19 && h < 21));
}
// 오후 4시~5시반(16:00~17:30) 동안 "오늘의 뉴오" 행을 보라색으로 깜빡이며 강조
function _updateNewsOhGlow(){
  const els = document.querySelectorAll('.noh-card');
  if (!els.length) return;
  const now = new Date();
  const mins = now.getHours()*60 + now.getMinutes();
  const on = mins >= 16*60 && mins < 17*60+30;   // 16:00 ~ 17:30
  els.forEach(el => el.classList.toggle('newsoh-glow', on));
}
function _bezierEase(x1,y1,x2,y2){
  const cx=3*x1, bx=3*(x2-x1)-cx, ax=1-cx-bx;
  const cy=3*y1, by=3*(y2-y1)-cy, ay=1-cy-by;
  const fx=t=>((ax*t+bx)*t+cx)*t, dx=t=>(3*ax*t+2*bx)*t+cx, fy=t=>((ay*t+by)*t+cy)*t;
  return function(x){ let t=x; for(let i=0;i<6;i++){ const e=fx(t)-x, d=dx(t); if(Math.abs(e)<1e-4||d===0) break; t-=e/d; } return fy(t); };
}
// 스피드 그래프 느낌: 초반 빠르게 붙었다가 길게 감속하는 꼬리
const _scrollEase=_bezierEase(0.28,0,0.05,1);
function _smoothScrollTo(targetY, duration){
  const startY=window.pageYOffset||document.documentElement.scrollTop; const diff=targetY-startY; const t0=performance.now();
  function step(now){ const p=Math.min((now-t0)/duration,1); window.scrollTo(0, startY+diff*_scrollEase(p)); if(p<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
function _scrollToWorkers(chipsId){
  const el=document.getElementById(chipsId); if(!el) return;
  const panel=el.closest('.panel')||el;
  const rect=panel.getBoundingClientRect();
  const off=Math.max(70,(window.innerHeight-rect.height)/2);
  _smoothScrollTo(Math.max(0, window.pageYOffset+rect.top-off), 820);
  panel.style.transition='outline-color .5s ease';
  panel.style.outline='2px solid rgba(49,130,246,.55)'; panel.style.outlineOffset=panel.closest('.hm3-col')?'-4px':'3px';   // 3분할 열 안에선 바깥 테두리가 잘리므로 안쪽에
  setTimeout(function(){ panel.style.outlineColor='rgba(49,130,246,0)'; }, 700);
  setTimeout(function(){ panel.style.outline=''; panel.style.outlineOffset=''; panel.style.transition=''; }, 1250);
}
// Read broadcast metadata from the published remarks, without creating duplicate calendar events.
function _news8ScheduleInfo(note) {
  const text = String(note || '');
  const entry = text.match(/(?:8\s*뉴스|뉴스\s*진입|진입(?:시간)?)\s*[:：]?\s*((?:[01]?\d|2[0-3]):[0-5]\d(?:\s*\/\s*(?:[01]?\d|2[0-3]):[0-5]\d)*)/);
  const duration = text.match(/편성(?:시간|길이)?\s*[:：]?\s*(\d+(?:\s*(?:분|['’′])?\s*\/\s*\d+)*\s*(?:분|['’′])?)/);
  if (!entry && !duration) return null;
  return { times:entry ? entry[1].split('/').map(t=>t.trim().padStart(5,'0')) : [], minutes:duration ? (duration[1].match(/\d+/g)||[]) : [] };
}
function _news8WeekCard(note) {
  const info = _news8ScheduleInfo(note);
  if (!info) return '';
  return `<div class="wm-news-card"><div class="wm-news-title">8뉴스</div>${info.times.length ? `<div class="wm-news-field"><span>진입</span><strong>${info.times.map(t=>'<span class="wm-news-value">'+t+'</span>').join('')}</strong></div>` : ''}${info.minutes.length ? `<div class="wm-news-field"><span>편성</span><strong>${info.minutes.map(n=>'<span class="wm-news-value">'+n+'분</span>').join('')}</strong></div>` : ''}</div>`;
}
function renderHome() {
  _checkLeaveReqDeadline();
  updateLeaveReqBadge();
  renderMySchedule();
  renderNoticeBar();
  renderPolls();
  if (typeof renderMeal === 'function') renderMeal();   // 오늘의 식사(js/meal.js)
  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth()+1, now.getDate());
  document.getElementById('header-date').textContent = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${DOW_FULL[now.getDay()]}`;
  const entry = data.schedule[todayStr];
  const s = data.settings;
  const _hDx=getDanjikExitStaff(todayStr);
  const _hCgEx=new Set([entry?.danjik,_hDx].filter(Boolean));
  const _hJIds=new Set(getStaff('조근').map(x=>x.id));
  const _hSpEx=new Set([entry?.satMorning,entry?.morningDesk].filter(Boolean));
  const _hLv=new Set((data.newLeaves?.[todayStr])||[]);
  const _hEx=id=>_isVw2(entry,id)||_hCgEx.has(id)||_hJIds.has(id)||_hSpEx.has(id)||_hLv.has(id)||isProbation(staffById(id),todayStr);
  const _hCgW=new Set(entry?.cg?.workers||[]);
  const _hVwS=new Set((entry?.vw?.workers||[]).filter(id=>!_hEx(id)&&!(_hCgW.has(id)&&(staffById(id)?.dept||'').toLowerCase()==='vw')));
  const _hIlVw=(entry?.ilgeun?staffById(entry.ilgeun)?.dept?.toUpperCase():'')==='VW';
  const _hIlOk=entry?.ilgeun&&!_hLv.has(entry.ilgeun)&&!_hSpEx.has(entry.ilgeun);
  const _h8=[entry?.weekend8jin,entry?.weekday8jin,entry?.weekend8jin2,entry?.weekday8jin2].filter(id=>id&&!_hSpEx.has(id)&&!_hLv.has(id));
  const _isVwDept=id=>(staffById(id)?.dept||'').toLowerCase()==='vw';
  const _isCgDept=id=>{const d=(staffById(id)?.dept||'').toLowerCase();return d==='cg'||d==='xr';};
  const _h8vwIds=_h8.filter(id=>!_hVwS.has(id)&&!_hCgW.has(id)&&_isVwDept(id));
  const _h8cgIds=_h8.filter(id=>!_hVwS.has(id)&&!_hCgW.has(id)&&_isCgDept(id));
  const _hNo=[entry?.newsOh,entry?.newsOh2].filter(id=>id&&!_hSpEx.has(id)&&!_hLv.has(id));
  const _hNoVwIds=_hNo.filter(id=>!_hVwS.has(id)&&!_hCgW.has(id)&&_isVwDept(id));
  const _hNoCgIds=_hNo.filter(id=>!_hVwS.has(id)&&!_hCgW.has(id)&&_isCgDept(id));
  const _ilVwAdd=(_hIlVw&&!_hCgW.has(entry?.ilgeun)&&_hIlOk);
  const _ilCgAdd=(!_hIlVw&&_hIlOk&&!_hVwS.has(entry?.ilgeun));
  const vwCnt=_hVwS.size+(_ilVwAdd?1:0)+_h8vwIds.length+_hNoVwIds.length;
  const cgCnt=(entry?.cg?.workers||[]).filter(id=>!_hEx(id)&&!_hVwS.has(id)).length+(entry?.xr||[]).filter(id=>!_hEx(id)).length+(_ilCgAdd?1:0)+_h8cgIds.length+_hNoCgIds.length;
  const prjCnt = (entry?.project||[]).length;
  const sptCnt = (entry?.sports||[]).length;
  // 오늘 요일/공휴일에 맞는 목표 인원 (작성소 설정 반영)
  const _hDow = now.getDay();
  const _hHoliWE = !isWeekdayForm(todayStr);   // 생성과 같은 기준(평일 편성 공휴일은 평일 목표)
  const _spToday = (s.specialDays||{})[todayStr];
  const goalVW = _spToday?.vw ?? (_hHoliWE ? (_hDow===6 ? (s.satVW||s.weekendVW||4) : (s.sunVW||s.weekendVW||4)) : (s.weekdayVW||7));
  const goalCG = _spToday?.cg ?? (_hHoliWE ? (_hDow===6 ? (s.satCG||6) : (s.sunCG||7)) : (s.weekdayCG||19));
  const vwOk = vwCnt >= goalVW;
  const cgOk = cgCnt >= goalCG;
  document.getElementById('home-summary').innerHTML = `
    <div class="dept-list">
      <div class="card-hd">부서 근무 현황</div>
      <div class="dept-row" onclick="_scrollToWorkers('vw-today-chips')">
        <div class="dept-ic vw"><svg viewBox="0 0 24 24" fill="#fff"><path d="M3 5h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg></div>
        <div class="dept-nm"><b>VW</b></div>
        <div class="dept-rt"><span class="dept-val">${vwCnt}<small>/${goalVW}명</small></span>${entry?(vwOk?'<span class="dept-tag ok">충족</span>':'<span class="dept-tag warn">미달</span>'):''}<span class="dept-chev"></span></div>
      </div>
      <div class="dept-row" onclick="_scrollToWorkers('cg-today-chips')">
        <div class="dept-ic cg"><svg viewBox="0 0 24 24" fill="#fff"><path d="M12 3a9 9 0 0 0 0 18c1 0 1.6-.8 1.6-1.6 0-.4-.2-.8-.4-1-.2-.3-.4-.6-.4-1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7-9-7Zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3.5 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg></div>
        <div class="dept-nm"><b>CG</b></div>
        <div class="dept-rt"><span class="dept-val">${cgCnt}<small>/${goalCG}명</small></span>${entry?(cgOk?'<span class="dept-tag ok">충족</span>':'<span class="dept-tag warn">미달</span>'):''}<span class="dept-chev"></span></div>
      </div>
      <div class="dept-row" onclick="_scrollToWorkers('project-today-chips')">
        <div class="dept-ic project"><svg viewBox="0 0 24 24" fill="#fff"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg></div>
        <div class="dept-nm"><b>PROJECT</b></div>
        <div class="dept-rt"><span class="dept-val">${prjCnt}<small>명</small></span><span class="dept-chev"></span></div>
      </div>
      <div class="dept-row" onclick="_scrollToWorkers('sports-today-chips')">
        <div class="dept-ic sports"><svg viewBox="0 0 24 24" fill="#fff"><path d="M7 4h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 13H8a4 4 0 0 1-4-4V6h3V4zm10 4V6h1v3a2 2 0 0 1-1 .1V8zM6 6v3H5V6h1z"/></svg></div>
        <div class="dept-nm"><b>SPORTS</b></div>
        <div class="dept-rt"><span class="dept-val">${sptCnt}<small>명</small></span><span class="dept-chev"></span></div>
      </div>
    </div>
  `;
  const monday = new Date(now);
  const curDow = now.getDay()===0?6:now.getDay()-1;
  monday.setDate(now.getDate() - curDow + homeWeekOffset*7);
  const weekDays = Array.from({length:7}, (_,i) => { const d=new Date(monday); d.setDate(monday.getDate()+i); return d; });
  let wMini = '';
  const dowLabels=['월','화','수','목','금','토','일'];
  const events = data.events || {};
  function _evCard(ds, ev) {
    const c = ev.color||'#6366f1';
    const ptIds = ev.participants||[];
    const ptNames = ptIds.map(id=>(data.staff||[]).find(s=>s.id===id)?.name).filter(Boolean);
    const cmtCnt = (ev.comments||[]).length;
    const pills = ptNames.map(n=>`<span class="wm-ev-pt" style="background:${c}22;color:${c};">${n}</span>`).join('');
    return `<div class="wm-ev-card" onclick="openEventDetail('${ds}','${ev.id}')" style="background:${c}15;--evc:${c};--evc2:${c}55;">
      ${cmtCnt?`<span class="wm-ev-cmt"><svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="flex:none;"><path d="M8 2.5c-3.1 0-5.7 1.9-5.7 4.2 0 1.3.8 2.5 2 3.3-.1.6-.4 1.2-.8 1.7-.2.2 0 .5.3.4.9-.1 1.8-.5 2.5-.9.5.1 1.1.2 1.7.2 3.1 0 5.7-1.9 5.7-4.2S11.1 2.5 8 2.5z"/></svg>${cmtCnt}</span>`:''}
      ${ev.time?`<div class="wm-ev-time" style="color:${c};">${ev.time}</div>`:''}
      <div class="wm-ev-title">${ev.title}</div>
      ${ev.location?`<div style="font-size:10px;color:var(--muted);margin-top:2px;">${ev.location}</div>`:''}
      ${pills?`<div class="wm-ev-pts">${pills}</div>`:''}
    </div>`;
  }
  // 구글 캘린더 일정(연동 시) 이번 주 발생일 인덱스
  _loadGcal();
  const _gcalWeek={};
  if(_gcalEvents && _gcalEvents.length){
    const _wkS=toDateStr(weekDays[0].getFullYear(),weekDays[0].getMonth()+1,weekDays[0].getDate());
    const _wkE=toDateStr(weekDays[6].getFullYear(),weekDays[6].getMonth()+1,weekDays[6].getDate());
    for(const ev of _gcalEvents){ if(!_gcalCalOn(ev._calId)) continue; for(const ds of _icsOccurrences(ev,_wkS,_wkE)){ (_gcalWeek[ds]=_gcalWeek[ds]||[]).push(ev); } }
  }
  function _gcalCard(ds, ev){
    const c=ev._color||'#4285f4';
    const _tl=(typeof _gcalTitleLoc==='function')?_gcalTitleLoc(ev):{title:ev.title||'',loc:ev.location||''};
    const t=(_tl.title||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const locEsc=(_tl.loc||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const meta=_gcalMeta(ev._id);
    const ptNames=(meta.participants||[]).map(id=>(data.staff||[]).find(s=>s.id===id)?.name).filter(Boolean);
    const pills=ptNames.map(n=>`<span class="wm-ev-pt" style="background:${c}22;color:${c};">${n}</span>`).join('');
    const cmtCnt=(meta.comments||[]).length;
    return `<div class="wm-ev-card" onclick="showGcalDetail('${ds}','${ev._id}')" style="background:${c}15;--evc:${c};--evc2:${c}55;cursor:pointer;">
      ${cmtCnt?`<span class="wm-ev-cmt"><svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="flex:none;"><path d="M8 2.5c-3.1 0-5.7 1.9-5.7 4.2 0 1.3.8 2.5 2 3.3-.1.6-.4 1.2-.8 1.7-.2.2 0 .5.3.4.9-.1 1.8-.5 2.5-.9.5.1 1.1.2 1.7.2 3.1 0 5.7-1.9 5.7-4.2S11.1 2.5 8 2.5z"/></svg>${cmtCnt}</span>`:''}
      ${ev.start.time?`<div class="wm-ev-time" style="color:${c};">${ev.start.time}</div>`:''}
      <div class="wm-ev-title">${t}</div>
      ${_tl.loc?`<div style="font-size:10px;color:var(--muted);margin-top:2px;">${locEsc}</div>`:''}
      ${pills?`<div class="wm-ev-pts">${pills}</div>`:''}
    </div>`;
  }
  // week-mini: 7컬럼 헤더 + 데스크탑용 이벤트 카드
  let mobileEvHtml = '';
  weekDays.forEach((d,i) => {
    const ds=toDateStr(d.getFullYear(),d.getMonth()+1,d.getDate());
    const isToday=ds===todayStr; const hasData=!!data.schedule[ds];
    const dow=d.getDay(); const isSun=dow===0; const isSat=dow===6;
    const dayEvs = events[ds]||[];
    const dayGcal = _gcalWeek[ds]||[];
    const broadcastCard = _news8WeekCard(data.schedule?.[ds]?.notes);
    const evCards = broadcastCard + dayEvs.map(ev=>_evCard(ds,ev)).join('') + dayGcal.map(ev=>_gcalCard(ds,ev)).join('');
    wMini+=`<div class="week-day-mini">
      <div class="wm-label">${dowLabels[i]}</div>
      <div class="wm-num ${isToday?'today':''} ${hasData?'has-data':''} ${isSun?'sun':isSat?'sat':''}" onclick="showDayModal('${ds}')">${d.getDate()}</div>
      ${evCards?`<div class="wm-ev-list">${evCards}</div>`:''}
    </div>`;
    // 모바일용 리스트도 동시에 생성
    if (broadcastCard || dayEvs.length || dayGcal.length) {
      const dowLbl=['일','월','화','수','목','금','토'][dow];
      mobileEvHtml += `<div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;color:${isToday?'#6366f1':'var(--muted)'};margin-bottom:6px;">${d.getMonth()+1}/${d.getDate()} (${dowLbl})${isToday?' 오늘':''}</div>
        <div style="display:flex;flex-direction:column;gap:7px;">${evCards}</div>
      </div>`;
    }
  });
  if (!mobileEvHtml) mobileEvHtml = `<div style="color:var(--muted);font-size:12px;padding:4px 2px;">이번 주 일정 없음</div>`;
  document.getElementById('home-week-mini').innerHTML = wMini;
  document.getElementById('home-events-list').innerHTML = '';
  // 모바일 전용 리스트 영역 (CSS로 데스크탑에선 숨김)
  const mobileListEl = document.getElementById('home-mobile-ev-list');
  if (mobileListEl) mobileListEl.innerHTML = mobileEvHtml;
  // 직원 먼저(프리랜서 나중) + 그 안에서는 근무표에 표시되는 순서(data.staff 배열 순서, 왼쪽부터)
  const _staffIdx=new Map((data.staff||[]).map((st,i)=>[st.id,i]));
  const _byStaffOrder=(a,b)=>{
    const sa=staffById(a),sb=staffById(b);
    const fa=(sa?.employmentType==='freelancer')?1:0, fb=(sb?.employmentType==='freelancer')?1:0;
    if(fa!==fb) return fa-fb;
    return (_staffIdx.get(a)??9999)-(_staffIdx.get(b)??9999);
  };
  function makeChips(ids, dept, deskId) {
    if (!ids.length) return '<div class="no-data">근무자 없음</div>';
    return [...ids].sort(_byStaffOrder).map(id => {
      const s=staffById(id); const isDesk=id===deskId;
      return s?`<span class="wchip ${dept.toLowerCase()}">${isDesk?'<span class="desk-star">★</span>':''}${s.name}</span>`:'';
    }).join('');
  }
  if (entry) {
    const _vwSeen=new Set();
    const _vwAll=[...(entry.vw?.workers||[]).map(id=>({id,tag:''})),..._h8vwIds.map(id=>({id,tag:'8진'})),..._hNoVwIds.map(id=>({id,tag:'뉴.오'})),...(_ilVwAdd?[{id:entry.ilgeun,tag:'일근'}]:[])].filter(x=>x.id&&!_vwSeen.has(x.id)&&(_vwSeen.add(x.id),true)).sort((a,b)=>_byStaffOrder(a.id,b.id));
    document.getElementById('vw-today-chips').innerHTML=_vwAll.length
      ? _vwAll.map(({id,tag})=>{const s=staffById(id);if(!s)return '';const isDesk=id===entry.vw?.desk;const _t=tag?` <span style="opacity:.55;font-size:9px;font-weight:700;">${tag}</span>`:'';return `<span class="wchip vw">${isDesk?'<span class="desk-star">★</span>':''}${s.name}${_t}</span>`}).join('')
      : '<div class="no-data">근무자 없음</div>';
    const _cgSeen=new Set();
    const _cgAndXr=[
      ...(entry.cg?.workers||[]).filter(id=>id!==entry.morningDesk).map(id=>({id,isXr:false,tag:''})),
      ...(entry.xr||[]).filter(id=>id!==entry.morningDesk).map(id=>({id,isXr:true,tag:''})),
      ..._h8cgIds.map(id=>({id,isXr:(staffById(id)?.dept||'').toLowerCase()==='xr',tag:'8진'})),
      ..._hNoCgIds.map(id=>({id,isXr:(staffById(id)?.dept||'').toLowerCase()==='xr',tag:'뉴.오'})),
      ...(_ilCgAdd?[{id:entry.ilgeun,isXr:(staffById(entry.ilgeun)?.dept||'').toLowerCase()==='xr',tag:'일근'}]:[])
    ].filter(x=>x.id&&!_cgSeen.has(x.id)&&(_cgSeen.add(x.id),true))
     .sort((a,b)=>{
       // 근무표 실제 컬럼 순서와 동일하게: CG 부서 그룹 전체 먼저 → XR 부서 그룹(각 그룹 내에선 직원 먼저+배열순서)
       const da=a.isXr?1:0, db=b.isXr?1:0;
       if(da!==db) return da-db;
       return _byStaffOrder(a.id,b.id);
     });
    document.getElementById('cg-today-chips').innerHTML=_cgAndXr.length
      ? _cgAndXr.map(({id,isXr,tag})=>{
          const s=staffById(id);if(!s)return '';
          const isDesk8=id===(entry.cg?.desk8||entry.cg?.desk);
          const isDesk5=id===entry.cg?.desk5;
          const _t=tag?` <span style="opacity:.55;font-size:9px;font-weight:700;">${tag}</span>`:'';
          const _mark=isDesk8?'<span class="desk-star">★</span>':isDesk5?'<span class="desk-star">☆</span>':'';
          return `<span class="wchip" style="${isXr?'background:var(--xr-chip-bg);color:var(--xr-light);':'background:var(--cg-chip-bg);color:var(--cg-chip-text);'}">${_mark}${s.name}${_t}</span>`;
        }).join('')
      : '<div class="no-data">근무자 없음</div>';
    document.getElementById('project-today-chips').innerHTML=makeChips(entry.project||[],'project',null);
    document.getElementById('sports-today-chips').innerHTML=makeChips(entry.sports||[],'sports',null);
  } else {
    ['vw-today-chips','cg-today-chips','project-today-chips','sports-today-chips'].forEach(id=>{
      document.getElementById(id).innerHTML='<div class="no-data">근무표 없음</div>';
    });
  }
  // 오늘의 당직자 / 오늘의 8진
  const _dutyName = entry?.danjik ? (staffById(entry.danjik)?.name || '') : '';
  const _duty8Id = entry?.weekday8jin || entry?.weekend8jin || null;
  const _duty8Name = _duty8Id ? (staffById(_duty8Id)?.name || '') : '';
  // 오늘의 뉴오(뉴스 진행): 1명이면 1행, 2명이면 각각 1행씩
  const _miss = '<span style="color:var(--muted);font-weight:600;">미정</span>';
  const _mic = '<svg viewBox="0 0 240 240"><defs><linearGradient id="nohGrad" x1="191.9" y1="172.4" x2="44.7" y2="72" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe3f7"/></linearGradient></defs><path fill="url(#nohGrad)" d="M120,212.4c-49.1,0-89.1-40-89.1-89.1S70.9,34.2,120,34.2s89.1,40,89.1,89.1-40,89.1-89.1,89.1ZM120,65.8c-31.7,0-57.5,25.8-57.5,57.5s25.8,57.5,57.5,57.5,57.5-25.8,57.5-57.5-25.8-57.5-57.5-57.5Z"/></svg>';
  const _nohRow = (label, nameHtml) => `
      <div class="tw-row noh-card">
        <div class="dept-ic newsoh">${_mic}</div>
        <div class="dept-nm"><span>${label}</span><b>${nameHtml}</b></div>
        <span class="dept-tag" style="color:#5b5ef0;background:rgba(99,102,241,.14);">뉴오</span>
      </div>`;
  const _nohIds = [entry?.newsOh, entry?.newsOh2].filter(Boolean);
  let _nohRowsHtml;
  if (_nohIds.length >= 2) {
    _nohRowsHtml = _nohRow('오늘의 뉴오 ①', staffById(_nohIds[0])?.name || _miss) + _nohRow('오늘의 뉴오 ②', staffById(_nohIds[1])?.name || _miss);
  } else {
    _nohRowsHtml = _nohRow('오늘의 뉴오', _nohIds.length ? (staffById(_nohIds[0])?.name || _miss) : _miss);
  }
  const _dutyRowHtml = `
    <div class="today-work">
      <div class="card-hd">오늘의 근무</div>
      <div class="tw-row">
        <div class="dept-ic duty"><svg viewBox="0 0 24 24" fill="#fff"><path d="M20.5 14.6A8.5 8.5 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1z"/></svg></div>
        <div class="dept-nm"><span>오늘의 당직</span><b>${_dutyName||_miss}</b></div>
        <span class="dept-tag" style="color:#e8890c;background:rgba(255,159,28,.16);">당직</span>
      </div>
      <div class="tw-row" id="duty8-card">
        <div class="dept-ic jin8"><svg viewBox="0 0 240 240" fill="#fff"><path d="M163.7,105.9c7.4-9.4,10.6-19.6,10.6-30.6,0-28.5-24.4-52.1-54-52.1s-53.7,22.7-53.7,52.1,3.6,22.2,10.2,31.1c-16,13.3-24.8,31.3-24.8,51,0,37.9,30.6,66.1,68.3,66.1s67.8-29.6,67.8-66-9.4-39-24.4-51.6ZM120.2,41.1c19.4,0,34.7,15.6,34.7,34.2s-3.8,16.4-8.4,21.1c-7.2-3.2-15.7-5.3-26.5-5.2v18.2c-19.4-.2-34.4-15.4-34.4-34.1s15.2-34.2,34.6-34.2ZM120.2,205.2c-27.2,0-48.8-21.4-48.8-47.7s8.9-30.2,19.2-37.9c8.6,5.6,18.7,8.5,29.8,8.5v-18.2c27.2.2,48.6,21.5,48.6,47.7s-21.6,47.7-48.8,47.7Z"/></svg></div>
        <div class="dept-nm"><span>오늘의 8진</span><b>${_duty8Name||_miss}</b></div>
        <span class="dept-tag" style="color:#e23744;background:rgba(240,68,82,.14);">8진</span>
      </div>
      ${_nohRowsHtml}
    </div>`;
  document.getElementById('home-duty-row').innerHTML = _dutyRowHtml;
  _updateDuty8Glow(); _updateNewsOhGlow();
  if (!window._duty8GlowTimer) window._duty8GlowTimer = setInterval(function(){ _updateDuty8Glow(); _updateNewsOhGlow(); }, 30000);
  (function(){
    var _pjBody=document.getElementById('home-project-body'); if(!_pjBody) return;
    // 프로젝트 진행 탭의 '홈 화면에 표시' 토글(data.settings.pjHome, 관리자)이 꺼져 있으면 홈에서 패널 숨김
    var _pjPanel=document.getElementById('home-project-panel'), _pjOn=!(data.settings&&data.settings.pjHome===false);
    if(_pjPanel) _pjPanel.style.display=_pjOn?'':'none';
    if(!_pjOn) return;
    var _pjs=(data.projects||[]);
    var _pjTot=document.getElementById('pj-home-total'); if(_pjTot) _pjTot.textContent=_pjs.length+'개';
    if(!_pjs.length){ _pjBody.innerHTML='<div style="padding:22px 0;text-align:center;color:var(--muted);font-size:13px;">등록된 프로젝트가 없습니다.</div>'; return; }
    var _dn=function(ds){return Math.round(new Date(ds+'T00:00:00').getTime()/86400000);};
    var _nd=new Date(), _tN=_dn(toDateStr(_nd.getFullYear(),_nd.getMonth()+1,_nd.getDate()));
    var _esc=function(t){return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');};
    var _al=Math.PI*46;
    var _items=_pjs.map(function(p){
      var s=_dn(p.start),e=_dn(p.end);
      var st=_tN<s?'예정':(_tN>e?'완료':'진행중');
      var pct=_tN<s?0:(_tN>e?100:(e<=s?100:Math.max(0,Math.min(100,Math.round((_tN-s)/(e-s)*100)))));
      var c=p.color||'#3182f6';
      var off=(_al*(1-pct/100)).toFixed(1);
      var _pts=(p.participants||[]).map(function(id){var st2=(data.staff||[]).find(function(x){return x.id===id;});if(!st2)return '';var d=(st2.dept||'').toLowerCase();var dc=['vw','cg','project','sports','xr'].indexOf(d)>=0?d:'';return '<span class="wchip pj-gpt-chip'+(dc?' '+dc:'')+'">'+_esc(st2.name)+'</span>';}).join('');
      return '<div class="pj-gauge-item">'
        +'<div style="position:relative;width:100%;max-width:112px;margin:0 auto;">'
        +'<svg viewBox="0 0 110 62" style="width:100%;height:auto;display:block;">'
        +'<path d="M9 56 A46 46 0 0 1 101 56" fill="none" stroke="var(--surface2)" stroke-width="11" stroke-linecap="round"/>'
        +'<path d="M9 56 A46 46 0 0 1 101 56" fill="none" stroke="'+c+'" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+_al.toFixed(1)+'" stroke-dashoffset="'+off+'"/>'
        +'</svg>'
        +'<div style="position:absolute;left:0;right:0;bottom:0;text-align:center;">'
        +'<div style="font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1;">'+pct+'<span style="font-size:10px;font-weight:700;color:var(--muted);">%</span></div>'
        +'</div></div>'
        +'<div class="pj-gauge-name" title="'+_esc(p.name)+'">'+_esc(p.name)+'</div>'
        +'<div class="pj-gauge-st" style="color:'+(st==='진행중'?c:'var(--muted)')+';">'+st+'</div>'
        +(_pts?'<div class="pj-gauge-pts">'+_pts+'</div>':'')
        +'</div>';
    }).join('');
    _pjBody.innerHTML='<div class="pj-gauge-grid">'+_items+'</div>';
  })();
  document.getElementById('vw-panel-count').textContent=`${vwCnt}명`;
  document.getElementById('cg-panel-count').textContent=`${cgCnt}명`;
  document.getElementById('project-panel-count').textContent=`${prjCnt}명`;
  document.getElementById('sports-panel-count').textContent=`${sptCnt}명`;
  let wsHtml='<div style="overflow-x:auto;"><table style="width:100%;border-collapse:separate;border-spacing:0 2px;font-size:13px;font-variant-numeric:tabular-nums;">';
  wsHtml+='<tr><th style="padding:2px 10px 10px;text-align:left;font-size:12px;font-weight:700;color:var(--muted);">날짜</th>';
  wsHtml+='<th style="padding:2px 8px 10px;text-align:center;font-size:12px;font-weight:800;color:var(--vw-light);">VW</th>';
  wsHtml+='<th style="padding:2px 8px 10px;text-align:center;font-size:12px;font-weight:800;color:var(--cg-light);">CG</th>';
  wsHtml+='<th style="padding:2px 8px 10px;text-align:center;font-size:12px;font-weight:800;color:var(--project-light);">PRJ</th>';
  wsHtml+='<th style="padding:2px 10px 10px;text-align:center;font-size:12px;font-weight:800;color:var(--sports-light);">SPT</th></tr>';
  weekDays.forEach(d => {
    const ds=toDateStr(d.getFullYear(),d.getMonth()+1,d.getDate());
    const e2=data.schedule[ds]; const dow=d.getDay(); const isToday2=ds===todayStr;
    const _hi=isToday2?'background:rgba(49,130,246,.1);':''; const _dcol=dow===0?'#d76a94':dow===6?'#5b8def':'var(--text)';
    let wVw='-', wCg='-';
    if (e2) {
      const _wDxExit=getDanjikExitStaff(ds);
      const _wCgExcl=new Set([e2.danjik,_wDxExit].filter(Boolean));
      const _wJIds=new Set(getStaff('조근').map(x=>x.id));
      const _wSpExcl=new Set([e2.satMorning,e2.morningDesk].filter(Boolean));
      const _wLv=new Set((data.newLeaves?.[ds])||[]);
      const _wExcl=id=>_isVw2(e2,id)||_wCgExcl.has(id)||_wJIds.has(id)||_wSpExcl.has(id)||_wLv.has(id);
      const _wCgWorkers=new Set(e2.cg?.workers||[]);
      const _wVwSet=new Set((e2.vw?.workers||[]).filter(id=>!_wExcl(id)&&!(_wCgWorkers.has(id)&&(staffById(id)?.dept||'').toLowerCase()==='vw')));
      const _w8Ids=[e2.weekend8jin,e2.weekday8jin,e2.weekend8jin2,e2.weekday8jin2].filter(id=>id&&!_wSpExcl.has(id)&&!_wLv.has(id));
      const _w8VwAdd=_w8Ids.filter(id=>!_wVwSet.has(id)&&!_wCgWorkers.has(id)&&(staffById(id)?.dept||'').toLowerCase()==='vw').length;
      const _w8CgAdd=_w8Ids.filter(id=>{if(_wVwSet.has(id)||_wCgWorkers.has(id))return false;const dd=(staffById(id)?.dept||'').toLowerCase();return dd==='cg'||dd==='xr';}).length;
      const _wNoIds=[e2.newsOh,e2.newsOh2].filter(id=>id&&!_wSpExcl.has(id)&&!_wLv.has(id));
      const _wNoVwAdd=_wNoIds.filter(id=>!_wVwSet.has(id)&&!_wCgWorkers.has(id)&&(staffById(id)?.dept||'').toLowerCase()==='vw').length;
      const _wNoCgAdd=_wNoIds.filter(id=>{if(_wVwSet.has(id)||_wCgWorkers.has(id))return false;const dd=(staffById(id)?.dept||'').toLowerCase();return dd==='cg'||dd==='xr';}).length;
      const _wIlVw=(e2.ilgeun?staffById(e2.ilgeun)?.dept?.toUpperCase():'')==='VW';
      const _wIlOk=e2.ilgeun&&!_wLv.has(e2.ilgeun)&&!_wSpExcl.has(e2.ilgeun);
      wVw=_wVwSet.size+(_wIlVw&&!_wCgWorkers.has(e2.ilgeun)&&_wIlOk?1:0)+_w8VwAdd+_wNoVwAdd;
      wCg=(e2.cg?.workers||[]).filter(id=>!_wExcl(id)&&!_wVwSet.has(id)).length+(e2.xr||[]).filter(id=>!_wExcl(id)).length+(!_wIlVw&&_wIlOk&&!_wVwSet.has(e2.ilgeun)?1:0)+_w8CgAdd+_wNoCgAdd;
    }
    wsHtml+=`<tr><td style="padding:9px 10px;font-weight:${isToday2?800:500};color:${_dcol};${_hi}${isToday2?'border-radius:10px 0 0 10px;':''}">${d.getMonth()+1}/${d.getDate()} ${DOW_KR[dow]}</td>
      <td style="padding:9px 8px;text-align:center;font-weight:${isToday2?800:600};color:var(--vw-light);${_hi}">${wVw}</td>
      <td style="padding:9px 8px;text-align:center;font-weight:${isToday2?800:600};color:var(--cg-light);${_hi}">${wCg}</td>
      <td style="padding:9px 8px;text-align:center;font-weight:${isToday2?800:600};color:var(--project-light);${_hi}">${e2?(e2.project||[]).length:'-'}</td>
      <td style="padding:9px 10px;text-align:center;font-weight:${isToday2?800:600};color:var(--sports-light);${_hi}${isToday2?'border-radius:0 10px 10px 0;':''}">${e2?(e2.sports||[]).length:'-'}</td></tr>`;
  });
  wsHtml+='</table></div>';
  document.getElementById('home-week-summary').innerHTML=wsHtml;
  try{ _hm3Sync(); }catch(e){}
  try{ layoutHomeMasonry(); }catch(e){}
}
// ===== 넓은 화면 벽돌쌓기(masonry): 각 카드가 자기 높이만큼 grid 행을 차지하게 해 세로 빈틈 제거 =====
// display:contents로 평탄화된 래퍼(.home-row, 내부 그리드)를 뚫고 실제 그리드 아이템만 수집
function _hmItems(grid){
  var out=[];
  Array.prototype.forEach.call(grid.children, function(ch){
    var d=getComputedStyle(ch).display; if(d==='none') return;
    if(d==='contents'){
      Array.prototype.forEach.call(ch.children, function(g){
        var gd=getComputedStyle(g).display; if(gd==='none') return;
        if(gd==='contents'){ Array.prototype.forEach.call(g.children, function(x){ if(getComputedStyle(x).display!=='none') out.push(x); }); }
        else out.push(g);
      });
    } else out.push(ch);
  });
  return out;
}
var _hmRO=null, _hmT=null;
// Reset every previously placed card, including children of display:contents wrappers.
// At narrower widths those wrappers become grids again, so stale row numbers create blank space.
function _hmResetPlacement(grid){
  grid.querySelectorAll('[style]').forEach(function(it){
    if(it.style.gridRowStart || it.style.gridRowEnd){
      it.style.gridRowStart=''; it.style.gridRowEnd=''; it.style.gridColumn='';
    }
  });
}
// 진짜 균형 배치: 각 아이템을 '현재 가장 짧은 열'에 직접 배치(열 높이 추적). span2는 인접 2열, full은 전체폭.
// grid-auto-flow(row dense)의 행 우선 채움 대신 열 최소높이 기준으로 놓아 바닥 정렬을 최대한 맞춤.
function _hmSpans(items){
  var grid=document.getElementById('view-home'); if(!grid) return;
  items.forEach(function(it){ it.style.gridColumn=''; it.style.gridRowStart=''; it.style.gridRowEnd=''; });  // 이전 배치 제거 → 암묵적 열이 사라져 정확한 열 수 측정(3열→2열 전환 시 3번째 열 잔존 버그 방지)
  var cols=(getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)||1;
  var ordered=items.map(function(it,i){return {it:it,o:parseFloat(getComputedStyle(it).order)||0,i:i};})
                   .sort(function(a,b){return a.o-b.o||a.i-b.i;}).map(function(x){return x.it;});
  // 균형 보정: 유독 큰 단칸 패널 1개를 '넓은 패널 바로 다음'으로 끌어올려 열을 일찍 안정 → 정돈 순서는 유지하면서 바닥 균형 개선.
  if(cols>1 && ordered.length>3){
    var info=ordered.map(function(it){ var h=it.getBoundingClientRect().height; var gc=getComputedStyle(it).gridColumn; return {it:it,h:h,wide:/\/\s*-1/.test(gc)||/span\s*2/.test(gc)}; });
    var singles=info.filter(function(m){return m.h>0 && !m.wide;});
    if(singles.length>=4){
      var tall=singles.reduce(function(a,b){return b.h>a.h?b:a;});
      var avgOther=(singles.reduce(function(s,m){return s+m.h;},0)-tall.h)/(singles.length-1);
      if(tall.h > avgOther*1.5){                 // 확실히 큰 이상치일 때만 승격
        var lastWide=-1; for(var w=0;w<info.length;w++){ if(info[w].wide && info[w].h>0) lastWide=w; }
        var cur=ordered.indexOf(tall.it);
        var ins=lastWide+1; if(ins<1) ins=1;
        if(cur>ins){ ordered.splice(cur,1); ordered.splice(ins,0,tall.it); }
      }
    }
  }
  var colH=[]; for(var k=0;k<cols;k++) colH.push(0);
  ordered.forEach(function(it){
    var h=it.getBoundingClientRect().height;
    if(h<=0){ it.style.gridColumn=''; it.style.gridRowStart=''; it.style.gridRowEnd=''; return; }
    var span=Math.max(1, Math.ceil((h+16)/8));
    var gc=getComputedStyle(it).gridColumn;
    var full=/\/\s*-1/.test(gc);
    var wide=/span\s*2/.test(gc);
    if(cols<=1){ it.style.gridColumn=''; it.style.gridRowStart=''; it.style.gridRowEnd='span '+span; colH[0]+=span; return; }
    var c, s, best, bh;
    if(full){
      s=Math.max.apply(null,colH);
      it.style.gridColumn='1 / -1'; it.style.gridRowStart=(s+1); it.style.gridRowEnd='span '+span;
      for(c=0;c<cols;c++) colH[c]=s+span;
    } else if(wide && cols>=2){
      best=0; bh=Infinity;
      for(c=0;c+1<cols;c++){ var mh=Math.max(colH[c],colH[c+1]); if(mh<bh){bh=mh;best=c;} }
      s=Math.max(colH[best],colH[best+1]);
      it.style.gridColumn=(best+1)+' / span 2'; it.style.gridRowStart=(s+1); it.style.gridRowEnd='span '+span;
      colH[best]=s+span; colH[best+1]=s+span;
    } else {
      best=0; bh=Infinity;
      for(c=0;c<cols;c++){ if(colH[c]<bh){bh=colH[c];best=c;} }
      s=colH[best];
      it.style.gridColumn=(best+1); it.style.gridRowStart=(s+1); it.style.gridRowEnd='span '+span;
      colH[best]=s+span;
    }
  });
}
// RO 콜백: 디바운스 없이 즉시 span만 갱신(FLIP 없음) → 카드가 커지는 동안 아래 카드가 곧바로 따라 내려가 '겹침' 방지.
// (grid 셀만 바꾸므로 관찰 대상 content-box는 그대로 → RO 재발생/루프 없음)
function _hmApplySpans(){
  var grid=document.getElementById('view-home'); if(!grid) return;
  if(getComputedStyle(grid).display!=='grid' || grid.classList.contains('hm3')){ grid.classList.remove('hm-on'); _hmResetPlacement(grid); return; }   // 3분할도 grid지만 벽돌쌓기 대상 아님
  grid.classList.add('hm-on');
  _hmSpans(_hmItems(grid));
}
// 재배치 + FLIP(부드러운 이동). renderHome/renderPolls가 호출.
function _hmApply(){
  var grid=document.getElementById('view-home'); if(!grid) return null;
  var noFlip=_hm3NoFlip; _hm3NoFlip=false;
  var isGrid=getComputedStyle(grid).display==='grid' && !grid.classList.contains('hm3');   // 3분할(.hm3)은 grid지만 벽돌쌓기 대상 아님
  var items=_hmItems(grid);
  if(!isGrid){ grid.classList.remove('hm-on'); _hmResetPlacement(grid); return items; }
  grid.classList.add('hm-on');
  var doFlip = !grid.classList.contains('home-anim') && !noFlip;   // 초기 등장(home-anim)·3분할 전환 직후엔 FLIP 생략(homeRise/블러 전환과 충돌 방지)
  var first = doFlip ? new Map() : null;
  if(doFlip) items.forEach(function(it){ first.set(it, it.getBoundingClientRect()); });   // FLIP: 이전 위치
  _hmSpans(items);
  if(doFlip) items.forEach(function(it){                                // FLIP: 이전→새 위치로 부드럽게 이동(투둑 방지)
    var o=first.get(it); if(!o) return; var n=it.getBoundingClientRect();
    var dx=o.left-n.left, dy=o.top-n.top;
    if(Math.abs(dx)<1 && Math.abs(dy)<1) return;
    try{ it.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{duration:460,easing:'cubic-bezier(.34,.02,.2,1)'}); }catch(e){}
  });
  return items;
}
// renderHome/renderPolls가 호출: 재배치+FLIP + 아이템 재관찰(1회). RO 콜백은 _hmApplySpans(즉시)만 부르므로 루프 없음.
function layoutHomeMasonry(){
  var items=_hmApply();
  if(window.ResizeObserver){
    if(!_hmRO){ _hmRO=new ResizeObserver(function(){ _hmApplySpans(); }); }
    else { _hmRO.disconnect(); }
    if(items) items.forEach(function(it){ _hmRO.observe(it); });
  }
}
window.addEventListener('resize', function(){ clearTimeout(_hmT); _hmT=setTimeout(layoutHomeMasonry, 140); });
// ===== 큰 화면(≥1560px) 홈 3분할 =====
// 1열 CG·VW·PROJECT/SPORTS 근무자·프로젝트 현황 / 2열 오늘의 근무·부서 근무 현황·이번 주 일별 인원 / 3열 이번 주 일정.
// 기존 패널을 열 카드 3개(#hm3 > .hm3-col)로 옮겨 담고 원래 자리는 주석 표식으로 기억 → 좁아지면 정확히 되돌림.
// 패널 id는 그대로라 renderHome의 innerHTML 갱신은 어느 배치든 그대로 동작. 스타일은 home.css의 .hm3 블록.
var _hm3MQ = window.matchMedia ? window.matchMedia('(min-width: 1560px)') : null;
var _hm3Marks = null, _hm3NoFlip = false, _hm3Busy = false, _hm3Seq = 0, _hm3Anims = [];
function _hm3Panel(id){ var e=document.getElementById(id); return e && e.closest('.panel'); }
function _hm3Build(){
  var vh=document.getElementById('view-home'); if(!vh || _hm3Marks) return false;
  var cols=[
    [_hm3Panel('cg-today-chips'), _hm3Panel('vw-today-chips'), [_hm3Panel('project-today-chips'), _hm3Panel('sports-today-chips')], document.getElementById('home-project-panel')],
    [document.getElementById('home-duty-row'), document.getElementById('home-summary'), _hm3Panel('home-week-summary')],
    [document.getElementById('home-week-panel')]
  ];
  var all=[]; cols.forEach(function(c){ c.forEach(function(x){ all=all.concat(x); }); });
  // 마크업이 바뀌어 패널을 못 찾거나, 같은 패널이 두 번 잡히거나 서로 포함되면 기존 배치 유지(복원 시 유실 방지)
  if(all.some(function(x){ return !x; }) || new Set(all).size!==all.length ||
     all.some(function(a){ return all.some(function(b){ return a!==b && a.contains(b); }); })) return false;
  var grid=document.createElement('div'); grid.id='hm3';
  _hm3Marks=[];
  cols.forEach(function(list, ci){
    var col=document.createElement('div'); col.className='panel hm3-col'; col.id='hm3-c'+(ci+1);
    list.forEach(function(x){
      var host=col;
      if(Array.isArray(x)){ host=document.createElement('div'); host.className='hm3-ps'; col.appendChild(host); }   // PROJECT·SPORTS는 한 구간
      [].concat(x).forEach(function(el){ var m=document.createComment('hm3'); el.parentNode.insertBefore(m, el); _hm3Marks.push([m, el]); host.appendChild(el); });
    });
    grid.appendChild(col);
  });
  var notice=document.getElementById('home-notice');
  if(notice && notice.parentNode===vh) vh.insertBefore(grid, notice.nextSibling); else vh.appendChild(grid);
  vh.classList.add('hm3'); vh.classList.remove('hm-on'); _hmResetPlacement(vh);
  return true;
}
function _hm3Restore(){
  var vh=document.getElementById('view-home'); if(!vh || !_hm3Marks) return false;
  _hm3Marks.forEach(function(p){ if(p[0].parentNode) p[0].parentNode.replaceChild(p[1], p[0]); else vh.appendChild(p[1]); });   // 표식이 사라졌어도 패널은 #hm3와 함께 지워지지 않게
  _hm3Marks=null;
  var g=document.getElementById('hm3'); if(g) g.remove();
  vh.classList.remove('hm3');
  return true;
}
// 지금 폭에 맞게 즉시(애니메이션 없이) 맞춤 — renderHome 끝에서 매번 호출(멱등). 경계 전환 애니메이션 도중엔 손대지 않음.
function _hm3Sync(){
  if(_hm3Busy) return false;
  var want=!!(_hm3MQ && _hm3MQ.matches), changed=false;
  if(want && !_hm3Marks) changed=_hm3Build();
  else if(!want && _hm3Marks) changed=_hm3Restore();
  if(changed) _hm3NoFlip=true;   // 바로 뒤 layoutHomeMasonry에서 FLIP(날아다님) 생략
  var vh=document.getElementById('view-home');
  if(vh) vh.classList.toggle('hm3-fail', want && !_hm3Marks);   // 3분할 구성 실패 시 예비로 3열 벽돌쌓기(home.css)
  return changed;
}
// 애니메이션 대상: 실제로 보이는 카드(3분할이면 열 카드 3개를 각각, 벽돌쌓기면 평탄화된 카드들) — 화면 위→아래, 왼쪽→오른쪽 순
function _hm3Visible(vh){
  var list=[];
  _hmItems(vh).forEach(function(el){ if(el.id==='hm3') list=list.concat([].slice.call(el.children)); else list.push(el); });
  list=list.filter(function(el){ return el.getClientRects().length && el.offsetHeight>0; });
  var pos=new Map(list.map(function(el){ return [el, el.getBoundingClientRect()]; }));
  return list.sort(function(a,b){ var ra=pos.get(a), rb=pos.get(b); return (Math.round(ra.top)-Math.round(rb.top)) || (ra.left-rb.left); });
}
// 경계(1560px)를 넘을 때: 지금 배치가 블러+투명으로 스르륵 사라짐 → 새 배치 카드가 하나씩 블러+투명으로 나타남
function _hm3Transition(){
  var vh=document.getElementById('view-home'); if(!vh) return;
  // 진행 중이던 효과는 지금 보이는 값(투명도·블러)을 읽어 두고 취소 → 이어서 그 값부터 움직여 깜빡임 없음
  var cur=new Map();
  _hm3Anims.forEach(function(a){ var t=a.effect && a.effect.target; if(t){ var cs=getComputedStyle(t); cur.set(t, {opacity:+cs.opacity, filter:cs.filter==='none'?'blur(0px)':cs.filter}); } });
  _hm3Anims.forEach(function(a){ try{ a.cancel(); }catch(e){} }); _hm3Anims=[];
  var seq=++_hm3Seq; _hm3Busy=false;
  var want=!!(_hm3MQ && _hm3MQ.matches);
  if(want===!!_hm3Marks){   // 넘었다가 바로 되돌아온 경우: 사라지던 카드를 그 자리에서 다시 부드럽게
    cur.forEach(function(v, el){ if(v.opacity<0.999 && el.isConnected && el.animate) _hm3Anims.push(el.animate([{opacity:v.opacity, filter:v.filter},{opacity:1, filter:'blur(0px)'}],{duration:220, easing:'ease-out'})); });
    return;
  }
  var shown=vh.classList.contains('active') && vh.getClientRects().length>0;
  var calm=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!shown || calm || document.hidden || !vh.animate){ if(_hm3Sync()) layoutHomeMasonry(); return; }   // 안 보이는 탭에선 애니메이션 시계가 멈추므로 즉시 교체
  _hm3Busy=true;
  var outs=_hm3Visible(vh).map(function(el){
    var v=cur.get(el) || {opacity:1, filter:'blur(0px)'};   // 등장 대기 중(투명)이던 카드는 투명한 채로
    return el.animate([{opacity:v.opacity, filter:v.filter},{opacity:0, filter:'blur(10px)'}],{duration:220, easing:'ease-in', fill:'forwards'});
  });
  _hm3Anims=outs.slice();
  var faded=Promise.all(outs.map(function(a){ return a.finished.catch(function(){}); }));
  Promise.race([faded, new Promise(function(r){ setTimeout(r, 450); })]).then(function(){   // 프레임이 밀려도(느린 기기·백그라운드) 0.45초 안엔 다음 단계로
    if(seq!==_hm3Seq || !_hm3Busy) return;   // 그 사이 다시 경계를 넘었으면 새 전환이 이어받음
    _hm3Busy=false;
    vh.classList.remove('home-anim','home-enter');   // 옮겨진 카드에 첫 등장 애니메이션이 다시 걸리지 않게(블러 등장이 대신함)
    _hm3Sync(); layoutHomeMasonry();
    var ins=_hm3Visible(vh), step=_hm3Marks?110:60;
    _hm3Anims=ins.map(function(el,i){
      return el.animate([{opacity:0, filter:'blur(14px)'},{opacity:1, filter:'blur(0px)'}],{duration:520, delay:Math.min(i*step, 900), easing:'cubic-bezier(.22,1,.36,1)', fill:'backwards'});
    });
    outs.forEach(function(a){ try{ a.cancel(); }catch(e){} });   // 같은 프레임 안에서 해제 → 깜빡임 없음
  });
}
if(_hm3MQ){ if(_hm3MQ.addEventListener) _hm3MQ.addEventListener('change', _hm3Transition); else if(_hm3MQ.addListener) _hm3MQ.addListener(_hm3Transition); }

