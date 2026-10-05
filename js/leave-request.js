/* [모듈] js/leave-request.js — 휴가신청(표·팝업·셀 단위 변경 대기열/동기화) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 휴가신청 =====
function _fmtLrDeadline(dl) {
  if (!dl) return '';
  const d = new Date(dl);
  if (isNaN(d.getTime())) return dl;
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function _checkLeaveReqDeadline() {
  const lr = data.leaveReq;
  if (lr && lr.isOpen && lr.deadline && new Date() >= new Date(lr.deadline)) {
    lr.isOpen = false; // 마감 판정은 로컬 표시만 변경. 신청 저장도 서버 최신 마감 조건을 확인한다.
  }
}
function renderLeaveReqView() {
  _lrRestorePending();_lrOverlayPending();
  _checkLeaveReqDeadline();   // 마감 시각이 지났으면 자동으로 닫기
  const lr = data.leaveReq || {};
  const isOpen = !!lr.isOpen;
  const rs = lr.rangeStart||'', re = lr.rangeEnd||'';
  const dl = lr.deadline||'';
  const entries = lr.entries||{};
  const hasEntries = Object.keys(entries).some(d=>(entries[d]||[]).length);

  // 마감일 배너 (사용자 화면 가장 위)
  let deadlineBanner = '';
  if (isOpen && dl) {
    deadlineBanner = `<div style="display:flex;align-items:center;gap:9px;background:rgba(16,185,129,.09);border:1px solid rgba(16,185,129,.28);border-radius:15px;padding:13px 17px;margin-bottom:14px;font-size:13.5px;font-weight:700;color:#0e9f6e;">📅 휴가 신청 마감: ${_fmtLrDeadline(dl)} 까지</div>`;
  } else if (!isOpen && (hasEntries || dl)) {
    deadlineBanner = `<div style="display:flex;align-items:center;gap:9px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.28);border-radius:15px;padding:13px 17px;margin-bottom:14px;font-size:13.5px;font-weight:700;color:#e0483c;">⛔ 휴가 신청이 마감되었습니다${dl?` (마감: ${_fmtLrDeadline(dl)})`:''}</div>`;
  }

  deadlineBanner=_lrSyncBanner()+deadlineBanner;
  // 관리자 컨트롤
  let adminCtrl = '';
  if (isAdmin) {
    adminCtrl = `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px;">
      <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-group" style="margin:0;"><label class="form-label">신청 기간</label>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="date" class="form-input" id="lr-start" value="${rs}" ${isOpen?'disabled':''} style="width:auto;">
            <span style="color:var(--muted);">~</span>
            <input type="date" class="form-input" id="lr-end" value="${re}" ${isOpen?'disabled':''} style="width:auto;">
          </div></div>
        <div class="form-group" style="margin:0;"><label class="form-label">신청 마감 (날짜·시간)</label>
          <input type="datetime-local" class="form-input" id="lr-deadline" value="${dl}" ${isOpen?'disabled':''} style="width:auto;"></div>
        <button class="btn" style="background:${isOpen?'#d65a52':'#4a9fbd'};color:#fff;border:none;" onclick="toggleLeaveReq()">${isOpen?'⛔ CLOSE':'✅ OPEN'}</button>
        <button class="btn btn-outline" onclick="importLeaveReq()" style="font-size:12px;">📥 근무표로 가져오기</button>
        ${isOpen?`<button class="btn" style="background:#7c3aed;color:#fff;border:none;font-size:12px;" onclick="sendLeaveReqNotice()">📢 신청 알림 보내기</button>`:''}
      </div>
      <div style="margin-top:8px;font-size:12px;color:${isOpen?'#059669':'var(--muted)'};">
        ${isOpen?`🟢 신청 진행 중: ${rs} ~ ${re}${dl?` · 마감 ${_fmtLrDeadline(dl)}`:''}`:'⚫ 휴가 신청 닫힘'}
      </div>
    </div>`;
  }

  // 비관리자: 드롭다운 + 열 클릭 병행
  let userSel = '';
  if (!isAdmin) {
    if (!isOpen && !hasEntries) {
      document.getElementById('leavereq-content').innerHTML = deadlineBanner +
        `<div style="padding:40px 0;text-align:center;color:var(--muted);font-size:14px;">현재 휴가 신청 기간이 아닙니다.</div>`;
      return;
    }
    if (isOpen) {
      const myId = (currentUser && currentUser.staffId) ? currentUser.staffId : '';
      const myStaff = myId ? staffById(myId) : null;
      if (myStaff) {
        // 로그인 사용자: 본인 신청 버튼만 노출 (다른 사람 열은 읽기전용)
        leaveReqUserId = myId; localStorage.setItem('nd_lr_user', myId);
        userSel = `<div style="margin-bottom:14px;display:flex;align-items:center;gap:11px;flex-wrap:wrap;">
          <button class="btn" style="background:linear-gradient(135deg,#4a94ff,#2f77f6);color:#fff;border:none;padding:10px 18px;font-size:13.5px;font-weight:800;border-radius:12px;white-space:nowrap;cursor:pointer;box-shadow:0 3px 9px -3px rgba(49,130,246,.5);" onclick="openLrPopup('${myId}')">내 휴가 신청하기</button>
          <span style="font-size:12px;color:var(--muted);line-height:1.45;"><b style="color:var(--text);">${myStaff.name}</b>님, 본인 열만 신청할 수 있어요 · 표에서 본인 열을 눌러도 됩니다</span>
        </div>`;
      } else {
        // 폴백(이름 미매칭): 기존 드롭다운 유지
        const autoId = leaveReqUserId;
        const opts = data.staff.filter(s=>s.active!==false)
          .map(s=>`<option value="${s.id}" ${s.id===autoId?'selected':''}>${s.name} (${s.dept})</option>`).join('');
        userSel = `<div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:12.5px;font-weight:700;color:var(--muted);">내 이름 선택</span>
          <div style="display:flex;align-items:center;gap:7px;">
            <select class="form-select" id="lr-user-sel" style="width:172px;border-radius:12px;font-size:13px;">
              <option value="">-- 선택하세요 --</option>${opts}
            </select>
            <button class="btn" style="background:linear-gradient(135deg,#4a94ff,#2f77f6);color:#fff;border:none;padding:9px 17px;font-size:13px;font-weight:800;border-radius:12px;white-space:nowrap;cursor:pointer;box-shadow:0 3px 9px -3px rgba(49,130,246,.5);" onclick="(function(){const v=document.getElementById('lr-user-sel').value;if(!v){toast('이름을 선택하세요.','error');return;}setLeaveReqUser(v);openLrPopup(v);})()">확인</button>
          </div>
          <span style="font-size:11.5px;color:var(--muted);">또는 표에서 셀을 클릭</span>
        </div>`;
      }
    }
  }

  // 테이블 생성
  let tableHtml = '';
  if (rs && re) {
    const dates=[];
    let cur=new Date(rs+'T00:00:00'), end=new Date(re+'T00:00:00');
    while(cur<=end){dates.push(new Date(cur));cur.setDate(cur.getDate()+1);}

    const DEPT_ORDER=['VW','조근','CG','XR','PROJECT','SPORTS'];
    const DEPT_COLOR={VW:'var(--vw)',CG:'var(--cg)',PROJECT:'var(--project)',SPORTS:'var(--sports)',XR:'var(--xr)','조근':'var(--vw)'};
    const DEPT_BG={XR:'var(--xr-bg)','조근':'var(--vw-bg)'};
    const cols=[];
    DEPT_ORDER.forEach(dept=>{
      const members=data.staff.filter(s=>deptOn(s,rs)===dept&&s.active!==false&&_freelancerActiveInRange(s,dates))
        .sort((a,b)=>(a.employmentType==='freelancer'?1:0)-(b.employmentType==='freelancer'?1:0));
      members.forEach(s=>cols.push({...s,_dept:dept}));
    });

    let cg='<col style="width:46px"><col style="width:36px">';
    cols.forEach(()=>{ cg+='<col>'; });
    cg+='<col style="width:60px">';

    // thead row1 — dept groups
    let th1='<tr class="dept-row"><th class="date-th" rowspan="2">날짜</th><th class="dow-th" rowspan="2">요일</th>';
    DEPT_ORDER.forEach(dept=>{
      const cnt=cols.filter(c=>c._dept===dept).length;
      if(cnt) th1+=`<th class="dept-group" colspan="${cnt}" style="background:${DEPT_BG[dept]||''};color:${DEPT_COLOR[dept]||'var(--text)'};">${dept} (${cnt}명)</th>`;
    });
    th1+=`<th rowspan="2" style="background:#fef2f2;color:#d06b64;font-size:10px;font-weight:800;white-space:nowrap;">확인</th></tr>`;

    // thead row2 — names (클릭하면 팝업)
    let th2='<tr>';
    cols.forEach(s=>{
      th2+=`<th class="name-th" onclick="openLrPopup('${s.id}')" style="background:${DEPT_BG[s._dept]||''};color:${DEPT_COLOR[s._dept]||'var(--text)'};cursor:pointer;" title="${s.name} 클릭하여 신청">${s.name}</th>`;
    });
    th2+='</tr>';

    const DOW_KR=['일','월','화','수','목','금','토'];
    const todayStr=toDateStr(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate());
    let tb='';
    dates.forEach(dt=>{
      const dow=dt.getDay();
      const dateStr=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
      const isWE=dow===0||dow===6;
      const isHoli=!!(data.holidays&&data.holidays[dateStr]);
      const dowCls=dow===0?'sun':dow===6?'sat':'';
      tb+=`<tr class="${isWE||isHoli?'weekend':''} ${dateStr===todayStr?'today-row':''}">`;
      tb+=`<td class="date-td">${dt.getMonth()+1}/${dt.getDate()}</td>`;
      tb+=`<td class="dow-td ${dowCls}">${DOW_KR[dow]}</td>`;
      const dayCount=(entries[dateStr]||[]).length;
      cols.forEach(s=>{
        const hasLeave=(entries[dateStr]||[]).includes(s.id);
        const bg=hasLeave?'#FFE0B2':'';
        const color=hasLeave?'#c79a5e':'';
        const fw=hasLeave?'700':'500';
        const text=hasLeave?'신휴가':'<span class="cell-off">-</span>';
        const st=bg?`background:${bg};color:${color};font-weight:${fw};`:(color?`color:${color};`:'');
        tb+=`<td data-sid="${s.id}" style="cursor:pointer;${st}">${text}</td>`;
      });
      if(dayCount>=4){
        tb+=`<td style="color:#dc2626;font-weight:800;font-size:10px;white-space:nowrap;background:#fef2f2;border:1px solid #fca5a5;text-align:center;">⚠ ${dayCount}명</td>`;
      } else {
        tb+=`<td style="color:var(--muted);font-size:10px;text-align:center;">${dayCount||''}</td>`;
      }
      tb+='</tr>';
    });

    tableHtml=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;"><table class="excel-table lreq-table">
      <colgroup>${cg}</colgroup>
      <thead>${th1}${th2}</thead>
      <tbody>${tb}</tbody>
    </table></div>`;
  } else if (isAdmin) {
    tableHtml='<div style="color:var(--muted);font-size:13px;padding:20px 0;">날짜 범위를 설정하고 OPEN을 눌러 휴가 신청을 시작하세요.</div>';
  }

  document.getElementById('leavereq-content').innerHTML = deadlineBanner + adminCtrl + userSel + tableHtml;
}

// 휴가신청 편집 주체: 비관리자는 로그인한 본인(currentUser.staffId)으로 고정
function _lrMyId(){ return (!isAdmin && currentUser && currentUser.staffId) ? currentUser.staffId : leaveReqUserId; }
function setLeaveReqUser(id) {
  if (!isAdmin && currentUser && currentUser.staffId) id = currentUser.staffId;   // 본인만 신청 가능
  leaveReqUserId = id;
  localStorage.setItem('nd_lr_user', id);
  renderLeaveReqView();
  if (id) openLrPopup(id);
}

// 신휴가 팝업 표 행 HTML (셀 클릭 시 팝업 재생성 없이 이 부분만 갱신 → 번쩍임 방지)
function _lrRowsHtml(staffId){
  const lr = data.leaveReq || {};
  const entries = lr.entries || {};
  const rs = lr.rangeStart, re = lr.rangeEnd;
  const staff = staffById(staffId);
  if(!staff || !rs || !re) return '';
  const isOpen = !!lr.isOpen;
  const canEdit = isAdmin || (isOpen && _lrMyId() === staffId);
  const DOW_KR = ['일','월','화','수','목','금','토'];
  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());
  const TD = 'height:34px;vertical-align:middle;text-align:center;white-space:nowrap;font-size:12px;border-bottom:1px solid var(--border);';
  const TD_WE = 'height:34px;vertical-align:middle;text-align:center;white-space:nowrap;font-size:12px;border-bottom:1px solid var(--border);background:var(--wk-bg);';
  const dates=[]; let cur=new Date(rs+'T00:00:00'), end=new Date(re+'T00:00:00');
  while(cur<=end){ dates.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
  let rows='';
  dates.forEach(dt=>{
    const dow=dt.getDay();
    const dateStr=toDateStr(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    const isWE=dow===0||dow===6;
    const isHoli=!!(data.holidays && data.holidays[dateStr]);
    const base=isWE||isHoli?TD_WE:TD;
    const dowColor=dow===0?'color:var(--pop-dow-sun);':dow===6?'color:var(--pop-dow-sat);':'';
    const todayExtra=dateStr===todayStr?'color:#5d6fb0;font-weight:800;':'font-weight:700;';
    const _todayTr=dateStr===todayStr?' style="background:var(--pop-today-bg);"':'';
    const hasLeave=(entries[dateStr]||[]).includes(staffId);
    const dayCount=(entries[dateStr]||[]).length;
    const over=dayCount>=4;
    const leaveBg=hasLeave?'background:#FFE0B2;color:#c79a5e;font-weight:700;':'';
    const clickAttr=canEdit?`onclick="lrPopupCellClick('${staffId}','${dateStr}')" style="cursor:pointer;${base}${leaveBg}"`:`style="${base}${leaveBg}"`;
    const warnCell=over?`<td style="${base}color:#dc2626;font-weight:800;background:#fef2f2;padding:0 8px;">⚠ ${dayCount}명</td>`:`<td style="${base}color:var(--muted);padding:0 8px;">${dayCount||''}</td>`;
    rows+=`<tr${_todayTr}>
      <td style="${base}${todayExtra}padding:0 8px;color:var(--text);">${dt.getMonth()+1}/${dt.getDate()}</td>
      <td style="${base}${dowColor}padding:0 6px;">${DOW_KR[dow]}</td>
      <td ${clickAttr}>${hasLeave?'신휴가':'<span style="color:var(--muted);">-</span>'}</td>
      ${warnCell}
    </tr>`;
  });
  return rows;
}
// 신휴가 팝업 '달력' 보기: 신청 기간 안의 날짜를 달력에서 눌러 신청/취소(목록과 같은 lrPopupCellClick 사용).
// 금색 동그라미 = 내 신휴가, 날짜 아래 숫자 = 그날 신청 인원(4명 이상 빨강). 마지막에 고른 보기는 기억.
let _lrView = (function(){ try{ return localStorage.getItem('nd_lr_view')==='cal'?'cal':'list'; }catch(e){ return 'list'; } })();
let _lrCalYM = null, _lrFocusDs = null;   // _lrFocusDs: 마지막으로 누른 날짜(오른쪽 목록에서 강조)
function lrSetView(v, staffId){
  const nv = v==='cal'?'cal':'list', changed = nv!==_lrView;
  _lrView = nv; try{ localStorage.setItem('nd_lr_view', _lrView); }catch(e){}
  document.querySelectorAll('#lr-popup-overlay .lr-view-tabs button').forEach(b=>{ const on=b.dataset.v===_lrView; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on)); });
  const card=document.querySelector('#lr-popup-overlay .lr-pop');
  const apply=()=>{
    const cal=document.getElementById('lr-cal-view'), list=document.getElementById('lr-popup-scroll');
    if(cal){ _lrCalPaint(cal, staffId); cal.style.display=_lrView==='cal'?'':'none'; }
    if(list) list.style.display=_lrView==='cal'?'none':'';
    card?.classList.toggle('lr-cal-mode', _lrView==='cal');
  };
  // 보기 바꿀 때: 내용 블러로 사라짐 → 팝업 크기 슈욱 → 새 내용 또렷하게(js/nd-cal.js ndMorph)
  if(changed && card && typeof ndMorph==='function') ndMorph(card, apply, { parts: ()=>[document.getElementById('lr-cal-view'), document.getElementById('lr-popup-scroll')] });
  else apply();
}
function lrCalNav(d, staffId){
  const lr=data.leaveReq||{}; if(!_lrCalYM||!lr.rangeStart||!lr.rangeEnd) return;
  let [y,m]=_lrCalYM; m+=d; if(m<1){m=12;y--;} if(m>12){m=1;y++;}
  const k=y*12+m, [sy,sm]=lr.rangeStart.split('-').map(Number), [ey,em]=lr.rangeEnd.split('-').map(Number);
  if(k<sy*12+sm||k>ey*12+em) return;
  _lrCalYM=[y,m]; const cal=document.getElementById('lr-cal-view'); if(cal) _lrCalPaint(cal, staffId);
}
// 달력을 다시 그려도 키보드 포커스(눌렀던 날짜·이전/다음 달 버튼)를 유지
function _lrCalPaint(cal, staffId){
  const fa=document.activeElement, fk=cal.contains(fa)&&fa.dataset?fa.dataset.f:'';
  cal.innerHTML=_lrCalHtml(staffId);
  if(fk){ let t=cal.querySelector('[data-f="'+fk+'"]'); if(!t||t.disabled) t=cal.querySelector(fk.indexOf('d:')===0?'.lr-day:not(.out):not(:disabled)':'[data-f="next"]:not(:disabled), [data-f="prev"]:not(:disabled)'); if(t) t.focus(); }
}
function _lrCalHtml(staffId){
  const lr=data.leaveReq||{}, entries=lr.entries||{}, rs=lr.rangeStart, re=lr.rangeEnd;
  if(!rs||!re) return '';
  const canEdit = isAdmin || (!!lr.isOpen && _lrMyId() === staffId);
  const now=new Date(), todayStr=toDateStr(now.getFullYear(),now.getMonth()+1,now.getDate());
  const [sy,sm]=rs.split('-').map(Number), [ey,em]=re.split('-').map(Number);
  if(!_lrCalYM || _lrCalYM[0]*12+_lrCalYM[1]<sy*12+sm || _lrCalYM[0]*12+_lrCalYM[1]>ey*12+em){
    const ty=now.getFullYear(), tm=now.getMonth()+1;   // 오늘이 기간 안이면 이번 달, 아니면 기간 첫 달
    _lrCalYM = (todayStr>=rs && todayStr<=re) ? [ty,tm] : [sy,sm];
  }
  const [y,m]=_lrCalYM, k=y*12+m, lead=new Date(y,m-1,1).getDay(), days=new Date(y,m,0).getDate();
  const chev=d=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d<0?'M15 5l-7 7 7 7':'M9 5l7 7-7 7'}"/></svg>`;
  let cells='<span></span>'.repeat(lead), mine=0;
  for(let d=1; d<=days; d++){
    const ds=toDateStr(y,m,d), inR=ds>=rs&&ds<=re, dow=(lead+d-1)%7;
    const list=entries[ds]||[], on=list.includes(staffId), cnt=list.length;
    if(on && inR) mine++;
    const holi=!!(data.holidays&&data.holidays[ds]);
    const cls='lr-day'+(on?' on':'')+(ds===todayStr?' today':'')+(dow===0||holi?' sun':dow===6?' sat':'')+(cnt>=4?' over':'');
    const lbl=`${m}월 ${d}일${on?' 신휴가 신청됨':''}${cnt?' · 신청 '+cnt+'명':''}`;
    cells += inR
      ? `<button type="button" data-f="d:${ds}" class="${cls}"${canEdit?` onclick="lrPopupCellClick('${staffId}','${ds}')"`:' disabled'} aria-pressed="${on}" aria-label="${lbl}"><b>${d}</b><i>${cnt||''}</i></button>`
      : `<span class="lr-day out"><b>${d}</b><i></i></span>`;
  }
  const DOW=['일','월','화','수','목','금','토'], DEPT_C={VW:'var(--vw)',CG:'var(--cg)',PROJECT:'var(--project)',SPORTS:'var(--sports)',XR:'var(--xr)'};
  const myDays=Object.keys(entries).filter(ds=>ds>=rs&&ds<=re&&(entries[ds]||[]).includes(staffId)).sort();
  const sideRows=myDays.map(ds=>{
    const dt=new Date(ds+'T00:00:00'), others=(entries[ds]||[]).filter(id=>id!==staffId), cnt=(entries[ds]||[]).length;
    const chips=others.map(id=>{ const st=staffById(id); return st?`<span class="lr-side-chip" style="--c:${DEPT_C[st.dept]||'var(--muted)'}">${st.name}<small>${st.dept||''}</small></span>`:''; }).join('');
    return `<div class="lr-side-row${ds===_lrFocusDs?' focus':''}${cnt>=4?' over':''}"><div class="lr-side-date"><b>${dt.getMonth()+1}/${dt.getDate()}</b><small>(${DOW[dt.getDay()]})</small></div><div class="lr-side-names">${chips||'<span class="lr-side-none">나 혼자 신청</span>'}</div><span class="lr-side-cnt">${cnt>=4?'⚠ ':''}총 ${cnt}명</span></div>`;
  }).join('');
  const side=`<aside class="lr-cal-side" aria-label="내 신휴가와 같은 날 신청한 사람">
    <div class="lr-side-hd">내 신휴가 <b>${myDays.length}일</b><span>같은 날 신청한 사람</span></div>
    <div class="lr-side-list">${sideRows||'<div class="lr-side-empty">달력에서 날짜를 누르면 신휴가가 신청되고,<br>그날 함께 신청한 사람이 여기에 보여요.</div>'}</div>
  </aside>`;
  return `<div class="lr-cal-wrap"><div class="lr-cal">
    <div class="lr-cal-head"><b>${y}년 ${m}월</b><div class="lr-cal-nav">
      <button type="button" data-f="prev" onclick="lrCalNav(-1,'${staffId}')" aria-label="이전 달"${k<=sy*12+sm?' disabled':''}>${chev(-1)}</button>
      <button type="button" data-f="next" onclick="lrCalNav(1,'${staffId}')" aria-label="다음 달"${k>=ey*12+em?' disabled':''}>${chev(1)}</button></div></div>
    <div class="lr-cal-week">${['일','월','화','수','목','금','토'].map(w=>`<span>${w}</span>`).join('')}</div>
    <div class="lr-cal-grid">${cells}</div>
    <div class="lr-cal-legend"><span><i class="lg-on"></i>내 신휴가</span><span>숫자 = 그날 신청 인원</span></div>
  </div>${side}</div>`;
}
function openLrPopup(staffId, noAnim) {
  const lr = data.leaveReq || {};
  const entries = lr.entries || {};
  const rs = lr.rangeStart, re = lr.rangeEnd;
  const staff = staffById(staffId);
  if (!staff || !rs || !re) return;
  document.getElementById('lr-popup-root')?.remove();   // 이전 팝업이 남아 있으면 제거(두 번 열려 겹치는 문제 방지)
  // 비관리자: 로그인한 본인으로 고정 (다른 열은 읽기전용으로 열람)
  if (!isAdmin) { const mine=(currentUser&&currentUser.staffId)?currentUser.staffId:staffId; leaveReqUserId=mine; localStorage.setItem('nd_lr_user',mine); }

  const dates = [];
  let cur = new Date(rs+'T00:00:00'), end = new Date(re+'T00:00:00');
  while (cur <= end) { dates.push(new Date(cur)); cur.setDate(cur.getDate()+1); }

  const DOW_KR = ['일','월','화','수','목','금','토'];
  const DEPT_COLOR = {VW:'var(--vw)',CG:'var(--cg)',PROJECT:'var(--project)',SPORTS:'var(--sports)',XR:'var(--xr)','조근':'var(--vw)'};
  const nameColor = DEPT_COLOR[staff.dept] || 'var(--text)';
  const isOpen = !!lr.isOpen;
  const canEdit = isAdmin || (isOpen && _lrMyId() === staffId);
  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());

  // 실제 테이블과 동일한 셀 스타일 상수
  const TD = 'height:34px;vertical-align:middle;text-align:center;white-space:nowrap;font-size:12px;border-bottom:1px solid var(--border);';
  const TD_WE = 'height:34px;vertical-align:middle;text-align:center;white-space:nowrap;font-size:12px;border-bottom:1px solid var(--border);background:var(--wk-bg);';

  const rows = _lrRowsHtml(staffId);

  const TH = 'padding:10px 8px;font-size:11px;font-weight:700;text-align:center;background:var(--surface);position:sticky;top:0;z-index:1;border-bottom:1.5px solid var(--border);';
  const html = `
  <div id="lr-popup-overlay" onclick="dismissLrPopup()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9000;display:flex;align-items:center;justify-content:center;">
    <div onclick="event.stopPropagation()" class="nd-pop lr-pop${noAnim?' no-anim':''}${_lrView==='cal'?' lr-cal-mode':''}" style="background:var(--surface);border-radius:20px;box-shadow:0 16px 50px -12px rgba(15,23,42,0.32);max-height:82vh;display:flex;flex-direction:column;width:340px;">
      <div class="lr-pop-head">
        <div style="min-width:0;">
          <div class="lr-pop-title">${staff.name}<span class="lr-pop-dept" style="color:${nameColor};">${staff.dept}</span></div>
          <div class="lr-pop-sub">${canEdit?'신휴가 신청 · 날짜를 눌러 신청/취소':'신휴가 신청 현황 · 읽기 전용'}</div>
        </div>
        <button type="button" class="lr-pop-close" onclick="dismissLrPopup()" aria-label="닫기">✕</button>
      </div>
      <div class="lr-view-tabs" role="tablist" aria-label="보기 방식">
        <button type="button" role="tab" data-v="list" class="${_lrView==='list'?'on':''}" aria-selected="${_lrView==='list'}" onclick="lrSetView('list','${staffId}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>목록</button>
        <button type="button" role="tab" data-v="cal" class="${_lrView==='cal'?'on':''}" aria-selected="${_lrView==='cal'}" onclick="lrSetView('cal','${staffId}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>달력</button>
      </div>
      <div id="lr-cal-view" style="${_lrView==='cal'?'':'display:none;'}overflow-y:auto;padding:4px 16px 10px;">${_lrCalHtml(staffId)}</div>
      <div id="lr-popup-scroll" style="${_lrView==='cal'?'display:none;':''}overflow-y:auto;padding:0 16px 12px;">
        <table style="border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;">
          <colgroup><col style="width:60px"><col style="width:44px"><col><col style="width:72px"></colgroup>
          <thead>
            <tr>
              <th style="${TH}color:var(--muted);">날짜</th>
              <th style="${TH}color:var(--muted);">요일</th>
              <th style="${TH}color:${nameColor};">${staff.name}</th>
              <th style="${TH}color:#d06b64;">확인</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="padding:10px 16px 14px;border-top:1px solid var(--border);flex-shrink:0;">
        ${canEdit
          ? `<div style="font-size:11px;color:var(--muted);text-align:center;margin-bottom:8px;">날짜를 눌러 신휴가를 신청/취소하세요</div>
             <button type="button" class="lr-pop-save" onclick="lrSaveAndClose()">저장하고 닫기</button>`
          : `<div style="font-size:11px;color:var(--muted);text-align:center;">읽기 전용</div>`}
      </div>
    </div>
  </div>`;

  const el = document.createElement('div');
  el.id = 'lr-popup-root';
  el.innerHTML = html;
  document.body.appendChild(el);
}

function closeLrPopup() {
  const el = document.getElementById('lr-popup-root');
  if (el) el.remove();
}
// 사용자가 닫을 때(✕·배경·저장): 닫힘 애니메이션 후 제거 (셀 클릭 재생성은 즉시 closeLrPopup 사용)
function dismissLrPopup() {
  _lrFlushSync();   // 미저장 토글이 있으면 즉시 병합 저장
  const ov = document.getElementById('lr-popup-overlay');
  if (!ov) { closeLrPopup(); return; }
  ov.classList.add('nd-closing');
  setTimeout(closeLrPopup, 360);
}

function lrPopupCellClick(staffId, dateStr) {
  _lrFocusDs = dateStr;
  lrCellClick(staffId, dateStr);   // 토글 + 저장 + 배경 갱신
  // 팝업을 재생성하지 않고 표(tbody)만 교체 → 번쩍임 없음, 스크롤 위치 유지
  const tb = document.querySelector('#lr-popup-overlay tbody');
  if (tb) tb.innerHTML = _lrRowsHtml(staffId);
  else { closeLrPopup(); openLrPopup(staffId, true); return; }   // 폴백
  const cal = document.getElementById('lr-cal-view');
  if (cal) _lrCalPaint(cal, staffId);
}
async function lrSaveAndClose() {
  if (_lrSyncTimer) { clearTimeout(_lrSyncTimer); _lrSyncTimer=null; }
  let ok = true;
  ok = await _lrSyncMyColumn(_lrMyId());   // 서버 최신본에 내 열 병합 (동시 저장 안전)
  renderLeaveReqView();
  if (ok) dismissLrPopup();
  if (ok) toast('휴가 신청이 저장되었습니다.','success');
  else toast('저장에 실패했습니다. 네트워크 확인 후 다시 시도해 주세요.','error');
}

function toggleLeaveReq() {
  if (!isAdmin) return;
  const lr = data.leaveReq || {};
  if (!lr.isOpen) {
    const s=document.getElementById('lr-start').value;
    const e=document.getElementById('lr-end').value;
    const dl=document.getElementById('lr-deadline')?.value||'';
    if(!s||!e){toast('날짜 범위를 입력하세요.','error');return;}
    if(new Date(s+'T00:00:00')>new Date(e+'T00:00:00')){toast('종료일이 시작일보다 앞섭니다.','error');return;}
    data.leaveReq={isOpen:true,rangeStart:s,rangeEnd:e,deadline:dl,entries:lr.entries||{}};
  } else {
    data.leaveReq={...lr,isOpen:false};
  }
  saveData(data);
  renderLeaveReqView();
}
function sendLeaveReqNotice() {
  if (!isAdmin) return;
  const lr = data.leaveReq;
  if (!lr?.isOpen) { toast('휴가 신청이 열려 있을 때만 보낼 수 있습니다.','error'); return; }
  const dlTxt = lr.deadline ? _fmtLrDeadline(lr.deadline) : '';
  const msg = `휴가 신청이 시작되었습니다. 신청 기간 ${lr.rangeStart} ~ ${lr.rangeEnd}.${dlTxt?` 마감: ${dlTxt}`:''}`;
  if (!confirm('전 직원에게 휴가신청 시작 알림을 보낼까요?\n\n'+msg)) return;
  _sendNoticePush(msg, '📋 휴가 신청 안내');
  toast('휴가신청 알림을 보냈습니다.','success');
}

// ===== 휴가신청: 셀 단위 변경 대기열 + 조건부 저장 =====
let _lrSyncTimer=null, _lrInFlight=null, _lrPending={}, _lrScope=null, _lrSerial=0, _lrSaveError='';
function _lrPendingKey(){return STORE_KEY+':leave-pending:'+(isAdmin?'admin':(_lrMyId()||'guest'));}
function _lrRestorePending(){
  const key=_lrPendingKey();if(_lrScope===key)return;
  _lrScope=key;_lrPending={};
  try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const [k,op]of Object.entries(saved))if(op&&op.id&&/^\d{4}-\d{2}-\d{2}$/.test(op.ds)&&(isAdmin||op.id===_lrMyId()))_lrPending[k]={...op,version:++_lrSerial};}catch{}
  _lrOverlayPending();
  if(Object.keys(_lrPending).length)_lrSaveError='restored';
}
function _lrPersistPending(){try{localStorage.setItem(_lrScope,JSON.stringify(_lrPending));return true;}catch{toast('기기 보관 공간이 부족합니다. 저장 완료 전 창을 닫지 마세요.','error');return false;}}
function _lrOverlayPending(){
  if(!data.leaveReq)data.leaveReq={entries:{}};if(!data.leaveReq.entries)data.leaveReq.entries={};
  for(const op of Object.values(_lrPending)){
    const list=(data.leaveReq.entries[op.ds]||[]).filter(id=>id!==op.id);
    if(op.selected)list.push(op.id);data.leaveReq.entries[op.ds]=list;
  }
}
function _lrHasPending(){_lrRestorePending();return !!_lrInFlight||Object.keys(_lrPending).length>0;}
function _lrSyncBanner(){
  if(!_lrHasPending())return '';
  return '<div role="status" style="padding:12px 16px;margin-bottom:12px;border-radius:12px;background:var(--vw-bg);color:var(--text);font-size:13px;line-height:1.7;">'+(_lrSaveError?'아직 서버에 저장되지 않았습니다. 변경 내용은 이 기기에 보관되어 있습니다.':'휴가 변경 사항을 저장 중입니다. 저장 완료 전에는 신청이 확정되지 않습니다.')+' <button class="btn" onclick="_lrSyncMyColumn(_lrMyId())">다시 저장</button> <button class="btn" onclick="_lrDiscardPending()">미저장 변경 취소</button></div>';
}
async function _lrDiscardPending(){
  if(_lrInFlight){toast('저장 중입니다. 잠시 후 다시 시도해 주세요.');return;}
  if(!confirm('서버에 저장되지 않은 휴가 변경을 취소하고 최신 내용을 불러올까요?'))return;
  _lrPending={};_lrPersistPending();_lrSaveError='';await _reloadRemoteData();renderLeaveReqView();
}
function _lrDateList(rs,re){const out=[];if(!rs||!re)return out;let cur=new Date(rs+'T00:00:00'),end=new Date(re+'T00:00:00');while(cur<=end){out.push(toDateStr(cur.getFullYear(),cur.getMonth()+1,cur.getDate()));cur.setDate(cur.getDate()+1);}return out;}
async function _lrSyncMyColumn(myId){
  _lrRestorePending();if(_lrSyncTimer){clearTimeout(_lrSyncTimer);_lrSyncTimer=null;}
  if(_lrInFlight)return _lrInFlight;
  if(!Object.keys(_lrPending).length)return true;
  const scope=_lrScope,admin=isAdmin;
  _lrSaveError='';
  _lrInFlight=_lrDrainChanges(scope,admin);
  let ok=false;
  try{ok=await _lrInFlight;return ok;}finally{
    _lrInFlight=null;
    if(_lrScope===scope){_lrSaveError=ok?'':'unsaved';renderLeaveReqView();if(!ok)toast('휴가 변경을 저장하지 못했습니다. 연결 확인 후 다시 저장해 주세요.','error');}
  }
}
async function _lrRequest(url,options){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}
}
async function _lrDrainChanges(scope,admin){
  if(isAdminTest){_lrPending={};_lrPersistPending();return true;}
  const url=SB_URL+'/rest/v1/nd_data?id=eq.main';
  let failures=0;
  while(Object.keys(_lrPending).length && failures<80){
    if(scope!==_lrPendingKey()||scope!==_lrScope)return false;
    const batch=Object.entries(_lrPending).map(([key,op])=>[key,{...op}]);
    try{
      const g=await _lrRequest(url+'&select=payload,updated_at',{headers:SB_HEADERS});
      if(!g.ok)throw Error('read');const remote=(await g.json())?.[0];
      if(!remote?.payload||!remote.updated_at)throw Error('missing version');
      const rp=remote.payload,lr=rp.leaveReq;
      if(!lr || (!admin&&(!lr.isOpen||(lr.deadline&&Date.now()>=new Date(lr.deadline).getTime()))))return false;
      if(batch.some(([,op])=>op.rs!==lr.rangeStart||op.re!==lr.rangeEnd||op.ds<lr.rangeStart||op.ds>lr.rangeEnd))return false;
      if(!lr.entries)lr.entries={};
      for(const [,op]of batch){const list=(lr.entries[op.ds]||[]).filter(id=>id!==op.id);if(op.selected)list.push(op.id);lr.entries[op.ds]=list;}
      const p=await _lrRequest(url+'&updated_at=eq.'+encodeURIComponent(remote.updated_at),{method:'PATCH',headers:{...SB_HEADERS,Prefer:'return=representation'},body:JSON.stringify({payload:rp})});
      if(!p.ok){if(p.status===409){failures++;}else throw Error('write');}
      else{
        const saved=(await p.json())?.[0];
        if(saved?.payload){
          if(scope!==_lrPendingKey()||scope!==_lrScope)return false;
          for(const [key,op]of batch)if(_lrPending[key]?.version===op.version)delete _lrPending[key];
          data.leaveReq=saved.payload.leaveReq;_lrOverlayPending();_lrPersistPending();
          // Do not advance the full-document revision: other local fields may be stale.
          try{localStorage.setItem(STORE_KEY,JSON.stringify(data));}catch{}
          _localBackup(data);failures=0;continue;
        }
        failures++;
      }
    }catch{failures++;if(failures>=3)return false;}
    await new Promise(resolve=>setTimeout(resolve,80+Math.random()*Math.min(1600,120*failures)));
  }
  return !Object.keys(_lrPending).length;
}
function _lrScheduleSync(myId){if(_lrSyncTimer)clearTimeout(_lrSyncTimer);_lrSyncTimer=setTimeout(()=>{_lrSyncTimer=null;_lrSyncMyColumn(myId);},450);}
function _lrFlushSync(){if(_lrHasPending())return _lrSyncMyColumn(_lrMyId());}
function lrCellClick(staffId,dateStr){
  _lrRestorePending();_lrOverlayPending();
  if(!isAdmin&&(_lrMyId()!==staffId||!data.leaveReq?.isOpen))return;
  const lr=data.leaveReq;if(!lr||dateStr<lr.rangeStart||dateStr>lr.rangeEnd)return;
  const selected=!(lr.entries?.[dateStr]||[]).includes(staffId);
  _lrPending[JSON.stringify([staffId,dateStr])]={id:staffId,ds:dateStr,selected,rs:lr.rangeStart,re:lr.rangeEnd,version:++_lrSerial};
  _lrOverlayPending();_lrPersistPending();_lrSaveError='';_lrScheduleSync(_lrMyId());renderLeaveReqView();
}
window.addEventListener('online',()=>{if(_lrHasPending())_lrSyncMyColumn(_lrMyId());});
window.addEventListener('beforeunload',event=>{if(_lrHasPending()){_lrPersistPending();event.preventDefault();event.returnValue='';}});

function importLeaveReq() {
  if (!isAdmin) return;
  // 작성소 탭으로 이동하여 가져오기
  toast('작성소 탭의 "신휴가 가져오기" 버튼을 사용하세요.','info');
}


