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
    const dow=dt.getDay(),ds=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    if(dow!==0&&dow!==6&&!(data.holidays&&data.holidays[ds])) weekdaysInMonth++;
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
  function getWC(staffId, wk) { return weekCount[staffId]?.[wk]||0; }
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
      const dow=dt.getDay();
      if(dow===0||dow===6) return false;
      const ds=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
      if(data.holidays&&data.holidays[ds]) return false;
      return isOnLeave(p.id,ds);
    }).length;
    freelancerWeekdayTarget[p.id]=Math.max(0,weekdaysInMonth-leaveCount);
  });
  const ilgeunPool=data.staff.filter(s=>s.canIlgeun&&s.employmentType!=='freelancer'&&s.active!==false);
  const newsOhPool=freelancerPool.filter(s=>s.canNewsOh);
  const weekend8jinPool=freelancerPool.filter(s=>s.canWeekend8jin);
  const weekday8jinPool=data.staff.filter(s=>s.canWeekday8jin&&s.employmentType!=='freelancer'&&s.active!==false);
  const morningSubCount={};
  const jogeunSubCount={};   // #2: 평일 조근 대체 횟수 → 그달 뉴.오 덜 배정
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
    const histEntries = Object.entries(data.schedule||{})
      .filter(([d]) => d >= histStart && d < startVal)
      .sort(([a],[b]) => a.localeCompare(b));
    histEntries.forEach(([d, entry]) => {
      if (entry.danjik) {
        danjikCount[entry.danjik]     = (danjikCount[entry.danjik]||0) + 1;
        lastDanjikDate[entry.danjik]  = d;
      }
      if (entry.danjik && d>=prevMonthStart && d<startMonthStart) prevMonthDanjik[entry.danjik]=(prevMonthDanjik[entry.danjik]||0)+1;
      if (entry.satMorning)  morningSubCount[entry.satMorning]   = (morningSubCount[entry.satMorning]||0) + 1;
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
  // 주말 CG 데스크 배정 횟수 (2순위/3순위 공정 배분)
  const weekendDeskCount = {};
  // XR 주말 근무 횟수 (전원 공정 로테이션용)
  const xrWeekendCount = {};
  // 주별 주말 데스크 담당 예약 (VW/CG 각 1명, XR 로테이션 일부 — 평일 1일 휴식 후 주말 투입)
  const weekendDeskPlan = {}; // wk -> {vw:id|null, cg:id|null, xr:[id...]}
  // 연속 근무일 추적 (6일 연속 방지)
  const consecutiveDays = {}; // id → 현재 연속 근무일수
  const lastWorkDate = {};    // id → 마지막 근무 날짜
  // 연속 6일 차단: 전날 실제 근무했고 연속 5일 이상일 때만 (쉬면 자동 해제)
  function consecBlocked(id, prevDS){ return lastWorkDate[id]===prevDS && (consecutiveDays[id]||0)>=5; }
  // 주말 예약자: 실제 주말 근무는 1일(weekendBlock으로 토/일 중복 차단)
  // → 평일 4일 허용, WC≥4 시 차단 (대휴 1일 확보). 신휴가 있는 주는 자동으로 대휴 없이 소화됨
  function reservedForWeekend(id, wk){
    const plan=weekendDeskPlan[wk]; if(!plan) return false;
    const inPlan=plan.vw===id||plan.vw2===id||plan.cg===id||plan.cg2===id||plan.ilgeun===id||plan.ilgeun2===id||(plan.xr&&plan.xr.includes(id));
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

  const sortPool=(pool,date,wk,skipIds,isHoliOrWE)=>{
   const prevDS=addDays(date,-1);
   return [...pool].filter(p=>{
    if (skipIds&&skipIds.includes(p.id)) return false;
    if (isOnLeave(p.id,date)) return false;
    if (!isContractActive(p,date)) return false;
    if (isDispatched(p,date)) return false;
    if (isHoliOrWE && isProbation(p,date)) return false; // 수습기간: 주말/휴일 근무 배제
    if (getWC(p.id,wk)>=5) return false; // 주5일 상한 (전원 동일)
    if (consecBlocked(p.id,prevDS)) return false; // 연속 6일 방지
    if (!isHoliOrWE && reservedForWeekend(p.id,wk)) return false; // 주말 데스크 예약자 평일 휴식
    if (p.employmentType==='freelancer'&&!isHoliOrWE&&(weekdayCount[p.id]||0)>=(freelancerWeekdayTarget[p.id]??weekdaysInMonth)) return false;
    return true;
  }).sort((a,b)=>{
    if (isHoliOrWE) {
      const hdiff=(holidayWorkCount[a.id]||0)-(holidayWorkCount[b.id]||0);
      if (hdiff!==0) return hdiff;
    }
    if (!isHoliOrWE) {
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
      if(dw!==0&&dw!==6&&!(data.holidays&&data.holidays[ds])){
        jogeunPool.forEach(jp=>{ if(!isOnLeave(jp.id,ds)) _addIv(jp.id,'jogeun',ds); });
      }
    }
    // 범위 마지막날 다음날(경계)의 조근 기본근무 등록 → 마지막날 당직이 다음 블록 첫날 조근과 겹침 판정(4주 이음새)
    const _post=addDays(genDateStrs[genDateStrs.length-1],1);
    { const _pdw=new Date(_post+"T00:00:00").getDay(); if(_pdw!==0&&_pdw!==6&&!(data.holidays&&data.holidays[_post])) jogeunPool.forEach(jp=>{ if(!isOnLeave(jp.id,_post)) _addIv(jp.id,"jogeun",_post); }); }
    // 범위 첫날 전날(경계)의 배포된 당직도 등록 → 첫날 아침 조근 겹침 반영
    const _pre=addDays(genDateStrs[0],-1);
    const _preDj=(data.draft&&data.draft.schedule&&data.draft.schedule[_pre]&&data.draft.schedule[_pre].danjik)||(data.schedule[_pre]&&data.schedule[_pre].danjik)||null;
    if(_preDj) _addIv(_preDj,'danjik',_pre);
  }
  for (const date of genDates) {
    const dow=date.getDay();
    const isWeekend=dow===0||dow===6;
    const dateStr=toDateStr(date.getFullYear(),date.getMonth()+1,date.getDate());
    const isHoliday=!!(data.holidays&&data.holidays[dateStr]);
    const isHoliOrWE=isWeekend||isHoliday;
    const wk=getWeekKey(dateStr);
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
      const ilgeunCandPlan=[...ilgeunPool].sort((a,b)=>((ilgeunCount[a.id]||0)-(ilgeunCount[b.id]||0))||((workDays[a.id]||0)-(workDays[b.id]||0)));
      weekendDeskPlan[wk]={
        vw:vwCand[0]?.id||null, vw2:vwCand[1]?.id||null,
        cg:cgCand[0]?.id||null, cg2:cgCand[1]?.id||null,
        xr:xrSorted.slice(0,xrReserveN).map(p=>p.id),
        ilgeun:ilgeunCandPlan[0]?.id||null, ilgeun2:ilgeunCandPlan[1]?.id||null
      };
    }
    const _sp = (s.specialDays||{})[dateStr];   // 특정일 수동 목표(있으면 우선 적용)
    const vwTarget=_sp?.vw ?? (isHoliOrWE?(dow===6?(s.satVW||s.weekendVW||4):(s.sunVW||s.weekendVW||4)):(s.weekdayVW||7));
    const cgTarget=_sp?.cg ?? (isHoliOrWE?(dow===6?(s.satCG||6):(s.sunCG||7)):(s.weekdayCG||19));
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
    const satIlgeunHold = (dow===6 && weekendDeskPlan[wk]?.ilgeun) ? [weekendDeskPlan[wk].ilgeun] : [];
    const blockedIds=[danjikOffId,danjikExitId,...weekendBlock,...restToday,...satIlgeunHold].filter(Boolean);
    if (danjikExitId) { addWC(danjikExitId,wk,0); }
    // (특수근무 제외쌍: 시간겹침 판정 _meets / 등록 _addIv — 코어 상단서 정의)
    // 당직 자동배정 (워커 픽 전) — 데스크 담당자 제외, 당직자는 일반 근무 인원에서 제외
    if (!existingDanjik) {
      const MIN_DANJIK_GAP = 7; // 당직 최소 간격: 1주일
      const MAX_DANJIK_MONTH = Math.max(3, Math.ceil(genDates.length / Math.max(1,[...vwPool,...cgPool].filter(p=>p.canDanjik).length)));
      const curMs = new Date(dateStr+'T00:00:00').getTime();
      // 주말 데스크 담당 예약자는 그 주말 당직 제외 → 주말 데스크 공백 방지
      // (오전데 순위자는 항상 당직 제외 / 데스크 순위자는 평일 당직 가능 — 다른 순위가 데스크 커버)
      const isWeekendDeskPerson=(id)=>isHoliOrWE&&(weekendDeskPlan[wk]?.vw===id||weekendDeskPlan[wk]?.cg===id);
      // 주말 데스크 가능자(2~5순위)는 주말 당직에서 우선 제외 → 주말 데스크 확보 (부족하면 최후 fallback에서 허용)
      const isWeekendDeskCand=(p)=>isHoliOrWE&&p.deskPriority>=2&&p.deskPriority<=5;
      const basePool = [...vwPool,...cgPool].filter(p=>
        p.canDanjik&&p.morningDeskPriority!==1&&!isWeekendDeskPerson(p.id)&&!isWeekendDeskCand(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_meets(p.id,'danjik',dateStr)
        &&!(dow===6&&satDanjikDone.has(p.id))
        &&(genDanjikCount[p.id]||0) < MAX_DANJIK_MONTH
      );
      // MAX 초과자 포함 fallback (오전데·주말데스크 가능자 제외 유지)
      let basePoolFull = basePool.length ? basePool : [...vwPool,...cgPool].filter(p=>
        p.canDanjik&&p.morningDeskPriority!==1&&!isWeekendDeskPerson(p.id)&&!isWeekendDeskCand(p)&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_meets(p.id,'danjik',dateStr)
        &&!(dow===6&&satDanjikDone.has(p.id))
      );
      // 최후 fallback: 그래도 없으면 예약자도 허용 (당직 공백 방지)
      if(!basePoolFull.length) basePoolFull = [...vwPool,...cgPool].filter(p=>
        p.canDanjik&&p.morningDeskPriority!==1&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)
        &&!(dow===6&&satDanjikDone.has(p.id))
      );
      const withGap = basePoolFull.filter(p=>{
        if (!lastDanjikDate[p.id]) return true;
        return (curMs - new Date(lastDanjikDate[p.id]+'T00:00:00').getTime()) / 86400000 >= MIN_DANJIK_GAP;
      });
      // gap 조건 + 당월횟수 기준 정렬 (당월 횟수 우선, 전체 누적 횟수 보조)
      // 공정성(이번 생성 당직수)×1000이 지배적 → 모두 1회 먼저 채움. 같은 레벨에선 데스크 순위자(+500)를
      // 뒤로 미뤄 비데스크 인원이 당직을 먼저 맡게 함 → 데스크 인원 확보(데스크 최우선). 누적 당직수는 보조.
      const danjikEligible = shuffleSort(withGap.length ? withGap : basePoolFull,
        p=>(genDanjikCount[p.id]||0)*1000+(prevMonthDanjik[p.id]||0)*80+(p.deskPriority?500:0)+(danjikCount[p.id]||0));
      if (danjikEligible.length) {
        existingDanjik = danjikEligible[0].id;
        danjikCount[existingDanjik] = (danjikCount[existingDanjik]||0) + 1;
        genDanjikCount[existingDanjik] = (genDanjikCount[existingDanjik]||0) + 1;
        lastDanjikDate[existingDanjik] = dateStr;
        if (dow===6) satDanjikDone.add(existingDanjik);
      }
    }
    // 당직자는 일반 근무 인원에 포함하지 않음 (데스크 포함)
    if (existingDanjik) { blockedIds.push(existingDanjik); _addIv(existingDanjik,'danjik',dateStr); }
    // VW 데스크: WC<5 전용 풀 사용 (sortPool의 WC<4 캡에 막히지 않게)
    const sVW=sortPool(vwPool,dateStr,wk,blockedIds,isHoliOrWE);
    const vwDeskPool=vwPool.filter(p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&(isHoliOrWE||!reservedForWeekend(p.id,wk))&&!(isHoliOrWE&&isProbation(p,dateStr)));
    let vwDeskCand=null;
    // 주말: 예약 1순위 → 백업 2순위 → 우선순위 탐색
    if(isHoliOrWE){
      const plan=weekendDeskPlan[wk]||{};
      vwDeskCand=vwDeskPool.find(p=>p.id===plan.vw)||vwDeskPool.find(p=>p.id===plan.vw2)||null;
    }
    if(!vwDeskCand) vwDeskCand=findDeskByPriority(vwDeskPool,dateStr,blockedIds);
    // 마지막 수단: 전체 풀 (주말 포함, WC 무시)
    if(!vwDeskCand){
      const vwFull=vwPool.filter(p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id));
      vwDeskCand=findDeskByPriority(vwFull,dateStr,blockedIds);
    }
    if(isHoliOrWE && vwDeskCand) weekendDeskCount[vwDeskCand.id]=(weekendDeskCount[vwDeskCand.id]||0)+1;
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
        .filter(p=>p.canVW&&p.dept!=='VW'&&p.active!==false&&!isOnLeave(p.id,dateStr)&&!vwPicked.includes(p.id)&&!blockedIds.includes(p.id)&&!(isHoliOrWE&&isProbation(p,dateStr)))
        .sort((a,b)=>(workDays[a.id]||0)-(workDays[b.id]||0));
      for (const p of crossVW) { if(vwPicked.length>=vwTarget) break; if(isHoliOrWE&&_meets(p.id,'work',dateStr))continue; vwPicked.push(p.id); if(isHoliOrWE)_addIv(p.id,'work',dateStr); }
    }
    // CG pool (주말은 오전데 전담·데스크1 제외)
    const cgPoolFiltered = isHoliOrWE
      ? cgPool.filter(p=>!p.morningDeskPriority && p.deskPriority!==1)
      : cgPool;
    const sCG=sortPool(cgPoolFiltered,dateStr,wk,blockedIds,isHoliOrWE);
    // CG 데스크 배정 (WC<5 전용 풀 사용)
    let cgDesk8=null, cgDesk5=null;
    if (!isHoliOrWE) {
      // 평일: 1순위→8데스, 2순위→5데스 (WC<5 보장)
      const deskCands=[1,2,3,4,5].map(pri=>cgPool.find(p=>p.deskPriority===pri&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!reservedForWeekend(p.id,wk))).filter(Boolean);
      // fallback: WC·연속 무시
      const deskCandsFull=[1,2,3,4,5].map(pri=>cgPool.find(p=>p.deskPriority===pri&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id))).filter(Boolean);
      cgDesk8=(deskCands[0]||deskCandsFull[0])||null;
      cgDesk5=(deskCands[1]||deskCandsFull[1])||null;
    } else {
      // 주말: 2/3순위 WC<5 우선, 없으면 전체 풀
      let wkDeskCands=cgPool.filter(p=>p.deskPriority>=2&&p.deskPriority<=5&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1)&&!isProbation(p,dateStr));
      if(!wkDeskCands.length) wkDeskCands=cgPool.filter(p=>p.deskPriority>=2&&p.deskPriority<=5&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!isProbation(p,dateStr));
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
    // 오전데 배정 (평일만) — cgPicked 초기화 전에 확정하여 workers에 포함 보장
    let morningDeskAssign = _prevSnap[dateStr]?.morningDesk || null;
    if (!isHoliOrWE && !morningDeskAssign) {
      const mdCand = data.staff
        .filter(p=>p.morningDeskPriority&&p.active!==false&&!isOnLeave(p.id,dateStr)&&!(data.draft?.newLeaves?.[dateStr]||[]).includes(p.id)&&!blockedIds.includes(p.id))
        .sort((a,b)=>(a.morningDeskPriority||9)-(b.morningDeskPriority||9));
      if (mdCand.length) morningDeskAssign = mdCand[0].id;
    }
    if (isHoliOrWE) morningDeskAssign = null;
    // XR·Project 먼저 배정 (CG 총계에 포함되므로 CG 목표 계산 전에 확정)
    const projectPicked=isHoliOrWE?[]:projectPool.filter(p=>!isOnLeave(p.id,dateStr)&&getWC(p.id,wk)<5).map(p=>p.id);
    // XR 배정: 평일은 예약 휴식자 제외, 주말은 이번 주 예약 XR을 토·일로 분배
    let xrPicked;
    if(isHoliOrWE){
      const plan=weekendDeskPlan[wk]?.xr||[];
      const avail=plan.filter(id=>!isOnLeave(id,dateStr)&&getWC(id,wk)<5&&!blockedIds.includes(id)&&!weekendBlock.includes(id)&&!_meets(id,'work',dateStr)&&!isProbation(staffById(id),dateStr));
      // 토요일엔 예약 XR 절반, 일요일엔 나머지(토요일 근무자는 weekendBlock으로 자동 제외)
      xrPicked = (dow===6) ? avail.slice(0, Math.ceil(avail.length/2)) : avail;
      xrPicked.forEach(id=>_addIv(id,'work',dateStr));
    } else {
      xrPicked=xrPool.filter(p=>!isOnLeave(p.id,dateStr)&&getWC(p.id,wk)<5&&!blockedIds.includes(p.id)&&!consecBlocked(p.id,_prevDay1)&&!reservedForWeekend(p.id,wk)).map(p=>p.id);
    }
    const sportsPicked=targetSchedule[dateStr]?.sports||[];

    // CG 유효 목표: 당일 최대 인원(평일/토/일 구분)에서 VW·XR·Project를 뺀 나머지
    const dailyCap = _sp?.cap ?? (isHoliOrWE
      ? (dow===6 ? (s.satDailyCap||s.dailyCap||11) : (s.sunDailyCap||s.dailyCap||11))
      : (s.wdDailyCap||s.dailyCap||22));
    const effectiveCgTarget = _sp?.cg ?? (isHoliOrWE
      ? cgTarget
      : Math.max(
          (cgDesk8?1:0)+(cgDesk5?1:0),
          dailyCap - vwPicked.length - xrPicked.length - projectPicked.length
        ));

    // 수동 입력 보존: 스냅샷에 cg.desk8/desk5/workers가 있으면 우선 사용
    const manualCgDesk8 = _prevSnap[dateStr]?.cg?.desk8 || null;
    const manualCgDesk5 = _prevSnap[dateStr]?.cg?.desk5 || null;
    const manualCgWorkers = _prevSnap[dateStr]?.cg?.workers || [];
    if (manualCgDesk8) cgDesk8 = { id: manualCgDesk8 };
    if (manualCgDesk5) cgDesk5 = { id: manualCgDesk5 };
    const cgPicked=[...new Set([cgDesk8?.id, cgDesk5?.id, morningDeskAssign, ...manualCgWorkers].filter(Boolean))];
    if(isHoliOrWE) cgPicked.forEach(id=>_addIv(id,'work',dateStr));
    for (const p of sCG) { if(cgPicked.length>=effectiveCgTarget) break; if(!cgPicked.includes(p.id) && !(isHoliOrWE&&_meets(p.id,'work',dateStr))) { cgPicked.push(p.id); if(isHoliOrWE)_addIv(p.id,'work',dateStr); } }
    // CG 부족 시 canCG 교차 지원 인원 보충
    if (cgPicked.length < effectiveCgTarget) {
      const crossCG = data.staff
        .filter(p=>p.canCG&&p.dept!=='CG'&&p.active!==false&&!isOnLeave(p.id,dateStr)&&!cgPicked.includes(p.id)&&!blockedIds.includes(p.id))
        .sort((a,b)=>(workDays[a.id]||0)-(workDays[b.id]||0));
      for (const p of crossCG) { if(cgPicked.length>=effectiveCgTarget) break; if(isHoliOrWE&&_meets(p.id,'work',dateStr))continue; cgPicked.push(p.id); if(isHoliOrWE)_addIv(p.id,'work',dateStr); }
    }
    // 3D가능 최소 2명 보장 (평일, effectiveCgTarget 범위 내)
    if (!isHoliOrWE) {
      const cur3D = cgPicked.filter(id=>staffById(id)?.can3D);
      if (cur3D.length < 2) {
        const need = 2 - cur3D.length;
        const extra3D = data.staff
          .filter(p=>p.can3D&&p.dept==='CG'&&p.active!==false&&!isOnLeave(p.id,dateStr)&&!cgPicked.includes(p.id)&&!blockedIds.includes(p.id))
          .sort((a,b)=>(workDays[a.id]||0)-(workDays[b.id]||0));
        for (let i=0;i<need&&i<extra3D.length;i++) cgPicked.push(extra3D[i].id);
      }
    }
    // 프리랜서 평일 근무 보장: 목표 인원 미달 시에만 추가 (목표 초과 방지)
    if (!isHoliOrWE) {
      vwPool.filter(p=>p.employmentType==='freelancer'&&!vwPicked.includes(p.id)&&!blockedIds.includes(p.id)&&!isOnLeave(p.id,dateStr)&&isContractActive(p,dateStr)&&getWC(p.id,wk)<5&&(weekdayCount[p.id]||0)<(freelancerWeekdayTarget[p.id]??weekdaysInMonth)).forEach(p=>{if(vwPicked.length<vwTarget)vwPicked.push(p.id);});
      cgPool.filter(p=>p.employmentType==='freelancer'&&!cgPicked.includes(p.id)&&!blockedIds.includes(p.id)&&!isOnLeave(p.id,dateStr)&&isContractActive(p,dateStr)&&getWC(p.id,wk)<5&&(weekdayCount[p.id]||0)<(freelancerWeekdayTarget[p.id]??weekdaysInMonth)).forEach(p=>{if(cgPicked.length<effectiveCgTarget)cgPicked.push(p.id);});
    }
    const prevDateStr=addDays(dateStr,-1);
    const countedSet=new Set();
    const countWork=(id)=>{
      if(countedSet.has(id)) return; countedSet.add(id);
      workDays[id]=(workDays[id]||0)+1;
      addWC(id,wk);
      monthCount[id]=(monthCount[id]||0)+1;
      if (!isHoliOrWE) weekdayCount[id]=(weekdayCount[id]||0)+1;
      if (isHoliOrWE) holidayWorkCount[id]=(holidayWorkCount[id]||0)+1;
      // 연속 근무일 업데이트
      consecutiveDays[id]=lastWorkDate[id]===prevDateStr?(consecutiveDays[id]||0)+1:1;
      lastWorkDate[id]=dateStr;
    };
    [...vwPicked,...cgPicked,...projectPicked,...sportsPicked,...xrPicked].forEach(countWork);
    if (isHoliOrWE) xrPicked.forEach(id=>{ xrWeekendCount[id]=(xrWeekendCount[id]||0)+1; });
    if (danjikExitId) addWC(danjikExitId, wk);
    // 주말 중복 방지: 이번 주 토/일 근무자 기록 (공휴일 포함)
    if (dow===6||dow===0) {
      if (!weekendWorked[wk]) weekendWorked[wk] = new Set();
      [...vwPicked,...cgPicked,...xrPicked].forEach(id => weekendWorked[wk].add(id));
      if (existingDanjik) weekendWorked[wk].add(existingDanjik);
    }
    // 조근 자동배정 - 각 조근직원별 처리
    const jogeunSubs={};
    if (!isWeekend && jogeunPool.length > 0) {
      jogeunPool.forEach(jp => {
        if (isOnLeave(jp.id, dateStr)) {
          // 신휴가/휴가 → 프리랜서 공평 배분
          const alreadySub = new Set(Object.values(jogeunSubs));
          const subCand = freelancerPool
            .filter(p => !isOnLeave(p.id, dateStr) && isContractActive(p, dateStr) && !alreadySub.has(p.id))
            .sort((a,b)=>(morningSubCount[a.id]||0)-(morningSubCount[b.id]||0));
          if (subCand.length) {
            const _sc = subCand.find(p=>!_meets(p.id,'jogeun',dateStr)) || subCand[0];
            jogeunSubs[jp.id] = _sc.id;
            morningSubCount[_sc.id]=(morningSubCount[_sc.id]||0)+1;
            jogeunSubCount[_sc.id]=(jogeunSubCount[_sc.id]||0)+1;   // #2
            _addIv(_sc.id,'jogeun',dateStr);
          }
        }
      });
    }
    // 토요일 조근 배정 (canSatMorning 직원 1명, 공평 순환)
    let satMorningAssign = _prevSnap[dateStr]?.satMorning || null;
    if (dow===6 && !satMorningAssign) {
      // 일근 예약자(1순위·백업)는 조근에서도 제외 → 일요일 일근 보존
      const plan=weekendDeskPlan[wk]||{};
      const ilgeunHoldIds=[plan.ilgeun,plan.ilgeun2].filter(Boolean);
      // 주5일 준수: WC<5(평일 하루 쉰 사람) + 연속 제약
      let satCand = data.staff.filter(p=>p.canSatMorning&&p.active!==false&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_meets(p.id,'jogeun',dateStr)&&!ilgeunHoldIds.includes(p.id)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1));
      if(!satCand.length) satCand = data.staff.filter(p=>p.canSatMorning&&p.active!==false&&!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5);
      const satSorted = shuffleSort(satCand, p=>morningSubCount[p.id]||0);
      if (satSorted.length) { satMorningAssign=satSorted[0].id; morningSubCount[satSorted[0].id]=(morningSubCount[satSorted[0].id]||0)+1; }
    }
    if (dow!==6) satMorningAssign=null;
    // 토요일 조근 배정자도 주말 근무자로 기록 + 근무 카운트
    if (dow===6 && satMorningAssign) {
      if (!weekendWorked[wk]) weekendWorked[wk] = new Set();
      weekendWorked[wk].add(satMorningAssign);
      countWork(satMorningAssign); _addIv(satMorningAssign,'jogeun',dateStr);
    }
    // morningDeskAssign은 위 cgPicked 초기화 전에 이미 배정됨
    // 일근 배정 (일요일, 직원만, 공평 순환)
    let ilgeunAssign = _prevSnap[dateStr]?.ilgeun || null;
    if (dow === 0 && ilgeunPool.length > 0) {
      // 주5일 준수: WC<5(평일 하루 쉰 사람) + 연속 제약
      let ilgeunCand = ilgeunPool.filter(p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_meets(p.id,'ilgeun',dateStr)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1));
      if(!ilgeunCand.length) ilgeunCand = ilgeunPool.filter(p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5);
      const ilgeunSorted = shuffleSort(ilgeunCand, p=>ilgeunCount[p.id]||0);
      // 이번 주 예약된 일근 담당 우선
      const planIlgeun=weekendDeskPlan[wk]?.ilgeun;
      const preferred=ilgeunCand.find(p=>p.id===planIlgeun);
      if (preferred || ilgeunSorted.length) {
        ilgeunAssign=(preferred||ilgeunSorted[0]).id;
        ilgeunCount[ilgeunAssign]=(ilgeunCount[ilgeunAssign]||0)+1;
        if (!weekendWorked[wk]) weekendWorked[wk] = new Set();
        weekendWorked[wk].add(ilgeunAssign);
        countWork(ilgeunAssign); _addIv(ilgeunAssign,'ilgeun',dateStr);
      }
    }
    // 주5일 보장은 주간 WC 상한(월~일 5일)으로 처리 — 평일에 하루 쉰 사람만 그 주 주말 근무 가능.
    // (과거의 "다음 주 대휴" 방식은 주6일을 유발해 제거함)
    // 평일 8진 배정 (평일, canWeekday8jin 직원, 공평 순환, 주 1회 제한)
    let weekday8jinAssign = _prevSnap[dateStr]?.weekday8jin || null;
    if (!weekday8jinAssign && !isHoliOrWE && weekday8jinPool.length > 0) {
      if (!weekday8jinWeekDone[wk]) weekday8jinWeekDone[wk] = new Set();
      const weekDone = weekday8jinWeekDone[wk];
      // 이번 주 미배정자 우선, 없으면 전체 허용
      let cand = weekday8jinPool.filter(p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!weekDone.has(p.id));
      if (!cand.length) cand = weekday8jinPool.filter(p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id));
      const sorted = shuffleSort(cand, p=>weekday8jinCount[p.id]||0);
      if (sorted.length) {
        weekday8jinAssign = sorted[0].id;
        weekday8jinCount[sorted[0].id]++;
        weekDone.add(sorted[0].id);
      }
    }
    // 뉴.오 배정 (평일, canNewsOh 프리랜서, 공평 순환)
    let newsOhAssign = _prevSnap[dateStr]?.newsOh || null;
    const _ns2 = _prevSnap[dateStr]?.newsOh2 || null;   // 수동 입력한 뉴.오2(교육)는 자동 뉴.오 후보에서 제외
    if (!newsOhAssign && !isHoliOrWE && newsOhPool.length > 0) {
      const cand = newsOhPool.filter(p=>!isOnLeave(p.id,dateStr) && p.id!==_ns2);
      const sorted = shuffleSort(cand, p=>(newsOhCount[p.id]||0)+(jogeunSubCount[p.id]||0));   // #2: 평일 조근 대체자는 뉴.오 후순위
      if (sorted.length) { newsOhAssign=sorted[0].id; newsOhCount[sorted[0].id]++; }
    }
    // 주말 8진 배정 (토·일, canWeekend8jin 프리랜서, 공평 순환) — 주5일 준수(WC<5)
    let weekend8jinAssign = _prevSnap[dateStr]?.weekend8jin || null;
    if (!weekend8jinAssign && isWeekend && !isHoliday && weekend8jinPool.length > 0) {
      let cand = weekend8jinPool.filter(p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&!_meets(p.id,'work',dateStr)&&getWC(p.id,wk)<5&&!consecBlocked(p.id,_prevDay1));
      if(!cand.length) cand = weekend8jinPool.filter(p=>!isOnLeave(p.id,dateStr)&&!blockedIds.includes(p.id)&&getWC(p.id,wk)<5);
      const sorted = shuffleSort(cand, p=>weekend8jinCount[p.id]||0);
      if (sorted.length) {
        weekend8jinAssign=sorted[0].id; weekend8jinCount[sorted[0].id]++;
        if (!weekendWorked[wk]) weekendWorked[wk] = new Set();
        weekendWorked[wk].add(weekend8jinAssign);
        countWork(weekend8jinAssign); _addIv(weekend8jinAssign,'work',dateStr);
      }
    }
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
  for (const ds of genDateStrs) {
    const entry=targetSchedule[ds];
    const d=new Date(ds+'T00:00:00');
    const dow=d.getDay();
    const isWeekend=dow===0||dow===6;
    const isHoliday=!!(data.holidays&&data.holidays[ds]);
    if(!entry){ issues.push({date:ds,what:'전체'}); continue; }
    if(!entry.vw?.desk) issues.push({date:ds,what:'VW데스'});
    if(!(entry.cg?.desk8||entry.cg?.desk)) issues.push({date:ds,what:'CG데스'});
    if(!isWeekend&&!isHoliday){
      if(!entry.cg?.desk5) issues.push({date:ds,what:'CG5데스'});
      if(!entry.morningDesk) issues.push({date:ds,what:'오전데'});
    }
    // 일요일 일근 누락 점검 (canIlgeun 직원이 있을 때만)
    if(dow===0&&!isHoliday&&ilgeunHasPool&&!entry.ilgeun&&phase!=='danjik') issues.push({date:ds,what:'일근'});
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
// 백그라운드 자동 재생성: 데스크 누락 없을 때까지 반복 (최대 시도 후 최선안 채택)
function _generateWithRetry(startVal, endVal, targetSchedule, resultElId, onDone, opts){
  opts = opts || {};
  const MAX_ATTEMPTS=50;
  let attempt=0, bestSnap=null, bestIssues=null, bestCount=Infinity, lastDateStrs=null, lastTotal=0;
  showResult(resultElId,'⏳ 근무표 계산 중...',true);
  function step(){
    attempt++;
    const res=_generateScheduleCore(startVal,endVal,targetSchedule,resultElId,{silent:true, phase:opts.phase});
    if(!res){ if(onDone)onDone(false); return; } // 하드 에러(직원부족 등) — 이미 메시지 표시됨
    lastDateStrs=res.genDateStrs; lastTotal=res.totalDays;
    const issues=_validateScheduleRange(targetSchedule,res.genDateStrs, opts.phase);
    if(issues.length<bestCount){
      bestCount=issues.length;
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
      toast('일부 데스크를 채우지 못했습니다. 직원 설정을 확인하세요.','error');
      if(onDone)onDone(false);
    }
  }
  setTimeout(step,0);
}
function showResult(id,msg,ok) {
  const el=document.getElementById(id);
  el.style.display='block'; el.className='gen-result '+(ok?'success':'error'); el.textContent=msg;
}

