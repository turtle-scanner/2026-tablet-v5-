const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'exams.json');
const SUBMISSIONS_FILE = path.join(__dirname, 'data', 'submissions.json');
const ADMIN_CONFIG_FILE = path.join(__dirname, 'data', 'admin_config.json');

// 임의의 계정 30개 (별자리 ID / 과일약자 PW)
const STUDENT_USERS = [
  { username: 'aries01', password: 'ap01', name: '양자리(Apple01)', studentNo: '2027-0101' },
  { username: 'taurus02', password: 'bn02', name: '황소자리(Banana02)', studentNo: '2027-0102' },
  { username: 'gemini03', password: 'og03', name: '쌍둥이자리(Orange03)', studentNo: '2027-0103' },
  { username: 'cancer04', password: 'gr04', name: '게자리(Grape04)', studentNo: '2027-0104' },
  { username: 'leo05', password: 'st05', name: '사자자리(Strawberry05)', studentNo: '2027-0105' },
  { username: 'virgo06', password: 'wm06', name: '처녀자리(Watermelon06)', studentNo: '2027-0106' },
  { username: 'libra07', password: 'mg07', name: '천칭자리(Mango07)', studentNo: '2027-0107' },
  { username: 'scorpio08', password: 'pk08', name: '전갈자리(Peach08)', studentNo: '2027-0108' },
  { username: 'sagittarius09', password: 'ki09', name: '사수자리(Kiwi09)', studentNo: '2027-0109' },
  { username: 'capricorn10', password: 'lm10', name: '염소자리(Lemon10)', studentNo: '2027-0110' },
  { username: 'aquarius11', password: 'melon11', name: '물병자리(Melon11)', studentNo: '2027-0111' },
  { username: 'pisces12', password: 'cherry12', name: '물고기자리(Cherry12)', studentNo: '2027-0112' },
  { username: 'orion13', password: 'plum13', name: '오리온자리(Plum13)', studentNo: '2027-0113' },
  { username: 'cassiopeia14', password: 'fig14', name: '카시오페아(Fig14)', studentNo: '2027-0114' },
  { username: 'pegasus15', password: 'berry15', name: '페가수스(Berry15)', studentNo: '2027-0115' },
  { username: 'lyra16', password: 'lime16', name: '거문고자리(Lime16)', studentNo: '2027-0116' },
  { username: 'cygnus17', password: 'pear17', name: '백조자리(Pear17)', studentNo: '2027-0117' },
  { username: 'aquila18', password: 'avocado18', name: '독수리자리(Avocado18)', studentNo: '2027-0118' },
  { username: 'andromeda19', password: 'guava19', name: '안드로메다(Guava19)', studentNo: '2027-0119' },
  { username: 'perseus20', password: 'papaya20', name: '페르세우스(Papaya20)', studentNo: '2027-0120' },
  { username: 'hercules21', password: 'coco21', name: '허큘리스(Coconut21)', studentNo: '2027-0121' },
  { username: 'draco22', password: 'ap02', name: '용자리(Apple02)', studentNo: '2027-0122' },
  { username: 'ursa23', password: 'bn03', name: '큰곰자리(Banana03)', studentNo: '2027-0123' },
  { username: 'hydra24', password: 'og04', name: '바다뱀자리(Orange04)', studentNo: '2027-0124' },
  { username: 'centaurus25', password: 'gr05', name: '센타우루스(Grape05)', studentNo: '2027-0125' },
  { username: 'phoenix26', password: 'st06', name: '피닉스(Strawberry06)', studentNo: '2027-0126' },
  { username: 'vega27', password: 'wm07', name: '직녀성(Watermelon07)', studentNo: '2027-0127' },
  { username: 'sirius28', password: 'mg08', name: '시리우스(Mango08)', studentNo: '2027-0128' },
  { username: 'polaris29', password: 'pk09', name: '북극성(Peach09)', studentNo: '2027-0129' },
  { username: 'galaxy30', password: 'ki10', name: '은하수(Kiwi10)', studentNo: '2027-0130' }
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
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
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
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` 2027 임용고시 모의고사 서버가 실행되었습니다.`);
  console.log(` 접속 주소: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
