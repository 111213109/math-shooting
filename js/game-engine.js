/**
 * game-engine.js - 特戰英豪數學作戰主控引擎
 * 串接學生登入狀態、關卡解鎖門檻 (85分及格)、三星成就評量、鷹架提示與數據存檔
 */

class GameEngine {
  constructor() {
    this.touchDevice = !!(window.matchMedia?.("(pointer: coarse)")?.matches || window.navigator?.maxTouchPoints > 0);
    this.practiceMode = false;
    this.runPractice = false;
    this.finishing = false;
    this.manualPaused = false;
    this.currentStudent = null;
    this.currentLevel = 1;
    this.activeGameInstance = null;
    this.levelTimerInterval = null;
    this.remainingSeconds = 180;
    this.levelStartTime = 0;

    this.initDOM();
  }

  initDOM() {
    this.dom = {
      loginScreen: document.getElementById("loginScreen"),
      levelSelectScreen: document.getElementById("levelSelectScreen"),
      gameViewScreen: document.getElementById("gameViewScreen"),
      tacticalHud: document.getElementById("tacticalHud"),

      // HUD 元素
      hudName: document.getElementById("hudStudentName"),
      hudClass: document.getElementById("hudClassName"),
      hudScore: document.getElementById("hudScore"),
      hudCombo: document.getElementById("hudCombo"),
      hudTimer: document.getElementById("hudTimer"),
      hudLevelBadge: document.getElementById("hudLevelBadge"),

      // 畫布容器
      canvasContainer: document.getElementById("gameViewport"),
      canvas2D: document.getElementById("gameCanvas2D"),
      radarContainer: document.getElementById("radarContainer"),
      barrierContainer: document.getElementById("barrierContainer"),

      // 鷹架提示彈窗
      remediationModal: document.getElementById("remediationModal"),
      remediationTitle: document.getElementById("remediationTitle"),
      remediationChoice: document.getElementById("remediationChoice"),
      remediationExplanation: document.getElementById("remediationExplanation"),
      remediationHint: document.getElementById("remediationHint"),
      btnResumeMission: document.getElementById("btnResumeMission"),

      // 關卡結算彈窗
      resultModal: document.getElementById("resultModal"),
      resultTitle: document.getElementById("resultTitle"),
      resultScore: document.getElementById("resultScore"),
      resultStars: document.getElementById("resultStars"),
      resultFeedback: document.getElementById("resultFeedback"),
      btnNextLevel: document.getElementById("btnNextLevel"),
      btnRetryLevel: document.getElementById("btnRetryLevel"),
      btnReturnMenu: document.getElementById("btnReturnMenu")
    };

    if (this.touchDevice) {
      document.body.classList.add("touch-device");
      document.getElementById("btnCaptureAim").textContent = "開始觸控瞄準";
      document.getElementById("aimInstructions").textContent = "在畫面上拖曳轉動視角，用右下角開火鍵向中央準星射擊。答錯扣 20 HP。";
    }
    this.bindDOMEvents();
    this.checkAutoLogin();
  }

