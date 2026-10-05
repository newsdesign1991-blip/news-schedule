/* [모듈] js/login-ui.js — 직원 로그인·상단 메뉴·바텀시트·헤더 스크롤 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 로그인 =====
const USER_KEY = 'nd_user';
let currentUser = localStorage.getItem(USER_KEY) || null; // {name, staffId}
try { if (currentUser) currentUser = JSON.parse(currentUser); } catch(e) { currentUser = null; }

function loginUser() { return employeeLogin(); }
function _startLoginSequence(name){
  window._homeAnimated=true;
  var ov=document.getElementById('login-overlay');
  if(ov){ ov.classList.add('leaving'); }
  _loginIntro(name);
}
function _loginIntro(name){
  var intro=document.getElementById('login-intro');
  var txtEl=document.getElementById('login-intro-text');
  if(!intro||!txtEl){ _homeReveal(); return; }
  var full=_givenName(name||'')+'님의 정보를 불러옵니다.';
  txtEl.innerHTML='';
  var chars=full.split('');
  chars.forEach(function(ch,i){ var sp=document.createElement('span'); sp.textContent=(ch===' ')?'\u00a0':ch; sp.style.animationDelay=(0.35+i*0.085).toFixed(3)+'s'; txtEl.appendChild(sp); });
  intro.style.display='flex'; intro.classList.remove('leaving'); void intro.offsetWidth; intro.classList.add('on');
  var typeEnd=0.35+chars.length*0.085+0.55, hold=0.75;
  setTimeout(function(){ intro.classList.add('leaving'); _homeReveal(); }, (typeEnd+hold)*1000);
  setTimeout(function(){ intro.style.display='none'; intro.classList.remove('on','leaving'); }, (typeEnd+hold+0.62)*1000);
}
function _homeReveal(){
  window.scrollTo(0,0);   // 로그인 후 홈 진입 시 항상 스크롤 최상단에서 시작
  var ovb=document.getElementById('login-overlay');
  if(ovb){ ovb.classList.add('bg-leaving'); setTimeout(function(){ ovb.style.display='none'; ovb.classList.remove('leaving','bg-leaving'); }, 680); }
  var vh=document.getElementById('view-home');
  if(vh){
    vh.classList.remove('home-anim','home-enter'); void vh.offsetWidth; vh.classList.add('home-enter');
    requestAnimationFrame(function(){ Array.prototype.forEach.call(vh.children, function(el){ el.addEventListener('animationend', function(){ try{ if(navigator.vibrate) navigator.vibrate(9); }catch(e){} }, {once:true}); }); });
    setTimeout(function(){ vh.classList.remove('home-enter'); }, 4500);
  }
  var h=document.querySelector('header'); if(h){ h.classList.remove('hdr-enter'); void h.offsetWidth; h.classList.add('hdr-enter'); setTimeout(function(){ h.classList.remove('hdr-enter'); }, 2200); }
}
function logoutUser() {
  if (!confirm(currentUser?.name + '님, 로그아웃 하시겠습니까?')) return;
  employeeApi('logout').catch(()=>{});
  employeeClearAdmin();
  adminLogout();
  document.getElementById('login-pin-input').value='';
  _recordLogout();   // 로그아웃 상태로 기록
  currentUser = null;
  localStorage.removeItem(USER_KEY);
  _updateUserHeader();
  if(typeof showView==='function') showView('home');
  document.getElementById('my-schedule-card').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-name-input').value = '';
}
function _givenName(n){ n=(n||'').trim(); var T=['제갈','남궁','황보','선우','사공','서문','독고','동방']; for(var i=0;i<T.length;i++){ if(n.length>=3 && n.indexOf(T[i])===0) return n.slice(2); } return n.length>1?n.slice(1):n; }
function _updateUserHeader() {
  const _hu = document.getElementById('hdr-user');
  if (_hu) _hu.innerHTML = (currentUser && currentUser.name)
    ? `<b>${currentUser.adminRole?currentUser.name:_givenName(currentUser.name)}</b><span class="hdr-nim">${currentUser.adminRole?"":"님"}</span>`
    : `<span class="hdr-team">뉴스디자인팀</span>`;
  const av = document.getElementById('hdr-menu-avatar');
  const mb = document.getElementById('hdr-menu-btn');
  if (!av || !mb) return;
  // 로그인 여부와 무관하게 항상 흰색 햄버거(☰) 버튼으로 표시
  av.textContent = '☰'; av.style.fontSize = '';
  mb.classList.remove('logged');
}
// ===== 상단 통합 메뉴 (컨텍스트 메뉴) =====
function toggleHdrMenu(e){
  if(e) e.stopPropagation();
  const m = document.getElementById('hdr-menu');
  if(m.style.display==='block'){ closeHdrMenu(); return; }
  const btn = (document.body.classList.contains('hdr-scrolled') ? document.getElementById('hdr-fab') : null) || document.getElementById('hdr-menu-btn');
  const r = btn.getBoundingClientRect();
  m.style.display='block';
  // 버튼 우측 정렬로 아래에 배치
  m.style.top = (r.bottom + 8) + 'px';
  m.style.right = (window.innerWidth - r.right) + 'px';
  m.style.left = 'auto';
  setTimeout(()=>document.addEventListener('click', _hdrMenuOutside), 0);
}
function _hdrMenuOutside(ev){
  const m=document.getElementById('hdr-menu');
  if(m && !m.contains(ev.target) && ev.target.id!=='hdr-menu-btn' && ev.target.id!=='hdr-menu-avatar' && ev.target.id!=='hdr-fab' && !(ev.target.closest&&ev.target.closest('#hdr-fab'))) closeHdrMenu();
}
function closeHdrMenu(){ const m=document.getElementById('hdr-menu'); if(m) m.style.display='none'; document.removeEventListener('click', _hdrMenuOutside); }

// ===== 바텀 시트(드로어) =====
function openSheet(title, html){
  closeHdrMenu();
  document.getElementById('sheet-title').textContent = title;
  document.getElementById('sheet-body').innerHTML = html;
  const ov = document.getElementById('sheet-overlay');
  ov.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>ov.classList.add('open')));
}
function closeSheet(){
  const ov = document.getElementById('sheet-overlay');
  ov.classList.remove('open');
  setTimeout(()=>{ ov.style.display='none'; }, 360);
}
// 계정 정보 시트
function openAccountSheet(){
  closeHdrMenu();
  if(!currentUser || !currentUser.staffId){
    openSheet('계정 정보', `<div style="text-align:center;padding:20px 0;color:var(--muted);font-size:14px;">이름으로 로그인하면 내 정보가 표시됩니다.</div>`);
    return;
  }
  const s = staffById(currentUser.staffId) || {};
  const DEPT_COLOR = {VW:'#5a7ec6',CG:'#4a9fbd',PROJECT:'#686dc8',SPORTS:'#8a6ecf',XR:'#4faa9c','조근':'#5a7ec6'};
  const col = DEPT_COLOR[s.dept] || '#6366f1';
  const initials = (currentUser.name||'').trim().slice(-2);
  // 내가 할 수 있는 임무 태그
  const tags = [];
  if(s.dept) tags.push({t:s.dept, c:col});
  if(s.employmentType==='freelancer'||s.employmentType==='프리랜서') tags.push({t:'프리랜서', c:'#c79a5e'});
  if(s.canVW) tags.push({t:'VW', c:'#5a7ec6'});
  if(s.canCG) tags.push({t:'CG', c:'#4a9fbd'});
  if(s.deskPriority>=1) tags.push({t:'데스크', c:'#527dc4'});
  if(s.morningDeskPriority) tags.push({t:'오데', c:'#527dc4'});
  if(s.canIlgeun) tags.push({t:'일근', c:'#45847a'});
  if(s.can3D) tags.push({t:'3D', c:'#8a6ecf'});
  if(s.canSatMorning) tags.push({t:'토요오전', c:'#5a7ec6'});
  const tagHtml = tags.length ? tags.map(x=>`<span style="font-size:12px;font-weight:700;padding:5px 12px;border-radius:14px;background:${x.c}18;color:${x.c};">${x.t}</span>`).join('') : '<span style="color:var(--muted);font-size:13px;">지정된 임무 없음</span>';
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0 18px;">
      <div style="width:78px;height:78px;border-radius:50%;background:linear-gradient(135deg,${col},${col}bb);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;box-shadow:0 6px 18px ${col}55;">${initials}</div>
      <div style="font-size:21px;font-weight:800;color:var(--text);margin-top:8px;">${currentUser.name}</div>
      <div style="font-size:14px;font-weight:600;color:${col};">${s.dept||''}${s.employmentType==='freelancer'?' · 프리랜서':''}</div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;">내가 할 수 있는 임무</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">${tagHtml}</div>
    </div>
    <button onclick="logoutUser();closeSheet();" style="width:100%;margin-top:22px;background:none;border:1px solid #f8a0a0;color:#d65a52;padding:12px;border-radius:12px;cursor:pointer;font-size:15px;font-weight:700;">로그아웃</button>`;
  openSheet('계정 정보', html);
}
// 알림 설정 시트 — 성격별 묶음: [근무] 근무 알림 · 8진/뉴오 진행 알림  [팀 소식] 공지 · 투표. 공지·투표는 기본 켜짐, 끄면 확인.
// news(8진·뉴오 진행)는 근무 알림에서 따로 뺀 항목 — 처음엔 근무 알림과 같은 상태로 시작(근무 알림 켜 둔 사람은 그대로 다 켜짐).
// 이 기기(localStorage)에 두고, 알림 켠 기기면 서버 구독 정보(push_subs.sub.prefs)에도 저장 → 서버(notify 함수)가 보고 거름
function getUserNotify(){
  var p; try{ p=JSON.parse(localStorage.getItem('nd_user_notify')||'{}'); }catch(e){ p={}; }
  var work=(p.work!==false && p.enabled!==false);
  return { work:work, news:(p.news===undefined ? work : p.news!==false), notice:(p.notice!==false), poll:(p.poll!==false) };
}
function setUserNotify(key, val){
  var p=getUserNotify(); p[key]=val;
  try{ localStorage.setItem('nd_user_notify', JSON.stringify({ work:p.work, news:p.news, notice:p.notice, poll:p.poll, enabled:p.work })); }catch(e){}
  if(typeof _pushSavePrefs==='function') Promise.resolve(_pushSavePrefs()).then(r=>{ if(r==='nosub'){ if(!window._nsNosubShown){ window._nsNosubShown=1; toast('이 기기의 알림 구독이 서버에 없어요. 아래에서 이 기기 알림을 껐다가 다시 켜 주세요.','error'); } } else if(r===false) toast('서버에 알림 설정을 저장하지 못했어요. 다음에 앱을 열 때 다시 저장돼요.','error'); });   // 'na'(이 기기 알림 꺼짐)·true는 조용히
}
function _nsToggle(id, el, ev){
  if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  var n=getUserNotify();
  var nv=!n[id];
  if(!nv && (id==='notice'||id==='poll')){
    if(!confirm('이 알림을 끄면 팀의 공지와 투표 소식을 받지 못할 수 있습니다.\n정말 끄시겠어요?')) return;
  }
  setUserNotify(id, nv);
  if(el){ el.classList.toggle('on', nv); el.setAttribute('aria-checked', String(nv)); }
  toast(nv?'알림 켜짐':'알림 꺼짐','success');
}
function openNotifySheet(){
  closeHdrMenu();
  const n=getUserNotify();
  const BELL='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  const IC={
    work:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    news:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17v4"/><path d="M10 9l4 2-4 2z" fill="currentColor"/></svg>',
    notice:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
    poll:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M6 20V11M12 20V5M18 20v-6"/></svg>'};
  const row=(id,label,sub,on)=>`<label class="ns-row"><span class="ns-ic">${IC[id]}</span><span class="ns-txt"><span class="ns-label">${label}</span><span class="ns-sub">${sub}</span></span><span class="nd-switch${on?' on':''}" role="switch" tabindex="0" aria-checked="${on}" aria-label="${label}" onclick="_nsToggle('${id}',this,event)" onkeydown="if(event.key===' '||event.key==='Enter'){_nsToggle('${id}',this,event)}"><span class="nd-switch-knob"></span></span></label>`;
  const html=`
    <div class="ns-sec-title" style="gap:5px;">${BELL} 푸시 알림</div>
    <div class="ns-group ns-g-work">
      <div class="ns-g-title">근무</div>
      <div class="ns-card">
        ${row('work','근무 알림','매일 내 근무(당직·조근·일근 등) 안내', n.work)}
        ${row('news','8진·뉴오 진행 알림','8진·뉴스오 근무 날 진행 시각 안내', n.news)}
      </div>
    </div>
    <div class="ns-group ns-g-team">
      <div class="ns-g-title">팀 소식</div>
      <div class="ns-card">
        ${row('notice','오늘의 공지 알림','새 공지·휴가 신청 안내', n.notice)}
        ${row('poll','오늘의 투표 알림','새 투표가 올라오면', n.poll)}
      </div>
    </div>
    <div id="us-push-status" class="ns-status"></div>
    <button id="us-push-toggle-btn" onclick="togglePush()" class="ns-btn"></button>
    <button id="us-push-test-btn" onclick="sendTestPush()" class="ns-btn ns-btn-primary">${BELL} 테스트 알림 보내기</button>`;
  openSheet('알림 설정', html);
  _refreshUserSettingsModal();
}
// 모바일: 아래로 스크롤하면 헤더(로고+메뉴버튼) 숨김, 위로 스크롤하면 표시
let _lastScrollY = 0;
function _onHeaderScroll(){
  const hdr = document.querySelector('header'); if(!hdr) return;
  const _fade = document.getElementById('hdr-fade'); if (_fade) _fade.classList.remove('on');
  if (window.innerWidth > 760) { hdr.style.opacity=''; hdr.style.filter=''; hdr.style.pointerEvents=''; document.body.classList.remove('hdr-scrolled'); _lastScrollY=window.scrollY||0; return; }
  const y = window.scrollY || document.documentElement.scrollTop || 0;
  const t = Math.max(0, Math.min(1, y/60));                       // 0~60px 스크롤 동안 서서히
  hdr.style.opacity = String(1 - t);
  hdr.style.filter = ''; // Keep header text sharp during scroll, including iOS overscroll.
  hdr.style.pointerEvents = t>0.6 ? 'none' : '';
  document.body.classList.toggle('hdr-scrolled', y > 44);   // 헤더 거의 사라지면 플로팅 등장
  _lastScrollY = y;
}
window.addEventListener('scroll', _onHeaderScroll, { passive:true });

