/* [모듈] js/onboard.js — 처음 로그인했을 때 '알림 켜기' 안내 + '휴대폰·앱으로 쓰기' 안내 화면 | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것)
   알림 켜기(10-20 요청): 이름으로 로그인한 뒤, 이 기기에서 알림이 꺼져 있으면 한 번(나중에 = 7일 뒤 다시). 켜기는 js/admin.js togglePush(웹 푸시·PC 앱 우편함 공통).
     아이폰 사파리(홈 화면 앱 아님)·삼성 인터넷처럼 알림을 못 받는 곳이면 켜기 대신 [방법 보기] → ndAppGuide. 근무표 PC 앱은 처음 사용법(ndAppTour)이 끝난 뒤.
   휴대폰·앱으로 쓰기(ndAppGuide): QR·주소 복사 / 아이폰 / 안드로이드 / PC — 지금 기기 칸이 먼저 펼쳐짐. 들어가는 곳 = 상단 이름 메뉴, PC 앱 렌치 메뉴, 알림 안내의 [방법 보기] */
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
  if(document.getElementById('nb-pop')||document.getElementById('tour-ov')||document.getElementById('apx-pop')) return;   // 다른 안내가 떠 있으면 다음에
  if(typeof ND_APP!=='undefined'&&ND_APP&&!force){ try{ if(!localStorage.getItem('nd_app_tour_v1')) return; }catch(e){} }   // 앱: 사용법 먼저
  if(!force){ try{ const v=JSON.parse(localStorage.getItem(_nbKey())||'null'); if(v&&(v.off||Date.now()<(v.until||0))) return; }catch(e){} }
  let on=false; try{ on=typeof isPushSubscribed==='function'&&await isPushSubscribed(); }catch(e){}
  if(on) return;
  const dev=_nbDevice(), standalone=typeof _isStandalone==='function'&&_isStandalone();
  const needGuide=(dev==='ios'&&!standalone)||dev==='samsung'||(typeof _pushSupported==='function'&&!_pushSupported());
  const lead=needGuide
    ?(dev==='ios'?'아이폰은 <b>홈 화면에 추가한 근무표</b>에서만 알림을 받을 수 있어요. 방법을 보고 추가한 뒤, 거기서 알림을 켜 주세요.'
      :dev==='samsung'?'삼성 인터넷에서는 알림이 안 돼요. <b>크롬(Chrome)</b>으로 열어 홈 화면에 추가한 뒤 알림을 켜 주세요.'
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
      <p class="wt-status" id="nb-status" role="status"></p>
    </div>
    <div class="wt-foot"><button type="button" class="wt-cancel nb-later">나중에</button><button type="button" class="wt-go nb-go">${needGuide?'방법 보기':'알림 켜기'}</button></div>
  </div>`;
  document.body.appendChild(el);
  const close=()=>el.remove();
  el.querySelector('.nb-later').onclick=()=>{ try{ localStorage.setItem(_nbKey(),JSON.stringify({ until:Date.now()+7*864e5 })); }catch(e){} close(); };
  el.addEventListener('click',e=>{ if(e.target===el) el.querySelector('.nb-later').click(); });
  const go=el.querySelector('.nb-go'), st=el.querySelector('#nb-status');
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
function ndAppGuide(){
  if(typeof closeHdrMenu==='function') closeHdrMenu();
  document.getElementById('ndt-pop')?.remove();
  const dev=_nbDevice(), url=_nbSiteUrl(), esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const sec=(k,title,sub,body)=>`<details class="gd-sec" ${k===dev||(k==='android'&&dev==='samsung')?'open':''}><summary><b>${title}</b><small>${sub}</small></summary><div class="gd-body">${body}</div></details>`;
  const steps=a=>'<ol class="gd-steps">'+a.map(t=>`<li>${t}</li>`).join('')+'</ol>';
  const share='<svg class="gd-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';
  const html=`<div class="gd">
    <div class="gd-qr-row">
      <div class="gd-qr" id="gd-qr" aria-label="근무표 주소 QR 코드"><span>QR 만드는 중…</span></div>
      <div class="gd-url"><b>휴대폰 카메라로 찍으면 열려요</b><code>${esc(url)}</code><button type="button" class="gd-copy" onclick="_gdCopy(this)">주소 복사</button></div>
    </div>
    ${sec('ios','아이폰 · 아이패드','사파리에서 홈 화면에 추가',steps(['<b>사파리(Safari)</b>로 위 주소를 열어요','아래 가운데 '+share+' <b>공유</b> 버튼을 눌러요','<b>홈 화면에 추가</b> → <b>추가</b>','홈 화면의 <b>근무표</b>로 열고, 이름으로 로그인 → <b>알림 켜기</b>'])+'<p class="gd-note">아이폰은 홈 화면에 추가한 근무표에서만 알림을 받을 수 있어요.</p>')}
    ${sec('android','안드로이드','크롬에서 앱 설치',steps(['<b>크롬(Chrome)</b>으로 위 주소를 열어요 — 삼성 인터넷은 알림이 안 돼요','오른쪽 위 <b>⋮</b> 메뉴 → <b>홈 화면에 추가</b>(또는 <b>앱 설치</b>)','홈 화면의 <b>근무표</b>로 열고 <b>알림 켜기</b>'])+(typeof _deferredInstall!=='undefined'&&_deferredInstall?'<button type="button" class="gd-install" onclick="closeSheet();installA2HS()">이 폰에 바로 설치</button>':''))}
    ${sec('pc','회사 PC','근무표 앱으로',dev==='app'?'<p class="gd-note">지금 근무표 PC 앱으로 쓰고 있어요. 업데이트는 오른쪽 위 렌치에서 해요.</p>':steps(['PC에서는 웹 대신 <b>근무표 PC 앱</b>을 써요','PC 브라우저로 위 주소를 열면 나오는 <b>설치 도우미 받기</b>를 눌러요','받은 파일을 실행 → 바탕화면의 <b>근무표</b>로 열어요']))}
  </div>`;
  openSheet('휴대폰·앱으로 쓰기', html);
  _gdQr(url);
}
async function _gdQr(url){
  const box=document.getElementById('gd-qr'); if(!box) return;
  try{
    if(typeof qrcode==='undefined') await new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
    const q=qrcode(0,'M'); q.addData(url); q.make();
    if(document.getElementById('gd-qr')) box.innerHTML=q.createSvgTag({ cellSize:4, margin:2, scalable:true });
  }catch(e){ if(document.getElementById('gd-qr')) box.innerHTML='<span>QR을 만들지 못했어요<br>주소를 복사해 보내 주세요</span>'; }
}
function _gdCopy(b){
  const url=_nbSiteUrl(), done=()=>{ b.textContent='복사했어요'; setTimeout(()=>{ if(b.isConnected) b.textContent='주소 복사'; },2000); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,done);
  else { const t=document.createElement('textarea'); t.value=url; t.style.cssText='position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try{ document.execCommand('copy'); }catch(e){} t.remove(); done(); }
}
