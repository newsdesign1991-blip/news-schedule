/* [모듈] js/look-chara.js — 캐릭터 테마 그리기(근무표 앱): 맨 뒤 배경 그림 · 오른쪽 아래 캐릭터 · 떨어지는 꽃잎 · 날아다니는 반딧불이
   웹하드 VW Source renderer/js/chara.js·chara-petals.js·chara-fireflies.js 를 옮김. 테마 고르기·색·숫자는 js/look.js(LOOK_CHARAS, applyLook 이 applyLookChara 를 부름)
   깎기: 웹하드는 파일 창 카드 하나를 캐릭터 모양으로 깎지만, 근무표는 화면 전체가 스크롤돼서 대신 '구멍'을 오른쪽 아래에 고정(#chara-hole) —
   캐릭터 실루엣(둘레 gap 만큼 부풀림) 모양으로 바탕색 + 같은 배경 그림을 덮어 그 자리 내용이 깎인 것처럼 보이게, 그 위에 캐릭터(#chara-pal)
   배경 그림·꽃잎·반딧불이는 z-index -1(화면 내용 뒤, body 바탕 위 — html 바탕이 투명이라 body 바탕이 캔버스로 감) — css/look.css */

let _lkChara = null;   // 지금 캐릭터 테마(LOOK_CHARAS 한 칸)

