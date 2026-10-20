/* [모듈] js/cg-assign.js — CG배정 현황(10-20, PC 사이드바 '근무표' 아래) | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것)
   오늘 출근한 CG 근무자(8데스·5데스 빼고) 카드 + NDS CG의뢰(nds.sbs.co.kr/request-cg)에서 누가 지금 작업 중인지.
   - 근무자 = 홈 'CG 근무자'와 같은 기준(js/home.js): CG 근무 + CG 부서 8진·뉴오·일근, 휴가·수습·당직/퇴근·조근·오전데 빼고, XR 부서 빼고, 8데스·5데스 빼고
   - NDS = 근무표 PC 앱 window.ndApp.ndsCg(오늘) (desktop/nds-cue.js, 공용 계정) — 이 화면을 열어 둔 PC만 20초마다(창이 보일 때만). 웹·옛 앱은 안내만
   - 상태 0002 배정 = 작업 중(파란 빛·깜빡이는 점·'작업 중…'·기자·의뢰/배정 시각), 그 밖 = 대기(회색). 이름은 NDS 디자이너 이름과 근무표 이름이 같아야 맞음
   - 10-20 추가: 프로젝트 인원은 늘 포함, [사람 추가]·카드 ×로 그날만 넣고 빼기(이 PC localStorage nd_cga_adj), 왼쪽 의뢰 ×로 이 앱에서만 숨기기(nd_cga_hide, NDS엔 그대로),
     보완요청은 회색, 새 의뢰(0001)가 생기면 오른쪽 위 알림 카드(ndApp.toast — 1.2.4+, 옛 앱은 화면 아래 토스트) */
