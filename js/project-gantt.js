/* [모듈] js/project-gantt.js — 프로젝트 간트 탭 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 프로젝트 간트 =====
const _PJ_DEPT_COLORS={'VW':'#6366f1','CG':'#4a9fbd','조근':'#8893dc','XR':'#0891b2','PROJECT':'#e6a817','SPORTS':'#22a06b'};
function _deptColor(dept){ return _PJ_DEPT_COLORS[dept]||'#94a3b8'; }
function renderProject(){
  const wrap=document.getElementById('pj-wrap'); if(!wrap) return;
  const addBtn=document.getElementById('pj-add-btn'); if(addBtn) addBtn.style.display='';
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
let _pjParticipants=[];
function _pjStaffOptions(){
  return (data.staff||[]).filter(x=>x.active!==false).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).map(x=>'<option value="'+x.id+'">'+_pEsc(x.name)+' · '+_pEsc(x.dept||'')+'</option>').join('');
}
function _pjRenderParts(){
  const box=document.getElementById('pj-part-list'); if(!box) return;
  if(!_pjParticipants.length){ box.innerHTML='<div style="font-size:12px;color:var(--muted);">참여자 없음</div>'; return; }
  box.innerHTML=_pjParticipants.map((id,i)=>{ const st=staffById(id), nm=st?st.name:'(삭제됨)';
    return '<span class="avoid-row" style="display:inline-flex;width:auto;margin:0 6px 6px 0;padding:5px 9px;"><span class="pj-avatar" style="width:20px;height:20px;font-size:10px;background:'+_deptColor(st?st.dept:'')+';margin-right:5px;">'+_pEsc((nm||'?').charAt(0))+'</span><span style="font-size:12.5px;font-weight:600;">'+_pEsc(nm)+'</span><button class="avoid-del" style="margin-left:6px;" onclick="_pjRemovePart('+i+')">✕</button></span>';
  }).join('');
}
function _pjAddPart(){
  const sel=document.getElementById('pj-part-sel'); const v=sel?sel.value:''; if(!v) return;
  if(_pjParticipants.includes(v)){ toast('이미 추가됨','error'); return; }
  _pjParticipants.push(v); _pjRenderParts();
}
function _pjRemovePart(i){ _pjParticipants.splice(i,1); _pjRenderParts(); }
function _pjCanEdit(p){ return isAdmin || (!!currentUser && !!currentUser.staffId && !!p && p.createdBy===currentUser.staffId); }
function openProjectModal(id){
  const m=document.getElementById('project-modal'); if(!m) return;
  const p=id?(data.projects||[]).find(x=>x.id===id):null;
  if(id && !_pjCanEdit(p)){ toast('작성자 또는 관리자만 편집할 수 있어요.','error'); return; }
  document.getElementById('pj-part-sel').innerHTML='<option value="">참여자 선택…</option>'+_pjStaffOptions();
  document.getElementById('pj-id').value=p?p.id:'';
  document.getElementById('pj-modal-title').textContent=p?(p.name+' 편집'):'새 프로젝트';
  document.getElementById('pj-name').value=p?p.name:'';
  const nd=new Date(), today=toDateStr(nd.getFullYear(),nd.getMonth()+1,nd.getDate());
  document.getElementById('pj-start').value=p?p.start:today;
  document.getElementById('pj-end').value=p?p.end:today;
  document.getElementById('pj-color').value=p?(p.color||'#f4a09a'):'#f4a09a';
  _pjParticipants=p?(p.participants||[]).slice():[];
  _pjRenderParts();
  document.getElementById('pj-del-btn').style.display=p?'':'none';
  m.style.display='flex';
}
function closeProjectModal(){ const m=document.getElementById('project-modal'); if(m) m.style.display='none'; }
function saveProject(){
  const name=document.getElementById('pj-name').value.trim();
  const start=document.getElementById('pj-start').value, end=document.getElementById('pj-end').value;
  if(!name){ toast('프로젝트명을 입력하세요','error'); return; }
  if(!start||!end){ toast('시작일·종료일을 입력하세요','error'); return; }
  if(start>end){ toast('종료일이 시작일보다 빠릅니다','error'); return; }
  if(!Array.isArray(data.projects)) data.projects=[];
  const id=document.getElementById('pj-id').value;
  const obj={name:name,start:start,end:end,color:document.getElementById('pj-color').value,participants:_pjParticipants.slice()};
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