// 캐릭터 실루엣(구멍 모양) — 그림을 둘레로 gap 만큼 여러 번 찍어 부풀리고 검게 칠함
function _lkCut(img, w, gap) {
  const h = (w * img.naturalHeight) / img.naturalWidth, s = Math.max(1, devicePixelRatio || 1);
  const cw = w + gap * 2, ch = h + gap * 2;
  const c = document.createElement('canvas'); c.width = Math.ceil(cw * s); c.height = Math.ceil(ch * s);
  const g = c.getContext('2d'); g.scale(s, s);
  const one = document.createElement('canvas'); one.width = Math.ceil(w * s); one.height = Math.ceil(h * s);   // 한 번만 그려 두고 둘레로 찍음
  one.getContext('2d').drawImage(img, 0, 0, one.width, one.height);
  const steps = gap ? 32 : 1;
  for (let i = 0; i < steps; i++) { const a = (i / steps) * Math.PI * 2; g.drawImage(one, gap + Math.cos(a) * gap, gap + Math.sin(a) * gap, w, h); }
  g.drawImage(one, gap, gap, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  return { url: `url("${c.toDataURL()}")`, w: cw, h: ch };
}
function _lkEls() {
  let hole = document.getElementById('chara-hole');
  if (!hole) {
    hole = document.createElement('div'); hole.id = 'chara-hole'; hole.setAttribute('aria-hidden', 'true');
    hole.innerHTML = '<i class="chw"></i><i class="chw chw-b"></i>';   // 구멍 안 배경 그림(또렷한 것 + 오른쪽 흐린 것) — 맨 뒤 그림과 같은 자리
    const pal = document.createElement('img'); pal.id = 'chara-pal'; pal.alt = ''; pal.draggable = false; pal.hidden = true;
    const pe = document.createElement('canvas'); pe.id = 'chara-petals'; pe.setAttribute('aria-hidden', 'true');
    const fl = document.createElement('canvas'); fl.id = 'chara-fireflies'; fl.setAttribute('aria-hidden', 'true');
    document.body.append(pe, fl, hole, pal);
  }
  return { hole, pal: document.getElementById('chara-pal') };
}
let _lkCutKey = '';
function applyLookChara(t) {
  const h = document.documentElement, st = h.style, was = _lkChara?.id;
  _lkChara = t;
  h.classList.toggle('chara-on', !!t);
  if (!t) {   // 끔 — 그림·캐릭터 변수(실루엣 data URL 포함)도 지움
    _lkPetals(null); _lkFlies(null); _lkCutKey = ''; h.classList.remove('chara-ready');
    [...st].filter(n => /^--(wall|wb-|ch-)/.test(n)).forEach(n => st.removeProperty(n));
    return;
  }
  const { pal } = _lkEls();
  // 배경 그림 — 정한 자리·높이 그대로(폭은 그림 비율대로라 그림을 읽어 잼). 완전한 주소로(변수 안 상대 주소는 css 파일 기준으로 풀림)
  const wl = t.wallpaper || {}, fade = wl.fade || {};
  const wallSrc = wl.file ? new URL(lookUrl(t, wl.file), location.href).href : '';
  st.setProperty('--wall', wallSrc ? `url("${wallSrc}")` : 'none');
  st.setProperty('--wall-x', (wl.x ?? 0) + 'px');
  st.setProperty('--wall-y', (wl.y ?? 0) + 'px');
  st.setProperty('--wall-h', (wl.height ?? innerHeight) + 'px');
  st.setProperty('--wall-op', wl.opacity ?? 1);
  for (const k of ['top', 'right', 'bottom', 'left']) st.setProperty('--wall-f' + k[0], (fade[k] ?? 0) + 'px');
  const br = wl.blurRight;   // 오른쪽 흐림 — 없으면 끔(아주 먼 자리)
  st.setProperty('--wb-s', br ? br.start * 100 + 'vw' : '99999px');
  st.setProperty('--wb-e', br ? br.end * 100 + 'vw' : '99999px');
  st.setProperty('--wb-px', (br?.px ?? 0) + 'px');
  if (wallSrc) { const pic = new Image(); pic.onload = () => { if (_lkChara === t) st.setProperty('--wall-w', ((wl.height ?? innerHeight) * pic.naturalWidth) / pic.naturalHeight + 'px'); }; pic.src = wallSrc; }
  _lkPetals(t.petals);
  _lkFlies(t.fireflies);
  const c = t.character;
  pal.hidden = !c;
  if (c) {
    // 어둡게는 틈으로 보이는 바탕이 카드보다 어두워 검은 테처럼 보여서 따로(gapDark)
    const gap = h.getAttribute('data-theme') === 'dark' && c.gapDark != null ? c.gapDark : c.gap ?? 0;
    st.setProperty('--ch-w', c.width + 'px');
    st.setProperty('--ch-r', c.right + 'px');
    st.setProperty('--ch-b', c.bottom + 'px');
    st.setProperty('--ch-gap', gap + 'px');
    const src = lookUrl(t, c.file), key = [src, c.width, gap].join('|');
    if (key !== _lkCutKey) {   // 그림·폭·틈이 바뀌었을 때만 실루엣을 새로
      _lkCutKey = key;
      pal.onload = () => {
        if (_lkCutKey !== key) return;
        const r = _lkCut(pal, c.width, gap);
        st.setProperty('--ch-cut', r.url);
        st.setProperty('--ch-cut-w', r.w + 'px');
        st.setProperty('--ch-cut-h', r.h + 'px');
        h.classList.add('chara-ready');
      };
      h.classList.remove('chara-ready');
      pal.src = src;
    }
  }
  if (was !== t.id) {
    h.classList.remove('chara-in'); void h.offsetWidth; h.classList.add('chara-in');   // 뒤에서 쑥 올라옴(css/look.css)
    setTimeout(() => h.classList.remove('chara-in'), 1000);
  }
}

/* 떨어지는 꽃잎(웹하드 chara-petals.js) — 왼쪽 위에서 오른쪽 아래로 흔들리고 뒤집히며 스르륵. fps 장씩만(손 그림 느낌), 창이 숨었거나 '동작 줄이기'면 멈춤 */
let _lkPetalTimer = null, _lkPetalList = [], _lkPetalCfg = null;
const _lkRnd = (a, b) => a + Math.random() * (b - a);
function _lkPetalPath(g) {   // 위가 살짝 파인 물방울 모양(가로 1 × 세로 1.2 단위)
  g.beginPath();
  g.moveTo(0, -0.46);
  g.bezierCurveTo(0.14, -0.62, 0.5, -0.56, 0.5, -0.12);
  g.bezierCurveTo(0.5, 0.28, 0.16, 0.54, 0, 0.62);
  g.bezierCurveTo(-0.16, 0.54, -0.5, 0.28, -0.5, -0.12);
  g.bezierCurveTo(-0.5, -0.56, -0.14, -0.62, 0, -0.46);
  g.closePath();
}
function _lkPetalNew(first) {   // 처음엔 왼쪽 반 여기저기, 그다음부턴 왼쪽 위에서(오른쪽은 화면 내용에 가려서 왼쪽에 몰아 줌)
  const c = _lkPetalCfg, W = innerWidth, H = innerHeight;
  const p = { size: _lkRnd(...c.size), vy: _lkRnd(...c.fall), vx: _lkRnd(...c.drift), rot: _lkRnd(0, Math.PI * 2), spin: _lkRnd(-1.2, 1.2),
    flip: _lkRnd(0, Math.PI * 2), flipV: _lkRnd(1.5, 3.5), sway: _lkRnd(8, 22), swayF: _lkRnd(0.6, 1.4), seed: _lkRnd(0, 10), t: 0,
    color: c.colors[Math.floor(Math.random() * c.colors.length)] };
  if (first) { p.x = _lkRnd(-0.1 * W, 0.45 * W); p.y = _lkRnd(-0.05 * H, H); }
  else if (Math.random() < 0.6) { p.x = _lkRnd(-0.25 * W, 0.22 * W); p.y = -20; }
  else { p.x = -20; p.y = _lkRnd(0, 0.6 * H); }
  return p;
}
function _lkPetalDraw() {
  const cv = document.getElementById('chara-petals'); if (!cv) return;
  const g = cv.getContext('2d'), s = devicePixelRatio || 1;
  if (cv.width !== Math.round(innerWidth * s) || cv.height !== Math.round(innerHeight * s)) { cv.width = Math.round(innerWidth * s); cv.height = Math.round(innerHeight * s); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  for (const p of _lkPetalList) {
    const sx = Math.cos(p.flip);   // 뒤집힘(납작해졌다 펴짐)
    g.setTransform(s, 0, 0, s, 0, 0);
    g.translate(p.x + Math.sin(p.t * p.swayF + p.seed) * p.sway, p.y);
    g.rotate(p.rot);
    g.scale(p.size * (0.25 + 0.75 * Math.abs(sx)), p.size * 1.2);
    _lkPetalPath(g);
    g.globalAlpha = 0.9; g.fillStyle = p.color; g.fill();
    g.globalAlpha = 0.35; g.lineWidth = 1.2 / p.size; g.strokeStyle = '#d9607f'; g.stroke();   // 가는 테두리
  }
  g.globalAlpha = 1;
}
function _lkPetalStep() {
  if (document.hidden) return;
  const dt = 1 / _lkPetalCfg.fps, W = innerWidth, H = innerHeight;
  _lkPetalList = _lkPetalList.map(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; p.flip += p.flipV * dt; return p.x > W + 40 || p.y > H + 40 ? _lkPetalNew(false) : p; });
  _lkPetalDraw();
}
function _lkPetals(cfg) {
  clearInterval(_lkPetalTimer); _lkPetalTimer = null;
  _lkPetalCfg = cfg ? { count: 20, fps: 14, size: [9, 17], fall: [40, 75], drift: [25, 60], colors: ['#f7a8bd'], ...cfg } : null;
  const cv = document.getElementById('chara-petals');
  if (!_lkPetalCfg) { _lkPetalList = []; if (cv) { const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); } return; }   // 다른 테마로 바꿔도 남던 꽃잎까지 지움
  _lkPetalList = Array.from({ length: _lkPetalCfg.count }, () => _lkPetalNew(true));
  _lkPetalDraw();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) _lkPetalTimer = setInterval(_lkPetalStep, 1000 / _lkPetalCfg.fps);
}

