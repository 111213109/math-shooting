/**
 * storage.js - 學生學習歷程與教師數據管理引擎
 * 支援 Firebase Realtime Database 即時同步 + LocalStorage 離線本機快取
 * 涵蓋高頻錯題統計、關卡時間分析、CSV/Excel 匯出
 */

const StorageService = {
  LOCAL_KEY_STUDENTS: "valorant_math_students_data",
  LOCAL_KEY_FIREBASE: "valorant_math_firebase_config",
  LOCAL_KEY_CURRENT: "valorant_math_current_session",

  /**
   * 取得 Firebase 連線設定
   */
  getFirebaseConfig() {
    try {
      const cfg = localStorage.getItem(this.LOCAL_KEY_FIREBASE);
      return cfg ? JSON.parse(cfg) : null;
    } catch {
      return null;
    }
  },

  /**
   * 儲存 Firebase 連線設定
   */
  saveFirebaseConfig(config) {
    if (!config) {
      localStorage.removeItem(this.LOCAL_KEY_FIREBASE);
      return;
    }
    localStorage.setItem(this.LOCAL_KEY_FIREBASE, JSON.stringify(config));
  },

  /**
   * 取得當前登入的學生資訊
   */
  getCurrentStudent() {
    try {
      const cur = sessionStorage.getItem(this.LOCAL_KEY_CURRENT);
      return cur ? JSON.parse(cur) : null;
    } catch {
      return null;
    }
  },

  /**
   * 設定當前登入學生
   */
  setCurrentStudent(student) {
    sessionStorage.setItem(this.LOCAL_KEY_CURRENT, JSON.stringify(student));
  },

  /**
   * 登出當前學生
   */
  logoutStudent() {
    sessionStorage.removeItem(this.LOCAL_KEY_CURRENT);
  },

  /**
   * 取得所有學生數據 (整合本機與 Firebase)
   */
  async getAllStudents() {
    let localData = {};
    try {
      const raw = localStorage.getItem(this.LOCAL_KEY_STUDENTS);
      if (raw) localData = JSON.parse(raw);
    } catch (e) {
      console.warn("讀取本機數據失敗:", e);
    }

    // 嘗試從 Firebase Realtime Database 抓取最新數據
    const fb = this.getFirebaseConfig();
    if (fb && fb.databaseURL) {
      try {
        let url = fb.databaseURL.replace(/\/$/, "") + "/students.json";
        if (fb.apiKey) url += `?auth=${fb.apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const remoteData = await res.json();
          if (remoteData) {
            // 合併並更新本機快取
            localData = { ...localData, ...remoteData };
            localStorage.setItem(this.LOCAL_KEY_STUDENTS, JSON.stringify(localData));
          }
        }
      } catch (err) {
        console.warn("Firebase 同步連線失敗，退回使用本機數據:", err);
      }
    }

    return localData;
  },

  /**
   * 儲存或更新單一學生的關卡成績與作答紀錄
   */
  async saveStudentProgress(record) {
    const { studentId, studentName, className, level, score, stars, passed, timeSpent, wrongQuestions } = record;
    if (!studentId) return;

    let allStudents = await this.getAllStudents();
    const key = `${className || "未分班"}_${studentId}`;

    if (!allStudents[key]) {
      allStudents[key] = {
        studentId,
        studentName,
        className: className || "未分班",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        levels: {
          1: { passed: false, highScore: 0, stars: 0, attempts: 0, totalTimeSeconds: 0, wrongQuestionIds: [] },
          2: { passed: false, highScore: 0, stars: 0, attempts: 0, totalTimeSeconds: 0, wrongQuestionIds: [] },
          3: { passed: false, highScore: 0, stars: 0, attempts: 0, totalTimeSeconds: 0, wrongQuestionIds: [] }
        },
        history: []
      };
    }

    const student = allStudents[key];
    student.studentName = studentName || student.studentName;
    student.lastActive = new Date().toISOString();

    const lvlData = student.levels[level] || {
      passed: false,
      highScore: 0,
      stars: 0,
      attempts: 0,
      totalTimeSeconds: 0,
      wrongQuestionIds: []
    };

    lvlData.attempts += 1;
    lvlData.totalTimeSeconds += Math.round(timeSpent || 0);
    if (score > lvlData.highScore) {
      lvlData.highScore = score;
    }
    if (stars > lvlData.stars) {
      lvlData.stars = stars;
    }
    if (passed) {
      lvlData.passed = true;
    }

    // 累積錯題 ID (去重複但記錄在歷史記錄中)
    if (Array.isArray(wrongQuestions) && wrongQuestions.length > 0) {
      const set = new Set([...(lvlData.wrongQuestionIds || []), ...wrongQuestions]);
      lvlData.wrongQuestionIds = Array.from(set);
    }

    student.levels[level] = lvlData;

    // 記錄詳細作答歷史
    student.history.push({
      timestamp: Date.now(),
      level,
      score,
      stars,
      passed,
      timeSpent,
      wrongQuestions: wrongQuestions || []
    });

    // 儲存至本機
    localStorage.setItem(this.LOCAL_KEY_STUDENTS, JSON.stringify(allStudents));

    // 同步更新當前 session
    this.setCurrentStudent(student);

    // 同步至 Firebase
    const fb = this.getFirebaseConfig();
    if (fb && fb.databaseURL) {
      try {
        let url = fb.databaseURL.replace(/\/$/, "") + `/students/${key}.json`;
        if (fb.apiKey) url += `?auth=${fb.apiKey}`;
        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(student)
        });
      } catch (err) {
        console.warn("Firebase 即時上傳失敗:", err);
      }
    }

    return student;
  },

  /**
   * 取得全班高頻錯題排行榜統計 (找出最多人答錯的題目)
   */
  async getWrongQuestionStats() {
    const allStudents = await this.getAllStudents();
    const questionStats = {};

    Object.values(allStudents).forEach(student => {
      if (!student.history) return;
      student.history.forEach(attempt => {
        if (attempt.wrongQuestions && Array.isArray(attempt.wrongQuestions)) {
          attempt.wrongQuestions.forEach(qId => {
            if (!questionStats[qId]) {
              questionStats[qId] = {
                questionId: qId,
                wrongCount: 0,
                affectedStudents: new Set()
              };
            }
            questionStats[qId].wrongCount += 1;
            questionStats[qId].affectedStudents.add(student.studentId);
          });
        }
      });
    });

    // 轉為陣列並附加題目詳細情報
    const results = Object.values(questionStats).map(item => {
      const q = window.QuestionBank ? window.QuestionBank.getQuestionById(item.questionId) : null;
      return {
        questionId: item.questionId,
        wrongCount: item.wrongCount,
        studentCount: item.affectedStudents.size,
        level: q ? q.level : 1,
        category: q ? q.category : "未知",
        prompt: q ? q.prompt : `題目 #${item.questionId}`,
        answer: q ? q.answer : "",
        hint: q ? q.hint : "",
        explanation: q ? q.explanation : ""
      };
    });

    // 由錯次高到低排序
    return results.sort((a, b) => b.wrongCount - a.wrongCount);
  },

  /**
   * 取得各關卡分析統計數據 (平均闖關次數、花費時間、通過率)
   */
  async getLevelAnalytics() {
    const allStudents = await this.getAllStudents();
    const studentsList = Object.values(allStudents);
    const totalStudents = studentsList.length;

    const stats = {
      1: { attemptsTotal: 0, timeTotal: 0, passedCount: 0, activeCount: 0 },
      2: { attemptsTotal: 0, timeTotal: 0, passedCount: 0, activeCount: 0 },
      3: { attemptsTotal: 0, timeTotal: 0, passedCount: 0, activeCount: 0 }
    };

    studentsList.forEach(st => {
      [1, 2, 3].forEach(lvl => {
        const d = st.levels && st.levels[lvl];
        if (d && d.attempts > 0) {
          stats[lvl].activeCount += 1;
          stats[lvl].attemptsTotal += d.attempts;
          stats[lvl].timeTotal += d.totalTimeSeconds;
          if (d.passed) {
            stats[lvl].passedCount += 1;
          }
        }
      });
    });

    return [1, 2, 3].map(lvl => {
      const active = stats[lvl].activeCount;
      return {
        level: lvl,
        totalParticipants: active,
        avgAttempts: active > 0 ? (stats[lvl].attemptsTotal / active).toFixed(1) : 0,
        avgTimeSeconds: active > 0 ? Math.round(stats[lvl].timeTotal / active) : 0,
        passRate: active > 0 ? Math.round((stats[lvl].passedCount / active) * 100) : 0
      };
    });
  },

  /**
   * 匯出 Excel / CSV 格式學習成效報表 (含 UTF-8 BOM 防中文亂碼)
   */
  async exportStudentsToCSV() {
    const allStudents = await this.getAllStudents();
    const list = Object.values(allStudents);

    const headers = [
      "班級",
      "座號/學號",
      "姓名",
      "Level 1 通關",
      "Level 1 最高分",
      "Level 1 星級",
      "Level 1 嘗試次數",
      "Level 1 作答時間(秒)",
      "Level 2 通關",
      "Level 2 最高分",
      "Level 2 星級",
      "Level 2 嘗試次數",
      "Level 2 作答時間(秒)",
      "Level 3 通關",
      "Level 3 最高分",
      "Level 3 星級",
      "Level 3 嘗試次數",
      "Level 3 作答時間(秒)",
      "累計星星數",
      "最後活動時間"
    ];

    const rows = list.map(st => {
      const l1 = (st.levels && st.levels[1]) || {};
      const l2 = (st.levels && st.levels[2]) || {};
      const l3 = (st.levels && st.levels[3]) || {};
      const totalStars = (l1.stars || 0) + (l2.stars || 0) + (l3.stars || 0);

      return [
        `"${st.className || ""}"`,
        `"${st.studentId || ""}"`,
        `"${st.studentName || ""}"`,
        l1.passed ? "已通關" : "未通關",
        l1.highScore || 0,
        l1.stars || 0,
        l1.attempts || 0,
        l1.totalTimeSeconds || 0,
        l2.passed ? "已通關" : "未通關",
        l2.highScore || 0,
        l2.stars || 0,
        l2.attempts || 0,
        l2.totalTimeSeconds || 0,
        l3.passed ? "已通關" : "未通關",
        l3.highScore || 0,
        l3.stars || 0,
        l3.attempts || 0,
        l3.totalTimeSeconds || 0,
        totalStars,
        `"${st.lastActive || ""}"`
      ].join(",");
    });

    // 加入 UTF-8 BOM (\uFEFF) 確保 Excel 正確解析中文
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    return csvContent;
  },

  /**
   * 產生示範測試數據 (供教師初次開啟後台即時預覽數據圖表)
   */
  generateDemoData() {
    const demoStudents = {
      "五年一班_01": {
        studentId: "01",
        studentName: "林小華",
        className: "五年一班",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        levels: {
          1: { passed: true, highScore: 100, stars: 3, attempts: 1, totalTimeSeconds: 65, wrongQuestionIds: [] },
          2: { passed: true, highScore: 95, stars: 3, attempts: 2, totalTimeSeconds: 150, wrongQuestionIds: [9] },
          3: { passed: true, highScore: 90, stars: 2, attempts: 2, totalTimeSeconds: 210, wrongQuestionIds: [18] }
        },
        history: [
          { timestamp: Date.now() - 3600000, level: 1, score: 100, stars: 3, passed: true, timeSpent: 65, wrongQuestions: [] },
          { timestamp: Date.now() - 3000000, level: 2, score: 75, stars: 1, passed: false, timeSpent: 80, wrongQuestions: [9] },
          { timestamp: Date.now() - 2500000, level: 2, score: 95, stars: 3, passed: true, timeSpent: 70, wrongQuestions: [] },
          { timestamp: Date.now() - 1500000, level: 3, score: 90, stars: 2, passed: true, timeSpent: 210, wrongQuestions: [18] }
        ]
      },
      "五年一班_02": {
        studentId: "02",
        studentName: "張美琪",
        className: "五年一班",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        levels: {
          1: { passed: true, highScore: 90, stars: 2, attempts: 2, totalTimeSeconds: 110, wrongQuestionIds: [3] },
          2: { passed: false, highScore: 70, stars: 1, attempts: 3, totalTimeSeconds: 280, wrongQuestionIds: [9, 11, 14] },
          3: { passed: false, highScore: 0, stars: 0, attempts: 0, totalTimeSeconds: 0, wrongQuestionIds: [] }
        },
        history: [
          { timestamp: Date.now() - 5000000, level: 1, score: 90, stars: 2, passed: true, timeSpent: 110, wrongQuestions: [3] },
          { timestamp: Date.now() - 4000000, level: 2, score: 50, stars: 1, passed: false, timeSpent: 90, wrongQuestions: [9, 11] },
          { timestamp: Date.now() - 3200000, level: 2, score: 70, stars: 1, passed: false, timeSpent: 95, wrongQuestions: [9, 14] }
        ]
      },
      "五年一班_03": {
        studentId: "03",
        studentName: "王大明",
        className: "五年一班",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        levels: {
          1: { passed: true, highScore: 100, stars: 3, attempts: 1, totalTimeSeconds: 55, wrongQuestionIds: [] },
          2: { passed: true, highScore: 85, stars: 2, attempts: 2, totalTimeSeconds: 190, wrongQuestionIds: [9] },
          3: { passed: true, highScore: 95, stars: 3, attempts: 1, totalTimeSeconds: 160, wrongQuestionIds: [] }
        },
        history: [
          { timestamp: Date.now() - 8000000, level: 1, score: 100, stars: 3, passed: true, timeSpent: 55, wrongQuestions: [] },
          { timestamp: Date.now() - 7000000, level: 2, score: 70, stars: 1, passed: false, timeSpent: 100, wrongQuestions: [9] },
          { timestamp: Date.now() - 6500000, level: 2, score: 85, stars: 2, passed: true, timeSpent: 90, wrongQuestions: [] },
          { timestamp: Date.now() - 5000000, level: 3, score: 95, stars: 3, passed: true, timeSpent: 160, wrongQuestions: [] }
        ]
      },
      "五年一班_04": {
        studentId: "04",
        studentName: "李冠宇",
        className: "五年一班",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        levels: {
          1: { passed: true, highScore: 95, stars: 3, attempts: 1, totalTimeSeconds: 70, wrongQuestionIds: [] },
          2: { passed: true, highScore: 90, stars: 2, attempts: 2, totalTimeSeconds: 175, wrongQuestionIds: [11] },
          3: { passed: false, highScore: 65, stars: 1, attempts: 2, totalTimeSeconds: 240, wrongQuestionIds: [16, 18] }
        },
        history: [
          { timestamp: Date.now() - 4500000, level: 1, score: 95, stars: 3, passed: true, timeSpent: 70, wrongQuestions: [] },
          { timestamp: Date.now() - 3500000, level: 2, score: 90, stars: 2, passed: true, timeSpent: 175, wrongQuestions: [11] },
          { timestamp: Date.now() - 2000000, level: 3, score: 65, stars: 1, passed: false, timeSpent: 120, wrongQuestions: [16, 18] }
        ]
      },
      "五年二班_01": {
        studentId: "01",
        studentName: "黃品瑄",
        className: "五年二班",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        levels: {
          1: { passed: true, highScore: 100, stars: 3, attempts: 1, totalTimeSeconds: 60, wrongQuestionIds: [] },
          2: { passed: true, highScore: 100, stars: 3, attempts: 1, totalTimeSeconds: 120, wrongQuestionIds: [] },
          3: { passed: true, highScore: 100, stars: 3, attempts: 1, totalTimeSeconds: 140, wrongQuestionIds: [] }
        },
        history: [
          { timestamp: Date.now() - 9000000, level: 1, score: 100, stars: 3, passed: true, timeSpent: 60, wrongQuestions: [] },
          { timestamp: Date.now() - 8500000, level: 2, score: 100, stars: 3, passed: true, timeSpent: 120, wrongQuestions: [] },
          { timestamp: Date.now() - 8000000, level: 3, score: 100, stars: 3, passed: true, timeSpent: 140, wrongQuestions: [] }
        ]
      }
    };

    localStorage.setItem(this.LOCAL_KEY_STUDENTS, JSON.stringify(demoStudents));
    return demoStudents;
  },

  /**
   * 清除所有本機學生數據
   */
  clearAllData() {
    localStorage.removeItem(this.LOCAL_KEY_STUDENTS);
    sessionStorage.removeItem(this.LOCAL_KEY_CURRENT);
  }
};

window.StorageService = StorageService;
