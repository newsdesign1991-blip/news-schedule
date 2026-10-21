/* [모듈] js/cg-assign.js — CG배정 현황(10-20, PC 사이드바 '근무표' 아래) | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것)
   오늘 출근한 CG 근무자(8데스·5데스 빼고) 카드 + NDS CG의뢰(nds.sbs.co.kr/request-cg)에서 누가 지금 작업 중인지.
   - 근무자 = 홈 'CG 근무자'와 같은 기준(js/home.js): CG 근무 + XR 근무(10-20: XR도 CG 제작을 늘 해서 포함) + CG·XR 부서 8진·뉴오·일근, 휴가·수습·당직/퇴근·조근·오전데 빼고, 8데스·5데스 빼고
   - NDS = 근무표 PC 앱 window.ndApp.ndsCg(오늘) (desktop/nds-cue.js, 공용 계정) — 이 화면을 열어 둔 PC만 20초마다(창이 보일 때만). 웹·옛 앱은 안내만
   - 상태 0002 배정 = 작업 중(파란 빛·깜빡이는 점·'작업 중…'·기자·의뢰/배정 시각), 그 밖 = 대기(회색). 이름은 NDS 디자이너 이름과 근무표 이름이 같아야 맞음
   - 10-20 추가: 프로젝트 인원은 늘 포함, [사람 추가]·카드 ×로 그날만 넣고 빼기(10-21부터 모든 PC 공용 — nd_data 'cgman'.adj, 5초마다 맞춤), 왼쪽 의뢰 ×로 이 PC에서만 숨기기(nd_cga_hide, NDS엔 그대로),
     보완요청은 회색, 새 의뢰(0001)가 생기면 오른쪽 위 알림 카드(ndApp.toast — 1.2.4+, 옛 앱은 화면 아래 토스트)
   - 직접 배정(CG·앵커터치·PT — NDS에 안 올라옴): 카드 오른쪽 클릭 → 배정/완료, 공용 nd_data 'cgman'(아래 _cgm*)
   - 끌어다 놓아 NDS 배정(10-21): 왼쪽 '의뢰'를 사람 카드에 → 확인 창 → 내 NDS 로그인(WISE × N)으로 NDS 에 배정(ndApp.ndsAssign, 앱 1.2.6~)
   - 의뢰 누르면 크게 보기(본문 포함, ndApp.ndsCgDetail) + [인쇄] = NDS [인쇄 → 기본]과 같은 모양, 미리보기 창에서 프린터 골라 바로 인쇄(ndApp.printHtml) — 앱 1.2.7~ */
const CGA_POLL = 20000;
const CGA_PERSON_POP = false;   // 10-20 사용자: 카드 누르면 뜨는 사람 팝업(_cgaPersonPop)은 일단 숨김 — 코드는 남겨 둠, true 면 다시 켜짐
let _cgaData = null, _cgaErr = '', _cgaBusy = false, _cgaTimer = null, _cgaTick = null, _cgaSeen = null, _cgmTimer = null;
// 그날만 쓰는 이 PC 설정(날짜가 바뀌면 비움): 숨긴 의뢰 id / 넣은·뺀 사람 id
function _cgaLocal(key) { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); if (v && v.day === _cgaToday()) return v; } catch (e) {} return { day: _cgaToday() }; }
function _cgaSave(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
const _cgaEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function _cgaToday() { const n = new Date(); return toDateStr(n.getFullYear(), n.getMonth() + 1, n.getDate()); }
const _cgaHM = v => { const m = /(\d{2}):(\d{2})/.exec(String(v || '')); return m ? `${m[1]}:${m[2]}` : ''; };
function _cgaMin(v) { const t = Date.parse(String(v || '').replace(' ', 'T') + '+09:00'); return isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 60000)); }
function _cgaAgo(m) { if (m == null) return ''; if (m < 1) return '방금'; if (m < 60) return m + '분째'; return Math.floor(m / 60) + '시간 ' + (m % 60) + '분째'; }

