/* [모듈] js/a2hs.js — 홈 화면에 추가 안내 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 홈 화면에 추가(A2HS) 안내 =====
// PWA 설치 조건: 서비스워커가 로드 시 등록돼 있어야 함(설치 안 하면 주소창 남는 바로가기로 추가됨)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
let _deferredInstall=null;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); _deferredInstall=e; });
window.addEventListener('appinstalled', ()=>{ const b=document.getElementById('a2hs-banner'); if(b) b.style.display='none'; });
function _isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true; }
function _initA2HS(){
  const banner=document.getElementById('a2hs-banner'); if(!banner) return;
  if(_isStandalone()) return;                            // 이미 홈화면 앱으로 실행 중
  if(localStorage.getItem('nd_a2hs_off')==='1') return;  // '다시 안 보기'
  const ua=navigator.userAgent;
  const isIOS=/iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);  // iPadOS13+ 포함
  const isAndroid=/Android/.test(ua);
  if(!isIOS && !isAndroid) return;                       // 모바일 브라우저에서만 노출
  const isSamsung=/SamsungBrowser/.test(ua);             // 삼성 인터넷 (PWA/푸시 지원 끊김)
  const guide=document.getElementById('a2hs-guide');
  const actions=document.getElementById('a2hs-actions');
  if(isIOS){
    guide.innerHTML='아이폰·아이패드는 <b style="color:#d65a52;">홈 화면에 추가해야 알림</b>을 받을 수 있어요.<br><br>① <b>Safari(사파리)</b>에서 열기<br>② 하단 <b>공유</b> 버튼 <span style="display:inline-block;border:1px solid var(--border);border-radius:4px;padding:0 4px;font-size:11px;">⬆</span> 누르기<br>③ <b>"홈 화면에 추가"</b> 선택';
    actions.innerHTML='<button class="btn btn-sm btn-outline" style="width:100%;" onclick="dismissA2HS(true)">다시 안 보기</button>';
  } else if(isSamsung){
    guide.innerHTML='안드로이드는 <b style="color:#d65a52;">반드시 크롬(Chrome)으로 열어야</b> 알림을 받을 수 있어요.<br><span style="color:#d65a52;">삼성 인터넷은 홈 화면 추가·푸시 알림이 지원되지 않습니다.</span><br><br>① 이 주소를 복사해 <b>크롬(Chrome)</b>으로 다시 열기<br>② 크롬 메뉴 <b>⋮</b> → <b>"앱 설치"</b>(또는 "홈 화면에 추가")';
    actions.innerHTML='<button class="btn btn-primary btn-sm" style="width:100%;" onclick="_copyAppUrl()">🔗 주소 복사하기</button><button class="btn btn-sm btn-outline" style="width:100%;" onclick="dismissA2HS(true)">다시 안 보기</button>';
  } else if(_deferredInstall){
    guide.innerHTML='안드로이드는 <b style="color:#d65a52;">크롬(Chrome)에서 홈 화면 추가 → 설치</b>해야 알림을 받을 수 있어요.<br><br>① <b>크롬(Chrome)</b>으로 실행<br>② <b>홈 화면에 추가</b> (아래 버튼)<br>③ <b>설치</b><br><span style="color:var(--muted);font-size:12px;">※ 삼성 인터넷 등은 알림 미지원</span>';
    actions.innerHTML='<button class="btn btn-primary btn-sm" style="width:100%;" onclick="installA2HS()">📲 홈 화면에 추가</button><button class="btn btn-sm btn-outline" style="width:100%;" onclick="dismissA2HS(true)">다시 안 보기</button>';
  } else {
    guide.innerHTML='안드로이드는 <b style="color:#d65a52;">크롬(Chrome)에서 홈 화면 추가 → 설치</b>해야 알림을 받을 수 있어요.<br><br>① <b>크롬(Chrome)</b>으로 실행<br>② 크롬 메뉴 <b>⋮</b> → <b>"홈 화면에 추가"</b><br>③ <b>설치</b> 선택<br><span style="color:var(--muted);font-size:12px;">※ 삼성 인터넷 등 다른 브라우저는 알림 미지원</span>';
    actions.innerHTML='<button class="btn btn-sm btn-outline" style="width:100%;" onclick="dismissA2HS(true)">다시 안 보기</button>';
  }
  banner.style.display='flex';
}
function _copyAppUrl(){
  const url=location.href;
  const done=()=>toast('주소를 복사했어요. 크롬(Chrome)에 붙여넣어 여세요.','success');
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done).catch(()=>done()); }
  else { const t=document.createElement('textarea'); t.value=url; document.body.appendChild(t); t.select(); try{document.execCommand('copy');}catch(e){} t.remove(); done(); }
}
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
    <!-- 넓은 화면(≥1001px, css/popup-wide.css): 왼쪽 기본 정보·계약·파견·수습 / 오른쪽 근무 속성·부서 이동 예약 + 버튼. 모바일은 sm-col이 display:contents라 원래 순서 그대로 -->
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
    <div id="modal-contract-group" style="display:none;margin-top:10px;">
      <label class="form-label" style="margin-bottom:4px;">계약기간 (직원B)</label>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="date" class="form-input" id="modal-contract-start" style="width:140px;">
        <span style="color:var(--muted);font-size:12px;">~</span>
        <input type="date" class="form-input" id="modal-contract-end" style="width:140px;">
      </div>
    </div>
    <div id="modal-dispatch-group" style="display:none;margin-top:10px;">
      <label class="form-label" style="margin-bottom:4px;">파견기간 (직원A)</label>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="date" class="form-input" id="modal-dispatch-start" style="width:140px;">
        <span style="color:var(--muted);font-size:12px;">~</span>
        <input type="date" class="form-input" id="modal-dispatch-end" style="width:140px;">
        <button class="btn btn-sm btn-outline" style="font-size:10px;padding:3px 8px;" onclick="document.getElementById('modal-dispatch-start').value='';document.getElementById('modal-dispatch-end').value='';">초기화</button>
      </div>
    </div>
    <div id="modal-probation-group" style="margin-top:10px;">
      <label class="form-label" style="margin-bottom:4px;">수습기간 <span style="font-weight:500;color:var(--muted);font-size:11px;">(주말·휴일 근무·인원 카운트 제외)</span></label>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="date" class="form-input" id="modal-probation-start" style="width:140px;">
        <span style="color:var(--muted);font-size:12px;">~</span>
        <input type="date" class="form-input" id="modal-probation-end" style="width:140px;">
        <button class="btn btn-sm btn-outline" style="font-size:10px;padding:3px 8px;" onclick="document.getElementById('modal-probation-start').value='';document.getElementById('modal-probation-end').value='';">초기화</button>
      </div>
    </div>
    </div>
    <div class="sm-col sm-col-r">
    <div class="sm-s-tags" style="margin-top:10px;">
      <label class="form-label" style="margin-bottom:4px;">근무 속성</label>
      <div class="tag-sel-pool" id="modal-staff-tag-pool"></div>
    </div>
    <div class="sm-s-dsched" style="margin-top:14px;background:rgba(49,130,246,.06);border:1px solid rgba(49,130,246,.14);border-radius:12px;padding:14px 15px;">
      <label class="form-label" style="margin-bottom:6px;">부서 이동 예약 <span style="font-weight:500;color:var(--muted);font-size:11px;">(그 날짜부터 부서 변경 · 과거 달은 원래 부서 유지)</span></label>
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

