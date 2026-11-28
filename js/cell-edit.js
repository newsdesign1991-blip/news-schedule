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
  optHtml+=`<button class="pop-opt" onclick="event.stopPropagation();openSpecialDutyPicker('${staffId}','${dateStr}')">특수 근무 선택</button>`;
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

// Excel imports and manual choices use the same assignment fields and palette.
// '2' 붙은 근무(정근2·VW2·CG2·당직2·조근2·일근2, 11-10 사용자) = 칸에만 보이고 근무 인원엔 안 셈(VW2 와 같은 방식 — 손입력 칸이라 근무자 명단에 안 들어감)
const SPECIAL_DUTIES = [
  {key:'excluded-work',text:'정근',label:'정근 · 집계 제외',group:'인원 집계 제외',bg:'#d9d9d9',color:'#333333',excl:true},
  {key:'n',text:'N',group:'인원 집계 제외',bg:'var(--surface2)',color:'var(--muted)',excl:true},
  {key:'jg2',text:'정근2',group:'인원 집계 제외',bg:'var(--surface2)',color:'var(--text)'},
  {key:'vw2',text:'VW2',group:'인원 집계 제외',bg:'var(--vw-bg)',color:'var(--vw-light)'},
  {key:'cg2',text:'CG2',group:'인원 집계 제외',bg:'var(--cg-bg)',color:'var(--cg-light)'},   // CG 배우는 중(11-10) — VW2 와 같은 방식
  {key:'dj2',text:'당직2',group:'인원 집계 제외',bg:'#fdf0ef',color:'#d65a52'},
  {key:'jo2',text:'조근2',group:'인원 집계 제외',bg:'var(--r-jogeun-bg)',color:'var(--r-jogeun-fg)'},
  {key:'il2',text:'일근2',group:'인원 집계 제외',bg:'var(--r-ilgeun-bg)',color:'var(--r-ilgeun-fg)'},
  ...['출장','Jr.캠프','AI 교육','교육','면접관','대의원','주.캠','NDS'].map(text=>({key:text,text,group:'출장 · 교육 · 기타',bg:'#ffc1df',color:'#000000'})),
  ...['Jr.휴가','경조','공가'].map(text=>({key:text,text,group:'휴가',kind:'leave'})),
  {key:'ojende8',text:'오전8데',group:'복합 근무',kind:'ojende8'},
  // 근무에 세는 복합 근무(11-28 사용자) — 엑셀 일정표의 노란 일근 칸 '일/데'(일근+데스크)·'일/CG'(VW 사람이 일근으로 CG 지원), 반대로 '일/VW'
  {key:'il-desk',text:'일/데',group:'복합 근무',kind:'combo',parts:['ilgeun','desk'],bg:'var(--r-ilgeun-bg)',color:'var(--r-ilgeun-fg)',tip:'일근 + 데스크(VW 사람 = VW데스크, CG 사람 = 8데스크)'},
  {key:'il-cg',text:'일/CG',group:'복합 근무',kind:'combo',parts:['ilgeun','cg-sub'],bg:'var(--r-ilgeun-bg)',color:'var(--r-ilgeun-fg)',tip:'일근 + CG 지원(CG 인원으로 셈)'},
  {key:'il-vw',text:'일/VW',group:'복합 근무',kind:'combo',parts:['ilgeun','vw-sub'],bg:'var(--r-ilgeun-bg)',color:'var(--r-ilgeun-fg)',tip:'일근 + VW 지원(VW 인원으로 셈)'}
];
// 복합 근무(kind 'combo') = 한 칸에 두 근무, 근무 인원에 셈. parts = [그날 역할, 어디서]
//  역할: 일근·8진·뉴.오 / 어디서: 데스크(부서대로 VW데스크·8데스크) · CG 지원 · VW 지원
//  진짜 근무 칸(ilgeun·desk·workers)에 넣어 인원·홈 목록·통계가 그대로 세고, 칸 글자는 손입력 칸(customCells, parts 같이 — 다시 생성해도 남음)
const COMBO_BASE = {
  ilgeun:{label:'일근',short:'일',bg:'var(--r-ilgeun-bg)',color:'var(--r-ilgeun-fg)'},
  '8jin':{label:'8진',short:'8진',bg:'',color:'#d65a52'},
  newsoh:{label:'뉴.오',short:'뉴.오',bg:'var(--r-news-bg)',color:'var(--r-news-fg)'}
};
const COMBO_PLACE = { desk:{label:'데스크',short:'데'}, 'cg-sub':{label:'CG 지원',short:'CG'}, 'vw-sub':{label:'VW 지원',short:'VW'} };
const _COMBO_TOK = {'일':'ilgeun','일근':'ilgeun','8진':'8jin','뉴오':'newsoh','뉴.오':'newsoh','데':'desk','데스':'desk','데스크':'desk','cg':'cg-sub','vw':'vw-sub'};
// 'A/B' 글자 → parts(앞뒤 순서 상관없음, 역할 하나 + 어디서 하나일 때만) | null
function _comboParse(t){
  const p=String(t||'').replace(/\s+/g,'').replace(/[①-⑨]/g,'').toLowerCase().split('/'); if(p.length!==2) return null;
  const a=p.map(x=>_COMBO_TOK[x]), b=a.find(x=>COMBO_BASE[x]), pl=a.find(x=>COMBO_PLACE[x]);
  return b&&pl?[b,pl]:null;
}
function _comboOk(parts){ return Array.isArray(parts)&&parts.length===2&&!!COMBO_BASE[parts[0]]&&!!COMBO_PLACE[parts[1]]; }
// 칸 글자 → 복합 근무 parts(목록에 있는 이름 먼저, 없으면 'A/B' 풀어 읽기) | null — 엑셀 가져오기·표 칸·통계 공통
function _dutyCombo(t){
  const d=(typeof data!=='undefined'&&data)?_dutyByText(t):null;
  if(d) return d.kind==='combo'&&_comboOk(d.parts)?d.parts:null;
  return _comboParse(t);
}
// 복합 근무를 그날 칸에 넣기(먼저 비우는 건 부르는 쪽). 일근 사람은 자기 부서 쪽 명단엔 안 넣음 — 일근으로 이미 한 명이라 두 번 세지 않게
function _dutyComboApply(entry,id,ds,parts){
  if(!_comboOk(parts)) return false;
  const [base,place]=parts, s=staffById(id), vwDept=String(((typeof deptOn==='function'&&s)?deptOn(s,ds):s?.dept)||'').toUpperCase()==='VW';
  entry.vw ||= {workers:[],desk:null}; entry.vw.workers ||= [];
  entry.cg ||= {workers:[],desk8:null,desk5:null}; entry.cg.workers ||= [];
  if(base==='ilgeun') entry.ilgeun=id;
  else if(base==='8jin'){ if(isWeekdayForm(ds)) entry.weekday8jin=id; else entry.weekend8jin=id; }
  else if(base==='newsoh') entry.newsOh=id;
  if(place==='desk'){ if(vwDept) entry.vw.desk=id; else entry.cg.desk8=id; }   // 데스크 칸만(명단엔 안 넣음 — 역할로 이미 셈)
  else if(place==='cg-sub'){ if(!(base==='ilgeun'&&!vwDept)&&!entry.cg.workers.includes(id)) entry.cg.workers.push(id); }
  else if(place==='vw-sub'){ if(!(base==='ilgeun'&&vwDept)&&!entry.vw.workers.includes(id)) entry.vw.workers.push(id); }
  return true;
}
// 그 사람 칸이 지금 복합 근무로 보이나(손입력 칸 또는 엑셀 칸) — 표 비고에 'CG대' 등을 또 쓰지 않으려고
function _comboCellOf(entry,id,leaves){
  const c=entry?.customCells?.[id]; if(c&&c.text) return _comboOk(c.parts);
  const imp=(typeof _importCellDisplay==='function')?_importCellDisplay(entry,id,leaves||[]):null;
  return !!(imp&&imp.text&&_dutyCombo(imp.text));
}
// 손입력 복합 근무 칸을 다시 넣기 — 자동 생성·평일 기본 채우기가 손입력 칸(customCells)만 남기고 다시 짠 뒤
function _dutyComboReapply(entry,ds){
  Object.keys(entry?.customCells||{}).forEach(id=>{ const c=entry.customCells[id]; if(c&&_comboOk(c.parts)) _dutyComboApply(entry,id,ds,c.parts); });
}
// 직접 만든 특수 근무(11-10 사용자: "명칭이 너무 다양 — 똑같이 계산되는데 이름만 내가 원하는 대로"): 분류만 고르면 색·계산은 분류대로, 이름은 마음대로.
// 저장 = data.settings.customDuties [{cat, text}], 키 = 'c:<분류>:<이름>'(목록에 없어도 키만으로 넣을 수 있음 — 오른쪽 클릭 '이름 직접 입력')
const DUTY_CATS = {
  offsite:{group:'출장 · 교육 · 기타',label:'출장·교육·기타',bg:'#ffc1df',color:'#000000'},
  leave:{group:'휴가',label:'휴가',kind:'leave'},
  nocount:{group:'인원 집계 제외',label:'집계 제외',bg:'#d9d9d9',color:'#333333',excl:true},
  combo:{group:'복합 근무',label:'복합 근무',kind:'combo',bg:'var(--r-ilgeun-bg)',color:'var(--r-ilgeun-fg)'}   // 근무에 셈(11-28) — 이름 + 역할·어디서(parts)
};
const _sdEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function _customDuties(){ const a=(data.settings&&Array.isArray(data.settings.customDuties))?data.settings.customDuties:[]; return a.filter(c=>c&&DUTY_CATS[c.cat]&&String(c.text||'').trim()&&(c.cat!=='combo'||_comboOk(c.parts)||_comboParse(c.text))); }
function _dutyFromKey(key){
  const b=SPECIAL_DUTIES.find(d=>d.key===key); if(b) return b;
  const m=/^c:(offsite|leave|nocount|combo):(.+)$/.exec(String(key||'')); if(!m) return null;
  const c=DUTY_CATS[m[1]], text=m[2].trim().slice(0,12); if(!text) return null;
  if(m[1]==='combo'){   // 복합 근무: 목록에 저장한 parts, 없으면 이름('일/CG' 같은)을 풀어 읽음
    const saved=((typeof data!=='undefined'&&data?.settings?.customDuties)||[]).find(x=>x&&x.cat==='combo'&&x.text===text);
    const parts=_comboOk(saved?.parts)?saved.parts:_comboParse(text); if(!parts) return null;
    const bs=COMBO_BASE[parts[0]];
    return {key:'c:combo:'+text,text,group:c.group,cat:'combo',custom:true,kind:'combo',parts,bg:bs.bg,color:bs.color,tip:bs.label+' + '+COMBO_PLACE[parts[1]].label};
  }
  return {key:'c:'+m[1]+':'+text,text,group:c.group,cat:m[1],custom:true,...(c.kind?{kind:c.kind}:{bg:c.bg,color:c.color}),...(c.excl?{excl:true}:{})};
}
function _allDuties(){ return [...SPECIAL_DUTIES, ..._customDuties().map(c=>_dutyFromKey('c:'+c.cat+':'+c.text)).filter(Boolean)]; }
// 칸 글자로 찾기(타이핑) — 기본 목록·직접 만든 목록에서 같은 이름. 목록에 없어도 '8진/CG' 같은 복합 근무 글자면 그것으로
function _dutyByText(t){ const k=String(t||'').replace(/\s+/g,'').toLowerCase(); if(!k) return null; return _allDuties().find(d=>String(d.text).replace(/\s+/g,'').toLowerCase()===k&&d.kind!=='ojende8')||(_comboParse(t)?_dutyFromKey('c:combo:'+String(t).replace(/\s+/g,'')):null)||null; }
function _dutySwatch(d){ return d.kind==='leave'?{bg:'rgba(199,154,94,.14)',color:'#b07d3c'}:d.kind==='ojende8'?{bg:'rgba(67,107,181,.12)',color:'#436bb5'}:(d.kind==='combo'&&!d.color)?{bg:DUTY_CATS.combo.bg,color:DUTY_CATS.combo.color}:{bg:d.bg||'var(--surface2)',color:d.color||'var(--text)'}; }
function _customDutyAdd(cat,text,parts){
  text=String(text||'').trim().slice(0,12); if(!DUTY_CATS[cat]||!text) return null;
  if(cat==='combo'&&!_comboOk(parts)) parts=_comboParse(text);
  if(cat==='combo'&&!_comboOk(parts)) return null;
  data.settings ||= {};
  const list=(data.settings.customDuties=Array.isArray(data.settings.customDuties)?data.settings.customDuties:[]);
  if(!SPECIAL_DUTIES.some(d=>d.text===text&&(DUTY_CATS[cat].group===d.group))&&!list.some(c=>c.cat===cat&&c.text===text)){ list.push(cat==='combo'?{cat,text,parts:[...parts]}:{cat,text}); saveData(data); }
  return 'c:'+cat+':'+text;
}
function _customDutyDel(cat,text){
  const list=(data.settings&&Array.isArray(data.settings.customDuties))?data.settings.customDuties:[];
  const i=list.findIndex(c=>c.cat===cat&&c.text===text); if(i<0) return;
  if(!confirm(`'${text}'를 목록에서 뺄까요?\n(이미 넣은 칸은 그대로예요)`)) return;
  list.splice(i,1); saveData(data);
}
let _specialDutyTarget = null;
function _assignSpecialDuty(entry, staffId, ds, key, leaves) {
  const duty=_dutyFromKey(key);
  if(!duty)return false;
  _brushClearStaff(entry,staffId,ds,leaves);
  if(duty.kind==='leave'){
    (leaves[ds] ||= []).push(staffId);
    (entry.leaveLabels ||= {})[staffId]=duty.text;
  }else if(duty.kind==='ojende8'){
    entry.morningDesk=staffId;
    _brushAddWorker(entry,staffId,'cg');
    entry.cg.desk8=staffId;
  }else if(duty.kind==='combo'){
    if(!_dutyComboApply(entry,staffId,ds,duty.parts)) return false;
    (entry.customCells ||= {})[staffId]={text:duty.text,bg:duty.bg,color:duty.color,parts:[...duty.parts]};   // 글자는 손입력 칸, 근무는 진짜 칸(인원에 셈)
  }else{
    (entry.customCells ||= {})[staffId]={text:duty.text,bg:duty.bg,color:duty.color,...(duty.excl?{excl:true}:{})};
  }
  return true;
}
function closeSpecialDutyPicker(){
  document.getElementById('special-duty-modal')?.remove();
  _specialDutyTarget=null;
}
function _sdBody(){
  const t=_specialDutyTarget, all=_allDuties(), groups=['인원 집계 제외','출장 · 교육 · 기타','휴가','복합 근무'];
  const catOf=g=>Object.keys(DUTY_CATS).find(k=>DUTY_CATS[k].group===g);
  const note={'인원 집계 제외':'칸에만 보이고 인원엔 안 셈','출장 · 교육 · 기타':'인원에서 빠짐','복합 근무':'근무 인원에 셈'};
  return `<p>${t?'선택한 날짜의 근무를 바꿔요.':'근무를 고른 뒤 표의 칸을 누르면 들어가요.'} 출장·교육은 엑셀처럼 인원 집계에서 빠지고, <b>복합 근무</b>(일/데·일/CG 등)는 근무 인원에 들어가요. <b>+ 직접 추가</b>로 이름을 마음대로 만들 수 있어요(색·계산은 그 묶음대로).</p>`
    +groups.map(g=>{ const cat=catOf(g);
      return `<h3>${g}${note[g]?`<small class="sd-note">${note[g]}</small>`:''}</h3><div class="special-duty-grid">`+all.filter(d=>d.group===g).map(d=>{ const sw=_dutySwatch(d);
        return `<button type="button" data-key="${_sdEsc(d.key)}" style="--sd-bg:${sw.bg};--sd-fg:${sw.color}"${d.tip?` title="${_sdEsc(d.tip)}"`:''}>${_sdEsc(d.label||d.text)}${d.kind==='combo'?`<small class="sd-sub">${_sdEsc(COMBO_BASE[d.parts[0]].label+' + '+COMBO_PLACE[d.parts[1]].label)}</small>`:''}${d.custom?`<span class="sd-del" data-del-cat="${d.cat}" data-del-text="${_sdEsc(d.text)}" role="button" aria-label="${_sdEsc(d.text)} 목록에서 빼기" title="목록에서 빼기">×</span>`:''}</button>`; }).join('')
        +(cat?`<button type="button" class="sd-add" data-add-cat="${cat}">+ 직접 추가</button>`:'')+`</div>`; }).join('');
}
function openSpecialDutyPicker(staffId,ds){
  if(!isAdmin)return;
  closeCellPop(); closeSpecialDutyPicker();
  _specialDutyTarget=staffId?{staffId,ds,draft:!!_draftCellMode}:null;
  const modal=document.createElement('div');
  modal.id='special-duty-modal'; modal.className='special-duty-overlay';
  modal.innerHTML=`<section class="special-duty-panel" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="special-duty-title">
    <div class="modal-header"><div class="mh-title" id="special-duty-title">특수 근무 선택</div><button class="modal-close" aria-label="닫기" onclick="closeSpecialDutyPicker()">✕</button></div>
    <div class="special-duty-body">${_sdBody()}</div></section>`;
  modal.addEventListener('click',e=>{
    const del=e.target.closest('[data-del-cat]');
    if(del){ e.stopPropagation(); _customDutyDel(del.dataset.delCat,del.dataset.delText); const body=modal.querySelector('.special-duty-body'); if(body) body.innerHTML=_sdBody(); return; }
    const add=e.target.closest('[data-add-cat]');
    if(add){ _sdAddInput(modal,add); return; }
    const b=e.target.closest('button[data-key]');
    if(b){ chooseSpecialDuty(b.dataset.key); return; }
    if(e.target===modal) closeSpecialDutyPicker();   // 바깥 누르면 닫기
  });
  modal.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!e.target.closest('.sd-add-input')) closeSpecialDutyPicker(); });
  document.body.appendChild(modal);
  modal.querySelector('.special-duty-panel').focus();   // 닫기 버튼에 바로 초점 테가 생기지 않게 판 자체에(Esc 는 그대로)
}
// '+ 직접 추가' → 그 자리에 이름 칸. Enter = 목록에 넣고(칸을 골라 연 팝업이면 그 칸에 바로 넣음), Esc = 취소
function _sdAddInput(modal,btn){
  if(btn.dataset.addCat==='combo') return _sdAddCombo(modal,btn);
  const cat=btn.dataset.addCat, c=DUTY_CATS[cat], sw=_dutySwatch(c.kind?{kind:c.kind}:c);
  const inp=document.createElement('input');
  inp.className='sd-add-input'; inp.maxLength=12; inp.placeholder='이름 입력 후 Enter'; inp.setAttribute('aria-label',c.label+' 이름');
  inp.style.cssText=`--sd-bg:${sw.bg};--sd-fg:${sw.color}`;
  btn.replaceWith(inp); inp.focus();
  let done=false;
  const fin=ok=>{ if(done) return; done=true; const v=inp.value.trim();
    const key=ok&&v?_customDutyAdd(cat,v):null;
    if(key&&_specialDutyTarget){ chooseSpecialDuty(key); return; }
    const body=modal.querySelector('.special-duty-body'); if(body) body.innerHTML=_sdBody();
    if(key) toast(`'${v}' 추가했어요 — 눌러서 넣으세요`,'success'); };
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); fin(true); } else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); fin(false); } });
  inp.addEventListener('blur',()=>fin(!!inp.value.trim()));
}
// 복합 근무 '+ 직접 추가'(11-28): 이름 + [그날 역할] + [어디서]. 이름을 '8진/CG'처럼 치면 고르는 칸이 저절로 따라감, 이름을 비우면 '일/데'처럼 지어 줌
function _sdAddCombo(modal,btn){
  const opt=o=>Object.keys(o).map(k=>`<option value="${k}">${_sdEsc(o[k].label)}</option>`).join('');
  const box=document.createElement('div'); box.className='sd-add-combo';
  box.innerHTML=`<input class="sd-add-input" maxlength="12" placeholder="이름 (예: 일/데)" aria-label="복합 근무 이름">
    <div class="sd-add-row"><select aria-label="그날 역할">${opt(COMBO_BASE)}</select><span>+</span><select aria-label="어디서">${opt(COMBO_PLACE)}</select></div>
    <div class="sd-add-row"><button type="button" class="sd-add-no">취소</button><button type="button" class="sd-add-ok">추가</button></div>`;
  btn.replaceWith(box);
  const inp=box.querySelector('input'), [bs,ps]=box.querySelectorAll('select');
  const sw=()=>{ const b=COMBO_BASE[bs.value]; box.style.cssText=`--sd-bg:${b.bg||'var(--surface2)'};--sd-fg:${b.color}`; inp.placeholder=`이름 (비우면 ${b.short}/${COMBO_PLACE[ps.value].short})`; };
  sw(); inp.focus();
  inp.addEventListener('input',()=>{ const p=_comboParse(inp.value); if(p){ bs.value=p[0]; ps.value=p[1]; sw(); } });
  bs.addEventListener('change',sw); ps.addEventListener('change',sw);
  const again=()=>{ const body=modal.querySelector('.special-duty-body'); if(body) body.innerHTML=_sdBody(); };
  const fin=()=>{
    const parts=[bs.value,ps.value], v=inp.value.trim()||(COMBO_BASE[parts[0]].short+'/'+COMBO_PLACE[parts[1]].short);
    const key=_customDutyAdd('combo',v,parts); if(!key) return;
    if(_specialDutyTarget){ chooseSpecialDuty(key); return; }
    again(); toast(`'${v}' 추가했어요 — 눌러서 넣으세요`,'success');
  };
  box.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target===inp){ e.preventDefault(); fin(); } else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); again(); } });
  box.querySelector('.sd-add-ok').addEventListener('click',e=>{ e.stopPropagation(); fin(); });
  box.querySelector('.sd-add-no').addEventListener('click',e=>{ e.stopPropagation(); again(); });
}
function chooseSpecialDuty(key){
  if(!isAdmin)return;
  const duty=_dutyFromKey(key); if(!duty)return;
  const target=_specialDutyTarget;
  if(!target){
    const bkey='special:'+duty.key;
    WS_BRUSH_LABELS[bkey]=duty.label||duty.text;
    const btn=document.getElementById('ws-special-duty');
    if(btn){btn.dataset.brush=bkey;btn.textContent='특수 근무 ▾';btn.title='선택: '+(duty.label||duty.text);}
    setWsBrush(bkey);closeSpecialDutyPicker();return;
  }
  const {staffId,ds,draft}=target;
  const staff=staffById(staffId);
  if(!staff||!isContractActive(staff,ds)||isDispatched(staff,ds)){toast('계약 외 기간 또는 파견 기간에는 지정할 수 없습니다.','error');return;}
  if(draft)_pushWsHistory();
  const entry=draft?_ensureDraftEntry(ds):(data.schedule[ds] ||= {vw:{workers:[],desk:null},cg:{workers:[],desk8:null,desk5:null}});
  const leaves=draft?(data.draft.newLeaves ||= {}):(data.leaves ||= {});
  _assignSpecialDuty(entry,staffId,ds,duty.key,leaves);
  closeSpecialDutyPicker();_draftCellMode=false;
  saveData(data);if(draft)renderWorkshopTable();else{renderTable();renderHome();}
  toast((duty.label||duty.text)+' 적용됨','success');
}

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

