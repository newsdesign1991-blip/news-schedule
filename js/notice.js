/* [모듈] js/notice.js — 오늘의 공지·공감표시(리액션)·공지 삭제/푸시 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 오늘의 공지 =====
function _todayStr() { const n=new Date(); return toDateStr(n.getFullYear(),n.getMonth()+1,n.getDate()); }
function _genNoticeId(){ return 'n'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4); }
// 공지 컨테이너 정규화: { news8Time, items:[{id,text,postedBy,postedAt,silent}] }. 구형 단일객체도 흡수(읽기 전용).
function _getNoticeBox(ds){
  const raw = (data.notices||{})[ds];
  if (!raw) return { news8Time:'', items:[] };
  if (Array.isArray(raw.items)) return raw;
  return { news8Time: raw.news8Time||'', items: raw.text ? [{ id:_genNoticeId(), text:raw.text, postedBy:raw.postedBy||'', postedAt:raw.postedAt||'', silent:false }] : [] };
}
// 쓰기용: 정규화한 컨테이너를 data.notices[ds]에 보장하고 반환
function _ensureNoticeBox(ds){
  if(!data.notices) data.notices={};
  const cur = data.notices[ds];
  if (cur && Array.isArray(cur.items)) return cur;
  const box = _getNoticeBox(ds);
  data.notices[ds] = box;
  return box;
}
// ── 게시 기간(until) 유틸 ──
function _noticeEnd(ds, it){ return (it && it.until && it.until > ds) ? it.until : ds; }   // 공지 게시 종료일(없으면 게시일 당일)
function _noticeActiveItems(today){   // 오늘이 게시기간 안인 공지를 모든 날짜 박스에서 수집
  const out = [];
  Object.keys(data.notices||{}).forEach(ds => {
    if (ds > today) return;                       // 미래 게시분 제외
    (_getNoticeBox(ds).items||[]).forEach(it => { if (_noticeEnd(ds, it) >= today) out.push({ ds, it }); });
  });
  out.sort((a,b) => b.ds.localeCompare(a.ds) || String(b.it.postedAt||'').localeCompare(String(a.it.postedAt||'')));
  return out;
}
function _findNoticeItem(id){   // id로 공지 항목이 들어있는 박스 찾기(과거 게시분도 수정/삭제 가능)
  for (const ds of Object.keys(data.notices||{})) {
    const box = _ensureNoticeBox(ds);
    const it = (box.items||[]).find(i=>i.id===id);
    if (it) return { ds, box, it };
  }
  return null;
}
function _onNoticePeriodChange(){
  const sel = document.getElementById('notice-period'), dateEl = document.getElementById('notice-until'), hint = document.getElementById('notice-period-hint');
  if (!sel) return;
  const today = _todayStr();
  if (sel.value === 'keep') {   // 게시가 끝난 공지 수정 — 홈에 다시 안 올림
    dateEl.style.display = 'none';
    if (hint) hint.textContent = '게시가 끝난 공지예요. 내용만 고치고 홈에는 다시 올리지 않아요. 다시 게시하려면 기간을 고르세요.';
    document.querySelectorAll('#notice-modal .nm-chips button').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    document.getElementById('notice-cal')?._ndCal?.render();
    return;
  }
  let until;
  if (sel.value === 'custom') {
    dateEl.style.display = ''; dateEl.min = today;
    if (!dateEl.value || dateEl.value < today) dateEl.value = today;
    until = dateEl.value;
  } else { dateEl.style.display = 'none'; until = addDays(today, parseInt(sel.value)||0); }
  if (hint) {
    if (until <= today) hint.textContent = '오늘 하루만 홈 화면에 표시됩니다.';
    else { const p = until.split('-'); hint.textContent = (+p[1]) + '월 ' + (+p[2]) + '일까지 홈 화면에 계속 표시됩니다. (8뉴스 진입시간은 항상 당일만 적용)'; }
  }
  // 넓은 화면: 빠른 선택 칩 + 달력(오늘~끝날 띠) 따라가기
  document.querySelectorAll('#notice-modal .nm-chips button').forEach(b => { const on = b.dataset.v === sel.value; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  document.getElementById('notice-cal')?._ndCal?.render();
}
function _noticeSetPeriod(v){ const sel = document.getElementById('notice-period'); if (!sel) return; sel.value = v; _onNoticePeriodChange(); }
// 넓은 화면(js/nd-cal.js): 게시 기간 = 오늘부터 고정, 달력에서 끝날을 누름(프리셋과 같으면 그 항목, 아니면 '직접 선택') / 8뉴스 시간 = 직접 입력
// 값은 원래 select·date·time input에 그대로 → saveNotice는 손대지 않음
function _noticePickers(){
  if (typeof ndCal !== 'function') return;
  const sel = document.getElementById('notice-period'), dEl = document.getElementById('notice-until'), today = _todayStr();
  const until = () => sel.value === 'custom' ? ((dEl.value && dEl.value >= today) ? dEl.value : today) : addDays(today, parseInt(sel.value)||0);
  ndCal(document.getElementById('notice-cal'), { range: true, fixedFrom: today, min: today, get: () => sel.value === 'keep' ? {} : ({ from: today, to: until() }),   // keep = 게시 끝남 그대로(달력에 기간 없음)
    set: r => { const to = r.to || today, k = ['0','2','6','13','29'].find(x => addDays(today, parseInt(x)) === to); if (k) sel.value = k; else { sel.value = 'custom'; dEl.min = today; dEl.value = to; } _onNoticePeriodChange(); } });
  ndTimeInput(document.getElementById('notice-news8'), document.getElementById('notice-news8-pick'), { presets: ['19:40','19:45','19:48','19:50','19:55'] });
}
function toggleNoticeExpand(){
  const _exp=!_noticeExpanded;
  const wrap=document.getElementById('home-notice');
  const _cs=[...document.querySelectorAll('#home-notice .notice-card')];
  const _animH=function(h0,stagger){
    const panel=wrap.firstElementChild; if(!panel){ return; }
    const h1=panel.scrollHeight;
    // ★ #home-notice(부모)가 아니라 패널 자체 높이를 애니한다 → 패널의 box-shadow는 잘리지 않음(그림자 튐 제거)
    panel.style.height=h0+'px'; panel.style.overflow='hidden';
    document.querySelectorAll('#home-notice .notice-card').forEach(function(c,i){ c.style.animation='noticeCardIn .5s cubic-bezier(.5,0,.35,1) both'; c.style.animationDelay=(i*stagger)+'ms'; });
    setTimeout(function(){ panel.style.transition='height .52s cubic-bezier(.5,0,.35,1)'; panel.style.height=h1+'px'; }, 20);   // 투표와 동일한 부드러운 크기 조정
    setTimeout(function(){ panel.style.height=''; panel.style.transition=''; panel.style.overflow=''; }, 610);
  };
  if(!_exp && _cs.length>1){
    const n=_cs.length; const h0=wrap.offsetHeight;
    _cs.forEach(function(c,i){ c.style.animation='noticeCardOut .2s cubic-bezier(.4,0,.7,1) forwards'; c.style.animationDelay=((n-1-i)*26)+'ms'; });
    _noticeExpanded=false;
    setTimeout(function(){ renderNoticeBar(); _animH(h0,0); }, (n-1)*26 + 195);
    return;
  }
  const _h0=wrap.offsetHeight;
  _noticeExpanded=_exp;
  renderNoticeBar();
  if(_exp){ _animH(_h0,55); }
}
function _updateNoticeSaveBtn(){
  const b=document.getElementById('notice-save-btn'), s=document.getElementById('notice-silent');
  if(b&&s) b.innerHTML = s.checked ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>조용히 저장' : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>저장 + 전직원 알림';
}
function renderNoticeBar() {
  _noticeHistRefresh();   // 지난 공지 창이 열려 있으면 그 목록도(공감·댓글·수정·삭제 반영)
  const wrap = document.getElementById('home-notice');
  if (!wrap) return;
  const ds = _todayStr();
  // 한 달(30일)이 지난 공지는 자동 삭제 — 단 게시기간(until)이 아직 유효한 항목이 있는 박스는 보존
  if (data.notices) {
    const cutoff = addDays(ds, -30);
    let pruned = false;
    Object.keys(data.notices).forEach(d => {
      if (d >= cutoff) return;
      const bx = _getNoticeBox(d);
      const anyActive = (bx.items||[]).some(it => _noticeEnd(d, it) >= ds);
      if (!anyActive) { delete data.notices[d]; pruned = true; }
    });
    if (pruned) saveData(data);
  }
  const todayBox = _getNoticeBox(ds);
  const items = _noticeActiveItems(ds).map(a => a.it);   // 오늘 게시기간에 해당하는 공지 전부(과거 게시분 포함)
  const news8 = todayBox.news8Time || '';
  const has = items.length>0 || news8;
  const canWrite = !!(currentUser && currentUser.staffId);   // 로그인한 직원 누구나 작성 가능
  const writeBtn = canWrite ? `<button onclick="openNoticeModal()" style="background:var(--surface);border:1px solid var(--notice-border);color:#b8860b;padding:4px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;"><svg viewBox="0 0 24 24" width="12" height="12" fill="#b8860b" style="vertical-align:-2px;margin-right:3px;"><path d="M4 9v6a1 1 0 0 0 1 1h1v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3l7 4V4L9 8H5a1 1 0 0 0-1 1z"/></svg>공지 작성</button>` : '';
  const histBtn = canWrite ? `<button onclick="openNoticeHistory()" style="background:var(--surface);border:1px solid var(--border);color:var(--muted);padding:4px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" fill-rule="evenodd" style="vertical-align:-2px;margin-right:3px;"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 4a1 1 0 1 0-2 0v5a1 1 0 0 0 .45.83l3 2a1 1 0 1 0 1.1-1.66L13 11.46V7z"/></svg>지난 공지</button>` : '';
  if (!has) {
    wrap.innerHTML = '';
    return;
  }
  const news8Html = news8 ? `<div style="margin-top:10px;"><span style="font-size:12px;font-weight:700;color:#d65a52;background:var(--surface);border:1px solid #f4bab6;border-radius:6px;padding:3px 9px;">📺 오늘 8뉴스 진입 ${news8}</span></div>` : '';
  const header = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px;">
      <div style="font-size:16px;font-weight:700;color:#e8890c;"><svg viewBox="0 0 24 24" width="17" height="17" fill="#e8890c" style="vertical-align:-3px;margin-right:4px;"><path d="M4 9v6a1 1 0 0 0 1 1h1v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3l7 4V4L9 8H5a1 1 0 0 0-1 1z"/></svg>오늘의 공지${items.length>1?` <span style="opacity:0.7;">· ${items.length}건</span>`:''}</div>
      ${canWrite?`<button class="ntc-add-btn" onclick="openNoticeModal()" title="공지 추가"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`:''}
    </div>`;
  const card = (it) => {
    const title = (it.title||'').trim() || (it.text||'').split('\n')[0] || '(제목 없음)';
    const bell = it.silent ? `<span title="조용한 공지(알림 미발송)" style="opacity:0.65;margin-left:6px;display:inline-flex;vertical-align:middle;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg></span>` : '';
    const edit = canWrite ? `<button onclick="event.stopPropagation();openNoticeModal('${it.id}')" style="background:transparent;border:none;color:#b8860b;cursor:pointer;font-size:13px;padding:0 2px;flex-shrink:0;" title="수정"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:-2px;"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>` : '';
    const span = (it.until && it.until > ds) ? (function(){ const p=it.until.split('-'); return `<span title="게시 기간" style="font-size:10px;font-weight:700;color:#c77f0a;background:rgba(255,176,32,0.16);border:none;border-radius:6px;padding:2px 7px;white-space:nowrap;font-weight:800;"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" style="vertical-align:-1px;margin-right:3px;"><path d="M9 2h6a1 1 0 0 1 0 2h-.6l.9 6.2 2.4 2.4a1 1 0 0 1-.7 1.7H13v5.1a1 1 0 0 1-2 0V14.3H5.9a1 1 0 0 1-.7-1.7l2.4-2.4L8.5 4H8a1 1 0 0 1 0-2z"/></svg>~${+p[1]}/${+p[2]}</span>`; })() : '';
    const by = it.postedBy ? `<span style="font-size:11.5px;color:var(--muted);font-weight:500;">· ${_pEsc(it.postedBy)}</span>` : '';
    return `<div class="notice-card" data-nid="${it.id}" onclick="openNoticeDetail('${it.id}')" style="background:linear-gradient(135deg,var(--notice-bg1) 0%,var(--notice-bg2) 100%);border:1px solid var(--notice-border);border-radius:12px;padding:11px 13px;cursor:pointer;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div class="ntc-title" style="font-size:15px;font-weight:800;line-height:1.4;word-break:break-word;">${_pEsc(title)}${bell}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:6px;"><span style="font-size:11.5px;color:#b8860b;font-weight:800;">눌러서 전체 보기 ›</span>${by}${(it.comments||[]).length?`<span class="ntc-cmt-cnt">댓글 ${(it.comments||[]).length}</span>`:''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">${span}</div>
          </div>
        ${_noticeReactBar(it, false)}</div>`;
  };
  let body;
  if (items.length <= 1) {
    body = items.map(card).join('');
  } else if (_noticeExpanded) {
    body = `<div style="display:flex;flex-direction:column;gap:8px;">${items.map(card).join('')}</div>
      <div style="text-align:center;margin-top:11px;"><button onclick="toggleNoticeExpand()" class="ntc-fold-btn"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>접기</button></div>`;
  } else {
    body = `<div onclick="toggleNoticeExpand()" style="position:relative;margin-bottom:20px;cursor:pointer;">
        <div style="position:relative;z-index:3;">${card(items[0])}</div>
        <div style="position:absolute;left:6px;right:6px;bottom:-6px;height:18px;background:var(--notice-stack1);border:1px solid var(--notice-border);border-radius:0 0 12px 12px;z-index:2;animation:ncFade .5s ease both;"></div>
        <div style="position:absolute;left:12px;right:12px;bottom:-12px;height:18px;background:var(--notice-stack2);border:1px solid var(--notice-border);border-radius:0 0 12px 12px;z-index:1;animation:ncFade .5s ease both;"></div>
      </div>
      <div style="text-align:center;"><button onclick="toggleNoticeExpand()" class="ntc-fold-btn"><span>공지 ${items.length}건 모두 보기</span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button></div>`;
  }
  wrap.innerHTML = `<div style="background:var(--notice-panel);border:1px solid var(--notice-border);border-radius:14px;padding:21.5px 16px 14px;">${header}${body}${news8Html}</div>`;
  _applyNoticeClamp();
  _bindNoticeReacts();
}
// ===== 오늘의 공지 공감표시 (카톡식 리액션) =====
const NOTICE_EMOJIS=['@bcheck','👍','👏','🙏','❤️','🔥','😂','😍','😮','😢','😡','🥺','🎉','👌','💪','😎','👀','🤔','😭','😅','🥳','💯','🙌'];
function _rxIcon(e){ if(e==='@bcheck') return '<svg viewBox=\'0 0 24 24\' width=\'1.05em\' height=\'1.05em\' style=\'vertical-align:-.16em;\'><circle cx=\'12\' cy=\'12\' r=\'11\' fill=\'#3182f6\'/><path d=\'M6.8 12.4l3.4 3.4L17.4 9\' fill=\'none\' stroke=\'#fff\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>'; return e; }
function _ndReactAddIcon(){ return '<svg viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><circle cx=\'11\' cy=\'12\' r=\'8\'/><path d=\'M8.5 14a3.5 3.5 0 0 0 5 0\'/><line x1=\'9\' y1=\'10\' x2=\'9\' y2=\'10.01\'/><line x1=\'13\' y1=\'10\' x2=\'13\' y2=\'10.01\'/><line x1=\'19\' y1=\'5\' x2=\'19\' y2=\'9\'/><line x1=\'17\' y1=\'7\' x2=\'21\' y2=\'7\'/></svg>'; }
function _ndWhoIcon(){ return '<svg viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><circle cx=\'12\' cy=\'8\' r=\'4\'/><path d=\'M4.5 20.5c0-4 3.4-7 7.5-7s7.5 3 7.5 7\'/></svg>'; }
// interactive=false(홈 바깥): 공감이 있을 때만 표시(추가/토글 불가, 클릭하면 카드가 팝업 오픈).
// interactive=true(팝업): 공감 추가(웃는얼굴)+ 누가 공감했는지 보기(사람) 버튼 포함.
function _noticeReactBar(it, interactive){
  const rx=it.reactions||{};
  const byEmoji={};
  Object.keys(rx).forEach(sid=>{ const e=rx[sid]; (byEmoji[e]=byEmoji[e]||[]).push(sid); });
  const myId=(currentUser&&currentUser.staffId)||null;
  const myE=myId?rx[myId]:null;
  const canReact=!!(currentUser&&currentUser.staffId);
  const keys=Object.keys(byEmoji);
  if(!interactive){
    if(!keys.length) return '';   // 바깥화면: 공감 없으면 아무것도 안 보임
    const pills=keys.map(e=>`<span class="ntc-rx${myE===e?' mine':''}" style="pointer-events:none;">${_rxIcon(e)}<b>${byEmoji[e].length}</b></span>`).join('');
    return `<div class="ntc-react ntc-react-ro" data-nid="${it.id}">${pills}</div>`;
  }
  const pills=keys.map(e=>`<button class="ntc-rx${myE===e?' mine':''}" onclick="event.stopPropagation();_noticeReactSet('${it.id}','${e}')">${_rxIcon(e)}<b>${byEmoji[e].length}</b></button>`).join('');
  const addBtn=canReact?`<button class="ntc-rx-add" onclick="event.stopPropagation();openReactPicker('${it.id}',this)" title="공감 추가">${_ndReactAddIcon()}</button>`:'';
  const whoBtn=`<button class="ntc-rx-add ntc-rx-who" onclick="event.stopPropagation();openReactDetail('${it.id}')" title="누가 공감했는지 보기">${_ndWhoIcon()}</button>`;
  return `<div class="ntc-react" data-nid="${it.id}">${pills}${addBtn}${whoBtn}</div>`;
}
function _noticeReactSet(itemId, emoji){
  if(!currentUser||!currentUser.staffId){ toast('이름으로 로그인 후 공감할 수 있습니다.','error'); return; }
  const found=_findNoticeItem(itemId); if(!found) return;
  const myId=currentUser.staffId; const it=found.it;
  if(!it.reactions) it.reactions={};
  if(it.reactions[myId]===emoji) delete it.reactions[myId]; else it.reactions[myId]=emoji;
  const desired=it.reactions[myId];
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }catch(e){}
  closeReactPicker();
  _noticeReactRefresh(itemId);
  _ndCommit((rp)=>{
    let target=null;
    Object.keys(rp.notices||{}).forEach(ds=>{ const items=((rp.notices[ds]||{}).items)||[]; const t=items.find(x=>x.id===itemId); if(t) target=t; });
    if(!target) return false;   // 공지가 이미 없음 → 쓰지 않음('gone')
    if(!target.reactions) target.reactions={};
    if(desired===undefined) delete target.reactions[myId]; else target.reactions[myId]=desired;
  }).then(ok=>{ if(ok) _noticeReactRefresh(itemId); });
}
// 원격 최신본에 내 공감만 병합 + updated_at 낙관적잠금 + 재시도 (동시 공감 무손실).
// mutate가 false를 돌려주면(대상 없음) 쓰지 않고 'gone'. 성공하면 true(그 뒤 ndAdoptMergedSave로 리비전 맞춤)
async function _ndCommit(mutate){
  if(isAdminTest) return true;
  const url=`${SB_URL}/rest/v1/nd_data?id=eq.main`;
  for(let attempt=0;attempt<6;attempt++){
    let remote;
    try{ const g=await fetch(`${url}&select=payload,updated_at`,{headers:SB_HEADERS}); if(!g.ok) throw new Error('GET'); const a=await g.json(); remote=a&&a[0]; }
    catch(e){ console.warn('공감 동기화 읽기 실패',e); return false; }
    if(!remote||!remote.payload) return false;
    const rp=remote.payload, base=rp._dataRevision||0; if(!rp.notices) rp.notices={};
    let mr; try{ mr=mutate(rp); }catch(e){ console.warn('공감 mutate 실패',e); return false; }
    if(mr===false){ ndAdoptGoneSnapshot(base, ()=>{ data.notices=rp.notices; }); return 'gone'; }   // 대상 공지가 이미 없음 → 쓰지 않음
    const nowIso=new Date().toISOString();
    try{
      const cond=remote.updated_at?`&updated_at=eq.${encodeURIComponent(remote.updated_at)}`:'';
      const pr=await fetch(`${url}${cond}`,{method:'PATCH',headers:Object.assign({},SB_HEADERS,{'Prefer':'return=representation'}),body:JSON.stringify({payload:rp,updated_at:nowIso})});
      if(!pr.ok) throw new Error('PATCH');
      const rows=await pr.json();
      if(Array.isArray(rows)&&rows.length>0){ const saved=rows[0]; data.notices=(saved.payload&&saved.payload.notices)||rp.notices; ndAdoptMergedSave(base, saved); try{ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }catch(e){} _localBackup(data); return true; }
    }catch(e){ console.warn('공감 동기화 쓰기 실패',e); return false; }
    await new Promise(res=>setTimeout(res, 70+attempt*110+Math.floor(Math.random()*140)));
  }
  return false;
}
// 이모지 피커
function openReactPicker(itemId, btn){
  closeReactPicker();
  if(!currentUser||!currentUser.staffId){ toast('이름으로 로그인 후 공감할 수 있습니다.','error'); return; }
  const pop=document.createElement('div'); pop.id='react-picker'; pop.className='react-picker';
  pop.innerHTML=NOTICE_EMOJIS.map(e=>`<button class="react-emo" onclick="_noticeReactSet('${itemId}','${e}')">${_rxIcon(e)}</button>`).join('');
  document.body.appendChild(pop);
  const rc=btn.getBoundingClientRect(); const pw=pop.offsetWidth, ph=pop.offsetHeight;
  let left=Math.max(10, Math.min(rc.left, window.innerWidth-pw-10));
  let top=rc.bottom+8; if(top+ph>window.innerHeight-10) top=Math.max(10, rc.top-ph-8);
  pop.style.left=left+'px'; pop.style.top=top+'px';
  setTimeout(()=>document.addEventListener('click', _reactPickerOutside, true), 0);
}
function _reactPickerOutside(e){ const p=document.getElementById('react-picker'); if(p && !p.contains(e.target)) closeReactPicker(); }
function closeReactPicker(){ const p=document.getElementById('react-picker'); if(p) p.remove(); document.removeEventListener('click', _reactPickerOutside, true); }
// 누가 어떤 공감 했나(꾹 눌러서 보기)
function openReactDetail(itemId){
  const found=_findNoticeItem(itemId); if(!found) return;
  closeReactPicker();
  const ov=document.getElementById('react2-modal'); const card=document.getElementById('react2-card');
  if(!ov||!card){ _pollShow(_reactDetailHtml(found.it)); return; }
  card.innerHTML=_reactDetailHtml(found.it);
  // 위치 초기화
  card.style.position=''; card.style.left=''; card.style.top=''; card.style.margin='';
  ov.classList.remove('r2-side');
  ov.style.display='flex';
  const notice=document.getElementById('poll-modal-card');
  const gap=16;
  const cwEst = 400;
  const wide = notice && (window.innerWidth >= (notice.getBoundingClientRect().width + gap + cwEst + 24));
  if(wide){
    // 넓은 화면: 공지 팝업 카드 옆에 나란히. 정확한 위치 측정 위해 공지 카드의 이전 transform/애니 먼저 정리.
    notice.getAnimations().forEach(function(a){ try{a.cancel();}catch(e){} });
    notice.style.transition='none';
    notice.style.transform='none';
    void notice.offsetWidth;   // 리플로우로 원위치 확정
    ov.classList.add('r2-side');   // 배경 투명 + 카드 position:fixed
    const cw=card.offsetWidth||cwEst, ch=card.offsetHeight||400;
    const nr=notice.getBoundingClientRect();   // 원위치(중앙)에서 측정
    const shift=Math.round((cw+gap)/2);   // 공지 카드를 왼쪽으로 이동시켜 쌍을 중앙 정렬
    notice.style.transition='transform .32s cubic-bezier(.5,0,.35,1)';
    notice.style.transform='translateX(-'+shift+'px)';
    let left=(nr.right - shift) + gap;
    if(left+cw>window.innerWidth-10) left=window.innerWidth-cw-10;
    if(left<10) left=10;
    let top=nr.top; if(top+ch>window.innerHeight-10) top=Math.max(10, window.innerHeight-ch-10);
    card.style.left=Math.round(left)+'px'; card.style.top=Math.round(Math.max(10,top))+'px';
    // 등장: 블러+오파시티(넓은 화면만 — 데스크톱은 blur 부담 적음)
    try{ card.animate([{opacity:0,filter:'blur(12px)',transform:'scale(.97)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}],{duration:340,easing:'cubic-bezier(.5,0,.35,1)'}); }catch(e){}
  } else {
    // 모바일(좁은 화면): 공지 카드 안 건드리고 위에 덮기(transform 리셋/애니취소 안 함 → 덜컹 방지).
    // 등장은 blur 없이 opacity+scale만 → 모바일 GPU 부담↓, 부드럽게.
    try{ card.animate([{opacity:0,filter:'blur(12px)',transform:'scale(.97)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}],{duration:340,easing:'cubic-bezier(.5,0,.35,1)'}); }catch(e){}
  }
}
function closeReact2(){
  const notice=document.getElementById('poll-modal-card');
  if(notice){ notice.style.transition='transform .3s cubic-bezier(.5,0,.35,1)'; notice.style.transform='none'; }
  _animModalClose(document.getElementById('react2-modal'));
}
// 공감한 사람(이모지별) + 확인함(공감 없이 열어 본 사람) + 아직 확인 안 한 사람 띠 — 따로 뜨는 공감 현황(모바일)과 넓은 화면 합친 창이 같이 씀.
// '확인' = 공감했거나, 공지 확인 창을 연 적 있거나(서버 별도 저장칸, _noticeSeenCache), 올린 사람. 활성 직원만 셈(머리 숫자와 띠가 같은 기준)
function _reactBandsHtml(it){
  const rx=it.reactions||{}, active=(data.staff||[]).filter(st=>st.active!==false), actIds=new Set(active.map(st=>st.id));
  const byEmoji={};
  Object.keys(rx).forEach(sid=>{ if(actIds.has(sid)) (byEmoji[rx[sid]]=byEmoji[rx[sid]]||[]).push(sid); });
  const emojis=Object.keys(byEmoji);
  const rxHtml = emojis.length ? emojis.map(e=>{
    const names=byEmoji[e].map(sid=>{ const st=staffById(sid); return st?st.name:null; }).filter(Boolean);
    return `<div class="poll-band" style="background:rgba(255,171,0,.1);"><div class="poll-band-hd" style="color:#b7791f;"><span style="font-size:18px;">${_rxIcon(e)}</span> ${names.length}명</div><div class="poll-band-names" style="color:var(--text);">${names.map(n=>`<span>${_pEsc(n)}</span>`).join('')}</div></div>`;
  }).join('') : `<div style="text-align:center;color:var(--muted);font-size:13px;padding:18px 0;">아직 아무도 공감하지 않았어요</div>`;
  const reacted=new Set(Object.keys(rx)), seen=_noticeSeenSet(it);
  const seenOnly=active.filter(st=>!reacted.has(st.id) && seen.has(st.id)).map(st=>st.name);
  const notYet=active.filter(st=>!reacted.has(st.id) && !seen.has(st.id)).map(st=>st.name);
  const seenHtml=seenOnly.length?`<div class="poll-band nd-seen" style="background:rgba(22,163,74,.08);"><div class="poll-band-hd" style="color:#15803d;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>확인함 · ${seenOnly.length}명</div><div class="poll-band-names" style="color:var(--text);">${seenOnly.map(n=>`<span>${_pEsc(n)}</span>`).join('')}</div></div>`:'';
  const notHtml=`<div class="poll-band nd-not" style="background:var(--surface2);"><div class="poll-band-hd" style="color:var(--muted);">아직 확인 안 함 · ${notYet.length}명</div><div class="poll-band-names" style="color:var(--muted);">${notYet.length?notYet.map(n=>`<span>${_pEsc(n)}</span>`).join(''):'<span>모두 확인했어요</span>'}</div></div>`;
  return rxHtml+seenHtml+notHtml;
}
// 넓은 화면 왼쪽 아래 현황(확인 N명 · 공감 M명 + 공감 누르기 + 띠) — 공감·확인이 바뀌면 이 부분만 다시 그림(댓글 칸은 그대로)
function _noticeStatusHtml(it){
  const act=new Set((data.staff||[]).filter(st=>st.active!==false).map(st=>st.id)), sn=_noticeSeenSet(it);
  const nSeen=[...sn].filter(id=>act.has(id)).length, nRx=Object.keys(it.reactions||{}).filter(id=>act.has(id)).length;
  return `<div class="ntd-rhd">확인 <b>${nSeen}명</b><span class="ntd-rhd-sep">·</span>공감 <b>${nRx}명</b></div>${_noticeReactBar(it, true)}<div class="ntd-bands">${_reactBandsHtml(it)}</div>`;
}
// ===== 확인함(열어 본 사람) =====
// 근무표 문서(nd_data main)에 쓰면 저장 번호가 올라가 다른 사람(관리자 편집 등)의 다음 저장이 막히므로,
// 서버 notify 함수(mode:'seen')가 별도 저장칸(nd_data id='seen', 저장 번호 검사 없음)에 기록·조회. 응답 = 그 공지를 확인한 사람 목록
let _noticeSeenCache={};   // 공지 id → {직원 id: 시각}
function _noticeSeenSet(it){ const s=new Set(Object.keys(_noticeSeenCache[it.id]||{})); Object.keys(it.reactions||{}).forEach(id=>s.add(id)); if(it.postedById) s.add(it.postedById); return s; }
// 공지 확인 창을 열면: 내 기록(로그인한 직원·관리자 테스트 아님) + 확인한 사람 목록 받아 오기. 실패해도 다음에 열 때 다시 시도
async function _noticeSyncSeen(itemId){
  const u=currentUser, me=(u&&u.staffId&&!isAdminTest)?u.staffId:'';
  if(me){ (_noticeSeenCache[itemId]=_noticeSeenCache[itemId]||{})[me]=_noticeSeenCache[itemId][me]||new Date().toISOString(); }   // 내 화면엔 바로 '확인함'
  try{
    const r=await fetch(NOTIFY_FN_URL,{ method:'POST', headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY }, body:JSON.stringify({ mode:'seen', notice_id:itemId, staff_id:me, until:(function(){ const f=_findNoticeItem(itemId); return f?_noticeEnd(f.ds, f.it):''; })() }) });   // until = 게시 종료일(서버가 기록 정리 기준으로 씀)
    const j=await r.json().catch(()=>({}));
    if(r.ok && j && j.seen && typeof j.seen==='object'){ _noticeSeenCache[itemId]=Object.assign({}, j.seen, me&&!j.seen[me]?{[me]:_noticeSeenCache[itemId][me]}:{}); _noticeStatusRefresh(itemId); }
  }catch(e){ /* 연결이 안 되면 내 화면에서만 확인함 — 다음에 열 때 다시 보냄 */ }
}
function _reactDetailHtml(it){
  const preview=(it.text||'').replace(/\n/g,' ').slice(0,28);
  return `<div class="modal-header"><div class="mh-title">공감 현황</div><button class="modal-close" onclick="closeReact2()">✕</button></div>
    <div class="poll-scroll" style="padding:15px 20px 20px;">
      <div style="font-size:12px;color:var(--muted);margin-bottom:13px;line-height:1.5;">“${_pEsc(preview)}${(it.text||'').length>28?'…':''}”</div>
      ${_reactBandsHtml(it)}
    </div>`;
}
function _noticeReactRefresh(itemId){ renderNoticeBar(); _noticeStatusRefresh(itemId); }
// 열린 확인 창의 현황만 다시 그림: 넓은 화면=왼쪽 아래 .ntd-status, 모바일=아래 공감 줄. 댓글 칸·입력 중인 글은 건드리지 않음
function _noticeStatusRefresh(itemId){
  if(window._noticeDetailId!==itemId) return;
  const pm=document.getElementById('poll-modal'), c=document.getElementById('poll-modal-card'); if(!pm || pm.style.display!=='flex' || !c) return;
  const fd=_findNoticeItem(itemId); if(!fd) return;
  const st=c.querySelector('.ntd-status'); if(st) st.innerHTML=_noticeStatusHtml(fd.it);
  const ft=c.querySelector('.ntc-detail-foot'); if(ft) ft.innerHTML=_noticeReactBar(fd.it, true);
  const r2=document.getElementById('react2-modal'), r2c=document.getElementById('react2-card');
  if(r2 && r2c && r2.style.display==='flex') r2c.innerHTML=_reactDetailHtml(fd.it);   // 모바일 '공감 현황' 창이 떠 있으면 같이
}
// 댓글(js/nd-comments.js): 내 화면에 먼저 보이고 → 서버 최신본에 이 댓글만 넣거나 뺌(_ndCommit, 동시 저장 안전).
// 실패하면 되돌리고 false(입력했던 글은 입력칸으로 돌아감). 같은 id는 두 번 안 들어감(재시도 안전)
function _noticeCmtShow(itemId, scrollToId){
  const fd=_findNoticeItem(itemId), list=(fd&&fd.it.comments)||[];
  if(typeof ndCmtRefresh==='function') ndCmtRefresh('notice', itemId, list, scrollToId);
  renderNoticeBar();   // 홈 카드의 댓글 수
}
// 지워진 공지: 그 공지 확인 창이 열려 있을 때만 닫고(그사이 연 다른 창은 그대로) 홈 공지 다시 그림
function _noticeGoneClose(itemId){ if(window._noticeDetailId===itemId) closePollModal(); renderNoticeBar(); }
function _noticeCmtRemote(rp, itemId){ let t=null; Object.keys(rp.notices||{}).forEach(ds=>{ const items=((rp.notices[ds]||{}).items)||[]; const x=items.find(y=>y.id===itemId); if(x) t=x; }); return t; }
async function _noticeCmtAdd(itemId, cmt){
  if(isAdminTest){ toast('관리자 테스트 모드에서는 댓글이 저장되지 않아요.','error'); return false; }
  const fd=_findNoticeItem(itemId); if(!fd){ toast('이미 삭제된 공지예요.','error'); _noticeGoneClose(itemId); return false; }
  (fd.it.comments=fd.it.comments||[]).push(cmt);   // 기기 저장(localStorage)은 서버 저장 성공 때 _ndCommit이 함(실패 시 남지 않게)
  _noticeCmtShow(itemId, cmt.id);
  const res=await _ndCommit(rp=>{ const t=_noticeCmtRemote(rp, itemId); if(!t) return false; t.comments=t.comments||[]; if(!t.comments.some(c=>c.id===cmt.id)) t.comments.push(cmt); });
  const ok=res===true;
  if(res==='gone'){ toast('이미 삭제된 공지예요.','error'); _noticeGoneClose(itemId); return false; }
  if(!ok){ const f2=_findNoticeItem(itemId); if(f2&&f2.it.comments) f2.it.comments=f2.it.comments.filter(c=>c.id!==cmt.id); toast('댓글을 저장하지 못했어요. 네트워크 확인 후 다시 시도하세요.','error'); }
  _noticeCmtShow(itemId); return ok;
}
async function _noticeCmtDel(itemId, cid){
  if(isAdminTest){ toast('관리자 테스트 모드에서는 댓글이 저장되지 않아요.','error'); return false; }
  const fd=_findNoticeItem(itemId); if(!fd){ _noticeGoneClose(itemId); return false; }
  const old=(fd.it.comments||[]).find(c=>c.id===cid); if(!old || !ndCmtCanDelete(old)) return false;
  fd.it.comments=(fd.it.comments||[]).filter(c=>c.id!==cid);
  _noticeCmtShow(itemId);
  const res=await _ndCommit(rp=>{ const t=_noticeCmtRemote(rp, itemId); if(!t) return false; if(!(t.comments||[]).some(c=>c.id===cid)) return false; t.comments=t.comments.filter(c=>c.id!==cid); });
  if(res==='gone' && !_findNoticeItem(itemId)){ toast('이미 삭제된 공지예요.','error'); _noticeGoneClose(itemId); return true; }
  const ok=res===true||res==='gone';   // 'gone' = 댓글만 이미 지워짐 → 지운 것과 같음
  if(!ok){ const f2=_findNoticeItem(itemId); if(f2 && !(f2.it.comments||[]).some(c=>c.id===cid)) (f2.it.comments=f2.it.comments||[]).push(old); toast('댓글을 지우지 못했어요. 다시 시도하세요.','error'); }
  _noticeCmtShow(itemId); return ok;
}
function openNoticeDetail(itemId, srcEl){   // srcEl = 커지는 효과의 시작 카드(없으면 홈 공지 카드)
  const found=_findNoticeItem(itemId); if(!found) return;
  _noticeSyncSeen(itemId);   // 열어 본 사람 = 확인함(서버 별도 저장칸, 근무표 저장 번호 안 올림)
  closeReactPicker();
  const src=srcEl||document.querySelector('#home-notice .notice-card[data-nid="'+itemId+'"]');
  _pollShow(_noticeDetailHtml(found.it)); window._noticeDetailId=itemId;
  if(typeof _pollWide==='function' && _pollWide()) document.getElementById('poll-modal-card')?.classList.add('pc-wide-card');   // 넓은 화면: 공지+공감 2분할 큰 창
  const pm=document.getElementById('poll-modal'); if(pm) pm.classList.add('nc-yellow');
  try{
    const modal=document.getElementById('poll-modal-card');
    if(src && modal && pm){
      pm.classList.add('nc-morph');
      const from=src.getBoundingClientRect(), to=modal.getBoundingClientRect();
      const dx=(from.left+from.width/2)-(to.left+to.width/2);
      const dy=(from.top+from.height/2)-(to.top+to.height/2);
      const sx=Math.max(.2,from.width/to.width), sy=Math.max(.2,from.height/to.height);
      pm.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease'});
      modal.animate([
        { transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity:.55 },
        { transform:'none', opacity:1 }
      ], { duration:460, easing:'cubic-bezier(.22,1,.36,1)', fill:'both' });
      // ★ nc-morph를 유지한다: 제거하면 CSS ndModalPop가 되살아나 팝업이 다시 팝(툭 재생성)됨.
      //   닫힐 때는 nd-closing이 붙어 CSS 규칙이 풀리며 닫힘 애니가 정상 재생됨. 다음 열림 때 _pollShow가 정리.
    }
  }catch(e){ if(pm) pm.classList.remove('nc-morph'); }
}
function _noticeIsMine(it){
  if(!it) return false;
  if(typeof isMaster!=='undefined' && isMaster) return true;   // 마스터는 항상 가능
  var u=currentUser||{};
  if(it.postedById) return it.postedById===u.staffId;
  return !!(it.postedBy && u.name && it.postedBy===u.name);     // 구버전(작성자ID 없음) 이름 매칭
}
// 상세 팝업 → 수정창: 블러+오파시티로 팝업 사라지고, 수정 팝업도 블러+오파시티로 등장
function _noticeEditFromDetail(id){
  var pc=document.getElementById('poll-modal-card'), pm=document.getElementById('poll-modal');
  try{ if(pc) pc.animate([{opacity:1,filter:'blur(0px)'},{opacity:0,filter:'blur(14px)'}],{duration:280,easing:'cubic-bezier(.4,0,.5,1)',fill:'forwards'}); }catch(e){}
  try{ if(pm) pm.animate([{opacity:1},{opacity:0}],{duration:280,easing:'ease',fill:'forwards'}); }catch(e){}
  setTimeout(function(){
    try{ if(pc) pc.getAnimations().forEach(function(a){a.cancel();}); }catch(e){}
    try{ if(pm) pm.getAnimations().forEach(function(a){a.cancel();}); }catch(e){}
    if(pm){ pm.style.display='none'; pm.classList.remove('nc-yellow','nc-morph'); }
    window._noticeDetailId=null;
    const hm=document.getElementById('notice-history-modal'); if(hm && hm.style.display==='flex') hm.style.display='none';   // 수정 창이 지난 공지 창 뒤에 가려지지 않게
    openNoticeModal(id);
    var nc=document.querySelector('#notice-modal .modal');
    try{ if(nc) nc.animate([{opacity:0,filter:'blur(14px)',transform:'scale(.97)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}],{duration:360,easing:'cubic-bezier(.16,1,.3,1)'}); }catch(e){}
  }, 275);
}
function _noticeDetailHtml(it){
  const title=(it.title||'').trim() || (it.text||'').split('\n')[0] || '공지';
  const body=(it.text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const by=it.postedBy?`<div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:13px;">${_pEsc(it.postedBy)}님이 올림</div>`:'';
  const _edit = _noticeIsMine(it) ? `<button class="modal-close" onclick="_noticeEditFromDetail('${it.id}')" title="수정" style="color:#b8860b;"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>` : '';
  const head=`<div class="modal-header"><div class="mh-title">${_pEsc(title)}</div><div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">${_edit}<button class="modal-close" onclick="closePollModal()">✕</button></div></div>`;
  // 넓은 화면: 공감 현황을 따로 띄우지 않고 한 창에 — 왼쪽 공지 본문 + 그 아래 확인·공감 현황(누르기·이름·아직 확인 안 함) / 오른쪽 댓글만(css/popup-wide.css .ntd-*)
  if(typeof _pollWide==='function' && _pollWide()){
    return head+`<div class="ntd-wide">
      <div class="ntd-left poll-scroll">${by}<div class="ntd-body">${body}</div><div class="ntd-status">${_noticeStatusHtml(it)}</div></div>
      <div class="ntd-right poll-scroll">${typeof ndCmtSection==='function'?ndCmtSection('notice', it.id, it.comments):''}</div>
    </div>`;
  }
  return head+`
    <div class="poll-scroll" style="padding:16px 20px 18px;">
      ${by}
      <div style="font-size:14.5px;color:var(--text);line-height:1.75;white-space:pre-wrap;word-break:break-word;">${body}</div>
      ${typeof ndCmtSection==='function'?ndCmtSection('notice', it.id, it.comments):''}
    </div>
    <div class="ntc-detail-foot">${_noticeReactBar(it, true)}</div>`;
}
// 롱프레스(꾹 누르기) 바인딩 — fn(x,y) = 누른 자리. 터치 뒤 브라우저가 흉내 내는 마우스 이벤트(약 0.8초 안)는 무시,
// 두 손가락이면 취소, 안드로이드처럼 길게 누르면 contextmenu도 오는 경우 한 번만 부름. 길게 누른 뒤 따라오는 click은 막음(카드 안 버튼이 같이 눌리지 않게)
function _bindLP(el, fn){
  let timer=null, fired=false, sx=0, sy=0, lastTouch=0, lastFire=0;
  const fire=(x,y)=>{ lastFire=Date.now(); fn(x,y); };
  const start=(x,y)=>{ if(timer) clearTimeout(timer); fired=false; sx=x; sy=y; timer=setTimeout(()=>{ timer=null; fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} fire(sx, sy); }, 480); };
  const move=(x,y)=>{ if(timer && (Math.abs(x-sx)>10||Math.abs(y-sy)>10)){ clearTimeout(timer); timer=null; } };
  const end=()=>{ if(timer){ clearTimeout(timer); timer=null; } };
  const fromTouch=()=>Date.now()-lastTouch<800;
  el.addEventListener('touchstart', e=>{ lastTouch=Date.now(); fired=false; if(e.touches.length>1){ end(); return; } const t=e.touches[0]; start(t.clientX,t.clientY); }, {passive:true});
  el.addEventListener('touchmove', e=>{ lastTouch=Date.now(); if(e.touches.length>1){ end(); return; } const t=e.touches[0]; move(t.clientX,t.clientY); }, {passive:true});
  el.addEventListener('touchend', ()=>{ lastTouch=Date.now(); end(); }); el.addEventListener('touchcancel', ()=>{ lastTouch=Date.now(); end(); });
  el.addEventListener('click', e=>{ if(fired){ e.stopPropagation(); e.preventDefault(); fired=false; } }, true);
  el.addEventListener('mousedown', e=>{ if(fromTouch()) return; fired=false; if(e.button===0) start(e.clientX,e.clientY); });
  el.addEventListener('keydown', ()=>{ fired=false; });   // 길게 누른 뒤 click이 안 온 경우(iOS 등) 다음 입력이 먹히지 않게
  el.addEventListener('mousemove', e=>{ if(!fromTouch()) move(e.clientX,e.clientY); });
  el.addEventListener('mouseup', ()=>{ if(!fromTouch()) end(); }); el.addEventListener('mouseleave', ()=>{ if(!fromTouch()) end(); });
  el.addEventListener('contextmenu', e=>{ e.preventDefault(); end(); if(Date.now()-lastFire<800) return; if(fromTouch()) fired=true; fire(e.clientX, e.clientY); });
}
function _bindNoticeReacts(){ /* 바깥화면 공감은 표시 전용 — 롱프레스/토글 바인딩 없음. 상세는 팝업의 사람 아이콘으로 확인 */ }
// 팝업이 열려 있을 때, 팝업 내부의 '실제 스크롤되는 영역'이 아니면 터치 스크롤을 막아
// 뒤 배경이 움직이는 현상을 차단. (body position:fixed 잠금 없이 — 오버레이/레이아웃 변형 방지)
(function(){
  function _anyModalOpen(){
    const els=document.querySelectorAll('.modal-overlay, #lr-popup-overlay, .nd-modal, .staff-modal-overlay');
    for(let i=0;i<els.length;i++){ const el=els[i]; const cs=getComputedStyle(el); if(cs.display!=='none' && cs.visibility!=='hidden' && el.offsetHeight>0) return true; }
    return false;
  }
  // 이벤트 대상이 '스크롤 가능한 팝업 내부'가 아니면 true(=배경 스크롤이므로 차단)
  function _shouldBlock(target){
    let n=target;
    while(n && n.nodeType===1){
      if(n.classList && (n.classList.contains('modal-overlay')||n.id==='lr-popup-overlay'||n.classList.contains('nd-modal')||n.classList.contains('staff-modal-overlay'))) break;
      const cs=getComputedStyle(n);
      if(/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight>n.clientHeight+1) return false;   // 스크롤 가능한 내부 → 허용
      n=n.parentElement;
    }
    return true;
  }
  document.addEventListener('touchmove', function(e){
    if(e.touches && e.touches.length>1) return;      // 핀치 줌은 허용
    if(!_anyModalOpen()) return;
    if(_shouldBlock(e.target)) e.preventDefault();
  }, {passive:false});
  document.addEventListener('wheel', function(e){    // 데스크톱 마우스 휠 배경 스크롤 차단
    if(!_anyModalOpen()) return;
    if(_shouldBlock(e.target)) e.preventDefault();
  }, {passive:false});
})();
// 각 공지 본문이 접힘 최대높이보다 길면 → 접고 하단 페이드 + '더보기' 노출. 펼침 상태(_noticeTextOpen)면 전문+접기.
function _applyNoticeClamp(){
  // 접힘 최대 높이: 화면의 약 30%(120~300px)로 제한 — '길어도 절반 정도만' 보이게
  const cap = Math.max(120, Math.min(Math.round((window.innerHeight||700)*0.30), 300));
  // 접힘 시 글자 자체를 하단으로 갈수록 투명하게(mask) → 배경이 그대로 비쳐 경계(사각형) 없이 자연스럽게 흐려짐
  const MASK = 'linear-gradient(to bottom, #000 calc(100% - 52px), transparent 100%)';
  document.querySelectorAll('#home-notice .notice-text').forEach(el=>{
    const id = el.getAttribute('data-nid');
    const inner = el.querySelector('.notice-text-inner');
    const moreWrap = el.parentElement.querySelector('.notice-more');
    const btn = moreWrap ? moreWrap.querySelector('button') : null;
    const contentH = inner ? inner.scrollHeight : 0;
    const overflow = contentH > cap + 6;
    const open = _noticeTextOpen.has(id);
    const setMask = (on)=>{ el.style.webkitMaskImage = on?MASK:'none'; el.style.maskImage = on?MASK:'none'; };
    if (open) {
      el.style.maxHeight = contentH + 'px';
      setMask(false);
      if (moreWrap) moreWrap.style.display = overflow ? '' : 'none';
      if (btn) btn.innerHTML = '▲ 접기';
    } else {
      el.style.maxHeight = (overflow ? cap : contentH) + 'px';
      setMask(overflow);
      if (moreWrap) moreWrap.style.display = overflow ? '' : 'none';
      if (btn) btn.innerHTML = '▼ 더보기';
    }
  });
}
// 개별 공지 본문 펼치기/접기 (재렌더 없이 DOM 직접 조작 → transition으로 부드럽게)
function toggleNoticeText(id){
  if (_noticeTextOpen.has(id)) _noticeTextOpen.delete(id); else _noticeTextOpen.add(id);
  _applyNoticeClamp();
}
function openNoticeModal(editId) {
  if (!currentUser || !currentUser.staffId) { toast('이름으로 로그인 후 작성할 수 있습니다.','error'); return; }
  _noticeEditId = (typeof editId==='string') ? editId : null;
  const found = _noticeEditId ? _findNoticeItem(_noticeEditId) : null;
  const it = found ? found.it : null;
  const today = _todayStr();
  const box = _getNoticeBox(today);
  document.getElementById('notice-modal-title').textContent = it ? '공지 수정' : '공지 작성';
  document.getElementById('notice-text').value = it ? (it.text||'') : '';
  document.getElementById('notice-title').value = it ? (it.title||'') : '';
  document.getElementById('notice-news8').value = box.news8Time || '';
  const silentEl = document.getElementById('notice-silent'); if (silentEl) silentEl.checked = it ? !!it.silent : false;
  // 게시 기간 셀렉트 초기화
  const _psel = document.getElementById('notice-period'), _pdate = document.getElementById('notice-until');
  if (_psel) {
    const baseDs = found ? found.ds : today;
    const until = (it && it.until && it.until > baseDs) ? it.until : baseDs;
    let matched = (until <= today) ? '0' : null;
    if (!matched) { ['0','2','6','13','29'].forEach(k => { if (!matched && addDays(today, parseInt(k)) === until) matched = k; }); }
    if (matched) { _psel.value = matched; if (_pdate) _pdate.style.display = 'none'; }
    else { _psel.value = 'custom'; if (_pdate) { _pdate.style.display = ''; _pdate.min = today; _pdate.value = until; } }
    // 지난 공지에서 연 '이미 게시가 끝난' 공지: 기간을 고르지 않으면 홈에 다시 올리지 않음(오늘 하루만으로 바뀌어 전 직원 홈에 다시 뜨던 문제)
    let keepOpt = _psel.querySelector('option[value="keep"]');
    if (found && _noticeEnd(found.ds, it) < today) {
      if (!keepOpt) { keepOpt = document.createElement('option'); keepOpt.value = 'keep'; keepOpt.textContent = '게시 끝남(그대로)'; _psel.insertBefore(keepOpt, _psel.firstChild); }
      _psel.value = 'keep'; if (_pdate) _pdate.style.display = 'none';
    } else if (keepOpt) keepOpt.remove();
  }
  _noticePickers();
  _onNoticePeriodChange();
  _updateNoticeSaveBtn();
  document.getElementById('notice-delete-btn').style.display = it ? '' : 'none';
  document.getElementById('notice-modal').style.display = 'flex';
}
function closeNoticeModal() {
  _animModalClose(document.getElementById('notice-modal'));
}
async function saveNotice() {
  if (!currentUser || !currentUser.staffId) { toast('이름으로 로그인 후 작성할 수 있습니다.','error'); return; }
  const ds = _todayStr();
  const text = document.getElementById('notice-text').value.trim();
  const title = document.getElementById('notice-title').value.trim();
  const news8 = document.getElementById('notice-news8').value || '';
  const silent = !!(document.getElementById('notice-silent')||{}).checked;
  if (!text && !news8) { toast('공지 내용 또는 8뉴스 진입시간을 입력하세요.','error'); return; }
  // 게시 종료일(until) 계산
  const _psel = document.getElementById('notice-period'), _pdate = document.getElementById('notice-until');
  let until = ds;
  const keepEnd = !!(_psel && _psel.value === 'keep' && _noticeEditId);   // 게시 끝난 공지 수정: 게시 기간 그대로(홈에 다시 안 올림)
  if (_psel && !keepEnd) {
    if (_psel.value === 'custom') until = (_pdate && _pdate.value && _pdate.value >= ds) ? _pdate.value : ds;
    else until = addDays(ds, parseInt(_psel.value)||0);
  }
  const box = _ensureNoticeBox(ds);
  box.news8Time = news8;   // 8뉴스 진입시간은 날짜당 1개(공지와 분리, 당일 전용)
  let isEdit = false;
  if (_noticeEditId) {
    const found = _findNoticeItem(_noticeEditId);
    if (found) { found.it.text = text; found.it.title = title; found.it.silent = silent; if (!keepEnd) { if (until > found.ds) found.it.until = until; else delete found.it.until; } isEdit = true; }
  }
  if (!isEdit && text) {
    const nit = { id:_genNoticeId(), text, title, postedBy:currentUser.name||'', postedById:(currentUser.staffId||''), postedAt:new Date().toISOString(), silent };  // 새 공지는 맨 앞(최신)
    if (until > ds) nit.until = until;
    box.items.unshift(nit);
  }
  saveData(data);
  closeNoticeModal();
  renderNoticeBar();
  const doPush = !silent && !isEdit && (text || news8);   // 수정/조용한 공지는 알림 미발송
  if (doPush) {
    toast('공지가 등록되었습니다. 전 직원에게 알림을 보냅니다.','success');
    _sendNoticePush(text || ('오늘 8뉴스 진입시간 ' + news8 + ' 입니다.'));
  } else {
    toast(isEdit ? '공지를 수정했습니다.' : (silent ? '조용히 등록되었습니다 (알림 미발송).' : '저장되었습니다.'),'success');
  }
  _noticeEditId = null;
}
// 지난 공지(최근 1개월): 최신순 카드(날짜·8뉴스는 카드 머리에) — 누르면 공지 확인 창(공감·확인함·댓글)이 이 창 위에 열리고, 닫으면 다시 이 목록
// 창이 열려 있는 동안 공지가 바뀌면(공감·댓글·수정·삭제) renderNoticeBar가 _noticeHistRefresh로 목록도 다시 그림
function openNoticeHistory() {
  _noticeHistPaint();
  document.getElementById('notice-history-modal').style.display = 'flex';
}
function _noticeHistRefresh(){ const m=document.getElementById('notice-history-modal'); if(m && m.style.display==='flex' && !m.classList.contains('nd-closing')) _noticeHistPaint(); }
function _noticeHistPaint(){
  const list = document.getElementById('notice-history-list'); if(!list) return;
  const today = _todayStr();
  const esc = t => String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const bellOff = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="조용히(알림 없음)"><path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17.9 17.9 0 0 1 18 8M6.3 6.3A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M3 3l18 18"/></svg>';
  const cmtIc = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 2.5c-3.1 0-5.7 1.9-5.7 4.2 0 1.3.8 2.5 2 3.3-.1.6-.4 1.2-.8 1.7-.2.2 0 .5.3.4.9-.1 1.8-.5 2.5-.9.5.1 1.1.2 1.7.2 3.1 0 5.7-1.9 5.7-4.2S11.1 2.5 8 2.5z"/></svg>';
  const days = Object.keys(data.notices||{}).sort((x,y) => y.localeCompare(x));   // 최신 날짜순
  let html = '';
  days.forEach(d => {
    const box = _ensureNoticeBox(d);   // id가 고정돼야 눌러서 열 수 있음(옛 형식도 정규화)
    const its = box.items || [];
    if (!its.length && !box.news8Time) return;
    const [y,mo,dd] = d.split('-').map(Number), dow = DOW_KR[new Date(y,mo-1,dd).getDay()];
    const n8 = box.news8Time ? `<span class="nh-n8">8뉴스 ${esc(box.news8Time)}</span>` : '';
    const dl = `<span class="nh-date">${mo}월 ${dd}일 (${dow})</span>${d===today?'<em class="nh-today">오늘</em>':''}`;
    if (!its.length) { html += `<div class="nh-card nh-only8"><div class="nh-meta">${dl}${n8}</div></div>`; return; }   // 8뉴스 시간만 있는 날
    its.forEach((it, k) => {
      const t = it.postedAt ? new Date(it.postedAt) : null;
      const hm = t && !isNaN(t) ? `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}` : '';
      const rx = it.reactions || {}, cnt = {};
      Object.keys(rx).forEach(id => { const e = rx[id]; if (e) cnt[e] = (cnt[e]||0) + 1; });
      const tops = Object.keys(cnt).sort((p,q) => cnt[q]-cnt[p]).slice(0,3);
      const rxN = Object.values(cnt).reduce((p,q) => p+q, 0), cm = (it.comments||[]).length;
      const live = _noticeEnd(d, it) >= today;
      html += `<button type="button" class="nh-card${live?' is-live':''}" data-nid="${esc(it.id)}" onclick="_noticeHistOpen(this.dataset.nid, this)">
        <div class="nh-meta">${dl}${k===0?n8:''}${it.postedBy?`<b>${esc(it.postedBy)}</b>`:''}${hm?`<span>${hm}</span>`:''}${it.silent?`<span class="nh-silent">${bellOff}</span>`:''}${live?'<span class="nh-live">게시 중</span>':''}</div>
        ${(it.title||'').trim()?`<div class="nh-title">${esc(it.title.trim())}</div>`:''}<div class="nh-text">${esc(it.text).replace(/\n/g,'<br>')}</div>
        <div class="nh-foot">${rxN?`<span class="nh-rx">${tops.map(e=>_rxIcon(esc(e))).join('')}<b>${rxN}</b></span>`:''}${cm?`<span class="nh-cm">${cmtIc}<b>${cm}</b></span>`:''}<span class="nh-more">자세히 보기<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span></div>
      </button>`;
    });
  });
  html = html || '<div class="nh-empty">등록된 공지가 없습니다.</div>';
  if (list._nhHtml === html) return;   // 바뀐 게 없으면 그대로(읽는 중 깜빡임·포커스 잃음 방지)
  const fid = list.contains(document.activeElement) ? document.activeElement.getAttribute('data-nid') : null;
  list._nhHtml = html; list.innerHTML = html;
  if (fid) { const el = [...list.querySelectorAll('.nh-card')].find(x => x.dataset.nid === fid); if (el) el.focus({ preventScroll: true }); }
}
// 지난 공지 카드 → 공지 확인 창(카드에서 커지듯 열림). 확인 창(#poll-modal)은 DOM에서 뒤에 있어 이 창 위에 뜸
function _noticeHistOpen(id, el){ if(!_findNoticeItem(id)){ toast('이미 삭제된 공지예요.','error'); _noticeHistRefresh(); return; } openNoticeDetail(id, el); }
function closeNoticeHistory() {
  _animModalClose(document.getElementById('notice-history-modal'));
}

function deleteNotice() {
  if (!currentUser || !currentUser.staffId) return;
  if (_noticeEditId) {
    const found = _findNoticeItem(_noticeEditId);
    if (found) {
      found.box.items = (found.box.items||[]).filter(i=>i.id!==_noticeEditId);   // 게시일 박스에서 개별 공지 삭제
      if ((!found.box.items || !found.box.items.length) && !found.box.news8Time) delete data.notices[found.ds];  // 0건+8뉴스없음이면 박스 정리
    }
  }
  saveData(data);
  closeNoticeModal();
  renderNoticeBar();
  toast('공지를 삭제했습니다.','success');
  _noticeEditId = null;
}
// kind: 'notice'(공지·휴가 신청 안내) | 'poll'(투표) — 서버가 받는 사람의 개인 알림 설정(공지/투표)으로 거름
async function _sendNoticePush(text, title, kind) {
  try {
    await fetch(NOTIFY_FN_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY },
      body: JSON.stringify({ mode:'notice', text, title: title||'', kind: kind||'notice' })
    });
  } catch(e) { console.warn('notice push failed', e); }
}
// 화면 폭이 1001px을 넘나들면(창 크기·회전) 열린 공지 확인 창을 그 폭의 배치로 다시 그림 — 쓰던 댓글·커서는 유지
(function(){
  if(!window.matchMedia) return;
  const mq=matchMedia('(min-width:1001px)');
  const onChange=()=>{
    const id=window._noticeDetailId, pm=document.getElementById('poll-modal'), c=document.getElementById('poll-modal-card');
    if(!id || !pm || pm.style.display!=='flex' || !c) return;
    const fd=_findNoticeItem(id); if(!fd) return;
    const ta=c.querySelector('.ndcm textarea'), draft=ta?ta.value:'', had=ta&&document.activeElement===ta;
    c.innerHTML=_noticeDetailHtml(fd.it); c.classList.toggle('pc-wide-card', mq.matches);
    const nt=c.querySelector('.ndcm textarea'); if(nt && draft){ nt.value=draft; if(typeof ndCmtGrow==='function') ndCmtGrow(nt); } if(nt && had) nt.focus();
  };
  if(mq.addEventListener) mq.addEventListener('change', onChange); else if(mq.addListener) mq.addListener(onChange);
})();
