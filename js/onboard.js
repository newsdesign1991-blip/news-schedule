/* [모듈] js/onboard.js — 처음 로그인했을 때 '알림 켜기' 안내 + '휴대폰·앱으로 쓰기' 안내 화면 | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것)
   알림 켜기(10-20 요청): 이름으로 로그인한 뒤, 이 기기에서 알림이 꺼져 있으면 한 번(나중에 = 7일 뒤 다시). 켜기는 js/admin.js togglePush(웹 푸시·PC 앱 우편함 공통).
     아이폰 사파리(홈 화면 앱 아님)처럼 알림을 못 받는 곳이면 켜기 대신 [방법 보기] → ndAppGuide. 안드로이드(삼성 인터넷·크롬)는 브라우저에서도 켜지고, 앱 설치 안내 링크만 덧붙임. 근무표 PC 앱은 처음 사용법(ndAppTour)이 끝난 뒤.
   휴대폰·앱으로 쓰기(ndAppGuide): QR·주소 복사 / 갤럭시(삼성 인터넷 주소창 설치 아이콘) / 아이폰(사파리 주소창 안 왼쪽 ≡ → 공유 → 위로 쓸어올려 홈 화면에 추가) / 다른 안드로이드(크롬) / PC — 지금 기기 칸이 먼저 펼쳐짐.
   PC 앱은 시트 대신 ndPhonePop(제목줄 휴대폰 버튼·렌치 메뉴): 왼쪽 QR·이유 / 오른쪽 기기 탭별 순서. 들어가는 곳 = 상단 이름 메뉴, PC 앱 렌치 메뉴, 알림 안내의 [방법 보기] */
