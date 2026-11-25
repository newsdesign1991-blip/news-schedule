/* [모듈] js/look-pack.js — 테마 팩(.vwtheme): 전체 배포 말고 받은 사람만 이 PC에 추가해 쓰는 캐릭터 테마(11-25 사용자, 근무표 앱만)
   팩 = 한 파일(JSON) { kind: 'vw-theme-pack', format: 1, theme: LOOK_CHARAS 한 칸과 같은 설정, files: { 그림 이름: 'data:image/…;base64,…' } } — 웹하드 VW Source 와 같은 형식
        그림과 숫자뿐 — 코드는 안 들어감. 아는 칸만 받고(숫자는 숫자·색은 #rrggbb·그림은 png/jpg/webp) 나머지는 버림. 폴더 아이콘(folders)은 근무표엔 없어서 무시
   만들기 = 웹하드 폴더 tools/make-theme-pack.cjs · 추가 = 테마 창(js/look.js) 캐릭터 칸에 파일 끌어 놓기 또는 [테마 팩 추가] 눌러 고르기 · 지우기 = 팩 카드의 '지우기'(한 번 더 눌러야)
   저장 = 이 PC 브라우저 저장소(IndexedDB nd-theme-packs). 켤 때 읽어 LOOK_CHARAS 뒤에 붙임(그림은 blob: 주소 — js/look.js lookUrl 이 _urls 를 씀)
   앱에 같은 id 테마가 생기면 앱 것이 이김(팩은 안 씀). 로드 순서 = look.js 다음 */

const _LKP_DB = 'nd-theme-packs', _LKP_MAX = 40 * 1024 * 1024;

