/* [모듈] js/schedule-finder.js — 공통 근무일 찾기·개인 일정 보기·내 근무 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// 한 사람의 특정 날짜 근무 역할 목록(bg/color/border 포함). 본인근무 카드·근무표 열 팝업 공용.
function _getPersonRoles(entry, sid) {
  if (!entry) return [];
  if (entry.danjik===sid) return [{label:'당직',bg:'#fee2e2',color:'#d65a52',border:'#f8a0a0'}];
  const roles = [];
  if ((entry.vw?.workers||[]).includes(sid)) roles.push({label:'VW 근무',bg:'var(--vw-bg)',color:'var(--vw-light)',border:'var(--vw)'});
  if (entry.vw?.desk===sid) roles.push({label:'VW 데스크',bg:'var(--vw-bg)',color:'var(--vw-light)',border:'var(--vw)'});
  if ((entry.cg?.workers||[]).includes(sid)) roles.push({label:'CG 근무',bg:'var(--cg-bg)',color:'var(--cg-light)',border:'var(--cg)'});
  if (entry.cg?.desk8===sid||entry.cg?.desk===sid) roles.push({label:'CG 8데스크',bg:'var(--cg-bg)',color:'var(--cg-light)',border:'var(--cg)'});
  if (entry.cg?.desk5===sid) roles.push({label:'CG 5데스크',bg:'var(--cg-bg)',color:'var(--cg-light)',border:'var(--cg)'});
  if (entry.newsOh===sid) roles.push({label:'뉴.오',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'});
  if (entry.newsOh2===sid) roles.push({label:'뉴.오2',bg:'#f3ddc0',color:'#b07d4a',border:'#d9b483'});
  if (entry.weekend8jin===sid) roles.push({label:'주말 8진',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'});
  if (entry.weekday8jin===sid) roles.push({label:'평일 8진',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'});
  if (entry.morningDesk===sid) roles.push({label:'오데',bg:'#fef3c7',color:'#c79a5e',border:'#fcd97d'});
  if (entry.satMorning===sid) roles.push({label:'토요 조근',bg:'#fef3c7',color:'#c79a5e',border:'#fcd97d'});
  if (entry.ilgeun===sid) roles.push({label:'일근',bg:'#d1fae5',color:'#45847a',border:'#6ee7b7'});
  if ((entry.xr||[]).includes(sid)) roles.push({label:'XR 근무',bg:'var(--xr-bg)',color:'var(--xr-light)',border:'var(--xr)'});
  if (entry.jogeunSubs) { Object.values(entry.jogeunSubs).forEach(subId => { if (subId===sid) roles.push({label:'조근 대체',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'}); }); }
  const me = staffById(sid);
  if (me?.dept==='조근') { const subbed = entry.jogeunSubs && Object.keys(entry.jogeunSubs).includes(sid); if (!subbed) roles.push({label:'조근',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'}); }
  if ((entry.project||[]).includes(sid)) roles.push({label:'P.J',bg:'var(--project-bg)',color:'var(--project-light)',border:'var(--project)'});
  if ((entry.sports||[]).includes(sid)) roles.push({label:'SPORTS',bg:'var(--sports-bg)',color:'var(--sports-light)',border:'var(--sports)'});
  return roles;
}
// 근무표 열(사람) 클릭 → 그 사람의 기간 내 근무를 표로 보여주는 팝업 (휴가 팝업과 동일 스타일)
// 회식 조회는 배포된 근무표만 사용한다. 작성 중인 draft 휴가는 섞지 않는다.
function _dinnerIsRegular(s, ds) {
  const e = data.schedule?.[ds], id = s.id;
  if (!e || s.active === false || !isContractActive(s, ds) || isDispatched(s, ds)) return false;
  if ((data.leaves?.[id] || []).includes(ds) || (data.newLeaves?.[ds] || []).includes(id)) return false;
  if (getDanjikExitStaff(ds) === id || getDanjikOffStaff(ds) === id) return false;
  // Time guide: duty 21–next 10, early 04–13, morning desk 09–18, newsOh 11–21, ilgeun 10–21.
  const special = ['danjik','ilgeun','satMorning','morningDesk','newsOh','newsOh2'];
  if (special.some(key => e[key] === id)) return false;
  if (['restWorkers','jogeunEdu','jogeunExtra'].some(key => (e[key] || []).includes(id))) return false;
  if (Object.values(e.jogeunSubs || {}).includes(id)) return false;
  // Known custom labels use the same documented 12:00–21:00 shift; unknown labels are not guessed.
  const custom = e.customCells?.[id]?.text;
  if (custom) return ['정근','8진','8진2','VW','CG','VW대','CG대','VW대체','CG대체','데스크','VW데스크','8데스','5데스','8데스크','5데스크'].includes(custom.replace(/\s/g,''));
  const regularRoles = [e.vw?.desk,e.cg?.desk,e.cg?.desk8,e.cg?.desk5,e.weekend8jin,e.weekday8jin,e.weekend8jin2,e.weekday8jin2];
  if (regularRoles.includes(id)) return true;
  // Work location and added duties do not change the regular shift hours.
  return [e.vw?.workers,e.cg?.workers,e.xr,e.project,e.sports].some(workers => (workers || []).includes(id));
}
function _dinnerDates(ids, start, end) {
  if (ids.length < 2 || !start || !end || start > end) return [];
  const people = ids.map(staffById);
  return Object.keys(data.schedule || {}).filter(ds => /^\d{4}-\d{2}-\d{2}$/.test(ds) && ds >= start && ds <= end && people.every(s => s && _dinnerIsRegular(s, ds))).sort();
}
function closeDinnerFinder() {
  _animModalClose(document.getElementById('dinner-modal'));
  const trigger = document.getElementById('dinner-trigger');
  if (trigger) trigger.focus();
}
function openDinnerFinder() {
  { const old=document.getElementById('dinner-modal'); old?.querySelector('#dinner-pick')?._ndPicker?.destroy(); old?.remove(); }
  const now = new Date(), today = toDateStr(now.getFullYear(),now.getMonth()+1,now.getDate());
  const start = tableRangeStart || today;
  const end = tableRangeEnd || toDateStr(now.getFullYear(),now.getMonth()+1,new Date(now.getFullYear(),now.getMonth()+1,0).getDate());
  const people = getStaff().slice().sort((a,b) => a.dept.localeCompare(b.dept,'ko') || a.name.localeCompare(b.name,'ko'));
  const el = document.createElement('div');
  el.id = 'dinner-modal'; el.className = 'nd-modal';
  el.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;';
  el.onclick = ev => { if (ev.target === el) closeDinnerFinder(); };
  el.innerHTML = `<div class="nd-pop" role="dialog" aria-modal="true" aria-labelledby="dinner-title" style="width:540px;max-width:94vw;max-height:84vh;display:flex;flex-direction:column;overflow:hidden;">
    <div class="modal-header schedule-dialog-head" style="padding:18px 22px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div><div id="dinner-title" style="font-size:17px;font-weight:800;color:var(--text);">공통 근무일 조회</div><div class="schedule-dialog-sub" style="font-size:12px;color:var(--muted);margin-top:5px;">선택한 직원 모두가 12:00~21:00에 근무하는 날을 조회합니다.</div></div>
      <button type="button" class="modal-close schedule-dialog-close" onclick="closeDinnerFinder()" aria-label="닫기">✕</button>
    </div>
    <div class="dinner-body" style="padding:18px 22px;overflow-y:auto;">
      <!-- 넓은 화면: 왼쪽(dinner-left) 기간 달력·직원 검색 / 오른쪽(dinner-right) 결과. 모바일은 위에서 아래로 그대로 -->
      <div class="dinner-left">
      <div class="dinner-period" style="display:flex;gap:12px;margin-bottom:18px;">
        <label style="flex:1;min-width:0;font-size:12px;color:var(--muted);">시작일<input id="dinner-start" type="date" value="${start}" onchange="renderDinnerResults()" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;"></label>
        <label style="flex:1;min-width:0;font-size:12px;color:var(--muted);">종료일<input id="dinner-end" type="date" value="${end}" onchange="renderDinnerResults()" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;"></label>
      </div>
      <div class="dinner-cal-wrap"><div class="dinner-sec-lbl">조회 기간 <span>시작일 → 종료일 순서로 누르세요</span></div><div id="dinner-cal"></div></div>
      <div class="dinner-who">
        <div class="dinner-who-head"><b>조회 대상 직원 <span id="dinner-count" style="color:var(--vw);">0명</span></b><button type="button" class="btn dinner-clear" onclick="document.getElementById('dinner-pick')?._ndPicker?.set([]);renderDinnerResults()">선택 해제</button></div>
        <div id="dinner-pick"></div>
      </div>
      </div>
      <div class="dinner-right">
      <div id="dinner-results" role="status" aria-live="polite" style="margin-top:18px;padding:15px;border-radius:14px;background:var(--surface2);border:1px solid var(--border);"></div>
      <p class="dinner-note" style="font-size:11px;line-height:1.7;color:var(--muted);margin:12px 0 0;">배포된 근무표의 12:00~21:00 근무 기준 · 정근, 8진, VW·CG 대체, VW·CG 데스크 포함. 다른 시간대 근무와 휴가·비번은 제외합니다.</p>
      </div>
    </div>
  </div>`;
  el.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { ev.stopPropagation(); closeDinnerFinder(); }
    if (ev.key === 'Tab') {
      const nodes = [...el.querySelectorAll('button,input')].filter(n => n.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length-1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });
  document.body.appendChild(el);
  // 직원 고르기: 이름·부서·초성 검색(js/nd-people.js) — 예전 이름 칸 격자/선택 칩 대신
  if (typeof ndPeoplePicker === 'function') ndPeoplePicker(el.querySelector('#dinner-pick'), { staff: people, onChange: renderDinnerResults, placeholder: '이름·부서·초성으로 검색해서 추가' });
  // 넓은 화면: 기간은 달력에서 시작~끝(js/nd-cal.js), 값은 시작일/종료일 input에 그대로
  if (typeof ndCal === 'function') {
    const si = el.querySelector('#dinner-start'), ei = el.querySelector('#dinner-end');
    ndCal(el.querySelector('#dinner-cal'), { range: true, mark: ds => _dinnerMarks.has(ds), markLabel: '공통 근무일', get: () => ({ from: si.value, to: ei.value }), set: r => { si.value = r.from || ''; ei.value = r.to || ''; renderDinnerResults(); } });
  }
  renderDinnerResults();
  const wide = window.matchMedia('(min-width:1001px)').matches;
  (wide ? el.querySelector('.ndc-day[tabindex="0"]') : el.querySelector('button[aria-label="닫기"]'))?.focus({preventScroll:true});
}
// 고른 직원(js/nd-people.js 태그) 기준으로 결과 갱신. 넓은 화면 달력엔 공통 근무일에 점 표시(_dinnerMarks)
let _dinnerMarks = new Set();
function renderDinnerResults() {
  const ids = document.getElementById('dinner-pick')?._ndPicker?.get() || [];
  document.getElementById('dinner-count').textContent = ids.length + '명';
  const start = document.getElementById('dinner-start').value, end = document.getElementById('dinner-end').value;
  const host = document.getElementById('dinner-results');
  const msg = !start || !end ? '조회 기간을 선택해 주세요.' : start > end ? '종료일을 시작일 이후로 선택해 주세요.' : ids.length < 2 ? '조회 대상 직원을 2명 이상 선택해 주세요.' : '';
  const cal = document.getElementById('dinner-cal')?._ndCal;
  if (msg) { host.textContent = msg; host.classList.add('is-empty'); _dinnerMarks = new Set(); if (cal) cal.render(); return; }
  host.classList.remove('is-empty');
  const dates = _dinnerDates(ids,start,end);
  _dinnerMarks = new Set(dates); if (cal) cal.render();
  const names = ids.map(id => _pEsc(staffById(id)?.name || '')).join(', ');
  host.innerHTML = `<div class="dinner-names" style="font-size:12px;color:var(--muted);line-height:1.6;overflow-wrap:anywhere;">${names}</div><div class="dinner-total" style="font-size:15px;font-weight:800;margin:8px 0 12px;">공통 근무일 <span style="color:var(--vw);">${dates.length}일</span></div>` + (dates.length ? `<div class="dinner-dates" style="display:flex;flex-wrap:wrap;gap:8px;">${dates.map(ds => { const dt = new Date(ds+'T00:00:00'); return `<span class="dinner-date" style="padding:9px 12px;border-radius:10px;background:var(--vw-bg);color:var(--vw-light);font-size:13px;font-weight:700;">${dt.getFullYear()}.${dt.getMonth()+1}.${dt.getDate()} (${'일월화수목금토'[dt.getDay()]})</span>`; }).join('')}</div>` : '<div class="dinner-none" style="font-size:12px;color:var(--muted);line-height:1.7;">조회 기간 내 공통 근무일이 없습니다.<br>조회 기간 또는 대상 직원을 변경해 주세요. 미배포 날짜는 결과에 포함되지 않습니다.</div>');
}
function _personLeaveCandidate(staff,ds,label,entry){
  if(!entry || !isContractActive(staff,ds) || isDispatched(staff,ds))return false;
  const dow=new Date(ds+'T00:00:00').getDay();
  if(dow===0 || dow===6 || data.holidays?.[ds])return false;
  const text=String(label||'').replace(/\s|\u00a0/g,'');
  return ['', '-', '–', '—', '신휴가', '휴가', 'Jr.휴가', '비번', '당직비번', '휴무'].includes(text);
}
function openPersonSchedule(staffId){
  const staff = staffById(staffId);
  if (!staff || !tableRangeStart || !tableRangeEnd) return;
  const sched = data.schedule || {};
  const dates=[]; let cur=new Date(tableRangeStart+'T00:00:00'); const end=new Date(tableRangeEnd+'T00:00:00');
  while(cur<=end){ dates.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
  const DOW_KR=['일','월','화','수','목','금','토'];
  const DEPT_COLOR={VW:'var(--vw)',CG:'var(--cg)',PROJECT:'var(--project)',SPORTS:'var(--sports)',XR:'var(--xr)','조근':'var(--vw)'};
  const nameColor=DEPT_COLOR[staff.dept]||'var(--text)';
  const now=new Date(); const todayStr=toDateStr(now.getFullYear(),now.getMonth()+1,now.getDate());
  const TD='padding:9px 8px;vertical-align:middle;text-align:center;font-size:12px;border-bottom:1px solid var(--border);';
  const TD_WE='padding:9px 8px;vertical-align:middle;text-align:center;font-size:12px;border-bottom:1px solid var(--border);background:var(--wk-bg);';
  // 실제 렌더된 근무표 셀을 그대로 가져와 동일한 디자인으로 표시 (없으면 역할 칩으로 대체)
  const _trs = document.querySelectorAll('#excel-tbody > tr');
  let rows=''; const leaveDates=[];
  dates.forEach((dt,i)=>{
    const ds=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    const dow=dt.getDay(); const isWE=dow===0||dow===6; const isHoli=!!(data.holidays&&data.holidays[ds]);
    const base=isWE||isHoli?TD_WE:TD;
    const dowColor=dow===0?'color:var(--pop-dow-sun);':dow===6?'color:var(--pop-dow-sat);':'';
    const isToday=ds===todayStr;
    // 근무표 셀 형식 그대로: 셀 전체를 색으로 칠하고 글씨(칩 아님)
    let _workStyle = base + 'font-size:12px;', _workContent = '<span style="color:var(--muted);">-</span>';
    const _row=_trs[i];
    const _td=_row?_row.querySelector('td[data-sid="'+staffId+'"]'):null;
    if(_td){
      const _st=(_td.getAttribute('style')||'').replace(/cursor:\s*pointer;?/g,'');
      _workStyle = base + 'font-size:12px;font-weight:700;' + _st;   // _st의 배경/색이 base를 덮음 → 셀 전체 칠
      _workContent = _td.innerHTML;
    } else {
      const onLv=isOnLeave(staffId,ds);
      const roles=onLv?[{label:'휴가',bg:'#fee2e2',color:'#d65a52'}]:_getPersonRoles(sched[ds],staffId);
      if(roles.length){ const r=roles[0]; _workStyle=base+`font-size:12px;font-weight:700;background:${r.bg};color:${r.color};`; _workContent=roles.map(x=>x.label).join(' '); }
    }
    const label=_td?_td.textContent:(_importCellDisplay(sched[ds],staffId,data.newLeaves?.[ds])?.text ?? _workContent.replace(/<[^>]*>/g,''));
    if(_personLeaveCandidate(staff,ds,label,sched[ds]))leaveDates.push({ds,month:dt.getMonth()+1,day:dt.getDate(),dow:DOW_KR[dow]});
    const _tbg = isToday ? 'background:var(--pop-today-bg);' : '';
    const _tBd = isToday ? 'border-bottom:2px solid #4c8ef2;' : '';
    const tL = isToday ? 'border-left:2px solid #4c8ef2;' : '';
    const tR = isToday ? 'border-right:2px solid #4c8ef2;' : '';
    rows+=`<tr${isToday?' class="pop-today"':''}>
      <td style="${base}${_tbg}font-weight:700;color:var(--text);white-space:nowrap;${_tBd}${tL}">${dt.getMonth()+1}/${dt.getDate()}</td>
      <td style="${base}${_tbg}${dowColor}${_tBd}">${DOW_KR[dow]}</td>
      <td style="${_tbg}${_workStyle}${_tBd}${tR}">${_workContent}</td>
    </tr>`;
  });
  const TH='padding:10px 6px;font-size:11px;font-weight:700;text-align:center;background:var(--surface);color:var(--muted);position:sticky;top:0;z-index:1;border-bottom:1.5px solid var(--border);';
  const leaveSummary=staff.employmentType==='employee'?`<aside class="nd-pop person-leave-summary" aria-labelledby="person-leave-title" onclick="event.stopPropagation()">
    <div class="person-leave-head"><div><div id="person-leave-title" style="font-size:15px;font-weight:800;color:var(--text);">Wise 휴가 신청 대상일</div><div style="margin-top:5px;font-size:12px;color:var(--muted);">${_pEsc(staff.name)} · 현재 조회 기간</div></div><span class="person-leave-count">${leaveDates.length}일</span></div>
    <div class="person-leave-body"><p style="margin:0 0 14px;font-size:12px;line-height:1.7;color:var(--muted);">주말·공휴일을 제외한 평일 휴무·휴가 날짜입니다.</p>
    ${leaveDates.length?'<ul class="person-leave-list">'+leaveDates.map(d=>`<li><span>${d.month}월 ${d.day}일 <span style="color:var(--muted);font-weight:500;">(${d.dow})</span></span><span class="person-leave-dot" aria-hidden="true"></span></li>`).join('')+'</ul>':'<div class="person-leave-empty">해당 기간에 신청 대상일이 없습니다.</div>'}
    <p style="margin:14px 0 0;font-size:11px;line-height:1.7;color:var(--muted);">근무표 기준 안내이며, 휴가 신청 완료 여부와는 별개입니다.</p></div>
  </aside>`:'';
  document.getElementById('lr-popup-root')?.remove();
  const html=`
  <style>
    .person-schedule-pair{display:contents;}
    .person-leave-summary{display:none;}
    @media(min-width:1001px){
      .person-schedule-pair{display:flex;align-items:flex-start;justify-content:center;gap:16px;max-width:calc(100vw - 32px);}
      .person-leave-summary{display:flex;flex-direction:column;width:282px;max-height:84vh;background:var(--surface);border-radius:20px;overflow:hidden;box-shadow:0 16px 50px -12px rgba(15,23,42,.32);}
      .person-leave-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;background:var(--vw-bg);border-bottom:1px solid var(--border);flex-shrink:0;}
      .person-leave-count{padding:6px 10px;border-radius:10px;background:var(--surface);color:var(--vw-light);font-size:14px;font-weight:800;white-space:nowrap;}
      .person-leave-body{padding:16px 20px 20px;overflow-y:auto;min-height:0;overscroll-behavior:contain;}
      .person-leave-list{list-style:none;padding:0;margin:0;}
      .person-leave-list li{display:flex;align-items:center;justify-content:space-between;min-height:46px;border-bottom:1px solid var(--border);font-size:14px;font-weight:700;color:var(--text);}
      .person-leave-list li:last-child{border-bottom:0;}
      .person-leave-dot{width:6px;height:6px;border-radius:50%;background:var(--vw-light);opacity:.6;}
      .person-leave-empty{padding:18px 0;font-size:13px;line-height:1.7;color:var(--text);}
    }
  </style>
  <div id="lr-popup-overlay" class="nd-modal" onclick="if(event.target===this)dismissLrPopup()" style="position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;">
    <section class="person-schedule-pair" aria-label="개인 근무 및 휴가 안내">
    <div onclick="event.stopPropagation()" class="nd-pop" style="background:var(--surface);border-radius:20px;box-shadow:0 16px 50px -12px rgba(15,23,42,0.32);max-height:84vh;display:flex;flex-direction:column;width:fit-content !important;min-width:186px;max-width:94vw;">
      <div style="padding:16px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div><span style="font-size:16px;font-weight:800;letter-spacing:-.01em;color:${nameColor};">${staff.name}</span><span style="font-size:11px;color:var(--muted);margin-left:6px;">${staff.dept} · 근무</span></div>
        <button onclick="dismissLrPopup()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);line-height:1;">✕</button>
      </div>
      <div id="lr-popup-scroll" style="overflow-y:auto;padding:0 14px 14px;">
        <table style="border-collapse:separate;border-spacing:0;width:auto;margin:0 auto;">
          <colgroup><col style="width:50px"><col style="width:32px"><col style="width:80px"></colgroup>
          <thead><tr><th style="${TH}">날짜</th><th style="${TH}">요일</th><th style="${TH}color:${nameColor};">근무</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    ${leaveSummary}
    </section>
  </div>`;
  const el=document.createElement('div'); el.id='lr-popup-root'; el.innerHTML=html; document.body.appendChild(el);
}
function renderMySchedule() {
  const card = document.getElementById('my-schedule-card');
  if (!currentUser || !currentUser.staffId) { card.style.display='none'; return; }
  const sid = currentUser.staffId;
  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth()+1, now.getDate());
  const sched = data.schedule || {};
  // 이번 주 월~일
  const mon = new Date(now);
  const curDow = now.getDay()===0?6:now.getDay()-1;
  mon.setDate(now.getDate()-curDow);
  const weekDays = Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});

  // bg / text / border 세트로 반환 (근무표 작성소 색상 사용)
  function getRoles(entry, sid) {
    if (!entry) return [];
    // 당직이면 당직만 표시 (VW/CG 등 다른 근무 역할 생략)
    if (entry.danjik===sid) return [{label:'당직',bg:'#fee2e2',color:'#d65a52',border:'#f8a0a0'}];
    const roles = [];
    if ((entry.vw?.workers||[]).includes(sid)) roles.push({label:'VW 근무',bg:'var(--vw-bg)',color:'var(--vw-light)',border:'var(--vw)'});
    if (entry.vw?.desk===sid) roles.push({label:'VW 데스크',bg:'var(--vw-bg)',color:'var(--vw-light)',border:'var(--vw)'});
    if ((entry.cg?.workers||[]).includes(sid)) roles.push({label:'CG 근무',bg:'var(--cg-bg)',color:'var(--cg-light)',border:'var(--cg)'});
    if (entry.cg?.desk8===sid||entry.cg?.desk===sid) roles.push({label:'CG 8데스크',bg:'var(--cg-bg)',color:'var(--cg-light)',border:'var(--cg)'});
    if (entry.cg?.desk5===sid) roles.push({label:'CG 5데스크',bg:'var(--cg-bg)',color:'var(--cg-light)',border:'var(--cg)'});
    if (entry.newsOh===sid) roles.push({label:'뉴.오',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'});
    if (entry.newsOh2===sid) roles.push({label:'뉴.오2',bg:'#f3ddc0',color:'#b07d4a',border:'#d9b483'});
    if (entry.weekend8jin===sid) roles.push({label:'주말 8진',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'});
    if (entry.weekday8jin===sid) roles.push({label:'평일 8진',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'});
    if (entry.morningDesk===sid) roles.push({label:'오데',bg:'#fef3c7',color:'#c79a5e',border:'#fcd97d'});
    if (entry.satMorning===sid) roles.push({label:'토요 조근',bg:'#fef3c7',color:'#c79a5e',border:'#fcd97d'});
    if (entry.ilgeun===sid) roles.push({label:'일근',bg:'#d1fae5',color:'#45847a',border:'#6ee7b7'});
    if ((entry.xr||[]).includes(sid)) roles.push({label:'XR 근무',bg:'var(--xr-bg)',color:'var(--xr-light)',border:'var(--xr)'});
    if (entry.jogeunSubs) {
      Object.values(entry.jogeunSubs).forEach(subId => {
        if (subId===sid) roles.push({label:'조근 대체',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'});
      });
    }
    const me = staffById(sid);
    if (me?.dept==='조근') {
      const subbed = entry.jogeunSubs && Object.keys(entry.jogeunSubs).includes(sid);
      if (!subbed) roles.push({label:'조근',bg:'#ede9fe',color:'#6366f1',border:'#c4b5fd'});
    }
    if ((entry.project||[]).includes(sid)) roles.push({label:'P.J',bg:'var(--project-bg)',color:'var(--project-light)',border:'var(--project)'});
    if ((entry.sports||[]).includes(sid)) roles.push({label:'SPORTS',bg:'var(--sports-bg)',color:'var(--sports-light)',border:'var(--sports)'});
    return roles;
  }
  function chipHtml(r, size='13px') {
    const small = parseFloat(size) <= 11;   // 주간 셀 등 좁은 칩은 패딩 축소
    const pad = small ? '2px 6px' : '3px 10px';
    // word-break:keep-all → 한글 단어(근무)는 안 쪼개고 띄어쓰기에서만 줄바꿈("CG"/"근무")
    return `<span style="display:inline-block;word-break:keep-all;padding:${pad};border-radius:6px;background:${r.bg};color:${r.color};font-size:${size};font-weight:600;border:1px solid ${r.border};line-height:1.25;">${r.label}</span>`;
  }

  // 겸직/데스크를 짧은 캡슐로: 데스크가 있으면 일반 CG/VW 생략, 8진/뉴오 등 겸직은 함께 표시
  function shortRoles(roles){
    if(!roles||!roles.length) return [];
    const hasVwDesk=roles.some(r=>r.label==='VW 데스크');
    const hasCgDesk=roles.some(r=>r.label==='CG 8데스크'||r.label==='CG 5데스크');
    const RE={'VW 데스크':'데스크','CG 8데스크':'8데스','CG 5데스크':'5데스','VW 근무':'VW','CG 근무':'CG','XR 근무':'XR','주말 8진':'8진','평일 8진':'8진'};
    const out=[];
    roles.forEach(r=>{
      if(r.label==='VW 근무'&&hasVwDesk) return;
      if(r.label==='CG 근무'&&hasCgDesk) return;
      out.push({label:RE[r.label]||r.label, bg:r.bg, color:r.color, border:r.border});
    });
    return out;
  }

  // 오늘 근무
  const todayRoles = getRoles(sched[todayStr], sid);
  const todayOnLeave = isOnLeave(sid, todayStr);

  let todayHtml = '';
  if (todayOnLeave) {
    todayHtml = `<span style="display:inline-block;padding:3px 10px;border-radius:6px;background:#fee2e2;color:#d65a52;font-size:13px;font-weight:600;border:1px solid #f8a0a0;">휴가</span>`;
  } else if (todayRoles.length) {
    todayHtml = todayRoles.map(r=>chipHtml(r,'13px')).join(' ');
  } else {
    todayHtml = `<span style="font-size:13px;color:var(--muted);">오늘 배정된 근무 없음</span>`;
  }

  // 이번 주 요약
  const DOW_S=['월','화','수','목','금','토','일'];
  let weekHtml = weekDays.map((d,i)=>{
    const ds=toDateStr(d.getFullYear(),d.getMonth()+1,d.getDate());
    const isToday=ds===todayStr;
    const onLv=isOnLeave(sid,ds);
    const roles=getRoles(sched[ds],sid);
    const isExit = !onLv && getDanjikExitStaff(ds)===sid && sched[ds]?.danjik!==sid;
    let tag;
    if(onLv) tag=`<span class="mw-role" style="background:${isToday?'rgba(255,255,255,0.22)':'#e8ecf3'};color:${isToday?'#fff':'#5f6b7d'};">휴가</span>`;
    else if(isExit) tag=`<span class="mw-role" style="background:${isToday?'rgba(255,255,255,0.22)':'var(--r-exit-bg)'};color:${isToday?'#fff':'var(--r-exit-fg)'};">퇴근</span>`;
    else if(roles.length){ const dr=shortRoles(roles).slice(0,2); tag=dr.map((r,ci)=>`<span class="mw-role" style="${ci>0?'margin-top:4px;':''}background:${isToday?'rgba(255,255,255,0.22)':r.bg};color:${isToday?'#fff':r.color};">${r.label}</span>`).join(''); }
    else tag=`<span class="mw-role mw-none">-</span>`;
    return `<div class="mw-day ${isToday?'today':''}">
      <div class="mw-dow">${DOW_S[i]}</div>
      <div class="mw-num">${d.getDate()}</div>
      ${tag}
    </div>`;
  }).join('');
  const _tdDate = new Date(todayStr+'T00:00:00');
  const _dowFull=['일','월','화','수','목','금','토'];
  const todayLabel = `${_tdDate.getMonth()+1}월 ${_tdDate.getDate()}일 · ${_dowFull[_tdDate.getDay()]}요일`;

  card.style.display='block';
  card.innerHTML=`<div class="mysched-head">
    <div class="mysched-title">이번 주 내 근무</div>
  </div>
  <div class="mw-strip">${weekHtml}</div>`;
    _refreshPushBtn();
    // 오늘 카드가 화면에 바로 보이도록 스트립을 중앙 정렬 (레이아웃 전이면 재시도)
    requestAnimationFrame(function(){
      const _strip=card.querySelector('.mw-strip'), _today=card.querySelector('.mw-day.today');
      if(!_strip || !_today) return;
      function _center(){
        if(!_strip.clientWidth) return false;
        const sr=_strip.getBoundingClientRect(), tr=_today.getBoundingClientRect();
        _strip.scrollLeft += (tr.left - sr.left) - (sr.width - tr.width)/2;
        return true;
      }
      if(!_center()) setTimeout(_center, 140);
    });
}

