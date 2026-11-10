/* [모듈] js/workshop.js — 근무표 작성소(표·이름열 드래그·브러시·셀 타이핑) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 근무표 작성소 =====
function renderWorkshop() {
  if (!isAdmin) return;
  _wsEnter();   // 공용 네트워크 드라이브에서 초안 받기(처음이면 서버 초안 옮김) — 파일 끝
  if (!_wsGate()) return;   // PC 앱(1.4.2~)·회사 네트워크가 아니면 안내만
  _updateUndoBtn();
  // 날짜 범위 초기화 (기본: 다음 달)
  if (!wsRangeStart || !wsRangeEnd) {
    const now=new Date();
    const y=now.getMonth()===11?now.getFullYear()+1:now.getFullYear();
    const m=now.getMonth()===11?1:now.getMonth()+2;
    wsRangeStart=toDateStr(y,m,1);
    wsRangeEnd=toDateStr(y,m,new Date(y,m,0).getDate());
    // draft에 저장된 범위가 있으면 사용
    if (data.draft.rangeStart) { wsRangeStart=data.draft.rangeStart; wsRangeEnd=data.draft.rangeEnd; }
  }
  updateSettingsSummary();
  renderDeployLog();
  const wsEl=document.getElementById('ws-start');
  const weEl=document.getElementById('ws-end');
  if (wsEl) wsEl.value=wsRangeStart;
  if (weEl) weEl.value=wsRangeEnd;
  const sd=new Date(wsRangeStart+'T00:00:00'), ed=new Date(wsRangeEnd+'T00:00:00');
  const isSameMonth=sd.getFullYear()===ed.getFullYear()&&sd.getMonth()===ed.getMonth();
  document.getElementById('ws-title').textContent = isSameMonth
    ? `근무표 작성소 — ${sd.getFullYear()}년 ${sd.getMonth()+1}월 초안`
    : `근무표 작성소 — ${sd.getMonth()+1}월 ${sd.getDate()}일 ~ ${ed.getMonth()+1}월 ${ed.getDate()}일 초안`;
  renderWorkshopTable();
}

function applyWsRange() {
  const s=document.getElementById('ws-start').value;
  const e=document.getElementById('ws-end').value;
  if(!s||!e){toast('날짜를 입력하세요.','error');return;}
  wsRangeStart=s; wsRangeEnd=e;
  data.draft.rangeStart=s; data.draft.rangeEnd=e;
  saveData(data);
  renderWorkshop();
}

function setWsNextMonth() {
  const now=new Date();
  const y=now.getMonth()===11?now.getFullYear()+1:now.getFullYear();
  const m=now.getMonth()===11?1:now.getMonth()+2;
  wsRangeStart=toDateStr(y,m,1);
  wsRangeEnd=toDateStr(y,m,new Date(y,m,0).getDate());
  document.getElementById('ws-start').value=wsRangeStart;
  document.getElementById('ws-end').value=wsRangeEnd;
  renderWorkshop();
}
// 좌우 화살표 페이징: 4주(28일) 단위로 이동, 월요일 정렬(월~일 4주 세트)
function wsRangeNav(dir) {
  if (!isAdmin) return;
  let base = wsRangeStart ? new Date(wsRangeStart+'T00:00:00') : new Date();
  const day = base.getDay();                 // 0=일 .. 6=토
  base.setDate(base.getDate() + (day===0 ? -6 : 1-day));   // 그 주 월요일로 정렬
  base.setDate(base.getDate() + dir*28);     // 4주 이동
  const end = new Date(base); end.setDate(end.getDate()+27); // 4주(월~4주차 일요일)
  wsRangeStart = toDateStr(base.getFullYear(), base.getMonth()+1, base.getDate());
  wsRangeEnd   = toDateStr(end.getFullYear(),  end.getMonth()+1,  end.getDate());
  data.draft.rangeStart = wsRangeStart; data.draft.rangeEnd = wsRangeEnd;
  saveData(data);
  renderWorkshop();
}

// ===== 관리자: 작성소 이름열 롱프레스 드래그 재정렬 =====
// data.staff 배열 순서를 바꿔 같은 부서 내 컬럼 순서 변경(작성소·근무표 양쪽 반영). 드롭은 같은 부서(data-grp)끼리만.
function _reorderStaffCol(dragSid, targetSid, before){
  if(!dragSid||!targetSid||dragSid===targetSid) return;
  const arr=data.staff;
  const di=arr.findIndex(s=>s.id===dragSid); if(di<0) return;
  const moved=arr.splice(di,1)[0];
  let ti=arr.findIndex(s=>s.id===targetSid);
  if(ti<0){ arr.splice(di,0,moved); return; }      // 타깃 사라짐 → 원복
  arr.splice(before?ti:ti+1, 0, moved);
  saveData(data);
  renderWorkshopTable();
  const vt=document.getElementById('view-table'); if(vt&&vt.classList.contains('active')&&typeof renderTable==='function') renderTable();
  if(typeof toast==='function') toast('순서 변경됨','success');
}
function _wsColDragSetup(){
  const thead=document.getElementById('ws-thead');
  if(!thead||thead._colDragBound) return;
  thead._colDragBound=true;
  thead.addEventListener('pointerdown', function(e){
    if(!isAdmin) return;
    const th=e.target.closest('th.name-th[data-sid]'); if(!th) return;
    const sid=th.getAttribute('data-sid'), grp=th.getAttribute('data-grp');
    const startX=e.clientX, startY=e.clientY, pid=e.pointerId;
    let dragging=false, ghost=null, indicator=null, curTarget=null, curBefore=true;
    const longTimer=setTimeout(startDrag, 300);
    function startDrag(){
      dragging=true;
      try{ th.setPointerCapture(pid); }catch(_){}
      document.body.classList.add('ws-coldragging');
      th.classList.add('col-dragsrc');
      ghost=document.createElement('div'); ghost.className='ws-col-ghost'; ghost.textContent=th.textContent;
      document.body.appendChild(ghost);
      indicator=document.createElement('div'); indicator.className='ws-col-indicator';
      document.body.appendChild(indicator);
      moveGhost(startX,startY);
      if(navigator.vibrate){ try{ navigator.vibrate(15); }catch(_){} }
    }
    function moveGhost(x,y){ if(ghost){ ghost.style.left=x+'px'; ghost.style.top=y+'px'; } }
    function onMove(ev){
      if(!dragging){
        if(Math.abs(ev.clientX-startX)>10||Math.abs(ev.clientY-startY)>10){ clearTimeout(longTimer); cleanup(); }
        return;
      }
      ev.preventDefault();
      moveGhost(ev.clientX,ev.clientY);
      const els=thead.querySelectorAll('th.name-th[data-grp="'+grp+'"]');
      let best=null,bestD=1e9,before=true;
      els.forEach(el=>{ const r=el.getBoundingClientRect(); const mid=r.left+r.width/2; const d=Math.abs(ev.clientX-mid); if(d<bestD){ bestD=d; best=el; before=ev.clientX<mid; } });
      curTarget=best; curBefore=before;
      if(best){ const r=best.getBoundingClientRect(); indicator.style.display='block'; indicator.style.left=(before?r.left:r.right)+'px'; indicator.style.top=r.top+'px'; indicator.style.height=r.height+'px'; }
      else if(indicator){ indicator.style.display='none'; }
    }
    function onUp(){
      clearTimeout(longTimer);
      const t=curTarget, b=curBefore, wasDragging=dragging;
      cleanup();
      if(wasDragging && t){ const tsid=t.getAttribute('data-sid'); if(tsid&&tsid!==sid) _reorderStaffCol(sid, tsid, b); }
    }
    function cleanup(){
      document.removeEventListener('pointermove',onMove,true);
      document.removeEventListener('pointerup',onUp,true);
      document.removeEventListener('pointercancel',onUp,true);
      document.body.classList.remove('ws-coldragging');
      th.classList.remove('col-dragsrc');
      if(ghost){ ghost.remove(); ghost=null; }
      if(indicator){ indicator.remove(); indicator=null; }
      dragging=false;
    }
    document.addEventListener('pointermove',onMove,true);
    document.addEventListener('pointerup',onUp,true);
    document.addEventListener('pointercancel',onUp,true);
  });
}
function renderWorkshopTable() {
  try{ _wsTabsRender(); }catch(e){}   // 초안 탭 줄(파일 끝)
  if (!_wsGate()) return;   // 작성소는 PC 앱 + 공용 네트워크 드라이브에서만(11-09)
  if (!wsRangeStart||!wsRangeEnd) return;
  const _sched = data.draft.schedule;
  const _newLvs = data.draft.newLeaves;
  const now=new Date();
  const todayStr=toDateStr(now.getFullYear(),now.getMonth()+1,now.getDate());
  const dates=[];
  const cur=new Date(wsRangeStart+'T00:00:00'), endD=new Date(wsRangeEnd+'T00:00:00');
  while(cur<=endD){dates.push(new Date(cur));cur.setDate(cur.getDate()+1);}

  function empFirst(arr){return [...arr].sort((a,b)=>(a.employmentType==='freelancer'?1:0)-(b.employmentType==='freelancer'?1:0));}
  const _gs = dept => empFirst(getStaff(dept, wsRangeStart).filter(s=>_freelancerActiveInRange(s,dates)));
  const vwStaff=_gs('VW'),cgStaff=_gs('CG');
  const projectStaff=_gs('PROJECT'),sportsStaff=_gs('SPORTS');
  const xrStaff=_gs('XR'),jogeunStaff=_gs('조근');
  const vwCols=vwStaff.map(s=>({...s,_dept:'vw'}));
  const jogeunCols=jogeunStaff.map(s=>({...s,_dept:'jogeun'}));
  const cgCols=[...cgXrCols(cgStaff,xrStaff),...projectStaff.map(s=>({...s,_dept:'project'})),...sportsStaff.map(s=>({...s,_dept:'sports'}))];
  const allCols=[...vwCols,...jogeunCols,...cgCols];

  let weekdaysInMonth=0;
  dates.forEach(dt=>{const ds=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());if(isWeekdayForm(ds))weekdaysInMonth++;});   // 평일 틀인 날(평일 편성 공휴일 포함)
  const workCount={};allCols.forEach(s=>{workCount[s.id]=0;});

  // colgroup
  let cg='<col style="width:46px"><col style="width:36px">';
  vwCols.forEach(()=>{cg+='<col>';});
  jogeunCols.forEach(()=>{cg+='<col>';});
  cg+='<col style="width:32px">'; // VW합
  cgCols.forEach(()=>{cg+='<col>';});
  cg+='<col style="width:32px"><col style="width:40px"><col style="width:90px"><col id="ws-bigo-col">';   // CG합·당일·확인·비고(비고는 내용맞춤 동적폭)
  document.getElementById('ws-colgroup').innerHTML=cg;

  // thead
  const deptColors={vw:'var(--vw-light)',cg:'var(--cg-light)',project:'var(--project-light)',sports:'var(--sports-light)',xr:'var(--project-light)'};   // XR 이름 = PROJECT 이름 색(11-09 사용자)
  let thead='<tr class="dept-row"><th class="date-th" rowspan="2">날짜</th><th class="dow-th" rowspan="2">요일</th>';
  if(vwCols.length)thead+=`<th class="dept-group vw" colspan="${vwCols.length}">VW (${vwCols.length}명)</th>`;
  if(jogeunCols.length)thead+=`<th class="dept-group" colspan="${jogeunCols.length}" style="background:var(--th-jogeun-bg);color:var(--th-jogeun-fg);border-color:var(--th-jogeun-bd);">조근 (${jogeunCols.length}명)</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;">VW</th>`;
  const cgxrN=cgStaff.length+xrStaff.length;   // XR은 CG 원래 자리에(이름만 XR 색, 11-04 — js/core.js cgXrCols)
  if(cgxrN)thead+=`<th class="dept-group cg" colspan="${cgxrN}">CG (${cgxrN}명)</th>`;
  if(projectStaff.length)thead+=`<th class="dept-group project" colspan="${projectStaff.length}">PROJECT</th>`;
  if(sportsStaff.length)thead+=`<th class="dept-group sports" colspan="${sportsStaff.length}">SPORTS</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;background:var(--th-cgsum-bg);color:var(--th-cgsum-fg);">CG</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;background:var(--th-daysum-bg);color:var(--th-daysum-fg);">당일</th>`;
  thead+=`<th rowspan="2" class="sum-col check-sticky" style="font-size:10px;background:#fff0f0;color:#c06b66;min-width:80px;">확인</th>`;
  thead+=`<th rowspan="2" style="font-size:10px;background:#f8f4ff;color:#7c3aed;min-width:160px;white-space:nowrap;">비고</th></tr><tr>`;
  const _grpMap={cg:'CG',xr:'CG',project:'PROJECT',sports:'SPORTS'};   // XR도 CG 묶음 안에서 끌어 옮김
  let nameFoot='';   // 표 맨 아래 이름 줄(근무표 renderTable 과 같음) — 열 순서는 합계 줄과 같음
  vwCols.forEach(s=>{thead+=`<th class="name-th" data-sid="${s.id}" data-grp="VW" style="color:${deptColors.vw};">${s.name}</th>`;nameFoot+=`<td style="color:${deptColors.vw};">${s.name}</td>`;});
  jogeunCols.forEach(s=>{thead+=`<th class="name-th" data-sid="${s.id}" data-grp="조근" style="background:var(--th-jogeun-bg);color:var(--th-jogeun-fg);">${s.name}</th>`;nameFoot+=`<td style="background:var(--th-jogeun-bg);color:var(--th-jogeun-fg);">${s.name}</td>`;});
  nameFoot+='<td></td>';   // VW합
  cgCols.forEach((s,_ci)=>{const bg=s._dept==='xr'?'background:var(--th-xr-namebg);':'';const _gc=s._dept==='project'?'#686dc8':s._dept==='sports'?'#8a6ecf':null;let _gb='';if(_gc){if(_ci===0||cgCols[_ci-1]._dept!==s._dept)_gb+=`border-left:1px solid ${_gc}55;`;if(_ci===cgCols.length-1||cgCols[_ci+1]._dept!==s._dept)_gb+=`border-right:1px solid ${_gc}55;`;}thead+=`<th class="name-th" data-sid="${s.id}" data-grp="${_grpMap[s._dept]||'CG'}" style="${bg}color:${deptColors[s._dept]||'var(--text)'};${_gb}">${s.name}</th>`;nameFoot+=`<td style="${bg}color:${deptColors[s._dept]||'var(--text)'};${_gb}">${s.name}</td>`;});
  thead+='</tr>';
  document.getElementById('ws-thead').innerHTML=thead;
  try{ _wsColDragSetup(); }catch(e){}   // 관리자: 이름열 롱프레스 드래그 재정렬

  // tbody
  let tbody='';
  for(const date of dates){
    const dow=date.getDay();
    const dateStr=toDateStr(date.getFullYear(),date.getMonth()+1,date.getDate());
    const isToday=dateStr===todayStr,isWeekend=dow===0||dow===6;
    const isHoliday=!!(data.holidays&&data.holidays[dateStr]);
    const holidayName=isHoliday?data.holidays[dateStr]:'';
    const dowClass=dow===0?'sun':dow===6?'sat':'';
    const entry=_sched[dateStr];
    const danjikExitId=entry?.importedCells?getDanjikExitStaff(dateStr,_sched):(_sched[addDays(dateStr,-1)]?.danjik||null);
    const danjikOffId=entry?.importedCells?getDanjikOffStaff(dateStr,_sched):(_sched[addDays(dateStr,-2)]?.danjik||null);
    const danjikId=entry?.danjik||null;
    const ilgeunId=entry?.ilgeun||null;
    const _cgExclude=new Set([entry?.danjik,danjikExitId].filter(Boolean));
    const jogeunIds=new Set(jogeunCols.map(s=>s.id));
    const jogeunSubReverse={};Object.entries(entry?.jogeunSubs||{}).forEach(([jId,sId])=>{jogeunSubReverse[sId]=jId;});
    const _ilgeunDept=(entry?.ilgeun?(deptOn(staffById(entry.ilgeun),dateStr)||'').toUpperCase():'');
    const _ilgeunIsVW=_ilgeunDept==='VW';
    // vw.workers에 있는 사람 → VW총계, cg/xr/project에 있는 사람 → CG총계 (중복 방지)
    const _cgWorkersSet=new Set(entry?.cg?.workers||[]);
    const _leaveSet=new Set(_newLvs?.[dateStr]||[]);
    const _specialExclude=new Set([entry?.satMorning,entry?.morningDesk].filter(Boolean));
    const _excl=id=>{const _p=staffById(id);return _isVw2(entry,id)||_cgExclude.has(id)||jogeunIds.has(id)||_specialExclude.has(id)||_leaveSet.has(id)||(_p&&!isContractActive(_p,dateStr));};
    const _vwSet=new Set((entry?.vw?.workers||[]).filter(id=>!_excl(id)&&!(_cgWorkersSet.has(id)&&(deptOn(staffById(id),dateStr)||'').toLowerCase()==='vw')));
    const _8jinIds=[entry?.weekend8jin,entry?.weekday8jin,entry?.weekend8jin2,entry?.weekday8jin2].filter(id=>id&&!_specialExclude.has(id)&&!_leaveSet.has(id));
    const _8jinVwAdd=_8jinIds.filter(id=>!_vwSet.has(id)&&!_cgWorkersSet.has(id)&&(deptOn(staffById(id),dateStr)||'').toLowerCase()==='vw').length;
    const _8jinCgAdd=_8jinIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(deptOn(staffById(id),dateStr)||'').toLowerCase();return d==='cg'||d==='xr';}).length;
    // 뉴.오/뉴.오2도 부서별로 일일 총계에 포함 (CG부서→CG총계, VW부서→VW총계). 이미 workers에 있으면 중복 제외
    const _newsOhIds=[entry?.newsOh,entry?.newsOh2].filter(id=>id&&!_specialExclude.has(id)&&!_leaveSet.has(id));
    const _newsOhVwAdd=_newsOhIds.filter(id=>!_vwSet.has(id)&&!_cgWorkersSet.has(id)&&(deptOn(staffById(id),dateStr)||'').toLowerCase()==='vw').length;
    const _newsOhCgAdd=_newsOhIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(deptOn(staffById(id),dateStr)||'').toLowerCase();return d==='cg'||d==='xr';}).length;
    const _ilgeunOk=entry?.ilgeun&&!_leaveSet.has(entry.ilgeun)&&!_specialExclude.has(entry?.ilgeun)&&!(isHoliday&&!isWeekend&&isWeekdayForm(dateStr));   // 평일 틀 공휴일 일근은 인원 밖(엑셀 10월 최종 10/5·10/9 합계 수식에 일근 없음, 생성기 인원도 같은 기준)
    // 토·일·공휴일에 PJ가 근무 칸에 있으면(정근으로 일반 근무) CG 인원 — 엑셀 합계 수식이 그날만 PJ 열까지 정근을 셈(10/5·10/9·10/17). 평일 PJ는 프로젝트 근무라 인원 밖
    const _pjAdd=(isWeekend||isHoliday)?(entry?.project||[]).filter(id=>!_excl(id)&&!_vwSet.has(id)&&!_cgWorkersSet.has(id)).length:0;
    const vwCnt=_vwSet.size+(_ilgeunIsVW&&!_cgWorkersSet.has(entry?.ilgeun)&&_ilgeunOk?1:0)+_8jinVwAdd+_newsOhVwAdd;
    const cgCnt=(entry?.cg?.workers||[]).filter(id=>!_excl(id)&&!_vwSet.has(id)).length+(entry?.xr||[]).filter(id=>!_excl(id)).length+(!_ilgeunIsVW&&_ilgeunOk&&!_vwSet.has(entry.ilgeun)?1:0)+_8jinCgAdd+_newsOhCgAdd+_pjAdd;
    const dailyCnt=vwCnt+cgCnt;
    const dm=date.getMonth()+1,dd=date.getDate();
    // 이날 부족한 것(확인 칸과 같은 목록) — 행을 옅게 물들이고 날짜 칸을 빨갛게 강조
    const _miss=(()=>{ const missing=[];
      if(!entry?.vw?.desk) missing.push('VW데스');
      if(!(entry?.cg?.desk8||entry?.cg?.desk)) missing.push('CG데스');
      if(entry?.cg?.desk8&&entry.cg.desk8===entry.cg.desk5) missing.push('데스 겹침');
      if(entry?.morningDesk&&[entry.cg?.desk8,entry.cg?.desk5,entry.vw?.desk].includes(entry.morningDesk)) missing.push('오전데 겹침');
      // 인원: 평일 틀은 VW 목표·하루 합계 하한(20, 상한이 더 작으면 상한), 주말 틀은 VW·CG 목표 — 특정일 인원 설정이 있으면 그 값
      { const _st=data.settings||{}, _sd=(_st.specialDays||{})[dateStr]||{}, _wd=isWeekdayForm(dateStr);
        const _vt=_sd.vw ?? (_wd?(_st.weekdayVW||7):(dow!==0?(_st.satVW||_st.weekendVW||4):(_st.sunVW||_st.weekendVW||4)));
        if(entry&&vwCnt<_vt) missing.push('VW '+vwCnt+'/'+_vt);
        if(entry&&_wd&&_sd.cg==null){ const _cap=_sd.cap ?? (_st.wdDailyCap||_st.dailyCap||22), _fl=Math.min(20,_cap); if(dailyCnt<_fl) missing.push('인원 '+dailyCnt+'/'+_fl); }
        if(entry&&!_wd){ const _ct=_sd.cg ?? (dow!==0?(_st.satCG||6):(_st.sunCG||7)); if(cgCnt<_ct) missing.push('CG '+cgCnt+'/'+_ct); }
      }
      if(isWeekdayForm(dateStr)){   // 평일 틀(8뉴스 평일 편성 공휴일 포함)
        if(!entry?.cg?.desk5) missing.push('5데스');   // 8뉴스 2번 데스크
        if(!isHoliday&&!entry?.morningDesk) missing.push('오전데');
        if(!entry?.danjik) missing.push('당직');
        if(!entry?.weekday8jin) missing.push('8진');
        if(!isHoliday&&!entry?.newsOh) missing.push('오.뉴');   // 공휴일엔 뉴.오 없음
        if(isHoliday&&!entry?.ilgeun) missing.push('일근');   // 평일 편성 공휴일 = 평일 틀 + 일근
        // 평일 조근 인원 체크: 실제 조근 커버 인원이 풀 인원보다 적으면 경고
        const jogeunPoolForCheck = getStaff('조근', dateStr);
        if (jogeunPoolForCheck.length > 0) {
          const jogeunSubsForDay = entry?.jogeunSubs || {};
          let jogeunCovered = 0;
          jogeunPoolForCheck.forEach(jp => {
            const onLv = (_newLvs?.[dateStr]||[]).includes(jp.id);
            const subId = jogeunSubsForDay[jp.id];
            const subValid = subId && !(_newLvs?.[dateStr]||[]).includes(subId);
            if (!onLv || subValid) jogeunCovered++;
          });
          // jogeunExtra(브러시로 추가한 조근 인원)로 부족분 보충
          const _extraJogeun = (entry?.jogeunExtra||[]).filter(id=>!(_newLvs?.[dateStr]||[]).includes(id));
          jogeunCovered = Math.min(jogeunPoolForCheck.length, jogeunCovered + _extraJogeun.length);
          if (jogeunCovered < jogeunPoolForCheck.length) {
            missing.push(`조근${jogeunCovered}/${jogeunPoolForCheck.length}`);
          }
        }
      } else {
        if(!entry?.danjik) missing.push('당직');
        if(!entry?.weekend8jin) missing.push('8진');   // 주말·주말 편성 공휴일
        if(dow===6&&!entry?.satMorning) missing.push('조근');
        if((dow===0||(isHoliday&&!isWeekend))&&!entry?.ilgeun) missing.push('일근');
      }
      return missing; })();
    const _missHi=_miss.length>0 && !!entry && !!((entry.vw?.workers||[]).length||(entry.cg?.workers||[]).length);   // 아직 안 짠 빈 날은 강조 안 함
    tbody+=`<tr class="${isWeekend||isHoliday?'weekend':''} ${isHoliday?'holiday':''} ${isToday?'today-row':''} ${_missHi?'ws-miss':''}">`;
    const shortHoliWs=holidayName.length>4?holidayName.slice(0,4)+'…':holidayName;
    const _isSp = !!(data.settings.specialDays||{})[dateStr];
    tbody+=`<td class="date-td${_missHi?' ws-miss-date':''}" onclick="openDaySpecial('${dateStr}', event)" style="cursor:pointer;${_isSp?'box-shadow:inset 3px 0 0 #f0a500;':''}" title="${_miss.length?'부족: '+_miss.join(', ')+' — ':''}${_isSp?'특정일 인원 지정됨 — 클릭하여 수정':'클릭: 적정 인원/상세 편집'}">${dm}/${dd}${_isSp?'<span style="color:#f0a500;">📌</span>':''}${isHoliday?`<br><span style="font-size:8px;color:#a8657f;white-space:nowrap;">${shortHoliWs}</span>`:''}</td>`;
    tbody+=`<td class="dow-td ${dowClass}">${DOW_KR[dow]}</td>`;

    // VW cells
    vwCols.forEach(s=>{
      let bg='',color='',fw='500',text='',extraStyle='';
      const imported=_importCellDisplay(entry,s.id,_newLvs?.[dateStr]);
      if(imported){
        if(imported.count)workCount[s.id]++;
        const style=`background:${imported.bg};color:${imported.color};font-weight:${imported.fw};`;
        tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="${style}">${_importCellHTML(imported.text)||'<span class="cell-off">-</span>'}</td>`;
        return;
      }
      const _custom=entry?.customCells?.[s.id];
      if(_custom?.text){
        {const _ls=_learnStyle(entry,s.id);bg=_ls?_ls.bg:(_custom.bg||'');color=_ls?_ls.color:(_custom.color||'var(--text)');}fw='700';text=_custom.text;workCount[s.id]++;
        const st=bg?`background:${bg};color:${color};font-weight:${fw};`:`color:${color};font-weight:${fw};`;
        tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="cursor:pointer;${st}">${text}</td>`;
        return;
      }
      const hasNL=(_newLvs?.[dateStr]||[]).includes(s.id);
      const contractOut=!isContractActive(s,dateStr);
      const dispatched=isDispatched(s,dateStr);
      if(contractOut){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(dispatched){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(s.id===danjikExitId){bg='var(--r-exit-bg)';color='var(--r-exit-fg)';fw='700';text='퇴근';workCount[s.id]++;}
      else if(hasNL){color='#c79a5e';fw='700';text=entry?.leaveLabels?.[s.id]||'신휴가';}
      else if(entry?.satMorning===s.id){workCount[s.id]++;bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';}
      else if(s.id===danjikOffId&&!_hasBrush(entry,s.id,'work',dateStr)){text='';}
      else if(s.id===danjikId&&entry){workCount[s.id]++;bg='#d65a52';color='#fff';fw='700';text='당직';}
      else if((entry?.restWorkers||[]).includes(s.id)){color='var(--muted)';text='휴무';}   // 작성소만 '휴무'(배포 근무표는 빈칸, 11-10)
      else if((entry?.jogeunEdu||[]).includes(s.id)){workCount[s.id]++;bg='var(--r-edu-bg)';color='var(--r-edu-fg)';fw='700';text='조근';}
      else if(entry?.newsOh===s.id){workCount[s.id]++;bg='var(--r-news-bg)';color='var(--r-news-fg)';fw='700';text='뉴.오';}
      else if(entry?.newsOh2===s.id){workCount[s.id]++;bg='var(--r-news2-bg)';color='var(--r-news2-fg)';fw='700';text='뉴.오2';}
      else if(entry?.weekend8jin===s.id||entry?.weekday8jin===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진';}
      else if(entry?.weekend8jin2===s.id||entry?.weekday8jin2===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진2';}
      else if(((isWeekdayForm(dateStr)&&jogeunSubReverse[s.id])||(entry?.jogeunExtra||[]).includes(s.id))){workCount[s.id]++;bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';}
      else if(entry){
        const workers=entry.vw?.workers||[],deskId=entry.vw?.desk;
        if(workers.includes(s.id)||s.id===ilgeunId){
          workCount[s.id]++;
          if(s.id===ilgeunId){bg='var(--r-ilgeun-bg)';color='var(--r-ilgeun-fg)';fw='700';text='일근';}
          else if(s.id===deskId){bg='';color='#6366f1';fw='700';text=isWeekdayForm(dateStr)?'VW데':'데스크';}   // 엑셀처럼 평일 VW데·주말 데스크
          else{color='var(--muted)';text='정근';}
        } else if((entry.cg?.workers||[]).includes(s.id)){
          workCount[s.id]++;bg='var(--cg-bg)';color='var(--cg-light)';fw='700';text='CG';
        }
      }
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};${fw!=='500'?`font-weight:${fw};`:''}`:'');   // 바탕 없는 칸도 굵기 그대로(8진2·VW데 등이 엑셀 칸처럼 굵게 — 10-21)
      tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="cursor:pointer;${st}${extraStyle}">${text||'<span class="cell-off">-</span>'}</td>`;
    });

    // 조근 cells
    jogeunCols.forEach(s=>{
      let bg='',color='',fw='500',text='',extraStyle='';
      const imported=_importCellDisplay(entry,s.id,_newLvs?.[dateStr]);
      if(imported){
        if(imported.count)workCount[s.id]++;
        const style=`background:${imported.bg};color:${imported.color};font-weight:${imported.fw};`;
        tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="${style}">${_importCellHTML(imported.text)||'<span class="cell-off">-</span>'}</td>`;
        return;
      }
      const _custom=entry?.customCells?.[s.id];
      if(_custom?.text){
        {const _ls=_learnStyle(entry,s.id);bg=_ls?_ls.bg:(_custom.bg||'');color=_ls?_ls.color:(_custom.color||'var(--text)');}fw='700';text=_custom.text;workCount[s.id]++;
        const st=bg?`background:${bg};color:${color};font-weight:${fw};`:`color:${color};font-weight:${fw};`;
        tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="cursor:pointer;${st}">${text}</td>`;
        return;
      }
      const hasNL=(_newLvs?.[dateStr]||[]).includes(s.id);
      if(isDispatched(s,dateStr)){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(hasNL){
        color='#c79a5e';fw='700';text=entry?.leaveLabels?.[s.id]||'신휴가';
      } else if(!isWeekdayForm(dateStr)){   // 주말·주말 편성 공휴일: 조근조는 쉼(8진만)
        if(entry?.weekend8jin===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진';}
        else if(entry?.weekend8jin2===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진2';}
      } else if((entry?.restWorkers||[]).includes(s.id)){color='var(--muted)';text='휴무';}   // 작성소만 '휴무'
      else if((entry?.jogeunEdu||[]).includes(s.id)){workCount[s.id]++;bg='var(--r-edu-bg)';color='var(--r-edu-fg)';fw='700';text='조근';}
      else if(entry?.newsOh===s.id){workCount[s.id]++;bg='var(--r-news-bg)';color='var(--r-news-fg)';fw='700';text='뉴.오';}
      else if(entry?.newsOh2===s.id){workCount[s.id]++;bg='var(--r-news2-bg)';color='var(--r-news2-fg)';fw='700';text='뉴.오2';}
      else if((entry?.vw?.workers||[]).includes(s.id)){workCount[s.id]++;bg='var(--vw-bg)';color='var(--vw-light)';fw='700';text='VW';}
      else if((entry?.cg?.workers||[]).includes(s.id)){workCount[s.id]++;bg='var(--cg-bg)';color='var(--cg-light)';fw='700';text='CG';}
      else if(entry){bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';workCount[s.id]++;}
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};${fw!=='500'?`font-weight:${fw};`:''}`:'');   // 바탕 없는 칸도 굵기 그대로(8진2·VW데 등이 엑셀 칸처럼 굵게 — 10-21)
      tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="cursor:pointer;${st}${extraStyle}">${text||'<span class="cell-off">-</span>'}</td>`;
    });

    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${vwCnt?'var(--vw-light)':'var(--muted)'};">${vwCnt||'-'}</td>`;

    // CG cells
    cgCols.forEach((s,_ci)=>{
      const _gc=s._dept==='project'?'#686dc8':s._dept==='sports'?'#8a6ecf':null;
      let _gb='';
      if(_gc){if(_ci===0||cgCols[_ci-1]._dept!==s._dept)_gb+=`border-left:1px solid ${_gc}55;`;if(_ci===cgCols.length-1||cgCols[_ci+1]._dept!==s._dept)_gb+=`border-right:1px solid ${_gc}55;`;}
      let bg='',color='',fw='500',text='',extraStyle='';
      const imported=_importCellDisplay(entry,s.id,_newLvs?.[dateStr]);
      if(imported){
        if(imported.count)workCount[s.id]++;
        const style=`background:${imported.bg};color:${imported.color};font-weight:${imported.fw};`;
        tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="${style}">${_importCellHTML(imported.text)||'<span class="cell-off">-</span>'}</td>`;
        return;
      }
      const _custom=entry?.customCells?.[s.id];
      if(_custom?.text){
        {const _ls=_learnStyle(entry,s.id);bg=_ls?_ls.bg:(_custom.bg||'');color=_ls?_ls.color:(_custom.color||'var(--text)');}fw='700';text=_custom.text;workCount[s.id]++;
        const st=bg?`background:${bg};color:${color};font-weight:${fw};`:`color:${color};font-weight:${fw};`;
        tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="cursor:pointer;${st}${_gb}">${text}</td>`;
        return;
      }
      const hasNL=(_newLvs?.[dateStr]||[]).includes(s.id);
      const contractOut=!isContractActive(s,dateStr);
      const dispatched=isDispatched(s,dateStr);
      if(contractOut){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(dispatched){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(s.id===danjikExitId){bg='var(--r-exit-bg)';color='var(--r-exit-fg)';fw='700';text='퇴근';workCount[s.id]++;}
      else if(hasNL){color='#c79a5e';fw='700';text=entry?.leaveLabels?.[s.id]||'신휴가';}
      else if(entry?.satMorning===s.id){workCount[s.id]++;bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';}
      else if(s.id===danjikOffId&&!_hasBrush(entry,s.id,'work',dateStr)){text='';}
      else if(s.id===danjikId&&entry){workCount[s.id]++;bg='#d65a52';color='#fff';fw='700';text='당직';}
      else if((entry?.restWorkers||[]).includes(s.id)){color='var(--muted)';text='휴무';}   // 작성소만 '휴무'(배포 근무표는 빈칸, 11-10)
      else if((entry?.jogeunEdu||[]).includes(s.id)){workCount[s.id]++;bg='var(--r-edu-bg)';color='var(--r-edu-fg)';fw='700';text='조근';}
      else if(entry?.newsOh===s.id){workCount[s.id]++;bg='var(--r-news-bg)';color='var(--r-news-fg)';fw='700';text='뉴.오';}
      else if(entry?.newsOh2===s.id){workCount[s.id]++;bg='var(--r-news2-bg)';color='var(--r-news2-fg)';fw='700';text='뉴.오2';}
      else if(entry?.weekend8jin===s.id||entry?.weekday8jin===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진';}
      else if(entry?.weekend8jin2===s.id||entry?.weekday8jin2===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진2';}
      else if(((isWeekdayForm(dateStr)&&jogeunSubReverse[s.id])||(entry?.jogeunExtra||[]).includes(s.id))){workCount[s.id]++;bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';}
      else if(entry){
        const dept=s._dept;
        let workers=[];
        if(dept==='cg'){workers=entry.cg?.workers||[];}
        else if(dept==='project')workers=entry.project||[];
        else if(dept==='sports')workers=entry.sports||[];
        else if(dept==='xr')workers=entry.xr||[];
        if(workers.includes(s.id)||s.id===ilgeunId){
          workCount[s.id]++;
          const isDesk8=dept==='cg'&&s.id===(entry.cg?.desk8||entry.cg?.desk||null);
          const isDesk5=dept==='cg'&&s.id===entry.cg?.desk5;
          if(s.id===ilgeunId){bg='var(--r-ilgeun-bg)';color='var(--r-ilgeun-fg)';fw='700';text='일근';}
          else if(dept==='cg'&&s.id===entry.morningDesk){bg='';color='#436bb5';fw='700';text='오전데';}
          else if(isDesk8){bg='';color='#6366f1';fw='700';text=isWeekdayForm(dateStr)?'8데스':'데스크';}   // 엑셀처럼 주말(주말 틀)은 데스크
          else if(isDesk5){bg='';color='#4a9fbd';fw='700';text=isWeekdayForm(dateStr)?'5데스':'데스크';}
          else{color='var(--muted)';text='정근';}
        } else if(dept!=='VW'&&(entry.vw?.workers||[]).includes(s.id)){
          workCount[s.id]++;bg='var(--vw-bg)';color='var(--vw-light)';fw='700';text='VW';
        } else if(dept!=='CG'&&(entry.cg?.workers||[]).includes(s.id)){
          workCount[s.id]++;bg='var(--cg-bg)';color='var(--cg-light)';fw='700';text='CG';
        }
      }
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};${fw!=='500'?`font-weight:${fw};`:''}`:'');   // 바탕 없는 칸도 굵기 그대로(8진2·VW데 등이 엑셀 칸처럼 굵게 — 10-21)
      tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="cursor:pointer;${st}${extraStyle}${_gb}">${text||'<span class="cell-off">-</span>'}</td>`;
    });

    {
      const _cgDbg=[];
      (entry?.cg?.workers||[]).filter(id=>!_excl(id)&&!_vwSet.has(id)).forEach(id=>{const p=staffById(id);if(p)_cgDbg.push(p.name+'(CG)');});
      (entry?.xr||[]).filter(id=>!_excl(id)).forEach(id=>{const p=staffById(id);if(p)_cgDbg.push(p.name+'(XR)');});
      if(!_ilgeunIsVW&&_ilgeunOk&&!_vwSet.has(entry.ilgeun)){const p=staffById(entry.ilgeun);if(p)_cgDbg.push(p.name+'(일근)');}
      _8jinIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(deptOn(staffById(id),dateStr)||'').toLowerCase();return d==='cg'||d==='xr';}).forEach(id=>{const p=staffById(id);if(p)_cgDbg.push(p.name+'(8진)');});
      _newsOhIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(deptOn(staffById(id),dateStr)||'').toLowerCase();return d==='cg'||d==='xr';}).forEach(id=>{const p=staffById(id);if(p)_cgDbg.push(p.name+'(뉴.오)');});
      const _cgTip=_cgDbg.join(', ');
      tbody+=`<td title="${_cgTip}" style="text-align:center;font-size:11px;font-weight:700;color:${cgCnt?'var(--cg-light)':'var(--muted)'};cursor:help;">${cgCnt||'-'}</td>`;
    }
    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${dailyCnt?'var(--vw-light)':'var(--muted)'};">${dailyCnt||'-'}</td>`;
    // 확인 열: 누락 항목 표시(목록은 행 시작 전에 계산한 _miss)
    {
      const missing=_miss;
      if(missing.length){
        // 한 줄만: 첫 항목 + 나머지는 "+N" (전체는 title hover로 보존)
        const _mhtml = missing.length===1
          ? missing[0]
          : `${missing[0]} <span style="color:#b58a86;font-weight:800;">+${missing.length-1}</span>`;
        tbody+=`<td class="check-sticky" title="${missing.join(', ')}" style="background:#f7e4e2;color:#c06b66;font-size:10px;font-weight:700;text-align:center;line-height:1.6;padding:2px 5px;white-space:nowrap;">${_mhtml}</td>`;
      } else {
        tbody+=`<td style="text-align:center;font-size:11px;color:#4a9fbd;">✓</td>`;
      }
    }
    // 비고 열: 뉴.오·8진이 타부서 대체자와 겹친 경우만 표시
    {
      const _bigo=[];
      const _vwW=entry?.vw?.workers||[];
      const _cgW=entry?.cg?.workers||[];
      const _vwDesk=entry?.vw?.desk;
      const _cgDepts=new Set(['cg','xr','project','sports']);
      const _addBigo=(id,text)=>{const p=staffById(id);if(p&&isContractActive(p,dateStr))_bigo.push(`<span style="color:#7c3aed;font-weight:700;">${p.name}</span>:${text}`);};
      const _isVwSub=(id)=>{const d=(deptOn(staffById(id),dateStr)||'').toLowerCase();return _vwW.includes(id)&&d!=='vw';};
      const _isCgSub=(id)=>{const d=(deptOn(staffById(id),dateStr)||'').toLowerCase();return _cgW.includes(id)&&d==='vw';};
      // newsOh + 타부서 대체자 중복
      if(entry?.newsOh){
        const _id=entry.newsOh;
        if(_isVwSub(_id)) _addBigo(_id, _id===_vwDesk?'VW데스크':'VW');
        else if(_isCgSub(_id)) _addBigo(_id,'CG');
      }
      // 8진 + 타부서 대체자 중복
      [entry?.weekend8jin, entry?.weekday8jin].filter(Boolean).forEach(_id=>{
        if(_isVwSub(_id)) _addBigo(_id, _id===_vwDesk?'VW데스크':'VW');
        else if(_isCgSub(_id)) _addBigo(_id,'CG');
      });
      // 일근 + 타부서 대체자 중복
      if(entry?.ilgeun){
        const _id=entry.ilgeun;
        if(_isVwSub(_id)) _addBigo(_id, _id===_vwDesk?'VW데스크':'VW');
        else if(_isCgSub(_id)) _addBigo(_id,'CG');
      }
      const _nesc=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
      const _nt = _notesShown(entry?.notes), _ntHtml = _nt ? `<span style="color:#7c3aed;font-weight:600;">${_nesc(_nt)}</span>` : '';
      const _bg = [..._bigo, _ntHtml].filter(Boolean);
      tbody+=`<td data-bigo="${dateStr}" title="더블클릭: 비고 입력" style="${_bg.length?'font-size:10px;padding:2px 5px;line-height:1.8;vertical-align:middle;text-align:left;white-space:nowrap;':''}cursor:text;">${_bg.join('<br>')}</td>`;   // 더블클릭 → wsBigoEdit(11-09)
    }
    tbody+='</tr>';
  }

  // 합계 행
  tbody+='<tr class="sum-row">';
  tbody+=`<td class="date-td" style="font-size:10px;font-weight:700;color:var(--muted);text-align:center;line-height:1.5;">평일<br>${weekdaysInMonth}일</td><td></td>`;
  vwCols.forEach(s=>{const cnt=workCount[s.id]||0;tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${cnt>weekdaysInMonth?'#d65a52':cnt?'var(--text)':'var(--muted)'};">${cnt||'-'}</td>`;});
  jogeunCols.forEach(s=>{const cnt=workCount[s.id]||0;tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${cnt>weekdaysInMonth?'#d65a52':cnt?'var(--vw-light)':'var(--muted)'};">${cnt||'-'}</td>`;});
  tbody+=`<td></td>`;
  cgCols.forEach(s=>{const cnt=workCount[s.id]||0;tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${cnt>weekdaysInMonth?'#d65a52':cnt?'var(--text)':'var(--muted)'};">${cnt||'-'}</td>`;});
  tbody+=`<td></td><td></td><td></td><td></td></tr>`;
  tbody+=`<tr class="name-foot-row"><td class="date-td">이름</td><td class="dow-td"></td>${nameFoot}<td></td><td></td><td></td><td></td></tr>`;   // 맨 아래 이름 줄(10-31)
  document.getElementById('ws-tbody').innerHTML=tbody;
  _wsPaintSelection();
  // 비고 열 폭을 가장 긴 비고 내용에 맞춰 동적 조정(내용 없으면 기본, 길면 늘림)
  (function(){
    const col=document.getElementById('ws-bigo-col'); const tb=document.getElementById('ws-tbody');
    if(!col||!tb) return;
    col.style.width='1px';                              // 최소로 눌러 실제 내용폭(scrollWidth) 측정
    let maxW=0;
    tb.querySelectorAll('tr').forEach(tr=>{ const last=tr.lastElementChild; if(last) maxW=Math.max(maxW, last.scrollWidth); });
    col.style.width=Math.min(Math.max(maxW+6,160),460)+'px';   // 최소 160, 최대 460
  })();
  wsInfoRefresh();   // 참고 자료 창이 열려 있으면 같이 다시 계산
}

let wsBrushType = null;
const WS_BRUSH_LABELS = {
  'select':'마우스 선택','special:excluded-work':'정근 · 집계 제외','special:n':'N','special:vw2':'VW2','special:cg2':'CG2','rest':'휴무',
  'work':'정근','vw-desk':'VW데스크','desk8':'8데스크','desk5':'5데스크',
  'danjik':'당직','jogeun':'조근','ojende':'오전데','8jin':'8진','8jin2':'8진2',
  'ilgeun':'일근','newsoh':'뉴.오','newsoh2':'뉴.오2','leave':'신휴가','off':'지우기'
};
function setWsBrush(type) {
  wsBrushType = (wsBrushType === type && type !== 'select') ? null : type;
  closeCellPop();
  if(wsBrushType!=='select')_wsSelection=null;
  _wsPaintSelection();
  document.querySelectorAll('.ws-brush-btn').forEach(b => {
    const on = b.dataset.brush === wsBrushType;
    b.style.outline = on ? '2px solid var(--accent)' : 'none';
    b.style.boxShadow = on ? '0 0 0 3px rgba(49,130,246,.22)' : 'none';
  });
  const lbl = document.getElementById('ws-brush-label');
  if (lbl) {
    lbl.textContent = wsBrushType ? ('✏ ' + (WS_BRUSH_LABELS[wsBrushType]||wsBrushType) + ' 브러쉬 — 셀 클릭 시 즉시 적용') : '💡 더블클릭 = 근무명 타이핑 · 오른쪽 클릭 = 모든 입력 · Ctrl+클릭 = 지우기';
    if(wsBrushType==='select')lbl.textContent='셀 클릭 · Shift+클릭 범위 선택 · Ctrl+C 복사 · Ctrl+V 붙여넣기';
    lbl.style.display = 'inline';
  }
  const tbody = document.getElementById('ws-tbody');
  if (tbody) tbody.style.cursor = wsBrushType ? 'cell' : '';
}
function _ensureDraftEntry(ds) {
  if (!data.draft) data.draft = {schedule:{}, newLeaves:{}};
  if (!data.draft.schedule[ds]) data.draft.schedule[ds] = {vw:{workers:[],desk:null},cg:{workers:[],desk8:null,desk5:null},project:[],sports:[],xr:[],danjik:null,morningDesk:null,notes:''};
  return data.draft.schedule[ds];
}
function _brushClearStaff(entry, staffId, ds, leaves = data.draft?.newLeaves) {
  if(entry.importedCells)delete entry.importedCells[staffId];
  if(entry.customCells)delete entry.customCells[staffId];
  if(entry.leaveLabels)delete entry.leaveLabels[staffId];
  for(const key of ['weekday8jin2','weekend8jin2']) if(entry[key]===staffId)entry[key]=null;
  if(entry.restWorkers)entry.restWorkers=entry.restWorkers.filter(id=>id!==staffId);
  if (entry.vw?.workers) entry.vw.workers = entry.vw.workers.filter(id=>id!==staffId);
  if (entry.vw?.desk===staffId) entry.vw.desk = null;
  if (entry.cg?.workers) entry.cg.workers = entry.cg.workers.filter(id=>id!==staffId);
  if (entry.cg?.desk8===staffId) entry.cg.desk8 = null;
  if (entry.cg?.desk5===staffId) entry.cg.desk5 = null;
  if (entry.cg?.desk===staffId)  entry.cg.desk  = null;
  entry.project = (entry.project||[]).filter(id=>id!==staffId);
  entry.sports  = (entry.sports||[]).filter(id=>id!==staffId);
  entry.xr      = (entry.xr||[]).filter(id=>id!==staffId);
  if (entry.danjik===staffId)      entry.danjik = null;
  if (entry.morningDesk===staffId) entry.morningDesk = null;
  if (entry.satMorning===staffId)  entry.satMorning = null;
  if (entry.ilgeun===staffId)      entry.ilgeun = null;
  if (entry.weekday8jin===staffId) entry.weekday8jin = null;
  if (entry.weekend8jin===staffId) entry.weekend8jin = null;
  if (entry.newsOh===staffId)      entry.newsOh = null;
  if (entry.newsOh2===staffId)     entry.newsOh2 = null;
  if (leaves?.[ds]) leaves[ds] = leaves[ds].filter(id=>id!==staffId);
  if (entry.jogeunExtra) entry.jogeunExtra = entry.jogeunExtra.filter(id=>id!==staffId);
  if (entry.jogeunEdu)   entry.jogeunEdu   = entry.jogeunEdu.filter(id=>id!==staffId);
  if (entry.jogeunSubs) {
    // 조근 직원(key)이 지워지는 경우 → 해당 대체 배정 제거
    if (staffId in entry.jogeunSubs) delete entry.jogeunSubs[staffId];
    // 대체자(value)가 지워지는 경우 → 해당 키 제거
    Object.keys(entry.jogeunSubs).forEach(k=>{ if(entry.jogeunSubs[k]===staffId) delete entry.jogeunSubs[k]; });
  }
}
function _brushAddWorker(entry, staffId, dept) {
  const d = dept.toLowerCase();
  if (d==='vw')           { if(!entry.vw) entry.vw={workers:[],desk:null}; if(!entry.vw.workers.includes(staffId)) entry.vw.workers.push(staffId); }
  else if (d==='cg')      { if(!entry.cg) entry.cg={workers:[],desk8:null,desk5:null}; if(!entry.cg.workers.includes(staffId)) entry.cg.workers.push(staffId); }
  else if (d==='xr')      { if(!entry.xr) entry.xr=[]; if(!entry.xr.includes(staffId)) entry.xr.push(staffId); }
  else if (d==='project') { if(!entry.project) entry.project=[]; if(!entry.project.includes(staffId)) entry.project.push(staffId); }
  else if (d==='sports')  { if(!entry.sports)  entry.sports=[];  if(!entry.sports.includes(staffId))  entry.sports.push(staffId); }
}
function _hasBrush(entry, staffId, bt, ds) {
  const dow = new Date(ds+'T00:00:00').getDay();
  const isWE = dow===0 || dow===6 || !!(data.holidays&&data.holidays[ds]);
  switch(bt) {
    case 'work':    return (entry?.vw?.workers||[]).includes(staffId)||(entry?.cg?.workers||[]).includes(staffId)||(entry?.xr||[]).includes(staffId)||(entry?.project||[]).includes(staffId)||(entry?.sports||[]).includes(staffId);
    case 'vw-desk': return entry?.vw?.desk === staffId;
    case 'desk8':   return entry?.cg?.desk8 === staffId;
    case 'desk5':   return entry?.cg?.desk5 === staffId;
    case 'danjik':  return entry?.danjik === staffId;
    case 'jogeun':  return isWE ? entry?.satMorning === staffId : (entry?.jogeunExtra||[]).includes(staffId);
    case 'ojende':  return entry?.morningDesk === staffId;
    case '8jin':    return !isWeekdayForm(ds) ? entry?.weekend8jin === staffId : entry?.weekday8jin === staffId;   // 평일 편성 공휴일은 평일 8진
    case '8jin2':   return !isWeekdayForm(ds) ? entry?.weekend8jin2 === staffId : entry?.weekday8jin2 === staffId;
    case 'ilgeun':  return entry?.ilgeun === staffId;
    case 'newsoh':  return entry?.newsOh === staffId;
    case 'newsoh2': return entry?.newsOh2 === staffId;
    case 'jogeun-edu': return (entry?.jogeunEdu||[]).includes(staffId);
    case 'vw-sub':  return (entry?.vw?.workers||[]).includes(staffId);
    case 'cg-sub':  return (entry?.cg?.workers||[]).includes(staffId);
    case 'leave':   return (data.draft?.newLeaves?.[ds]||[]).includes(staffId);
    case 'rest':    return (entry?.restWorkers||[]).includes(staffId);   // 휴무(11-10): 작성소엔 '휴무', 배포 근무표엔 빈칸
    default: return false;
  }
}
function _applyBrush(staffId, ds, skipRender) {
  const s = staffById(staffId); if (!s) return;
  if (!isContractActive(s, ds)) { toast('계약 외 기간으로 입력이 불가능합니다.', 'error'); return; }
  if (isDispatched(s, ds)) { toast('파견 기간으로 입력이 불가능합니다.', 'error'); return; }
  const dept = (s.dept||'').toLowerCase();
  const bt = wsBrushType;
  if (bt?.startsWith('special:')) {
    _assignSpecialDuty(_ensureDraftEntry(ds), staffId, ds, bt.slice(8), data.draft.newLeaves ||= {});
    saveData(data); if(!skipRender)renderWorkshopTable(); return;
  }
  const dow = new Date(ds+'T00:00:00').getDay();
  const isWE  = dow===0 || dow===6 || !!(data.holidays&&data.holidays[ds]);
  const isSat = dow===6;

  // 같은 브러시로 이미 지정된 셀 → 클릭 시 지우기
  if (bt !== 'off' && _hasBrush(data.draft?.schedule?.[ds], staffId, bt, ds)) {
    if (bt === 'leave') {
      if (data.draft?.newLeaves?.[ds]) {
        data.draft.newLeaves[ds] = data.draft.newLeaves[ds].filter(id => id !== staffId);
      }
    } else {
      const entry = _ensureDraftEntry(ds);
      _brushClearStaff(entry, staffId, ds);
    }
    saveData(data); if (!skipRender) renderWorkshopTable(); return;
  }

  if (bt === 'leave') {
    if (!data.draft) data.draft = {schedule:{}, newLeaves:{}};
    _brushClearStaff(_ensureDraftEntry(ds),staffId,ds);
    if (!data.draft.newLeaves) data.draft.newLeaves = {};
    if (!data.draft.newLeaves[ds]) data.draft.newLeaves[ds] = [];
    if (!data.draft.newLeaves[ds].includes(staffId)) data.draft.newLeaves[ds].push(staffId);
    saveData(data); renderWorkshopTable(); return;
  }

  const entry = _ensureDraftEntry(ds);
  // 공존 가능한 역할 미리 저장 (뉴.오↔대체자, 8진↔대체자)
  const _coVwW = (entry?.vw?.workers||[]).includes(staffId);
  const _coCgW = (entry?.cg?.workers||[]).includes(staffId);
  const _coNewsOh = entry?.newsOh === staffId;
  const _coNewsOh2 = entry?.newsOh2 === staffId;
  const _coW8jin  = entry?.weekend8jin === staffId;
  const _coWd8jin = entry?.weekday8jin === staffId;
  const _coIlgeun = entry?.ilgeun === staffId;
  _brushClearStaff(entry, staffId, ds);

  if (bt === 'off') {
    // 지우기
  } else if (bt === 'rest') {
    (entry.restWorkers ||= []).push(staffId);   // 휴무 — 근무 인원에 안 셈
  } else if (bt === 'work') {
    _brushAddWorker(entry, staffId, dept);
  } else if (bt === 'vw-desk') {
    if (!entry.vw) entry.vw = {workers:[], desk:null};
    if (!entry.vw.workers.includes(staffId)) entry.vw.workers.push(staffId);
    entry.vw.desk = staffId;
  } else if (bt === 'desk8') {
    if (!entry.cg) entry.cg = {workers:[], desk8:null, desk5:null};
    if (!entry.cg.workers.includes(staffId)) entry.cg.workers.push(staffId);
    entry.cg.desk8 = staffId;
  } else if (bt === 'desk5') {
    if (!entry.cg) entry.cg = {workers:[], desk8:null, desk5:null};
    if (!entry.cg.workers.includes(staffId)) entry.cg.workers.push(staffId);
    entry.cg.desk5 = staffId;
  } else if (bt === 'danjik') {
    entry.danjik = staffId;
    _brushAddWorker(entry, staffId, dept);
  } else if (bt === 'jogeun') {
    if (isSat) {
      entry.satMorning = staffId;
      _brushAddWorker(entry, staffId, dept);
    } else {
      // 평일: jogeunExtra 배열에 추가 (조근 대체/추가 인원)
      if (!entry.jogeunExtra) entry.jogeunExtra = [];
      if (!entry.jogeunExtra.includes(staffId)) entry.jogeunExtra.push(staffId);
    }
  } else if (bt === 'ojende') {
    entry.morningDesk = staffId;
    _brushAddWorker(entry, staffId, dept);
  } else if (bt === '8jin') {
    if (!isWeekdayForm(ds)) { entry.weekend8jin = staffId; } else { entry.weekday8jin = staffId; }   // 생성·점검과 같은 기준
  } else if (bt === '8jin2') {   // 교육용 두 번째 8진(10-21) — 그날 원래 8진은 그대로, 엑셀 '8진2'와 같은 자리(weekday8jin2·weekend8jin2)
    if (!isWeekdayForm(ds)) { entry.weekend8jin2 = staffId; } else { entry.weekday8jin2 = staffId; }
  } else if (bt === 'ilgeun') {
    entry.ilgeun = staffId;
  } else if (bt === 'newsoh') {
    entry.newsOh = staffId;
    _brushAddWorker(entry, staffId, dept);
  } else if (bt === 'newsoh2') {
    entry.newsOh2 = staffId;
    _brushAddWorker(entry, staffId, dept);
  } else if (bt === 'jogeun-edu') {
    if (!entry.jogeunEdu) entry.jogeunEdu=[];
    if (!entry.jogeunEdu.includes(staffId)) entry.jogeunEdu.push(staffId);
  } else if (bt === 'vw-sub') {
    if (!entry.vw) entry.vw = {workers:[], desk:null};
    if (!entry.vw.workers.includes(staffId)) entry.vw.workers.push(staffId);
  } else if (bt === 'cg-sub') {
    if (!entry.cg) entry.cg = {workers:[], desk8:null, desk5:null};
    if (!entry.cg.workers.includes(staffId)) entry.cg.workers.push(staffId);
  }

  // 공존 역할 복원: 뉴.오·8진·일근 ↔ VW/CG대체 서로 지우지 않음
  if (bt==='newsoh' || bt==='newsoh2' || bt==='8jin' || bt==='8jin2' || bt==='ilgeun') {
    if (_coVwW && !(entry.vw?.workers||[]).includes(staffId)) { if(!entry.vw) entry.vw={workers:[],desk:null}; entry.vw.workers.push(staffId); }
    if (_coCgW && !(entry.cg?.workers||[]).includes(staffId)) { if(!entry.cg) entry.cg={workers:[],desk8:null,desk5:null}; entry.cg.workers.push(staffId); }
  }
  if (bt==='vw-sub' || bt==='cg-sub') {
    if (_coNewsOh) entry.newsOh = staffId;
    if (_coNewsOh2) entry.newsOh2 = staffId;
    if (_coW8jin)  entry.weekend8jin = staffId;
    if (_coWd8jin) entry.weekday8jin = staffId;
    if (_coIlgeun) entry.ilgeun = staffId;
  }

  saveData(data);
  if (!skipRender) renderWorkshopTable();
}
function wsCellClick(td, event) {
  if (!isAdmin) return;
  event.stopPropagation();
  const staffId = td.dataset.sid;
  const dateStr = td.dataset.ds;
  if(event.ctrlKey||event.metaKey){ _wsClearCells([{sid:staffId,ds:dateStr}]); return; }   // Ctrl+클릭 = 무슨 브러시든 그 칸 바로 지우기(11-10)
  if(wsBrushType==='select'){_wsSelectCell(td,event.shiftKey);return;}
  if (wsBrushType) { _pushWsHistory(); _applyBrush(staffId, dateStr); return; }
  _draftCellMode = true;
  cellClick(staffId, dateStr, event);
}
// ===== #7 셀 더블클릭 타이핑: 근무명 인식 → 정식 셀(브러시 재사용), 미인식 → 직접입력 텍스트 =====
const WS_TYPE_MAP = {
  '정근':'work','근무':'work',
  '당직':'danjik',
  '조근':'jogeun','조근추가':'jogeun','토요조근':'jogeun','토조근':'jogeun',
  '오전데':'ojende','오전데스크':'ojende',
  '8진':'8jin','팔진':'8jin',
  '8진2':'8jin2','8진②':'8jin2','팔진2':'8jin2',
  '일근':'ilgeun',
  '뉴오':'newsoh','뉴.오':'newsoh','뉴스오픈':'newsoh',
  '뉴오2':'newsoh2','뉴.오2':'newsoh2',
  'vw데스크':'vw-desk','vw데':'vw-desk',
  '8데스':'desk8','8데스크':'desk8','8데':'desk8',
  '5데스':'desk5','5데스크':'desk5','5데':'desk5',
  '조근교육':'jogeun-edu','조근-교육':'jogeun-edu',
  'vw':'vw-sub','cg':'cg-sub',
  '신휴가':'leave','휴가':'leave','연차':'leave',
  '휴무':'rest','휴':'rest','쉼':'rest','쉬는날':'rest',   // 휴무(11-10)
  'vw2':'special:vw2','vw②':'special:vw2','cg2':'special:cg2','cg②':'special:cg2',   // 배우는 중(인원 집계 제외)
  '정근2':'special:jg2','정근②':'special:jg2','당직2':'special:dj2','당직②':'special:dj2','조근2':'special:jo2','조근②':'special:jo2','일근2':'special:il2','일근②':'special:il2',   // 2 붙은 근무(11-10, 인원 X)
  '지우기':'off','삭제':'off','off':'off','x':'off','없음':'off','-':'off'
};
function _wsTypeApply(sid, ds, type){
  _pushWsHistory();
  const entry = _ensureDraftEntry(ds);
  if (entry.customCells && entry.customCells[sid]) delete entry.customCells[sid];
  _brushClearStaff(entry, sid, ds);                             // 먼저 비움 → SET 의미 보장(토글 회피)
  if (type==='off') { saveData(data); renderWorkshopTable(); return; }
  const prev = wsBrushType;
  wsBrushType = type;
  try { _applyBrush(sid, ds); } finally { wsBrushType = prev; }
}
function _wsTypeSubmit(sid, ds, v){
  const raw = (v||'').trim();
  if (raw === '') { renderWorkshopTable(); return; }             // 빈 입력 = 취소
  const key = raw.toLowerCase().replace(/\s+/g,'');
  const type = WS_TYPE_MAP[key];
  if (type) { _wsTypeApply(sid, ds, type); return; }             // 인식 → 정식 셀(_applyBrush 내부서 저장·렌더)
  const _duty = typeof _dutyByText==='function' ? _dutyByText(raw) : null;   // 특수 근무 목록(출장·교육·휴가·직접 만든 이름) 그대로 친 것 → 그 색·계산으로(11-10)
  if (_duty) { _wsTypeApply(sid, ds, 'special:'+_duty.key); return; }
  _pushWsHistory();                                              // 미인식 → 직접입력 텍스트 셀(기존 배정 대체)
  const entry = _ensureDraftEntry(ds);
  _brushClearStaff(entry, sid, ds);
  if (!entry.customCells) entry.customCells = {};
  entry.customCells[sid] = { text: raw.slice(0,8) };
  saveData(data); renderWorkshopTable();
  toast('근무명 미인식 → "'+raw.slice(0,8)+'" 텍스트로 저장', 'error');
}
function wsCellType(td){
  if (!isAdmin || wsBrushType) return;                          // 브러시 모드면 클릭으로 처리
  closeCellPop();
  const sid = td.dataset.sid, ds = td.dataset.ds;
  if (!sid || !ds) return;
  if (td.querySelector('input.ws-type-input')) return;
  const cur = td.textContent.trim();
  const inp = document.createElement('input');
  inp.className = 'ws-type-input';
  inp.value = (cur==='-' ? '' : cur);
  inp.setAttribute('style','width:100%;box-sizing:border-box;border:1.5px solid var(--accent);border-radius:4px;font-size:11px;padding:1px 2px;text-align:center;outline:none;');
  inp.addEventListener('click', e=>e.stopPropagation());
  td.innerHTML=''; td.appendChild(inp);
  inp.focus(); inp.select();
  let done=false;
  const finish=(apply)=>{ if(done) return; done=true; if(apply) _wsTypeSubmit(sid, ds, inp.value); else renderWorkshopTable(); };
  inp.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); finish(true); }
    else if(e.key==='Escape'){ e.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur', ()=>finish(true));
}
// 비고 칸 더블클릭 → 그날 비고(entry.notes) 직접 입력(11-09 — 예전엔 엑셀 가져오기로만 들어감). Enter·칸 밖 클릭=저장, Esc=취소. 자동 비고(타부서 대체)는 그대로 붙어 보임
function wsBigoEdit(td){
  if (!isAdmin) return;
  const ds=td.dataset.bigo;
  if (!ds || td.querySelector('input.ws-type-input')) return;
  if (typeof closeCellPop==='function') closeCellPop();
  const cur=_notesShown(data.draft?.schedule?.[ds]?.notes);
  const inp=document.createElement('input');
  inp.className='ws-type-input'; inp.value=cur; inp.placeholder='비고 입력 후 Enter';
  inp.setAttribute('style','width:100%;min-width:150px;box-sizing:border-box;border:1.5px solid var(--accent);border-radius:4px;font-size:11px;padding:1px 4px;outline:none;');
  inp.addEventListener('click', e=>e.stopPropagation());
  inp.addEventListener('dblclick', e=>e.stopPropagation());
  td.innerHTML=''; td.appendChild(inp);
  inp.focus(); inp.select();
  let done=false;
  const finish=(apply)=>{
    if(done) return; done=true;
    const v=inp.value.trim();
    if(!apply||v===cur){ renderWorkshopTable(); return; }
    _pushWsHistory();
    const sch=(data.draft.schedule ||= {});
    const e=(sch[ds] ||= {vw:{workers:[],desk:null},cg:{workers:[],desk8:null,desk5:null},project:[],sports:[],xr:[],danjik:null,morningDesk:null,notes:''});
    e.notes=v;
    saveData(data); renderWorkshopTable();
  };
  inp.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); finish(true); }
    else if(e.key==='Escape'){ e.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur', ()=>finish(true));
}
(function(){
  const tb=document.getElementById('ws-tbody');
  if (tb && !tb._wsTypeBound){
    tb._wsTypeBound=true;
    tb.addEventListener('contextmenu', function(e){   // 오른쪽 클릭 = 넣을 수 있는 모든 것(11-10)
      const td=e.target.closest('td[data-sid][data-ds]');
      if(!td||!isAdmin) return;
      e.preventDefault(); _wsCtxOpen(td,e);
    });
    tb.addEventListener('dblclick', function(e){
      const bigo=e.target.closest('td[data-bigo]');
      if(bigo){ wsBigoEdit(bigo); return; }
      const td=e.target.closest('td[data-sid][data-ds]');
      if(td) wsCellType(td);
    });
  }
  const _lbl=document.getElementById('ws-brush-label');
  if (_lbl && !wsBrushType){ _lbl.textContent='💡 더블클릭 = 근무명 타이핑 · 오른쪽 클릭 = 모든 입력 · Ctrl+클릭 = 지우기'; _lbl.style.display='inline'; }
})();
// Rectangular, in-app clipboard: store assignment data, never just cell text.
let _wsSelection=null, _wsClipboard=null;
const WS_COPY_SINGLE=['danjik','morningDesk','satMorning','ilgeun','weekday8jin','weekend8jin','weekday8jin2','weekend8jin2','newsOh','newsOh2'];
const WS_COPY_ARRAY=['project','sports','xr','jogeunExtra','jogeunEdu','restWorkers'];
function _wsGrid(){
  return [...document.querySelectorAll('#ws-tbody tr')].map(tr=>[...tr.querySelectorAll('td[data-sid][data-ds]')]).filter(row=>row.length);
}
function _wsSelectionBounds(grid){
  if(!_wsSelection)return null;
  const pos=point=>{for(let r=0;r<grid.length;r++){const c=grid[r].findIndex(td=>td.dataset.sid===point.sid&&td.dataset.ds===point.ds);if(c>=0)return {r,c};}return null;};
  const a=pos(_wsSelection.anchor),b=pos(_wsSelection.end);if(!a||!b)return null;
  return {r:Math.min(a.r,b.r),c:Math.min(a.c,b.c),rows:Math.abs(a.r-b.r)+1,cols:Math.abs(a.c-b.c)+1};
}
function _wsPaintSelection(){
  const grid=_wsGrid(),b=wsBrushType==='select'?_wsSelectionBounds(grid):null;
  grid.forEach((row,r)=>row.forEach((td,c)=>{
    const on=!!b&&r>=b.r&&r<b.r+b.rows&&c>=b.c&&c<b.c+b.cols;
    td.classList.toggle('ws-selected-cell',on);
    if(on)td.setAttribute('aria-selected','true');else td.removeAttribute('aria-selected');
  }));
}
function _wsSelectCell(td,extend){
  const point={sid:td.dataset.sid,ds:td.dataset.ds};
  _wsSelection={anchor:extend&&_wsSelection?_wsSelection.anchor:point,end:point};
  window.getSelection()?.removeAllRanges();_wsPaintSelection();
  const tb=document.getElementById('ws-tbody');tb.tabIndex=-1;tb.focus({preventScroll:true});
}
function _wsCaptureAssignment(entry,id,leaves,text,dept){
  const e=entry||{},copy={single:[],arrays:[],groups:{},leave:(leaves||[]).includes(id)};
  for(const k of WS_COPY_SINGLE)if(e[k]===id)copy.single.push(k);
  for(const k of WS_COPY_ARRAY)if(e[k]?.includes(id))copy.arrays.push(k);
  for(const group of ['vw','cg']){
    const roles=[];for(const k of ['desk','desk8','desk5'])if(e[group]?.[k]===id)roles.push(k);
    if(e[group]?.workers?.includes(id))roles.push('workers');
    if(roles.length)copy.groups[group]=roles;
  }
  if(Object.values(e.jogeunSubs||{}).includes(id)&&!copy.arrays.includes('jogeunExtra'))copy.arrays.push('jogeunExtra');
  for(const k of ['customCells','leaveLabels'])if(e[k]?.[id]!=null)copy[k]=JSON.parse(JSON.stringify(e[k][id]));
  const imported=_importCellDisplay(e,id,leaves);
  if(imported)copy.imported=JSON.parse(JSON.stringify(e.importedCells[id]));
  // Automatically derived cells also need a concrete destination assignment.
  if(!copy.single.length&&!copy.arrays.length&&!Object.keys(copy.groups).length&&!copy.leave&&!copy.customCells){
    const label=(imported?.text??text??'').trim();
    if(label==='정근'){
      const d=String(dept).toLowerCase();
      if(['vw','cg'].includes(d))copy.groups[d]=['workers'];
      else if(['xr','sports','project'].includes(d))copy.arrays.push(d);
    }else if(label==='조근')copy.arrays.push('jogeunExtra');
    else if(['신휴가','Jr.휴가','공가','경조'].includes(label)){copy.leave=true;if(label!=='신휴가')copy.leaveLabels=label;}
    else if(label&&label!=='-')copy.customCells={text:label,bg:'var(--surface2)',color:'var(--muted)',excl:true};
    else copy.arrays.push('restWorkers');
  }
  return copy;
}
function _wsWriteAssignment(entry,id,ds,leaves,copy){
  // Reject occupied unique duties instead of silently replacing another person.
  for(const k of copy.single){if(entry[k]&&entry[k]!==id)throw Error(ds+'에 해당 역할의 다른 담당자가 있습니다.');entry[k]=id;}
  for(const k of copy.arrays){entry[k] ||= [];if(!entry[k].includes(id))entry[k].push(id);}
  for(const [group,roles] of Object.entries(copy.groups)){
    entry[group] ||= {workers:[]};
    for(const k of roles){
      if(k==='workers'){entry[group].workers ||= [];if(!entry[group].workers.includes(id))entry[group].workers.push(id);}
      else{if(entry[group][k]&&entry[group][k]!==id)throw Error(ds+'에 해당 데스크의 다른 담당자가 있습니다.');entry[group][k]=id;}
    }
  }
  if(copy.leave)(leaves[ds] ||= []).push(id);
  for(const k of ['customCells','leaveLabels'])if(copy[k]!=null)(entry[k] ||= {})[id]=JSON.parse(JSON.stringify(copy[k]));
  if(copy.imported)(entry.importedCells ||= {})[id]={...copy.imported,signature:_importCellSignature(entry,id,leaves[ds])};
}
function _wsCopySelection(){
  const grid=_wsGrid(),b=_wsSelectionBounds(grid);if(!b)return;
  _wsClipboard=Array.from({length:b.rows},(_,r)=>Array.from({length:b.cols},(_,c)=>{
    const td=grid[b.r+r][b.c+c],{sid,ds}=td.dataset,staff=staffById(sid);
    return _wsCaptureAssignment(data.draft?.schedule?.[ds],sid,data.draft?.newLeaves?.[ds],td.textContent,deptOn(staff,ds));
  }));
  toast(`${b.rows*b.cols}개 셀 복사됨 · 붙여넣을 시작 셀을 선택하세요`,'success');
}
function _wsPasteSelection(){
  const grid=_wsGrid(),b=_wsSelectionBounds(grid);if(!b||!_wsClipboard)return;
  const rows=_wsClipboard.length,cols=_wsClipboard[0].length;
  if(b.r+rows>grid.length||Array.from({length:rows},(_,r)=>grid[b.r+r].length).some(n=>b.c+cols>n)){toast('복사 범위가 표 밖으로 나갑니다. 시작 칸을 바꿔주세요.','error');return;}
  const draft=JSON.parse(JSON.stringify(data.draft||{schedule:{},newLeaves:{}}));
  draft.schedule ||= {};draft.newLeaves ||= {};
  try{
    // Clear the entire destination first so roles can move within the pasted block.
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const {sid,ds}=grid[b.r+r][b.c+c].dataset,s=staffById(sid);
      if(!s||!isContractActive(s,ds)||isDispatched(s,ds))throw Error('계약 외 기간 또는 파견 기간이 포함되어 있습니다.');
      const entry=draft.schedule[ds] ||= {vw:{workers:[]},cg:{workers:[]}};
      _brushClearStaff(entry,sid,ds,draft.newLeaves);
    }
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const {sid,ds}=grid[b.r+r][b.c+c].dataset;
      _wsWriteAssignment(draft.schedule[ds],sid,ds,draft.newLeaves,_wsClipboard[r][c]);
    }
  }catch(err){toast(err.message+' 붙여넣기를 취소했습니다.','error');return;}
  _pushWsHistory();data.draft=draft;
  _wsSelection={anchor:{...grid[b.r][b.c].dataset},end:{...grid[b.r+rows-1][b.c+cols-1].dataset}};
  saveData(data);renderWorkshopTable();toast(`${rows*cols}개 셀 붙여넣기 완료`,'success');
}
document.addEventListener('keydown',event=>{
  if(!isAdmin||wsBrushType!=='select'||event.defaultPrevented)return;
  const target=event.target;
  if(target?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;
  const table=document.getElementById('ws-tbody');
  if(!table?.getClientRects().length||!table.contains(target))return;
  if((event.ctrlKey||event.metaKey)&&!event.altKey){
    const key=event.key.toLowerCase();
    if(key==='c'){event.preventDefault();_wsCopySelection();}
    if(key==='v'){event.preventDefault();_wsPasteSelection();}
  }else if(event.key==='Escape'){_wsSelection=null;_wsPaintSelection();}
});
// 작성소 Ctrl+Z = [뒤로가기](undoWorkshop) — 글자 칸·팝업 안에서는 그 칸의 되돌리기 그대로
document.addEventListener('keydown',event=>{
  if(!isAdmin||currentView!=='workshop'||event.defaultPrevented||event.altKey||event.shiftKey)return;
  if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z')return;
  if(event.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"],.modal-overlay'))return;
  if(document.getElementById('wt-pop')||[...document.querySelectorAll('.modal-overlay')].some(m=>getComputedStyle(m).display!=='none'))return;   // 팝업이 떠 있으면 아래 표는 안 건드림
  event.preventDefault();
  if(_wsHistory.length) undoWorkshop(); else toast('더 되돌릴 게 없어요','');
});

// ===== 작성소 참고 자료 창(떠 있는 창): 근무 통계 · 직원B 근무일(평일 수 대비 지난 기간 초과분) · 직원B 남은 휴가(직접 입력) =====
// 근무표를 고치는 동안 열어 둠(모달 아님, 머리를 끌어 옮김). 표가 다시 그려질 때마다 wsInfoRefresh로 새로 셈
let _wiTab=(()=>{ try{ return localStorage.getItem('nd_wsinfo_tab')||'stats'; }catch(e){ return 'stats'; } })();
const _wiEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 넓은 화면: 브라우저 밖으로도 옮길 수 있는 별도 창(크롬·엣지 '문서 PiP' = 항상 위, 안 되면 일반 새 창). 휴대폰: 화면 안 패널
let _wiEl=null, _wiWin=null;
function wsInfoToggle(){
  if(_wiEl){ _wiClose(); return; }
  _wiOpen();
}
function _wiClose(){
  const w=_wiWin; _wiWin=null; if(_wiEl&&!w) _wiEl.remove(); _wiEl=null;
  if(w){ try{ w.close(); }catch(e){} }
  document.getElementById('ws-info-btn')?.classList.remove('active');
}
function _wiBuild(doc){
  const el=doc.createElement('div'); el.id='ws-info'; el.className='ws-info';
  el.setAttribute('role','dialog'); el.setAttribute('aria-label','근무표 참고 자료');
  el.innerHTML=`<div class="wi-head"><div class="wi-title">참고 자료</div><button class="wi-close" aria-label="닫기" onclick="wsInfoToggle()">✕</button></div>
    <div class="wi-tabs" role="tablist">${[['stats','근무 통계'],['flwork','직원B 근무일'],['flleave','직원B 남은 휴가']].map(([k,t])=>`<button role="tab" data-wi="${k}" onclick="wsInfoTab('${k}')">${t}</button>`).join('')}</div>
    <div class="wi-body"></div>`;
  return el;
}
async function _wiOpen(){
  document.getElementById('ws-info-btn')?.classList.add('active');
  if(window.innerWidth>1000){
    let w=null;
    try{
      if(window.documentPictureInPicture&&!window.ndApp) w=await documentPictureInPicture.requestWindow({width:640,height:760});   // 작성 앱(Electron)은 새 창(window.open)이 진짜 창으로 뜸
      else w=window.open('','nd_ws_info','popup,width=680,height=820');
    }catch(e){ w=null; }
    if(w){
      const d=w.document; d.title='참고 자료';
      if(!window.documentPictureInPicture) d.body.innerHTML='';
      document.querySelectorAll('link[rel="stylesheet"],style').forEach(n=>d.head.appendChild(n.cloneNode(true)));   // 앱 스타일 그대로
      const th=document.documentElement.getAttribute('data-theme'); if(th) d.documentElement.setAttribute('data-theme',th);
      if(window.ndApp) d.documentElement.classList.add('nd-app');   // 작성 앱: 윈도 제목줄 없는 창 — 파란 머리로 끌기(css/admin.css)
      d.body.style.cssText='margin:0;padding:0;background:var(--bg);';
      // 창 안의 onclick이 이 앱 함수를 부르게
      w.wsInfoToggle=wsInfoToggle; w.wsInfoTab=wsInfoTab; w.flSelect=flSelect; w.flSaveOne=flSaveOne; w.wsInfoYear=wsInfoYear; w.wsInfoPerson=wsInfoPerson; w.wlOpenWise=wlOpenWise; w.wlAppFetch=wlAppFetch; w.wlPasteToggle=wlPasteToggle; w.wlPasteImport=wlPasteImport; w.toast=toast;
      w.addEventListener('message',e=>{ if(e.origin==='https://wise.sbs.co.kr'&&e.data&&e.data.type==='nd-wise-leave') _wlImport(String(e.data.text||'')); });
      const el=_wiBuild(d); el.classList.add('wi-win'); d.body.appendChild(el);
      _wiEl=el; _wiWin=w;
      w.addEventListener('pagehide',()=>{ if(_wiWin===w){ _wiWin=null; _wiEl=null; document.getElementById('ws-info-btn')?.classList.remove('active'); } });
      wsInfoRefresh(); return;
    }
  }
  const el=_wiBuild(document); document.body.appendChild(el); _wiEl=el;
  wsInfoRefresh();
}
function wsInfoTab(k){ _wiTab=k; try{localStorage.setItem('nd_wsinfo_tab',k);}catch(e){} wsInfoRefresh(); }
// 근무표 한 달 기간: 그달 첫 월요일 ~ 다음 달 첫 월요일 전날(엑셀 시트와 같음)
function _wiFirstMon(y,m){ const d=new Date(y,m-1,1); while(d.getDay()!==1) d.setDate(d.getDate()+1); return toDateStr(d.getFullYear(),d.getMonth()+1,d.getDate()); }
function _wiPeriodOf(ds){ const d=new Date(ds+'T00:00:00'); let y=d.getFullYear(), m=d.getMonth()+1;
  if(ds<_wiFirstMon(y,m)){ m--; if(m<1){m=12;y--;} }
  const ny=m===12?y+1:y, nm=m===12?1:m+1; return [_wiFirstMon(y,m), addDays(_wiFirstMon(ny,nm),-1), y, m]; }
function _wiDates(a,b){ const r=[]; for(let d=a; d<=b; d=addDays(d,1)) r.push(d); return r; }
const _wiRest=/^(휴무|휴|쉼|대휴|비번|당직비번|신휴가|휴가|연차|반차|Jr\.?휴가|경조|공가|-|0)$/i;
// 그 사람이 그날 일했는지(퇴근 포함, 휴가 제외) — 자동 생성과 같은 셈(_genDayUnits)
function _wiWorked(src, s, ds){ if(isOnLeave(s.id,ds)) return false; const e=src(ds)||{}, pe=src(addDays(ds,-1))||{};
  const c=e.customCells?.[s.id]; if(c&&c.text) return !_wiRest.test(String(c.text).replace(/\s/g,''));
  return _genDayUnits(e,pe).has(s.id); }
function _wiFreelancers(ds){ return data.staff.filter(s=>s.employmentType==='freelancer'&&s.active!==false&&String(deptOn(s,ds)||'')!=='조근'&&isContractActive(s,ds)); }
function wsInfoRefresh(){
  if(!_wiEl) return; const body=_wiEl.querySelector('.wi-body'); if(!body) return;
  _wiEl.querySelectorAll('.wi-tabs button').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.wi===_wiTab)));
  const rs=wsRangeStart, re=wsRangeEnd;
  if(!rs||!re){ body.innerHTML='<div class="wi-empty">작성소 기간을 먼저 정하세요.</div>'; return; }
  try{ body.innerHTML=_wiTab==='flwork'?_wiFlWork(rs,re):_wiTab==='flleave'?'<div class="fl-admin fl-in-info">'+_flSplitHTML(rs,false)+'</div>':_wiStats(rs); }
  catch(e){ body.innerHTML='<div class="wi-empty">계산하지 못했습니다: '+_wiEsc(e.message)+'</div>'; }
}
// ① 근무 통계: 관리자 '근무 통계' 탭과 같은 표(_workStatsHTML, js/admin.js) — 연도는 창 안에서 고름(기본 = 작성소 기간의 해)
let _wiYear=null;
function _wiStats(rs){
  const y0=+rs.slice(0,4), year=_wiYear||y0;
  const opts=[y0+1,y0,y0-1,y0-2].map(y=>`<option value="${y}"${y===year?' selected':''}>${y}년</option>`).join('');
  return `<div class="wi-statbar"><select class="wi-in wi-year" aria-label="통계 연도" onchange="wsInfoYear(this.value)">${opts}</select><span class="wi-note" style="margin:0">배포된 근무표 + 과거 직접 입력분(관리자 근무 통계와 같음)</span></div>
    <div class="wi-stats">${_workStatsHTML(year,false,'wsInfoPerson')}</div>`;
}
function wsInfoYear(v){ _wiYear=+v||null; wsInfoRefresh(); }
// ② 직원B 근무일: 근무 + 평일 휴가 = 그 기간 평일 수(계약 기간 안)가 기준(자동 생성과 같음) — 지난 기간에 더(덜) 일한 날만큼 이번에 덜(더)
function _wiFlWork(rs,re){
  const [ps,pe,,pm]=_wiPeriodOf(addDays(rs,-1));
  const prevDates=_wiDates(ps,pe), curDates=_wiDates(rs,re);
  const dep=ds=>data.schedule[ds], dft=ds=>data.draft?.schedule?.[ds]||data.schedule[ds];
  const list=_wiFreelancers(rs).filter(s=>['VW','CG','XR'].includes(String(deptOn(s,rs)||'').toUpperCase()));
  if(!list.length) return '<div class="wi-empty">직원B가 없습니다.</div>';
  const tally=(s,dates,src)=>{ const on=dates.filter(d=>isContractActive(s,d)&&!isDispatched(s,d)), wdays=on.filter(d=>isWeekdayForm(d));
    return { wd:wdays.length, lv:wdays.filter(d=>isOnLeave(s.id,d)).length, work:on.filter(d=>_wiWorked(src,s,d)).length }; };
  const sg=n=>n>0?`<b class="wi-plus">+${n}</b>`:n<0?`<b class="wi-minus">${n}</b>`:'<span class="wi-dim">0</span>';
  const rows=list.map(s=>{
    const p=tally(s,prevDates,dep), c=tally(s,curDates,dft);
    const had=p.work+p.lv>0;                         // 지난 기간에 근무·휴가가 없으면(신입·복귀) 넘어온 것 없음
    const over=had?p.work+p.lv-p.wd:0, target=c.wd-c.lv-over, gap=c.work-target;
    return `<tr><td class="wi-name"><button class="wi-namebtn" onclick="wsInfoPerson('${s.id}')">${_wiEsc(s.name)}</button><small>${_wiEsc(deptOn(s,rs))}</small></td>
      <td class="c-prev">${had?p.work:'<span class="wi-dim">-</span>'}${p.lv?`<small class="wi-dim"> 휴${p.lv}</small>`:''}</td><td class="c-prev">${had?sg(over):'<span class="wi-dim">-</span>'}</td>
      <td class="c-cur">${target}<small class="wi-dim"> /${c.wd}</small></td><td class="c-cur">${c.work}${c.lv?`<small class="wi-dim"> 휴${c.lv}</small>`:''}</td><td class="c-gap">${sg(gap)}</td></tr>`; }).join('');
  return `<p class="wi-note">지난 기간 ${pm}월(${ps.slice(5)}~${pe.slice(5)}) · 이번 기간(${rs.slice(5)}~${re.slice(5)})<br>
    기준: 근무일 + 평일 휴가 = 평일 수(계약 기간 안). <b>지난 초과</b>만큼 이번 목표에서 뺌 → 이번 목표 = 평일 수 − 평일 휴가 − 지난 초과. 근무일엔 당직 다음날 퇴근 포함</p>
    <table class="wi-table wi-fl"><thead><tr><th>이름</th><th class="c-prev">지난 근무</th><th class="c-prev">지난 초과</th><th class="c-cur">이번 목표</th><th class="c-cur">이번 초안</th><th class="c-gap">목표 대비</th></tr></thead><tbody>${rows}</tbody></table>`;
}
// ③ 직원B 남은 휴가 — 관리자 '휴가' 탭과 같은 2분할(_flSplitHTML, 아래)
// ===== WISE 휴가 내역(파견사원 휴가신청/승인 PEDA2020) — WISE는 사내망·로그인이라 앱이 직접 못 읽음:
//  'WISE 열기'로 연 창에서 로그인·조회 → 즐겨찾기 버튼(leave-import.js)이 목록을 이 창으로 보냄(postMessage), 또는 복사해 붙여넣기 =====
const WISE_LEAVE_URL='https://wise.sbs.co.kr/wise/websquare/websquare.html?w2xPath=/wise/xml/per/d/peda2020.xml&__menuId=peda2020';
function _wlBookmarklet(){ const src=new URL('leave-import.js', location.href).href; return `javascript:(function(){var s=document.createElement('script');s.src='${src}?t='+Date.now();document.body.appendChild(s);})();`; }
function _wlBar(ro){
  if(ro) return '';
  if(window.ndApp?.wiseFetch)   // 근무표 작성 앱: 앱이 WISE를 열어(처음 한 번 로그인) 올해 휴가를 조회해 바로 가져옴
    return `<div class="wl-bar"><button class="wl-btn wl-btn-main" onclick="wlAppFetch(this)">WISE에서 올해 휴가 가져오기</button><button class="wl-btn" onclick="wlPasteToggle(this)">붙여넣기</button></div>
    <div class="wl-help">WISE 창이 열리면 처음 한 번만 로그인하세요. 그다음은 자동으로 조회해 가져옵니다.</div>
    <div class="wl-paste" hidden><textarea class="wi-in" rows="4" placeholder="WISE 목록을 복사해 붙여넣으세요(신청-이름[시작~끝]n일 …)"></textarea><button class="wl-btn" onclick="wlPasteImport(this)">가져오기</button></div>`;
  return `<div class="wl-bar"><button class="wl-btn" onclick="wlOpenWise()">WISE 열기</button><button class="wl-btn" onclick="wlPasteToggle(this)">붙여넣기</button>
    <a class="wl-bm" href="${_wiEsc(_wlBookmarklet())}" onclick="event.preventDefault();toast('이 버튼을 즐겨찾기 막대로 끌어다 놓으세요','')" title="즐겨찾기 막대로 끌어 두세요">근무표 휴가 가져오기</a></div>
    <div class="wl-help">처음 한 번: 오른쪽 <b>근무표 휴가 가져오기</b>를 즐겨찾기 막대로 끌어 두세요. 그다음 <b>WISE 열기</b> → 로그인 → 파견사원 휴가신청/승인에서 [조회] → 즐겨찾기 버튼을 누르면 바로 들어옵니다.</div>
    <div class="wl-paste" hidden><textarea class="wi-in" rows="4" placeholder="WISE 목록을 복사해 붙여넣으세요(신청-이름[시작~끝]n일 …)"></textarea><button class="wl-btn" onclick="wlPasteImport(this)">가져오기</button></div>`;
}
// 작성 앱(desktop/main.js 'nd:wise-fetch' → desktop/wise-fetch.js): WISE 조회 결과 줄을 받아 _wlImport로 저장. 진행 글은 버튼에
let _wlAppBusy=false;
async function wlAppFetch(btn){
  if(_wlAppBusy||!window.ndApp?.wiseFetch) return;
  if(typeof isAdminTest!=='undefined'&&isAdminTest){ toast('관리자 테스트 모드에서는 저장되지 않습니다.','error'); return; }
  _wlAppBusy=true; btn.disabled=true;
  _wlProg({t:'WISE 여는 중…',p:3});
  const off=window.ndApp.onWiseStatus?.(o=>_wlProg(o));
  try{
    const r=await window.ndApp.wiseFetch({year:new Date().getFullYear()});
    if(r&&r.ok){ _wlProg({t:'저장하는 중…',p:100}); if(r.lines.length) _wlImport(r.lines.join('\n')); else toast('WISE 목록이 비어 있습니다.',''); if(typeof _ndWiseState==='function') _ndWiseState(true); if(typeof _mealAppAuto==='function') setTimeout(()=>_mealAppAuto(true),500); }   // 로그인된 김에 오늘의 식사도
    else toast('WISE에서 가져오지 못했습니다: '+((r&&r.error)||'알 수 없는 오류'),'error');
  }catch(e){ toast('WISE에서 가져오지 못했습니다: '+e.message,'error'); }
  finally{ try{off&&off();}catch(e){} _wlProg(null); _wlAppBusy=false; if(btn.isConnected) btn.disabled=false; }
}
// 가져오는 동안 앱 화면 위쪽 가운데 진행 카드. o={t:글, p:0~100 | null(로그인 기다림 — 움직이는 막대)}, null이면 닫음
function _wlProg(o){
  let el=document.getElementById('wl-prog');
  if(!o){ if(el){ el.classList.add('out'); setTimeout(()=>el.remove(),260); } return; }
  if(!el){ el=document.createElement('div'); el.id='wl-prog'; el.setAttribute('role','status');
    el.innerHTML='<div class="wlp-title">WISE 휴가 가져오는 중</div><div class="wlp-bar"><i></i></div><div class="wlp-text"></div>'; document.body.appendChild(el); }
  el.querySelector('.wlp-text').textContent=o.t||'';
  const ind=typeof o.p!=='number'; el.classList.toggle('ind',ind);
  if(!ind) el.querySelector('.wlp-bar i').style.width=Math.max(3,Math.min(100,o.p))+'%';
}
function wlOpenWise(){ const w=window.open(WISE_LEAVE_URL,'nd_wise_leave','width=1200,height=800'); if(!w) toast('팝업이 막혔습니다. 주소창 오른쪽에서 팝업을 허용해 주세요.','error'); }
function wlPasteToggle(btn){ const box=btn.closest('.ws-info,.wl-host')?.querySelector('.wl-paste'); if(box){ box.hidden=!box.hidden; if(!box.hidden) box.querySelector('textarea').focus(); } }
function wlPasteImport(btn){ const ta=btn.parentElement.querySelector('textarea'); const n=_wlImport(ta.value); if(n>=0){ ta.value=''; btn.parentElement.hidden=true; } }
// WISE 목록 줄 해석: "2026-01-06 신청-이소정[2026-01-09~2026-01-09]1일 보건휴가 영상디자인팀 경영지원팀 결재완료 승인"
function _wlParse(text){
  const out=[]; String(text||'').split(/\r?\n/).forEach(line=>{
    const m=line.match(/신청-([^\[\s]+)\[(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})\]\s*([\d.]+)\s*일/); if(!m) return;
    const rest=line.slice(line.indexOf(m[0])+m[0].length).split(/\t|\s{2,}|\s/).map(t=>t.trim()).filter(Boolean);
    const req=(line.match(/(\d{4}-\d{2}-\d{2})/)||[])[1];
    out.push({name:m[1], s:m[2], e:m[3], days:+m[4], type:rest.find(t=>/휴가$/.test(t))||'', status:rest.find(t=>/결재|반려|진행|취소|대기|상신/.test(t))||'', gubun:rest.length?rest[rest.length-1]:'', req:req!==m[2]?req:''}); });
  return out;
}
function _wlImport(text){
  if(typeof isAdminTest!=='undefined'&&isAdminTest){ toast('관리자 테스트 모드에서는 저장되지 않습니다.','error'); return -1; }
  const items=_wlParse(text); if(!items.length){ toast('휴가 줄을 찾지 못했습니다.','error'); return -1; }
  data.freelancerLeave=data.freelancerLeave||{}; const now=new Date().toISOString(), people=new Set(); let n=0;
  items.forEach(it=>{ const ss=data.staff.filter(s=>s.name===it.name&&s.active!==false&&s.employmentType==='freelancer'); if(ss.length!==1) return;   // 직원B만
    const rec=data.freelancerLeave[ss[0].id]=data.freelancerLeave[ss[0].id]||{};
    rec.wise=_wlDedup([...(rec.wise||[]),{s:it.s,e:it.e,days:it.days,type:it.type,status:it.status,gubun:it.gubun,req:it.req}]); rec.wiseAt=now; people.add(ss[0].id); n++; });
  if(n){ saveData(data); toast(`직원B ${people.size}명의 WISE 휴가 ${n}건을 가져왔습니다.`,'success'); }
  else toast('WISE 목록에 직원B 이름이 없습니다.','error');
  wsInfoRefresh(); _flLeaveTabRefresh(); if(typeof _wlStaffModalRefresh==='function') _wlStaffModalRefresh();
  return n;
}
window.addEventListener('message',e=>{ if(e.origin!=='https://wise.sbs.co.kr'||!e.data||e.data.type!=='nd-wise-leave') return; _wlImport(String(e.data.text||'')); });
// 그해 사용(결재완료·승인, 취소·반려 제외) 일수 — 내역이 없으면 null
function _wlUsed(id,yr){ const L=data.freelancerLeave?.[id]?.wise; if(!L||!L.length) return null; return L.filter(x=>x.s.startsWith(yr)&&!/취소|반려/.test(x.status+x.gubun)).reduce((a,x)=>a+(+x.days||0),0); }
// 칸 구분 없이 붙어 들어온 줄(예: 구분 빈칸·상태 '보건휴가영상디자인팀…결재완료승인') 바로잡기
function _wlNorm(x){
  if(x.type) return x;
  const src=String(x.status||'')+String(x.gubun||''), t=src.match(/([가-힣]{0,4}휴가)/);
  return {...x, type:t?t[1]:'', status:(src.match(/(결재완료|결재중|결재대기|반려|진행중|취소|대기|상신)/)||[])[1]||x.status, gubun:(src.match(/(승인|반려|취소)$/)||[])[1]||x.gubun};
}
// 같은 휴가(시작·끝·구분)는 하나로(나중 것), 날짜순
function _wlDedup(L){ const m=new Map(); L.map(_wlNorm).forEach(x=>m.set(x.s+'|'+x.e+'|'+x.type,x)); return [...m.values()].sort((a,b)=>a.s<b.s?-1:a.s>b.s?1:0); }
// 휴가 한 건(시작~끝, n일)의 날짜들 — 표에 '03/21, 03/22, 03/23'처럼 풀어 씀. 기간이 일수보다 길면(주말·공휴일 낀 휴가) 평일만
function _wlDates(x){
  const all=[]; const d=new Date(x.s+'T00:00:00'), e=new Date((x.e||x.s)+'T00:00:00');
  for(let i=0;i<62&&d<=e;i++){ all.push(toDateStr(d.getFullYear(),d.getMonth()+1,d.getDate())); d.setDate(d.getDate()+1); }
  if(!all.length) return [{ds:x.s,n:+x.days||1}];
  if(all.length===1) return [{ds:all[0],n:+x.days||1}];
  const n=+x.days||all.length, wd=all.length>n?all.filter(ds=>isWeekdayForm(ds)):all, use=wd.length?wd:all;
  return use.map(ds=>({ds,n:1}));
}
function _wlListHTML(id,editable){   // editable: 직접 넣은 줄 지우기(관리자 휴가 탭)
  const rec=data.freelancerLeave?.[id]||{}, L=_wlDedup(rec.wise||[]);
  if(!L.length) return '<div class="wl-empty">휴가 내역이 없습니다.'+(editable?' 위에서 직접 넣을 수 있어요.':'')+'</div>';
  const byType={}; L.filter(x=>!/취소|반려/.test(x.status+x.gubun)).forEach(x=>{ byType[x.type||'휴가']=(byType[x.type||'휴가']||0)+(+x.days||0); });
  return `<div class="wl-sum">${Object.entries(byType).map(([t,d])=>`<span>${_wiEsc(t)} <b>${d}일</b></span>`).join('')}<small>가져온 날 ${_wiEsc((rec.wiseAt||'').slice(0,10))}</small></div>
    <table class="wl-list"><thead><tr><th>휴가 날짜</th><th>일수</th><th>구분</th><th>상태</th>${editable?'<th></th>':''}</tr></thead><tbody>${[...L].reverse().map(x=>{ const off=/취소|반려/.test(x.status+x.gubun), ty=x.type||'휴가';
      const tc=/보건/.test(ty)?'t-health':/연차/.test(ty)?'t-annual':/특별/.test(ty)?'t-special':'t-etc';
      return `<tr class="${off?'wl-off':''}"><td class="wl-d">${_wlDates(x).map(d=>_wiEsc(d.ds.slice(5).replace('-','/'))).join(', ')}</td><td class="wl-n">${x.days}일</td><td><span class="wl-type ${tc}">${_wiEsc(ty)}</span></td><td><span class="wl-st${off?' off':''}${x.manual?' manual':''}">${_wiEsc(x.status||x.gubun||'-')}</span></td>${editable?`<td class="wl-x">${x.manual?`<button type="button" title="지우기" aria-label="지우기" onclick="flDelLeave('${id}','${_wiEsc(x.s+'|'+x.e+'|'+x.type)}')">✕</button>`:''}</td>`:''}</tr>`; }).join('')}</tbody></table>`;
}
// 참고 자료 창에서 이름 → 직원 카드(직원 편집 창, 오른쪽에 WISE 휴가 내역)를 앱 화면에 띄움(별도 창이면 앱 창을 앞으로)
function wsInfoPerson(id){
  if(!data.staff.some(x=>x.id===id)) return;
  openStaffModal(id);
  try{ window.focus(); }catch(e){}
}
// 관리자 패널 '휴가' 탭 — 2분할: 왼쪽 직원B 목록(카드 아무 데나 누르면 선택), 오른쪽 그 사람의 남은 휴가·메모(저장)와 WISE 휴가 내역. 팝업 없음. 기준 날짜 = 오늘
let _flSel=null;
function renderFlLeaveTab(){
  const host=document.getElementById('fleave-area'); if(!host) return;
  const n=new Date(); host.innerHTML=_flSplitHTML(toDateStr(n.getFullYear(),n.getMonth()+1,n.getDate()),true);
}
// 2분할 HTML(관리자 '휴가' 탭 = 오늘 기준·WISE 가져오기 버튼, 참고 자료 '직원B 남은 휴가' = 작성소 기간 기준·버튼 없음). 고른 사람(_flSel)은 둘이 같이 씀
function _flSplitHTML(ds,withBar){
  const yr=ds.slice(0,4), ro=typeof isAdminTest!=='undefined'&&isAdminTest, list=_wiFreelancers(ds), fl=data.freelancerLeave||{};
  const top=withBar?_wlBar(ro):'<p class="wi-note">카드를 누르면 오른쪽에 그 사람 휴가가 나옵니다. WISE 휴가는 관리자 패널 \'휴가\' 탭에서 가져옵니다.</p>';
  if(!list.length) return top+'<div class="wi-empty">직원B가 없습니다.</div>';
  if(!list.some(s=>s.id===_flSel)) _flSel=list[0].id;
  const av=()=>'';   // 성씨 동그라미는 뺌(10-21 사용자)
  const items=list.map(s=>{ const dept=String(deptOn(s,ds)||''), v=fl[s.id]||{}, used=_wlUsed(s.id,yr);
    return `<button type="button" class="fl-item${s.id===_flSel?' on':''}" aria-pressed="${s.id===_flSel}" onclick="flSelect('${s.id}')">${av(s,dept)}
      <span class="fl-id"><b>${_wiEsc(s.name)}</b><small>${_wiEsc(dept)}</small></span>
      <span class="fl-meta">${v.days!=null?`<span class="fl-left">남은 <b>${v.days}</b>일</span>`:''}${used!=null?`<em class="wl-used">사용 ${used}일</em>`:''}</span></button>`; }).join('');
  const s=list.find(x=>x.id===_flSel), dept=String(deptOn(s,ds)||''), v=fl[s.id]||{}, used=_wlUsed(s.id,yr);
  const term=s.contractStart||s.contractEnd?`계약 ${_wiEsc((s.contractStart||'').replace(/-/g,'.'))} ~ ${_wiEsc((s.contractEnd||'').replace(/-/g,'.'))}`:'';
  return `${top}<div class="fl-split">
    <div class="fl-list" role="list" aria-label="직원B">${items}</div>
    <div class="fl-detail" data-sid="${s.id}">
      <div class="fl-head">${av(s,dept)}<div class="fl-id"><b>${_wiEsc(s.name)}</b><small>${_wiEsc([dept,term].filter(Boolean).join(' · '))}</small></div>${used!=null?`<em class="wl-used">${yr}년 사용 ${used}일</em>`:''}</div>
      <div class="fl-edit">
        <label class="wl-days">남은 휴가<input type="number" class="wi-in" min="0" max="99" step="0.5" value="${v.days??''}" placeholder="-" aria-label="남은 휴가 일수" ${ro?'disabled':''}><b>일</b></label>
        <input type="text" class="wi-in wi-memo" value="${_wiEsc(v.memo||'')}" placeholder="메모" aria-label="메모" ${ro?'disabled':''}>
        ${ro?'':`<button type="button" class="fl-save" onclick="flSaveOne(this)">저장</button>`}
      </div>
      ${v.at?`<div class="fl-at">고친 날 ${_wiEsc(v.at.slice(0,10).replace(/-/g,'.'))}</div>`:''}
      <div class="fl-sec">휴가 내역 <small>WISE에서 가져온 것 + 직접 넣은 것</small></div>
      ${withBar&&!ro?`<div class="fl-add">
        <input type="date" class="wi-in" id="fl-add-start" aria-label="휴가 시작" onchange="_flAddDays()">
        <span class="fl-tilde">~</span>
        <input type="date" class="wi-in" id="fl-add-end" aria-label="휴가 끝(하루면 비움)" onchange="_flAddDays()">
        <select class="wi-in" id="fl-add-type" aria-label="휴가 구분" onchange="_flAddDays()">${['연차휴가','반차','보건휴가','특별휴가','경조휴가','기타휴가'].map(t=>`<option>${t}</option>`).join('')}</select>
        <label class="fl-add-n"><input type="number" class="wi-in" id="fl-add-days" min="0.5" max="60" step="0.5" placeholder="-" aria-label="일수">일</label>
        <button type="button" class="fl-save" onclick="flAddLeave('${s.id}')">추가</button>
      </div>`:''}
      ${_wlListHTML(s.id, withBar&&!ro)}
    </div></div>`;
}
function flSelect(id){ _flSel=id; _flLeaveTabRefresh(); wsInfoRefresh(); }
// 직접 넣기: 날짜를 고르면 일수를 저절로(평일 수 — 공휴일은 뺌(ndIsOffDay, js/holiday-work.js), 반차 = 0.5). isWeekdayForm 은 편성 틀이라 성탄절 등 평일 틀 공휴일도 셈
function _flAddDays(){
  const a=document.getElementById('fl-add-start')?.value, b=document.getElementById('fl-add-end')?.value||a, ty=document.getElementById('fl-add-type')?.value, n=document.getElementById('fl-add-days');
  if(!a||!n) return;
  if(ty==='반차'){ n.value=0.5; return; }
  if(b<a){ n.value=''; return; }
  n.value=_wlDates({s:a,e:b,days:0}).filter(d=>typeof ndIsOffDay==='function'?!ndIsOffDay(d.ds):isWeekdayForm(d.ds)).length||1;
}
function flAddLeave(id){
  if(typeof isAdminTest!=='undefined'&&isAdminTest){ toast('관리자 테스트 모드에서는 저장되지 않습니다.','error'); return; }
  const a=document.getElementById('fl-add-start').value, b=document.getElementById('fl-add-end').value||a, ty=document.getElementById('fl-add-type').value;
  const days=+document.getElementById('fl-add-days').value;
  if(!a){ toast('휴가 날짜를 고르세요.','error'); return; }
  if(b<a){ toast('끝 날짜가 시작보다 앞입니다.','error'); return; }
  if(!(days>0)){ toast('일수를 적으세요.','error'); return; }
  data.freelancerLeave=data.freelancerLeave||{}; const rec=data.freelancerLeave[id]=data.freelancerLeave[id]||{};
  const type=ty==='반차'?'연차휴가':ty;   // 반차 = 연차 0.5일
  rec.wise=_wlDedup([...(rec.wise||[]),{s:a,e:b,days:ty==='반차'?0.5:days,type,status:'직접 입력',gubun:'',req:'',manual:true}]);
  saveData(data); toast('휴가를 넣었습니다.','success'); _flLeaveTabRefresh(); wsInfoRefresh(); if(typeof _wlStaffModalRefresh==='function') _wlStaffModalRefresh();
}
// 직접 넣은 휴가만 지움(WISE 에서 온 줄은 다시 가져오면 되돌아오므로 지우지 않음)
function flDelLeave(id,key){
  if(typeof isAdminTest!=='undefined'&&isAdminTest){ toast('관리자 테스트 모드에서는 저장되지 않습니다.','error'); return; }
  const rec=data.freelancerLeave?.[id]; if(!rec?.wise) return;
  const L=rec.wise.filter(x=>!(x.manual&&(x.s+'|'+x.e+'|'+x.type)===key)); if(L.length===rec.wise.length) return;
  rec.wise=L; saveData(data); toast('지웠습니다.','success'); _flLeaveTabRefresh(); wsInfoRefresh(); if(typeof _wlStaffModalRefresh==='function') _wlStaffModalRefresh();
}
function flSaveOne(btn){
  if(typeof isAdminTest!=='undefined'&&isAdminTest){ toast('관리자 테스트 모드에서는 저장되지 않습니다.','error'); return; }
  const box=btn.closest('.fl-detail'), id=box?.dataset.sid; if(!id) return;
  const d=box.querySelector('.wl-days input'), m=box.querySelector('.wi-memo'), days=d.value===''?null:Math.max(0,+d.value), memo=m.value.trim();
  data.freelancerLeave=data.freelancerLeave||{}; const old=data.freelancerLeave[id]||{};
  if((old.days??null)===days&&(old.memo||'')===memo){ toast('바뀐 내용이 없습니다.',''); return; }
  if(days===null&&!memo&&!(old.wise&&old.wise.length)) delete data.freelancerLeave[id]; else data.freelancerLeave[id]={...old,days,memo,at:new Date().toISOString()};
  saveData(data); toast('저장했습니다.','success'); _flLeaveTabRefresh(); wsInfoRefresh();
}
function _flLeaveTabRefresh(){ if(document.getElementById('panel-fleave')?.classList.contains('active')) renderFlLeaveTab(); }

// ===== 작성소 초안 = 회사 공용 네트워크 드라이브(11-09 사용자: "컴퓨터에서만 하는 작업은 공용 네트워크 드라이브", "근무표 작성은 휴대폰에서 안 되게 — 그럼 Supabase 에 올릴 필요 없음") =====
// · 작성소는 PC 앱(1.4.2~, 공유 폴더 이름 'wsdraft'·'wstabs')에서만 — 휴대폰·브라우저·옛 앱은 막음(_wsGate).
// · 'wsdraft' = { list:[{id,name}], active, draft } — 지금 보는 탭 + 탭 목록. 편집할 때마다(0.6초 모아) 씀. data.draft·data.draftTabs 가 이 내용.
//   'wstabs' = { drafts:{ <탭id>: 초안 } } — 안 보는 탭들. 탭을 바꿀 때만 읽고 씀.
// · Supabase main 문서에서는 초안을 뺌: data.settings.draftOnShare 가 켜지면 저장(_ndServerView, js/core.js)에 draft·draftTabs 를 안 넣고,
//   받은 문서에 남은 옛 초안은 무시(_wsAttach). 처음 한 번 PC 앱이 서버 초안(+ 11-09 시험판이 서버 줄 wsdraft_<id> 에 둔 탭)을 공유 폴더로 옮긴 뒤에 켬(_wsSeed).
// · 다른 PC에서 같은 관리자가 고친 것: 작성소에 들어올 때마다 공유 폴더 판(ver)을 보고 바뀌었으면 받음. 같은 때 두 PC가 쓰면 나중 것이 이김.
const WS_DOC='wsdraft', WS_TABS='wstabs';
const _ws={ready:false,ver:0,err:'',loading:null,hash:'',timer:0,writing:false,again:false,savedAt:'',failToast:0};
let _wsSrvDraft=null;   // 아직 안 옮겼을 때 서버에서 받은 초안·탭(옮길 원본)
let _wsTabBusy=false;
const _wsTabEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function _wsAvail(){ try{ const a=typeof window!=='undefined'&&window.ndApp; return !!(a&&Array.isArray(a.shareNames)&&a.shareNames.includes(WS_DOC)&&a.shareNames.includes(WS_TABS)&&a.shareRead&&a.shareWrite); }catch(e){ return false; } }
// data 를 서버(또는 기기·공유 폴더 사본) 문서로 바꾼 직후(js/sync-init.js) — prev* = 바꾸기 전 화면의 초안·탭
function _wsAttach(prevDraft,prevTabs){
  if(_ws.ready){ if(prevDraft) data.draft=prevDraft; if(prevTabs) data.draftTabs=prevTabs; return; }   // 공유 폴더 초안이 진짜
  if(data.settings&&data.settings.draftOnShare){ data.draft={schedule:{},newLeaves:{}}; delete data.draftTabs; return; }   // 서버에 남은 옛 초안은 안 씀
  _wsSrvDraft={draft:data.draft,tabs:data.draftTabs};   // 아직 안 옮김 — 지금은 서버 초안이 진짜
}
function _wsTabs(){
  let t=data.draftTabs;
  if(!t||typeof t!=='object'||!Array.isArray(t.list)||!t.list.length){ t={list:[{id:'t1',name:'초안 1'}],active:'t1'}; data.draftTabs=t; }
  if(!t.list.some(x=>x.id===t.active)) t.active=t.list[0].id;
  return t;
}
function _wsTabCur(){ const t=_wsTabs(); return t.list.find(x=>x.id===t.active); }
function _wsDoc(){ const t=_wsTabs(); return {list:t.list.map(x=>({id:x.id,name:x.name})),active:t.active,draft:data.draft||{schedule:{},newLeaves:{}}}; }
function _wsTabBlank(){ const d=data.draft||{}; return {schedule:{},newLeaves:{},rangeStart:d.rangeStart||wsRangeStart||undefined,rangeEnd:d.rangeEnd||wsRangeEnd||undefined}; }
function _wsTime(iso){ if(!iso) return ''; const d=new Date(iso); if(isNaN(d)) return ''; const p=n=>String(n).padStart(2,'0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
// 받은 공유 폴더 문서를 화면에
function _wsApply(doc,ver){
  const list=Array.isArray(doc&&doc.list)&&doc.list.length?doc.list.map(x=>({id:String(x.id),name:String(x.name||'초안')})):[{id:'t1',name:'초안 1'}];
  data.draftTabs={list,active:list.some(x=>x.id===doc.active)?doc.active:list[0].id};
  _wsTabShow(doc&&doc.draft);
  _ws.ver=ver; _ws.ready=true; _ws.err='';
  _ws.hash=ndTextHash(JSON.stringify(_wsDoc()));
}
// 고른 탭 내용을 화면에 — 기간도 그 탭 기간으로, 뒤로가기는 탭마다 따로라 비움
function _wsTabShow(draft){
  data.draft=draft&&typeof draft==='object'?draft:{schedule:{},newLeaves:{}};
  data.draft.schedule ||= {}; data.draft.newLeaves ||= {};
  _wsHistory=[]; _updateUndoBtn();
  if(data.draft.rangeStart&&data.draft.rangeEnd){
    wsRangeStart=data.draft.rangeStart; wsRangeEnd=data.draft.rangeEnd;
    const s=document.getElementById('ws-start'), e=document.getElementById('ws-end');
    if(s) s.value=wsRangeStart; if(e) e.value=wsRangeEnd;
  }
}
// 공유 폴더에서 받기(처음이면 서버 초안을 옮김) → { ok, changed }
function _wsLoad(){
  if(!_wsAvail()) return Promise.resolve({ok:false});
  if(_ws.loading) return _ws.loading;
  _ws.loading=(async()=>{
    try{
      const r=await window.ndApp.shareRead(WS_DOC);
      if(!r||!r.ok){ _ws.err=(r&&r.error)||'공유 폴더에 연결이 안 돼요.'; return {ok:false}; }
      if(!r.data) return await _wsSeed(r.ver);
      if(_ws.ready&&(r.ver===_ws.ver||_ws.timer||_ws.writing)) { _ws.err=''; return {ok:true,changed:false}; }   // 그대로이거나 이 PC가 쓰는 중(내 것이 최신)
      _wsApply(r.data,r.ver); return {ok:true,changed:true};
    }catch(e){ _ws.err=String((e&&e.message)||e); return {ok:false}; }
    finally{ _ws.loading=null; }
  })();
  return _ws.loading;
}
// 처음 한 번: 서버에 있던 초안·탭을 공유 폴더로 옮기고, 그다음부터 서버 저장에서 초안을 뺌
async function _wsSeed(ver){
  if(typeof _bootRemoteOk!=='undefined'&&!_bootRemoteOk){ _ws.err='근무표를 아직 서버에서 못 받았어요. 잠시 뒤 다시 열어 주세요.'; return {ok:false}; }   // 옛 기기 저장본으로 옮기면 안 됨
  const flagged=!!(data.settings&&data.settings.draftOnShare);
  const src=(!flagged&&_wsSrvDraft)||{};
  const draft=src.draft&&typeof src.draft==='object'?JSON.parse(JSON.stringify(src.draft)):{schedule:{},newLeaves:{}};
  const tabs=src.tabs&&Array.isArray(src.tabs.list)&&src.tabs.list.length?JSON.parse(JSON.stringify(src.tabs)):{list:[{id:'t1',name:'초안 1'}],active:'t1'};
  if(!tabs.list.some(x=>x.id===tabs.active)) tabs.active=tabs.list[0].id;
  const others={};   // 안 보는 탭 — 11-09 시험판이 서버 줄 wsdraft_<id> 에 둠
  for(const tb of tabs.list){
    if(tb.id===tabs.active) continue;
    try{ const r=await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.${encodeURIComponent('wsdraft_'+tb.id)}&select=payload`,{headers:SB_HEADERS,cache:'no-store'});
      if(r.ok){ const a=await r.json(), p=a&&a[0]&&a[0].payload; if(p&&p.draft&&typeof p.draft==='object') others[tb.id]=p.draft; } }catch(e){}
  }
  if(Object.keys(others).length&&!(await _wsTabsEdit(m=>{ Object.keys(others).forEach(k=>{ if(!m[k]) m[k]=others[k]; }); }))){ _ws.err='공유 폴더에 쓰지 못했어요.'; return {ok:false}; }
  const doc={list:tabs.list.map(x=>({id:x.id,name:x.name})),active:tabs.active,draft};
  const w=await window.ndApp.shareWrite(WS_DOC,doc,ver);
  if(!w||!w.ok){
    if(w&&w.conflict){ const r2=await window.ndApp.shareRead(WS_DOC); if(r2&&r2.ok&&r2.data){ _wsApply(r2.data,r2.ver); return {ok:true,changed:true}; } }   // 그새 다른 PC가 옮김
    _ws.err=(w&&w.error)||'공유 폴더에 쓰지 못했어요.'; return {ok:false};
  }
  _wsApply(doc,w.ver);
  if(!flagged){ data.settings.draftOnShare=true; saveData(data); }   // 이제부터 서버에는 초안을 안 올림(옮긴 뒤에만 — 못 옮기면 서버 초안 그대로)
  Object.keys(others).forEach(_wsSrvRowDel);
  _wsSrvDraft=null;
  toast('작성소 초안을 회사 공용 네트워크 드라이브로 옮겼어요 — 이제 서버에 안 올라가요','success');
  return {ok:true,changed:true};
}
function _wsSrvRowDel(id){
  const url=`${SB_URL}/rest/v1/nd_data?id=eq.${encodeURIComponent('wsdraft_'+id)}`;
  fetch(url,{method:'DELETE',headers:SB_HEADERS}).then(r=>{ if(!r.ok) return fetch(url,{method:'PATCH',headers:SB_HEADERS,body:JSON.stringify({payload:{}})}); }).catch(()=>{});
}
// 안 보는 탭 파일 고치기(읽은 판 그대로일 때만 씀, 겹치면 다시 읽고) → 성공 여부
async function _wsTabsEdit(mutate){
  for(let i=0;i<4;i++){
    const r=await window.ndApp.shareRead(WS_TABS);
    if(!r||!r.ok) return false;
    const m=(r.data&&r.data.drafts&&typeof r.data.drafts==='object')?r.data.drafts:{};
    mutate(m);
    const w=await window.ndApp.shareWrite(WS_TABS,{drafts:m},r.ver);
    if(w&&w.ok) return true;
    if(!w||!w.conflict) return false;
  }
  return false;
}
async function _wsTabsGet(id){
  const r=await window.ndApp.shareRead(WS_TABS);
  if(!r||!r.ok) throw Error((r&&r.error)||'read');
  const d=r.data&&r.data.drafts&&r.data.drafts[id];
  return d&&typeof d==='object'?d:null;
}
// 저장(saveData, js/core.js)마다 — 초안·탭이 바뀌었으면 0.6초 모아 공유 폴더에
function _wsAfterSave(){
  if(!_ws.ready||isAdminTest) return;
  let h=''; try{ h=ndTextHash(JSON.stringify(_wsDoc())); }catch(e){ return; }
  if(h===_ws.hash) return;
  clearTimeout(_ws.timer); _ws.timer=setTimeout(_wsFlush,600);
}
async function _wsFlush(){
  _ws.timer=0;
  if(_ws.writing){ _ws.again=true; return; }
  _ws.writing=true;
  try{
    do{
      _ws.again=false;
      const doc=_wsDoc(), h=ndTextHash(JSON.stringify(doc));
      if(h===_ws.hash) break;
      let w=await window.ndApp.shareWrite(WS_DOC,doc,_ws.ver);
      if(w&&!w.ok&&w.conflict) w=await window.ndApp.shareWrite(WS_DOC,doc,w.ver);   // 다른 PC가 썼어도 지금 이 화면(작업하는 관리자) 내용으로
      if(!w||!w.ok){
        if(Date.now()-_ws.failToast>60e3){ _ws.failToast=Date.now(); toast('공용 네트워크 드라이브에 저장하지 못했어요 — 연결을 확인해 주세요(다시 시도 중)','error'); }
        clearTimeout(_ws.timer); _ws.timer=setTimeout(_wsFlush,10e3);
        break;
      }
      _ws.ver=w.ver; _ws.hash=h; _ws.savedAt=new Date().toISOString();
    }while(_ws.again);
  }finally{ _ws.writing=false; try{ _wsTabsRender(); }catch(e){} }
}
// 지금 바로 쓰고 끝날 때까지 기다림 → 저장됐는지
async function _wsFlushNow(){
  clearTimeout(_ws.timer); _ws.timer=0;
  for(let i=0;i<200&&_ws.writing;i++) await new Promise(r=>setTimeout(r,50));
  await _wsFlush();
  for(let i=0;i<200&&_ws.writing;i++) await new Promise(r=>setTimeout(r,50));
  try{ return ndTextHash(JSON.stringify(_wsDoc()))===_ws.hash; }catch(e){ return false; }
}
// 작성소를 쓸 수 있는지 — 아니면 안내만 보이고 표·도구는 숨김
function _wsGate(){
  const v=document.getElementById('view-workshop'), g=document.getElementById('ws-gate');
  if(!v||!g) return true;
  let title='', body='', retry=false;
  if(!_wsAvail()){
    const app=typeof window!=='undefined'&&!!window.ndApp, ver=(typeof _ndAppVer==='function'&&_ndAppVer(navigator.userAgent))||'';
    title=app?'근무표 앱을 업데이트해 주세요':'근무표 작성은 회사 PC의 근무표 앱에서만 할 수 있어요';
    body=app?`작성소는 근무표 앱 1.4.2부터 회사 공용 네트워크 드라이브에 저장해요. NDT 런처에서 근무표를 업데이트해 주세요.${ver?` (지금 ${_wsTabEsc(ver)})`:''}`:'작성 중인 초안은 회사 공용 네트워크 드라이브에만 저장돼요(서버에 올리지 않음). 휴대폰과 일반 브라우저에서는 열 수 없어요.';
  } else if(!_ws.ready){
    if(_ws.err){ title='회사 공용 네트워크 드라이브에 연결이 안 돼요'; body=_wsTabEsc(_ws.err)+' — 회사 네트워크에서 다시 시도해 주세요.'; retry=true; }
    else { title='초안을 불러오는 중이에요…'; body='회사 공용 네트워크 드라이브에서 읽고 있어요.'; }
  }
  const lock=!!title;
  v.classList.toggle('ws-locked',lock);
  g.innerHTML=lock?`<div class="ws-gate-card" role="status"><div class="ws-gate-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div><h3>${title}</h3><p>${body}</p>${retry?'<button type="button" class="ws-tab-save" onclick="_wsRetry()">다시 시도</button>':''}</div>`:'';
  return !lock;
}
function _wsRetry(){ _ws.err=''; _wsGate(); _wsLoad().then(()=>{ if(typeof currentView!=='undefined'&&currentView==='workshop') renderWorkshop(); }); }
// 작성소에 들어올 때(renderWorkshop) — 아직이면 받고, 받았으면 다른 PC가 고쳤는지 확인
function _wsEnter(){
  if(!_wsAvail()) return;
  _wsLoad().then(res=>{ if(typeof currentView==='undefined'||currentView!=='workshop') return; if(res.changed) renderWorkshop(); else if(!res.ok) _wsGate(); });   // 실패면 안내만(다시 그리면 또 읽어 끝없이 돎)
}
function _wsTabsRender(){
  const el=document.getElementById('ws-tabs'); if(!el) return;
  if(!isAdmin||!_ws.ready){ el.innerHTML=''; return; }
  _wsTabBind(el);
  const t=_wsTabs(), many=t.list.length>1;
  const X='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const pending=!!(_ws.timer||_ws.writing), saved=_wsTime(_ws.savedAt);
  el.innerHTML=t.list.map(tb=>{ const on=tb.id===t.active, nm=_wsTabEsc(tb.name);
    return `<div class="ws-tab${on?' on':''}" role="tab" tabindex="0" aria-selected="${on}" data-tab="${_wsTabEsc(tb.id)}" title="${nm} — 더블클릭: 이름 바꾸기 · 오른쪽 클릭: 메뉴"><span class="nm">${nm}</span>${many?`<span class="x" data-x="1" role="button" aria-label="${nm} 탭 닫기" title="탭 닫기">${X}</span>`:''}</div>`; }).join('')
    +`<button class="ws-tab-add" type="button" data-add="1" aria-label="새 탭" title="새 탭"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>`
    +`<span class="ws-tab-right"><span class="ws-tab-saved" title="작성소 초안은 회사 공용 네트워크 드라이브에만 저장돼요(서버에 안 올림)">${pending?'저장 중…':saved?`${saved} 공용 드라이브에 저장됨`:'공용 드라이브에 저장'}</span><button class="ws-tab-save" type="button" data-save="1"${_wsTabBusy?' disabled':''}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>임시저장</button></span>`;
  el.classList.toggle('busy',_wsTabBusy);
}
function _wsTabBind(el){
  if(el._wsTabBound) return; el._wsTabBound=true;
  el.addEventListener('click',e=>{
    if(e.target.closest('input')) return;
    if(e.target.closest('[data-save]')){ wsTabSave(); return; }
    if(e.target.closest('[data-add]')){ _wsTabMenu(e.target.closest('[data-add]'),[{t:'빈 탭 새로 만들기',f:()=>wsTabNew(false)},{t:'지금 탭 복사해서 만들기',f:()=>wsTabNew(true)}]); return; }
    const tab=e.target.closest('.ws-tab'); if(!tab) return;
    if(e.target.closest('[data-x]')){ wsTabClose(tab.dataset.tab); return; }
    wsTabSwitch(tab.dataset.tab);
  });
  el.addEventListener('dblclick',e=>{ const tab=e.target.closest('.ws-tab'); if(tab&&!e.target.closest('[data-x]')) wsTabRename(tab.dataset.tab); });
  el.addEventListener('contextmenu',e=>{ const tab=e.target.closest('.ws-tab'); if(!tab||e.target.closest('input')) return; e.preventDefault(); const id=tab.dataset.tab;
    _wsTabMenu(tab,[{t:'이름 바꾸기',f:()=>wsTabRename(id)},{t:'복사해서 새 탭',f:()=>{ if(id===_wsTabs().active) wsTabNew(true); else wsTabSwitch(id).then(ok=>{ if(ok) wsTabNew(true); }); }},...(_wsTabs().list.length>1?[{t:'탭 닫기',f:()=>wsTabClose(id),danger:true}]:[])]); });
  el.addEventListener('keydown',e=>{ const tab=e.target.closest('.ws-tab'); if(!tab||e.target.closest('input')) return;
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); wsTabSwitch(tab.dataset.tab); } else if(e.key==='F2'){ e.preventDefault(); wsTabRename(tab.dataset.tab); } });
}
function _wsTabMenu(anchor,items){
  document.getElementById('ws-tab-menu')?.remove();
  const m=document.createElement('div'); m.id='ws-tab-menu'; m.className='ws-tab-menu'; m.setAttribute('role','menu');
  items.forEach(it=>{ const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem'); b.textContent=it.t; if(it.danger) b.className='danger'; b.onclick=()=>{ close(); it.f(); }; m.appendChild(b); });
  document.body.appendChild(m);
  const r=anchor.getBoundingClientRect(), w=m.offsetWidth;
  m.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px'; m.style.top=(r.bottom+4)+'px';
  m.querySelector('button')?.focus();
  function close(){ m.remove(); document.removeEventListener('pointerdown',off,true); document.removeEventListener('keydown',esc,true); }
  function off(e){ if(!m.contains(e.target)) close(); }
  function esc(e){ if(e.key==='Escape') close(); }
  setTimeout(()=>{ document.addEventListener('pointerdown',off,true); document.addEventListener('keydown',esc,true); },0);
}
function _wsTabOk(){
  if(!isAdmin||_wsTabBusy||!_ws.ready) return false;
  if(isAdminTest){ toast('관리자 테스트 모드 — 탭은 바꿀 수 없어요(저장 안 됨).','error'); return false; }
  return true;
}
async function wsTabSwitch(id){
  const t=_wsTabs(); if(id===t.active) return true;
  if(!_wsTabOk()||!t.list.some(x=>x.id===id)) return false;
  _wsTabBusy=true; _wsTabsRender();
  try{
    const cur=_wsTabCur(), keep=JSON.parse(JSON.stringify(data.draft||{}));
    if(!(await _wsTabsEdit(m=>{ m[cur.id]=keep; }))) throw Error('tabs');   // 지금 탭 먼저 보관 — 실패하면 안 바꿈
    const next=await _wsTabsGet(id);
    t.active=id; _wsTabShow(next||_wsTabBlank());
    await _wsFlushNow();
    renderWorkshopTable();
    return true;
  }catch(e){ toast('탭을 바꾸지 못했어요. 공용 드라이브 연결을 확인해 주세요.','error'); return false; }
  finally{ _wsTabBusy=false; _wsTabsRender(); }
}
async function wsTabNew(copy){
  if(!_wsTabOk()) return;
  const t=_wsTabs(), cur=_wsTabCur();
  _wsTabBusy=true; _wsTabsRender();
  try{
    const keep=JSON.parse(JSON.stringify(data.draft||{}));
    if(!(await _wsTabsEdit(m=>{ m[cur.id]=keep; }))) throw Error('tabs');
    const names=new Set(t.list.map(x=>x.name));
    let name=copy?`${cur.name} 복사`:`초안 ${t.list.length+1}`; for(let i=2;names.has(name);i++) name=copy?`${cur.name} 복사 ${i}`:`초안 ${t.list.length+i}`;
    const id='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    t.list.push({id,name}); t.active=id;
    _wsTabShow(copy?keep:_wsTabBlank());
    await _wsFlushNow();
    renderWorkshopTable();
    toast(copy?`'${name}' 탭을 만들었어요(복사본)`:`'${name}' 빈 탭을 만들었어요 — ① 신휴가부터 채우세요`,'success');
  }catch(e){ toast('새 탭을 만들지 못했어요. 공용 드라이브 연결을 확인해 주세요.','error'); }
  finally{ _wsTabBusy=false; _wsTabsRender(); }
}
async function wsTabSave(){
  if(!isAdmin||!_ws.ready) return;
  if(isAdminTest){ toast('관리자 테스트 모드 — 저장되지 않아요.','error'); return; }
  const ok=await _wsFlushNow();
  if(ok) toast(`'${_wsTabCur().name}' 임시저장했어요 — 공용 네트워크 드라이브(배포 전까지 그대로)`,'success'); else toast('임시저장하지 못했어요. 공용 드라이브 연결을 확인해 주세요.','error');
}
function wsTabRename(id){
  if(!_wsTabOk()) return;
  const t=_wsTabs(), tb=t.list.find(x=>x.id===id); if(!tb) return;
  const el=document.querySelector(`#ws-tabs .ws-tab[data-tab="${CSS.escape(id)}"] .nm`); if(!el) return;
  const inp=document.createElement('input'); inp.className='ws-tab-input'; inp.value=tb.name; inp.maxLength=30; inp.setAttribute('aria-label','탭 이름');
  el.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const fin=ok=>{ if(done) return; done=true; const v=inp.value.trim().slice(0,30);
    if(ok&&v&&v!==tb.name){ tb.name=v; _wsFlushNow(); }
    _wsTabsRender(); };
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); fin(true); } else if(e.key==='Escape'){ e.preventDefault(); fin(false); } });
  inp.addEventListener('blur',()=>fin(true));
  inp.addEventListener('click',e=>e.stopPropagation()); inp.addEventListener('dblclick',e=>e.stopPropagation());
}
async function wsTabClose(id){
  if(!_wsTabOk()) return;
  const t=_wsTabs(), i=t.list.findIndex(x=>x.id===id); if(i<0||t.list.length<2) return;
  if(!confirm(`'${t.list[i].name}' 탭을 닫을까요?\n\n이 탭의 초안은 지워지고 되돌릴 수 없어요.`)) return;
  _wsTabBusy=true; _wsTabsRender();
  try{
    if(id===t.active){
      const nb=t.list[i+1]||t.list[i-1];
      const next=await _wsTabsGet(nb.id);
      t.list.splice(i,1); t.active=nb.id; _wsTabShow(next||_wsTabBlank());
    } else t.list.splice(i,1);
    await _wsFlushNow();
    await _wsTabsEdit(m=>{ delete m[id]; });
    renderWorkshopTable();
  }catch(e){ toast('탭을 닫지 못했어요. 공용 드라이브 연결을 확인해 주세요.','error'); }
  finally{ _wsTabBusy=false; _wsTabsRender(); }
}

// ===== 작성소 칸 오른쪽 클릭 메뉴(11-10 사용자: "오른쪽 클릭해서 입력할 수 있는 모든 옵션이 잘 정리돼서 나오면", "분류를 골라 색을 칠하고 이름은 키보드로") =====
// 근무 / 인원 집계 제외(2 붙은 근무 등) / 출장·교육·기타 / 휴가 / 복합 / 이름 직접 입력(분류 → 이름) / 지우기. 마우스 선택으로 여러 칸을 골라 두고 그 안에서 누르면 고른 칸 전체에
const WS_CTX_WORK=[['work','정근'],['vw-desk','VW데스크'],['desk8','8데스크'],['desk5','5데스크'],['danjik','당직'],['jogeun','조근'],['ojende','오전데'],['8jin','8진'],['8jin2','8진2'],['ilgeun','일근'],['newsoh','뉴.오'],['newsoh2','뉴.오2'],['vw-sub','VW대체'],['cg-sub','CG대체'],['jogeun-edu','조근교육'],['leave','신휴가'],['rest','휴무']];
let _wsCtxTargets=[];
function _wsCtxClose(){ document.getElementById('ws-ctx')?.remove(); document.removeEventListener('pointerdown',_wsCtxOff,true); document.removeEventListener('keydown',_wsCtxKey,true); window.removeEventListener('resize',_wsCtxClose); }
function _wsCtxOff(e){ const m=document.getElementById('ws-ctx'); if(m&&!m.contains(e.target)) _wsCtxClose(); }
function _wsCtxKey(e){ if(e.key==='Escape'&&!e.target.closest?.('.ws-ctx-type input')){ e.preventDefault(); _wsCtxClose(); } }
// 계약 밖·파견 칸은 건너뜀 → 넣은 칸 수
function _wsApplyCells(targets,fn){
  _pushWsHistory();
  let n=0;
  for(const t of targets){ const s=staffById(t.sid); if(!s||!isContractActive(s,t.ds)||isDispatched(s,t.ds)) continue; fn(t.sid,t.ds,_ensureDraftEntry(t.ds)); n++; }
  saveData(data); renderWorkshopTable();
  if(!n) toast('계약 외·파견 기간이라 넣지 못했어요.','error');
  return n;
}
function _wsClearCells(targets){ return _wsApplyCells(targets,(sid,ds,e)=>{ if(e.customCells) delete e.customCells[sid]; _brushClearStaff(e,sid,ds); }); }
function _wsCtxType(type){
  const T=_wsCtxTargets; _wsCtxClose();
  if(type==='off'){ _wsClearCells(T); return; }
  _wsApplyCells(T,(sid,ds,e)=>{ if(e.customCells) delete e.customCells[sid]; _brushClearStaff(e,sid,ds); const prev=wsBrushType; wsBrushType=type; try{ _applyBrush(sid,ds,true); }finally{ wsBrushType=prev; } });
}
function _wsCtxDuty(key){
  const T=_wsCtxTargets; _wsCtxClose();
  _wsApplyCells(T,(sid,ds,e)=>_assignSpecialDuty(e,sid,ds,key,(data.draft.newLeaves ||= {})));
}
function _wsCtxOpen(td,ev){
  _wsCtxClose(); if(typeof closeCellPop==='function') closeCellPop();
  const one={sid:td.dataset.sid,ds:td.dataset.ds};
  let T=[one];
  if(wsBrushType==='select'&&_wsSelection){   // 골라 둔 범위 안에서 누르면 그 범위 전체
    const grid=_wsGrid(), b=_wsSelectionBounds(grid);
    if(b){ const cells=[]; for(let r=b.r;r<b.r+b.rows;r++) for(let c=b.c;c<b.c+b.cols;c++){ const x=grid[r]&&grid[r][c]; if(x) cells.push({sid:x.dataset.sid,ds:x.dataset.ds}); }
      if(cells.some(x=>x.sid===one.sid&&x.ds===one.ds)) T=cells; }
  }
  _wsCtxTargets=T;
  const s=staffById(one.sid), d=new Date(one.ds+'T00:00:00'), DOW=['일','월','화','수','목','금','토'];
  const head=T.length>1?`${T.length}칸 선택`:`${_sdEsc(s?.name||'')} · ${d.getMonth()+1}/${d.getDate()} (${DOW[d.getDay()]})`;
  const brushStyle=k=>{ const b=document.querySelector(`.ws-brush-btn[data-brush="${k}"]`); return b?_sdEsc(b.getAttribute('style')||''):''; };
  const chip=(attrs,label,style)=>`<button type="button" class="ws-ctx-chip" ${attrs} style="${style}">${_sdEsc(label)}</button>`;
  const duties=_allDuties(), sec=(title,html,note)=>`<div class="ws-ctx-sec"><h4>${title}${note?`<small>${note}</small>`:''}</h4><div class="ws-ctx-chips">${html}</div></div>`;
  const byGroup=g=>duties.filter(x=>x.group===g).map(x=>{ const sw=_dutySwatch(x); return chip(`data-duty="${_sdEsc(x.key)}"`,x.label||x.text,`background:${sw.bg};color:${sw.color};`); }).join('');
  const m=document.createElement('div');
  m.id='ws-ctx'; m.className='ws-ctx'; m.setAttribute('role','menu'); m.setAttribute('aria-label','칸에 넣기');
  m.innerHTML=`<div class="ws-ctx-head"><b>${head}</b><span>오른쪽 클릭 메뉴</span></div>
    <div class="ws-ctx-body">
      ${sec('근무',WS_CTX_WORK.map(([k,l])=>chip(`data-type="${k}"`,l,brushStyle(k))).join(''))}
      ${sec('인원 집계 제외',byGroup('인원 집계 제외'),'칸에만 보이고 인원엔 안 셈')}
      ${sec('출장 · 교육 · 기타',byGroup('출장 · 교육 · 기타'),'인원에서 빠짐')}
      ${sec('휴가',byGroup('휴가'))}
      ${sec('복합 근무',byGroup('복합 근무'))}
      <div class="ws-ctx-sec"><h4>이름 직접 입력<small>묶음을 고르고 이름을 치세요</small></h4>
        <div class="ws-ctx-chips">${Object.keys(DUTY_CATS).map(k=>{ const c=DUTY_CATS[k], sw=_dutySwatch(c.kind?{kind:c.kind}:c); return chip(`data-cat="${k}"`,c.label,`background:${sw.bg};color:${sw.color};`); }).join('')}</div>
        <div class="ws-ctx-type" hidden><input type="text" maxlength="12" placeholder="이름 입력 후 Enter" aria-label="이름"><label><input type="checkbox" class="ws-ctx-keep"> 목록에 저장</label></div>
      </div>
    </div>
    <div class="ws-ctx-foot"><button type="button" class="ws-ctx-clear" data-type="off">지우기</button><span>Ctrl+클릭 = 바로 지우기</span></div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{
    const ty=e.target.closest('[data-type]'); if(ty){ _wsCtxType(ty.dataset.type); return; }
    const du=e.target.closest('[data-duty]'); if(du){ _wsCtxDuty(du.dataset.duty); return; }
    const ca=e.target.closest('[data-cat]');
    if(ca){ const box=m.querySelector('.ws-ctx-type'), inp=box.querySelector('input[type=text]'), c=DUTY_CATS[ca.dataset.cat], sw=_dutySwatch(c.kind?{kind:c.kind}:c);
      m.querySelectorAll('[data-cat]').forEach(b=>b.classList.toggle('on',b===ca));
      box.hidden=false; box.dataset.cat=ca.dataset.cat; inp.style.background=sw.bg; inp.style.color=sw.color; inp.placeholder=`${c.label} 이름 입력 후 Enter`; inp.focus(); }
  });
  const inp=m.querySelector('.ws-ctx-type input[type=text]');
  inp.addEventListener('keydown',e=>{
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); _wsCtxClose(); return; }
    if(e.key!=='Enter') return; e.preventDefault();
    const v=inp.value.trim(), cat=m.querySelector('.ws-ctx-type').dataset.cat; if(!v||!DUTY_CATS[cat]) return;
    const key=m.querySelector('.ws-ctx-keep').checked?_customDutyAdd(cat,v):('c:'+cat+':'+v.slice(0,12));
    _wsCtxDuty(key);
  });
  // 자리: 누른 곳 옆, 화면 밖으로 안 나가게(길면 안에서 스크롤)
  const W=m.offsetWidth, H=Math.min(m.offsetHeight,innerHeight-16);
  m.style.maxHeight=(innerHeight-16)+'px';
  m.style.left=Math.max(8,Math.min(ev.clientX+2,innerWidth-W-8))+'px';
  m.style.top=Math.max(8,Math.min(ev.clientY+2,innerHeight-H-8))+'px';
  setTimeout(()=>{ document.addEventListener('pointerdown',_wsCtxOff,true); document.addEventListener('keydown',_wsCtxKey,true); window.addEventListener('resize',_wsCtxClose); },0);
}
