/* [모듈] js/staff.js — 직원 관리(태그·폼·목록·드래그 정렬) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== STAFF =====
function _tagDefs(dept, employmentType) {
  const tags = [];
  if (dept==='VW'||dept==='CG') {
    tags.push({val:'danjik', label:'당직 가능', bg:'#d65a52'});
  }
  if (dept==='VW'||dept==='CG'||dept==='XR') {
    tags.push({val:'satMorning', label:'토요일 조근', bg:'#8893dc'});
    tags.push({val:'ilgeun', label:'일근 가능', bg:'#f6e0ea', dark:true});
  }
  if (dept==='CG'||dept==='XR'||dept==='PROJECT') {
    tags.push({val:'can3D', label:'3D 가능', bg:'#b69bd6'});
  }
  // 교차 지원 가능 태그 (본인 부서 제외)
  if (dept!=='VW') tags.push({val:'canVW', label:'VW 지원 가능', bg:'#6366f1'});
  if (dept!=='CG') tags.push({val:'canCG', label:'CG 지원 가능', bg:'#4a9fbd'});
  if (dept==='SPORTS'||dept==='조근') {
    [{v:1,l:'월'},{v:2,l:'화'},{v:3,l:'수'},{v:4,l:'목'},{v:5,l:'금'},{v:6,l:'토'},{v:0,l:'일'}].forEach(d=>{
      tags.push({val:'day-'+d.v, label:d.l, bg:dept==='SPORTS'?'#d65a52':'#8893dc'});
    });
  }
  if (employmentType==='freelancer') {
    tags.push({val:'canNewsOh', label:'뉴.오', bg:'#f5e2cc', dark:true});
    tags.push({val:'canWeekend8jin', label:'주말 8진', bg:'#d65a52'});
  } else {
    tags.push({val:'canWeekday8jin', label:'평일 8진', bg:'#d65a52'});
  }
  return tags;
}
function _setTag(el, on) {
  const dark=el.dataset.dark==='true';
  if (on) { el.classList.add('selected'); el.style.background=el.dataset.bg; el.style.borderColor=el.dataset.bg; el.style.color=dark?'#000':'#fff'; }
  else { el.classList.remove('selected'); el.style.background=''; el.style.borderColor=''; el.style.color=''; }
}
function toggleTagSel(el) { _setTag(el, !el.classList.contains('selected')); }

function updateStaffForm() {
  const dept=document.getElementById('staff-dept').value;
  const employmentType=document.getElementById('staff-employment-type').value;
  const isVWCG=dept==='VW'||dept==='CG';
  document.getElementById('desk-group').style.display=(isVWCG&&employmentType!=='freelancer')?'block':'none';
  document.getElementById('morning-desk-group').style.display=(dept==='CG'&&employmentType!=='freelancer')?'block':'none';
  const defs=_tagDefs(dept, employmentType);
  const pool=document.getElementById('staff-tag-pool');
  const section=document.getElementById('staff-tags-section');
  if (defs.length===0) { section.style.display='none'; return; }
  section.style.display='block';
  pool.innerHTML=defs.map(t=>`<div class="tag-sel-item" data-val="${t.val}" data-bg="${t.bg}" data-dark="${t.dark||false}" onclick="toggleTagSel(this)">${t.label}</div>`).join('');
}

function clearStaffForm() {
  document.getElementById('edit-staff-id').value='';
  document.getElementById('staff-name').value='';
  document.getElementById('staff-dept').value='VW';
  document.getElementById('staff-desk-priority').value='';
  document.getElementById('staff-employment-type').value='employee';
  document.getElementById('staff-probation-start').value='';
  document.getElementById('staff-probation-end').value='';
  updateStaffForm();
}

function _readTags() {
  const sel=[...document.querySelectorAll('.tag-sel-item.selected')].map(t=>t.dataset.val);
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

function saveStaff() {
  const name=document.getElementById('staff-name').value.trim();
  if (!name) { toast('이름을 입력하세요.','error'); return; }
  const dept=document.getElementById('staff-dept').value;
  const deskPriorityVal=document.getElementById('staff-desk-priority').value;
  const deskPriority=deskPriorityVal?parseInt(deskPriorityVal):null;
  const morningDeskPriorityVal=document.getElementById('staff-morning-desk-priority').value;
  const morningDeskPriority=morningDeskPriorityVal?parseInt(morningDeskPriorityVal):null;
  const editId=document.getElementById('edit-staff-id').value;
  const employmentType=document.getElementById('staff-employment-type').value;
  const {canDanjik, canSatMorning, canIlgeun, canVW, canCG, can3D, canNewsOh, canWeekend8jin, canWeekday8jin, availableDays}=_readTags();
  const probationStart=document.getElementById('staff-probation-start').value||null;
  const probationEnd=document.getElementById('staff-probation-end').value||null;
  if (editId) {
    const p=data.staff.find(x=>x.id===editId);
    if (p) { p.name=name; p.dept=dept; p.deskPriority=deskPriority; p.morningDeskPriority=morningDeskPriority; p.canDanjik=canDanjik; p.canSatMorning=canSatMorning; p.canIlgeun=canIlgeun; p.canVW=canVW; p.canCG=canCG; p.can3D=can3D; p.canNewsOh=canNewsOh; p.canWeekend8jin=canWeekend8jin; p.canWeekday8jin=canWeekday8jin; p.availableDays=availableDays; p.employmentType=employmentType; p.probationStart=probationStart; p.probationEnd=probationEnd; }
    toast(`${name} 수정됨`,'success');
  } else {
    data.staff.push({id:Date.now().toString(36)+Math.random().toString(36).substr(2,4),name,dept,deskPriority,morningDeskPriority,canDanjik,canSatMorning,canIlgeun,canVW,canCG,can3D,canNewsOh,canWeekend8jin,canWeekday8jin,active:true,availableDays,employmentType,probationStart,probationEnd});
    toast(`${name} 추가됨`,'success');
  }
  saveData(data); clearStaffForm(); renderStaffTable();
}

function editStaff(id) { openStaffModal(id); }
function toggleStaffActive(id) {
  const p=data.staff.find(x=>x.id===id); if(p){p.active=!p.active;saveData(data);renderStaffTable();}
}
function deleteStaff(id) {
  const p=data.staff.find(x=>x.id===id); if(!p) return;
  if(!confirm(`${p.name}을(를) 삭제하시겠습니까?`)) return;
  data.staff=data.staff.filter(x=>x.id!==id); saveData(data); renderStaffTable(); toast('삭제됨','success');
}
let staffDeptFilter = 'ALL';
let _dragSrcId = null;

function setStaffFilter(dept) {
  staffDeptFilter = dept;
  document.querySelectorAll('.staff-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.dept === dept);
  });
  renderStaffTable();
}

function renderStaffTable() {
  const all = data.staff;
  const filtered = staffDeptFilter === 'ALL' ? all : all.filter(s => s.dept === staffDeptFilter);
  const employees = filtered.filter(s => s.employmentType !== 'freelancer');
  const freelancers = filtered.filter(s => s.employmentType === 'freelancer');
  const activeAll = all.filter(s => s.active !== false);
  const filterLabel = staffDeptFilter === 'ALL' ? '' : ` (${staffDeptFilter} 필터)`;
  document.getElementById('staff-count-label').textContent =
    `직원A ${all.filter(s=>s.employmentType!=='freelancer'&&s.active!==false).length}명 / 직원B ${all.filter(s=>s.employmentType==='freelancer'&&s.active!==false).length}명 재직 (전체 ${activeAll.length}명)${filterLabel}`;

  const noHtml = '<span style="color:var(--muted);font-size:11px;">-</span>';
  const yesHtml = '<span style="color:var(--cg);font-size:11px;">✓</span>';

  function deskLabel(s) {
    if (s.dept !== 'VW' && s.dept !== 'CG') return '-';
    const p = s.deskPriority;
    if (!p) return noHtml;
    const c = ['#d65a52','#d4b06a','#6366f1'][p-1] || '#888';
    return `<span style="font-weight:700;color:${c};font-size:11px;">${p}번</span>`;
  }

  function staffCard(s) {
    const DEPT_COLORS = {'VW':'#6366f1','CG':'#4a9fbd','조근':'#8893dc','XR':'#0891b2','PROJECT':'#e6a817','SPORTS':'#22a06b'};
    const chip=(bg,color,txt,bd)=>`<span style="background:${bg};color:${color};${bd?('border:1px solid '+bd+';'):''}font-size:10.5px;padding:2px 7px;border-radius:5px;font-weight:700;white-space:nowrap;">${txt}</span>`;
    const tags=[
      s.canDanjik&&chip('#fde2e0','#c0392b','당직'),
      s.canSatMorning&&chip('#8893dc','#fff','토조근'),
      s.canIlgeun&&chip('#f6e0ea','#a34873','일근'),
      s.canVW&&chip('#eef0ff','#4b52d6','VW지원'),
      s.canCG&&chip('#e3f1f6','#3a7f96','CG지원'),
      s.can3D&&chip('#efe8fa','#7a52c0','3D'),
      s.canNewsOh&&chip('#f5e2cc','#9c6b4a','뉴.오'),
      s.canWeekend8jin&&chip('#fde2e0','#c0392b','주말8진'),
      s.canWeekday8jin&&chip('#fde2e0','#c0392b','평일8진'),
      s.morningDeskPriority&&chip('#e5ecf7','#3a5c9a','오전데'+s.morningDeskPriority+'번'),
      (s.contractStart||s.contractEnd)&&chip('#f0fdf4','#166534','계약','#bbf7d0'),
      (s.dispatchStart||s.dispatchEnd)&&chip('#fef3c7','#92400e','파견','#fde68a')
    ].filter(Boolean).join('');
    const sub=[s.employmentType==='freelancer'?'직원B':'직원A'];
    if((s.dept==='VW'||s.dept==='CG')&&s.deskPriority) sub.push('데스크 '+s.deskPriority+'번');
    const av=((s.name||'?').trim().charAt(0))||'?';
    const color=DEPT_COLORS[s.dept]||'#94a3b8';
    return `<div class="staff-card${s.active===false?' inactive':''}" draggable="true" data-staff-id="${s.id}"
      ondragstart="staffDragStart(event,'${s.id}')" ondragover="staffDragOver(event)" ondragleave="staffDragLeave(event)" ondrop="staffDrop(event,'${s.id}')" ondragend="staffDragEnd(event)"
      onclick="openStaffModal('${s.id}')">
      <div class="sc-avatar" style="background:${color};">${_pEsc(av)}</div>
      <div class="sc-body">
        <div class="sc-name-row"><span class="sc-name">${_pEsc(s.name)}</span><span class="dept-badge ${s.dept}" style="font-size:9.5px;">${_pEsc(s.dept)}</span></div>
        <div class="sc-sub">${sub.join(' · ')}</div>
        <div class="sc-tags">${tags||'<span style="color:var(--muted);font-size:10.5px;">근무 속성 없음</span>'}</div>
      </div>
      <span class="sc-dot ${s.active!==false?'on':'off'}" title="${s.active!==false?'재직':'비활성'}"></span>
    </div>`;
  }

  const empEl = document.getElementById('staff-cards-employee');
  const frlEl = document.getElementById('staff-cards-freelancer');
  if (empEl) empEl.innerHTML = employees.length ? employees.map(staffCard).join('') : '<div class="sc-empty">직원A가 없습니다.</div>';
  if (frlEl) frlEl.innerHTML = freelancers.length ? freelancers.map(staffCard).join('') : '<div class="sc-empty">직원B가 없습니다.</div>';
  const _ce=document.getElementById('sc-count-emp'); if(_ce)_ce.textContent=employees.length+'명';
  const _cf=document.getElementById('sc-count-frl'); if(_cf)_cf.textContent=freelancers.length+'명';
}

function staffDragStart(event, staffId) {
  _dragSrcId = staffId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', staffId);
  setTimeout(() => event.target.closest('[data-staff-id]')?.classList.add('dragging'), 0);
}
function staffDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const tr = event.target.closest('[data-staff-id]');
  if (tr && tr.dataset.staffId !== _dragSrcId) {
    document.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
    tr.classList.add('drag-over');
  }
}
function staffDragLeave(event) {
  const tr = event.target.closest('[data-staff-id]');
  if (tr) tr.classList.remove('drag-over');
}
function staffDragEnd(event) {
  document.querySelectorAll('.dragging, .drag-over').forEach(r => {
    r.classList.remove('dragging'); r.classList.remove('drag-over');
  });
}
function staffDrop(event, targetId) {
  event.preventDefault();
  event.stopPropagation();
  if (!_dragSrcId || _dragSrcId === targetId) { staffDragEnd(event); return; }
  const srcIdx = data.staff.findIndex(s => s.id === _dragSrcId);
  const tgtIdx = data.staff.findIndex(s => s.id === targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;
  const [moved] = data.staff.splice(srcIdx, 1);
  data.staff.splice(tgtIdx, 0, moved);
  _dragSrcId = null;
  saveData(data);
  renderStaffTable();
}

