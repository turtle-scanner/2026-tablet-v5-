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
    userAnswers = {}; 
    if (!isAdmin) {
      completedSections.P = false;
      completedSections.A = false;
      completedSections.B = false;
    }
    await loadExamData(currentExamId);
    await startSection('P');
  });

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

      const div = document.createElement('div');
      div.className = 'result-detail-item';
      div.innerHTML = `
        <div class="result-q-title">문항 [${q.section || '교육학'}] ${q.title} (획득: ${earnedScore}점 / 배점 ${q.score}점)</div>
        <div class="ans-box ans-user"><strong>작성한 답안:</strong><br>${userAns || '(작성 내용 없음)'}</div>
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
      qEl.innerHTML = `
        <div class="q-title">${q.title}</div>
        ${q.passage ? `<div class="q-passage">${q.passage}</div>` : ''}
      `;
      paperBody.appendChild(qEl);
    });

    // 🖍️ 지문 형광펜/펜 색칠 내역 자동 복원
    restorePassageHighlightState();
  }

  function renderOMRForm(questions) {
    omrAnswerContainer.innerHTML = '';
    questions.forEach(q => {
      const isPed = (currentSectionKey === 'P');
      const box = document.createElement('div');
      box.className = `pink-omr-box ${isPed ? 'pedagogy-box' : ''}`;
      box.id = `omr-card-${q.id}`;

      box.innerHTML = `
        <div class="pink-q-cell">
          <div class="pink-q-num">${isPed ? '교육학' : `문항 ${q.number}`}</div>
          <div class="pink-q-score">(${q.score}점)</div>
        </div>
        <div class="pink-input-cell">
          <textarea id="ans-text-${q.id}" class="pink-4line-textarea ${isPed ? 'pedagogy-textarea' : ''}" placeholder="${isPed ? '교육학 논술 서론-본론-결론 구조로 작성하세요 (1200~1500자)' : `${q.number}번 서술형 답안을 4줄에 작성하세요.`}">${userAnswers[q.id] || ''}</textarea>
          <div class="pink-char-counter" id="char-count-${q.id}">${(userAnswers[q.id] || '').length} 자</div>
        </div>
      `;

      omrAnswerContainer.appendChild(box);

      const ta = box.querySelector('textarea');
      ta.addEventListener('focus', () => selectQuestion(q.id));
      ta.addEventListener('input', (e) => {
        userAnswers[q.id] = e.target.value;
        document.getElementById(`char-count-${q.id}`).textContent = `${e.target.value.length} 자`;
        updateTotalCharCount();
        saveDraftAnswers(); // 실시간 회원별 자동 저장!
      });
    });
    updateTotalCharCount();
  }

  function renderTabs(questions) {
    questionTabs.innerHTML = '';
    questions.forEach(q => {
      const btn = document.createElement('button');
      btn.className = 'q-tab';
      btn.dataset.qid = q.id;
      btn.textContent = currentSectionKey === 'P' ? '1교시 교육학 논술' : `문항 ${q.number}번 (${q.type})`;
      btn.addEventListener('click', () => selectQuestion(q.id));
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


