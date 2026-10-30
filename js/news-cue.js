/* [모듈] js/news-cue.js — 오늘 8뉴스·오뉴스 진입시간(NDS 큐시트 방송 시작 시각) | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것)
   데이터: nd_data id='cue' { days:{ 'YYYY-MM-DD': { news8:'HH:MM'|'', newsOh:'HH:MM'|'', progs:[{n,s}], at, sent } }, leader:{ dev, name, until } }
     — main 과 별도(저장 번호 안 올림). 쓰기는 서버 notify mode 'cue'만.
   가져오기 = 서버(notify serverCue — 비밀값 NDS_ID·NDS_PW, 오후 5분·그 외 15분)가 먼저. 서버가 못 읽으면 '담당 PC' 1대만(10-17): 근무표 앱들 중 서버 자리표(leader, 20분)를 잡은 PC만 NDS 에 붙어 오후(14:00~20:30) 5분·그 외 15분마다 확인.
     다른 앱은 자리표가 살아 있으면 NDS 도 서버 함수도 안 부르고 읽기만. 담당 PC가 꺼지면 자리표가 끝나 다른 앱이 이어받음.
   서버가 저장할 때 오늘 진입시간이 바뀌면 그날 8진·뉴오에게 '진입시간 변경' 알림, 크론은 시작 20분 전 알림(시간이 바뀌면 새 시각 기준으로 한 번 더)
   쓰는 곳: 홈 '오늘의 근무' 8진·뉴오 줄(_cuePaint — 8뉴스는 공지에 직접 넣은 시각이 먼저, cueNews8), 8뉴스가 평소(지난 5주 같은 요일에 가장 많던 시각)와 30분 이상 다르면 오늘의 공지 자동 등록 + 전 직원 알림(_cueNotice, 제목에 시각) */
