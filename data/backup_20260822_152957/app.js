document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let currentExam = null;
  let currentExamId = 'exam-26';
  let currentSectionKey = 'P'; // P: 1교시 교육학, A: 2교시 전공A, B: 3교시 전공B
  let activeQuestionId = 1;
  let userAnswers = {};

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
  let sectionRemainingSecs = 60 * 60;

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
        inputStudentNo.value = currentUser.studentNo;
        displayStudentInfo.textContent = `${currentUser.isAdmin ? '👑 관리자' : '수험생'}: ${currentUser.name} (${currentUser.studentNo})`;

        if (currentUser.isAdmin) {
          btnAdminDashboardNav.classList.remove('hidden');
          completedSections.P = true;
          completedSections.A = true;
          completedSections.B = true;
        } else {
          btnAdminDashboardNav.classList.add('hidden');
          completedSections.P = false;
          completedSections.A = false;
          completedSections.B = false;
        }

        await setupExamRoundDropdownOptions();

        loginView.classList.add('hidden');
        examView.classList.remove('hidden');

        await loadExamData(currentExamId);
        await startSection('P');
      } else {
        alert(data.message || '로그인 실패: 아이디 또는 비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버 오류가 발생했습니다.');
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
    const savedVal = currentExamId || 'exam-26';

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
        opt.textContent = ex.title || `📚 [제 ${ex.id.replace('exam-', '')} 회차] 2027 통합 모의고사`;
        selectExamRound.appendChild(opt);
      });
    } else {
      for (let i = 1; i <= 26; i++) {
        const exId = `exam-${i}`;
        const opt = document.createElement('option');
        opt.value = exId;
        opt.textContent = `📚 [제 ${i} 회차] 2027 통합 모의고사`;
        selectExamRound.appendChild(opt);
      }
    }

    if (selectExamRound.querySelector(`option[value="${savedVal}"]`)) {
      selectExamRound.value = savedVal;
    } else if (selectExamRound.options.length > 0) {
      selectExamRound.value = selectExamRound.options[selectExamRound.options.length - 1].value;
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

    if (currentUser && currentUser.isAdmin) {
      startSection(targetKey);
      return;
    }

    if (targetKey === 'A' && !completedSections.P) {
      alert('⚠️ 1교시 [교육학 논술] 답안을 제출하거나 시험 시간이 경과되어야 2교시 전공 A형으로 이동할 수 있습니다.');
      return;
    }

    if (targetKey === 'B' && !completedSections.A) {
      alert('⚠️ 2교시 [전공 A형] 답안을 제출하거나 시험 시간이 경과되어야 3교시 전공 B형으로 이동할 수 있습니다.');
      return;
    }

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
      if (confirm('2교시 [전공 A형] 답안을 완료 제출하고 3교시 [전공 B형(90분)]으로 이동하시겠습니까?')) {
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
    const isAdmin = currentUser && currentUser.isAdmin;

    btnSecP.classList.toggle('active-sec', currentSectionKey === 'P');
    
    if (isAdmin || completedSections.P) {
      btnSecA.classList.remove('locked-tab');
      btnSecA.textContent = '2교시 전공 A (35분)';
      btnSecA.classList.toggle('active-sec', currentSectionKey === 'A');
    } else {
      btnSecA.classList.add('locked-tab');
      btnSecA.textContent = '🔒 2교시 전공 A (35분)';
    }

    if (isAdmin || completedSections.A) {
      btnSecB.classList.remove('locked-tab');
      btnSecB.textContent = '3교시 전공 B (35분)';
      btnSecB.classList.toggle('active-sec', currentSectionKey === 'B');
    } else {
      btnSecB.classList.add('locked-tab');
      btnSecB.textContent = '🔒 3교시 전공 B (35분)';
    }
  }

  async function loadExamData(examId) {
    try {
      const res = await fetch(`/api/exams/${examId}?t=${Date.now()}`);
      const data = await res.json();
      if (data.success && data.exam) {
        currentExam = data.exam;
        if (currentExam && currentExam.sections && currentExam.sections.P) {
          currentExam.sections.P.timeLimit = 37;
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
      currentExam.sections.P.timeLimit = 37;
    }
  }

  // 교시(P/A/B) 시작 시 최종 제출 버튼 노출 제어 (마지막 B형에서만 전체 최종 제출 버튼 노출!)
  async function startSection(secKey) {
    currentSectionKey = secKey;
    await loadDraftAnswers();
    const secData = currentExam.sections[secKey];

    if (secKey === 'P') {
      secData.timeLimit = 37;
    }

    updateSectionTabUI();

    if (secKey === 'P') {
      paperSectionTitle.textContent = '교육학';
      if (tableSectionName) tableSectionName.textContent = '1교시 교육학';
      if (tableQSpec) tableQSpec.textContent = '1문항 20점';
      if (tableTimeSpec) tableTimeSpec.textContent = `시험 시간 37분`;
      omrTitleText.textContent = '✏️ 오른쪽 1교시 교육학 논술 작성란 (20점 만점 / 1200~1500자)';
      btnCompleteCurrentSec.textContent = '🚀 1교시 교육학 제출 및 답안 확인';
      btnCompleteCurrentSec.classList.remove('hidden');
      btnSubmitExam.classList.add('hidden'); // 1교시엔 전체 최종 제출 버튼 숨김!
    } else if (secKey === 'A') {
      paperSectionTitle.textContent = '전문상담 [전공 A]';
      if (tableSectionName) tableSectionName.textContent = '2교시 전공 A';
      if (tableQSpec) tableQSpec.textContent = '12문항 40점';
      if (tableTimeSpec) tableTimeSpec.textContent = `시험 시간 ${secData.timeLimit || 35}분`;
      omrTitleText.textContent = '✏️ 오른쪽 서술형 답안 작성란 (평가원 핑크 4줄 양식)';
      btnCompleteCurrentSec.textContent = '🚀 2교시 전공A 제출 및 답안 확인';
      btnCompleteCurrentSec.classList.remove('hidden');
      btnSubmitExam.classList.add('hidden'); // 2교시엔 전체 최종 제출 버튼 숨김!
    } else {
      // 3교시 전공 B형일 때만 전체 최종 제출 버튼 노출!
      paperSectionTitle.textContent = '전문상담 [전공 B]';
      if (tableSectionName) tableSectionName.textContent = '3교시 전공 B';
      if (tableQSpec) tableQSpec.textContent = '11문항 40점';
      if (tableTimeSpec) tableTimeSpec.textContent = `시험 시간 ${secData.timeLimit || 35}분`;
      omrTitleText.textContent = '✏️ 오른쪽 서술형 답안 작성란 (평가원 핑크 4줄 양식)';
      btnCompleteCurrentSec.classList.add('hidden');
      btnSubmitExam.classList.remove('hidden'); // 마지막 B형에서만 노출!
      btnSubmitExam.textContent = '📝 3교시 B형 완료 및 전체 최종 제출';
    }

    sectionRemainingSecs = (secKey === 'P' ? 37 : (secData.timeLimit || 35)) * 60;
    startSectionTimer();

    renderExamPaper(secData.questions);
    renderOMRForm(secData.questions);
    renderTabs(secData.questions);

    if (secData.questions.length > 0) {
      selectQuestion(secData.questions[0].id);
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
      showSupervisorNotice('🔔 1교시 교육학 논술 시험이 시작되었습니다. 제한시간 37분 동안 신중히 답안을 작성하십시오.');
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

  function selectQuestion(qId) {
    activeQuestionId = qId;
    startQuestionTimer();

    document.querySelectorAll('.q-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.qid == qId);
    });

    document.querySelectorAll('.pink-omr-box').forEach(c => {
      c.classList.toggle('active-omr', c.id === `omr-card-${qId}`);
    });

    const paperQ = document.getElementById(`paper-q-${qId}`);
    const omrQ = document.getElementById(`omr-card-${qId}`);
    if (paperQ) paperQ.scrollIntoView({ behavior: 'smooth' });
    if (omrQ) omrQ.scrollIntoView({ behavior: 'smooth' });
  }

  function renderExamPaper(questions) {
    paperBody.innerHTML = '';
    questions.forEach(q => {
      const qEl = document.createElement('div');
      qEl.className = 'q-block';
      qEl.id = `paper-q-${q.id}`;

      let titleText = q.title || '';
      const qScore = q.points || q.score || (qIdx < 4 ? 2 : 4);
      // 개념명(집단상담, 성격심리학 등)을 완전히 제거하고 오직 [문항 A-N] (N점) 형식만 표출!
      if (titleText.includes('[문항 A-')) {
        titleText = titleText.replace(/(\[문항 A-\d+\]).*/, '$1') + ` (${qScore}점)`;
      } else if (titleText.includes('[문항 B-')) {
        titleText = titleText.replace(/(\[문항 B-\d+\]).*/, '$1') + ` (${qScore}점)`;
      }

      let rubricText = q.rubric || '';
      // [정답 예시] 스포일러 방지를 위해 문제지 표출 시 정답 텍스트 완전 필터링
      if (rubricText.includes('[정답 예시]')) {
        rubricText = rubricText.split('[정답 예시]')[0].trim();
      }
      if (rubricText.includes('[정답]')) {
        rubricText = rubricText.split('[정답]')[0].trim();
      }
      if (rubricText.includes('[모범 답안]')) {
        rubricText = rubricText.split('[모범 답안]')[0].trim();
      }

      let rubricHtml = '';
      if (rubricText) {
        rubricHtml = `<div class="q-rubric">${rubricText}</div>`;
      }

      let formattedPassage = q.passage || '';
      if (formattedPassage) {
        // 대화 축어록 지문에서 대화 사람이 새로 시작할 때는 반드시 다음줄(\n)에 시작하도록 처리
        const speakerNames = "상담교사|담임교사|경력 교사|신임 교사|김 교사|지혜|민우|승호|유진|수진|민지|현수|민호|재민|성민|성준|아버지|준서|집단원 A|집단원 B|내담자|수검자|보호자|내담자 민우|내담자 현수|내담자 민호|내담자 서연이|내담 아동";
        const dialogueRegex = new RegExp(`([\\"\\.\\?!\\)\\s])\\s*(${speakerNames})\\s*:`, 'g');
        formattedPassage = formattedPassage.replace(dialogueRegex, '$1\n$2:');
        formattedPassage = formattedPassage.replace(/\n{3,}/g, '\n\n').trim();
      }

      qEl.innerHTML = `
        <div class="q-title">${titleText}</div>
        ${formattedPassage ? `<div class="q-passage">${formattedPassage}</div>` : ''}
        ${rubricHtml}
      `;
      paperBody.appendChild(qEl);
    });

    // 🖍️ 지문 형광펜/펜 색칠 내역 자동 복원
    restorePassageHighlightState();
  }

  // =========================================================
  // ⭕/❌ O/X 채점 도장 표식 & ✒️ 한글 프로그램 방식 개별 글자 펜 색상(검정/빨강/파랑) 서식 엔진
  // =========================================================
  let omrMarksMap = {};
  let qPenColorMap = {}; // 문항별 기본 펜 색상 저장
  let userAnswersHtmlMap = {}; // 개별 글자 색상이 포함된 서식 HTML 영구 저장 { '1': '...', '2': '...' }
  let activePenColor = 'black'; // 기본 펜 색상

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

      const miniToolbar = document.getElementById(`mini-pen-toolbar-${qNum}`);
      if (miniToolbar) {
        miniToolbar.querySelectorAll('.btn-pen-color').forEach(btn => {
          btn.classList.toggle('active-pen', btn.dataset.color === colorName);
        });
      }
    }
  }

  if (btnPenBlack) btnPenBlack.addEventListener('click', () => applyRichTextColor('black'));
  if (btnPenRed) btnPenRed.addEventListener('click', () => applyRichTextColor('red'));
  if (btnPenBlue) btnPenBlue.addEventListener('click', () => applyRichTextColor('blue'));

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
    if (!current) omrMarksMap[qNum] = 'O';
    else if (current === 'O') omrMarksMap[qNum] = 'X';
    else if (current === 'X') omrMarksMap[qNum] = 'TRIANGLE';
    else omrMarksMap[qNum] = null;

    updateOMRMarkDisplay(qNum, qCell);
    saveDraftAnswers(); // 🔴 O, 🔵 X, 🟡 △ 채점 도장 실시간 자동 영구 저장!
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
      </div>
    `;
    omrAnswerContainer.appendChild(omrTopHeader);

    questions.forEach((q, idx) => {
      const qNumRaw = q.id || q.number || q.no || (idx + 1);
      // 숫자 번호 추출 (A-1 -> 1, B-5 -> 5 등)
      const numMatch = String(qNumRaw).match(/\d+/);
      const qNumInt = numMatch ? parseInt(numMatch[0], 10) : (idx + 1);
      const qNum = qNumRaw;
      const ansKey = getAnswerKey(qNum);
      const qScore = q.points || q.score || (isPed ? 20 : (isSecA ? (qNumInt <= 4 ? 2 : 4) : (qNumInt <= 2 ? 2 : 4)));
      const qColor = qPenColorMap[ansKey] || qPenColorMap[qNum] || 'black';

      // 1줄 vs 4줄 판정
      // A형: 1~4번은 1줄, 5~12번은 4줄
      // B형: 1~2번은 1줄, 3~11번은 4줄
      let isOneLine = false;
      if (isSecA && qNumInt <= 4) isOneLine = true;
      if (isSecB && qNumInt <= 2) isOneLine = true;

      // 색상 테마 클래스 판정:
      // A형: 1~7번 red-theme (약간 빨간색), 8~12번 gray-theme (회색/슬레이트)
      // B형: 1~6번 red-theme (약간 빨간색), 7~11번 cyan-theme (청록/틸)
      // 교육학: ped-theme (블루)
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
      box.id = `omr-card-${qNum}`;

      const savedHtml = userAnswersHtmlMap[ansKey] || userAnswers[ansKey] || '';
      const savedText = userAnswers[ansKey] || '';

      box.innerHTML = `
        <div class="pink-q-cell pink-q-label" id="q-label-cell-${qNum}" data-anskey="${ansKey}" title="클릭하여 O/X 도장을 찍으세요">
          <div class="pink-q-num">${isPed ? '교육학' : `문항 ${qNumInt}`}</div>
          <div class="pink-q-score">(${qScore}점)</div>
        </div>
        <div class="pink-input-cell">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <div id="mini-pen-toolbar-${qNum}" class="pen-color-toolbar" style="margin-left:0; padding:2px 6px; scale:0.9;">
              <span class="pen-color-label" style="font-size:10px;">✒️ 펜색상:</span>
              <button type="button" class="btn-pen-color btn-pen-black ${qColor==='black'?'active-pen':''}" data-color="black" title="검정색"></button>
              <button type="button" class="btn-pen-color btn-pen-red ${qColor==='red'?'active-pen':''}" data-color="red" title="빨간색"></button>
              <button type="button" class="btn-pen-color btn-pen-blue ${qColor==='blue'?'active-pen':''}" data-color="blue" title="파란색"></button>
            </div>
            <div class="pink-char-counter" id="char-count-${qNum}" style="margin:0;">${savedText.length} 자${isPed ? '' : (isOneLine ? ' (단답 1줄)' : ' (최대 4줄)')}</div>
          </div>
          <div id="ans-text-${qNum}" contenteditable="true" class="pink-rich-textarea ${isPed ? 'pedagogy-textarea' : ''} ${isOneLine ? 'oneline-textarea' : 'fourline-textarea'} ${colorThemeClass}-textarea" data-placeholder="${isPed ? '교육학 논술 서론-본론-결론 구조로 작성하세요 (1200~1500자)' : (isOneLine ? `문항 ${qNumInt}번 단답형 답안을 1줄에 작성하세요.` : `문항 ${qNumInt}번 서술형 답안을 4줄에 작성하세요.`)}">${savedHtml}</div>
        </div>
      `;

      omrAnswerContainer.appendChild(box);

      // 개별 미니 툴바 버튼 이벤트
      const miniTb = box.querySelector(`#mini-pen-toolbar-${qNum}`);
      if (miniTb) {
        miniTb.querySelectorAll('.btn-pen-color').forEach(b => {
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = b.dataset.color;
            activeQuestionId = qNum;
            applyRichTextColor(color, qNum);
          });
        });
      }

      const qCell = box.querySelector(`#q-label-cell-${qNum}`);
      if (qCell) {
        updateOMRMarkDisplay(ansKey, qCell);
        qCell.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleOMRMark(ansKey, qCell);
        });
      }

      const ed = box.querySelector(`#ans-text-${qNum}`);
      if (ed) {
        ed.addEventListener('focus', () => {
          selectQuestion(qNum);
          const curColor = qPenColorMap[ansKey] || qPenColorMap[qNum] || 'black';
          if (btnPenBlack) btnPenBlack.classList.toggle('active-pen', curColor === 'black');
          if (btnPenRed) btnPenRed.classList.toggle('active-pen', curColor === 'red');
          if (btnPenBlue) btnPenBlue.classList.toggle('active-pen', curColor === 'blue');
        });

        ed.addEventListener('input', () => {
          const textVal = ed.innerText.trim();
          userAnswers[ansKey] = textVal;
          userAnswers[qNum] = textVal; // 하위 호환
          userAnswersHtmlMap[ansKey] = ed.innerHTML;
          userAnswersHtmlMap[qNum] = ed.innerHTML;
          document.getElementById(`char-count-${qNum}`).textContent = `${textVal.length} 자${isPed ? '' : ' (최대 4줄)'}`;
          updateTotalCharCount();
          saveDraftAnswers(); // 실시간 회원별 영구 저장!
        });
      }
    });
    updateTotalCharCount();
  }

  function renderTabs(questions) {
    questionTabs.innerHTML = '';
    questions.forEach((q, idx) => {
      const qNum = q.id || q.number || q.no || (idx + 1);
      const qScore = q.points || q.score || (currentSectionKey === 'P' ? 20 : (idx < 4 ? 2 : 4));
      const qType = q.type || (currentSectionKey === 'P' ? '논술형' : (idx < 4 ? '단답형' : '서술형'));

      const btn = document.createElement('button');
      btn.className = 'q-tab';
      btn.dataset.qid = qNum;
      btn.textContent = currentSectionKey === 'P' ? '1교시 교육학 논술 (20점)' : `문항 ${qNum}번 [${qScore}점] (${qType})`;
      btn.addEventListener('click', () => selectQuestion(qNum));
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
    scoreVal.textContent = result.totalScore;
    maxScoreVal.textContent = result.maxScore;
    resultName.textContent = `${result.studentName} (${result.studentNo})`;
    resultTime.textContent = new Date().toLocaleTimeString();
    resultModalTitle.textContent = '🎉 2027 임용고시 전체 종합 (교육학 20점 + 전공 80점) 성적 리포트';

    resultDetailsList.innerHTML = '';
    result.details.forEach(item => {
      const div = document.createElement('div');
      div.className = 'result-detail-item';
      div.innerHTML = `
        <div class="result-q-title">문항 [${item.section || '교육학'}] ${item.title} (획득: ${item.earnedScore}점 / 배점 ${item.score}점)</div>
        <div class="ans-box ans-user"><strong>작성한 답안:</strong><br>${item.userAnswer || '(작성 내용 없음)'}</div>
        <div class="ans-box ans-model"><strong>모범 답안:</strong><br>${item.modelAnswer}</div>
      `;
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

  // ↔️ 문제지 - 답안지 반응형 5:5 비율 조절 및 리사이저 드래그 엔합
  const paneLeft = document.getElementById('paneLeft');
  const paneRight = document.getElementById('paneRight');
  const resizer = document.getElementById('resizer');
  const splitMain = document.querySelector('.split-main');

  if (resizer && paneLeft && paneRight && splitMain) {
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
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

    // 윈도우 창 크기 변경 시 비율 유지
    window.addEventListener('resize', () => {
      if (window.innerWidth < 768) {
        paneLeft.style.flex = '1 1 100%';
        paneRight.style.flex = '1 1 100%';
      } else {
        if (!paneLeft.style.flex || paneLeft.style.flex.includes('100%')) {
          paneLeft.style.flex = '1 1 50%';
          paneRight.style.flex = '1 1 50%';
        }
      }
    });
  }

  // 페이지 초기 진입 시 드롭다운 동적 생성 즉시 실행
  setupExamRoundDropdownOptions();
});


