/* [모듈] js/app-mode.js — 근무표 작성 앱(desktop/ Electron, html.nd-app) 전용 제목줄 | dashboard.html 메인 스크립트 맨 끝. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// 앱은 윈도 기본 제목줄을 숨기고(desktop/main.js titleBarStyle hidden — 최소화·최대화·닫기만 오른쪽 끝에 겹쳐 그림) 이 제목줄(#nd-titlebar)을 씀:
// 왼쪽 앱 이름 · [근무표 작성소] · 관리자 탭(#admin-area .admin-tabs 를 그대로 옮겨 옴 — showAdminTab·탭 숨김 규칙 그대로). 빈 곳을 끌면 창이 움직임.
// 높이는 desktop/main.js TITLEBAR_H(44)와 같게. 색은 테마(밝기)에 맞춰 ndApp.setTitleBar 로 창 버튼 색도 맞춤.
function _ndTitlebarInit(){
  if(!ND_APP||document.getElementById('nd-titlebar')) return;
  const bar=document.createElement('div'); bar.id='nd-titlebar';
  bar.innerHTML='<div class="ndt-brand"><img src="icon-192.png" alt=""><span>근무표 작성</span></div>'
    +'<nav class="ndt-nav" aria-label="앱 메뉴"><button class="ndt-ws" type="button" onclick="showView(\'workshop\')">근무표 작성소</button><span class="ndt-sep" aria-hidden="true"></span></nav>';
  const tabs=document.querySelector('#admin-area .admin-tabs');
  if(tabs){
    bar.querySelector('.ndt-nav').appendChild(tabs);
    // 작성소에서 관리자 탭을 누르면 관리자 화면으로(탭 버튼의 showAdminTab 다음에)
    tabs.addEventListener('click',e=>{ if(e.target.closest('.admin-tab')&&currentView!=='admin') showView('admin'); });
  }
  document.body.prepend(bar);
  _ndTitlebarSync();
  new MutationObserver(_ndTitlebarColors).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  _ndTitlebarColors();
}
// 지금 화면 표시(작성소면 [근무표 작성소]가, 관리자면 그 탭이 켜짐) — showView 끝에서 부름
function _ndTitlebarSync(){
  const bar=document.getElementById('nd-titlebar'); if(bar) bar.classList.toggle('on-ws', currentView==='workshop');
}
// 창 버튼(최소화·최대화·닫기) 바탕·글자색을 제목줄과 같게
function _ndTitlebarColors(){
  const bar=document.getElementById('nd-titlebar'); if(!bar||!window.ndApp?.setTitleBar) return;
  const hex=c=>{ const m=String(c).match(/\d+(\.\d+)?/g)||[]; return '#'+m.slice(0,3).map(n=>Math.round(+n).toString(16).padStart(2,'0')).join(''); };
  const cs=getComputedStyle(bar);
  window.ndApp.setTitleBar({ color:hex(cs.backgroundColor), symbolColor:hex(cs.color) });
}
_ndTitlebarInit();