  bindDOMEvents() {
    document.getElementById("practiceMode").addEventListener("change", e => {
      this.practiceMode = e.target.checked; this.updateLevelSelectCards();
    });
    document.getElementById("btnCaptureAim").addEventListener("click", () => this.activeGameInstance?.captureAim());
    document.getElementById("btnDragAim").addEventListener("click", () => this.activeGameInstance?.enableDragAim());
    document.getElementById("btnPause").addEventListener("click", () => this.togglePause());
    document.getElementById("btnContinue").addEventListener("click", () => this.togglePause());
    document.getElementById("btnExit").addEventListener("click", () => this.showLevelSelect());
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && performance.now() - (this.activeGameInstance?.pointerReleasedAt || -1000) > 250) this.togglePause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.activeGameInstance?.active && !this.activeGameInstance.paused) this.togglePause();
    });
    // 學生登入表單
    const loginForm = document.getElementById("studentLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // 登出按鈕
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => this.handleLogout());
    }

    // 音效開關按鈕
    const btnAudioToggle = document.getElementById("btnAudioToggle");
    if (btnAudioToggle) {
      btnAudioToggle.addEventListener("click", () => {
        const isMuted = window.Sound.toggleMute();
        btnAudioToggle.textContent = isMuted ? "🔇 靜音" : "🔊 音效";
      });
    }

    // 關卡選擇卡片按鈕
    document.querySelectorAll(".btn-enter-level").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const lvl = Number(e.currentTarget.dataset.level);
        this.selectLevel(lvl);
      });
    });

    // 戰術鷹架「重新鎖定目標 / 繼續任務」按鈕
    if (this.dom.btnResumeMission) {
      this.dom.btnResumeMission.addEventListener("click", () => {
        this.closeRemediationModal();
      });
    }

    // 結算按鈕們
    if (this.dom.btnNextLevel) {
      this.dom.btnNextLevel.addEventListener("click", () => {
        this.closeResultModal();
        if (this.currentLevel < 3) {
          this.selectLevel(this.currentLevel + 1);
        } else {
          this.showLevelSelect();
        }
      });
    }

    if (this.dom.btnRetryLevel) {
      this.dom.btnRetryLevel.addEventListener("click", () => {
        this.closeResultModal();
        this.selectLevel(this.currentLevel);
      });
    }

    if (this.dom.btnReturnMenu) {
      this.dom.btnReturnMenu.addEventListener("click", () => {
        this.closeResultModal();
        this.showLevelSelect();
      });
    }

    const fire = document.getElementById("mobileFireBtn");
    fire.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation();
      const g = this.activeGameInstance;
      if (!g?.active || g.paused || !g.aimReady) return;
      if (this.compatibilityMode) g.handleShoot(g.mouseX, g.mouseY);
      else g.handleShoot();
    });
    document.getElementById("btnFullscreen").addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (error) { document.getElementById("controlHint").textContent = "此瀏覽器不支援全螢幕；仍可正常遊玩，橫向畫面會更寬。"; }
    });
  }

  checkAutoLogin() {
    const cur = window.StorageService.getCurrentStudent();
    if (cur) {
      this.currentStudent = cur;
      this.showLevelSelect();
    } else {
      this.showLoginScreen();
    }
  }

  handleLogin() {
    const classInput = document.getElementById("inputClass").value.trim();
    const idInput = document.getElementById("inputId").value.trim();
    const nameInput = document.getElementById("inputName").value.trim();

    if (!idInput || !nameInput) {
      alert("請輸入學號/座號與姓名！");
      return;
    }

    window.Sound.playBeep(true);

    this.currentStudent = {
      className: classInput || "五年一班",
      studentId: idInput,
      studentName: nameInput,
      levels: {
        1: { passed: false, highScore: 0, stars: 0, attempts: 0, totalTimeSeconds: 0, wrongQuestionIds: [] },
        2: { passed: false, highScore: 0, stars: 0, attempts: 0, totalTimeSeconds: 0, wrongQuestionIds: [] },
        3: { passed: false, highScore: 0, stars: 0, attempts: 0, totalTimeSeconds: 0, wrongQuestionIds: [] }
      }
    };

    // 嘗試讀取雲端/本機已存在的舊資料
    window.StorageService.getAllStudents().then(all => {
      const key = `${this.currentStudent.className}_${this.currentStudent.studentId}`;
      if (all[key]) {
        this.currentStudent = all[key];
      }
      window.StorageService.setCurrentStudent(this.currentStudent);
      this.showLevelSelect();
    });
  }

  handleLogout() {
    window.StorageService.logoutStudent();
    this.currentStudent = null;
    this.stopCurrentGame();
    this.showLoginScreen();
  }

  showLoginScreen() {
    this.dom.loginScreen.style.display = "flex";
    this.dom.levelSelectScreen.style.display = "none";
    this.dom.gameViewScreen.style.display = "none";
    this.dom.tacticalHud.style.display = "none";
  }

  showLevelSelect() {
    this.stopCurrentGame();
    this.dom.loginScreen.style.display = "none";
    this.dom.levelSelectScreen.style.display = "block";
    this.dom.gameViewScreen.style.display = "none";
    this.dom.tacticalHud.style.display = "flex";

    this.updateHudUserInfo();
    this.updateLevelSelectCards();
  }

  updateHudUserInfo() {
    if (!this.currentStudent) return;
    this.dom.hudName.textContent = this.currentStudent.studentName;
    this.dom.hudClass.textContent = `${this.currentStudent.className} #${this.currentStudent.studentId}`;
  }

  /**
   * 更新關卡選單解鎖狀態與星級成就
   * 規定：前一關達到 85 分才可解鎖下一關
   */
  updateLevelSelectCards() {
    const lvls = this.currentStudent.levels || {};
    const l1 = lvls[1] || { passed: false, highScore: 0, stars: 0 };
    const l2 = lvls[2] || { passed: false, highScore: 0, stars: 0 };
    const l3 = lvls[3] || { passed: false, highScore: 0, stars: 0 };

    // Level 1: 始終開放
    this.renderCardState(1, true, l1);

    // Level 2: Level 1 達 85 分解鎖
    const l2Unlocked = (l1.highScore >= 85) || l1.passed;
    this.renderCardState(2, this.practiceMode || l2Unlocked, l2);

    // Level 3: Level 2 達 85 分解鎖
    const l3Unlocked = (l2.highScore >= 85) || l2.passed;
    this.renderCardState(3, this.practiceMode || l3Unlocked, l3);
  }

  renderCardState(levelNum, unlocked, data) {
    const card = document.getElementById(`levelCard${levelNum}`);
    const scoreText = document.getElementById(`level${levelNum}Score`);
    const starBox = document.getElementById(`level${levelNum}Stars`);
    const btn = card?.querySelector(".btn-enter-level");

    if (!card) return;

    if (unlocked) {
      card.classList.remove("locked");
      if (btn) {
        btn.disabled = false;
        btn.textContent = data.highScore > 0 ? "再次挑戰" : "開始作戰";
      }
    } else {
      card.classList.add("locked");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "未解鎖 (需 85 分)";
      }
    }

    if (scoreText) {
      scoreText.textContent = data.highScore > 0 ? `${data.highScore} 分` : "-- 分";
    }

    if (starBox) {
      const stars = data.stars || 0;
      starBox.innerHTML = `
        <span class="star ${stars >= 1 ? "active" : ""}">★</span>
        <span class="star ${stars >= 2 ? "active" : ""}">★</span>
        <span class="star ${stars >= 3 ? "active" : ""}">★</span>
      `;
    }
  }

  selectLevel(level) {
    if (!this.currentStudent || ![1,2,3].includes(level)) return;
    if (!this.practiceMode && level > 1) {
      const previous = this.currentStudent.levels?.[level - 1];
      if (!previous?.passed && !(previous?.highScore >= 85)) return;
    }
    const questions = window.QuestionBank.getQuestions(level).map(q => ({ ...q, options: [...q.options] }));
    if (!questions.length) { alert("這一關還沒有題目，請先檢查題庫。"); return; }
    // Shuffle questions and options for each attempt without changing the source bank.
    const shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } };
    shuffle(questions); questions.forEach(q => shuffle(q.options));
    this.stopCurrentGame();
    this.finishing = false;
    this.runPractice = this.practiceMode;
    this.currentLevel = level;
    document.body.classList.add("in-mission");
    document.getElementById("runModeLabel").textContent = this.runPractice ? "自由練習 · 不記成績" : "正式挑戰";
    this.dom.levelSelectScreen.style.display = "none";
    this.dom.gameViewScreen.style.display = "block";
    this.dom.tacticalHud.style.display = "flex";

    this.dom.hudLevelBadge.textContent = `LEVEL 0${level}`;
    this.dom.hudScore.textContent = "0";
    this.dom.hudCombo.textContent = "x0";

    // 啟動關卡計時器 (每關限時 180 秒)
    this.remainingSeconds = 180;
    this.levelStartTime = Date.now();
    this.updateTimerDisplay();

    if (this.levelTimerInterval) clearInterval(this.levelTimerInterval);
    this.levelTimerInterval = setInterval(() => {
      if (this.runPractice || this.activeGameInstance?.paused || !this.activeGameInstance?.aimReady || this.manualPaused) return;
      this.remainingSeconds -= 1;
      this.updateTimerDisplay();
      if (this.remainingSeconds <= 0) {
        this.handleTimeOut();
      }
    }, 1000);

    // 載入題庫
    // questions were validated before starting the timer.

    this.dom.canvas2D.style.display = "none";
    this.dom.radarContainer.style.display = level === 2 ? "block" : "none";
    this.dom.barrierContainer.style.display = "none";
    this.playerHealth = 100;
    this.updateHealthUI();
    document.getElementById("missionConcept").textContent = ["因數與倍數 · 找出符合題意的目標", "公因數與公倍數 · 算好再瞄準", "生活任務 · 判斷情境再計算"][level - 1];
    document.getElementById("aimOverlay").classList.add("active");
    try {
      this.activeGameInstance = new window.Level2ZombieGame(
        this.dom.canvasContainer,
        (score, combo) => this.onScoreUpdate(score, combo),
        (question, picked) => this.onWrongAnswer(question, picked),
        (result) => this.onLevelFinish(result)
      );
      this.activeGameInstance.start(questions);
    } catch (error) {
      console.error(error);
      this.start2DFallback(questions, error);
    }
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    this.dom.hudTimer.textContent = this.runPractice ? "不限時" : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  handleTimeOut() {
    clearInterval(this.levelTimerInterval);
    this.finishReason = "時間到，未完成題目不計首次答對。";
    if (this.activeGameInstance && this.activeGameInstance.finishLevel) {
      this.activeGameInstance.finishLevel();
    }
  }

  onScoreUpdate(score, combo) {
    this.dom.hudScore.textContent = String(score);
    this.dom.hudCombo.textContent = `x${combo}`;
  }

  /**
   * 答錯即時跳出「學習解析與概念提示」 (鷹架支持)
   */
  onZombieBreach(question) {
    this.playerHealth=Math.max(0,this.playerHealth-20);
    this.updateHealthUI();
    const viewport=this.dom.canvasContainer;
    viewport.classList.remove("damage-flash");
    void viewport.offsetWidth;
    viewport.classList.add("damage-flash");
    if(this.playerHealth===0) {
      this.finishReason=`喪屍突破防線，血量歸零。最後一題：${question.prompt} 正確答案：${question.answer}。`;
      this.activeGameInstance.finishLevel();
    }
  }

  onWrongAnswer(question, pickedText) {
    this.playerHealth = Math.max(0, this.playerHealth - 20);
    this.updateHealthUI();
    const viewport = this.dom.canvasContainer;
    viewport.classList.remove("damage-flash");
    void viewport.offsetWidth;
    viewport.classList.add("damage-flash");
    if (this.playerHealth === 0) {
      this.finishReason = `血量歸零。最後一題：${question.prompt} 正確答案：${question.answer}。${question.explanation}`;
      this.activeGameInstance.finishLevel();
      return;
    }
    this.dom.remediationTitle.textContent = question.prompt;
    this.dom.remediationChoice.textContent = `你選擇了【${pickedText}】 · −20 HP · 剩餘 ${this.playerHealth} HP`;
    this.dom.remediationExplanation.textContent = question.explanation;
    this.dom.remediationHint.textContent = question.hint;

    this.dom.remediationModal.classList.add("active");
  }

  closeRemediationModal() {
    this.dom.remediationModal.classList.remove("active");
    if (this.activeGameInstance && this.activeGameInstance.resume) {
      this.activeGameInstance.resume();
    }
  }

  /**
   * 關卡通關結算
   * 評量：>=95 三星, >=85 二星, <85 一星 (未達標需重考)
   */
  async onLevelFinish(result) {
    if (this.finishing) return;
    this.finishing = true;
    const finishedInstance = this.activeGameInstance;
    this.dom.remediationModal.classList.remove("active");
    if (this.levelTimerInterval) clearInterval(this.levelTimerInterval);

    const timeSpent = Math.max(1, Math.round((Date.now() - this.levelStartTime) / 1000));
    const score = result.normalizedScore;

    // 計算星級成就
    let stars = 1;
    let passed = false;
    let feedback = "";

    if (this.playerHealth <= 0) {
      feedback = "血量耗盡。看看最後一題的解析，再重新挑戰。";
    } else if (score >= 95) {
      stars = 3;
      passed = true;
      feedback = "🌟 頂尖特戰特工！完美掌握因數與倍數概念，命中率極高！";
    } else if (score >= 85) {
      stars = 2;
      passed = true;
      feedback = "🎖️ 任務達成！成功通過 85 分門檻，已解鎖下一階段作戰！";
    } else {
      stars = 1;
      passed = false;
      feedback = "⚠️ 戰術未達標！首次答對率需達 85% 方可解鎖下一關，請複習提示並再次挑戰！";
    }

    // The final shot already supplies success/failure feedback; no second sound here.

    // 儲存數據
    const record = {
      studentId: this.currentStudent.studentId,
      studentName: this.currentStudent.studentName,
      className: this.currentStudent.className,
      level: this.currentLevel,
      score: score,
      stars: stars,
      passed: passed,
      timeSpent: timeSpent,
      wrongQuestions: result.wrongQuestionIds || []
    };

    if (!this.runPractice) {
      try {
        await window.StorageService.saveStudentProgress(record);
        this.currentStudent = window.StorageService.getCurrentStudent() || this.currentStudent;
      } catch (error) { feedback += " 成績儲存失敗，請稍後再試。"; }
    }
    feedback += ` 首次答對 ${result.firstTryCorrect}/${result.totalQuestions} 題，完成 ${result.solved} 題。`;
    if (this.runPractice) feedback = "自由練習完成，本次不寫入正式成績。" + feedback;
    if (this.finishReason) feedback += " " + this.finishReason;

    if (this.activeGameInstance !== finishedInstance) return;

    // 顯示結算畫面
    this.dom.resultTitle.textContent = this.playerHealth <= 0 ? "血量耗盡 · 再試一次" : passed ? "MISSION ACCOMPLISHED // 任務完成" : "MISSION FAILED // 需再次挑戰";
    this.dom.resultScore.textContent = `${score} 分`;
    this.dom.resultStars.innerHTML = `
      <span class="star ${stars >= 1 ? "active" : ""}">★</span>
      <span class="star ${stars >= 2 ? "active" : ""}">★</span>
      <span class="star ${stars >= 3 ? "active" : ""}">★</span>
    `;
    this.dom.resultFeedback.textContent = feedback;

    if (this.dom.btnNextLevel) {
      if (this.playerHealth > 0 && (passed || this.runPractice) && this.currentLevel < 3) {
        this.dom.btnNextLevel.style.display = "inline-flex";
      } else {
        this.dom.btnNextLevel.style.display = "none";
      }
    }

    document.getElementById("aimOverlay").classList.remove("active");
    document.getElementById("fpsCrosshair").style.display = "none";
    this.dom.resultModal.classList.add("active");
  }

  closeResultModal() {
    this.dom.resultModal.classList.remove("active");
  }

  start2DFallback(questions, error) {
    if (this.activeGameInstance?.dispose) this.activeGameInstance.dispose();
    this.compatibilityMode = true;
    document.getElementById("aimOverlay").classList.remove("active");
    document.getElementById("fpsCrosshair").style.display = "none";
    this.dom.radarContainer.style.display = "none";
    this.dom.canvas2D.style.display = "block";
    const notice = document.getElementById("compatibilityNotice");
    notice.textContent = `已切換到 2D 相容模式，可繼續作答；血量與計分照常。3D 啟動訊息：${error.message || String(error)}`;
    notice.style.display = "block";
    document.getElementById("controlHint").textContent = "相容模式：移動滑鼠瞄準，直接點擊／觸控答案標靶射擊。";
    const GameClass = this.currentLevel === 3 ? window.Level3HybridGame : window.Level1RangeGame;
    this.activeGameInstance = new GameClass(this.dom.canvas2D,
      (score, combo) => this.onScoreUpdate(score, combo),
      (question, picked) => this.onWrongAnswer(question, picked),
      result => this.onLevelFinish(result));
    this.activeGameInstance.aimReady = true;
    this.activeGameInstance.start(questions);
  }

  updateHealthUI() {
    const hp = this.playerHealth;
    document.getElementById("playerHealthText").textContent = `${hp} / 100`;
    document.getElementById("playerHealthFill").style.width = `${hp}%`;
    document.getElementById("playerHealth").classList.toggle("critical", hp <= 40);
    document.getElementById("playerHealth").setAttribute("aria-valuenow", hp);
  }

  updateQuestionProgress(index, total) {
    if (this.compatibilityMode) {
      const q = this.activeGameInstance?.questions[index];
      const legend = document.getElementById("answerLegend");
      legend.replaceChildren();
      if (q) {
        document.getElementById("missionConcept").textContent = q.category || "相容模式";
        q.options.forEach(option => {const chip=document.createElement("div");chip.className="answer-chip";chip.textContent=String(option);legend.appendChild(chip);});
      }
    }
    document.getElementById("questionProgress").textContent = `第 ${index + 1} / ${total} 題`;
    document.getElementById("questionProgressFill").style.width = `${index / total * 100}%`;
  }

  togglePause() {
    if (!this.activeGameInstance?.active || this.finishing || this.dom.remediationModal.classList.contains("active")) return;
    this.manualPaused = !this.manualPaused;
    document.getElementById("pauseModal").classList.toggle("active", this.manualPaused);
    if (this.manualPaused) this.activeGameInstance.pause(); else this.activeGameInstance.resume();
  }

  stopCurrentGame() {
    this.compatibilityMode = false;
    document.body.classList.remove("in-mission");
    document.getElementById("compatibilityNotice").style.display = "none";
    this.manualPaused = false;
    document.getElementById("aimOverlay").classList.remove("active");
    document.getElementById("fpsCrosshair").style.display = "none";
    this.finishReason = "";
    document.getElementById("pauseModal").classList.remove("active");
    this.dom.remediationModal.classList.remove("active");
    this.dom.resultModal.classList.remove("active");
    document.getElementById("killBanner").classList.remove("active");
    if (this.levelTimerInterval) {
      clearInterval(this.levelTimerInterval);
      this.levelTimerInterval = null;
    }
    if (this.activeGameInstance) {
      if (this.activeGameInstance.dispose) this.activeGameInstance.dispose();
      else this.activeGameInstance.stop();
      this.activeGameInstance = null;
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.Game = new GameEngine();
});