const CGA_POLL = 20000;
const CGA_PERSON_POP = false;   // 10-20 사용자: 카드 누르면 뜨는 사람 팝업(_cgaPersonPop)은 일단 숨김 — 코드는 남겨 둠, true 면 다시 켜짐
let _cgaData = null, _cgaErr = '', _cgaBusy = false, _cgaTimer = null, _cgaTick = null, _cgaSeen = null;
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
    if (d === 'xr' || (needCgDept ? d !== 'cg' : (d === 'vw' && vwW.has(id)))) return;
    if (desk.has(id) || ex.has(id) || lv.has(id) || jo.has(id) || (typeof isProbation === 'function' && isProbation(s, ds))) return;
    seen.add(id); out.push({ id, name: s.name, tag });
  };
  ((entry.cg && entry.cg.workers) || []).forEach(id => add(id, '', false));
  // 프로젝트 인원은 부서와 상관없이 늘 넣음(10-20) — 휴가·수습만 뺌
  (entry.project || []).forEach(id => { const s = staffById(id); if (!s || seen.has(id) || lv.has(id) || (typeof isProbation === 'function' && isProbation(s, ds))) return; seen.add(id); out.push({ id, name: s.name, tag: 'PROJECT' }); });
  [['8진', entry.weekend8jin], ['8진', entry.weekday8jin], ['8진', entry.weekend8jin2], ['8진', entry.weekday8jin2], ['뉴.오', entry.newsOh], ['뉴.오', entry.newsOh2], ['일근', entry.ilgeun]]
    .forEach(([t, id]) => { if (id && seen.has(id)) { const p = out.find(x => x.id === id); if (p && !p.tag) p.tag = t; } else add(id, t, true); });
  // 손으로 넣고 뺀 사람(그날만)
  const adj = _cgaLocal('nd_cga_adj'), del = new Set(adj.del || []);
  (adj.add || []).forEach(id => { const s = staffById(id); if (s && !seen.has(id)) { seen.add(id); out.push({ id, name: s.name, tag: _cgaRoleTag(s.name, ds), added: true }); } });
  const idx = new Map((data.staff || []).map((s, i) => [s.id, i]));
  const fl = id => (staffById(id) && staffById(id).employmentType === 'freelancer') ? 1 : 0;
  return out.filter(p => !del.has(p.id)).sort((a, b) => (fl(a.id) - fl(b.id)) || ((idx.get(a.id) ?? 9999) - (idx.get(b.id) ?? 9999)));
}
function _cgaDel(id) { const v = _cgaLocal('nd_cga_adj'); v.add = (v.add || []).filter(x => x !== id); v.del = [...new Set([...(v.del || []), id])]; _cgaSave('nd_cga_adj', v); _cgaPaint(); }
function _cgaAdd(id) {
  const v = _cgaLocal('nd_cga_adj'); v.del = (v.del || []).filter(x => x !== id); _cgaSave('nd_cga_adj', v);
  if (!_cgaPeople(_cgaToday()).some(p => p.id === id)) { v.add = [...new Set([...(v.add || []), id])]; _cgaSave('nd_cga_adj', v); }
  document.getElementById('cga-pick')?.remove(); _cgaPaint();
}
function _cgaHide(id) { const v = _cgaLocal('nd_cga_hide'); v.ids = [...new Set([...(v.ids || []), id])]; _cgaSave('nd_cga_hide', v); _cgaPaint(); }
function _cgaUnhide() { _cgaSave('nd_cga_hide', { day: _cgaToday(), ids: [] }); _cgaPaint(); }
// [사람 추가] 작은 창: 이름 찾기 + 오늘 뺀 사람 다시 넣기
function _cgaPick(btn) {
  const old = document.getElementById('cga-pick'); if (old) { old.remove(); return; }
  const ds = _cgaToday(), on = new Set(_cgaPeople(ds).map(p => p.id)), del = new Set(_cgaLocal('nd_cga_adj').del || []);
  const list = (data.staff || []).filter(s => s && s.name && !on.has(s.id) && (typeof isContractActive !== 'function' || isContractActive(s, ds)));
  const el = document.createElement('div'); el.id = 'cga-pick'; el.className = 'cga-pick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '사람 추가');
  el.innerHTML = '<div class="cga-pick-h">사람 추가 <small>오늘만, 이 PC에서</small></div><input type="search" class="cga-pick-q" placeholder="이름 찾기" aria-label="이름 찾기"><div class="cga-pick-list"></div>';
  const paint = q => {
    const f = list.filter(s => !q || s.name.includes(q));
    const row = s => `<button type="button" data-id="${_cgaEsc(s.id)}"><b>${_cgaEsc(s.name)}</b><small>${_cgaEsc(_cgaRoleTag(s.name, ds))}</small>${del.has(s.id) ? '<em>뺀 사람</em>' : ''}</button>`;
    el.querySelector('.cga-pick-list').innerHTML = f.length ? [...f.filter(s => del.has(s.id)), ...f.filter(s => !del.has(s.id))].map(row).join('') : '<p>찾는 사람이 없어요.</p>';
  };
  el.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) _cgaAdd(b.dataset.id); });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') el.remove(); });
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
      <div class="cga-body"><aside class="cga-side" id="cga-side"><section class="cga-box"><h3>배정 기다리는 의뢰 <span id="cga-reqn">…</span></h3><div class="cga-reqs" id="cga-reqs"></div><p class="cga-none" id="cga-none" hidden>지금 기다리는 의뢰가 없어요.</p><button type="button" class="cga-unhide" id="cga-unhide" onclick="_cgaUnhide()" hidden></button></section></aside><div class="cga-grid" id="cga-grid"></div></div>`;
  }
  const g = document.getElementById('cga-grid');
  if (CGA_PERSON_POP && !g._wired) {   // 카드 누르면 그 사람 오늘 CG(× 는 빼기)
    g._wired = true;
    const open = e => { if (e.target.closest('.cga-x')) return; const c = e.target.closest('.cga-card[data-name]'); if (c && !c.classList.contains('cga-leaving')) _cgaPersonPop(c.dataset.name); };
    g.addEventListener('click', open);
    g.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cga-card')) { e.preventDefault(); open(e); } });
  }
  _cgaPaint();
  _cgaFetch(false);
  clearInterval(_cgaTimer); _cgaTimer = setInterval(() => { if (currentView !== 'cgassign') { clearInterval(_cgaTimer); _cgaTimer = null; return; } if (document.visibilityState === 'visible') _cgaFetch(false); }, CGA_POLL);
  clearInterval(_cgaTick); _cgaTick = setInterval(() => { if (currentView !== 'cgassign') { clearInterval(_cgaTick); _cgaTick = null; return; } _cgaAgoFill(); }, 30000);   // '몇 분째'만 갱신
}
async function _cgaFetch(manual) {
  if (_cgaBusy) return;
  if (!(typeof ND_APP !== 'undefined' && ND_APP && window.ndApp && window.ndApp.ndsCg)) {
    _cgaErr = (typeof ND_APP !== 'undefined' && ND_APP) ? '근무표 앱을 업데이트하면 볼 수 있어요. 오른쪽 위 렌치에서 업데이트해 주세요.' : 'CG배정 현황은 근무표 PC 앱에서 볼 수 있어요.';
    _cgaPaint(); return;
  }
  _cgaBusy = true;
  const btn = document.querySelector('#cga-root .cga-refresh'); if (btn) btn.classList.add('spin');
  try {
    const r = await window.ndApp.ndsCg(_cgaToday());
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
function _cgaNotifyNew(r) {
  const req = (r.rows || []).filter(x => x.status === '0001');
  if (!_cgaSeen || _cgaSeen.day !== r.day) { _cgaSeen = { day: r.day, ids: new Set(req.map(x => x.id)) }; return; }
  const fresh = req.filter(x => !_cgaSeen.ids.has(x.id));
  fresh.forEach(x => _cgaSeen.ids.add(x.id));
  if (!fresh.length) return;
  const f = fresh[0], title = fresh.length > 1 ? `새 CG 의뢰 ${fresh.length}건` : '새 CG 의뢰가 들어왔어요';
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
    .filter(p => !(p.id && (_cgaLocal('nd_cga_adj').del || []).includes(p.id)));
  const work = [...people.filter(p => active(p.name).length), ...extra], idle = people.filter(p => !active(p.name).length);
  const sub = `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일 · 8데스·5데스 빼고 오늘 CG 근무자` + (loaded ? ` · ${new Date(_cgaData.at).toTimeString().slice(0, 5)} 기준` : '');
  const subEl = document.getElementById('cga-sub'); if (subEl.textContent !== sub) subEl.textContent = sub;
  const stat = loaded ? `<span class="cga-pill on"><i></i>작업 중 ${work.length}</span><span class="cga-pill">대기 ${idle.length}</span>` : '';
  const statEl = document.getElementById('cga-stat'); if (statEl._h !== stat) { statEl.innerHTML = stat; statEl._h = stat; }
  const msg = document.getElementById('cga-msg'); if (msg.textContent !== _cgaErr) msg.textContent = _cgaErr; msg.hidden = !_cgaErr;
  // 오른쪽: 사람 카드(작업 중 먼저). 성씨 동그라미는 뺌(10-20)
  const card = p => {
    const a = active(p.name), on = a.length > 0;
    let body;
    if (!loaded) body = `<div class="cga-wait">${_cgaErr ? '' : '불러오는 중…'}</div>`;
    else if (on) body = `<div class="cga-now">작업 중<span class="cga-dots"><i>.</i><i>.</i><i>.</i></span></div>` + a.slice(0, 2).map(r => `<div class="cga-job">
        <div class="cga-who"><b>${_cgaEsc(r.requester || '요청자 없음')}</b>${r.requesterDept ? `<small>${_cgaEsc(r.requesterDept)}</small>` : ''}${r.reqCnt > 1 ? `<em>${r.reqCnt}건</em>` : ''}</div>
        ${r.title ? `<div class="cga-ttl" title="${_cgaEsc(r.title)}">${_cgaEsc(r.title)}</div>` : ''}
        <div class="cga-time"><span>의뢰 <b>${_cgaHM(r.inputAt)}</b></span><span>배정 <b>${_cgaHM(r.assignAt)}</b></span><span class="cga-ago" data-at="${_cgaEsc(r.assignAt)}"></span></div>
      </div>`).join('') + (a.length > 2 ? `<div class="cga-more">+${a.length - 2}건 더</div>` : '');
    else body = '<div class="cga-idle">대기 중</div>';   // 끝난 CG는 안 보여 줌(10-20)
    return { key: 'p:' + (p.id || p.name), cls: 'cga-card' + (on ? ' on' : loaded ? ' off' : '') + (CGA_PERSON_POP ? ' pop' : ''), attrs: CGA_PERSON_POP ? { role: 'button', tabindex: '0', 'data-name': p.name, 'aria-label': `${p.name} ${on ? '작업 중' : '대기'} — 오늘 처리한 CG 보기` } : { role: 'group', 'data-name': p.name, 'aria-label': `${p.name} ${on ? '작업 중' : '대기'}` },
      html: `<span class="cga-dot" aria-hidden="true"></span>${p.id ? `<button type="button" class="cga-x" onclick="_cgaDel('${_cgaEsc(p.id)}')" title="오늘 이 화면에서 빼기" aria-label="${_cgaEsc(p.name)} 빼기">×</button>` : ''}
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
  const wait = all.filter(r => !hid.has(r.id)).sort((a, b) => ((a.status === '0003') - (b.status === '0003')) || String(a.inputAt).localeCompare(String(b.inputAt)));
  const nHid = all.length - wait.length, nReq = wait.filter(r => r.status === '0001').length;
  const item = r => {
    const fix = r.status === '0003';
    return { key: 'r:' + r.id, cls: 'cga-req' + (fix ? ' fix' : ''),
      html: `<button type="button" class="cga-x" onclick="_cgaHide(${Number(r.id) || 0})" title="이 앱에서만 숨기기(NDS엔 그대로)" aria-label="의뢰 숨기기">×</button>`
        + `<div class="cga-who"><b>${_cgaEsc(r.requester)}</b>${r.requesterDept ? `<small>${_cgaEsc(r.requesterDept)}</small>` : ''}${r.reqCnt > 1 ? `<em>${r.reqCnt}건</em>` : ''}${fix ? '<em class="cga-fix">보완요청</em>' : ''}</div>`
        + (r.title ? `<div class="cga-ttl" title="${_cgaEsc(r.title)}">${_cgaEsc(r.title)}</div>` : '')
        + `<div class="cga-time"><span>의뢰 <b>${_cgaHM(r.inputAt)}</b></span>${fix ? '<span class="cga-ago">보완 기다림</span>' : `<span class="cga-ago" data-kind="wait" data-at="${_cgaEsc(r.inputAt)}"></span>`}</div>` };
  };
  const list = document.getElementById('cga-reqs');
  const cnt = document.getElementById('cga-reqn'), cntT = loaded ? String(nReq) : '…'; if (cnt.textContent !== cntT) cnt.textContent = cntT;
  _cgaKeyed(list, wait.map(item), (el, i) => {
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
