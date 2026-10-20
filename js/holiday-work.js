/* [모듈] js/holiday-work.js — 관리자 패널 '휴일 사전근무' 탭: 휴일에 일하는 사람을 WISE 휴일근무 사전신청(peda0215)에 올림 | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것)
   대상 = 직원A(employmentType 'employee' — 직원B는 해당 없음, 10-17) 중 게시된 근무표(data.schedule)에서 그날 몇 시라도 일하는 사람(근무 시간 기준) — 그날 근무자 + 전날 당직(다음날 00:00–10:00, 표엔 '퇴근').
   예) 금 당직 → 토요일, 토 당직 → 토(21–24)·일(00–10) 둘 다, 일 당직 → 일요일(21–24).
   근무내용 기본 'CG제작'(스포츠 'SPORTS' → '스포츠CG'), 사람마다 고치면 이 PC에 기억(localStorage nd_hw_cont).
   WISE 채우기·결재는 근무표 PC 앱만(desktop/wise-fetch.js wiseHolidayApply). 결재까지 했으면 data.hwApply[날짜] = { at, by, n }. */
let _hwSel='';
// 쉬는 날(휴일근무 사전신청·대휴 기준) = 토·일 + 공휴일(data.holidays — 평일 공휴일 포함). isWeekdayForm 은 8뉴스 편성·인원 틀이라
// 평일 공휴일(성탄절·3·1절·선거일 등)을 평일 틀로 봐서 여기엔 안 씀 — 근무시간 입력 대휴(js/app-mode.js _wtHolHours)도 이걸 씀
function ndIsOffDay(ds){ const w=new Date(ds+'T00:00:00').getDay(); return w===0||w===6||!!((data.holidays||{})[ds]); }
// 근무 시간(근무 안내 — 메모리 reference_shift_rules): 그날 일하는 시간만
function _hwTime(role, e, sid){
  if(role==='퇴근') return '00:00–10:00 (전날 당직)';
  if(role==='당직') return '21:00–24:00 (다음날 10:00까지)';
  if(role==='조근') return '04:00–13:00';
  if(role==='일근') return '10:00–21:00';
  if(/^뉴\.오/.test(role)) return '11:00–21:00';
  if(e&&(e.morningDesk===sid||e.satMorning===sid)) return '09:00–18:00';
  return '12:00–21:00';
}
// 그날 일하는 역할인가(빈칸·휴가·'-'·'0'·엑셀에서 가져온 '비번'·'당직비번'은 아님 — 표 집계 _importCellDisplay().count 와 같게)
function _hwWorks(role){ const r=String(role||'').trim(); return !!r&&!/^(-|0|휴가|비번|당직비번)$/.test(r)&&!/휴가|공가|경조|병가|연차/.test(r); }
function _hwPeople(ds){
  const e=(data.schedule||{})[ds]; if(!e) return [];
  // 직원A만(직원B는 휴일 사전근무 신청 대상 아님)
  return (data.staff||[]).filter(s=>s.active!==false&&s.employmentType!=='freelancer').map(s=>{ let role=''; try{ role=workCellRole(e,s,ds); }catch(err){} return { s, role }; })
    .filter(x=>_hwWorks(x.role)).map(x=>({ ...x, dept:String(deptOn(x.s,ds)||x.s.dept||''), time:_hwTime(x.role,e,x.s.id) }));
}
function _hwDates(){
  const t=_todayStr(), out=[];
  for(let i=0;i<=62;i++){ const ds=addDays(t,i); if(!ndIsOffDay(ds)||!(data.schedule||{})[ds]) continue; out.push(ds); }
  return out;
}
function _hwContMap(){ try{ return JSON.parse(localStorage.getItem('nd_hw_cont')||'{}')||{}; }catch(e){ return {}; } }
function _hwCont(p){ const m=_hwContMap(); if(m[p.s.id]) return m[p.s.id]; return /SPORTS|스포츠/i.test(p.dept)?'스포츠CG':'CG제작'; }
function _hwMD(ds){ const d=new Date(ds+'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`; }
function renderHworkTab(){
  const host=document.getElementById('hwork-area'); if(!host) return;
  const dates=_hwDates(), app=typeof ND_APP!=='undefined'&&ND_APP&&!!window.ndApp?.wiseHoliday, ro=typeof isAdminTest!=='undefined'&&isAdminTest;
  const note=app?'':'<p class="hw-note">WISE에 올리는 건 근무표 PC 앱(설치판)에서만 돼요. 여기선 명단만 볼 수 있어요.</p>';
  if(!dates.length){ host.innerHTML=note+'<div class="wi-empty">앞으로 두 달 안에 게시된 근무표의 휴일이 없어요.</div>'; return; }
  if(!dates.includes(_hwSel)) _hwSel=dates.find(ds=>!(data.hwApply||{})[ds])||dates[0];
  const done=data.hwApply||{};
  const items=dates.map(ds=>{ const n=_hwPeople(ds).length, hn=(data.holidays||{})[ds], dn=done[ds];
    return `<button type="button" class="fl-item hw-item${ds===_hwSel?' on':''}" aria-pressed="${ds===_hwSel}" onclick="_hwPick('${ds}')">
      <span class="fl-id"><b>${_hwMD(ds)}</b><small>${_wiEsc(hn||'주말')}</small></span>
      <span class="fl-meta"><span class="hw-n">${n}명</span>${dn?'<em class="hw-done">올림</em>':''}</span></button>`; }).join('');
  const ds=_hwSel, ppl=_hwPeople(ds), dn=done[ds];
  const rows=ppl.map(p=>`<tr data-sid="${p.s.id}" data-name="${_wiEsc(p.s.name)}">
      <td><input type="checkbox" class="hw-on" checked aria-label="${_wiEsc(p.s.name)} 올리기"></td>
      <td><b>${_wiEsc(p.s.name)}</b><small>${_wiEsc(p.dept)}</small></td>
      <td><span class="hw-role">${_wiEsc(p.role==='근무'?'정근':p.role)}</span></td>
      <td class="hw-time">${_wiEsc(p.time)}</td>
      <td><input type="text" class="wi-in hw-cont" maxlength="30" value="${_wiEsc(_hwCont(p))}" aria-label="${_wiEsc(p.s.name)} 근무내용"></td></tr>`).join('');
  host.innerHTML=`${note}<div class="fl-split">
    <div class="fl-list" role="list" aria-label="휴일">${items}</div>
    <div class="fl-detail hw-detail">
      <div class="fl-head"><div class="fl-id"><b>${_hwMD(ds)} 휴일 근무 ${ppl.length}명</b><small>근무표 기준 직원A — 그날 몇 시라도 일하는 사람(전날 당직 포함)</small></div>${dn?`<em class="hw-done">${_wiEsc((dn.at||'').slice(5,10).replace('-','/'))} ${_wiEsc(dn.by||'')} 올림</em>`:''}</div>
      ${ppl.length||_hwExtra().length?`<table class="hw-tbl"><thead><tr><th><input type="checkbox" checked aria-label="모두" onchange="document.querySelectorAll('#hwork-area .hw-on').forEach(c=>c.checked=this.checked)"></th><th>이름</th><th>근무</th><th>시간</th><th>근무내용</th></tr></thead><tbody>${rows}${_hwExtra().map(x=>`<tr data-sid="" data-name="${_wiEsc(x.name)}" class="hw-extra"><td><input type="checkbox" class="hw-on" aria-label="${_wiEsc(x.name)} 올리기"></td><td><b>${_wiEsc(x.name)}</b><small>근무표 밖</small></td><td><span class="hw-role">추가</span></td><td class="hw-time">-</td><td><div class="hw-cont-row"><input type="text" class="wi-in hw-cont" maxlength="30" value="${_wiEsc(x.cont)}" aria-label="${_wiEsc(x.name)} 근무내용" onchange="_hwExtraCont('${_wiEsc(x.name)}',this.value)"><button type="button" class="hw-del" onclick="_hwExtraDel('${_wiEsc(x.name)}')" aria-label="${_wiEsc(x.name)} 지우기" title="추가 인원에서 지우기">×</button></div></td></tr>`).join('')}</tbody></table>`:'<div class="wi-empty">이날 근무자가 없어요.</div>'}
      <div class="hw-extra-in"><span>근무표 밖 추가 인원</span><input type="text" class="wi-in" id="hw-x-name" maxlength="20" placeholder="이름" aria-label="추가할 이름" onkeydown="if(event.key==='Enter')_hwExtraAdd()"><input type="text" class="wi-in" id="hw-x-cont" maxlength="30" placeholder="근무내용(예: CG총괄)" aria-label="추가할 사람 근무내용" onkeydown="if(event.key==='Enter')_hwExtraAdd()"><button type="button" class="hw-add" onclick="_hwExtraAdd()">추가</button><small>표 아래에 체크칸으로 붙어요(기본 꺼짐), 줄 오른쪽 ×로 지워요 — 이 PC가 기억</small></div>
      <p class="hw-note">WISE 휴일근무 사전신청 창이 열리고, 체크한 사람을 근무여부 Y·근무내용으로 채워요. <b>채우고 결재</b>는 WISE 창 없이 결재 확인까지 끝내요. <b>채우기만</b>은 WISE 창에 채워 두고 직접 결재해요. WISE 팀원 목록에 없는 이름은 빠지고 알려 드려요.</p>
      <p class="hw-status" id="hw-status" role="status"></p>
      <div class="hw-foot"><button type="button" class="hw-fill" onclick="_hwRun(false)" ${!app||ro||!ppl.length?'disabled':''}>채우기만</button><button type="button" class="hw-go" onclick="_hwRun(true)" ${!app||ro||!ppl.length?'disabled':''}>채우고 결재</button></div>
    </div></div>`;
}
function _hwPick(ds){ _hwSel=ds; renderHworkTab(); }
// 근무표에 없는 사람(팀장 'CG총괄'·스포츠 등): '이름 근무내용, 이름 근무내용' — localStorage nd_hw_extra
function _hwExtraRaw(){ try{ return localStorage.getItem('nd_hw_extra')||''; }catch(e){ return ''; } }
function _hwExtra(){ return _hwExtraRaw().split(/[,\n]/).map(x=>x.trim()).filter(Boolean).map(x=>{ const m=x.match(/^(\S+)\s*(.*)$/); return { name:m[1].slice(0,20), cont:(m[2]||'CG제작').trim().slice(0,30) }; }); }
function _hwExtraSave(v){ try{ localStorage.setItem('nd_hw_extra',String(v||'').slice(0,300)); }catch(e){} renderHworkTab(); }
function _hwExtraPut(list){ _hwExtraSave(list.map(x=>x.name+' '+x.cont).join(', ')); }
function _hwExtraAdd(){
  const n=(document.getElementById('hw-x-name')?.value||'').replace(/[\s,]/g,''), c=(document.getElementById('hw-x-cont')?.value||'').replace(/,/g,' ').trim()||'CG제작';
  if(!n){ document.getElementById('hw-x-name')?.focus(); return; }
  const list=_hwExtra().filter(x=>x.name!==n); list.push({ name:n.slice(0,20), cont:c.slice(0,30) }); _hwExtraPut(list);
}
function _hwExtraDel(name){ _hwExtraPut(_hwExtra().filter(x=>x.name!==name)); }
function _hwExtraCont(name,v){ const c=String(v||'').replace(/,/g,' ').trim(); try{ localStorage.setItem('nd_hw_extra',_hwExtra().map(x=>x.name===name?{ name, cont:c||'CG제작' }:x).map(x=>x.name+' '+x.cont).join(', ').slice(0,300)); }catch(e){} }   // 다시 그리지 않음(다른 줄 체크·입력 그대로)
async function _hwRun(submit){
  const host=document.getElementById('hwork-area'), st=document.getElementById('hw-status'); if(!host||!st) return;
  const ds=_hwSel, rows=[], m=_hwContMap();
  host.querySelectorAll('.hw-tbl tbody tr').forEach(tr=>{ if(!tr.querySelector('.hw-on').checked) return; const cont=tr.querySelector('.hw-cont').value.trim(); rows.push({ name:tr.dataset.name, cont }); if(tr.dataset.sid) m[tr.dataset.sid]=cont; });
  if(!rows.length){ st.textContent='올릴 사람을 하나 이상 골라 주세요.'; return; }
  if(rows.some(r=>!r.cont)){ st.textContent='근무내용이 빈 사람이 있어요.'; return; }
  try{ localStorage.setItem('nd_hw_cont',JSON.stringify(m)); }catch(e){}
  const btns=host.querySelectorAll('.hw-foot button'); btns.forEach(b=>b.disabled=true);
  const off=window.ndApp.onWiseStatus?.(o=>{ st.textContent=o.t||''; });
  try{
    const r=await window.ndApp.wiseHoliday({ date:ds, rows, submit });
    const miss=r&&r.missing&&r.missing.length?` WISE 목록에 없어서 뺀 사람: ${r.missing.join(', ')}`:'';
    if(r&&r.ok){
      if(r.submitted){
        if(!data.hwApply) data.hwApply={};
        data.hwApply[ds]={ at:new Date().toISOString(), by:(staffById(currentUser?.staffId)?.name)||currentUser?.name||'', n:(r.matched||[]).length };
        saveData(data);
      }
      toast((r.submitted?`${_hwMD(ds)} ${r.matched.length}명을 결재까지 마쳤어요.`:`${_hwMD(ds)} ${r.matched.length}명을 채웠어요. WISE 창에서 확인해 주세요.`)+miss,'success');
      renderHworkTab();
    } else { st.textContent=((r&&r.error)||'WISE에 올리지 못했어요.')+miss; if(r&&r.reason==='login'&&typeof _ndWiseState==='function') _ndWiseState(false); }
  }catch(e){ st.textContent='WISE에 올리지 못했어요: '+e.message; }
  finally{ try{ off&&off(); }catch(e){} btns.forEach(b=>{ if(document.contains(b)) b.disabled=false; }); }
}
