/* [모듈] js/a2hs.js — 홈 화면에 추가 안내 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 홈 화면에 추가(A2HS) 안내 =====
// PWA 설치 조건: 서비스워커가 로드 시 등록돼 있어야 함(설치 안 하면 주소창 남는 바로가기로 추가됨)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
let _deferredInstall=null;
// 늦게 와도(삼성 인터넷은 몇 초 뒤) 떠 있는 안내에 [앱으로 설치] 버튼을 붙임 — js/onboard.js _gdQuick 도 같이
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); _deferredInstall=e; const b=document.getElementById('a2hs-banner'); if(b&&b.style.display==='flex') _a2hsFill(); if(typeof _gdQuick==='function') _gdQuick(); });
window.addEventListener('appinstalled', ()=>{ const b=document.getElementById('a2hs-banner'); if(b) b.style.display='none'; });
function _isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true; }
function _a2hsKind(){
  const ua=navigator.userAgent;
  if(/iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)) return 'ios';   // iPadOS13+ 포함
  if(/Android/.test(ua)) return /SamsungBrowser/.test(ua)?'samsung':'android';   // 삼성 인터넷도 앱 설치·푸시 됨(주소창 설치 아이콘). 메뉴 '현재 페이지 추가 → 홈 화면'은 바로가기라 안내에서 빼라고 함
  return '';
}
function _initA2HS(){
  const banner=document.getElementById('a2hs-banner'); if(!banner) return;
  if(_isStandalone()) return;                            // 이미 홈화면 앱으로 실행 중
  if(localStorage.getItem('nd_a2hs_off')==='1') return;  // '다시 안 보기'
  if(!_a2hsKind()) return;                               // 모바일 브라우저에서만 노출
  _a2hsFill();
  banner.style.display='flex';
}
// 짧은 안내 + [설치 방법 자세히 보기] → js/onboard.js ndAppGuide(버튼 모양 그림까지)
function _a2hsFill(){
  const k=_a2hsKind(), guide=document.getElementById('a2hs-guide'), actions=document.getElementById('a2hs-actions'), title=document.getElementById('a2hs-title');
  if(!guide||!actions) return;
  const key=t=>'<span style="display:inline-block;border:1px solid var(--border);border-radius:6px;padding:0 6px;font-size:12px;font-weight:800;line-height:1.6;">'+t+'</span>';
  const note=t=>'<br><span style="color:var(--muted);font-size:12px;">'+t+'</span>';
  if(title) title.innerHTML=k==='ios'?'홈 화면에 추가하고<br>근무 알림 받기':'앱으로 설치하고<br>근무 알림 받기';
  if(k==='ios'){
    guide.innerHTML='아이폰·아이패드는 <b style="color:#d65a52;">홈 화면에 추가해야 알림</b>을 받을 수 있어요.<br><br>① <b>사파리</b> 아래 주소창 안 왼쪽 '+key('≡')+' 누르기<br>② '+key('공유')+' → 뜬 창을 위로 쓸어올려 '+key('홈 화면에 추가')+'<br>③ <b>웹 앱으로 열기</b> 켜고 오른쪽 위 <b>추가</b>'+note('※ 맨 아래에 버튼 줄이 있는 아이폰은 가운데 공유 버튼부터');
  } else if(k==='samsung'){
    guide.innerHTML='갤럭시는 <b>삼성 인터넷</b>에서 바로 <b style="color:#d65a52;">앱으로 설치</b>할 수 있어요.<br><br>① 주소창 오른쪽, 새로고침 옆 '+key('설치')+' 아이콘<br>② 뜨는 창에서 <b>설치</b><br>③ 새로 생긴 <b>근무표</b>로 열고 알림 켜기'+note('※ ≡ 메뉴 → 현재 페이지 추가 → 홈 화면은 바로가기라 안 돼요');
  } else {
    guide.innerHTML='안드로이드는 <b style="color:#d65a52;">앱으로 설치</b>하면 알림을 받기 편해요.<br><br>① <b>크롬</b> 주소창 오른쪽 '+key('⋮')+' 메뉴<br>② '+key('앱 설치')+' 또는 <b>홈 화면에 추가</b><br>③ <b>설치</b> (바로가기 만들기 말고)'+note('※ 갤럭시는 삼성 인터넷으로 열어도 돼요');
  }
  actions.innerHTML=(_deferredInstall&&k!=='ios'?'<button class="btn btn-primary btn-sm" style="width:100%;" onclick="installA2HS()">이 폰에 앱으로 설치</button>':'')
    +'<button class="btn btn-sm '+(_deferredInstall&&k!=='ios'?'btn-outline':'btn-primary')+'" style="width:100%;" onclick="_a2hsMore()">설치 방법 자세히 보기</button>'
    +'<button class="btn btn-sm btn-outline" style="width:100%;" onclick="dismissA2HS(true)">다시 안 보기</button>';
}
function _a2hsMore(){ dismissA2HS(false); if(typeof ndAppGuide==='function') ndAppGuide(); }
async function installA2HS(){
  if(!_deferredInstall){ dismissA2HS(false); return; }
  _deferredInstall.prompt();
  try{ await _deferredInstall.userChoice; }catch(e){}
  _deferredInstall=null;
  _animModalClose(document.getElementById('a2hs-banner'));
}
function dismissA2HS(permanent){
  if(permanent) localStorage.setItem('nd_a2hs_off','1');
  _animModalClose(document.getElementById('a2hs-banner'));
}
setTimeout(_initA2HS, 500);   // 로드 직후 로그인 화면 위로 안내 팝업 노출
document.body.insertAdjacentHTML('beforeend', `
<div class="staff-modal-overlay" id="staff-edit-modal">
  <div class="staff-modal">
    <div class="staff-modal-head">
      <div class="smh-title" id="staff-modal-title">직원</div>
      <button class="smh-close" onclick="closeStaffModal()">✕</button>
    </div>
    <div class="staff-modal-body">
    <input type="hidden" id="modal-edit-staff-id">
    <!-- 넓은 화면(≥1001px, css/popup-wide.css): 왼쪽 기본 정보·근무 속성·(접힘)계약·파견·수습·부서 이동 예약 / 오른쪽 WISE 휴가 내역(직원B만, 직원A는 한 칸 창) + 버튼. 모바일은 sm-col이 display:contents라 원래 순서 그대로 -->
    <div class="sm-col sm-col-l">
    <div class="form-row sm-s-basic">
      <div class="form-group">
        <label class="form-label">소속 부서</label>
        <select class="form-select" id="modal-staff-dept" onchange="updateStaffModalForm()">
          <option value="VW">VW</option>
          <option value="CG">CG</option>
          <option value="조근">조근</option>
          <option value="XR">XR</option>
          <option value="PROJECT">PROJECT</option>
          <option value="SPORTS">SPORTS</option>
          <option value="팀장">팀장 (근무표에 안 나옴 · 로그인만)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">구분</label>
        <select class="form-select" id="modal-staff-employment-type" onchange="updateStaffModalForm()">
          <option value="employee">직원A</option>
          <option value="freelancer">직원B</option>
        </select>
      </div>
      <div class="form-group" id="modal-desk-group">
        <label class="form-label">데스크 순위</label>
        <select class="form-select" id="modal-staff-desk-priority">
          <option value="">없음</option>
          <option value="1">1번 (주데스크)</option>
          <option value="2">2번 (대체1)</option>
          <option value="3">3번 (대체2)</option>
          <option value="4">4번 (대체3)</option>
          <option value="5">5번 (대체4)</option>
        </select>
      </div>
      <div class="form-group" id="modal-morning-desk-group" style="display:none;">
        <label class="form-label">오전데 순위</label>
        <select class="form-select" id="modal-staff-morning-desk-priority">
          <option value="">없음</option>
          <option value="1">1번</option>
          <option value="2">2번</option>
          <option value="3">3번</option>
        </select>
      </div>
    </div>
    <div class="sm-s-tags" style="margin-top:10px;">
      <label class="form-label" style="margin-bottom:4px;">근무 속성</label>
      <div class="tag-sel-pool" id="modal-staff-tag-pool"></div>
    </div>
    <details id="modal-contract-group" class="sm-fold" style="display:none;">
      <summary><span class="form-label">계약기간 (직원B)</span><em class="sm-fold-sum" data-sum="contract"></em></summary>
      <div class="sm-fold-body" style="display:flex;align-items:center;gap:8px;">
        <input type="date" class="form-input" id="modal-contract-start" style="width:140px;" oninput="_smFoldSummary()">
        <span style="color:var(--muted);font-size:12px;">~</span>
        <input type="date" class="form-input" id="modal-contract-end" style="width:140px;" oninput="_smFoldSummary()">
      </div>
    </details>
    <details id="modal-dispatch-group" class="sm-fold" style="display:none;">
      <summary><span class="form-label">파견기간 (직원A)</span><em class="sm-fold-sum" data-sum="dispatch"></em></summary>
      <div class="sm-fold-body" style="display:flex;align-items:center;gap:8px;">
        <input type="date" class="form-input" id="modal-dispatch-start" style="width:140px;" oninput="_smFoldSummary()">
        <span style="color:var(--muted);font-size:12px;">~</span>
        <input type="date" class="form-input" id="modal-dispatch-end" style="width:140px;" oninput="_smFoldSummary()">
        <button class="btn btn-sm btn-outline" style="font-size:10px;padding:3px 8px;" onclick="document.getElementById('modal-dispatch-start').value='';document.getElementById('modal-dispatch-end').value='';_smFoldSummary();">초기화</button>
      </div>
    </details>
    <details id="modal-probation-group" class="sm-fold">
      <summary><span class="form-label">수습기간 <span style="font-weight:500;color:var(--muted);font-size:11px;">(주말·휴일 근무·인원 카운트 제외)</span></span><em class="sm-fold-sum" data-sum="probation"></em></summary>
      <div class="sm-fold-body" style="display:flex;align-items:center;gap:8px;">
        <input type="date" class="form-input" id="modal-probation-start" style="width:140px;" oninput="_smFoldSummary()">
        <span style="color:var(--muted);font-size:12px;">~</span>
        <input type="date" class="form-input" id="modal-probation-end" style="width:140px;" oninput="_smFoldSummary()">
        <button class="btn btn-sm btn-outline" style="font-size:10px;padding:3px 8px;" onclick="document.getElementById('modal-probation-start').value='';document.getElementById('modal-probation-end').value='';_smFoldSummary();">초기화</button>
      </div>
    </details>
    <details class="sm-fold sm-s-dsched-fold">
      <summary><span class="form-label">부서 이동 예약 <span style="font-weight:500;color:var(--muted);font-size:11px;">(그 날짜부터 부서 변경 · 과거 달은 원래 부서 유지)</span></span><em class="sm-fold-sum" data-sum="dsched"></em></summary>
      <div class="sm-fold-body sm-s-dsched" style="background:rgba(49,130,246,.06);border:1px solid rgba(49,130,246,.14);border-radius:12px;padding:14px 15px;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <input type="date" class="form-input" id="modal-deptsched-date" style="width:150px;">
          <span style="color:var(--muted);font-size:12px;">부터</span>
          <select class="form-select" id="modal-deptsched-dept" style="width:auto;">
            <option value="VW">VW</option><option value="CG">CG</option><option value="조근">조근</option>
            <option value="XR">XR</option><option value="PROJECT">PROJECT</option><option value="SPORTS">SPORTS</option>
          </select>
          <button class="btn btn-sm" style="background:var(--accent);color:#fff;border:none;" onclick="_deptSchedAdd()">추가</button>
        </div>
        <div id="modal-deptsched-list"></div>
      </div>
    </details>
    </div>
    <div class="sm-col sm-col-r">
    <div id="modal-wise-group" class="sm-s-wise" style="display:none;">
      <label class="form-label" style="margin-bottom:6px;">WISE 휴가 내역</label>
      <div id="modal-wise-leave" class="wl-host"></div>
    </div>
    </div>
    </div>
    <div class="staff-modal-foot">
      <button class="btn btn-primary" style="width:auto;" onclick="saveStaffModal()">저장</button>
      <button class="btn btn-outline" onclick="closeStaffModal()">취소</button>
      <div class="smf-sp" style="flex:1;"></div>
      <button id="modal-active-btn" class="btn btn-outline" style="font-size:12px;" onclick="_modalToggleActive()">비활성화</button>
      <button class="btn btn-danger" style="font-size:12px;" onclick="_modalDeleteStaff()">삭제</button>
    </div>
    <div id="staff-del-confirm" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,.4);z-index:5;align-items:center;justify-content:center;">
      <div style="background:var(--surface);border-radius:14px;padding:20px 22px;width:280px;max-width:86%;text-align:center;box-shadow:0 10px 34px rgba(0,0,0,.3);">
        <div style="font-size:14.5px;font-weight:800;margin-bottom:6px;color:var(--text);"><span id="staff-del-name"></span> 삭제</div>
        <div style="font-size:12.5px;color:var(--muted);margin-bottom:16px;line-height:1.55;">정말 삭제하시겠습니까?<br>되돌릴 수 없습니다.</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" style="flex:1;" onclick="_hideDelConfirm()">취소</button>
          <button class="btn btn-danger" style="flex:1;" onclick="_confirmDeleteStaff()">삭제</button>
        </div>
      </div>
    </div>
  </div>
</div>`);

