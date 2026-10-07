/* 근무표 앱 — WISE 식단(SBS 목동) 가져오기.
   앱의 '식단 가져오기' 창에서 즐겨찾기 막대로 끌어 둔 버튼(북마클릿)이 WISE 창에서 이 파일을 불러 실행한다.
   WISE에 로그인된 그 창의 세션으로 식단조회(CMCA0540, 화면과 같은 요청)를 오늘부터 '메뉴가 나온 데까지' 읽어
   서버(notify 함수 mode 'meal' → nd_data id='meal')에 저장 → 앱 홈 '오늘의 식사'에 보임. 비밀번호는 어디에도 보내지 않음.
   테스트: swap-backend/test-meal.cjs (window.__ndMealTest 로 내부 함수만 꺼내 씀) */
(function () {
  'use strict';
  var FN = 'https://ntpoaqnhnwrpenstqhwb.supabase.co/functions/v1/notify';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50cG9hcW5obndycGVuc3RxaHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNzEyMzQsImV4cCI6MjA5Nzg0NzIzNH0.MyX2v56Q8SFqcU56tQfmZZVVr1R-X6BF4iBJautOANs';
  var WISE_HOST = 'wise.sbs.co.kr';
  var WISE_LOGIN = 'https://wise.sbs.co.kr/wise/intLoginWise.jsp';
  var AREA = '001';                                  // 001 목동 · 002 탄현 · 003 상암 (WISE 식단조회 화면 기준)
  var MEALS = ['조식', '중식', '석식'];
  var MAX_DAYS = 92, EMPTY_STOP = 14;                // 최대 92일, 메뉴 없는 날이 14일 이어지면 '나온 데까지'로 보고 멈춤

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function cookie(name) { var m = (' ' + document.cookie + ';').match(new RegExp(' ' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*);')); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return m ? m[1] : ''; } }
  function xmlEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // WISE 화면(cmca0540.xml)의 RQ 인스턴스와 같은 모양 — 사용자·회사·IP는 WISE가 쓰는 쿠키값(getAttribute와 같음)
  function reqXml(date8, gubun) {
    return '<map id="header"><WEBT_CALL_TYPE>G</WEBT_CALL_TYPE><WEBT_SVC_ID>CMCA0540</WEBT_SVC_ID><WEBT_XA/><WEBT_TIMEOUT/>' +
      '<RQH_FLAG>R</RQH_FLAG><RQH_CNT/><RQH_USER>' + xmlEsc(cookie('USER_ID')) + '</RQH_USER><RQH_CO>' + xmlEsc(cookie('CO_CD')) + '</RQH_CO>' +
      '<RQH_IP>' + xmlEsc(cookie('REMOTE_IP')) + '</RQH_IP><RQH_CROWNUM/><RQH_FROWNUM/><TEMP_PGM_ID>cmca0540</TEMP_PGM_ID>' +
      '<list id="body"><map><WEBT_GRID_SET/><WEBT_GRID_FIELD/><WEBT_GRID_FLAG/><AREA_CD/><APPLY_DD>' + date8 + '</APPLY_DD><GUBUN>' + xmlEsc(gubun) + '</GUBUN></map></list></map>';
  }
  // 응답 해석: { kind:'ok'|'login'|'error', msg, rows:[{area,item,text}] }
  // RSH_STATUS '0'/'' = 정상(건수 0이면 메뉴 없음), W/E/I/C/T/H = 오류(WISE common.js submitEnd와 같은 기준), 쿠키 오류 = 로그인 안 됨
  function parseRes(text) {
    var doc; try { doc = new DOMParser().parseFromString(String(text || ''), 'application/xml'); } catch (e) { doc = null; }
    if (!doc || doc.getElementsByTagName('parsererror').length || !doc.documentElement) return { kind: 'error', msg: '응답을 읽지 못했어요.', rows: [] };
    var root = doc.documentElement;
    function child(el, tag) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.tagName === tag) return c; return null; }
    function val(el, tag) { var c = child(el, tag); return c ? (c.textContent || '') : ''; }
    if (!child(root, 'RSH_STATUS')) return { kind: 'error', msg: '응답 형식이 달라요.', rows: [] };   // WISE 응답엔 항상 있음 — 없으면 '메뉴 없음'으로 보지 않음(저장본 보호)
    var st = val(root, 'RSH_STATUS').trim(), cd = val(root, 'RSH_ERR_CD').trim(), msg = val(root, 'RSH_MSG').trim();
    if (/쿠키|세션|session|login|로그인/i.test(msg) && (st && st !== '0' || cd === '-1')) return { kind: 'login', msg: msg, rows: [] };
    if (/^[WEICTH]$/.test(st) || cd === 'X') return { kind: 'error', msg: msg || ('오류 ' + st), rows: [] };
    var rows = [], list = child(root, 'list');
    if (list) for (var m = list.firstElementChild; m; m = m.nextElementSibling) {
      if (m.tagName !== 'map') continue;
      rows.push({ area: val(m, 'AREA_CD').trim(), item: val(m, 'ITEM_CD').trim(), text: val(m, 'RMKS').replace(/\r/g, '').trim() });
    }
    return { kind: 'ok', msg: msg, rows: rows };
  }
  // 목동(001) 줄만 → { A:'..', B:'..' } (코너1→A, 코너2→B, 코너3→C)
  function pickArea(rows) {
    var o = {}, any = false;
    rows.forEach(function (r) {
      if (r.area !== AREA || !r.text || /^운영\s*없음$/.test(r.text)) return;   // 운영 안 하는 코너는 저장 안 함
      var k = { '코너1': 'A', '코너2': 'B', '코너3': 'C', 'A': 'A', 'B': 'B', 'C': 'C' }[r.item.replace(/\s/g, '')];
      if (!k) return;
      o[k] = o[k] ? o[k] + '\n' + r.text : r.text; any = true;
    });
    return any ? o : null;
  }
  function withTimeout(ms) { var c = typeof AbortController === 'function' ? new AbortController() : null; var t = c ? setTimeout(function () { c.abort(); }, ms) : 0; return { signal: c ? c.signal : undefined, clear: function () { clearTimeout(t); } }; }
  async function fetchMeal(date, gubun) {
    var to = withTimeout(20000);
    try {
    var r = await fetch('/wise/commonSvcMap.action', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: to.signal,
      headers: { 'Content-Type': 'application/xml; charset=UTF-8' }, body: reqXml(ymd(date).replace(/-/g, ''), gubun) });
    if (!r.ok) return { kind: 'error', msg: 'WISE 응답 ' + r.status, rows: [] };
    return parseRes(await r.text());
    } finally { to.clear(); }
  }
  // 오늘부터 하루씩(조·중·석 동시) 읽음. 오류가 나면 그 전날까지만 저장(확인 못 한 날의 저장본은 건드리지 않음)
  async function collect(start, onDay) {
    var days = {}, lastOk = null, empty = 0, found = 0;
    for (var i = 0; i < MAX_DAYS; i++) {
      var d = addDays(start, i);
      var res = await Promise.all(MEALS.map(function (g) { return fetchMeal(d, g).catch(function (e) { return { kind: 'error', msg: (e && e.message) || '연결 실패', rows: [] }; }); }));
      var bad = res.filter(function (x) { return x.kind !== 'ok'; })[0];
      if (bad) return { days: days, from: ymd(start), to: lastOk ? ymd(lastOk) : '', found: found, stop: bad };
      var o = {}, has = false;
      res.forEach(function (x, k) { var a = pickArea(x.rows); if (a) { o[MEALS[k]] = a; has = true; } });
      if (has) { days[ymd(d)] = o; found++; empty = 0; } else empty++;
      lastOk = d;
      if (onDay) onDay(ymd(d), found);
      if (empty >= EMPTY_STOP) break;
    }
    return { days: days, from: ymd(start), to: lastOk ? ymd(lastOk) : '', found: found, stop: null };
  }
  async function upload(c) {
    var to = withTimeout(30000), r;
    try { r = await fetch(FN, { method: 'POST', signal: to.signal, headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
      body: JSON.stringify({ mode: 'meal', from: c.from, to: c.to, days: c.days }) }); } finally { to.clear(); }
    var j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok || !j.ok) throw new Error(j.error || ('저장 실패 ' + r.status));
    return j;
  }
  function md(s) { var m = /^(d{4})-(d{2})-(d{2})$/.exec(String(s || '')); return m ? (+m[2]) + '월 ' + (+m[3]) + '일' : ''; }   // 형식이 다르면 빈 글자(서버 값이 HTML로 들어가지 않게)

  // ── 화면(WISE 창 위에 뜨는 작은 카드) ──
  var ui = null;
  function show(title, text, btns, busy) {
    if (!ui) {
      ui = document.createElement('div'); ui.id = 'nd-meal-ui';
      ui.setAttribute('role', 'status');
      ui.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(420px,calc(100vw - 32px));box-sizing:border-box;' +
        'background:#f8fafd;border-radius:20px;box-shadow:0 22px 55px -14px rgba(20,24,40,.38),0 1px 2px rgba(20,24,40,.08);overflow:hidden;' +
        'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1f2937;';
      document.body.appendChild(ui);
    }
    ui.innerHTML = '<div style="padding:15px 18px 12px;background:rgba(251,146,60,.16);font-weight:800;font-size:15px;color:#c2410c;display:flex;align-items:center;gap:8px;">' +
      '<span style="flex:1">' + title + '</span>' + (busy ? '' : '<button type="button" data-x style="border:0;background:rgba(255,255,255,.7);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;color:#1f2937;">✕</button>') + '</div>' +
      '<div style="padding:14px 18px 16px;">' + text +
      (busy ? '<div style="margin-top:12px;height:6px;border-radius:9px;background:rgba(251,146,60,.18);overflow:hidden;"><div style="width:40%;height:100%;border-radius:9px;background:#fb923c;animation:ndMealBar 1.1s ease-in-out infinite;"></div></div>' : '') +
      (btns && btns.length ? '<div style="display:flex;gap:8px;margin-top:14px;">' + btns.map(function (b, i) { return '<button type="button" data-b="' + i + '" style="flex:1;border:0;border-radius:12px;padding:11px;font-weight:800;font-size:14px;cursor:pointer;' + (i === 0 ? 'background:linear-gradient(135deg,#4a94ff,#2f77f6);color:#fff;' : 'background:#eef1f6;color:#1f2937;') + '">' + b[0] + '</button>'; }).join('') + '</div>' : '') +
      '</div><style>@keyframes ndMealBar{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}</style>';
    var x = ui.querySelector('[data-x]'); if (x) x.onclick = done;
    (btns || []).forEach(function (b, i) { var el = ui.querySelector('[data-b="' + i + '"]'); if (el) el.onclick = b[1]; });
  }
  function done() { if (ui) { ui.remove(); ui = null; } var old = document.getElementById('nd-meal-ui'); if (old) old.remove(); }
  function tell(msg) { try { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*'); } catch (e) { } }   // 앱 창(이 창을 연 곳)에 바로 알림 — 내용은 기간·건수뿐

  async function run() {
    if (location.hostname !== WISE_HOST) {
      show('식단 가져오기', 'WISE 창에서 눌러 주세요. WISE를 열고 로그인한 뒤, 그 창에서 즐겨찾기의 \'식단 가져오기\'를 다시 누르면 돼요.',
        [['WISE 열기', function () { window.open(WISE_LOGIN, 'nd_wise'); done(); }], ['닫기', done]]);
      return;
    }
    show('목동 식단 가져오는 중', '<span data-p>오늘부터 메뉴가 나온 날까지 확인하고 있어요.</span>', null, true);
    var c;
    try {
      c = await collect(new Date(), function (ds, n) { var p = ui && ui.querySelector('[data-p]'); if (p) p.textContent = md(ds) + '까지 확인 · 메뉴 있는 날 ' + n + '일'; });
    } catch (e) { c = { found: 0, stop: { kind: 'error', msg: (e && e.message) || '알 수 없는 오류' } }; }
    if (c.stop && c.stop.kind === 'login' && !c.found) {
      tell({ type: 'nd-meal', ok: false, reason: 'login' });
      show('WISE 로그인이 필요해요', 'WISE에 로그인이 안 돼 있어요. 로그인한 뒤 즐겨찾기의 \'식단 가져오기\'를 다시 눌러 주세요.',
        [['로그인 화면으로', function () { location.href = WISE_LOGIN; }], ['닫기', done]]);
      return;
    }
    if (!c.found) {
      tell({ type: 'nd-meal', ok: false, reason: c.stop ? 'error' : 'empty' });
      show('가져올 식단이 없어요', c.stop ? ('WISE에서 식단을 읽지 못했어요.<br><small style="color:#6b7280">' + xmlEsc(c.stop.msg || '') + '</small>') : 'WISE에 등록된 목동 식단이 아직 없어요.', [['닫기', done]]);
      return;
    }
    show('저장하는 중', md(c.from) + ' ~ ' + md(c.to) + ' · 메뉴 있는 날 ' + c.found + '일', null, true);
    try {
      var j = await upload(c);
      tell({ type: 'nd-meal', ok: true, upto: j.upto || '', count: c.found });
      show('목동 식단을 가져왔어요', '<b>' + (md(j.upto) || md(c.to)) + '</b>까지 ' + c.found + '일치를 저장했어요. 근무표 앱 \'오늘의 식사\'에 바로 보여요.' +
        (c.stop ? '<br><small style="color:#b45309">중간에 WISE 오류가 나서 ' + md(c.to) + '까지만 확인했어요.</small>' : '') + '<br><small style="color:#6b7280">이 창은 닫아도 돼요.</small>',
        [['근무표로 돌아가기', function () { try { if (window.opener && !window.opener.closed) window.opener.focus(); } catch (e) { } done(); }], ['닫기', done]]);
    } catch (e) {
      tell({ type: 'nd-meal', ok: false, reason: 'upload' });
      show('저장하지 못했어요', '식단은 읽었는데 근무표 서버에 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.<br><small style="color:#6b7280">' + xmlEsc(e && e.message) + '</small>', [['다시 시도', function () { done(); start(); }], ['닫기', done]]);
    }
  }
  // 도는 중에만 막음(끝나면 결과 카드가 떠 있어도 다시 누르면 새로 시작). 즐겨찾기를 누를 때마다 이 파일이 새로 실행되므로 표시는 window에
  function start() {
    if (window.__ndMealRunning) return;
    window.__ndMealRunning = true;
    var old = document.getElementById('nd-meal-ui'); if (old) old.remove();
    run().catch(function () { done(); }).then(function () { window.__ndMealRunning = false; });
  }

  if (window.__ndMealTest) { window.__ndMealTest({ reqXml: reqXml, parseRes: parseRes, pickArea: pickArea, collect: collect, ymd: ymd, addDays: addDays }); return; }
  start();
})();