const ND_SITE_URL='https://newsdesign1991-blip.github.io/news-schedule/';
function _nbSiteUrl(){ return /github\.io$/.test(location.hostname)?location.origin+location.pathname.replace(/index\.html$|dashboard\.html$/,''):ND_SITE_URL; }
function _nbDevice(){
  const ua=navigator.userAgent;
  if(typeof ND_APP!=='undefined'&&ND_APP) return 'app';
  if(/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)) return 'ios';
  if(/Android/.test(ua)) return /SamsungBrowser/.test(ua)?'samsung':'android';
  return 'pc';
}
function _nbKey(){ return 'nd_notify_prompt_'+((typeof currentUser!=='undefined'&&currentUser&&currentUser.staffId)||''); }
let _nbChecked=false;
// 로그인 뒤 한 번(js/login-ui.js _updateUserHeader 가 부름). 앱은 처음 사용법이 끝난 뒤(ndAppTour 가 부름)
function ndNotifyPromptSoon(){
  if(_nbChecked||typeof currentUser==='undefined'||!currentUser||!currentUser.staffId) return;
  _nbChecked=true;
  setTimeout(()=>ndNotifyPrompt(false),2500);
}
async function ndNotifyPrompt(force){
  if(typeof currentUser==='undefined'||!currentUser||!currentUser.staffId) return;
  if(document.getElementById('nb-pop')||document.getElementById('tour-ov')||document.getElementById('apx-pop')||document.getElementById('ph-pop')) return;   // 다른 안내가 떠 있으면 다음에(휴대폰 안내는 닫힐 때 다시 부름)
  if(typeof ND_APP!=='undefined'&&ND_APP&&!force){ try{ if(!localStorage.getItem('nd_app_tour_v1')) return; }catch(e){} }   // 앱: 사용법 먼저
  if(!force){ try{ const v=JSON.parse(localStorage.getItem(_nbKey())||'null'); if(v&&(v.off||Date.now()<(v.until||0))) return; }catch(e){} }
  let on=false; try{ on=typeof isPushSubscribed==='function'&&await isPushSubscribed(); }catch(e){}
  if(on) return;
  const dev=_nbDevice(), standalone=typeof _isStandalone==='function'&&_isStandalone();
  const needGuide=(dev==='ios'&&!standalone)||(typeof _pushSupported==='function'&&!_pushSupported());
  const howLink=!needGuide&&!standalone&&(dev==='samsung'||dev==='android');   // 안드로이드 브라우저: 알림은 켜지지만 앱으로 설치하면 더 편함
  const lead=needGuide
    ?(dev==='ios'?'아이폰은 <b>홈 화면에 추가한 근무표</b>에서만 알림을 받을 수 있어요. 방법을 보고 추가한 뒤, 거기서 알림을 켜 주세요.'
      :'이 브라우저는 알림을 받을 수 없어요. 아래 방법으로 앱처럼 설치한 뒤 켜 주세요.')
    :(dev==='app'?'이 PC에서 알림을 켜면 8진·오뉴스 진행을 화면 알림으로 받아요. 창을 닫아도 트레이에서 계속 받아요.':'알림을 켜면 내 근무와 진행 시각을 놓치지 않아요.');
  const el=document.createElement('div'); el.id='nb-pop'; el.className='wt-pop';
  el.innerHTML=`<div class="wt-card nb-card" role="dialog" aria-modal="true" aria-labelledby="nb-t">
    <div class="wt-head nb-head" id="nb-t"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>알림을 켜 주세요</div>
    <div class="wt-body">
      <p class="nb-lead">${lead}</p>
      <ul class="nb-list">
        <li><b>근무 알림</b> — 매일 내 근무 안내</li>
        <li><b>8진·오뉴스 진행</b> — 진입 20분 전, 시간이 바뀌면 바로</li>
        <li><b>공지·투표·휴가 조정</b> — 새 소식이 올라오면</li>
      </ul>
      ${howLink?'<button type="button" class="nb-how">홈 화면에 앱으로 설치하는 방법 보기</button>':''}
      <p class="wt-status" id="nb-status" role="status"></p>
    </div>
    <div class="wt-foot"><button type="button" class="wt-cancel nb-later">나중에</button><button type="button" class="wt-go nb-go">${needGuide?'방법 보기':'알림 켜기'}</button></div>
  </div>`;
  document.body.appendChild(el);
  const close=()=>el.remove();
  el.querySelector('.nb-later').onclick=()=>{ try{ localStorage.setItem(_nbKey(),JSON.stringify({ until:Date.now()+7*864e5 })); }catch(e){} close(); };
  el.addEventListener('click',e=>{ if(e.target===el) el.querySelector('.nb-later').click(); });
  const go=el.querySelector('.nb-go'), st=el.querySelector('#nb-status');
  const how=el.querySelector('.nb-how'); if(how) how.onclick=()=>{ close(); ndAppGuide(); };
  go.onclick=async()=>{
    if(needGuide){ close(); ndAppGuide(); return; }
    go.disabled=true; go.textContent='켜는 중…';
    try{ if(typeof togglePush==='function') await togglePush(); }catch(e){}
    let ok=false; try{ ok=await isPushSubscribed(); }catch(e){}
    if(ok){ close(); toast('알림을 켰어요. 알림 종류는 [알림 설정]에서 고를 수 있어요.','success'); }
    else { go.disabled=false; go.textContent='다시 켜기'; st.textContent='알림을 켜지 못했어요. 브라우저가 묻는 창에서 [허용]을 눌러 주세요.'; }
  };
  go.focus();
}
// ── 휴대폰·앱으로 쓰기 안내 ──
// 버튼 모양 그림(_gdI 아이콘·_gdK 버튼 칩·_gdMock 화면 그림). 갤럭시=삼성 인터넷 주소창 [설치] 아이콘 → 설치(앱으로 설치). 메뉴 '현재 페이지 추가 → 홈 화면'은 바로가기라 안 됨
const _GD_IC={
  dots:'<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  kebab:'<circle cx="12" cy="5" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.7" fill="currentColor" stroke="none"/>',
  share:'<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  addsq:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  install:'<path d="M12 3v11"/><path d="M7.5 9.5 12 14l4.5-4.5"/><path d="M5 20h14"/>',
  reload:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  pmenu:'<path d="M4 7h16M4 12h13M4 17h9"/>',
  tabs2:'<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
  siri:'<circle cx="12" cy="12" r="8"/><path d="M4.5 13c2.5-3 5 2 7.5 0s5-3 7.5 0"/>',
  trans:'<path d="M4 5h8v6H7l-3 2z"/><path d="M12 9h8v7h-2v3l-3-3h-3z"/>',
  folder:'<path d="M3 6a2 2 0 0 1 2-2h5l4 3v12H5a2 2 0 0 1-2-2z"/><path d="M14 7h5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5"/>',
  memo:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/><path d="M7 15c1-2 2-2 2.5 0s1.5 2 2.5 0 2-2 3 0"/>',
  find:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M8 8h6M8 12h3"/><circle cx="16" cy="16" r="3"/><path d="M18.2 18.2 21 21"/>',
  glasses:'<circle cx="6.5" cy="13" r="3.5"/><circle cx="17.5" cy="13" r="3.5"/><path d="M10 13h4"/>',
  up:'<path d="M6 15l6-6 6 6"/>',
  back:'<path d="M15 18l-6-6 6-6"/>',
  fwd:'<path d="M9 18l6-6-6-6"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h14V9.5"/>',
  tabs:'<rect x="4" y="4" width="16" height="16" rx="3"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
};
function _gdI(k,cls){ return `<svg class="${cls||'gd-ic'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${_GD_IC[k]||''}</svg>`; }
function _gdK(k,label){ return `<span class="gd-key">${k?_gdI(k):''}${label?'<b>'+label+'</b>':''}</span>`; }
function _gdHost(){ try{ return new URL(_nbSiteUrl()).host; }catch(e){ return 'github.io'; } }
// 화면 그림: 실제 화면을 그대로 그린 게 아니라 '어디를 누르는지'만 보이게. gd-hit = 누를 곳(파란 테두리가 깜빡임), gd-no = 누르면 안 되는 곳
function _gdMock(kind){
  const h=_gdHost(), b=(k,c)=>`<span class="gd-mb${c?' '+c:''}">${_gdI(k)}</span>`;
  const row=(k,t,c)=>`<div class="gd-mrow${c?' '+c:''}"><span>${t}</span>${k?_gdI(k):''}</div>`;
  const app=`<div class="gd-dlg-app"><img src="app-icon-v3-192.png" alt=""><div><b>근무표</b><small>${h}</small></div></div>`;
  const M={
    iosBar:`<div class="gd-bar">${b('back')}<span class="gd-addr gd-addr-ios">${b('pmenu','gd-hit')}<span class="gd-host">${h}</span>${_gdI('reload','gd-ic-s')}</span>${b('tabs2')}</div><i class="gd-cap">화면 아래 주소창 — 주소창 <b>안 왼쪽</b>의 줄 세 개</i>`,
    iosMenu:`<div class="gd-menu gd-menu-l">${row('siri','Siri에게 요청하기','gd-dim')}${row('trans','영어로 번역','gd-dim')}${row('share','공유','gd-hit gd-sep')}${row('book','북마크에 추가','gd-dim')}${row('folder','북마크를 추가할 폴더…','gd-dim')}</div><i class="gd-cap">줄 세 개를 누르면 나오는 메뉴</i>`,
    iosOld:`<div class="gd-bar gd-tool">${b('back')}${b('fwd','gd-dim')}${b('share','gd-hit')}${b('book')}${b('tabs')}</div><i class="gd-cap">예전 아이폰: 맨 아래 줄 가운데 <b>공유</b></i>`,
    iosSheet:`<div class="gd-share"><div class="gd-apps"><span><i style="background:linear-gradient(#5ba8ff,#1f6fe5)"></i>AirDrop</span><span><i style="background:linear-gradient(#7be36f,#34c759)"></i>메시지</span><span><i style="background:linear-gradient(#ffd84d 0 22%,#fff 22%)"></i>메모</span><span><i style="background:#fff"></i>미리 알림</span></div><div class="gd-acts">${['copy:복사','book:북마크에 추가','glasses:읽기 목록에 추가','up:간략히 보기'].map(x=>{ const [k,t]=x.split(':'); return `<span><i>${_gdI(k)}</i>${t}</span>`; }).join('')}</div><div class="gd-swipe">${_gdI('up')}위로 쓸어올리면 아래 목록이 나와요</div><div class="gd-menu gd-menu-l">${row('folder','북마크를 추가할 폴더…','gd-dim')}${row('star','즐겨찾기에 추가','gd-dim')}${row('memo','빠른 메모에 추가','gd-dim')}${row('find','페이지에서 찾기','gd-dim')}${row('addsq','홈 화면에 추가','gd-hit')}</div></div><i class="gd-cap">공유 창을 <b>위로 쓸어올려서</b> 목록 맨 아래쪽</i>`,
    iosAdd:`<div class="gd-dlg"><div class="gd-dlg-h"><span>취소</span><b>홈 화면에 추가</b><span class="gd-txt gd-hit">추가</span></div>${app}<div class="gd-mrow"><span>웹 앱으로 열기</span><span class="gd-tg"></span></div></div><i class="gd-cap"><b>웹 앱으로 열기</b>가 켜져(초록) 있어야 해요 → 오른쪽 위 <b>추가</b></i>`,
    sgBar:`<div class="gd-bar"><span class="gd-addr">${_gdI('lock','gd-ic-s')}${h}</span>${b('reload')}${b('install','gd-hit')}</div><i class="gd-cap">주소창 오른쪽, 새로고침 옆 <b>설치</b> 아이콘 (근무표처럼 설치되는 사이트에서만)</i>`,
    sgDlg:`<div class="gd-dlg">${app}<div class="gd-dlg-btns"><span>취소</span><span class="gd-txt gd-hit">설치</span></div></div><i class="gd-cap">아래에 뜨는 설치 창에서 <b>설치</b></i>`,
    sgTool:`<div class="gd-bar gd-tool">${b('back')}${b('fwd')}${b('home')}${b('star')}${b('tabs')}${b('menu','gd-no')}</div><i class="gd-cap">맨 아래 <b>≡ → 현재 페이지 추가 → 홈 화면</b> = 바로가기</i>`,
    crBar:`<div class="gd-bar">${b('home')}<span class="gd-addr">${_gdI('lock','gd-ic-s')}${h}</span>${b('tabs')}${b('kebab','gd-hit')}</div><i class="gd-cap">주소창 오른쪽 끝 <b>⋮</b></i>`,
    crMenu:`<div class="gd-menu">${row('','새 탭','gd-dim')}${row('','…','gd-dim')}${row('install','앱 설치 (또는 홈 화면에 추가)','gd-hit')}</div><i class="gd-cap">메뉴를 조금 내리면 있어요</i>`
  };
  return `<div class="gd-mock" aria-hidden="true">${M[kind]||''}</div>`;
}
// 브라우저가 설치 창을 띄워 줄 수 있으면(beforeinstallprompt — 크롬·삼성 인터넷) 맨 위에 [이 폰에 앱으로 설치]. js/a2hs.js 가 늦게 받아도 다시 부름
function _gdQuick(){
  const can=typeof _deferredInstall!=='undefined'&&!!_deferredInstall;
  document.querySelectorAll('[data-gd-quick]').forEach(el=>{
    el.innerHTML=can?'<button type="button" class="gd-install" onclick="_gdInstall()">이 폰에 앱으로 설치</button><small>누르면 뜨는 창에서 <b>설치</b>를 누르면 끝이에요. 안 되면 아래 순서대로 해 주세요.</small>':'';
  });
}
function _gdInstall(){ if(typeof closeSheet==='function') closeSheet(); if(typeof installA2HS==='function') installA2HS(); }
// 기기별 설치 순서(휴대폰 안내 시트·PC 앱 휴대폰 팝업 같이 씀). qr=true 면 'QR을 찍어 열어요'(PC 앱 팝업), 아니면 '위 주소를 열어요'
function _gdSteps(k,qr){
  const steps=a=>'<ol class="gd-steps">'+a.map(t=>`<li>${t}</li>`).join('')+'</ol>';
  const bell='홈 화면의 <b>근무표</b>로 열고 이름으로 로그인 → 나오는 '+_gdK('bell','알림 켜기')+' → <b>허용</b>';
  if(k==='ios') return steps([
      qr?'카메라로 QR을 찍고 뜨는 주소를 눌러 <b>사파리(Safari)</b>로 열어요':'<b>사파리(Safari)</b>로 위 주소를 열어요 (카톡에서 눌렀다면 오른쪽 아래 메뉴 → <b>Safari로 열기</b>)',
      '아래 주소창 <b>안 왼쪽</b>에 있는 '+_gdK('pmenu','')+' (줄 세 개) 버튼을 눌러요'+_gdMock('iosBar'),
      '메뉴에서 '+_gdK('share','공유')+'를 눌러요'+_gdMock('iosMenu'),
      '아래에서 올라온 공유 창을 <b>위로 쓸어올리면</b> 버튼이 더 나와요 → '+_gdK('addsq','홈 화면에 추가')+'를 눌러요'+_gdMock('iosSheet'),
      '<b>웹 앱으로 열기</b>가 켜져 있는지 보고 오른쪽 위 <b>추가</b>'+_gdMock('iosAdd'),
      bell
    ])+`<p class="gd-note"><b>맨 아래에 버튼 줄이 따로 있는 아이폰</b>(iOS 18 이하)은 줄 세 개 대신 아래 가운데 ${_gdK('share','공유')}를 바로 누르고 ④부터 하면 돼요.</p>${_gdMock('iosOld')}<p class="gd-note">아이패드는 주소창 오른쪽 위에 공유 버튼이 있어요. 목록에 홈 화면에 추가가 없으면 맨 아래 <b>작업 편집</b>에서 켜요.</p><p class="gd-note">아이폰은 <b>홈 화면에 추가한 근무표</b>에서만 알림을 받을 수 있어요(iOS 16.4 이상).</p>`;
  if(k==='galaxy') return '<div class="gd-quick" data-gd-quick></div>'+steps([
      qr?'카메라로 QR을 찍고 뜨는 주소를 눌러 <b>삼성 인터넷</b>으로 열어요 (크롬으로 열리면 <b>다른 안드로이드</b> 순서대로 해도 돼요)':'<b>삼성 인터넷</b>으로 위 주소를 열어요',
      '주소창 오른쪽, 새로고침 옆에 생기는 '+_gdK('install','설치')+' 아이콘을 눌러요 (아래 화살표 모양, 버전에 따라 <b>＋</b>)'+_gdMock('sgBar')+'<p class="gd-note">이 아이콘은 <b>앱으로 설치할 수 있는 사이트에서만</b> 생겨요. 구글 같은 보통 사이트에선 안 보이는 게 맞아요. 근무표 주소를 열고 잠깐 기다리면 나타나요.</p>',
      '아래에 뜨는 설치 창(<b>앱스 화면에 설치</b>)에서 <b>설치</b> — 설치 진행은 알림창에 보여요'+_gdMock('sgDlg'),
      bell
    ])+`<div class="gd-warn"><b>≡ 메뉴 → 현재 페이지 추가 → 홈 화면은 쓰지 마세요.</b> 앱이 아니라 <b>바로가기</b>라서 삼성 인터넷 안에서 열리고 주소창이 그대로 보여요.${_gdMock('sgTool')}이미 그렇게 만들었다면 그 아이콘은 지우고 위 순서로 다시 설치해 주세요.</div><p class="gd-note"><b>제대로 설치됐는지 보는 법</b> — 근무표를 열었을 때 맨 위에 <b>주소창이 없으면</b> 앱으로 설치된 거예요.</p><p class="gd-note"><b>설치 아이콘이 안 보이면</b> — 페이지를 한 번 새로고침해요. 그래도 없으면 갤럭시 스토어에서 삼성 인터넷을 업데이트해요. 쉬운 사용 모드에서는 안 될 수 있어요. 그래도 안 되면 크롬 순서대로 해 주세요.</p>`;
  if(k==='chrome') return '<div class="gd-quick" data-gd-quick></div>'+steps([
      qr?'카메라로 QR을 찍고 뜨는 주소를 눌러 <b>크롬(Chrome)</b>으로 열어요':'<b>크롬(Chrome)</b>으로 위 주소를 열어요',
      '주소창 오른쪽 끝 '+_gdK('kebab','')+' 메뉴를 눌러요'+_gdMock('crBar'),
      _gdK('install','앱 설치')+' 또는 <b>홈 화면에 추가</b> → <b>설치</b> (<b>바로가기 만들기</b> 말고 <b>설치</b>)'+_gdMock('crMenu'),
      bell
    ]);
  return '';
}
function ndAppGuide(){
  if(typeof closeHdrMenu==='function') closeHdrMenu();
  document.getElementById('ndt-pop')?.remove();
  const dev=_nbDevice();
  if(dev==='app') return ndPhonePop();   // PC 앱: 시트 대신 큰 팝업(QR + 기기별 순서)
  const url=_nbSiteUrl(), esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const standalone=typeof _isStandalone==='function'&&_isStandalone();
  const openK=dev==='samsung'?'galaxy':dev==='android'?'chrome':dev;
  const sec=(k,title,sub,body)=>`<details class="gd-sec" ${k===openK?'open':''}><summary><b>${title}</b><small>${sub}</small></summary><div class="gd-body">${k===openK&&standalone?'<p class="gd-ok">지금 앱으로 열려 있어요. 알림만 켜면 끝이에요.</p>':''}${body}</div></details>`;
  const html=`<div class="gd">
    <div class="gd-qr-row">
      <div class="gd-qr" id="gd-qr" aria-label="근무표 주소 QR 코드"><span>QR 만드는 중…</span></div>
      <div class="gd-url"><b>휴대폰 카메라로 찍으면 열려요</b><code>${esc(url)}</code><button type="button" class="gd-copy" onclick="_gdCopy(this)">주소 복사</button></div>
    </div>
    ${sec('galaxy','갤럭시','삼성 인터넷 → 앱으로 설치',_gdSteps('galaxy'))}
    ${sec('ios','아이폰 · 아이패드','사파리 → 홈 화면에 추가',_gdSteps('ios'))}
    ${sec('chrome','다른 안드로이드','크롬 → 앱 설치',_gdSteps('chrome'))}
    ${sec('pc','회사 PC','근무표 앱으로','<ol class="gd-steps"><li>PC에서는 웹 대신 <b>근무표 PC 앱</b>을 써요</li><li>PC 브라우저로 위 주소를 열면 나오는 <b>설치 도우미 받기</b>를 눌러요</li><li>받은 파일을 실행 → 바탕화면의 <b>근무표</b>로 열어요</li></ol>')}
  </div>`;
  openSheet('휴대폰·앱으로 쓰기', html);
  // 로그인 화면(z 9999) 위에서 열 때도 보이게 — 다음 openSheet 가 지움
  const lo=document.getElementById('login-overlay');
  if(lo&&getComputedStyle(lo).display!=='none') document.getElementById('sheet-overlay')?.classList.add('sheet-top');
  _gdQuick();
  _gdQr(url);
}
// ── PC 앱 제목줄 휴대폰 버튼(js/app-mode.js) → 큰 팝업: 왼쪽 QR·주소·왜 깔면 좋은지 / 오른쪽 갤럭시·아이폰·다른 안드로이드 탭별 설치 순서(그림) ──
const _PH_TABS=[['galaxy','갤럭시','삼성 인터넷'],['ios','아이폰','사파리'],['chrome','다른 안드로이드','크롬']];
function ndPhonePop(onClose){
  if(typeof closeHdrMenu==='function') closeHdrMenu();
  document.getElementById('ndt-pop')?.remove();
  if(document.getElementById('ph-pop')) return;
  const url=_nbSiteUrl(), esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  let tab='galaxy'; try{ const t=localStorage.getItem('nd_phone_tab'); if(_PH_TABS.some(x=>x[0]===t)) tab=t; }catch(e){}
  const el=document.createElement('div'); el.id='ph-pop'; el.className='wt-pop';
  el.innerHTML=`<div class="wt-card ph-card" role="dialog" aria-modal="true" aria-labelledby="ph-t">
    <div class="wt-head ph-head"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg><span id="ph-t">휴대폰에서 근무표 쓰기</span><button type="button" class="ph-x" aria-label="닫기"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="ph-body">
      <aside class="ph-left">
        <div class="ph-qr" id="ph-qr" aria-label="근무표 주소 QR 코드"><span>QR 만드는 중…</span></div>
        <b class="ph-big">휴대폰 카메라로 QR을 찍으세요</b>
        <p class="ph-sub">근무표가 열리면 오른쪽 순서대로 <b>앱으로 설치</b>하고 알림을 켜면 끝이에요.</p>
        <div class="ph-url"><code>${esc(url)}</code><button type="button" class="gd-copy" onclick="_gdCopy(this)">주소 복사</button></div>
        <div class="ph-why"><b>휴대폰에 깔아 두면</b><ul>
          <li><b>근무 알림</b> — 매일 내 근무를 알려 줘요</li>
          <li><b>8진·오뉴스 진행</b> — 진입 20분 전, 시간이 바뀌면 바로</li>
          <li><b>공지·투표·휴가 조정</b> — 새 소식이 올라오면</li>
          <li>회사 밖에서도 근무표·휴가 보기, 휴가 신청</li>
        </ul></div>
        <p class="ph-note">로그인은 PC 앱과 같은 이름으로 해요. 알림은 휴대폰마다 따로 켜야 해요.</p>
      </aside>
      <section class="ph-right">
        <div class="ph-tabs" role="tablist" aria-label="휴대폰 종류">${_PH_TABS.map(([k,t,s])=>`<button type="button" role="tab" data-k="${k}" aria-selected="${k===tab}"><b>${t}</b><small>${s}</small></button>`).join('')}</div>
        <div class="ph-panel" role="tabpanel"></div>
      </section>
    </div>
  </div>`;
  document.body.appendChild(el);
  const panel=el.querySelector('.ph-panel');
  const show=k=>{
    tab=k; try{ localStorage.setItem('nd_phone_tab',k); }catch(e){}
    el.querySelectorAll('.ph-tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.k===k)));
    panel.innerHTML=_gdSteps(k,true); panel.scrollTop=0;
    panel.querySelectorAll('[data-gd-quick]').forEach(q=>q.remove());   // PC에선 '이 폰에 설치' 버튼 없음
  };
  el.querySelector('.ph-tabs').onclick=e=>{ const b=e.target.closest('button[data-k]'); if(b) show(b.dataset.k); };
  const close=()=>{ el.remove(); document.removeEventListener('keydown',onKey,true); if(typeof onClose==='function') onClose(); };   // onClose = 처음 사용법 끝(js/app-mode.js _ndPhoneOnce) → 알림 켜기 안내
  const onKey=e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } };
  document.addEventListener('keydown',onKey,true);
  el.querySelector('.ph-x').onclick=close;
  el.addEventListener('click',e=>{ if(e.target===el) close(); });
  show(tab);
  el.querySelector('.ph-x').focus();
  _gdQr(url,'ph-qr');
}
// id: 시트='gd-qr', PC 앱 팝업='ph-qr'(닫힌 시트에 gd-qr 가 남아 있어도 안 헷갈리게)
async function _gdQr(url,id){
  id=id||'gd-qr';
  const box=document.getElementById(id); if(!box) return;
  try{
    if(typeof qrcode==='undefined') await new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
    const q=qrcode(0,'M'); q.addData(url); q.make();
    if(box.isConnected) box.innerHTML=q.createSvgTag({ cellSize:4, margin:2, scalable:true });
  }catch(e){ if(box.isConnected) box.innerHTML='<span>QR을 만들지 못했어요<br>주소를 복사해 보내 주세요</span>'; }
}
function _gdCopy(b){
  const url=_nbSiteUrl(), done=()=>{ b.textContent='복사했어요'; setTimeout(()=>{ if(b.isConnected) b.textContent='주소 복사'; },2000); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,done);
  else { const t=document.createElement('textarea'); t.value=url; t.style.cssText='position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try{ document.execCommand('copy'); }catch(e){} t.remove(); done(); }
}
