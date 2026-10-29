const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'exams.json');
const DEFAULT_DATA_FILE = path.join(__dirname, 'data', 'default_exams.json');
const SUBMISSIONS_FILE = path.join(__dirname, 'data', 'submissions.json');
const DRAFTS_FILE = path.join(__dirname, 'data', 'drafts.json');
const ADMIN_CONFIG_FILE = path.join(__dirname, 'data', 'admin_config.json');

// 카카오톡 수험생 스터디 회원 정식 계정 (7인 + 관리자)
const STUDENT_USERS = [
  // 관리자
  { username: 'cntfed', password: 'cntfed', name: '관리자(변귀섭)', studentNo: 'ADMIN-2027', role: 'admin' },
  { username: '1000door', password: 'cntfed', name: '천개의문(관리자)', studentNo: 'ADMIN-2027-2', role: 'admin' },

  // 회원 1: 엉엉 우는 어피치
  { username: '어피치', password: '381924', name: '엉엉 우는 어피치', studentNo: '2027-0101', role: 'vip' },
  { username: '엉엉우는어피치', password: '381924', name: '엉엉 우는 어피치', studentNo: '2027-0101', role: 'vip' },

  // 회원 2: 죠르디
  { username: '죠르디', password: '592814', name: '죠르디', studentNo: '2027-0102', role: 'vip' },

  // 회원 3: 춘식
  { username: '춘식', password: '419827', name: '춘식', studentNo: '2027-0103', role: 'vip' },

  // 회원 4: 교대원 2학차
  { username: '교대원2학차', password: '628193', name: '교대원 2학차', studentNo: '2027-0104', role: 'vip' },
  { username: '교대원', password: '628193', name: '교대원 2학차', studentNo: '2027-0104', role: 'vip' },

  // 회원 5: 라이언
  { username: '라이언', password: '731948', name: '라이언', studentNo: '2027-0105', role: 'vip' },

  // 회원 6: 화이팅 춘식이
  { username: '화이팅춘식이', password: '284719', name: '화이팅 춘식이', studentNo: '2027-0106', role: 'vip' },

  // 회원 7: rann
  { username: 'rann', password: '918273', name: 'rann♡', studentNo: '2027-0107', role: 'vip' },
  { username: 'rann♡', password: '918273', name: 'rann♡', studentNo: '2027-0107', role: 'vip' },
  { username: 'open', password: '000011', name: '열린생각/초수/청주', studentNo: '2027-0108', role: 'vip' },
  { username: '열린생각', password: '000011', name: '열린생각/초수/청주', studentNo: '2027-0108', role: 'vip' }
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const getAdminConfig = () => {
  if (!fs.existsSync(ADMIN_CONFIG_FILE)) {
    return { username: 'cntfed', password: 'cntfed', adminName: '관리자(출제자)', studentNo: 'ADMIN-2027' };
  }
  try {
    return JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf-8'));
  } catch (e) {
    return { username: 'cntfed', password: 'cntfed', adminName: '관리자(출제자)', studentNo: 'ADMIN-2027' };
  }
};

const saveAdminConfig = (config) => {
  fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
};

const getExamsData = () => {
  let defaultExams = [];
  if (fs.existsSync(DEFAULT_DATA_FILE)) {
    try {
      defaultExams = JSON.parse(fs.readFileSync(DEFAULT_DATA_FILE, 'utf-8'));
    } catch (e) {}
  }

  let finalExams = defaultExams;
  if (finalExams.length === 0 && fs.existsSync(DATA_FILE)) {
    try {
      finalExams = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {}
  } else if (finalExams.length > 0) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultExams, null, 2), 'utf-8');
    } catch (e) {}
  }

  finalExams.forEach(ex => {
    const p_sec = ex.p_section || (ex.sections ? ex.sections.P : null);
    const a_sec = ex.a_section || (ex.sections ? ex.sections.A : null);
    const b_sec = ex.b_section || (ex.sections ? ex.sections.B : null);
    if (p_sec) p_sec.timeLimit = 37;
    ex.sections = {
      P: p_sec || { title: "1교시 교육학", timeLimit: 37, questions: [] },
      A: a_sec || { title: "2교시 전공 A", timeLimit: 35, questions: [] },
      B: b_sec || { title: "3교시 전공 B", timeLimit: 35, questions: [] }
    };
  });

  return finalExams;
};

