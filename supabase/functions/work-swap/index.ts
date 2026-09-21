import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import {validate,fingerprint,exchange,assignment} from './logic.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,'Content-Type':'application/json'}});
async function notify(ids:string[],id:string,text:string){
 try{
  const key=Deno.env.get('VAPID_PRIVATE');if(!key)return {sent:0};
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:sbs8xr@gmail.com',Deno.env.get('VAPID_PUBLIC')||'BPbuDNOiXuJN5KpRWINHNtAYVlG3Pq6T6KVJ4ABv9PFn9hv8cfMoQXHCWVbLwqvxteVAkxaN4XKX1KOi5lhAMdc',key);
  const {data:subs}=await sb.from('push_subs').select('sub,endpoint').in('staff_id',[...new Set(ids)]);
  let sent=0;await Promise.all((subs||[]).map(async s=>{try{await webpush.sendNotification(s.sub,JSON.stringify({title:'근무 교환',body:text,tag:'swap-'+id,data:{url:'./?swap='+id},icon:'icon-192.png'}));sent++}catch(e){if([404,410].includes(e.statusCode))await sb.from('push_subs').delete().eq('endpoint',s.endpoint)}}));return {sent};
 }catch{return {sent:0}}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const b=await req.json();const actor=String(b.staffId||'');
  const {data:row,error:loadError}=await sb.from('nd_data').select('payload,updated_at').eq('id','main').single();
  if(loadError)throw Error('근무표를 불러오지 못했습니다.');
  const p=row.payload;
  const {data:login}=await sb.from('login_log').select('staff_id,logged_in').eq('device_id',String(b.deviceId||'')).maybeSingle();
  if(!actor||login?.staff_id!==actor||!login.logged_in||!p.staff?.some(s=>s.id===actor&&s.active!==false))return reply({error:'다시 로그인한 후 이용하세요.'},401);
  // Match the existing application's name/device login. Admin writes additionally verify the password on the server.
  const admin=!!b.adminPassword&&[p.adminPass,p.masterPass].filter(Boolean).includes(btoa(b.adminPassword));
  if(b.admin&&!admin)return reply({error:'관리자 비밀번호를 확인해 주세요.'},403);
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),now=new Date().toISOString();
  if(b.action==='list'){
   let q=sb.from('nd_swaps').select('*').order('created_at',{ascending:false}).limit(200);
   if(!admin)q=q.or(`requester.eq.${actor},recipient.eq.${actor}`);
   const {data,error}=await q;if(error)throw error;
   return reply({requests:(data||[]).map(x=>({...x.doc,revision:x.revision})),admin});
  }
  if(b.action==='registerAdmin'){
   if(!admin)throw Error('관리자 확인이 필요합니다.');
   const {error}=await sb.from('nd_swap_admins').upsert({staff_id:actor});if(error)throw error;return reply({ok:true});
  }
  if(b.action==='create'){
   const r:any={id:crypto.randomUUID(),requester:actor,recipient:String(b.recipient||''),from:String(b.from||''),to:String(b.to||''),status:'pending',createdAt:now,updatedAt:now,messages:[],history:[{status:'pending',actor,at:now}]};
   validate(p,r,today);r.snapshot=fingerprint(p,r);
   const {data:pending}=await sb.from('nd_swaps').select('doc').or(`requester.eq.${actor},recipient.eq.${actor}`);
   if((pending||[]).some(x=>['pending','accepted'].includes(x.doc.status)&&[r.from,r.to].some(d=>[x.doc.from,x.doc.to].includes(d))))throw Error('해당 날짜에 진행 중인 교환 신청이 있습니다.');
   if(String(b.text||'').trim())r.messages.push({id:crypto.randomUUID(),actor,text:String(b.text).trim().slice(0,1000),at:now});
   const {error}=await sb.from('nd_swaps').insert({id:r.id,requester:actor,recipient:r.recipient,doc:r});if(error)throw error;
   const push=await notify([r.recipient],r.id,'새 근무 교환 신청이 도착했습니다.');return reply({request:r,push});
  }
  const {data:record}=await sb.from('nd_swaps').select('*').eq('id',b.id).single();
  if(!record)throw Error('신청을 찾을 수 없습니다.');
  const r=record.doc;if(!admin&&![r.requester,r.recipient].includes(actor))return reply({error:'접근 권한이 없습니다.'},403);
  if(Number(b.revision)!==record.revision)throw Error('신청이 변경되었습니다. 다시 확인하세요.');
  let nextPayload=null,recipients=[r.requester,r.recipient].filter(x=>x!==actor),message='근무 교환 상태가 변경되었습니다.';
  if(b.action==='chat'){
   const text=String(b.text||'').trim();if(!text||text.length>1000)throw Error('메시지는 1~1000자로 입력하세요.');
   if((r.messages||[]).length>=300)throw Error('이 신청의 대화 한도에 도달했습니다.');
   (r.messages||=[]).push({id:crypto.randomUUID(),actor,text,at:now});message='근무 교환에 새 메시지가 도착했습니다.';
  }else{
   if(b.action==='accept'&&actor===r.recipient&&r.status==='pending'){validate(p,r,today);if(fingerprint(p,r)!==r.snapshot)throw Error('근무표가 변경되었습니다. 새로 신청해 주세요.');r.status='accepted';const {data:admins}=await sb.from('nd_swap_admins').select('staff_id');recipients=[r.requester,...(admins||[]).map(x=>x.staff_id)];message='상대방이 근무 교환을 수락했습니다. 관리자 승인을 기다립니다.';}
   else if(b.action==='reject'&&actor===r.recipient&&r.status==='pending')r.status='rejected';
   else if(b.action==='cancel'&&actor===r.requester&&['pending','accepted'].includes(r.status))r.status='cancelled';
   else if(b.action==='approve'&&admin&&r.status==='accepted'){nextPayload=exchange(p,r,today);r.status='approved';r.approvedAt=now;r.approvedBy=actor;message='관리자가 근무 교환을 승인했습니다. 근무표에 반영되었습니다.';}
   else if(b.action==='decline'&&admin&&r.status==='accepted')r.status='declined';
   else throw Error('현재 상태에서는 처리할 수 없습니다.');
   (r.history||=[]).push({status:r.status,actor,at:now});
  }
  r.updatedAt=now;
  const {error}=await sb.rpc('nd_swap_commit',{p_id:r.id,p_revision:record.revision,p_doc:r,p_version:nextPayload?row.updated_at:null,p_payload:nextPayload});if(error)throw error;
  const push=await notify(recipients,r.id,message);return reply({request:{...r,revision:record.revision+1},push});
 }catch(e){return reply({error:e.message||'처리 중 오류가 발생했습니다.'},400)}
});
