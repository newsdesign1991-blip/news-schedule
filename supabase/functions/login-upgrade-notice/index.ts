import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const campaign='password-login-20260922';
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  const b=await req.json();
  const {data:row,error}=await sb.from('nd_data').select('payload').eq('id','main').single();if(error)throw error;
  if(!b.adminPassword||btoa(String(b.adminPassword))!==(row.payload.masterPass||row.payload.adminPass))return reply({error:'Master authorization required'},403);
  const key=Deno.env.get('VAPID_PRIVATE');if(!key)throw Error('Missing push configuration');
  const {data:accounts,error:ae}=await sb.from('nd_employee_accounts').select('staff_id,must_change');if(ae)throw ae;
  const {data:subs,error:se}=await sb.from('push_subs').select('staff_id,endpoint,sub');if(se)throw se;
  const completed=new Set(accounts.filter(a=>!a.must_change).map(a=>a.staff_id));
  const active=new Set((row.payload.staff||[]).filter(s=>s.active!==false).map(s=>s.id));
  const seen=new Set();
  const targets=subs.filter(s=>{if(!active.has(s.staff_id)||completed.has(s.staff_id)||seen.has(s.staff_id))return false;seen.add(s.staff_id);return true});
  if(b.preview===true)return reply({eligiblePeople:active.size-completed.size,subscribedTargets:targets.length});
  // Reserve before sending. Retrying the same campaign never broadcasts twice.
  const {error:claim}=await sb.from('nd_login_upgrade_notice').insert({campaign});
  if(claim){if(claim.code==='23505'){const {data}=await sb.from('nd_login_upgrade_notice').select('result').eq('campaign',campaign).single();return reply({alreadySent:true,result:data?.result})}throw claim;}
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:sbs8xr@gmail.com',Deno.env.get('VAPID_PUBLIC')||'BPbuDNOiXuJN5KpRWINHNtAYVlG3Pq6T6KVJ4ABv9PFn9hv8cfMoQXHCWVbLwqvxteVAkxaN4XKX1KOi5lhAMdc',key);
  const payload=JSON.stringify({title:'새 기능 이용을 위해 다시 로그인해 주세요',body:'근무 교환 등 새 기능을 위해 비밀번호 로그인이 적용되었습니다. 앱을 다시 열어 이름과 초기 비밀번호 000000으로 로그인한 뒤 새 비밀번호를 설정해 주세요.',tag:campaign,icon:'icon-192.png',data:{url:'./?login-upgrade=20260922'}});
  let sent=0,failed=0;
  for(const target of targets){try{await webpush.sendNotification(target.sub,payload);sent++}catch(e){failed++;if([404,410].includes(e.statusCode))await sb.from('push_subs').delete().eq('endpoint',target.endpoint)}}
  const result={targets:targets.length,sent,failed,completedAccountsPreserved:completed.size};
  const {error:recordError}=await sb.from('nd_login_upgrade_notice').update({result}).eq('campaign',campaign);if(recordError)return reply({...result,recorded:false});
  return reply(result);
 }catch(e){return reply({error:e.message},500)}
});
