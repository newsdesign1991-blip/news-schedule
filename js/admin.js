/* [모듈] js/admin.js — 관리자 패널(근무 통계·날짜 편집·설정·내보내기·로그인 기록·알림·푸시·공휴일) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== WORK STATS =====
function _initYearSelect(elId, onchange) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!el.options.length) {
    const curY = new Date().getFullYear();
    for (let y = curY + 1; y >= curY - 5; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y + '년';
      if (y === curY) opt.selected = true;
      el.appendChild(opt);
    }
  }
  if (onchange) el.onchange = onchange;
}

let _statsEditMode = false;
// 근무 통계 자동 집계(스케줄 기준) — 화면 표시(renderWorkStats)와 검사(swap-backend/test-work-stats.cjs)가 같이 씀
function _workStatsAuto(year) {
  const active = data.staff.filter(s => s.active !== false);

  // 올해 한 달이라도(그 달 1일 기준) 조근 부서가 아니었던 사람만 — 부서 이동(deptSchedule)으로 조근에서 나간 사람도 포함
  const _dOn = (s, ds) => (typeof deptOn === 'function' ? deptOn(s, ds) : s.dept);
  const _monthStarts = Array.from({length:12}, (_, i) => toDateStr(year, i+1, 1));
  const _notJogeunYear = s => _monthStarts.some(ms => _dOn(s, ms) !== '조근');
  // 직원: 조근 부서 제외 + 프리랜서 제외
  const employees = active.filter(s => _notJogeunYear(s) && s.employmentType !== 'freelancer');

  // 직원B(프리랜서) 조근 대체 근무: 활성 프리랜서 전원(조근 부서 제외) — 대체를 안 했어도 0으로 표시
  const jflPool = active.filter(s => s.employmentType === 'freelancer' && _notJogeunYear(s));

  // 자동 집계(스케줄)분만 따로 보관 — 수동 입력분(manualStats)과 분리해서 역산 가능하게
  const satA = {}, friA = {}, jsubA = {}, ilgeunA = {}, jflA = {};
  employees.forEach(s => { satA[s.id]=Array(12).fill(0); friA[s.id]=Array(12).fill(0); jsubA[s.id]=Array(12).fill(0); ilgeunA[s.id]=Array(12).fill(0); });
  jflPool.forEach(s => { jflA[s.id]=Array(12).fill(0); });

  // 근무표에 '보이는 그대로' 센다(js/table-view.js workCellRole — 표와 같은 우선순위).
  // 예전엔 자동생성용 jogeunSubs만 세서 엑셀 가져오기·브러시로 넣은 조근 대체(jogeunExtra)가 빠졌고,
  // 휴가·당직 등으로 표에선 다른 글자인 날도 셌음. 그날 조근 부서인 사람은(부서 이동 포함) 세지 않음
  const statStaff = [...employees, ...jflPool];
  for (let m = 1; m <= 12; m++) {
    const days = new Date(year, m, 0).getDate();
    const mi = m - 1, ms = _monthStarts[mi];
    for (let d = 1; d <= days; d++) {
      const dow = new Date(year, m-1, d).getDay();
      const ds = toDateStr(year, m, d);
      const en = data.schedule[ds];
      if (!en) continue;
      statStaff.forEach(s => {
        if (_dOn(s, ms) === '조근') return;   // 그 달 근무표에서 조근 열인 사람(조근이 본업) — 표와 같은 기준
        const role = workCellRole(en, s, ds);
        if (role === '당직' && dow === 6 && satA[s.id]) satA[s.id][mi]++;        // 토요 숙직 = 토요일 당직
        if (role === '당직' && dow === 5 && friA[s.id]) friA[s.id][mi]++;        // 금요일 당직
        if (role === '조근' && dow === 6 && jsubA[s.id]) jsubA[s.id][mi]++;      // 직원 토요 조근
        if (role === '일근' && ilgeunA[s.id]) ilgeunA[s.id][mi]++;
        if (role === '조근' && jflA[s.id]) jflA[s.id][mi]++;                     // 직원B 조근(평일 대체·토요일 모두)
      });
    }
  }
  return { employees, jflPool, satA, friA, jsubA, ilgeunA, jflA };
}
function renderWorkStats() {
  _initYearSelect('stats-year', renderWorkStats);
  const year = parseInt(document.getElementById('stats-year')?.value) || new Date().getFullYear();
  const edit = _statsEditMode;
  const { employees, jflPool, satA, friA, jsubA, ilgeunA, jflA } = _workStatsAuto(year);

  const manY = data.manualStats?.[year] || {};

  // title, cat, 명단, 자동집계맵, 색상 → 표. 편집 모드면 각 셀이 input(기본값=자동+수동 합계).
  function buildStatTable(title, cat, staffList, autoMap, accentBg, accentColor) {
    if (!staffList.length) return '';
    const manualSrc = manY[cat] || {};
    const mHd = Array.from({length:12},(_,i)=>`<th style="min-width:36px;padding:4px 3px;font-size:11px;font-weight:700;text-align:center;white-space:nowrap;">${i+1}월</th>`).join('');
    const rows = staffList.map(s => {
      const auto = autoMap[s.id] || Array(12).fill(0);
      const man  = manualSrc[s.id] || Array(12).fill(0);
      const tot  = auto.map((a,i)=> a + (man[i]||0));
      const total = tot.reduce((a,b)=>a+b,0);
      const cells = tot.map((c,i) => {
        if (edit) {
          const hasAuto = (auto[i]||0) > 0;
          return `<td style="padding:2px 2px;text-align:center;"><input type="number" min="0" max="99" value="${c||''}" placeholder="0"
            data-sid="${s.id}" data-mi="${i}" data-cat="${cat}" data-auto="${auto[i]||0}"
            title="${hasAuto?'자동집계 '+auto[i]+'건 포함':''}"
            style="width:34px;padding:3px 2px;font-size:11px;text-align:center;border:1px solid ${hasAuto?accentColor:'var(--border)'};border-radius:4px;background:var(--surface);color:var(--text);"></td>`;
        }
        return c > 0
          ? `<td style="text-align:center;background:${accentBg};color:${accentColor};font-weight:700;font-size:11px;border-radius:3px;padding:4px 2px;">${c}</td>`
          : `<td style="text-align:center;color:#d0d5de;font-size:11px;padding:4px 2px;">-</td>`;
      }).join('');
      const fl = s.employmentType==='freelancer' ? '<span style="font-size:9px;background:#f0f0f0;color:#888;border-radius:3px;padding:0 3px;margin-left:2px;">B</span>' : '';
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:5px 8px;font-size:12px;font-weight:600;white-space:nowrap;position:sticky;left:0;background:var(--surface);z-index:1;">${s.name}${fl}</td>
        ${cells}
        <td style="text-align:center;font-size:11px;font-weight:800;padding:4px 6px;color:${total?accentColor:'#d0d5de'};background:var(--surface2);position:sticky;right:0;z-index:1;">${total||'-'}</td>
      </tr>`;
    }).join('');
    return `<div style="min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid ${accentBg};">
        <span style="font-size:13px;font-weight:800;color:var(--text);">${title}</span>
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--border);border-radius:8px;">
        <table style="border-collapse:collapse;min-width:480px;width:100%;">
          <thead><tr style="background:var(--surface2);">
            <th style="padding:5px 8px;font-size:11px;font-weight:700;text-align:left;min-width:60px;white-space:nowrap;position:sticky;left:0;background:var(--surface2);z-index:2;">이름</th>
            ${mHd}
            <th style="padding:4px 6px;font-size:11px;font-weight:700;text-align:center;background:${accentBg};color:${accentColor};position:sticky;right:0;z-index:2;">합계</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  const area = document.getElementById('work-stats-area');
  const hasData = edit
    || Object.keys(data.schedule||{}).some(ds => ds.startsWith(year+''))
    || Object.keys(manY).length > 0;
  if (!hasData) {
    area.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--muted);font-size:14px;">${year}년 데이터가 없습니다. '과거 데이터 직접 입력'으로 채워 넣으세요.</div>`;
    return;
  }
  const t1 = buildStatTable('토요 숙직근무', 'sat', employees, satA, '#dfe4f2', '#565ba4');
  const t2 = buildStatTable('토요 조근 근무', 'jsub', employees, jsubA, '#e1f1ed', '#45847a');
  const t3 = buildStatTable('일근 근무', 'ilgeun', employees, ilgeunA, '#f6e0ea', '#a34873');
  const t4 = jflPool.length ? buildStatTable('직원B 조근근무', 'jfl', jflPool, jflA, '#fce8e8', '#c06b66') : '';
  const t5 = buildStatTable('금요일 당직', 'fri', employees, friA, '#fbe6cf', '#a9772f');
  area.innerHTML = `<div class="stats-grid">${t1}${t5}${t2}${t3}${t4}</div>`;
}

function toggleManualStats() {
  if (_statsEditMode) { saveStatsInline(); }          // 편집 중이면 저장하고 종료
  else { _statsEditMode = true; renderWorkStats(); _updateStatsEditBtn(); }
}
function _updateStatsEditBtn() {
  const btn = document.getElementById('stats-edit-btn');
  const hint = document.getElementById('stats-edit-hint');
  if (!btn) return;
  if (_statsEditMode) {
    btn.textContent = '입력 완료 (저장)';
    btn.style.background = '#6366f1'; btn.style.color = '#fff'; btn.style.borderColor = '#6366f1';
    if (hint) hint.style.display = '';
  } else {
    btn.textContent = '과거 데이터 직접 입력';
    btn.style.background = '#e0f0e8'; btn.style.color = '#2d7a5f'; btn.style.borderColor = '#a8d5b8';
    if (hint) hint.style.display = 'none';
  }
}
function saveStatsInline() {
  const year = parseInt(document.getElementById('stats-year')?.value) || new Date().getFullYear();
  if (!data.manualStats) data.manualStats = {};
  if (!data.manualStats[year]) data.manualStats[year] = {};
  const acc = {}; // cat -> id -> arr(12)
  document.querySelectorAll('#work-stats-area input[data-sid]').forEach(inp => {
    const sid = inp.dataset.sid, mi = parseInt(inp.dataset.mi), cat = inp.dataset.cat;
    const auto = parseInt(inp.dataset.auto) || 0;
    const val = parseInt(inp.value) || 0;
    const man = Math.max(0, val - auto);   // 자동집계분은 유지, 초과분만 수동 저장
    if (!acc[cat]) acc[cat] = {};
    if (!acc[cat][sid]) acc[cat][sid] = Array(12).fill(0);
    acc[cat][sid][mi] = man;
  });
  Object.entries(acc).forEach(([cat, map]) => {
    if (!data.manualStats[year][cat]) data.manualStats[year][cat] = {};
    Object.entries(map).forEach(([id, arr]) => {
      if (arr.some(v => v > 0)) data.manualStats[year][cat][id] = arr;
      else delete data.manualStats[year][cat][id];
    });
    if (!Object.keys(data.manualStats[year][cat]).length) delete data.manualStats[year][cat];
  });
  saveData(data);
  _statsEditMode = false;
  toast('과거 데이터 저장됨', 'success');
  renderWorkStats();
  _updateStatsEditBtn();
}

// ===== DAY EDIT =====
function loadDayForEdit() {
  const dateStr=document.getElementById('edit-date').value; if(!dateStr) return;
  const {y,m,d,date}=parseDateStr(dateStr); const dow=date.getDay(); const isWeekend=dow===0||dow===6;
  const s=data.settings;
  document.getElementById('edit-vw-target').textContent=isWeekend?(s.weekendVW||4):(s.weekdayVW||7);
  document.getElementById('edit-cg-target').textContent=isWeekend?(dow===6?(s.satCG||6):(s.sunCG||7)):(s.weekdayCG||19);
  const entry=data.schedule[dateStr]||{};
  document.getElementById('edit-notes').value=entry.notes||'';
  // 당직 dropdown
  const danjikPool=data.staff.filter(p=>p.canDanjik&&p.active!==false);
  const xrToday=entry.xr||[];
  document.getElementById('edit-danjik').innerHTML=`<option value="">-- 당직 없음 --</option>`+
    danjikPool.filter(p=>!xrToday.includes(p.id)).map(p=>`<option value="${p.id}" ${p.id===entry.danjik?'selected':''}>${p.name}</option>`).join('');
  // Morning desk dropdown
  const morningPool=data.staff.filter(p=>p.morningDeskPriority&&p.active!==false).sort((a,b)=>(a.morningDeskPriority||9)-(b.morningDeskPriority||9));
  const mdEl=document.getElementById('edit-morning-desk');
  if(mdEl) mdEl.innerHTML=`<option value="">-- 없음 --</option>`+morningPool.map(p=>`<option value="${p.id}" ${p.id===entry.morningDesk?'selected':''}>${p.name} (${p.morningDeskPriority}번)</option>`).join('');
  // XR checkboxes (XR dept staff)
  const xrPool=getStaff('XR');
  document.getElementById('edit-xr-workers').innerHTML=xrPool.map(p=>`
    <label class="worker-cb ${xrToday.includes(p.id)?'xr-sel':''}">
      <input type="checkbox" value="${p.id}" ${xrToday.includes(p.id)?'checked':''}
        onchange="this.parentElement.className='worker-cb '+(this.checked?'xr-sel':'')">
      ${p.name}
    </label>`).join('');
  function renderCBs(containerId,deptFilter,selected,deptClass) {
    const pool=data.staff.filter(p=>p.dept===deptFilter&&p.active!==false);
    document.getElementById(containerId).innerHTML=pool.map(p=>`
      <label class="worker-cb ${selected.includes(p.id)?deptClass+'-sel':''}">
        <input type="checkbox" value="${p.id}" ${selected.includes(p.id)?'checked':''}
          onchange="this.parentElement.className='worker-cb '+(this.checked?'${deptClass}-sel':'')">
        ${p.name}
      </label>`).join('');
  }
  function renderDeskSel(selId,deptFilter,curDesk) {
    const pool=data.staff.filter(p=>p.dept===deptFilter&&p.deskPriority&&p.active!==false).sort((a,b)=>(a.deskPriority||9)-(b.deskPriority||9));
    document.getElementById(selId).innerHTML=`<option value="">-- 미지정 --</option>`+pool.map(p=>`<option value="${p.id}" ${p.id===curDesk?'selected':''}>${p.name} (${p.deskPriority}번)</option>`).join('');
  }
  renderCBs('edit-vw-workers','VW',entry.vw?.workers||[],'vw');
  renderCBs('edit-cg-workers','CG',entry.cg?.workers||[],'cg');
  renderCBs('edit-project-workers','PROJECT',entry.project||[],'project');
  renderCBs('edit-sports-workers','SPORTS',entry.sports||[],'sports');
  renderDeskSel('edit-vw-desk','VW',entry.vw?.desk);
  renderDeskSel('edit-cg-desk','CG',entry.cg?.desk);
  document.getElementById('day-edit-area').style.display='block';
}
function saveDayEdit() {
  const dateStr=document.getElementById('edit-date').value; if(!dateStr) return;
  const getChecked=id=>[...document.querySelectorAll(`#${id} input[type=checkbox]:checked`)].map(cb=>cb.value);
  data.schedule[dateStr]={
    vw:{workers:getChecked('edit-vw-workers'),desk:document.getElementById('edit-vw-desk').value||null},
    cg:{workers:getChecked('edit-cg-workers'),desk:document.getElementById('edit-cg-desk').value||null},
    project:getChecked('edit-project-workers'),
    sports:getChecked('edit-sports-workers'),
    xr:getChecked('edit-xr-workers'),
    danjik:document.getElementById('edit-danjik').value||null,
    morningDesk:document.getElementById('edit-morning-desk')?.value||null,
    notes:document.getElementById('edit-notes').value
  };
  saveData(data); toast('저장됨','success');
}

// ===== SETTINGS =====
function saveSettings() {
  data.settings.weekdayVW=parseInt(document.getElementById('set-wd-vw').value)||7;
  data.settings.weekdayCG=parseInt(document.getElementById('set-wd-cg').value)||19;
  data.settings.weekendVW=parseInt(document.getElementById('set-we-vw').value)||4;
  data.settings.satCG=parseInt(document.getElementById('set-sat-cg').value)||6;
  data.settings.sunCG=parseInt(document.getElementById('set-sun-cg').value)||7;
  data.settings.dailyCap=parseInt(document.getElementById('set-daily-cap').value)||21;
  const apiKeyEl=document.getElementById('set-holiday-key');
  if (apiKeyEl) data.settings.holidayApiKey=apiKeyEl.value.trim();
  saveData(data); updateSettingsSummary(); toast('설정 저장됨','success');
}
function changePassword() {
  const cur=document.getElementById('pw-current').value;
  const nw=document.getElementById('pw-new').value;
  const conf=document.getElementById('pw-confirm').value;
  const err=document.getElementById('pw-error');
  if(btoa(cur)!==data.adminPass){err.textContent='현재 비밀번호 오류';return;}
  if(nw.length<4){err.textContent='4자 이상 입력';return;}
  if(nw!==conf){err.textContent='비밀번호 불일치';return;}
  data.adminPass=btoa(nw); saveData(data);
  err.textContent=''; ['pw-current','pw-new','pw-confirm'].forEach(id=>document.getElementById(id).value='');
  toast('비밀번호 변경됨','success');
}
function updateSettingsSummary() {
  const s=data.settings;
  // 작성소 인원 설정 인풋 동기화
  const wsMap={
    'ws-wd-vw': s.weekdayVW||7,
    'ws-wd-cg': s.weekdayCG||19,
    'ws-wd-cap': s.wdDailyCap||s.dailyCap||22,
    'ws-sat-vw': s.satVW||(s.weekendVW||4),
    'ws-sat-cg': s.satCG||6,
    'ws-sat-cap': s.satDailyCap||s.dailyCap||11,
    'ws-sun-vw': s.sunVW||(s.weekendVW||4),
    'ws-sun-cg': s.sunCG||7,
    'ws-sun-cap': s.sunDailyCap||s.dailyCap||11,
  };
  Object.entries(wsMap).forEach(([id,v])=>{ const el=document.getElementById(id); if(el) el.value=v; });
}

function saveWsSettings() {
  const s=data.settings;
  s.weekdayVW=parseInt(document.getElementById('ws-wd-vw')?.value)||7;
  s.weekdayCG=parseInt(document.getElementById('ws-wd-cg')?.value)||19;
  s.wdDailyCap=parseInt(document.getElementById('ws-wd-cap')?.value)||22;
  s.satVW=parseInt(document.getElementById('ws-sat-vw')?.value)||4;
  s.satCG=parseInt(document.getElementById('ws-sat-cg')?.value)||6;
  s.satDailyCap=parseInt(document.getElementById('ws-sat-cap')?.value)||11;
  s.sunVW=parseInt(document.getElementById('ws-sun-vw')?.value)||4;
  s.sunCG=parseInt(document.getElementById('ws-sun-cg')?.value)||7;
  s.sunDailyCap=parseInt(document.getElementById('ws-sun-cap')?.value)||11;
  saveData(data);
  toast('인원 설정 저장됨','success');
}

// ===== EXPORT/IMPORT =====
function exportData() {
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  a.download=`근무표_${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url); toast('내보내기 완료','success');
}
function importData(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const imp=JSON.parse(e.target.result);
      if(!imp.staff||!imp.schedule) throw new Error();
      if(!confirm('기존 데이터를 교체하시겠습니까?')) return;
      data=imp; if(!data.leaves) data.leaves={};
      saveData(data); renderAdminPanel(); toast('가져오기 완료','success');
    } catch { toast('파일 형식 오류','error'); }
  };
  reader.readAsText(file); input.value='';
}

// ===== ADMIN PANEL =====
function renderAdminPanel() {
  renderStaffTable(); updateSettingsSummary();
  ['set-wd-vw','set-wd-cg','set-we-vw','set-sat-cg','set-sun-cg','set-daily-cap'].forEach((id,i)=>{
    const el=document.getElementById(id); if(el) el.value=[data.settings.weekdayVW,data.settings.weekdayCG,data.settings.weekendVW,data.settings.satCG,data.settings.sunCG,data.settings.dailyCap||21][i]||[7,19,4,6,7,21][i];
  });
  const keyEl=document.getElementById('set-holiday-key');
  if (keyEl) keyEl.value=data.settings.holidayApiKey||'';
  const yearEl=document.getElementById('holiday-year');
  if (yearEl) yearEl.value=new Date().getFullYear();
  renderHolidayList();
  updateStaffForm();
  const now=new Date();
  const _ny=now.getFullYear(),_nm=String(now.getMonth()+1).padStart(2,'0');
  const _nLast=new Date(_ny,now.getMonth()+1,0).getDate();
  const _gs=document.getElementById('gen-start'); if(_gs) _gs.value=`${_ny}-${_nm}-01`;
  const _ge=document.getElementById('gen-end'); if(_ge) _ge.value=`${_ny}-${_nm}-${String(_nLast).padStart(2,'0')}`;
}
function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(btn=>{
    const m=(btn.getAttribute('onclick')||'').match(/showAdminTab\('([^']+)'\)/);
    btn.classList.toggle('active', !!m && m[1]===tab);
  });
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById('panel-'+tab);
  if (panel) panel.classList.add('active');
  if (tab==='leave') { _statsEditMode = false; renderWorkStats(); _updateStatsEditBtn(); }
  if (tab==='notify') renderNotifyTab();
  if (tab==='accounts') employeeAccounts();
  if (tab==='settings') { _initGcalSettings(); _renderBackupList(); }
  if (tab==='loginlog') renderLoginLog();
  if (tab==='avoid') renderAvoidTab();
}
// ===== 로그인 상태 (마스터 전용) =====
// 메인 데이터(schedule)와 분리된 별도 테이블 login_log에 '기기별 로그인 상태'를 upsert.
// logged_in=true = 아직 로그아웃 안 함(세션 유지), false = 로그아웃. 근무표 blob엔 영향 없음.
const LOGINLOG_SQL = `drop table if exists login_log;\ncreate table login_log (\n  device_id text primary key,\n  staff_id text, name text, dept text, ua text,\n  logged_in boolean default true,\n  last_login timestamptz default now(),\n  last_logout timestamptz\n);\nalter table login_log enable row level security;\ncreate policy "anon all login_log" on login_log for all to anon using (true) with check (true);`;
function _deviceId(){
  let id=localStorage.getItem('nd_device_id');
  if(!id){ id='d'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); localStorage.setItem('nd_device_id', id); }
  return id;
}
function _recordLogin(force){
  try {
    if(!currentUser||!currentUser.staffId) return;
    const key='nd_loginlog_'+_bkToday();
    if(!force && localStorage.getItem(key)) return;   // 자동로그인은 하루 1회만 갱신
    localStorage.setItem(key,'1');
    const st=staffById(currentUser.staffId);
    fetch(`${SB_URL}/rest/v1/login_log?on_conflict=device_id`, {
      method:'POST', headers:{...SB_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify({ device_id:_deviceId(), staff_id:currentUser.staffId, name:currentUser.name, dept:(st&&st.dept)||'', ua:(navigator.userAgent||'').slice(0,200), logged_in:true, last_login:new Date().toISOString() })
    }).catch(()=>{});
  } catch(e){}
}
function _recordLogout(){
  try {
    localStorage.removeItem('nd_loginlog_'+_bkToday());
    fetch(`${SB_URL}/rest/v1/login_log?device_id=eq.${encodeURIComponent(_deviceId())}`, {
      method:'PATCH', headers:{...SB_HEADERS,'Prefer':'return=minimal'},
      body: JSON.stringify({ logged_in:false, last_logout:new Date().toISOString() })
    }).catch(()=>{});
  } catch(e){}
}
async function renderLoginLog(){
  const box=document.getElementById('loginlog-body'); if(!box) return;
  box.innerHTML='불러오는 중…';
  try {
    const res=await fetch(`${SB_URL}/rest/v1/login_log?select=*&order=last_login.desc`, { headers:{ 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY } });
    if(!res.ok){
      box.innerHTML = `<div style="color:#d65a52;font-weight:600;margin-bottom:8px;">로그인 상태 테이블이 없거나 예전 버전입니다. (HTTP ${res.status})</div><div style="color:var(--muted);margin-bottom:8px;">Supabase → SQL Editor에서 아래를 1회 실행하세요. <b>(기존 login_log는 삭제되고 새 구조로 생성됩니다)</b></div><pre style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:11px;line-height:1.5;overflow-x:auto;white-space:pre;">${LOGINLOG_SQL.replace(/</g,'&lt;')}</pre>`;
      return;
    }
    const rows=await res.json();
    if(!rows.length){ box.innerHTML='<div style="color:var(--muted);">아직 로그인한 사람이 없습니다. (직원이 이름으로 접속하면 여기에 표시됩니다)</div>'; return; }
    const devName=ua=>{ ua=ua||''; if(/iPhone|iPad|iPod/.test(ua))return '📱 iOS'; if(/SamsungBrowser/.test(ua))return '📱 삼성인터넷'; if(/Android/.test(ua))return '📱 안드로이드'; if(/Windows/.test(ua))return '💻 PC'; if(/Mac/.test(ua))return '💻 Mac'; return '기타'; };
    const fmt=iso=>{ if(!iso)return '-'; try{ const k=new Date(iso); const mm=String(k.getMonth()+1).padStart(2,'0'),dd=String(k.getDate()).padStart(2,'0'),hh=String(k.getHours()).padStart(2,'0'),mi=String(k.getMinutes()).padStart(2,'0'); return `${mm}-${dd} ${hh}:${mi}`; }catch(e){ return iso; } };
    const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    // 사람(staff_id)별로 묶기 — 여러 기기 로그인 가능
    const byStaff={};
    rows.forEach(r=>{ const k=r.staff_id||r.name; if(!byStaff[k]) byStaff[k]={name:r.name,dept:r.dept,loggedIn:false,lastLogin:r.last_login,devs:[]};
      const g=byStaff[k]; if(r.logged_in) g.loggedIn=true; if((r.last_login||'')>(g.lastLogin||'')) g.lastLogin=r.last_login; g.devs.push(r); });
    const list=Object.values(byStaff).sort((a,b)=> (b.loggedIn-a.loggedIn) || ((b.lastLogin||'')>(a.lastLogin||'')?1:-1));
    const onCnt=list.filter(p=>p.loggedIn).length;
    const head=`<div style="margin-bottom:12px;color:var(--text);">한번이라도 로그인 <b>${list.length}명</b> · <span style="color:#16a34a;">🟢 로그인 중 <b>${onCnt}명</b></span> · ⚪ 로그아웃 <b>${list.length-onCnt}명</b></div>`;
    const trs=list.map(p=>{
      const badge = p.loggedIn
        ? '<span style="background:#dcfce7;color:#16a34a;font-weight:700;font-size:11px;padding:2px 9px;border-radius:20px;white-space:nowrap;">🟢 로그인 중</span>'
        : '<span style="background:var(--surface2);color:var(--muted);font-weight:700;font-size:11px;padding:2px 9px;border-radius:20px;white-space:nowrap;">⚪ 로그아웃</span>';
      const devs=[...new Set(p.devs.map(d=>devName(d.ua)))].join(', ');
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:8px 10px;font-weight:700;color:var(--text);white-space:nowrap;">${esc(p.name)}</td>
        <td style="padding:8px 10px;color:var(--muted);white-space:nowrap;">${esc(p.dept)}</td>
        <td style="padding:8px 10px;">${badge}</td>
        <td style="padding:8px 10px;color:var(--muted);white-space:nowrap;">${devs}</td>
        <td style="padding:8px 10px;color:var(--muted);white-space:nowrap;font-family:ui-monospace,monospace;">${fmt(p.lastLogin)}</td>
      </tr>`;
    }).join('');
    box.innerHTML = head + `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="border-bottom:2px solid var(--border);text-align:left;">
        <th style="padding:7px 10px;color:var(--muted);">이름</th><th style="padding:7px 10px;color:var(--muted);">부서</th><th style="padding:7px 10px;color:var(--muted);">상태</th><th style="padding:7px 10px;color:var(--muted);">기기</th><th style="padding:7px 10px;color:var(--muted);">마지막 로그인</th>
      </tr></thead><tbody>${trs}</tbody></table></div>`;
  } catch(e){ box.innerHTML='<div style="color:#d65a52;">불러오기 실패: '+e.message+'</div>'; }
}

// ===== 알림 제어 =====
// 근무형태별 알림 시각 설정. 백엔드(GitHub Actions cron)가 이 설정을 읽어
// 매일 지정 시각에 해당 근무자에게만 푸시를 전송한다.
const NOTIFY_DEFAULT_TYPES = [
  { key:'danjik',  label:'당직',            time:'08:30', enabled:true,  body:'{이름}님, 오늘은 당직 근무입니다.' },
  { key:'jogeun',  label:'조근 (평일·토요)', time:'06:30', enabled:true,  body:'{이름}님, 오늘은 조근입니다.' },
  { key:'ojende',  label:'오전데스크',       time:'07:30', enabled:true,  body:'{이름}님, 오늘은 오전데스크입니다.' },
  { key:'8jin',    label:'8진',             time:'08:00', enabled:true,  body:'{이름}님, 오늘은 8진 근무입니다.' },
  { key:'ilgeun',  label:'일근',            time:'09:00', enabled:true,  body:'{이름}님, 오늘은 일근입니다.' },
  { key:'newsoh',  label:'뉴.오',         time:'13:00', enabled:true,  body:'{이름}님, 오늘은 뉴.오 근무입니다.' },
  { key:'vw',      label:'VW 근무',         time:'09:00', enabled:true,  body:'{이름}님, 오늘은 VW 근무입니다.' },
  { key:'cg',      label:'CG 근무',         time:'09:00', enabled:true,  body:'{이름}님, 오늘은 CG 근무입니다.' },
  { key:'general', label:'기타 근무 (XR·PROJECT·SPORTS)',        time:'09:00', enabled:true,  body:'{이름}님, 오늘 근무가 있습니다.' },
  { key:'off',     label:'휴무 (오늘 근무 없음 알림)', time:'09:00', enabled:false, body:'{이름}님, 오늘은 근무가 없습니다.' },
];
function getNotifyConfig() {
  if (!data.settings) data.settings = {};
  if (!data.settings.notify) {
    data.settings.notify = {
      enabled: false,
      publishNotify: true,
      types: NOTIFY_DEFAULT_TYPES.map(t=>({...t})),
    };
  }
  // 새 근무형태 추가 시 마이그레이션 (기존 설정 유지)
  const cfg = data.settings.notify;
  if (!Array.isArray(cfg.types)) cfg.types = NOTIFY_DEFAULT_TYPES.map(t=>({...t}));
  NOTIFY_DEFAULT_TYPES.forEach(def=>{
    const ex = cfg.types.find(t=>t.key===def.key);
    if (!ex) cfg.types.push({...def});
    else if (ex.body===undefined) ex.body = def.body;   // 기존 설정에 알림 내용 채우기
  });
  return cfg;
}
function renderNotifyTab() {
  const cfg = getNotifyConfig();
  const body = document.getElementById('notify-tab-body');
  if (!body) return;
  const rows = cfg.types.map(t=>`
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:9px 8px;font-weight:600;font-size:13px;white-space:nowrap;vertical-align:top;">${t.label}</td>
      <td style="padding:9px 8px;text-align:center;vertical-align:top;">
        <input type="time" class="form-input" style="width:110px;padding:5px 8px;display:inline-block;"
          value="${t.time||'09:00'}" data-nt-time="${t.key}" ${t.enabled?'':'disabled'}>
      </td>
      <td style="padding:9px 8px;text-align:center;vertical-align:top;">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
          <input type="checkbox" data-nt-enabled="${t.key}" ${t.enabled?'checked':''}
            onchange="this.closest('tr').querySelector('[data-nt-time]').disabled=!this.checked;">
          <span style="color:var(--muted);">알림</span>
        </label>
      </td>
      <td style="padding:9px 8px;vertical-align:top;">
        <input type="text" class="form-input" style="width:100%;min-width:220px;padding:6px 8px;font-size:12px;"
          value="${(t.body||'').replace(/"/g,'&quot;')}" data-nt-body="${t.key}" placeholder="{이름}님, 오늘 ...">
      </td>
    </tr>`).join('');
  body.innerHTML = `
    <div class="gen-box">
      <h3>🔔 알림 마스터 설정</h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6;">
        로그인한 직원에게 매일 자신의 근무를 푸시 알림으로 보냅니다.
        당직·조근처럼 출근 시각이 다른 근무는 아래에서 형태별로 시각을 따로 지정하세요.<br>
        <span style="color:#c79a5e;">⚠ 실제 발송은 백엔드(서버 스케줄러) 연동이 필요합니다 — 아래 설정은 발송 규칙을 정의합니다.</span>
      </p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" id="nt-master" ${cfg.enabled?'checked':''} style="width:18px;height:18px;">
          <span style="font-weight:600;font-size:14px;">알림 기능 사용</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" id="nt-publish" ${cfg.publishNotify?'checked':''} style="width:18px;height:18px;">
          <span style="font-size:13px;">근무표 <b>배포 시</b> 전 직원에게 알림</span>
        </label>
      </div>
    </div>
    <div class="gen-box" style="margin-top:14px;">
      <h3>⏰ 근무형태별 알림 시각</h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.6;">
        각 근무형태마다 그날 해당 근무인 사람에게 지정 시각에 알림이 갑니다. 한 사람이 여러 근무면 형태별로 각각 받습니다.<br>
        <b>알림 내용</b>은 직접 편집할 수 있어요. <code style="background:var(--surface2);padding:1px 5px;border-radius:4px;">{이름}</code>=직원 이름, <code style="background:var(--surface2);padding:1px 5px;border-radius:4px;">{근무}</code>=근무형태명, <code style="background:var(--surface2);padding:1px 5px;border-radius:4px;">{시각}</code>=알림 시각 으로 자동 치환됩니다.
      </p>
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:560px;">
        <thead>
          <tr style="border-bottom:2px solid var(--border);text-align:left;">
            <th style="padding:8px;font-size:12px;color:var(--muted);">근무형태</th>
            <th style="padding:8px;font-size:12px;color:var(--muted);text-align:center;">알림 시각</th>
            <th style="padding:8px;font-size:12px;color:var(--muted);text-align:center;">사용</th>
            <th style="padding:8px;font-size:12px;color:var(--muted);">알림 내용 (메시지)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
      <button class="btn btn-primary" style="width:auto;margin-top:14px;" onclick="saveNotifyConfig()">알림 설정 저장</button>
      <div id="nt-save-status" style="margin-top:8px;font-size:12px;color:var(--muted);"></div>
    </div>`;
}
function saveNotifyConfig() {
  const cfg = getNotifyConfig();
  cfg.enabled = document.getElementById('nt-master').checked;
  cfg.publishNotify = document.getElementById('nt-publish').checked;
  document.querySelectorAll('[data-nt-time]').forEach(el=>{
    const key = el.getAttribute('data-nt-time');
    const t = cfg.types.find(x=>x.key===key);
    if (t) t.time = el.value || '09:00';
  });
  document.querySelectorAll('[data-nt-enabled]').forEach(el=>{
    const key = el.getAttribute('data-nt-enabled');
    const t = cfg.types.find(x=>x.key===key);
    if (t) t.enabled = el.checked;
  });
  document.querySelectorAll('[data-nt-body]').forEach(el=>{
    const key = el.getAttribute('data-nt-body');
    const t = cfg.types.find(x=>x.key===key);
    if (t) t.body = el.value;
  });
  saveData(data);
  const st = document.getElementById('nt-save-status');
  if (st) { st.textContent = '✓ 저장됨 — 서버 스케줄러가 다음 주기에 반영합니다.'; st.style.color = '#45847a'; }
  toast('알림 설정 저장됨','success');
}

// ===== 푸시 구독 (클라이언트) =====
const VAPID_PUBLIC = 'BPbuDNOiXuJN5KpRWINHNtAYVlG3Pq6T6KVJ4ABv9PFn9hv8cfMoQXHCWVbLwqvxteVAkxaN4XKX1KOi5lhAMdc';
const NOTIFY_FN_URL = `${SB_URL}/functions/v1/notify`;
function _urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const base = (b64 + pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(base); const arr = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
function _pushSupported() { return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window); }
async function isPushSubscribed() {
  try {
    if (!_pushSupported()) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    return !!(await reg.pushManager.getSubscription());
  } catch(_) { return false; }
}
async function enablePush() {
  if (!currentUser || !currentUser.staffId) { toast('먼저 이름으로 로그인하세요.','error'); return; }
  if (!_pushSupported()) { toast('이 브라우저는 푸시 미지원입니다. 아이폰은 Safari에서 "홈 화면에 추가" 후 사용하세요.','error'); return; }
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('알림 권한이 거부되었습니다.','error'); return; }
    // iOS 등에서 옛 구독이 무효화돼도 로컬엔 남아있어, 그걸 재사용하면 죽은 endpoint를 다시 저장하게 됨.
    // → 켤 때마다 기존 구독을 해지하고 새 구독을 만들어 항상 유효한 endpoint를 보장한다.
    const _old = await reg.pushManager.getSubscription();
    if (_old) { try { await _old.unsubscribe(); } catch(_){} }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:_urlB64ToUint8(VAPID_PUBLIC) });
    const j = sub.toJSON();
    // 같은 사람(staff_id)의 기존 구독을 전부 제거 후 새로 삽입 → 옛 endpoint 잔존으로 인한 중복 알림 방지
    await fetch(`${SB_URL}/rest/v1/push_subs?staff_id=eq.${encodeURIComponent(currentUser.staffId)}`, { method:'DELETE', headers:SB_HEADERS }).catch(()=>{});
    const res = await fetch(`${SB_URL}/rest/v1/push_subs`, {
      method:'POST',
      headers:{...SB_HEADERS, 'Prefer':'return=minimal'},
      body: JSON.stringify({ staff_id:currentUser.staffId, name:currentUser.name, endpoint:j.endpoint, sub:{ ...j, prefs:getUserNotify() } })   // prefs = 개인 알림 설정(서버가 보고 거름)
    });
    if (!res.ok) {
      const errTxt = await res.text().catch(()=>'');
      throw new Error(`구독 저장 실패 (HTTP ${res.status}). ${errTxt||'서버 권한(RLS) 설정을 확인하세요.'}`);
    }
    try { localStorage.setItem('nd_prefs_synced', j.endpoint + '|' + currentUser.staffId + '|' + JSON.stringify(getUserNotify())); } catch(_){}   // 이 설정으로 서버에 저장됨(_pushSavePrefs가 다시 안 보냄)
    toast('알림이 켜졌습니다 🔔','success');
    renderMySchedule();
    _refreshUserSettingsModal();
  } catch(e) { console.warn('enablePush', e); toast('알림 설정 실패: '+e.message,'error'); }
}
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) {
      const ep = sub.endpoint;
      await sub.unsubscribe();
      await fetch(`${SB_URL}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(ep)}`, { method:'DELETE', headers:SB_HEADERS });
    }
    toast('알림이 꺼졌습니다.','success');
    renderMySchedule();
    _refreshUserSettingsModal();
  } catch(e) { console.warn('disablePush', e); }
}
// 개인 알림 설정이 바뀌면 이 기기 구독 행(push_subs)의 sub.prefs만 갱신 — 서버 notify 함수(mode:'prefs')가 대신 고침.
// 웹(anon)은 push_subs를 읽을 권한이 없어 직접 덮어쓰기(upsert)가 안 되고, 지우고 다시 넣는 방식은 구독을 잃을 수 있어 쓰지 않음.
// 서버는 endpoint+직원 id가 둘 다 맞는 행만 고침(공용 PC에서 남의 구독을 바꾸지 않음). 실제로 고친 행이 있을 때만 '저장됨' 표시.
// 여러 번 빨리 바꿔도 순서대로 하나씩 보내고, 보낼 때의 최신 설정을 보냄
function _pushSavePrefs(onlyIfChanged) {
  window._ndPrefsChain = (window._ndPrefsChain || Promise.resolve()).then(() => _pushSavePrefsNow(onlyIfChanged), () => _pushSavePrefsNow(onlyIfChanged));
  return window._ndPrefsChain;
}
async function _pushSavePrefsNow(onlyIfChanged) {
  try {
    if (!currentUser || !currentUser.staffId || !_pushSupported()) return 'na';
    const reg = await navigator.serviceWorker.getRegistration();
    const s = reg && await reg.pushManager.getSubscription(); if (!s) return 'na';   // 이 기기 알림이 꺼져 있음 → 서버에 보낼 것 없음
    const prefs = getUserNotify(), mark = s.endpoint + '|' + currentUser.staffId + '|' + JSON.stringify(prefs);
    if (onlyIfChanged) { let last = ''; try { last = localStorage.getItem('nd_prefs_synced') || ''; } catch(_){} if (last === mark) return true; }   // 이미 서버에 같은 설정이면 건너뜀
    const r = await fetch(NOTIFY_FN_URL, { method:'POST', headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY },
      body: JSON.stringify({ mode:'prefs', endpoint:s.endpoint, staff_id:currentUser.staffId, prefs }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.updated > 0) { try { localStorage.setItem('nd_prefs_synced', mark); } catch(_){} return true; }
    if (r.ok && !j.error && (j.found === 0 || (j.found === undefined && j.updated === 0))) return 'nosub';   // 서버에 이 기기·이 직원의 구독이 없음
    return false;
  } catch(e) { console.warn('push prefs sync', e); return false; }
}
async function togglePush() {
  if (await isPushSubscribed()) disablePush(); else enablePush();
}
async function sendTestPush() {
  const btn = document.getElementById('us-push-test-btn');
  if (!currentUser || !currentUser.staffId) { toast('먼저 이름으로 로그인하세요.','error'); return; }
  if (!_pushSupported()) { toast('이 브라우저는 푸시 미지원입니다. 아이폰은 홈 화면에 추가 후 사용하세요.','error'); return; }
  if (!(await isPushSubscribed())) { toast('먼저 위에서 "이 기기 알림 켜기"를 눌러주세요.','error'); return; }
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 발송 중...'; }
  try {
    const res = await fetch(NOTIFY_FN_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY },
      body: JSON.stringify({ mode:'test', staff_id: currentUser.staffId })
    });
    const j = await res.json().catch(()=>({}));
    if (res.ok && j.sent > 0) toast('테스트 알림을 보냈습니다! 잠시 후 알림이 떠요 🔔','success');
    else if (res.ok && j.sent === 0) toast('보낼 구독 정보가 없습니다. 알림을 껐다 다시 켜보세요.','error');
    else toast('발송 실패 (HTTP '+res.status+'). 서버 함수 배포 상태를 확인하세요.','error');
  } catch(e) {
    toast('발송 오류: '+e.message,'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig || '🔔 테스트 알림 보내기'; }
  }
}
function openUserSettings() { openNotifySheet(); }   // 하위호환: 알림 설정 시트로 연결
function closeUserSettings() { closeSheet(); }
async function _refreshUserSettingsModal() {
  const subbed = await isPushSubscribed();
  const btn = document.getElementById('us-push-toggle-btn');
  const testBtn = document.getElementById('us-push-test-btn');
  const status = document.getElementById('us-push-status');
  if (!btn) return;
  if (!_pushSupported()) {
    btn.style.display = 'none';
    if (testBtn) testBtn.style.display = 'none';
    if (status) { status.textContent = '이 브라우저는 푸시 미지원입니다. 아이폰은 홈 화면에 추가 후 사용하세요.'; status.style.color = '#c79a5e'; }
    return;
  }
  btn.style.display = '';
  if (testBtn) testBtn.style.display = subbed ? '' : 'none';   // 구독된 기기에서만 테스트 버튼 노출
  if (subbed) {
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg> 이 기기 알림 끄기'; btn.style.display='inline-flex'; btn.style.alignItems='center'; btn.style.justifyContent='center'; btn.style.gap='6px';
    btn.style.borderColor = '#f8a0a0'; btn.style.color = '#d65a52';
    if (status) { status.textContent = '✓ 이 기기에서 알림이 켜져 있습니다.'; status.style.color = '#45847a'; }
  } else {
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> 이 기기 알림 켜기'; btn.style.display='inline-flex'; btn.style.alignItems='center'; btn.style.justifyContent='center'; btn.style.gap='6px';
    btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted)';
    if (status) { status.textContent = '이 기기에서 알림이 꺼져 있습니다.'; status.style.color = 'var(--muted)'; }
  }
}
function saveUserSettings() {
  const chk = document.getElementById('us-push-enabled');
  const pref = { enabled: chk ? chk.checked : true };
  localStorage.setItem('nd_user_notify', JSON.stringify(pref));
  toast(pref.enabled ? '알림 설정 켜짐' : '알림 설정 꺼짐', 'success');
}
async function _refreshPushBtn() {
  // 접속마다 1번: 이 기기에 저장된 개인 알림 설정을 서버 구독 정보에도 맞춰 둠(예전에 끈 설정도 서버가 알게)
  if (!window._ndPrefsSynced && currentUser && currentUser.staffId) { window._ndPrefsSynced = true; _pushSavePrefs(true); }
  const btn = document.getElementById('push-toggle-btn');
  if (!btn) return;
  if (!_pushSupported()) { btn.style.display='none'; return; }
  const subbed = await isPushSubscribed();
  const _bellSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:-2px;margin-right:3px;"><path d="M12 2a1.4 1.4 0 0 0-1.4 1.4v.7A6 6 0 0 0 6 9.8c0 5-2 6-2 6a1 1 0 0 0 .87 1.5h14.26A1 1 0 0 0 20 15.8s-2-1-2-6a6 6 0 0 0-4.6-5.7v-.7A1.4 1.4 0 0 0 12 2z"/><path d="M9.9 19a2.2 2.2 0 0 0 4.2 0H9.9z"/></svg>';
  btn.innerHTML = _bellSvg + (subbed ? '알림 끄기' : '알림 받기');
  btn.style.borderColor = subbed ? '#45847a' : 'var(--border)';
  btn.style.color = subbed ? '#45847a' : 'var(--muted)';
}
async function _sendPublishPush(token) {
  try {
    await fetch(NOTIFY_FN_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY },
      body: JSON.stringify({ mode:'publish', token: token||'' })
    });
  } catch(e) { console.warn('publish push failed', e); }
}

// ===== 공휴일 API =====
async function fetchHolidaysAll() {
  const key=document.getElementById('set-holiday-key').value.trim();
  if (!key) { toast('서비스키를 입력하세요.','error'); return; }
  // API 키 저장
  data.settings.holidayApiKey=key;
  const year=parseInt(document.getElementById('holiday-year').value)||new Date().getFullYear();
  const monthVal=document.getElementById('holiday-month').value.trim();
  const months=monthVal?[parseInt(monthVal)]:Array.from({length:12},(_,i)=>i+1);
  const statusEl=document.getElementById('holiday-status');
  statusEl.textContent='⏳ 불러오는 중...';
  if (!data.holidays) data.holidays={};
  let total=0;
  let errors=[];
  for (const m of months) {
    try {
      const mm=String(m).padStart(2,'0');
      const url=`https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${encodeURIComponent(key)}&solYear=${year}&solMonth=${mm}&_type=json&numOfRows=20`;
      const res=await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json=await res.json();
      const items=json.response?.body?.items?.item;
      if (!items) continue;
      const list=Array.isArray(items)?items:[items];
      list.forEach(item=>{
        if (item.isHoliday==='Y') {
          const loc=String(item.locdate);
          const ds=`${loc.slice(0,4)}-${loc.slice(4,6)}-${loc.slice(6,8)}`;
          data.holidays[ds]=item.dateName;
          total++;
        }
      });
    } catch(e) { errors.push(`${m}월: ${e.message}`); }
  }
  saveData(data);
  if (errors.length) {
    statusEl.textContent=`⚠ ${errors.join(', ')}`;
    statusEl.style.color='var(--sports-light)';
  } else {
    statusEl.textContent=`✅ ${year}년 공휴일 ${total}일 로드 완료`;
    statusEl.style.color='var(--cg-light)';
  }
  renderHolidayList();
  toast(`공휴일 ${total}일 업데이트됨`,'success');
}
function clearHolidays() {
  if (!confirm('모든 공휴일 데이터를 삭제하시겠습니까?')) return;
  data.holidays={};
  saveData(data);
  document.getElementById('holiday-list').innerHTML='';
  document.getElementById('holiday-status').textContent='삭제됨';
  toast('공휴일 초기화됨','success');
}
function renderHolidayList() {
  const el=document.getElementById('holiday-list');
  if (!el) return;
  const holidays=Object.entries(data.holidays||{}).sort((a,b)=>a[0].localeCompare(b[0]));
  el.innerHTML=holidays.map(([ds,name])=>`
    <span style="display:inline-flex;align-items:center;gap:3px;background:#faf2f6;border:1px solid #e6c4d8;border-radius:5px;padding:2px 7px;font-size:11px;color:#a8657f;">
      ${ds.slice(5)} ${name}
      <button onclick="removeHoliday('${ds}')" style="background:none;border:none;cursor:pointer;color:#d65a52;font-size:12px;padding:0;line-height:1;">×</button>
    </span>`).join('');
}
function removeHoliday(ds) {
  delete data.holidays[ds];
  saveData(data); renderHolidayList();
  toast('삭제됨','success');
}

