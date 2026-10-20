# 근무표 앱 모듈 지도

원래 `index.html` 한 파일(1.1만 줄)이었던 앱을 **코드 내용은 그대로 두고** 기능별 파일로 나눴다(2026-10).
수정할 기능의 파일만 열면 된다. 이 문서는 Claude·GPT 공용 안내서다.

## 구조

```
index.html        HTML 뼈대 + 모달 마크업 + 작은 인라인 스크립트 3개(테마 부팅, 버전 표기 등)
css/*.css         스타일 12개 (아래 순서대로 <link>)
js/*.js           메인 스크립트 23개 (아래 순서대로 <script>)
data-save.js  employee-auth.js/.css  work-swap.js/.css   ← 원래부터 따로 있던 모듈
meal-import.js   ← 앱이 아니라 WISE 탭에서 즐겨찾기로 실행(식단 가져오기). deploy.py ROOT_FILES에 포함
sw.js  manifest.json
```

로컬 작업 폴더에서는 `dashboard.html`이 원본이고 `index.html`은 그 복사본이다.
GitHub 저장소에는 `index.html`만 있다(내용은 `dashboard.html`과 같음).

## 반드시 지킬 규칙

1. **`<script>`/`<link>` 순서를 바꾸지 말 것.** 모듈은 일반(classic) 스크립트라 순서대로 실행된다.
   - 전역 `let/const/function`은 파일끼리 공유된다(그래서 나눠도 그대로 동작).
   - 단, **함수 호이스팅은 파일을 넘지 못한다.** 로드 중에 바로 실행되는 코드(최상위 호출, IIFE)가 **뒤쪽 파일**의 함수·변수를 부르면 깨진다. 이벤트 핸들러·onclick·setTimeout 안에서 부르는 건 괜찮다.
   - 새 최상위 실행 코드는 필요한 것이 모두 정의된 뒤쪽 파일(보통 `sync-init.js` 이후)에 둔다.
2. **같은 이름의 함수를 두 파일에 만들지 말 것.** 뒤 파일이 앞 파일을 조용히 덮는다.
3. **`type="module"`, `defer`, `async`를 붙이지 말 것.** 전역 공유·실행 순서가 바뀌어 앱 전체가 깨진다.
4. 파일 첫 줄의 `/* [모듈] ... */` 주석은 지우지 말 것(이 파일이 무엇인지 표시).
5. 홈/근무표 셀 로직: `renderTable()`(table-view.js)과 `renderWorkshopTable()`(workshop.js)은 항상 같이 고친다.
6. 근무표 칸 우선순위(VW·CG+ 열)를 바꾸면 `workCellRole()`(table-view.js)도 같이 고친다 — 근무 통계가 이걸로 센다. 검사: `node swap-backend/test-work-stats.cjs`(표를 실제로 그려 통계와 비교).

## JS 모듈 (로드 순서)

