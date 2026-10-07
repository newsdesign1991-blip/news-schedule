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
| 1 | `js/core.js` | 데이터 로드/저장, 백업, 날짜·직원 헬퍼, 부서 이동(`deptOn`), 초안 되돌리기, 특수일 | `loadData` `saveData` `deptOn` `getStaff` `toDateStr` `isOnLeave` |
| 2 | `js/project-gantt.js` | 프로젝트 간트 탭 | `renderProject` `openProjectModal` |
| 3 | `js/nav-admin.js` | 탭 전환 `showView`, 관리자/마스터 로그인 | `showView` `toggleAdmin` `openMasterLogin` |
| 4 | `js/home.js` | 홈 화면(오늘의 근무, 8진/뉴오 깜빡임, masonry 배치, 큰 화면 ≥1560px 3분할 + 경계 블러 전환), 테마 전환 | `renderHome` `layoutHomeMasonry` `_hm3Sync` `_hm3Transition` `toggleTheme` |
| 5 | `js/table-view.js` | 근무표 탭(표, 기간 선택·저장, 이미지로 저장), 칸이 무엇으로 보이는지(`workCellRole`, 통계용) | `renderTable` `workCellRole` `captureSchedule` |
| 6 | `js/calendar.js` | 달력 탭(iOS 캘린더식 월 보기: 주 줄·이어지는 막대·+N개), 구글 캘린더(.ics) 병합·댓글, 날짜 창(일정 위주·근무자는 "근무자 보기"로 펼침) | `renderMonth` `showDayModal` `_dayWorkToggle` `toggleGcal` |
| 7 | `js/generation.js` | 근무 자동생성(단계별 desk→danjik→rest, 재시도) | `generateDraftSchedule` `_generateScheduleCore` |
| 8 | `js/workshop.js` | 근무표 작성소(초안 표, 브러시, 열 순서 드래그) | `renderWorkshopTable` `setWsBrush` `_applyBrush` |
| 9 | `js/excel-import.js` | 엑셀/이미지 가져오기(파싱·적용, 비고·조근 처리) | `parseExcelSchedule` `_doApplyImageSchedule` |
| 10 | `js/events.js` | 일정(이벤트) 추가·상세·수정, 댓글 | `openEventModal` `openEventDetail` |
| 11 | `js/publish.js` | 하루 보기, 근무표 배포, 배포 기록 | `publishSchedule` `wsShowDay` `openDeployLog` |
| 12 | `js/leave-request.js` | 휴가신청(병합저장·낙관적 잠금) | `renderLeaveReqView` `openLrPopup` |
| 13 | `js/staff.js` | 직원 목록/폼 | `renderStaffTable` `saveStaff` |
| 14 | `js/admin.js` | 관리자 탭(통계, 하루 수정, 설정, 비밀번호, 알림제어, 로그인 기록), 푸시 구독·개인 알림 설정 서버 저장 | `_workStatsAuto` `renderWorkStats` `_pushSavePrefs` `saveSettings` |
| 15 | `js/cell-edit.js` | 토스트, 셀 직접 수정 팝업 | `toast` `cellClick` `setCell` |
| 16 | `js/login-ui.js` | 직원 로그인, 상단 메뉴, 시트(계정·알림) | `loginUser` `openSheet` `openAccountSheet` |
| 17 | `js/notice.js` | 오늘의 공지, 공감(리액션), 확인함 기록(`it.seen`, 창 열면 1회 `_noticeMarkSeen`), 댓글, 푸시 발송 | `renderNoticeBar` `openNoticeModal` `deleteNotice` |
| 18 | `js/poll.js` | 오늘의 투표(만들기·수정·자세히 보기·댓글) | `renderPolls` `openPollCreate` |
| 19 | `js/schedule-finder.js` | 저녁 같이 먹을 사람 찾기, 개인 근무 보기, 내 근무 카드 | `openDinnerFinder` `openPersonSchedule` `renderMySchedule` |
| 20 | `js/sync-init.js` | **앱 부팅**(데이터 로드, 2분 자동 동기화, 첫 렌더) | `_migrateRemote` `_rerenderActiveView` |
| 21 | `js/a2hs.js` | 홈 화면에 추가 안내 (+끝부분에 직원 편집 모달 `#staff-edit-modal` HTML 삽입 → staff-modal.js보다 먼저 와야 함) | `installA2HS` |
| 22 | `js/staff-modal.js` | 직원 편집 모달(카드 UI) | `openStaffModal` `saveStaffModal` |
| 23 | `js/pull-refresh.js` | 당겨서 새로고침 | — |
| 24 | `js/nd-select.js` | 넓은 화면(≥1001px·마우스) 드롭다운을 앱 스타일 목록으로(원래 select가 값의 주인, change 이벤트 그대로) | `ndSelectClose` |
| 25 | `js/nd-people.js` | 사람 고르기 공통 부품(이름·부서·초성 검색 + 추천 목록 + 고른 사람 태그) — 일정·프로젝트·공통 근무일 조회 | `ndPeoplePicker(host,{selected,onChange})` |
| 26 | `js/nd-cal.js` | 팝업 달력(날짜·기간·시작 고정·점 표시)·시간 직접 입력(넓은 화면에서만 보임, 값은 원래 input에), 메뉴 전환 모핑(블러로 사라짐→크기 슈욱→또렷하게) | `ndCal` `ndTime` `ndDateInput` `ndTimeInput` `ndMorph` |
| 27 | `js/nd-comments.js` | 투표·공지 댓글 공통 부품(목록 + 입력칸, Enter 등록·Shift+Enter 줄바꿈). 저장은 각 기능이 서버 최신본에 병합(투표 `_pollCmtAdd/_pollCmtDel`→`_pollCommit`, 공지 `_noticeCmtAdd/_noticeCmtDel`→`_ndCommit`) | `ndCmtSection` `ndCmtRefresh` |
| 28 | `js/meal.js` | 홈 '오늘의 식사'(SBS 목동 조식·점심·석식, 예전 빠른 접속 자리) + '식단 가져오기' 창. 데이터 `nd_data id='meal'`(읽기=REST, 쓰기=notify 함수 mode `meal`만). 가져오기는 회사 PC WISE 탭에서 즐겨찾기(북마클릿 → 루트 `meal-import.js`)가 그 탭 로그인으로 읽어 저장 — WISE는 로그인·사내망이 필요해 앱/서버가 직접 못 읽음. 테스트 `swap-backend/test-meal.cjs` | `renderMeal` `openMealImport` |

참고: `events.js`·`notice.js`는 원래 스크립트의 떨어진 두 구간을 합친 것이고, `excel-import.js`가 `events.js`보다 먼저 로드된다(함수 선언뿐이라 동작 동일). 그래서 js 파일을 태그 순서로 이어 붙여도 원본과 글자 순서가 완전히 같지는 않다.

## 모듈 로드 실패 안내

폰 네트워크가 끊겨 js/·css/ 파일 하나라도 못 받으면, 반쯤 깨진 채 저장되는 것을 막기 위해 화면 전체에 "앱을 다 불러오지 못했어요 — 새로고침" 안내(`#nd-modfail`)가 뜬다.
- 실패 기록: `<head>` 첫 인라인 스크립트의 `error` 캡처 리스너(`window.__ndModFail`)
- 안내 표시: `pull-refresh.js` 태그 바로 뒤 인라인 스크립트
- CDN 라이브러리(xlsx, html2canvas, 폰트) 실패는 대상 아님(예전처럼 해당 기능만 안 됨)

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
