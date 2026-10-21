/* [모듈] js/staff-modal.js — 직원 편집 모달·부서 이동 예약 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 부서 이동 예약(effective-dated) 편집 상태 =====
let _modalDeptSched = [];
function _renderDeptSched(){
  const box=document.getElementById('modal-deptsched-list'); if(!box) return;
  const base=(document.getElementById('modal-staff-dept')||{}).value||'';
  _modalDeptSched.sort((a,b)=>a.start<b.start?-1:1);
  _smFoldSummary();
  if(!_modalDeptSched.length){ box.innerHTML='<div style="font-size:12px;color:var(--muted);padding:2px;">예약 없음 — 항상 '+_pEsc(base)+' 부서.</div>'; return; }
  box.innerHTML=_modalDeptSched.map((h,i)=>`<div class="avoid-row" style="margin-bottom:6px;"><span class="avoid-chip">${_pEsc(h.start)} 부터 <b style="color:var(--accent);margin-left:3px;">${_pEsc(h.dept)}</b></span><button class="avoid-del" onclick="_deptSchedRemove(${i})" title="삭제">✕</button></div>`).join('');
}
function _deptSchedAdd(){
  const d=(document.getElementById('modal-deptsched-date')||{}).value;
  const dp=(document.getElementById('modal-deptsched-dept')||{}).value;
  if(!d){ toast('이동 시작일을 선택하세요','error'); return; }
  if(_modalDeptSched.some(h=>h.start===d)){ toast('같은 날짜 예약이 이미 있어요','error'); return; }
  _modalDeptSched.push({start:d,dept:dp});
  document.getElementById('modal-deptsched-date').value='';
  _renderDeptSched();
}
function _deptSchedRemove(i){ _modalDeptSched.splice(i,1); _renderDeptSched(); }
// ===== 직원 편집 모달 =====
function openStaffModal(id) {
  const p = data.staff.find(x => x.id === id); if (!p) return;
  const ov = document.getElementById('staff-edit-modal');
  ov.querySelector('#modal-edit-staff-id').value = p.id;
  const _mt=document.getElementById('staff-modal-title'); if(_mt) _mt.textContent = (p.name||'직원');
  ov.querySelector('#modal-staff-dept').value = p.dept;
  ov.querySelector('#modal-staff-desk-priority').value = p.deskPriority || '';
  ov.querySelector('#modal-staff-morning-desk-priority').value = p.morningDeskPriority || '';
  ov.querySelector('#modal-staff-employment-type').value = p.employmentType || 'employee';
  updateStaffModalForm();
  ov.querySelector('#modal-contract-start').value = p.contractStart || '';
  ov.querySelector('#modal-contract-end').value = p.contractEnd || '';
  ov.querySelector('#modal-dispatch-start').value = p.dispatchStart || '';
  ov.querySelector('#modal-dispatch-end').value = p.dispatchEnd || '';
  ov.querySelector('#modal-probation-start').value = p.probationStart || '';
  ov.querySelector('#modal-probation-end').value = p.probationEnd || '';
  ov.querySelectorAll('.modal-tag-sel-item').forEach(el => {
    const v = el.dataset.val; let on = false;
    if (v==='danjik') on=!!p.canDanjik;
    else if (v==='satMorning') on=!!p.canSatMorning;
    else if (v==='ilgeun') on=!!p.canIlgeun;
    else if (v==='canVW') on=!!p.canVW;
    else if (v==='canCG') on=!!p.canCG;
    else if (v==='can3D') on=!!p.can3D;
    else if (v==='canNewsOh') on=!!p.canNewsOh;
    else if (v==='canWeekend8jin') on=!!p.canWeekend8jin;
    else if (v==='canWeekday8jin') on=!!p.canWeekday8jin;
    else if (v==='canJogeunSub') on=!!p.canJogeunSub;
    else if (v.startsWith('day-')) on=(p.availableDays||[]).includes(parseInt(v.replace('day-','')));
    _setModalTag(el, on);
  });
  _wlStaffModalRefresh(p.id);
  _modalDeptSched = Array.isArray(p.deptSchedule) ? p.deptSchedule.map(h=>({start:h.start,dept:h.dept})) : [];
  _renderDeptSched();
  ov.querySelectorAll('details.sm-fold').forEach(d=>{ d.open=false; });   // 계약·파견·수습·부서 이동 예약은 접어서 열기(필요할 때만 펼침)
  const _ab=document.getElementById('modal-active-btn'); if(_ab) _ab.textContent = p.active===false ? '활성화' : '비활성화';
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeStaffModal() {
  const el = document.getElementById('staff-edit-modal');
  if (el && el.classList.contains('open')) {
    el.classList.add('nd-closing');
    setTimeout(()=>{ el.classList.remove('open'); el.classList.remove('nd-closing'); }, 360);
  }
  document.body.style.overflow = '';
}
function _setModalTag(el, on) {
  if (on) { el.classList.add('selected'); el.style.background=el.dataset.bg; el.style.color=el.dataset.dark==='true'?'#000':'#fff'; el.style.borderColor=el.dataset.bg; }
  else { el.classList.remove('selected'); el.style.background=''; el.style.color=''; el.style.borderColor=''; }
}
function updateStaffModalForm() {
  const ov = document.getElementById('staff-edit-modal');
  const dept = ov.querySelector('#modal-staff-dept').value;
  const employmentType = ov.querySelector('#modal-staff-employment-type').value;
  ov.querySelector('#modal-desk-group').style.display = ((dept==='VW'||dept==='CG') && employmentType!=='freelancer') ? 'block' : 'none';
  ov.querySelector('#modal-morning-desk-group').style.display = (dept==='CG' && employmentType!=='freelancer') ? 'block' : 'none';
  ov.querySelector('#modal-contract-group').style.display = employmentType==='freelancer' ? 'block' : 'none';
  ov.querySelector('#modal-dispatch-group').style.display = employmentType==='employee' ? 'block' : 'none';
  const _wg=ov.querySelector('#modal-wise-group'); if(_wg) _wg.style.display = employmentType==='freelancer' ? 'block' : 'none';   // WISE 휴가 내역은 직원B만
  ov.querySelector('.staff-modal')?.classList.toggle('sm-one', employmentType!=='freelancer');   // 직원A는 오른쪽 칸이 비므로 넓은 화면에서도 한 칸 창
  const defs = _tagDefs(dept, employmentType);
  const pool = ov.querySelector('#modal-staff-tag-pool');
  pool.innerHTML = defs.map(t => `<div class="tag-sel-item modal-tag-sel-item" data-val="${t.val}" data-bg="${t.bg}" data-dark="${t.dark||false}" onclick="_setModalTag(this,!this.classList.contains('selected'))">${t.label}</div>`).join('');
}
function _readModalTags(ov) {
  const sel = [...ov.querySelectorAll('.modal-tag-sel-item.selected')].map(t=>t.dataset.val);
  return {
    canDanjik: sel.includes('danjik'),
    canSatMorning: sel.includes('satMorning'),
    canIlgeun: sel.includes('ilgeun'),
    canVW: sel.includes('canVW'),
    canCG: sel.includes('canCG'),
    can3D: sel.includes('can3D'),
    canNewsOh: sel.includes('canNewsOh'),
    canWeekend8jin: sel.includes('canWeekend8jin'),
    canWeekday8jin: sel.includes('canWeekday8jin'),
    canJogeunSub: sel.includes('canJogeunSub'),
    availableDays: sel.filter(v=>v.startsWith('day-')).map(v=>parseInt(v.replace('day-','')))
  };
}
function saveStaffModal() {
  const ov = document.getElementById('staff-edit-modal');
  const id = ov.querySelector('#modal-edit-staff-id').value;
  const p = data.staff.find(x=>x.id===id); if (!p) return;
  const _old = { dept: p.dept, deptSchedule: Array.isArray(p.deptSchedule) ? p.deptSchedule.map(h=>({start:h.start,dept:h.dept})) : undefined };   // 부서 이동 전(근무 목록 옮기기용)
  const tags = _readModalTags(ov);
  p.dept = ov.querySelector('#modal-staff-dept').value;
  p.employmentType = ov.querySelector('#modal-staff-employment-type').value;
  p.deskPriority = parseInt(ov.querySelector('#modal-staff-desk-priority').value)||null;
  p.morningDeskPriority = parseInt(ov.querySelector('#modal-staff-morning-desk-priority').value)||null;
  if(p.employmentType==='freelancer'){ p.deskPriority=null; p.morningDeskPriority=null; }
  p.contractStart = p.employmentType==='freelancer' ? (ov.querySelector('#modal-contract-start').value||null) : null;
  p.contractEnd   = p.employmentType==='freelancer' ? (ov.querySelector('#modal-contract-end').value||null)   : null;
  p.dispatchStart = p.employmentType==='employee'   ? (ov.querySelector('#modal-dispatch-start').value||null) : null;
  p.dispatchEnd   = p.employmentType==='employee'   ? (ov.querySelector('#modal-dispatch-end').value||null)   : null;
  p.probationStart = ov.querySelector('#modal-probation-start').value||null;
  p.probationEnd   = ov.querySelector('#modal-probation-end').value||null;
  Object.assign(p, tags);
  if (p.dept === '팀장') _ndLeadClear(p);   // 팀장 = 근무표 밖(로그인만) — 근무 생성에 안 들어가게
  const _ds=_modalDeptSched.filter(h=>h.start&&h.dept).sort((a,b)=>a.start<b.start?-1:1);
  if(_ds.length) p.deptSchedule=_ds; else delete p.deptSchedule;
  const _moved = _deptMoveLists(p, _old), _to = String(deptOn(p, _todayStr())||'').toUpperCase();
  saveData(data); renderStaffTable(); closeStaffModal(); toast(_moved ? `저장됨 · 오늘부터 근무 ${_moved}일을 ${_to} 근무로 옮겼어요` : '저장됨','success');
  if(typeof wsInfoRefresh==='function') wsInfoRefresh();   // 참고 자료 창이 열려 있으면 바뀐 계약·부서 반영
}
// 팀장(10-21): 근무표에 안 나오고 로그인·계정만 있는 사람 — 표는 부서별로 그려서 저절로 빠지고, 근무 생성에 안 들어가게 할 수 있는 근무 태그·데스크 우선순위를 비움
function _ndLeadClear(p) {
  ['canDanjik', 'canSatMorning', 'canIlgeun', 'canVW', 'canCG', 'can3D', 'canNewsOh', 'canWeekend8jin', 'canWeekday8jin', 'canJogeunSub'].forEach((k) => { p[k] = false; });
  p.availableDays = []; p.deskPriority = null; p.morningDeskPriority = null;
}
// 부서를 옮기면 오늘부터 그날 근무 목록(VW·CG·XR)도 새 부서로(10-21) — 표는 부서 줄을 따르는데 홈 '오늘 근무'·CG배정·인원 셈은 이 목록을 따라서 어긋났음.
// 옮기는 칸: 오늘 이후(배포·작성소 둘 다) 중 ① 이번 저장으로 그날 부서가 바뀐 날 ② 이미 부서를 옮겼는데 엑셀 칸이 그냥 '정근'인 채 예전 부서 목록에 남은 날
// ③ 이미 옮겼는데 오늘 이후 근무 대부분(3일 이상·제 부서보다 많이)이 다른 한 부서 목록에 남아 있으면 그 목록 = 예전 부서로 봄(가끔 하는 대체 근무와 구분).
// 'VW대'·'CG대'·VW2(대체 근무)와 데스크는 그대로. 엑셀 칸 글자는 계속 보이게 서명을 다시 맞춤. 반환 = 옮긴 날 수
function _deptMoveLists(p, old) {
  const key = d => ({ vw: 'vw', cg: 'cg', xr: 'xr' })[String(d || '').toLowerCase()];
  const list = (e, k, make) => k === 'xr' ? (make ? (e.xr ||= []) : e.xr) : (make ? ((e[k] ||= {}).workers ||= []) : (e[k] && e[k].workers));
  const today = _todayStr(), both = [[data.schedule, data.newLeaves], [data.draft && data.draft.schedule, data.draft && data.draft.newLeaves]];
  const cnt = { vw: 0, cg: 0, xr: 0 }, moved = new Set(); let own = 0;
  both.forEach(([sch]) => sch && Object.keys(sch).forEach(ds => {
    const e = sch[ds], k = key(deptOn(p, ds)); if (ds < today || !e || !k) return;
    ['vw', 'cg', 'xr'].forEach(f => { const L = list(e, f); if (L && L.includes(p.id)) { if (f === k) own++; else cnt[f]++; } });
  }));
  const stale = Object.keys(cnt).find(f => cnt[f] >= 3 && cnt[f] > own);
  both.forEach(([sch, lvs]) => {
    if (!sch) return;
    Object.keys(sch).forEach(ds => {
      const e = sch[ds]; if (ds < today || !e) return;
      const to = key(deptOn(p, ds)); if (!to) return;
      const was = key(deptOn(old, ds)), lv = lvs && lvs[ds];
      ['vw', 'cg', 'xr'].forEach(from => {
        const L = from === to ? null : list(e, from); if (!L || !L.includes(p.id)) return;
        if ((from === 'vw' && e.vw.desk === p.id) || (from === 'cg' && [e.cg.desk8, e.cg.desk, e.cg.desk5].includes(p.id))) return;
        const imp = _importCellDisplay(e, p.id, lv), k = imp ? WORK_TYPE_MAP[_normalizeImportedWorkType(imp.text)] : null;
        if (k === 'vw-sub' || k === 'cg-sub' || _isVw2(e, p.id)) return;
        if (!(from === was && was !== to) && k !== 'work' && from !== stale) return;
        L.splice(L.indexOf(p.id), 1);
        const T = list(e, to, true); if (!T.includes(p.id)) T.push(p.id);
        if (imp) e.importedCells[p.id].signature = _importCellSignature(e, p.id, lv);
        moved.add(ds);
      });
    });
  });
  return moved.size;   // 옮긴 날 수(배포·작성소에 같은 날이 있어도 하루로)
}
function _modalToggleActive(){
  const id=(document.getElementById('modal-edit-staff-id')||{}).value;
  const p=data.staff.find(x=>x.id===id); if(!p) return;
  p.active = p.active===false;   // false→활성, true/undefined→비활성
  saveData(data); renderStaffTable();
  const b=document.getElementById('modal-active-btn'); if(b) b.textContent = p.active===false ? '활성화' : '비활성화';
  toast(p.active===false?'비활성 처리됨':'활성화됨','success');
}
function _modalDeleteStaff(){
  const id=(document.getElementById('modal-edit-staff-id')||{}).value;
  const p=data.staff.find(x=>x.id===id); if(!p) return;
  const nm=document.getElementById('staff-del-name'); if(nm) nm.textContent=p.name;
  const ov=document.getElementById('staff-del-confirm'); if(ov) ov.style.display='flex';
}
function _hideDelConfirm(){ const ov=document.getElementById('staff-del-confirm'); if(ov) ov.style.display='none'; }
function _confirmDeleteStaff(){
  const id=(document.getElementById('modal-edit-staff-id')||{}).value;
  const p=data.staff.find(x=>x.id===id); if(!p){ _hideDelConfirm(); return; }
  data.staff=data.staff.filter(x=>x.id!==id);
  saveData(data); renderStaffTable(); _hideDelConfirm(); closeStaffModal(); toast('삭제됨','success');
}
document.getElementById('staff-edit-modal').addEventListener('click', function(e){
  if (e.target === this) closeStaffModal();
});

// 휴가신청 테이블 — 열 클릭 시 팝업
document.addEventListener('click', function(e){
  const cell = e.target.closest('.lreq-table [data-sid]');
  if (!cell) return;
  e.stopPropagation();
  openLrPopup(cell.dataset.sid);
});
// 근무표 테이블 — 열(사람) 아무 셀이나 클릭 시 그 사람 근무 팝업 (관리자는 셀 편집 우선이라 제외)
document.addEventListener('click', function(e){
  if (isAdmin) return;
  const cell = e.target.closest('.excel-table [data-sid]');
  if (!cell || !document.getElementById('view-table')?.classList.contains('active')) return;
  openPersonSchedule(cell.dataset.sid);
});

// 열 호버 하이라이트 — getBoundingClientRect 방식으로 colspan/rowspan 무관하게 정확히 동작
(function(){
  let lastTable=null, lastMidX=-1;
  function clearHl(table){
    (table||document).querySelectorAll('.col-hl').forEach(el=>el.classList.remove('col-hl'));
  }
  function hlColumn(table, midX){
    table.querySelectorAll('tr').forEach(tr=>{
      [...tr.cells].forEach(c=>{
        if(c.colSpan>1) return; // 부서 그룹 헤더 스킵
        const r=c.getBoundingClientRect();
        if(r.left<=midX && r.right>midX) c.classList.add('col-hl');
      });
    });
  }
  document.addEventListener('mouseover',function(e){
    const cell=e.target.closest('.excel-table td,.excel-table th');
    if(!cell){clearHl(lastTable);lastTable=null;lastMidX=-1;return;}
    const table=cell.closest('.excel-table');
    const r=cell.getBoundingClientRect();
    const midX=(r.left+r.right)/2;
    if(table===lastTable && Math.abs(midX-lastMidX)<2) return;
    clearHl(lastTable);
    lastTable=table; lastMidX=midX;
    hlColumn(table, midX);
  });
  document.addEventListener('mouseout',function(e){
    if(!e.relatedTarget?.closest('.excel-table')){clearHl(lastTable);lastTable=null;lastMidX=-1;}
  });
})();
// 직원B 편집 창의 WISE 휴가 내역(가져오기 버튼·붙여넣기 포함) — 내용은 js/workshop.js _wlListHTML·_wlBar
let _wlModalId=null;
function _wlStaffModalRefresh(id){
  if(id) _wlModalId=id; const box=document.getElementById('modal-wise-leave'); if(!box||!_wlModalId) return;
  box.innerHTML=_wlListHTML(_wlModalId);   // 가져오기 버튼은 관리자 패널 '휴가' 탭에만
}
// 접어 둔 칸(계약·파견·수습·부서 이동 예약) 제목 옆 요약 — 접혀 있어도 값이 있는지 보이게
function _smFoldSummary(){
  const v=id=>(document.getElementById(id)||{}).value||'', rng=(a,b)=>{ const x=v(a), y=v(b); return x||y ? (x||'…')+' ~ '+(y||'…') : '없음'; };
  const sum={ contract:rng('modal-contract-start','modal-contract-end'), dispatch:rng('modal-dispatch-start','modal-dispatch-end'), probation:rng('modal-probation-start','modal-probation-end'),
    dsched:_modalDeptSched.length ? _modalDeptSched.map(h=>h.start.slice(2).replace(/-/g,'.')+' '+h.dept).join(', ') : '없음' };
  document.querySelectorAll('#staff-edit-modal .sm-fold-sum').forEach(el=>{ const t=sum[el.dataset.sum]||''; el.textContent=t; el.classList.toggle('empty', t==='없음'); });
}