| # | 파일 | 담당 기능 | 대표 함수 |
|---|---|---|---|
| 1 | `js/core.js` | 데이터 로드/저장, 백업, 날짜·직원 헬퍼, 부서 이동(`deptOn`), 초안 되돌리기, 특수일(인원·CG 데스크 2명·**8뉴스 편성** `news:'weekday'|'weekend'`), 평일 틀 판단 `isWeekdayForm`(생성·표·점검·가져오기·브러시 공통 — 공휴일 기본: 설·추석만 주말 틀, 그 밖은 평일 틀. **쉬는 날 판단엔 쓰지 말 것** → `ndIsOffDay`), 백업·파일로 서버 전체 교체 `_ndRestoreDoc(o, okMsg)`(백업의 옛 `_dataRevision`을 서버 지금 번호로 바꿔 저장, 성공한 뒤에만 안내 — `restoreLocalBackup`·`importBackupFile`·admin.js `importData`) | `loadData` `saveData` `deptOn` `getStaff` `toDateStr` `isOnLeave` `isWeekdayForm` `_ndRestoreDoc` |
| 2 | `js/project-gantt.js` | 프로젝트 간트 탭. 작성자(일반 직원)도 고치므로 저장·홈 표시·삭제는 `_pjCommit` → `_ndCommit(…, ['projects'])`(문서 전체 saveData 아님) | `renderProject` `openProjectModal` `saveProject` |
| 3 | `js/nav-admin.js` | 탭 전환 `showView`, 관리자/마스터 로그인 | `showView` `toggleAdmin` `openMasterLogin` |
| 4 | `js/home.js` | 홈 화면(오늘의 근무, 8진/뉴오 깜빡임, masonry 배치, 큰 화면 ≥1560px 3분할 + 경계 블러 전환), 테마 전환 | `renderHome` `layoutHomeMasonry` `_hm3Sync` `_hm3Transition` `toggleTheme` |
| 5 | `js/table-view.js` | 근무표 탭(표, 기간 선택·저장, 이미지로 저장), 칸이 무엇으로 보이는지(`workCellRole`, 통계용) | `renderTable` `workCellRole` `captureSchedule` |
| 6 | `js/calendar.js` | 달력 탭(iOS 캘린더식 월 보기: 주 줄·이어지는 막대·+N개), 구글 캘린더(.ics) 병합·댓글, 날짜 창(일정 위주·근무자는 "근무자 보기"로 펼침). 캘린더별 보이기는 이 기기에만(localStorage `nd_gcal_off`) | `renderMonth` `showDayModal` `_dayWorkToggle` `toggleGcal` |
| 7 | `js/generation.js` | 근무 자동생성(단계별 desk→danjik→rest, 재시도). 사람 엑셀(2026 1~10월) 규칙에 맞춤: 평일 틀 공휴일(8뉴스 평일 편성)=평일 인원+일근, 주말 틀 공휴일=조근조 쉼+일근+주말8진, 8진·뉴오는 그날 근무자 안에서(`_swapIn`), 당직날도 근무일, 조근 대타=`canJogeunSub` 표시자·겹침 금지, 금8진→토조·전날 저녁→조근 금지, 뉴오 주1회, 일근+토조 월1회, 손입력 칸·앞 단계 역할 보존. **주 7일 금지(하드)**: 모든 배정·최후 수단에 `_cap`(그 주 6일까지), 주 근무일 `getWC`=지금까지+앞으로 정해진 근무(`_commitWk`), 범위 앞 같은 주 근무도 셈(`_genSchedOn`), 토·일·금 당직 주 초 예약(`plan.dj`/`dj2`/`djFri`, 토·금 당직자는 낮근무 3일 — 금요 당직자는 주말 근무조에서 빠지고 월~목 하루 쉼). 일근은 비우지 않음(6일째 허용→근무자에서 돌림). 재시도는 매번 생성 전 상태에서(`_restoreExact`), 점검에 당직·주7일. 계약 종료·파견자 제외(`_okAvail`), 3D 보장은 인원 목표 안에서. 평일 하한 20명·VW 7명 채우기(주 6일 안, 특정일 CG 인원은 존중), 오전데를 CG 데스크보다 먼저(겹침 금지), 데스크 비우는 당직은 뒤로(`_breaksDesk`, 주말 당직 예약자가 대신하면 `_planDuty` 재예약), 주말 당직 공정(`wkndDanjik`), 당직 퇴근·비번날 근무 확인(`_busyAfter`). 그날 근무일 셈 `_genDayUnits`. **주말 우선**: 주 초에 토·일 근무조(`crewSat/SunVW·CG`)와 예약자 평일 쉬는 날(`restOn`, 월~금 고르게)을 정하고, 평일은 나머지로 채움(휴가 많은 주 19~20명), 끝에 평일→주말 맞바꾸기 보정. **주말 인원은 근무표 칸·엑셀 합계와 같은 셈** `_genVC`(일근=자기 부서, XR·주말 PJ=CG 쪽) — 일요 일근은 근무자보다 먼저 정함(`sunIl`), 목표·보정·점검 모두 이 셈. 엑셀 비교 반영: 주말 데스크 돌림에 VW데 1순위·오전데 1순위도(1.5배 가중, 토·일 짝 반반), 조근조는 주말 8진 안 맡음, 대휴는 부서별 휴가 많은 평일을 피함, 설·추석 평일은 토요일 목표, 평일 CG 데스크 후보는 같은 순위 여러 명. 당직(사람 방식): 지난 주말 당직 뒤 비번=쉬는 날, 평일(월~목) 당직이면 남은 예약 휴식 취소, 그 주 5일 못 채우는 후보 뒤로(`_under`), 주말 당직 2주 연속 금지(`lastWkndDj`, 시작 전 2주 주말 당직도 `wkndDanjik`에), 7일 뒤 같은 요일 뒤로, 데스크 순위 벌점 40, 전날 일근 뒤로·전날 평일 8진 앞으로, 1·2순위 짝 보호(`_pairOff`·`_pairBad`). 8진·뉴.오·주말 8진은 이번 생성 횟수 1순위(`_gW8`·`_gNo`·`_gE8`). 조근 대타는 근무자보다 먼저 표시자 중에서(`_jgPre`, 어제 대타 이어 씀, 스포츠·PJ 안 씀). 검사 `swap-backend/test-generation-rules.cjs`. 생성 중 표시 `_ndGenBusy`(나눠 도는 동안 sync-init.js 동기화가 data를 안 바꿈) | `generateDraftSchedule` `_generateScheduleCore` |
| 8 | `js/workshop.js` | **참고 자료 창**(`wsInfoToggle`: 넓은 화면은 문서 PiP/새 창이라 브라우저 밖으로 옮길 수 있음 — 근무 통계 올해+초안, 직원B 근무일=근무+평일휴가 vs 평일 수·지난 기간 초과, 직원B 남은 휴가 직접 입력 `data.freelancerLeave`(관리자 패널 '휴가' 탭 `renderFlLeaveTab`과 참고 자료 '직원B 남은 휴가'는 같은 2분할 `_flSplitHTML`(왼쪽 직원B 목록 `flSelect`, 오른쪽 남은 휴가·메모 `flSaveOne` + 휴가 내역 표 — 날짜는 '03/21, 03/22'처럼 `_wlDates`, 관리자 탭에선 WISE에 없는 휴가 직접 넣기 `flAddLeave`(manual:true, `flDelLeave`로 지움)) — 저장 `wsInfoSaveLeave(btn)`은 누른 버튼이 든 곳에서 읽음), 이름 누르면 `wsInfoPerson`→**직원 편집 창**(왼쪽 계약·수습·부서 이동 예약은 접힘 `details.sm-fold`, 오른쪽 **WISE 휴가 내역** `#modal-wise-group`: `_wl*` WISE 열기 창+북마클릿 루트 `leave-import.js`가 postMessage로 보냄 / 붙여넣기, `freelancerLeave[id].wise`)).  근무표 작성소(초안 표, 브러시, 열 순서 드래그) | `renderWorkshopTable` `setWsBrush` `_applyBrush` |
| 9 | `js/excel-import.js` | 엑셀/이미지 가져오기(파싱·적용, 비고·조근 처리) | `parseExcelSchedule` `_doApplyImageSchedule` |
| 10 | `js/events.js` | 일정(이벤트) 추가·상세·수정, 댓글 | `openEventModal` `openEventDetail` |
| 11 | `js/publish.js` | 하루 보기, 근무표 배포, 배포 기록 | `publishSchedule` `wsShowDay` `openDeployLog` |
| 12 | `js/leave-request.js` | 휴가신청(병합저장·낙관적 잠금) | `renderLeaveReqView` `openLrPopup` |
| 13 | `js/staff.js` | 직원 목록/폼 | `renderStaffTable` `saveStaff` |
| 14 | `js/admin.js` | 관리자 탭(통계, 하루 수정, 설정, 비밀번호, 알림제어, 로그인 기록), 푸시 구독·개인 알림 설정 서버 저장 | `_workStatsAuto` `renderWorkStats` `_pushSavePrefs` `saveSettings` |
| 15 | `js/cell-edit.js` | 토스트, 셀 직접 수정 팝업 | `toast` `cellClick` `setCell` |
| 16 | `js/login-ui.js` | 직원 로그인, 상단 메뉴, 시트(계정·알림) | `loginUser` `openSheet` `openAccountSheet` |
| 17 | `js/notice.js` | **병합 저장 `_ndCommit(mutate, keys)`**: 일반 직원 경로의 main 쓰기(공지·공감·댓글·일정·프로젝트)는 이것, 휴가신청·투표(`_pollCommit`)도 같은 방식 — 문서 전체 saveData 금지(서버 최신본을 받아 mutate → `updated_at` 낙관적 잠금 PATCH → 재시도, 성공 뒤 `ndAdoptMergedSave`). keys = 고치는 main 칸(기본 `['notices']`, 일정 `['events']`, 프로젝트 `['projects']`), 결과 `true`/`'gone'`(mutate가 false = 대상 없음)/`false`(실패). 오늘의 공지, 공감(리액션), 확인함 기록(서버 별도 칸 nd_data id='seen', `_noticeSyncSeen`), 댓글, 지난 공지(카드 2열 → 누르면 확인 창이 위에, `openNoticeHistory`), 푸시 발송. 게시가 끝난 공지를 수정하면 기간 기본값 '게시 끝남(그대로)'(`keep`) — 홈에 다시 안 올림 | `renderNoticeBar` `openNoticeModal` `openNoticeHistory` `deleteNotice` |
| 18 | `js/poll.js` | 오늘의 투표(만들기·수정·자세히 보기·댓글) | `renderPolls` `openPollCreate` |
| 19 | `js/schedule-finder.js` | 저녁 같이 먹을 사람 찾기, 개인 근무 보기, 내 근무 카드 | `openDinnerFinder` `openPersonSchedule` `renderMySchedule` |
| 20 | `js/sync-init.js` | **앱 부팅**(데이터 로드, 2분 자동 동기화, 첫 렌더). 데이터·로그인 확인 요청은 `dashboard.html` `<head>` 인라인 스크립트가 맨 먼저 동시에 시작(`window.__ndBootMain`·`__ndBootSession`) — 여기서와 `employee-auth.js` `employeeRestore`가 그 응답을 씀. head의 주소·키는 `core.js` `SB_URL`·`SB_KEY`와 같게 유지 | `_migrateRemote` `_rerenderActiveView` |
| 21 | `js/a2hs.js` | 홈 화면에 추가 안내 (+끝부분에 직원 편집 모달 `#staff-edit-modal` HTML 삽입 → staff-modal.js보다 먼저 와야 함) | `installA2HS` |
| 22 | `js/staff-modal.js` | 직원 편집 모달(카드 UI) | `openStaffModal` `saveStaffModal` |
| 23 | `js/pull-refresh.js` | 당겨서 새로고침 | — |
| 24 | `js/nd-select.js` | 넓은 화면(≥1001px·마우스) 드롭다운을 앱 스타일 목록으로(원래 select가 값의 주인, change 이벤트 그대로) | `ndSelectClose` |
| 25 | `js/nd-people.js` | 사람 고르기 공통 부품(이름·부서·초성 검색 + 추천 목록 + 고른 사람 태그) — 일정·프로젝트·공통 근무일 조회 | `ndPeoplePicker(host,{selected,onChange})` |
| 26 | `js/nd-cal.js` | 팝업 달력(날짜·기간·시작 고정·점 표시, `months:2` 두 달 나란히)·시간 직접 입력(넓은 화면에서만 보임, 값은 원래 input에), 메뉴 전환 모핑. 넓은 화면에선 앱의 모든 날짜 칸이 이 달력 팝업으로 열림: 도구막대 기간(`ndToolbarCalendar`), `…-start`/`…-end` 짝은 두 달 기간 팝업, 날짜 하나는 한 달 팝업(`ndDatePopup`). 빼려면 input에 `data-nd-native` | `ndCal` `ndTime` `ndDateInput` `ndTimeInput` `ndMorph` `ndDatePopup` |
| 27 | `js/nd-comments.js` | 투표·공지 댓글 공통 부품(목록 + 입력칸, Enter 등록·Shift+Enter 줄바꿈). 저장은 각 기능이 서버 최신본에 병합(투표 `_pollCmtAdd/_pollCmtDel`→`_pollCommit`, 공지 `_noticeCmtAdd/_noticeCmtDel`→`_ndCommit`) | `ndCmtSection` `ndCmtRefresh` |
| 29 | `js/alarms.js` | **알림함**: 받은 휴가 조정·데스크 조정 요청 등. 서버 notify mode `direct`가 `nd_data id='alarms'` payload[직원 id]에 쌓음(60일·100건) → 여기선 내 것만, 종 버튼 `#hdr-alarm`(웹·휴대폰 = 위쪽 이름 바, 앱 = 제목줄 렌치 왼쪽) 안 읽은 수(localStorage nd_alarm_seen_<id>), 시트 `openAlarmStation`. 휴가신청 쪽(js/leave-request.js): 그 날 6번째 이후(`LR_OVER`=5)·데스크 가능한 사람(같은 부서 deskPriority) 모두 휴가가 되면 확인 팝업 `_lrConfirmPop` → 신청 + `_lrSendAlarms`, 표에선 그런 칸 주황(`_lrFlags`, 신청 순서 = entries 배열 순서) | `alarmLoad` `openAlarmStation` |
| 31 | `js/news-cue.js` | **오늘 8뉴스·오뉴스 진입시간**(NDS 큐시트 방송 시작). 데이터 `nd_data id='cue'`(main 밖, 쓰기는 notify mode `cue`, 60일). **서버가 먼저**(notify `serverCue` — 비밀값 NDS_ID·NDS_PW, 크론 오후 5분·그 외 15분, leader 'server'), 서버가 못 읽으면 **담당 PC 1대만** NDS(`desktop/nds-cue.js`, 계정 `desktop/nds-account.json` — 앱 설치 파일에만 묶임, 웹 `download/`엔 작은 설치 도우미만): 서버 자리표 `leader`(20분)를 저장 때 잡음 — 다른 앱은 자리표가 살아 있으면 읽기만, 담당은 오후 5분·그 외 15분마다. 서버: 오늘 시각이 바뀌면 그날 8진·뉴오에게 '진입시간 변경', 크론은 진입 20분 전~진입 전 사이 아직 그 시각으로 안 보냈으면 보냄(`days[오늘].sent`), 오후 1시 넘어 받은 오늘 기록에 오뉴스 없으면 안 보냄. 홈 칩 `_cuePaint`, 그날 8뉴스 시각 `cueNews8(ds)`(공지에 직접 넣은 시각이 먼저, 없으면 큐시트 — 서버 8진 알림과 같은 규칙), 평소와 다르면 공지 자동(id `cue8-날짜`, 알림 없음, `_cueNotice`·`_cueAct`). 자동으로 올린 시각·글은 main `cue8Auto[날짜]={t,text}`(7일): 사람이 지웠으면 같은 시각으론 다시 안 올림, 시스템이 지우면(평소로 돌아옴·공지에 시각 직접 넣음) 기억도 지움 | `cueLoad` `cueDay` `cueNews8` `_cueTick` |
| 32 | `js/holiday-work.js` | **관리자 '휴일 사전근무' 탭**: 앞으로 두 달 게시된 근무표의 휴일(토·일·공휴일 — `ndIsOffDay`, 성탄절 같은 평일 틀 공휴일 포함. 근무시간 입력 대휴 `_wtHolHours`·직원B 휴가 일수 `_flAddDays`도 이걸 씀)마다 그날 몇 시라도 일하는 **직원A**(`workCellRole` — 전날 당직 '퇴근' 포함, 근무 시간 표시) → 근무내용(기본 CG제작·SPORTS 스포츠CG, PC에 기억 nd_hw_cont) → WISE 휴일근무 사전신청 peda0215(`desktop/wise-fetch.js wiseHolidayApply`: 근무일자 입력 → grid1 이름 맞는 줄 SERV_YN Y·SERV_CONT → [결재]). 결재까지 했으면 `data.hwApply[날짜]` | `renderHworkTab` `_hwRun` `ndIsOffDay` |
| 33 | `js/onboard.js` | **처음 로그인 알림 켜기 안내**(`ndNotifyPrompt` — 이 기기 알림 꺼져 있으면 한 번, 나중에=7일, 아이폰 사파리(홈 화면 앱 아님)만 [방법 보기]; 앱은 사용법·휴대폰 안내 뒤) + **휴대폰·앱으로 쓰기**(`ndAppGuide` 시트 — QR·갤럭시(삼성 인터넷 설치 아이콘)/아이폰(주소창 안 ≡ → 공유 → 쓸어올려 홈 화면에 추가)/크롬/PC, 버튼 모양 그림 `_gdMock`, 기기별 순서 `_gdSteps`) + **PC 앱 휴대폰 팝업**(`ndPhonePop` — 제목줄 휴대폰 버튼, 왼쪽 QR·오른쪽 기기 탭) | `ndNotifyPrompt` `ndAppGuide` `ndPhonePop` |
| 34 | `js/cg-assign.js` | **CG배정 현황**(PC 사이드바 근무표 아래, `showView('cgassign')`) — 오늘 CG 근무자(8데스·5데스·XR 빼고, 홈 CG 근무자 기준) 카드 + NDS CG의뢰(`window.ndApp.ndsCg`, desktop/nds-cue.js) 0002 배정=작업 중(파란 빛)·그 밖 대기(회색), 왼쪽 배정 기다리는 의뢰(보완요청 회색, × 숨기기=이 PC만)·오른쪽 카드(프로젝트 인원 늘 포함, CG 인원 밖 작업자도 카드, [사람 추가]·× 빼기=그날·이 PC), 새 의뢰면 오른쪽 위 알림 카드(`ndApp.toast`). 바뀐 칸만 고침(`_cgaKeyed` FLIP — 상태 변화·순서·새 의뢰가 부드럽게), 카드 누르면 사람 팝업(`_cgaPersonPop`, 지금 숨김 CGA_PERSON_POP). 카드 오른쪽 클릭 = 앵커·PT 직접 배정/완료(`_cgaCtx`·`_cgmCommit`, 공용 nd_data 'cgman' 낙관적 잠금). 이 화면을 연 PC만 20초마다 | `renderCgAssign` `_cgaPeople` `_cgaPick` `_cgaCtx` `_cgmCommit` |
| 30 | `js/app-mode.js` | **근무표 앱(설치판)**(`desktop/` Electron — 배포 사이트를 `?app=ws`로 띄움, `html.nd-app`·`ND_APP`, 모든 직원용 — 화면·데이터는 웹과 같음) 전용 제목줄 `#nd-titlebar`(오른쪽 끝 = 관리자면 [WISE 로그인] `ndWiseLogin`(로그인 화면 intLoginWise.jsp만 작은 창으로, 로그인 순간 숨김. 연결되면 'WISE 연결됨' 초록 점, 로그인 뒤 식단 바로 받기 — desktop/wise-fetch.js wiseLogin·wiseCheck. 앱이 켜져 있는 동안 10분마다 `wiseKeepAlive`가 WISE 세션으로 가벼운 조회(오늘 점심 식단 CMCA0540)를 보내 로그인을 이어 줌, 쿠키 30일, 끊기면 `onWiseState`로 버튼 표시) + header에서 옮긴 날짜·라이트/다크 + 렌치 `_ndToolToggle` 앱 버전·업데이트 확인/설치(desktop/updater.js, 공유 폴더 latest.json) — 앱에선 header 숨김, 사이드바 '계정 정보' 자리에 이름): 앱 이름 + 관리자면 [근무표 작성소]·관리자 탭(`.admin-tabs`를 옮겨 옴), 일반 직원이면 [알림 설정]. **PC 알림**: Electron은 웹 푸시를 못 받아 `push_subs`에 endpoint `ndapp:<PC>`로 등록(js/admin.js `_appPushEnable`, 먼저 notify `mode:'hello'`로 서버 판 확인) → notify 함수가 `nd_data id=appinbox_<PC>`에 쌓음 → desktop/app-notify.js가 10초마다 읽어 화면 오른쪽 위 알림 카드(desktop/toast.js·toast.html — 윈도 알림은 위치를 못 정함), **8진 근무 알림·오뉴스 진행 알림(서버 newsohGo, 뉴.오 근무자, 기본 16:30)만** 모니터마다 화면 테두리 빨간 빛 깜빡임 + 위쪽 가운데 '8진입니다'/'오뉴스 진행입니다' 바·[5분 뒤 다시 알림]·[확인](desktop/alert.js·alert-glow.html·alert-bar.html — 확인 전까지, 클릭은 뒤로 지나감), 켜져 있으면 창 닫아도 트레이·윈도 시작 때 숨은 채 켜짐. 휴대폰 켤 때 지우는 것도 `ndapp` 행은 남김. WISE 가져오기는 관리자 패널 '휴가' 탭에서만, 앱이 WISE를 숨긴 채 조회(로그인 때만 창 보임)하고 화면엔 진행 카드 `_wlProg`, 저장은 직원B 이름만(`_wlImport`·`_wlDedup`). 윈도 제목줄은 숨기고 창 버튼 색을 `ndApp.setTitleBar`로 맞춤. 앱 모드의 나머지: 관리자로 들어오면 작성소부터(`_enterAdmin`), 빨간 관리자 띠·알림 설정 숨김(Electron은 웹 푸시 못 받음), WISE `wlAppFetch`(js/workshop.js → desktop/wise-fetch.js), CSS는 css/dark.css. 개발판 `desktop/근무표_개발판.bat`, 설치 파일 `node desktop/build.cjs`(설치 도우미도 같이 구움). **웹(PC 브라우저) 설치 안내** `ndAppPromo` → `download/NDSchedule-Install.exe` = 작은 설치 도우미(앱은 안 담음 — 회사 PC(사내망)에서 최신 근무표를 받아 확인·설치, `desktop/setup-ui`), 렌치 업데이트 때 진행 창도 같은 exe(`desktop/updater.js`가 `--update`로 띄우고, 창이 뜬 뒤(`--ready`) 앱이 꺼짐 — 받는 진행은 `ndApp.onUpdateProgress`로 렌치 카드에). 공유 폴더 자리는 `desktop/share-dirs.js` 한 곳(사이트 파일엔 쓰지 않음), `py deploy.py`는 `download/NDSchedule-Install.exe`가 없으면 멈춤. **윈도 PC 웹 막기** `ndPcBlock`(근무표 앱 아님 + 윈도 PC + 배포 사이트면 부팅 때 설치 안내로 화면 전체를 덮음, `html.nd-pc-blocked` — 숨김 규칙은 css/dark.css, `#apx-pop`·`#nd-modfail`만 남김): 주소 `?pc=1` = 이 탭에선 안 막음(sessionStorage `nd_pc_bypass`), `?pc=0` = localhost에서도 막는 화면 미리 보기.  **WISE 근무시간 입력** `ndWorkTimeOpen`(홈 '이번 주 내 근무' 오늘 칩 — 지금은 정근 12:00–21:00만 `_wtRegular`, 휴일이면 당일대휴 선택, [채우기만]/[채우고 결재] → desktop/wise-fetch.js `wiseWorkTime`이 pedb0240 팝업을 보이는 창으로 열어 desktop/wise-work.js `__ndwk`로 칸 찾아 채움, 결재 확인창은 사용자가).(알림 설정 시트·알림 제어 탭, 앱에서만 — 서버 안 거치고 이 PC에 카드·8진·오뉴스 진행). | `_ndTitlebarInit` `_ndTitlebarSync` |
| 28 | `js/meal.js` | 홈 '오늘의 식사'(SBS 목동 조식·점심·석식, 예전 빠른 접속 자리. 기본 위치 = 이번 주 내 근무 바로 아래(DOM을 #my-schedule-card 뒤로 옮김), 카드를 길게 누르면(PC 오른쪽 클릭) '맨 아래로 내리기/맨 위로 올리기' — 이 기기에 기억 localStorage nd_meal_top('0'=아래) — `_mealPosPop` `mealSetTop`, 길게 누르기는 js/notice.js `_bindLP(el, fn(x,y))`) + '식단 가져오기' 창. 데이터 `nd_data id='meal'`(읽기=REST, 쓰기=notify 함수 mode `meal`만). 가져오기는 **근무표 PC 앱이 저절로**(`_mealAppAuto` → desktop/wise-fetch.js `fetchMealDays`가 WISE 세션 창에서 루트 `meal-import.js`의 collect를 실행, 켤 때·3시간마다·휴가 가져오기 직후, 저장본이 6시간 넘었거나 사흘 안에 끝날 때) → notify mode `meal` 저장 → 웹·앱 모두 표시. 웹·앱 모두 가져오기 버튼 없음(앱 로그인이 풀렸으면 관리자에게만 'WISE 로그인하고 받기' 글자 링크). WISE 로그인 쿠키는 앱이 하루짜리로 바꿔 저장(persistWiseCookies). 테스트 `swap-backend/test-meal.cjs` | `renderMeal` `openMealImport` |

참고: `events.js`·`notice.js`는 원래 스크립트의 떨어진 두 구간을 합친 것이고, `excel-import.js`가 `events.js`보다 먼저 로드된다(함수 선언뿐이라 동작 동일). 그래서 js 파일을 태그 순서로 이어 붙여도 원본과 글자 순서가 완전히 같지는 않다.

## 모듈 로드 실패 안내

폰 네트워크가 끊겨 js/·css/ 파일 하나라도 못 받으면, 반쯤 깨진 채 저장되는 것을 막기 위해 화면 전체에 "앱을 다 불러오지 못했어요 — 새로고침" 안내(`#nd-modfail`)가 뜬다.
- 실패 기록: `<head>` 첫 인라인 스크립트의 `error` 캡처 리스너(`window.__ndModFail`)
- 안내 표시: `pull-refresh.js` 태그 바로 뒤 인라인 스크립트
- CDN 라이브러리(xlsx, html2canvas, 폰트) 실패는 대상 아님(예전처럼 해당 기능만 안 됨). xlsx·html2canvas는 `<head>`에서 받지 않고 `ndLoadLib('xlsx'|'h2c')`(core.js)로 쓸 때 받음(엑셀 가져오기 창 열 때, 이미지 저장 때 / html2canvas는 부팅 4초 뒤 미리)

## 이 기기에만 남는 값(localStorage, 서버 아님)

- `nd_gcal_off` — 숨긴 구글 캘린더 id 목록(calendar.js)
- `nd_lr_alarm_sent` — 휴가 조정 알림 보낸 (신청자, 날짜, 종류) — 같은 알림은 이 기기에서 한 번만(leave-request.js `_lrSendAlarms`)
- `nd_unsaved_last` — 서버에 못 올린 마지막 문서 사본 하나(data-save.js, 예전 `nd_unsaved_<시각>`은 정리됨)

## CSS 모듈 (로드 순서 = 덮어쓰기 우선순위)

`base` → `dark` → `nav` → `home` → `notice-poll` → `toss-common` → `calendar` → `table` → `modal` → `admin` → `gantt-etc` → `sheet-login` → `nd-select`(드롭다운·사람 고르기 목록) → `nd-cal`(팝업 달력·시간 입력) → `popup-wide`(넓은 화면 입력 팝업 2분할: 왼쪽 430px 달력/선택, 오른쪽 내용, 폭 min(1080px, 화면-48px)) → `meal`(오늘의 식사 카드·식단 가져오기 창)
(그 뒤에 index.html의 작은 인라인 `<style>`들, `work-swap.css`, `employee-auth.css`가 온다.)
뒤 파일이 앞 파일을 이긴다. 다크모드 공통 변수는 `dark.css`, 기능별 다크 규칙은 각 기능 CSS 안에 있다(`grep 'data-theme="dark"' css/*.css`).

## 함수 찾기

```
grep -n "function renderHome" js/*.js
```
함수 이름으로 검색하면 어느 파일인지 바로 나온다.

## 캐시와 배포

- 각 `<script>`/`<link>`에 `?v=파일md5앞8자리`가 붙어 있다. **파일을 고치면 이 값도 바뀌어야** 폰/PWA가 새 파일을 받는다.
- 로컬 작업 폴더에서는 `py deploy.py`가 `?v=` 갱신 → 버전 표기 갱신 → index.html 복사 → GitHub 폴더로 `js/` `css/` 포함 복사 → `git add`(stage)까지 한다(`--check`로 미리보기, `--pull`로 GitHub 쪽 변경 가져오기). 그다음 GitHub 폴더에서 commit/push.
- GitHub에서만 바뀐 파일은 덮어쓰지 않고 멈춘다(마지막 배포 기준 `.deploy-state.json`과 비교). 이때 `py deploy.py --pull` 후 다시 배포.
- 테스트(`swap-backend/test-*.cjs`)는 `swap-backend/app-source.cjs`의 `appSource(html경로)`로 js/·css/를 다시 한 파일로 합쳐 읽는다. HTML에서 코드를 잘라 쓰는 스크립트는 이걸 쓸 것.
- GitHub 저장소에서 직접 고칠 때(GPT 등): 고친 파일의 `?v=` 값을 index.html에서 함께 바꾸고(아무 새 값이면 됨), **index.html과 js/·css/ 변경을 한 커밋으로** push할 것. index.html만 올리고 js/를 빠뜨리면 앱이 통째로 안 뜬다.
