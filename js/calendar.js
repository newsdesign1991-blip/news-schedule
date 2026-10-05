/* [모듈] js/calendar.js — 달력·구글 캘린더 연동·날짜 모달·달력 일정 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== MONTH CALENDAR =====
// ===== 구글 캘린더 연동 (공개 .ics → Edge Function 프록시 → 클라이언트 파싱 → 달력 셀 오버레이) =====
const GCAL_FN_URL = `${SB_URL}/functions/v1/gcal`;
let _gcalEvents = null;   // [{title, start:{date,time,allDay}, rrule}]
let _gcalLoadedAt = 0;    // 마지막 로드(ms)
let _gcalLoading = false;
let gcalShow = true;      // 구글 일정 표시 토글
function _icsUnfold(t){ return (t||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n[ \t]/g,''); }
function _icsDecode(v){ return (v||'').replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\'); }
function _icsParseDate(line){
  const ci=line.indexOf(':'); if(ci<0) return null;
  const params=line.slice(0,ci), val=line.slice(ci+1).trim();
  const m=val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/); if(!m) return null;
  const [,Y,Mo,D,h,mi,s,z]=m;
  const dateOnly = /VALUE=DATE(?!-)/i.test(params) || h===undefined;
  if(dateOnly) return { date:`${Y}-${Mo}-${D}`, time:'', allDay:true };
  if(z){ // UTC → KST(+9)
    const dt=new Date(Date.UTC(+Y,+Mo-1,+D,+h,+mi,+(s||0))); dt.setUTCHours(dt.getUTCHours()+9);
    const p=n=>String(n).padStart(2,'0');
    return { date:`${dt.getUTCFullYear()}-${p(dt.getUTCMonth()+1)}-${p(dt.getUTCDate())}`, time:`${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}`, allDay:false };
  }
  return { date:`${Y}-${Mo}-${D}`, time:`${h}:${mi}`, allDay:false };   // TZID/floating → 그대로(현지/KST 가정)
}
function _parseICS(text){
  text=_icsUnfold(text); const events=[];
  const blocks=text.split('BEGIN:VEVENT').slice(1);
  for(const b of blocks){
    const block=b.split('END:VEVENT')[0]; const lines=block.split('\n');
    let title='', start=null, end=null, rrule=null, location='', desc='';
    for(const ln of lines){
      if(/^SUMMARY[:;]/i.test(ln)) title=_icsDecode(ln.slice(ln.indexOf(':')+1)).trim();
      else if(/^DTSTART/i.test(ln)) start=_icsParseDate(ln);
      else if(/^DTEND/i.test(ln)) end=_icsParseDate(ln);
      else if(/^LOCATION[:;]/i.test(ln)) location=_icsDecode(ln.slice(ln.indexOf(':')+1)).trim();
      else if(/^DESCRIPTION[:;]/i.test(ln)) desc=_icsDecode(ln.slice(ln.indexOf(':')+1)).trim();
      else if(/^RRULE[:;]/i.test(ln)) rrule=ln.slice(ln.indexOf(':')+1).trim();
    }
    if(start) events.push({ title:title||'(제목 없음)', start, end, rrule, location, desc });
  }
  return events;
}
// 반복일정 전개 → 범위 내 발생일 ['YYYY-MM-DD',...]
function _icsOccurrences(ev, rsStr, reStr){
  const sd=ev.start.date;
  if(!ev.rrule) return (sd>=rsStr && sd<=reStr) ? [sd] : [];
  const R={}; ev.rrule.split(';').forEach(p=>{const i=p.indexOf('='); if(i>0) R[p.slice(0,i).toUpperCase()]=p.slice(i+1);});
  const freq=(R.FREQ||'').toUpperCase(), interval=Math.max(1,parseInt(R.INTERVAL||'1',10));
  const count=R.COUNT?parseInt(R.COUNT,10):Infinity;
  let until=null; if(R.UNTIL){const m=R.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/); if(m) until=`${m[1]}-${m[2]}-${m[3]}`;}
  const byday=(R.BYDAY||'').split(',').map(x=>x.trim().slice(-2).toUpperCase()).filter(Boolean);
  const DOW={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};
  const p=n=>String(n).padStart(2,'0'); const fmt=dt=>`${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`;
  const out=[]; let emitted=0, iter=0; const CAP=4000; let cur=new Date(sd+'T00:00:00');
  while(iter++<CAP && emitted<count){
    const curStr=fmt(cur);
    if(until&&curStr>until) break;
    if(curStr>reStr) break;
    if(freq==='WEEKLY'&&byday.length){
      const ws=new Date(cur); ws.setDate(cur.getDate()-cur.getDay()); let brk=false;
      for(const d of byday){ if(!(d in DOW))continue; const dt=new Date(ws); dt.setDate(ws.getDate()+DOW[d]); const ds=fmt(dt);
        if(ds<sd) continue; if(until&&ds>until){brk=true;break;} if(emitted>=count){brk=true;break;}
        emitted++; if(ds>=rsStr&&ds<=reStr) out.push(ds); }
      if(brk) break; cur.setDate(cur.getDate()+7*interval);
    } else {
      emitted++; if(curStr>=rsStr&&curStr<=reStr) out.push(curStr);
      if(freq==='DAILY') cur.setDate(cur.getDate()+interval);
      else if(freq==='WEEKLY') cur.setDate(cur.getDate()+7*interval);
      else if(freq==='MONTHLY') cur.setMonth(cur.getMonth()+interval);
      else if(freq==='YEARLY') cur.setFullYear(cur.getFullYear()+interval);
      else break;
    }
  }
  return [...new Set(out)];
}
const GCAL_PALETTE=['#4285f4','#0b8043','#d50000','#f4511e','#8e24aa','#e4c441','#3f51b5','#039be5'];
function _migrateGcals(){
  if(!data.settings) data.settings={};
  if(!Array.isArray(data.settings.gcals)){
    data.settings.gcals = data.settings.gcalUrl ? [{id:_genNoticeId(), url:data.settings.gcalUrl, color:'#4285f4', name:'구글'}] : [];
  }
}
function _gcalList(){ _migrateGcals(); return data.settings.gcals; }
async function _loadGcal(force){
  const cals=_gcalList().filter(c=>c.url && c.url.trim());
  if(!cals.length){ _gcalEvents=null; return; }
  if(!force && _gcalEvents && (Date.now()-_gcalLoadedAt < 30*60*1000)) return;   // 30분 캐시
  if(_gcalLoading) return; _gcalLoading=true;
  const all=[]; let failed=0;
  for(const c of cals){
    try{
      // apikey를 쿼리로, Content-Type text/plain → CORS preflight 회피(더 견고). Edge Function은 req.json()으로 본문 파싱.
      const res=await fetch(GCAL_FN_URL+'?apikey='+encodeURIComponent(SB_KEY),{ method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify({url:c.url.trim()}) });
      const txt=await res.text();
      if(!res.ok){ failed++; console.warn('gcal load failed', c.url, txt); continue; }
      const evs=_parseICS(txt); const col=c.color||'#4285f4'; evs.forEach(e=>{ e._color=col; e._calName=c.name||''; e._calId=c.id; }); all.push(...evs);
    }catch(e){ failed++; console.warn('gcal', e); }
  }
  all.forEach(e=>{ e._id=_gcalHashId(e); });   // 이벤트 정체성 기반 안정 id (새로고침에도 유지)
  _gcalEvents=all; _gcalLoadedAt=Date.now(); _gcalLoading=false;
  if(force) toast(failed?`구글 일정 ${all.length}건 (${failed}개 캘린더 실패)`:`구글 일정 ${all.length}건 불러옴`, failed?'error':'success');
  // 비동기 로드 완료 후 현재 보고 있는 화면을 다시 그림 (홈/달력 모두 — 첫 진입 시 일정 안 뜨던 문제)
  if(currentView==='month') renderMonth(); else if(currentView==='home') renderHome();
}
function toggleGcal(){
  if(!_gcalList().some(c=>c.url&&c.url.trim())){ toast(isAdmin?'관리자 패널 → 설정에서 구글 캘린더를 연동하세요.':'관리자가 구글 캘린더를 연동해야 합니다.','error'); return; }
  gcalShow=!gcalShow; renderMonth();
}
function closeGcalPopover(){ var p=document.getElementById('gcal-popover'); if(p) p.remove(); document.removeEventListener('click', _gcalPopOutside, true); }
function _gcalPopOutside(e){ var p=document.getElementById('gcal-popover'); var btn=document.getElementById('cal-gcal-toggle'); if(p && !p.contains(e.target) && btn && !btn.contains(e.target)) closeGcalPopover(); }
function toggleGcalPopover(e){
  if(e) e.stopPropagation();
  if(document.getElementById('gcal-popover')){ closeGcalPopover(); return; }
  var cals=_gcalList().filter(function(c){return c.url&&c.url.trim();});
  var btn=document.getElementById('cal-gcal-toggle'); if(!btn) return;
  var rect=btn.getBoundingClientRect();
  var pop=document.createElement('div'); pop.id='gcal-popover'; pop.className='gcal-pop';
  var rows = cals.length ? cals.map(function(c){ var on=c.on!==false; return '<div class="gcal-pop-row" onclick="_toggleGcalCal(\''+c.id+'\', this)"><span class="gcal-pop-dot" style="background:'+(c.color||'#4285f4')+'"></span><span class="gcal-pop-name">'+_gcalEsc(c.name||c.url)+'</span><span class="gcal-pop-sw'+(on?' on':'')+'"></span></div>'; }).join('') : '<div style="padding:14px 8px;text-align:center;color:var(--muted);font-size:13px;">연동된 구글 캘린더가 없습니다</div>';
  pop.innerHTML='<div class="gcal-pop-title">구글 캘린더</div>'+rows;
  document.body.appendChild(pop);
  var pw=pop.offsetWidth, ph=pop.offsetHeight;
  var left=Math.max(10, Math.min(rect.left, window.innerWidth - pw - 10));
  var top=rect.bottom+8; if(top+ph > window.innerHeight-10) top=Math.max(10, rect.top-ph-8);
  pop.style.left=left+'px'; pop.style.top=top+'px';
  if(rect.bottom+8+ph > window.innerHeight-10) pop.classList.add('flip');
  var tailX=Math.max(16, Math.min(pw-16, rect.left+rect.width/2 - left));
  pop.style.setProperty('--tail-x', tailX+'px');
  setTimeout(function(){ document.addEventListener('click', _gcalPopOutside, true); }, 0);
}
function _toggleGcalCal(id, rowEl){
  var cal=_gcalList().find(function(c){return c.id===id;}); if(!cal) return;
  cal.on = (cal.on===false);
  saveData(data);
  if(rowEl){ var sw=rowEl.querySelector('.gcal-pop-sw'); if(sw) sw.classList.toggle('on', cal.on!==false); }
  var gt=document.getElementById('cal-gcal-toggle'); if(gt){ var anyOn=_gcalList().some(function(c){return c.url&&c.url.trim()&&c.on!==false;}); gt.className='btn btn-sm'+(anyOn?'':' btn-outline'); }
  _gcalRefreshViews();
}
let _gcalDetailId=null, _gcalDetailDate=null;
function _gcalHashId(e){ var k=(e.title||'')+'|'+((e.start&&e.start.date)||'')+'|'+((e.start&&e.start.time)||'')+'|'+(e.location||'')+'|'+(e.rrule||''); var h=0; for(var i=0;i<k.length;i++){ h=((h<<5)-h+k.charCodeAt(i))|0; } return 'g'+(h>>>0).toString(36); }
function _gcalRefreshViews(){ try{ if(typeof renderMonth==='function' && currentView==='month') renderMonth(); if(typeof renderHome==='function') renderHome(); }catch(e){} }
function _gcalCalOn(calId){ var cal=(_gcalList()||[]).find(function(c){return c.id===calId;}); return cal ? (cal.on!==false) : true; }
function _gcalMeta(id){ if(!data.gcalMeta) data.gcalMeta={}; if(!data.gcalMeta[id]) data.gcalMeta[id]={participants:[],comments:[]}; return data.gcalMeta[id]; }
function _gcalTitleLoc(ev){ let title=(ev.title||''), loc=(ev.location||''); const m=title.match(/^\s*\[([^\]]+)\]\s*/); if(m){ if(!loc) loc=m[1]; title=title.slice(m[0].length); } return {title:title, loc:loc}; }
function _gcalEsc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showGcalDetail(dateStr, id){
  const ev=(_gcalEvents||[]).find(e=>e._id===id); if(!ev) return;
  _gcalDetailId=id; _gcalDetailDate=dateStr;
  const c=ev._color||'#4285f4';
  const esc=_gcalEsc;
  const dt=new Date(dateStr+'T00:00:00'); const dow=['일','월','화','수','목','금','토'][dt.getDay()];
  const timeStr = ev.start.allDay ? '종일' : (ev.start.time + (ev.end&&ev.end.time&&!ev.end.allDay ? ' ~ '+ev.end.time : ''));
  const meta=_gcalMeta(id);
  const _tl=_gcalTitleLoc(ev);
  document.getElementById('gcal-detail-body').innerHTML=`
    <div style="background:${c}22;border-bottom:2px solid ${c};padding:18px 20px 15px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:800;color:${c};letter-spacing:-.01em;">${dt.getMonth()+1}월 ${dt.getDate()}일 (${dow})${timeStr?' · '+timeStr:''}</div>
          <div style="font-size:19px;font-weight:800;color:var(--text);line-height:1.35;margin-top:5px;">${esc(_tl.title)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="toggleGcalEdit()" style="background:rgba(255,255,255,0.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.65);color:var(--text);padding:6px 14px;border-radius:999px;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(15,23,42,0.12);">편집</button>
          <button onclick="closeGcalDetail()" style="background:rgba(255,255,255,0.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.65);color:var(--text);width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:16px;font-weight:400;line-height:1;box-shadow:0 2px 8px rgba(15,23,42,0.12);flex-shrink:0;">&#10005;</button>
        </div>
      </div>
      <div style="margin-top:9px;font-size:12.5px;color:var(--muted);font-weight:600;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        ${_tl.loc?`<span>${esc(_tl.loc)}</span>`:''}
        <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;border-radius:2px;background:${c};flex-shrink:0;"></span>${esc(ev._calName||'구글 캘린더')}</span>
      </div>
      <div id="gcal-detail-participants" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px;"></div>
    </div>
    <div id="gcal-edit-form" style="display:none;padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface2);">
      <label class="form-label">참여자</label>
      <div id="gcal-participants-wrap" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:6px;padding:8px;border:1px solid var(--border);border-radius:8px;min-height:36px;background:var(--bg);"></div>
      <button onclick="saveGcalParticipants()" style="width:100%;margin-top:10px;background:linear-gradient(135deg,#4a94ff,#2f77f6);color:#fff;border:none;border-radius:12px;padding:10px;font-size:13px;font-weight:800;cursor:pointer;">참여자 저장</button>
    </div>
    <div style="padding:14px 20px 18px;">
      ${ev.desc?`<div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap;word-break:break-word;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border);">${esc(ev.desc)}</div>`:''}
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px;">댓글</div>
      <div id="gcal-comments-list"></div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <input id="gcal-cmt-author" placeholder="이름" style="width:76px;flex-shrink:0;border:1px solid var(--border);border-radius:10px;padding:9px 10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;">
        <input id="gcal-cmt-text" placeholder="댓글을 입력하세요" style="flex:1;min-width:0;border:1px solid var(--border);border-radius:10px;padding:9px 12px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;" onkeydown="if(event.key==='Enter')addGcalComment()">
        <button onclick="addGcalComment()" style="flex-shrink:0;background:linear-gradient(135deg,#4a94ff,#2f77f6);color:#fff;border:none;border-radius:12px;padding:9px 16px;font-size:13px;font-weight:800;cursor:pointer;">등록</button>
      </div>
    </div>`;
  _renderGcalParticipants(id, c);
  _renderGcalComments(id);
  if(typeof _renderParticipantChips==='function') _renderParticipantChips('gcal-participants-wrap', (meta.participants||[]).slice(), dateStr);
  const _au=document.getElementById('gcal-cmt-author'); if(_au && currentUser && currentUser.name) _au.value=currentUser.name;
  document.getElementById('gcal-detail-modal').style.display='flex';
}
function _renderGcalParticipants(id,color){ const wrap=document.getElementById('gcal-detail-participants'); if(!wrap) return; const ids=_gcalMeta(id).participants||[]; color=color||'#4285f4'; wrap.innerHTML = ids.map(pid=>{ const st=(data.staff||[]).find(x=>x.id===pid); return st?`<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11.5px;font-weight:700;background:${color}1f;color:${color};">${st.name}</span>`:''; }).join(''); }
function toggleGcalEdit(){ const fm=document.getElementById('gcal-edit-form'); if(fm) fm.style.display = (fm.style.display==='none'||!fm.style.display)?'block':'none'; }
function saveGcalParticipants(){ const meta=_gcalMeta(_gcalDetailId); meta.participants=_getSelectedParticipants('gcal-participants-wrap'); saveData(data); const ev=(_gcalEvents||[]).find(e=>e._id===_gcalDetailId); _renderGcalParticipants(_gcalDetailId, ev?ev._color:'#4285f4'); const fm=document.getElementById('gcal-edit-form'); if(fm) fm.style.display='none'; _gcalRefreshViews(); }
function _renderGcalComments(id){ const cmts=_gcalMeta(id).comments||[]; let html=''; if(!cmts.length) html='<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px 0;">첫 댓글을 남겨보세요</div>'; else cmts.forEach((cc,i)=>{ const dt=new Date(cc.at||0); const dtStr=`${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`; html+=`<div style="padding:8px 10px;border-radius:8px;background:var(--surface2);margin-bottom:6px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><span style="font-size:12px;font-weight:700;color:var(--text);">${_gcalEsc(cc.author)||'익명'}</span><div style="display:flex;align-items:center;gap:6px;"><span style="font-size:10px;color:var(--muted);">${dtStr}</span><button onclick="deleteGcalComment(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:0;line-height:1;">&#10005;</button></div></div><div style="font-size:13px;color:var(--text);line-height:1.5;">${_gcalEsc(cc.text)}</div></div>`; }); document.getElementById('gcal-comments-list').innerHTML=html; }
function addGcalComment(){ const t=document.getElementById('gcal-cmt-text'); const text=t.value.trim(); if(!text) return; const author=(document.getElementById('gcal-cmt-author').value.trim())||(currentUser&&currentUser.name)||'익명'; const meta=_gcalMeta(_gcalDetailId); meta.comments.push({id:Date.now().toString(36),text,author,at:new Date().toISOString()}); saveData(data); t.value=''; _renderGcalComments(_gcalDetailId); _gcalRefreshViews(); }
function deleteGcalComment(idx){ const meta=_gcalMeta(_gcalDetailId); meta.comments.splice(idx,1); saveData(data); _renderGcalComments(_gcalDetailId); _gcalRefreshViews(); }
// 모달을 닫을 때 닫힘 애니메이션 재생 후 실제로 숨김 (열림과 동일한 느낌으로 사라짐)
function _animModalClose(el){
  if(!el) return;
  if(getComputedStyle(el).display==='none'){ el.style.display='none'; return; }
  if(el.classList.contains('nd-closing')) return;
  el.classList.add('nd-closing');
  let done=false;
  const finish=()=>{ if(done)return; done=true; el.style.display='none'; el.classList.remove('nd-closing'); el.removeEventListener('animationend',h); };
  function h(ev){ if(ev.target===el) finish(); }
  el.addEventListener('animationend',h);
  setTimeout(finish, 400);   // 폴백
}
function closeGcalDetail(){ _animModalClose(document.getElementById('gcal-detail-modal')); }
// iOS Safari는 display:none→표시 전환 시 CSS 애니메이션을 재생하지 않는 경우가 있어, 표시되는 순간 강제로 재시작한다.
function _restartAnim(el){
  [el].concat(Array.prototype.slice.call(el.children)).forEach(function(n){
    if(!(n instanceof HTMLElement) || !n.style) return;
    n.style.animation='none';
    void n.offsetWidth;      // reflow
    n.style.animation='';    // CSS에 정의된 애니메이션으로 되돌려 재생
  });
}
function _watchModalAnim(el){
  if(!el || el.__animWatch) return; el.__animWatch=true;
  new MutationObserver(function(){
    if(el.__animBusy || el.classList.contains('nd-closing')) return;
    if(getComputedStyle(el).display==='none') return;
    el.__animBusy=true;
    _restartAnim(el);
    setTimeout(function(){ el.__animBusy=false; }, 60);
  }).observe(el, { attributes:true, attributeFilter:['style','class'] });
}
(function(){
  var SEL='.modal-overlay, .nd-modal, .staff-modal-overlay, [id="lr-popup-overlay"]';
  function scan(root){ (root||document).querySelectorAll(SEL).forEach(_watchModalAnim); }
  scan();
  if(document.body){
    new MutationObserver(function(muts){
      muts.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes||[], function(n){
        if(n.nodeType!==1) return;
        if(n.matches && n.matches(SEL)) _watchModalAnim(n);
        if(n.querySelectorAll) scan(n);
      }); });
    }).observe(document.body, { childList:true, subtree:true });
  }
})();
// ── 구글 캘린더 관리 (관리자 패널 설정 탭에 인라인) ──
let _gcalEdit=[];
function _initGcalSettings(){
  _gcalEdit = _gcalList().map(c=>({id:c.id||_genNoticeId(), url:c.url||'', color:c.color||'#4285f4', name:c.name||''}));
  if(!_gcalEdit.length) _gcalEdit.push({id:_genNoticeId(), url:'', color:'#4285f4', name:''});
  _renderGcalList();
}
function _renderGcalList(){
  const box=document.getElementById('gcal-list'); if(!box) return;
  box.innerHTML=_gcalEdit.length? _gcalEdit.map((c,i)=>`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <input type="color" value="${c.color}" onchange="_gcalEdit[${i}].color=this.value" style="width:34px;height:34px;border:none;background:none;cursor:pointer;flex-shrink:0;padding:0;" title="색상">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
        <input type="text" value="${(c.name||'').replace(/"/g,'&quot;')}" oninput="_gcalEdit[${i}].name=this.value" placeholder="이름(선택, 예: 부서일정)" class="form-input" style="font-size:12px;padding:5px 8px;">
        <input type="text" value="${(c.url||'').replace(/"/g,'&quot;')}" oninput="_gcalEdit[${i}].url=this.value" placeholder="iCal 공개 .ics 주소 붙여넣기" class="form-input" style="font-size:11px;padding:5px 8px;">
      </div>
      <button onclick="removeGcalRow(${i})" style="background:none;border:none;color:#d65a52;font-size:16px;cursor:pointer;flex-shrink:0;" title="삭제">✕</button>
    </div>`).join('') : '<div style="color:var(--muted);font-size:13px;padding:10px 0;text-align:center;">+ 캘린더 추가를 눌러 시작하세요.</div>';
}
function addGcalRow(){ _gcalEdit.push({id:_genNoticeId(), url:'', color:GCAL_PALETTE[_gcalEdit.length%GCAL_PALETTE.length], name:''}); _renderGcalList(); }
function removeGcalRow(i){ _gcalEdit.splice(i,1); _renderGcalList(); }
function saveGcals(){
  if(!isAdmin){ toast('관리자만 설정할 수 있습니다.','error'); return; }
  if(!data.settings) data.settings={};
  data.settings.gcals=_gcalEdit.filter(c=>c.url&&c.url.trim()).map(c=>({id:c.id,url:c.url.trim(),color:c.color,name:(c.name||'').trim()}));
  delete data.settings.gcalUrl;   // 구형 단일 필드 제거
  saveData(data);
  _gcalEvents=null; _gcalLoadedAt=0; gcalShow=true;
  if(data.settings.gcals.length){ _loadGcal(true); toast('구글 캘린더를 저장했습니다.','success'); } else { toast('구글 캘린더 연동을 해제했습니다.','success'); }
  if(currentView==='month') renderMonth();
}
function setCalMode(m){
  calMode = m;
  const mine=document.getElementById('cal-mode-mine'), team=document.getElementById('cal-mode-team');
  if(mine&&team){
    mine.className = 'btn btn-sm' + (m==='mine'?'':' btn-outline');
    team.className = 'btn btn-sm' + (m==='team'?'':' btn-outline');
  }
  const gt=document.getElementById('cal-gcal-toggle');
  if(gt){ const has=_gcalList().some(c=>c.url&&c.url.trim()); const anyOn=_gcalList().some(c=>c.url&&c.url.trim()&&c.on!==false); gt.className='btn btn-sm'+((has&&anyOn)?'':' btn-outline'); gt.style.opacity=has?'1':'0.55'; }
  renderMonth();
}
// 달력 셀(좁음)용 컴팩트 역할 칩 — 한 사람 하루 근무를 짧은 라벨로. (홈 카드 getRoles와 별도: 라벨 길이 다름)
function _calRolesShort(entry, sid){
  if(!entry) return [];
  if(entry.danjik===sid) return [{label:'당직',bg:'#fee2e2',color:'#d65a52',border:'#f8a0a0'}];
  const r=[];
  const C={vw:['var(--vw-bg)','var(--vw-light)','var(--vw)'], cg:['var(--cg-bg)','var(--cg-light)','var(--cg)'], xr:['var(--xr-bg)','var(--xr-light)','var(--xr)'], pj:['var(--project-bg)','var(--project-light)','var(--project)'], sp:['var(--sports-bg)','var(--sports-light)','var(--sports)'], y:['#fef3c7','#c79a5e','#fcd97d'], g:['#d1fae5','#45847a','#6ee7b7'], p:['#ede9fe','#6366f1','#c4b5fd']};
  const add=(label,c)=>r.push({label,bg:c[0],color:c[1],border:c[2]});
  // VW: 데스크 > 근무
  if(entry.vw?.desk===sid) add('VW데',C.vw);
  else if((entry.vw?.workers||[]).includes(sid)) add('VW',C.vw);
  // CG: 8데스 > 5데스 > 오전데 > 근무 (가장 구체적 1개)
  if(entry.cg?.desk8===sid||entry.cg?.desk===sid) add('8데스',C.cg);
  else if(entry.cg?.desk5===sid) add('5데스',C.cg);
  else if(entry.morningDesk===sid) add('오전데',C.y);
  else if((entry.cg?.workers||[]).includes(sid)) add('CG',C.cg);
  // 독립 역할
  if(entry.ilgeun===sid) add('일근',C.g);
  if(entry.newsOh===sid) add('뉴오',C.p);
  if(entry.newsOh2===sid) add('뉴오2',C.p);
  if(entry.weekend8jin===sid||entry.weekday8jin===sid) add('8진',C.p);
  if(entry.satMorning===sid) add('조근',C.y);
  if(entry.jogeunSubs&&Object.values(entry.jogeunSubs).includes(sid)) add('조근',C.p);
  else { const me=staffById(sid); if(me?.dept==='조근'&&!(entry.jogeunSubs&&Object.keys(entry.jogeunSubs).includes(sid))) add('조근',C.p); }
  if((entry.xr||[]).includes(sid)) add('XR',C.xr);
  if((entry.project||[]).includes(sid)) add('P.J',C.pj);
  if((entry.sports||[]).includes(sid)) add('SP',C.sp);
  return r;
}
function _monthNav(dir){
  monthOffset += dir;
  renderMonth();
  var el=document.getElementById('month-calendar');
  var vm=document.getElementById('view-month');
  if(vm) vm.classList.add('cal-sliding');
  if(el){ el.style.animation='none'; void el.offsetWidth; el.style.animation=(dir>0?'weekSlideNext':'weekSlidePrev')+' .34s cubic-bezier(.22,1,.36,1)'; }
  setTimeout(function(){ if(vm) vm.classList.remove('cal-sliding'); if(el) el.style.animation=''; }, 380);
}
// 달력 탭(iOS 캘린더식 월 보기): 주 단위 줄 + 얇은 구분선, 큰 날짜(오늘=빨간 동그라미), 일정은 둥근 막대.
// 같은 근무·공휴일·종일 구글 일정이 며칠 이어지면 막대 하나로 이어 그림. 한 칸에 다 못 넣으면 '+N개'(누르면 그날 상세)
// 막대는 클릭을 아래 날짜 칸으로 흘려보냄(구글 일정만 자체 상세 열기). 이번 달이 아닌 칸은 비워 둠
function renderMonth() {
  const now=new Date();
  const target=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
  const year=target.getFullYear(); const month=target.getMonth();
  const _t=document.getElementById('month-title');
  _t.innerHTML=`<b>${month+1}월</b><span>${year}년</span>`; _t.setAttribute('aria-label',`${year}년 ${month+1}월`);
  var _tb=document.getElementById('mn-today-btn'); if(_tb) _tb.style.visibility = (monthOffset===0)?'hidden':'visible';
  const todayStr=toDateStr(now.getFullYear(),now.getMonth()+1,now.getDate());
  const mine = (calMode==='mine');
  const sid = currentUser && currentUser.staffId;
  const host=document.getElementById('month-calendar');
  if (mine && !sid) { host.innerHTML='<div class="mc-empty">로그인하면 나만의 근무 달력을 볼 수 있어요.</div>'; return; }
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  // 이번 달 범위로 구글 일정 인덱스
  _loadGcal();
  const _gcalByDate={};
  if(_gcalEvents && _gcalEvents.length){
    const _mS=toDateStr(year,month+1,1), _mE=toDateStr(year,month+1,daysInMonth);
    for(const ev of _gcalEvents){ if(!_gcalCalOn(ev._calId)) continue; for(const ds of _icsOccurrences(ev,_mS,_mE)){ (_gcalByDate[ds]=_gcalByDate[ds]||[]).push(ev); } }
  }
  const _esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const MAXL=window.matchMedia('(min-width:761px)').matches?4:3;   // 한 주에 보일 막대 줄 수
  const DOWN=['일','월','화','수','목','금','토'];
  const IC={cal:'<svg class="mc-ic" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1.6" width="10" height="9.4" rx="2.4" fill="currentColor"/><path d="M1.2 4.6h9.6" stroke="#fff" stroke-width="1.3" opacity=".9"/></svg>',
    star:'<svg class="mc-ic" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5.6" fill="currentColor"/><path d="M6 2.7l.98 2 2.2.32-1.6 1.55.38 2.18L6 7.72 4.04 8.75l.38-2.18L2.82 5.02l2.2-.32z" fill="#fff"/></svg>'};
  // 하루 항목: 근무(나만의 달력) 또는 부서 인원(팀 전체) → 공휴일 → 일정 → 구글 일정. merge=이어지는 날과 막대 합치기
  function dayItems(ds){
    const out=[], entry=data.schedule[ds];
    if (mine) {
      const roles = isOnLeave(sid,ds) ? [{label:'휴가',bg:'#fee2e2',color:'#c0524a'}] : _calRolesShort(entry, sid);
      roles.forEach(r=>out.push({key:'r:'+r.label, label:r.label, bg:r.bg, fg:r.color, cls:'r', ic:'cal', merge:true}));
    } else if (entry) {
      [['VW',(entry.vw?.workers||[]).length,'vw'],['CG',(entry.cg?.workers||[]).length,'cg'],['P',(entry.project||[]).length,'project'],['S',(entry.sports||[]).length,'sports']]
        .forEach(([l,n,k])=>{ if(n) out.push({key:'t:'+k, label:l+' '+n, cls:'t-'+k, merge:false}); });
    }
    const hol=data.holidays&&data.holidays[ds];
    if (hol) out.push({key:'h:'+hol, label:hol, cls:'hol', ic:'star', merge:true});
    ((data.events||{})[ds]||[]).forEach(ev=>{ const c=ev.color||'#6366f1'; out.push({key:'e:'+ev.id, label:(ev.time?ev.time+' ':'')+(ev.title||''), bg:c+'24', fg:c, ic:'cal', merge:false}); });
    (_gcalByDate[ds]||[]).forEach(ev=>{ const c=ev._color||'#4285f4'; out.push({key:'g:'+ev._id, label:(ev.start.time?ev.start.time+' ':'')+(ev.title||''), bg:c+'20', fg:c, ic:'cal', merge:!ev.start.time, g:ev._id, title:(ev._calName?ev._calName+': ':'')+(ev.title||'')}); });
    return out;
  }
  let html='<div class="mc-head" aria-hidden="true">'+DOWN.map((d,i)=>`<span${i===0||i===6?' class="we"':''}>${d}</span>`).join('')+'</div>';
  const weeks=Math.ceil((firstDay+daysInMonth)/7);
  for (let w=0; w<weeks; w++) {
    const cols=[];
    for (let c=0;c<7;c++) { const d=w*7+c-firstDay+1; if(d<1||d>daysInMonth){ cols.push(null); continue; } const ds=toDateStr(year,month+1,d); cols.push({d, ds, its:dayItems(ds)}); }
    // 이어지는 같은 항목(merge) 합치기 → 줄(lane) 배치: 먼저 시작·긴 것부터 비어 있는 가장 위 줄에
    const segs=[]; let open={};
    cols.forEach((col,c)=>{ const nx={}; (col?col.its:[]).forEach((it,i)=>{ const o=open[it.key]; if(it.merge&&o){ o.end=c; nx[it.key]=o; } else { const s={it, start:c, end:c, ds:col.ds, ord:i}; segs.push(s); nx[it.key]=s; } }); open=nx; });
    segs.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start)||a.ord-b.ord);
    const lanes=[];
    segs.forEach(s=>{ let l=0; for(;;l++){ lanes[l]=lanes[l]||[]; let ok=true; for(let c=s.start;c<=s.end;c++) if(lanes[l][c]){ ok=false; break; } if(ok) break; } for(let c=s.start;c<=s.end;c++) lanes[l][c]=1; s.lane=l; });
    const over=lanes.length>MAXL, vis=over?MAXL-1:lanes.length, more=[0,0,0,0,0,0,0];
    if (over) segs.forEach(s=>{ if(s.lane>=vis) for(let c=s.start;c<=s.end;c++) more[c]++; });
    const rows=vis+(over?1:0);
    let cells='', bars='';
    cols.forEach((col,c)=>{
      if (!col) { cells+=`<div class="mc-day is-blank" style="grid-column:${c+1}"></div>`; return; }
      const isT=col.ds===todayStr, hol=!!(data.holidays&&data.holidays[col.ds]);
      const lbl=`${month+1}월 ${col.d}일 ${DOWN[c]}요일${isT?', 오늘':''}${col.its.length?', '+col.its.map(i=>i.label).join(', '):''}`;   // 화면읽기: 막대는 숨기고 칸 이름에 항목 이름을 다 읽어 줌
      cells+=`<div class="mc-day${isT?' today':''}${c===0||c===6?' we':''}${hol?' hol':''}" style="grid-column:${c+1}" role="button" tabindex="0" aria-label="${_esc(lbl)}" onclick="showDayModal('${col.ds}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showDayModal('${col.ds}')}"><span class="mc-num">${col.d}</span></div>`;
    });
    segs.forEach(s=>{
      if (s.lane>=vis) return;
      const it=s.it, st=`grid-column:${s.start+1}/${s.end+2};grid-row:${s.lane+2};${it.bg?'--bg:'+it.bg+';':''}${it.fg?'--fg:'+it.fg+';':''}`;
      const link=it.g?` role="button" tabindex="0" onclick="event.stopPropagation();showGcalDetail('${s.ds}','${it.g}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();showGcalDetail('${s.ds}','${it.g}')}"`:' aria-hidden="true"';
      bars+=`<div class="mc-bar${it.cls?' '+it.cls:''}${it.g?' is-link':''}${s.end>s.start?' is-span':''}" style="${st}"${link} title="${_esc(it.title||it.label)}">${it.ic?IC[it.ic]:''}<span>${_esc(it.label)}</span></div>`;
    });
    if (over) more.forEach((n,c)=>{ if(n) bars+=`<div class="mc-more" style="grid-column:${c+1};grid-row:${vis+2}" aria-hidden="true">+${n}개</div>`; });
    html+=`<div class="mc-week" style="grid-template-rows:var(--mc-num-h)${rows?` repeat(${rows},var(--mc-lane-h))`:''} 1fr">${cells}${bars}</div>`;
  }
  host.innerHTML=html;
}

