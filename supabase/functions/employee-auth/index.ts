import {createClient} from 'npm:@supabase/supabase-js@2';
const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
async function hash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function account(id:string){
 const {error}=await sb.from('nd_employee_accounts').upsert({staff_id:id},{onConflict:'staff_id',ignoreDuplicates:true});if(error)throw error;
 const q=await sb.from('nd_employee_accounts').select('*').eq('staff_id',id).single();if(q.error)throw q.error;return q.data;
}
async function issue(a:any,person:any){const token=crypto.randomUUID()+crypto.randomUUID();const {error}=await sb.from('nd_employee_sessions').insert({token_hash:await hash(token),staff_id:a.staff_id,version:a.version,expires_at:new Date(Date.now()+30*86400000).toISOString()});if(error)throw error;return {user:{staffId:person.id,name:person.name,authToken:token},mustChange:a.must_change}}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 try{
  const b=await req.json();
  const {data:row,error}=await sb.from('nd_data').select('payload').eq('id','main').single();if(error)throw error;
  const p=row.payload,people=(p.staff||[]).filter((s:any)=>s.active!==false);
  if(b.action==='adminLogin'){
   const mode=b.mode==='master'?'master':'admin',expected=mode==='master'?(p.masterPass||p.adminPass):p.adminPass;
   if(!b.password||btoa(String(b.password))!==expected)return reply({error:'비밀번호가 일치하지 않습니다.'},401);
   const token='admin.'+crypto.randomUUID()+crypto.randomUUID();
   const {error}=await sb.from('nd_admin_sessions').insert({token_hash:await hash(token),mode,credential_hash:await hash(expected),expires_at:new Date(Date.now()+12*3600000).toISOString()});if(error)throw error;
   return reply({user:{staffId:'@'+mode,name:mode==='master'?'마스터':'관리자',adminRole:mode,authToken:token},mustChange:false});
  }
  if(b.action==='login'){
   const matches=people.filter((s:any)=>s.name===String(b.name||'').trim());
   if(matches.length!==1||!/^\d{6}$/.test(String(b.pin||'')))return reply({error:'이름과 숫자 6자리 비밀번호를 확인해 주세요.'},401);
   const person=matches[0],a=await account(person.id);
   if(a.pin!==b.pin)return reply({error:'이름 또는 비밀번호가 일치하지 않습니다.'},401);
   return reply(await issue(a,person));
  }
  const tokenHash=await hash(String(b.token||''));
  let master=false,admin=false;
  if(String(b.token||'').startsWith('admin.')){
   const {data:session}=await sb.from('nd_admin_sessions').select('*').eq('token_hash',tokenHash).maybeSingle();
   if(!session||session.expires_at<new Date().toISOString()||session.credential_hash!==await hash(session.mode==='master'?(p.masterPass||p.adminPass):p.adminPass))return reply({error:'관리자 계정으로 다시 로그인해 주세요.'},401);
   if(b.action==='logout'){await sb.from('nd_admin_sessions').delete().eq('token_hash',tokenHash);return reply({ok:true})}
   if(b.action==='session')return reply({user:{staffId:'@'+session.mode,name:session.mode==='master'?'마스터':'관리자',adminRole:session.mode},mustChange:false});
   master=session.mode==='master';admin=true;
  }else{
  const {data:session}=await sb.from('nd_employee_sessions').select('*').eq('token_hash',tokenHash).maybeSingle();
  if(!session||session.expires_at<new Date().toISOString())return reply({error:'다시 로그인해 주세요.'},401);
  const person=people.find((s:any)=>s.id===session.staff_id),a=await account(session.staff_id);
  if(!person||session.version!==a.version)return reply({error:'비밀번호가 초기화되었거나 변경되었습니다. 다시 로그인해 주세요.'},401);
  if(b.action==='logout'){const {error}=await sb.from('nd_employee_sessions').delete().eq('token_hash',tokenHash);if(error)throw error;return reply({ok:true})}
  if(b.action==='session')return reply({user:{staffId:person.id,name:person.name},mustChange:a.must_change});
  if(b.action==='change'){
   if(!/^\d{6}$/.test(String(b.pin||''))||b.pin==='000000')throw Error('000000을 제외한 숫자 6자리로 설정해 주세요.');
   if(!a.must_change&&b.currentPin!==a.pin)throw Error('현재 비밀번호가 일치하지 않습니다.');
   const {data:version,error}=await sb.rpc('nd_employee_pin_change',{p_staff:person.id,p_version:a.version,p_pin:b.pin,p_reset:false});if(error)throw error;
   return reply(await issue({...a,version,must_change:false},person));
  }
  if(a.must_change)return reply({error:'비밀번호를 먼저 변경해 주세요.'},403);
  const pass=btoa(String(b.adminPassword||''));
  master=b.mode==='master'&&!!b.adminPassword&&pass===(p.masterPass||p.adminPass);admin=master||(b.mode==='admin'&&!!b.adminPassword&&pass===p.adminPass);
  if(!admin)return reply({error:'관리자 또는 마스터 확인이 필요합니다.'},403);
  }
  if(b.action==='accounts'){
   const {data:accounts,error}=await sb.from('nd_employee_accounts').select('staff_id,pin,must_change');if(error)throw error;
   return reply({master,accounts:people.map((s:any)=>{const c=accounts?.find(x=>x.staff_id===s.id);return {staffId:s.id,name:s.name,dept:s.dept,mustChange:c?.must_change??true,...(master?{pin:c?.pin||'000000'}:{})}})});
  }
  if(b.action==='reset'){
   if(!people.some((s:any)=>s.id===b.staffId))throw Error('직원을 찾을 수 없습니다.');
   const target=await account(b.staffId);
   const {error}=await sb.rpc('nd_employee_pin_change',{p_staff:target.staff_id,p_version:target.version,p_pin:'000000',p_reset:true});if(error)throw error;
   return reply({ok:true});
  }
  throw Error('지원하지 않는 요청입니다.');
 }catch(e){return reply({error:e.message||'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},400)}
});
