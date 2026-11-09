/* [모듈] js/sync-init.js — 자동 동기화·앱 시작(INIT) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 자동 동기화 (절약형: updated_at만 폴링 → 변경됐을 때만 전체 1회 로드) =====
let _autoSyncTimer = null;
let _bootRemoteOk = false;   // 부팅 때 원격 데이터를 받았는지 — 못 받았으면 첫 동기화 확인에서 바로 다시 받음
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
  if (remote.staff) _deptApplyDue(remote);   // 부서 이동 예약 날짜가 된 사람은 지금 부서도(10-27)
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
  else if (v==='view-cgassign' && typeof _cgaPaint==='function') _cgaPaint();   // CG배정 현황: 근무표가 바뀌면 인원 다시 셈
}
// targetUa(서버 수정시각)를 알면 이 기기 서버 사본(_ndSrv) → PC 앱은 회사 공유 폴더 사본에서 먼저 찾음(같은 판이면 서버에서 안 받음, data-save.js)
async function _reloadRemoteData(targetUa) {
  if(ndSaving || ndSaveQueue.length || _lrHasPending())return false;
  if (typeof _ndGenBusy!=='undefined' && _ndGenBusy) return false;   // 근무 자동 생성 중(js/generation.js)엔 data를 바꾸지 않음 — 바꾸면 남은 생성 결과가 떨어져 나간 옛 객체에 들어가 저장에서 빠짐
  try {
    let remote = null, ua = null, fromShare = false;
    if (typeof targetUa === 'string' && targetUa && targetUa === _ndSrv.ua && _ndSrv.json) { remote = JSON.parse(_ndSrv.json); ua = targetUa; fromShare = true; }   // 이 기기 서버 사본(병합 저장 직후 등)
    else if (typeof targetUa === 'string' && targetUa) { remote = await _ndShareCopy(targetUa); if (remote) { ua = targetUa; fromShare = true; } }
    if (!remote) {
      const res = await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.main&select=payload,updated_at`, {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY }
      });
      if (!res.ok) throw new Error('Refresh failed');
      const rows = await res.json();
      remote = rows?.[0]?.payload; ua = rows?.[0]?.updated_at || null;
    }
    if (!remote || typeof remote!=='object' || !Object.keys(remote).length) return false;
    if(ndSaving || ndSaveQueue.length || _lrHasPending())return false;
    if (typeof _ndGenBusy!=='undefined' && _ndGenBusy) return false;
    const _prevDraft = data.draft, _prevTabs = data.draftTabs;
    data = _migrateRemote(remote);
    if (typeof _wsAttach==='function') _wsAttach(_prevDraft, _prevTabs);   // 작성소 초안은 공용 네트워크 드라이브 것 그대로(js/workshop.js, 11-09)
    if (ua) _ndUpdatedAt = ua;   // 받은 판의 수정시각 — 받기에 성공했을 때만 맞춤(_checkRemoteUpdate가 미리 넣지 않음)
    if (typeof _wsHistoryOnRemote==='function') _wsHistoryOnRemote(_prevDraft);
    _ndStoreServerCopy(ua, fromShare);   // 기기에 저장(공간이 차도 받은 데이터는 씀) + '서버본 그대로' 표시 + PC는 공유 폴더 사본도
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return true; // 입력 중이면 화면 갱신만 보류(데이터는 갱신됨)
    _rerenderActiveView();
    if (typeof toast==='function') toast('🔄 최신 정보로 업데이트되었습니다.','info');
    return true;
  } catch(e) { return false; }
}
async function _checkRemoteUpdate() {
  if (document.hidden || ndSaving || ndSaveQueue.length || _lrHasPending()) return;   // 저장 중에는 로컬 편집 보존
  if (typeof _ndGenBusy!=='undefined' && _ndGenBusy) return;   // 자동 생성 중이면 끝난 뒤 다음 확인에서
  try {
    const res = await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.main&select=updated_at`, {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY }
    });
    if (!res.ok) return;
    const rows = await res.json();
    const ua = rows?.[0]?.updated_at;
    if (!ua) return;
    // 수정시각은 전체 받기에 성공했을 때 _reloadRemoteData가 맞춤 — 먼저 넣으면 받기 실패 뒤 서버가 또 바뀔 때까지 옛 판에 머묾
    if (_ndUpdatedAt === null) { if (_bootRemoteOk) _ndUpdatedAt = ua; else await _reloadRemoteData(); return; }
    if (ua !== _ndUpdatedAt) await _reloadRemoteData(ua);
  } catch(e) {}
}
// 11-08(Supabase 무료 전송량 초과로 막힌 뒤): 누가 저장할 때마다 켜져 있는 모든 화면이 근무표 전체(약 640KB)를 다시 받았음 —
// PC 앱처럼 하루 종일 켜 둔 화면이 많아서. 10분 넘게 마우스·키보드·터치가 없으면 15분마다만 확인하고, 다시 손대면(마우스만 움직여도) 바로 확인
let _syncTouched = Date.now(), _syncCheckedAt = 0;
const _syncIdle = () => Date.now() - _syncTouched > 10 * 60e3;
['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'].forEach(t => addEventListener(t, () => {
  const wake = _syncIdle(); _syncTouched = Date.now();
  if (wake && !document.hidden && _autoSyncTimer && Date.now() - _syncCheckedAt > 20e3) { _syncCheckedAt = Date.now(); _checkRemoteUpdate(); }
}, { capture: true, passive: true }));
function _startAutoSync() {
  if (_autoSyncTimer) clearInterval(_autoSyncTimer);
  _autoSyncTimer = setInterval(() => {
    if (document.hidden || (_syncIdle() && Date.now() - _syncCheckedAt < 15 * 60e3)) return;
    _syncCheckedAt = Date.now(); _checkRemoteUpdate();
  }, _AUTO_SYNC_MS);
  if (!window._deptDueTimer) window._deptDueTimer = setInterval(() => { if (_deptApplyDue(data)) _rerenderActiveView(); }, 60000);   // 켜 둔 채 날이 바뀌어 부서 이동 날짜가 되면(10-27)
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
    const _bm = window.__ndBootMain; window.__ndBootMain = null;   // dashboard.html <head>에서 미리 시작한 요청(없으면 지금 요청)
    // head 가 고른 받기 방식(11-08 전송량 절약): 'full' 전체 | 'since' 기기 저장본(nd_v3)이 서버본 그대로면 바뀌었을 때만 | 'ua' PC 앱 — 수정시각만(내용은 기기 저장본·공유 폴더 사본)
    const _bk = (_bm && window.__ndBoot) || {}; window.__ndBoot = null;
    const _get = () => fetch(`${SB_URL}/rest/v1/nd_data?id=eq.main&select=payload,updated_at`, {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY }
    });
    let kind = _bk.kind || 'full', res;
    try { res = await (_bm || _get()); } catch(e) { if (!_bm) throw e; kind = 'full'; res = await _get(); }   // 미리 요청이 연결 오류면 한 번 더
    if (!res.ok) throw new Error('HTTP '+res.status);
    let rows = await res.json();
    const _full = async () => { const r = await _get(); if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); };
    // 기기 저장본이 수정시각 ua 의 서버본 그대로인지(head 뒤에 바뀌었으면 안 씀) → 그 글
    const _same = (ua) => { const c = _bk.clean; if (!c || !ua || c.ua !== ua) return null; try { const t = localStorage.getItem(STORE_KEY); return t && ndTextHash(t) === c.h ? t : null; } catch(e) { return null; } };
    let local = null, fromShare = false;
    if (kind === 'since' && Array.isArray(rows) && !rows.length) {   // 서버가 그대로라 내용이 안 옴(빈 목록 ≠ 서버가 빔 — 아래 '서버가 비면 올림'으로 가지 않게)
      local = _same(_bk.clean && _bk.clean.ua);
      if (!local) rows = await _full();
    } else if (kind === 'ua' && Array.isArray(rows) && rows.length) {   // PC 앱: 기기 저장본 → 공유 폴더 사본 → 서버 전체
      const ua = rows[0].updated_at;
      local = _same(ua);
      if (!local) {
        const sp = ua ? await _ndShareCopy(ua) : null;
        if (sp) { rows = [{ payload: sp, updated_at: ua }]; fromShare = true; } else rows = await _full();
      }
    }
    _remoteLoadOk = true; _bootRemoteOk = true;
    if (local) {   // 서버본 그대로 → 받지 않고 기기 저장본
      data = _migrateRemote(JSON.parse(local));
      if (typeof _wsAttach==='function') _wsAttach(null, null);
      try { _ndSrvHash = ndTextHash(local); } catch(e) {}
      _ndUpdatedAt = _bk.clean.ua;
      _ndSrvSet(_bk.clean.ua, local, true);
      _localBackup(data);
    } else {
    _ndUpdatedAt = rows?.[0]?.updated_at || null;
    const remote = rows?.[0]?.payload;
    if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
      data = _migrateRemote(remote);
      if (typeof _wsAttach==='function') _wsAttach(null, null);   // 아직 안 옮긴 서버 초안은 옮길 원본으로 기억, 옮긴 뒤면 서버에 남은 옛 초안 무시
      _ndStoreServerCopy(_ndUpdatedAt, fromShare);   // 기기에 저장(공간이 차도 로드 성공으로 봄) + '서버본 그대로' 표시 + PC는 공유 폴더 사본도
      _localBackup(data);   // 정상 로드 시 당일 백업 확보
    } else if (Object.keys(data).length > 0 && !_looksEmptyData(data)) {
      // Supabase가 비어있고 + 로컬에 실제 데이터가 있을 때만 올림 (빈/기본 데이터로 원격을 덮어쓰지 않음)
      saveData(data);
    }
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
  setTimeout(()=>{ if (typeof ndLoadLib==='function') ndLoadLib('h2c').catch(()=>{}); }, 4000);   // 이미지 저장 라이브러리는 앱이 뜬 뒤 미리 받아 둠
})();