// NDS 프로그램 이름(brdcPgmNm) — 10-17 실제: '8시뉴스'(월~목 19:48·금 19:46·토 19:53·일 19:56), '오뉴스'(평일 16:52~16:55, 주말 없음). 재방송 '(R)'은 뺌
const CUE_PGM={ news8:/8시\s*뉴스|8\s*뉴스/, newsOh:/^(SBS\s*)?오\s*뉴스/, skip:/\(R\)|스포츠|예고|재방|하이라이트/ };
let _cueDoc=null, _cueLoading=null, _cueNoAcct=false, _cueNext=0, _cueBusy=false;
function cueDay(ds){ return (_cueDoc&&_cueDoc.days&&_cueDoc.days[ds])||null; }
// 그날 8뉴스 진입시간 — 오늘의 공지에 직접 넣은 시각(notices[날짜].news8Time)이 먼저, 없으면 큐시트. 서버 notify n8Use(8진 알림)와 같은 규칙
//   홈 8진 줄 칩(_cuePaint)·8진 강조(js/home.js _updateDuty8Glow)가 씀
function _cueMan8(box){ const m=String((box&&box.news8Time)||'').trim().match(/^(\d{1,2}):(\d{2})$/); return m?m[1].padStart(2,'0')+':'+m[2]:''; }
function cueNews8(ds){
  let man=''; try{ man=_cueMan8(_getNoticeBox(ds)); }catch(e){}
  if(man) return man;
  const c=cueDay(ds); return c&&/^\d{2}:\d{2}$/.test(c.news8||'')?c.news8:'';
}
// 주말·공휴일 오후 짧은 뉴스 'SBS뉴스(15시)' 진입(10-20) — 그날 8진이 진행. 서버 notify n15(15시 뉴스 진행 알림, 20분 전)와 같은 규칙: 재방 (R) 빼고 첫 시작
function cueNews15(ds){
  const dow=new Date(ds+'T00:00:00').getDay();
  if(!(dow===0||dow===6||(data.holidays&&data.holidays[ds]))) return '';
  const c=cueDay(ds); if(!c||!Array.isArray(c.progs)) return '';
  return c.progs.filter(g=>/SBS\s*뉴스\s*\(\s*15\s*시\s*\)|^15시\s*뉴스/.test(String(g&&g.n||''))&&!/\(R\)|재방/.test(String(g&&g.n||''))).map(g=>String(g.s||'')).filter(v=>/^\d{2}:\d{2}$/.test(v)).sort()[0]||'';
}
// 오늘 오뉴스가 '없음'으로 확정됐나 — 오후 1시 넘어 가져왔는데도 큐시트에 없을 때만(그 전엔 아직 안 만들었을 수 있음)
function cueNoNewsOh(ds){ const c=cueDay(ds); if(!c||c.newsOh||!c.at) return false; const t=new Date(c.at), d=toDateStr(t.getFullYear(),t.getMonth()+1,t.getDate()); return d>ds||(d===ds&&t.getHours()>=13); }   // 전날 받아 둔 '내일' 기록은 확정 아님
function cueLoad(){
  if(_cueLoading) return _cueLoading;
  _cueLoading=(async()=>{
    try{
      const r=await fetch(`${SB_URL}/rest/v1/nd_data?id=eq.cue&select=payload`,{ headers:SB_HEADERS, cache:'no-store' });
      if(!r.ok) return;
      const a=await r.json(), p=a&&a[0]&&a[0].payload;
      _cueDoc=p&&p.days?p:{ days:{} };
      _cuePaint();
    }catch(e){ /* 다음에 */ }
    finally{ _cueLoading=null; }
  })();
  return _cueLoading;
}
// 홈 '오늘의 근무': 8진 줄 = (주말·공휴일이면 오후뉴스 진입 +) 8뉴스 진입, 뉴오 줄 = 오뉴스 진입 / 없음
function _cuePaint(){
  const ds=_todayStr(), c=cueDay(ds), n8=cueNews8(ds);
  document.querySelectorAll('[data-cue="news8"]').forEach(el=>{ el.textContent=n8?`${n8} 진입`:''; el.hidden=!n8; });
  const n15=cueNews15(ds);   // 주말·공휴일 오후 뉴스(8진 진행)
  document.querySelectorAll('[data-cue="news15"]').forEach(el=>{ el.textContent=n15?`오후뉴스 ${n15} 진입`:''; el.hidden=!n15; });
  document.querySelectorAll('[data-cue="newsOh"]').forEach(el=>{ const no=cueNoNewsOh(ds); el.textContent=c&&c.newsOh?`${c.newsOh} 진입`:no?'오늘 오뉴스 없음':''; el.hidden=!(c&&c.newsOh)&&!no; el.classList.toggle('none',!(c&&c.newsOh)&&no); });
  try{ _updateDuty8Glow(); _updateNewsOhGlow(); }catch(e){}
}
// 그날 큐시트 목록 → { news8, newsOh, progs }
function _cuePick(list, ds){
  const day=(list||[]).filter(c=>c&&c.date===ds&&/^\d{2}:\d{2}$/.test(c.start||''));
  const first=re=>day.filter(c=>re.test(c.name)&&!CUE_PGM.skip.test(c.name)).map(c=>c.start).sort()[0]||'';
  const seen=new Set(), progs=[];
  day.slice().sort((a,b)=>a.start.localeCompare(b.start)).forEach(c=>{ const k=c.name+'|'+c.start; if(seen.has(k)||progs.length>=60) return; seen.add(k); progs.push({ n:c.name, s:c.start }); });
  return { news8:first(CUE_PGM.news8), newsOh:first(CUE_PGM.newsOh), progs };
}
// 평소 8뉴스 시각: 지난 5주의 같은 요일(요일마다 다름 — 금 19:46, 토 19:53 …) 중 가장 많던 시각(2번 이상일 때만 — 특집 하루가 평소가 되지 않게)
function _cueUsual(ds){
  const cnt={};
  for(let i=7;i<=35;i+=7){ const c=cueDay(addDays(ds,-i)); if(c&&c.news8) cnt[c.news8]=(cnt[c.news8]||0)+1; }
  const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
  return best&&best[1]>=2?best[0]:'';
}
const _cueMin=t=>(+t.slice(0,2))*60+(+t.slice(3));
// 8뉴스가 평소와 다르면 오늘의 공지에 자동으로 + 전 직원 알림(10-29 사용자 '8뉴스 시간 바뀌면 무조건 알람' — 전엔 조용히 올렸음). 시간이 또 바뀌면 글을 고치고 다시 알림, 평소로 돌아오면 지움. id 하나(cue8-날짜)
// 알림은 저장(낙관적 잠금)에 성공한 기기 한 대만 보냄 — 여러 PC가 동시에 불러도 한 번
// 공지에 8뉴스 시각을 직접 넣었으면 자동 공지는 안 만듦(있으면 지움 — 시각이 둘로 보이지 않게)
// 올린 시각·글은 main cue8Auto[날짜] = { t, text }에 기억(7일): 사람이 지웠으면 같은 시각으론 다시 안 올림(시각이 또 바뀌면 새로), 사람이 글을 고쳤으면 덮지도 지우지도 않음
const CUE_NOTICE_MIN = 30;   // 평소와 이만큼(분) 이상 다르면 자동 공지(10-21: 5 → 30)
function _cueWant(ds, box){
  const c=cueDay(ds), usual=_cueUsual(ds);
  if(_cueMan8(box)||!(c&&c.news8&&usual)) return '';
  return Math.abs(_cueMin(c.news8)-_cueMin(usual))>=CUE_NOTICE_MIN?`오늘 8뉴스 진입시간은 ${c.news8}이에요. (평소 ${usual})`:'';   // 30분 이상 다를 때만(10-21 사용자 — 몇 분 차이는 그날 큐시트 사정)
}
// 공지 제목에도 시각(10-29 사용자 '안 열어보고도 바로 알게') — 알림 제목도 같음
const _cueTitle=n8=>`8뉴스 진입시간 ${n8}`;
// 할 일: '' 그대로 · 'del' 지움 · 'put' 올리기/고치기 · 'title' 제목만 고침(알림 없음 — 시각 없던 옛 제목) (it = 지금 자동 공지, mm = 기억한 { t, text }, n8 = 지금 큐시트 시각)
function _cueAct(it, want, mm, n8){
  if(it&&mm&&mm.text&&it.text!==mm.text) return '';   // 사람이 고친 글
  if(!want) return it?'del':'';
  if(it) return it.text!==want?'put':/^8뉴스 진입시간(\s+\d{2}:\d{2})?$/.test(it.title||'')&&it.title!==_cueTitle(n8)?'title':'';   // 사람이 바꾼 제목은 그대로
  return mm&&mm.t===n8?'':'put';   // 이 시각으로 올렸던 걸 사람이 지움
}
async function _cueNotice(ds){
  const id='cue8-'+ds, c=cueDay(ds), n8=(c&&c.news8)||'';
  const box0=_getNoticeBox(ds), cur=(box0.items||[]).find(i=>i.id===id);
  if(!_cueAct(cur, _cueWant(ds,box0), (data.cue8Auto||{})[ds], n8)) return;   // 이 기기 데이터로 먼저 거름(모두가 5분마다 부름 — main 을 괜히 받지 않게)
  let memo=null, push='';
  const ok=await _ndCommit(rp=>{
    const raw=rp.notices[ds];
    const box=raw&&Array.isArray(raw.items)?raw:{ news8Time:(raw&&raw.news8Time)||'', items:raw&&raw.text?[{ id:_genNoticeId(), text:raw.text, postedBy:raw.postedBy||'', postedAt:raw.postedAt||'', silent:false }]:[] };
    const m=rp.cue8Auto&&typeof rp.cue8Auto==='object'?rp.cue8Auto:{}, i=box.items.findIndex(x=>x.id===id), it=i>=0?box.items[i]:null;
    const want=_cueWant(ds,box), act=_cueAct(it,want,m[ds],n8);
    memo=null; push='';
    if(!act) return false;
    if(act==='del'){ box.items.splice(i,1); if(m[ds]){ delete m[ds]; rp.cue8Auto=memo=m; } }   // 시스템이 지움 → 기억도 지움(같은 시각이 다시 오면 다시 올림 — 기억이 남으면 '사람이 지움'으로 봄)
    else if(act==='title') it.title=_cueTitle(n8);
    else {
      if(it){ it.text=want; it.title=_cueTitle(n8); it.postedAt=new Date().toISOString(); it.silent=false; }
      else box.items.unshift({ id, title:_cueTitle(n8), text:want, postedBy:'NDS 큐시트', postedById:'', postedAt:new Date().toISOString(), silent:false, auto:true });
      push=want;
      m[ds]={ t:n8, text:want };
      Object.keys(m).forEach(d=>{ if(d<addDays(ds,-7)) delete m[d]; });
      rp.cue8Auto=memo=m;
    }
    rp.notices[ds]=box;
  });
  if(ok===true){
    if(memo){ data.cue8Auto=memo; try{ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }catch(e){} }   // _ndCommit 은 notices 만 받아 옴 — 기억도 같이
    try{ renderNoticeBar(); }catch(e){}
    if(push) _sendNoticePush(push, '⏰ '+_cueTitle(n8));
  }
}
function _cueDev(){ return ndPcId(); }   // js/meal.js
async function _cuePost(body){
  try{
    const res=await fetch(NOTIFY_FN_URL,{ method:'POST', headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY }, body:JSON.stringify(Object.assign({ mode:'cue', dev:_cueDev(), name:(currentUser&&staffById(currentUser.staffId)?.name)||(currentUser&&currentUser.name)||'' },body)) });
    return res.ok?await res.json():null;
  }catch(e){ return null; }
}
// 근무표 PC 앱만: 담당 PC 자리표가 비었거나 내 것이면 → NDS 오늘·내일(평소 시각 셈이 모자라면 지난 4주도) → 서버 저장(저장하면서 자리표를 잡음/늘림)
// NDS 를 못 읽는 PC(사내망 밖·계정 문제)는 저장을 못 하니 자리표를 잡지 않음 — 다른 PC가 담당
async function _cueTick(){
  await cueLoad();
  // 서버가 담당(NDS 를 서버가 직접 읽음 — notify serverCue)이면 PC는 안 읽고, 8뉴스가 평소와 다를 때 공지만(누가 먼저 하든 한 번 — id 하나)
  const L0=_cueDoc&&_cueDoc.leader;
  if(L0&&L0.dev==='server'&&Date.parse(L0.until||'')>Date.now()){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.staffId) _cueNotice(_todayStr()); return; }
  if(_cueBusy||_cueNoAcct||typeof ND_APP==='undefined'||!ND_APP||!window.ndApp?.ndsCue) return;
  const now=new Date(), mins=now.getHours()*60+now.getMinutes();
  if(mins<6*60||mins>21*60+30||Date.now()<_cueNext) return;
  const L=_cueDoc&&_cueDoc.leader;
  if(L&&L.dev&&L.dev!==_cueDev()&&Date.parse(L.until||'')>Date.now()) return;   // 다른 PC가 담당 중 — NDS 도 서버 함수도 안 부름
  _cueBusy=true;
  try{
    const today=_todayStr();
    const past=Object.keys((_cueDoc&&_cueDoc.days)||{}).filter(d=>d<today&&d>=addDays(today,-28)&&cueDay(d).news8).length;
    const from=past<10?addDays(today,-28):today, to=addDays(today,1);
    const r=await window.ndApp.ndsCue(from,to).catch(e=>({ ok:false, error:e.message }));
    if(!r||!r.ok){
      if(r&&r.reason==='noaccount') _cueNoAcct=true;
      _cueNext=Date.now()+(r&&r.reason==='login'?30:15)*60e3;   // 못 읽으면 잠시 쉼(NDS 를 두드리지 않게)
      console.warn('NDS 큐시트:',r&&(r.error||r.reason)); return;
    }
    const days={};
    for(let d=from; d<=to; d=addDays(d,1)){ const p=_cuePick(r.list,d); if(p.progs.length||d===today) days[d]=p; }
    const sv=await _cuePost({ from, to, days });
    if(!sv||!sv.leader){ _cueNext=Date.now()+5*60e3; await cueLoad(); return; }   // 그 사이 다른 PC가 담당이 됨
    await cueLoad();
    _cueNotice(today);
    _cueNext=Date.now()+((mins>=14*60&&mins<20*60+30)?5:15)*60e3-20e3;   // 오후(오뉴스·8뉴스 앞)엔 5분, 그 외 15분 — 자리표(20분)보다 짧게
  }finally{ _cueBusy=false; }
}
// 모두: 시작 때 읽기(웹·폰도 진입시간 표시) + 5분마다(앱은 담당 PC 확인 포함, 아니면 읽기만)
setTimeout(()=>{ _cueTick(); },4000);
setInterval(()=>{ _cueTick(); },5*60e3);
