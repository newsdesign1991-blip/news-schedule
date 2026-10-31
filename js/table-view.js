/* [모듈] js/table-view.js — 근무표(배포) 표·기간 이동·이미지로 저장 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== EXCEL TABLE VIEW =====
// 근무표 칸에 '무엇으로 보이는지'(VW·CG·XR·PROJECT·SPORTS 열, 조근 부서 제외) — renderTable의 칸 우선순위와 똑같이.
// 근무 통계(js/admin.js)가 이걸로 세므로, 표의 우선순위를 바꾸면 여기도 같이 바꿀 것(검사: swap-backend/test-work-stats.cjs)
// 반환: '당직'·'조근'·'일근'·'휴가'·'퇴근'·'뉴.오'·'뉴.오2'·'8진'·'8진2'·'근무'·''(비어 있음) 또는 엑셀/수동 칸이면 그 글자
function workCellRole(entry, s, ds) {
  const leaves = data.newLeaves?.[ds] || [];
  const byText = t => { const k = (typeof WORK_TYPE_MAP !== 'undefined') ? WORK_TYPE_MAP[_normalizeImportedWorkType(t)] : null;
    return k==='danjik' ? '당직' : k==='jogeun' ? '조근' : k==='ilgeun' ? '일근' : k==='leave' ? '휴가' : /^(퇴근|당직퇴근)$/.test(t) ? '퇴근' : String(t||'').trim(); };
  const imported = (typeof _importCellDisplay === 'function') ? _importCellDisplay(entry, s.id, leaves) : null;
  if (imported) return byText(imported.text);
  const custom = entry?.customCells?.[s.id];
  if (custom?.text) return byText(custom.text);
  if (!isContractActive(s, ds) || isDispatched(s, ds)) return '';
  const dow = new Date(ds+'T00:00:00').getDay(), isWeekend = dow===0||dow===6, isHoliday = !!(data.holidays && data.holidays[ds]);
  if (s.id === getDanjikExitStaff(ds)) return '퇴근';
  if (leaves.includes(s.id)) return '휴가';
  if (entry?.satMorning === s.id) return '조근';
  if (s.id === getDanjikOffStaff(ds) && !_hasBrush(entry, s.id, 'work', ds)) return '';
  if (entry && s.id === entry.danjik) return '당직';
  if ((entry?.restWorkers||[]).includes(s.id)) return '';
  if ((entry?.jogeunEdu||[]).includes(s.id)) return '조근';
  if (entry?.newsOh === s.id) return '뉴.오';
  if (entry?.newsOh2 === s.id) return '뉴.오2';
  if (entry?.weekend8jin === s.id || entry?.weekday8jin === s.id) return '8진';
  if (entry?.weekend8jin2 === s.id || entry?.weekday8jin2 === s.id) return '8진2';
  const subbed = Object.values(entry?.jogeunSubs||{}).includes(s.id);
  if ((isWeekdayForm(ds) && subbed) || (entry?.jogeunExtra||[]).includes(s.id)) return '조근';
  if (entry && s.id === entry.ilgeun) return '일근';
  if (!entry) return '';
  const all = [...(entry.vw?.workers||[]), ...(entry.cg?.workers||[]), ...(entry.xr||[]), ...(entry.project||[]), ...(entry.sports||[])];
  return all.includes(s.id) ? '근무' : '';
}
// 근무표 탭은 '배포한 기간' 하나씩만 본다(10-30 사용자 — 배포마다 부서 이동 등이 달라 기간을 섞으면 헷갈림). 자유 기간 입력 없음
// 기간 = 배포 기록(deployLog range '(시작 ~ 끝)') + data.pubPeriods(배포 때 남김 — 배포 기록을 지워도 남음)를 오래된 배포부터 겹쳐 나중 배포가 이김
//   (겹친 앞 기간은 남는 쪽만), 근무 데이터가 하루도 없는 기간은 뺌(배포 삭제). at = 그 기간을 마지막으로 배포한 때
function tablePeriods() {
  const ev = [];
  (data.deployLog||[]).forEach((l,i) => { const m = String(l&&l.range||'').match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/); if (m && m[1]<=m[2]) ev.push({ s:m[1], e:m[2], ts:l.ts||'', at:l.at||'', o:-i }); });   // deployLog 는 최근 것이 앞
  (data.pubPeriods||[]).forEach((p,i) => { if (p && p.s && p.e && p.s<=p.e) ev.push({ s:p.s, e:p.e, ts:p.ts||'', at:p.at||'', o:i }); });
  ev.sort((a,b) => a.ts.localeCompare(b.ts) || a.o-b.o);
  let per = [];
  ev.forEach(p => {
    const out = [];
    per.forEach(q => {
      if (q.e<p.s || q.s>p.e) { out.push(q); return; }
      if (q.s<p.s) out.push({ s:q.s, e:addDays(p.s,-1), at:q.at });
      if (q.e>p.e) out.push({ s:addDays(p.e,1), e:q.e, at:q.at });
    });
    out.push({ s:p.s, e:p.e, at:p.at });
    per = out;
  });
  const days = Object.keys(data.schedule||{});
  return per.filter(p => days.some(d => d>=p.s && d<=p.e)).sort((a,b) => a.s.localeCompare(b.s));
}
// 지금 보는 기간의 번호 — 배포 기간과 딱 맞으면 그것, 아니면(옛 자유 기간·다시 배포해 바뀜) ref(없으면 보던 시작일·오늘)가 든 기간, 없으면 바로 다음, 끝을 넘으면 마지막
function _tblPeriodIdx(P, ref) {
  if (!ref) { const i = P.findIndex(p => p.s===tableRangeStart && p.e===tableRangeEnd); if (i>=0) return i; }
  ref = ref || tableRangeStart || _todayStr();
  const j = P.findIndex(p => p.e>=ref); return j>=0 ? j : P.length-1;
}
function _tblGoPeriod(p) { tableRangeStart=p.s; tableRangeEnd=p.e; _saveTableRange(); renderTable(); }
function tableThisPeriod() { const P=tablePeriods(); if (P.length) _tblGoPeriod(P[_tblPeriodIdx(P,_todayStr())]); }
// 좌우 화살표: 이전·다음 배포 기간
function tableRangeNav(dir) {
  const P=tablePeriods(); if (!P.length) return;
  _tblGoPeriod(P[Math.max(0, Math.min(P.length-1, _tblPeriodIdx(P)+dir))]);
}
function _tblPeriodLabel(p) {
  const f = ds => { const d=new Date(ds+'T00:00:00'); return `${d.getFullYear()!==new Date().getFullYear()?d.getFullYear()+'년 ':''}${d.getMonth()+1}월 ${d.getDate()}일 (${DOW_KR[d.getDay()]})`; };
  return `${f(p.s)} ~ ${f(p.e)}`;
}
function importNewLeaves(input) {
  if (!isAdmin) { toast('관리자만 가능합니다.','error'); input.value=''; return; }
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const json=JSON.parse(e.target.result);
      if (!data.newLeaves) data.newLeaves={};
      let added=0;
      const arr=Array.isArray(json)?json:Object.entries(json).flatMap(([name,dates])=>(Array.isArray(dates)?dates:[]).map(d=>({name,date:d})));
      arr.forEach(item=>{
        const name=item.name||item.staffName||'';
        const staff=data.staff.find(s=>s.name===name);
        if (!staff) return;
        const dates=item.dates||(item.startDate&&item.endDate?null:null);
        const getDates=()=>{
          if (item.date) return [item.date];
          if (item.dates) return item.dates;
          if (item.startDate&&item.endDate) {
            const out=[]; const cur=new Date(item.startDate+'T00:00:00');
            const end=new Date(item.endDate+'T00:00:00');
            while(cur<=end){ out.push(toDateStr(cur.getFullYear(),cur.getMonth()+1,cur.getDate())); cur.setDate(cur.getDate()+1); }
            return out;
          }
          return [];
        };
        getDates().forEach(ds=>{
          if (!data.newLeaves[ds]) data.newLeaves[ds]=[];
          if (!data.newLeaves[ds].includes(staff.id)) { data.newLeaves[ds].push(staff.id); added++; }
        });
      });
      saveData(data);
      toast(`신휴가 ${added}건 가져왔습니다.`,'success');
      renderTable();
    } catch(err) { toast('JSON 파일 형식이 올바르지 않습니다.','error'); }
    input.value='';
  };
  reader.readAsText(file,'UTF-8');
}
function quickGenerate() {
  // 현재 범위의 시작 월 기준으로 생성
  if (!tableRangeStart) return;
  const d=new Date(tableRangeStart+'T00:00:00');
  const _y=d.getFullYear(),_m=String(d.getMonth()+1).padStart(2,'0'),_day=String(d.getDate()).padStart(2,'0');
  const _lastDay=new Date(_y,d.getMonth()+1,0).getDate();
  document.getElementById('gen-start').value=`${_y}-${_m}-01`;
  document.getElementById('gen-end').value=`${_y}-${_m}-${String(_lastDay).padStart(2,'0')}`;
  generateSchedule(); // 완료 시 콜백에서 renderTable 수행
}

async function captureSchedule() {
  if (typeof html2canvas === 'undefined') { toast('캡쳐 준비 중...',''); try { await ndLoadLib('h2c'); } catch(e) { toast(e.message,'error'); return; } }
  const titleEl = document.getElementById('table-title');
  const tableEl = document.getElementById('excel-table');
  if (!tableEl) { toast('근무표가 없습니다',''); return; }
  toast('캡쳐 중...','');
  try {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch(e){} }
    const S = 2;   // 출력 해상도 배율(선명하게)
    // html2canvas: 화면에 보이는 그대로(색·폰트·테두리) 렌더 — dom-to-image의 뿌옇게/두껍게 나오던 문제 해결
    const canvas = await html2canvas(tableEl, { backgroundColor: '#ffffff', scale: S, useCORS: true, logging: false });

    // 제목 + 테이블 합치기
    const PAD = 20 * S, titleH = 44 * S;
    const out = document.createElement('canvas');
    out.width = canvas.width + PAD * 2;
    out.height = canvas.height + PAD * 2 + titleH;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);

    const titleText = (titleEl.querySelector('#table-title-text')?.textContent || '근무표').trim();
    const deployText = (titleEl.querySelector('span[style*="muted"]')?.textContent || '').trim();
    const _ff = '"Wanted Sans Variable","Wanted Sans","Segoe UI",sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 ' + (18 * S) + 'px ' + _ff;
    ctx.fillText(titleText, PAD, PAD + 24 * S);
    if (deployText) {
      const titleW = ctx.measureText(titleText).width;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 ' + (11 * S) + 'px ' + _ff;
      ctx.fillText(deployText, PAD + titleW + 12 * S, PAD + 22 * S);
    }
    ctx.drawImage(canvas, PAD, PAD + titleH);

    const link = document.createElement('a');
    link.download = titleText.replace(/\s+/g,'_') + '.png';
    link.href = out.toDataURL('image/png');
    link.click();
    toast('이미지 저장 완료','success');
  } catch(e) {
    toast('캡쳐 실패: '+e.message,'');
  }
}
function startEditTableTitle() {
  if (!isAdmin) return;   // 제목 고정은 모든 사람 화면·이미지 저장에 반영되므로 관리자만
  const span = document.getElementById('table-title-text');
  if (!span) return;
  const cur = span.textContent;
  const auto = span.dataset.auto || '';   // renderTable이 넣은 이번 기간 자동 제목
  const input = document.createElement('input');
  input.value = cur;
  input.style.cssText = 'font-size:inherit;font-weight:inherit;font-family:inherit;border:none;border-bottom:2px solid #6366f1;outline:none;background:transparent;width:220px;';
  span.replaceWith(input);
  input.focus();
  input.select();
  let fin = false;
  const done = () => {
    if (fin) return; fin = true;
    const val = input.value.trim();
    if (!data.settings) data.settings = {};
    const next = (!val || val === auto) ? null : val;   // 비우거나 자동 제목과 같으면 자동 제목(달마다 바뀜)으로
    if ((data.settings.scheduleTitle || null) !== next) { data.settings.scheduleTitle = next; saveData(data); }   // 안 바꿨으면 저장 안 함
    renderTable();
  };
  input.addEventListener('blur', done);
  input.addEventListener('keydown', e => { if(e.key==='Enter') input.blur(); if(e.key==='Escape'){ input.value=cur; input.blur(); } });
}
function renderTable() {
  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth()+1, now.getDate());
  { const _dpb=document.getElementById('tbl-del-pub'); if(_dpb) _dpb.style.display = isAdmin ? 'inline-block' : 'none'; }

  // 배포된 근무표가 없을 경우 안내
  if (!Object.keys(data.schedule||{}).length) {
    document.getElementById('excel-thead').innerHTML='';
    document.getElementById('excel-tbody').innerHTML=`<tr><td colspan="30" style="text-align:center;padding:60px 20px;color:var(--muted);font-size:14px;">📋 배포된 근무표가 없습니다.<br><span style="font-size:12px;margin-top:6px;display:block;">근무표 작성소에서 근무를 생성하고 🚀 배포 버튼을 눌러주세요.</span></td></tr>`;
    return;
  }

  // 기간 = 배포한 기간 하나(tablePeriods). 처음엔 오늘이 든 기간, 저장해 둔 기간이 배포 기간과 다르면 그 날짜가 든 배포 기간으로
  const _P=tablePeriods(), _pi=_P.length?_tblPeriodIdx(_P):-1, _per=_pi>=0?_P[_pi]:null;
  if (_per && (_per.s!==tableRangeStart || _per.e!==tableRangeEnd)) { tableRangeStart=_per.s; tableRangeEnd=_per.e; _saveTableRange(); }
  if (!tableRangeStart || !tableRangeEnd) {   // 배포 기록이 없을 때만(옛 데이터) 이번 달
    const y=now.getFullYear(), m=now.getMonth()+1;
    tableRangeStart=toDateStr(y,m,1);
    tableRangeEnd=toDateStr(y,m,new Date(y,m,0).getDate());
  }
  { const lb=document.getElementById('tbl-period');
    if (lb) lb.innerHTML = _per ? `${_tblPeriodLabel(_per)}${_per.s<=todayStr&&todayStr<=_per.e?'<span class="tbl-now">지금</span>':''}` : '';
    const pv=document.getElementById('tbl-prev'), nx=document.getElementById('tbl-next');
    if (pv) pv.disabled = _pi<=0; if (nx) nx.disabled = _pi<0 || _pi>=_P.length-1; }

  // 날짜 배열 생성
  const dates=[];
  const cur=new Date(tableRangeStart+'T00:00:00');
  const endDate=new Date(tableRangeEnd+'T00:00:00');
  while(cur<=endDate){ dates.push(new Date(cur)); cur.setDate(cur.getDate()+1); }

  // 제목
  const sd=new Date(tableRangeStart+'T00:00:00'), ed=new Date(tableRangeEnd+'T00:00:00');
  const isSameMonth=sd.getFullYear()===ed.getFullYear()&&sd.getMonth()===ed.getMonth();
  // 범위 내 월별 날수 계산 → 가장 많은 달
  const _monthDays={};
  dates.forEach(d=>{ const k=`${d.getFullYear()}-${d.getMonth()}`; _monthDays[k]=(_monthDays[k]||0)+1; });
  const _topMonthKey=Object.entries(_monthDays).sort((a,b)=>b[1]-a[1])[0]?.[0]||`${sd.getFullYear()}-${sd.getMonth()}`;
  const [_tmY,_tmM]=_topMonthKey.split('-').map(Number);
  const _autoTitle = `${_tmY}년 ${_tmM+1}월 근무표`;
  const _savedTitle = data.settings?.scheduleTitle || null;
  const _titleMain = _savedTitle || _autoTitle;
  const _lastDeploy = (_per && _per.at) || data.deployLog?.[0]?.at || null;   // 이 기간을 마지막으로 배포한 날
  const _deploySpan = _lastDeploy ? ` <span style="font-size:11px;font-weight:400;color:var(--muted);margin-left:8px;">v.${_lastDeploy.split(' ').slice(0,3).join(' ')} 배포</span>` : '';
  document.getElementById('table-title').innerHTML =
    `<span id="table-title-text" data-auto="${_autoTitle}" ondblclick="startEditTableTitle()"${isAdmin?' title="더블클릭하여 제목 수정" style="cursor:pointer;"':''}>${_titleMain}</span>${_deploySpan}`;


  // 직원 먼저, 프리랜서 나중 (드래그 순서 내에서 stable sort)
  function empFirst(arr){ return [...arr].sort((a,b)=>(a.employmentType==='freelancer'?1:0)-(b.employmentType==='freelancer'?1:0)); }
  const _gs = dept => empFirst(getStaff(dept, tableRangeStart).filter(s=>_freelancerActiveInRange(s,dates)));
  const vwStaff=_gs('VW'), cgStaff=_gs('CG');
  const projectStaff=_gs('PROJECT'), sportsStaff=_gs('SPORTS');
  const xrStaff=_gs('XR');
  const jogeunStaff=_gs('조근');
  // VW 컬럼 그룹 | 조근 컬럼 그룹 | CG+ 컬럼 그룹 분리
  const vwCols=vwStaff.map(s=>({...s,_dept:'vw'}));
  const jogeunCols=jogeunStaff.map(s=>({...s,_dept:'jogeun'}));
  const cgCols=[
    ...cgStaff.map(s=>({...s,_dept:'cg'})),
    ...xrStaff.map(s=>({...s,_dept:'xr'})),
    ...projectStaff.map(s=>({...s,_dept:'project'})),
    ...sportsStaff.map(s=>({...s,_dept:'sports'}))
  ];
  const allCols=[...vwCols,...jogeunCols,...cgCols];

  // 범위 내 평일 수 (공휴일 제외)
  let weekdaysInMonth=0;
  dates.forEach(dt=>{
    const dw=dt.getDay();
    const ds=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    const isHoli=!!(data.holidays&&data.holidays[ds]);
    if(isWeekdayForm(ds)) weekdaysInMonth++;   // 평일 틀인 날(평일 편성 공휴일 포함)
  });

  // Work count per staff
  const workCount={};
  allCols.forEach(s=>{workCount[s.id]=0;});

  // colgroup — 날짜(36) 요일(26) [VW staff] 조근(56) VW합(32) [CG+] CG합(32) 당일(40)
  let cg='';
  cg+='<col style="width:46px">';
  cg+='<col style="width:36px">';
  vwCols.forEach(()=>{ cg+='<col>'; });
  jogeunCols.forEach(()=>{ cg+='<col>'; });
  cg+='<col style="width:32px">';
  cgCols.forEach(()=>{ cg+='<col>'; });
  cg+='<col style="width:32px">';
  cg+='<col style="width:40px">';
  cg+='<col id="excel-bigo-col">';   // 비고: 내용맞춤 동적폭
  document.getElementById('excel-colgroup').innerHTML=cg;

  // thead row 1 — dept groups
  let thead='<tr class="dept-row">';
  thead+=`<th class="date-th" rowspan="2">날짜</th>`;
  thead+=`<th class="dow-th" rowspan="2">요일</th>`;
  if(vwCols.length) thead+=`<th class="dept-group vw" colspan="${vwCols.length}">VW (${vwCols.length}명)</th>`;
  if(jogeunCols.length) thead+=`<th class="dept-group" colspan="${jogeunCols.length}" style="background:var(--th-jogeun-bg);color:var(--th-jogeun-fg);border-color:var(--th-jogeun-bd);">조근 (${jogeunCols.length}명)</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;">VW</th>`;
  if(cgStaff.length) thead+=`<th class="dept-group cg" colspan="${cgStaff.length}">CG (${cgStaff.length}명)</th>`;
  if(xrStaff.length) thead+=`<th class="dept-group" colspan="${xrStaff.length}" style="background:var(--th-xr-bg);color:var(--th-xr-fg);border-color:var(--th-xr-bd);">XR</th>`;
  if(projectStaff.length) thead+=`<th class="dept-group project" colspan="${projectStaff.length}">PROJECT</th>`;
  if(sportsStaff.length) thead+=`<th class="dept-group sports" colspan="${sportsStaff.length}">SPORTS</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;background:var(--th-cgsum-bg);color:var(--th-cgsum-fg);">CG</th>`;
  thead+=`<th rowspan="2" class="sum-col" style="font-size:10px;background:var(--th-daysum-bg);color:var(--th-daysum-fg);">당일</th>`;
  thead+=`<th rowspan="2" style="font-size:10px;font-weight:800;background:var(--th-remark-bg);color:var(--th-remark-fg);padding:4px 6px;white-space:nowrap;">비고</th>`;
  thead+='</tr>';
  // thead row 2 — names (조근/VW합/CG합/당일 은 rowspan=2이므로 생략)
  thead+='<tr>';
  const deptColors={vw:'var(--vw-light)',cg:'var(--cg-light)',project:'var(--project-light)',sports:'var(--sports-light)',xr:'var(--xr-light)'};
  let nameFoot='';   // 표 맨 아래 이름 줄(머리줄 이름과 같은 색) — 열 순서는 합계 줄과 같음
  vwCols.forEach(s=>{
    thead+=`<th class="name-th" data-sid="${s.id}" style="cursor:pointer;color:${deptColors.vw};">${s.name}</th>`;
    nameFoot+=`<td style="color:${deptColors.vw};">${s.name}</td>`;
  });
  jogeunCols.forEach(s=>{
    thead+=`<th class="name-th" data-sid="${s.id}" style="cursor:pointer;background:var(--th-jogeun-bg);color:var(--th-jogeun-fg);">${s.name}</th>`;
    nameFoot+=`<td style="background:var(--th-jogeun-bg);color:var(--th-jogeun-fg);">${s.name}</td>`;
  });
  nameFoot+='<td></td>';   // VW합
  cgCols.forEach((s,_ci)=>{
    const bg=s._dept==='xr'?'background:var(--th-xr-namebg);':'';
    const _gc=s._dept==='xr'?'#4faa9c':s._dept==='project'?'#686dc8':s._dept==='sports'?'#8a6ecf':null;
    let _gb='';
    if(_gc){if(_ci===0||cgCols[_ci-1]._dept!==s._dept)_gb+=`border-left:1px solid ${_gc}55;`;if(_ci===cgCols.length-1||cgCols[_ci+1]._dept!==s._dept)_gb+=`border-right:1px solid ${_gc}55;`;}
    thead+=`<th class="name-th" data-sid="${s.id}" style="cursor:pointer;${bg}color:${deptColors[s._dept]||'var(--text)'};${_gb}">${s.name}</th>`;
    nameFoot+=`<td style="${bg}color:${deptColors[s._dept]||'var(--text)'};${_gb}">${s.name}</td>`;
  });
  thead+='</tr>';
  document.getElementById('excel-thead').innerHTML=thead;

  // tbody
  let tbody='';
  for(const date of dates){
    const dow=date.getDay();
    const dateStr=toDateStr(date.getFullYear(),date.getMonth()+1,date.getDate());
    const isToday=dateStr===todayStr;
    const isWeekend=dow===0||dow===6;
    const isHoliday=!!(data.holidays&&data.holidays[dateStr]);
    const holidayName=isHoliday?data.holidays[dateStr]:'';
    const entry=data.schedule[dateStr];
    const dowClass=dow===0?'sun':dow===6?'sat':'';
    const danjikExitId=getDanjikExitStaff(dateStr);
    const danjikOffId=getDanjikOffStaff(dateStr);
    const danjikId=entry?.danjik||null;
    const ilgeunId=entry?.ilgeun||null;

    // VW / CG daily counts (당직·퇴근·SPORTS·조근 제외)
    const _cgExclude=new Set([entry?.danjik,danjikExitId].filter(Boolean));
    const jogeunIds=new Set(jogeunCols.map(s=>s.id));
    const jogeunSubReverse={};Object.entries(entry?.jogeunSubs||{}).forEach(([jId,sId])=>{jogeunSubReverse[sId]=jId;});
    const _ilgeunDept=(entry?.ilgeun?(deptOn(staffById(entry.ilgeun),dateStr)||'').toUpperCase():'');
    const _ilgeunIsVW=_ilgeunDept==='VW';
    // vw.workers에 있는 사람 → VW총계, cg/xr/project에 있는 사람 → CG총계 (중복 방지)
    const _cgWorkersSet=new Set(entry?.cg?.workers||[]);
    const _leaveSet=new Set((data.newLeaves?.[dateStr])||[]);
    const _specialExclude=new Set([entry?.satMorning,entry?.morningDesk].filter(Boolean));
    const _excl=id=>{const _p=staffById(id);return _isVw2(entry,id)||_cgExclude.has(id)||jogeunIds.has(id)||_specialExclude.has(id)||_leaveSet.has(id)||(_p&&!isContractActive(_p,dateStr));};
    const _vwSet=new Set((entry?.vw?.workers||[]).filter(id=>!_excl(id)&&!(_cgWorkersSet.has(id)&&(deptOn(staffById(id),dateStr)||'').toLowerCase()==='vw')));
    const _8jinIds=[entry?.weekend8jin,entry?.weekday8jin,entry?.weekend8jin2,entry?.weekday8jin2].filter(id=>id&&!_specialExclude.has(id)&&!_leaveSet.has(id));
    const _8jinVwAdd=_8jinIds.filter(id=>!_vwSet.has(id)&&!_cgWorkersSet.has(id)&&(deptOn(staffById(id),dateStr)||'').toLowerCase()==='vw').length;
    const _8jinCgAdd=_8jinIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(deptOn(staffById(id),dateStr)||'').toLowerCase();return d==='cg'||d==='xr';}).length;
    // 뉴.오/뉴.오2도 부서별로 일일 총계에 포함 (CG부서→CG총계, VW부서→VW총계). 이미 workers에 있으면 중복 제외
    const _newsOhIds=[entry?.newsOh,entry?.newsOh2].filter(id=>id&&!_specialExclude.has(id)&&!_leaveSet.has(id));
    const _newsOhVwAdd=_newsOhIds.filter(id=>!_vwSet.has(id)&&!_cgWorkersSet.has(id)&&(deptOn(staffById(id),dateStr)||'').toLowerCase()==='vw').length;
    const _newsOhCgAdd=_newsOhIds.filter(id=>{if(_vwSet.has(id)||_cgWorkersSet.has(id))return false;const d=(deptOn(staffById(id),dateStr)||'').toLowerCase();return d==='cg'||d==='xr';}).length;
    const _ilgeunOk=entry?.ilgeun&&!_leaveSet.has(entry.ilgeun)&&!_specialExclude.has(entry?.ilgeun)&&!(isHoliday&&!isWeekend&&isWeekdayForm(dateStr));   // 평일 틀 공휴일 일근은 인원 밖(엑셀 10월 최종 10/5·10/9 합계 수식에 일근 없음, 생성기 인원도 같은 기준)
    // 토·일·공휴일에 PJ가 근무 칸에 있으면(정근으로 일반 근무) CG 인원 — 엑셀 합계 수식이 그날만 PJ 열까지 정근을 셈(10/5·10/9·10/17). 평일 PJ는 프로젝트 근무라 인원 밖
    const _pjAdd=(isWeekend||isHoliday)?(entry?.project||[]).filter(id=>!_excl(id)&&!_vwSet.has(id)&&!_cgWorkersSet.has(id)).length:0;
    const vwCnt=_vwSet.size+(_ilgeunIsVW&&!_cgWorkersSet.has(entry?.ilgeun)&&_ilgeunOk?1:0)+_8jinVwAdd+_newsOhVwAdd;
    const cgCnt=(entry?.cg?.workers||[]).filter(id=>!_excl(id)&&!_vwSet.has(id)).length+(entry?.xr||[]).filter(id=>!_excl(id)).length+(!_ilgeunIsVW&&_ilgeunOk&&!_vwSet.has(entry.ilgeun)?1:0)+_8jinCgAdd+_newsOhCgAdd+_pjAdd;
    const dailyCnt=vwCnt+cgCnt;
    if(isToday) window._todayCounts={vw:vwCnt,cg:cgCnt};

    tbody+=`<tr class="${isWeekend?'weekend':''} ${isHoliday?'holiday':''} ${isToday?'today-row':''}">`;
    const dd=date.getDate(), dm=date.getMonth()+1;
    const dateLabel=isSameMonth?`${dd}`:`<span style="font-size:9px;color:var(--muted);">${dm}/</span>${dd}`;
    const shortHoli=holidayName.length>4?holidayName.slice(0,4)+'…':holidayName;
    tbody+=`<td class="date-td" onclick="showDayModal('${dateStr}')" style="cursor:pointer;" title="${holidayName}">${dateLabel}${isHoliday?`<br><span style="font-size:8px;color:#a8657f;white-space:nowrap;">${shortHoli}</span>`:''}</td>`;
    tbody+=`<td class="dow-td ${dowClass}">${DOW_KR[dow]}</td>`;

    // VW staff cells
    vwCols.forEach(s=>{
      let bg='',color='',fw='500',text='',extraStyle='';
      const imported=_importCellDisplay(entry,s.id,data.newLeaves?.[dateStr]);
      if(imported){
        if(imported.count)workCount[s.id]++;
        const style=`background:${imported.bg};color:${imported.color};font-weight:${imported.fw};`;
        tbody+=`<td data-sid="${s.id}" ${isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)"`:""} style="${style}">${_importCellHTML(imported.text)||'<span class="cell-off">-</span>'}</td>`;
        return;
      }
      const _custom=entry?.customCells?.[s.id];
      if(_custom?.text){
        bg=_isVw2(entry,s.id)?'var(--vw-bg)':(_custom.bg||'');color=_isVw2(entry,s.id)?'var(--vw-light)':(_custom.color||'var(--text)');fw='700';text=_custom.text;workCount[s.id]++;
        const st=bg?`background:${bg};color:${color};font-weight:${fw};`:`color:${color};font-weight:${fw};`;
        const cl=isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)" style="cursor:pointer;${st}"`:`style="${st}"`;
        tbody+=`<td data-sid="${s.id}" ${cl}>${text}</td>`; return;
      }
      const hasNL=(data.newLeaves?.[dateStr]||[]).includes(s.id);
      const contractOut=!isContractActive(s,dateStr);
      const dispatched=isDispatched(s,dateStr);
      if(contractOut){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(dispatched){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(s.id===danjikExitId){bg='var(--r-exit-bg)';color='var(--r-exit-fg)';fw='700';text='퇴근';workCount[s.id]++;}
      else if(hasNL){color='#c79a5e';fw='700';text=entry?.leaveLabels?.[s.id]||'신휴가';}
      else if(entry?.satMorning===s.id){workCount[s.id]++;bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';}
      else if(s.id===danjikOffId&&!_hasBrush(entry,s.id,'work',dateStr)){text='';}
      else if(s.id===danjikId&&entry){workCount[s.id]++;bg='#d65a52';color='#fff';fw='700';text='당직';}
      else if((entry?.restWorkers||[]).includes(s.id)){text=' ';}
      else if((entry?.jogeunEdu||[]).includes(s.id)){workCount[s.id]++;bg='var(--r-edu-bg)';color='var(--r-edu-fg)';fw='700';text='조근';}
      else if(entry?.newsOh===s.id){workCount[s.id]++;bg='var(--r-news-bg)';color='var(--r-news-fg)';fw='700';text='뉴.오';}
      else if(entry?.newsOh2===s.id){workCount[s.id]++;bg='var(--r-news2-bg)';color='var(--r-news2-fg)';fw='700';text='뉴.오2';}
      else if(entry?.weekend8jin===s.id||entry?.weekday8jin===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진';}
      else if(entry?.weekend8jin2===s.id||entry?.weekday8jin2===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진2';}
      else if(((isWeekdayForm(dateStr)&&jogeunSubReverse[s.id])||(entry?.jogeunExtra||[]).includes(s.id))){workCount[s.id]++;bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';}
      else if(entry){
        const workers=entry.vw?.workers||[],deskId=entry.vw?.desk;
        if(workers.includes(s.id)||s.id===ilgeunId){
          workCount[s.id]++;
          if(s.id===ilgeunId){bg='var(--r-ilgeun-bg)';color='var(--r-ilgeun-fg)';fw='700';text='일근';}
          else if(s.id===deskId){bg='';color='#6366f1';fw='700';text=isWeekdayForm(dateStr)?'VW데':'데스크';}   // 엑셀처럼 평일 VW데·주말 데스크
          else{color='var(--muted)';text='정근';}
        } else if((entry.cg?.workers||[]).includes(s.id)){
          workCount[s.id]++;bg='var(--cg-bg)';color='var(--cg-light)';fw='700';text='CG';
        }
      }
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};${fw!=='500'?`font-weight:${fw};`:''}`:'');   // 바탕 없는 칸도 굵기 그대로(8진2·VW데 등이 엑셀 칸처럼 굵게 — 10-21)
      const cl=isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)" style="cursor:pointer;${st}${extraStyle}"`:`style="${st}${extraStyle}"`;
      tbody+=`<td data-sid="${s.id}" ${cl}>${text||'<span class="cell-off">-</span>'}</td>`;
    });

    // 조근 dept staff cells
    jogeunCols.forEach(s=>{
      let bg='',color='',fw='500',text='',extraStyle='';
      const imported=_importCellDisplay(entry,s.id,data.newLeaves?.[dateStr]);
      if(imported){
        if(imported.count)workCount[s.id]++;
        const style=`background:${imported.bg};color:${imported.color};font-weight:${imported.fw};`;
        tbody+=`<td data-sid="${s.id}" ${isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)"`:""} style="${style}">${_importCellHTML(imported.text)||'<span class="cell-off">-</span>'}</td>`;
        return;
      }
      const _custom=entry?.customCells?.[s.id];
      if(_custom?.text){
        bg=_isVw2(entry,s.id)?'var(--vw-bg)':(_custom.bg||'');color=_isVw2(entry,s.id)?'var(--vw-light)':(_custom.color||'var(--text)');fw='700';text=_custom.text;workCount[s.id]++;
        const st=bg?`background:${bg};color:${color};font-weight:${fw};`:`color:${color};font-weight:${fw};`;
        const cl=isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)" style="cursor:pointer;${st}"`:`style="${st}"`;
        tbody+=`<td data-sid="${s.id}" ${cl}>${text}</td>`; return;
      }
      const hasNL=(data.newLeaves?.[dateStr]||[]).includes(s.id);
      if(isDispatched(s,dateStr)){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(hasNL){
        color='#c79a5e';fw='700';text=entry?.leaveLabels?.[s.id]||'신휴가';
      } else if(!isWeekdayForm(dateStr)){   // 주말·주말 편성 공휴일: 조근조는 쉼(8진만)
        if(entry?.weekend8jin===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진';}
        else if(entry?.weekend8jin2===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진2';}
      } else if((entry?.restWorkers||[]).includes(s.id)){text=' ';}
      else if((entry?.jogeunEdu||[]).includes(s.id)){workCount[s.id]++;bg='var(--r-edu-bg)';color='var(--r-edu-fg)';fw='700';text='조근';}
      else if(entry?.newsOh===s.id){workCount[s.id]++;bg='var(--r-news-bg)';color='var(--r-news-fg)';fw='700';text='뉴.오';}
      else if(entry?.newsOh2===s.id){workCount[s.id]++;bg='var(--r-news2-bg)';color='var(--r-news2-fg)';fw='700';text='뉴.오2';}
      else if((entry?.vw?.workers||[]).includes(s.id)){workCount[s.id]++;bg='var(--vw-bg)';color='var(--vw-light)';fw='700';text='VW';}
      else if((entry?.cg?.workers||[]).includes(s.id)){workCount[s.id]++;bg='var(--cg-bg)';color='var(--cg-light)';fw='700';text='CG';}
      else if(entry){bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';workCount[s.id]++;}
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};${fw!=='500'?`font-weight:${fw};`:''}`:'');   // 바탕 없는 칸도 굵기 그대로(8진2·VW데 등이 엑셀 칸처럼 굵게 — 10-21)
      const cl=isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)" style="cursor:pointer;${st}${extraStyle}"`:`style="${st}${extraStyle}"`;
      tbody+=`<td data-sid="${s.id}" ${cl}>${text||'<span class="cell-off">-</span>'}</td>`;
    });

    // VW합 cell
    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${vwCnt?'var(--vw-light)':'var(--muted)'};">${vwCnt||'-'}</td>`;

    // CG+ staff cells
    cgCols.forEach((s,_ci)=>{
      const _gc=s._dept==='xr'?'#4faa9c':s._dept==='project'?'#686dc8':s._dept==='sports'?'#8a6ecf':null;
      let _gb='';
      if(_gc){if(_ci===0||cgCols[_ci-1]._dept!==s._dept)_gb+=`border-left:1px solid ${_gc}55;`;if(_ci===cgCols.length-1||cgCols[_ci+1]._dept!==s._dept)_gb+=`border-right:1px solid ${_gc}55;`;}
      let bg='',color='',fw='500',text='',extraStyle='';
      const imported=_importCellDisplay(entry,s.id,data.newLeaves?.[dateStr]);
      if(imported){
        if(imported.count)workCount[s.id]++;
        const style=`background:${imported.bg};color:${imported.color};font-weight:${imported.fw};`;
        tbody+=`<td data-sid="${s.id}" ${isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)"`:""} style="${style}">${_importCellHTML(imported.text)||'<span class="cell-off">-</span>'}</td>`;
        return;
      }
      const _custom=entry?.customCells?.[s.id];
      if(_custom?.text){
        bg=_isVw2(entry,s.id)?'var(--vw-bg)':(_custom.bg||'');color=_isVw2(entry,s.id)?'var(--vw-light)':(_custom.color||'var(--text)');fw='700';text=_custom.text;workCount[s.id]++;
        const st=bg?`background:${bg};color:${color};font-weight:${fw};${_gb}`:`color:${color};font-weight:${fw};${_gb}`;
        const cl=isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)" style="cursor:pointer;${st}"`:`style="${st}"`;
        tbody+=`<td data-sid="${s.id}" ${cl}>${text}</td>`; return;
      }
      const hasNL=(data.newLeaves?.[dateStr]||[]).includes(s.id);
      const contractOut=!isContractActive(s,dateStr);
      const dispatched=isDispatched(s,dateStr);
      if(contractOut){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(dispatched){bg='';color='';text=' ';extraStyle='box-shadow:inset 0 0 0 1000px rgba(0,0,0,0.08);';}
      else if(s.id===danjikExitId){bg='var(--r-exit-bg)';color='var(--r-exit-fg)';fw='700';text='퇴근';workCount[s.id]++;}
      else if(hasNL){color='#c79a5e';fw='700';text=entry?.leaveLabels?.[s.id]||'신휴가';}
      else if(entry?.satMorning===s.id){workCount[s.id]++;bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';}
      else if(s.id===danjikOffId&&!_hasBrush(entry,s.id,'work',dateStr)){text='';}
      else if(s.id===danjikId&&entry){workCount[s.id]++;bg='#d65a52';color='#fff';fw='700';text='당직';}
      else if((entry?.restWorkers||[]).includes(s.id)){text=' ';}
      else if((entry?.jogeunEdu||[]).includes(s.id)){workCount[s.id]++;bg='var(--r-edu-bg)';color='var(--r-edu-fg)';fw='700';text='조근';}
      else if(entry?.newsOh===s.id){workCount[s.id]++;bg='var(--r-news-bg)';color='var(--r-news-fg)';fw='700';text='뉴.오';}
      else if(entry?.newsOh2===s.id){workCount[s.id]++;bg='var(--r-news2-bg)';color='var(--r-news2-fg)';fw='700';text='뉴.오2';}
      else if(entry?.weekend8jin===s.id||entry?.weekday8jin===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진';}
      else if(entry?.weekend8jin2===s.id||entry?.weekday8jin2===s.id){workCount[s.id]++;color='#d65a52';fw='700';text='8진2';}
      else if(((isWeekdayForm(dateStr)&&jogeunSubReverse[s.id])||(entry?.jogeunExtra||[]).includes(s.id))){workCount[s.id]++;bg='var(--r-jogeun-bg)';color='var(--r-jogeun-fg)';fw='700';text='조근';}
      else if(entry){
        const dept=s._dept;
        let workers=[];
        if(dept==='cg'){workers=entry.cg?.workers||[];}
        else if(dept==='project')workers=entry.project||[];
        else if(dept==='sports')workers=entry.sports||[];
        else if(dept==='xr')workers=entry.xr||[];
        if(workers.includes(s.id)||s.id===ilgeunId){
          workCount[s.id]++;
          const isDesk8=dept==='cg'&&s.id===(entry.cg?.desk8||entry.cg?.desk||null);
          const isDesk5=dept==='cg'&&s.id===entry.cg?.desk5;
          if(s.id===ilgeunId){bg='var(--r-ilgeun-bg)';color='var(--r-ilgeun-fg)';fw='700';text='일근';}
          else if(dept==='cg'&&s.id===entry.morningDesk){bg='';color='#436bb5';fw='700';text='오전데';}
          else if(isDesk8){bg='';color='#6366f1';fw='700';text=isWeekdayForm(dateStr)?'8데스':'데스크';}   // 엑셀처럼 주말(주말 틀)은 데스크
          else if(isDesk5){bg='';color='#4a9fbd';fw='700';text=isWeekdayForm(dateStr)?'5데스':'데스크';}
          else{color='var(--muted)';text='정근';}
        } else if(dept!=='VW'&&(entry.vw?.workers||[]).includes(s.id)){
          workCount[s.id]++;bg='var(--vw-bg)';color='var(--vw-light)';fw='700';text='VW';
        } else if(dept!=='CG'&&(entry.cg?.workers||[]).includes(s.id)){
          workCount[s.id]++;bg='var(--cg-bg)';color='var(--cg-light)';fw='700';text='CG';
        }
      }
      const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};${fw!=='500'?`font-weight:${fw};`:''}`:'');   // 바탕 없는 칸도 굵기 그대로(8진2·VW데 등이 엑셀 칸처럼 굵게 — 10-21)
      const cl=isAdmin?`onclick="cellClick('${s.id}','${dateStr}',event)" style="cursor:pointer;${st}${extraStyle}${_gb}"`:`style="${st}${extraStyle}${_gb}"`;
      tbody+=`<td data-sid="${s.id}" ${cl}>${text||'<span class="cell-off">-</span>'}</td>`;
    });

    // CG합 cell
    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${cgCnt?'var(--cg-light)':'var(--muted)'};">${cgCnt||'-'}</td>`;
    // 당일근무 합계 cell
    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${dailyCnt?'var(--vw-light)':'var(--muted)'};">${dailyCnt||'-'}</td>`;

    // 비고 cell — 동일인이 2개 이상 역할(8진/뉴.오/VW대/CG대/일근)일 때만 표시
    const _personRoles={};
    const _addRole=(id,note,color,bg)=>{
      if(!_personRoles[id])_personRoles[id]=[];
      _personRoles[id].push({note,color,bg});
    };
    if(entry){
      const jin8=entry.weekend8jin||entry.weekday8jin;
      if(jin8) _addRole(jin8,'8진','#d65a52','#fce8e8');
      if(entry.newsOh) _addRole(entry.newsOh,'뉴.오','#9c6b4a','#f5e2cc');
      if(entry.newsOh2) _addRole(entry.newsOh2,'뉴.오2','#b07d4a','#f3ddc0');
      if(ilgeunId) _addRole(ilgeunId,'일근','#a34873','#f6e0ea');
      (entry.vw?.workers||[]).forEach(id=>{
        const sx=staffById(id); if(!sx)return;
        const dx=(sx.dept||'').toUpperCase();
        if(dx!=='VW'&&dx!=='조근') _addRole(id,'VW대','#565ba4','#dfe4f2');
      });
      (entry.cg?.workers||[]).forEach(id=>{
        const sx=staffById(id); if(!sx)return;
        const dx=(sx.dept||'').toUpperCase();
        if(!['CG','XR','PROJECT','SPORTS','조근'].includes(dx)) _addRole(id,'CG대','#437d93','#d4e8ee');
      });
    }
    // 우선순위: 일근>뉴.오>8진>VW대>CG대 — 첫번째는 셀에, 나머지는 비고에
    const _roleOrder=['일근','뉴.오','뉴.오2','8진','VW대','CG대'];
    const bigoItems=[];
    Object.entries(_personRoles).forEach(([id,roles])=>{
      if(roles.length<2)return; // 1개뿐이면 비고 불필요
      const sx=staffById(id); if(!sx)return;
      const sorted=roles.slice().sort((a,b)=>_roleOrder.indexOf(a.note)-_roleOrder.indexOf(b.note));
      // 첫번째(primary)는 이미 셀에 표시됨 — 나머지만 비고에
      sorted.slice(1).forEach(r=>bigoItems.push({name:sx.name,...r}));
    });
    const bigoHtml=bigoItems.map(b=>`<span style="display:inline-block;font-size:10px;padding:1px 5px;border-radius:4px;background:${b.bg};color:${b.color};font-weight:700;white-space:nowrap;margin:1px;">${b.name}: ${b.note}</span>`).join('');
    const _nesc2=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const _ntHtml2 = entry?.notes ? `<span style="display:block;font-size:10px;color:#7c3aed;font-weight:600;margin-top:2px;white-space:nowrap;">${_nesc2(entry.notes)}</span>` : '';
    tbody+=`<td style="padding:3px 6px;white-space:nowrap;text-align:left;">${(bigoHtml||_ntHtml2)?(bigoHtml+_ntHtml2):'<span style="color:var(--muted);font-size:10px;">-</span>'}</td>`;

    tbody+='</tr>';
  }

  // Summary row
  tbody+='<tr class="sum-row">';
  tbody+=`<td class="date-td" style="font-size:10px;font-weight:700;color:var(--muted);text-align:center;line-height:1.5;">평일<br>${weekdaysInMonth}일</td>`;
  tbody+=`<td></td>`; // 요일
  vwCols.forEach(s=>{
    const cnt=workCount[s.id]||0;
    const over=cnt>weekdaysInMonth;
    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${over?'#d65a52':cnt?'var(--text)':'var(--muted)'};">${cnt||'-'}</td>`;
  });
  jogeunCols.forEach(s=>{
    const cnt=workCount[s.id]||0;
    const over=cnt>weekdaysInMonth;
    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${over?'#d65a52':cnt?'var(--vw-light)':'var(--muted)'};">${cnt||'-'}</td>`;
  });
  tbody+=`<td></td>`; // VW합
  cgCols.forEach(s=>{
    const cnt=workCount[s.id]||0;
    const over=cnt>weekdaysInMonth;
    tbody+=`<td style="text-align:center;font-size:11px;font-weight:700;color:${over?'#d65a52':cnt?'var(--text)':'var(--muted)'};">${cnt||'-'}</td>`;
  });
  tbody+=`<td></td><td></td><td></td>`; // CG합, 당일, 비고
  tbody+='</tr>';
  // 맨 아래 이름 줄(10-31 사용자 — 아래쪽 근무를 볼 때 맨 위 이름이 멀어 보기 힘듦). 작성소 표(js/workshop.js)도 같음
  tbody+=`<tr class="name-foot-row"><td class="date-td">이름</td><td class="dow-td"></td>${nameFoot}<td></td><td></td><td></td></tr>`;

  document.getElementById('excel-tbody').innerHTML=tbody;
  (function(){ var dr=document.querySelector('.excel-table thead tr.dept-row'); if(dr){ var h=dr.getBoundingClientRect().height; document.querySelectorAll('.excel-table thead th.name-th').forEach(function(el){ el.style.top=h+'px'; }); } })();
  // 비고 열 폭을 가장 긴 비고 내용에 맞춰 동적 조정(안 잘리게) — 이미지 저장도 렌더된 표 그대로라 함께 반영
  (function(){
    var col=document.getElementById('excel-bigo-col'); var tb=document.getElementById('excel-tbody');
    if(!col||!tb) return;
    col.style.width='1px';
    var maxW=0;
    tb.querySelectorAll('tr').forEach(function(tr){ var last=tr.lastElementChild; if(last) maxW=Math.max(maxW, last.scrollWidth); });
    col.style.width=Math.min(Math.max(maxW+8,130),480)+'px';
  })();
  if(!allCols.length){
    document.getElementById('excel-tbody').innerHTML=`<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--muted);">직원을 먼저 등록해 주세요.</td></tr>`;
  }
}

// 터치: 근무표·작성소 표 칸(가로·세로 둘 다 스크롤) — 스크롤 자체는 브라우저 기본(부드러움. 10-31 손가락을 직접 따라가게 했더니 버벅임 → 되돌림)
//   ① 방향 고정(10-31 사용자 '위로 올리는데 자꾸 셀이 좌우로 움직임'): 처음 LOCK px 움직인 방향이 세로면 overflow-x:hidden, 가로면 overflow-y:hidden 을
//      그 손짓·관성 동안만 걸어 비스듬히 밀어도 한 방향으로만. 브라우저가 스크롤을 시작하는 거리보다 먼저 정함. 관성이 끝나면(스크롤 멈춘 뒤 UNLOCK ms) 풀어 둠
//   ② 세로로 표 끝에 닿으면 같은 손짓으로 화면 전체가 이어서 움직임(10-30 — 위로도 같음). 표 칸은 overscroll-behavior-y:none(css/gantt-etc.css)
//   당겨서 새로고침은 js/pull-refresh.js(표가 맨 위일 때만). 표 칸이 세로로 스크롤되지 않는 크기(태블릿 세로)는 아무것도 안 함
(function(){
  const LOCK=4, UNLOCK=160;
  function bind(el){
    let on=false, axis='', x0=0, y0=0, ly=0, relT=0;
    const unlock=()=>{ clearTimeout(relT); axis=''; el.style.overflowX=''; el.style.overflowY=''; };
    const later=()=>{ clearTimeout(relT); relT=setTimeout(unlock, UNLOCK); };
    el.addEventListener('scroll', ()=>{ if(!on&&axis) later(); }, { passive:true });   // 관성으로 움직이는 동안은 고정 유지
    el.addEventListener('touchstart', e=>{
      unlock(); on=false;
      if(e.touches.length!==1||el.scrollHeight<=el.clientHeight+1) return;
      const t=e.touches[0]; on=true; x0=t.clientX; y0=ly=t.clientY;
    }, { passive:true });
    el.addEventListener('touchmove', e=>{
      if(!on) return;
      if(e.touches.length!==1){ on=false; unlock(); return; }
      const t=e.touches[0];
      if(!axis){
        const dx=t.clientX-x0, dy=t.clientY-y0; if(Math.max(Math.abs(dx),Math.abs(dy))<LOCK) return;
        axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
        if(axis==='y') el.style.overflowX='hidden'; else el.style.overflowY='hidden';
      }
      if(axis==='y'){ const d=ly-t.clientY; if(d&&(d>0?el.scrollTop+el.clientHeight>=el.scrollHeight-1:el.scrollTop<=0)) window.scrollBy(0,d); }   // d>0 = 내려 보기
      ly=t.clientY;
    }, { passive:true });
    const end=()=>{ if(!on) return; on=false; if(axis) later(); };
    el.addEventListener('touchend', end, { passive:true });
    el.addEventListener('touchcancel', end, { passive:true });
  }
  document.querySelectorAll('.excel-wrap').forEach(bind);
})();