// 오늘 CG 근무자: [{ id, name, tag }] — 근무표 순서
function _cgaPeople(ds) {
  const entry = data.schedule && data.schedule[ds]; if (!entry) return [];
  const lv = new Set((data.newLeaves && data.newLeaves[ds]) || []);
  const desk = new Set([entry.cg && entry.cg.desk8, entry.cg && entry.cg.desk, entry.cg && entry.cg.desk5].filter(Boolean));
  const ex = new Set([entry.danjik, typeof getDanjikExitStaff === 'function' ? getDanjikExitStaff(ds) : null, entry.satMorning, entry.morningDesk].filter(Boolean));
  const jo = new Set(getStaff('조근').map(x => x.id));
  const dept = id => String(deptOn(staffById(id), ds) || '').toLowerCase();
  const vwW = new Set((entry.vw && entry.vw.workers) || []);
  const out = [], seen = new Set();
  const add = (id, tag, needCgDept) => {
    if (!id || seen.has(id)) return;
    const s = staffById(id); if (!s) return;
    const d = dept(id);
    if (needCgDept ? (d !== 'cg' && d !== 'xr') : (d === 'vw' && vwW.has(id))) return;
    if (desk.has(id) || ex.has(id) || lv.has(id) || jo.has(id) || (typeof isProbation === 'function' && isProbation(s, ds))) return;
    seen.add(id); out.push({ id, name: s.name, tag });
  };
  ((entry.cg && entry.cg.workers) || []).forEach(id => add(id, dept(id) === 'xr' ? 'XR' : '', false));
  (entry.xr || []).forEach(id => add(id, 'XR', false));   // XR 근무(10-20)
  // 프로젝트 인원은 부서와 상관없이 늘 넣음(10-20) — 휴가·수습만 뺌
  (entry.project || []).forEach(id => { const s = staffById(id); if (!s || seen.has(id) || lv.has(id) || (typeof isProbation === 'function' && isProbation(s, ds))) return; seen.add(id); out.push({ id, name: s.name, tag: 'PROJECT' }); });
  [['8진', entry.weekend8jin], ['8진', entry.weekday8jin], ['8진', entry.weekend8jin2], ['8진', entry.weekday8jin2], ['뉴.오', entry.newsOh], ['뉴.오', entry.newsOh2], ['일근', entry.ilgeun]]
    .forEach(([t, id]) => { if (id && seen.has(id)) { const p = out.find(x => x.id === id); if (p && !p.tag) p.tag = t; } else add(id, t, true); });
  // 표에 보이는 그대로(10-21): 엑셀에서 가져온 칸·손으로 쓴 칸은 그 글자를 따름 — 예) 부서를 VW→CG로 옮겼는데 그날 목록은 예전 VW 그대로이고
  //   표의 CG 줄 칸엔 '정근'이 보이는 경우. 그냥 목록만 있는 칸(VW 대체 등)은 위에서 이미 셈. 회색(특별 작업)·집계 제외 칸은 뺌
  if (typeof WORK_TYPE_MAP !== 'undefined' && typeof _normalizeImportedWorkType === 'function') (data.staff || []).forEach(s => {
    if (!s || seen.has(s.id)) return;
    const d = dept(s.id); if (d !== 'cg' && d !== 'xr') return;
    const imp = typeof _importCellDisplay === 'function' ? _importCellDisplay(entry, s.id, [...lv]) : null, cus = entry.customCells && entry.customCells[s.id];
    const text = imp ? imp.text : (cus && cus.text); if (!text) return;
    if (imp ? (entry.importedCells[s.id] || {}).gray : cus.excl) return;
    const k = WORK_TYPE_MAP[_normalizeImportedWorkType(text)];
    const t = (k === 'work' || k === 'cg-sub') ? (d === 'xr' ? 'XR' : '') : (k === '8jin' || k === '8jin2') ? '8진' : (k === 'newsoh' || k === 'newsoh2') ? '뉴.오' : k === 'ilgeun' ? '일근' : undefined;
    if (t !== undefined) add(s.id, t, true);
  });
  // 손으로 넣고 뺀 사람(그날만) — 10-21부터 모든 PC 공용(nd_data 'cgman' adj, 5초마다 맞춤)
  const adj = _cgaAdjGet(), del = new Set(adj.del || []);
  (adj.add || []).forEach(id => { const s = staffById(id); if (s && !seen.has(id)) { seen.add(id); out.push({ id, name: s.name, tag: _cgaRoleTag(s.name, ds), added: true }); } });
  const idx = new Map((data.staff || []).map((s, i) => [s.id, i]));
  const fl = id => (staffById(id) && staffById(id).employmentType === 'freelancer') ? 1 : 0;
  return out.filter(p => !del.has(p.id)).sort((a, b) => (fl(a.id) - fl(b.id)) || ((idx.get(a.id) ?? 9999) - (idx.get(b.id) ?? 9999)));
}
// 누가 바꿀 수 있나(10-21 사용자): 그날 데스크(8데스크·5데스크·오전데)와 최재영(마스터 — 늘 가능)만 사람 넣고 빼기·의뢰 배정·직접 배정·완료. 다른 사람은 보기만(크게 보기·인쇄·의뢰 숨기기는 됨)
function _cgaCanEdit() {
  if (typeof isMaster !== 'undefined' && isMaster) return true;
  const u = typeof currentUser !== 'undefined' && currentUser; if (!u) return false;
  const me = (u.staffId && staffById(u.staffId)) || (data.staff || []).find(s => s.name === u.name); if (!me) return false;
  if (String(me.name || '').replace(/\s/g, '') === '최재영') return true;
  const e = data.schedule && data.schedule[_cgaToday()]; if (!e) return false;
  return [e.cg && e.cg.desk8, e.cg && e.cg.desk, e.cg && e.cg.desk5, e.morningDesk].includes(me.id);
}
function _cgaNoEdit() { toast('오늘 데스크(8데스크·5데스크·오전데)만 바꿀 수 있어요.', 'error'); return true; }
// 사람 넣고 빼기 = 공용(10-21 '다른 PC도 똑같이'): 화면 먼저 바꾸고(낙관적) nd_data 'cgman'.adj[날짜] = { add:[], del:[] } 에 낙관적 잠금으로 저장
function _cgaAdjGet() { const a = _cgmData && _cgmData.adj && _cgmData.adj[_cgaToday()]; return { add: (a && a.add) || [], del: (a && a.del) || [] }; }
async function _cgaAdjSet(fn) {
  const day = _cgaToday();
  _cgmData = _cgmData || { days: {} }; _cgmData.adj = _cgmData.adj || {};
  const loc = _cgmData.adj[day] = _cgaAdjGet(); fn(loc); _cgaPaint();
  const ok = await _cgmCommit(p => { p.adj = (p.adj && typeof p.adj === 'object') ? p.adj : {}; const v = p.adj[day] = { add: (p.adj[day] && p.adj[day].add) || [], del: (p.adj[day] && p.adj[day].del) || [] }; fn(v); });
  if (!ok) { toast('저장하지 못했어요. 잠시 뒤 다시 해 주세요.', 'error'); await _cgmLoad(); }
  _cgaPaint();
}
function _cgaDel(id) {
  if (!_cgaCanEdit()) return _cgaNoEdit();
  const s = staffById(id); if (!s) return;
  document.getElementById('cga-delask')?.remove();
  const el = document.createElement('div'); el.id = 'cga-delask'; el.className = 'wt-pop';
  el.innerHTML = `<div class="wt-card cga-ask-card" role="dialog" aria-modal="true" aria-labelledby="cga-delask-t">
    <div class="wt-head cga-del-head" id="cga-delask-t">사람 빼기</div>
    <div class="wt-body"><p class="cga-ask-q"><b>${_cgaEsc(s.name)}</b>님을 오늘 CG배정 현황에서 뺄까요?</p>
      <p class="cga-ask-who">오늘만 빠지고, 모든 PC에 같이 보여요. [사람 추가]에서 다시 넣을 수 있어요.</p></div>
    <div class="wt-foot"><button type="button" class="wt-cancel">취소</button><button type="button" class="wt-go cga-del-go">빼기</button></div>
  </div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('click', e => { if (e.target === el) close(); });
  el.querySelector('.wt-cancel').onclick = () => close();
  const go = el.querySelector('.wt-go'); go.focus();
  go.onclick = () => { close(); _cgaAdjSet(v => { v.add = v.add.filter(x => x !== id); if (!v.del.includes(id)) v.del.push(id); }); };
}
function _cgaAdd(id) {
  document.getElementById('cga-pick')?.remove();
  if (!_cgaCanEdit()) return _cgaNoEdit();
  // 원래 그날 근무자인지(넣기·빼기를 잠깐 비우고 계산) — 아니면 넣기 목록에도
  const day = _cgaToday(); _cgmData = _cgmData || { days: {} }; _cgmData.adj = _cgmData.adj || {};
  const saved = _cgmData.adj[day]; _cgmData.adj[day] = { add: [], del: [] };
  const inBase = _cgaPeople(day).some(p => p.id === id);
  if (saved) _cgmData.adj[day] = saved; else delete _cgmData.adj[day];
  _cgaAdjSet(v => { v.del = v.del.filter(x => x !== id); if (!inBase && !v.add.includes(id)) v.add.push(id); });
}
function _cgaHide(id) { const v = _cgaLocal('nd_cga_hide'); v.ids = [...new Set([...(v.ids || []), id])]; _cgaSave('nd_cga_hide', v); _cgaPaint(); }
function _cgaUnhide() { _cgaSave('nd_cga_hide', { day: _cgaToday(), ids: [] }); _cgaPaint(); }
// [사람 추가] 작은 창: 이름 찾기 + 오늘 뺀 사람 다시 넣기
function _cgaPick(btn) {
  const old = document.getElementById('cga-pick'); if (old) { old.remove(); return; }
  if (!_cgaCanEdit()) return _cgaNoEdit();
  const ds = _cgaToday(), on = new Set(_cgaPeople(ds).map(p => p.id)), del = new Set(_cgaAdjGet().del || []);
  const list = (data.staff || []).filter(s => s && s.name && !on.has(s.id) && (typeof isContractActive !== 'function' || isContractActive(s, ds)));
  const el = document.createElement('div'); el.id = 'cga-pick'; el.className = 'cga-pick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '사람 추가');
  el.innerHTML = '<div class="cga-pick-h">사람 추가 <small>오늘만 · 모든 PC에 같이 보여요</small></div><input type="search" class="cga-pick-q" placeholder="이름 쓰고 엔터" aria-label="이름 찾기 — 엔터로 바로 넣기"><div class="cga-pick-list"></div>';
  const paint = q => {
    const f = list.filter(s => !q || s.name.includes(q));
    const row = s => `<button type="button" data-id="${_cgaEsc(s.id)}"><b>${_cgaEsc(s.name)}</b><small>${_cgaEsc(_cgaRoleTag(s.name, ds))}</small>${del.has(s.id) ? '<em>뺀 사람</em>' : ''}</button>`;
    el.querySelector('.cga-pick-list').innerHTML = f.length ? [...f.filter(s => del.has(s.id)), ...f.filter(s => !del.has(s.id))].map(row).join('') : '<p>찾는 사람이 없어요.</p>';
  };
  el.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) _cgaAdd(b.dataset.id); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') el.remove();
    else if (e.key === 'Enter' && e.target.classList.contains('cga-pick-q') && !e.isComposing) { e.preventDefault(); const b = el.querySelector('.cga-pick-list button[data-id]'); if (b) _cgaAdd(b.dataset.id); }   // 이름 쓰고 엔터 = 맨 위 사람 바로 넣기
  });
  el.querySelector('.cga-pick-q').addEventListener('input', e => paint(e.target.value.trim()));
  document.body.appendChild(el); paint('');
  const r = btn.getBoundingClientRect();
  el.style.top = (r.bottom + 8) + 'px'; el.style.left = Math.max(12, Math.min(innerWidth - el.offsetWidth - 12, r.right - el.offsetWidth)) + 'px';
  el.querySelector('.cga-pick-q').focus();
  const off = e => { if (!el.isConnected) { document.removeEventListener('mousedown', off, true); return; } if (!el.contains(e.target) && !btn.contains(e.target)) { el.remove(); document.removeEventListener('mousedown', off, true); } };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
}

function renderCgAssign() {
  const root = document.getElementById('cga-root'); if (!root) return;
  if (!root.dataset.built) {
    root.dataset.built = '1';
    root.innerHTML = `<div class="cga-head">
        <div><h2 class="cga-title">CG배정 현황</h2><div class="cga-sub" id="cga-sub"></div></div>
        <div class="cga-stat" id="cga-stat"></div>
        <button type="button" class="cga-addp" onclick="_cgaPick(this)"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>사람 추가</button>
        <button type="button" class="cga-refresh" onclick="_cgaFetch(true)" title="지금 새로고침" aria-label="지금 새로고침"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg></button>
      </div>
      <div class="cga-msg" id="cga-msg" role="status"></div>
      <div class="cga-body"><aside class="cga-side" id="cga-side"><section class="cga-box"><h3>배정 기다리는 의뢰 <span id="cga-reqn">…</span></h3><div class="cga-reqs" id="cga-reqs"></div><p class="cga-none" id="cga-none" hidden>지금 기다리는 의뢰가 없어요.</p><button type="button" class="cga-unhide" id="cga-unhide" onclick="_cgaUnhide()" hidden></button></section></aside><div class="cga-grid" id="cga-grid"></div></div>
      <button type="button" class="cga-demo" onclick="_cgaDemo()" title="가짜 의뢰가 들어오는 모습을 이 화면에서만 보여 줘요(NDS엔 아무것도 안 가요)">시험 의뢰</button>`;   // 자주 안 써서 화면 오른쪽 아래 구석(10-21 사용자)
  }
  const g = document.getElementById('cga-grid');
  if (!g._ctx) { g._ctx = true; g.addEventListener('contextmenu', _cgaCtx);
    g.addEventListener('click', e => { if (e.target.closest('.cga-x, .cga-done')) return; const j = e.target.closest('.cga-job[data-rid]'); if (!j) return; const id = Number(j.dataset.rid) || 0; if (id) _cgaReqOpen(id); });   // 배정된 의뢰 칸 → 크게 보기(10-21, 시험 의뢰도)
  }
  _cgaWireDnd();   // 의뢰 → 사람 카드 끌어다 놓기 배정(10-21)   // 카드 오른쪽 클릭 → CG·앵커터치·PT 직접 배정/완료
  if (CGA_PERSON_POP && !g._wired) {   // 카드 누르면 그 사람 오늘 CG(× 는 빼기)
    g._wired = true;
    const open = e => { if (e.target.closest('.cga-x, .cga-done')) return; const c = e.target.closest('.cga-card[data-name]'); if (c && !c.classList.contains('cga-leaving')) _cgaPersonPop(c.dataset.name); };
    g.addEventListener('click', open);
    g.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cga-card')) { e.preventDefault(); open(e); } });
  }
  _cgaPaint();
  requestAnimationFrame(_cgaFit);
  _cgaFetch(false);
  clearInterval(_cgaTimer); _cgaTimer = setInterval(() => { if (currentView !== 'cgassign') { clearInterval(_cgaTimer); _cgaTimer = null; return; } if (document.visibilityState === 'visible') _cgaFetch(false); }, CGA_POLL);
  clearInterval(_cgaTick); _cgaTick = setInterval(() => { if (currentView !== 'cgassign') { clearInterval(_cgaTick); _cgaTick = null; return; } _cgaAgoFill(); }, 30000);   // '몇 분째'만 갱신
  // 직접 배정·사람 넣고 빼기(공용 'cgman')는 5초마다 — 다른 PC에서 바꾼 게 5초 안에 보이게(10-21). 바뀌었을 때만 다시 그림
  clearInterval(_cgmTimer); _cgmTimer = setInterval(async () => {
    if (currentView !== 'cgassign') { clearInterval(_cgmTimer); _cgmTimer = null; return; }
    if (document.visibilityState !== 'visible' || _cgaPull) return;
    const before = JSON.stringify(_cgmData || null); await _cgmLoad();
    if (JSON.stringify(_cgmData || null) !== before) _cgaPaint();
  }, 5000);
}
// 왼쪽 의뢰 창 아래 끝 = 사이드바 아래 끝에서 (사이드바 위 끝 ~ 'CG배정 현황' 글자) 만큼 위(10-20 사용자: 위아래 여백 같게). 좁아서 한 줄로 쌓이면 원래대로
function _cgaFit() {
  const side = document.getElementById('cga-side'), nav = document.getElementById('side-nav'), t = document.querySelector('#cga-root .cga-title'), body = document.querySelector('#cga-root .cga-body');
  if (!side || !body) return;
  if (!nav || !t || !nav.offsetWidth || getComputedStyle(side).position !== 'sticky') { side.style.height = ''; return; }
  const n = nav.getBoundingClientRect(), sy = window.scrollY || 0;
  const gap = Math.max(0, (t.getBoundingClientRect().top + sy) - n.top);
  if (sy > 4) return;   // 내려 둔 상태(창이 위에 붙음)에선 재지 않음 — 맨 위일 때 잰 값 유지
  const h = Math.round((n.bottom - gap) - side.getBoundingClientRect().top);
  side.style.height = h > 240 ? h + 'px' : '';
}
addEventListener('resize', () => { if (typeof currentView !== 'undefined' && currentView === 'cgassign') _cgaFit(); });
async function _cgaFetch(manual) {
  if (_cgaBusy) return;
  await _cgmLoad();   // 직접 배정(앵커·PT) — 여러 PC 공용
  if (!(typeof ND_APP !== 'undefined' && ND_APP && window.ndApp && window.ndApp.ndsCg)) {
    _cgaErr = (typeof ND_APP !== 'undefined' && ND_APP) ? '근무표 앱을 업데이트하면 볼 수 있어요. 오른쪽 위 렌치에서 업데이트해 주세요.' : 'CG배정 현황은 근무표 PC 앱에서 볼 수 있어요.';
    _cgaPaint(); return;
  }
  _cgaBusy = true;
  if (typeof _checkRemoteUpdate === 'function') _checkRemoteUpdate().catch(() => {});   // 근무표가 바뀌었으면 받아 둠(인원 계산용) — 보통 2분 → 이 화면은 20초
  const btn = document.querySelector('#cga-root .cga-refresh'); if (btn) btn.classList.add('spin');
  try {
    const r = await window.ndApp.ndsCg(_cgaToday());
    // 시험용 가짜 의뢰(개발판에서 애니메이션 볼 때만 — window._cgaFakeRows, id 는 음수. NDS 로 안 감)
    if (r && r.ok && Array.isArray(window._cgaFakeRows)) r.rows = r.rows.concat(window._cgaFakeRows.filter(x => !r.rows.some(y => y.id === x.id)));
    if (r && r.ok && window._cgaFakeCue8 && (!r.cue8 || window._cgaFakeCue8.force)) r.cue8 = window._cgaFakeCue8;   // 시험용 8뉴스 큐시트(큐시트가 안 오거나 시험에 쓸 이름이 모자랄 때)
    if (r && r.ok) { _cgaNotifyNew(r); _cgaData = r; _cgaErr = ''; }
    else _cgaErr = !r ? 'NDS에서 읽지 못했어요.' : r.reason === 'noaccount' ? 'NDS 공용 계정이 이 PC에 없어요.' : r.reason === 'login' ? 'NDS 로그인 실패: ' + (r.error || '') : (r.error || 'NDS에서 읽지 못했어요.');
  } catch (e) { _cgaErr = 'NDS에서 읽지 못했어요.'; }
  finally { _cgaBusy = false; if (btn) setTimeout(() => btn.classList.remove('spin'), 400); }
  _cgaPaint();
  if (manual && !_cgaErr) toast('새로 읽었어요.', 'success');
}
// 근무표 CG 인원이 아닌데 지금 CG를 하는 사람(데스크·XR 등) 카드에 붙일 그날 역할
function _cgaRoleTag(name, ds) {
  const s = (data.staff || []).find(x => x.name === name); if (!s) return '근무표 밖';
  const e = (data.schedule && data.schedule[ds]) || {}, id = s.id;
  if (e.cg && (e.cg.desk8 === id || e.cg.desk === id)) return '8데스';
  if (e.cg && e.cg.desk5 === id) return '5데스';
  if (e.morningDesk === id) return '오전데';
  if (e.vw && e.vw.desk === id) return 'VW데';
  if (e.danjik === id) return '당직';
  return String(deptOn(s, ds) || '근무').toUpperCase();
}
// 새 의뢰(0001)가 생기면 한 번 알림 — 처음 읽을 때는 기억만
// 의뢰 제목으로 일 종류 짐작(10-21 사용자): '앵커터치'·'앵터'·'8터치' → 앵커터치(빨강), 'PT'·그냥 '터치' → PT(주황), 아니면 ''(CG 파랑)
function _cgaKw(title) {
  const t = String(title || '');
  if (/앵커\s*터치|앵터|8\s*터치/.test(t)) return 'anchor';
  if (/터치/.test(t) || /(^|[^A-Za-z])PT([^A-Za-z]|$)/i.test(t)) return 'pt';
  return '';
}
// 8뉴스 의뢰 큐시트 순서(10-21 사용자): 8시뉴스 의뢰를 그날 8뉴스 큐시트(빈 줄 뺀 순서)에서 찾아 번호 — 1~10번째는 가장 먼저 방송되니 목록 맨 위에 급한 순서대로·빨강주황 바탕·오른쪽 위 번호.
// 찾는 순서: 제목 맨 앞 이름(보통 '전병남 8리 CG 4컷'처럼 리포트 기자 이름) → 제목 속 아무 큐시트 기자 이름(맨 앞에 가까운 것) → 요청자 이름. 같은 기자가 여러 줄이면 앞 줄.
// 큐시트 줄은 앱이 의뢰 목록과 같이 줌(desktop/nds-cue.js cue8 — 앱 1.2.8~, 없으면 번호 없이 예전 그대로)
const CGA_URGENT = 10, CGA_NOT_NAME = new Set(['정치', '사회', '경제', '국제', '문화', '스포츠', '캐스터', '기상', '단신', '날씨']);
function _cga8Rank(r, cue) {
  const c = cue || (_cgaData && _cgaData.cue8); if (!c || !Array.isArray(c.items) || !r || (c.pgmId && r.pgm !== c.pgmId)) return 0;
  const by = new Map(); c.items.forEach(it => { const n = String(it.rptr || '').trim(); if (/^[가-힣]{2,5}$/.test(n) && !CGA_NOT_NAME.has(n) && !by.has(n)) by.set(n, it.no); });
  const t = String(r.title || '').replace(/^\s*(\[[^\]]*\]|\([^)]*\)|<[^>]*>)\s*/, ''), lead = (t.match(/^\s*([가-힣]{2,5})/) || [])[1];
  if (lead && by.has(lead)) return by.get(lead);
  let best = 0, at = Infinity; by.forEach((no, n) => { const i = t.indexOf(n); if (i >= 0 && i < at) { at = i; best = no; } });
  return best || by.get(String(r.requester || '').trim()) || 0;
}
// 시험 의뢰(10-21 사용자 '실제 의뢰가 오기 전에 어떻게 들어오는지 보여 줄 수 있게'): [시험 의뢰]를 누르면 가짜 의뢰가 몇 초 간격으로 하나씩 들어옴 —
// 들어오는 모양·알림 카드·8뉴스 1~10번째(맨 위·빨강주황·빨간 번호)·끌어다 배정(가짜는 화면에서만 배정됨)까지 실제처럼. NDS 에는 아무것도 안 가고 이 PC 화면에서만(window._cgaFakeRows).
// 8뉴스는 오늘 큐시트 기자 이름을 빌려 진짜 번호가 붙게(큐시트가 없거나 이름이 모자라면 가짜 큐시트). 다시 누르거나 10분 지나면 끝
let _cgaDemoT = [];
function _cgaDemoOn() { return Array.isArray(window._cgaFakeRows) && window._cgaFakeRows.some(x => x.demo); }
function _cgaDemoBtn() { const b = document.querySelector('#cga-root .cga-demo'); if (!b) return; const on = _cgaDemoOn(); b.classList.toggle('on', on); b.textContent = on ? '시험 끝내기' : '시험 의뢰'; }
function _cgaDemoApply() {   // NDS 를 다시 읽지 않고 바로 화면에(새 의뢰 알림 카드도)
  if (!_cgaData || _cgaData.day !== _cgaToday()) return;
  _cgaData.rows = (_cgaData.rows || []).filter(x => x.id > 0).concat(window._cgaFakeRows || []);
  if (window._cgaFakeCue8 && (!_cgaData.cue8 || window._cgaFakeCue8.force)) _cgaData.cue8 = window._cgaFakeCue8;
  _cgaNotifyNew(_cgaData); _cgaPaint(); _cgaDemoBtn();
}
function _cgaDemo() {
  if (_cgaDemoOn()) return _cgaDemoEnd();
  if (!_cgaData || _cgaData.day !== _cgaToday()) { toast('NDS 의뢰를 먼저 불러온 뒤에 해 주세요.', 'error'); return; }
  const ok = it => /^[가-힣]{2,5}$/.test(String(it.rptr || '')) && !CGA_NOT_NAME.has(it.rptr);
  let cue = _cgaData.cue8, names = cue && Array.isArray(cue.items) ? cue.items.filter(ok) : [];
  if (names.filter(i => i.no <= 10).length < 2 || !names.some(i => i.no > 10)) {
    cue = window._cgaFakeCue8 = { pgmId: (cue && cue.pgmId) || 39, fake: true, force: !!cue, items: ['김시험', '박예시', '이보기', '최연습', '정샘플', '한데모', '오시험', '윤예제', '장연습', '임보기', '강샘플', '조예시'].map((r, i) => ({ no: i + 1, rptr: r, title: '[시험] 리포트 ' + (i + 1) })) };
    names = cue.items;
  }
  const A = names.find(i => i.no >= 5 && i.no <= 10) || names.filter(i => i.no <= 10).pop();
  const B = names.find(i => i.no <= 4 && i !== A) || names.find(i => i.no <= 10 && i !== A), C = names.find(i => i.no > 10);
  const base = -(Date.now() % 1e6) * 10, pg = cue.pgmId || 39;
  const rows = [
    { requester: '편집제작부', requesterDept: '뉴스브리핑', title: '[시험] 뉴브A 무빙CG 2', reqCnt: 2, pgm: 53 },
    { requester: A.rptr, requesterDept: '사회부', title: `${A.rptr} 8리 CG 3컷 [시험]`, reqCnt: 3, pgm: pg },
    { requester: '시험요청', requesterDept: '정치부', title: `${B.rptr} 8리 CG [시험] — 요청자와 리포트 기자가 달라도 제목 앞 이름으로 찾아요`, reqCnt: 1, pgm: pg },
    { requester: C.rptr, requesterDept: '경제부', title: `${C.rptr} 8리 그래픽 [시험]`, reqCnt: 1, pgm: pg },
  ];
  window._cgaFakeRows = [];
  _cgaDemoT.forEach(clearTimeout);
  _cgaDemoT = rows.map((r, i) => setTimeout(() => {
    if (!Array.isArray(window._cgaFakeRows)) return;
    window._cgaFakeRows.push(Object.assign({ id: base - i - 1, status: '0001', inputAt: _cgmNow(), designer: '', demo: true, content: `<p><b>(시험 의뢰)</b> 이 화면에서만 보이는 가짜 의뢰예요. NDS 에는 없어요.</p><p>${_cgaEsc(r.title)}</p>` }, r));
    _cgaDemoApply();
  }, 400 + i * 2600));
  _cgaDemoT.push(setTimeout(_cgaDemoEnd, 10 * 60e3));
  window._cgaFakeRows.push({ id: base, status: '0004', demo: true, title: '', designer: '' });   // 시험 중 표시용(목록·카드엔 안 나옴: 완료·디자이너 없음)
  _cgaDemoBtn(); _cgaPaint();
  toast('시험 의뢰가 몇 초 간격으로 들어와요. NDS엔 아무것도 안 가요.', 'success');
}
function _cgaDemoEnd() {
  _cgaDemoT.forEach(clearTimeout); _cgaDemoT = [];
  window._cgaFakeRows = null; window._cgaFakeCue8 = null;
  if (_cgaData) { _cgaData.rows = (_cgaData.rows || []).filter(x => x.id > 0); if (_cgaData.cue8 && _cgaData.cue8.fake) _cgaData.cue8 = null; }
  _cgaPaint(); _cgaDemoBtn();
  setTimeout(() => _cgaFetch(false), 300);   // 진짜 큐시트로 돌려놓기
}
function _cgaNotifyNew(r) {
  const req = (r.rows || []).filter(x => x.status === '0001');
  if (!_cgaSeen || _cgaSeen.day !== r.day) { _cgaSeen = { day: r.day, ids: new Set(req.map(x => x.id)) }; return; }
  const fresh = req.filter(x => !_cgaSeen.ids.has(x.id));
  fresh.forEach(x => _cgaSeen.ids.add(x.id));
  if (!fresh.length) return;
  const f = fresh[0], n8 = _cga8Rank(f, r.cue8), title = fresh.length > 1 ? `새 CG 의뢰 ${fresh.length}건` : n8 && n8 <= CGA_URGENT ? `급함 — 8뉴스 ${n8}번째 CG 의뢰가 들어왔어요` : '새 CG 의뢰가 들어왔어요';
  const body = fresh.length > 1 ? fresh.map(x => x.requester).filter(Boolean).join(', ') : `${f.requester}${f.requesterDept ? ' (' + f.requesterDept + ')' : ''}${f.title ? ' — ' + f.title : ''}`;
  if (window.ndApp && window.ndApp.toast) window.ndApp.toast({ title, body }); else toast(title + ' · ' + body, 'success');
}
// 칸 목록을 통째로 다시 그리지 않고 바뀐 것만 고침(10-20) — 그대로인 칸은 자리만 부드럽게 옮기고(FLIP), 내용이 바뀐 칸은 높이·내용이 스르륵,
// 새 칸은 enter(el, i)로 들어오고, 빠지는 칸은 그 자리에서 흐려지며 사라짐. items = [{ key, cls, html, attrs }]
function _cgaKeyed(host, items, enter) {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const old = new Map(); [...host.children].forEach(e => { if (e.dataset.k && !e.classList.contains('cga-leaving')) old.set(e.dataset.k, e); else if (!e.dataset.k) e.remove(); });
  const first = new Map(); old.forEach((e, k) => first.set(k, e.getBoundingClientRect()));
  const hostR = host.getBoundingClientRect(), keep = new Set(), fresh = [], changed = new Set();
  let prev = null;
  items.forEach(it => {
    let el = old.get(it.key);
    if (!el) { el = document.createElement('div'); el.dataset.k = it.key; fresh.push(el); }
    if (el.className !== it.cls) el.className = it.cls;
    Object.entries(it.attrs || {}).forEach(([a, v]) => { if (el.getAttribute(a) !== v) el.setAttribute(a, v); });
    if (el._h !== it.html) { if (el._h !== undefined) changed.add(el); el.innerHTML = it.html; el._h = it.html; }
    const ref = prev ? prev.nextSibling : host.firstChild;
    if (el !== ref) host.insertBefore(el, ref);
    prev = el; keep.add(it.key);
  });
  // 빠지는 칸: 제자리에 띄워 놓고 흐려지며 사라짐(나머지는 그 자리로 미끄러짐)
  old.forEach((e, k) => {
    if (keep.has(k)) return;
    const r = first.get(k);
    e.classList.add('cga-leaving');
    Object.assign(e.style, { position: 'absolute', left: (r.left - hostR.left + host.scrollLeft) + 'px', top: (r.top - hostR.top + host.scrollTop) + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0', pointerEvents: 'none' });
    if (reduce) { e.remove(); return; }
    e.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 380, easing: 'ease' }).onfinish = () => e.remove();
  });
  if (reduce) return;
  items.forEach(it => {
    const el = host.querySelector(`:scope > [data-k="${CSS.escape(it.key)}"]`); if (!el) return;
    const f = first.get(it.key);
    if (!f) return;
    const r = el.getBoundingClientRect(), dx = f.left - r.left, dy = f.top - r.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (changed.has(el)) {
      if (Math.abs(f.height - r.height) > 1) { el.style.overflow = 'hidden'; el.animate([{ height: f.height + 'px' }, { height: r.height + 'px' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => { el.style.overflow = ''; }; }
      const c = el.querySelector('.cga-cbody'); if (c) c.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'ease-out' });
    }
  });
  fresh.forEach((el, i) => enter(el, i));
}
// 'N분째' 글자만 따로(30초마다) — 칸 내용 비교(_h)에 안 들어가게
function _cgaAgoFill(root) {
  const roots = root ? [root] : [document.getElementById('cga-root'), document.getElementById('cgp-pop')].filter(Boolean);   // 화면 + 사람 팝업
  roots.forEach(rt => rt.querySelectorAll('[data-at]').forEach(e => {
    const m = _cgaMin(e.dataset.at), t = e.dataset.kind === 'wait' ? (m == null ? '' : m < 1 ? '방금' : m + '분째 대기') : _cgaAgo(m);
    if (e.textContent !== t) e.textContent = t;
    const req = e.closest('.cga-req'); if (req && e.dataset.kind === 'wait') req.classList.toggle('late', m != null && m >= 15);
  }));
}
let _cgaFirstPaint = true;
function _cgaPaint() {
  const grid = document.getElementById('cga-grid'); if (!grid) return;
  const ds = _cgaToday(), people = _cgaPeople(ds), d = new Date();
  const rows = (_cgaData && _cgaData.day === ds && _cgaData.rows) || [];
  const loaded = !!(_cgaData && _cgaData.day === ds);
  const byName = {};
  rows.forEach(r => { if (r.designer) (byName[r.designer] = byName[r.designer] || []).push(r); });
  const active = n => (byName[n] || []).filter(r => r.status === '0002').sort((a, b) => String(b.assignAt).localeCompare(String(a.assignAt)));
  // 카드에 없는 사람이 작업 중이면 그 사람 카드도(그날 역할 표시)
  const names = new Set(people.map(p => p.name));
  const extra = [...new Set(rows.filter(r => r.status === '0002' && r.designer && !names.has(r.designer)).map(r => r.designer))]
    .map(n => { const st = (data.staff || []).find(x => x.name === n); return { id: st ? st.id : '', name: n, tag: _cgaRoleTag(n, ds), extra: true }; })
    .filter(p => !(p.id && (_cgaAdjGet().del || []).includes(p.id)));
  const busy = n => active(n).length > 0 || _cgmActive(n).length > 0;   // NDS 배정 또는 직접 배정(CG·앵커터치·PT)
  // 배정이 오래된 사람부터(10-20): 작업 중 = 지금 하는 일 중 가장 최근 배정 시각이 이른 순, 대기 = 오늘 마지막 배정 시각이 이른 순(오늘 한 번도 없으면 맨 앞).
  // 시각은 NDS 배정(assignAt)과 직접 배정(at) 둘 다 'YYYY-MM-DD HH:MM:SS'(한국 시각)라 글자 비교. 같으면 근무표 순서 그대로(정렬이 안정적)
  const lastAt = (n, onlyActive) => [...(byName[n] || []).filter(r => (onlyActive ? r.status === '0002' : (r.status === '0002' || r.status === '0004'))).map(r => String(r.assignAt || '')),
    ..._cgmToday().filter(j => j.name === n && (!onlyActive || !j.done)).map(j => String(j.at || ''))].filter(Boolean).sort().pop() || '';
  const byOld = onlyActive => (x, y) => lastAt(x.name, onlyActive).localeCompare(lastAt(y.name, onlyActive));
  const work = [...people.filter(p => busy(p.name)), ...extra].sort(byOld(true)), idle = people.filter(p => !busy(p.name)).sort(byOld(false));
  const can = _cgaCanEdit();
  const sub = `CG제작 가능 인원 ${work.length + idle.length}명` + (can ? '' : ' · 배정·사람 넣고 빼기는 오늘 데스크만') + (_cgaDemoOn() ? ' · 시험 중(가짜 의뢰 — NDS엔 안 가요)' : '');   // 10-20 사용자: 날짜·기준 시각 등은 빼고 이것만
  const addBtn = document.querySelector('#cga-root .cga-addp'); if (addBtn) addBtn.style.display = can ? '' : 'none';
  const subEl = document.getElementById('cga-sub'); if (subEl.textContent !== sub) subEl.textContent = sub;
  const stat = loaded ? `<span class="cga-pill on"><i></i>작업 중 ${work.length}</span><span class="cga-pill">대기 ${idle.length}</span>` : '';
  const statEl = document.getElementById('cga-stat'); if (statEl._h !== stat) { statEl.innerHTML = stat; statEl._h = stat; }
  const msg = document.getElementById('cga-msg'); if (msg.textContent !== _cgaErr) msg.textContent = _cgaErr; msg.hidden = !_cgaErr;
  // 오른쪽: 사람 카드(작업 중 먼저). 성씨 동그라미는 뺌(10-20)
  const card = p => {
    const a = active(p.name), mj = _cgmActive(p.name), on = a.length > 0 || mj.length > 0;
    const manHtml = mj.map(j => `<div class="cga-job man k-${_cgmKey(j.kind)}"><div class="cga-who"><b>${_cgaEsc(j.kind)}</b><small>직접 배정${j.by ? ' · ' + _cgaEsc(j.by) : ''}</small>${can ? `<button type="button" class="cga-done" onclick="_cgmDone('${_cgaEsc(j.id)}')">완료</button>` : ''}</div>
        <div class="cga-time"><span>배정 <b>${_cgaHM(j.at)}</b></span><span class="cga-ago" data-at="${_cgaEsc(j.at)}"></span></div></div>`).join('');
    let body;
    if (!loaded) body = `<div class="cga-wait">${_cgaErr ? '' : '불러오는 중…'}</div>`;
    else if (on) body = `<div class="cga-now">작업 중<span class="cga-dots"><i>.</i><i>.</i><i>.</i></span></div>` + manHtml + a.slice(0, 2).map(r => `<div class="cga-job${_cgaKw(r.title) ? ' kw k-' + _cgaKw(r.title) : ''}" data-rid="${Number(r.id) || 0}" title="눌러서 의뢰 크게 보기">
        <div class="cga-who"><b>${_cgaEsc(r.requester || '요청자 없음')}</b>${r.requesterDept ? `<small>${_cgaEsc(r.requesterDept)}</small>` : ''}${r.reqCnt > 1 ? `<em>${r.reqCnt}건</em>` : ''}</div>
        ${r.title ? `<div class="cga-ttl" title="${_cgaEsc(r.title)}">${_cgaEsc(r.title)}</div>` : ''}
        <div class="cga-time"><span>의뢰 <b>${_cgaHM(r.inputAt)}</b></span><span>배정 <b>${_cgaHM(r.assignAt)}</b></span><span class="cga-ago" data-at="${_cgaEsc(r.assignAt)}"></span></div>
      </div>`).join('') + (a.length > 2 ? `<div class="cga-more">+${a.length - 2}건 더</div>` : '');
    else body = '<div class="cga-idle">대기 중</div>';   // 끝난 CG는 안 보여 줌(10-20)
    // 카드 빛 색(10-21 사용자): 손으로 넣은 앵커터치·PT·3D·XR 이나 제목에 PT·터치·앵터가 든 의뢰가 있으면 그 색(그중 최근 것) — 나중에 CG 의뢰가 붙어도
    // 그건 그 PT 내용이라 PT 색 그대로. 그런 게 없으면 CG 파랑
    const special = [...a.map(r => ({ at: String(r.assignAt || ''), k: _cgaKw(r.title) })), ...mj.map(j => ({ at: String(j.at || ''), k: _cgmKey(j.kind) }))]
      .filter(x => x.k && x.k !== 'cg').sort((x, y) => y.at.localeCompare(x.at))[0];
    const tone = on && special ? ' k-' + special.k : '';   // 앵커터치 빨강 · PT 주황 · 3D 보라 · XR 초록 · 그 밖 파랑
    return { key: 'p:' + (p.id || p.name), cls: 'cga-card' + (on ? ' on' : loaded ? ' off' : '') + tone + (CGA_PERSON_POP ? ' pop' : ''), attrs: Object.assign({ 'data-name': p.name, 'data-sid': p.id || '' }, CGA_PERSON_POP ? { role: 'button', tabindex: '0', 'aria-label': `${p.name} ${on ? '작업 중' : '대기'} — 오늘 처리한 CG 보기` } : { role: 'group', 'aria-label': `${p.name} ${on ? '작업 중' : '대기'} (오른쪽 클릭: CG·앵커터치·PT 배정)` }),
      html: `<span class="cga-dot" aria-hidden="true"></span>${p.id && can ? `<button type="button" class="cga-x" onclick="_cgaDel('${_cgaEsc(p.id)}')" title="오늘 이 화면에서 빼기" aria-label="${_cgaEsc(p.name)} 빼기">×</button>` : ''}
      <div class="cga-top"><div class="cga-nm"><b>${_cgaEsc(p.name)}</b><span class="cga-tag${p.extra ? ' x' : ''}">${_cgaEsc(p.tag || 'CG')}</span></div></div>
      <div class="cga-cbody">${body}</div>` };
  };
  const cards = [...work, ...idle].map(card);
  if (!cards.length) cards.push({ key: 'empty', cls: 'cga-empty', html: '오늘 근무표에 CG 근무자가 없어요.' });
  const firstPaint = _cgaFirstPaint && loaded; if (loaded) _cgaFirstPaint = false;
  _cgaKeyed(grid, cards, (el, i) => el.animate([{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: firstPaint ? i * 35 : 0, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  // 왼쪽: 배정 기다리는 의뢰(의뢰·보완요청), 오래된 것부터 위로 쌓임. 새 의뢰는 아래에서 스르륵 올라옴. 15분 넘으면 빨강, 보완요청은 회색(맨 아래), ×로 이 앱에서만 숨김
  const hid = new Set(_cgaLocal('nd_cga_hide').ids || []);
  const all = rows.filter(r => r.status === '0001' || r.status === '0003');
  const rk = new Map(all.map(r => { const n = r.status === '0001' ? _cga8Rank(r) : 0; return [r.id, n && n <= CGA_URGENT ? n : 0]; })), urg = r => rk.get(r.id) || 0;   // 8뉴스 1~10번째(10-21)
  const wait = all.filter(r => !hid.has(r.id)).sort((a, b) => ((a.status === '0003') - (b.status === '0003')) || ((urg(b) > 0) - (urg(a) > 0)) || (urg(a) - urg(b)) || String(a.inputAt).localeCompare(String(b.inputAt)));
  const nHid = all.length - wait.length, nReq = wait.filter(r => r.status === '0001').length;
  const item = r => {
    const fix = r.status === '0003', n8 = urg(r);
    return { key: 'r:' + r.id, cls: 'cga-req' + (fix ? ' fix' : can ? ' drag' : '') + (n8 ? ' urgent' : ''), attrs: fix ? { draggable: 'false' } : { draggable: 'false', 'data-rid': String(r.id), title: can ? '누르면 크게 보기 · 끌어서 사람 카드에 놓으면 배정' : '누르면 크게 보기' },
      html: `<button type="button" class="cga-x" onclick="_cgaHide(${Number(r.id) || 0})" title="이 앱에서만 숨기기(NDS엔 그대로)" aria-label="의뢰 숨기기">×</button>`
        + (n8 ? `<span class="cga-no" title="8뉴스 큐시트 ${n8}번째 아이템 — 먼저 방송돼요">${n8}</span>` : '')
        + `<div class="cga-who"><b>${_cgaEsc(r.requester)}</b>${r.requesterDept ? `<small>${_cgaEsc(r.requesterDept)}</small>` : ''}${r.reqCnt > 1 ? `<em>${r.reqCnt}건</em>` : ''}${fix ? '<em class="cga-fix">보완요청</em>' : ''}</div>`
        + (r.title ? `<div class="cga-ttl" title="${_cgaEsc(r.title)}">${_cgaEsc(r.title)}</div>` : '')
        + `<div class="cga-time"><span>의뢰 <b>${_cgaHM(r.inputAt)}</b></span>${fix ? '<span class="cga-ago">보완 기다림</span>' : `<span class="cga-ago" data-kind="wait" data-at="${_cgaEsc(r.inputAt)}"></span>`}</div>` };
  };
  const list = document.getElementById('cga-reqs');
  const cnt = document.getElementById('cga-reqn'), cntT = loaded ? String(nReq) : '…'; if (cnt.textContent !== cntT) cnt.textContent = cntT;
  if (!_cgaPull) _cgaKeyed(list, wait.map(item), (el, i) => {   // 물방울을 끄는 동안엔 목록을 다시 그리지 않음(끄는 칸이 바뀌지 않게)
    // 목록 바닥(창 아래)에서 올라와 제자리에 쌓임 — 새로 여러 건이면 하나씩
    const lb = list.getBoundingClientRect().bottom, r = el.getBoundingClientRect(), dy = Math.max(60, lb - r.top);
    // 10-20 '더 부드럽게 천천히': 1.5초, 하나씩 0.35초 간격, 끝에서 살짝 감속 + 흐릿→선명
    el.animate([{ opacity: 0, transform: `translateY(${dy}px) scale(.98)`, filter: 'blur(3px)' }, { opacity: .85, filter: 'blur(0)', offset: .55 }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 1500, delay: i * 350, easing: 'cubic-bezier(.22,.9,.24,1)', fill: 'backwards' });
  });
  const none = document.getElementById('cga-none'); none.hidden = !(loaded && !wait.length);
  const un = document.getElementById('cga-unhide'); un.hidden = !nHid; if (nHid) un.textContent = `숨긴 의뢰 ${nHid}건 다시 보이기`;
  _cgaAgoFill();
  _cgpPaint();   // 사람 팝업이 열려 있으면 같이
}

// 카드를 누르면: 왼쪽 이름·오늘 요약 / 오른쪽 오늘 처리한 CG(작업 중 + 완료, 최근 것부터). 열려 있는 동안 20초마다 같이 새로 그림
let _cgpName = '';
const CGP_SHOW_COUNTS = true;   // 완료·작업 중·요청 건수 칸
function _cgaPersonPop(name) {
  if (!name) return;
  document.getElementById('cgp-pop')?.remove();
  _cgpName = name;
  const el = document.createElement('div'); el.id = 'cgp-pop'; el.className = 'wt-pop';
  el.innerHTML = `<div class="wt-card cgp-card" role="dialog" aria-modal="true" aria-labelledby="cgp-t">
    <div class="wt-head cgp-head"><span id="cgp-t"></span><button type="button" class="cgp-x" aria-label="닫기"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="cgp-body"><aside class="cgp-left" id="cgp-left"></aside><section class="cgp-right"><h4>오늘 처리한 CG</h4><div class="cgp-list" id="cgp-list"></div></section></div>
  </div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); _cgpName = ''; document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.querySelector('.cgp-x').onclick = close;
  el.addEventListener('click', e => { if (e.target === el) close(); });
  _cgpPaint();
  el.querySelector('.cgp-x').focus();
}
function _cgpPaint() {
  const el = document.getElementById('cgp-pop'); if (!el || !_cgpName) return;
  const ds = _cgaToday(), name = _cgpName;
  const rows = ((_cgaData && _cgaData.day === ds && _cgaData.rows) || []).filter(r => r.designer === name && (r.status === '0002' || r.status === '0004'));
  const on = rows.filter(r => r.status === '0002'), done = rows.filter(r => r.status === '0004');
  const p = _cgaPeople(ds).find(x => x.name === name), tag = p ? (p.tag || 'CG') : _cgaRoleTag(name, ds);
  const cnt = rows.reduce((n, r) => n + (r.reqCnt || 1), 0);
  const mins = done.map(r => { const a = Date.parse(String(r.assignAt).replace(' ', 'T')), b = Date.parse(String(r.doneAt).replace(' ', 'T')); return isNaN(a) || isNaN(b) ? null : Math.max(0, Math.round((b - a) / 60000)); }).filter(x => x != null);
  const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null;
  const firstAssign = rows.map(r => r.assignAt).filter(Boolean).sort()[0], lastDone = done.map(r => r.doneAt).filter(Boolean).sort().pop();
  el.querySelector('#cgp-t').textContent = `${name}님의 오늘 CG`;
  el.querySelector('#cgp-left').innerHTML = `<div class="cgp-name">${_cgaEsc(name)}</div><span class="cga-tag">${_cgaEsc(tag)}</span>
    <div class="cgp-state${on.length ? ' on' : ''}"><i></i>${on.length ? '작업 중' : '대기 중'}</div>
    <div class="cgp-stats"${CGP_SHOW_COUNTS ? '' : ' hidden'}><div><b>${done.length}</b><small>완료</small></div><div><b>${on.length}</b><small>작업 중</small></div><div><b>${cnt}</b><small>요청 건수</small></div></div>
    <dl class="cgp-meta"><div><dt>첫 배정</dt><dd>${_cgaHM(firstAssign) || '—'}</dd></div><div><dt>마지막 완료</dt><dd>${_cgaHM(lastDone) || '—'}</dd></div><div><dt>평균 제작</dt><dd>${avg != null ? avg + '분' : '—'}</dd></div></dl>`;
  const list = [...on, ...done.sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)))];
  el.querySelector('#cgp-list').innerHTML = list.length ? list.map(r => {
    const live = r.status === '0002', took = live ? null : (() => { const a = Date.parse(String(r.assignAt).replace(' ', 'T')), b = Date.parse(String(r.doneAt).replace(' ', 'T')); return isNaN(a) || isNaN(b) ? null : Math.max(0, Math.round((b - a) / 60000)); })();
    return `<div class="cgp-row${live ? ' on' : ''}">
      <div class="cgp-row-h"><div class="cga-who"><b>${_cgaEsc(r.requester || '요청자 없음')}</b>${r.requesterDept ? `<small>${_cgaEsc(r.requesterDept)}</small>` : ''}${r.reqCnt > 1 ? `<em>${r.reqCnt}건</em>` : ''}</div><span class="cgp-badge">${live ? '작업 중' : '완료'}</span></div>
      ${r.title ? `<div class="cgp-ttl">${_cgaEsc(r.title)}</div>` : ''}
      <div class="cga-time"><span>의뢰 <b>${_cgaHM(r.inputAt)}</b></span><span>배정 <b>${_cgaHM(r.assignAt)}</b></span>${live ? '' : `<span>완료 <b>${_cgaHM(r.doneAt)}</b></span>`}<span class="cga-ago"${live ? ` data-at="${_cgaEsc(r.assignAt)}"` : ''}>${live ? '' : took != null ? took + '분 걸림' : ''}</span></div>
    </div>`;
  }).join('') : `<p class="cgp-none">${_cgaData ? '오늘 처리한 CG가 아직 없어요.' : '불러오는 중…'}</p>`;
  _cgaAgoFill(el);
}

