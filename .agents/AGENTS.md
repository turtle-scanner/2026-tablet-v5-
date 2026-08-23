# Project Specific Rules

- 모의고사 회차 추가 시 필수 자동화 작업 절차:
  1. `data/exams.json` 및 `data/default_exams.json`에 신규 모의고사 데이터 추가
  2. `export_fallback_js.py`를 실행하여 `public/fallback_exams.js` 내장 번들 동시 업데이트
  3. `public/index.html`의 드롭다운 `<option>` 및 스크립트 버전 캐시 파라미터(`v=...`) 갱신
  4. `git add .`, `git commit`, `git push origin main` 및 `git push origin main:master` 를 실행하여 Render 온라인 웹사이트까지 100% 교체 동기화
