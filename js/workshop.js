/* [모듈] js/workshop.js — 근무표 작성소(표·이름열 드래그·브러시·셀 타이핑) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 근무표 작성소 =====
function renderWorkshop() {
  if (!isAdmin) return;
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
  const cgCols=[...cgStaff.map(s=>({...s,_dept:'cg'})),...xrStaff.map(s=>({...s,_dept:'xr'})),...projectStaff.map(s=>({...s,_dept:'project'})),...sportsStaff.map(s=>({...s,_dept:'sports'}))];
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
  const deptColors={vw:'var(--vw-light)',cg:'var(--cg-light)',project:'var(--project-light)',sports:'var(--sports-light)',xr:'var(--xr-light)'};
  let thead='<tr class="dept-row"><th class="date-th" rowspan="2">날짜</th><th class="dow-th" rowspan="2">요일</th>';
  if(vwCols.length)thead+=`<th class="dept-group vw" colspan="${vwCols.length}">VW (${vwCols.length}명)</th>`;
  if(jogeunCols.length)thead+=`<th class="dept-group" colspan="${jogeunCols.length}" style="background:var(--th-jogeun-bg);color:var(--th-jogeun-fg);border-color:var(--th-jogeun-bd);">조근 (${jogeunCols.length}명)</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;">VW</th>`;
  if(cgStaff.length)thead+=`<th class="dept-group cg" colspan="${cgStaff.length}">CG (${cgStaff.length}명)</th>`;
  if(xrStaff.length)thead+=`<th class="dept-group" colspan="${xrStaff.length}" style="background:var(--th-xr-bg);color:var(--th-xr-fg);border-color:var(--th-xr-bd);">XR</th>`;
  if(projectStaff.length)thead+=`<th class="dept-group project" colspan="${projectStaff.length}">PROJECT</th>`;
  if(sportsStaff.length)thead+=`<th class="dept-group sports" colspan="${sportsStaff.length}">SPORTS</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;background:var(--th-cgsum-bg);color:var(--th-cgsum-fg);">CG</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;background:var(--th-daysum-bg);color:var(--th-daysum-fg);">당일</th>`;
  thead+=`<th rowspan="2" class="sum-col check-sticky" style="font-size:10px;background:#fff0f0;color:#c06b66;min-width:80px;">확인</th>`;
  thead+=`<th rowspan="2" style="font-size:10px;background:#f8f4ff;color:#7c3aed;min-width:160px;white-space:nowrap;">비고</th></tr><tr>`;
  const _grpMap={cg:'CG',xr:'XR',project:'PROJECT',sports:'SPORTS'};
  vwCols.forEach(s=>{thead+=`<th class="name-th" data-sid="${s.id}" data-grp="VW" style="color:${deptColors.vw};">${s.name}</th>`;});
  jogeunCols.forEach(s=>{thead+=`<th class="name-th" data-sid="${s.id}" data-grp="조근" style="background:var(--th-jogeun-bg);color:var(--th-jogeun-fg);">${s.name}</th>`;});
  cgCols.forEach((s,_ci)=>{const bg=s._dept==='xr'?'background:var(--th-xr-namebg);':'';const _gc=s._dept==='xr'?'#4faa9c':s._dept==='project'?'#686dc8':s._dept==='sports'?'#8a6ecf':null;let _gb='';if(_gc){if(_ci===0||cgCols[_ci-1]._dept!==s._dept)_gb+=`border-left:1px solid ${_gc}55;`;if(_ci===cgCols.length-1||cgCols[_ci+1]._dept!==s._dept)_gb+=`border-right:1px solid ${_gc}55;`;}thead+=`<th class="name-th" data-sid="${s.id}" data-grp="${_grpMap[s._dept]||'CG'}" style="${bg}color:${deptColors[s._dept]||'var(--text)'};${_gb}">${s.name}</th>`;});
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
    const _ilgeunDept=(entry?.ilgeun?staffById(entry.ilgeun)?.dept?.toUpperCase():'');
    const _ilgeunIsVW=_ilgeunDept==='VW';
    // vw.workers에 있는 사람 → VW총계, cg/xr/project에 있는 사람 → CG총계 (중복 방지)
    const _cgWorkersSet=new Set(entry?.cg?.workers||[]);
    const _leaveSet=new Set(_newLvs?.[dateStr]||[]);
    const _specialExclude=new Set([entry?.satMorning,entry?.morningDesk].filter(Boolean));
    const _excl=id=>{const _p=staffById(id);return _isVw2(entry,id)||_cgExclude.has(id)||jogeunIds.has(id)||_specialExclude.has(id)||_leaveSet.has(id)||(_p&&!isContractActive(_p,dateStr));};
    const _vwSet=new Set((entry?.vw?.workers||[]).filter(id=>!_excl(id)&&!(_cgWorkersSet.has(id)&&(staffById(id)?.dept||'').toLowerCase()==='vw')));
    const _8jinIds=[entry?.weekend8jin,entry?.weekday8jin,entry?.weekend8jin2,entry?.weekday8jin2].filter(id=>id&&!_specialExclude.has(id)&&!_leaveSet.has(id));
    const _8jinVwAdd=_8jinIds.filter(id=>!_vwSet.has(id)&&!_cgWorkersSet.has(id)&&(staffById(id)?.dept||'').toLowerCase()==='vw').length;
    const _8jinCgAdd=_8jinIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(staffById(id)?.dept||'').toLowerCase();return d==='cg'||d==='xr';}).length;
    // 뉴.오/뉴.오2도 부서별로 일일 총계에 포함 (CG부서→CG총계, VW부서→VW총계). 이미 workers에 있으면 중복 제외
    const _newsOhIds=[entry?.newsOh,entry?.newsOh2].filter(id=>id&&!_specialExclude.has(id)&&!_leaveSet.has(id));
    const _newsOhVwAdd=_newsOhIds.filter(id=>!_vwSet.has(id)&&!_cgWorkersSet.has(id)&&(staffById(id)?.dept||'').toLowerCase()==='vw').length;
    const _newsOhCgAdd=_newsOhIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(staffById(id)?.dept||'').toLowerCase();return d==='cg'||d==='xr';}).length;
    const _ilgeunOk=entry?.ilgeun&&!_leaveSet.has(entry.ilgeun)&&!_specialExclude.has(entry?.ilgeun)&&!(isHoliday&&!isWeekend&&isWeekdayForm(dateStr));   // 평일 틀 공휴일 일근은 인원 밖(엑셀 10월 최종 10/5·10/9 합계 수식에 일근 없음, 생성기 인원도 같은 기준)
    // 토·일·공휴일에 PJ가 근무 칸에 있으면(정근으로 일반 근무) CG 인원 — 엑셀 합계 수식이 그날만 PJ 열까지 정근을 셈(10/5·10/9·10/17). 평일 PJ는 프로젝트 근무라 인원 밖
    const _pjAdd=(isWeekend||isHoliday)?(entry?.project||[]).filter(id=>!_excl(id)&&!_vwSet.has(id)&&!_cgWorkersSet.has(id)).length:0;
    const vwCnt=_vwSet.size+(_ilgeunIsVW&&!_cgWorkersSet.has(entry?.ilgeun)&&_ilgeunOk?1:0)+_8jinVwAdd+_newsOhVwAdd;
    const cgCnt=(entry?.cg?.workers||[]).filter(id=>!_excl(id)&&!_vwSet.has(id)).length+(entry?.xr||[]).filter(id=>!_excl(id)).length+(!_ilgeunIsVW&&_ilgeunOk&&!_vwSet.has(entry.ilgeun)?1:0)+_8jinCgAdd+_newsOhCgAdd+_pjAdd;
    const dailyCnt=vwCnt+cgCnt;
    const dm=date.getMonth()+1,dd=date.getDate();
    tbody+=`<tr class="${isWeekend||isHoliday?'weekend':''} ${isHoliday?'holiday':''} ${isToday?'today-row':''}">`;
    const shortHoliWs=holidayName.length>4?holidayName.slice(0,4)+'…':holidayName;
    const _isSp = !!(data.settings.specialDays||{})[dateStr];
    tbody+=`<td class="date-td" onclick="openDaySpecial('${dateStr}', event)" style="cursor:pointer;${_isSp?'box-shadow:inset 3px 0 0 #f0a500;':''}" title="${_isSp?'특정일 인원 지정됨 — 클릭하여 수정':'클릭: 적정 인원/상세 편집'}">${dm}/${dd}${_isSp?'<span style="color:#f0a500;">📌</span>':''}${isHoliday?`<br><span style="font-size:8px;color:#a8657f;white-space:nowrap;">${shortHoliWs}</span>`:''}</td>`;
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
        bg=_isVw2(entry,s.id)?'var(--vw-bg)':(_custom.bg||'');color=_isVw2(entry,s.id)?'var(--vw-light)':(_custom.color||'var(--text)');fw='700';text=_custom.text;workCount[s.id]++;
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
      else if((entry?.restWorkers||[]).includes(s.id)){text=' ';}
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
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};`:'');
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
        bg=_isVw2(entry,s.id)?'var(--vw-bg)':(_custom.bg||'');color=_isVw2(entry,s.id)?'var(--vw-light)':(_custom.color||'var(--text)');fw='700';text=_custom.text;workCount[s.id]++;
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
      } else if((entry?.restWorkers||[]).includes(s.id)){text=' ';}
      else if((entry?.jogeunEdu||[]).includes(s.id)){workCount[s.id]++;bg='var(--r-edu-bg)';color='var(--r-edu-fg)';fw='700';text='조근';}
      else if(entry?.newsOh===s.id){workCount[s.id]++;bg='var(--r-news-bg)';color='var(--r-news-fg)';fw='700';text='뉴.오';}
      else if(entry?.newsOh2===s.id){workCount[s.id]++;bg='var(--r-news2-bg)';color='var(--r-news2-fg)';fw='700';text='뉴.오2';}
      else if((entry?.vw?.workers||[]).includes(s.id)){workCount[s.id]++;bg='var(--vw-bg)';color='var(--vw-light)';fw='700';text='VW';}
      else if((entry?.cg?.workers||[]).includes(s.id)){workCount[s.id]++;bg='var(--cg-bg)';color='var(--cg-light)';fw='700';text='CG';}
      else if(entry){bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';workCount[s.id]++;}
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};`:'');
      tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="cursor:pointer;${st}${extraStyle}">${text||'<span class="cell-off">-</span>'}</td>`;
    });

    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${vwCnt?'var(--vw-light)':'var(--muted)'};">${vwCnt||'-'}</td>`;

    // CG cells
    cgCols.forEach((s,_ci)=>{
      const _gc=s._dept==='xr'?'#4faa9c':s._dept==='project'?'#686dc8':s._dept==='sports'?'#8a6ecf':null;
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
        bg=_isVw2(entry,s.id)?'var(--vw-bg)':(_custom.bg||'');color=_isVw2(entry,s.id)?'var(--vw-light)':(_custom.color||'var(--text)');fw='700';text=_custom.text;workCount[s.id]++;
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
      else if((entry?.restWorkers||[]).includes(s.id)){text=' ';}
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
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};`:'');
      tbody+=`<td data-sid="${s.id}" data-ds="${dateStr}" onclick="wsCellClick(this,event)" style="cursor:pointer;${st}${extraStyle}${_gb}">${text||'<span class="cell-off">-</span>'}</td>`;
    });

    {
      const _cgDbg=[];
      (entry?.cg?.workers||[]).filter(id=>!_excl(id)&&!_vwSet.has(id)).forEach(id=>{const p=staffById(id);if(p)_cgDbg.push(p.name+'(CG)');});
      (entry?.xr||[]).filter(id=>!_excl(id)).forEach(id=>{const p=staffById(id);if(p)_cgDbg.push(p.name+'(XR)');});
      if(!_ilgeunIsVW&&_ilgeunOk&&!_vwSet.has(entry.ilgeun)){const p=staffById(entry.ilgeun);if(p)_cgDbg.push(p.name+'(일근)');}
      _8jinIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(staffById(id)?.dept||'').toLowerCase();return d==='cg'||d==='xr';}).forEach(id=>{const p=staffById(id);if(p)_cgDbg.push(p.name+'(8진)');});
      _newsOhIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(staffById(id)?.dept||'').toLowerCase();return d==='cg'||d==='xr';}).forEach(id=>{const p=staffById(id);if(p)_cgDbg.push(p.name+'(뉴.오)');});
      const _cgTip=_cgDbg.join(', ');
      tbody+=`<td title="${_cgTip}" style="text-align:center;font-size:11px;font-weight:700;color:${cgCnt?'var(--cg-light)':'var(--muted)'};cursor:help;">${cgCnt||'-'}</td>`;
    }
    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${dailyCnt?'var(--vw-light)':'var(--muted)'};">${dailyCnt||'-'}</td>`;
    // 확인 열: 누락 항목 표시
    {
      const missing=[];
      if(!entry?.vw?.desk) missing.push('VW데스');
      if(!(entry?.cg?.desk8||entry?.cg?.desk)) missing.push('CG데스');
      if(entry?.cg?.desk8&&entry.cg.desk8===entry.cg.desk5) missing.push('데스 겹침');
      if(entry?.morningDesk&&[entry.cg?.desk8,entry.cg?.desk5,entry.vw?.desk].includes(entry.morningDesk)) missing.push('오전데 겹침');
      // 인원: 평일 틀은 VW 목표·하루 합계 하한(20, 상한이 더 작으면 상한), 주말 틀은 VW·CG 목표 — 특정일 인원 설정이 있으면 그 값
      { const _st=data.settings||{}, _sd=(_st.specialDays||{})[dateStr]||{}, _wd=isWeekdayForm(dateStr);
        const _vt=_sd.vw ?? (_wd?(_st.weekdayVW||7):(dow===6?(_st.satVW||_st.weekendVW||4):(_st.sunVW||_st.weekendVW||4)));
        if(entry&&vwCnt<_vt) missing.push('VW '+vwCnt+'/'+_vt);
        if(entry&&_wd&&_sd.cg==null){ const _cap=_sd.cap ?? (_st.wdDailyCap||_st.dailyCap||22), _fl=Math.min(20,_cap); if(dailyCnt<_fl) missing.push('인원 '+dailyCnt+'/'+_fl); }
        if(entry&&!_wd){ const _ct=_sd.cg ?? (dow===6?(_st.satCG||6):(_st.sunCG||7)); if(cgCnt<_ct) missing.push('CG '+cgCnt+'/'+_ct); }
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
      const _isVwSub=(id)=>{const d=(staffById(id)?.dept||'').toLowerCase();return _vwW.includes(id)&&d!=='vw';};
      const _isCgSub=(id)=>{const d=(staffById(id)?.dept||'').toLowerCase();return _cgW.includes(id)&&d==='vw';};
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
      const _ntHtml = entry?.notes ? `<span style="color:#7c3aed;font-weight:600;">${_nesc(entry.notes)}</span>` : '';
      const _bg = [..._bigo, _ntHtml].filter(Boolean);
      tbody+=_bg.length?`<td style="font-size:10px;padding:2px 5px;line-height:1.8;vertical-align:middle;text-align:left;white-space:nowrap;">${_bg.join('<br>')}</td>`:`<td></td>`;
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
  document.getElementById('ws-tbody').innerHTML=tbody;
  // 비고 열 폭을 가장 긴 비고 내용에 맞춰 동적 조정(내용 없으면 기본, 길면 늘림)
  (function(){
    const col=document.getElementById('ws-bigo-col'); const tb=document.getElementById('ws-tbody');
    if(!col||!tb) return;
    col.style.width='1px';                              // 최소로 눌러 실제 내용폭(scrollWidth) 측정
    let maxW=0;
    tb.querySelectorAll('tr').forEach(tr=>{ const last=tr.lastElementChild; if(last) maxW=Math.max(maxW, last.scrollWidth); });
    col.style.width=Math.min(Math.max(maxW+6,160),460)+'px';   // 최소 160, 최대 460
  })();
}

let wsBrushType = null;
const WS_BRUSH_LABELS = {
  'work':'정근','vw-desk':'VW데스크','desk8':'8데스크','desk5':'5데스크',
  'danjik':'당직','jogeun':'조근','ojende':'오전데','8jin':'8진',
  'ilgeun':'일근','newsoh':'뉴.오','newsoh2':'뉴.오2','leave':'신휴가','off':'지우기'
};
function setWsBrush(type) {
  wsBrushType = (wsBrushType === type) ? null : type;
  document.querySelectorAll('.ws-brush-btn').forEach(b => {
    const on = b.dataset.brush === wsBrushType;
    b.style.outline = on ? '2px solid var(--accent)' : 'none';
    b.style.boxShadow = on ? '0 0 0 3px rgba(49,130,246,.22)' : 'none';
  });
  const lbl = document.getElementById('ws-brush-label');
  if (lbl) {
    lbl.textContent = wsBrushType ? ('✏ ' + (WS_BRUSH_LABELS[wsBrushType]||wsBrushType) + ' 브러쉬 — 셀 클릭 시 즉시 적용') : '💡 셀 더블클릭 → 근무명 타이핑 (당직·일근·정근·조근·8진·뉴.오·오전데·VW데스크 등)';
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
function _brushClearStaff(entry, staffId, ds) {
  if(entry.importedCells)delete entry.importedCells[staffId];
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
  if (data.draft?.newLeaves?.[ds]) data.draft.newLeaves[ds] = data.draft.newLeaves[ds].filter(id=>id!==staffId);
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
    case 'ilgeun':  return entry?.ilgeun === staffId;
    case 'newsoh':  return entry?.newsOh === staffId;
    case 'newsoh2': return entry?.newsOh2 === staffId;
    case 'jogeun-edu': return (entry?.jogeunEdu||[]).includes(staffId);
    case 'vw-sub':  return (entry?.vw?.workers||[]).includes(staffId);
    case 'cg-sub':  return (entry?.cg?.workers||[]).includes(staffId);
    case 'leave':   return (data.draft?.newLeaves?.[ds]||[]).includes(staffId);
    default: return false;
  }
}
function _applyBrush(staffId, ds, skipRender) {
  const s = staffById(staffId); if (!s) return;
  if (!isContractActive(s, ds)) { toast('계약 외 기간으로 입력이 불가능합니다.', 'error'); return; }
  if (isDispatched(s, ds)) { toast('파견 기간으로 입력이 불가능합니다.', 'error'); return; }
  const dept = (s.dept||'').toLowerCase();
  const bt = wsBrushType;
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
  if (bt==='newsoh' || bt==='newsoh2' || bt==='8jin' || bt==='ilgeun') {
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
  '일근':'ilgeun',
  '뉴오':'newsoh','뉴.오':'newsoh','뉴스오픈':'newsoh',
  '뉴오2':'newsoh2','뉴.오2':'newsoh2',
  'vw데스크':'vw-desk','vw데':'vw-desk',
  '8데스':'desk8','8데스크':'desk8','8데':'desk8',
  '5데스':'desk5','5데스크':'desk5','5데':'desk5',
  '조근교육':'jogeun-edu','조근-교육':'jogeun-edu',
  'vw':'vw-sub','cg':'cg-sub',
  '신휴가':'leave','휴가':'leave','연차':'leave',
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
(function(){
  const tb=document.getElementById('ws-tbody');
  if (tb && !tb._wsTypeBound){
    tb._wsTypeBound=true;
    tb.addEventListener('dblclick', function(e){
      const td=e.target.closest('td[data-sid][data-ds]');
      if(td) wsCellType(td);
    });
  }
  const _lbl=document.getElementById('ws-brush-label');
  if (_lbl && !wsBrushType){ _lbl.textContent='💡 셀 더블클릭 → 근무명 타이핑 (당직·일근·정근·조근·8진·뉴.오·오전데·VW데스크 등)'; _lbl.style.display='inline'; }
})();