// ── 직접 배정(10-20): CG(손으로)·앵커터치·PT 처럼 NDS에 안 올라오는 일 — 카드 오른쪽 클릭 → [CG 배정]/[앵커터치 배정]/[PT 배정]/[완료]
// 저장 = nd_data id='cgman'(main 밖 — 자주 바뀌어서), payload.days[날짜] = [{ id, sid, name, kind, at:'YYYY-MM-DD HH:MM:SS'(한국 시각), by, done }]
// 여러 PC가 같이 봄(20초마다 읽음). 쓸 때는 updated_at 낙관적 잠금 + 재시도. 7일 지난 날짜는 지움. 관리자 테스트 모드는 저장 안 함(화면에만)
const CGM_KINDS = ['CG', '앵커터치', 'PT', '3D CG', 'XR'];   // 앵커터치 = 흔히 '앵터'. 색: CG 파랑·앵커터치 빨강·PT 주황·3D CG 보라·XR 초록(10-21)
// 종류별 색(카드 빛·깜빡이는 점·'작업 중' 글자·칸 색이 이 색 — css --g: CG 파랑·앵커터치 빨강·PT 주황)과 메뉴 아이콘. NDS CG 배정도 'cg'(파랑)
const CGM_KIND = {
  'CG': { key: 'cg', ic: '<path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>' },
  '앵커터치': { key: 'anchor', ic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M8.5 21h7"/>' },
  'PT': { key: 'pt', ic: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/><path d="m8 12 3-3 2 2 3-3"/>' },
  '3D CG': { key: 'k3d', ic: '<path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z"/><path d="M3.5 7 12 11.5 20.5 7"/><path d="M12 11.5v10"/>' },
  'XR': { key: 'xr', ic: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3.5l-2-2.5h-3l-2 2.5H5a2 2 0 0 1-2-2z"/><circle cx="8" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/>' }
};
const _cgmKey = k => (CGM_KIND[k] && CGM_KIND[k].key) || 'cg';
const _cgmIc = k => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(CGM_KIND[k] || CGM_KIND.CG).ic}</svg>`;
let _cgmData = null;
const _cgmNow = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
function _cgmToday() { return ((_cgmData && _cgmData.days && _cgmData.days[_cgaToday()]) || []); }
function _cgmActive(name) { return _cgmToday().filter(j => j.name === name && !j.done).sort((a, b) => String(b.at).localeCompare(String(a.at))); }
async function _cgmLoad() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.cgman&select=payload`, { headers: SB_HEADERS, cache: 'no-store' });
    if (!r.ok) return;
    const a = await r.json();
    _cgmData = (a && a[0] && a[0].payload) || { days: {} };
  } catch (e) { /* 다음에 */ }
}
async function _cgmCommit(mutate) {
  if (typeof isAdminTest !== 'undefined' && isAdminTest) { _cgmData = _cgmData || { days: {} }; mutate(_cgmData); toast('관리자 테스트 모드라 저장되지 않아요(화면에만).', 'error'); return true; }
  const url = `${SB_URL}/rest/v1/nd_data?id=eq.cgman`;
  for (let attempt = 0; attempt < 6; attempt++) {
    let remote = null;
    try { const g = await fetch(`${url}&select=payload,updated_at`, { headers: SB_HEADERS, cache: 'no-store' }); if (!g.ok) return false; const a = await g.json(); remote = (a && a[0]) || null; }
    catch (e) { return false; }
    const pay = (remote && remote.payload && typeof remote.payload === 'object') ? remote.payload : {};
    if (!pay.days || typeof pay.days !== 'object') pay.days = {};
    mutate(pay);
    const keep = new Date(Date.now() + 9 * 3600e3 - 7 * 864e5).toISOString().slice(0, 10);
    Object.keys(pay.days).forEach(k => { if (k < keep) delete pay.days[k]; });
    if (pay.adj && typeof pay.adj === 'object') Object.keys(pay.adj).forEach(k => { if (k < keep) delete pay.adj[k]; });
    const nowIso = new Date().toISOString(), H = Object.assign({}, SB_HEADERS, { 'Prefer': 'return=representation' });
    try {
      if (!remote) {
        const pr = await fetch(`${SB_URL}/rest/v1/nd_data`, { method: 'POST', headers: H, body: JSON.stringify({ id: 'cgman', payload: pay, updated_at: nowIso }) });
        if (pr.ok) { _cgmData = pay; return true; }
        if (pr.status !== 409) return false;   // 그사이 누가 만들었으면 다시 읽고 고침
      } else {
        const pr = await fetch(`${url}&updated_at=eq.${encodeURIComponent(remote.updated_at)}`, { method: 'PATCH', headers: H, body: JSON.stringify({ payload: pay, updated_at: nowIso }) });
        if (!pr.ok) return false;
        const rows = await pr.json();
        if (Array.isArray(rows) && rows.length) { _cgmData = pay; return true; }
      }
    } catch (e) { return false; }
    await new Promise(res => setTimeout(res, 70 + attempt * 110 + Math.floor(Math.random() * 140)));
  }
  return false;
}
async function _cgmAssign(sid, name, kind) {
  document.getElementById('cga-ctx')?.remove();
  if (!_cgaCanEdit()) return _cgaNoEdit();
  const day = _cgaToday(), by = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '';
  const job = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), sid: sid || '', name, kind, at: _cgmNow(), by, done: null };
  const ok = await _cgmCommit(p => { (p.days[day] = p.days[day] || []).push(job); });
  if (!ok) { toast('저장하지 못했어요. 잠시 뒤 다시 해 주세요.', 'error'); return; }
  toast(`${name} — ${kind} 배정`, 'success');
  _cgaPaint();
}
async function _cgmDone(id) {
  document.getElementById('cga-ctx')?.remove();
  if (!_cgaCanEdit()) return _cgaNoEdit();
  const day = _cgaToday(), at = _cgmNow();
  let hit = null;
  const ok = await _cgmCommit(p => { const j = (p.days[day] || []).find(x => x.id === id); if (j && !j.done) { j.done = at; hit = j; } });
  if (!ok) { toast('저장하지 못했어요. 잠시 뒤 다시 해 주세요.', 'error'); return; }
  if (hit) toast(`${hit.name} — ${hit.kind} 완료`, 'success');
  _cgaPaint();
}
// 카드 오른쪽 클릭 메뉴
function _cgaCtx(e) {
  const c = e.target.closest('.cga-card[data-name]'); if (!c || c.classList.contains('cga-leaving')) return;
  e.preventDefault();
  if (!_cgaCanEdit()) return _cgaNoEdit();
  document.getElementById('cga-ctx')?.remove();
  const name = c.dataset.name, sid = c.dataset.sid || '', act = _cgmActive(name);
  const el = document.createElement('div'); el.id = 'cga-ctx'; el.className = 'cga-ctx'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', name + ' 직접 배정');
  el.innerHTML = `<div class="cga-ctx-h">${_cgaEsc(name)}</div>`
    + CGM_KINDS.map(k => `<button type="button" role="menuitem" data-act="as" data-kind="${_cgaEsc(k)}"><i class="cga-ctx-ic k-${_cgmKey(k)}">${_cgmIc(k)}</i>${_cgaEsc(k)} 배정</button>`).join('')
    + (act.length ? '<div class="cga-ctx-div"></div>' + act.map(j => `<button type="button" role="menuitem" data-act="done" data-id="${_cgaEsc(j.id)}"><i class="cga-ctx-ic ok">✓</i>${_cgaEsc(j.kind)} 완료 <small>${_cgaHM(j.at)}~</small></button>`).join('') : '')
    + (sid ? `<div class="cga-ctx-div"></div><button type="button" role="menuitem" data-act="del" class="dim">오늘 이 화면에서 빼기</button>` : '');
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-act]'); if (!b) return;
    if (b.dataset.act === 'as') _cgmAssign(sid, name, b.dataset.kind);
    else if (b.dataset.act === 'done') _cgmDone(b.dataset.id);
    else if (b.dataset.act === 'del') { el.remove(); _cgaDel(sid); }
  });
  document.body.appendChild(el);
  const x = Math.min(e.clientX, innerWidth - el.offsetWidth - 8), y = Math.min(e.clientY, innerHeight - el.offsetHeight - 8);
  el.style.left = Math.max(8, x) + 'px'; el.style.top = Math.max(8, y) + 'px';
  el.querySelector('button')?.focus();
  const off = ev => { if (!el.isConnected) { cleanup(); return; } if (!el.contains(ev.target)) { el.remove(); cleanup(); } };
  const onKey = ev => { if (ev.key === 'Escape') { el.remove(); cleanup(); } };
  const cleanup = () => { document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', onKey, true); removeEventListener('scroll', onScroll, true); };
  const onScroll = () => { el.remove(); cleanup(); };
  setTimeout(() => { document.addEventListener('mousedown', off, true); document.addEventListener('keydown', onKey, true); addEventListener('scroll', onScroll, true); }, 0);
}

