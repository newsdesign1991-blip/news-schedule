/* [모듈] js/publish.js — 작성소 날짜보기·근무표 배포·배포 기록·신휴가 가져오기 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
function wsShowDay(dateStr) {
  _draftCellMode = true;
  showDayModal(dateStr);
}

function publishSchedule() {
  if (!isAdmin) return;
  const draftSched = data.draft.schedule;
  if (!Object.keys(draftSched).length) { toast('초안 근무표가 없습니다.','error'); return; }
  // draft → published: 범위 내 기존 데이터 먼저 제거 후 덮어쓰기
  if (data.draft.rangeStart && data.draft.rangeEnd) {
    const _cur = new Date(data.draft.rangeStart + 'T00:00:00');
    const _end = new Date(data.draft.rangeEnd + 'T00:00:00');
    while (_cur <= _end) {
      const _ds = toDateStr(_cur.getFullYear(), _cur.getMonth()+1, _cur.getDate());
      delete data.schedule[_ds];
      delete data.newLeaves[_ds];
      _cur.setDate(_cur.getDate()+1);
    }
  }
  Object.assign(data.schedule, draftSched);
  Object.assign(data.newLeaves, data.draft.newLeaves||{});
  // tableRange를 draft 범위로 맞춤
  if (data.draft.rangeStart) { tableRangeStart=data.draft.rangeStart; tableRangeEnd=data.draft.rangeEnd; }
  // 배포 기록 저장
  if (!data.deployLog) data.deployLog = [];
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const label = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const rangeLabel = data.draft.rangeStart && data.draft.rangeEnd
    ? ` (${data.draft.rangeStart} ~ ${data.draft.rangeEnd})`
    : '';
  data.deployLog.unshift({ at: label, range: rangeLabel, ts: now.toISOString() });
  data.deployLog = data.deployLog.filter(l => !l.ts || (Date.now()-new Date(l.ts).getTime()) < 365*24*3600*1000);
  saveData(data);
  renderDeployLog();
  renderHome();
  renderTable();
  toast('근무표가 배포되었습니다.','success');
  // 배포 알림: 전 직원에게 보낼지 매번 확인
  if (confirm('근무표를 배포했습니다.\n\n전 직원에게 "근무표 업데이트" 알림을 보낼까요?')) {
    _sendPublishPush(label);
  }
}

function renderDeployLog() {
  const el = document.getElementById('ws-deploy-log');
  if (!el) return;
  const logs = data.deployLog || [];
  if (!logs.length) { el.innerHTML = '<span style="color:var(--muted);font-size:11px;">배포 기록 없음</span>'; return; }
  el.innerHTML = logs.map((l,i) => `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;">
      <span style="color:var(--muted);font-size:10px;min-width:18px;">#${i+1}</span>
      <span style="font-weight:600;">📦 ${l.at}</span>
      <span style="color:var(--muted);">${l.range||''}</span>
    </div>`).join('');
}
function _deployLogs1y(){ return (data.deployLog||[]).filter(l => !l.ts || (Date.now()-new Date(l.ts).getTime()) < 365*24*3600*1000); }
function renderDeployLogHtml(){
  const logs=_deployLogs1y();
  const rows = logs.length ? logs.map((l,i)=>`
    <div style="display:flex;align-items:center;gap:11px;padding:13px 0;border-top:1px solid var(--border);">
      <div style="width:26px;height:26px;border-radius:9px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--muted);flex-shrink:0;">${i+1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13.5px;font-weight:700;color:var(--text);word-break:keep-all;">${l.at}</div>
        ${l.range?`<div style="font-size:11.5px;color:var(--muted);margin-top:1px;">${(l.range||'').trim()}</div>`:''}
      </div>
      <button onclick="deleteDeployRecord(${i})" style="flex-shrink:0;background:var(--danger-bg);color:var(--danger);border:1px solid var(--danger-border);border-radius:9px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">삭제</button>
    </div>`).join('') : '<div style="text-align:center;color:var(--muted);font-size:13px;padding:36px 0;">배포 기록이 없습니다.</div>';
  return `<div class="modal-header"><div class="mh-title">배포 기록</div><button class="modal-close" onclick="closeDeployLog()">✕</button></div>
    <div class="poll-scroll" style="padding:12px 20px 18px;">
      <div style="font-size:12px;color:var(--muted);margin-bottom:2px;">최근 1년간의 배포 내역이 보관됩니다.</div>
      ${rows}
    </div>`;
}
function openDeployLog(){ const c=document.getElementById('deploy-log-card'); if(!c) return; c.innerHTML=renderDeployLogHtml(); const m=document.getElementById('deploy-log-modal'); if(m) m.style.display='flex'; }
function closeDeployLog(){ _animModalClose(document.getElementById('deploy-log-modal')); }
function deleteDeployRecord(i){
  const logs=_deployLogs1y(); const rec=logs[i]; if(!rec) return;
  if(!confirm('이 배포 기록을 삭제할까요?')) return;
  const idx=(data.deployLog||[]).indexOf(rec);
  if(idx>=0){ data.deployLog.splice(idx,1); saveData(data); }
  openDeployLog();
}

function importLeaveToWorkshop() {
  if (!isAdmin) return;
  const entries=data.leaveReq?.entries||{};
  if(!Object.keys(entries).length){toast('가져올 휴가 신청 데이터가 없습니다.','error');return;}
  if(!data.draft.newLeaves) data.draft.newLeaves={};
  // 워크샵 범위 기준으로 필터, entries의 날짜는 완전 덮어쓰기(취소 반영)
  const wsStart=wsRangeStart?new Date(wsRangeStart+'T00:00:00'):null;
  const wsEnd=wsRangeEnd?new Date(wsRangeEnd+'T00:00:00'):null;
  let cnt=0;
  Object.entries(entries).forEach(([dateStr,ids])=>{
    if(wsStart&&wsEnd){
      const d=new Date(dateStr+'T00:00:00');
      if(d<wsStart||d>wsEnd) return;
    }
    // 기존 데이터 완전 교체 (취소된 휴가도 반영)
    data.draft.newLeaves[dateStr]=[...ids];
    cnt+=ids.length;
  });
  saveData(data);
  renderWorkshopTable();
  toast(`신휴가 ${cnt}건 반영했습니다.`,'success');
}

