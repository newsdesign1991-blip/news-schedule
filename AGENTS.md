# 작업 안내 (AI 공용)

이 앱은 2026-10-05부터 **기능별 파일로 나뉘어 있다.** 먼저 `MODULES.md`를 읽을 것.

- 로직은 `js/*.js`, 스타일은 `css/*.css`에 있다. `dashboard.html`(= GitHub의 `index.html`)은 뼈대와 모달 마크업뿐이다. `dashboard.html`에서 함수 본문을 찾지 말고 `grep -n "function 이름" js/*.js`로 찾는다.
- `<script>`/`<link>` 순서 변경, `defer`/`async`/`type="module"` 추가 금지. 같은 이름의 함수를 두 파일에 만들지 말 것.
- 배포: 작업 폴더에서 `py deploy.py` → GitHub 폴더(`C:\Users\sbs\Documents\GitHub\news-schedule`)에 stage까지 된다. 그다음 commit/push. `index.html`만 복사하거나 커밋하면 앱이 깨진다(js/·css/·?v= 갱신이 함께 가야 함).
- GitHub 폴더에서 직접 고쳤다면, 작업 폴더에서 `py deploy.py --pull`로 가져온다.
- `swap-backend/test-*.cjs` 테스트는 `swap-backend/app-source.cjs`로 모듈을 다시 합쳐 읽는다. HTML에서 코드를 잘라 쓰는 새 테스트/스크립트도 `appSource(file)`을 쓸 것.
