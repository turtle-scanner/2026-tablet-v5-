document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let currentExam = null;
  let currentExamId = 'exam-0905_01';
  let currentSectionKey = 'P'; // P: 1교시 교육학, A: 2교시 전공A, B: 3교시 전공B
  let currentExamPageNo = 1;
  let activeQuestionId = 1;
  let userAnswers = {};
  let userAnswersHtmlMap = {}; // 개별 글자 색상이 포함된 서식 HTML 영구 저장
  let omrMarksMap = {};        // 문항별 O / △ / X 채점 도장 저장
  let qPenColorMap = {};       // 문항별 기본 펜 색상 저장
  let activePenColor = 'black'; // 기본 펜 색상

  let draftSaveTimer = null;

  async function loadDraftAnswers() {
    if (!currentUser || !currentExamId) return;
    const username = currentUser.username;
    const localKey = `draft_answers_${username}_${currentExamId}`;
    
    // 1. 로컬 스토리지 데이터 우선 복원
    const localSaved = localStorage.getItem(localKey);
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (parsed && typeof parsed === 'object') {
          userAnswers = parsed;
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // 2. 서버 백업에서 복원 시도
    try {
      const res = await fetch(`/api/draft?username=${username}&examId=${currentExamId}`);
      const data = await res.json();
      if (data.success && data.draft && data.draft.userAnswers) {
        userAnswers = data.draft.userAnswers || {};
        localStorage.setItem(localKey, JSON.stringify(userAnswers));
      }
    } catch (e) {
      console.error(e);
    }
  }

  function saveDraftAnswers() {
    if (!currentUser || !currentExamId) return;
    const username = currentUser.username;
    const localKey = `draft_answers_${username}_${currentExamId}`;
    
    // 로컬스토리지 즉시 실시간 자동 저장 (페이지 이동/새로고침 보존)
    localStorage.setItem(localKey, JSON.stringify(userAnswers));

    // 서버에 1초 데바운스 저장
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(async () => {
      try {
        await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            examId: currentExamId,
            userAnswers
          })
        });
      } catch (e) {
        console.error(e);
      }
    }, 1000);
  }

  // 교시별 제출/완료 상태 (P, A, B)
  let completedSections = {
    P: false,
    A: false,
    B: false
  };

  let sectionTimerInterval = null;
  let sectionRemainingSecs = 35 * 60;

  let qTimerInterval = null;
  let qRemainingSecs = 6 * 60;

  let isTimerPaused = false;
  let zoomPercent = 100;

  // Admin Variables
  let adminSubmissions = [];
  let selectedSubmission = null;

  // DOM Elements - Login & Quick Select
  const loginView = document.getElementById('loginView');
  const examView = document.getElementById('examView');
  const loginIdInput = document.getElementById('loginId');
  const loginPwInput = document.getElementById('loginPw');
  const inputName = document.getElementById('inputName');
  const inputStudentNo = document.getElementById('inputStudentNo');
  const selectStudentQuick = document.getElementById('selectStudentQuick');
  const btnLogin = document.getElementById('btnLogin');

  // DOM Elements - Section Switch Tabs
  const btnSecP = document.getElementById('btnSecP');
  const btnSecA = document.getElementById('btnSecA');
  const btnSecB = document.getElementById('btnSecB');

  // Load Student Accounts
  async function loadStudentAccounts() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && selectStudentQuick) {
        selectStudentQuick.innerHTML = '<option value="">-- 수험생 계정 30개 중 선택 --</option>';
        data.users.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.username;
          opt.dataset.name = u.name;
          opt.textContent = `⭐ 계정: ${u.name} (${u.username})`;
          selectStudentQuick.appendChild(opt);
        });
      }
    } catch (e) {
      console.error(e);
    }
  }
  loadStudentAccounts();
  setupExamRoundDropdownOptions();

  if (selectStudentQuick) {
    selectStudentQuick.addEventListener('change', () => {
      const selectedOpt = selectStudentQuick.options[selectStudentQuick.selectedIndex];
      if (selectedOpt && selectedOpt.value) {
        loginIdInput.value = selectedOpt.value;
        loginPwInput.value = '';
        loginPwInput.focus();
        inputName.value = selectedOpt.dataset.name;
      }
    });
  }

  // Header & Controls
  const selectExamRound = document.getElementById('selectExamRound');
  const displayStudentInfo = document.getElementById('displayStudentInfo');
  const sectionTimerDisplay = document.getElementById('sectionTimerDisplay');
  const qTimerDisplay = document.getElementById('qTimerDisplay');
  const btnPauseTimer = document.getElementById('btnPauseTimer');
  const btnSaveTemp = document.getElementById('btnSaveTemp');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnCompleteCurrentSec = document.getElementById('btnCompleteCurrentSec');
  const btnSubmitExam = document.getElementById('btnSubmitExam');
  const btnAdminDashboardNav = document.getElementById('btnAdminDashboardNav');

  const btnToggleViewMode = document.getElementById('btnToggleViewMode');
  const btnOpenOmrDrawer = document.getElementById('btnOpenOmrDrawer');
  const btnRightOmrStrip = document.getElementById('btnRightOmrStrip');
  const btnCloseOmrDrawer = document.getElementById('btnCloseOmrDrawer');
  const omrBackdrop = document.getElementById('omrBackdrop');
  const floatingScoreBadge = document.getElementById('floatingScoreBadge');
  const splitMain = document.getElementById('splitMain');
  const paneLeft = document.getElementById('paneLeft');
  const paneRight = document.getElementById('paneRight');
  const resizer = document.getElementById('resizer');

  // Paper & OMR
  const questionTabs = document.getElementById('questionTabs');
  const paperSectionTitle = document.getElementById('paperSectionTitle');
  const tableSectionName = document.getElementById('tableSectionName');
  const tableQSpec = document.getElementById('tableQSpec');
  const tableTimeSpec = document.getElementById('tableTimeSpec');
  const paperBody = document.getElementById('paperBody');
  const omrAnswerContainer = document.getElementById('omrAnswerContainer');
  const omrTitleText = document.getElementById('omrTitleText');
  const totalCharCount = document.getElementById('totalCharCount');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const zoomLevel = document.getElementById('zoomLevel');

  // Modals
  const sectionCompleteModal = document.getElementById('sectionCompleteModal');
  const btnGoToNextSec = document.getElementById('btnGoToNextSec');
  const secCompleteTitle = document.getElementById('secCompleteTitle');
  const secCompleteMsg = document.getElementById('secCompleteMsg');

  const resultModal = document.getElementById('resultModal');
  const resultModalTitle = document.getElementById('resultModalTitle');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnRetryExam = document.getElementById('btnRetryExam');
  const btnPrintResult = document.getElementById('btnPrintResult');
  const scoreVal = document.getElementById('scoreVal');
  const maxScoreVal = document.getElementById('maxScoreVal');
  const resultName = document.getElementById('resultName');
  const resultTime = document.getElementById('resultTime');
  const resultDetailsList = document.getElementById('resultDetailsList');

  const adminModal = document.getElementById('adminModal');
  const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
  const submissionList = document.getElementById('submissionList');
  const gradingHeader = document.getElementById('gradingHeader');
  const gradingDetailsContainer = document.getElementById('gradingDetailsContainer');
  const adminActionFooter = document.getElementById('adminActionFooter');
  const btnSaveAdminGrade = document.getElementById('btnSaveAdminGrade');

  // 관리자 암호 변경 모달 요소
  const changePwModal = document.getElementById('changePwModal');
  const btnOpenChangePwModal = document.getElementById('btnOpenChangePwModal');
  const btnClosePwModal = document.getElementById('btnClosePwModal');
  const inputCurrentPw = document.getElementById('inputCurrentPw');
  const inputNewPw = document.getElementById('inputNewPw');
  const btnSubmitChangePw = document.getElementById('btnSubmitChangePw');

  // 1. 로그인

  btnLogin.addEventListener('click', () => {
    const username = loginIdInput.value.trim();
    const password = loginPwInput.value.trim();

    if (!username) {
      alert('아이디를 선택하거나 입력해 주세요.');
      loginIdInput.focus();
      return;
    }
    if (!password) {
      alert('패스워드를 입력해 주세요.');
      loginPwInput.focus();
      return;
    }
    handleLogin(username, password);
  });

  loginPwInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      btnLogin.click();
    }
  });

  async function handleLogin(username, password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        currentUser = data.user;
        currentUser.isAdmin = data.isAdmin || (username === 'cntfed');
        if (inputStudentNo) inputStudentNo.value = currentUser.studentNo;
        if (displayStudentInfo) displayStudentInfo.textContent = `${currentUser.isAdmin ? '👑 관리자' : '수험생'}: ${currentUser.name} (${currentUser.studentNo})`;

        if (btnAdminDashboardNav) {
          if (currentUser.isAdmin) {
            btnAdminDashboardNav.classList.remove('hidden');
          } else {
            btnAdminDashboardNav.classList.add('hidden');
          }
        }

        if (currentUser.isAdmin) {
          completedSections.P = true;
          completedSections.A = true;
          completedSections.B = true;
        } else {
          completedSections.P = false;
          completedSections.A = false;
          completedSections.B = false;
        }

        try {
          await setupExamRoundDropdownOptions();
        } catch(e) { console.warn(e); }

        if (loginView) loginView.classList.add('hidden');
        if (examView) examView.classList.remove('hidden');

        try {
          await loadExamData(currentExamId);
          await startSection('P');
        } catch(e) { console.error('loadExamData error:', e); }
      } else {
        alert(data.message || '로그인 실패: 아이디 또는 비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      console.warn('서버 연결 실패, 오프라인 단독 모드로 로그인합니다.', err);
      const studentList = [
        { username: '1000door', password: '135300', name: '천개의문/초수/인천/독학', studentNo: '2027-0100' },
        { username: 'ryan_jaesu', password: 'pass_ryan77', name: '라이언/재수/경기', studentNo: '2027-0100b' }
      ];
      const isAdmin = (username === 'cntfed' || username === 'admin');
      const foundStudent = studentList.find(u => u.username === username && u.password === password);
      const user = isAdmin ? { username: 'cntfed', name: '관리자(출제자)', studentNo: 'ADMIN-2027' } :
                   (foundStudent || { username, name: username, studentNo: '2027-LOCAL' });
      
      currentUser = user;
      currentUser.isAdmin = isAdmin;
      if (inputStudentNo) inputStudentNo.value = currentUser.studentNo;
      if (displayStudentInfo) displayStudentInfo.textContent = `${currentUser.isAdmin ? '👑 관리자' : '수험생'}: ${currentUser.name} (${currentUser.studentNo})`;

      if (btnAdminDashboardNav) {
        if (currentUser.isAdmin) {
          btnAdminDashboardNav.classList.remove('hidden');
        } else {
          btnAdminDashboardNav.classList.add('hidden');
        }
      }

      if (currentUser.isAdmin) {
        completedSections.P = true;
        completedSections.A = true;
        completedSections.B = true;
      } else {
        completedSections.P = false;
        completedSections.A = false;
        completedSections.B = false;
      }

      try {
        await setupExamRoundDropdownOptions();
      } catch(e) { console.warn(e); }

      if (loginView) loginView.classList.add('hidden');
      if (examView) examView.classList.remove('hidden');

      try {
        await loadExamData(currentExamId);
        await startSection('P');
      } catch(e) { console.error('loadExamData offline error:', e); }
    }
  }

  async function autoSyncFallbackExamsWithServer() {
    if (window.FALLBACK_EXAMS_MAP) {
      const fbExams = Object.values(window.FALLBACK_EXAMS_MAP);
      if (fbExams.length >= 23) {
        try {
          await fetch('/api/sync-exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exams: fbExams })
          });
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  async function setupExamRoundDropdownOptions() {
    if (!selectExamRound) return;
    const savedVal = currentExamId || 'exam-101';

    autoSyncFallbackExamsWithServer();

    let examList = [];
    try {
      const res = await fetch('/api/exams?t=' + Date.now());
      const data = await res.json();
      if (data.success && Array.isArray(data.exams) && data.exams.length > 0) {
        examList = data.exams;
      }
    } catch (e) {
      console.error(e);
    }

    if (examList.length === 0 && window.FALLBACK_EXAMS_MAP) {
      examList = Object.values(window.FALLBACK_EXAMS_MAP);
    }

    selectExamRound.innerHTML = '';
    if (examList.length > 0) {
      examList.forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex.id;
        const cleanId = ex.id.replace('exam-', '');
        opt.textContent = `제 ${cleanId}`;
        selectExamRound.appendChild(opt);
      });
    } else {
      for (let i = 1; i <= 26; i++) {
        const exId = `exam-${i}`;
        const opt = document.createElement('option');
        opt.value = exId;
        opt.textContent = `제 ${i}`;
        selectExamRound.appendChild(opt);
      }
    }

    if (selectExamRound.querySelector(`option[value="${savedVal}"]`)) {
      selectExamRound.value = savedVal;
    } else if (selectExamRound.options.length > 0) {
      selectExamRound.value = selectExamRound.options[0].value;
      currentExamId = selectExamRound.value;
    }
  }

  selectExamRound.addEventListener('change', async (e) => {
    const targetRound = e.target.value;
    const isAdmin = currentUser && currentUser.isAdmin;

    currentExamId = targetRound;
    if (!isAdmin) {
      completedSections.P = false;
      completedSections.A = false;
      completedSections.B = false;
    }
    await loadExamData(currentExamId);
    await startSection('P');
  });

  const btnResetCurrentAnswers = document.getElementById('btnResetCurrentAnswers');
  if (btnResetCurrentAnswers) {
    btnResetCurrentAnswers.addEventListener('click', async () => {
      if (!confirm(`🧹 [제 ${currentExamId.replace('exam-', '')} 회차] 의 모든 작성 답안과 O/X 채점 도장을 완전히 지우고 깨끗한 새 시험지로 시작하시겠습니까?`)) {
        return;
      }
      userAnswers = {};
      
      // 1. 모든 로컬 스토리지 답안 삭제
      if (currentUser) {
        const username = currentUser.username;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`draft_answers_${username}`)) {
            localStorage.removeItem(key);
          }
        }
      }
      localStorage.clear();

      // 2. 서버 드래프트 삭제 요청
      if (currentUser && currentExamId) {
        try {
          await fetch('/api/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: currentUser.username,
              examId: currentExamId,
              userAnswers: {}
            })
          });
        } catch (e) {
          console.error(e);
        }
      }

      // 3. 화면의 모든 textarea 및 input 값 강제 비우기
      const allAreas = document.querySelectorAll('.omr-card textarea, .omr-card input');
      allAreas.forEach(el => { el.value = ''; });

      renderOMRForm();
      alert('🧹 현재 회차 작성 답안 및 채점 표식이 100% 깔끔하게 지워졌습니다! 새 마음으로 작성해 보세요!');
    });
  }

  btnSecP.addEventListener('click', () => switchSection('P'));
  btnSecA.addEventListener('click', () => switchSection('A'));
  btnSecB.addEventListener('click', () => switchSection('B'));

  function switchSection(targetKey) {
    if (currentSectionKey === targetKey) return;
    startSection(targetKey);
  }

  // 현재 교시 제출 버튼
  btnCompleteCurrentSec.addEventListener('click', () => {
    if (currentSectionKey === 'P') {
      if (confirm('1교시 [교육학 논술] 답안을 완료 제출하고 교육학 답안 리포트를 확인하시겠습니까?')) {
        completedSections.P = true;
        updateSectionTabUI();
        showSectionResultModal('P');
      }
    } else if (currentSectionKey === 'A') {
      if (confirm('2교시 [전공 A형] 답안을 완료 제출하고 3교시 [전공 B형(35분)]으로 이동하시겠습니까?')) {
        completedSections.A = true;
        updateSectionTabUI();
        showSectionResultModal('A');
      }
    }
  });

  function showSectionResultModal(secKey) {
    const secData = currentExam.sections[secKey];
    let secScore = 0;
    let secMaxScore = 0;

    resultDetailsList.innerHTML = '';

    secData.questions.forEach(q => {
      secMaxScore += q.score;
      const userAns = (userAnswers && userAnswers[q.id]) ? userAnswers[q.id].trim() : '';

      let matchedKeywords = [];
      if (q.keywords && q.keywords.length > 0) {
        matchedKeywords = q.keywords.filter(kw => userAns.includes(kw));
      }

      let earnedScore = 0;
      if (q.keywords && q.keywords.length > 0) {
        const matchRatio = matchedKeywords.length / q.keywords.length;
        earnedScore = Math.round(matchRatio * q.score * 10) / 10;
      }
      secScore += earnedScore;

      const ansDisplay = userAnswersHtmlMap[q.id] || userAns || '(작성 내용 없음)';
      const div = document.createElement('div');
      div.className = 'result-detail-item';
      div.innerHTML = `
        <div class="result-q-title">문항 [${q.section || '교육학'}] ${q.title} (획득: ${earnedScore}점 / 배점 ${q.score}점)</div>
        <div class="ans-box ans-user"><strong>작성한 답안:</strong><br>${ansDisplay}</div>
        <div class="ans-box ans-model"><strong>모범 답안:</strong><br>${q.answer}</div>
      `;
      resultDetailsList.appendChild(div);
    });

    scoreVal.textContent = secScore;
    maxScoreVal.textContent = secMaxScore;
    resultName.textContent = `${currentUser ? currentUser.name : '수험생'} (${currentUser ? currentUser.studentNo : '2027-0000'})`;
    resultTime.textContent = new Date().toLocaleTimeString();

    if (secKey === 'P') {
      resultModalTitle.textContent = '🎉 1교시 교육학 논술 제출 및 답안 리포트 (20점 만점)';
    } else if (secKey === 'A') {
      resultModalTitle.textContent = '🎉 2교시 전공 A형 제출 및 답안 리포트 (40점 만점)';
    }

    resultModal.classList.remove('hidden');
  }

  function updateSectionTabUI() {
    if (btnSecP) {
      btnSecP.textContent = '1교시 교육학';
      btnSecP.classList.toggle('active-sec', currentSectionKey === 'P');
    }
    
    if (btnSecA) {
      btnSecA.classList.remove('locked-tab');
      btnSecA.textContent = '2교시 전공 A';
      btnSecA.classList.toggle('active-sec', currentSectionKey === 'A');
    }

    if (btnSecB) {
      btnSecB.classList.remove('locked-tab');
      btnSecB.textContent = '3교시 전공 B';
      btnSecB.classList.toggle('active-sec', currentSectionKey === 'B');
    }
  }

  async function loadExamData(examId) {
    try {
      const res = await fetch(`/api/exams/${examId}?t=${Date.now()}`);
      const data = await res.json();
      if (data.success && data.exam) {
        currentExam = data.exam;
        if (currentExam && currentExam.sections && currentExam.sections.P) {
          currentExam.sections.P.timeLimit = 35;
        }
        return;
      }
    } catch (err) {
      console.error(err);
    }

    // 백엔드가 해당 회차 데이터를 서빙하지 못할 때도 100% 정상 작동하도록 클라이언트 2중 완충 장치 작동!
    if (window.FALLBACK_EXAMS_MAP && window.FALLBACK_EXAMS_MAP[examId]) {
      currentExam = window.FALLBACK_EXAMS_MAP[examId];
    } else {
      alert('시험지 데이터를 로드하지 못했습니다.');
    }
    if (currentExam && currentExam.sections && currentExam.sections.P) {
      currentExam.sections.P.timeLimit = 35;
    }
  }

  // 교시(P/A/B) 시작 시 최종 제출 버튼 노출 제어 (마지막 B형에서만 전체 최종 제출 버튼 노출!)
  async function startSection(secKey) {
    currentSectionKey = secKey;
    currentExamPageNo = 1;
    await loadDraftAnswers();
    const secData = currentExam.sections[secKey];

    if (secKey === 'P') {
      secData.timeLimit = 35;
    }

    updateSectionTabUI();

    const paperFooterPage = document.getElementById('paperFooterPage');
    const noticeBanner = document.querySelector('.p-notice-banner');

    if (secKey === 'P') {
      if (paperSectionTitle) paperSectionTitle.innerHTML = '교 &nbsp; 육 &nbsp; 학';
      if (tableSectionName) tableSectionName.textContent = '1교시';
      if (tableQSpec) tableQSpec.textContent = '1문항 20점';
      if (tableTimeSpec) tableTimeSpec.textContent = `시험 시간 60분`;
      if (paperFooterPage) paperFooterPage.textContent = '교육학 (2면 중 2면)';
      if (noticeBanner) noticeBanner.innerHTML = '○ 문제지 전체 면수가 맞는지 확인하시오.';
      if (omrTitleText) omrTitleText.textContent = '✏️ 1교시 교육학 논술 작성란 (20점 만점 / 1200~1500자)';
      if (btnCompleteCurrentSec) {
        btnCompleteCurrentSec.textContent = '🚀 1교시 제출';
        btnCompleteCurrentSec.classList.remove('hidden');
      }
      if (btnSubmitExam) btnSubmitExam.classList.add('hidden');
    } else if (secKey === 'A') {
      if (paperSectionTitle) paperSectionTitle.innerHTML = '전 &nbsp; 문 &nbsp; 상 &nbsp; 담';
      if (tableSectionName) tableSectionName.textContent = '2교시 전공 A';
      if (tableQSpec) tableQSpec.textContent = '12문항 40점';
      if (tableTimeSpec) tableTimeSpec.textContent = `시험 시간 90분`;
      if (paperFooterPage) paperFooterPage.textContent = '전문상담 [전공 A] (8면 중 4면)';
      if (noticeBanner) noticeBanner.innerHTML = '○ 문제지 전체 면수가 맞는지 확인하시오.<br>○ 모든 문항에는 배점이 표시되어 있습니다.';
      if (omrTitleText) omrTitleText.textContent = '✏️ 2교시 전공 A형 서술형 작성란 (40점 만점)';
      if (btnCompleteCurrentSec) {
        btnCompleteCurrentSec.textContent = '🚀 2교시 제출';
        btnCompleteCurrentSec.classList.remove('hidden');
      }
      if (btnSubmitExam) btnSubmitExam.classList.add('hidden');
    } else {
      // 3교시 전공 B형일 때만 전체 최종 제출 버튼 노출!
      if (paperSectionTitle) paperSectionTitle.innerHTML = '전 &nbsp; 문 &nbsp; 상 &nbsp; 담';
      if (tableSectionName) tableSectionName.textContent = '3교시 전공 B';
      if (tableQSpec) tableQSpec.textContent = '11문항 40점';
      if (tableTimeSpec) tableTimeSpec.textContent = `시험 시간 90분`;
      if (paperFooterPage) paperFooterPage.textContent = '전문상담 [전공 B] (8면 중 6면)';
      if (noticeBanner) noticeBanner.innerHTML = '○ 문제지 전체 면수가 맞는지 확인하시오.<br>○ 모든 문항에는 배점이 표시되어 있습니다.';
      if (omrTitleText) omrTitleText.textContent = '✏️ 3교시 전공 B형 서술형 작성란 (40점 만점)';
      if (btnCompleteCurrentSec) btnCompleteCurrentSec.classList.add('hidden');
      if (btnSubmitExam) {
        btnSubmitExam.classList.remove('hidden');
        btnSubmitExam.textContent = '📝 3교시 최종 제출';
      }
    }

    sectionRemainingSecs = 35 * 60;
    startSectionTimer();

    const qs = (secData && secData.questions) ? secData.questions : [];
    renderExamPaper(qs);
    renderOMRForm(qs);
    renderTabs(qs);
    renderTabletQuickJumpChips(qs);
    initTabletTouchSwipe();

    // 🎯 시험지 첫 번째 페이지 활성화 보장
    const firstPage = document.querySelector('.kice-exam-page');
    if (firstPage) {
      firstPage.classList.add('active-page');
    }

    if (qs.length > 0) {
      selectQuestion(1);
    }
  }

  // =========================================================
  // Web Audio API 사운드 및 실제 임용 시험장 긴장감 연출 엔진
  // =========================================================
  let audioCtx = null;
  let soundEnabled = true;
  let notice10MinFired = false;
  let notice5MinFired = false;

  const btnToggleSound = document.getElementById('btnToggleSound');
  const sectionTimerBox = document.getElementById('sectionTimerBox');
  const supervisorNoticeBar = document.getElementById('supervisorNoticeBar');
  const supervisorNoticeText = document.getElementById('supervisorNoticeText');
  const screenUrgencyGlow = document.getElementById('screenUrgencyGlow');

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
  }

  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundEnabled) {
        initAudioContext();
        btnToggleSound.textContent = '🔊 시험장 오디오 (ON)';
        btnToggleSound.classList.add('sound-on');
      } else {
        btnToggleSound.textContent = '🔇 시험장 오디오 (OFF)';
        btnToggleSound.classList.remove('sound-on');
      }
    });
    btnToggleSound.classList.add('sound-on');
  }

  // 👀 눈보호 소프트 크림 모드 토글
  const btnToggleEyeComfort = document.getElementById('btnToggleEyeComfort');
  let eyeComfortEnabled = false;

  if (btnToggleEyeComfort) {
    btnToggleEyeComfort.addEventListener('click', () => {
      eyeComfortEnabled = !eyeComfortEnabled;
      const paperContainer = document.getElementById('paperContainer');
      if (eyeComfortEnabled) {
        if (paperContainer) paperContainer.classList.add('eye-comfort-active');
        btnToggleEyeComfort.textContent = '👁️ 눈보호 모드 (ON)';
        btnToggleEyeComfort.style.background = '#d97706';
        btnToggleEyeComfort.style.borderColor = '#b45309';
      } else {
        if (paperContainer) paperContainer.classList.remove('eye-comfort-active');
        btnToggleEyeComfort.textContent = '👁️ 눈보호 모드 (OFF)';
        btnToggleEyeComfort.style.background = '#78716c';
        btnToggleEyeComfort.style.borderColor = '#57534e';
      }
    });
  }

  // 아날로그 시계 초침 째깍 소리 (Tik-Tok)
  function playTickSound(isCritical = false) {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = isCritical ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isCritical ? 1200 : 800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(isCritical ? 0.25 : 0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {}
  }

  // 시험 감독관 령 종소리 (Chime Bell)
  function playChimeSound() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;

      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.15);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.15 + 1.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + idx * 0.15);
        osc.stop(audioCtx.currentTime + idx * 0.15 + 1.2);
      });
    } catch (e) {}
  }

  // 긴급 경고 삐- 소리 (Warning Beep)
  function playWarningBeep() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;

      for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + i * 0.18);

        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.18 + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + i * 0.18);
        osc.stop(audioCtx.currentTime + i * 0.18 + 0.1);
      }
    } catch (e) {}
  }

  // 실제 시험장 감독관 음성 TTS 낭독 방송
  function speakSupervisorNotice(text) {
    if (!soundEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/^[^\w가-힣]+/, '').replace(/\[.*?\]/g, '');
      const msg = new SpeechSynthesisUtterance(cleanText);
      msg.lang = 'ko-KR';
      msg.rate = 0.92;
      msg.pitch = 1.0;
      window.speechSynthesis.speak(msg);
    } catch(e) {}
  }

  // 실시간 시험 감독관 공지 팝업 & 음성 방송
  function showSupervisorNotice(text) {
    if (!supervisorNoticeBar || !supervisorNoticeText) return;
    supervisorNoticeText.textContent = text;
    supervisorNoticeBar.classList.remove('hidden');

    speakSupervisorNotice(text);

    setTimeout(() => {
      supervisorNoticeBar.classList.add('hidden');
    }, 6000);
  }

  // 윈도우 창 이탈 엄격 감시
  window.addEventListener('blur', () => {
    if (sectionTimerInterval && sectionRemainingSecs > 0) {
      showSupervisorNotice('⚠️ [시험 감독관 경고] 시험장 화면 이탈 감지! 시험에 온전히 집중해 주십시오.');
    }
  });

  function startSectionTimer() {
    if (sectionTimerInterval) clearInterval(sectionTimerInterval);
    notice10MinFired = false;
    notice5MinFired = false;

    if (sectionTimerBox) {
      sectionTimerBox.classList.remove('timer-warning-amber', 'timer-critical-red');
    }
    if (screenUrgencyGlow) {
      screenUrgencyGlow.classList.add('hidden');
    }

    updateSectionTimerDisplay();
    playChimeSound(); // 교시 개시 령 종소리!
    
    if (currentSectionKey === 'P') {
      showSupervisorNotice('🔔 1교시 교육학 논술 시험이 시작되었습니다. 제한시간 35분 동안 신중히 답안을 작성하십시오.');
    } else if (currentSectionKey === 'A') {
      showSupervisorNotice('🔔 2교시 전공 A형 시험이 시작되었습니다. 제한시간 35분 동안 서술형 답안을 작성하십시오.');
    } else {
      showSupervisorNotice('🔔 3교시 전공 B형 시험이 시작되었습니다. 제한시간 35분 동안 서술형 답안을 작성하십시오.');
    }

    sectionTimerInterval = setInterval(() => {
      if (!isTimerPaused && sectionRemainingSecs > 0) {
        sectionRemainingSecs--;
        updateSectionTimerDisplay();

        const isCritical = sectionRemainingSecs <= 300;
        playTickSound(isCritical);

        // 10분 남았을 때 앰버 경고 (600초)
        if (sectionRemainingSecs === 600 && !notice10MinFired) {
          notice10MinFired = true;
          if (sectionTimerBox) sectionTimerBox.classList.add('timer-warning-amber');
          showSupervisorNotice('📢 [시험 감독관 안내] 시험 종료 10분 전입니다! 미작성 서술란을 정리하고 답안을 검토하십시오.');
          playChimeSound();
        }

        // 5분 남았을 때 레드 펄스 긴급 경고 (300초)
        if (sectionRemainingSecs === 300 && !notice5MinFired) {
          notice5MinFired = true;
          if (sectionTimerBox) {
            sectionTimerBox.classList.remove('timer-warning-amber');
            sectionTimerBox.classList.add('timer-critical-red');
          }
          if (screenUrgencyGlow) screenUrgencyGlow.classList.remove('hidden');
          showSupervisorNotice('🚨 [시험 감독관 긴급 안내] 시험 종료 5분 전입니다! OMR 답안 서술을 최종 점검하십시오.');
          playWarningBeep();
        }

        if (sectionRemainingSecs === 0) {
          clearInterval(sectionTimerInterval);
          if (screenUrgencyGlow) screenUrgencyGlow.classList.add('hidden');
          playChimeSound();
          showSupervisorNotice('🔔 [시험 감독관] 시험이 종료되었습니다! 즉시 필기구를 놓아주십시오.');
          handleSectionTimeOut();
        }
      }
    }, 1000);
  }

  function updateSectionTimerDisplay() {
    const mins = Math.floor(sectionRemainingSecs / 60);
    const secs = sectionRemainingSecs % 60;
    sectionTimerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function handleSectionTimeOut() {
    if (currentSectionKey === 'P') {
      completedSections.P = true;
      showSectionResultModal('P');
    } else if (currentSectionKey === 'A') {
      completedSections.A = true;
      showSectionResultModal('A');
    } else {
      alert('3교시 전공 B형 시험 시간이 종료되었습니다! 전체 답안을 자동 최종 제출합니다.');
      submitFinalExam();
    }
  }

  btnGoToNextSec.addEventListener('click', () => {
    sectionCompleteModal.classList.add('hidden');
    if (currentSectionKey === 'P') startSection('A');
    else if (currentSectionKey === 'A') startSection('B');
  });

  function startQuestionTimer() {
    if (qTimerInterval) clearInterval(qTimerInterval);
    qRemainingSecs = 6 * 60;
    updateQuestionTimerDisplay();

    qTimerInterval = setInterval(() => {
      if (!isTimerPaused && qRemainingSecs > 0) {
        qRemainingSecs--;
        updateQuestionTimerDisplay();

        if (qRemainingSecs === 0) {
          clearInterval(qTimerInterval);
          qTimerDisplay.style.color = '#ef4444';
        }
      }
    }, 1000);
  }

  function updateQuestionTimerDisplay() {
    const mins = Math.floor(qRemainingSecs / 60);
    const secs = qRemainingSecs % 60;
    qTimerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (qRemainingSecs > 60) qTimerDisplay.style.color = '#facc15';
  }


  function selectExamPage(pageNo) {
    currentExamPageNo = pageNo;
    document.querySelectorAll('.kice-exam-page').forEach(p => {
      p.classList.toggle('active-page', p.id === `exam-page-${pageNo}`);
    });
    document.querySelectorAll('.kice-page-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.page == pageNo);
    });
    const activePageEl = document.getElementById(`exam-page-${pageNo}`);
    if (activePageEl) activePageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectQuestion(qId) {
    const qNumInt = parseInt(qId, 10) || 1;
    activeQuestionId = qNumInt;
    startQuestionTimer();

    if (currentSectionKey !== 'P') {
      const targetPageNo = Math.max(1, Math.ceil(qNumInt / 2));
      selectExamPage(targetPageNo);
    } else {
      currentExamPageNo = 1;
      const pedPage = document.querySelector('.pedagogy-page-mode') || document.querySelector('.kice-exam-page');
      if (pedPage) pedPage.classList.add('active-page');
    }

    document.querySelectorAll('.q-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.qid == qNumInt);
    });

    document.querySelectorAll('.pink-omr-box').forEach(c => {
      c.classList.toggle('active-omr', c.id === `omr-card-${qNumInt}`);
    });

    document.querySelectorAll('.jump-chip').forEach(chip => {
      chip.classList.toggle('active-chip', chip.dataset.jumpid == qNumInt);
    });

    if (typeof updateSingleFocusDisplay === 'function') {
      updateSingleFocusDisplay(qNumInt);
    }

    const paperQ = document.getElementById(`paper-q-${qNumInt}`);
    const omrQ = document.getElementById(`omr-card-${qNumInt}`);
    if (paperQ) paperQ.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (omrQ) omrQ.scrollIntoView({ behavior: 'smooth' });
  }

  // 📝 (ㄱ), (ㄴ), ㉠, ㉡ 및 "아닌 것", "않는", "아닌" 등 부정형 핵심 용어에 평가원 기출 밑줄을 자동 적용하는 함수
  function formatKiceSymbols(text) {
    if (!text) return '';
    let res = text;

    // 1. (ㄱ), (ㄴ), (ㄷ)... 밑줄 처리
    res = res.replace(/\((ㄱ|ㄴ|ㄷ|ㄹ|ㅁ|ㅂ|ㅅ|ㅇ|ㅈ|ㅊ|ㅋ|ㅌ|ㅍ|ㅎ)\)/g, '<u>($1)</u>');

    // 2. ( ㉠ ), ( ㉡ )...
    res = res.replace(/\(\s*(㉠|㉡|㉢|㉣|㉤|㉥|㉦|㉧|㉨|㉩|㉪|㉫|㉬|㉭)\s*\)/g, '<u>( $1 )</u>');

    // 3. (㉠), (㉡)...
    res = res.replace(/\((㉠|㉡|㉢|㉣|㉤|㉥|㉦|㉧|㉨|㉩|㉪|㉫|㉬|㉭)\)/g, '<u>($1)</u>');

    // 4. (a), (b), (c)...
    res = res.replace(/\((a|b|c|d|e|f|g)\)/gi, '<u>($1)</u>');

    // 중복 <u> 태그 정리
    res = res.replace(/<u>\s*<u>/g, '<u>').replace(/<\/u>\s*<\/u>/g, '</u>');

    return res;
  }

  function renderExamPaper(questions) {
    paperContainer.innerHTML = ''; // 페이지 단위 독립 렌더링
    const isPed = (currentSectionKey === 'P');

    if (isPed) {
      // 📜 1교시 교육학 논술 전용 대형 1단 페이지
      const q = questions[0] || {};
      const qNumInt = 1;
      const qScore = q.points || q.score || 20;

      let rawTitle = q.title || '';
      rawTitle = rawTitle.replace(/\[문항 [AB]-\d+\]/g, '').replace(/\(\d+점\)/g, '').trim();
      rawTitle = rawTitle.replace(/^\[.*?\]\s*/, '').trim();

      let rubricText = q.rubric || '';
      if (rubricText.includes('[정답 예시]')) rubricText = rubricText.split('[정답 예시]')[0].trim();
      if (rubricText.includes('[정답]')) rubricText = rubricText.split('[정답]')[0].trim();
      let formattedPassage = q.passage || '';
      let mainQuestionText = '';
      let separateRubric = '';

      let cleanPassage = formattedPassage;
      // 1. 발문(Intro) 추출: "다음은 ... 논하시오. [20점]"
      const matchIntro = cleanPassage.match(/^(다음은\s+[\s\S]*?논하시오\.\s*(\[\d+점\])?)/);
      if (matchIntro) {
        mainQuestionText = matchIntro[1].trim();
        if (!mainQuestionText.includes(`[${qScore}점]`)) mainQuestionText += ` [${qScore}점]`;
        cleanPassage = cleanPassage.substring(matchIntro[0].length).trim();
      } else if (rawTitle && rawTitle.length > 10) {
        mainQuestionText = `${formatKiceSymbols(rawTitle)} [${qScore}점]`;
      } else {
        mainQuestionText = `다음 내용을 읽고 지시사항에 따라 서론, 본론, 결론을 갖추어 논하시오. [${qScore}점]`;
      }

      cleanPassage = cleanPassage.replace(/^\[제시문\]\s*/i, '').trim();

      // 2. passage 안에 <배 점> 또는 <작성 방법>이 포함되어 있는지 검사하여 지문과 배점 박스를 명확히 분리!
      const rubricMatchInPassage = cleanPassage.match(/<(배\s*점|작성\s*방법)>([\s\S]*)/i);
      if (rubricMatchInPassage) {
        separateRubric = rubricMatchInPassage[0];
        cleanPassage = cleanPassage.substring(0, rubricMatchInPassage.index).trim();
      } else if (rubricText) {
        separateRubric = rubricText;
      }

      // 3. 지문 끝에 붙은 <수고하셨습니다.> 제거
      cleanPassage = cleanPassage.replace(/<수고하셨습니다\.?>/g, '').replace(/─{5,}/g, '').trim();
      formattedPassage = cleanPassage;

      // 4. <배 점> 박스 HTML 깔끔하게 생성
      let rubricHtml = '';
      if (separateRubric) {
        let cleanRubric = separateRubric.replace(/<수고하셨습니다\.?>/g, '').replace(/─{5,}/g, '').trim();
        cleanRubric = cleanRubric.replace(/^<(작성\s*방법|배\s*점)>\s*:?\s*/i, '').trim();
        const lines = cleanRubric.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const formattedLines = lines.map(l => {
          let text = l;
          return `<div class="kice-rubric-item">${formatKiceSymbols(text)}</div>`;
        }).join('');

        rubricHtml = `
          <div class="kice-rubric-box" style="margin-top: 24px; border: 1.5px solid #222; background: #fff; padding: 14px 18px; border-radius: 4px;">
            <div class="kice-rubric-header" style="text-align: center; font-weight: 800; font-size: 15px; margin-bottom: 10px; color: #111;">&lt;배 &nbsp; 점&gt;</div>
            <div class="kice-rubric-body" style="font-size: 13.5px; line-height: 1.8; color: #222;">${formattedLines}</div>
          </div>
        `;
      }

      if (formattedPassage) {
        formattedPassage = formatKiceSymbols(formattedPassage);
      }

      const pageEl = document.createElement('div');
      pageEl.className = 'kice-exam-page pedagogy-page-mode active-page';
      pageEl.id = 'exam-page-1';
      pageEl.innerHTML = `
        <div class="paper-header">
          <div class="p-title">2027학년도 중등학교교사 임용후보자 선정경쟁시험</div>
          <div class="p-subject">교 &nbsp; 육 &nbsp; 학</div>
          <div class="p-user-info-row">
            <span>수험 번호 : ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</span>
            <span>성 &nbsp;&nbsp; 명 : ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</span>
          </div>
          <table class="p-meta-table">
            <tr>
              <td>제1차 시험</td>
              <td>1교시</td>
              <td>1문항 20점</td>
              <td>시험 시간 35분</td>
            </tr>
          </table>
        </div>
        <div class="p-notice-banner">○ 문제지 전체 면수가 맞는지 확인하시오.</div>
        <div class="kice-page-grid">
          <div class="q-block" id="paper-q-1">
            <div class="q-title">${mainQuestionText}</div>
            ${formattedPassage ? `<div class="q-passage">${formattedPassage}</div>` : ''}
            ${rubricHtml}
            <div class="pedagogy-congrats">&lt;수고하셨습니다.&gt;</div>
          </div>
        </div>
        <div class="paper-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1.5px solid #333a45; padding-top:12px; margin-top:24px; font-weight:700;">
          <span>🏛️ 한국교육과정평가원</span>
          <span>교육학 (2면 중 2면)</span>
        </div>
      `;
      paperContainer.appendChild(pageEl);
    } else {
      // 📰 2/3교시 전공 시험지: 페이지당 좌측 1문제 / 우측 1문제 정통 배치!
      const totalPages = Math.ceil(questions.length / 2);

      // 📄 상단 페이지 이동 네비게이션 바 생성
      const navBar = document.createElement('div');
      navBar.className = 'kice-page-nav-bar';
      
      let navButtonsHtml = `
        <button type="button" class="kice-page-btn" id="btnPrevPage">◀ 이전 면</button>
      `;

      for (let i = 1; i <= totalPages; i++) {
        const qStart = (i - 1) * 2 + 1;
        const qEnd = Math.min(i * 2, questions.length);
        const pageLabel = (qStart === qEnd) ? `${i}면 (${qStart}번)` : `${i}면 (${qStart}·${qEnd}번)`;
        navButtonsHtml += `<button type="button" class="kice-page-btn ${i === 1 ? 'active' : ''}" data-page="${i}">${pageLabel}</button>`;
      }

      navButtonsHtml += `
        <button type="button" class="kice-page-btn" id="btnNextPage">다음 면 ▶</button>
      `;
      navBar.innerHTML = navButtonsHtml;
      paperContainer.appendChild(navBar);

      navBar.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = parseInt(btn.dataset.page, 10);
          selectExamPage(p);
        });
      });

      const btnPrev = navBar.querySelector('#btnPrevPage');
      if (btnPrev) {
        btnPrev.addEventListener('click', () => {
          if (currentExamPageNo > 1) selectExamPage(currentExamPageNo - 1);
        });
      }
      const btnNext = navBar.querySelector('#btnNextPage');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          if (currentExamPageNo < totalPages) selectExamPage(currentExamPageNo + 1);
        });
      }

      for (let pIdx = 0; pIdx < totalPages; pIdx++) {
        const pageNo = pIdx + 1;
        const leftQIdx = pIdx * 2;
        const rightQIdx = pIdx * 2 + 1;
        const leftQ = questions[leftQIdx];
        const rightQ = (rightQIdx < questions.length) ? questions[rightQIdx] : null;

        const pageEl = document.createElement('div');
        pageEl.className = `kice-exam-page ${pageNo === 1 ? 'active-page' : ''}`;
        pageEl.id = `exam-page-${pageNo}`;

        // 1페이지일 때만 상단 정통 메타 헤더 표출, 2페이지부터는 간략한 상단 라인
        let pageHeaderHtml = '';
        if (pageNo === 1) {
          const totalQCount = (currentSectionKey === 'A' ? 12 : 11);
          pageHeaderHtml = `
            <div class="paper-header">
              <div class="p-title">2027학년도 중등학교교사 임용후보자 선정경쟁시험</div>
              <div class="p-subject">전 &nbsp; 문 &nbsp; 상 &nbsp; 담</div>
              <div class="p-user-info-row">
                <span>수험 번호 : ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</span>
                <span>성 &nbsp;&nbsp; 명 : ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</span>
              </div>
              <table class="p-meta-table">
                <tr>
                  <td>제1차 시험</td>
                  <td>${currentSectionKey === 'A' ? '2교시 전공 A' : '3교시 전공 B'}</td>
                  <td>${totalQCount}문항 40점</td>
                  <td>시험 시간 35분</td>
                </tr>
              </table>
            </div>
            <div class="p-notice-banner">
              ○ 문제지 전체 면수가 맞는지 확인하시오.<br>
              ○ 모든 문항에는 배점이 표시되어 있습니다.
            </div>
          `;
        } else {
          pageHeaderHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #333a45; padding-bottom:8px; margin-bottom:20px; font-weight:700; font-size:13.5px; color:#64748b;">
              <span>2027학년도 중등학교교사 임용후보자 선정경쟁시험</span>
              <span>전문상담 [전공 ${currentSectionKey}]</span>
            </div>
          `;
        }

        // 개별 문제 렌더러 함수
        const renderQuestionBlock = (q, qIndex) => {
          if (!q) return '';
          const qNumInt = qIndex + 1;
          const isSecA = (currentSectionKey === 'A');
          const isSecB = (currentSectionKey === 'B');
          let isOneLine = false;
          if (isSecA && qNumInt <= 4) isOneLine = true;
          if (isSecB && qNumInt <= 2) isOneLine = true;

          const qScore = q.points || q.score || (isOneLine ? 2 : 4);

          let rawTitle = q.title || '';
          rawTitle = rawTitle.replace(/\[문항 [AB]-\d+\]/g, '').replace(/\(\d+점\)/g, '').trim();
          rawTitle = rawTitle.replace(/^\[.*?\]\s*/, '').trim();

          let rubricText = q.rubric || '';
          if (rubricText.includes('[정답 예시]')) rubricText = rubricText.split('[정답 예시]')[0].trim();
          if (rubricText.includes('[정답]')) rubricText = rubricText.split('[정답]')[0].trim();
          let formattedPassage = q.passage || '';
          let mainQuestionText = '';
          let separateRubric = '';

          if (!formattedPassage && rubricText) {
            mainQuestionText = `${qNumInt}. ${formatKiceSymbols(rubricText)} [${qScore}점]`;
          } else if (rawTitle && rawTitle.length > 5) {
            mainQuestionText = `${qNumInt}. ${formatKiceSymbols(rawTitle)} [${qScore}점]`;
            separateRubric = rubricText;
          } else if (rubricText) {
            if (rubricText.startsWith('<작성 방법>') || rubricText.includes('○') || rubricText.includes('\n')) {
              mainQuestionText = `${qNumInt}. 다음 사례를 읽고 &lt;작성 방법&gt;에 따라 서술하시오. [${qScore}점]`;
              separateRubric = rubricText;
            } else {
              mainQuestionText = `${qNumInt}. 다음은 ... ${formatKiceSymbols(rubricText)} [${qScore}점]`;
            }
          } else {
            mainQuestionText = `${qNumInt}. 다음 지문을 읽고 물음에 답하시오. [${qScore}점]`;
          }

          let rubricHtml = '';
          if (separateRubric) {
            let cleanRubric = separateRubric.replace(/^<(작성 방법|배\s*점)>\s*:?\s*/i, '').trim();
            const lines = cleanRubric.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const formattedLines = lines.map(l => {
              let text = l;
              if (!text.startsWith('○') && !text.startsWith('-') && !text.startsWith('•') && !text.startsWith('※') && !text.startsWith('1.') && !text.startsWith('2.')) {
                text = `○ ${text}`;
              } else if (text.startsWith('1.') || text.startsWith('2.') || text.startsWith('3.')) {
                text = text.replace(/^\d+\.\s*/, '○ ');
              }
              return `<div class="kice-rubric-item">${formatKiceSymbols(text)}</div>`;
            }).join('');

            rubricHtml = `
              <div class="kice-rubric-box">
                <div class="kice-rubric-header">&lt;작성 &nbsp; 방법&gt;</div>
                <div class="kice-rubric-body">${formattedLines}</div>
              </div>
            `;
          }

          if (formattedPassage) {
            const speakerNames = "상담교사|수퍼바이저|담임교사|경력 교사|신임 교사|김 교사|박 교사|이 교사|최 교사|지혜|민우|승호|유진|수진|민지|현수|민호|재민|성민|성준|아버지|어 머 니|어머니|준서|집단원 A|집단원 B|내담자|수검자|보호자|내담자 민우|내담자 현수|내담자 민호|내담자 서연이|내담 아동";
            const dialogueRegex = new RegExp(`([\\"\\.\\?!\\)\\s])\\s*(${speakerNames})\\s*:`, 'g');
            formattedPassage = formattedPassage.replace(dialogueRegex, '$1\n$2:');
            formattedPassage = formattedPassage.replace(/\n{3,}/g, '\n\n').trim();
            formattedPassage = formatKiceSymbols(formattedPassage);
          }

          return `
            <div class="q-block" id="paper-q-${qNumInt}">
              <div class="q-title">${mainQuestionText}</div>
              ${formattedPassage ? `<div class="q-passage">${formattedPassage}</div>` : ''}
              ${rubricHtml}
            </div>
          `;
        };

        const leftColHtml = renderQuestionBlock(leftQ, leftQIdx);
        const rightColHtml = rightQ ? renderQuestionBlock(rightQ, rightQIdx) : '';

        pageEl.innerHTML = `
          ${pageHeaderHtml}
          <div class="kice-page-grid">
            <div class="kice-col kice-col-left">${leftColHtml}</div>
            <div class="kice-col kice-col-right">${rightColHtml}</div>
          </div>
          <div class="paper-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1.5px solid #333a45; padding-top:12px; margin-top:24px; font-weight:700;">
            <span>🏛️ 한국교육과정평가원</span>
            <span>전문상담 [전공 ${currentSectionKey}] (8면 중 ${pageNo}면)</span>
          </div>
        `;
        paperContainer.appendChild(pageEl);
      }
    }

    restorePassageHighlightState();
  }

  // =========================================================
  // ⭕/❌ O/X 채점 도장 표식 & ✒️ 한글 프로그램 방식 개별 글자 펜 색상(검정/빨강/파랑) 서식 엔진
  // =========================================================
  // (상단에 이미 전역 선언됨)

  const colorHexCodes = {
    black: '#000000',
    red: '#dc2626',
    blue: '#2563eb'
  };

  const btnPenBlack = document.getElementById('btnPenBlack');
  const btnPenRed = document.getElementById('btnPenRed');
  const btnPenBlue = document.getElementById('btnPenBlue');

  function applyRichTextColor(colorName, targetQNum = null) {
    activePenColor = colorName;
    const hexColor = colorHexCodes[colorName] || '#000000';

    if (btnPenBlack) btnPenBlack.classList.toggle('active-pen', colorName === 'black');
    if (btnPenRed) btnPenRed.classList.toggle('active-pen', colorName === 'red');
    if (btnPenBlue) btnPenBlue.classList.toggle('active-pen', colorName === 'blue');

    const qNum = targetQNum || activeQuestionId;
    if (qNum) {
      const ansKey = getAnswerKey(qNum);
      qPenColorMap[ansKey] = colorName;
      qPenColorMap[qNum] = colorName;
      const el = document.getElementById(`ans-text-${qNum}`);
      if (el) {
        el.focus();
        try {
          document.execCommand('styleWithCSS', false, true);
          document.execCommand('foreColor', false, hexColor);
        } catch (e) {}

        userAnswers[ansKey] = el.innerText.trim();
        userAnswers[qNum] = el.innerText.trim();
        userAnswersHtmlMap[ansKey] = el.innerHTML;
        userAnswersHtmlMap[qNum] = el.innerHTML;
        saveDraftAnswers();
      }
    }
  }

  if (btnPenBlack) btnPenBlack.addEventListener('click', () => applyRichTextColor('black'));
  if (btnPenRed) btnPenRed.addEventListener('click', () => applyRichTextColor('red'));
  if (btnPenBlue) btnPenBlue.addEventListener('click', () => applyRichTextColor('blue'));

  // =========================================================
  // 🎯 자가 채점 O / △ / X 자동 점수 계산 및 실시간 스코어보드 엔진
  // ⭕ O: 만점 (4점/2점/20점)
  // 🔺 세모: 절반 점수 (2점/1점/10점)
  // ❌ X: 기본 25% 점수 (4점 만점 시 1점 / 2점 만점 시 0.5점 / 20점 만점 시 5점)
  // =========================================================
  function calculateSelfGradingScores() {
    let scoreP = 0;
    let scoreA = 0;
    let scoreB = 0;
    let countO = 0;
    let countTri = 0;
    let countX = 0;
    let gradedCount = 0;
    let totalQuestions = 1 + 12 + 11; // 24문항

    // 1교시 교육학 (20점)
    const pMark = omrMarksMap['P_1'] || omrMarksMap['1'];
    if (pMark === 'O') { scoreP += 20; countO++; gradedCount++; }
    else if (pMark === 'TRIANGLE') { scoreP += 10; countTri++; gradedCount++; }
    else if (pMark === 'X') { scoreP += 5; countX++; gradedCount++; }

    // 2교시 전공 A (40점: 1~4번 각 2점, 5~12번 각 4점)
    for (let i = 1; i <= 12; i++) {
      const qScore = (i <= 4) ? 2 : 4;
      const aMark = omrMarksMap[`A_${i}`];
      if (aMark === 'O') {
        scoreA += qScore;
        countO++;
        gradedCount++;
      } else if (aMark === 'TRIANGLE') {
        scoreA += (qScore * 0.5); // 세모 절반 점수 (4점->2점, 2점->1점)
        countTri++;
        gradedCount++;
      } else if (aMark === 'X') {
        scoreA += (qScore * 0.25); // X 기본 25% 점수 (4점->1점, 2점->0.5점)
        countX++;
        gradedCount++;
      }
    }

    // 3교시 전공 B (40점: 1~2번 각 2점, 3~11번 각 4점)
    for (let i = 1; i <= 11; i++) {
      const qScore = (i <= 2) ? 2 : 4;
      const bMark = omrMarksMap[`B_${i}`];
      if (bMark === 'O') {
        scoreB += qScore;
        countO++;
        gradedCount++;
      } else if (bMark === 'TRIANGLE') {
        scoreB += (qScore * 0.5); // 세모 절반 점수 (4점->2점, 2점->1점)
        countTri++;
        gradedCount++;
      } else if (bMark === 'X') {
        scoreB += (qScore * 0.25); // X 기본 25% 점수 (4점->1점, 2점->0.5점)
        countX++;
        gradedCount++;
      }
    }

    const totalScore = scoreP + scoreA + scoreB;
    return { scoreP, scoreA, scoreB, totalScore, gradedCount, totalQuestions, countO, countTri, countX };
  }

  function updateSelfGradingBanner() {
    const bannerEl = document.getElementById('realtimeScoreBanner');
    if (!bannerEl) return;

    const scores = calculateSelfGradingScores();
    const floatingBadge = document.getElementById('floatingScoreBadge');
    if (floatingBadge) {
      floatingBadge.textContent = `${scores.totalScore.toFixed(1)}/100점`;
    }
    bannerEl.innerHTML = `
      <div class="score-banner-title">
        <span>🎯 <strong>실시간 자가채점 스코어보드</strong> (진행: ${scores.gradedCount}/${scores.totalQuestions}문항 | ⭕:${scores.countO} 🔺:${scores.countTri} ❌:${scores.countX})</span>
      </div>
      <div class="score-banner-stats">
        <span class="score-pill">1교시 교육학: <strong style="color:#60a5fa;">${scores.scoreP.toFixed(1)}</strong>/20점</span>
        <span class="score-pill">2교시 전공A: <strong style="color:#f87171;">${scores.scoreA.toFixed(1)}</strong>/40점</span>
        <span class="score-pill">3교시 전공B: <strong style="color:#38bdf8;">${scores.scoreB.toFixed(1)}</strong>/40점</span>
        <span class="score-pill total">🏆 최종 총점: <strong>${scores.totalScore.toFixed(1)}</strong> / 100점</span>
      </div>
    `;
  }

  function getEarnedScoreByMark(qScore, markType) {
    if (markType === 'O') return qScore;
    if (markType === 'TRIANGLE') return qScore * 0.5;
    if (markType === 'X') return qScore * 0.25;
    return 0;
  }

  function setSelfGradeMark(ansKey, markType, qCell = null) {
    if (omrMarksMap[ansKey] === markType) {
      omrMarksMap[ansKey] = null; // 같은 도장 다시 누르면 취소
    } else {
      omrMarksMap[ansKey] = markType;
    }

    // OMR 라벨 도장 갱신
    const cellEl = qCell || document.querySelector(`[data-anskey="${ansKey}"]`);
    if (cellEl) {
      updateOMRMarkDisplay(ansKey, cellEl);
    }

    // OMR 버튼 스타일 갱신
    document.querySelectorAll(`.btn-grade-choice[data-anskey="${ansKey}"]`).forEach(btn => {
      const type = btn.dataset.marktype;
      btn.classList.toggle('active-o', type === 'O' && omrMarksMap[ansKey] === 'O');
      btn.classList.toggle('active-tri', type === 'TRIANGLE' && omrMarksMap[ansKey] === 'TRIANGLE');
      btn.classList.toggle('active-x', type === 'X' && omrMarksMap[ansKey] === 'X');
    });

    // 개별 문항 획득 점수 뱃지 갱신
    const earnedTagEl = document.getElementById(`earned-score-tag-${ansKey}`);
    if (earnedTagEl) {
      const qScore = parseFloat(earnedTagEl.dataset.maxscore) || 4;
      const earned = getEarnedScoreByMark(qScore, omrMarksMap[ansKey]);
      const cur = omrMarksMap[ansKey];
      earnedTagEl.className = `grade-score-tag ${cur === 'O' ? 'tag-full' : cur === 'TRIANGLE' ? 'tag-half' : cur === 'X' ? 'tag-zero' : ''}`;
      earnedTagEl.textContent = cur ? `[+${earned.toFixed(1)}점]` : '';
    }

    updateSelfGradingBanner();
    saveDraftAnswers();
  }

  function updateOMRMarkDisplay(qNum, qCell) {
    let markBadge = qCell.querySelector('.omr-mark-badge');
    if (markBadge) markBadge.remove();

    const currentState = omrMarksMap[qNum];
    if (currentState === 'O') {
      const b = document.createElement('div');
      b.className = 'omr-mark-badge';
      b.innerHTML = '<div class="omr-mark-o"></div>';
      qCell.appendChild(b);
    } else if (currentState === 'X') {
      const b = document.createElement('div');
      b.className = 'omr-mark-badge';
      b.innerHTML = '<div class="omr-mark-x"></div>';
      qCell.appendChild(b);
    } else if (currentState === 'TRIANGLE') {
      const b = document.createElement('div');
      b.className = 'omr-mark-badge';
      b.innerHTML = `
        <div class="omr-mark-triangle">
          <svg viewBox="0 0 100 100">
            <polygon points="50,10 92,86 8,86" fill="none" stroke="#f59e0b" stroke-width="12" stroke-linejoin="round" />
          </svg>
        </div>
      `;
      qCell.appendChild(b);
    }
  }

  function toggleOMRMark(qNum, qCell) {
    const current = omrMarksMap[qNum];
    if (!current) setSelfGradeMark(qNum, 'O', qCell);
    else if (current === 'O') setSelfGradeMark(qNum, 'TRIANGLE', qCell);
    else if (current === 'TRIANGLE') setSelfGradeMark(qNum, 'X', qCell);
    else setSelfGradeMark(qNum, null, qCell);
  }

  // =========================================================
  // 💾 OMR 답안 & O/X/△ 채점 도장 & 글자별 개별 서식 HTML 영구 저장 및 완벽 복원
  // =========================================================
  async function saveDraftAnswers() {
    const userKey = currentUser ? (currentUser.studentNo || currentUser.username) : 'guest';
    const draftKey = `draft_${userKey}_${currentExamId}`;

    const draftData = {
      userAnswers: userAnswers || {},
      userAnswersHtmlMap: userAnswersHtmlMap || {},
      omrMarksMap: omrMarksMap || {},
      qPenColorMap: qPenColorMap || {},
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));

      fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentNo: userKey,
          username: userKey,
          examId: currentExamId,
          userAnswers,
          userAnswersHtmlMap,
          omrMarksMap,
          qPenColorMap
        })
      }).catch(() => {});
    } catch (e) {
      console.error(e);
    }
  }

  async function loadDraftAnswers() {
    const userKey = currentUser ? (currentUser.studentNo || currentUser.username) : 'guest';
    const draftKey = `draft_${userKey}_${currentExamId}`;

    // 회차 이동 시 전역 답안 메모리를 오직 해당 회차(currentExamId) 전용으로 깨끗하게 초기화
    userAnswers = {};
    userAnswersHtmlMap = {};
    omrMarksMap = {};
    qPenColorMap = {};

    // 1차: 로컬스토리지에서 현재 회차(currentExamId) 전용 데이터만 100% 복원
    try {
      const localItem = localStorage.getItem(draftKey);
      if (localItem) {
        const parsed = JSON.parse(localItem);
        if (parsed.userAnswers) userAnswers = { ...parsed.userAnswers };
        if (parsed.userAnswersHtmlMap) userAnswersHtmlMap = { ...parsed.userAnswersHtmlMap };
        if (parsed.omrMarksMap) omrMarksMap = { ...parsed.omrMarksMap };
        if (parsed.qPenColorMap) qPenColorMap = { ...parsed.qPenColorMap };
      }
    } catch (e) {
      console.error(e);
    }

    // 2차: 백엔드 서버 API에 저장된 현재 회차 내역만 병합 복원
    try {
      const res = await fetch(`/api/drafts/${userKey}/${currentExamId}`);
      const data = await res.json();
      if (data.success && data.draft) {
        if (data.draft.userAnswers) userAnswers = { ...userAnswers, ...data.draft.userAnswers };
        if (data.draft.userAnswersHtmlMap) userAnswersHtmlMap = { ...userAnswersHtmlMap, ...data.draft.userAnswersHtmlMap };
        if (data.draft.omrMarksMap) omrMarksMap = { ...omrMarksMap, ...data.draft.omrMarksMap };
        if (data.draft.qPenColorMap) qPenColorMap = { ...qPenColorMap, ...data.draft.qPenColorMap };
      }
    } catch (e) {}

    updateSelfGradingBanner();
  }

  // 교시별 답안 고유 키 생성 도우미 (2교시 전공A_1과 3교시 전공B_1 답안지 완전 분리!)
  function getAnswerKey(qNum) {
    const sec = currentSectionKey || 'A';
    if (String(qNum).startsWith(`${sec}_`)) return String(qNum);
    return `${sec}_${qNum}`;
  }

  function renderOMRForm(questions) {
    omrAnswerContainer.innerHTML = '';
    
    // 실제 KICE 평가원 답안지 상단 OMR 마킹 안내 헤더 삽입
    const isPed = (currentSectionKey === 'P');
    const isSecA = (currentSectionKey === 'A');
    const isSecB = (currentSectionKey === 'B');
    
    const omrTopHeader = document.createElement('div');
    omrTopHeader.className = `kice-omr-header-box ${isPed ? 'theme-ped' : isSecA ? 'theme-a' : 'theme-b'}`;
    omrTopHeader.innerHTML = `
      <div class="kice-header-title-row">
        <div class="kice-sec-badge">${isPed ? '1교시' : isSecA ? '2교시' : '3교시'}</div>
        <div class="kice-exam-main-title">2027학년도 중등학교교사 임용후보자 선정경쟁시험 제1차 시험 답안지</div>
      </div>
      <div class="kice-notice-banner">
        <span>1. 수험 번호 및 성명을 확인 후 작성하십시오.</span>
        <span>2. 답안은 지워지거나 번지지 않는 검은색 펜을 사용하여 작성하십시오.</span>
        <span>💡 [⭕/🔺/❌] 자가채점 버튼을 누르면 실시간 총점이 자동 계산됩니다!</span>
      </div>
    `;
    omrAnswerContainer.appendChild(omrTopHeader);

    // 1. 문항별 실전 줄노트 답안 상자 렌더링 (사용자가 바로 작성할 수 있도록 최상단에 전면 노출!)
    if (questions && questions.length > 0) {
      questions.forEach((q, idx) => {
        const qNumInt = idx + 1; // 🎯 교시 내 실제 문항 번호 (1번, 2번, 3번...)
        const qNum = qNumInt;
        const ansKey = getAnswerKey(qNumInt);
        const qScore = q.points || q.score || (isPed ? 20 : (isSecA ? (qNumInt <= 4 ? 2 : 4) : (qNumInt <= 2 ? 2 : 4)));
        const qColor = qPenColorMap[ansKey] || qPenColorMap[qNum] || 'black';

        // 1줄 vs 4줄 판정:
        // A형: 1~4번은 1줄(단답형 2점), 5~12번은 4줄(서술형 4점)
        // B형: 1~2번은 1줄(단답형 2점), 3~11번은 4줄(서술형 4점)
        let isOneLine = false;
        if (isSecA && qNumInt <= 4) isOneLine = true;
        if (isSecB && qNumInt <= 2) isOneLine = true;

        let colorThemeClass = 'theme-red';
        if (isPed) {
          colorThemeClass = 'theme-ped';
        } else if (isSecA) {
          if (qNumInt >= 8) colorThemeClass = 'theme-gray';
          else colorThemeClass = 'theme-red';
        } else if (isSecB) {
          if (qNumInt >= 7) colorThemeClass = 'theme-cyan';
          else colorThemeClass = 'theme-red';
        }

        const box = document.createElement('div');
        box.className = `pink-omr-box ${isPed ? 'pedagogy-box' : ''} ${isOneLine ? 'oneline-omr-box' : 'fourline-omr-box'} ${colorThemeClass}`;
        box.id = `omr-card-${qNumInt}`;

        const savedHtml = userAnswersHtmlMap[ansKey] || userAnswers[ansKey] || '';
        const savedText = userAnswers[ansKey] || '';
        const curMark = omrMarksMap[ansKey] || null;

        const earnedScore = getEarnedScoreByMark(qScore, curMark);
        const earnedTagText = curMark ? `[+${earnedScore.toFixed(1)}점]` : '';
        const tagClass = curMark === 'O' ? 'tag-full' : curMark === 'TRIANGLE' ? 'tag-half' : curMark === 'X' ? 'tag-zero' : '';

        box.innerHTML = `
          <div class="pink-q-cell pink-q-label" id="q-label-cell-${qNumInt}" data-anskey="${ansKey}" title="클릭하여 O/X/△ 도장을 찍으세요">
            <div class="pink-q-num">${isPed ? '교육학' : `문항 ${qNumInt}`}</div>
            <div class="pink-q-score">(${qScore}점)</div>
            <div id="earned-score-tag-${ansKey}" class="grade-score-tag ${tagClass}" data-maxscore="${qScore}">${earnedTagText}</div>
          </div>
          <div class="pink-input-cell">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:4px;">
              <!-- O / △ / X 원클릭 자가채점 버튼 바 -->
              <div class="omr-self-grade-bar">
                <span style="font-size:11.5px; font-weight:800; color:#475569; margin-right:4px;">채점:</span>
                <button type="button" class="btn-grade-choice ${curMark === 'O' ? 'active-o' : ''}" data-anskey="${ansKey}" data-marktype="O" title="정답 (+${qScore}점)">⭕ 정답 (+${qScore}점)</button>
                <button type="button" class="btn-grade-choice ${curMark === 'TRIANGLE' ? 'active-tri' : ''}" data-anskey="${ansKey}" data-marktype="TRIANGLE" title="부분점수 (+${(qScore * 0.5).toFixed(1)}점)">🔺 세모 (+${(qScore * 0.5).toFixed(1)}점)</button>
                <button type="button" class="btn-grade-choice ${curMark === 'X' ? 'active-x' : ''}" data-anskey="${ansKey}" data-marktype="X" title="기본점수 (+${(qScore * 0.25).toFixed(1)}점)">❌ 오답 (+${(qScore * 0.25).toFixed(1)}점)</button>
              </div>
              <div class="pink-char-counter" id="char-count-${qNumInt}" style="margin:0;">${savedText.length} 자${isPed ? '' : (isOneLine ? ' (단답 1줄)' : ' (최대 4줄)')}</div>
            </div>
            <div id="ans-text-${qNumInt}" contenteditable="true" class="pink-rich-textarea ${isPed ? 'pedagogy-textarea' : ''} ${isOneLine ? 'oneline-textarea' : 'fourline-textarea'} ${colorThemeClass}-textarea" data-placeholder="${isPed ? '교육학 논술 서론-본론-결론 구조로 작성하세요 (1200~1500자)' : (isOneLine ? `문항 ${qNumInt}번 단답형 답안을 1줄에 작성하세요.` : `문항 ${qNumInt}번 서술형 답안을 4줄에 작성하세요.`)}">${savedHtml}</div>
          </div>
        `;

        omrAnswerContainer.appendChild(box);

        const qCell = box.querySelector(`#q-label-cell-${qNumInt}`);
        if (qCell) {
          updateOMRMarkDisplay(ansKey, qCell);
          qCell.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleOMRMark(ansKey, qCell);
          });
        }

        // O / △ / X 버튼 클릭 이벤트 리스너
        box.querySelectorAll('.btn-grade-choice').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetKey = btn.dataset.anskey;
            const targetMark = btn.dataset.marktype;
            setSelfGradeMark(targetKey, targetMark, qCell);
          });
        });

        const ed = box.querySelector(`#ans-text-${qNumInt}`);
        if (ed) {
          ed.addEventListener('focus', () => {
            selectQuestion(qNumInt);
            const curColor = qPenColorMap[ansKey] || qPenColorMap[qNumInt] || 'black';
            if (btnPenBlack) btnPenBlack.classList.toggle('active-pen', curColor === 'black');
            if (btnPenRed) btnPenRed.classList.toggle('active-pen', curColor === 'red');
            if (btnPenBlue) btnPenBlue.classList.toggle('active-pen', curColor === 'blue');
          });

          ed.addEventListener('input', () => {
            const textVal = ed.innerText.trim();
            userAnswers[ansKey] = textVal;
            userAnswers[qNumInt] = textVal; // 하위 호환
            userAnswersHtmlMap[ansKey] = ed.innerHTML;
            userAnswersHtmlMap[qNumInt] = ed.innerHTML;
            const counterEl = document.getElementById(`char-count-${qNumInt}`);
            if (counterEl) counterEl.textContent = `${textVal.length} 자${isPed ? '' : (isOneLine ? ' (단답 1줄)' : ' (최대 4줄)')}`;
            updateTotalCharCount();
            saveDraftAnswers(); // 실시간 회원별 영구 저장!
          });
        }
      });
    }

    // 2. 실시간 자가 채점 스코어보드 배너 삽입 (답안지 작성란 하단에 안정적으로 배치)
    const bannerContainer = document.createElement('div');
    bannerContainer.id = 'realtimeScoreBanner';
    bannerContainer.className = 'realtime-score-banner';
    omrAnswerContainer.appendChild(bannerContainer);
    
    updateTotalCharCount();
    updateSelfGradingBanner();
  }

  function renderTabs(questions) {
    questionTabs.innerHTML = '';
    questions.forEach((q, idx) => {
      const qNumInt = idx + 1;
      const isSecA = (currentSectionKey === 'A');
      const isSecB = (currentSectionKey === 'B');
      let isOneLine = false;
      if (isSecA && qNumInt <= 4) isOneLine = true;
      if (isSecB && qNumInt <= 2) isOneLine = true;

      const qScore = q.points || q.score || (currentSectionKey === 'P' ? 20 : (isOneLine ? 2 : 4));
      const qType = isOneLine ? '단답형' : '서술형';

      const btn = document.createElement('button');
      btn.className = 'q-tab';
      btn.dataset.qid = qNumInt;
      btn.textContent = currentSectionKey === 'P' ? '1교시 교육학 논술 (20점)' : `문항 ${qNumInt}번 [${qScore}점] (${qType})`;
      btn.addEventListener('click', () => selectQuestion(qNumInt));
      questionTabs.appendChild(btn);
    });
  }

  function updateTotalCharCount() {
    const total = Object.values(userAnswers).reduce((acc, val) => acc + (val ? val.length : 0), 0);
    totalCharCount.textContent = `작성 글자 수: ${total}자`;
  }

  btnPauseTimer.addEventListener('click', () => {
    isTimerPaused = !isTimerPaused;
    btnPauseTimer.textContent = isTimerPaused ? '▶ 계속 진행' : '⏸️ 일시정지';
  });

  btnZoomIn.addEventListener('click', () => {
    if (zoomPercent < 150) {
      zoomPercent += 10;
      zoomLevel.textContent = `${zoomPercent}%`;
      paperBody.style.fontSize = `${15 * (zoomPercent / 100)}px`;
    }
  });

  btnZoomOut.addEventListener('click', () => {
    if (zoomPercent > 80) {
      zoomPercent -= 10;
      zoomLevel.textContent = `${zoomPercent}%`;
      paperBody.style.fontSize = `${15 * (zoomPercent / 100)}px`;
    }
  });

  btnSaveTemp.addEventListener('click', async () => {
    saveDraftAnswers();
    const userName = currentUser ? currentUser.name : '수험생';
    alert(`💾 [${userName}]님의 [${currentExam ? currentExam.title : '모의고사'}] 작성 답안이 회원 계정에 안전하게 임시 저장되었습니다!\n(페이지 이동/새로고침을 하거나 재접속해도 답안이 유지됩니다.)`);
  });

  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
      window.location.href = '/api/admin/export-csv';
    });
  }

  btnSubmitExam.addEventListener('click', () => {
    if (confirm(`3교시 전공 B형까지 모두 마쳤습니다. 전체 시험 답안을 최종 제출하시겠습니까?`)) {
      submitFinalExam();
    }
  });

  async function submitFinalExam() {
    if (sectionTimerInterval) clearInterval(sectionTimerInterval);
    if (qTimerInterval) clearInterval(qTimerInterval);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: currentExam.id,
          userAnswers,
          user: currentUser
        })
      });
      const data = await res.json();
      if (data.success) {
        showResultModal(data.result);
      }
    } catch (err) {
      console.error(err);
      alert('답안 제출 중 오류가 발생했습니다.');
    }
  }

  function showResultModal(result) {
    const scores = calculateSelfGradingScores();
    const displayTotal = scores.gradedCount > 0 ? scores.totalScore : (result.totalScore || 0);

    scoreVal.textContent = displayTotal.toFixed(1);
    maxScoreVal.textContent = result.maxScore || 100;
    resultName.textContent = `${result.studentName} (${result.studentNo})`;
    resultTime.textContent = new Date().toLocaleTimeString();
    resultModalTitle.textContent = '🎉 2027 임용고시 전체 종합 (교육학 20점 + 전공 80점) 성적 리포트';

    resultDetailsList.innerHTML = '';
    result.details.forEach((item, idx) => {
      const qScore = item.score || (item.section === '교육학' ? 20 : 4);
      let secKey = item.section === '교육학' ? 'P' : (item.section === '전공 A' ? 'A' : 'B');
      let qNumInt = idx + 1;
      if (secKey === 'A') qNumInt = idx; // 교육학 다음
      if (secKey === 'B') qNumInt = idx - 12;
      let ansKey = `${secKey}_${qNumInt}`;
      if (secKey === 'P') ansKey = 'P_1';

      const curMark = omrMarksMap[ansKey] || null;
      const earned = curMark ? getEarnedScoreByMark(qScore, curMark) : (item.earnedScore || 0);

      const div = document.createElement('div');
      div.className = 'result-detail-item';
      div.id = `result-item-${ansKey}`;
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div class="result-q-title" style="margin:0;">문항 [${item.section || '교육학'}] ${item.title} (배점: ${qScore}점)</div>
          <div class="result-self-grade-row" style="margin:0; padding:4px 10px;">
            <span style="font-size:12px; font-weight:800; color:#475569; margin-right:4px;">채점하기:</span>
            <button type="button" class="btn-grade-choice res-btn-grade ${curMark === 'O' ? 'active-o' : ''}" data-reskey="${ansKey}" data-resscore="${qScore}" data-marktype="O">⭕ 만점 (+${qScore}점)</button>
            <button type="button" class="btn-grade-choice res-btn-grade ${curMark === 'TRIANGLE' ? 'active-tri' : ''}" data-reskey="${ansKey}" data-resscore="${qScore}" data-marktype="TRIANGLE">🔺 세모 (+${(qScore * 0.5).toFixed(1)}점)</button>
            <button type="button" class="btn-grade-choice res-btn-grade ${curMark === 'X' ? 'active-x' : ''}" data-reskey="${ansKey}" data-resscore="${qScore}" data-marktype="X">❌ 오답 (+${(qScore * 0.25).toFixed(1)}점)</button>
            <span id="res-score-badge-${ansKey}" class="grade-score-tag ${curMark === 'O' ? 'tag-full' : curMark === 'TRIANGLE' ? 'tag-half' : curMark === 'X' ? 'tag-zero' : ''}" style="margin-left:6px;">획득: <strong style="color:#7c3aed;">${earned.toFixed(1)}점</strong></span>
          </div>
        </div>
        <div class="ans-box ans-user"><strong>내 작성 답안:</strong><br>${item.userAnswer || '(작성 내용 없음)'}</div>
        <div class="ans-box ans-model"><strong>평가원 모범 답안 & 칼채점 루브릭:</strong><br>${item.modelAnswer}</div>
      `;

      div.querySelectorAll('.res-btn-grade').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetKey = btn.dataset.reskey;
          const mark = btn.dataset.marktype;
          setSelfGradeMark(targetKey, mark);

          // 결과 모달 내 버튼 UI & 뱃지 갱신
          const cur = omrMarksMap[targetKey];
          div.querySelectorAll('.res-btn-grade').forEach(b => {
            const m = b.dataset.marktype;
            b.classList.toggle('active-o', m === 'O' && cur === 'O');
            b.classList.toggle('active-tri', m === 'TRIANGLE' && cur === 'TRIANGLE');
            b.classList.toggle('active-x', m === 'X' && cur === 'X');
          });

          const badgeEl = document.getElementById(`res-score-badge-${targetKey}`);
          if (badgeEl) {
            const newEarned = getEarnedScoreByMark(qScore, cur);
            badgeEl.className = `grade-score-tag ${cur === 'O' ? 'tag-full' : cur === 'TRIANGLE' ? 'tag-half' : cur === 'X' ? 'tag-zero' : ''}`;
            badgeEl.innerHTML = `획득: <strong style="color:#7c3aed;">${newEarned.toFixed(1)}점</strong>`;
          }

          // 종합 총점 원형 차트 실시간 재계산
          const updatedScores = calculateSelfGradingScores();
          scoreVal.textContent = updatedScores.totalScore.toFixed(1);
        });
      });

      resultDetailsList.appendChild(div);
    });

    resultModal.classList.remove('hidden');
  }

  btnCloseModal.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    if (currentSectionKey === 'P' && completedSections.P) {
      startSection('A');
    } else if (currentSectionKey === 'A' && completedSections.A) {
      startSection('B');
    }
  });

  btnRetryExam.addEventListener('click', () => location.reload());
  btnPrintResult.addEventListener('click', () => window.print());

  // 관리자 대시보드
  btnAdminDashboardNav.addEventListener('click', openAdminDashboard);

  async function openAdminDashboard() {
    try {
      const res = await fetch('/api/admin/submissions');
      const data = await res.json();
      if (data.success) {
        adminSubmissions = data.submissions;
        renderAdminSubmissionList();
        adminModal.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      alert('관리자 데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }

  function renderAdminSubmissionList() {
    submissionList.innerHTML = '';
    if (adminSubmissions.length === 0) {
      submissionList.innerHTML = '<p style="color:#64748b; font-size:14px;">제출된 답안지가 없습니다.</p>';
      return;
    }

    adminSubmissions.forEach(sub => {
      const div = document.createElement('div');
      div.className = `sub-item ${selectedSubmission && selectedSubmission.id === sub.id ? 'active-sub' : ''}`;
      div.innerHTML = `
        <div class="sub-item-name">${sub.studentName} <span style="font-weight:400; font-size:13px;">(${sub.studentNo})</span></div>
        <div class="sub-item-meta">시험: ${sub.examId} / 제출: ${sub.submittedAt}</div>
        <div class="sub-item-score">점수: ${sub.totalScore} / ${sub.maxScore}점 [${sub.status}]</div>
      `;
      div.addEventListener('click', () => selectAdminSubmission(sub));
      submissionList.appendChild(div);
    });
  }

  function selectAdminSubmission(sub) {
    selectedSubmission = sub;
    renderAdminSubmissionList();

    gradingHeader.innerHTML = `
      <h3>📝 ${sub.studentName} (${sub.studentNo}) 님의 답안지 [${sub.examId} / 제출: ${sub.submittedAt}]</h3>
      <p style="font-size:14px; color:#64748b; margin-top:4px;">종합점수: <strong style="color:#7c3aed; font-size:16px;">${sub.totalScore}</strong> / ${sub.maxScore}점</p>
    `;

    gradingDetailsContainer.innerHTML = '';
    sub.details.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'admin-q-card';
      card.innerHTML = `
        <div class="admin-q-header">문항 [${item.section || '교육학'}] ${item.title} (배점: ${item.score}점)</div>
        <div class="user-ans-display"><strong>[수험생 서술 답안]</strong><br>${item.userAnswer || '(작성 내용 없음)'}</div>
        <div class="model-ans-display"><strong>[모범 답안]</strong><br>${item.modelAnswer}</div>
        <div class="admin-input-row">
          <label>수동 점수 부여:</label>
          <input type="number" step="0.5" min="0" max="${item.score}" id="admin-score-${idx}" value="${item.earnedScore}">
          <label>관리자 첨삭 피드백:</label>
          <textarea id="admin-fb-${idx}" placeholder="수험생에게 남길 첨삭 코멘트를 입력하세요.">${item.feedback || ''}</textarea>
        </div>
      `;
      gradingDetailsContainer.appendChild(card);
    });

    adminActionFooter.classList.remove('hidden');
  }

  btnSaveAdminGrade.addEventListener('click', async () => {
    if (!selectedSubmission) return;

    let newTotalScore = 0;
    const updatedDetails = selectedSubmission.details.map((item, idx) => {
      const scoreInput = document.getElementById(`admin-score-${idx}`);
      const fbInput = document.getElementById(`admin-fb-${idx}`);
      const newScore = parseFloat(scoreInput.value) || 0;
      newTotalScore += newScore;

      return {
        ...item,
        earnedScore: newScore,
        feedback: fbInput.value
      };
    });

    try {
      const res = await fetch('/api/admin/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: selectedSubmission.id,
          updatedDetails,
          totalScore: newTotalScore
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('수동 채점 및 첨삭 피드백이 저장되었습니다!');
        await openAdminDashboard();
      }
    } catch (err) {
      console.error(err);
      alert('채점 저장 중 오류가 발생했습니다.');
    }
  });

  btnCloseAdminModal.addEventListener('click', () => adminModal.classList.add('hidden'));

  // 암호 변경 모달
  btnOpenChangePwModal.addEventListener('click', () => {
    inputCurrentPw.value = '';
    inputNewPw.value = '';
    changePwModal.classList.remove('hidden');
  });

  btnClosePwModal.addEventListener('click', () => {
    changePwModal.classList.add('hidden');
  });

  btnSubmitChangePw.addEventListener('click', async () => {
    const currentPassword = inputCurrentPw.value.trim();
    const newPassword = inputNewPw.value.trim();

    if (!currentPassword || !newPassword) {
      alert('현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.');
      return;
    }

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (data.success) {
        alert('🎉 ' + data.message + '\n다음 로그인 시 변경한 비밀번호를 입력하세요.');
        changePwModal.classList.add('hidden');
      } else {
        alert('❌ ' + (data.message || '비밀번호 변경 실패'));
      }
    } catch (e) {
      console.error(e);
      alert('비밀번호 변경 처리 중 오류가 발생했습니다.');
    }
  });

  // =========================================================
  // 🖍️ 4색 지문 형광펜 & 펜 색칠 기능 (자동 저장 및 복원 엔진)
  // =========================================================
  const colorSchemes = {
    yellow: { bg: '#fef08a', text: '#1e293b' },
    red: { bg: '#ffe4e6', text: '#dc2626' },
    green: { bg: '#bbf7d0', text: '#065f46' },
    blue: { bg: '#bfdbfe', text: '#1e40af' }
  };

  function applyHighlightColor(colorName) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) {
      alert('💡 색칠할 지문 텍스트를 마우스로 드래그 선택한 후 버튼을 누르세요!');
      return;
    }

    const scheme = colorSchemes[colorName] || colorSchemes.yellow;
    const paperBody = document.getElementById('paperBody') || document.body;
    const prevEditable = paperBody.isContentEditable;

    try {
      paperBody.contentEditable = 'true';
      document.execCommand('foreColor', false, scheme.text);
      document.execCommand('hiliteColor', false, scheme.bg);
    } catch (e) {
      console.error('Highlight execCommand error:', e);
    } finally {
      paperBody.contentEditable = prevEditable ? 'true' : 'false';
    }

    sel.removeAllRanges();
    savePassageHighlightState();
  }

  function clearPassageHighlight() {
    const sel = window.getSelection();
    const paperBody = document.getElementById('paperBody') || document.body;
    const prevEditable = paperBody.isContentEditable;

    try {
      paperBody.contentEditable = 'true';
      if (sel && !sel.isCollapsed) {
        document.execCommand('removeFormat', false, null);
        document.execCommand('foreColor', false, '#1e293b');
        document.execCommand('hiliteColor', false, 'transparent');
      } else {
        const colored = paperBody.querySelectorAll('*');
        colored.forEach(el => {
          el.style.color = '';
          el.style.backgroundColor = '';
        });
      }
    } catch(e) {
      console.error('Clear highlight error:', e);
    } finally {
      paperBody.contentEditable = prevEditable ? 'true' : 'false';
    }

    if (sel) sel.removeAllRanges();
    savePassageHighlightState();
  }

  function savePassageHighlightState() {
    const paperBody = document.getElementById('paperBody');
    if (!paperBody || !currentExamId || !currentSectionKey) return;
    const userKey = currentUser ? currentUser.username : 'guest';
    const key = `exam_hl_${userKey}_${currentExamId}_${currentSectionKey}`;
    try {
      localStorage.setItem(key, paperBody.innerHTML);
    } catch (e) {}
  }

  function restorePassageHighlightState() {
    const paperBody = document.getElementById('paperBody');
    if (!paperBody || !currentExamId || !currentSectionKey) return;
    const userKey = currentUser ? currentUser.username : 'guest';
    const key = `exam_hl_${userKey}_${currentExamId}_${currentSectionKey}`;
    try {
      const savedHtml = localStorage.getItem(key);
      if (savedHtml && savedHtml.trim().length > 0) {
        paperBody.innerHTML = savedHtml;
      }
    } catch (e) {}
  }

  const btnHlYellow = document.getElementById('btnHlYellow');
  const btnHlRed = document.getElementById('btnHlRed');
  const btnHlGreen = document.getElementById('btnHlGreen');
  const btnHlBlue = document.getElementById('btnHlBlue');
  const btnClearHl = document.getElementById('btnClearHl');

  if (btnHlYellow) {
    btnHlYellow.addEventListener('mousedown', (e) => e.preventDefault());
    btnHlYellow.addEventListener('click', () => applyHighlightColor('yellow'));
  }
  if (btnHlRed) {
    btnHlRed.addEventListener('mousedown', (e) => e.preventDefault());
    btnHlRed.addEventListener('click', () => applyHighlightColor('red'));
  }
  if (btnHlGreen) {
    btnHlGreen.addEventListener('mousedown', (e) => e.preventDefault());
    btnHlGreen.addEventListener('click', () => applyHighlightColor('green'));
  }
  if (btnHlBlue) {
    btnHlBlue.addEventListener('mousedown', (e) => e.preventDefault());
    btnHlBlue.addEventListener('click', () => applyHighlightColor('blue'));
  }
  if (btnClearHl) {
    btnClearHl.addEventListener('mousedown', (e) => e.preventDefault());
    btnClearHl.addEventListener('click', clearPassageHighlight);
  }

  // ✂️ 수정테이프 (정답 가리기 / 암호 마스킹) 기능
  const btnHlStrike = document.getElementById('btnHlStrike');
  if (btnHlStrike) {
    btnHlStrike.addEventListener('mousedown', (e) => e.preventDefault());
    btnHlStrike.addEventListener('click', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) {
        alert('💡 수정테이프로 가릴 지문 텍스트(정답 단어 등)를 마우스로 드래그 선택해 주세요!');
        return;
      }

      try {
        const range = sel.getRangeAt(0);
        const span = document.createElement('span');
        span.className = 'correction-tape';
        span.title = '💡 마우스를 대면 가려진 정답이 보입니다! (클릭 시 수정테이프 제거)';

        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);

        // 클릭 시 수정테이프 떼어내기 (제거)
        span.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const parent = span.parentNode;
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
          savePassageHighlightState();
        });
      } catch (e) {
        console.error('Correction tape masking error:', e);
      }

      sel.removeAllRanges();
      savePassageHighlightState();
    });
  }

  // 📌 노란색 스티키 메모장 제어 및 실시간 저장 엔진
  const btnToggleStickyNote = document.getElementById('btnToggleStickyNote');
  const stickyNoteWidget = document.getElementById('stickyNoteWidget');
  const btnCloseStickyNote = document.getElementById('btnCloseStickyNote');
  const stickyNoteTextarea = document.getElementById('stickyNoteTextarea');
  const stickySaveBadge = document.getElementById('stickySaveBadge');

  function loadStickyNoteContent() {
    if (!stickyNoteTextarea) return;
    const userKey = currentUser ? currentUser.username : 'guest';
    const key = `user_sticky_note_${userKey}`;
    try {
      const savedText = localStorage.getItem(key);
      if (savedText !== null) {
        stickyNoteTextarea.value = savedText;
      }
    } catch(e) {}
  }

  function saveStickyNoteContent() {
    if (!stickyNoteTextarea) return;
    const userKey = currentUser ? currentUser.username : 'guest';
    const key = `user_sticky_note_${userKey}`;
    try {
      localStorage.setItem(key, stickyNoteTextarea.value);
      if (stickySaveBadge) {
        stickySaveBadge.textContent = '✓ 실시간 저장됨';
        stickySaveBadge.style.background = '#dcfce7';
        stickySaveBadge.style.color = '#15803d';
      }
    } catch(e) {}
  }

  if (btnToggleStickyNote && stickyNoteWidget) {
    btnToggleStickyNote.addEventListener('click', () => {
      loadStickyNoteContent();
      stickyNoteWidget.classList.toggle('hidden');
      if (!stickyNoteWidget.classList.contains('hidden')) {
        stickyNoteTextarea.focus();
      }
    });
  }

  if (btnCloseStickyNote && stickyNoteWidget) {
    btnCloseStickyNote.addEventListener('click', () => {
      saveStickyNoteContent();
      stickyNoteWidget.classList.add('hidden');
    });
  }

  if (stickyNoteTextarea) {
    stickyNoteTextarea.addEventListener('input', () => {
      if (stickySaveBadge) {
        stickySaveBadge.textContent = '⏳ 저장 중...';
        stickySaveBadge.style.background = '#fef3c7';
        stickySaveBadge.style.color = '#b45309';
      }
      saveStickyNoteContent();
    });
  }

  // =========================================================
  // 📱 아이패드 10.1 & 태블릿 & 모바일 전용 팝업 OMR 답안지 드로어 컨트롤러
  // =========================================================
  // (DOM element variables moved to top)

  let isPopupOmrMode = true;

  function setViewMode(popupMode) {
    isPopupOmrMode = popupMode;
    if (splitMain) {
      splitMain.classList.toggle('mode-popup-omr', isPopupOmrMode);
    }
    if (btnToggleViewMode) {
      btnToggleViewMode.textContent = isPopupOmrMode ? '🖥️ 좌우 분할 뷰' : '📱 답안지 팝업 모드';
      btnToggleViewMode.style.background = isPopupOmrMode ? '#059669' : '#4338ca';
    }
    if (btnOpenOmrDrawer) {
      btnOpenOmrDrawer.style.display = isPopupOmrMode ? 'inline-block' : 'none';
    }
    if (btnRightOmrStrip) {
      btnRightOmrStrip.style.display = isPopupOmrMode ? 'flex' : 'none';
    }
    if (!isPopupOmrMode) {
      closeOmrDrawer();
      if (paneLeft && paneRight && window.innerWidth >= 1100) {
        paneLeft.style.flex = '1 1 50%';
        paneRight.style.flex = '1 1 50%';
      }
    } else {
      if (paneLeft) {
        paneLeft.style.flex = '1 1 100%';
      }
    }
    try {
      localStorage.setItem('user_pref_popup_mode', isPopupOmrMode ? 'true' : 'false');
    } catch(e) {}
  }

  function openOmrDrawer() {
    if (splitMain) splitMain.classList.add('mode-popup-omr');
    if (paneRight) {
      paneRight.classList.add('omr-drawer-open');
    }
    if (omrBackdrop) {
      omrBackdrop.classList.remove('hidden');
    }
    if (btnOpenOmrDrawer) {
      btnOpenOmrDrawer.textContent = '✕ 답안지 닫기';
      btnOpenOmrDrawer.style.background = '#475569';
    }
  }

  function closeOmrDrawer() {
    if (paneRight) {
      paneRight.classList.remove('omr-drawer-open');
    }
    if (omrBackdrop) {
      omrBackdrop.classList.add('hidden');
    }
    if (btnOpenOmrDrawer) {
      btnOpenOmrDrawer.textContent = '📝 답안지 팝업';
      btnOpenOmrDrawer.style.background = '#0e7490';
    }
  }

  if (btnToggleViewMode) {
    btnToggleViewMode.addEventListener('click', () => {
      setViewMode(!isPopupOmrMode);
    });
  }

  const btnMoreTools = document.getElementById('btnMoreTools');
  const moreToolsMenu = document.getElementById('moreToolsMenu');

  if (btnMoreTools && moreToolsMenu) {
    btnMoreTools.addEventListener('click', (e) => {
      e.stopPropagation();
      moreToolsMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!moreToolsMenu.contains(e.target) && e.target !== btnMoreTools) {
        moreToolsMenu.classList.add('hidden');
      }
    });
  }

  function toggleOmrDrawer() {
    if (paneRight && paneRight.classList.contains('omr-drawer-open')) {
      closeOmrDrawer();
    } else {
      openOmrDrawer();
    }
  }

  if (btnOpenOmrDrawer) btnOpenOmrDrawer.addEventListener('click', toggleOmrDrawer);
  if (btnRightOmrStrip) btnRightOmrStrip.addEventListener('click', toggleOmrDrawer);
  if (btnCloseOmrDrawer) btnCloseOmrDrawer.addEventListener('click', closeOmrDrawer);
  if (omrBackdrop) omrBackdrop.addEventListener('click', closeOmrDrawer);

  // 기본적으로 팝업 답안지 모드를 기본 활성화하여 문제지가 100% 큼직하게 보이도록 설정!
  const savedPrefMode = localStorage.getItem('user_pref_popup_mode');
  if (savedPrefMode !== null) {
    setViewMode(savedPrefMode === 'true');
  } else {
    // 모든 기기(아이패드, 태블릿, PC)에서 문제지가 시원하게 보이도록 팝업 모드를 기본으로 적용!
    setViewMode(true);
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 1100 && !isPopupOmrMode) {
      setViewMode(true);
    }
  });

  // ↔️ 문제지 - 답안지 반응형 5:5 비율 조절 및 리사이저 드래그 엔진
  if (resizer && paneLeft && paneRight && splitMain) {
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      if (isPopupOmrMode) return;
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing || isPopupOmrMode) return;
      const containerRect = splitMain.getBoundingClientRect();
      const leftWidth = e.clientX - containerRect.left;
      const totalWidth = containerRect.width;

      let percentage = (leftWidth / totalWidth) * 100;
      if (percentage < 20) percentage = 20;
      if (percentage > 80) percentage = 80;

      paneLeft.style.flex = `0 0 ${percentage}%`;
      paneRight.style.flex = `0 0 ${100 - percentage}%`;
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    });
  }


  // =========================================================
  // 📱 태블릿 ULTRA 프리미엄 UX 엔진 (3단 뷰 / 터치 스와이프 / 하단 칩)
  // =========================================================
  let currentTabletViewMode = 'split'; // 'split' | 'popup' | 'single'
  let examFontScale = parseFloat(localStorage.getItem('user_exam_font_scale')) || 1.0;

  window.setExamFontScale = function(scale) {
    scale = Math.max(0.8, Math.min(2.2, parseFloat(scale) || 1.0));
    examFontScale = Math.round(scale * 10) / 10;
    document.documentElement.style.setProperty('--exam-font-scale', examFontScale);
    const disp = document.getElementById('fontScaleDisplay');
    if (disp) disp.textContent = Math.round(examFontScale * 100) + '%';
    localStorage.setItem('user_exam_font_scale', examFontScale);
  };

  window.stepExamFontScale = function(delta) {
    window.setExamFontScale(examFontScale + delta);
  };

  window.setTabletViewMode = function(mode) {
    currentTabletViewMode = mode;
    const splitMainEl = document.getElementById('splitMain');
    const paneLeftEl = document.getElementById('paneLeft');
    const paneRightEl = document.getElementById('paneRight');

    document.querySelectorAll('.v6-vm-btn').forEach(b => b.classList.remove('active'));
    if (mode === 'split') {
      const btn = document.getElementById('btnVmSplit');
      if (btn) btn.classList.add('active');
      if (splitMainEl) {
        splitMainEl.classList.remove('mode-popup-omr', 'mode-single-focus');
        splitMainEl.classList.add('mode-split');
      }
      if (paneLeftEl) paneLeftEl.style.flex = '1 1 50%';
      if (paneRightEl) {
        paneRightEl.style.flex = '1 1 50%';
        paneRightEl.classList.remove('omr-drawer-open');
      }
    } else if (mode === 'popup') {
      const btn = document.getElementById('btnVmFull');
      if (btn) btn.classList.add('active');
      if (splitMainEl) {
        splitMainEl.classList.remove('mode-split', 'mode-single-focus');
        splitMainEl.classList.add('mode-popup-omr');
      }
      if (paneLeftEl) paneLeftEl.style.flex = '1 1 100%';
    } else if (mode === 'single') {
      const btn = document.getElementById('btnVmSingle');
      if (btn) btn.classList.add('active');
      if (splitMainEl) {
        splitMainEl.classList.remove('mode-popup-omr');
        splitMainEl.classList.add('mode-single-focus');
      }
      if (paneLeftEl) paneLeftEl.style.flex = '1 1 50%';
      if (paneRightEl) {
        paneRightEl.style.flex = '1 1 50%';
        paneRightEl.classList.remove('omr-drawer-open');
      }
      updateSingleFocusDisplay(activeQuestionId);
    }
  };

  function updateSingleFocusDisplay(qNumInt) {
    if (currentTabletViewMode !== 'single') return;
    document.querySelectorAll('.q-block').forEach(b => {
      b.classList.toggle('focus-active-q', b.id === `paper-q-${qNumInt}`);
    });
    document.querySelectorAll('.pink-omr-box').forEach(b => {
      b.classList.toggle('focus-active-omr', b.id === `omr-card-${qNumInt}`);
    });
  }

  function renderTabletQuickJumpChips(questions) {
    const container = document.getElementById('jumpChipsContainer');
    if (!container) return;
    container.innerHTML = '';

    const count = (currentSectionKey === 'P') ? 1 : questions.length;
    for (let i = 1; i <= count; i++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `jump-chip ${i === activeQuestionId ? 'active-chip' : ''}`;
      chip.dataset.jumpid = i;
      chip.textContent = (currentSectionKey === 'P') ? '1교시 논술' : `${i}번`;
      chip.addEventListener('click', () => {
        selectQuestion(i);
      });
      container.appendChild(chip);
    }
  }

  // 🖐️ 태블릿 터치 스와이프 제스처 리스너
  function initTabletTouchSwipe() {
    const paperContainerEl = document.getElementById('paperContainer');
    if (!paperContainerEl) return;

    let touchStartX = 0;
    let touchStartY = 0;

    paperContainerEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    paperContainerEl.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1 && currentSectionKey !== 'P') {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        // 수평 스와이프 판정 (60px 이상, 수직 이동 대비 1.5배 이상)
        if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          const totalPages = (currentSectionKey === 'A') ? 6 : 6;
          if (deltaX < 0) {
            // 좌로 스와이프 -> 다음 페이지
            if (currentExamPageNo < totalPages) selectExamPage(currentExamPageNo + 1);
          } else {
            // 우로 스와이프 -> 이전 페이지
            if (currentExamPageNo > 1) selectExamPage(currentExamPageNo - 1);
          }
        }
      }
    }, { passive: true });
  }


  // 페이지 초기 진입 시 드롭다운 동적 생성 즉시 실행
  setupExamRoundDropdownOptions();
});



