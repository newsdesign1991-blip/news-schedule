/* [모듈] js/project-gantt.js — 프로젝트 간트 탭 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 프로젝트 간트 =====
const _PJ_DEPT_COLORS={'VW':'#6366f1','CG':'#4a9fbd','조근':'#8893dc','XR':'#0891b2','PROJECT':'#e6a817','SPORTS':'#22a06b'};
function _deptColor(dept){ return _PJ_DEPT_COLORS[dept]||'#94a3b8'; }
function renderProject(){
  const wrap=document.getElementById('pj-wrap'); if(!wrap) return;
  const addBtn=document.getElementById('pj-add-btn'); if(addBtn) addBtn.style.display='';
  const sw=document.getElementById('pj-home-sw'), swWrap=document.getElementById('pj-home-sw-wrap');
  if(sw) sw.checked=!(data.settings&&data.settings.pjHome===false);
  if(swWrap) swWrap.style.display=isAdmin?'':'none';   // 관리자만 바꿈(설정은 모두의 홈에 적용)
  if(!wrap._pjBound){ wrap._pjBound=true; wrap.addEventListener('click', function(e){ const row=e.target.closest('.pj-row[data-pjid], .pj-card[data-pjid]'); if(row){ const _pid=row.getAttribute('data-pjid'); const _pp=(data.projects||[]).find(x=>x.id===_pid); if(_pjCanEdit(_pp)) openProjectModal(_pid); } }); }
  const projects=(data.projects||[]).slice();
  if(!projects.length){ wrap.innerHTML='<div class="pj-empty">등록된 프로젝트가 없습니다.'+(isAdmin?'<br><span style="font-size:12px;">＋ 프로젝트 추가로 시작하세요.</span>':'')+'</div>'; return; }
  const dnum=ds=>Math.round(new Date(ds+'T00:00:00').getTime()/86400000);
  const nowM=new Date();
  const mStart=dnum(toDateStr(nowM.getFullYear(),nowM.getMonth()+1,1));
  const mEnd=dnum(toDateStr(nowM.getFullYear(),nowM.getMonth()+1,new Date(nowM.getFullYear(),nowM.getMonth()+1,0).getDate()));
  const minS=Math.min.apply(null,projects.map(p=>dnum(p.start)).concat([mStart]));
  const maxE=Math.max.apply(null,projects.map(p=>dnum(p.end)).concat([mEnd]));
  const numDays=maxE-minS+1, colW=34, timelineW=numDays*colW;
  const DOWK=['일','월','화','수','목','금','토'];
  const nd=new Date(), todayN=dnum(toDateStr(nd.getFullYear(),nd.getMonth()+1,nd.getDate()));
  const todayInRange=(todayN>=minS&&todayN<=maxE), todayColLeft=(todayN-minS)*colW;
  const todayX=todayInRange?((todayN-minS)*colW+colW/2):null;
  let dayCells='', offStrips='';
  for(let i=0;i<numDays;i++){ const n=minS+i, d=new Date(n*86400000), dow=d.getDay(), we=(dow===0||dow===6);
    const _ds=toDateStr(d.getFullYear(),d.getMonth()+1,d.getDate());
    const hol=!!(data.holidays&&data.holidays[_ds]);
    const cls=hol?'pj-hol':(we?'pj-we':'');
    dayCells+='<div class="pj-day-cell'+(cls?' '+cls:'')+(n===todayN?' pj-today':'')+'" style="width:'+colW+'px;"><div class="pj-dow">'+DOWK[dow]+'</div><div class="pj-dnum">'+d.getDate()+'</div></div>';
    if(cls) offStrips+='<div class="pj-off-col '+(hol?'hol':'we')+'" style="left:'+((n-minS)*colW)+'px;width:'+colW+'px;"></div>';
  }
  const rows=projects.map((p,idx)=>{
    const sN=dnum(p.start), eN=dnum(p.end);
    const barLeft=(sN-minS)*colW+2, barW=Math.max(colW-4,(eN-sN+1)*colW-4), days=eN-sN+1, pct=(eN<=sN?(todayN>=eN?100:0):Math.max(0,Math.min(100,Math.round((todayN-sN)/(eN-sN)*100))));
    const color=p.color||'#f4a09a', parts=(p.participants||[]);
    const av=parts.map(id=>{ const st=staffById(id), nm=st?st.name:'?', d=(st&&st.dept?st.dept:'').toLowerCase(), dc=(['vw','cg','project','sports','xr'].indexOf(d)>=0?d:''); return '<span class="wchip pj-pchip'+(dc?' '+dc:'')+'">'+_pEsc(nm)+'</span>'; }).join('');
    const more='';
    return '<div class="pj-row'+(_pjCanEdit(p)?' pj-clickable':'')+'" data-pjid="'+p.id+'">'
      +'<div class="pj-left">'
      +'<div class="pj-c-name" title="'+_pEsc(p.name)+'">'+_pEsc(p.name)+'</div>'
      +'<div class="pj-c-work">'+(av||'<span style="color:var(--muted);font-size:11px;">-</span>')+more+'</div>'
      +'<div class="pj-c-date">'+String(p.start).slice(5)+'</div>'
      +'<div class="pj-c-date">'+String(p.end).slice(5)+'</div>'
      +'<div class="pj-c-days">'+days+'</div>'+'<div class="pj-c-pct">'+pct+'%</div>'
      +'</div>'
      +'<div class="pj-timeline" style="width:'+timelineW+'px;--pj-colw:'+colW+'px;">'
      +offStrips
      +(todayInRange?'<div class="pj-today-col'+(idx===projects.length-1?' pj-today-col-end':'')+'" style="left:'+todayColLeft+'px;width:'+colW+'px;"></div>':'')
      +'<div class="pj-bar" style="left:'+barLeft+'px;width:'+barW+'px;background:'+color+'59;border:1.5px solid '+color+'aa;"></div>'
      +'</div></div>';
  }).join('');
  const cards=projects.map(function(p){
    const sN=dnum(p.start), eN=dnum(p.end), days=eN-sN+1, color=p.color||'#f4a09a', parts=(p.participants||[]);
    const av=parts.map(id=>{ const st=staffById(id), nm=st?st.name:'?', dc=_deptColor(st?st.dept:''); return '<span class="pj-cn-chip" style="background:'+dc+';">'+_pEsc(nm)+'</span>'; }).join('');
    const bl=((sN-minS)/numDays*100), bw=(days/numDays*100), tp=(todayX!=null)?((todayN-minS+0.5)/numDays*100):null;
    return '<div class="pj-card'+(_pjCanEdit(p)?' pj-clickable':'')+'" data-pjid="'+p.id+'">'
      +'<div class="pj-card-top"><span class="pj-card-dot" style="background:'+color+';"></span><span class="pj-card-name">'+_pEsc(p.name)+'</span><span class="pj-card-badge">'+days+'일</span></div>'
      +'<div class="pj-card-sub"><span>'+String(p.start)+' ~ '+String(p.end)+'</span><span class="pj-card-pct">'+(eN<=sN?(todayN>=eN?100:0):Math.max(0,Math.min(100,Math.round((todayN-sN)/(eN-sN)*100))))+'% 경과</span></div>'
      +(av?'<div class="pj-card-names">'+av+'</div>':'')
      +'<div class="pj-mini"><div class="pj-mini-bar" style="left:'+bl+'%;width:'+bw+'%;background:'+color+';"></div>'+(tp!=null?'<div class="pj-mini-today" style="left:'+tp+'%;"></div>':'')+'</div>'
      +'</div>';
  }).join('');
  wrap.innerHTML='<div class="pj-gantt"><div class="pj-table">'
    +'<div class="pj-row pj-head"><div class="pj-left"><div class="pj-c-name">프로젝트</div><div class="pj-c-work">참여자</div><div class="pj-c-date">시작</div><div class="pj-c-date">종료</div><div class="pj-c-days">일수</div><div class="pj-c-pct">경과</div></div>'
    +'<div class="pj-timeline pj-timeline-head" style="width:'+timelineW+'px;">'+dayCells+'</div></div>'
    +rows+'</div></div><div class="pj-cards">'+cards+'</div>';
}
// '홈 화면에 표시' 토글: 끄면 모든 사람의 홈에서 '프로젝트 현황' 패널이 숨겨짐(js/home.js renderHome이 data.settings.pjHome 확인)
function pjSetHomeShow(on){
  if(!isAdmin){ const sw=document.getElementById('pj-home-sw'); if(sw) sw.checked=!on; toast('관리자만 바꿀 수 있어요.','error'); return; }
  data.settings=data.settings||{};
  data.settings.pjHome=!!on;
  saveData(data);
  renderHome();
  toast(on?'홈 화면에 프로젝트 현황을 표시합니다':'홈 화면에서 프로젝트 현황을 숨겼습니다','success');
}
// 참여자: 검색 + 추천 목록 + 태그(js/nd-people.js). 저장 형식(직원 id 배열, 고른 순서)은 그대로
function _pjMountPicker(sel){
  const host=document.getElementById('pj-part-pick'); if(!host||typeof ndPeoplePicker!=='function') return;
  if(host._ndPicker) host._ndPicker.destroy();
  // 활성 직원(이름순) + 이미 고른 비활성 직원 / 삭제된 직원은 '(삭제됨)'으로 남겨 직접 빼게
  const staff=(data.staff||[]).filter(x=>x.active!==false||sel.includes(x.id)).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  sel.forEach(id=>{ if(!staffById(id)) staff.push({id:id,name:'(삭제됨)',dept:''}); });
  ndPeoplePicker(host,{staff:staff,selected:sel,placeholder:'이름·부서·초성으로 검색해서 추가'});
}
// 넓은 화면: 기간 달력(시작~끝) — 값은 #pj-start/#pj-end에 그대로(모바일은 그 날짜칸을 씀)
function _pjMountCal(){
  const host=document.getElementById('pj-cal'), si=document.getElementById('pj-start'), ei=document.getElementById('pj-end');
  if(!host||typeof ndCal!=='function') return;
  si.classList.add('nd-native-src'); ei.classList.add('nd-native-src');
  ndCal(host,{range:true, get:()=>({from:si.value,to:ei.value}), set:r=>{ si.value=r.from||''; ei.value=r.to||''; _pjDaysLbl(); }});
  if(!si._pjBound){ si._pjBound=1; [si,ei].forEach(el=>el.addEventListener('change',()=>{ if(host._ndCal) host._ndCal.sync(); _pjDaysLbl(); })); }
  _pjDaysLbl();
}
function _pjDaysLbl(){
  const el=document.getElementById('pj-days'); if(!el) return;
  const s=document.getElementById('pj-start').value, e=document.getElementById('pj-end').value;
  el.textContent=(s&&e&&s<=e)?('총 '+(Math.round((new Date(e+'T00:00:00')-new Date(s+'T00:00:00'))/86400000)+1)+'일'):(s?'끝 날짜를 골라 주세요':'');
}
// 머리 색 = 고른 프로젝트 색(넓은 화면에서만 쓰임, css/popup-wide.css --pj-tint)
function _pjTint(){
  const m=document.querySelector('#project-modal .modal'), c=document.getElementById('pj-color'); if(!m||!c) return;
  const v=_evHexRgba(c.value, document.documentElement.getAttribute('data-theme')==='dark'?0.17:0.11);
  if(v) m.style.setProperty('--pj-tint', v); else m.style.removeProperty('--pj-tint');
}
function _pjCanEdit(p){ return isAdmin || (!!currentUser && !!currentUser.staffId && !!p && p.createdBy===currentUser.staffId); }
function openProjectModal(id){
  const m=document.getElementById('project-modal'); if(!m) return;
  const p=id?(data.projects||[]).find(x=>x.id===id):null;
  if(id && !_pjCanEdit(p)){ toast('작성자 또는 관리자만 편집할 수 있어요.','error'); return; }
  document.getElementById('pj-id').value=p?p.id:'';
  document.getElementById('pj-modal-title').textContent=p?(p.name+' 편집'):'새 프로젝트';
  document.getElementById('pj-name').value=p?p.name:'';
  const nd=new Date(), today=toDateStr(nd.getFullYear(),nd.getMonth()+1,nd.getDate());
  document.getElementById('pj-start').value=p?p.start:today;
  document.getElementById('pj-end').value=p?p.end:today;
  document.getElementById('pj-color').value=p?(p.color||'#f4a09a'):'#f4a09a';
  _pjMountPicker(p?(p.participants||[]).filter(Boolean):[]);
  _pjMountCal(); _pjTint();
  document.getElementById('pj-del-btn').style.display=p?'':'none';
  m.style.display='flex';
}
function closeProjectModal(){ const m=document.getElementById('project-modal'); if(m) m.style.display='none'; const h=document.getElementById('pj-part-pick'); if(h&&h._ndPicker) h._ndPicker.close(); }
function saveProject(){
  const name=document.getElementById('pj-name').value.trim();
  const start=document.getElementById('pj-start').value, end=document.getElementById('pj-end').value;
  if(!name){ toast('프로젝트명을 입력하세요','error'); return; }
  if(!start||!end){ toast('시작일·종료일을 입력하세요','error'); return; }
  if(start>end){ toast('종료일이 시작일보다 빠릅니다','error'); return; }
  if(!Array.isArray(data.projects)) data.projects=[];
  const id=document.getElementById('pj-id').value;
  const pk=document.getElementById('pj-part-pick')._ndPicker, old=id?(data.projects||[]).find(x=>x.id===id):null;
  const parts=pk?pk.get():((old&&old.participants)||[]).slice();   // 고르기 부품이 없으면(로드 실패) 기존 참여자 유지
  const obj={name:name,start:start,end:end,color:document.getElementById('pj-color').value,participants:parts};
  if(id){ const p=(data.projects||[]).find(x=>x.id===id); if(p) Object.assign(p,obj); }
  else { obj.id='pj'+Date.now().toString(36)+Math.random().toString(36).slice(2,5); obj.createdBy=(currentUser&&currentUser.staffId)||null; obj.createdByName=(currentUser&&currentUser.name)||''; data.projects.unshift(obj); }
  saveData(data); closeProjectModal(); renderProject(); toast('저장됨','success');
}
function deleteProject(){
  const id=document.getElementById('pj-id').value; if(!id) return;
  if(!confirm('이 프로젝트를 삭제할까요? 되돌릴 수 없습니다.')) return;
  data.projects=(data.projects||[]).filter(x=>x.id!==id);
  saveData(data); closeProjectModal(); renderProject(); toast('삭제됨','success');
}
