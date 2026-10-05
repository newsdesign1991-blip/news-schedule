/* [모듈] js/cell-edit.js — 토스트·근무표 셀 인라인 편집 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== TOAST =====
function toast(msg,type) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.className='toast show '+(type||'');
  setTimeout(()=>el.classList.remove('show'),2500);
}

// ===== INLINE CELL EDITING =====
function cellClick(staffId, dateStr, event) {
  if (!isAdmin) return;
  const s=staffById(staffId); if(!s) return;
  event.stopPropagation();
  const pop=document.getElementById('cell-popover');
  const opts=document.getElementById('cell-pop-opts');
  const dept=s.dept.toLowerCase();
  const curMorning=data.schedule[dateStr]?.morningDesk;
  const isMorning=curMorning===staffId;
  let optHtml=`<div style="font-size:10px;color:#888;font-weight:700;padding:2px 4px 4px;">${s.name}</div>`;
  const _hasCustom=!!((_draftCellMode?data.draft?.schedule:data.schedule)?.[dateStr]?.customCells?.[staffId]);
  optHtml+=`<button class="pop-opt" style="background:${_hasCustom?'#6366f1':'#f0f3f8'};color:${_hasCustom?'#fff':'#64748b'};border:1px solid #c5cce8;" onclick="event.stopPropagation();openCustomCell('${staffId}','${dateStr}')">${_hasCustom?'직접입력(수정)':'직접입력'}</button>`;
  opts.innerHTML=optHtml;
  const rect=event.currentTarget.getBoundingClientRect();
  pop.style.display='block';
  pop.style.left=Math.min(rect.right,window.innerWidth-170)+'px';
  pop.style.top=Math.min(rect.bottom+2,window.innerHeight-220)+'px';
  setTimeout(()=>{document.addEventListener('click',closeCellPop,{once:true});},0);
}

function morningCellClick(dateStr, event) {
  if (!isAdmin) return;
  event.stopPropagation();
  const pop=document.getElementById('cell-popover');
  const opts=document.getElementById('cell-pop-opts');
  const morningStaff=data.staff.filter(s=>s.morningDeskPriority&&s.active!==false);
  const curMorning=data.schedule[dateStr]?.morningDesk||null;
  let optHtml=`<div style="font-size:11px;color:#64748b;font-weight:700;padding:2px 4px;margin-bottom:4px;">조근 지정</div>`;
  optHtml+=`<button class="pop-opt" style="background:#f0f3f8;color:#64748b;" onclick="setMorningDesk('${dateStr}',null)">✕ 없음</button>`;
  morningStaff.sort((a,b)=>(a.morningDeskPriority||9)-(b.morningDeskPriority||9)).forEach(s=>{
    const sel=s.id===curMorning?'★ ':'';
    optHtml+=`<button class="pop-opt" style="background:#E2EFDA;color:#1a3d1a;" onclick="setMorningDesk('${dateStr}','${s.id}')">${sel}${s.name}</button>`;
  });
  opts.innerHTML=optHtml;
  const rect=event.currentTarget.getBoundingClientRect();
  pop.style.display='block';
  pop.style.left=Math.min(rect.right,window.innerWidth-160)+'px';
  pop.style.top=rect.bottom+2+'px';
  setTimeout(()=>{document.addEventListener('click',closeCellPop,{once:true});},0);
}

function closeCellPop() { document.getElementById('cell-popover').style.display='none'; }

function openCustomCell(staffId, dateStr) {
  const pop=document.getElementById('cell-popover');
  const opts=document.getElementById('cell-pop-opts');
  const s=staffById(staffId);
  const _targetSched = _draftCellMode ? (data.draft?.schedule||{}) : data.schedule;
  const ex=_targetSched[dateStr]?.customCells?.[staffId]||{};
  opts.innerHTML=`
    <div style="font-size:10px;color:#888;font-weight:700;padding:2px 4px 6px;">${s?.name||''} 직접입력</div>
    <input type="text" id="cctxt" value="${(ex.text||'').replace(/"/g,'&quot;')}" placeholder="표시 텍스트 (최대 8자)" maxlength="8"
      style="width:100%;padding:5px 8px;border:1px solid #dce3ed;border-radius:6px;font-size:12px;box-sizing:border-box;margin-bottom:6px;">
    <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;font-size:11px;color:#555;flex-wrap:wrap;">
      <label style="display:flex;align-items:center;gap:3px;cursor:pointer;">
        <input type="checkbox" id="ccnobg" ${!ex.bg?'checked':''} onchange="document.getElementById('ccbg').disabled=this.checked"> 배경없음
      </label>
      <input type="color" id="ccbg" value="${ex.bg||'#fffde7'}" ${!ex.bg?'disabled':''} style="width:34px;height:24px;border:none;cursor:pointer;border-radius:4px;padding:1px;">
      <span>글자</span>
      <input type="color" id="cccol" value="${ex.color||'#333333'}" style="width:34px;height:24px;border:none;cursor:pointer;border-radius:4px;padding:1px;">
    </div>
    <div style="display:flex;gap:4px;">
      <button class="pop-opt" style="flex:1;background:#f0f3f8;color:#64748b;" onclick="closeCellPop()">취소</button>
      <button class="pop-opt" style="flex:1;background:#6366f1;color:#fff;" onclick="saveCustomCell('${staffId}','${dateStr}')">저장</button>
      ${ex.text?`<button class="pop-opt" style="background:#fce8e8;color:#d65a52;" onclick="clearCustomCell('${staffId}','${dateStr}')">삭제</button>`:''}
    </div>`;
  pop.style.display='block';
  setTimeout(()=>document.getElementById('cctxt')?.focus(),50);
  setTimeout(()=>{document.addEventListener('click',closeCellPop,{once:true});},0);
}

function saveCustomCell(staffId, dateStr) {
  const text=(document.getElementById('cctxt')?.value||'').trim();
  const noBg=document.getElementById('ccnobg')?.checked;
  const bg=noBg?'':( document.getElementById('ccbg')?.value||'#fffde7');
  const color=document.getElementById('cccol')?.value||'#333333';
  const isDraft = _draftCellMode;
  closeCellPop();
  if (isDraft) {
    if (!data.draft) data.draft = { schedule: {}, newLeaves: {} };
    if (!data.draft.schedule[dateStr]) data.draft.schedule[dateStr] = {vw:{workers:[],desk:null},cg:{workers:[],desk8:null,desk5:null},project:[],sports:[],xr:[],danjik:null,morningDesk:null,notes:''};
    if (!data.draft.schedule[dateStr].customCells) data.draft.schedule[dateStr].customCells = {};
    if (text) { data.draft.schedule[dateStr].customCells[staffId] = {text,bg,color}; }
    else { delete data.draft.schedule[dateStr].customCells[staffId]; }
    saveData(data); renderWorkshopTable(); toast(text?'저장됨':'삭제됨','success');
  } else {
    if(!data.schedule[dateStr]) data.schedule[dateStr]={vw:{workers:[],desk:null},cg:{workers:[],desk8:null,desk5:null},project:[],sports:[],xr:[],danjik:null,morningDesk:null,notes:''};
    if(!data.schedule[dateStr].customCells) data.schedule[dateStr].customCells={};
    if(text){ data.schedule[dateStr].customCells[staffId]={text,bg,color}; }
    else { delete data.schedule[dateStr].customCells[staffId]; }
    saveData(data); renderTable(); toast(text?'저장됨':'삭제됨','success');
  }
}

function clearCustomCell(staffId, dateStr) {
  const isDraft = _draftCellMode;
  closeCellPop();
  if (isDraft) {
    if(data.draft?.schedule?.[dateStr]?.customCells) delete data.draft.schedule[dateStr].customCells[staffId];
    saveData(data); renderWorkshopTable();
  } else {
    if(data.schedule[dateStr]?.customCells) delete data.schedule[dateStr].customCells[staffId];
    saveData(data); renderTable();
  }
  toast('삭제됨','success');
}

function setMorningDesk(dateStr, staffId) {
  closeCellPop();
  if (!data.schedule[dateStr]) data.schedule[dateStr]={vw:{workers:[],desk:null},cg:{workers:[],desk:null},project:[],sports:[],xr:[],danjik:null,morningDesk:null,notes:''};
  data.schedule[dateStr].morningDesk=staffId;
  saveData(data); renderTable(); toast('조근 지정됨','success');
}

function setCell(staffId, dateStr, type) {
  closeCellPop();
  const s=staffById(staffId); if(!s) return;
  const isDraft=_draftCellMode;
  _draftCellMode=false;
  if (isDraft) {
    _pushWsHistory();
    if (!data.draft) data.draft={schedule:{},newLeaves:{}};
    if (!data.draft.schedule) data.draft.schedule={};
  }
  const targetSched=isDraft?data.draft.schedule:data.schedule;
  if (!targetSched[dateStr]) {
    targetSched[dateStr]={vw:{workers:[],desk:null},cg:{workers:[],desk8:null,desk5:null},project:[],sports:[],xr:[],danjik:null,morningDesk:null,notes:''};
  }
  const entry=targetSched[dateStr];
  const dept=s.dept.toLowerCase();
  // 기존 상태 모두 초기화
  if (entry.vw?.workers) entry.vw.workers=entry.vw.workers.filter(id=>id!==staffId);
  if (entry.vw?.desk===staffId) entry.vw.desk=null;
  if (entry.cg?.workers) entry.cg.workers=entry.cg.workers.filter(id=>id!==staffId);
  if (entry.cg?.desk8===staffId) entry.cg.desk8=null;
  if (entry.cg?.desk5===staffId) entry.cg.desk5=null;
  if (entry.cg?.desk===staffId) entry.cg.desk=null;
  entry.project=(entry.project||[]).filter(id=>id!==staffId);
  entry.sports=(entry.sports||[]).filter(id=>id!==staffId);
  entry.xr=(entry.xr||[]).filter(id=>id!==staffId);
  if (entry.danjik===staffId) entry.danjik=null;
  if (entry.morningDesk===staffId) entry.morningDesk=null;
  entry.jogeunEdu=(entry.jogeunEdu||[]).filter(id=>id!==staffId);
  if (data.leaves[staffId]) data.leaves[staffId]=data.leaves[staffId].filter(d=>d!==dateStr);

  if (type==='off') {
    // 커스텀 셀도 초기화
    if(entry.customCells) delete entry.customCells[staffId];
  } else if (type==='vw-work') {
    if (!entry.vw) entry.vw={workers:[],desk:null};
    if (!entry.vw.workers.includes(staffId)) entry.vw.workers.push(staffId);
  } else if (type==='vw-desk') {
    if (!entry.vw) entry.vw={workers:[],desk:null};
    if (!entry.vw.workers.includes(staffId)) entry.vw.workers.push(staffId);
    entry.vw.desk=staffId;
  } else if (type==='cg-work') {
    if (!entry.cg) entry.cg={workers:[],desk8:null,desk5:null};
    if (!entry.cg.workers.includes(staffId)) entry.cg.workers.push(staffId);
  } else if (type==='cg-desk8') {
    if (!entry.cg) entry.cg={workers:[],desk8:null,desk5:null};
    if (!entry.cg.workers.includes(staffId)) entry.cg.workers.push(staffId);
    entry.cg.desk8=staffId;
  } else if (type==='cg-desk5') {
    if (!entry.cg) entry.cg={workers:[],desk8:null,desk5:null};
    if (!entry.cg.workers.includes(staffId)) entry.cg.workers.push(staffId);
    entry.cg.desk5=staffId;
  } else if (type==='prj') {
    if (!entry.project.includes(staffId)) entry.project.push(staffId);
  } else if (type==='spt') {
    if (!entry.sports.includes(staffId)) entry.sports.push(staffId);
  } else if (type==='xr') {
    if (!entry.xr.includes(staffId)) entry.xr.push(staffId);
  } else if (type==='morning') {
    // 조근: 기존 조근 해제 후 이 사람으로 설정 (토글)
    if (data.schedule[dateStr]?.morningDesk===staffId) {
      entry.morningDesk=null; // 토글 off
    } else {
      // 조근이면 해당 dept 근무에도 추가
      if (dept==='vw') { if(!entry.vw)entry.vw={workers:[],desk:null}; if(!entry.vw.workers.includes(staffId))entry.vw.workers.push(staffId); }
      else if (dept==='cg') { if(!entry.cg)entry.cg={workers:[],desk:null}; if(!entry.cg.workers.includes(staffId))entry.cg.workers.push(staffId); }
      entry.morningDesk=staffId;
    }
  } else if (type==='danjik') {
    entry.danjik=staffId;
    // 당직자는 해당 dept 근무에도 추가
    if (dept==='vw') { if(!entry.vw)entry.vw={workers:[],desk:null}; if(!entry.vw.workers.includes(staffId))entry.vw.workers.push(staffId); }
    else if (dept==='cg') { if(!entry.cg)entry.cg={workers:[],desk:null}; if(!entry.cg.workers.includes(staffId))entry.cg.workers.push(staffId); }
    else if (dept==='xr') { if(!entry.xr.includes(staffId))entry.xr.push(staffId); }
  } else if (type==='jogeun-edu') {
    if (!entry.jogeunEdu) entry.jogeunEdu=[];
    if (!entry.jogeunEdu.includes(staffId)) entry.jogeunEdu.push(staffId);
  } else if (type==='leave') {
    if (isDraft) {
      if (!data.draft.newLeaves) data.draft.newLeaves={};
      if (!data.draft.newLeaves[dateStr]) data.draft.newLeaves[dateStr]=[];
      if (!data.draft.newLeaves[dateStr].includes(staffId)) data.draft.newLeaves[dateStr].push(staffId);
    } else {
      if (!data.leaves[staffId]) data.leaves[staffId]=[];
      if (!data.leaves[staffId].includes(dateStr)) data.leaves[staffId].push(dateStr);
      data.leaves[staffId].sort();
    }
  }
  saveData(data);
  if (isDraft) renderWorkshopTable(); else renderTable();
  toast('저장됨','success');
}

