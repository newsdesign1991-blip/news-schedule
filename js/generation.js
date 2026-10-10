/* [모듈] js/generation.js — 특수근무 제외쌍·근무 자동 생성·검증/재시도 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 특수근무 제외쌍 (만나면 안 되는 사람) =====
// data.settings.specialAvoid = [[staffIdA, staffIdB], ...]
// 같은 날 특수근무(당직·조근대체·토요조근·일근·주말8진)에 두 사람이 함께 배정되지 않도록 소프트 제약.
function _specialAvoidList(){ return (data.settings && Array.isArray(data.settings.specialAvoid)) ? data.settings.specialAvoid : []; }
function _isSpecialAvoid(a,b){
  if(!a||!b||a===b) return false;
  return _specialAvoidList().some(pr=>Array.isArray(pr)&&((pr[0]===a&&pr[1]===b)||(pr[0]===b&&pr[1]===a)));
}
function _avoidStaffOptions(){
  return (data.staff||[]).filter(x=>x.active!==false)
    .slice().sort((a,b)=>String(a.dept||'').localeCompare(String(b.dept||''))||String(a.name||'').localeCompare(String(b.name||'')))
    .map(x=>`<option value="${x.id}">${_pEsc(x.name)} · ${_pEsc(x.dept||'')}</option>`).join('');
}
function renderAvoidTab(){
  const opts=_avoidStaffOptions();
  const a=document.getElementById('avoid-a'), b=document.getElementById('avoid-b');
  if(a) a.innerHTML=opts;
  if(b) b.innerHTML=opts;
  _renderAvoidList();
}
function _renderAvoidList(){
  const box=document.getElementById('avoid-list'); if(!box) return;
  const list=_specialAvoidList();
  if(!list.length){ box.innerHTML='<div style="font-size:12.5px;color:var(--muted);padding:12px 2px;">아직 지정된 제외쌍이 없습니다.</div>'; return; }
  const chip=(st)=>st?`<span class="avoid-chip">${_pEsc(st.name)}<span class="avoid-dept">${_pEsc(st.dept||'')}</span></span>`:`<span class="avoid-chip" style="color:var(--muted);">(삭제된 직원)</span>`;
  box.innerHTML=list.map((pr,i)=>`<div class="avoid-row">${chip(staffById(pr[0]))}<span class="avoid-x">✕</span>${chip(staffById(pr[1]))}<button class="avoid-del" onclick="_avoidRemovePair(${i})" title="삭제">✕</button></div>`).join('');
}
function _avoidAddPair(){
  const a=document.getElementById('avoid-a').value, b=document.getElementById('avoid-b').value;
  if(!a||!b){ toast('두 사람을 선택하세요','error'); return; }
  if(a===b){ toast('서로 다른 사람을 선택하세요','error'); return; }
  if(!data.settings) data.settings={};
  if(!Array.isArray(data.settings.specialAvoid)) data.settings.specialAvoid=[];
  if(_isSpecialAvoid(a,b)){ toast('이미 등록된 쌍입니다','error'); return; }
  data.settings.specialAvoid.push([a,b]);
  saveData(data);
  _renderAvoidList();
  toast('제외쌍이 추가됐어요','success');
}
function _avoidRemovePair(i){
  if(!Array.isArray(data.settings && data.settings.specialAvoid)) return;
  data.settings.specialAvoid.splice(i,1);
  saveData(data);
  _renderAvoidList();
  toast('삭제됨','success');
}

// ===== SCHEDULE GENERATION =====
// 쉬는 글자(손입력 칸이 이 글자면 근무일로 안 셈)
function _genRestText(t){ return /^(휴무|휴|쉼|대휴|비번|당직비번|퇴근|당직퇴근|신휴가|휴가|연차|반차|Jr\.?휴가|경조|공가|-|0)$/i.test(String(t||'').replace(/\s/g,'')); }
// 그날 근무일로 세는 사람: 근무자 명단·데스크·토조·일근·8진·뉴.오·조근 대타·교육 2인 칸·당직·퇴근(전날 당직)·쉬는 글자가 아닌 손입력 칸
// fresh=false면 생성 때마다 새로 뽑는 XR·PROJECT는 뺌(앞으로 정해진 근무 셀 때)
// 범위 밖 날의 근무: 초안에 근무자·당직이 있으면 초안, 없으면(손입력 칸만 있는 날 등) 배포본 + 초안 손입력 칸
function _genSchedOn(targetSchedule, d){
  const t=targetSchedule&&targetSchedule[d], p=data.schedule&&data.schedule[d];
  if(t&&(t.vw?.workers?.length||t.cg?.workers?.length||t.danjik)) return t;
  if(!p) return t||null;
  return (t&&t.customCells&&t!==p) ? Object.assign({},p,{customCells:Object.assign({},p.customCells||{},t.customCells)}) : p;
}
function _genDayUnits(e, pe, fresh){
  const s=new Set(); e=e||{};
  [...(e.vw?.workers||[]),...(e.cg?.workers||[]),...(fresh===false?[]:[...(e.xr||[]),...(e.project||[])]),...(e.sports||[]),
   e.vw?.desk,e.cg?.desk8,e.cg?.desk5,e.morningDesk,e.satMorning,e.ilgeun,e.weekend8jin,e.weekend8jin2,e.weekday8jin,e.weekday8jin2,e.newsOh,e.newsOh2,
   ...Object.values(e.jogeunSubs||{}),...(e.jogeunExtra||[]),...(e.jogeunEdu||[]),e.danjik,pe?.danjik].filter(Boolean).forEach(id=>s.add(id));
  Object.keys(e.customCells||{}).forEach(id=>{ if(!_genRestText(e.customCells[id]?.text)) s.add(id); });
  return s;
}
function generateDraftSchedule(phase) {
  _pushWsHistory();
  // 작성소 인원 설정을 생성 전에 즉시 반영 (onchange 미발동 방지)
  saveWsSettings();
  const startVal=document.getElementById('ws-start').value;
  const endVal=document.getElementById('ws-end').value;
  if(!startVal||!endVal){ showResult('ws-gen-result','❌ 시작일과 종료일을 입력하세요.',false); return; }
  _generateWithRetry(startVal, endVal, data.draft.schedule, 'ws-gen-result', ()=>{
    data.draft.rangeStart = startVal;
    data.draft.rangeEnd = endVal;
    wsRangeStart = startVal; wsRangeEnd = endVal;
    saveData(data);
    renderWorkshopTable();
  }, { phase: (typeof phase==='string' ? phase : 'all') });
}
function generateSchedule() {
  // 어드민 패널의 기존 gen-start/gen-end 사용 (하위 호환)
  const startVal=document.getElementById('gen-start').value;
  const endVal=document.getElementById('gen-end').value;
  if(!startVal||!endVal){ showResult('gen-result','❌ 시작일과 종료일을 입력하세요.',false); return; }
  _generateWithRetry(startVal, endVal, data.schedule, 'gen-result', ()=>{
    saveData(data);
    renderTable();
  });
}
function _generateScheduleCore(startVal, endVal, targetSchedule, resultElId, opts) {
  opts = opts || {};
  const startDate=new Date(startVal+'T00:00:00');
  const endDate=new Date(endVal+'T00:00:00');
  if(startDate>endDate){ showResult(resultElId,'❌ 종료일이 시작일보다 앞섭니다.',false); return null; }
  const s=data.settings;
  const vwPool=getStaff('VW', startVal), cgPool=getStaff('CG', startVal);
  const projectPool=getStaff('PROJECT', startVal), sportsPool=getStaff('SPORTS', startVal), xrPool=getStaff('XR', startVal);
  if (vwPool.length<(s.weekdayVW||7)) { showResult(resultElId,`❌ VW 직원 부족: ${vwPool.length}명 / ${s.weekdayVW||7}명 필요`,false); return null; }
  if (cgPool.length<(s.weekdayCG||19)) { showResult(resultElId,`❌ CG 직원 부족: ${cgPool.length}명 / ${s.weekdayCG||19}명 필요`,false); return null; }
  // 날짜 범위 내 날짜 목록
  const genDates=[];
  {let cur=new Date(startDate);while(cur<=endDate){genDates.push(new Date(cur));cur.setDate(cur.getDate()+1);}}
  const genDateStrs=genDates.map(dt=>toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate()));
  const totalDays=genDates.length;
  // 재생성 시 해당 범위 초안 초기화 (수동 입력값 보존)
  const isDraftTarget = targetSchedule === (data.draft?.schedule);
  const _prevSnap = {}; // 수동 입력 보존용 스냅샷
  genDates.forEach(dt=>{
    const ds=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    // 기존 초안 전체 스냅샷 (수동 입력 보존)
    _prevSnap[ds] = JSON.parse(JSON.stringify(targetSchedule[ds] || {}));
    // 데스크 단계('desk')는 누를 때마다 자동배정(데스크·당직·8진·뉴오·일근 등)을 새로 굴린다.
    // 수동 편집(셀 직접입력·조근 교육/추가·뉴오2·메모)만 보존하고 나머지 자동 필드는 스냅샷에서 제거.
    if (opts.phase==='desk' && _prevSnap[ds]) {
      const _pv=_prevSnap[ds];
      _prevSnap[ds] = { customCells:_pv.customCells, jogeunEdu:_pv.jogeunEdu, jogeunExtra:_pv.jogeunExtra, newsOh2:_pv.newsOh2, weekend8jin2:_pv.weekend8jin2, weekday8jin2:_pv.weekday8jin2, notes:_pv.notes };
    }
    const draftSports = targetSchedule[ds]?.sports||[];
    const publishedSports = isDraftTarget ? (data.schedule[ds]?.sports||[]) : [];
    const savedSports = draftSports.length ? draftSports : publishedSports;
    if (targetSchedule[ds]) delete targetSchedule[ds];
    if (savedSports.length) targetSchedule[ds]={sports:savedSports};
  });
  let weekdaysInMonth=0;
  genDates.forEach(dt=>{
    const ds=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    if(isWeekdayForm(ds)) weekdaysInMonth++;   // 평일 틀인 날(8뉴스 평일 편성 공휴일 포함)
  });
  // 프리랜서별 평일 목표 근무일 = 평일 수 - 평일 신휴가 수 (나중에 isOnLeave 정의 후 재계산)
  const freelancerWeekdayTarget = {};
  const workDays={};
  [...vwPool,...cgPool,...projectPool,...sportsPool,...xrPool].forEach(p=>{workDays[p.id]=0;});
  const monthCount={};
  const weekdayCount={}; // 프리랜서 평일 근무일만 별도 집계
  [...vwPool,...cgPool,...projectPool,...sportsPool,...xrPool].forEach(p=>{monthCount[p.id]=0; weekdayCount[p.id]=0;});
  // weekly count: weekKey -> staffId -> count
  const weekCount={};
  // 앞으로 정해진 근무: wk -> id -> [날짜...] — 그 주 '오늘 다음' 날짜 몫까지 getWC에 더함
  //  (단계별 '나머지 채우기'에서 토요 당직·일요 일근이 이미 정해진 사람을 평일에 다 채워 주 7일이 되던 것, 주 뒤쪽 출장·교육 칸을 못 보던 것 방지)
  const _commitWk={};
  let _curDS='';
  genDateStrs.forEach((ds,i)=>{
    const pv=_prevSnap[ds]; if(!pv) return;
    const k=getWeekKey(ds);
    _genDayUnits(pv, i>0?_prevSnap[genDateStrs[i-1]]:null, false).forEach(id=>{ ((_commitWk[k]=_commitWk[k]||{})[id]=_commitWk[k][id]||[]).push(ds); });
  });
  const _outR=d=>d<genDateStrs[0]||d>genDateStrs[genDateStrs.length-1];   // 생성 범위 밖 날
  const _weOrHol=d=>{ const w=new Date(d+'T00:00:00').getDay(); return w===0||w===6||!!(data.holidays&&data.holidays[d]); };
  // 범위가 주 중간에 끝나면 같은 주 뒷날(이미 있는 초안·배포본 근무)도 앞으로 정해진 근무로 셈 — 그 주 7일 방지
  { const _eN=genDateStrs[genDateStrs.length-1], _wkE=getWeekKey(_eN);
    for (let d=addDays(_eN,1), first=true; getWeekKey(d)===_wkE; d=addDays(d,1), first=false)
      _genDayUnits(_genSchedOn(targetSchedule,d), first?null:_genSchedOn(targetSchedule,addDays(d,-1))).forEach(id=>{ ((_commitWk[_wkE]=_commitWk[_wkE]||{})[id]=_commitWk[_wkE][id]||[]).push(d); });
  }
  function _futureN(staffId, wk){ const l=_commitWk[wk]?.[staffId]; if(!l) return 0; let n=0; for(const d of l) if(d>_curDS) n++; return n; }
  function _wkndCommitted(staffId, wk){ const l=_commitWk[wk]?.[staffId]; if(!l) return false; const sa=addDays(wk,5), su=addDays(wk,6); return l.some(d=>d>_curDS&&(d===sa||d===su)); }
  function getWC(staffId, wk) { return (weekCount[staffId]?.[wk]||0)+_futureN(staffId,wk); }
  function addWC(staffId, wk, amt=1) {
    if (!weekCount[staffId]) weekCount[staffId]={};
    weekCount[staffId][wk]=(weekCount[staffId][wk]||0)+amt;
  }
  const holidayWorkCount={};
  const danjikCount={};
  [...vwPool,...cgPool,...projectPool,...sportsPool].forEach(p=>{holidayWorkCount[p.id]=0;danjikCount[p.id]=0;});

  // 조근 자동배정 관련
  const jogeunPool=getStaff('조근', startVal);
  const freelancerPool=data.staff.filter(s=>s.employmentType==='freelancer'&&s.active!==false);
  // 프리랜서 평일 목표 = 평일 수 - 평일 신휴가(연차+신휴가) 수
  [...vwPool,...cgPool].filter(p=>p.employmentType==='freelancer').forEach(p=>{
    const leaveCount=genDates.filter(dt=>{
      const ds=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
      if(!isWeekdayForm(ds)) return false;
      return isOnLeave(p.id,ds);
    }).length;
    freelancerWeekdayTarget[p.id]=Math.max(0,weekdaysInMonth-leaveCount);
  });
  const ilgeunPool=data.staff.filter(s=>s.canIlgeun&&s.employmentType!=='freelancer'&&s.active!==false);
  const newsOhPool=freelancerPool.filter(s=>s.canNewsOh);
  const weekend8jinPool=freelancerPool.filter(s=>s.canWeekend8jin);
  const weekday8jinPool=data.staff.filter(s=>s.canWeekday8jin&&s.employmentType!=='freelancer'&&s.active!==false);
  const morningSubCount={};
  const jogeunSubCount={};   // #2: 평일 조근 대체 횟수 → 그달 뉴.오 덜 배정, 조근 대타끼리 공정 배분
  const satMorningCount={};   // 토요 조근 횟수(조근 대타와 따로 셈)
  const specialMonth={};      // 이번 생성 기간의 일근+토요 조근 횟수 — 사람처럼 한 사람 월 1회로 돌림
  const newsOhWeekDone={};    // wk -> Set<id> : 뉴.오 한 사람 주 1회
  // 조근 대타: 사람 근무표는 정해진 몇 명(경험자)만 맡음 → 직원 정보의 '조근 대타 가능' 표시자. 아무도 없으면 예전처럼 프리랜서 전체
  const jogeunSubFlagged=data.staff.filter(s=>s.canJogeunSub&&s.active!==false);
  const jogeunSubPool=jogeunSubFlagged.length?jogeunSubFlagged:freelancerPool;
  const ilgeunCount={};
  const newsOhCount={};
  const weekend8jinCount={};
  const weekday8jinCount={};
  const weekday8jinWeekDone={}; // wk -> Set<id> : 이번 주 이미 평일8진 배정된 사람
  freelancerPool.forEach(p=>{morningSubCount[p.id]=0;});
  freelancerPool.forEach(p=>{jogeunSubCount[p.id]=0;});
  ilgeunPool.forEach(p=>{ilgeunCount[p.id]=0;});
  newsOhPool.forEach(p=>{newsOhCount[p.id]=0;});
  weekend8jinPool.forEach(p=>{weekend8jinCount[p.id]=0;});
  weekday8jinPool.forEach(p=>{weekday8jinCount[p.id]=0;});

  // 과거 2개월 실적으로 카운터 초기화 — 토조근·일근·당직이 골고루 배정되도록
  const lastDanjikDate = {}; // staffId -> 마지막 당직 날짜(dateStr)
  const genDanjikCount = {}; // 이번 생성 기간 내 당직 횟수 (당월 공정배분용)
  const prevMonthDanjik = {}; // #3: 전달(직전 달) 당직 횟수 → 이번달 소프트 후순위
  {
    const histDate = new Date(startVal+'T00:00:00');
    histDate.setMonth(histDate.getMonth() - 2);
    const histStart = toDateStr(histDate.getFullYear(), histDate.getMonth()+1, 1);
    // #3: 직전 달 범위 [prevMonthStart, startMonthStart) — 전달 당직 횟수 집계
    const _sMon=new Date(startVal+'T00:00:00');
    const _pMon=new Date(_sMon.getFullYear(), _sMon.getMonth()-1, 1);
    const prevMonthStart=toDateStr(_pMon.getFullYear(), _pMon.getMonth()+1, 1);
    const startMonthStart=toDateStr(_sMon.getFullYear(), _sMon.getMonth()+1, 1);
    // 과거 데이터를 날짜 오름차순으로 처리해야 lastDanjikDate가 최신값으로 기록됨
    const _hs=Object.assign({},data.schedule||{});
    for(let d=histStart; d<startVal; d=addDays(d,1)){ const e=_genSchedOn(targetSchedule,d); if(e) _hs[d]=e; }   // 초안에만 있는 앞 블록 당직도 이력으로
    const histEntries = Object.entries(_hs)
      .filter(([d]) => d >= histStart && d < startVal)
      .sort(([a],[b]) => a.localeCompare(b));
    histEntries.forEach(([d, entry]) => {
      if (entry.danjik) {
        danjikCount[entry.danjik]     = (danjikCount[entry.danjik]||0) + 1;
        lastDanjikDate[entry.danjik]  = d;
      }
      if (entry.danjik && d>=prevMonthStart && d<startMonthStart) prevMonthDanjik[entry.danjik]=(prevMonthDanjik[entry.danjik]||0)+1;
      if (entry.satMorning)  morningSubCount[entry.satMorning]   = (morningSubCount[entry.satMorning]||0) + 1;
      if (entry.satMorning)  satMorningCount[entry.satMorning]   = (satMorningCount[entry.satMorning]||0) + 1;
      Object.values(entry.jogeunSubs||{}).forEach(id=>{ if(id) jogeunSubCount[id]=(jogeunSubCount[id]||0)+1; });
      if (entry.ilgeun)      ilgeunCount[entry.ilgeun]           = (ilgeunCount[entry.ilgeun]||0) + 1;
      if (entry.newsOh)      newsOhCount[entry.newsOh]           = (newsOhCount[entry.newsOh]||0) + 1;
      if (entry.weekend8jin) weekend8jinCount[entry.weekend8jin] = (weekend8jinCount[entry.weekend8jin]||0) + 1;
      if (entry.weekday8jin) weekday8jinCount[entry.weekday8jin] = (weekday8jinCount[entry.weekday8jin]||0) + 1;
    });
  }

  // 배열을 한 번 랜덤 셔플한 뒤 카운트 오름차순 정렬 (같은 카운트 내 순서 랜덤화)
  function shuffleSort(arr, countFn) {
    const a = [...arr];
    for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a.sort((x,y)=>countFn(x)-countFn(y));
  }

  // 주말 중복 방지: 토요일 근무자는 일요일 제외, 일요일 근무자는 토요일 제외
  const weekendWorked = {}; // weekKey -> Set<staffId>
  // 주말근무 후 다음주 대휴
  const restDays = {}; // dateStr -> Set<staffId>
  // 토요일 당직 중복 방지: 이미 토요일 당직을 한 사람은 다시 배정 안 함
  const satDanjikDone = new Set();
  const wkndDanjik = {};   // 이번 생성 기간 주말(토·일) 당직 횟수 — 주말 당직이 한 사람에게 몰리지 않게
  // 주말 당직 예약: 그 주 다른 주말 역할(데스크·일근·토조·XR·다른 당직 예약) 아닌 사람, 그날·다음날(퇴근) 휴가 아님, 수습은 주말·공휴일 근무 안 됨, 간격 7일·월 상한
  // byWC: 주 중간에 다시 예약할 때는 그 주에 덜 일한 사람 먼저(평일을 쉬어야 주말에 설 수 있음)
  // 당직날 다음날(퇴근)·다다음날(비번)에 이미 정해진 근무가 있는 사람: 범위 밖은 지금 근무표, 범위 안은 보존된 칸·앞 단계 역할
  function _busyAfter(day){ const b=new Set(); [1,2].forEach(k=>{ const d=addDays(day,k); const e=_outR(d)?_genSchedOn(targetSchedule,d):_prevSnap[d]; if(e) _genDayUnits(e,null,false).forEach(id=>b.add(id)); }); return b; }
  function _planDuty(P, day, excludeIds, byWC){
    const taken=[P.vw,P.vw2,P.cg,P.cg2,P.ilgeun,P.sat,P.dj,P.dj2,...(P.xr||[]),...(excludeIds||[])].filter(Boolean), nx=addDays(day,1), wkD=getWeekKey(day), busy=_busyAfter(day);
    const ok=p=>p.canDanjik&&!busy.has(p.id)&&p.morningDeskPriority!==1&&!taken.includes(p.id)&&!isOnLeave(p.id,day)&&!isOnLeave(p.id,nx)
      &&isContractActive(p,day)&&!isDispatched(p,day)&&!isProbation(p,day)&&!(_weOrHol(nx)&&isProbation(p,nx))&&(genDanjikCount[p.id]||0)<MAX_DANJIK_MONTH
      &&(!lastDanjikDate[p.id]||(new Date(day+'T00:00:00').getTime()-new Date(lastDanjikDate[p.id]+'T00:00:00').getTime())/86400000>=MIN_DANJIK_GAP)
      &&!(new Date(day+'T00:00:00').getDay()===6&&satDanjikDone.has(p.id));
    const key=p=>(byWC?getWC(p.id,wkD)*2000:0)+(genDanjikCount[p.id]||0)*1000+(wkndDanjik[p.id]||0)*600+(prevMonthDanjik[p.id]||0)*80+(p.deskPriority?500:0)+(danjikCount[p.id]||0);
    return shuffleSort([...vwPool,...cgPool].filter(ok),key)[0]?.id||null;
  }
  // 주말 CG 데스크 배정 횟수 (2순위/3순위 공정 배분)
  const weekendDeskCount = {};
  // XR 주말 근무 횟수 (전원 공정 로테이션용)
  const xrWeekendCount = {};
  // 주별 주말 데스크 담당 예약 (VW/CG 각 1명, XR 로테이션 일부 — 평일 1일 휴식 후 주말 투입)
  const weekendDeskPlan = {}; // wk -> {vw:id|null, cg:id|null, xr:[id...]}
  const MIN_DANJIK_GAP = 7; // 당직 최소 간격: 1주일
  const MAX_DANJIK_MONTH = Math.max(3, Math.ceil(genDates.length / Math.max(1,[...vwPool,...cgPool].filter(p=>p.canDanjik).length)));
  // 연속 근무일 추적 (6일 연속 방지)
  const consecutiveDays = {}; // id → 현재 연속 근무일수
  const lastWorkDate = {};    // id → 마지막 근무 날짜
  // 연속 6일 차단: 전날 실제 근무했고 연속 5일 이상일 때만 (쉬면 자동 해제)
  function consecBlocked(id, prevDS){ return lastWorkDate[id]===prevDS && (consecutiveDays[id]||0)>=5; }
  // 주말 예약자: 실제 주말 근무는 1일(weekendBlock으로 토/일 중복 차단)
  // → 평일 4일 허용, WC≥4 시 차단 (대휴 1일 확보). 신휴가 있는 주는 자동으로 대휴 없이 소화됨
  function reservedForWeekend(id, wk){
    const plan=weekendDeskPlan[wk]; if(!plan) return false;
    if(_wkndCommitted(id,wk)) return false;   // 주말 몫이 앞 단계에서 이미 정해짐 → getWC가 그 몫까지 셈
    // 토요 당직 예약자: 토 당직+일 퇴근 = 주말 이틀 → 평일 3일까지(사람 근무표도 당직 주는 낮근무 3일+당직+퇴근)
    if(plan.dj===id) return getWC(id,wk)>=3;
    const inPlan=plan.vw===id||plan.vw2===id||plan.cg===id||plan.cg2===id||plan.ilgeun===id||plan.ilgeun2===id||plan.sat===id||plan.dj2===id||(plan.xr&&plan.xr.includes(id));
    return inPlan && getWC(id,wk)>=4;
  }

  // 데스크 순위 선택: 1번 우선, 휴가/비번이면 2→3→4→5번 순서대로
  function findDeskByPriority(pool, dateStr, blockedIds) {
    for (const pri of [1,2,3,4,5]) {
      const cand=pool.find(p=>p.deskPriority===pri&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id));
      if (cand) return cand;
    }
    return null;
  }

  const sortPool=(pool,date,wk,skipIds,isHoliOrWE,tmplWE)=>{
   if(tmplWE===undefined) tmplWE=isHoliOrWE;
   const prevDS=addDays(date,-1);
   return [...pool].filter(p=>{
    if (skipIds&&skipIds.includes(p.id)) return false;
    if (isOnLeave(p.id,date)) return false;
    if (!isContractActive(p,date)) return false;
    if (isDispatched(p,date)) return false;
    if (isHoliOrWE && isProbation(p,date)) return false; // 수습기간: 주말/휴일 근무 배제
    if (getWC(p.id,wk)>=5) return false; // 주5일 상한 (전원 동일)
    if (consecBlocked(p.id,prevDS)) return false; // 연속 6일 방지
    if (!tmplWE && reservedForWeekend(p.id,wk)) return false; // 주말 데스크 예약자 평일 휴식
    if (p.employmentType==='freelancer'&&!tmplWE&&(weekdayCount[p.id]||0)>=(freelancerWeekdayTarget[p.id]??weekdaysInMonth)) return false;
    return true;
  }).sort((a,b)=>{
    if (isHoliOrWE) {
      const hdiff=(holidayWorkCount[a.id]||0)-(holidayWorkCount[b.id]||0);
      if (hdiff!==0) return hdiff;
    }
    if (!tmplWE) {
      // 목표 대비 달성률로 정렬 → 프리랜서·직원 자연스럽게 혼합
      const tA=a.employmentType==='freelancer'?(freelancerWeekdayTarget[a.id]||weekdaysInMonth):weekdaysInMonth;
      const tB=b.employmentType==='freelancer'?(freelancerWeekdayTarget[b.id]||weekdaysInMonth):weekdaysInMonth;
      const rA=(weekdayCount[a.id]||0)/tA;
      const rB=(weekdayCount[b.id]||0)/tB;
      if (Math.abs(rA-rB)>0.001) return rA-rB;
    }
    const diff=workDays[a.id]-workDays[b.id];
    return diff;
  });
  };

  // ===== 특수근무 제외쌍(만나면 안 되는 사람): 실제 근무 시간대 겹침 기반 소프트 제약 =====
  // 근무를 절대분 구간으로 보고, '만나면 안 되는' 상대와 시간이 겹치면 후보에서 제외.
  // 당직 21:00~익10:00 / 조근·토요조근 04:00~13:00 / 일근 10:00~21:00 / 일반(주말포함) 12:00~21:00.
  const _avoidOn = _specialAvoidList().length>0;
  const _avoidIv = {};
  const _SIVOFF = { danjik:[1260,2040], jogeun:[240,780], ilgeun:[600,1260], work:[720,1260] };
  const _dayMin = ds => Math.round(new Date(ds+'T00:00:00').getTime()/60000);
  const _ivOf = (kind, ds) => { const b=_dayMin(ds), off=_SIVOFF[kind]||_SIVOFF.work; return [b+off[0], b+off[1]]; };
  const _addIv = (id, kind, ds) => { if(!_avoidOn||!id) return; (_avoidIv[id]=_avoidIv[id]||[]).push(_ivOf(kind,ds)); };
  const _meets = (id, kind, ds) => {
    if(!_avoidOn||!id) return false;
    const iv=_ivOf(kind,ds);
    for(const pr of _specialAvoidList()){
      const partner = pr[0]===id ? pr[1] : (pr[1]===id ? pr[0] : null);
      if(!partner) continue;
      const list=_avoidIv[partner]; if(!list) continue;
      for(const q of list){ if(iv[0]<q[1] && q[0]<iv[1]) return true; }
    }
    return false;
  };
  if(_avoidOn){
    // 조근 부서 평일 기본근무(고정) 미리 등록 → 당직↔조근 겹침을 순서 무관하게 판정
    for(const ds of genDateStrs){
      const dw=new Date(ds+'T00:00:00').getDay();
      if(isWeekdayForm(ds)){
        jogeunPool.forEach(jp=>{ if(!isOnLeave(jp.id,ds)) _addIv(jp.id,'jogeun',ds); });
      }
    }
    // 범위 마지막날 다음날(경계)의 조근 기본근무 등록 → 마지막날 당직이 다음 블록 첫날 조근과 겹침 판정(4주 이음새)
    const _post=addDays(genDateStrs[genDateStrs.length-1],1);
    { if(isWeekdayForm(_post)) jogeunPool.forEach(jp=>{ if(!isOnLeave(jp.id,_post)) _addIv(jp.id,"jogeun",_post); }); }
    // 범위 첫날 전날(경계)의 배포된 당직도 등록 → 첫날 아침 조근 겹침 반영
    const _pre=addDays(genDateStrs[0],-1);
    const _preDj=(data.draft&&data.draft.schedule&&data.draft.schedule[_pre]&&data.draft.schedule[_pre].danjik)||(data.schedule[_pre]&&data.schedule[_pre].danjik)||null;
    if(_preDj) _addIv(_preDj,'danjik',_pre);
  }
  // 범위가 주 중간에 시작하면, 같은 주 앞날(초안·배포본)의 근무도 주 근무일·연속 근무에 넣음(경계 주 7일 방지)
  {
    const _s0=genDateStrs[0], _wk0=getWeekKey(_s0), _src=d=>_genSchedOn(targetSchedule,d);
    for(let d=_wk0; d<_s0; d=addDays(d,1)) _genDayUnits(_src(d),_src(addDays(d,-1))).forEach(id=>addWC(id,_wk0));
    // 연속 근무: 시작 전날부터 거꾸로 이어진 근무일(퇴근 날은 생성 규칙처럼 연속에 안 셈)
    const _ws=[]; for(let k=1;k<=6;k++) _ws.push(_genDayUnits(_src(addDays(_s0,-k)),null));
    _ws[0].forEach(id=>{ let n=0; while(n<_ws.length&&_ws[n].has(id)) n++; consecutiveDays[id]=n; lastWorkDate[id]=addDays(_s0,-1); });
    // 일요일에 시작하면 같은 주 토요일(범위 밖) 근무자는 일요일에 안 뽑음(토·일 하루만). 금요 당직자의 토요 퇴근은 빼고 셈
    { const _sat0=addDays(_wk0,5); if(_sat0<_s0){ const ww=(weekendWorked[_wk0]=weekendWorked[_wk0]||new Set()); _genDayUnits(_src(_sat0),null).forEach(id=>ww.add(id)); } }
  }
  // 평일 8진 주 1회: 같은 주 범위 밖 날(앞·뒤)과 보존된 칸의 8진도 그 주 배정으로 셈
  { const _add8=(d,e)=>{ if(e&&e.weekday8jin){ const k=getWeekKey(d); (weekday8jinWeekDone[k]=weekday8jinWeekDone[k]||new Set()).add(e.weekday8jin); } };
    const _s0=genDateStrs[0], _eN=genDateStrs[genDateStrs.length-1];
    for(let d=getWeekKey(_s0); d<_s0; d=addDays(d,1)) _add8(d,_genSchedOn(targetSchedule,d));
    for(let d=addDays(_eN,1); getWeekKey(d)===getWeekKey(_eN); d=addDays(d,1)) _add8(d,_genSchedOn(targetSchedule,d));
    genDateStrs.forEach(d=>_add8(d,_prevSnap[d]));
  }
  for (const date of genDates) {
    const dow=date.getDay();
    const isWeekend=dow===0||dow===6;
    const dateStr=toDateStr(date.getFullYear(),date.getMonth()+1,date.getDate());
    const isHoliday=!!(data.holidays&&data.holidays[dateStr]);
    const isHoliOrWE=isWeekend||isHoliday;   // 휴일 근무 공정성·수습 배제 기준
    const wdForm=isWeekdayForm(dateStr);       // 평일 틀(평일 인원·데스크 3개·조근·평일 8진) — 8뉴스 평일 편성(50분) 공휴일 포함
    const tmplWE=!wdForm;                      // 주말 틀 — 토·일, 설·추석처럼 주말 편성인 공휴일
    const wk=getWeekKey(dateStr);
    _curDS=dateStr;
    const prevDateStr=addDays(dateStr,-1);
    const countedSet=new Set();
    const countWork=(id)=>{
      if(!id||countedSet.has(id)) return; countedSet.add(id);
      workDays[id]=(workDays[id]||0)+1;
      addWC(id,wk);
      monthCount[id]=(monthCount[id]||0)+1;
      if (!tmplWE) weekdayCount[id]=(weekdayCount[id]||0)+1;
      if (isHoliOrWE) holidayWorkCount[id]=(holidayWorkCount[id]||0)+1;
      // 연속 근무일 업데이트
      consecutiveDays[id]=lastWorkDate[id]===prevDateStr?(consecutiveDays[id]||0)+1:1;
      lastWorkDate[id]=dateStr;
    };
    const _cap=(id,n=1)=>getWC(id,wk)+n<=6;   // 주 7일 금지(하드): 이 배정 뒤에도 그 주 근무가 6일을 넘지 않을 때만 — 모든 '최후 수단'에도 적용
    const _rsv=id=>!tmplWE&&reservedForWeekend(id,wk);   // 주말 예약자 평일 휴식
    const _okAvail=p=>!!p&&p.active!==false&&isContractActive(p,dateStr)&&!isDispatched(p,dateStr);   // 계약 기간 안·파견 아님
    // 손입력 칸(출장·Jr.캠프·교육 같은 외부 일정, 회색 '특별 작업', N, VW2 등)이 있는 사람은 그날 어떤 근무에도 뽑지 않음
    const customIds=Object.keys(_prevSnap[dateStr]?.customCells||{});
    // 이번 주 주말 데스크 담당 예약 (데스크 순위자 중 가장 적게 맡은 사람, 공정 로테이션)
    if(!weekendDeskPlan[wk]){
      const vwCand=vwPool.filter(p=>p.deskPriority>=1&&p.deskPriority<=5)
        .sort((a,b)=>((weekendDeskCount[a.id]||0)-(weekendDeskCount[b.id]||0))||(a.deskPriority-b.deskPriority));
      const cgCand=cgPool.filter(p=>p.deskPriority>=2&&p.deskPriority<=5)
        .sort((a,b)=>((weekendDeskCount[a.id]||0)-(weekendDeskCount[b.id]||0))||(a.deskPriority-b.deskPriority));
      // XR 전원 로테이션: 주말 근무 적은 순으로 이번 주 담당(절반, 최소1) 예약 — 평일 1일 쉬고 주말 투입
      const xrSorted=[...xrPool].sort((a,b)=>((xrWeekendCount[a.id]||0)-(xrWeekendCount[b.id]||0))||((workDays[a.id]||0)-(workDays[b.id]||0)));
      const xrReserveN=xrPool.length?Math.max(1,Math.floor(xrPool.length/2)):0;
      // 일근(일요일) 담당 예약: 일근 적게 한 사람 우선 — 평일 1일 쉬고 일요일 일근 투입
      const _sun0=addDays(dateStr,(7-dow)%7), _sun0Cells=(_prevSnap[_sun0]||(_outR(_sun0)?_genSchedOn(targetSchedule,_sun0):null)||{}).customCells||{};
      const ilgeunCandPlan=[...ilgeunPool].filter(p=>!isOnLeave(p.id,_sun0)&&!_sun0Cells[p.id]&&isContractActive(p,_sun0)).sort((a,b)=>((specialMonth[a.id]||0)-(specialMonth[b.id]||0))||((ilgeunCount[a.id]||0)-(ilgeunCount[b.id]||0))||((workDays[a.id]||0)-(workDays[b.id]||0)));   // 일근+토조 월 1회 먼저, 그 주 일요일 휴가자 제외
      // 토요 데스크(vw·cg)는 그 주 토요일 휴가자 말고, 일요 데스크(vw2·cg2)는 일요일 휴가자 말고
      const _satD = dow===0 ? addDays(dateStr,-1) : addDays(dateStr,6-dow), _sunD = dow===0 ? dateStr : addDays(dateStr,7-dow);
      const _pair = c => { const a=c.find(p=>!isOnLeave(p.id,_satD)&&isContractActive(p,_satD))||null; const b=c.find(p=>p!==a&&!isOnLeave(p.id,_sunD)&&isContractActive(p,_sunD))||null; return [a,b]; };
      const [_vwA,_vwB]=_pair(vwCand), [_cgA,_cgB]=_pair(cgCand);
      const _ss=_prevSnap[_satD]||(_outR(_satD)?_genSchedOn(targetSchedule,_satD):null)||{}, _su=_prevSnap[_sunD]||(_outR(_sunD)?_genSchedOn(targetSchedule,_sunD):null)||{};   // 앞 단계·이전 초안에서 이미 정한 토·일 데스크·일요 일근
      // 일근 예약은 주말 데스크 예약자 말고(같은 사람이면 일근 보류에 막혀 그 주말 데스크가 빔)
      const _dsk=[_ss.vw?.desk||_vwA?.id, _su.vw?.desk||_vwB?.id, _ss.cg?.desk8||_cgA?.id, _su.cg?.desk8||_cgB?.id].filter(Boolean);
      const _ilPick=_su.ilgeun||ilgeunCandPlan.find(p=>!_dsk.includes(p.id))?.id||ilgeunCandPlan[0]?.id||null;
      weekendDeskPlan[wk]={
        vw:_ss.vw?.desk||_vwA?.id||null, vw2:_su.vw?.desk||_vwB?.id||null,
        cg:_ss.cg?.desk8||_cgA?.id||null, cg2:_su.cg?.desk8||_cgB?.id||null,
        xr:xrSorted.slice(0,xrReserveN).map(p=>p.id),
        ilgeun:_ilPick, ilgeun2:ilgeunCandPlan.find(p=>p.id!==_ilPick&&!_dsk.includes(p.id))?.id||ilgeunCandPlan.find(p=>p.id!==_ilPick)?.id||null
      };
      // 토요 조근 담당도 주 초에 예약 → 평일 하루 쉬게(reservedForWeekend) 해서 토요일에 주 5일이 남게. 일근 예약·토요 데스크·토요일 휴가자 제외
      { const _P=weekendDeskPlan[wk];
        const _sc=data.staff.filter(p=>p.canSatMorning&&p.active!==false&&!isOnLeave(p.id,_satD)&&![_P.ilgeun,_P.ilgeun2,_P.vw,_P.cg].includes(p.id)&&!isProbation(p,_satD)&&isContractActive(p,_satD))
          .sort((a,b)=>((specialMonth[a.id]||0)-(specialMonth[b.id]||0))||((satMorningCount[a.id]||0)-(satMorningCount[b.id]||0))||((a.deskPriority?1:0)-(b.deskPriority?1:0))||((workDays[a.id]||0)-(workDays[b.id]||0)));
        _P.sat=_ss.satMorning||_sc[0]?.id||null; }
      // 토·일 당직도 주 초에 예약 → 토요 당직은 평일 이틀, 일요 당직은 평일 하루 쉬게(reservedForWeekend)
      //  (예전엔 토요일에 그날 당직을 고르다 보니 평일 5일 다 일한 사람밖에 없어 '평일 5일+토 당직+일 퇴근' = 주 7일이 생김)
      { const _P=weekendDeskPlan[wk];
        _P.dj=_ss.danjik||_planDuty(_P,_satD);
        _P.dj2=_su.danjik||_planDuty(_P,_sunD);
      }
    }
    const _sp = (s.specialDays||{})[dateStr];   // 특정일 수동 목표(있으면 우선 적용)
    const vwTarget=_sp?.vw ?? (tmplWE?(dow===6?(s.satVW||s.weekendVW||4):(s.sunVW||s.weekendVW||4)):(s.weekdayVW||7));
    const cgTarget=_sp?.cg ?? (tmplWE?(dow===6?(s.satCG||6):(s.sunCG||7)):(s.weekdayCG||19));
    // 당직 constraints — targetSchedule(초안) 우선, 없으면 배포본 참조
    const _prevDay1 = addDays(dateStr,-1);
    const _prevDay2 = addDays(dateStr,-2);
    const danjikExitId = targetSchedule[_prevDay1]?.danjik || data.schedule[_prevDay1]?.danjik || null;
    const danjikOffId  = targetSchedule[_prevDay2]?.danjik || data.schedule[_prevDay2]?.danjik || null;
    const existingXr=(data.schedule[dateStr]?.xr||[]);
    let existingDanjik=_prevSnap[dateStr]?.danjik||targetSchedule[dateStr]?.danjik||null;
    const weekendBlock = (dow===6||dow===0) ? [...(weekendWorked[wk]||[])] : [];
    const restToday = restDays[dateStr] ? [...restDays[dateStr]] : [];
    // 일근 예약자는 토요일 일반근무에서 제외 → 일요일 일근용으로 보존 (토요일 소진 방지)
    const ilgeunHold = ((dow===6||dow===0) && weekendDeskPlan[wk]?.ilgeun) ? [weekendDeskPlan[wk].ilgeun] : [];
    // 일요 데스크 담당(예약 백업 vw2·cg2)은 토요일 일반 근무에서 빼 둠 — 토요일에 일하면 '주말 하루만' 규칙으로 일요일 데스크를 못 맡음
    const sunDeskHold = (dow===6) ? [weekendDeskPlan[wk]?.vw2, weekendDeskPlan[wk]?.cg2, weekendDeskPlan[wk]?.dj2].filter(Boolean) : [];   // 일요 당직 예약자도
    // 앞 단계(데스크·당직)나 이전 초안에서 이미 정한 역할(일근·토요 조근·조근 대타·교육 2인 칸 등)을 맡은 사람은 일반 근무자로 또 뽑지 않음
    //  (예전엔 '나머지 채우기'에서 일요일 일근 담당이 그날 근무자로 또 들어감)
    const _ps=_prevSnap[dateStr]||{};
    const presetRoleIds=[_ps.ilgeun,_ps.satMorning,...Object.values(_ps.jogeunSubs||{}),...(_ps.jogeunExtra||[]),...(_ps.jogeunEdu||[]),_ps.newsOh2,_ps.weekday8jin2,_ps.weekend8jin2].filter(Boolean);
    // 토요일: 다음날(일요일)에 이미 정해진 일근·주말 8진·당직·데스크·근무자(단계별 생성의 앞 단계, 수동 입력)는 토요일에 안 뽑음 — 주말 하루만
    const _nx=(dow===6)?(_prevSnap[addDays(dateStr,1)]||(_outR(addDays(dateStr,1))?_genSchedOn(targetSchedule,addDays(dateStr,1)):null)||{}):{};
    const _nxCustom=(dow===6)?Object.keys(_nx.customCells||{}).filter(id=>!/^(휴무|휴|쉼|대휴|비번|당직비번|퇴근|당직퇴근|신휴가|휴가|연차|반차|Jr\.?휴가|경조|공가|-|0)$/i.test(String(_nx.customCells[id]?.text||'').replace(/\s/g,''))):[];
    const nextDayHold=(dow===6)?[_nx.ilgeun,_nx.weekend8jin,_nx.weekend8jin2,_nx.danjik,_nx.vw?.desk,_nx.cg?.desk8,_nx.cg?.desk5,...(_nx.vw?.workers||[]),...(_nx.cg?.workers||[]),...(_nx.jogeunExtra||[]),...(_nx.jogeunEdu||[]),..._nxCustom].filter(Boolean):[];   // XR 주말 분배는 weekendBlock·토/일 몫이 맡음
    const baseBlocked=[danjikOffId,danjikExitId,...weekendBlock,...restToday,...customIds,...presetRoleIds,...nextDayHold].filter(Boolean);
    const extraBlocked=[];   // 아래에서 정해지는 당직·평일 공휴일 일근·토요 조근
    const blockedIds=[...baseBlocked,...ilgeunHold,...sunDeskHold];
    // 손입력 칸(출장·교육·회색 특별 작업·N·VW2 등 — 쉬는 글자는 빼고)과 조근 추가·교육 인원은 명단엔 안 넣지만 근무일로는 셈(주 5일·연속)
    const _restTxt=t=>/^(휴무|휴|쉼|대휴|비번|당직비번|퇴근|당직퇴근|신휴가|휴가|연차|반차|Jr\.?휴가|경조|공가|-|0)$/i.test(String(t||'').replace(/\s/g,''));
    customIds.filter(id=>!_restTxt(_ps.customCells?.[id]?.text)).forEach(countWork);
    [...(_ps.jogeunExtra||[]),...(_ps.jogeunEdu||[]),_ps.newsOh2,_ps.weekday8jin2,_ps.weekend8jin2].filter(Boolean).forEach(countWork);
    // 평일 공휴일(설·추석 주말 틀, 8뉴스 평일 편성 모두) 일근 1명: 근무자·당직을 뽑기 전에 먼저 정해 빼 둠
    // (평일 틀이면 직원 대부분이 근무자로 먼저 뽑혀 일근 할 사람이 안 남음). 데스크·오전데 1순위는 그날 데스크를 맡아야 해서 제외
    let holIlgeun=null, holIlgeunNew=false;
    if (isHoliday && !isWeekend && ilgeunPool.length) {
      holIlgeun = _prevSnap[dateStr]?.ilgeun || null;
      if (!holIlgeun) {
        const _c = ilgeunPool.filter(p=>p.id!==weekendDeskPlan[wk]?.ilgeun&&_okAvail(p)&&!_rsv(p.id)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_meets(p.id,'ilgeun',dateStr)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!isProbation(p,dateStr)&&p.deskPriority!==1&&p.morningDeskPriority!==1);
        holIlgeun = shuffleSort(_c, p=>(specialMonth[p.id]||0)*1000+(ilgeunCount[p.id]||0)+(p.deskPriority?500:0))[0]?.id || null;
        holIlgeunNew = !!holIlgeun;
      }
      if (holIlgeun) { blockedIds.push(holIlgeun); extraBlocked.push(holIlgeun); _addIv(holIlgeun,'ilgeun',dateStr); }
    }
    // 토요 조근: 근무자·당직을 뽑기 전에 먼저 정해 빼 둠(나중에 고르면 쉬는 날 있던 사람이 토요 일반 근무로 먼저 뽑혀 후보가 안 남음 — 사람 근무표는 38/38 토요일 모두 있음)
    let satPre=null, satPreNew=false;
    if (dow===6) {
      satPre = _prevSnap[dateStr]?.satMorning || null;
      if (!satPre) {
        const _plan=weekendDeskPlan[wk]||{};
        const _hold=[_plan.ilgeun,_plan.ilgeun2,_plan.vw,_plan.cg,_plan.dj,_plan.dj2].filter(Boolean);   // 일근 예약·토요 데스크·주말 당직 예약 제외
        const _pe0=targetSchedule[_prevDay1]||data.schedule[_prevDay1]||{};
        const _eve0=new Set([_pe0.weekday8jin,_pe0.weekday8jin2,_pe0.newsOh,_pe0.newsOh2,_pe0.weekend8jin,_pe0.weekend8jin2].filter(Boolean));   // 금요일 8진·뉴.오 다음날 금지
        const _ok=p=>p.canSatMorning&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_eve0.has(p.id)&&!_hold.includes(p.id)&&!isProbation(p,dateStr);
        const _planSat=_plan.sat;
        let _c=data.staff.filter(p=>_ok(p)&&!_meets(p.id,'jogeun',dateStr)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1));
        if(_planSat && _c.some(p=>p.id===_planSat)) _c=_c.filter(p=>p.id===_planSat);   // 예약자 우선
        if(!_c.length) _c=data.staff.filter(p=>_ok(p)&&getWC(p.id,wk)<5);
        if(!_c.length) _c=data.staff.filter(p=>p.canSatMorning&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_eve0.has(p.id)&&!isProbation(p,dateStr)&&getWC(p.id,wk)<5);   // 일근 2순위·토요 데스크 제외도 풂
        if(!_c.length) _c=data.staff.filter(p=>p.canSatMorning&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_eve0.has(p.id)&&!isProbation(p,dateStr)&&!consecBlocked(p.id,_prevDay1)&&_cap(p.id));   // 최후: 주 5일 찬 사람도(비우지 않음) — 단 주 7일은 안 됨
        // 일근+토요 조근을 합쳐 한 사람 월 1회(이번 생성 기간) 먼저, 그다음 토요 조근 누적 횟수, 데스크 순위자는 뒤로
        satPre = shuffleSort(_c, p=>(specialMonth[p.id]||0)*1000+(satMorningCount[p.id]||0)*10+(p.deskPriority?5:0))[0]?.id || null;
        satPreNew = !!satPre;
      }
      if (satPre) { blockedIds.push(satPre); extraBlocked.push(satPre); }
    }
    if (danjikExitId) { addWC(danjikExitId,wk,0); }
    // (특수근무 제외쌍: 시간겹침 판정 _meets / 등록 _addIv — 코어 상단서 정의)
    // 당직 자동배정 (워커 픽 전) — 데스크 담당자 제외, 당직자는 일반 근무 인원에서 제외
    if (!existingDanjik) {
      const curMs = new Date(dateStr+'T00:00:00').getTime();
      // 주말 데스크 담당 예약자는 그 주말 당직 제외 → 주말 데스크 공백 방지
      // (오전데 순위자는 항상 당직 제외 / 데스크 순위자는 평일 당직 가능 — 다른 순위가 데스크 커버)
      // 사람 근무표: 주말 데스크 2~5순위도 그 주말 데스크를 안 맡으면 주말 당직을 섬(83건 중 24건) → 그 주 예약자(1순위·백업)만 제외
      const _wPlan=weekendDeskPlan[wk]||{};
      // 당직 다음날 퇴근·그다음 날 비번이 주말 데스크 날에 걸리지 않게: 토요 데스크(vw·cg)는 목~토, 일요 데스크(vw2·cg2)는 금~일 당직 제외
      const _satDesk=[_wPlan.vw,_wPlan.cg].filter(Boolean), _sunDesk=[_wPlan.vw2,_wPlan.cg2].filter(Boolean);
      const isWeekendDeskPerson=(id)=>((dow===4||dow===5||dow===6)&&_satDesk.includes(id))||((dow===5||dow===6||dow===0)&&_sunDesk.includes(id))||((dow===4||dow===5||dow===6)&&(_wPlan.ilgeun===id||_wPlan.sat===id))||(dow===6&&_wPlan.dj2===id);   // 일근 예약자는 목~토 당직 제외(일요일 비번·퇴근, 목 당직이면 주 5일이 차서 일근 불가)
      // 당직(월~토)은 다음날 퇴근까지 그 주 이틀, 일요 당직은 이번 주 하루(퇴근은 다음 주) — 이걸 더해도 주 6일 이하인 사람만(주 7일 금지)
      const _dx=addDays(dateStr,1), _dxWE=_weOrHol(_dx);
      const _postBusy=_busyAfter(dateStr);
      const _dU=dow===0?1:2, _djHard=p=>_okAvail(p)&&_cap(p.id,_dU)&&!(isHoliOrWE&&isProbation(p,dateStr))&&!(_dxWE&&isProbation(p,_dx))&&!_postBusy.has(p.id);
      const basePool = [...vwPool,...cgPool].filter(p=>
        _djHard(p)&&p.canDanjik&&p.morningDeskPriority!==1&&!isWeekendDeskPerson(p.id)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_meets(p.id,'danjik',dateStr)
        &&!(dow===6&&satDanjikDone.has(p.id))
        &&(genDanjikCount[p.id]||0) < MAX_DANJIK_MONTH
      );
      // MAX 초과자 포함 fallback (오전데·주말데스크 가능자 제외 유지)
      let basePoolFull = basePool.length ? basePool : [...vwPool,...cgPool].filter(p=>
        _djHard(p)&&p.canDanjik&&p.morningDeskPriority!==1&&!isWeekendDeskPerson(p.id)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_meets(p.id,'danjik',dateStr)
        &&!(dow===6&&satDanjikDone.has(p.id))
      );
      // 최후 fallback: 그래도 없으면 예약자도 허용 (당직 공백 방지)
      if(!basePoolFull.length) basePoolFull = [...vwPool,...cgPool].filter(p=>
        _djHard(p)&&p.canDanjik&&p.morningDeskPriority!==1&&!isOnLeave(p.id,dateStr)&&![...baseBlocked,...extraBlocked,...ilgeunHold].includes(p.id)
        &&!(dow===6&&satDanjikDone.has(p.id))
      );
      const withGap = basePoolFull.filter(p=>{
        if (!lastDanjikDate[p.id]) return true;
        return (curMs - new Date(lastDanjikDate[p.id]+'T00:00:00').getTime()) / 86400000 >= MIN_DANJIK_GAP;
      });
      // 당직날+다음날 퇴근 = 이틀 근무로 셈(엑셀과 같음) → 그 주 근무가 5일을 넘지 않을 사람 우선(일요일 당직의 퇴근은 다음 주)
      const _weekOk=p=>getWC(p.id,wk)+(dow===0?1:2)<=5;
      const _gapWeek=withGap.filter(_weekOk);
      // gap 조건 + 당월횟수 기준 정렬 (당월 횟수 우선, 전체 누적 횟수 보조)
      // 공정성(이번 생성 당직수)×1000이 지배적 → 모두 1회 먼저 채움. 같은 레벨에선 데스크 순위자(+500)를
      // 뒤로 미뤄 비데스크 인원이 당직을 먼저 맡게 함 → 데스크 인원 확보(데스크 최우선). 누적 당직수는 보조.
      // 주 5일 안에 들 사람이 없으면(모두 평일을 다 일한 주) 그 주에 가장 덜 일한 사람부터 — 주 6·7일 최소화
      const _byWeek=!_gapWeek.length;
      // 데스크를 비우게 하는 당직은 뒤로: 데스크 순위자가 당직을 서면 그날(당직)·다음날(퇴근) 그 그룹 데스크 칸을 채울 순위자가 모자라는지
      const _deskNeedOn=(g,d)=>g==='VW'?1:(isWeekdayForm(d)?2:(((s.specialDays||{})[d]||{}).deskPair?2:1));
      const _deskAvailOn=(g,d,excl)=>(g==='CG'?cgPool:vwPool).filter(q=>q.deskPriority>=((g==='CG'&&!isWeekdayForm(d))?2:1)&&q.deskPriority<=5&&!excl.includes(q.id)&&_okAvail(q)&&!isOnLeave(q.id,d)&&!(_weOrHol(d)&&isProbation(q,d))).map(q=>q.id);
      const _xCells=Object.keys((_prevSnap[_dx]||{}).customCells||{});
      const _dToday={CG:_deskAvailOn('CG',dateStr,blockedIds), VW:_deskAvailOn('VW',dateStr,blockedIds)};
      const _dTom={CG:_deskAvailOn('CG',_dx,[danjikExitId,..._xCells].filter(Boolean)), VW:_deskAvailOn('VW',_dx,[danjikExitId,..._xCells].filter(Boolean))};
      const _breaksDesk=p=>{ if(!p.deskPriority) return false; const g=cgPool.includes(p)?'CG':(vwPool.includes(p)?'VW':null); if(!g) return false;
        return (_dToday[g].includes(p.id)&&_dToday[g].length-1<_deskNeedOn(g,dateStr))||(_dTom[g].includes(p.id)&&_dTom[g].length-1<_deskNeedOn(g,_dx)); };
      const _isWkndRes=p=>dow>=1&&dow<=5&&(_wPlan.dj===p.id||_wPlan.dj2===p.id);   // 주말 당직 예약자는 평일 당직을 데스크를 비우게 할 때만 대신 맡음
      const danjikEligible = shuffleSort(_gapWeek.length ? _gapWeek : (withGap.length ? withGap : basePoolFull),
        p=>(_byWeek?getWC(p.id,wk)*100000:0)+(_breaksDesk(p)?50000:0)+(_isWkndRes(p)?20000:0)+(genDanjikCount[p.id]||0)*1000+((dow===0||dow===6)?(wkndDanjik[p.id]||0)*600:0)+(prevMonthDanjik[p.id]||0)*80+(p.deskPriority?500:0)+(danjikCount[p.id]||0));
      // 이번 주 토·일 당직 예약자가 그날 설 수 있으면(주 5일 안) 그 사람
      const _planDj = dow===6 ? _wPlan.dj : (dow===0 ? _wPlan.dj2 : null);
      const _pp = _planDj ? basePoolFull.find(p=>p.id===_planDj&&_weekOk(p)&&!(_breaksDesk(p)&&danjikEligible.some(q=>!_breaksDesk(q)))) : null;   // 예약자도 데스크를 비우게 하면(다른 후보가 있을 때) 안 씀
      if (_pp || danjikEligible.length) {
        existingDanjik = (_pp||danjikEligible[0]).id;
        danjikCount[existingDanjik] = (danjikCount[existingDanjik]||0) + 1;
        genDanjikCount[existingDanjik] = (genDanjikCount[existingDanjik]||0) + 1;
        lastDanjikDate[existingDanjik] = dateStr;
        if (dow===6) satDanjikDone.add(existingDanjik);
        if (dow===0||dow===6) wkndDanjik[existingDanjik]=(wkndDanjik[existingDanjik]||0)+1;
        // 주말 당직 예약자가 평일 당직을 맡았으면 그 주말 자리를 다른 사람으로 다시 예약
        if (dow>=1&&dow<=5&&(_wPlan.dj===existingDanjik||_wPlan.dj2===existingDanjik)) {
          const _slot=_wPlan.dj===existingDanjik?'dj':'dj2';
          _wPlan[_slot]=null; _wPlan[_slot]=_planDuty(_wPlan, addDays(wk,_slot==='dj'?5:6), [existingDanjik], true);
        }
      }
    }
    // 당직자는 일반 근무 인원에 포함하지 않음 (데스크 포함)
    if (existingDanjik) { blockedIds.push(existingDanjik); extraBlocked.push(existingDanjik); _addIv(existingDanjik,'danjik',dateStr); countWork(existingDanjik); }   // 당직날도 근무일(주 5일·연속 근무에 셈)
    // VW 데스크: WC<5 전용 풀 사용 (sortPool의 WC<4 캡에 막히지 않게)
    const sVW=sortPool(vwPool,dateStr,wk,blockedIds,isHoliOrWE,tmplWE);
    const vwDeskPool=vwPool.filter(p=>_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&(tmplWE||!reservedForWeekend(p.id,wk))&&!(isHoliOrWE&&isProbation(p,dateStr)));
    let vwDeskCand=null;
    // 주말 틀: 예약 1순위 → 백업 2순위 → 우선순위 탐색
    if(tmplWE){
      const plan=weekendDeskPlan[wk]||{};
      vwDeskCand=vwDeskPool.find(p=>p.id===plan.vw)||vwDeskPool.find(p=>p.id===plan.vw2)||null;
    }
    if(!vwDeskCand) vwDeskCand=findDeskByPriority(vwDeskPool,dateStr,blockedIds);
    // 토요일: 예약 담당이 휴가 등으로 없으면 일요 데스크 보류자(vw2)도 토요 데스크로는 허용
    const _blkDesk=[...baseBlocked,...extraBlocked,...ilgeunHold];
    if(!vwDeskCand && dow===6){ const _rx=vwPool.filter(p=>_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!_blkDesk.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!isProbation(p,dateStr)); vwDeskCand=_rx.find(p=>p.id===weekendDeskPlan[wk]?.vw2)||findDeskByPriority(_rx,dateStr,_blkDesk); }
    // 마지막 수단: 전체 풀 (주말 포함, WC 무시)
    if(!vwDeskCand){
      const vwFull=vwPool.filter(p=>_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&_cap(p.id)&&!(isHoliOrWE&&isProbation(p,dateStr)));   // 주 7일은 안 됨
      vwDeskCand=findDeskByPriority(vwFull,dateStr,blockedIds);
    }
    if(tmplWE && vwDeskCand) weekendDeskCount[vwDeskCand.id]=(weekendDeskCount[vwDeskCand.id]||0)+1;
    // 수동 입력 보존: 스냅샷에 vw.desk/workers가 있으면 우선 사용
    const manualVwDesk = _prevSnap[dateStr]?.vw?.desk || null;
    const manualVwWorkers = _prevSnap[dateStr]?.vw?.workers || [];
    if (manualVwDesk) vwDeskCand = { id: manualVwDesk };
    const vwPicked=[...new Set([...(vwDeskCand?[vwDeskCand.id]:[]), ...manualVwWorkers])];
    if(isHoliOrWE) vwPicked.forEach(id=>_addIv(id,'work',dateStr));
    for (const p of sVW) { if(vwPicked.length>=vwTarget) break; if(!vwPicked.includes(p.id) && !(isHoliOrWE&&_meets(p.id,'work',dateStr))) { vwPicked.push(p.id); if(isHoliOrWE)_addIv(p.id,'work',dateStr); } }
    // VW 부족 시 canVW 교차 지원 인원 보충
    if (vwPicked.length < vwTarget) {
      const crossVW = data.staff
        .filter(p=>p.canVW&&p.dept!=='VW'&&_okAvail(p)&&!_rsv(p.id)&&!p.deskPriority&&!p.morningDeskPriority&&!isOnLeave(p.id,dateStr)&&!vwPicked.includes(p.id)&&!blockedIds.includes(p.id)&&!(isHoliOrWE&&isProbation(p,dateStr))&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1))
        .sort((a,b)=>(workDays[a.id]||0)-(workDays[b.id]||0));
      for (const p of crossVW) { if(vwPicked.length>=vwTarget) break; if(isHoliOrWE&&_meets(p.id,'work',dateStr))continue; vwPicked.push(p.id); if(isHoliOrWE)_addIv(p.id,'work',dateStr); }
    }
    // CG pool (주말은 오전데 전담·데스크1 제외)
    const cgPoolFiltered = tmplWE
      ? cgPool.filter(p=>!p.morningDeskPriority && p.deskPriority!==1)
      : cgPool;
    const sCG=sortPool(cgPoolFiltered,dateStr,wk,[...blockedIds,...vwPicked],isHoliOrWE,tmplWE);   // VW로 이미 들어간 사람은 CG에서 다시 안 뽑음
    // 오전데 배정 (평일만) — CG 데스크보다 먼저 정함: 오전데 사람은 5데스·8데스에서 빠짐(사람 근무표 0/105일 겹침). cgPicked 초기화 전에 확정하여 workers에 포함 보장
    let morningDeskAssign = _prevSnap[dateStr]?.morningDesk || null;
    if (!isHoliOrWE && !morningDeskAssign) {
      const mdAll = data.staff
        .filter(p=>p.morningDeskPriority&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!(data.draft?.newLeaves?.[dateStr]||[]).includes(p.id)&&!blockedIds.includes(p.id)&&!vwPicked.includes(p.id)&&_cap(p.id))
        .sort((a,b)=>(a.morningDeskPriority||9)-(b.morningDeskPriority||9));
      const mdCand = mdAll.filter(p=>getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!_rsv(p.id));   // 순위 지키되 주 5일 안 사람 먼저, 없으면 주 6일까지
      if (mdCand.length || mdAll.length) morningDeskAssign = (mdCand[0]||mdAll[0]).id;
    }
    if (isHoliOrWE) morningDeskAssign = null;
    // CG 데스크 배정 (WC<5 전용 풀 사용)
    let cgDesk8=null, cgDesk5=null;
    if (!tmplWE) {
      // 평일 틀: 1순위→8데스, 2순위→5데스(8뉴스 2번 데스크) (WC<5 보장)
      const deskCands=[1,2,3,4,5].map(pri=>cgPool.find(p=>p.deskPriority===pri&&p.id!==morningDeskAssign&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!vwPicked.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!reservedForWeekend(p.id,wk))).filter(Boolean);
      // fallback: WC·연속 무시
      const deskCandsFull=[1,2,3,4,5].map(pri=>cgPool.find(p=>p.deskPriority===pri&&p.id!==morningDeskAssign&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!vwPicked.includes(p.id)&&_cap(p.id))).filter(Boolean);   // 주 7일은 안 됨
      cgDesk8=(deskCands[0]||deskCandsFull[0])||null;
      cgDesk5=deskCands.find(p=>p!==cgDesk8)||deskCandsFull.find(p=>p!==cgDesk8)||null;   // 8데스와 같은 사람 안 됨
    } else {
      // 주말: 2/3순위 WC<5 우선, 없으면 전체 풀
      let wkDeskCands=cgPool.filter(p=>p.deskPriority>=2&&p.deskPriority<=5&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!vwPicked.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!isProbation(p,dateStr));
      if(!wkDeskCands.length) wkDeskCands=cgPool.filter(p=>p.deskPriority>=2&&p.deskPriority<=5&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!vwPicked.includes(p.id)&&!isProbation(p,dateStr)&&_cap(p.id));
      // 토요일: 그래도 없으면 일요 데스크 보류자(cg2)도 토요 데스크로는 허용
      if(!wkDeskCands.length && dow===6) wkDeskCands=cgPool.filter(p=>p.deskPriority>=2&&p.deskPriority<=5&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!_blkDesk.includes(p.id)&&!vwPicked.includes(p.id)&&!isProbation(p,dateStr)&&_cap(p.id));
      if(wkDeskCands.length){
        const plan=weekendDeskPlan[wk]||{};
        cgDesk8=wkDeskCands.find(p=>p.id===plan.cg)||wkDeskCands.find(p=>p.id===plan.cg2)||shuffleSort(wkDeskCands,p=>(weekendDeskCount[p.id]||0))[0];
        weekendDeskCount[cgDesk8.id]=(weekendDeskCount[cgDesk8.id]||0)+1;
        // 특정일 'CG 데스크 2명' 지정 시 5데스도 배정 (휴일/주말 기본은 8데스 1명)
        if (_sp?.deskPair) {
          const rest = wkDeskCands.filter(p=>p.id!==cgDesk8.id);
          cgDesk5 = shuffleSort(rest, p=>(weekendDeskCount[p.id]||0))[0] || null;
          if (cgDesk5) weekendDeskCount[cgDesk5.id]=(weekendDeskCount[cgDesk5.id]||0)+1;
        }
      }
    }
    // XR·Project 먼저 배정 (CG 총계에 포함되므로 CG 목표 계산 전에 확정)
    const projectPicked=isHoliOrWE?[]:projectPool.filter(p=>_okAvail(p)&&!isOnLeave(p.id,dateStr)&&getWC(p.id,wk)<5).map(p=>p.id);
    // XR 배정: 평일은 예약 휴식자 제외, 주말은 이번 주 예약 XR을 토·일로 분배
    let xrPicked;
    if(tmplWE){
      const plan=weekendDeskPlan[wk]?.xr||[];
      const avail=plan.filter(id=>_okAvail(staffById(id))&&!isOnLeave(id,dateStr)&&getWC(id,wk)<5&&!blockedIds.includes(id)&&!weekendBlock.includes(id)&&!_meets(id,'work',dateStr)&&!isProbation(staffById(id),dateStr));
      // 토요일엔 예약 XR 절반, 일요일엔 나머지(토요일 근무자는 weekendBlock으로 자동 제외)
      // 토요일엔 예약 XR 일부, 일요일엔 나머지(토요일 근무자는 weekendBlock으로 자동 제외). 주마다 토·일 몫을 번갈아 → 1명이면 격주로 토/일
      const _wIdx=Math.floor((Math.round(new Date(dateStr+'T00:00:00').getTime()/864e5)+3)/7);
      const _satN=(_wIdx%2===0)?Math.ceil(avail.length/2):Math.floor(avail.length/2);
      xrPicked = (dow===6) ? avail.slice(0, _satN) : avail;
      xrPicked.forEach(id=>_addIv(id,'work',dateStr));
    } else {
      xrPicked=xrPool.filter(p=>_okAvail(p)&&!isOnLeave(p.id,dateStr)&&getWC(p.id,wk)<5&&!blockedIds.includes(p.id)&&!consecBlocked(p.id,_prevDay1)&&!reservedForWeekend(p.id,wk)).map(p=>p.id);
    }
    const sportsPicked=targetSchedule[dateStr]?.sports||[];

    // CG 유효 목표: 당일 최대 인원(평일/토/일 구분)에서 VW·XR·Project를 뺀 나머지
    const dailyCap = _sp?.cap ?? (tmplWE
      ? (dow===6 ? (s.satDailyCap||s.dailyCap||11) : (s.sunDailyCap||s.dailyCap||11))
      : (s.wdDailyCap||s.dailyCap||22));
    const effectiveCgTarget = _sp?.cg ?? (tmplWE
      ? cgTarget
      : Math.max(
          (cgDesk8?1:0)+(cgDesk5?1:0),
          // 하루 인원 = 근무표 "당일" 칸·엑셀 합계와 같은 셈: VW + CG + XR, 오전데·평일 PJ는 빼고 셈(10월 엑셀 평일 20~21명)
          dailyCap - vwPicked.length - xrPicked.length - (isHoliOrWE ? projectPicked.length : 0) + (morningDeskAssign ? 1 : 0)
        ));

    // 수동 입력 보존: 스냅샷에 cg.desk8/desk5/workers가 있으면 우선 사용
    const manualCgDesk8 = _prevSnap[dateStr]?.cg?.desk8 || null;
    const manualCgDesk5 = _prevSnap[dateStr]?.cg?.desk5 || null;
    const manualCgWorkers = _prevSnap[dateStr]?.cg?.workers || [];
    if (manualCgDesk8) cgDesk8 = { id: manualCgDesk8 };
    if (manualCgDesk5) cgDesk5 = { id: manualCgDesk5 };
    if (cgDesk8 && cgDesk5 && cgDesk8.id===cgDesk5.id) {   // 손으로 정한 데스크와 자동 데스크가 같은 사람 → 자동 쪽을 다른 순위자로
      const _x=cgDesk8.id, _alt=(tmplWE?[2,3,4,5]:[1,2,3,4,5]).map(pri=>cgPool.find(p=>p.deskPriority===pri&&p.id!==_x&&p.id!==morningDeskAssign&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!vwPicked.includes(p.id)&&_cap(p.id)&&!(isHoliOrWE&&isProbation(p,dateStr)))).filter(Boolean);
      const _a=_alt.find(p=>getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1))||_alt[0]||null;
      if (manualCgDesk5 && !manualCgDesk8) cgDesk8=_a; else cgDesk5=_a;
    }
    const cgPicked=[...new Set([cgDesk8?.id, cgDesk5?.id, morningDeskAssign, ...manualCgWorkers].filter(Boolean))];
    if(isHoliOrWE) cgPicked.forEach(id=>_addIv(id,'work',dateStr));
    for (const p of sCG) { if(cgPicked.length>=effectiveCgTarget) break; if(!cgPicked.includes(p.id) && !vwPicked.includes(p.id) && !(isHoliOrWE&&_meets(p.id,'work',dateStr))) { cgPicked.push(p.id); if(isHoliOrWE)_addIv(p.id,'work',dateStr); } }
    // CG 부족 시 canCG 교차 지원 인원 보충
    if (cgPicked.length < effectiveCgTarget) {
      const crossCG = data.staff
        .filter(p=>p.canCG&&p.dept!=='CG'&&_okAvail(p)&&!_rsv(p.id)&&!isOnLeave(p.id,dateStr)&&!cgPicked.includes(p.id)&&!vwPicked.includes(p.id)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!(isHoliOrWE&&isProbation(p,dateStr)))
        .sort((a,b)=>(workDays[a.id]||0)-(workDays[b.id]||0));
      for (const p of crossCG) { if(cgPicked.length>=effectiveCgTarget) break; if(isHoliOrWE&&_meets(p.id,'work',dateStr))continue; cgPicked.push(p.id); if(isHoliOrWE)_addIv(p.id,'work',dateStr); }
    }
    // 3D가능 최소 2명 보장 (평일 틀, effectiveCgTarget 범위 내)
    if (!tmplWE) {
      const cur3D = cgPicked.filter(id=>staffById(id)?.can3D);
      if (cur3D.length < 2) {
        const need = 2 - cur3D.length;
        const extra3D = data.staff
          .filter(p=>p.can3D&&p.dept==='CG'&&_okAvail(p)&&!_rsv(p.id)&&!isOnLeave(p.id,dateStr)&&!cgPicked.includes(p.id)&&!vwPicked.includes(p.id)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!(isHoliOrWE&&isProbation(p,dateStr)))
          .sort((a,b)=>(workDays[a.id]||0)-(workDays[b.id]||0));
        // 인원 목표가 이미 찼으면 3D 아닌 일반 근무자(데스크·오전데·보존 칸 빼고 마지막에 뽑힌 사람)와 바꿈 — 평일 총인원(21명)이 넘지 않게
        const _fix3=new Set([cgDesk8?.id,cgDesk5?.id,morningDeskAssign,...manualCgWorkers].filter(Boolean));
        for (let i=0;i<need&&i<extra3D.length;i++){
          if(cgPicked.length>=effectiveCgTarget){
            let j=cgPicked.length-1; while(j>=0&&(_fix3.has(cgPicked[j])||staffById(cgPicked[j])?.can3D)) j--;
            if(j>=0){ const q=cgPicked[j]; if(isHoliOrWE&&_avoidIv[q]) _avoidIv[q].pop(); cgPicked.splice(j,1,extra3D[i].id); continue; }
          }
          cgPicked.push(extra3D[i].id);
        }
      }
    }
    // 프리랜서 평일 근무 보장: 목표 인원 미달 시에만 추가 (목표 초과 방지)
    if (!tmplWE) {
      vwPool.filter(p=>p.employmentType==='freelancer'&&!_rsv(p.id)&&!isDispatched(p,dateStr)&&!vwPicked.includes(p.id)&&!cgPicked.includes(p.id)&&!blockedIds.includes(p.id)&&!(isHoliOrWE&&isProbation(p,dateStr))&&!consecBlocked(p.id,_prevDay1)&&!isOnLeave(p.id,dateStr)&&isContractActive(p,dateStr)&&getWC(p.id,wk)<5&&(weekdayCount[p.id]||0)<(freelancerWeekdayTarget[p.id]??weekdaysInMonth)).forEach(p=>{if(vwPicked.length<vwTarget)vwPicked.push(p.id);});
      cgPool.filter(p=>p.employmentType==='freelancer'&&!_rsv(p.id)&&!isDispatched(p,dateStr)&&!cgPicked.includes(p.id)&&!vwPicked.includes(p.id)&&!blockedIds.includes(p.id)&&!(isHoliOrWE&&isProbation(p,dateStr))&&!consecBlocked(p.id,_prevDay1)&&!isOnLeave(p.id,dateStr)&&isContractActive(p,dateStr)&&getWC(p.id,wk)<5&&(weekdayCount[p.id]||0)<(freelancerWeekdayTarget[p.id]??weekdaysInMonth)).forEach(p=>{if(cgPicked.length<effectiveCgTarget)cgPicked.push(p.id);});
    }
    // ── 8진·뉴.오: 근무자를 세기 전에 정함. 사람 근무표처럼 '그날 근무자 안의 한 명'(엑셀 VW 7·CG 14 합계에 포함) ──
    // 그날 데스크·오전데·당직·퇴근·비번·손입력 칸인 사람은 제외. 근무자 명단에 없으면 같은 부서 일반 근무자 1명과 자리를 바꿈(인원 유지)
    const _deskIds=new Set([vwDeskCand?.id, cgDesk8?.id, cgDesk5?.id, morningDeskAssign].filter(Boolean));
    const _fixedIds=new Set([..._deskIds, ...manualVwWorkers, ...manualCgWorkers]);
    const _inLists=id=>vwPicked.includes(id)||cgPicked.includes(id)||xrPicked.includes(id)||projectPicked.includes(id)||sportsPicked.includes(id);
    const _freeOk=p=>_inLists(p.id) || (_okAvail(p) && !_rsv(p.id) && getWC(p.id,wk)<5 && !consecBlocked(p.id,_prevDay1) && !(isHoliOrWE&&isProbation(p,dateStr)));
    const _swapIn=(id)=>{
      if(!id || _inLists(id)) return;
      const p=staffById(id); const dpt=((typeof deptOn==='function'?deptOn(p,dateStr):p?.dept)||'').toUpperCase();
      // VW·CG가 아닌 부서는 근무자와 바꾸지 않고 그 부서 명단에 넣음(근무일·주말 기록에 들어가게)
      if(dpt==='XR'){ if(!xrPicked.includes(id)) xrPicked.push(id); return; }
      if(dpt==='PROJECT'){ if(!projectPicked.includes(id)) projectPicked.push(id); return; }
      if(dpt!=='VW' && dpt!=='CG'){ countWork(id); if(dow===0||dow===6){ (weekendWorked[wk]=weekendWorked[wk]||new Set()).add(id); } return; }
      const list = dpt==='VW' ? vwPicked : cgPicked;
      const n3d = list.filter(x=>staffById(x)?.can3D).length;
      for(let j=list.length-1;j>=0;j--){
        const q=list[j]; if(_fixedIds.has(q)) continue;
        if(!tmplWE && staffById(q)?.can3D && n3d<=2) continue;   // 3D 최소 2명 유지
        list.splice(j,1,id); return;
      }
      list.push(id);   // 바꿀 일반 근무자가 없으면 추가
    };
    // 평일 8진 (평일 틀, canWeekday8jin 직원, 공평 순환, 주 1회 제한)
    const _no8XR=p=>String(deptOn(p,dateStr)||'').toUpperCase()!=='XR';   // XR 부서(그날 기준)는 8진 안 맡음 — 8진 표시가 남아 있어도
    let weekday8jinAssign = _prevSnap[dateStr]?.weekday8jin || null;
    if (!weekday8jinAssign && !tmplWE && weekday8jinPool.length > 0) {
      if (!weekday8jinWeekDone[wk]) weekday8jinWeekDone[wk] = new Set();
      const weekDone = weekday8jinWeekDone[wk];
      const _ok=p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_deskIds.has(p.id)&&isContractActive(p,dateStr)&&_freeOk(p)&&!(dow===5&&weekendDeskPlan[wk]?.sat===p.id);   // 금요일엔 토요 조근 예약자 제외
      // 이번 주 미배정자 우선, 없으면 전체 허용. 같은 횟수면 이미 그날 근무자인 사람 우선
      let cand = weekday8jinPool.filter(p=>_ok(p)&&!weekDone.has(p.id)&&_no8XR(p));
      // 한 사람 주 1회는 지킴(같은 주 두 번 없음): 후보가 없으면 '주 5일·연속' 같은 부드러운 규칙만 풀고(주 6일까지), 그래도 없으면 비워 두고 재시도
      if (!cand.length) cand = weekday8jinPool.filter(p=>_no8XR(p)&&!weekDone.has(p.id)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_deskIds.has(p.id)&&_okAvail(p)&&(_inLists(p.id)||_cap(p.id))&&!(dow===5&&weekendDeskPlan[wk]?.sat===p.id));
      const sorted = shuffleSort(cand, p=>(weekday8jinCount[p.id]||0)*2+(_inLists(p.id)?0:1));
      if (sorted.length) {
        weekday8jinAssign = sorted[0].id;
        weekday8jinCount[sorted[0].id]=(weekday8jinCount[sorted[0].id]||0)+1;
        weekDone.add(sorted[0].id);
      }
    }
    if (weekday8jinAssign && !tmplWE) _swapIn(weekday8jinAssign);
    if (weekday8jinAssign) _fixedIds.add(weekday8jinAssign);   // 다음 뉴.오 바꿔 넣기에서 밀려나지 않게(예전엔 명단에서 빠져 근무일로 안 셈)
    // 뉴.오 (평일, 공휴일 아님 — 사람 근무표는 공휴일에 뉴.오 없음, canNewsOh 프리랜서, 한 사람 주 1회)
    let newsOhAssign = _prevSnap[dateStr]?.newsOh || null;
    const _ns2 = _prevSnap[dateStr]?.newsOh2 || null;   // 수동 입력한 뉴.오2(교육)는 자동 뉴.오 후보에서 제외
    if (!newsOhAssign && !isHoliOrWE && newsOhPool.length > 0) {
      if (!newsOhWeekDone[wk]) newsOhWeekDone[wk] = new Set();
      const nDone = newsOhWeekDone[wk];
      const _ok=p=>!isOnLeave(p.id,dateStr)&&p.id!==_ns2&&p.id!==weekday8jinAssign&&!blockedIds.includes(p.id)&&!_deskIds.has(p.id)&&isContractActive(p,dateStr)&&_freeOk(p)&&!(dow===5&&weekendDeskPlan[wk]?.sat===p.id);
      let cand = newsOhPool.filter(p=>_ok(p)&&!nDone.has(p.id));
      if (!cand.length) cand = newsOhPool.filter(_ok);
      const sorted = shuffleSort(cand, p=>((newsOhCount[p.id]||0)+(jogeunSubCount[p.id]||0))*2+(_inLists(p.id)?0:1));   // #2: 평일 조근 대체자는 뉴.오 후순위
      if (sorted.length) { newsOhAssign=sorted[0].id; newsOhCount[sorted[0].id]=(newsOhCount[sorted[0].id]||0)+1; nDone.add(sorted[0].id); }
    }
    if (newsOhAssign && !isHoliOrWE) _swapIn(newsOhAssign);
    if (newsOhAssign) _fixedIds.add(newsOhAssign);
    // 주말 8진 (주말 틀 — 토·일, 설·추석 같은 주말 편성 공휴일, 토·일 공휴일 포함. canWeekend8jin 프리랜서, 공평 순환)
    let weekend8jinAssign = _prevSnap[dateStr]?.weekend8jin || null;
    if (!weekend8jinAssign && tmplWE && weekend8jinPool.length > 0) {
      const _ok=p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_deskIds.has(p.id)&&isContractActive(p,dateStr)&&!(isHoliOrWE&&_meets(p.id,'work',dateStr))&&_freeOk(p);
      const cand = weekend8jinPool.filter(p=>_ok(p)&&_no8XR(p));
      const sorted = shuffleSort(cand, p=>(weekend8jinCount[p.id]||0)*2+(_inLists(p.id)?0:1));
      if (sorted.length) { weekend8jinAssign=sorted[0].id; weekend8jinCount[sorted[0].id]=(weekend8jinCount[sorted[0].id]||0)+1; _addIv(weekend8jinAssign,'work',dateStr); }
    }
    if (weekend8jinAssign && tmplWE) _swapIn(weekend8jinAssign);
    // 평일 인원 하한(20명, 하루 상한이 더 작으면 상한): 주말 예약·주 5일·연속 같은 '부드러운' 규칙 때문에 모자라면 주 6일 안(하드)에서 채움
    //  — 사용자: "21명이 20명까지 줄어도 되지만 주 7일은 안 됨". 주말 예약자는 맨 나중, VW는 VW 목표 안에서만
    if (!tmplWE) {
      const _floor=Math.min(dailyCap,20);
      const _wp=weekendDeskPlan[wk]||{}, _planIds=new Set([_wp.vw,_wp.vw2,_wp.cg,_wp.cg2,_wp.dj,_wp.dj2].filter(Boolean));
      // 토요 조근·일근 예약자는 대신할 사람이 적어 여기서 안 씀(토요 조근이 비던 것)
      const _ok=p=>p.id!==_wp.sat&&!_inLists(p.id)&&p.id!==weekday8jinAssign&&p.id!==newsOhAssign&&_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&_cap(p.id)&&!(isHoliOrWE&&(isProbation(p,dateStr)||_meets(p.id,'work',dateStr)));
      const _tier=p=>p.id===_wp.ilgeun?3:((getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!_rsv(p.id))?0:(_planIds.has(p.id)?2:1));   // 일근 예약자는 맨 마지막(일근은 6일째·돌림으로도 채워짐)
      const _byTier=([a],[b])=>(_tier(a)-_tier(b))||(getWC(a.id,wk)-getWC(b.id,wk))||((workDays[a.id]||0)-(workDays[b.id]||0));
      // 근무표 "당일" 칸과 같은 셈(오전데·평일 PJ 제외)
      let _tot=vwPicked.length+cgPicked.length-(morningDeskAssign&&cgPicked.includes(morningDeskAssign)?1:0)+xrPicked.length+(isHoliOrWE?projectPicked.length:0);
      // VW 목표(7명) 먼저 — 사람 근무표는 평일 VW 7명 고정(39/39주). 하루 상한을 넘으면 CG 일반 근무자 1명과 바꿈(3D 2명·데스크·8진·뉴오는 유지)
      if (vwPicked.length<vwTarget) {
        const _vc=[...vwPool.filter(_ok),...data.staff.filter(p=>p.canVW&&deptOn(p,dateStr)!=='VW'&&!p.deskPriority&&!p.morningDeskPriority&&_ok(p))].map(p=>[p]).sort(_byTier);
        for (const [p] of _vc) {
          if (vwPicked.length>=vwTarget) break;
          if (_inLists(p.id)) continue;
          if (isHoliOrWE&&_meets(p.id,'work',dateStr)) continue;   // 앞에서 넣은 사람과 만나면 안 되는 쌍
          if (_tot>=dailyCap) {
            const n3d=cgPicked.filter(x=>staffById(x)?.can3D).length;
            let j=cgPicked.length-1; while(j>=0&&(_fixedIds.has(cgPicked[j])||(staffById(cgPicked[j])?.can3D&&n3d<=2))) j--;
            if (j<0) break;
            const q=cgPicked[j]; if(isHoliOrWE&&_avoidIv[q]) _avoidIv[q].pop(); cgPicked.splice(j,1); _tot--;
          }
          vwPicked.push(p.id); _tot++; if (isHoliOrWE) _addIv(p.id,'work',dateStr);
        }
      }
      if (_tot<_floor && _sp?.cg==null) {   // 특정일에 CG 인원을 정했으면 그 수를 따름(CG로 채우지 않음)
        const _fc=[...cgPoolFiltered.filter(_ok).map(p=>[p,'cg']),...data.staff.filter(p=>p.canCG&&deptOn(p,dateStr)!=='CG'&&_ok(p)).map(p=>[p,'cg']),...vwPool.filter(_ok).map(p=>[p,'vw'])].sort(_byTier);
        for (const [p,to] of _fc) {
          if (_tot>=_floor) break;
          if (_inLists(p.id)) continue;
          if (isHoliOrWE&&_meets(p.id,'work',dateStr)) continue;
          if (to==='vw') { if (vwPicked.length>=vwTarget) continue; vwPicked.push(p.id); } else cgPicked.push(p.id);
          _tot++; if (isHoliOrWE) _addIv(p.id,'work',dateStr);
        }
      }
    }
    [...vwPicked,...cgPicked,...projectPicked,...sportsPicked,...xrPicked].forEach(countWork);
    if (tmplWE) xrPicked.forEach(id=>{ xrWeekendCount[id]=(xrWeekendCount[id]||0)+1; });
    // 그날 이미 맡은 사람(근무자·8진·뉴.오) — 조근 대타·토요 조근·일근은 이 사람들 말고
    const todayBusy=new Set([...vwPicked,...cgPicked,...projectPicked,...sportsPicked,...xrPicked,weekday8jinAssign,newsOhAssign,weekend8jinAssign].filter(Boolean));
    // 전날 저녁 근무(8진·뉴.오)한 사람은 다음날 새벽 조근 금지(사람 근무표 0건)
    const _pe=targetSchedule[_prevDay1]||data.schedule[_prevDay1]||{};
    const prevEvening=new Set([_pe.weekday8jin,_pe.weekday8jin2,_pe.newsOh,_pe.newsOh2,_pe.weekend8jin,_pe.weekend8jin2].filter(Boolean));
    if (danjikExitId) addWC(danjikExitId, wk);
    // 주말 중복 방지: 이번 주 토/일 근무자 기록 (공휴일 포함)
    if (dow===6||dow===0) {
      if (!weekendWorked[wk]) weekendWorked[wk] = new Set();
      [...vwPicked,...cgPicked,...xrPicked].forEach(id => weekendWorked[wk].add(id));
      if (existingDanjik) weekendWorked[wk].add(existingDanjik);
      customIds.filter(id=>!_restTxt(_ps.customCells?.[id]?.text)).forEach(id=>weekendWorked[wk].add(id));   // 토요 출장·교육 같은 손입력 근무 칸
      [...(_ps.jogeunExtra||[]),...(_ps.jogeunEdu||[]),_ps.newsOh2,_ps.weekday8jin2,_ps.weekend8jin2].filter(Boolean).forEach(id=>weekendWorked[wk].add(id));
    }
    // 조근 자동배정 - 각 조근직원별 처리
    const jogeunSubs={};
    const _jgIds=new Set(jogeunPool.map(p=>p.id));
    if (!tmplWE && jogeunPool.length > 0) {   // 주말 편성 공휴일(설·추석)엔 조근조 쉼
      jogeunPool.forEach(jp => {
        if (isOnLeave(jp.id, dateStr)) {
          // 앞 단계(데스크)·수동으로 이미 정한 대타가 있으면 그 사람을 근무일로 세고 끝(예전엔 새로 뽑아 세고 결과는 앞 단계 대타로 덮어 '유령 근무일'이 생김)
          const _preSub=_prevSnap[dateStr]?.jogeunSubs?.[jp.id];
          if (_preSub) { countWork(_preSub); todayBusy.add(_preSub); _addIv(_preSub,'jogeun',dateStr); return; }
          // 신휴가/휴가 → '조근 대타 가능' 표시자(없으면 프리랜서) 공평 배분.
          // 그날 근무자·8진·뉴.오, 당직·퇴근·비번, 손입력 칸, 전날 8진/뉴.오는 제외. 주 5일·연속 근무도 지킴
          const alreadySub = new Set(Object.values(jogeunSubs));
          const _base = p => !_jgIds.has(p.id) && !isOnLeave(p.id, dateStr) && _okAvail(p) && !alreadySub.has(p.id) && !todayBusy.has(p.id) && !blockedIds.includes(p.id) && !(isHoliOrWE&&isProbation(p,dateStr));   // 그날 자기 조근을 서는 조근 부서원은 제외
          let subCand = jogeunSubPool.filter(p => _base(p) && !prevEvening.has(p.id) && getWC(p.id,wk)<5 && !consecBlocked(p.id,_prevDay1) && !_rsv(p.id));
          if (!subCand.length) subCand = jogeunSubPool.filter(p => _base(p) && !prevEvening.has(p.id) && _cap(p.id));   // 주 7일은 안 됨
          if (!subCand.length) subCand = freelancerPool.filter(p => _base(p) && !prevEvening.has(p.id) && getWC(p.id,wk)<5);
          subCand = shuffleSort(subCand, p=>jogeunSubCount[p.id]||0);
          if (subCand.length) {
            const _sc = subCand.find(p=>!_meets(p.id,'jogeun',dateStr)) || subCand[0];
            jogeunSubs[jp.id] = _sc.id;
            morningSubCount[_sc.id]=(morningSubCount[_sc.id]||0)+1;
            jogeunSubCount[_sc.id]=(jogeunSubCount[_sc.id]||0)+1;   // #2
            countWork(_sc.id); todayBusy.add(_sc.id);
            _addIv(_sc.id,'jogeun',dateStr);
          }
        }
      });
    }
    // 토요일 조근: 근무자·당직보다 먼저 정한 사람(satPre) — 보존된 값이면 그대로
    let satMorningAssign = (dow===6) ? satPre : null;
    if (satPreNew) { morningSubCount[satPre]=(morningSubCount[satPre]||0)+1; satMorningCount[satPre]=(satMorningCount[satPre]||0)+1; specialMonth[satPre]=(specialMonth[satPre]||0)+1; }
    if (dow!==6) satMorningAssign=null;
    // 토요일 조근 배정자도 주말 근무자로 기록 + 근무 카운트
    if (dow===6 && satMorningAssign) {
      if (!weekendWorked[wk]) weekendWorked[wk] = new Set();
      weekendWorked[wk].add(satMorningAssign);
      countWork(satMorningAssign); _addIv(satMorningAssign,'jogeun',dateStr);
    }
    // morningDeskAssign은 위 cgPicked 초기화 전에 이미 배정됨
    // 일근 배정 (일요일, 직원만, 공평 순환)
    let ilgeunAssign = _prevSnap[dateStr]?.ilgeun || null;   // 앞 단계(데스크·당직)에서 정한 일근은 그대로 — 예전엔 '나머지 채우기'에서 다시 뽑혀 바뀌었음
    const ilgeunDay = (dow===0 || (isHoliday && !isWeekend));   // 사람 근무표: 일요일 + 평일 공휴일(설·추석·평일 편성 공휴일 모두) 일근 1명
    if (!ilgeunDay) ilgeunAssign = null;
    if (holIlgeun) { ilgeunAssign = holIlgeun; if (holIlgeunNew) { ilgeunCount[holIlgeun]=(ilgeunCount[holIlgeun]||0)+1; specialMonth[holIlgeun]=(specialMonth[holIlgeun]||0)+1; } }   // 평일 공휴일은 앞에서 정한 사람
    if (!ilgeunAssign && ilgeunDay && ilgeunPool.length > 0) {
      const _blk = [...baseBlocked,...extraBlocked,...sunDeskHold];   // 일근 예약 보류(ilgeunHold)만 풀고 비번·퇴근·당직·손입력·앞 단계 역할은 그대로 막음
      // 주5일 준수: WC<5(평일 하루 쉰 사람) + 연속 제약, 그날 근무자·손입력 칸 제외
      const _ilOk=p=>_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!_blk.includes(p.id)&&!todayBusy.has(p.id)&&!isProbation(p,dateStr);
      let ilgeunCand = ilgeunPool.filter(p=>_ilOk(p)&&!_meets(p.id,'ilgeun',dateStr)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1));
      if(!ilgeunCand.length) ilgeunCand = ilgeunPool.filter(p=>_ilOk(p)&&getWC(p.id,wk)<5);
      if(!ilgeunCand.length) ilgeunCand = ilgeunPool.filter(p=>_ilOk(p)&&_cap(p.id));   // 일근은 비우지 않음: 그 주 6일째까지 허용(7일은 안 됨)
      // 일근+토요 조근을 합쳐 한 사람 월 1회 먼저, 그다음 일근 누적 횟수
      const ilgeunSorted = shuffleSort(ilgeunCand, p=>(specialMonth[p.id]||0)*1000+(ilgeunCount[p.id]||0));
      // 이번 주 예약된 일근 담당 우선(일요일)
      const planIlgeun=dow===0?weekendDeskPlan[wk]?.ilgeun:null;
      const preferred=ilgeunCand.find(p=>p.id===planIlgeun&&!(specialMonth[p.id]>0));
      if (preferred || ilgeunSorted.length) {
        ilgeunAssign=(preferred||ilgeunSorted[0]).id;
        ilgeunCount[ilgeunAssign]=(ilgeunCount[ilgeunAssign]||0)+1;
        specialMonth[ilgeunAssign]=(specialMonth[ilgeunAssign]||0)+1;
      }
    }
    // 그래도 없으면(일근 가능자가 모두 그날 근무자) 그날 일반 근무자 중 일근 가능자 1명을 일근으로 돌리고, 빈자리는 쉬는 사람으로 채움(못 채우면 근무자 1명 줄어듦)
    if (!ilgeunAssign && ilgeunDay && ilgeunPool.length > 0) {
      const _fixedW=new Set([vwDeskCand?.id,cgDesk8?.id,cgDesk5?.id,morningDeskAssign,weekday8jinAssign,newsOhAssign,weekend8jinAssign,...manualVwWorkers,...manualCgWorkers].filter(Boolean));
      const _ilIds=new Set(ilgeunPool.filter(p=>_okAvail(p)&&!isOnLeave(p.id,dateStr)&&!isProbation(p,dateStr)&&!_meets(p.id,'ilgeun',dateStr)).map(p=>p.id));
      for (const [list,pool] of [[cgPicked,cgPoolFiltered],[vwPicked,vwPool],[xrPicked,null]]) {
        const _can=id=>_ilIds.has(id)&&!_fixedW.has(id);
        let j=(!tmplWE&&list===cgPicked)?list.findIndex(id=>_can(id)&&!staffById(id)?.can3D):-1;   // 평일 틀이면 3D 아닌 사람 먼저
        if (j<0) j=list.findIndex(_can);
        if (j<0) continue;
        const _was3D=!!staffById(list[j])?.can3D;
        ilgeunAssign=list[j]; list.splice(j,1);
        ilgeunCount[ilgeunAssign]=(ilgeunCount[ilgeunAssign]||0)+1; specialMonth[ilgeunAssign]=(specialMonth[ilgeunAssign]||0)+1;
        if (!pool) break;   // XR은 빈자리 채우지 않음
        const _rfs=sortPool(pool,dateStr,wk,[...blockedIds,...todayBusy,...vwPicked,...cgPicked],isHoliOrWE,tmplWE).filter(p=>!(isHoliOrWE&&_meets(p.id,'work',dateStr)));
        const _need3D=!tmplWE&&list===cgPicked&&_was3D&&cgPicked.filter(id=>staffById(id)?.can3D).length<2;
        const _rf=(_need3D&&_rfs.find(p=>p.can3D))||_rfs[0];
        if (_rf) { list.push(_rf.id); countWork(_rf.id); todayBusy.add(_rf.id); if (dow===0||dow===6) { (weekendWorked[wk]=weekendWorked[wk]||new Set()).add(_rf.id); } if (isHoliOrWE) _addIv(_rf.id,'work',dateStr); }
        break;
      }
    }
    if (ilgeunAssign) {
      if (dow===0||dow===6) { if (!weekendWorked[wk]) weekendWorked[wk] = new Set(); weekendWorked[wk].add(ilgeunAssign); }
      countWork(ilgeunAssign); _addIv(ilgeunAssign,'ilgeun',dateStr);
    }
    // 주5일 보장은 주간 WC 상한(월~일 5일)으로 처리 — 평일에 하루 쉰 사람만 그 주 주말 근무 가능.
    // (과거의 "다음 주 대휴" 방식은 주6일을 유발해 제거함)
    // 수동 입력 보존: jogeunSubs는 자동생성에 수동 스냅샷 병합 (수동 우선)
    const finalJogeunSubs = { ...jogeunSubs, ...(_prevSnap[dateStr]?.jogeunSubs||{}) };
    const _full={
      vw:{workers:vwPicked, desk:manualVwDesk||vwDeskCand?.id||null},
      cg:{workers:cgPicked, desk8:manualCgDesk8||cgDesk8?.id||null, desk5:manualCgDesk5||cgDesk5?.id||null},
      project:projectPicked,
      sports:sportsPicked,
      xr:xrPicked,
      danjik:existingDanjik,
      jogeunSubs:finalJogeunSubs,
      ilgeun:ilgeunAssign,
      morningDesk:morningDeskAssign,
      satMorning:satMorningAssign,
      newsOh:newsOhAssign,
      newsOh2:_prevSnap[dateStr]?.newsOh2||null,
      weekend8jin:weekend8jinAssign,
      weekday8jin:weekday8jinAssign,
      weekend8jin2:_prevSnap[dateStr]?.weekend8jin2||null,
      weekday8jin2:_prevSnap[dateStr]?.weekday8jin2||null,
      restWorkers:restDays[dateStr]?[...restDays[dateStr]]:[],
      // 수동 입력 필드 보존
      customCells:_prevSnap[dateStr]?.customCells||undefined,
      jogeunEdu:_prevSnap[dateStr]?.jogeunEdu||[],
      jogeunExtra:_prevSnap[dateStr]?.jogeunExtra||undefined,
      notes:_prevSnap[dateStr]?.notes||targetSchedule[dateStr]?.notes||''
    };
    const _phase = opts.phase || 'all';
    if (_phase==='desk') {
      // 고정 역할 전부(데스크·오전데·당직·8진·뉴오·일근·조근) + 그 인원만. 일반 근무자·XR·PROJECT·SPORTS는 '나머지 채우기'에서.
      const fixed = new Set([
        _full.vw.desk, _full.cg.desk8, _full.cg.desk5, _full.morningDesk,
        _full.danjik, _full.ilgeun, _full.newsOh, _full.newsOh2,
        _full.weekend8jin, _full.weekday8jin, _full.satMorning,
        ...(_full.jogeunExtra||[]), ...Object.values(_full.jogeunSubs||{})
      ].filter(Boolean));
      const e = JSON.parse(JSON.stringify(_full));
      e.vw.workers = (e.vw.workers||[]).filter(id=>fixed.has(id));
      e.cg.workers = (e.cg.workers||[]).filter(id=>fixed.has(id));
      e.xr=[]; e.project=[]; e.sports=[];
      targetSchedule[dateStr]=e;
    } else if (_phase==='danjik') {
      // 당직만 추가, 데스크 등 기존은 보존
      const pv=_prevSnap[dateStr];
      const e=pv?JSON.parse(JSON.stringify(pv)):{vw:{workers:[],desk:null},cg:{workers:[],desk8:null,desk5:null},project:[],sports:[],xr:[],morningDesk:null,notes:''};
      e.danjik=_full.danjik;
      targetSchedule[dateStr]=e;
    } else {
      // 'all' / 'rest' — 기존 데스크·당직·근무자 보존하며 나머지 전부 채움
      targetSchedule[dateStr]=_full;
    }
  }
  if (!opts.silent) {
    showResult(resultElId,`✅ ${startVal} ~ ${endVal} 근무표 생성 완료 (${totalDays}일)`,true);
    toast('근무표 초안이 생성되었습니다.','success');
  }
  return { genDateStrs, totalDays };
}
// 데스크 누락 점검: VW데스/CG데스(매일), 평일 5데스·오전데
function _validateScheduleRange(targetSchedule, genDateStrs, phase) {
  phase = phase || 'all';
  const issues=[];
  const ilgeunHasPool=data.staff.some(s=>s.canIlgeun&&s.employmentType!=='freelancer'&&s.active!==false);
  const satHasPool=data.staff.some(s=>s.canSatMorning&&s.active!==false);
  const djHasPool=data.staff.some(s=>s.canDanjik&&s.active!==false);
  const w8HasPool=data.staff.some(s=>s.canWeekday8jin&&s.employmentType!=='freelancer'&&s.active!==false);
  for (const ds of genDateStrs) {
    const entry=targetSchedule[ds];
    const d=new Date(ds+'T00:00:00');
    const dow=d.getDay();
    const isWeekend=dow===0||dow===6;
    const isHoliday=!!(data.holidays&&data.holidays[ds]);
    if(!entry){ issues.push({date:ds,what:'전체'}); continue; }
    if(!entry.vw?.desk) issues.push({date:ds,what:'VW데스'});
    if(djHasPool&&!entry.danjik) issues.push({date:ds,what:'당직'});
    if(!(entry.cg?.desk8||entry.cg?.desk)) issues.push({date:ds,what:'CG데스'});
    if(entry.cg?.desk8&&entry.cg.desk8===entry.cg.desk5) issues.push({date:ds,what:'CG데스 중복'});
    if(entry.morningDesk&&[entry.cg?.desk8,entry.cg?.desk5,entry.vw?.desk].includes(entry.morningDesk)) issues.push({date:ds,what:'오전데 중복'});
    if(isWeekdayForm(ds)&&w8HasPool&&!entry.weekday8jin&&phase!=='danjik') issues.push({date:ds,what:'8진'});
    if(isWeekdayForm(ds)&&phase!=='desk'&&phase!=='danjik'&&((data.settings.specialDays||{})[ds]||{}).cg==null){   // 평일 인원 하한(20명, 하루 상한이 더 작으면 상한) — 특정일 CG 인원을 정한 날은 그 수를 따름
      const _c0=((data.settings.specialDays||{})[ds]||{}).cap ?? (data.settings.wdDailyCap||data.settings.dailyCap||22);
      const _t0=(entry.vw?.workers||[]).length+(entry.cg?.workers||[]).length-(entry.morningDesk&&(entry.cg?.workers||[]).includes(entry.morningDesk)?1:0)+(entry.xr||[]).length+(isHoliday?(entry.project||[]).length:0);   // 근무표 "당일" 칸과 같은 셈
      if(_t0<Math.min(20,_c0)) issues.push({date:ds,what:'인원 '+_t0+'명'});
    }
    if(isWeekdayForm(ds)){   // 평일 틀: 8데스+5데스(8뉴스 2번 데스크), 공휴일이 아니면 오전데
      if(!entry.cg?.desk5) issues.push({date:ds,what:'CG5데스'});
      if(!isHoliday&&!entry.morningDesk) issues.push({date:ds,what:'오전데'});
    }
    // 토요 조근 누락 점검(canSatMorning 직원이 있을 때만) — 비면 재시도
    if(dow===6&&satHasPool&&!entry.satMorning&&phase!=='danjik') issues.push({date:ds,what:'토요조근'});
    // 일근 누락 점검: 일요일 + 평일 공휴일 (canIlgeun 직원이 있을 때만)
    if((dow===0||(isHoliday&&!isWeekend))&&ilgeunHasPool&&!entry.ilgeun&&phase!=='danjik') issues.push({date:ds,what:'일근'});
  }
  // 평일 8진 한 사람 주 2회 이상
  { const w8={}; genDateStrs.forEach(ds=>{ const e=targetSchedule[ds]; if(e&&e.weekday8jin){ const k=getWeekKey(ds)+'|'+e.weekday8jin; (w8[k]=w8[k]||[]).push(ds); } });
    Object.entries(w8).forEach(([k,l])=>{ if(l.length>1){ const st=staffById(k.split('|')[1]); issues.push({date:l[1],what:'8진 주2회 '+(st?.name||'')}); } }); }
  // 주 7일(월~일 매일 근무) — 생성 결과가 낀 경우만(그 주 7일이 모두 손입력 칸이면 사용자가 정한 것). 조근 부서는 평일 기본 근무가 칸에 없어 제외
  const _inR=new Set(genDateStrs), _src=d=>_inR.has(d)?(targetSchedule[d]||null):_genSchedOn(targetSchedule,d);
  for (const wk of [...new Set(genDateStrs.map(getWeekKey))]) {
    const cnt={}, gen={};
    for (let i=0;i<7;i++){ const d=addDays(wk,i), e=_src(d); if(!e) continue;
      _genDayUnits(e,_src(addDays(d,-1))).forEach(id=>{ cnt[id]=(cnt[id]||0)+1; if(!(e.customCells&&e.customCells[id])) gen[id]=1; }); }
    Object.keys(cnt).forEach(id=>{ if(cnt[id]<7||!gen[id]) return; const st=staffById(id); if(st&&st.dept==='조근') return; issues.push({date:wk,what:'주7일 '+(st?.name||id)}); });
  }
  return issues;
}
function _snapshotRange(targetSchedule, dateStrs){
  const snap={};
  dateStrs.forEach(ds=>{ if(targetSchedule[ds]) snap[ds]=JSON.parse(JSON.stringify(targetSchedule[ds])); });
  return snap;
}
function _restoreRange(targetSchedule, dateStrs, snap){
  dateStrs.forEach(ds=>{ if(snap[ds]) targetSchedule[ds]=JSON.parse(JSON.stringify(snap[ds])); });
}
// 생성 전 상태로 정확히 되돌림(그때 없던 날은 지움)
function _restoreExact(targetSchedule, dateStrs, snap){
  dateStrs.forEach(ds=>{ if(snap[ds]) targetSchedule[ds]=JSON.parse(JSON.stringify(snap[ds])); else delete targetSchedule[ds]; });
}
// 누락 점수: 주 7일·일근·당직 빈칸은 데스크 빈칸보다 훨씬 무겁게(최선안 고를 때)
function _issueScore(issues){ return issues.reduce((s,i)=>s+(/^(주7일|일근$|당직$)/.test(i.what)?100:(i.what==='토요조근'?10:1)),0); }
// 백그라운드 자동 재생성: 데스크 누락 없을 때까지 반복 (최대 시도 후 최선안 채택)
function _generateWithRetry(startVal, endVal, targetSchedule, resultElId, onDone, opts){
  opts = opts || {};
  const MAX_ATTEMPTS=50;
  let attempt=0, bestSnap=null, bestIssues=null, bestCount=Infinity, bestScore=Infinity, lastDateStrs=null, lastTotal=0;
  // 매 시도는 생성 전 상태(수동 입력·앞 단계 결과)에서 새로 굴림 — 예전엔 앞 시도 결과가 '보존'돼 재시도가 거의 같은 결과를 냈음
  const _rangeDates=[]; for(let d=startVal; d<=endVal && _rangeDates.length<400; d=addDays(d,1)) _rangeDates.push(d);
  const _base=_snapshotRange(targetSchedule,_rangeDates);
  showResult(resultElId,'⏳ 근무표 계산 중...',true);
  function step(){
    attempt++;
    if(attempt>1) _restoreExact(targetSchedule,_rangeDates,_base);
    const res=_generateScheduleCore(startVal,endVal,targetSchedule,resultElId,{silent:true, phase:opts.phase});
    if(!res){ if(onDone)onDone(false); return; } // 하드 에러(직원부족 등) — 이미 메시지 표시됨
    lastDateStrs=res.genDateStrs; lastTotal=res.totalDays;
    const issues=_validateScheduleRange(targetSchedule,res.genDateStrs, opts.phase);
    const score=_issueScore(issues);
    if(score<bestScore){
      bestScore=score; bestCount=issues.length;
      bestSnap=_snapshotRange(targetSchedule,res.genDateStrs);
      bestIssues=issues;
    }
    if(issues.length===0){
      showResult(resultElId,`✅ ${startVal} ~ ${endVal} 근무표 생성 완료 (${res.totalDays}일 · ${attempt}회 시도)`,true);
      toast('근무표 초안이 생성되었습니다.','success');
      if(onDone)onDone(true);
      return;
    }
    if(attempt<MAX_ATTEMPTS){
      showResult(resultElId,`⏳ 데스크 누락 보정 중... (${attempt}회 · 부족 ${bestCount}건)`,true);
      setTimeout(step,0);
    } else {
      // 최선안 복원 후 잔여 누락 보고
      _restoreRange(targetSchedule,lastDateStrs,bestSnap);
      const summ=bestIssues.slice(0,8).map(i=>`${i.date.slice(5)} ${i.what}`).join(', ')+(bestIssues.length>8?' 외':'');
      showResult(resultElId,`⚠️ ${attempt}회 시도 후 완료 — 잔여 부족 ${bestCount}건: ${summ}`,false);
      toast('일부 자리를 채우지 못했습니다. 결과 메시지와 직원 설정·휴가를 확인하세요.','error');
      if(onDone)onDone(false);
    }
  }
  setTimeout(step,0);
}
function showResult(id,msg,ok) {
  const el=document.getElementById(id);
  el.style.display='block'; el.className='gen-result '+(ok?'success':'error'); el.textContent=msg;
}

