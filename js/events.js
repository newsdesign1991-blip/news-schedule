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
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _evTintUpdate();
  setTimeout(()=>document.getElementById('ev-title').focus(), 100);
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
function saveEvent() {
  const date  = document.getElementById('ev-date').value;
  const title = document.getElementById('ev-title').value.trim();
  if (!date)  { toast('날짜를 선택하세요','error'); return; }
  if (!title) { toast('내용을 입력하세요','error'); return; }
  const time     = document.getElementById('ev-time').value || '';
  const location = document.getElementById('ev-location').value.trim();
  const author   = document.getElementById('ev-author').value.trim();
  const color    = (document.querySelector('input[name="ev-color"]:checked')?.value) || '#6366f1';
  const id       = Date.now().toString(36);
  if (!data.events) data.events = {};
  if (!data.events[date]) data.events[date] = [];
  const participants = _getSelectedParticipants('ev-participants-wrap');
  data.events[date].push({ id, title, time, location, color, author, participants });
  // 시간순 정렬
  data.events[date].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  saveData(data);
  closeEventModal();
  toast('일정이 추가되었습니다','success');
  renderHome();
  if (currentView === 'month') renderMonth();
}
function deleteEvent(dateStr, idx) {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  if (data.events?.[dateStr]) {
    data.events[dateStr].splice(idx, 1);
    if (!data.events[dateStr].length) delete data.events[dateStr];
    saveData(data);
    renderHome();
    if (currentView === 'month') renderMonth();
  }
}

// ===== 참여자 칩 =====
function _renderParticipantChips(wrapperId, selectedIds, dateStr) {
  const wrap = document.getElementById(wrapperId); if (!wrap) return;
  const _now = new Date();
  const _d = dateStr || toDateStr(_now.getFullYear(), _now.getMonth()+1, _now.getDate());
  const _sel = selectedIds||[];
  // 현재 계약기간이 아닌 사람은 숨김(단, 이미 선택된 참여자는 유지해 실수로 빠지지 않게)
  const staff = (data.staff||[]).filter(s => s.active!==false && (isContractActive(s, _d) || _sel.includes(s.id)));
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
  document.getElementById('ev-edit-form').style.display = 'block';
}
function saveEventEdit() {
  const newDate  = document.getElementById('ev-edit-date').value;
  const newTitle = document.getElementById('ev-edit-title').value.trim();
  if (!newDate||!newTitle) { toast('날짜와 내용을 입력하세요','error'); return; }
  const newTime  = document.getElementById('ev-edit-time').value||'';
  const newColor = document.querySelector('input[name="ev-edit-color"]:checked')?.value||'#6366f1';
  const oldDate  = _evDetailDate;
  const evList   = data.events?.[oldDate]||[];
  const idx      = evList.findIndex(e=>e.id===_evDetailId);
  if (idx<0) return;
  const ev = evList[idx];
  ev.title = newTitle; ev.time = newTime; ev.color = newColor;
  ev.location = document.getElementById('ev-edit-location').value.trim();
  ev.participants = _getSelectedParticipants('ev-edit-participants-wrap');
  if (newDate !== oldDate) {
    evList.splice(idx,1);
    if (!evList.length) delete data.events[oldDate];
    if (!data.events[newDate]) data.events[newDate]=[];
    data.events[newDate].push(ev);
    data.events[newDate].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    _evDetailDate = newDate;
  } else {
    evList.sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  }
  saveData(data);
  document.getElementById('ev-edit-form').style.display='none';
  openEventDetail(_evDetailDate, _evDetailId);
  renderHome();
  if (currentView==='month') renderMonth();
  toast('일정이 수정되었습니다','success');
}
function deleteEventById() {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  const list = data.events?.[_evDetailDate]||[];
  const idx = list.findIndex(e=>e.id===_evDetailId);
  if (idx>=0) { list.splice(idx,1); if(!list.length) delete data.events[_evDetailDate]; }
  saveData(data); closeEventDetail(); renderHome();
  if (currentView==='month') renderMonth();
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
        <span style="font-size:12px;font-weight:700;color:var(--text);">${c.author||'익명'}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:10px;color:var(--muted);">${dtStr}</span>
          <button onclick="deleteEventComment(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:0;line-height:1;">✕</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text);line-height:1.5;">${c.text}</div>
    </div>`;
  });
  document.getElementById('ev-comments-list').innerHTML = html;
}
function addEventComment() {
  const text = document.getElementById('ev-cmt-text').value.trim();
  if (!text) return;
  const author = document.getElementById('ev-cmt-author').value.trim()||currentUser?.name||'익명';
  const ev = _findEvent(_evDetailDate, _evDetailId); if (!ev) return;
  if (!ev.comments) ev.comments = [];
  ev.comments.push({ id: Date.now().toString(36), text, author, at: new Date().toISOString() });
  saveData(data);
  document.getElementById('ev-cmt-text').value='';
  _renderEventComments(ev);
  renderHome();
}
function deleteEventComment(idx) {
  const ev = _findEvent(_evDetailDate, _evDetailId); if (!ev) return;
  ev.comments.splice(idx,1);
  saveData(data); _renderEventComments(ev); renderHome();
}

