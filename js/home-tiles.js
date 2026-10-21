/* [모듈] js/home-tiles.js — 홈 타일 길게 눌러 옮기기(10-21 요청) | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것)
   - 카드(타일)를 길게(0.45초) 누르면 들려서 손가락·마우스를 따라오고, 다른 카드 위로 가면 그 앞/뒤로 자리가 바뀜(나머지는 부드럽게 비켜남). 놓으면 이 기기에 저장
   - 넓은 화면(1120~1559px, 벽돌쌓기 js/home.js _hmSpans)과 좁은 화면(모바일·창 좁을 때)만. 아주 큰 화면(≥1560 3분할 .hm3)은 안 함
   - 화면 폭마다 따로 기억(localStorage nd_home_tiles_d = 넓은 화면, nd_home_tiles_m = 좁은 화면). 아무것도 안 옮겼으면 원래 배치 그대로
   - 좁은 화면은 원래 줄 묶음(.home-row)이라 순서를 못 줘서, 옮긴 사람만 홈을 세로 한 줄(flex, .hk-flat)로 펴고 카드마다 order. PROJECT·SPORTS 는 한 칸으로 같이 다님
   - 넓은 화면은 카드마다 style.order → _hmSpans 가 order 순서대로 쌓음(옮긴 뒤엔 '큰 카드 끌어올리기' 보정을 안 함 — .hk-custom)
   - 공지 공감·입력칸 위에서는 길게 눌러도 안 움직임. 오늘의 식사 카드의 예전 '위/아래로' 팝업은 이걸로 바뀜(js/meal.js) */
const HT_KEY = { d: 'nd_home_tiles_d', m: 'nd_home_tiles_m' };
function _htPanel(id) { const e = document.getElementById(id); return e ? e.closest('.panel') : null; }
function _htMode() {
  const vh = document.getElementById('view-home'); if (!vh || !vh.classList.contains('active')) return null;
  if (vh.classList.contains('hm3')) return null;   // 아주 큰 화면 3분할
  return innerWidth >= 1120 ? 'd' : 'm';
}
// 지금 화면의 타일 [{ key, el }] — 안 보이는 것(display:none·높이 0)은 빼지만 order 는 줌
function _htTiles(mode) {
  const pjsp = (() => { const p = _htPanel('project-today-chips'); const w = p && p.parentElement; return w && /grid-template-columns/.test(w.getAttribute('style') || '') ? w : null; })();
  const list = [
    ['mysched', document.getElementById('my-schedule-card')], ['polls', document.getElementById('home-polls')], ['meal', document.getElementById('home-meal')],
    ['notice', document.getElementById('home-notice')], ['week', document.getElementById('home-week-panel')], ['project', document.getElementById('home-project-panel')],
    ['vw', _htPanel('vw-today-chips')], ['cg', _htPanel('cg-today-chips')],
    ...(mode === 'm' && pjsp ? [['pjsp', pjsp]] : [['pj', _htPanel('project-today-chips')], ['sp', _htPanel('sports-today-chips')]]),
    ['summary', document.getElementById('home-summary')], ['duty', document.getElementById('home-duty-row')], ['wsum', _htPanel('home-week-summary')]
  ];
  return list.filter(([, el]) => el).map(([key, el]) => ({ key, el }));
}
function _htLoad(mode) { try { const v = JSON.parse(localStorage.getItem(HT_KEY[mode]) || 'null'); return Array.isArray(v) && v.length ? v.map(String) : null; } catch (e) { return null; } }
function _htSave(mode, order) { try { if (order) localStorage.setItem(HT_KEY[mode], JSON.stringify(order)); else localStorage.removeItem(HT_KEY[mode]); } catch (e) { /* 저장 못 함 — 이번만 */ } }
// 지금 보이는 순서(넓은 화면 = order·문서 순서, 좁은 화면 = 문서 순서)
function _htVisualOrder(mode) {
  const tiles = _htTiles(mode);
  const pos = (el) => { const all = document.getElementById('view-home').querySelectorAll('*'); return Array.prototype.indexOf.call(all, el); };
  return tiles.map((t) => ({ k: t.key, o: mode === 'd' ? (parseFloat(getComputedStyle(t.el).order) || 0) : 0, p: pos(t.el) }))
    .sort((a, b) => a.o - b.o || a.p - b.p).map((x) => x.k);
}
function _htSetOrders(mode, order) {
  const vh = document.getElementById('view-home'), tiles = _htTiles(mode), idx = new Map(order.map((k, i) => [k, i]));
  vh.classList.add('hk-custom'); vh.classList.toggle('hk-flat', mode === 'm');
  tiles.forEach((t, i) => { t.el.dataset.hk = t.key; t.el.style.order = String(idx.has(t.key) ? idx.get(t.key) : 500 + i); });
}
// renderHome·창 크기 바뀜 때(js/home.js layoutHomeMasonry 맨 앞에서 부름): 저장된 순서를 지금 화면 폭에 맞춰 씌움
function ndTilesApply() {
  const vh = document.getElementById('view-home'); if (!vh) return;
  vh.querySelectorAll('[data-hk]').forEach((e) => { e.style.order = ''; });
  vh.classList.remove('hk-custom', 'hk-flat');
  const mode = _htMode(); if (!mode) return;
  _htTiles(mode).forEach((t) => { t.el.dataset.hk = t.key; });
  const saved = _htLoad(mode);
  if (saved) _htSetOrders(mode, saved);
  _htBind();
}
function ndTilesReset() {
  const mode = _htMode() || (innerWidth >= 1120 ? 'd' : 'm');
  _htSave(mode, null); document.getElementById('ht-pill')?.remove();
  ndTilesApply(); try { layoutHomeMasonry(); } catch (e) {}
  toast('홈 배치를 원래대로 돌렸어요.', 'success');
}

