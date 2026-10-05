/* [모듈] js/sync-init.js — 자동 동기화·앱 시작(INIT) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 자동 동기화 (절약형: updated_at만 폴링 → 변경됐을 때만 전체 1회 로드) =====
let _autoSyncTimer = null;
const _AUTO_SYNC_MS = 120000; // 2분
function _migrateRemote(remote) {
  if (!remote.leaves) remote.leaves = {};
  if (!remote.events) remote.events = {};
  if (!remote.holidays) remote.holidays = {};
  if (!remote.settings) remote.settings = {};
  if (!remote.newLeaves) remote.newLeaves = {};
  if (!remote.leaveReq) remote.leaveReq = {isOpen:false,rangeStart:'',rangeEnd:'',entries:{}};
  if (!remote.draft) remote.draft = {schedule:{},newLeaves:{},rangeStart:'',rangeEnd:''};
  if (!remote.deployLog) remote.deployLog = [];
  if (!remote.notices) remote.notices = {};
  if (!Array.isArray(remote.polls)) remote.polls = [];
  if (remote.staff) remote.staff.forEach(s => {
    s.employmentType = s.employmentType || 'employee';
    if (s.morningDeskPriority === undefined) s.morningDeskPriority = null;
    if (s.canSatMorning === undefined) s.canSatMorning = false;
    if (s.canIlgeun === undefined) s.canIlgeun = false;
    if (s.canVW === undefined) s.canVW = false;
    if (s.canCG === undefined) s.canCG = false;
    if (s.can3D === undefined) s.can3D = false;
    if (s.availableDays === undefined) s.availableDays = [];
  });
  return remote;
}
function _rerenderActiveView() {
  const v = document.querySelector('.view.active')?.id;
  if (v==='view-home') renderHome();
  else if (v==='view-table') renderTable();
  else if (v==='view-month') renderMonth();
  else if (v==='view-leavereq') renderLeaveReqView();
  else if (v==='view-workshop') renderWorkshopTable();
}
async function _reloadRemoteData() {
  if(ndSaving || ndSaveQueue.length || _lrHasPending())return false;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.main&select=payload`, {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY }
    });
    if (!res.ok) throw new Error('Refresh failed');
    const rows = await res.json();
    let remote = rows?.[0]?.payload;
    if (!remote || typeof remote!=='object' || !Object.keys(remote).length) return false;
    if(ndSaving || ndSaveQueue.length || _lrHasPending())return false;
    data = _migrateRemote(remote);
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return true; // 입력 중이면 화면 갱신만 보류(데이터는 갱신됨)
    _rerenderActiveView();
    if (typeof toast==='function') toast('🔄 최신 정보로 업데이트되었습니다.','info');
    return true;
  } catch(e) { return false; }
}
async function _checkRemoteUpdate() {
  if (document.hidden || ndSaving || ndSaveQueue.length || _lrHasPending()) return;   // 저장 중에는 로컬 편집 보존
  try {
    const res = await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.main&select=updated_at`, {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY }
    });
    if (!res.ok) return;
    const rows = await res.json();
    const ua = rows?.[0]?.updated_at;
    if (!ua) return;
    if (_ndUpdatedAt === null) { _ndUpdatedAt = ua; return; }
    if (ua !== _ndUpdatedAt) { _ndUpdatedAt = ua; await _reloadRemoteData(); }
  } catch(e) {}
}
function _startAutoSync() {
  if (_autoSyncTimer) clearInterval(_autoSyncTimer);
  _autoSyncTimer = setInterval(() => { if (!document.hidden) _checkRemoteUpdate(); }, _AUTO_SYNC_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) _checkRemoteUpdate(); }); // 탭 복귀 즉시 1회
}

// ===== INIT =====
// 근무표 등 날짜형 데이터가 전부 비었으면 '기본/빈' 상태로 간주(실수로 원격을 덮어쓰는 사고 방지용)
function _looksEmptyData(d){
  if(!d) return true;
  const e=o=>!o||Object.keys(o).length===0;
  return e(d.schedule)&&e(d.events)&&e(d.leaves)&&e(d.holidays)&&e(d.newLeaves);
}
(async () => {
  let _remoteLoadOk = false;   // 원격 fetch가 성공적으로 끝났는지(빈 응답 포함). 실패 시엔 절대 저장하지 않음.
  try {
    const res = await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.main&select=payload,updated_at`, {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY }
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const rows = await res.json();
    _remoteLoadOk = true;
    _ndUpdatedAt = rows?.[0]?.updated_at || null;
    const remote = rows?.[0]?.payload;
    if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
      data = _migrateRemote(remote);
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      _localBackup(data);   // 정상 로드 시 당일 백업 확보
    } else if (Object.keys(data).length > 0 && !_looksEmptyData(data)) {
      // Supabase가 비어있고 + 로컬에 실제 데이터가 있을 때만 올림 (빈/기본 데이터로 원격을 덮어쓰지 않음)
      saveData(data);
    }
  } catch(e) {
    _remoteLoadOk = false;
    console.warn('Supabase 로딩 실패, 로컬 데이터 사용(저장은 보류):', e);
  }
  // 3모드 비번 1회 초기화: 관리자/관리자테스트/마스터 모두 '0000'으로 통일 (이후 마스터가 각각 변경 가능)
  // ⚠️ 원격 로드가 실패했거나(=원격 상태 모름) 데이터가 빈/기본이면 저장하지 않는다.
  //    (로드 실패 시 기본 데이터를 saveData하면 원격 근무표가 통째로 날아갔던 사고 재발 방지)
  if (!data._pwModeInit) {
    data.adminPass = data.adminPass || btoa('0000');
    data.masterPass = data.masterPass || btoa('0000');
    data.adminTestPass = data.adminTestPass || btoa('0000');
    if (_remoteLoadOk && !_looksEmptyData(data)) {
      data._pwModeInit = true;
      saveData(data);
    }
  }
  _updateUserHeader();
  _applyThemeUI();   // 토글 아이콘을 저장된 테마와 동기화
  // 관리자 모드 세션 복원(새로고침해도 유지 — 탭 닫으면 해제)
  try{ var _am=sessionStorage.getItem('nd_admin'); if(_am==='admin'||_am==='master'||_am==='test'){ _enterAdmin(_am); } }catch(e){}
  await employeeRestore();
  renderHome();
  if (currentUser) { var _vh0=document.getElementById('view-home'); if(_vh0){ _vh0.classList.remove('home-anim'); void _vh0.offsetWidth; _vh0.classList.add('home-anim'); setTimeout(function(){ _vh0.classList.remove('home-anim'); }, 1200); } }
  _startAutoSync();
})();

