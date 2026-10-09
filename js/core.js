/* [모듈] js/core.js — 기본 직원·데이터 로드/저장·로컬 백업·공용 유틸·작성소 상태·배포기간 삭제·특정일 적정인원·근무표 기간 저장 | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */

// ===== DEFAULT STAFF =====
const DEFAULT_STAFF = [
  // VW — deskPriority: 1=주데스크, 2=대체1, 3=대체2, null=불가
  {id:'vw01',name:'김원일',dept:'VW',deskPriority:1,canDanjik:false,class:'S',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw02',name:'손승필',dept:'VW',deskPriority:2,canDanjik:true,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw03',name:'류상수',dept:'VW',deskPriority:3,canDanjik:true,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw04',name:'이재준',dept:'VW',deskPriority:null,canDanjik:true,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw05',name:'홍한기',dept:'VW',deskPriority:null,canDanjik:false,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw06',name:'박정권',dept:'VW',deskPriority:null,canDanjik:true,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw07',name:'김나미',dept:'VW',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw08',name:'방민주',dept:'VW',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw09',name:'박혜진',dept:'VW',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw10',name:'심수현',dept:'VW',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'vw11',name:'이소정',dept:'VW',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  // CG
  {id:'cg01',name:'홍성용',dept:'CG',deskPriority:1,canDanjik:false,class:'S',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg02',name:'손호석',dept:'CG',deskPriority:2,canDanjik:true,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg03',name:'정회윤',dept:'CG',deskPriority:3,canDanjik:false,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg04',name:'장성범',dept:'CG',deskPriority:null,canDanjik:true,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg05',name:'서현중',dept:'CG',deskPriority:null,canDanjik:true,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg06',name:'강윤정',dept:'CG',deskPriority:null,canDanjik:true,class:'A',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg07',name:'이종정',dept:'CG',deskPriority:null,canDanjik:true,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg08',name:'한흥수',dept:'CG',deskPriority:null,canDanjik:true,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg09',name:'제갈찬',dept:'CG',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg10',name:'이준호',dept:'CG',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg11',name:'최하늘',dept:'CG',deskPriority:null,canDanjik:true,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg12',name:'홍지월',dept:'CG',deskPriority:null,canDanjik:true,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg13',name:'전유근',dept:'CG',deskPriority:null,canDanjik:true,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg14',name:'최재영',dept:'CG',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg15',name:'임찬혁',dept:'CG',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg16',name:'서승현',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg17',name:'조수인',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg18',name:'장예은',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg19',name:'박태영',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg20',name:'석진선',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg21',name:'이연준',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg22',name:'김예지',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg23',name:'이예솔',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  {id:'cg24',name:'황세연',dept:'CG',deskPriority:null,canDanjik:false,class:'C',active:true,availableDays:[],employmentType:'employee',morningDeskPriority:null},
  // SPORTS
  {id:'sp01',name:'최진회',dept:'SPORTS',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[1,2,3,4,5],employmentType:'employee',morningDeskPriority:null},
  {id:'sp02',name:'한송연',dept:'SPORTS',deskPriority:null,canDanjik:false,class:'B',active:true,availableDays:[1,2,3,4,5],employmentType:'employee',morningDeskPriority:null},
];

// ===== DATA =====
const STORE_KEY = 'nd_v3';
function loadData() {
  try {
    const r = localStorage.getItem(STORE_KEY);
    if (r) {
      const d = JSON.parse(r);
      if (!d.leaves) d.leaves = {};
      if (!d.events) d.events = {};
      if (!d.holidays) d.holidays = {};
      if (!d.settings) d.settings = {};
      if (!d.newLeaves) d.newLeaves = {};
      if (!d.leaveReq) d.leaveReq = {isOpen:false, rangeStart:'', rangeEnd:'', entries:{}};
      if (!d.draft) d.draft = {schedule:{}, newLeaves:{}, rangeStart:'', rangeEnd:''};
      if (d.settings.holidayApiKey === undefined) d.settings.holidayApiKey = '';
      if (d.staff) d.staff.forEach(s => {
        s.employmentType = s.employmentType || 'employee';
        if (s.morningDeskPriority === undefined) s.morningDeskPriority = null;
        if (s.canSatMorning === undefined) s.canSatMorning = false;
        if (s.canIlgeun === undefined) s.canIlgeun = false;
        if (s.canVW === undefined) s.canVW = false;
        if (s.canCG === undefined) s.canCG = false;
        if (s.can3D === undefined) s.can3D = false;
        if (s.availableDays === undefined) s.availableDays = [];
        if (s.deskPriority === undefined) {
          s.deskPriority = s.canDesk ? 1 : null;
        }
      });
      if (!d.deployLog) d.deployLog = [];
      // 기존 cg.desk → cg.desk8 마이그레이션
      Object.values(d.schedule||{}).forEach(entry => {
        if (entry.cg) {
          if (entry.cg.desk !== undefined && entry.cg.desk8 === undefined) {
            entry.cg.desk8 = entry.cg.desk;
            delete entry.cg.desk;
          }
          if (entry.cg.desk5 === undefined) entry.cg.desk5 = null;
        }
      });
      return d;
    }
  } catch(e) {}
  return {
    staff: DEFAULT_STAFF,
    schedule: {},
    leaves: {},
    events: {},
    holidays: {},
    newLeaves: {},
    adminPass: btoa('0000'),
    settings: { weekdayVW:7, weekdayCG:19, weekendVW:4, satVW:4, sunVW:4, weekendCG:10, satCG:6, sunCG:7, wdDailyCap:22, satDailyCap:11, sunDailyCap:11, dailyCap:22, holidayApiKey:'' }
  };
}
function openPath(path) {
  const uri = 'file:///' + path.replace(/\\/g,'\\');
  const a = document.createElement('a');
  a.href = 'file:///' + path.replace(/\\/g,'/');
  a.target = '_blank';
  a.click();
}
const SB_URL = 'https://ntpoaqnhnwrpenstqhwb.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50cG9hcW5obndycGVuc3RxaHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNzEyMzQsImV4cCI6MjA5Nzg0NzIzNH0.MyX2v56Q8SFqcU56tQfmZZVVr1R-X6BF4iBJautOANs';
const SB_HEADERS = { 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };

let _ndUpdatedAt = null;   // 마지막으로 확인한 서버 수정시각 (자동 동기화 기준)
function saveData(d) {
  if (isAdminTest) {   // 관리자 테스트 모드: 저장(영구 반영) 차단 — 토스트는 3초에 한 번만
    const now = Date.now();
    if (!window._lastTestToast || now - window._lastTestToast > 3000) { window._lastTestToast = now; toast('관리자 테스트 모드 — 수정 사항이 저장되지 않습니다.','error'); }
    return;
  }
  data = d;
  localStorage.setItem(STORE_KEY, JSON.stringify(d));
  _localBackup(d);
  return ndQueueSave(d);
}

// ===== 로컬 자동 백업 (서버 미사용 · 데이터 유실 대비) =====
// 매일 1개씩(당일 키에 최신본 덮어쓰기) 이 기기 localStorage에 최근 7일치 보관.
// 자동동기화는 'nd_v3'만 덮어쓰므로 'nd_backup_*'는 사고에도 살아남는다.
function _bkToday(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function _bkKeys(){ return Object.keys(localStorage).filter(k=>/^nd_backup_\d{4}-\d{2}-\d{2}$/.test(k)).sort(); }
function _localBackup(d){
  try {
    if (typeof _looksEmptyData==='function' && _looksEmptyData(d)) return;   // 빈/기본 데이터는 백업 안 함
    localStorage.setItem('nd_backup_'+_bkToday(), JSON.stringify(d));
    const keys=_bkKeys(); while (keys.length>7) localStorage.removeItem(keys.shift());   // 최근 7일만
  } catch(e){
    try { const keys=_bkKeys(); if(keys.length){ localStorage.removeItem(keys[0]); localStorage.setItem('nd_backup_'+_bkToday(), JSON.stringify(d)); } } catch(_){}
  }
}
function listLocalBackups(){
  return _bkKeys().reverse().map(k=>{ let days='?'; try{ days=Object.keys((JSON.parse(localStorage.getItem(k)).schedule)||{}).length; }catch(_){} return {key:k, date:k.replace('nd_backup_',''), days}; });
}
function exportBackup(){
  try {
    const blob=new Blob([JSON.stringify(data)], {type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`근무표백업_${_bkToday()}.json`; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    toast('백업 파일을 내려받았습니다 💾','success');
  } catch(e){ toast('내보내기 실패: '+e.message,'error'); }
}
function restoreLocalBackup(key){
  try {
    const raw=localStorage.getItem(key); if(!raw){ toast('백업을 찾을 수 없습니다.','error'); return; }
    const o=JSON.parse(raw); const days=Object.keys(o.schedule||{}).length;
    if(!confirm(`${key.replace('nd_backup_','')} 백업(근무표 ${days}일)으로 되돌립니다.\n현재 데이터를 덮어쓰고 모든 기기에 반영됩니다. 계속할까요?`)) return;
    saveData(_migrateRemote(o)); _rerenderActiveView(); renderAdminPanel(); _renderBackupList();
    toast('백업에서 복원했습니다.','success');
  } catch(e){ toast('복원 실패: '+e.message,'error'); }
}
function importBackupFile(input){
  const f=input.files&&input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try {
      const o=JSON.parse(r.result);
      if(!o.staff||!o.schedule){ toast('올바른 백업 파일이 아닙니다.','error'); return; }
      const days=Object.keys(o.schedule||{}).length;
      if(!confirm(`가져온 파일(근무표 ${days}일)로 되돌립니다.\n현재 데이터를 덮어쓰고 모든 기기에 반영됩니다. 계속할까요?`)) return;
      saveData(_migrateRemote(o)); _rerenderActiveView(); renderAdminPanel(); _renderBackupList();
      toast('파일에서 복원했습니다.','success');
    } catch(e){ toast('가져오기 실패: '+e.message,'error'); } finally { input.value=''; }
  };
  r.readAsText(f);
}
function _renderBackupList(){
  const box=document.getElementById('local-backup-list'); if(!box) return;
  const list=listLocalBackups();
  box.innerHTML = list.length
    ? '<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">이 기기에 저장된 백업 (최근 7일):</div>'+list.map(b=>`<div style="display:flex;align-items:center;gap:10px;padding:4px 0;"><span style="font-family:ui-monospace,monospace;">${b.date}</span><span style="color:var(--muted);font-size:12px;">근무표 ${b.days}일</span><button class="btn btn-sm btn-outline" style="width:auto;padding:2px 10px;margin-left:auto;" onclick="restoreLocalBackup('${b.key}')">이 백업으로 복원</button></div>`).join('')
    : '<div style="font-size:12px;color:var(--muted);">아직 저장된 백업이 없습니다. (정상 데이터로 앱을 열면 오늘자 백업이 자동 생성됩니다.)</div>';
}

let data = loadData();

// 부서 이동(effective-dated): ds 시점의 부서. deptSchedule=[{start:'YYYY-MM-DD',dept}] 중 start<=ds 최신, 없으면 s.dept(기준부서).
function deptOn(s, ds) {
  if (!s) return undefined;
  const hist = s.deptSchedule;
  if (ds && Array.isArray(hist) && hist.length) {
    let best = null;
    for (const h of hist) { if (h && h.start && h.dept && h.start <= ds && (!best || h.start > best.start)) best = h; }
    if (best) return best.dept;
  }
  return s.dept;
}
function getStaff(dept, ds) {
  const active = data.staff.filter(s => s.active !== false);
  return dept ? active.filter(s => deptOn(s, ds) === dept) : active;
}
function staffById(id) { return data.staff.find(s => s.id === id); }
function toDateStr(y,m,d) { return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function parseDateStr(s) { const [y,m,d] = s.split('-').map(Number); return { y, m, d, date: new Date(y,m-1,d) }; }
function addDays(dateStr, n) {
  const { y, m, d } = parseDateStr(dateStr);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + n);
  return toDateStr(dt.getFullYear(), dt.getMonth()+1, dt.getDate());
}
function getWeekKey(dateStr) {
  const { y, m, d } = parseDateStr(dateStr);
  const dt = new Date(y, m-1, d);
  const dow = dt.getDay();
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - (dow === 0 ? 6 : dow - 1));
  return toDateStr(monday.getFullYear(), monday.getMonth()+1, monday.getDate());
}

// 당직 helpers: given a date, find who is doing 당직퇴근 (started 당직 yesterday) and 당직비번 (started 당직 2 days ago)
function getDanjikExitStaff(dateStr, extraSched) {
  const current=extraSched?.[dateStr]||data.schedule[dateStr];
  if(current?.importedCells){
    const leaves=extraSched?data.draft?.newLeaves?.[dateStr]:data.newLeaves?.[dateStr];
    const ids=Object.keys(current.importedCells);
    const exit=ids.find(id=>/^(퇴근|당직퇴근)$/.test(_importCellDisplay(current,id,leaves)?.text||''));
    if(exit)return exit;
    const previous=extraSched?.[addDays(dateStr,-1)]?.danjik||data.schedule[addDays(dateStr,-1)]?.danjik;
    if(previous&&_importCellDisplay(current,previous,leaves))return null;
  }
  const prev = addDays(dateStr, -1);
  return extraSched?.[prev]?.danjik || data.schedule[prev]?.danjik || null;
}
function getDanjikOffStaff(dateStr, extraSched) {
  const current=extraSched?.[dateStr]||data.schedule[dateStr];
  if(current?.importedCells){
    const leaves=extraSched?data.draft?.newLeaves?.[dateStr]:data.newLeaves?.[dateStr];
    const off=Object.keys(current.importedCells).find(id=>/^(비번|당직비번)$/.test(_importCellDisplay(current,id,leaves)?.text||''));
    if(off)return off;
    const previous=extraSched?.[addDays(dateStr,-2)]?.danjik||data.schedule[addDays(dateStr,-2)]?.danjik;
    if(previous&&_importCellDisplay(current,previous,leaves))return null;
  }
  const prev2 = addDays(dateStr, -2);
  return extraSched?.[prev2]?.danjik || data.schedule[prev2]?.danjik || null;
}

function isOnLeave(staffId, dateStr) {
  return (data.leaves[staffId] || []).includes(dateStr) ||
         (data.newLeaves?.[dateStr] || []).includes(staffId) ||
         (data.draft?.newLeaves?.[dateStr] || []).includes(staffId);
}
function isContractActive(s, dateStr) {
  if (s.employmentType !== 'freelancer') return true;
  if (!s.contractStart && !s.contractEnd) return true;
  if (s.contractStart && dateStr < s.contractStart) return false;
  if (s.contractEnd   && dateStr > s.contractEnd)   return false;
  return true;
}
// 프리랜서가 해당 기간(날짜 배열) 중 하루라도 계약이 유효한지 — 계약 만료된 프리랜서는 다음 달 근무표 컬럼에서 제외
function _freelancerActiveInRange(s, dateList) {
  if (s.employmentType !== 'freelancer') return true;
  if (!s.contractStart && !s.contractEnd) return true;
  return (dateList||[]).some(dt => isContractActive(s, toDateStr(dt.getFullYear(), dt.getMonth()+1, dt.getDate())));
}
function isDispatched(s, dateStr) {
  if (!s || s.employmentType !== 'employee') return false;
  if (!s.dispatchStart && !s.dispatchEnd) return false;
  if (s.dispatchStart && dateStr < s.dispatchStart) return false;
  if (s.dispatchEnd   && dateStr > s.dispatchEnd)   return false;
  return true;
}
// 수습기간: probationStart~End 사이면 true (주말/휴일 근무·인원 카운트 제외)
function isProbation(s, dateStr) {
  if (!s) return false;
  if (!s.probationStart && !s.probationEnd) return false;
  if (s.probationStart && dateStr < s.probationStart) return false;
  if (s.probationEnd   && dateStr > s.probationEnd)   return false;
  return true;
}

// 그날을 '평일 틀'로 짜는지 — 평일이면서 공휴일이 아니거나, 공휴일이라도 8뉴스가 평일과 같은 50분 편성인 날.
// 공휴일 기본값: 설·추석(이름에 '설'·'추석')은 주말 편성, 그 밖의 평일 공휴일은 평일 편성(사람 근무표 3/2·5/5·5/25·7/17·8/17·10/5·10/9 모두 평일 틀).
// 특정일 설정 news:'weekday'|'weekend'로 날마다 직접 정할 수 있음.
// 평일 틀 = 평일 인원·데스크 3개(VW데·8데스·5데스=8뉴스 2번 데스크)·조근·평일 8진. 설·추석처럼 주말 편성인 공휴일은 주말 틀(조근조 쉼, 일근·주말 8진).
// 근무 생성(js/generation.js)·표 표시(js/table-view.js, js/workshop.js)·점검이 모두 이 기준을 씀
function isWeekdayForm(dateStr) {
  const dow = new Date(dateStr+'T00:00:00').getDay();
  if (dow===0 || dow===6) return false;
  const hn = data.holidays && data.holidays[dateStr];
  if (!hn) return true;
  const news = (((data.settings||{}).specialDays||{})[dateStr]||{}).news;
  if (news === 'weekday') return true;
  if (news === 'weekend') return false;
  return !/설|추석/.test(String(hn));
}

// ===== STATE =====
let currentView = 'home';
let leaveReqUserId = localStorage.getItem('nd_lr_user') || '';
let wsRangeStart = null, wsRangeEnd = null;
let _draftCellMode = false;
let _wsHistory = []; // 뒤로가기 히스토리 (최대 30단계)
function _pushWsHistory() {
  _wsHistory.push(JSON.stringify(data.draft||{}));
  if (_wsHistory.length > 30) _wsHistory.shift();
  _updateUndoBtn();
}
function _updateUndoBtn() {
  const btn = document.getElementById('ws-undo-btn');
  if (!btn) return;
  const n = _wsHistory.length;
  if (n > 0) {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    btn.style.background = '#dfe4f2';
    btn.style.color = '#3b4db0';
    btn.title = `${n}단계 뒤로가기 가능`;
  } else {
    btn.style.opacity = '0.45';
    btn.style.pointerEvents = 'none';
    btn.style.background = '#eef1f9';
    btn.style.color = '#5d6fb0';
    btn.title = '뒤로가기 없음';
  }
  const cnt = document.getElementById('ws-undo-count');
  if (cnt) cnt.textContent = n > 0 ? `${n}단계 저장됨` : '';
}
function undoWorkshop() {
  if (!_wsHistory.length) return;
  const prev = _wsHistory.pop();
  data.draft = JSON.parse(prev);
  _updateUndoBtn();
  saveData(data);
  renderWorkshopTable();
  toast('뒤로 되돌렸습니다', 'success');
}
function resetDraftSchedule() {
  const lbl = document.getElementById('reset-range-label');
  const rb = document.getElementById('reset-range-btn');
  const hasRange = !!(wsRangeStart && wsRangeEnd);
  if (lbl) lbl.textContent = hasRange ? `${wsRangeStart} ~ ${wsRangeEnd}` : '기간 미설정';
  if (rb) rb.style.display = hasRange ? '' : 'none';
  const cs=document.getElementById('reset-custom-start'), ce=document.getElementById('reset-custom-end');
  if (cs && hasRange) cs.value = wsRangeStart;
  if (ce && hasRange) ce.value = wsRangeEnd;
  document.getElementById('reset-draft-modal').style.display = 'flex';
}
function _closeResetModal() { const m=document.getElementById('reset-draft-modal'); if(m) m.style.display='none'; }
function _resetDraftDates(startStr, endStr) {
  if (!startStr || !endStr) { toast('기간을 입력하세요.','error'); return false; }
  if (new Date(startStr+'T00:00:00') > new Date(endStr+'T00:00:00')) { toast('종료일이 시작일보다 앞섭니다.','error'); return false; }
  _pushWsHistory();
  const cur = new Date(startStr+'T00:00:00'), end = new Date(endStr+'T00:00:00');
  while (cur <= end) {
    const ds = toDateStr(cur.getFullYear(), cur.getMonth()+1, cur.getDate());
    if (data.draft?.schedule) delete data.draft.schedule[ds];
    if (data.draft?.newLeaves) delete data.draft.newLeaves[ds];
    cur.setDate(cur.getDate()+1);
  }
  saveData(data);
  renderWorkshopTable();
  return true;
}
function _resetDraftRange() {
  if (!wsRangeStart || !wsRangeEnd) { toast('기간이 설정되지 않았습니다.','error'); return; }
  if (_resetDraftDates(wsRangeStart, wsRangeEnd)) { _closeResetModal(); toast(`현재 기간(${wsRangeStart} ~ ${wsRangeEnd}) 초기화 완료`, 'success'); }
}
function _resetDraftCustom() {
  const s = document.getElementById('reset-custom-start')?.value;
  const e = document.getElementById('reset-custom-end')?.value;
  if (_resetDraftDates(s, e)) { _closeResetModal(); toast(`${s} ~ ${e} 초기화 완료`, 'success'); }
}
function _resetDraftAll() {
  _pushWsHistory();
  data.draft = {schedule:{}, newLeaves:{}};
  saveData(data);
  renderWorkshopTable();
  _closeResetModal();
  toast('작성소 전체 초기화 완료', 'success');
}
// ===== #4 배포된 근무표 기간 삭제 (근무표 탭, 관리자만) =====
function openDeletePublished(){
  if(!isAdmin){ toast('관리자만 가능합니다.','error'); return; }
  const ms=document.getElementById('del-pub-start'), me=document.getElementById('del-pub-end');
  if(ms) ms.value=tableRangeStart||'';
  if(me) me.value=tableRangeEnd||'';
  document.getElementById('del-pub-modal').style.display='flex';
}
function closeDeletePublished(){ const m=document.getElementById('del-pub-modal'); if(m) m.style.display='none'; }
function confirmDeletePublished(){
  if(!isAdmin){ toast('관리자만 가능합니다.','error'); return; }
  const sVal=document.getElementById('del-pub-start').value, eVal=document.getElementById('del-pub-end').value;
  if(!sVal||!eVal){ toast('기간을 입력하세요.','error'); return; }
  if(new Date(sVal+'T00:00:00')>new Date(eVal+'T00:00:00')){ toast('종료일이 시작일보다 앞섭니다.','error'); return; }
  let cnt=0;
  const cur=new Date(sVal+'T00:00:00'), end=new Date(eVal+'T00:00:00');
  while(cur<=end){
    const ds=toDateStr(cur.getFullYear(),cur.getMonth()+1,cur.getDate());
    if(data.schedule && data.schedule[ds]!==undefined){ delete data.schedule[ds]; cnt++; }
    cur.setDate(cur.getDate()+1);
  }
  saveData(data);
  closeDeletePublished();
  renderTable();
  toast(cnt?(sVal+' ~ '+eVal+' 배포 근무표 '+cnt+'일 삭제됨'):'해당 기간에 삭제할 배포 근무표가 없습니다.', cnt?'success':'error');
}
// ===== 특정일 적정 인원 =====
function openSpecialDayModal() {
  ['sp-date','sp-vw','sp-cg','sp-cap'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  { const pr=document.getElementById('sp-deskpair'); if(pr) pr.checked=false; }
  { const nw=document.getElementById('sp-news'); if(nw) nw.value=''; }
  // 넓은 화면: 날짜는 달력(js/nd-cal.js), 등록된 특정일엔 점 표시. 값은 #sp-date에 그대로(모바일은 그 날짜칸)
  if (typeof ndDateInput === 'function') ndDateInput(document.getElementById('sp-date'), document.getElementById('sp-date-cal'), { mark: ds => !!((data.settings.specialDays||{})[ds]), markLabel: '등록된 특정일' });
  _renderSpecialDayList();
  document.getElementById('special-day-modal').style.display = 'flex';
}
// 날짜칸 값이 코드로 바뀐 뒤(수정 버튼·저장 후 비움·목록 변경) 달력을 따라가게
function _spCalSync() { const h=document.getElementById('sp-date-cal'); if(h && h._ndCal) h._ndCal.sync(); }
function closeSpecialDayModal() { const m=document.getElementById('special-day-modal'); if(m) m.style.display='none'; }
function saveSpecialDay() {
  const ds = document.getElementById('sp-date').value;
  const vw = parseInt(document.getElementById('sp-vw').value);
  const cg = parseInt(document.getElementById('sp-cg').value);
  const cap = parseInt(document.getElementById('sp-cap').value);
  const pair = !!document.getElementById('sp-deskpair')?.checked;   // 'CG 데스크 2명'(작성소 날짜칸 팝업과 같은 값) — 예전엔 여기서 저장하면 사라졌음
  const news = document.getElementById('sp-news')?.value || '';    // 공휴일 8뉴스 편성: ''(자동: 설·추석=주말, 그 밖=평일) | 'weekday'(50분 평일 편성) | 'weekend'
  if (!ds) { toast('날짜를 선택하세요.','error'); return; }
  if (isNaN(vw) && isNaN(cg) && isNaN(cap) && !pair && !news) { toast('VW·CG·최대 인원, CG 데스크 2명, 8뉴스 편성 중 하나는 정하세요.','error'); return; }
  if (!data.settings.specialDays) data.settings.specialDays = {};
  const o = {};
  if (!isNaN(vw)) o.vw = vw;
  if (!isNaN(cg)) o.cg = cg;
  if (!isNaN(cap)) o.cap = cap;
  if (pair) o.deskPair = true;
  if (news==='weekday'||news==='weekend') o.news = news;
  data.settings.specialDays[ds] = o;
  saveData(data);
  _renderSpecialDayList();
  ['sp-date','sp-vw','sp-cg','sp-cap'].forEach(id=>{document.getElementById(id).value='';});
  { const pr=document.getElementById('sp-deskpair'); if(pr) pr.checked=false; }
  { const nw=document.getElementById('sp-news'); if(nw) nw.value=''; }
  toast('특정일 인원 저장됨 — 근무 생성 시 반영됩니다.','success');
  if (wsRangeStart && wsRangeEnd) renderWorkshopTable();
}
function _editSpecialDay(ds) {
  const o = (data.settings.specialDays||{})[ds] || {};
  document.getElementById('sp-date').value = ds;
  document.getElementById('sp-vw').value = o.vw ?? '';
  document.getElementById('sp-cg').value = o.cg ?? '';
  document.getElementById('sp-cap').value = o.cap ?? '';
  { const pr=document.getElementById('sp-deskpair'); if(pr) pr.checked=!!o.deskPair; }
  { const nw=document.getElementById('sp-news'); if(nw) nw.value=o.news||''; }
  _spCalSync();
  document.querySelectorAll('#special-day-list .sp-item').forEach(el=>el.classList.toggle('on', el.dataset.ds===ds));   // 지금 고치는 날 표시
}
function deleteSpecialDay(ds) {
  if (data.settings.specialDays) delete data.settings.specialDays[ds];
  saveData(data);
  _renderSpecialDayList();
  toast('삭제되었습니다.','success');
  if (wsRangeStart && wsRangeEnd) renderWorkshopTable();
}
// 작성소 날짜 칸 클릭 → 작은 팝업으로 그날 적정 인원 직접 수정
function openDaySpecial(ds, ev) {
  if (ev) ev.stopPropagation();
  const sp = (data.settings.specialDays||{})[ds] || {};
  const [y,m,d] = ds.split('-').map(Number);
  let pop = document.getElementById('day-special-pop');
  if (!pop) {
    pop = document.createElement('div'); pop.id='day-special-pop'; document.body.appendChild(pop);
    document.addEventListener('click', (e)=>{ if(pop.style.display==='block' && !pop.contains(e.target)) pop.style.display='none'; });
  }
  pop.style.cssText = 'position:fixed;z-index:10001;background:var(--surface);border:1px solid #fcd97d;border-radius:12px;box-shadow:0 6px 30px rgba(0,0,0,0.28);padding:13px;width:236px;';
  pop.innerHTML = `
    <div style="font-size:13px;font-weight:800;color:#b8860b;margin-bottom:9px;">${m}/${d} 적정 인원<br><span style="font-size:10px;font-weight:500;color:var(--muted);">빈칸은 기본 설정 사용</span></div>
    <div style="display:flex;gap:5px;margin-bottom:9px;">
      <div style="flex:1;text-align:center;"><div style="font-size:10px;color:var(--muted);margin-bottom:2px;">VW</div><input type="number" id="dsp-vw" value="${sp.vw??''}" placeholder="기본" min="0" max="40" style="width:100%;padding:5px 2px;font-size:13px;font-weight:700;border:1px solid var(--border);border-radius:6px;text-align:center;"></div>
      <div style="flex:1;text-align:center;"><div style="font-size:10px;color:var(--muted);margin-bottom:2px;">CG</div><input type="number" id="dsp-cg" value="${sp.cg??''}" placeholder="기본" min="0" max="40" style="width:100%;padding:5px 2px;font-size:13px;font-weight:700;border:1px solid var(--border);border-radius:6px;text-align:center;"></div>
      <div style="flex:1;text-align:center;"><div style="font-size:10px;color:var(--muted);margin-bottom:2px;">최대</div><input type="number" id="dsp-cap" value="${sp.cap??''}" placeholder="기본" min="0" max="60" style="width:100%;padding:5px 2px;font-size:13px;font-weight:700;border:1px solid var(--border);border-radius:6px;text-align:center;"></div>
    </div>
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text);margin-bottom:9px;cursor:pointer;">
      <input type="checkbox" id="dsp-deskpair" ${sp.deskPair?'checked':''} style="width:15px;height:15px;">
      CG 데스크 2명 (8데스+5데스) <span style="color:var(--muted);">— 휴일/주말용</span>
    </label>
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text);margin-bottom:9px;">
      <span style="flex:none;">8뉴스 편성</span>
      <select id="dsp-news" style="flex:1;min-width:0;padding:4px 6px;font-size:11px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);">
        <option value="" ${!sp.news?'selected':''}>자동(설·추석=주말)</option><option value="weekday" ${sp.news==='weekday'?'selected':''}>평일 편성(50분)</option><option value="weekend" ${sp.news==='weekend'?'selected':''}>주말 편성</option>
      </select>
    </label>
    <div style="display:flex;gap:5px;margin-bottom:7px;">
      <button onclick="_saveDaySpecial('${ds}')" style="flex:1;background:#4a9fbd;color:#fff;border:none;border-radius:7px;padding:6px;font-size:12px;font-weight:700;cursor:pointer;">저장</button>
      <button onclick="_clearDaySpecial('${ds}')" style="background:#fce8e8;color:#d65a52;border:1px solid #f4bab6;border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer;">해제</button>
    </div>
    <button onclick="document.getElementById('day-special-pop').style.display='none';wsShowDay('${ds}')" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:6px;font-size:11px;color:var(--muted);font-weight:700;cursor:pointer;">이 날 근무 상세 편집</button>`;
  pop.style.display='block';
  const pw = pop.offsetWidth||244, ph = pop.offsetHeight||240;   // 실제 크기로 화면 안에 맞춤
  const px = ev ? Math.min(ev.clientX, window.innerWidth-pw-8) : 80;
  const py = ev ? Math.min(ev.clientY+8, window.innerHeight-ph-8) : 80;
  pop.style.left = Math.max(8,px)+'px';
  pop.style.top = Math.max(8,py)+'px';
  setTimeout(()=>{ const f=document.getElementById('dsp-vw'); if(f) f.focus(); }, 30);
}
function _saveDaySpecial(ds) {
  const vw=parseInt(document.getElementById('dsp-vw').value);
  const cg=parseInt(document.getElementById('dsp-cg').value);
  const cap=parseInt(document.getElementById('dsp-cap').value);
  const pair=document.getElementById('dsp-deskpair')?.checked;
  const news=document.getElementById('dsp-news')?.value||'';
  if(!data.settings.specialDays) data.settings.specialDays={};
  if(isNaN(vw)&&isNaN(cg)&&isNaN(cap)&&!pair&&!news){ delete data.settings.specialDays[ds]; }
  else { const o={}; if(!isNaN(vw))o.vw=vw; if(!isNaN(cg))o.cg=cg; if(!isNaN(cap))o.cap=cap; if(pair)o.deskPair=true; if(news==='weekday'||news==='weekend')o.news=news; data.settings.specialDays[ds]=o; }
  saveData(data);
  const pop=document.getElementById('day-special-pop'); if(pop) pop.style.display='none';
  renderWorkshopTable();
  toast('특정일 인원 저장됨','success');
}
function _clearDaySpecial(ds) {
  if(data.settings.specialDays) delete data.settings.specialDays[ds];
  saveData(data);
  const pop=document.getElementById('day-special-pop'); if(pop) pop.style.display='none';
  renderWorkshopTable();
  toast('해제됨','success');
}
function _renderSpecialDayList() {
  const wrap = document.getElementById('special-day-list');
  if (!wrap) return;
  _spCalSync();   // 달력 점(등록된 날) 갱신
  const sp = data.settings.specialDays || {};
  const keys = Object.keys(sp).sort();
  if (!keys.length) { wrap.innerHTML = '<div class="sp-empty">등록된 특정일이 없습니다.</div>'; return; }
  const DOW=['일','월','화','수','목','금','토'];
  // 모양은 css/admin.css(.sp-item …) — 작성소 날짜칸 팝업에서 켠 'CG 데스크 2명'도 함께 표시
  wrap.innerHTML = keys.map(ds=>{
    const o = sp[ds];
    const parts=[];
    if (o.vw!=null) parts.push(`VW ${o.vw}`);
    if (o.cg!=null) parts.push(`CG ${o.cg}`);
    if (o.cap!=null) parts.push(`최대 ${o.cap}`);
    if (o.deskPair) parts.push('CG 데스크 2명');
    if (o.news==='weekday') parts.push('8뉴스 평일 편성');
    if (o.news==='weekend') parts.push('8뉴스 주말 편성');
    const [y,m,d]=ds.split('-').map(Number);
    const dw=new Date(ds+'T00:00:00').getDay(), dow=DOW[dw];
    return `<div class="sp-item" data-ds="${ds}">
      <div class="sp-item-txt"><b class="sp-item-date${dw===0?' sun':dw===6?' sat':''}">${m}/${d}(${dow})</b><span class="sp-item-vals">${parts.join(' · ')}</span></div>
      <div class="sp-item-btns">
        <button type="button" class="sp-edit" onclick="_editSpecialDay('${ds}')">수정</button>
        <button type="button" class="sp-del" onclick="deleteSpecialDay('${ds}')">삭제</button>
      </div>
    </div>`;
  }).join('');
}

function _setAdminNav(on) {
  const ws = document.getElementById('nav-workshop');
  if (ws) ws.style.display = on ? 'inline-block' : 'none';
  const na = document.getElementById('nav-admin');
  if (na) na.style.display = on ? 'inline-block' : 'none';
  // 플로팅바 작성소·관리자 탭은 CSS(body.admin-mode-active)로 슈우욱 펼침 — display 토글 대신 애니메이션
  if (on) { const _fn=document.getElementById('floating-nav'); if(_fn){ _fn.classList.remove('fnav-mode-in'); void _fn.offsetWidth; _fn.classList.add('fnav-mode-in'); setTimeout(function(){ _fn.classList.remove('fnav-mode-in'); }, 950); } }
  const bar = document.getElementById('admin-mode-bar');
  if (bar) bar.style.display = on ? 'block' : 'none';
  document.body.classList.toggle('admin-mode-active', on);
}
let homeWeekOffset = 0;
function _homeWeekNav(dir){ homeWeekOffset += dir; renderHome(); var anim = dir>0 ? 'weekSlideNext' : 'weekSlidePrev'; [document.getElementById('home-week-mini'), document.getElementById('home-mobile-ev-list')].forEach(function(el){ if(!el) return; el.style.animation='none'; void el.offsetWidth; el.style.animation=anim+' .34s cubic-bezier(.22,1,.36,1)'; }); }
let monthOffset = 0;
let calMode = 'mine';   // 달력 탭 모드: 'mine'(나만의 달력) | 'team'(팀 전체). 탭 진입 시 기본 mine
let _noticeExpanded = false;  // 홈 공지 다중카드 펼침 상태
let _noticeTextOpen = new Set();  // 개별 공지 본문 펼침 상태(id) — 길면 접고 페이드+더보기
let _noticeEditId = null;     // 공지 수정 중인 항목 id (없으면 새 공지)
let tableRangeStart = null; // 'YYYY-MM-DD'
let tableRangeEnd = null;   // 'YYYY-MM-DD'
// 근무표 기간을 기기에 저장/복원 — 사용자가 바꾸지 않으면 앱 재실행에도 유지
(function(){ try{ const _r=JSON.parse(localStorage.getItem('nd_table_range')||'null'); if(_r&&_r.start&&_r.end){ tableRangeStart=_r.start; tableRangeEnd=_r.end; } }catch(e){} })();
function _saveTableRange(){ try{ if(tableRangeStart&&tableRangeEnd) localStorage.setItem('nd_table_range', JSON.stringify({start:tableRangeStart,end:tableRangeEnd})); }catch(e){} }
let isAdmin = false;
let isMaster = false;     // 마스터 모드: 관리자와 동일 + 관리자/관리자테스트 비번 변경 가능
let isAdminTest = false;  // 관리자 테스트 모드: 관리자와 동일 화면, 읽기 전용(저장 안 됨)
let modalDate = null;
const DOW_KR = ['일','월','화','수','목','금','토'];
const DOW_FULL = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];

