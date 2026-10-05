/* [모듈] js/staff-modal.js — 직원 편집 모달·부서 이동 예약 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 부서 이동 예약(effective-dated) 편집 상태 =====
let _modalDeptSched = [];
function _renderDeptSched(){
  const box=document.getElementById('modal-deptsched-list'); if(!box) return;
  const base=(document.getElementById('modal-staff-dept')||{}).value||'';
  _modalDeptSched.sort((a,b)=>a.start<b.start?-1:1);
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
    else if (v.startsWith('day-')) on=(p.availableDays||[]).includes(parseInt(v.replace('day-','')));
    _setModalTag(el, on);
  });
  _modalDeptSched = Array.isArray(p.deptSchedule) ? p.deptSchedule.map(h=>({start:h.start,dept:h.dept})) : [];
  _renderDeptSched();
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
    availableDays: sel.filter(v=>v.startsWith('day-')).map(v=>parseInt(v.replace('day-','')))
  };
}
function saveStaffModal() {
  const ov = document.getElementById('staff-edit-modal');
  const id = ov.querySelector('#modal-edit-staff-id').value;
  const p = data.staff.find(x=>x.id===id); if (!p) return;
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
  const _ds=_modalDeptSched.filter(h=>h.start&&h.dept).sort((a,b)=>a.start<b.start?-1:1);
  if(_ds.length) p.deptSchedule=_ds; else delete p.deptSchedule;
  saveData(data); renderStaffTable(); closeStaffModal(); toast('저장됨','success');
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

