/* [모듈] js/nd-comments.js — 투표·공지 댓글 공통 부품(목록 + 입력칸) | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// 댓글 하나 = {id, text, by(이름), byId(직원 id), at(ISO 시각)} — 투표 p.comments / 공지 it.comments 배열.
// 저장은 각 기능이 맡음(서버 최신본에 이 댓글만 병합): kind='poll' → _pollCmtAdd/_pollCmtDel(js/poll.js, _pollCommit)
//                                                 kind='notice' → _noticeCmtAdd/_noticeCmtDel(js/notice.js, _ndCommit)
// 처리기는 Promise<boolean>을 돌려주고, 실패(false)면 입력했던 글을 입력칸에 되돌려 놓는다.
// ndCmtSection(kind, ownerId, comments) → HTML(팝업에 넣음) / ndCmtRefresh(kind, ownerId, comments) → 열린 칸만 다시 그림(입력 중인 글 유지)
(function(){
  var HANDLERS = { poll: ['_pollCmtAdd', '_pollCmtDel'], notice: ['_noticeCmtAdd', '_noticeCmtDel'] };
  var MAX = 500;
  var AV = ['#3182f6', '#e0483c', '#16a34a', '#e6a817', '#8b5cf6', '#0891b2', '#ec4899', '#64748b'];
  var SEND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var X = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function me(){ return (typeof currentUser !== 'undefined' && currentUser && currentUser.staffId) ? currentUser : null; }
  function when(iso){
    var d = new Date(iso || 0); if (isNaN(d)) return '';
    var diff = (Date.now() - d.getTime()) / 60000, p = function(n){ return String(n).padStart(2, '0'); };
    if (diff < 1) return '방금';
    if (diff < 60) return Math.floor(diff) + '분 전';
    var n = new Date(), hm = p(d.getHours()) + ':' + p(d.getMinutes());
    if (d.toDateString() === n.toDateString()) return hm;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }
  function color(name){ var h = 0; String(name || '').split('').forEach(function(c){ h = (h * 31 + c.charCodeAt(0)) | 0; }); return AV[Math.abs(h) % AV.length]; }
  // 지울 수 있는 사람: 쓴 사람(직원 id) 또는 관리자·마스터
  window.ndCmtCanDelete = function(c){
    var u = me();
    return !!c && ((u && c.byId && c.byId === u.staffId) || (typeof isAdmin !== 'undefined' && isAdmin) || (typeof isMaster !== 'undefined' && isMaster));
  };
  function listHtml(kind, list){
    list = (list || []).slice().sort(function(a, b){ return String(a.at || '').localeCompare(String(b.at || '')); });
    if (!list.length) return '<div class="ndcm-empty">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</div>';
    var u = me();
    return list.map(function(c){
      var mine = u && c.byId === u.staffId, name = c.by || '익명';
      return '<div class="ndcm-item' + (mine ? ' mine' : '') + '" data-cid="' + esc(c.id) + '">' +
        '<span class="ndcm-av" style="background:' + color(name) + '" aria-hidden="true">' + esc(name.charAt(0)) + '</span>' +
        '<div class="ndcm-bub"><div class="ndcm-meta"><b>' + esc(name) + '</b><time datetime="' + esc(c.at || '') + '">' + when(c.at) + '</time>' +
        (ndCmtCanDelete(c) ? '<button type="button" class="ndcm-del" aria-label="댓글 지우기" title="지우기" onclick="ndCmtDelete(this)">' + X + '</button>' : '') +
        '</div><div class="ndcm-text">' + esc(c.text) + '</div></div></div>';
    }).join('');
  }
  window.ndCmtSection = function(kind, ownerId, comments){
    var u = me(), n = (comments || []).length;
    var form = u
      ? '<div class="ndcm-form"><textarea rows="1" maxlength="' + MAX + '" placeholder="댓글을 입력하세요" aria-label="댓글 입력" onkeydown="ndCmtKey(event,this)" oninput="ndCmtGrow(this)"></textarea>' +
        '<button type="button" class="ndcm-send" aria-label="댓글 등록" title="등록 (Enter)" onclick="ndCmtSubmit(this)">' + SEND + '</button></div>'
      : '<div class="ndcm-login">이름으로 로그인하면 댓글을 쓸 수 있어요.</div>';
    return '<section class="ndcm" data-kind="' + esc(kind) + '" data-owner="' + esc(ownerId) + '" aria-label="댓글">' +
      '<div class="ndcm-hd">댓글 <b class="ndcm-n">' + n + '</b></div><div class="ndcm-list">' + listHtml(kind, comments) + '</div>' + form + '</section>';
  };
  // 열린 댓글 칸만 다시 그림(입력칸·입력 중인 글은 그대로)
  window.ndCmtRefresh = function(kind, ownerId, comments, scrollToId){
    document.querySelectorAll('.ndcm[data-kind="' + kind + '"]').forEach(function(sec){
      if (sec.dataset.owner !== String(ownerId)) return;
      sec.querySelector('.ndcm-list').innerHTML = listHtml(kind, comments);
      var nEl = sec.querySelector('.ndcm-n'); if (nEl) nEl.textContent = (comments || []).length;
      if (scrollToId){ var it = sec.querySelector('.ndcm-item[data-cid="' + scrollToId + '"]'); if (it && it.scrollIntoView) it.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
  };
  window.ndCmtGrow = function(ta){ ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 140) + 'px'; };
  // Enter = 등록, Shift+Enter = 줄바꿈. 한글 조합 중 Enter는 무시(글자 확정용)
  window.ndCmtKey = function(e, ta){
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    e.preventDefault(); ndCmtSubmit(ta);
  };
  window.ndCmtSubmit = function(el){
    var sec = el.closest('.ndcm'); if (!sec || sec.dataset.busy) return;
    var ta = sec.querySelector('textarea'), u = me();
    if (!u){ if (typeof toast === 'function') toast('이름으로 로그인 후 댓글을 쓸 수 있습니다.', 'error'); return; }
    var text = (ta.value || '').trim().slice(0, MAX); if (!text) return;
    var fn = window[(HANDLERS[sec.dataset.kind] || [])[0]]; if (typeof fn !== 'function') return;
    var cmt = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: text, by: u.name || '', byId: u.staffId, at: new Date().toISOString() };
    var kind = sec.dataset.kind, owner = sec.dataset.owner;
    // 저장이 끝났을 때 화면에 살아 있는 같은 댓글 칸의 입력칸(그사이 창이 다시 그려졌을 수 있음)
    function live(){ var s2 = null; document.querySelectorAll('.ndcm[data-kind="' + kind + '"]').forEach(function(x){ if (!s2 && x.dataset.owner === owner) s2 = x; }); return s2; }
    sec.dataset.busy = '1'; ta.value = ''; ndCmtGrow(ta);
    Promise.resolve(fn(owner, cmt)).then(function(ok){
      delete sec.dataset.busy; var s2 = live(), t = s2 ? s2.querySelector('textarea') : null; if (s2) delete s2.dataset.busy;
      if (ok === false && t && !t.value) { t.value = text; ndCmtGrow(t); }   // 저장 실패 → 쓴 글 되돌림
      if (t && t.isConnected && !t.closest('.nd-closing')) t.focus();
    }, function(){ delete sec.dataset.busy; var s2 = live(), t = s2 ? s2.querySelector('textarea') : null; if (t && !t.value) { t.value = text; ndCmtGrow(t); } });
  };
  window.ndCmtDelete = function(btn){
    var sec = btn.closest('.ndcm'), item = btn.closest('.ndcm-item'); if (!sec || !item) return;
    var cid = item.dataset.cid;
    if (!confirm('이 댓글을 지울까요?')) return;
    var fn = window[(HANDLERS[sec.dataset.kind] || [])[1]]; if (typeof fn === 'function') fn(sec.dataset.owner, cid);
  };
})();