// ===== MODAL =====
function _dayEvCard(ds, ev){
  const c=ev.color||'#6366f1';
  const esc=x=>(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const ptNames=(ev.participants||[]).map(id=>(data.staff||[]).find(s=>s.id===id)?.name).filter(Boolean);
  const pills=ptNames.map(n=>`<span class="wm-ev-pt" style="background:${c}22;color:${c};">${esc(n)}</span>`).join('');
  const cmt=(ev.comments||[]).length;
  return `<div class="wm-ev-card" onclick="closeModal();openEventDetail('${ds}','${ev.id}')" style="background:${c}15;--evc:${c};--evc2:${c}55;">
    ${ev.time?`<div class="wm-ev-time" style="color:${c};">${ev.time}</div>`:''}
    <div class="wm-ev-title">${esc(ev.title)}${cmt?` <span style="display:inline-flex;align-items:center;gap:2px;background:${c}22;color:${c};font-size:12px;font-weight:700;padding:1px 7px;border-radius:10px;margin-left:4px;border:1px solid ${c}44;"><svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="flex:none;vertical-align:-1px;"><path d="M8 2.5c-3.1 0-5.7 1.9-5.7 4.2 0 1.3.8 2.5 2 3.3-.1.6-.4 1.2-.8 1.7-.2.2 0 .5.3.4.9-.1 1.8-.5 2.5-.9.5.1 1.1.2 1.7.2 3.1 0 5.7-1.9 5.7-4.2S11.1 2.5 8 2.5z"/></svg>${cmt}</span>`:''}</div>
    ${ev.location?`<div style="font-size:11px;color:var(--muted);margin-top:3px;">${esc(ev.location)}</div>`:''}
    ${pills?`<div class="wm-ev-pts">${pills}</div>`:''}
  </div>`;
}
function _dayGcalCard(ds, ev){
  const c=ev._color||'#4285f4';
  const esc=x=>(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const tl=(typeof _gcalTitleLoc==='function')?_gcalTitleLoc(ev):{title:ev.title||'',loc:ev.location||''};
  const meta=(typeof _gcalMeta==='function')?_gcalMeta(ev._id):{participants:[],comments:[]};
  const ptNames=(meta.participants||[]).map(id=>(data.staff||[]).find(s=>s.id===id)?.name).filter(Boolean);
  const pills=ptNames.map(n=>`<span class="wm-ev-pt" style="background:${c}22;color:${c};">${esc(n)}</span>`).join('');
  const cmt=(meta.comments||[]).length;
  return `<div class="wm-ev-card" onclick="closeModal();showGcalDetail('${ds}','${ev._id}')" style="background:${c}15;--evc:${c};--evc2:${c}55;cursor:pointer;">
    ${ev.start.time?`<div class="wm-ev-time" style="color:${c};">${ev.start.time}</div>`:''}
    <div class="wm-ev-title">${esc(tl.title)} <span style="font-size:10px;font-weight:700;color:${c};opacity:.65;">· ${esc(ev._calName||'구글')}</span>${cmt?` <span style="display:inline-flex;align-items:center;gap:2px;background:${c}22;color:${c};font-size:12px;font-weight:700;padding:1px 7px;border-radius:10px;margin-left:4px;border:1px solid ${c}44;"><svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="flex:none;vertical-align:-1px;"><path d="M8 2.5c-3.1 0-5.7 1.9-5.7 4.2 0 1.3.8 2.5 2 3.3-.1.6-.4 1.2-.8 1.7-.2.2 0 .5.3.4.9-.1 1.8-.5 2.5-.9.5.1 1.1.2 1.7.2 3.1 0 5.7-1.9 5.7-4.2S11.1 2.5 8 2.5z"/></svg>${cmt}</span>`:''}</div>
    ${tl.loc?`<div style="font-size:11px;color:var(--muted);margin-top:3px;">${esc(tl.loc)}</div>`:''}
    ${pills?`<div class="wm-ev-pts">${pills}</div>`:''}
  </div>`;
}
function showDayModal(dateStr) {
  modalDate=dateStr;
  const {y,m,d,date}=parseDateStr(dateStr); const dow=date.getDay();
  document.getElementById('modal-date-title').textContent=`${m}월 ${d}일 (${DOW_KR[dow]}) 근무 현황`;
  const entry=data.schedule[dateStr];
  const _esc=x=>(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const evColors=['#6366f1','#4a9fbd','#436bb5','#d65a52','#b69bd6','#4faa9c','#8a6ecf'];

  // ===== 일정 카드 (우리 일정 + 구글 일정) =====
  const ourEvs=(data.events||{})[dateStr]||[];
  let gEvs=[];
  try { gEvs=(_gcalEvents||[]).filter(ev=>(typeof _gcalCalOn!=='function'||_gcalCalOn(ev._calId)) && _icsOccurrences(ev,dateStr,dateStr).length); } catch(e){ gEvs=[]; }
  const addEvBtn=isAdmin?`<button class="btn btn-sm btn-outline" style="padding:3px 12px;font-size:11px;border-radius:999px;" onclick="toggleEventForm('${dateStr}')">+ 추가</button>`:'';
  let evCards='';
  ourEvs.forEach(ev=>{ evCards+=_dayEvCard(dateStr, ev); });
  gEvs.forEach(ev=>{ evCards+=_dayGcalCard(dateStr, ev); });
  let evHtml=`<div class="day-sect"><div class="day-sect-hd"><span class="day-hd-label">📌 일정</span>${addEvBtn}</div>`;
  evHtml += evCards ? `<div class="day-ev-list">${evCards}</div>` : `<div class="day-empty">등록된 일정 없음</div>`;
  evHtml+=`<div id="event-add-form" style="display:none;margin-top:8px;" class="event-form">
    <div class="event-row" style="margin-bottom:8px;">
      <input type="text" id="ev-title" class="form-input" placeholder="일정 제목" style="flex:1;padding:6px 10px;font-size:12px;">
      <input type="time" id="ev-time" class="form-input" style="width:90px;padding:6px 8px;font-size:12px;">
    </div>
    <div class="event-row">
      <div class="color-opts" id="ev-color-opts">
        ${evColors.map((c,i)=>`<div class="color-opt ${i===0?'selected':''}" style="background:${c};" onclick="selectEvColor(this)" data-color="${c}"></div>`).join('')}
      </div>
      <button class="btn btn-primary" style="width:auto;padding:5px 14px;font-size:12px;margin-left:auto;" onclick="saveCalEvent('${dateStr}')">저장</button>
    </div>
  </div>`;
  evHtml+=`</div>`;

  // ===== 근무 (당직 + 부서, 배경색 구분) =====
  let workHtml='';
  if (!entry) {
    workHtml=`<div class="day-empty" style="text-align:center;padding:22px 0;">근무표가 없습니다.</div>`;
  } else {
    if (entry.notes) workHtml+=`<div class="day-sect"><div class="day-note">📝 ${_esc(entry.notes)}</div></div>`;
    if (entry.danjik) { const s=staffById(entry.danjik); workHtml+=`<div class="day-dept-band" style="background:#fee2e2;color:#d65a52;"><div class="dd-band-title">당직</div><div class="dd-band-names"><span class="nm">${s?.name||'?'}</span></div></div>`; }
    const depts=[
      {key:'xr',label:'XR',bg:'var(--xr-bg)',fg:'var(--xr-light)',workers:(entry.xr||[]),desk:null},
      {key:'vw',label:'VW',bg:'var(--vw-bg)',fg:'var(--vw-light)',workers:(entry.vw?.workers||[]),desk:entry.vw?.desk},
      {key:'cg',label:'CG',bg:'var(--cg-bg)',fg:'var(--cg-light)',workers:(entry.cg?.workers||[]),desk:entry.cg?.desk},
      {key:'project',label:'PROJECT',bg:'var(--project-bg)',fg:'var(--project-light)',workers:(entry.project||[]),desk:null},
      {key:'sports',label:'SPORTS',bg:'var(--sports-bg)',fg:'var(--sports-light)',workers:(entry.sports||[]),desk:null},
    ];
    depts.forEach(({key,label,bg,fg,workers,desk})=>{
      if(!workers.length) return;
      const names=workers.map(id=>{ const s=staffById(id); const isDesk=id===desk; return s?`<span class="nm">${isDesk?'<span class="desk-star">★</span>':''}${s.name}</span>`:''; }).join('');
      workHtml+=`<div class="day-dept-band" style="background:${bg};color:${fg};"><div class="dd-band-title">${label} · ${workers.length}명</div><div class="dd-band-names">${names}</div></div>`;
    });
  }

  document.getElementById('modal-body').innerHTML = evHtml + workHtml;
  document.getElementById('day-modal').style.display='flex';
}
function toggleEventForm(dateStr) {
  const f=document.getElementById('event-add-form');
  f.style.display=f.style.display==='none'?'block':'none';
  if(f.style.display==='block') document.getElementById('ev-title').focus();
}
function selectEvColor(el) {
  document.querySelectorAll('.color-opt').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
}
function saveCalEvent(dateStr) {
  if (!isAdmin) { toast('관리자만 가능합니다.','error'); return; }
  const title=document.getElementById('ev-title').value.trim();
  if (!title) { toast('제목을 입력하세요.','error'); return; }
  const time=document.getElementById('ev-time').value||'';
  const colorEl=document.querySelector('.color-opt.selected');
  const color=colorEl?colorEl.dataset.color:'#6366f1';
  if (!data.events) data.events={};
  if (!data.events[dateStr]) data.events[dateStr]=[];
  data.events[dateStr].push({title,time,color});
  saveData(data);
  showDayModal(dateStr);
  if(currentView==='month') renderMonth();
  toast('일정 추가됨','success');
}
function removeCalEvent(dateStr, idx) {
  if (!isAdmin) { toast('관리자만 가능합니다.','error'); return; }
  if (!data.events?.[dateStr]) return;
  data.events[dateStr].splice(idx,1);
  if (!data.events[dateStr].length) delete data.events[dateStr];
  saveData(data);
  showDayModal(dateStr);
  if(currentView==='month') renderMonth();
  toast('삭제됨','success');
}
function closeModal() { _animModalClose(document.getElementById('day-modal')); }
function editThisDay() {
  closeModal();
  if (!isAdmin) { toggleAdmin(); return; }
  showAdminTab('edit');
  document.getElementById('edit-date').value=modalDate;
  loadDayForEdit();
}

