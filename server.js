const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'exams.json');
const SUBMISSIONS_FILE = path.join(__dirname, 'data', 'submissions.json');
const ADMIN_CONFIG_FILE = path.join(__dirname, 'data', 'admin_config.json');

// 카카오톡 수험생 스터디 회원 계정 (닉네임 기반 계정)
const STUDENT_USERS = [
  { username: '1000door', password: '135300', name: '천개의문/초수/인천/독학', studentNo: '2027-0100' },
  { username: 'ryan_jaesu', password: 'pass_ryan77', name: '라이언/재수/경기', studentNo: '2027-0100b' },
  { username: 'jordi_incheon', password: 'pass_jordi01', name: '사랑에 빠진 죠르디/재수/인천', studentNo: '2027-0101' },
  { username: 'apeach_gyeongbuk', password: 'pass_apeach02', name: '엉엉 우는 어피치/재수/경북', studentNo: '2027-0102' },
  { username: 'jjordy_jeonbuk', password: 'pass_jjordy03', name: '쪼르디/초수/전북', studentNo: '2027-0103' },
  { username: 'ryan_gyeonggi', password: 'pass_ryan04', name: '축하하는 라이언/초수/경기', studentNo: '2027-0104' },
  { username: 'chunsik_gyeonggi', password: 'pass_chunsik05', name: '춘식/초수/경기', studentNo: '2027-0105' },
  { username: 'muzi_seoul', password: 'pass_muzi06', name: '쑥스러운 무지/N수/서울', studentNo: '2027-0106' },
  { username: 'con_busan', password: 'pass_con07', name: '신나는 콘/초수/부산', studentNo: '2027-0107' },
  { username: 'tube_daegu', password: 'pass_tube08', name: '기빠진 튜브/재수/대구', studentNo: '2027-0108' },
  { username: 'frodo_gyeongnam', password: 'pass_frodo09', name: '당황한 프로도/초수/경남', studentNo: '2027-0109' },
  { username: 'neo_chungnam', password: 'pass_neo10', name: '도도한 네오/N수/충남', studentNo: '2027-0110' },
  { username: 'jayg_jeonnam', password: 'pass_jayg11', name: '신난 제이지/재수/전남', studentNo: '2027-0111' },
  { username: 'studying_jordi', password: 'pass_jordi12', name: '열공하는 죠르디/초수/강원', studentNo: '2027-0112' },
  { username: 'running_chunsik', password: 'pass_chunsik13', name: '달려라 춘식/재수/대전', studentNo: '2027-0113' },
  { username: 'pass_apeach', password: 'pass_apeach14', name: '합격 기원 어피치/초수/세종', studentNo: '2027-0114' },
  { username: 'smile_ryan', password: 'pass_ryan15', name: '웃는 라이언/N수/광주', studentNo: '2027-0115' },
  { username: 'fighting_tube', password: 'pass_tube16', name: '파이팅 튜브/초수/울산', studentNo: '2027-0116' },
  { username: 'effort_muzi', password: 'pass_muzi17', name: '노력파 무지/재수/제주', studentNo: '2027-0117' },
  { username: 'pass_con', password: 'pass_con18', name: '초수합격 콘/초수/인천', studentNo: '2027-0118' },
  { username: 'dream_jordi', password: 'pass_jordi19', name: '꿈꾸는 죠르디/재수/서울', studentNo: '2027-0119' },
  { username: 'passion_chunsik', password: 'pass_chunsik20', name: '열정의 춘식/초수/경북', studentNo: '2027-0120' },
  { username: 'top_apeach', password: 'pass_apeach21', name: '수석합격 어피치/N수/경기', studentNo: '2027-0121' },
  { username: 'sincere_neo', password: 'pass_neo22', name: '성실한 네오/재수/충북', studentNo: '2027-0122' },
  { username: 'lucky_frodo', password: 'pass_frodo23', name: '행운의 프로도/초수/전북', studentNo: '2027-0123' },
  { username: 'flame_jayg', password: 'pass_jayg24', name: '불꽃 제이지/재수/경남', studentNo: '2027-0124' },
  { username: 'hope_jordi', password: 'pass_jordi25', name: '희망찬 죠르디/초수/부산', studentNo: '2027-0125' },
  { username: 'positive_chunsik', password: 'pass_chunsik26', name: '긍정 춘식/N수/대구', studentNo: '2027-0126' },
  { username: 'shining_ryan', password: 'pass_ryan27', name: '빛나는 라이언/재수/경북', studentNo: '2027-0127' },
  { username: 'passion_muzi', password: 'pass_muzi28', name: '열정 무지/초수/강원', studentNo: '2027-0128' },
  { username: 'victory_apeach', password: 'pass_apeach29', name: '필승 어피치/재수/경기', studentNo: '2027-0129' },
  { username: 'final_chunsik', password: 'pass_chunsik30', name: '최종합격 춘식/초수/서울', studentNo: '2027-0130' }
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
