let employeePending=null,employeeBusy=false,employeeAdminPass='',employeeAdminMode='';
const employeeEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function employeeApi(action,extra={}){
 let res;try{res=await fetch(SB_URL+'/functions/v1/employee-auth',{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({action,token:currentUser?.authToken||employeePending?.authToken||'',...extra})});}catch(e){throw new Error(e.message==='Design preview is read-only'?'디자인 시안에서는 로그인할 수 없습니다. 실제 앱에서 로그인해 주세요.':'로그인 서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')}
 const r=await res.json();if(!res.ok){const e=new Error(r.error||'연결하지 못했습니다.');e.status=res.status;throw e}return r;
}
function employeeAdminCredential(mode,password){employeeAdminPass=mode==='test'?'':password;employeeAdminMode=mode==='test'?'':mode}
function employeeClearAdmin(){employeeAdminPass='';employeeAdminMode='';const host=document.getElementById('employee-accounts');if(host)host.replaceChildren()}
function employeeLoginScreen(message=''){
 document.getElementById('employee-loading')?.remove();
 currentUser=null;employeePending=null;localStorage.removeItem(USER_KEY);sessionStorage.removeItem('nd_admin');
 if(typeof adminLogout==='function')adminLogout();
 document.getElementById('employee-change')?.remove();
 const ov=document.getElementById('login-overlay');ov.classList.remove('leaving','bg-leaving');ov.style.display='flex';
 document.getElementById('login-pin-input').value='';document.getElementById('login-name-error').textContent=message;_updateUserHeader();
}
function employeeLegacyNotice(saved){
 const key='nd_login_upgrade_seen_'+(saved.staffId||saved.name||'legacy');
 if(localStorage.getItem(key)){employeeLoginScreen();return}
 document.getElementById('employee-loading')?.remove();
 const el=document.createElement('div');el.className='nd-modal';el.id='employee-upgrade';
 el.innerHTML='<div class="nd-pop employee-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-upgrade-title"><div class="employee-head"><h2 id="employee-upgrade-title">로그인 방식이 변경되었습니다</h2></div><div class="employee-form"><p>근무 교환 등 새로운 기능을 위해 비밀번호 로그인이 적용되었습니다.</p><p>확인을 누르면 기존 로그인이 해제됩니다. 이름과 초기 비밀번호 <b>000000</b>으로 로그인한 뒤, 숫자 6자리 새 비밀번호를 설정해 주세요.</p><button class="btn btn-primary">확인하고 다시 로그인</button></div></div>';
 el.querySelector('button').onclick=()=>{localStorage.setItem(key,'1');el.remove();employeeLoginScreen()};document.body.appendChild(el);el.querySelector('button').focus({preventScroll:true});
}
async function employeeRestore(){
 const saved=currentUser;currentUser=null;document.getElementById('login-overlay').style.display='none';
 if(!saved?.authToken){if(saved)employeeLegacyNotice(saved);else employeeLoginScreen();return}
 try{const r=await employeeApi('session',{token:saved.authToken});const user={...r.user,authToken:saved.authToken};
  document.getElementById('employee-loading')?.remove();
  if(r.mustChange){employeePending=user;localStorage.removeItem(USER_KEY);employeeChangeDialog();return}
  currentUser=user;localStorage.setItem(USER_KEY,JSON.stringify(user));_updateUserHeader();
  if(user.adminRole){_enterAdmin(user.adminRole);showView('admin')}else _recordLogin(false);
 }catch(e){
  if(e.status===401){employeeLoginScreen('비밀번호로 다시 로그인해 주세요.');return}
  // A connection failure must not delete a valid saved login.
  let host=document.getElementById('employee-loading');if(!host){host=document.createElement('div');host.id='employee-loading';document.body.appendChild(host)}
  host.innerHTML='<p>로그인 상태를 확인하지 못했습니다.</p><button class="btn btn-primary">다시 시도</button>';
  host.querySelector('button').onclick=()=>{currentUser=saved;employeeRestore()};
 }
}
function employeeAdminDialog(mode='admin'){
 mode=mode==='master'?'master':'admin';
 document.getElementById('employee-admin-login')?.remove();const el=document.createElement('div');el.id='employee-admin-login';el.className='nd-modal';
 el.innerHTML='<div class="nd-pop employee-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-admin-title"><div class="employee-head"><h2 id="employee-admin-title">관리자 로그인</h2></div><form class="employee-form"><label>비밀번호<input id="employee-admin-pin" type="password" autocomplete="current-password" required></label><p id="employee-admin-login-error" role="status"></p><button class="btn btn-primary" type="submit">로그인</button><button class="btn btn-outline" type="button" onclick="document.getElementById(&quot;employee-admin-login&quot;).remove()">돌아가기</button></form></div>';
 el.querySelector('#employee-admin-title').textContent=mode==='master'?'마스터 로그인':'관리자 로그인';
 el.querySelector('form').onsubmit=async e=>{e.preventDefault();if(employeeBusy)return;employeeBusy=true;try{const r=await employeeApi('adminLogin',{mode,password:document.getElementById('employee-admin-pin').value});currentUser=r.user;localStorage.setItem(USER_KEY,JSON.stringify(currentUser));el.remove();document.getElementById('login-overlay').style.display='none';_updateUserHeader();_enterAdmin(currentUser.adminRole);showView('admin')}catch(err){document.getElementById('employee-admin-login-error').textContent=err.message}finally{employeeBusy=false}};
 document.body.appendChild(el);
}
async function employeeLogin(){
 if(employeeBusy)return;const err=document.getElementById('login-name-error'),name=document.getElementById('login-name-input').value.trim(),pin=document.getElementById('login-pin-input').value;
 if(!name||!/^\d{6}$/.test(pin)){err.textContent='이름과 숫자 6자리 비밀번호를 입력하세요.';return}
 employeeBusy=true;err.textContent='로그인 확인 중…';
 try{const r=await employeeApi('login',{name,pin});document.getElementById('login-pin-input').value='';err.textContent='';if(r.mustChange){employeePending=r.user;currentUser=null;employeeChangeDialog()}else employeeEnter(r.user)}catch(e){err.textContent=e.message}finally{employeeBusy=false}
}
function employeeEnter(user){employeePending=null;currentUser=user;localStorage.setItem(USER_KEY,JSON.stringify(user));document.getElementById('employee-change')?.remove();_updateUserHeader();showView('home');_recordLogin(true);_startLoginSequence(user.name)}
function employeeChangeDialog(){
 document.getElementById('employee-change')?.remove();const el=document.createElement('div');el.id='employee-change';el.className='nd-modal';
 el.innerHTML=`<div class="nd-pop employee-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-change-title"><div class="employee-head"><h2 id="employee-change-title">새 비밀번호 설정</h2><p>처음 로그인했거나 비밀번호가 초기화되었습니다.<br>새 비밀번호를 설정해야 이용할 수 있습니다.</p></div><form class="employee-form" onsubmit="event.preventDefault();employeeChange()"><label>새 비밀번호<input id="employee-new-pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password" required placeholder="숫자 6자리"></label><label>새 비밀번호 확인<input id="employee-confirm-pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password" required placeholder="한 번 더 입력"></label><p class="employee-hint">기본 비밀번호 000000은 사용할 수 없습니다.</p><p id="employee-change-error" role="status"></p><button class="btn btn-primary" type="submit">변경하고 시작하기</button><button class="btn btn-outline" type="button" onclick="employeeCancel()">로그인으로 돌아가기</button></form></div>`;
 el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation()}if(e.key==='Tab'){const items=[...el.querySelectorAll('input,button')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus()}}});
 document.body.appendChild(el);el.querySelector('button').focus({preventScroll:true});
}
async function employeeCancel(){try{await employeeApi('logout')}catch{}employeeLoginScreen()}
async function employeeChange(){
 if(employeeBusy)return;const pin=document.getElementById('employee-new-pin').value,confirm=document.getElementById('employee-confirm-pin').value,err=document.getElementById('employee-change-error');
 if(!/^\d{6}$/.test(pin)||pin==='000000'){err.textContent='000000을 제외한 숫자 6자리로 입력하세요.';return}if(pin!==confirm){err.textContent='두 비밀번호가 일치하지 않습니다.';return}
 employeeBusy=true;try{const r=await employeeApi('change',{pin});employeeEnter(r.user)}catch(e){err.textContent=e.message}finally{employeeBusy=false}
}
async function employeeCheckSession(){if(document.hidden||!currentUser?.authToken||employeeBusy)return;try{const r=await employeeApi('session');if(r.mustChange)employeeLoginScreen('비밀번호를 다시 설정해 주세요.')}catch(e){if(e.status===401)employeeLoginScreen(e.message)}}
async function employeeAccounts(){
 const host=document.getElementById('employee-accounts');if(!host)return;
 if(!isAdmin||isAdminTest){host.textContent='관리자 또는 마스터 계정으로 이용해 주세요.';return}
 if(!employeeAdminPass&&!currentUser?.adminRole){host.innerHTML='<form class="employee-form" onsubmit="event.preventDefault();employeeUnlock()"><label>관리자 확인<input id="employee-admin-password" type="password" autocomplete="current-password" required placeholder="현재 모드의 비밀번호"></label><button class="btn btn-primary">확인</button><p id="employee-admin-error" role="status"></p></form>';return}
 host.textContent='직원 계정을 불러오는 중…';
 try{const r=await employeeApi('accounts',{adminPassword:employeeAdminPass,mode:employeeAdminMode});host.innerHTML=`<p class="employee-hint">${r.master?'마스터 모드에서는 직원 비밀번호를 조회하고 초기화할 수 있습니다.':'관리자 모드에서는 직원 비밀번호를 초기화할 수 있습니다.'}</p><div class="employee-account-list">${r.accounts.map(a=>`<div class="employee-account" data-password-ready="${a.mustChange===false}"><div><b>${employeeEsc(a.name)}</b><span>${employeeEsc(a.dept)} · ${a.mustChange?'변경 필요':'설정 완료'}</span>${r.master?`<details><summary>비밀번호 보기</summary><output>${employeeEsc(a.pin)}</output></details>`:''}</div><button class="btn btn-outline" data-reset-id="${employeeEsc(a.staffId)}">초기화</button></div>`).join('')}</div>`;host.querySelectorAll('[data-reset-id]').forEach(button=>button.onclick=()=>employeeReset(button.dataset.resetId,r.accounts.find(a=>a.staffId===button.dataset.resetId)?.name))}
 catch(e){employeeClearAdmin();host.textContent=e.message;const retry=document.createElement('button');retry.className='btn';retry.textContent='다시 확인';retry.onclick=employeeAccounts;host.appendChild(retry)}
}
function employeeUnlock(){employeeAdminCredential(isMaster?'master':'admin',document.getElementById('employee-admin-password').value);employeeAccounts()}
async function employeeReset(id,name){
 if(employeeBusy||!confirm(name+'님의 비밀번호를 000000으로 초기화할까요? 기존 로그인은 해제되고, 다음 로그인 시 새 비밀번호를 설정해야 합니다.'))return;
 employeeBusy=true;try{await employeeApi('reset',{staffId:id,adminPassword:employeeAdminPass,mode:employeeAdminMode});if(id===currentUser?.staffId)employeeLoginScreen('비밀번호가 000000으로 초기화되었습니다.');else{toast('초기화했습니다. 다음 로그인 시 변경해야 합니다.','success');await employeeAccounts()}}catch(e){toast(e.message,'error')}finally{employeeBusy=false}
}
setInterval(employeeCheckSession,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)employeeCheckSession()});