const getSubmissionsData = () => {
  if (!fs.existsSync(SUBMISSIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
};

const saveSubmissionsData = (data) => {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

const getDraftsData = () => {
  if (!fs.existsSync(DRAFTS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf-8'));
  } catch (e) {
    return {};
  }
};

const saveDraftsData = (data) => {
  try {
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(e);
  }
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. API: /api/login (POST)
  if (pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body || '{}');
        const adminConfig = getAdminConfig();
        
        // 보안된 관리자 계정 검증 (아이디 cntfed + 암호 cntfed)
        if (username === adminConfig.username && password === adminConfig.password) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            success: true,
            isAdmin: true,
            user: { username: adminConfig.username, name: adminConfig.adminName, studentNo: adminConfig.studentNo },
            message: '관리자 계정으로 안심 로그인하였습니다.'
          }));
        }

        // 별자리 수험생 계정 30개 검증
        const foundStudent = STUDENT_USERS.find(u => u.username === username && u.password === password);
        if (foundStudent) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            success: true,
            isAdmin: false,
            user: foundStudent,
            message: `${foundStudent.name}님 환영합니다.`
          }));
        }

        // 비밀번호 불일치 및 실패 처리
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: false,
          message: '아이디 또는 패스워드가 일치하지 않습니다. 올바른 수험생 암호를 입력해 주세요.'
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: '잘못된 요청 형식입니다.' }));
      }
    });
    return;
  }

  // 2. API: /api/admin/change-password (POST) - 나만의 암호 변경 API
  if (pathname === '/api/admin/change-password' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { currentPassword, newPassword } = JSON.parse(body || '{}');
        const adminConfig = getAdminConfig();

        if (currentPassword !== adminConfig.password) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: '현재 관리자 비밀번호가 일치하지 않습니다.' }));
        }

        if (!newPassword || newPassword.trim().length < 4) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: '새 비밀번호는 최소 4자 이상 입력해 주세요.' }));
        }

        adminConfig.password = newPassword.trim();
        saveAdminConfig(adminConfig);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, message: '관리자 전용 비밀번호가 안전하게 변경되었습니다.' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: '비밀번호 변경 처리 중 오류가 발생했습니다.' }));
      }
    });
    return;
  }

  // 2-1. API: /api/sync-exams (POST) - 원격 온라인 서버 실시간 17개 시험지 강제 덮어쓰기 동기화
  if (pathname === '/api/sync-exams' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { exams } = JSON.parse(body || '{}');
        if (Array.isArray(exams) && exams.length > 0) {
          fs.writeFileSync(DATA_FILE, JSON.stringify(exams, null, 2), 'utf-8');
          fs.writeFileSync(DEFAULT_DATA_FILE, JSON.stringify(exams, null, 2), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, count: exams.length, message: `성공적으로 ${exams.length}개 회차 모의고사가 온라인 서버에 실시간 반영되었습니다.` }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: '올바른 exams 배열 데이터가 필요합니다.' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, message: '동기화 중 오류가 발생했습니다.' }));
      }
    });
    return;
  }

  // 3. API: /api/users (GET) - 보안을 위해 비밀번호는 제거하여 응답!
  if (pathname === '/api/users' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    const safeUsers = STUDENT_USERS.map(u => ({ username: u.username, name: u.name, studentNo: u.studentNo }));
    return res.end(JSON.stringify({ success: true, users: safeUsers }));
  }

  // 4. API: /api/exams (GET)
  if (pathname === '/api/exams' && req.method === 'GET') {
    const exams = getExamsData();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: true, exams }));
  }

  // 4-1. API: /api/draft (POST) - 회원별/회차별 임시 작성 답안 및 O/X/△ 채점 도장 저장
  if ((pathname === '/api/draft' || pathname === '/api/drafts') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, studentNo, examId, userAnswers, userAnswersHtmlMap, omrMarksMap, qPenColorMap } = JSON.parse(body || '{}');
        const uKey = username || studentNo;
        if (!uKey || !examId) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: 'username/studentNo와 examId가 필요합니다.' }));
        }
        const drafts = getDraftsData();
        const key = `${uKey}_${examId}`;
        drafts[key] = {
          username: uKey,
          examId,
          userAnswers: userAnswers || {},
          userAnswersHtmlMap: userAnswersHtmlMap || {},
          omrMarksMap: omrMarksMap || {},
          qPenColorMap: qPenColorMap || {},
          updatedAt: new Date().toLocaleString('ko-KR')
        };
        saveDraftsData(drafts);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, message: '임시 답안 및 O/X/△ 채점 도장이 성공적으로 저장되었습니다.' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, message: '임시 저장 중 오류가 발생했습니다.' }));
      }
    });
    return;
  }

  // 4-2. API: /api/draft (GET) - 회원별/회차별 임시 작성 답안 및 O/X/△ 채점 도장 불러오기
  if ((pathname === '/api/draft' || pathname === '/api/drafts' || pathname.startsWith('/api/drafts/')) && req.method === 'GET') {
    let username = parsedUrl.query.username || parsedUrl.query.studentNo;
    let examId = parsedUrl.query.examId;

    if (pathname.startsWith('/api/drafts/')) {
      const parts = pathname.replace('/api/drafts/', '').split('/');
      if (parts.length >= 2) {
        username = parts[0];
        examId = parts[1];
      }
    }

    if (!username || !examId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: false, message: 'username과 examId가 필요합니다.' }));
    }
    const drafts = getDraftsData();
    const key = `${username}_${examId}`;
    const draft = drafts[key] || null;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: true, draft }));
  }

  // 5. API: /api/exams/:id (GET)
  if (pathname.startsWith('/api/exams/') && req.method === 'GET') {
    const examId = pathname.replace('/api/exams/', '');
    const exams = getExamsData();
    const exam = exams.find(e => e.id === examId) || exams[0];
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: true, exam }));
  }

  // 6. API: /api/submit (POST)
  if (pathname === '/api/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { examId, userAnswers, user } = JSON.parse(body || '{}');
        const exams = getExamsData();
        const exam = exams.find(e => e.id === examId) || exams[0];

        let totalScore = 0;
        let maxScore = 0;

        const allQuestions = [
          ...(exam.sections.P ? exam.sections.P.questions : []),
          ...exam.sections.A.questions,
          ...exam.sections.B.questions
        ];

        const details = allQuestions.map(q => {
          maxScore += q.score;
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

          totalScore += earnedScore;

          return {
            questionId: q.id,
            number: q.number,
            section: q.section || (q.score === 20 ? '교육학' : '전공'),
            title: q.title,
            score: q.score,
            earnedScore,
            userAnswer: userAns,
            modelAnswer: q.answer,
            matchedKeywords,
            feedback: ''
          };
        });

        const submissionId = 'sub_' + Date.now();
        const newSubmission = {
          id: submissionId,
          examId: exam.id,
          examTitle: exam.title,
          username: user ? user.username : 'guest',
          studentName: user ? user.name : '수험생',
          studentNo: user ? user.studentNo : '2027-0000',
          submittedAt: new Date().toLocaleString('ko-KR'),
          totalScore,
          maxScore,
          status: '자동채점완료',
          details
        };

        const submissions = getSubmissionsData();
        submissions.unshift(newSubmission);
        saveSubmissionsData(submissions);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: true,
          submissionId,
          result: {
            examTitle: exam.title,
            studentName: newSubmission.studentName,
            studentNo: newSubmission.studentNo,
            totalScore,
            maxScore,
            details
          }
        }));
      } catch (e) {
        console.error(e);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: '채점 처리 중 오류가 발생했습니다.' }));
      }
    });
    return;
  }

  // 7. API: /api/admin/submissions (GET)
  if (pathname === '/api/admin/submissions' && req.method === 'GET') {
    const submissions = getSubmissionsData();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: true, submissions }));
  }

  // 8. API: /api/admin/grade (POST)
  if (pathname === '/api/admin/grade' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { submissionId, updatedDetails, totalScore } = JSON.parse(body || '{}');
        const submissions = getSubmissionsData();
        const sub = submissions.find(s => s.id === submissionId);

        if (!sub) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: '해당 제출 내역을 찾을 수 없습니다.' }));
        }

        sub.details = updatedDetails;
        sub.totalScore = totalScore;
        sub.status = '관리자수동채점완료';
        sub.gradedAt = new Date().toLocaleString('ko-KR');

        saveSubmissionsData(submissions);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, message: '수동 채점 및 첨삭이 저장되었습니다.', submission: sub }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: '수동 채점 저장 중 오류가 발생했습니다.' }));
      }
    });
    return;
  }

  // 9. API: /api/admin/export-csv (GET) - 전체 수험생 답안 엑셀 다운로드 (UTF-8 BOM CSV)
  if (pathname === '/api/admin/export-csv' && req.method === 'GET') {
    const submissions = getSubmissionsData();
    const drafts = getDraftsData();
    const exams = getExamsData();

    // Excel 한글 깨짐 방지 UTF-8 BOM Header (\uFEFF)
    let csvContent = '\uFEFF';
    csvContent += '수험생성명,수험번호,회원아이디,모의고사회차,과목명(교시),문제번호,문제제목,작성한답안,획득점수,배점,제출/저장시각,상태\n';

    // 1) 제출 완료된 수험생 답안 목록
    submissions.forEach(sub => {
      const exam = exams.find(e => e.id === sub.examId);
      const roundTitle = exam ? exam.title : sub.examId;

      if (sub.details && sub.details.length > 0) {
        sub.details.forEach(det => {
          const studentName = `"${(sub.studentName || '').replace(/"/g, '""')}"`;
          const studentNo = `"${(sub.studentNo || '').replace(/"/g, '""')}"`;
          const username = `"${(sub.username || '').replace(/"/g, '""')}"`;
          const round = `"${(roundTitle || '').replace(/"/g, '""')}"`;
          const section = `"${(det.section || '전공').replace(/"/g, '""')}"`;
          const qNum = `"${(det.number || det.questionId || '').toString().replace(/"/g, '""')}"`;
          const qTitle = `"${(det.title || '').replace(/"/g, '""')}"`;
          const userAns = `"${(det.userAnswer || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
          const earned = det.earnedScore || 0;
          const score = det.score || 0;
          const time = `"${(sub.submittedAt || '').replace(/"/g, '""')}"`;
          const status = `"${(sub.status || '제출완료').replace(/"/g, '""')}"`;

          csvContent += `${studentName},${studentNo},${username},${round},${section},${qNum},${qTitle},${userAns},${earned},${score},${time},${status}\n`;
        });
      }
    });

    // 2) 작성 중인 수험생 임시저장 답안 목록
    Object.keys(drafts).forEach(key => {
      const draft = drafts[key];
      const exam = exams.find(e => e.id === draft.examId);
      const roundTitle = exam ? exam.title : draft.examId;
      const userAnswers = draft.userAnswers || {};

      if (exam && exam.sections) {
        const allQ = [
          ...(exam.sections.P ? exam.sections.P.questions : []),
          ...(exam.sections.A ? exam.sections.A.questions : []),
          ...(exam.sections.B ? exam.sections.B.questions : [])
        ];

        allQ.forEach(q => {
          const ans = userAnswers[q.id];
          if (ans && ans.trim()) {
            const studentName = `"${(draft.username || '').replace(/"/g, '""')}"`;
            const studentNo = `"임시저장"`;
            const username = `"${(draft.username || '').replace(/"/g, '""')}"`;
            const round = `"${(roundTitle || '').replace(/"/g, '""')}"`;
            const section = `"${(q.section || '전공').replace(/"/g, '""')}"`;
            const qNum = `"${q.number}"`;
            const qTitle = `"${(q.title || '').replace(/"/g, '""')}"`;
            const userAns = `"${ans.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
            const time = `"${(draft.updatedAt || '').replace(/"/g, '""')}"`;
            const status = `"작성중(임시저장)"`;

            csvContent += `${studentName},${studentNo},${username},${round},${section},${qNum},${qTitle},${userAns},0,${q.score},${time},${status}\n`;
          }
        });
      }
    });

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="2027_Mock_Exam_All_Student_Answers.csv"'
    });
    return res.end(csvContent);
  }

  // 정적 파일 호스팅
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` 2027 임용고시 모의고사 서버가 실행되었습니다.`);
  console.log(` 접속 주소: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
