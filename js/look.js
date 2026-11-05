/* [모듈] js/look.js — 근무표 앱(PC, html.nd-app) 테마: 제목줄 [도구] 메뉴 → 테마 창(11-04 사용자 '웹하드처럼' — 웹하드 VW Source renderer/js/look.js·menubar.js 와 같은 방식)
   테마 창 = 화면 가운데 카드 2분할: 왼쪽 종류(일반 · 캐릭터) | 오른쪽 고르기(색 톤 동그라미 · 캐릭터 카드). 고르는 즉시 앱 전체가 바뀜
   일반 = 색 톤 하나(바탕·카드·글자 색을 그 톤으로 살짝, 강조색) · 캐릭터 = LOOK_CHARAS(치이카와·도라에몽: 색 + 배경 그림·캐릭터·꽃잎/반딧불이 — js/look-chara.js)
   이 PC에만 저장(localStorage nd_look = { accent, tint, amount } 또는 { chara: id, ...색 }), 앱에서만(웹·휴대폰은 그대로). 그림은 themes/<id>/(원본 = 웹하드 renderer/themes)
   로드 순서 = dashboard.html 의 <script> 순서 — app-mode.js(제목줄) 다음 */

// 색 계산(웹하드 renderer/js/look-color.js 를 근무표 색 변수에 맞춤): 밝게/어둡게 + look → <html> 에 덮어쓸 색 변수
// 배경 색 톤은 OKLCH 로 '밝기는 그대로 두고 색상·채도만' 바꿔서 글자 대비가 안 무너짐
const LookColor = (function () {
  // 기본 색 = css/base.css(밝게)·css/dark.css(어둡게)·css/admin.css(--card-fill)
  const BASE = {
    light: { bg: '#f1f4f8', surface: '#ffffff', surface2: '#f7f9fc', border: '#e2e8f0', text: '#334155', muted: '#94a3b8', 'card-fill': '#f8fafd' },
    dark: { bg: '#0f0f0f', surface: '#212121', surface2: '#272727', border: '#303030', text: '#f1f1f1', muted: '#aaaaaa', 'card-fill': '#212121' },
  };
  // 배경 색 세기 100% 일 때 칸마다 들어가는 채도(OKLCH C) — 바탕은 진하게, 흰 카드·글자는 아주 살짝
  const TINT_C = { bg: .05, surface: .012, surface2: .022, border: .045, text: .035, muted: .055, 'card-fill': .02 };
  // 테마 창의 색 톤 동그라미(첫 칸 파랑 = 기본)
  const COLORS = [
    { name: '파랑', hex: '#3182f6' }, { name: '하늘', hex: '#0ea5e9' }, { name: '민트', hex: '#14b8a6' },
    { name: '초록', hex: '#22b35e' }, { name: '레몬', hex: '#eab308' }, { name: '주황', hex: '#f97316' },
    { name: '핑크', hex: '#f0609e' }, { name: '보라', hex: '#8b5cf6' }, { name: '회색', hex: '#64748b' },
  ];
  const DEFAULT_AMOUNT = 60;
  const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toGamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function toOklch(hex) {
    const [r, g, b] = rgbOf(hex).map(v => toLin(v / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
  }
  function linOf(L, C, h) {
    const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  // 화면에 낼 수 없는 색이면 채도만 줄여서(밝기·색상은 그대로)
  function oklch(L, C, h) {
    let lin = linOf(L, C, h);
    for (let i = 0; i < 30 && lin.some(v => v < -1e-4 || v > 1 + 1e-4); i++) { C *= 0.9; lin = linOf(L, C, h); }
    return '#' + lin.map(v => Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, '0')).join('');
  }
  const rgba = (hex, a) => `rgba(${rgbOf(hex).join(',')},${a})`;
  // 강조색: 밝게 = 너무 밝은 색(레몬)은 흰 바탕 글자로 읽히게 조금 어둡게, 어둡게 = 한 단계 밝게
  function accentFor(mode, hex) {
    const [L, C, h] = toOklch(hex);
    const L2 = mode === 'dark' ? Math.min(0.85, Math.max(0.68, L + 0.06)) : Math.min(L, 0.68);
    return Math.abs(L2 - L) < 0.005 ? hex : oklch(L2, C, h);
  }
  // mode 'light'|'dark' → { '--bg': '#…', … } (없는 변수는 css 기본값 그대로 — 기본 테마 = 빈 값)
  function tokens(mode, look) {
    mode = mode === 'dark' ? 'dark' : 'light'; look = look || {};
    const vars = {}, base = BASE[mode];
    if (look.tint) {
      const [, tc, th] = toOklch(look.tint);
      const k = (Math.max(0, Math.min(100, look.amount ?? DEFAULT_AMOUNT)) / 100) * Math.max(0, Math.min(1, (tc - 0.05) / 0.07)) * (mode === 'dark' ? 0.85 : 1);   // 회색 = 무채색, 어둡게는 조금 덜
      for (const [name, hex] of Object.entries(base)) {
        const [L] = toOklch(hex);
        vars['--' + name] = oklch(L > 0.985 ? L - 0.012 * k : L, TINT_C[name] * k, th);   // 흰색은 그대로면 색이 못 들어가서 아주 살짝 낮춤
      }
    }
    if (look.accent) {
      const a = accentFor(mode, look.accent);
      vars['--nd-accent'] = a;
      vars['--nd-accent-bg'] = rgba(a, mode === 'dark' ? 0.18 : 0.12);
    }
    return vars;
  }
  return { COLORS, DEFAULT_AMOUNT, tokens, rgbOf };
})();

// 캐릭터 테마(숫자는 웹하드 renderer/themes/themes.js 와 같음 — 폴더 아이콘 꾸미기만 근무표엔 폴더가 없어 뺌). 그림 = themes/<id>/<file>
//   wallpaper: 앱 창 왼쪽 위 0 기준 자리·크기 px(창이 바뀌어도 그림 크기 그대로), opacity 진하기, fade 가장자리 부드럽게 px, blurRight 오른쪽으로 갈수록 흐리게(창 가로 0~1)
//   petals: 떨어지는 꽃잎 · fireflies: 날아다니는 반딧불이(area 'sidebar' = 사이드바 둘레) — 둘 다 배경에만, fps 장씩(손 그림 느낌)
//   character: 오른쪽 아래 캐릭터 — 그 모양대로 화면 내용을 깎은 것처럼(gap = 둘레 틈 px, 어둡게는 gapDark)
const LOOK_CHARAS = [
  {
    id: 'chiikawa', name: '치이카와', thumb: 'hachiware.png',
    colors: { accent: '#ec6a9c', tint: '#f0609e', amount: 55 },
    wallpaper: { file: 'wallpaper.jpg', x: -443, y: -102, height: 1222, opacity: 0.35, fade: { top: 0, right: 200, bottom: 0, left: 0 }, blurRight: { start: 0.35, end: 0.75, px: 8 } },
    petals: { count: 22, fps: 14, size: [9, 17], fall: [40, 75], drift: [25, 60], colors: ['#f7a8bd', '#f39ab2', '#fbc3d1', '#ee8aa6'] },
    character: { file: 'hachiware.png', width: 210, right: 2, bottom: -46, gap: 7, gapDark: 3 },
  },
  {
    id: 'doraemon', name: '도라에몽', thumb: 'doraemon-copter.png',
    colors: { accent: '#1fa463', tint: '#2fb36b', amount: 60 },   // 초록 톤
    wallpaper: { file: 'wallpaper.jpg', x: -918, y: -147, height: 1221, opacity: 0.35, fade: { top: 0, right: 200, bottom: 0, left: 0 }, blurRight: { start: 0.35, end: 0.75, px: 8 } },
    fireflies: { count: 40, area: 'sidebar', fps: 14, size: [2.4, 4.2], speed: [10, 26], color: '#d8ff78', colorLight: '#8fd12e' },
    character: { file: 'doraemon-copter.png', width: 240, right: -32, bottom: -14, gap: 7, gapDark: 3 },
  },
];
const lookChara = id => LOOK_CHARAS.find(t => t.id === id) || null;
const lookUrl = (t, file) => ['themes', t.id, file].map(encodeURIComponent).join('/');

function lookGet() { try { const v = JSON.parse(localStorage.getItem('nd_look') || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
let _lookVars = [];   // 지금 <html> 에 덮어쓴 색 변수(다시 칠할 때 지움)
function applyLook() {
  if (!ND_APP) return;
  let look = lookGet();
  const t = look && look.chara ? lookChara(look.chara) : null;
  if (look && look.chara && !t) look = null;   // 없어진 캐릭터
  const h = document.documentElement, st = h.style;
  _lookVars.forEach(n => st.removeProperty(n));
  const vars = LookColor.tokens(h.getAttribute('data-theme'), t ? t.colors : look);
  for (const [n, v] of Object.entries(vars)) st.setProperty(n, v);
  _lookVars = Object.keys(vars);
  h.classList.toggle('nd-look-on', !!(look && (look.accent || look.tint)) || !!t);
  if (typeof applyLookChara === 'function') applyLookChara(t);   // js/look-chara.js
  if (typeof _ndTitlebarColors === 'function') _ndTitlebarColors();   // 윈도 창 버튼 바탕(js/app-mode.js)
}
function setLook(look) {
  try { if (look) localStorage.setItem('nd_look', JSON.stringify(look)); else localStorage.removeItem('nd_look'); } catch (e) {}
  applyLook(); _lookPaint();
}

/* 테마 창 */
const _LK_CHECK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const _lkSame = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();
let _lookPane = 'tone';
function _lookPaint() {
  const pop = document.getElementById('look-pop'); if (!pop) return;
  const look = lookGet() || {};
  pop.querySelectorAll('.lk-nav button').forEach(b => b.classList.toggle('on', b.dataset.pane === _lookPane));
  pop.querySelector('#look-pane-tone').hidden = _lookPane !== 'tone';
  pop.querySelector('#look-pane-chara').hidden = _lookPane !== 'chara';
  // 일반 — 색 톤 동그라미(첫 칸 '기본' = 처음 색)
  pop.querySelector('#look-tones').innerHTML = LookColor.COLORS.map((c, i) => {
    const on = !look.chara && (i ? _lkSame(look.accent, c.hex) && _lkSame(look.tint, c.hex) : !look.accent && !look.tint);
    return `<div class="lk-tone"><button type="button" class="lk-dot${on ? ' on' : ''}" style="--c:${c.hex}" data-tone="${i ? c.hex : ''}" title="${i ? c.name + ' 톤' : '기본 (처음 색)'}" aria-pressed="${on}">${_LK_CHECK}</button><span>${i ? c.name : '기본'}</span></div>`;
  }).join('');
  // 캐릭터 — 테마 카드(그림 + 이름) + 준비 중 칸
  pop.querySelector('#look-charas').innerHTML = LOOK_CHARAS.map(t => `<button type="button" class="lk-chara${look.chara === t.id ? ' on' : ''}" style="--c:${t.colors.accent}" data-chara="${t.id}" aria-pressed="${look.chara === t.id}"><span class="lk-chara-pic"><img src="${lookUrl(t, t.thumb)}" alt="" draggable="false"></span><span class="lk-chara-nm">${t.name}</span><span class="lk-chara-check">${_LK_CHECK}</span></button>`).join('')
    + '<div class="lk-chara soon"><span class="lk-chara-pic">＋</span><span class="lk-chara-nm">다른 캐릭터<small>준비 중</small></span></div>';
}
function openLook() {
  if (!ND_APP) return;
  _ndMenuClose();
  document.getElementById('ndt-pop')?.remove();
  _lookPane = lookGet()?.chara ? 'chara' : 'tone';
  let pop = document.getElementById('look-pop');
  if (!pop) {
    pop = document.createElement('div'); pop.id = 'look-pop';
    pop.innerHTML = `<div class="lk-card" role="dialog" aria-modal="true" aria-label="테마">
      <div class="lk-head"><div><b>테마</b><small>고르면 앱 전체가 바로 바뀌어요 · 이 PC에만 저장</small></div><button type="button" class="lk-x" aria-label="닫기" title="닫기 (Esc)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="lk-body">
        <nav class="lk-nav">
          <button type="button" data-pane="tone">${_ndMbIcon('palette', 18)}일반</button>
          <button type="button" data-pane="chara">${_ndMbIcon('cat', 18)}캐릭터</button>
        </nav>
        <section class="lk-pane" id="look-pane-tone"><div class="lk-ptitle">색 톤<small>바탕·카드 색과 강조색을 한 번에</small></div><div class="lk-tones" id="look-tones"></div></section>
        <section class="lk-pane" id="look-pane-chara" hidden><div class="lk-ptitle">캐릭터<small>배경 그림 · 캐릭터 · 꽃잎/반딧불이까지 꾸며요</small></div><div class="lk-charas" id="look-charas"></div></section>
      </div></div>`;
    document.body.appendChild(pop);
    pop.querySelector('.lk-nav').onclick = e => { const p = e.target.closest('button')?.dataset.pane; if (p) { _lookPane = p; _lookPaint(); } };
    pop.querySelector('.lk-x').onclick = closeLook;
    pop.addEventListener('mousedown', e => { if (e.target === pop) closeLook(); });   // 카드 바깥(옅게 어두운 바탕) 누르면 닫힘
    pop.addEventListener('click', e => {
      const d = e.target.closest('.lk-dot'); if (d) { const hex = d.dataset.tone; setLook(hex ? { accent: hex, tint: hex, amount: LookColor.DEFAULT_AMOUNT } : null); return; }
      const c = e.target.closest('button.lk-chara'); if (c) { const t = lookChara(c.dataset.chara); if (t) setLook({ chara: t.id, ...t.colors }); }
    });
  }
  pop.hidden = false;
  _lookPaint();
  pop.querySelector('.lk-x').focus();
}
function closeLook() { const p = document.getElementById('look-pop'); if (p) p.hidden = true; }
document.addEventListener('keydown', e => { const p = document.getElementById('look-pop'); if (e.key === 'Escape' && p && !p.hidden) { closeLook(); e.stopPropagation(); } }, true);

/* 제목줄 [도구] 메뉴 — 웹하드 renderer/js/menubar.js 와 같은 모양(글자만 있는 메뉴, 펼치면 왼쪽 아이콘 · 이름 · 켜고 끄는 건 맨 오른쪽 체크)
   누르면 열림(다시 누르면 닫힘) · ↑↓ 고르기 · Enter 실행 · Esc/바깥 누르면 닫힘. 펼칠 때마다 다시 만듦(체크·쓸 수 있는지가 지금 상태를 따르게) */
const _ND_MB_ICONS = {
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 9.8C22 6 17.5 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
  cat: '<path d="M5 9.5 6 3.5l4 3.2h4l4-3.2 1 6"/><path d="M4.5 13.5c0-3.9 3.4-6.8 7.5-6.8s7.5 2.9 7.5 6.8S16.1 20.5 12 20.5s-7.5-3.1-7.5-7z"/><path d="M11 15.6h2"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  tour: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6h.01"/>',
  reload: '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M5 3.5V8h4.5M19 20.5V16h-4.5"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
};
function _ndMbIcon(k, s) { return `<svg viewBox="0 0 24 24" width="${s || 17}" height="${s || 17}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${_ND_MB_ICONS[k] || ''}</svg>`; }
const _ND_MB_CHECK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function _ndToolItems() {
  const tool = document.querySelector('#nd-titlebar .ndt-tool');
  return [
    { icon: 'palette', label: '테마…', run: openLook },
    { icon: 'moon', label: '어둡게', check: document.documentElement.getAttribute('data-theme') === 'dark', run: () => { if (typeof toggleTheme === 'function') toggleTheme(); else document.getElementById('theme-toggle')?.click(); } },
    '-',
    { icon: 'phone', label: '휴대폰에서 근무표 쓰기', run: () => { if (typeof ndPhonePop === 'function') ndPhonePop(); } },
    { icon: 'tour', label: '사용법 다시 보기', off: typeof ndAppTour !== 'function', run: () => setTimeout(() => ndAppTour(true)) },   // 메뉴가 닫힌 뒤에
    '-',
    { icon: 'reload', label: '화면 새로고침', key: 'F5', run: () => location.reload() },
    ...(tool ? [{ icon: 'wrench', label: '앱 정보', run: () => setTimeout(() => _ndToolToggle(tool)) }] : []),
  ];
}
function _ndMenuOpen(btn) {
  let pop = document.getElementById('nd-menu-pop');
  const first = !pop || pop.hidden;
  if (!pop) {
    pop = document.createElement('div'); pop.id = 'nd-menu-pop'; pop.setAttribute('role', 'menu'); document.body.appendChild(pop);
    pop.addEventListener('mousemove', e => { const b = e.target.closest('.mp-item:not(:disabled)'); if (b) _ndMenuHl(b); });
  }
  const items = _ndToolItems();
  pop.innerHTML = items.map((it, i) => it === '-' ? '<div class="mp-sep"></div>'
    : `<button type="button" role="menuitem" class="mp-item${'check' in it ? ' checkable' + (it.check ? ' checked' : '') : ''}" data-i="${i}"${it.off ? ' disabled' : ''}><span class="mp-ic">${_ndMbIcon(it.icon)}</span><span class="mp-label">${it.label}</span><span class="mp-key">${it.key || ''}</span><span class="mp-check">${it.check ? _ND_MB_CHECK : ''}</span></button>`).join('');
  pop.onclick = e => { const b = e.target.closest('.mp-item'); if (!b || b.disabled) return; _ndMenuClose(); items[+b.dataset.i].run(); };
  const r = btn.getBoundingClientRect();
  pop.style.left = r.left + 'px'; pop.style.top = r.bottom + 6 + 'px';
  pop.classList.toggle('in', first);
  pop.hidden = false;
  btn.classList.add('on'); btn.setAttribute('aria-expanded', 'true');
}
function _ndMenuClose() {
  const pop = document.getElementById('nd-menu-pop'); if (!pop || pop.hidden) return;
  pop.hidden = true;
  document.querySelectorAll('#nd-titlebar .ndt-mb').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); });
}
function _ndMenuHl(b) { document.querySelectorAll('#nd-menu-pop .mp-item.hl').forEach(x => x.classList.remove('hl')); b?.classList.add('hl'); }
function _ndMenuInit() {
  const bar = document.getElementById('nd-titlebar'); if (!bar || bar.querySelector('.ndt-menubar')) return;
  const mb = document.createElement('nav'); mb.className = 'ndt-menubar'; mb.setAttribute('aria-label', '메뉴');
  mb.innerHTML = '<button type="button" class="ndt-mb" aria-haspopup="menu" aria-expanded="false">도구</button>';
  bar.prepend(mb);
  const btn = mb.firstChild;
  btn.onmousedown = e => { if (e.button) return; e.preventDefault(); const p = document.getElementById('nd-menu-pop'); if (p && !p.hidden) _ndMenuClose(); else _ndMenuOpen(btn); };
  btn.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); _ndMenuOpen(btn); _ndMenuHl(document.querySelector('#nd-menu-pop .mp-item:not(:disabled)')); } };
  document.addEventListener('mousedown', e => { if (!e.target.closest('.ndt-menubar, #nd-menu-pop')) _ndMenuClose(); });
  window.addEventListener('blur', _ndMenuClose);
  window.addEventListener('resize', _ndMenuClose);
  // 열려 있는 동안 키보드는 메뉴가 먼저
  window.addEventListener('keydown', e => {
    const pop = document.getElementById('nd-menu-pop'); if (!pop || pop.hidden) return;
    const items = [...pop.querySelectorAll('.mp-item:not(:disabled)')], cur = items.indexOf(pop.querySelector('.mp-item.hl'));
    if (e.key === 'Escape') { _ndMenuClose(); btn.focus(); }
    else if (e.key === 'ArrowDown') _ndMenuHl(items[(cur + 1) % items.length]);
    else if (e.key === 'ArrowUp') _ndMenuHl(items[(cur - 1 + items.length) % items.length]);
    else if (e.key === 'Enter' && cur >= 0) items[cur].click();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);
}
if (ND_APP) {
  _ndMenuInit();
  applyLook();
  // 밝게/어둡게를 바꾸면 색을 다시 계산(캐릭터 둘레 틈도 어둡게용으로)
  new MutationObserver(() => applyLook()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
