/* [모듈] js/nav-admin.js — 탭 전환(showView)·관리자/마스터 로그인 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== NAV =====
function showView(v) {
  const _prevView = currentView;   // 슬라이드 방향 판단용
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active','nd-slide-r','nd-slide-l'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  const _tv = document.getElementById('view-'+v);
  _tv.classList.add('active');
  // 탭 순서: 홈(1) 근무표(2) 달력(3) 휴가(4) 작성소(5) — 오른쪽 탭이면 오른쪽에서, 왼쪽 탭이면 왼쪽에서 슬라이드
  const _ord = {home:1,table:2,month:3,project:4,leavereq:5,workshop:6,admin:7};
  if (_ord[v] && _ord[_prevView] && v!==_prevView) {
    _tv.classList.add(_ord[v] > _ord[_prevView] ? 'nd-slide-r' : 'nd-slide-l');
  }
  const labels = {home:'홈',table:'근무표',month:'달력',leavereq:'휴가신청',workshop:'근무표 작성소',admin:'관리자'};
  document.querySelectorAll('.nav-btn').forEach(el => {
    if (el.textContent.trim() === (labels[v]||v)) el.classList.add('active');
  });
  document.querySelectorAll('.fnav-btn').forEach(el => el.classList.toggle('active', el.getAttribute('data-view')===v));
  document.querySelectorAll('.snav-btn').forEach(el => el.classList.toggle('active', el.getAttribute('data-view')===v));
  currentView = v;
  if (v==='home'){ renderHome(); const _lov=document.getElementById('login-overlay'); const _login=(_lov && getComputedStyle(_lov).display!=='none') || _tv.classList.contains('home-enter'); if(!_login){ _tv.classList.remove('home-anim'); void _tv.offsetWidth; _tv.classList.add('home-anim'); setTimeout(function(){_tv.classList.remove('home-anim');},1200); } }
  else if (v==='table') renderTable();
  else if (v==='month') setCalMode('mine');
  else if (v==='project') renderProject();
  else if (v==='leavereq') renderLeaveReqView();
  else if (v==='workshop') { if(!isAdmin){showView('home');return;} renderWorkshop(); }
  else if (v==='admin') { if(!isAdmin){ showView('home'); return; } document.getElementById('login-area').style.display='none'; document.getElementById('admin-area').style.display='block'; renderAdminPanel(); }
}
function toggleAdmin() {
  if (currentView === 'admin') { showView('home'); document.getElementById('admin-toggle').classList.remove('active'); return; }
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-admin').classList.add('active');
  document.getElementById('admin-toggle').classList.add('active');
  currentView = 'admin';
  if (!isAdmin) {
    document.getElementById('login-area').style.display='block';
    document.getElementById('admin-area').style.display='none';
  } else { renderAdminPanel(); }
}
function adminLogout() {
  const standalone=!!currentUser?.adminRole;
  employeeClearAdmin();
  isAdmin = false; isMaster = false; isAdminTest = false;
  try{ sessionStorage.removeItem('nd_admin'); }catch(e){}
  _setAdminNav(false);
  document.getElementById('login-area').style.display='block';
  document.getElementById('admin-area').style.display='none';
  ['pw-admin','pw-test','pw-master'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  if(standalone)employeeCancel();
}

// ===== LOGIN ===== (모드별 명시 로그인: 관리자/관리자테스트 박스 + 마스터 하단 투명버튼)
function doLoginMode(mode) {
  const inMap = { admin:'pw-admin', test:'pw-test', master:'pw-master' };
  const errMap = { admin:'login-err-admin', test:'login-err-test', master:'login-err-master' };
  const passMap = { admin:data.adminPass, test:data.adminTestPass, master:(data.masterPass||data.adminPass) };
  const inEl = document.getElementById(inMap[mode]);
  const errEl = document.getElementById(errMap[mode]);
  if (errEl) errEl.textContent='';
  if (mode==='test' && !data.adminTestPass) { if(errEl) errEl.textContent='관리자 테스트가 비활성화돼 있습니다.'; return; }
  if (btoa(inEl.value) === passMap[mode]) {
    employeeAdminCredential(mode,inEl.value);
    if (mode==='master') closeMasterLogin();
    // 관리자 화면으로 전환 후 입장
    document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
    document.getElementById('view-admin').classList.add('active');
    document.getElementById('admin-toggle')?.classList.add('active');
    currentView='admin';
    inEl.value='';
    _enterAdmin(mode);
  } else {
    if (errEl) errEl.textContent='비밀번호가 틀렸습니다.';
  }
}
function _enterAdmin(mode) {
  isAdmin = true;
  try{ sessionStorage.setItem('nd_admin', mode); }catch(e){}
  isMaster = (mode === 'master');
  isAdminTest = (mode === 'test');
  _setAdminNav(true);
  document.getElementById('login-area').style.display='none';
  document.getElementById('admin-area').style.display='block';
  renderAdminPanel();
  if (mode === 'master') showAdminTab('settings');
  _updateAdminModeUI();
}
function toggleMasterBox() {
  const box=document.getElementById('master-login-box'); if(!box) return;
  const show = box.style.display==='none';
  box.style.display = show ? '' : 'none';
  if (show) {
    const e=document.getElementById('login-err-master'); if(e) e.textContent='';
    const i=document.getElementById('pw-master'); if(i){ i.value=''; setTimeout(()=>{ try{i.focus();}catch(_){} },100); }
  }
}
function openMasterLogin() { const b=document.getElementById('master-login-box'); if(b) b.style.display=''; }
function closeMasterLogin() { const b=document.getElementById('master-login-box'); if(b) b.style.display='none'; }
function _updateAdminModeUI() {
  const bar = document.getElementById('admin-mode-bar');
  if (bar) bar.innerHTML = (isAdminTest ? '👁 관리자 테스트 모드 — 읽기 전용(수정 저장 안 됨)' : isMaster ? '👑 마스터 모드' : '🔐 관리자 모드') + ' <button onclick="adminLogout()">로그아웃</button>';
  const ab = document.getElementById('admin-pw-box'); if (ab) ab.style.display = (isAdmin && !isMaster && !isAdminTest) ? '' : 'none';
  const mb = document.getElementById('master-pw-box'); if (mb) mb.style.display = isMaster ? '' : 'none';
  const lt = document.getElementById('tab-loginlog'); if (lt) lt.style.display = isMaster ? '' : 'none';  // 로그인 기록 탭은 마스터만
}
function masterSetPw(which) {
  if (!isMaster) { toast('마스터 모드에서만 변경할 수 있습니다.','error'); return; }
  const map = { admin:'master-pw-admin', test:'master-pw-test', master:'master-pw-master' };
  const el = document.getElementById(map[which]); const v = (el.value||'').trim();
  if (which !== 'test' && v.length < 4) { toast('4자 이상 입력하세요.','error'); return; }   // 테스트는 빈값=비활성 허용
  if (which === 'admin') data.adminPass = btoa(v);
  else if (which === 'test') data.adminTestPass = v ? btoa(v) : '';
  else if (which === 'master') data.masterPass = btoa(v);
  saveData(data); el.value='';
  toast((which==='admin'?'관리자':which==='test'?(v?'관리자 테스트':'관리자 테스트 비활성화'):'마스터') + ' 비밀번호 ' + (which==='test'&&!v?'됨':'설정됨'),'success');
  if(document.getElementById('master-pw-reveal')?.dataset.shown==='1') revealMasterPws(), revealMasterPws();  // 보기 중이면 갱신
}
function revealMasterPws() {
  if (!isMaster) { toast('마스터 모드에서만 볼 수 있습니다.','error'); return; }
  const el = document.getElementById('master-pw-reveal');
  if (el.dataset.shown === '1') { el.dataset.shown='0'; el.style.display='none'; el.innerHTML=''; return; }
  const dec = v => { try { return v ? atob(v) : ''; } catch(e) { return '(읽기 오류)'; } };
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const admin = dec(data.adminPass), master = dec(data.masterPass || data.adminPass);
  const test = data.adminTestPass ? dec(data.adminTestPass) : '(비활성)';
  el.innerHTML = `<div style="font-size:13px;line-height:2;font-family:ui-monospace,monospace;">`+
    `🔐 관리자: <b style="color:var(--text);">${esc(admin)}</b><br>`+
    `👁 관리자 테스트: <b style="color:var(--text);">${esc(test)}</b><br>`+
    `👑 마스터: <b style="color:var(--text);">${esc(master)}</b></div>`+
    `<div style="font-size:11px;color:var(--muted);margin-top:6px;">※ 마스터만 볼 수 있습니다.</div>`;
  el.dataset.shown='1'; el.style.display='block';
}