// ── 길게 눌러 끌기 ──
let _ht = null;   // { tile, mode, order, x0, y0, timer, active, dx, dy, tx, ty, lastKey, lastAt, raf, px, py }
function _htExcluded(t) { return !!(t.closest && t.closest('input,textarea,select,[contenteditable],[class*="react"],.ndt-pop,.hm3-col')); }
function _htBind() {
  const vh = document.getElementById('view-home'); if (!vh || vh._htBound) return; vh._htBound = true;
  let lastTouch = 0;
  const down = (x, y, target, touch) => {
    if (_ht || !_htMode()) return;
    const tile = target.closest && target.closest('[data-hk]'); if (!tile || !vh.contains(tile) || _htExcluded(target)) return;
    _ht = { tile, touch, x0: x, y0: y, px: x, py: y, active: false };
    _ht.timer = setTimeout(() => _htBegin(), 450);
  };
  const move = (x, y, e) => {
    if (!_ht) return;
    _ht.px = x; _ht.py = y;
    if (!_ht.active) { if (Math.abs(x - _ht.x0) > 8 || Math.abs(y - _ht.y0) > 8) { clearTimeout(_ht.timer); _ht = null; } return; }
    if (e && e.cancelable) e.preventDefault();
    _htDrag(x, y);
  };
  const up = () => { if (!_ht) return; clearTimeout(_ht.timer); if (_ht.active) _htDrop(); else _ht = null; };
  vh.addEventListener('touchstart', (e) => { lastTouch = Date.now(); if (e.touches.length !== 1) { up(); return; } const t = e.touches[0]; down(t.clientX, t.clientY, e.target, true); }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (!_ht) return; lastTouch = Date.now(); const t = e.touches[0]; if (t) move(t.clientX, t.clientY, e); }, { passive: false });
  document.addEventListener('touchend', () => { lastTouch = Date.now(); up(); });
  document.addEventListener('touchcancel', () => { lastTouch = Date.now(); if (_ht && _ht.active) _htDrop(); else if (_ht) { clearTimeout(_ht.timer); _ht = null; } });
  vh.addEventListener('mousedown', (e) => { if (Date.now() - lastTouch < 800 || e.button !== 0) return; down(e.clientX, e.clientY, e.target, false); });
  document.addEventListener('mousemove', (e) => { if (Date.now() - lastTouch < 800) return; move(e.clientX, e.clientY, e); });
  document.addEventListener('mouseup', () => { if (Date.now() - lastTouch < 800) return; up(); });
  vh.addEventListener('contextmenu', (e) => { if (_ht) e.preventDefault(); });   // 휴대폰 길게 누르기 메뉴 대신
  // 끌고 난 뒤 따라오는 클릭은 막음(카드 안 버튼이 같이 눌리지 않게)
  vh.addEventListener('click', (e) => { if (vh._htJustDropped && Date.now() - vh._htJustDropped < 500) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && _ht && _ht.active) { _ht.cancel = true; _htDrop(); } });
}
function _htBegin() {
  const s = _ht; if (!s) return;
  const mode = _htMode(); if (!mode) { _ht = null; return; }
  s.mode = mode; s.active = true;
  s.before = _htLoad(mode);   // Esc 면 이걸로
  s.order = s.before || _htVisualOrder(mode);
  const r0 = s.tile.getBoundingClientRect();
  _htSetOrders(mode, s.order);
  if (mode === 'd') { try { _hmSpans(_hmItems(document.getElementById('view-home'))); } catch (e) {} }
  const r = s.tile.getBoundingClientRect();
  s.dx = s.x0 - r0.left; s.dy = s.y0 - r0.top; s.w = r.width;
  s.tile.classList.add('ht-lift'); document.body.classList.add('ht-dragging');
  try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
  s.tx = 0; s.ty = 0; _htPlace(s.px, s.py);
  const tick = () => { if (!_ht || !_ht.active) return;   // 화면 가장자리면 저절로 스크롤
    const y = _ht.py, edge = 70, sp = y < edge ? -Math.ceil((edge - y) / 5) : y > innerHeight - edge ? Math.ceil((y - (innerHeight - edge)) / 5) : 0;
    if (sp) { scrollBy(0, sp); _htPlace(_ht.px, _ht.py); _htDrag(_ht.px, _ht.py); }
    _ht.raf = requestAnimationFrame(tick); };
  s.raf = requestAnimationFrame(tick);
}
// 들린 카드가 누른 자리 그대로 손가락을 따라오게(지금 자리 기준 transform)
function _htPlace(x, y) {
  const s = _ht; if (!s) return;
  const r = s.tile.getBoundingClientRect(), baseL = r.left - s.tx, baseT = r.top - s.ty;
  s.tx = (x - s.dx) - baseL; s.ty = (y - s.dy) - baseT;
  s.tile.style.transform = `translate(${s.tx}px,${s.ty}px) scale(1.03)`;
}
function _htDrag(x, y) {
  const s = _ht; if (!s) return;
  _htPlace(x, y);
  if (Date.now() - (s.lastAt || 0) < 140) return;
  const tiles = _htTiles(s.mode);
  const hit = tiles.find((t) => t.el !== s.tile && (() => { const r = t.el.getBoundingClientRect(); return r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; })());
  if (!hit) return;
  const r = hit.el.getBoundingClientRect(), after = y > r.top + r.height / 2;
  const next = s.order.filter((k) => k !== s.tile.dataset.hk);
  // 화면에 없는 카드 키도 순서에 남아 있게(그 날 안 보이는 투표·공지 등)
  if (!next.includes(hit.key)) return;
  next.splice(next.indexOf(hit.key) + (after ? 1 : 0), 0, s.tile.dataset.hk);
  if (next.join('|') === s.order.join('|')) return;
  s.lastAt = Date.now();
  _htReorder(next);
}
function _htReorder(order) {
  const s = _ht, vh = document.getElementById('view-home'), tiles = _htTiles(s.mode);
  const first = new Map(tiles.map((t) => [t.el, t.el.getBoundingClientRect()]));
  s.order = order; _htSetOrders(s.mode, order);
  if (s.mode === 'd') { try { _hmSpans(_hmItems(vh)); } catch (e) {} }
  tiles.forEach((t) => {
    if (t.el === s.tile) return;
    const a = first.get(t.el), b = t.el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    try { t.el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }); } catch (e) {}
  });
  _htPlace(s.px, s.py);
}
function _htDrop() {
  const s = _ht; if (!s) return; _ht = null;
  cancelAnimationFrame(s.raf);
  const vh = document.getElementById('view-home');
  if (s.cancel) { s.order = s.before; if (s.before) _htSetOrders(s.mode, s.before); else ndTilesApply(); if (s.mode === 'd') { try { _hmSpans(_hmItems(vh)); } catch (e) {} } }
  // 제자리로 내려앉기
  const el = s.tile, from = el.style.transform;
  el.style.transform = '';
  const r = el.getBoundingClientRect();
  try { el.animate([{ transform: from || 'none' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => el.classList.remove('ht-lift'); } catch (e) { el.classList.remove('ht-lift'); }
  setTimeout(() => el.classList.remove('ht-lift'), 320);
  document.body.classList.remove('ht-dragging');
  vh._htJustDropped = Date.now();
  if (s.cancel || !s.order) return;
  const changed = (s.before || _htVisualOrderDefault(s.mode)).join('|') !== s.order.join('|');
  if (!changed && !s.before) { ndTilesApply(); try { layoutHomeMasonry(); } catch (e) {} return; }   // 그대로면 저장 안 함
  _htSave(s.mode, s.order);
  try { layoutHomeMasonry(); } catch (e) {}
  _htPill();
  void r;
}
// 원래(아무것도 안 옮겼을 때) 순서 — 저장을 지운 상태로 잠깐 계산
function _htVisualOrderDefault(mode) {
  const vh = document.getElementById('view-home'), keep = [];
  _htTiles(mode).forEach((t) => { keep.push([t.el, t.el.style.order]); t.el.style.order = ''; });
  const hadC = vh.classList.contains('hk-custom'), hadF = vh.classList.contains('hk-flat');
  vh.classList.remove('hk-custom', 'hk-flat');
  const o = _htVisualOrder(mode);
  keep.forEach(([el, v]) => { el.style.order = v; });
  vh.classList.toggle('hk-custom', hadC); vh.classList.toggle('hk-flat', hadF);
  return o;
}
// 놓은 뒤 잠깐: '배치를 저장했어요 · 원래대로'
function _htPill() {
  document.getElementById('ht-pill')?.remove();
  const p = document.createElement('div'); p.id = 'ht-pill'; p.className = 'ht-pill'; p.setAttribute('role', 'status');
  p.innerHTML = '<span>홈 배치를 저장했어요</span><button type="button" onclick="ndTilesReset()">원래대로</button>';
  document.body.appendChild(p);
  setTimeout(() => { if (p.isConnected) { p.classList.add('out'); setTimeout(() => p.remove(), 300); } }, 5000);
}
