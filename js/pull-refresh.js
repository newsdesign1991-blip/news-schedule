/* [모듈] js/pull-refresh.js — 당겨서 새로고침 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 풀-투-리프레시 =====
(function(){
  const THRESHOLD = 80; // 당기는 거리 (px)
  let startY = 0, pulling = false, dist = 0, refreshing = false;

  const indicator = document.createElement('div');
  indicator.id = 'ptr-indicator';
  indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;align-items:center;justify-content:center;height:0;overflow:hidden;background:var(--surface);transition:none;pointer-events:none;';
  indicator.innerHTML = '<div id="ptr-inner" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding-bottom:8px;"><svg id="ptr-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted);transition:transform 0.15s;"><path d="M12 5v14M5 12l7 7 7-7"/></svg><span id="ptr-label" style="font-size:11px;color:var(--muted);font-weight:600;"></span></div>';
  document.body.prepend(indicator);

  function setDist(d) {
    dist = Math.min(d, THRESHOLD * 1.5);
    const ratio = Math.min(dist / THRESHOLD, 1);
    indicator.style.height = dist + 'px';
    const arrow = document.getElementById('ptr-arrow');
    const label = document.getElementById('ptr-label');
    if (ratio >= 1) {
      arrow.style.transform = 'rotate(180deg)';
      arrow.style.color = '#6366f1';
      label.textContent = '놓으면 새로고침';
      label.style.color = '#6366f1';
    } else {
      arrow.style.transform = `rotate(0deg) scale(${0.6 + ratio * 0.4})`;
      arrow.style.color = 'var(--muted)';
      label.textContent = '당겨서 새로고침';
      label.style.color = 'var(--muted)';
    }
  }

  document.addEventListener('touchstart', e => {
    if (refreshing || window.scrollY > 0) return;
    // 모달/오버레이 위에서는 무시
    if (e.target.closest('.modal-overlay,.nd-modal,.staff-modal-overlay,#lr-popup-overlay,[style*="position:fixed"]')) { pulling=false; return; }
    startY = e.touches[0].clientY;
    pulling = true;
    indicator.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    if (window.scrollY > 0) { pulling = false; setDist(0); return; }
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) setDist(dy * 0.5); // 저항감
  }, { passive: true });

  document.addEventListener('touchcancel', () => { pulling=false; if(!refreshing)setDist(0); }, {passive:true});
  document.addEventListener('touchend', async () => {
    if (!pulling || refreshing) return;
    pulling = false;
    indicator.style.transition = 'height 0.25s ease';
    if (dist >= THRESHOLD) {
      // 스피너로 전환 후 새로고침
      const arrow = document.getElementById('ptr-arrow');
      arrow.innerHTML = '<circle cx="12" cy="12" r="9" stroke-dasharray="28 56" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle>';
      arrow.style.transform = '';
      document.getElementById('ptr-label').textContent = '새로고침 중...';
      refreshing = true;
      try {
        // Refresh data in place: preserve the login, selected view and local UI state.
        const wasLoggedIn = !!currentUser;
        if (currentUser?.authToken) await employeeCheckSession();
        if (!wasLoggedIn || currentUser) {
          const ok = await _reloadRemoteData();
          if (!ok) toast('새로고침하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.','error');
        }
      } finally {
        arrow.innerHTML = '<path d="M12 5v14M5 12l7 7 7-7"/>';
        refreshing = false;
        setDist(0);
      }
    } else {
      setDist(0);
    }
  });
})();