/* 날아다니는 반딧불이(웹하드 chara-fireflies.js) — 작은 빛이 천천히 떠다니며 숨 쉬듯 밝아졌다 어두워짐. area 'sidebar' 면 사이드바(#side-nav) 둘레 */
let _lkFlyTimer = null, _lkFlyList = [], _lkFlyCfg = null;
function _lkFlyArea() {
  const W = innerWidth, H = innerHeight;
  if (_lkFlyCfg.area === 'sidebar') {
    const r = document.getElementById('side-nav')?.getBoundingClientRect();
    if (r && r.width > 40) return { x0: Math.max(0, r.left - 10), x1: Math.min(W, r.right + 24), y0: Math.max(44, r.top), y1: Math.min(H, r.bottom + 10) };
  }
  return { x0: 0, x1: W, y0: 0, y1: H };
}
function _lkFlyNew() {   // 아래쪽에 조금 더 많이(숲 바닥 풀 위)
  const c = _lkFlyCfg, a = _lkFlyArea();
  return { x: _lkRnd(a.x0, a.x1), y: a.y0 + (a.y1 - a.y0) * Math.pow(Math.random(), 0.75), dir: _lkRnd(0, Math.PI * 2), speed: _lkRnd(...c.speed), turn: _lkRnd(0.6, 1.6),
    size: _lkRnd(...c.size), phase: _lkRnd(0, Math.PI * 2), blink: _lkRnd(0.5, 1.3), t: 0 };
}
function _lkFlyDraw() {
  const cv = document.getElementById('chara-fireflies'); if (!cv) return;
  const g = cv.getContext('2d'), s = devicePixelRatio || 1;
  if (cv.width !== Math.round(innerWidth * s) || cv.height !== Math.round(innerHeight * s)) { cv.width = Math.round(innerWidth * s); cv.height = Math.round(innerHeight * s); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(s, 0, 0, s, 0, 0);
  const light = document.documentElement.getAttribute('data-theme') !== 'dark';   // 밝게 = 보통으로 + 진한 색 빛, 어둡게 = 겹치면 더 밝게(빛처럼)
  g.globalCompositeOperation = light ? 'source-over' : 'lighter';
  const rgb = light ? _lkFlyCfg.rgbLight : _lkFlyCfg.rgb;
  for (const f of _lkFlyList) {
    const b = Math.pow((Math.sin(f.t * f.blink * Math.PI + f.phase) + 1) / 2, 1.6);   // 0~1 숨 쉬듯
    if (b < 0.03) continue;
    const r = f.size * 5, glow = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    glow.addColorStop(0, `rgba(${rgb},${(light ? 0.85 : 0.75) * b})`);
    glow.addColorStop(0.35, `rgba(${rgb},${(light ? 0.4 : 0.3) * b})`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = glow; g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(255,255,230,${0.9 * b})`; g.beginPath(); g.arc(f.x, f.y, f.size * 0.55, 0, Math.PI * 2); g.fill();   // 가운데 작은 점
  }
  g.globalCompositeOperation = 'source-over';
}
function _lkFlyStep() {
  if (document.hidden) return;
  const dt = 1 / _lkFlyCfg.fps, a = _lkFlyArea(), cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2;
  _lkFlyList = _lkFlyList.map(f => {
    f.t += dt;
    f.dir += _lkRnd(-1, 1) * f.turn * dt * 2;   // 천천히 방향을 바꿈
    if (f.x < a.x0 || f.x > a.x1 || f.y < a.y0 || f.y > a.y1) { const want = Math.atan2(cy - f.y, cx - f.x); f.dir += Math.atan2(Math.sin(want - f.dir), Math.cos(want - f.dir)) * Math.min(1, dt * 2.5); }   // 벗어나면 가운데 쪽으로 슬슬
    f.x += Math.cos(f.dir) * f.speed * dt; f.y += Math.sin(f.dir) * f.speed * dt * 0.7;
    return f.x < a.x0 - 60 || f.x > a.x1 + 60 || f.y < a.y0 - 60 || f.y > a.y1 + 60 ? _lkFlyNew() : f;
  });
  _lkFlyDraw();
}
function _lkFlies(cfg) {
  clearInterval(_lkFlyTimer); _lkFlyTimer = null;
  _lkFlyCfg = cfg ? { count: 26, fps: 14, size: [2, 3.6], speed: [10, 26], color: '#d8ff78', colorLight: '#8fd12e', ...cfg } : null;
  const cv = document.getElementById('chara-fireflies');
  if (!_lkFlyCfg) { _lkFlyList = []; if (cv) { const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); } return; }
  const rgb = hex => LookColor.rgbOf(hex).join(',');
  _lkFlyCfg.rgb = rgb(_lkFlyCfg.color); _lkFlyCfg.rgbLight = rgb(_lkFlyCfg.colorLight);
  _lkFlyList = Array.from({ length: _lkFlyCfg.count }, _lkFlyNew);
  _lkFlyDraw();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) _lkFlyTimer = setInterval(_lkFlyStep, 1000 / _lkFlyCfg.fps);
}