/* 저장소 */
function _lkpDb() {
  return new Promise((ok, no) => {
    const r = indexedDB.open(_LKP_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('packs', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
async function _lkpStore(mode, fn) {
  const db = await _lkpDb();
  return new Promise((ok, no) => {
    const tx = db.transaction('packs', mode), req = fn(tx.objectStore('packs'));
    tx.oncomplete = () => { db.close(); ok(req && req.result); };
    tx.onerror = tx.onabort = () => { db.close(); no(tx.error); };
  });
}
const _lkpAll = () => _lkpStore('readonly', s => s.getAll());
const _lkpPut = rec => _lkpStore('readwrite', s => s.put(rec));
const _lkpDel = id => _lkpStore('readwrite', s => s.delete(id));

/* 팩 확인 — 아는 칸만 다듬어 받음(웹하드 renderer/js/look-pack.js 와 같은 규칙) */
const _LKP_HEX = /^#[0-9a-f]{6}$/i, _LKP_FILE = /^(icons\/)?[^\\/:*?"<>|\x00-\x1f]{1,80}\.(png|jpe?g|webp)$/i;
const _LKP_FX = { count: 'n', fps: 'n', size: '2', color: 'h', colorLight: 'h', area: ['sidebar', 'all'] };
const _LKP_SCHEMA = {
  thumb: 'f',
  colors: { accent: 'h', tint: 'h', amount: 'n' },
  wallpaper: { file: 'f', x: 'n', y: 'n', height: 'n', opacity: 'n', fade: { top: 'n', right: 'n', bottom: 'n', left: 'n' },
    blurRight: { start: 'n', end: 'n', px: 'n' }, light: { file: 'f', opacity: 'n', x: 'n', y: 'n', height: 'n' } },
  petals: { shape: ['clover'], count: 'n', fps: 'n', size: '2', fall: '2', drift: '2', colors: 'hexes', line: 'h' },
  fireflies: { ..._LKP_FX, speed: '2' },
  embers: { ..._LKP_FX, rise: '2', sway: '2', life: '2' },
  character: { file: 'f', width: 'n', right: 'n', bottom: 'n', gap: 'n', gapDark: 'n' },
};
function _lkpClean(v, sch) {
  if (sch === 'n') return typeof v === 'number' && isFinite(v) ? v : undefined;
  if (sch === 'h') return typeof v === 'string' && _LKP_HEX.test(v) ? v : undefined;
  if (sch === 'f') return typeof v === 'string' && _LKP_FILE.test(v) && !v.includes('..') ? v : undefined;
  if (sch === '2') return Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number' && isFinite(x)) ? [v[0], v[1]] : undefined;
  if (sch === 'hexes') return Array.isArray(v) ? v.filter(x => typeof x === 'string' && _LKP_HEX.test(x)).slice(0, 12) : undefined;
  if (Array.isArray(sch)) return sch.includes(v) ? v : undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = {};
  for (const k of Object.keys(sch)) { const c = _lkpClean(v[k], sch[k]); if (c !== undefined) o[k] = c; }
  return o;
}
function _lkpBlob(url) {   // data URL → Blob(그림만)
  const m = typeof url === 'string' && /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!m) return null;
  const bin = atob(m[2]), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: m[1] });
}
// 팩 → 저장할 기록 { id, theme, files: { 이름: Blob } } · 안 되면 알림 글(문자열)
function _lkpCheck(pk) {
  if (!pk || pk.kind !== 'vw-theme-pack' || pk.format !== 1 || !pk.theme || !pk.files) return '테마 팩 파일이 아니에요';
  const id = pk.theme.id, name = typeof pk.theme.name === 'string' ? pk.theme.name.trim().slice(0, 20) : '';
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(id) || !name) return '테마 팩 설정이 잘못됐어요';
  if (LOOK_CHARAS.some(t => t.id === id && !t.pack)) return `‘${name}’ 테마는 이미 앱에 들어 있어요`;
  const theme = { id, name, ..._lkpClean(pk.theme, _LKP_SCHEMA) };
  if (!theme.colors?.accent || !theme.thumb) return '테마 팩 설정이 잘못됐어요';
  for (const k of ['petals', 'fireflies', 'embers']) if (theme[k]) { theme[k].count = Math.min(200, Math.max(0, theme[k].count ?? 20)); theme[k].fps = Math.min(30, Math.max(1, theme[k].fps ?? 14)); }
  const need = [theme.thumb, theme.wallpaper?.file, theme.wallpaper?.light?.file, theme.character?.file].filter(Boolean);
  const files = {};
  for (const n of new Set(need)) {
    const b = _lkpBlob(pk.files[n]);
    if (!b) return `테마 팩에 그림이 빠졌어요(${n})`;
    files[n] = b;
  }
  return { id, theme, files, added: Date.now() };
}

/* 테마 목록에 붙이기·떼기 */
function _lkpRegister(rec) {
  if (LOOK_CHARAS.some(t => t.id === rec.id && !t.pack)) return false;   // 앱에 같은 테마가 생기면 앱 것
  _lkpUnregister(rec.id);
  const urls = {};
  for (const [n, b] of Object.entries(rec.files)) urls[n] = URL.createObjectURL(b);
  LOOK_CHARAS.push({ ...rec.theme, pack: true, _urls: urls });
  return true;
}
function _lkpUnregister(id) {
  const i = LOOK_CHARAS.findIndex(t => t.id === id && t.pack);
  if (i < 0) return;
  Object.values(LOOK_CHARAS[i]._urls).forEach(u => URL.revokeObjectURL(u));
  LOOK_CHARAS.splice(i, 1);
}

/* 추가·지우기 */
async function lookPackInstall(file) {
  if (!file) return;
  if (!/\.vwtheme$/i.test(file.name)) return toast('테마 팩 파일(.vwtheme)을 놓아 주세요');
  if (file.size > _LKP_MAX) return toast('테마 팩이 너무 커요');
  let pk;
  try { pk = JSON.parse(await file.text()); } catch (e) { return toast('테마 팩을 읽지 못했어요'); }
  const rec = _lkpCheck(pk);
  if (typeof rec === 'string') return toast(rec);
  const was = LOOK_CHARAS.some(t => t.id === rec.id && t.pack);
  try { await _lkpPut(rec); } catch (e) { return toast('테마 팩을 저장하지 못했어요'); }
  _lkpRegister(rec);
  _lookPane = 'chara';
  setLook({ chara: rec.id, ...rec.theme.colors });   // 바로 그 테마로(js/look.js — 칠하고 테마 창도 다시)
  toast(`‘${rec.theme.name}’ 테마 팩을 ${was ? '새것으로 바꿨어요' : '추가했어요'}`);
}
async function lookPackRemove(id) {
  const name = lookChara(id)?.name || '';
  try { await _lkpDel(id); } catch (e) { return toast('테마 팩을 지우지 못했어요'); }
  if (lookGet()?.chara === id) setLook(null);   // 쓰던 테마면 기본으로
  _lkpUnregister(id);
  _lookPaint();
  toast(`‘${name}’ 테마 팩을 이 PC에서 지웠어요`);
}
function lookPackPick() {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = '.vwtheme';
  i.onchange = () => lookPackInstall(i.files[0]);
  i.click();
}

/* 테마 창 조각(js/look.js _lookPaint · openLook 이 부름) */
const _lkpEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lookPackAddCard = () => '<button type="button" class="lk-chara add"><span class="lk-chara-pic">＋</span><span class="lk-chara-nm">테마 팩 추가<small>파일을 끌어 놓거나 누르기</small></span></button>';
const lookPackMark = () => '<small>이 PC에만</small>';
const lookPackDel = () => '<span class="lk-chara-del" role="button" title="이 PC에서 테마 팩 지우기">지우기</span>';
// 카드의 '지우기' — 첫 번째는 묻기만(3초), 한 번 더 누르면 지움. 처리했으면 true
function lookPackClick(e) {
  const x = e.target.closest('.lk-chara-del');
  if (x) {
    e.stopPropagation();
    if (!x.classList.contains('ask')) {
      x.classList.add('ask'); x.textContent = '한 번 더 누르면 지워요';
      setTimeout(() => { if (x.isConnected) { x.classList.remove('ask'); x.textContent = '지우기'; } }, 3000);
    } else lookPackRemove(x.closest('.lk-chara').dataset.chara);
    return true;
  }
  if (e.target.closest('.lk-chara.add')) { lookPackPick(); return true; }
  return false;
}
// 끌어 놓기 — 테마 창 위에 .vwtheme 파일
function lookPackDrop(pop) {
  const card = () => pop.querySelector('.lk-card'), files = e => e.dataTransfer?.types?.includes('Files');
  pop.addEventListener('dragover', e => { if (!files(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; card().classList.add('lk-drop'); });
  pop.addEventListener('dragleave', e => { if (!pop.contains(e.relatedTarget)) card().classList.remove('lk-drop'); });
  pop.addEventListener('drop', e => {
    if (!files(e)) return;
    e.preventDefault();
    card().classList.remove('lk-drop');
    const list = [...e.dataTransfer.files];
    lookPackInstall(list.find(f => /\.vwtheme$/i.test(f.name)) || list[0]);
  });
}

/* 켤 때 — 저장해 둔 팩을 읽어 붙이고, 쓰던 테마가 팩이면 다시 칠함(앱에서만) */
if (ND_APP && window.indexedDB) (async () => {
  let recs = [];
  try { recs = await _lkpAll(); } catch (e) { return; }
  let any = false;
  for (const r of recs) any = _lkpRegister(r) || any;
  if (any) { applyLook(); _lookPaint(); }
})();