// ── 끌어다 놓아 배정(10-21): 왼쪽 '의뢰'(0001)를 사람 카드에 놓으면 확인 창 → 내 NDS 로그인(WISE × N)으로 NDS 에 실제 배정(window.ndApp.ndsAssign, 앱 1.2.6~)
// 보완요청(0003)은 NDS 도 배정이 안 돼서 못 끎. 놓은 뒤 화면은 바로 '작업 중'으로 바꾸고(낙관적) NDS 를 다시 읽어 맞춤
// 10-21 '물방울' 끌기(iOS 26 처럼): 처음엔 자석에 붙은 듯 조금씩만 늘어나며 버티다가(고무줄) 일정 거리를 넘으면 '뾱' 하고 물방울이 떨어져 나와 손을 따라옴.
//   카드 위에서 놓으면 그 카드로 빨려 들어가며 배정 확인, 아무 데나 놓으면 물방울이 제자리로 돌아가 합쳐짐. 브라우저 기본 끌기 대신 포인터로 직접(그래야 이 느낌이 남)
const CGA_POP = 78;   // 이만큼(px) 끌면 떨어져 나옴
let _cgaPull = null;   // { it, id, sx, sy, pid, phase:0 잡음|1 버팀|2 떨어짐, drop, x, y, gx, gy, vx, vy, raf, hot }
function _cgaWireDnd() {
  const list = document.getElementById('cga-reqs'), grid = document.getElementById('cga-grid');
  if (!list || list._dnd) return; list._dnd = true;
  // 의뢰를 한 번 누르면 크게 보기(10-21) — × 는 숨기기. 끌다 놓은 뒤 따라오는 클릭은 무시
  list.addEventListener('click', e => {
    if (list._pulledAt && Date.now() - list._pulledAt < 400) { e.stopPropagation(); return; }
    if (e.target.closest('.cga-x')) return; const it = e.target.closest('.cga-req[data-k]'); if (!it) return;
    const id = Number(String(it.dataset.k).replace(/^r:/, '')); if (id) _cgaReqOpen(id);
  });
  list.addEventListener('dragstart', e => e.preventDefault());   // 브라우저 기본 끌기(그림 끌기 등) 끔
  list.addEventListener('pointerdown', e => {
    if (_cgaPull || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const it = e.target.closest('.cga-req.drag[data-rid]'); if (!it || e.target.closest('.cga-x') || !_cgaCanEdit()) return;
    _cgaPull = { it, id: Number(it.dataset.rid) || 0, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, pid: e.pointerId, phase: 0, vx: 0, vy: 0 };
  });
  document.addEventListener('pointermove', e => { const p = _cgaPull; if (!p || e.pointerId !== p.pid) return; p.x = e.clientX; p.y = e.clientY; _cgaPullMove(e); }, { passive: false });
  document.addEventListener('pointerup', e => { const p = _cgaPull; if (!p || e.pointerId !== p.pid) return; _cgaPullEnd(false); });
  document.addEventListener('pointercancel', e => { const p = _cgaPull; if (!p || e.pointerId !== p.pid) return; _cgaPullEnd(true); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _cgaPull && _cgaPull.phase) _cgaPullEnd(true); });
  void grid;
}
// 고무줄: 끈 만큼 다 안 가고 점점 덜 따라옴(최대 약 R)
function _cgaRubber(d, R) { return R * (1 - 1 / (d / R + 1)); }
// 10-21 다듬기: ① 잡으면 그 칸이 그 자리에서 카드로 스르륵(배경·그림자만 서서히, 글자는 그대로) ② 버티며 늘어남 ③ 넘으면 '그 카드 자체가' 뾱 떨어져
//   잡은 지점을 그대로 붙든 채 손을 따라옴(위에서 새로 생기지 않게) ④ 놓으면 카드로 빨려 들어가거나 제자리로 돌아가 합쳐짐
function _cgaPullMove(e) {
  const p = _cgaPull, dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy);
  if (p.phase === 0) {
    if (d < 5) return; p.phase = 1; document.body.classList.add('cga-pulling'); try { p.it.setPointerCapture(p.pid); } catch (x) {}
    // 목록 상자(스크롤 영역)에 잘리지 않게: 같은 칸을 화면 위(body)에 같은 자리로 띄워 그걸 움직임(위치는 transform 하나로)
    const r = p.it.getBoundingClientRect(), cs = getComputedStyle(p.it), g = document.createElement('div');
    const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    g.className = 'cga-pullghost' + (p.it.classList.contains('late') ? ' late' : '') + (p.it.classList.contains('urgent') ? ' urgent' : ''); g.setAttribute('aria-hidden', 'true');
    g.innerHTML = [...p.it.children].filter(c => !c.classList.contains('cga-x')).map(c => c.outerHTML).join('');
    Object.assign(g.style, { width: (r.width + 20) + 'px', minHeight: r.height + 'px', paddingLeft: (padL + 10) + 'px', paddingRight: (padR + 10) + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom });
    p.bx = r.left - 10; p.by = r.top; p.gw = r.width + 20;
    p.ox = p.sx - p.bx; p.oy = p.sy - p.by;   // 잡은 지점(카드 안 좌표) — 떨어진 뒤에도 이 점을 붙든 채 따라옴
    g.style.transform = `translate(${p.bx}px,${p.by}px)`;
    document.body.appendChild(g); p.ghost = g; p.it.classList.add('pulling');
  }
  if (e && e.cancelable) e.preventDefault();
  if (p.phase === 1) {
    const r = _cgaRubber(d, 36), ux = dx / (d || 1), uy = dy / (d || 1), a = Math.atan2(dy, dx) * 180 / Math.PI;
    const st = Math.min(.16, d / 520);   // 끄는 쪽으로 늘어남
    p.cx = p.bx + ux * r; p.cy = p.by + uy * r;
    p.ghost.style.transform = `translate(${p.cx}px,${p.cy}px) rotate(${a}deg) scale(${1 + st},${1 - st * .55}) rotate(${-a}deg)`;
    if (d > CGA_POP) _cgaPullPop();
  }
  // 떨어진 뒤: rAF 에서 손을 살짝 늦게 따라감(_cgaPullTick)
}
function _cgaPullPop() {
  const p = _cgaPull, it = p.it, g = p.ghost;
  p.phase = 2; p.drop = g; p.ghost = null;
  p.gx = p.cx; p.gy = p.cy;
  // 떨어져 나오며 유리 물방울로: 폭을 줄이되 잡은 지점은 손 아래 그대로
  const w = Math.min(p.gw, 280); p.w = w; p.ox = Math.min(p.ox, w - 24);
  g.classList.add('cga-drop'); g.style.width = w + 'px';
  try { g.animate([{ scale: '1' }, { scale: '1.07', offset: .45 }, { scale: '1' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1)', composite: 'add' }); } catch (x) {}
  p.h = g.offsetHeight;
  _cgaSlotClose(it);   // 떨어져 나간 칸은 목록에서 접혀 사라지고 아래 칸들이 올라와 메움(10-21)
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (x) {}
  document.body.classList.add('cga-dragging');
  const tick = () => { if (!_cgaPull || _cgaPull.phase !== 2) return; _cgaPullTick(); _cgaPull.raf = requestAnimationFrame(tick); };
  p.raf = requestAnimationFrame(tick);
}
function _cgaPullTick() {
  const p = _cgaPull, g = p.drop; if (!g) return;
  const tx = p.x - p.ox, ty = p.y - p.oy;
  const nx = p.gx + (tx - p.gx) * .32, ny = p.gy + (ty - p.gy) * .32;
  p.vx = nx - p.gx; p.vy = ny - p.gy; p.gx = nx; p.gy = ny;
  // 움직이는 쪽으로 살짝 늘어나는 물방울
  const v = Math.hypot(p.vx, p.vy), st = Math.min(.12, v / 100), a = Math.atan2(p.vy, p.vx) * 180 / Math.PI;
  g.style.transform = `translate(${nx}px,${ny}px) rotate(${a}deg) scale(${1 + st},${1 - st * .6}) rotate(${-a}deg)`;
  // 놓을 카드 표시
  const el = document.elementFromPoint(p.x, p.y), c = el && el.closest && el.closest('#cga-grid .cga-card[data-name]');
  if (c !== p.hot) { if (p.hot) p.hot.classList.remove('drop-hot'); if (c && !c.classList.contains('cga-leaving')) { c.classList.add('drop-hot'); p.hot = c; } else p.hot = null; g.classList.toggle('over', !!p.hot); }
}
function _cgaPullEnd(cancel) {
  const p = _cgaPull; if (!p) return; _cgaPull = null;
  cancelAnimationFrame(p.raf);
  const it = p.it, list = document.getElementById('cga-reqs');
  document.body.classList.remove('cga-pulling', 'cga-dragging');
  try { it.releasePointerCapture(p.pid); } catch (x) {}
  if (p.phase === 0) return;   // 그냥 누름 → 클릭(크게 보기)
  if (list) list._pulledAt = Date.now();
  if (p.phase === 1) {   // 덜 끌었음 → 고무줄처럼 '퐁' 제자리, 카드 모습은 서서히 목록 칸으로
    const g = p.ghost, done = () => { if (g) g.remove(); it.classList.remove('pulling'); };
    if (!g) { done(); return; }
    g.classList.add('back');
    try { const an = g.animate([{ transform: g.style.transform || 'none' }, { transform: `translate(${p.bx}px,${p.by}px)` }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' }); an.onfinish = done; } catch (x) { done(); }
    return;
  }
  const g = p.drop, card = !cancel && p.hot;
  if (p.hot) p.hot.classList.remove('drop-hot');
  if (card) {   // 카드로 빨려 들어감 → 배정 확인
    const r = card.getBoundingClientRect(), cx = r.left + r.width / 2 - p.w / 2, cy = r.top + Math.min(r.height / 2, 60) - p.h / 2;
    const an = g.animate([{ transform: g.style.transform, opacity: 1 }, { transform: `translate(${cx}px,${cy}px) scale(.35)`, opacity: 0 }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    an.onfinish = () => g.remove();
    try { card.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' }); } catch (x) {}
    _cgaAssignAsk(p.id, card.dataset.name, it);   // 확인 창이 떠 있는 동안 칸은 접힌 채, 취소하면 다시 벌어짐
    return;
  }
  // 아무 데도 아님 → 물방울이 제자리로 돌아가 합쳐짐
  const r = it.getBoundingClientRect(), bx = r.left - 10, by = r.top;
  g.classList.add('back');
  const an = g.animate([{ transform: g.style.transform, opacity: 1 }, { transform: `translate(${bx}px,${by}px)`, opacity: .15 }], { duration: 440, easing: 'cubic-bezier(.34,1.25,.64,1)', fill: 'forwards' });
  _cgaSlotOpen(it);   // 칸이 다시 벌어지며 물방울이 그 자리로 들어가 합쳐짐
  an.onfinish = () => { g.remove(); try { it.animate([{ transform: 'scale(.98)' }, { transform: 'scale(1.015)' }, { transform: 'none' }], { duration: 340, easing: 'ease-out' }); } catch (x) {} };
}
// 목록 칸 접기/펴기 — 접힌 동안은 높이·여백 0(안 보임), 펴면 원래 높이로 벌어지며 서서히 보임
const CGA_SLOT0 = { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', opacity: 0 };
function _cgaSlotClose(it) {
  const cs = getComputedStyle(it);
  it._slotFull = { height: it.offsetHeight + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth, opacity: 0 };
  it.style.overflow = 'hidden'; it.style.boxSizing = 'border-box';
  if (it._slot) it._slot.cancel();
  it._slot = it.animate([it._slotFull, CGA_SLOT0], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
}
function _cgaSlotOpen(it) {
  const full = it._slotFull; it.classList.remove('pulling');
  if (!full || !it.isConnected) { if (it._slot) it._slot.cancel(); it._slot = null; it._slotFull = null; return; }
  if (it._slot) it._slot.cancel();
  const an = it.animate([CGA_SLOT0, Object.assign({}, full, { opacity: 1 })], { duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)' });
  it._slot = an; it._slotFull = null;
  an.onfinish = () => { if (it._slot === an) it._slot = null; it.style.overflow = ''; it.style.boxSizing = ''; };
}
async function _cgaAssignAsk(id, name, slot) {
  const ds = _cgaToday(), rows = (_cgaData && _cgaData.day === ds && _cgaData.rows) || [];
  const reopen = () => { if (slot) _cgaSlotOpen(slot); };   // 배정 안 하고 닫으면 접어 둔 목록 칸을 다시 펼침
  if (!_cgaCanEdit()) { reopen(); return _cgaNoEdit(); }
  const r = rows.find(x => x.id === id); if (!r) { reopen(); toast('그 의뢰를 찾지 못했어요. 새로고침 뒤 다시 해 주세요.', 'error'); return; }
  document.getElementById('cga-ask')?.remove();
  const can = !!(window.ndApp && window.ndApp.ndsAssign);
  // NDS 가 배정 때 묻는 '알림(메시지)을 전송하시겠습니까?'를 여기 토글로 — 지난번 고른 대로 기억(이 PC, 처음엔 켜짐)
  let pushOn = true; try { const v = localStorage.getItem('nd_cga_push'); if (v !== null) pushOn = v === '1'; } catch (e) { /* 기본 켜짐 */ }
  const el = document.createElement('div'); el.id = 'cga-ask'; el.className = 'wt-pop';
  el.innerHTML = `<div class="wt-card cga-ask-card" role="dialog" aria-modal="true" aria-labelledby="cga-ask-t">
    <div class="wt-head cga-ask-head" id="cga-ask-t">CG 배정</div>
    <div class="wt-body">
      <p class="cga-ask-q"><b>${_cgaEsc(name)}</b>님에게 배정할까요?</p>
      <div class="cga-ask-req"><div class="cga-who"><b>${_cgaEsc(r.requester || '요청자 없음')}</b>${r.requesterDept ? `<small>${_cgaEsc(r.requesterDept)}</small>` : ''}${r.reqCnt > 1 ? `<em>${r.reqCnt}건</em>` : ''}</div>${r.title ? `<div class="cga-ttl">${_cgaEsc(r.title)}</div>` : ''}<div class="cga-time"><span>의뢰 <b>${_cgaHM(r.inputAt)}</b></span></div></div>
      <label class="cga-ask-push"><span><b>메시지 보내기</b><small>NDS 알림으로 ${_cgaEsc(name)}님에게 배정됐다고 알려요</small></span><input type="checkbox" role="switch" id="cga-ask-push" ${pushOn ? 'checked' : ''}><i class="cga-sw" aria-hidden="true"></i></label>
      <p class="cga-ask-who" id="cga-ask-who">${can ? '내 NDS 로그인 확인 중…' : '근무표 앱을 업데이트(1.2.6)하면 여기서 바로 배정할 수 있어요.'}</p>
      <p class="wt-status" id="cga-ask-st" role="status"></p>
    </div>
    <div class="wt-foot"><button type="button" class="wt-cancel">취소</button><button type="button" class="wt-go" ${can ? '' : 'disabled'}>배정</button></div>
  </div>`;
  document.body.appendChild(el);
  const close = ok => { el.remove(); document.removeEventListener('keydown', onKey, true); if (ok !== true) reopen(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.querySelector('.wt-cancel').onclick = () => close();
  el.addEventListener('click', e => { if (e.target === el) close(); });
  const go = el.querySelector('.wt-go'), st = el.querySelector('#cga-ask-st'), who = el.querySelector('#cga-ask-who');
  el.querySelector('#cga-ask-push').addEventListener('change', e => { try { localStorage.setItem('nd_cga_push', e.target.checked ? '1' : '0'); } catch (x) {} });
  go.focus();
  if (can && window.ndApp.ndsUserInfo) window.ndApp.ndsUserInfo(false).then(n => {
    if (!who.isConnected) return;
    if (n && n.loggedIn) who.textContent = `내 NDS 로그인(${n.name || n.id})으로 배정돼요.`;
    else { who.textContent = 'NDS에 로그인돼 있지 않아요. 위쪽 [WISE × NDS]에서 NDS를 연결해 주세요.'; who.classList.add('warn'); }
  }).catch(() => {});
  go.onclick = async () => {
    go.disabled = true; go.textContent = '배정하는 중…'; st.textContent = '';
    const hint = (rows.find(x => x.designer === name && Number(x.designerId) > 0) || {}).designerId || 0;
    const res = id < 0 ? (() => { const f = (window._cgaFakeRows || []).find(x => x.id === id); if (f) Object.assign(f, { status: '0002', designer: name, assignAt: _cgmNow() }); return { ok: true, designerId: 0 }; })()   // 가짜 의뢰는 화면에서만
      : await window.ndApp.ndsAssign({ id, name, hintId: hint, push: el.querySelector('#cga-ask-push').checked }).catch(e => ({ ok: false, error: e.message }));
    if (res && res.ok) {
      close(true);
      // 화면 먼저(낙관적) → NDS 다시 읽어 맞춤
      if (_cgaData && _cgaData.rows) { const x = _cgaData.rows.find(y => y.id === id); if (x) Object.assign(x, { status: '0002', designer: name, designerId: res.designerId || hint, assignAt: _cgmNow() }); }
      _cgaPaint(); toast(`${name}님에게 배정했어요.`, 'success');
      setTimeout(() => _cgaFetch(false), 1200);
    } else {
      go.disabled = false; go.textContent = '다시 배정';
      st.textContent = (res && res.error) || '배정하지 못했어요.';
      if (res && res.reason === 'state') setTimeout(() => _cgaFetch(false), 300);
    }
  };
}

// ── 의뢰 크게 보기·인쇄(10-21) — 왼쪽 의뢰를 누르면 큰 창(왼쪽 정보 / 오른쪽 본문), [인쇄] = NDS [인쇄 → 기본]과 같은 모양의 미리보기 → 프린터 골라 바로 인쇄 ──
// 본문은 NDS 편집기 HTML — 보여 주기 전에 위험한 것(script·iframe·on…·javascript:)은 지움
function _cgaSanitize(html) {
  try {
    const doc = new DOMParser().parseFromString('<div>' + String(html || '') + '</div>', 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form,link,meta,base').forEach((e) => e.remove());
    doc.querySelectorAll('*').forEach((e) => [...e.attributes].forEach((a) => {
      const n = a.name.toLowerCase(), v = String(a.value || '');
      if (n.startsWith('on') || ((n === 'href' || n === 'src' || n === 'xlink:href') && /^\s*(javascript|vbscript|data:text)/i.test(v))) e.removeAttribute(a.name);
    }));
    return doc.body.firstChild ? doc.body.firstChild.innerHTML : '';
  } catch (e) { return _cgaEsc(String(html || '').replace(/<[^>]+>/g, ' ')); }
}
async function _cgaReqOpen(id) {
  const ds = _cgaToday(), row = ((_cgaData && _cgaData.day === ds && _cgaData.rows) || []).find((x) => x.id === id) || {};
  document.getElementById('cga-view')?.remove();
  const el = document.createElement('div'); el.id = 'cga-view'; el.className = 'wt-pop';
  el.innerHTML = `<div class="wt-card cgv-card" role="dialog" aria-modal="true" aria-labelledby="cgv-t">
    <div class="wt-head cgv-head"><span id="cgv-t">CG 의뢰</span>
      <button type="button" class="cgv-print" disabled><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>인쇄</button>
      <button type="button" class="cgv-x" aria-label="닫기"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="cgv-body"><aside class="cgv-left" id="cgv-left">${_cgvInfo(row)}</aside><section class="cgv-right"><div class="cgv-content" id="cgv-content"><p class="cgv-wait">의뢰 내용 불러오는 중…</p></div></section></div>
  </div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape' && !document.getElementById('cga-pv')) { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.querySelector('.cgv-x').onclick = close; el.addEventListener('click', (e) => { if (e.target === el) close(); });
  el.querySelector('.cgv-x').focus();
  if (id < 0) { el.querySelector('#cgv-content').innerHTML = _cgaSanitize(row.content || '<p>(시험 의뢰) 화면에서만 보이는 가짜 의뢰예요.</p>'); const pb0 = el.querySelector('.cgv-print'); pb0.disabled = false; pb0.onclick = () => _cgaPrintPreview(Object.assign({ content: '' }, row)); return; }   // 가짜 의뢰
  if (!(window.ndApp && window.ndApp.ndsCgDetail)) { el.querySelector('#cgv-content').innerHTML = '<p class="cgv-wait">근무표 앱을 업데이트(1.2.7)하면 의뢰 내용을 볼 수 있어요.</p>'; return; }
  const r = await window.ndApp.ndsCgDetail(id).catch(() => null);
  if (!el.isConnected) return;
  if (!r || !r.ok) { el.querySelector('#cgv-content').innerHTML = `<p class="cgv-wait">${_cgaEsc((r && r.error) || 'NDS에서 의뢰를 못 읽었어요.')}</p>`; return; }
  const d = r.d;
  el.querySelector('#cgv-left').innerHTML = _cgvInfo(d);
  el.querySelector('#cgv-content').innerHTML = _cgaSanitize(d.content) || '<p class="cgv-wait">내용이 없어요.</p>';
  el.querySelectorAll('#cgv-content a[href]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  const pb = el.querySelector('.cgv-print'); pb.disabled = false; pb.onclick = () => _cgaPrintPreview(d);
}
function _cgvInfo(d) {
  const row = (k, v) => v ? `<div class="cgv-row"><span>${k}</span><b>${_cgaEsc(v)}</b></div>` : '';
  return `<div class="cgv-title">${_cgaEsc(d.title || '(제목 없음)')}</div>
    <div class="cgv-who"><b>${_cgaEsc(d.requester || '')}</b><small>${_cgaEsc(d.requesterDept || '')}</small>${(d.reqCnt || 1) > 1 ? `<em>${d.reqCnt}건</em>` : ''}</div>
    <div class="cgv-rows">${row('의뢰', d.inputAt)}${row('프로그램', d.program)}${row('상태', d.statusName || ({ '0001': '의뢰', '0002': '배정', '0003': '보완요청', '0004': '완료' })[d.status] || '')}${row('디자이너', d.designer)}${row('배정', d.assignAt)}${row('완료', d.doneAt)}</div>`;
}
// NDS PrintTemplate(request-cg, 기본)과 같은 마크업·스타일
// 인쇄 글자 크기 5단계(10-21 슬라이드) — 본문(그림 포함)을 이만큼 줄임, 마지막 = NDS 그대로
const CGA_PRINT_ZOOM = [0.7, 0.78, 0.85, 0.92, 1];
function _cgaPrintHtml(d, o = {}) {   // o = { gap: 빈 줄 줄이기, lh: 줄 간격 좁게, zoom: 글자 크기(1 = 그대로) } — 종이 아끼기(10-21), 없으면 NDS 그대로
  const L = 'style="width: 150px;"', V = 'style="margin: 0 5px; word-break:break-all;"', SPAN = 'colspan="3"';
  const tr = (k, v) => `<tr><td><div ${L}>${k}</div></td><td ${SPAN}><div ${V}>${_cgaEsc(v || '')}</div></td></tr>`;
  const table = `<table><tbody>${tr('제목', d.title)}${tr('의뢰일시', d.inputAt)}`
    + `<tr><td><div ${L}>취재기자</div></td><td><div ${V}>${_cgaEsc(d.requester || '')}</div></td><td style="border-left: 1px solid #dfe7ef;"><div ${L}>의뢰부서</div></td><td><div ${V}>${_cgaEsc(d.requesterDept || '')}</div></td></tr>`
    + `${tr('배정일시', d.assignAt)}${tr('완료일시', d.doneAt)}${tr('프로그램', d.program)}${tr('디자이너', d.designer)}`
    + `<tr><td colspan="4" style="text-align: left; border-right: 0;"><div style="padding-left: 4.1rem;">내용</div></td></tr></tbody></table>`;
  const css = `@page { margin: 10mm 15mm; }
    body { margin: 0; color: #000; font-family: 'Malgun Gothic','맑은 고딕',sans-serif; }
    img { max-width: 100%; height: auto; }
    div.print-title { width: 100%; text-align: center; }
    div.print-title > h2 { padding: 0; margin: 0; font-size: 18px; border-bottom: 2px solid #dfe7ef; margin-bottom: 15px; padding-bottom: 10px; }
    div.view-box > table { font-size: 16px; width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; }
    div.view-contents > div:first-child { border: 1px solid #dfe7ef; }
    div.view-contents > div:first-child > table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 5px; font-size: 10px; }
    div.view-contents > div:first-child > table > tbody > tr > td { width: 10px; text-align: left; border-bottom: 1px solid #dfe7ef; padding: 7px 0; }
    div.view-contents > div:first-child > table > tbody > tr > td:nth-child(odd) { border-right: 1px solid #dfe7ef; width: 10%; text-align: center; }
    div.print-content-place table { font-size: 16px; border-collapse: separate; border-spacing: 0; border: 0.1rem solid #dfe7ef; border-top: 0; border-bottom: 0; }
    div.print-content-place table > tbody > tr > td { border-top: 0.1rem solid #dfe7ef; border-left: 0.1rem solid #dfe7ef; }
    div.print-content-place table > tbody > tr > td:first-child { border-left: 0; }
    div.print-content-place table > tbody > tr:last-child > td { border-bottom: 0.1rem solid #dfe7ef; }
    div.print-content-place p, div.print-content-place div { white-space: pre-wrap; }
    div.print-content-place p { margin: 0; font-size: 10px; line-height: 1.9; }`
    + `div.print-content-place .pgap { display: block; height: 4px; }`
    + (o.lh ? `div.print-content-place, div.print-content-place p { line-height: 1.4; }` : '')
    + (o.zoom && o.zoom < 1 ? `div.print-content-place { zoom: ${Number(o.zoom)}; }` : '')
    + (o.tightEnd ? `div.print-content-place { padding-bottom: 0 !important; } div.view-contents > div:first-child { border-bottom: 0; }` : '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>CG의뢰</title><style>${css}</style></head><body><div class="print-box">`
    + `<div class="print-title"><h2>CG의뢰</h2></div><div class="view-box"><div class="view-contents"><div>${table}<div style="padding: 1.25rem;" class="print-content-place">${_cgaPrintBody(d.content, o)}</div></div></div></div></div></body></html>`;
}
// NDS PrintTemplate 과 같게 본문 손질: 이미지는 width="100%"를 빼고(원래 크기, 넘치면 줄임) 블록으로, 빈 문단은 줄바꿈 한 줄
function _cgaPrintBody(html, o = {}) {
  const clean = _cgaSanitize(html);
  try {
    const doc = new DOMParser().parseFromString('<div>' + clean + '</div>', 'text/html'), root = doc.body.firstChild;
    root.querySelectorAll('img').forEach((i) => { if (i.getAttribute('width') === '100%') i.removeAttribute('width'); i.style.maxWidth = '100%'; i.style.display = 'block'; });
    root.querySelectorAll('p').forEach((pp) => { if (!pp.querySelector('img') && !pp.textContent.replace(/\s/g, '')) pp.replaceWith(doc.createElement('br')); });
    if (o.gap) _cgaPrintGaps(doc, root);
    _cgaTrimEnd(root);   // 끝의 빈 줄은 늘 뺌(그것 때문에 글자 없는 장이 나오지 않게, 10-21)
    return root.innerHTML;
  } catch (e) { return clean; }
}
// 본문 끝의 빈 줄·빈 문단·끝 줄바꿈만 지움(글자·그림·표는 그대로) — 끝 빈 줄 때문에 다음 장에 표 테두리만 찍히던 것(10-21 사용자)
function _cgaTrimEnd(root) {
  const blank = (n) => n.nodeType === 8 || (n.nodeType === 3 && !n.nodeValue.replace(/[\s\u00a0]/g, ''))
    || (n.nodeType === 1 && (n.tagName === 'BR' || n.classList.contains('pgap') || (/^(P|DIV|SPAN|FONT|B|STRONG|EM|I|U)$/.test(n.tagName) && !n.querySelector('img,table,video,iframe,hr,svg') && !n.textContent.replace(/[\s\u00a0]/g, ''))));
  let box = root;
  for (let depth = 0; box && depth < 20; depth++) {
    while (box.lastChild && blank(box.lastChild)) box.lastChild.remove();
    const last = box.lastChild;
    if (!last) break;
    if (last.nodeType === 3) { last.nodeValue = last.nodeValue.replace(/[\s\u00a0]+$/, ''); break; }
    if (last.nodeType !== 1 || /^(TABLE|UL|OL|IMG|PRE)$/.test(last.tagName)) break;
    box = last;   // 마지막 문단 안쪽 끝도(예: <div>글\n\n\n</div>)
  }
}
// 빈 줄 줄이기(10-21 '기자들이 줄바꿈을 너무 많이 써서 종이가 아까움'): 글자·그림·표는 하나도 안 건드리고 '아무것도 없는 줄'만 —
// 글 속 줄바꿈 여러 개는 하나로, 빈 줄(앞에 글이 없는 줄바꿈)이 이어지면 작은 틈(4px) 하나로. 글 끝의 줄바꿈(다음 줄로 넘기기)은 그대로
function _cgaPrintGaps(doc, root) {
  const tw = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT), ts = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) ts.push(n);
  ts.forEach((n) => { n.nodeValue = n.nodeValue.replace(/\n[ \t\u00a0]*(?:\n[ \t\u00a0]*)+/g, '\n'); });
  const INLINE = /^(A|SPAN|B|STRONG|EM|I|U|S|FONT|SUB|SUP|MARK|SMALL|BIG|CODE|LABEL)$/;
  [...root.querySelectorAll('br')].forEach((br) => {
    let prev = br.previousSibling;
    while (prev && ((prev.nodeType === 3 && !prev.nodeValue.replace(/[\s\u00a0]/g, '')) || prev.nodeType === 8)) prev = prev.previousSibling;
    const isGap = prev && prev.nodeType === 1 && prev.classList.contains('pgap');
    const afterText = prev && !isGap && ((prev.nodeType === 3) || (prev.nodeType === 1 && INLINE.test(prev.tagName) && prev.textContent.replace(/[\s\u00a0]/g, '')));
    if (afterText) return;   // 글 다음 줄바꿈 = 줄 넘기기(빈 줄 아님)
    if (isGap) { br.remove(); return; }   // 빈 줄이 또 이어짐 → 없앰
    const g = doc.createElement('span'); g.className = 'pgap'; br.replaceWith(g);   // 빈 줄 → 작은 틈
  });
}
// 다단으로 나눈 미리보기에서 글자·그림이 있는 마지막 단(장) 번호 — 그 뒤 장은 테두리·여백뿐
function _cgaLastCol(doc, step) {
  let last = 0;
  try {
    const box = doc.querySelector('.print-box'), tw = doc.createTreeWalker(box, NodeFilter.SHOW_TEXT), rg = doc.createRange();
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      if (!t.nodeValue.replace(/[\s\u00a0]/g, '')) continue;
      rg.selectNodeContents(t); [...rg.getClientRects()].forEach((r) => { if (r.height > 0) last = Math.max(last, Math.floor((r.left + doc.scrollingElement.scrollLeft + 1) / step)); });
    }
    doc.querySelectorAll('.print-box img').forEach((i) => { [...i.getClientRects()].forEach((r) => { if (r.height > 0) last = Math.max(last, Math.floor((r.left + doc.scrollingElement.scrollLeft + 1) / step)); }); });
  } catch (e) { return 1e9; }
  return last;
}
// 인쇄 미리보기(NDS 의 크롬 인쇄 창처럼): 왼쪽 A4 미리보기 / 오른쪽 대상·매수·레이아웃·컬러 + [인쇄](바로 인쇄)·[취소]. 고른 프린터·설정은 이 PC 에 기억
async function _cgaPrintPreview(d) {
  document.getElementById('cga-pv')?.remove();
  let pref = {}; try { pref = JSON.parse(localStorage.getItem('nd_cga_print') || '{}') || {}; } catch (e) { pref = {}; }
  const zi0 = Number.isInteger(pref.size) && pref.size >= 0 && pref.size < CGA_PRINT_ZOOM.length ? pref.size : (pref.small ? 2 : CGA_PRINT_ZOOM.length - 1);
  let opt = { gap: !!pref.gap, lh: !!pref.lh, zoom: CGA_PRINT_ZOOM[zi0] }, html = _cgaPrintHtml(d, opt);   // 종이 아끼기(10-21) — 지난번 고른 대로
  const el = document.createElement('div'); el.id = 'cga-pv'; el.className = 'cpv-pop';
  el.innerHTML = `<div class="cpv-card" role="dialog" aria-modal="true" aria-label="인쇄">
    <div class="cpv-sheetwrap" id="cpv-wrap"><div class="cpv-pagelist" id="cpv-sheets"></div><iframe id="cpv-frame" class="cpv-hidden" title="인쇄용" sandbox="allow-same-origin" aria-hidden="true" tabindex="-1"></iframe></div>
    <aside class="cpv-side">
      <div class="cpv-h"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg><b>인쇄</b><span id="cpv-pages">용지 …장</span></div>
      <div class="cpv-fields">
        <label class="cpv-f"><span>프린터</span><select id="cpv-dev"><option value="">프린터 찾는 중…</option></select></label>
        <label class="cpv-f"><span>매수</span><input type="number" id="cpv-copies" min="1" max="50" value="${Math.min(Math.max(Number(pref.copies) || 1, 1), 50)}"></label>
        <div class="cpv-f"><span>방향</span><div class="cpv-seg" id="cpv-orient-seg"><button type="button" data-v="p">세로</button><button type="button" data-v="l">가로</button></div><select id="cpv-orient" hidden><option value="p">세로 방향</option><option value="l">가로 방향</option></select></div>
        <div class="cpv-f" id="cpv-duplex-f"><span>양면</span><div class="cpv-seg" id="cpv-duplex-seg"><button type="button" data-v="0">단면</button><button type="button" data-v="1">양면</button></div><select id="cpv-duplex" hidden><option value="0">단면</option><option value="1">양면</option></select></div>
        <div class="cpv-f"><span>색</span><div class="cpv-seg" id="cpv-color-seg"><button type="button" data-v="c">컬러</button><button type="button" data-v="m">흑백</button></div><select id="cpv-color" hidden><option value="c">컬러</option><option value="m">흑백</option></select></div>
        <p class="cpv-sec">종이 아끼기 <small>글자·그림은 그대로, 빈 줄·간격·크기만 줄여요</small></p>
        <div class="cpv-f"><span>빈 줄</span><div class="cpv-seg" id="cpv-gap-seg"><button type="button" data-v="0">그대로</button><button type="button" data-v="1">줄이기</button></div><select id="cpv-gap" hidden><option value="0">그대로</option><option value="1">줄이기</option></select></div>
        <div class="cpv-f"><span>줄 간격</span><div class="cpv-seg" id="cpv-lh-seg"><button type="button" data-v="0">기본</button><button type="button" data-v="1">좁게</button></div><select id="cpv-lh" hidden><option value="0">기본</option><option value="1">좁게</option></select></div>
        <div class="cpv-f"><span>글자 크기</span><div class="cpv-steps" id="cpv-steps" role="radiogroup" aria-label="글자 크기"><span class="cpv-thumb" aria-hidden="true"></span>${CGA_PRINT_ZOOM.map((z, i) => `<button type="button" role="radio" data-i="${i}">${Math.round(z * 100)}%</button>`).join('')}</div></div>
        <p class="cpv-note">고른 프린터·설정은 다음에도 그대로예요.</p>
      </div>
      <p class="cpv-st" id="cpv-st" role="status"></p>
      <div class="cpv-foot"><button type="button" class="cpv-cancel">취소</button><button type="button" class="cpv-go">인쇄</button></div>
    </aside></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), frame = $('#cpv-frame');
  $('#cpv-orient').value = pref.landscape ? 'l' : 'p'; $('#cpv-color').value = pref.color === false ? 'm' : 'c';
  $('#cpv-duplex').value = pref.duplex ? '1' : '0';
  if (!(window.ndApp && window.ndApp.printCaps && window.ndApp.printCaps.duplex)) $('#cpv-duplex-f').hidden = true;   // 양면은 앱 1.3.0~
  let lastN = 1; const pagesLabel = () => { const dup = $('#cpv-duplex').value === '1' && !$('#cpv-duplex-f').hidden; $('#cpv-pages').textContent = dup && lastN > 1 ? `용지 ${Math.ceil(lastN / 2)}장 · ${lastN}쪽` : `용지 ${lastN}장`; };
  $('#cpv-gap').value = opt.gap ? '1' : '0'; $('#cpv-lh').value = opt.lh ? '1' : '0';
  // 글자 크기: 딱 5칸(10-21 사용자) — 둥근 칸 안 흰 둥근 칸(.cpv-thumb)이 고른 칸으로 미끄러짐. 끌면 손을 따라오다 놓으면 가장 가까운 칸에 딱, ←→ 키도
  let zi = zi0, sizeT = 0;
  const zoomOf = () => CGA_PRINT_ZOOM[zi], steps = $('#cpv-steps'), thumb = steps.querySelector('.cpv-thumb'), last = CGA_PRINT_ZOOM.length - 1;
  const paintSteps = () => {
    steps.style.setProperty('--i', String(zi));
    steps.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('on', i === zi); b.setAttribute('aria-checked', String(i === zi)); b.tabIndex = i === zi ? 0 : -1; });
  };
  const setZ = (i, wait) => { i = Math.min(last, Math.max(0, i)); if (i === zi) return; zi = i; paintSteps(); clearTimeout(sizeT); sizeT = setTimeout(() => rebuild(), wait ? 220 : 0); };
  const rebuild = () => { opt = { gap: $('#cpv-gap').value === '1', lh: $('#cpv-lh').value === '1', zoom: zoomOf() }; html = _cgaPrintHtml(d, opt); frame.srcdoc = html; fit(); };   // tightEnd 는 다시 잼
  paintSteps();
  steps.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const r = steps.getBoundingClientRect(), pad = 4, w = (r.width - 2 * pad) / (last + 1);
    const at = (x) => Math.floor((x - r.left - pad) / w);
    let moved = false;
    const move = (ev) => {   // 흰 칸이 손을 따라옴(양끝 안에서), 글자색은 가장 가까운 칸
      if (!moved && Math.abs(ev.clientX - e.clientX) < 4) return;
      moved = true; thumb.classList.add('drag');
      const x = Math.min(r.width - pad - w, Math.max(pad, ev.clientX - r.left - w / 2));
      thumb.style.left = x + 'px'; setZ(Math.round((x - pad) / w), true);
    };
    const up = (ev) => {
      steps.removeEventListener('pointermove', move); steps.removeEventListener('pointerup', up); steps.removeEventListener('pointercancel', up);
      thumb.classList.remove('drag'); thumb.style.left = '';   // 놓으면 그 칸 자리로 딱
      if (!moved && ev.type === 'pointerup') setZ(at(ev.clientX));
      steps.querySelector('button.on')?.focus();
    };
    try { steps.setPointerCapture(e.pointerId); } catch (x) {}
    steps.addEventListener('pointermove', move); steps.addEventListener('pointerup', up); steps.addEventListener('pointercancel', up);
  });
  steps.addEventListener('keydown', (e) => {
    const d = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -1 : 0; if (!d) return;
    e.preventDefault(); setZ(zi + d); steps.querySelector('button.on')?.focus();
  });
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey, true); removeEventListener('resize', scale); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  $('.cpv-cancel').onclick = close; el.addEventListener('click', (e) => { if (e.target === el) close(); });
  // A4 장마다 끊어서 보여 줌(10-21 사용자): 인쇄 영역(A4 − 여백 위아래 10mm·양옆 15mm) 크기의 칸에 같은 내용을 '세로로 장 높이만큼씩 다단'으로 흘려서
  // (브라우저가 인쇄할 때 장을 나누는 것과 같은 방식 — 글 줄은 안 잘리고 다음 장으로) k번째 단을 k번째 종이에 보여 줌. 몇 장인지 = 단 개수. 창 폭에 맞춰 통째로 줄임
  let gen = 0, sheets = [];
  const dims = () => { const land = $('#cpv-orient').value === 'l', mm = 96 / 25.4, W = (land ? 297 : 210) * mm, H = (land ? 210 : 297) * mm; return { mm, W, H, cw: W - 30 * mm, chH: H - 20 * mm, G: 48 }; };
  const scale = () => {
    const host = $('#cpv-sheets'), wrap = $('#cpv-wrap'), { W } = dims(), k = Math.min(1, (wrap.clientWidth - 48) / W);
    host.style.transform = `scale(${k})`; host.style.marginBottom = (-(1 - k) * host.offsetHeight) + 'px';
  };
  const mono = () => sheets.forEach((x) => x.f.classList.toggle('mono', $('#cpv-color').value === 'm'));
  const fit = () => {
    const my = ++gen, { mm, W, H, cw, chH, G } = dims(), host = $('#cpv-sheets');
    const multi = html.replace('</head>', `<style>html{overflow:hidden;height:${chH}px}body{height:${chH}px;column-width:${cw}px;column-gap:${G}px;column-fill:auto}</style></head>`);
    host.innerHTML = ''; sheets = [];
    const count = () => {
      if (my !== gen || !sheets[0]) return;
      let n = 1; try { const se = sheets[0].f.contentDocument.scrollingElement; n = Math.max(1, Math.round((se.scrollWidth + G) / (cw + G))); } catch (e) { /* 못 셈 */ }
      while (sheets.length < n) add(sheets.length);
      while (sheets.length > n) { const x = sheets.pop(); x.s.remove(); x.lab.remove(); }
      sheets.forEach((x, i) => { x.lab.textContent = `${i + 1} / ${n}`; });
      lastN = n; pagesLabel(); scale();
      if (n > 1 && !opt.tightEnd && _cgaLastCol(sheets[0].f.contentDocument, cw + G) < n - 1) { opt.tightEnd = true; html = _cgaPrintHtml(d, opt); frame.srcdoc = html; fit(); }
    };
    const add = (k) => {
      const sh = document.createElement('div'); sh.className = 'cpv-sheet'; sh.style.width = W + 'px'; sh.style.height = H + 'px';
      const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-same-origin'); f.title = `인쇄 미리보기 ${k + 1}장`;
      Object.assign(f.style, { width: cw + 'px', height: chH + 'px', margin: `${10 * mm}px ${15 * mm}px` });
      const lab = document.createElement('div'); lab.className = 'cpv-pno';
      sh.appendChild(f); host.appendChild(sh); host.appendChild(lab);
      const x = { s: sh, f, lab }; sheets.push(x);
      f.addEventListener('load', () => {
        const go = () => { try { f.contentDocument.scrollingElement.scrollLeft = k * (cw + G); } catch (e) {} };
        go(); if (k === 0) count();
        try { [...f.contentDocument.images].forEach((i) => { if (!i.complete) i.addEventListener('load', () => { go(); if (k === 0) count(); }); }); } catch (e) {}
      });
      f.srcdoc = multi; mono();
      return x;
    };
    add(0); scale();
  };
  frame.srcdoc = html;   // 앱이 아닐 때 [인쇄] = 이 숨은 칸의 인쇄
  fit();
  $('#cpv-orient').onchange = fit; $('#cpv-color').onchange = mono; addEventListener('resize', scale);
  [['#cpv-orient-seg', '#cpv-orient'], ['#cpv-duplex-seg', '#cpv-duplex'], ['#cpv-color-seg', '#cpv-color'], ['#cpv-gap-seg', '#cpv-gap'], ['#cpv-lh-seg', '#cpv-lh']].forEach(([sg, se]) => {
    const seg = $(sg), selEl = $(se), paint = () => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === selEl.value)));
    seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; selEl.value = b.dataset.v; paint(); if (se === '#cpv-orient') fit(); else if (se === '#cpv-color') mono(); else if (se === '#cpv-duplex') pagesLabel(); else rebuild(); });
    paint();
  });
  // 프린터 목록(앱 1.2.7~). 없으면 [인쇄] = 이 창의 인쇄(운영체제 창)
  const sel = $('#cpv-dev'), canApp = !!(window.ndApp && window.ndApp.printers && window.ndApp.printHtml);
  if (canApp) {
    const ps = await window.ndApp.printers().catch(() => []) || [];
    sel.innerHTML = ps.length ? ps.map((p) => `<option value="${_cgaEsc(p.name)}">${_cgaEsc(p.displayName)}${p.isDefault ? ' (기본)' : ''}</option>`).join('') : '<option value="">기본 프린터</option>';
    const want = pref.device && ps.some((p) => p.name === pref.device) ? pref.device : ((ps.find((p) => p.isDefault) || ps[0] || {}).name || '');
    sel.value = want;
  } else sel.innerHTML = '<option value="">이 PC 기본 프린터</option>';
  $('.cpv-go').focus();
  $('.cpv-go').onclick = async () => {
    const o = { deviceName: sel.value, copies: Math.min(Math.max(Number($('#cpv-copies').value) || 1, 1), 50), landscape: $('#cpv-orient').value === 'l', color: $('#cpv-color').value !== 'm', duplex: $('#cpv-duplex').value === '1' && !$('#cpv-duplex-f').hidden };
    try { localStorage.setItem('nd_cga_print', JSON.stringify({ device: o.deviceName, copies: o.copies, landscape: o.landscape, color: o.color, duplex: o.duplex, gap: opt.gap, lh: opt.lh, size: CGA_PRINT_ZOOM.indexOf(opt.zoom) })); } catch (e) {}
    if (!canApp) { try { frame.contentWindow.print(); } catch (e) { toast('인쇄하지 못했어요.', 'error'); } return; }
    const go = $('.cpv-go'); go.disabled = true; go.textContent = '보내는 중…'; $('#cpv-st').textContent = '';
    const r = await window.ndApp.printHtml(Object.assign({ html }, o)).catch((e) => ({ ok: false, error: e.message }));
    if (r && r.ok) { close(); toast('인쇄를 보냈어요.', 'success'); }
    else { go.disabled = false; go.textContent = '인쇄'; $('#cpv-st').textContent = (r && r.error) || '인쇄하지 못했어요.'; }
  };
}
