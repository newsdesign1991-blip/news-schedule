/* [모듈] js/events.js — 이번 주 일정 이벤트(추가 모달·참여자 칩·상세/편집/댓글) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 이벤트(이번 주 일정) =====
function openEventModal(dateStr) {
  const modal = document.getElementById('event-add-modal');
  // 기본 날짜: 전달된 날짜 or 오늘
  const now = new Date();
  const def = dateStr || toDateStr(now.getFullYear(), now.getMonth()+1, now.getDate());
  document.getElementById('ev-date').value = def;
  document.getElementById('ev-time').value = '';
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-author').value = '';
  const firstRadio = modal.querySelector('input[name="ev-color"]');
  if (firstRadio) firstRadio.checked = true;
  modal.querySelectorAll('input[name="ev-color"]').forEach(function(el){ el.onchange=function(){ _evTintUpdate(this.value); }; });
  _renderParticipantChips('ev-participants-wrap', [], def);
  _evAttachPickers('ev-date', 'ev-date-cal', 'ev-time', 'ev-time-pick');
  _evAutoGrow(document.getElementById('ev-title'));
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _evTintUpdate();
  setTimeout(()=>document.getElementById('ev-title').focus(), 100);
}
// 넓은 화면: 날짜는 달력, 시간은 직접 입력(js/nd-cal.js). 값은 원래 input에 그대로 → 저장 코드는 그대로 .value를 읽음
function _evAttachPickers(dateId, calId, timeId, timeHostId) {
  if (typeof ndDateInput !== 'function') return;
  ndDateInput(document.getElementById(dateId), document.getElementById(calId));
  ndTimeInput(document.getElementById(timeId), document.getElementById(timeHostId));
}
// 내용칸(textarea): 모바일은 한 줄에서 시작해 글 길이만큼 늘어남, 넓은 화면은 CSS가 크게 고정
function _evAutoGrow(el) {
  if (!el) return;
  const fit = () => { if (matchMedia('(min-width:1001px)').matches) { el.style.height = ''; return; } el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; };
  if (!el._evGrow) { el._evGrow = 1; el.addEventListener('input', fit); }
  el.style.height = ''; if (el.value) fit();
}
function closeEventModal() {
  _animModalClose(document.getElementById('event-add-modal'));
  document.body.style.overflow = '';
}
function _evHexRgba(hex,a){ hex=(hex||'').replace('#',''); if(hex.length<6) return null; var R=parseInt(hex.substr(0,2),16),G=parseInt(hex.substr(2,2),16),B=parseInt(hex.substr(4,2),16); return 'rgba('+R+','+G+','+B+','+a+')'; }
function _evTintUpdate(hex){ var m=document.querySelector('#event-add-modal .modal'); if(!m) return; if(!hex){ var c=document.querySelector('#event-add-modal input[name=\"ev-color\"]:checked'); hex=c?c.value:'#3182f6'; } var dark=document.documentElement.getAttribute('data-theme')==='dark'; var v=_evHexRgba(hex, dark?0.17:0.10); if(v) m.style.setProperty('--ev-tint', v); }
function tryCloseEventModal(){
  var g=function(id){var e=document.getElementById(id);return e?(e.value||''):'';};
  if(g('ev-title').trim() || g('ev-location').trim() || g('ev-time')){ _evConfirmDiscard(); return; }
  closeEventModal();
}
function _closeEvDiscard(){ var o=document.getElementById('ev-discard-ov'); if(o) o.remove(); }
function _evConfirmDiscard(){
  if(document.getElementById('ev-discard-ov')) return;
  var ov=document.createElement('div'); ov.id='ev-discard-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,0.32);';
  ov.innerHTML='<div class="ev-discard-card" style="width:100%;max-width:300px;text-align:center;padding:24px 22px 18px;">'
    +'<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px;">작성 중인 일정을 삭제할까요?</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:20px;line-height:1.5;">지금까지 입력한 내용이 사라집니다.</div>'
    +'<div style="display:flex;gap:8px;">'
    +'<button onclick="_closeEvDiscard()" style="flex:1;padding:12px;border-radius:14px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:14px;font-weight:700;cursor:pointer;">아니오</button>'
    +'<button onclick="_closeEvDiscard();closeEventModal();" style="flex:1;padding:12px;border-radius:14px;border:none;background:linear-gradient(135deg,#f36a6a,#e2453f);color:#fff;font-size:14px;font-weight:800;cursor:pointer;">예</button>'
    +'</div></div>';
  ov.onclick=function(e){ if(e.target===ov) _closeEvDiscard(); };
  document.body.appendChild(ov);
}
// ── 저장: 일반 직원 경로라 문서 전체(saveData)가 아니라 서버 최신본에 이 변경만 병합(js/notice.js _ndCommit, 'events' 칸) ──
// 그사이 남이 저장해도 거부·덮어쓰기 없음. 저장이 끝난 뒤에만 창을 닫음(실패하면 쓴 내용 그대로). 저장 중 두 번 누르면 무시(null)
let _evSaving = false;
async function _evCommit(mutate) {
  if (_evSaving) return null;
  _evSaving = true;
  try { return await _ndCommit(mutate, ['events']); } finally { _evSaving = false; }
}
function _evFindIn(root, id) {   // 모든 날짜에서 id로 찾기(그사이 다른 기기가 날짜를 옮겼어도)
  for (const ds of Object.keys(root.events||{})) { const list = root.events[ds]||[]; const i = list.findIndex(e => e && e.id === id); if (i >= 0) return { ds, list, i, ev: list[i] }; }
  return null;
}
function _evSortTime(list) { list.sort((a,b)=>(a.time||'').localeCompare(b.time||'')); }   // 시간순 정렬
function _evRemoveIn(root, id) { const f = _evFindIn(root, id); if (!f) return false; f.list.splice(f.i, 1); if (!f.list.length) delete root.events[f.ds]; }
function _evNewId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function _evRerender() { renderHome(); if (currentView === 'month') renderMonth(); }
const EV_SAVE_FAIL = '저장하지 못했어요. 네트워크 확인 후 다시 시도하세요.';
async function saveEvent() {
  const date  = document.getElementById('ev-date').value;
  const title = document.getElementById('ev-title').value.trim();
  if (!date)  { toast('날짜를 선택하세요','error'); return; }
  if (!title) { toast('내용을 입력하세요','error'); return; }
  const time     = document.getElementById('ev-time').value || '';
  const location = document.getElementById('ev-location').value.trim();
  const author   = document.getElementById('ev-author').value.trim();
  const color    = (document.querySelector('input[name="ev-color"]:checked')?.value) || '#6366f1';
  const id       = _evNewId();
  const participants = _getSelectedParticipants('ev-participants-wrap');
  const ev = { id, title, time, location, color, author, participants };
  const res = await _evCommit(rp => {
    const list = rp.events[date] = rp.events[date] || [];
    if (!list.some(e => e && e.id === id)) list.push(ev);   // 다시 시도해도 한 번만
    _evSortTime(list);
  });
  if (res === null) return;
  if (res !== true) { toast(EV_SAVE_FAIL,'error'); return; }
  closeEventModal();
  toast('일정이 추가되었습니다','success');
  _evRerender();
}
async function deleteEvent(dateStr, idx) {
  const ev = (data.events?.[dateStr]||[])[idx]; if (!ev) return;
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  const res = await _evCommit(rp => _evRemoveIn(rp, ev.id));
  if (res === null) return;
  if (res !== true && res !== 'gone') { toast(EV_SAVE_FAIL,'error'); return; }   // 'gone' = 이미 지워짐
  _evRerender();
}

// ===== 참여자 칩 =====
// 이름 칩 격자 대신 검색 + 추천 목록 + 고른 사람 태그(js/nd-people.js). 저장 형식(직원 id 배열)은 그대로.
function _renderParticipantChips(wrapperId, selectedIds, dateStr) {
  const wrap = document.getElementById(wrapperId); if (!wrap) return;
  const _now = new Date();
  const _d = dateStr || toDateStr(_now.getFullYear(), _now.getMonth()+1, _now.getDate());
  const _sel = selectedIds||[];
  // 현재 계약기간이 아닌 사람은 숨김(단, 이미 선택된 참여자는 유지해 실수로 빠지지 않게)
  const staff = (data.staff||[]).filter(s => s.active!==false && (isContractActive(s, _d) || _sel.includes(s.id)));
  if (typeof ndPeoplePicker === 'function') {
    if (wrap._ndPicker) wrap._ndPicker.destroy();
    wrap.style.cssText = ''; wrap.classList.add('pt-pick');
    ndPeoplePicker(wrap, { staff, selected: _sel.filter(id => staff.some(s => s.id === id)), placeholder: '이름 검색해서 참여자 추가' });
    return;
  }
  wrap.innerHTML = staff.map(s => {
    const on = selectedIds.includes(s.id);
    return `<span onclick="_toggleChip(this,'${wrapperId}','${s.id}')" data-pid="${s.id}" style="display:block;text-align:center;padding:5px 6px;border-radius:12px;font-size:12px;cursor:pointer;border:1.5px solid ${on?'#6366f1':'var(--border)'};background:${on?'#6366f1':'transparent'};color:${on?'#fff':'var(--text)'};transition:all 0.15s;">${s.name}</span>`;
  }).join('');
}
function _toggleChip(el, wrapperId, staffId) {
  const on = el.style.background === 'rgb(99, 102, 241)' || el.style.background === '#6366f1';
  el.style.background = on ? 'transparent' : '#6366f1';
  el.style.color = on ? 'var(--text)' : '#fff';
  el.style.borderColor = on ? 'var(--border)' : '#6366f1';
}
function _getSelectedParticipants(wrapperId) {
  const wrap = document.getElementById(wrapperId); if (!wrap) return [];
  if (wrap._ndPicker) {   // 근무표 열 순서(data.staff 순서)로 저장 — 예전 칩 격자와 같은 순서
    const idx = new Map((data.staff||[]).map((s,i)=>[s.id,i]));
    return wrap._ndPicker.get().sort((a,b)=>(idx.get(a)??1e9)-(idx.get(b)??1e9));
  }
  return Array.from(wrap.querySelectorAll('[data-pid]'))
    .filter(el => el.style.background === '#6366f1' || el.style.background === 'rgb(99, 102, 241)')
    .map(el => el.dataset.pid);
}
function _renderDetailParticipants(ev) {
  const wrap = document.getElementById('ev-detail-participants'); if (!wrap) return;
  const ids = ev.participants||[];
  if (!ids.length) { wrap.innerHTML=''; return; }
  const color = ev.color||'#6366f1';
  wrap.innerHTML = ids.map(id => {
    const s = (data.staff||[]).find(x=>x.id===id);
    return s ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11.5px;font-weight:700;background:${color}1f;color:${color};">${s.name}</span>` : '';
  }).join('');
}

// ===== 이벤트 상세/편집/댓글 =====
let _evDetailDate = null, _evDetailId = null;
function _findEvent(dateStr, id) {
  return (data.events?.[dateStr]||[]).find(e=>e.id===id);
}
function openEventDetail(dateStr, id) {
  const ev = _findEvent(dateStr, id); if (!ev) return;
  _evDetailDate = dateStr; _evDetailId = id;
  const color = ev.color||'#6366f1';
  const header = document.getElementById('ev-detail-header');
  header.style.background = color+'22';
  header.style.color = 'var(--text)';
  header.style.borderBottom = '2px solid '+color;
  const {y,m,d,date} = parseDateStr(dateStr);
  const dowLbl = ['일','월','화','수','목','금','토'][date.getDay()];
  document.getElementById('ev-detail-date-label').style.color = color;
  document.getElementById('ev-detail-date-label').textContent = `${m}월 ${d}일 (${dowLbl})${ev.time?' · '+ev.time:''}`;
  document.getElementById('ev-detail-title').textContent = ev.title;
  document.getElementById('ev-detail-meta').textContent = [ev.location?''+ev.location:'', ev.author?'작성자: '+ev.author:''].filter(Boolean).join('  ·  ');
  _renderDetailParticipants(ev);
  document.getElementById('ev-edit-form').style.display = 'none';
  document.querySelector('#event-detail-modal .modal')?.classList.remove('ev-editing');   // 넓은 화면 편집용 2분할 해제
  _renderEventComments(ev);
  const _cmtAuthorEl = document.getElementById('ev-cmt-author');
  if (_cmtAuthorEl && currentUser?.name) _cmtAuthorEl.value = currentUser.name;
  document.getElementById('event-detail-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeEventDetail() {
  _animModalClose(document.getElementById('event-detail-modal'));
  document.body.style.overflow = '';
  _evDetailDate = null; _evDetailId = null;
}
function openEventEdit() {
  const ev = _findEvent(_evDetailDate, _evDetailId); if (!ev) return;
  document.getElementById('ev-edit-date').value = _evDetailDate;
  document.getElementById('ev-edit-time').value = ev.time||'';
  document.getElementById('ev-edit-title').value = ev.title;
  document.getElementById('ev-edit-location').value = ev.location||'';
  const radio = document.querySelector(`input[name="ev-edit-color"][value="${ev.color||'#6366f1'}"]`);
  if (radio) radio.checked = true;
  _renderParticipantChips('ev-edit-participants-wrap', ev.participants||[], _evDetailDate);
  _evAttachPickers('ev-edit-date', 'ev-edit-date-cal', 'ev-edit-time', 'ev-edit-time-pick');
  document.getElementById('ev-edit-form').style.display = 'block';
  document.querySelector('#event-detail-modal .modal')?.classList.add('ev-editing');   // 넓은 화면: 편집하는 동안 좌우 2분할(css/popup-wide.css)
  _evAutoGrow(document.getElementById('ev-edit-title'));
}
async function saveEventEdit() {
  const newDate  = document.getElementById('ev-edit-date').value;
  const newTitle = document.getElementById('ev-edit-title').value.trim();
  if (!newDate||!newTitle) { toast('날짜와 내용을 입력하세요','error'); return; }
  const newTime  = document.getElementById('ev-edit-time').value||'';
  const newColor = document.querySelector('input[name="ev-edit-color"]:checked')?.value||'#6366f1';
  const id = _evDetailId;
  if (!_findEvent(_evDetailDate, id)) return;
  const patch = { title:newTitle, time:newTime, color:newColor,
    location: document.getElementById('ev-edit-location').value.trim(),
    participants: _getSelectedParticipants('ev-edit-participants-wrap') };
  const res = await _evCommit(rp => {
    const f = _evFindIn(rp, id); if (!f) return false;   // 그사이 지워진 일정
    Object.assign(f.ev, patch);
    if (f.ds !== newDate) {
      f.list.splice(f.i,1);
      if (!f.list.length) delete rp.events[f.ds];
      const nl = rp.events[newDate] = rp.events[newDate] || [];
      nl.push(f.ev); _evSortTime(nl);
    } else _evSortTime(f.list);
  });
  if (res === null) return;
  if (res === 'gone') { toast('이미 삭제된 일정이에요.','error'); closeEventDetail(); _evRerender(); return; }
  if (res !== true) { toast(EV_SAVE_FAIL,'error'); return; }   // 편집 칸 그대로
  _evDetailDate = newDate; _evDetailId = id;
  document.getElementById('ev-edit-form').style.display='none';
  openEventDetail(_evDetailDate, _evDetailId);
  _evRerender();
  toast('일정이 수정되었습니다','success');
}
async function deleteEventById() {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  const id = _evDetailId; if (!id) return;
  const res = await _evCommit(rp => _evRemoveIn(rp, id));
  if (res === null) return;
  if (res !== true && res !== 'gone') { toast(EV_SAVE_FAIL,'error'); return; }   // 'gone' = 이미 지워짐
  closeEventDetail(); _evRerender();
}
function _renderEventComments(ev) {
  const cmts = ev.comments||[];
  let html = '';
  if (!cmts.length) html='<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px 0;">첫 댓글을 남겨보세요</div>';
  else cmts.forEach((c,i)=>{
    const dt=new Date(c.at||0);
    const dtStr=`${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    html+=`<div style="padding:8px 10px;border-radius:8px;background:var(--surface2);margin-bottom:6px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
        <span style="font-size:12px;font-weight:700;color:var(--text);">${_pEsc(c.author||'익명')}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:10px;color:var(--muted);">${dtStr}</span>
          <button onclick="deleteEventComment(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:0;line-height:1;">✕</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text);line-height:1.5;word-break:break-word;">${_pEsc(c.text).replace(/\n/g,'<br>')}</div>
    </div>`;   // 작성자·본문은 직원이 쓴 글 → 이스케이프(js/poll.js _pEsc)
  });
  document.getElementById('ev-comments-list').innerHTML = html;
}
// 댓글 저장 뒤: 상세 창이 아직 그 일정이면 댓글 목록 다시 그림(그사이 날짜가 옮겨졌으면 따라감)
function _evAfterCmt(id) {
  const f = _evFindIn(data, id);
  if (_evDetailId === id) { if (f) { _evDetailDate = f.ds; _renderEventComments(f.ev); } else closeEventDetail(); }
  renderHome();
}
async function addEventComment() {
  const ta = document.getElementById('ev-cmt-text');
  const text = ta.value.trim();
  if (!text) return;
  const author = document.getElementById('ev-cmt-author').value.trim()||currentUser?.name||'익명';
  const id = _evDetailId;
  if (!_findEvent(_evDetailDate, id)) return;
  const cmt = { id: _evNewId(), text, author, at: new Date().toISOString() };
  const res = await _evCommit(rp => {
    const f = _evFindIn(rp, id); if (!f) return false;
    const cs = f.ev.comments = f.ev.comments || [];
    if (!cs.some(c => c.id === cmt.id)) cs.push(cmt);   // 다시 시도해도 한 번만
  });
  if (res === null) return;
  if (res === 'gone') { toast('이미 삭제된 일정이에요.','error'); _evAfterCmt(id); return; }
  if (res !== true) { toast('댓글을 저장하지 못했어요. 네트워크 확인 후 다시 시도하세요.','error'); return; }   // 쓴 글은 입력칸에 그대로
  if (ta.value.trim() === text) ta.value = '';
  _evAfterCmt(id);
}
async function deleteEventComment(idx) {
  const id = _evDetailId;
  const ev = _findEvent(_evDetailDate, id); if (!ev) return;
  const old = (ev.comments||[])[idx]; if (!old) return;
  const same = c => old.id ? c.id === old.id : (c.at === old.at && c.text === old.text);   // 서버본에서 id로 찾음(번호는 그사이 바뀔 수 있음)
  const res = await _evCommit(rp => {
    const f = _evFindIn(rp, id); if (!f) return false;
    const cs = f.ev.comments || [], i = cs.findIndex(same);
    if (i < 0) return false;
    cs.splice(i, 1);
  });
  if (res === null) return;
  if (res !== true && res !== 'gone') { toast('댓글을 지우지 못했어요. 다시 시도하세요.','error'); return; }   // 'gone' = 이미 지워짐
  _evAfterCmt(id);
}

