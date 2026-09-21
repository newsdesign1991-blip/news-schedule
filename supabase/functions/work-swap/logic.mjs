const arrays=['vw','cg','xr','project','sports'];
const roles=['danjik','ilgeun','satMorning','morningDesk','newsOh','newsOh2','weekday8jin','weekday8jin2','weekend8jin','weekend8jin2'];
const members=(e,k)=>['vw','cg'].includes(k)?e[k]?.workers||[]:e[k]||[];
const department=(s,date)=>[...(s.deptSchedule||[])].filter(h=>h.start&&h.dept&&h.start<=date).sort((a,b)=>b.start.localeCompare(a.start))[0]?.dept||s.dept;
const group=(s,date)=>({VW:'vw',CG:'cg',XR:'xr',PROJECT:'project',SPORTS:'sports'})[department(s,date)];
const plus=(d,n)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
export function assignment(p,id,date){
 const e=p.schedule?.[date],s=p.staff?.find(s=>s.id===id);
 if(!e||!s||s.active===false) return 'unavailable';
 if(s.employmentType==='freelancer'&&((s.contractStart&&date<s.contractStart)||(s.contractEnd&&date>s.contractEnd)))return 'unavailable';
 if(s.employmentType==='employee'&&(s.dispatchStart||s.dispatchEnd)&&(!s.dispatchStart||date>=s.dispatchStart)&&(!s.dispatchEnd||date<=s.dispatchEnd))return 'unavailable';
 if(!group(s,date)) return 'unavailable';
 if((p.leaves?.[id]||[]).includes(date)||(p.newLeaves?.[date]||[]).includes(id))return 'leave';
 if([1,2].some(n=>p.schedule?.[plus(date,-n)]?.danjik===id))return 'duty-rest';
 if(roles.some(k=>e[k]===id)||[e.vw?.desk,e.cg?.desk,e.cg?.desk8,e.cg?.desk5].includes(id))return 'special';
 if(['jogeunEdu','jogeunExtra'].some(k=>(e[k]||[]).includes(id))||Object.values(e.jogeunSubs||{}).includes(id))return 'special';
 const custom=e.customCells?.[id]?.text?.trim();
 if(custom&&custom!=='정근')return 'special';
 if((e.restWorkers||[]).includes(id))return 'off';
 if(custom==='정근'||members(e,group(s,date)).includes(id))return 'regular';
 return arrays.some(k=>members(e,k).includes(id))?'special':'off';
}
export function fingerprint(p,r){return JSON.stringify([p.schedule?.[r.from],p.schedule?.[r.to],p.staff?.filter(s=>[r.requester,r.recipient].includes(s.id)),p.leaves?.[r.requester]||[],p.leaves?.[r.recipient]||[],p.newLeaves?.[r.from]||[],p.newLeaves?.[r.to]||[],[r.from,r.to].map(d=>[1,2].map(n=>p.schedule?.[plus(d,-n)]?.danjik||null))]);}
export function validate(p,r,today){
 if(r.requester===r.recipient)throw Error('본인과 교환할 수 없습니다.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.from)||!/^\d{4}-\d{2}-\d{2}$/.test(r.to)||r.from===r.to||r.from<today||r.to<today)throw Error('오늘 이후의 서로 다른 두 날짜를 선택하세요.');
 if([r.from,r.to].some(d=>!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))throw Error('올바른 날짜를 선택하세요.');
 if(assignment(p,r.requester,r.from)!=='regular'||assignment(p,r.recipient,r.to)!=='regular')throw Error('교환할 두 근무는 정근이어야 합니다. 당직·8진·데스크 등 별도 임무는 교환할 수 없습니다.');
 if(assignment(p,r.recipient,r.from)!=='off'||assignment(p,r.requester,r.to)!=='off')throw Error('대신 근무할 날짜는 휴무여야 합니다. 휴가·당직 퇴근·비번·다른 근무가 있는 날은 교환할 수 없습니다.');
}
export function exchange(p,r,today){
 validate(p,r,today);
 if(fingerprint(p,r)!==r.snapshot)throw Error('신청 이후 근무표가 변경되었습니다. 취소 후 새로 신청해 주세요.');
 const out=structuredClone(p);
 out._swapRevision=(Number(p._swapRevision)||0)+1;
 for(const [d,from,to] of [[r.from,r.requester,r.recipient],[r.to,r.recipient,r.requester]]){
  const e=out.schedule[d];
  const draft=out.draft?.schedule?.[d];
  if(draft&&JSON.stringify(draft)!==JSON.stringify(e))throw Error('해당 날짜에 수정 중인 초안이 있습니다. 관리자가 초안을 먼저 정리해 주세요.');
  for(const k of arrays){if(['vw','cg'].includes(k)){if(e[k]?.workers)e[k].workers=e[k].workers.filter(id=>id!==from&&id!==to)}else if(e[k])e[k]=e[k].filter(id=>id!==from&&id!==to)}
  const target=group(out.staff.find(s=>s.id===to),d);
  if(['vw','cg'].includes(target)){e[target]||={};e[target].workers||=[];e[target].workers.push(to)}else{e[target]||=[];e[target].push(to)}
  if(e.customCells){delete e.customCells[to];if(e.customCells[from]){e.customCells[to]=e.customCells[from];delete e.customCells[from]}}
  if(e.restWorkers)e.restWorkers=e.restWorkers.filter(id=>id!==to);
  if(draft)out.draft.schedule[d]=structuredClone(e);
 }
 return out;
}
