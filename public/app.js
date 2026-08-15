document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let currentExam = null;
  let currentExamId = 'exam-1';
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

  async function setupExamRoundDropdownOptions() {
    try {
      const res = await fetch('/api/exams');
      const data = await res.json();
      if (data.success && data.exams && selectExamRound) {
        const savedVal = currentExamId || 'exam-1';
        selectExamRound.innerHTML = '';
        data.exams.forEach((ex, idx) => {
          const opt = document.createElement('option');
          opt.value = ex.id;
          opt.textContent = `📚 [제 ${idx + 1} 회차] 2027 통합 모의고사 (교육학+전공)`;
          selectExamRound.appendChild(opt);
        });
        selectExamRound.value = savedVal;
      }
    } catch (e) {
      console.error(e);
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
      btnSecA.textContent = '2교시 전공 A (90분)';
      btnSecA.classList.toggle('active-sec', currentSectionKey === 'A');
    } else {
      btnSecA.classList.add('locked-tab');
      btnSecA.textContent = '🔒 2교시 전공 A (90분)';
    }

    if (isAdmin || completedSections.A) {
      btnSecB.classList.remove('locked-tab');
      btnSecB.textContent = '3교시 전공 B (90분)';
      btnSecB.classList.toggle('active-sec', currentSectionKey === 'B');
    } else {
      btnSecB.classList.add('locked-tab');
      btnSecB.textContent = '🔒 3교시 전공 B (90분)';
    }
  }

  async function loadExamData(examId) {
    try {
      const res = await fetch(`/api/exams/${examId}`);
      const data = await res.json();
      if (data.success) {
        currentExam = data.exam;
      }
    } catch (err) {
      console.error(err);
      alert('시험지 데이터를 로드하지 못했습니다.');
    }
  }

  // 교시(P/A/B) 시작 시 최종 제출 버튼 노출 제어 (마지막 B형에서만 전체 최종 제출 버튼 노출!)
  async function startSection(secKey) {
    currentSectionKey = secKey;
    await loadDraftAnswers();
    const secData = currentExam.sections[secKey];

    updateSectionTabUI();

    if (secKey === 'P') {
      paperSectionTitle.textContent = '교육학';
      if (tableSectionName) tableSectionName.textContent = '1교시 교육학';
      if (tableQSpec) tableQSpec.textContent = '1문항 20점';
      if (tableTimeSpec) tableTimeSpec.textContent = '시험 시간 60분';
      omrTitleText.textContent = '✏️ 오른쪽 1교시 교육학 논술 작성란 (20점 만점 / 1200~1500자)';
      btnCompleteCurrentSec.textContent = '🚀 1교시 교육학 제출 및 답안 확인';
      btnCompleteCurrentSec.classList.remove('hidden');
      btnSubmitExam.classList.add('hidden'); // 1교시엔 전체 최종 제출 버튼 숨김!
    } else if (secKey === 'A') {
      paperSectionTitle.textContent = '전문상담 [전공 A]';
      if (tableSectionName) tableSectionName.textContent = '2교시 전공 A';
      if (tableQSpec) tableQSpec.textContent = '12문항 40점';
      if (tableTimeSpec) tableTimeSpec.textContent = '시험 시간 90분';
      omrTitleText.textContent = '✏️ 오른쪽 서술형 답안 작성란 (평가원 핑크 4줄 양식)';
      btnCompleteCurrentSec.textContent = '🚀 2교시 전공A 제출 및 답안 확인';
      btnCompleteCurrentSec.classList.remove('hidden');
      btnSubmitExam.classList.add('hidden'); // 2교시엔 전체 최종 제출 버튼 숨김!
    } else {
      // 3교시 전공 B형일 때만 전체 최종 제출 버튼 노출!
      paperSectionTitle.textContent = '전문상담 [전공 B]';
      if (tableSectionName) tableSectionName.textContent = '3교시 전공 B';
      if (tableQSpec) tableQSpec.textContent = '11문항 40점';
      if (tableTimeSpec) tableTimeSpec.textContent = '시험 시간 90분';
      omrTitleText.textContent = '✏️ 오른쪽 서술형 답안 작성란 (평가원 핑크 4줄 양식)';
      btnCompleteCurrentSec.classList.add('hidden');
      btnSubmitExam.classList.remove('hidden'); // 마지막 B형에서만 노출!
      btnSubmitExam.textContent = '📝 3교시 B형 완료 및 전체 최종 제출';
    }

    sectionRemainingSecs = secData.timeLimit * 60;
    startSectionTimer();

    renderExamPaper(secData.questions);
    renderOMRForm(secData.questions);
    renderTabs(secData.questions);

    if (secData.questions.length > 0) {
      selectQuestion(secData.questions[0].id);
    }
  }

  function startSectionTimer() {
    if (sectionTimerInterval) clearInterval(sectionTimerInterval);
    updateSectionTimerDisplay();

    sectionTimerInterval = setInterval(() => {
      if (!isTimerPaused && sectionRemainingSecs > 0) {
        sectionRemainingSecs--;
        updateSectionTimerDisplay();

        if (sectionRemainingSecs === 0) {
          clearInterval(sectionTimerInterval);
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
});
