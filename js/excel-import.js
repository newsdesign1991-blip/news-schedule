/* [모듈] js/excel-import.js — 이미지/엑셀 가져오기(파싱·적용) | dashboard.html 메인 스크립트에서 분리됨. 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// ===== 이미지/엑셀 가져오기 =====
let _imgBase64 = null, _imgMediaType = 'image/jpeg', _imgParsedData = null, _unknownNames = [];
let _xlArrayBuffer = null, _currentImportTab = 'excel';

function switchImportTab(tab) {
  _currentImportTab = 'excel';
  const ex = document.getElementById('img-section-excel'); if (ex) ex.style.display = '';
  const im = document.getElementById('img-section-image'); if (im) im.style.display = 'none';
  const btn = document.getElementById('img-analyze-btn'); if (btn) btn.textContent = '📊 파싱하기';
  const ra = document.getElementById('img-result-area'); if (ra) ra.style.display = 'none';
  const ab = document.getElementById('img-apply-btn'); if (ab) ab.style.display = 'none';
}
function openImageImport() {
  document.getElementById('img-result-area').style.display = 'none';
  document.getElementById('img-apply-btn').style.display = 'none';
  document.getElementById('img-import-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _imgParsedData = null; _xlArrayBuffer = null;
  switchImportTab('excel');
}
function closeImageImport() {
  _animModalClose(document.getElementById('img-import-modal'));
  document.body.style.overflow = '';
}
function runImport() {
  parseExcelSchedule();
}
// ---- 엑셀 파일 처리 ----
function handleXlFile(input) {
  const file = input.files[0]; if (!file) return;
  document.getElementById('xl-file-name').textContent = '📄 ' + file.name;
  document.getElementById('xl-file-name').style.display = 'block';
  document.getElementById('xl-drop-label').style.display = 'none';
  const reader = new FileReader();
  reader.onload = e => {
    _xlArrayBuffer = e.target.result;
    try {
      const wb = XLSX.read(_xlArrayBuffer, {type:'array'});
      const sel = document.getElementById('xl-sheet-select');
      sel.innerHTML = wb.SheetNames.map((n,i)=>`<option value="${i}">${n}</option>`).join('');
      // 기본 선택: "최종" 포함 시트 우선
      const preferred = wb.SheetNames.findIndex(n=>n.includes('최종'));
      if (preferred>=0) sel.value = preferred;
      document.getElementById('xl-sheet-select-wrap').style.display = '';
    } catch(e) { /* ignore */ }
  };
  reader.readAsArrayBuffer(file);
}
function handleXlDrop(e) {
  e.preventDefault();
  document.getElementById('xl-drop-zone').style.borderColor = '';
  const file = e.dataTransfer.files[0]; if (!file) return;
  const dt = new DataTransfer(); dt.items.add(file);
  document.getElementById('xl-file-input').files = dt.files;
  handleXlFile(document.getElementById('xl-file-input'));
}
function parseExcelSchedule() {
  if (!_xlArrayBuffer) { toast('엑셀 파일을 먼저 올려주세요','error'); return; }
  try {
    const wb = XLSX.read(_xlArrayBuffer, {type:'array'});
    const sheetIdx = parseInt(document.getElementById('xl-sheet-select')?.value||'0');
    const sheetName = wb.SheetNames[sheetIdx] || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

    // 연도/월 추출: 시트명 또는 상단 행에서 "YYYY년 M월" 검색
    let year = new Date().getFullYear(), month = new Date().getMonth()+1;
    const srcText = [sheetName, ...rows.slice(0,5).map(r=>r.join(' '))].join(' ');
    const ymMatch = srcText.match(/(\d{4})[년\s]*\s*(\d{1,2})[월]/);
    if (ymMatch) { year=parseInt(ymMatch[1]); month=parseInt(ymMatch[2]); }

    const staffNames = new Set((data.staff||[]).map(s=>s.name));
    const knownStaffByName = {};
    (data.staff||[]).forEach(s=>{ knownStaffByName[s.name]=s; });

    // 이름 헤더 행 찾기 (직원 이름이 3개 이상 있는 첫 행)
    let nameRowIdx = -1;
    for (let r=0; r<Math.min(10,rows.length); r++) {
      let cnt=0;
      rows[r].forEach(v=>{ if(staffNames.has(String(v).trim())) cnt++; });
      if (cnt>=3) { nameRowIdx=r; break; }
    }
    if (nameRowIdx===-1) { toast('직원 이름 헤더 행을 찾을 수 없습니다.','error'); return; }

    const nameRow = rows[nameRowIdx];

    // 날짜 열 자동 감지
    // 1순위: 요일 열(월~일)을 찾고 그 바로 왼쪽의 숫자 열을 날짜로 (가장 확실)
    const _isDateCol = c => {
      if (c<0 || c>=nameRow.length) return false;
      if (staffNames.has(String(nameRow[c]).trim())) return false;
      let numCount=0, total=0;
      for (let r=nameRowIdx+1; r<Math.min(nameRowIdx+12,rows.length); r++) {
        const v=String(rows[r][c]).trim();
        if(v){total++; if(/^\d{1,2}$/.test(v)&&parseInt(v)>=1&&parseInt(v)<=31) numCount++;}
      }
      return total>0 && numCount/total>=0.7;
    };
    const _DOW = new Set(['월','화','수','목','금','토','일']);
    let dateColIdx = -1, dowColIdx = -1;
    for (let c=1; c<nameRow.length; c++) {
      let dowCount=0, total=0;
      for (let r=nameRowIdx+1; r<Math.min(nameRowIdx+12,rows.length); r++) {
        const v=String(rows[r][c]).trim();
        if(v){total++; if(_DOW.has(v)) dowCount++;}
      }
      if(total>0 && dowCount/total>=0.6){ dowColIdx=c; break; }
    }
    if (dowColIdx > 0) {
      // 요일 열 왼쪽 1~3칸 내 숫자 열 = 날짜
      for (let c=dowColIdx-1; c>=0 && c>=dowColIdx-3; c--) {
        if (_isDateCol(c)) { dateColIdx=c; break; }
      }
    }
    // 2순위 폴백: 1~31 순차 증가(연속 day) 점수가 가장 높은 숫자 열
    if (dateColIdx < 0) {
      let best=-1, bestScore=-1;
      for (let c=0; c<nameRow.length; c++) {
        if (staffNames.has(String(nameRow[c]).trim())) continue;
        const nums=[];
        for (let r=nameRowIdx+1; r<rows.length; r++) {
          const v=String(rows[r][c]).trim();
          if(/^\d{1,2}$/.test(v)&&parseInt(v)>=1&&parseInt(v)<=31) nums.push(parseInt(v));
        }
        if(nums.length<5) continue;
        let inc=0; for(let i=1;i<nums.length;i++) if(nums[i]-nums[i-1]===1) inc++;
        const score=inc/(nums.length-1);
        if(score>bestScore){ bestScore=score; best=c; }
      }
      if(best>=0 && bestScore>=0.5) dateColIdx=best;
    }

    // 실제 날짜/요일이 연속되는 본문만 읽는다. 하단 집계/메모는 근무행이 아니다.
    const isBodyRow=row=>{
      if(!row) return false;
      if(dowColIdx>=0 && !_DOW.has(String(row[dowColIdx]||'').trim())) return false;
      if(dateColIdx>=0) {
        const day=String(row[dateColIdx]||'').trim();
        return /^\d{1,2}$/.test(day) && Number(day)>=1 && Number(day)<=31;
      }
      return /^(?:\d{1,2}[/.]\d{1,2}|\d{1,2}월\d{1,2}일?|\d{5})$/.test(String(row[0]||'').trim());
    };
    let bodyStart=nameRowIdx+1;
    while(bodyStart<rows.length && !isBodyRow(rows[bodyStart])) bodyStart++;
    let bodyEnd=bodyStart;
    while(bodyEnd<rows.length && isBodyRow(rows[bodyEnd])) bodyEnd++;
    const hasWorkValues=c=>{
      let filled=0, recognized=0;
      for(let r=bodyStart;r<bodyEnd;r++) {
        const value=_normalizeImportedWorkType(rows[r][c]);
        if(!value || value==='-' || value==='0') continue;
        filled++;
        if(Object.prototype.hasOwnProperty.call(WORK_TYPE_MAP,value)) recognized++;
      }
      return filled>0 && recognized/filled>=0.5;
    };

    // 부서 병합 헤더의 범위만 직원 열로 사용한다. 표 밖 메모는 이름으로 읽지 않는다.
    const candidateNames = nameRow.map((v,c)=>{
      const nm=String(v||'').trim();
      if(!nm || c===dateColIdx || c===dowColIdx) return '';
      if(knownStaffByName[nm]) return nm;
      if(/\d|\s/.test(nm) || nm in WORK_TYPE_MAP || nm.length>5) return '';
      if(/^(비고|편성|길이|진입|합계|총원|인원|일반|근무|요일|날짜)$/.test(nm)) return '';
      return nm;
    });
    const sheetStart=XLSX.utils.decode_range(ws['!ref']||'A1').s;
    const staffColumns=new Set();
    (ws['!merges']||[]).forEach(range=>{
      const headerRow=range.s.r-sheetStart.r;
      if(headerRow<0 || headerRow>=nameRowIdx || range.e.r>=nameRowIdx+sheetStart.r) return;
      const start=range.s.c-sheetStart.c, end=range.e.c-sheetStart.c;
      const header=String((rows[headerRow]||[])[start]||'');
      if(!/VW|CG|XR|P\.?J|PROJECT|SPORTS|조근|스포츠/i.test(header)) return;
      for(let c=Math.max(0,start);c<=Math.min(end,nameRow.length-1);c++) staffColumns.add(c);
    });
    // 병합 헤더가 없는 형식: 등록 직원에서 이어지는 이름 열까지만 허용한다.
    // 빈 열/합계/숫자 메모를 만나면 멈추므로 떨어져 있는 메모 영역은 제외된다.
    candidateNames.forEach((nm,c)=>{
      if(!knownStaffByName[nm] || staffColumns.has(c) || !hasWorkValues(c)) return;
      staffColumns.add(c);
      for(const step of [-1,1]) {
        for(let next=c+step;next>=0 && next<candidateNames.length && candidateNames[next] && hasWorkValues(next);next+=step) staffColumns.add(next);
      }
    });
    const colMap = [];
    candidateNames.forEach((name,colIdx)=>{
      if(name && staffColumns.has(colIdx)) colMap.push({name,colIdx});
    });

    // 비고 열 감지: 이름행 위(병합 헤더행) 또는 이름행 헤더에 '8뉴스/진입/편성/길이/비고' 포함 → 날짜별 메모로 수집
    const _noteHdr = nameRowIdx>0 ? (rows[nameRowIdx-1]||[]) : [];
    const noteCols = [];
    const _hdrMaxC = Math.max(nameRow.length, _noteHdr.length);
    // 비고도 표에 이어지는 헤더만 수집하고 빈 열 너머의 별도 메모는 제외한다.
    let tableLeft=Math.min(...staffColumns), tableRight=Math.max(...staffColumns);
    const hasHeader=c=>String(nameRow[c]||_noteHdr[c]||'').trim()!=='';
    while(tableLeft>0 && hasHeader(tableLeft-1)) tableLeft--;
    while(tableRight+1<_hdrMaxC && hasHeader(tableRight+1)) tableRight++;
    for (let c=tableLeft; c<=tableRight; c++) {
      if (c===dateColIdx || c===dowColIdx) continue;
      const h = (String(_noteHdr[c]||'')+String(nameRow[c]||'')).replace(/\s+/g,'');
      let label=null;
      if (/8뉴스|뉴스진입|진입/.test(h)) label='8뉴스';
      else if (/편성|길이/.test(h)) label='편성';
      else if (/비고/.test(h)) label='';
      if (label!==null) noteCols.push({colIdx:c, label});
    }

    const unknown = new Set();
    colMap.forEach(({name})=>{ if(!knownStaffByName[name]) unknown.add(name); });

    // 날짜별 근무 파싱 — 근무표는 월~일 주 단위라 시트가 월을 넘어감(예: 6월 끝에 7월 첫 주).
    // 날짜 열에는 '일'만 있으므로, 날짜가 역행하면(예: 30→1) 자동으로 다음 달로 이어서 인식한다.
    const schedule = [];
    let _prevDay = 0, _curMon = month, _curYear = year;
    for (let r=bodyStart; r<bodyEnd; r++) {
      const row = rows[r];
      let dayNum=null, explicitMon=null;   // explicitMon: col0에서 '월'이 직접 적힌 경우만

      if (dateColIdx>=0) {
        // 날짜 열에서 일(day) 숫자 읽기
        const dv=String(row[dateColIdx]).trim();
        if(/^\d{1,2}$/.test(dv)) dayNum=parseInt(dv);
      }
      if (!dayNum) {
        // col0에서 "6/1", "6월1일", 엑셀 시리얼 등 파싱 시도 (월이 명시됨)
        const dc=String(row[0]).trim();
        const s=dc.match(/^(\d{1,2})[\/.](\d{1,2})$/);
        const k=dc.match(/(\d{1,2})월(\d{1,2})일?/);
        if(s){explicitMon=parseInt(s[1]);dayNum=parseInt(s[2]);}
        else if(k){explicitMon=parseInt(k[1]);dayNum=parseInt(k[2]);}
        else if(/^\d+$/.test(dc)&&parseInt(dc)>31){
          const jd=new Date(Math.round((parseInt(dc)-25569)*86400*1000));
          explicitMon=jd.getUTCMonth()+1;dayNum=jd.getUTCDate();
        }
      }
      if (!dayNum) continue;

      let useYear, useMon;
      if (explicitMon !== null) {
        // 월이 직접 적힌 경우 그대로 사용 + 추적값 동기화
        useMon = explicitMon; useYear = year;
        _curMon = explicitMon; _curYear = year;
      } else {
        // 날짜 열(일만): 역행하면(30→1) 다음 달로 넘어감 (월~일 주 단위라 월경계를 넘어감: 예 9/7~10/4)
        if (_prevDay && dayNum < _prevDay) {
          _curMon++;
          if (_curMon > 12) { _curMon = 1; _curYear++; }
        }
        useMon = _curMon; useYear = _curYear;
      }
      _prevDay = dayNum;

      const dateStr=`${useYear}-${String(useMon).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
      const entries=[];
      colMap.forEach(({name,colIdx})=>{
        // 셀 안의 공백·줄바꿈을 제거해 표기 변형 흡수 ('오전 데'→'오전데', '뉴.오 2'→'뉴.오2' 등)
        const val=String(row[colIdx]||'').replace(/\s+/g,'').trim();
        if(val&&val!=='-'&&val!=='0') entries.push({name,workType:val});
      });
      // 비고 열 값 수집(8뉴스 진입 시간·편성 길이 등) → 날짜별 note
      let _note='';
      if (noteCols.length) {
        const _parts=[];
        noteCols.forEach(nc=>{
          let v=row[nc.colIdx], sv='';
          if (typeof v==='number' && v>0 && v<1) {         // 시간 셀(하루의 분수) → HH:MM
            const _tm=Math.round(v*24*60); sv=String(Math.floor(_tm/60)%24).padStart(2,'0')+':'+String(_tm%60).padStart(2,'0');
          } else { sv=String(v==null?'':v).trim(); }   // 텍스트(복수시간 '21:40/22:00' 등)는 그대로
          if (sv && sv!=='-' && sv!=='0') _parts.push(nc.label? `${nc.label} ${sv}` : sv);
        });
        _note=_parts.join(' · ');
      }
      schedule.push({date:dateStr,entries,note:_note});
    }

    if (!schedule.length) { toast('파싱된 근무 데이터가 없습니다. 엑셀 구조를 확인해주세요.','error'); return; }
    _imgParsedData = {year,month,unknownNames:[...unknown],schedule,source:'excel',staffNames:colMap.map(c=>c.name)};
    _renderImgResult(_imgParsedData);
  } catch(err) {
    toast('엑셀 파싱 오류: '+err.message, 'error');
  }
}
// ---- 이미지(AI) 처리 ----
function handleImgFile(input) {
  const file = input.files[0]; if (!file) return;
  _imgMediaType = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = e => {
    _imgBase64 = e.target.result.split(',')[1];
    document.getElementById('img-preview').src = e.target.result;
    document.getElementById('img-preview').style.display = 'block';
    document.getElementById('img-drop-label').style.display = 'none';
  };
  reader.readAsDataURL(file);
}
function handleImgDrop(e) {
  e.preventDefault();
  document.getElementById('img-drop-zone').style.borderColor = '';
  const file = e.dataTransfer.files[0]; if (!file) return;
  const dt = new DataTransfer(); dt.items.add(file);
  document.getElementById('img-file-input').files = dt.files;
  handleImgFile(document.getElementById('img-file-input'));
}
async function analyzeScheduleImage() {
  const apiKey = document.getElementById('img-api-key').value.trim();
  if (!apiKey) { toast('API Key를 입력하세요','error'); return; }
  if (!_imgBase64) { toast('이미지를 먼저 업로드하세요','error'); return; }
  localStorage.setItem('nd_gemini_key', apiKey);
  const btn = document.getElementById('img-analyze-btn');
  btn.textContent = '⏳ 분석 중...'; btn.disabled = true;
  document.getElementById('img-result-area').style.display = 'none';
  document.getElementById('img-apply-btn').style.display = 'none';
  try {
    const staffNames = (data.staff||[]).map(s=>s.name).join(', ');
    const prompt = `이 근무표 이미지를 분석해서 JSON으로 반환해주세요.

등록된 직원 이름 목록: ${staffNames}

규칙:
- 각 날짜(date: "YYYY-MM-DD")별로 직원별 근무유형을 추출
- 연도와 월은 이미지의 제목에서 추출 (예: "2026년 6월")
- 근무유형 코드: 정근, 신휴가, Jr.휴가, 출장, Jr.캠프, AI 교육, 당직, VW대, 8데스크, 5데스크, 오전데스크, 조근, 8진, 뉴오, 일근, 데스크, CG
- 이미지에서 셀 내용이 "정근"이면 workType을 "정근"으로, "신휴가"이면 "신휴가"로 등 그대로 사용
- 빈 셀(근무 없음)은 포함하지 마세요
- 등록된 직원 목록에 없는 이름은 unknownNames 배열에 추가

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{"year":2026,"month":6,"unknownNames":[],"schedule":[{"date":"2026-06-01","entries":[{"name":"홍길동","workType":"정근"}]}]}`;

    const MODELS = ['gemini-2.0-flash','gemini-1.5-flash','gemini-1.5-pro','gemini-pro-vision'];
    const body = JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: _imgMediaType, data: _imgBase64 } },
        { text: prompt }
      ]}],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 }
    });
    let rawText = '', lastErr = '';
    for (const model of MODELS) {
      btn.textContent = `⏳ 시도 중 (${model})...`;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body
        });
        const resp = await res.json();
        if (!res.ok) { lastErr = resp.error?.message || res.statusText; continue; }
        rawText = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText) break;
      } catch(e) { lastErr = e.message; }
    }
    if (!rawText) throw new Error('모든 모델 시도 실패. 마지막 오류: ' + lastErr);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + rawText.substring(0, 200));
    _imgParsedData = JSON.parse(jsonMatch[0]);
    _renderImgResult(_imgParsedData);
  } catch(e) {
    toast('분석 실패: ' + e.message, 'error');
    document.getElementById('img-result-content').innerHTML = `<div style="color:#d65a52;font-size:12px;line-height:1.6;">오류: ${e.message}<br><br>💡 <b>이미지 대신 엑셀 파일 탭을 이용하면 API 키 없이 바로 가져올 수 있습니다.</b></div>`;
    document.getElementById('img-result-area').style.display = 'block';
  } finally {
    btn.textContent = '🔍 AI 분석하기'; btn.disabled = false;
  }
}
function _renderImgResult(parsed) {
  const area = document.getElementById('img-result-area');
  const content = document.getElementById('img-result-content');
  const totalEntries = (parsed.schedule||[]).reduce((s,d)=>s+d.entries.length,0);
  const days = (parsed.schedule||[]).length;
  let html = `<div style="background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px;">
    <b>${parsed.year}년 ${parsed.month}월</b> — ${days}일, ${totalEntries}개 근무 항목 추출됨
  </div>`;
  if (parsed.unknownNames?.length) {
    html += `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#92400e;">
      <b>⚠️ 미등록 인원 ${parsed.unknownNames.length}명:</b> ${parsed.unknownNames.join(', ')}<br>
      <span style="font-size:11px;">적용 시 등록 팝업이 표시됩니다.</span>
    </div>`;
  }
  // 샘플 미리보기 (최대 5일)
  html += `<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">미리보기 (최대 5일)</div>`;
  const preview = parsed.schedule.slice(0,5);
  preview.forEach(day => {
    const {y,m,d,date} = parseDateStr(day.date);
    const dow = ['일','월','화','수','목','금','토'][date.getDay()];
    html += `<div style="margin-bottom:6px;"><span style="font-size:11px;font-weight:700;color:var(--text);">${m}/${d}(${dow})</span> `;
    html += day.entries.map(e=>`<span style="font-size:11px;padding:1px 6px;border-radius:8px;background:var(--surface2);margin-right:3px;">${e.name}<span style="color:var(--muted);margin-left:2px;">${e.workType}</span></span>`).join('');
    html += `</div>`;
  });
  if (parsed.schedule.length > 5) html += `<div style="font-size:11px;color:var(--muted);">... 외 ${parsed.schedule.length-5}일</div>`;
  content.innerHTML = html;
  area.style.display = 'block';
  document.getElementById('img-apply-btn').style.display = 'block';
}

function _isVw2(entry,id) { return String(entry?.customCells?.[id]?.text || '').replace(/\s/g,'').toUpperCase() === 'VW2'; }
function _normalizeImportedWorkType(value){return String(value||'').replace(/\s+/g,'').replace(/^jr[.．]?/i,'Jr.').replace(/^ai교육$/i,'AI 교육');}
const WORK_TYPE_MAP = {
  '정근': 'work', '신휴가': 'leave', 'Jr.휴가': 'leave', '출장': 'offsite', 'Jr.캠프': 'offsite', 'AI 교육': 'offsite', '당직': 'danjik',
  'VW데': 'vw-desk', '데스크': 'desk-auto',
  'VW대': 'vw-sub', 'VW대체': 'vw-sub', 'VW대체자': 'vw-sub',
  'CG대': 'cg-sub', 'CG대체': 'cg-sub', 'CG대체자': 'cg-sub',
  '8데스크': 'desk8', '8데스': 'desk8', '5데스크': 'desk5', '5데스': 'desk5',
  '오전데스크': 'ojende', '오전데': 'ojende', '오데': 'ojende', '오데/반차': 'ojende',
  '조근': 'jogeun', '8진': '8jin', '8진2': '8jin2', '8진②': '8jin2',
  '뉴오': 'newsoh', '뉴.오': 'newsoh', '뉴오1': 'newsoh', '뉴.오1': 'newsoh',
  '뉴오2': 'newsoh2', '뉴.오2': 'newsoh2', '뉴오②': 'newsoh2',
  '일근': 'ilgeun',
  'XR': 'work', 'N': 'work',
  // 부서명 라벨 = "그 부서에서 근무". 같은 부서면 정근, 타부서 사람이면 대체로 자동 표시(cg.workers/vw.workers).
  'CG': 'cg-sub', 'VW': 'vw-sub', 'VW2': 'vw2', 'vw2': 'vw2',
  // 당직 지정 시 자동 계산되는 항목 → 가져오기에서 무시
  '퇴근': 'skip', '당직퇴근': 'skip', '비번': 'skip', '당직비번': 'skip'
};

function applyImageSchedule() {
  if (!_imgParsedData) return;
  _unknownNames = _imgParsedData.unknownNames || [];
  if (_unknownNames.length) {
    _showUnknownStaffPopup(_unknownNames);
  } else {
    _doApplyImageSchedule([]);
  }
}
function _showUnknownStaffPopup(names) {
  let html = names.map(name => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px;border:1px solid var(--border);border-radius:8px;">
      <span style="font-weight:600;font-size:13px;min-width:70px;">${name}</span>
      <select class="form-select" id="un-dept-${name}" style="flex:1;font-size:12px;">
        <option value="VW">VW</option><option value="CG" selected>CG</option>
        <option value="조근">조근</option><option value="XR">XR</option>
        <option value="PROJECT">PROJECT</option><option value="SPORTS">SPORTS</option>
      </select>
      <select class="form-select" id="un-type-${name}" style="flex:1;font-size:12px;">
        <option value="employee">직원</option>
        <option value="freelancer">프리랜서</option>
      </select>
      <label style="font-size:12px;white-space:nowrap;"><input type="checkbox" id="un-skip-${name}"> 건너뜀</label>
    </div>`).join('');
  document.getElementById('unknown-staff-list').innerHTML = html;
  document.getElementById('unknown-staff-modal').style.display = 'flex';
}
function registerUnknownStaff() {
  const skip = [];
  _unknownNames.forEach(name => {
    if (document.getElementById('un-skip-'+name)?.checked) { skip.push(name); return; }
    const dept = document.getElementById('un-dept-'+name)?.value || 'CG';
    const type = document.getElementById('un-type-'+name)?.value || 'employee';
    const newId = Date.now().toString(36)+Math.random().toString(36).substr(2,4);
    data.staff.push({id:newId,name,dept,deskPriority:null,morningDeskPriority:null,canDanjik:false,canSatMorning:false,canIlgeun:false,canVW:false,canCG:true,can3D:false,canNewsOh:false,canWeekend8jin:false,canWeekday8jin:false,active:true,availableDays:[],employmentType:type});
  });
  saveData(data);
  document.getElementById('unknown-staff-modal').style.display = 'none';
  _doApplyImageSchedule(skip);
  toast('등록 완료 후 근무표에 적용했습니다','success');
}
function skipUnknownStaff() {
  document.getElementById('unknown-staff-modal').style.display = 'none';
  _doApplyImageSchedule(_unknownNames);
}
// 엑셀 원문은 계산된 근무와 별도로 보존한다. 이후 수동 수정/교환된 셀은 현재 배정을 표시한다.
function _importCellSignature(entry,id,leaves) {
  const roles={};
  Object.keys(entry||{}).sort().forEach(key=>{
    if(['importedCells','notes','leaveLabels'].includes(key)) return;
    const v=entry[key];
    if(Array.isArray(v)){if(v.includes(id))roles[key]=true;}
    else if(v && typeof v==='object'){
      const own={};Object.keys(v).sort().forEach(k=>{if(k===id)own[k]=v[k];else if(v[k]===id || (Array.isArray(v[k])&&v[k].includes(id)))own[k]=true;});
      if(Object.keys(own).length)roles[key]=own;
    } else if(v===id)roles[key]=true;
  });
  roles.leave=(leaves||[]).includes(id);
  return JSON.stringify(roles);
}
function _importCellDisplay(entry,id,leaves) {
  const cell=entry?.importedCells?.[id];
  if(!cell || cell.signature!==_importCellSignature(entry,id,leaves)) return null;
  const text=cell.text, type=WORK_TYPE_MAP[_normalizeImportedWorkType(text)];
  let bg='',color='var(--muted)',fw='500';
  const palette={danjik:['#d65a52','#fff'],jogeun:['var(--r-jogeun-bg)','var(--r-jogeun-fg)'],ilgeun:['var(--r-ilgeun-bg)','var(--r-ilgeun-fg)'],offsite:['#ffc1df','#000000'],'vw-sub':['var(--vw-bg)','var(--vw-light)'],vw2:['var(--vw-bg)','var(--vw-light)'],'cg-sub':['var(--cg-bg)','var(--cg-light)'],newsoh:['var(--r-news-bg)','var(--r-news-fg)'],newsoh2:['var(--r-news2-bg)','var(--r-news2-fg)']};
  if(palette[type]) [bg,color]=palette[type];
  if(type==='leave')color='#c79a5e';
  if(type==='8jin'||type==='8jin2')color='#d65a52';
  if(['desk8','vw-desk','desk-auto'].includes(type))color='#6366f1';
  if(type==='desk5')color='#4a9fbd';
  if(type==='ojende')color='#436bb5';
  if(/^(퇴근|당직퇴근)$/.test(text)){bg='var(--r-exit-bg)';color='var(--r-exit-fg)';}
  if(text && type!=='work')fw='700';
  const count=!!text && text!=='-' && text!=='0' && type!=='leave' && !/^(비번|당직비번)$/.test(text);
  return {text,bg,color,fw,count};
}
function _importCellHTML(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function _doApplyImageSchedule(skipNames) {
  if (!_imgParsedData) return;
  const skipSet = new Set(skipNames);
  if (!data.draft.schedule) data.draft.schedule = {};
  let applied = 0;
  if (!data.draft.newLeaves) data.draft.newLeaves = {};
  // 엑셀에 열(데이터)이 있는 사람 이름 집합 — 조근 휴무 판정에 사용(열 자체가 없는 사람은 건드리지 않음)
  const _impNames = new Set();
  (_imgParsedData.schedule||[]).forEach(d=>(d.entries||[]).forEach(e=>_impNames.add(e.name)));
  (_imgParsedData.schedule||[]).forEach(day => {
    const ds = day.date;
    // 파싱된 날짜는 기존 내용을 비우고 새로 덮어씀 (재파싱 시 누적 방지)
    data.draft.schedule[ds] = { vw:{workers:[],desk:null}, cg:{workers:[],desk8:null,desk5:null}, danjik:null, jogeunSubs:{}, satMorning:null, ilgeun:null, project:[], sports:[], xr:[], notes:'' };
    delete data.draft.newLeaves[ds];
    const entry = data.draft.schedule[ds];
    if (day.note) entry.notes = day.note;   // 엑셀 비고(8뉴스 진입·편성 길이)
    day.entries.forEach(({name, workType}) => {
      if (skipSet.has(name)) return;
      const s = (data.staff||[]).find(x=>x.name===name);
      if (!s) return;
      const dOn = (typeof deptOn==='function') ? deptOn(s, ds) : (s.dept||'');   // 시점부서(부서이동 예약 반영) — 기준부서 s.dept 대신 사용
      workType = _normalizeImportedWorkType(workType);
      const wt = WORK_TYPE_MAP[workType];
      if (wt === 'skip') return;   // 당직퇴근·비번 등 자동 계산 항목은 가져오지 않음
      if (wt === undefined) {      // 매핑 안 된 표기(면접관 등) → 자동 배정 않고 메모에 '수동입력 필요' 기록
        entry.notes = (entry.notes ? entry.notes + ', ' : '') + `${name}:${workType}(수동입력 필요)`;
        applied++; return;
      }
      if (wt === 'leave') {
        if (!data.draft.newLeaves) data.draft.newLeaves = {};
        if (!data.draft.newLeaves[ds]) data.draft.newLeaves[ds] = [];
        if (!data.draft.newLeaves[ds].includes(s.id)) data.draft.newLeaves[ds].push(s.id);
        if(workType==='Jr.휴가'){if(!entry.leaveLabels)entry.leaveLabels={};entry.leaveLabels[s.id]='Jr.휴가';}
      } else if (wt === 'offsite') {
        if(!entry.customCells)entry.customCells={};
        entry.customCells[s.id]={text:workType,bg:'#ffc1df',color:'#000000'};
      } else if (wt === 'danjik') {
        entry.danjik = s.id;
      } else if (wt === 'desk8') {
        if (!entry.cg.workers.includes(s.id)) entry.cg.workers.push(s.id);
        entry.cg.desk8 = s.id;
      } else if (wt === 'desk5') {
        if (!entry.cg.workers.includes(s.id)) entry.cg.workers.push(s.id);
        entry.cg.desk5 = s.id;
      } else if (wt === 'vw-desk') {
        if (!entry.vw.workers.includes(s.id)) entry.vw.workers.push(s.id);
        entry.vw.desk = s.id;
      } else if (wt === 'desk-auto') {
        // 그냥 '데스크' — 직원 부서로 판별: VW 직원이면 VW데스크, 그 외(CG 등)는 8데스 (토·일 포함)
        if ((dOn||'').toUpperCase()==='VW') {
          if (!entry.vw.workers.includes(s.id)) entry.vw.workers.push(s.id);
          entry.vw.desk = s.id;
        } else {
          if (!entry.cg.workers.includes(s.id)) entry.cg.workers.push(s.id);
          entry.cg.desk8 = s.id;
        }
      } else if (wt === 'ojende') {
        entry.morningDesk = s.id;
        _brushAddWorker(entry, s.id, dOn || '');   // cg.workers에 넣어야 렌더에서 '오전데'로 표시됨
      } else if (wt === 'cg-sub') {
        // CG 대체자(타부서 사람이 CG 자리) → cg.workers에만 추가(데스크 건드리지 않음). 렌더가 자동으로 'CG'/'CG대' 표시
        if (!entry.cg.workers.includes(s.id)) entry.cg.workers.push(s.id);
      } else if (wt === 'vw2') {
        // Display this assignment without adding it to staffing headcounts.
        if (!entry.customCells) entry.customCells = {};
        entry.customCells[s.id] = {text:'VW2', bg:'var(--vw-bg)', color:'var(--vw-light)'};
      } else if (wt === 'vw-sub') {
        // VW 대체자(타부서 사람이 VW 자리) → vw.workers에만 추가(메인데스크로 만들지 않음)
        if (!entry.vw.workers.includes(s.id)) entry.vw.workers.push(s.id);
      } else if (wt === 'jogeun') {
        // 토요일 조근(직원)→satMorning, 평일 조근 대체(비조근 부서/프리랜서)→jogeunExtra, 평일 조근부서원은 기본 자동
        const _dow = new Date(ds+'T00:00:00').getDay();
        if (_dow===6 && !entry.satMorning) entry.satMorning = s.id;
        if (dOn!=='조근' || _imgParsedData.source==='excel') {
          if (!entry.jogeunExtra) entry.jogeunExtra = [];
          if (!entry.jogeunExtra.includes(s.id)) entry.jogeunExtra.push(s.id);
        }
      } else if (wt === 'ilgeun') {
        entry.ilgeun = s.id;
      } else if (wt === 'newsoh') {
        if (!entry.newsOh) entry.newsOh = s.id;
        else if (entry.newsOh !== s.id && !entry.newsOh2) entry.newsOh2 = s.id;   // 같은 날 두 번째 뉴.오 → 뉴.오2
      } else if (wt === 'newsoh2') {
        entry.newsOh2 = s.id;
      } else if (wt === '8jin') {
        const dow = new Date(ds+'T00:00:00').getDay();
        if (dow===0||dow===6) { if(!entry.weekend8jin) entry.weekend8jin=s.id; else if(entry.weekend8jin!==s.id&&!entry.weekend8jin2) entry.weekend8jin2=s.id; }
        else { if(!entry.weekday8jin) entry.weekday8jin=s.id; else if(entry.weekday8jin!==s.id&&!entry.weekday8jin2) entry.weekday8jin2=s.id; }
      } else if (wt === '8jin2') {
        const dow = new Date(ds+'T00:00:00').getDay();
        if (dow===0||dow===6) entry.weekend8jin2 = s.id;
        else entry.weekday8jin2 = s.id;
      } else if (wt === 'work') {
        // 부서에 맞는 배열로 배정 (XR→entry.xr, PROJECT→entry.project 등; 브러쉬와 동일 처리)
        _brushAddWorker(entry, s.id, dOn || '');
      }
      applied++;
    });
    // 조근 부서: 엑셀 셀이 비어있는 날은 그날 휴무로 명시(가져오기=엑셀 그대로) → 렌더가 자동으로 '조근' 채우는 것 방지.
    //  (엑셀에 값 있으면 그대로: 조근/8진/신휴가 등. 엑셀에 열 자체가 없는 조근원은 건드리지 않음.)
    (function(){
      const _jNames = new Set((day.entries||[]).map(e=>e.name));
      (data.staff||[]).forEach(s=>{
        if (s.active===false) return;
        const _d = (typeof deptOn==='function') ? deptOn(s, ds) : s.dept;
        if (_d !== '조근') return;
        if (_jNames.has(s.name)) return;      // 이 날 엑셀에 값 있음 → 유지
        if (!_impNames.has(s.name)) return;   // 엑셀에 열 자체가 없음 → 건드리지 않음
        if (!entry.restWorkers) entry.restWorkers = [];
        if (!entry.restWorkers.includes(s.id)) entry.restWorkers.push(s.id);
      });
    })();
    if(_imgParsedData.source==='excel'){
      entry.importedCells={};
      const originals=new Map((day.entries||[]).map(e=>[e.name,e.workType]));
      (_imgParsedData.staffNames||[]).forEach(name=>{
        if(skipSet.has(name))return;
        const person=(data.staff||[]).find(p=>p.name===name);if(!person)return;
        const text=_normalizeImportedWorkType(originals.get(name)||'');
        entry.importedCells[person.id]={text,signature:_importCellSignature(entry,person.id,data.draft.newLeaves[ds])};
      });
    }
  });
  // 작성소 범위를 파싱된 날짜 범위로 맞춤 (적용 직후 바로 보이게)
  const _ds = (_imgParsedData.schedule||[]).map(d=>d.date).filter(Boolean).sort();
  if (_ds.length) {
    data.draft.rangeStart = _ds[0];
    data.draft.rangeEnd = _ds[_ds.length-1];
    wsRangeStart = _ds[0]; wsRangeEnd = _ds[_ds.length-1];
    const ss=document.getElementById('ws-start'), ee=document.getElementById('ws-end');
    if(ss) ss.value=_ds[0]; if(ee) ee.value=_ds[_ds.length-1];
  }
  saveData(data);
  closeImageImport();
  renderWorkshopTable();
  toast(`${applied}개 항목이 근무표 초안에 적용되었습니다`, 'success');
}

