/* 근무표 앱 — WISE '파견사원 휴가신청/승인(PEDA2020)' 목록 복사.
   앱의 참고 자료 '직원B 남은 휴가' 탭에서 즐겨찾기 막대로 끌어 둔 버튼(북마클릿)이 WISE 창에서 이 파일을 불러 실행한다.
   지금 화면에 조회된 목록 줄(신청-이름[시작~끝]n일 · 휴가구분 · 진행상태)만 모아 클립보드에 복사 → 앱에서 '붙여넣기'.
   서버로 아무것도 보내지 않음. 줄 해석은 앱(js/workshop.js _wlParse)이 함 */
(function () {
  'use strict';
  var RE = /신청-[^\[\s]+\[\d{4}-\d{2}-\d{2}~\d{4}-\d{2}-\d{2}\]/;
  function texts(doc, out) {
    try {
      var rows = doc.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) { var t = (rows[i].innerText || rows[i].textContent || '').replace(/\s*\n\s*/g, '\t'); if (RE.test(t)) out.push(t); }
      var fr = doc.querySelectorAll('iframe,frame');
      for (var j = 0; j < fr.length; j++) { try { if (fr[j].contentDocument) texts(fr[j].contentDocument, out); } catch (e) {} }
    } catch (e) {}
    return out;
  }
  var lines = texts(document, []).filter(function (v, i, a) { return a.indexOf(v) === i; });
  function done(msg) { alert(msg); }
  if (!lines.length) { done('휴가 목록을 찾지 못했습니다.\n파견사원 휴가신청/승인 화면에서 [조회]를 누른 뒤 다시 눌러 주세요.'); return; }
  var text = '# 근무표 WISE 휴가 목록\n' + lines.join('\n');
  // 앱의 'WISE 열기'로 연 창이면 앱 창으로 바로 보냄(복사·붙여넣기 없이 저장)
  if (window.opener && !window.opener.closed) {
    try { window.opener.postMessage({ type: 'nd-wise-leave', text: text }, '*'); done(lines.length + '줄을 근무표 앱으로 보냈습니다. 앱 창을 확인하세요.'); return; } catch (e) {}
  }
  function fallback() {
    var ta = document.createElement('textarea'); ta.value = text;
    ta.style.cssText = 'position:fixed;inset:10% 10%;width:80%;height:60%;z-index:2147483647;font-size:12px;border:2px solid #2f77f6;border-radius:12px;padding:12px;background:#fff;color:#111';
    document.body.appendChild(ta); ta.focus(); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    if (ok) { ta.remove(); done(lines.length + '줄을 복사했습니다. 근무표 앱 참고 자료에서 [WISE 붙여넣기]를 누르세요.'); }
    else { ta.addEventListener('blur', function () { ta.remove(); }); done('자동 복사가 막혔습니다. 열린 글상자에서 Ctrl+C로 복사한 뒤 앱에 붙여넣으세요.'); }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(lines.length + '줄을 복사했습니다. 근무표 앱 참고 자료에서 [WISE 붙여넣기]를 누르세요.'); }, fallback);
  else fallback();
})();
