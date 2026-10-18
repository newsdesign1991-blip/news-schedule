/* [모듈] js/alarms.js — 알림함(받은 휴가 조정·데스크 조정 요청 등) | dashboard.html 메인 스크립트(app-mode.js 앞). 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// 서버 notify 함수 mode 'direct'(js/leave-request.js _lrSendAlarms가 부름)가 받는 사람마다 nd_data id='alarms' payload[직원 id]에 쌓음(60일·100건).
// 여기선 내 것만 읽어 보여 줌: 웹·휴대폰 = 위쪽 이름 떠 있는 바(header)의 종 버튼, 근무표 앱 = 제목줄(js/app-mode.js가 같은 버튼을 옮김).
// 안 읽은 수 = 마지막으로 연 뒤 온 것(이 기기 localStorage nd_alarm_seen_<직원 id>). 2분마다·로그인 때 새로 읽음.
let _alData=null, _alAt=0;
const _alEsc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function _alSid(){ return (typeof currentUser!=='undefined'&&currentUser&&currentUser.staffId)||''; }
function _alMine(){ const sid=_alSid(); return sid&&_alData&&Array.isArray(_alData[sid])?_alData[sid].slice().sort((a,b)=>b.id-a.id):[]; }
function _alSeenKey(){ return 'nd_alarm_seen_'+_alSid(); }
function _alSeen(){ try{ return +localStorage.getItem(_alSeenKey())||0; }catch(e){ return 0; } }
async function alarmLoad(force){
  if(!_alSid()){ _alBadge(); return; }
  if(!force && _alData && Date.now()-_alAt<60e3){ _alBadge(); return; }
  try{
    const r=await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.alarms&select=payload`,{ headers:SB_HEADERS, cache:'no-store' });
    if(r.ok){ const a=await r.json(); _alData=(a&&a[0]&&a[0].payload&&typeof a[0].payload==='object')?a[0].payload:{}; _alAt=Date.now(); }
  }catch(e){}
  _alBadge();
}
// 종 버튼: 직원으로 로그인했을 때만 보임, 안 읽은 게 있으면 빨간 숫자
function _alBadge(){
  const sid=_alSid(), n=sid?_alMine().filter(x=>x.id>_alSeen()).length:0;
  document.querySelectorAll('.nd-alarm-btn').forEach(b=>{
    b.style.display=sid?'':'none'; b.classList.toggle('has', n>0);
    const c=b.querySelector('.nd-alarm-n'); if(c) c.textContent=n>9?'9+':(n?String(n):'');
    b.setAttribute('aria-label', n?`알림함 — 안 읽은 알림 ${n}개`:'알림함');
  });
}
function _alWhen(iso){
  const d=new Date(iso); if(isNaN(d)) return '';
  const m=Math.round((Date.now()-d)/60000);
  if(m<1) return '방금'; if(m<60) return m+'분 전'; if(m<24*60) return Math.round(m/60)+'시간 전';
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
}
function openAlarmStation(){
  const L=_alMine(), seen=_alSeen();
  const ic={ leave:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    desk:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17v4"/></svg>' };
  const html=L.length
    ? '<div class="al-list">'+L.map(x=>`<button type="button" class="al-item k-${_alEsc(x.kind)}${x.id>seen?' new':''}" onclick="alarmOpen('${_alEsc(x.kind)}')"><span class="al-ic">${ic[x.kind]||ic.leave}</span><span class="al-tx"><b>${_alEsc(x.title)}</b><span>${_alEsc(x.body)}</span><small>${_alEsc(_alWhen(x.at))}${x.fromName?' · '+_alEsc(x.fromName):''}</small></span>${x.id>seen?'<i class="al-dot" aria-label="새 알림"></i>':''}</button>`).join('')+'</div>'
    : '<div class="al-empty">받은 알림이 없어요.<br><small>휴가 조정 요청 같은 알림이 오면 여기에 모여요.</small></div>';
  openSheet('알림함', html);
  if(L.length) try{ localStorage.setItem(_alSeenKey(), String(L[0].id)); }catch(e){}
  _alBadge();
}
// 알림을 누르면 관련 화면으로(휴가·데스크 조정 → 휴가신청)
function alarmOpen(kind){
  if(typeof closeSheet==='function') closeSheet();
  if(kind==='leave'||kind==='desk') setTimeout(()=>showView('leavereq'), 200);
}
setInterval(()=>{ if(_alSid()) alarmLoad(true); }, 2*60e3);
