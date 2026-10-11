/**
 * level1-2d.js - 關卡 1：2D 特戰英豪真實靶場 (Realistic Valorant Range & First-Person Gun)
 * 特色：
 * 1. 忠實參考特戰英豪訓練靶場原圖（木造桁架屋頂、頂部計分板、地面橙色導引軌道、前置操作台與兩側直立發光燈柱）
 * 2. 真實第一人稱特工手槍視角（右下角戰術手套手持 Classic 手槍，瞄準即時跟隨、開火後座力跳動、槍口火光）
 * 3. 動態無人機移動標靶與即時爆頭音效
 */

class Level1RangeGame {
  constructor(canvas, onScoreUpdate, onWrongAnswer, onLevelComplete) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onScoreUpdate = onScoreUpdate;
    this.onWrongAnswer = onWrongAnswer;
    this.onLevelComplete = onLevelComplete;

    this.session = new window.MissionSession();
    this.solved = 0;
    this.firstTryCorrect = 0;
    this.questionHadError = false;
    this.transitioning = false;
    this.active = false;
    this.paused = false;
    this.questions = [];
    this.currentQIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.targets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.wrongQuestionIds = [];

    this.mouseX = 0;
    this.mouseY = 0;
    this.gunRecoil = 0;
    this.gunMuzzleFlash = 0;
    this.animationId = null;

    this.initCanvasSize();
    this.bindEvents();
  }

  initCanvasSize() {
    this.width = this.canvas.parentElement.clientWidth || 900;
    this.height = this.canvas.parentElement.clientHeight || 550;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;
  }

  bindEvents() {
    this.session.listen(window, "resize", () => {
      if (this.active) this.initCanvasSize();
    });

    this.session.listen(this.canvas, "mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });

    this.session.listen(this.canvas, "mousedown", (e) => {
      if (!this.active || this.paused) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.handleShoot(x, y);
    });

    this.session.listen(this.canvas, "touchstart", (e) => {
      if (!this.active || this.paused) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.mouseX = x;
      this.mouseY = y;
      this.handleShoot(x, y);
    }, { passive: false });
  }

  start(questions) {
    this.questions = questions || [];
    this.currentQIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.gunRecoil = 0;
    this.gunMuzzleFlash = 0;
    this.wrongQuestionIds = [];
    this.active = true;
    this.paused = false;
    this.particles = [];
    this.floatingTexts = [];

    this.initCanvasSize();
    this.loadQuestion(this.currentQIndex);
    this.loop();
  }

  stop() {
    this.active = false;
    this.session.dispose();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  loadQuestion(index) {
    if (index >= this.questions.length) {
      this.finishLevel();
      return;
    }

    this.transitioning = false;
    this.questionHadError = false;
    window.Game?.updateQuestionProgress(index, this.questions.length);
    const q = this.questions[index];
    this.targets = [];

    const promptBar = document.getElementById("missionPromptText");
    if (promptBar) {
      promptBar.textContent = q.prompt;
    }

    // 建立 4 個橫向懸浮移動標靶
    const laneHeight = (this.height - 190) / 4;
    q.options.forEach((opt, idx) => {
      const isCorrect = String(opt).trim() === String(q.answer).trim();
      const y = 90 + idx * laneHeight;
      const speed = (idx % 2 === 0 ? 1.9 : -1.9) * (1 + (idx * 0.12));
      const startX = idx % 2 === 0 ? 80 : this.width - 120;

      this.targets.push({
        text: String(opt),
        isCorrect: isCorrect,
        x: startX,
        y: y,
        radius: 44,
        vx: speed,
        pulse: 0,
        destroyed: false
      });
    });
  }

  handleShoot(x, y) {
    if (!this.active || this.paused || this.transitioning) return;
    // One feedback sound is played after the hit result is known.

    // 觸發槍枝後座力跳動與火光
    this.gunRecoil = 32;
    this.gunMuzzleFlash = 5;

    let hit = false;
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (t.destroyed) continue;

      const dist = Math.hypot(x - t.x, y - t.y);
      if (dist <= t.radius) {
        hit = true;
        this.processTargetHit(t, x, y);
        break;
      }
    }

    if (!hit) {
      window.Sound.playMiss();
      this.createSparks(x, y, "#768079", 6);
    }
  }

  processTargetHit(target, x, y) {
    const currentQ = this.questions[this.currentQIndex];

    if (target.isCorrect) {
      this.transitioning = true;
      this.solved += 1;
      if (!this.questionHadError) this.firstTryCorrect += 1;
      this.combo += 1;
      window.Sound.playKill(this.combo);

      const points = 20 + Math.min(10, this.combo * 2);
      this.score += points;

      this.createSparks(target.x, target.y, "#00f5d4", 32);
      this.addFloatingText(`HEADSHOT! +${points}`, target.x, target.y - 20, "#00f5d4");
      this.showKillBanner(`ELIMINATED! COMBO x${this.combo}`);

      target.destroyed = true;

      if (this.onScoreUpdate) {
        this.onScoreUpdate(this.score, this.combo);
      }

      this.session.later(() => {
        if (!this.active) return;
        this.currentQIndex += 1;
        this.loadQuestion(this.currentQIndex);
      }, 700);

    } else {
      window.Sound.playMiss();
      this.combo = 0;
      this.createSparks(target.x, target.y, "#ff4655", 25);
      this.addFloatingText("MISS! 錯誤目標", target.x, target.y - 20, "#ff4655");

      this.questionHadError = true;
      this.wrongQuestionIds.push(currentQ.id);

      if (this.onScoreUpdate) {
        this.onScoreUpdate(this.score, this.combo);
      }

      this.pause();
      if (this.onWrongAnswer) {
        this.onWrongAnswer(currentQ, target.text);
      }
    }
  }

  showKillBanner(text) {
    const banner = document.getElementById("killBanner");
    const sub = document.getElementById("killBannerSub");
    if (banner && sub) {
      banner.classList.add("active");
      sub.textContent = text;
      this.session.later(() => {
        banner.classList.remove("active");
      }, 900);
    }
  }

  addFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      alpha: 1,
      vy: -1.5,
      life: 40
    });
  }

  createSparks(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1,
        life: 25 + Math.random() * 15
      });
    }
  }

  finishLevel() {
    if (!this.active) return;
    this.stop();
    if (this.onLevelComplete) {
      const normalizedScore = Math.round(this.firstTryCorrect / (this.questions.length || 1) * 100);
      this.onLevelComplete({
        level: 1,
        rawScore: this.score,
        normalizedScore,
        solved: this.solved,
        firstTryCorrect: this.firstTryCorrect,
        totalQuestions: this.questions.length,
        wrongQuestionIds: Array.from(new Set(this.wrongQuestionIds))
      });
    }
  }

  loop() {
    if (!this.active) return;
    const now = performance.now();
    this.frameDelta = Math.min(2, (now - (this.lastFrame || now - 16.67)) / 16.67);
    this.lastFrame = now;

    if (!this.paused) {
      this.update();
    }
    this.render();

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update() {
    // 標靶移動
    this.targets.forEach(t => {
      if (t.destroyed) return;
      t.x += t.vx * Math.min(2, (this.frameDelta || 1)) * (window.Game?.runPractice ? 0.55 : 1);
      t.pulse += 0.05;

      if (t.x - t.radius < 50) {
        t.x = 50 + t.radius;
        t.vx *= -1;
      } else if (t.x + t.radius > this.width - 50) {
        t.x = this.width - 50 - t.radius;
        t.vx *= -1;
      }
    });

    // 武器後座力阻尼回復
    this.gunRecoil *= 0.82;
    if (this.gunMuzzleFlash > 0) this.gunMuzzleFlash--;

    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 1 / p.life;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 浮動文字
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. 繪製真實特戰英豪訓練靶場環境 (參考圖 1)
    this.renderRangeBackground(ctx);

    // 2. 繪製移動標靶
    this.targets.forEach(t => {
      if (t.destroyed) return;
      this.renderTarget(ctx, t);
    });

    // 3. 繪製粒子與文字
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = "bold 20px 'Chakra Petch', sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // 4. 繪製前方戰術操作台與兩側直立發光燈柱 (參考圖 1 視角下緣)
    this.renderFrontConsoleBooth(ctx);

    // 5. 繪製真實第一人稱手槍與特工戰術手套
    this.renderFirstPersonPistol(ctx);

    // 6. 準星
    this.renderTacticalCrosshair(ctx, this.mouseX, this.mouseY);
  }

  /**
   * 忠實渲染特戰英豪訓練靶場內部結構 (參考圖 1)
   */
  renderRangeBackground(ctx) {
    const w = this.width;
    const h = this.height;

    // A. 遠景牆面 (暖米石造牆色調)
    ctx.fillStyle = "#a8947e";
    ctx.fillRect(0, 0, w, h);

    // 牆面縱深暗角
    const wallShadow = ctx.createLinearGradient(0, 0, 0, h * 0.65);
    wallShadow.addColorStop(0, "rgba(20, 16, 12, 0.75)");
    wallShadow.addColorStop(1, "rgba(20, 16, 12, 0.1)");
    ctx.fillStyle = wallShadow;
    ctx.fillRect(0, 0, w, h * 0.65);

    // 後方靶位木板 (圖 1 中遠處兩塊帶有靶紙的長方木板)
    ctx.fillStyle = "#704829";
    ctx.fillRect(w * 0.32, h * 0.28, w * 0.09, h * 0.18);
    ctx.fillRect(w * 0.59, h * 0.28, w * 0.09, h * 0.18);
    ctx.fillStyle = "#d8caa8";
    ctx.fillRect(w * 0.33, h * 0.31, w * 0.07, h * 0.12);
    ctx.fillRect(w * 0.60, h * 0.31, w * 0.07, h * 0.12);

    // B. 地面 (混凝土靶場地板)
    const groundY = h * 0.45;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
    groundGrad.addColorStop(0, "#736b60");
    groundGrad.addColorStop(1, "#423d37");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, w, h - groundY);

    // 地面縱向地磚接縫
    ctx.strokeStyle = "rgba(45, 40, 35, 0.5)";
    ctx.lineWidth = 2;
    for (let x = w * 0.1; x < w; x += w * 0.2) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x + (x - w / 2) * 0.6, h);
      ctx.stroke();
    }

    // 地面橙色導引發光軌道線 (參考圖 1 中央三條向內延伸的亮橙色光線)
    ctx.save();
    ctx.strokeStyle = "#ff7b00";
    ctx.shadowColor = "#ff7b00";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;

    // 中央直線
    ctx.beginPath();
    ctx.moveTo(w * 0.5, groundY + 20);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();

    // 左右兩側導引斜線
    ctx.beginPath();
    ctx.moveTo(w * 0.5 - 20, groundY + 30);
    ctx.lineTo(w * 0.3, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w * 0.5 + 20, groundY + 30);
    ctx.lineTo(w * 0.7, h);
    ctx.stroke();
    ctx.restore();

    // C. 頂部木造桁架梁柱 (Timber Roof Trusses)
    ctx.fillStyle = "#5c391e";
    // 主橫梁
    ctx.fillRect(0, h * 0.08, w, 22);

    // 人字斜木支架
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#5c391e";
    for (let i = 0; i <= 4; i++) {
      const rx = (w / 4) * i;
      ctx.beginPath();
      ctx.moveTo(rx - 80, 0);
      ctx.lineTo(rx, h * 0.1);
      ctx.lineTo(rx + 80, 0);
      ctx.stroke();
    }

    // 頂部灰色大型金屬風管
    ctx.fillStyle = "#485361";
    ctx.fillRect(w * 0.62, 0, w * 0.08, h * 0.16);

    // D. 天花板懸掛計分板 (Scoreboard Hanging Display - 參考圖 1)
    const sbW = Math.min(260, w * 0.32);
    const sbH = 68;
    const sbX = w / 2 - sbW / 2;
    const sbY = h * 0.06;

    // 吊索
    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sbX + 25, 0); ctx.lineTo(sbX + 25, sbY);
    ctx.moveTo(sbX + sbW - 25, 0); ctx.lineTo(sbX + sbW - 25, sbY);
    ctx.stroke();

    // 計分板外框
    ctx.fillStyle = "#111822";
    ctx.fillRect(sbX, sbY, sbW, sbH);
    ctx.strokeStyle = "#2b3b4d";
    ctx.lineWidth = 2;
    ctx.strokeRect(sbX, sbY, sbW, sbH);

    // 計分文字
    ctx.fillStyle = "#6a8296";
    ctx.font = "bold 11px 'Chakra Petch', sans-serif";
    ctx.fillText("SCORE", sbX + 35, sbY + 22);
    ctx.fillText("BOT // 連擊", sbX + sbW - 85, sbY + 22);

    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 28px 'Chakra Petch', sans-serif";
    ctx.fillText(String(this.score).padStart(2, "0"), sbX + 32, sbY + 54);

    ctx.fillStyle = "#ffd166";
    ctx.fillText(`x${this.combo}`, sbX + sbW - 75, sbY + 54);
  }

  /**
   * 繪製前方戰術操作台與兩側直立發光燈柱 (參考圖 1 下緣視角)
   */
  renderFrontConsoleBooth(ctx) {
    const w = this.width;
    const h = this.height;
    const deskY = h - 68;

    // 黑色金屬斜面操控台
    ctx.fillStyle = "#151c24";
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h);
    ctx.lineTo(w * 0.16, deskY);
    ctx.lineTo(w * 0.84, deskY);
    ctx.lineTo(w * 0.92, h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#243242";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 操作台中央標記「開始 / 射擊訓練 / 100 HP」
    ctx.fillStyle = "rgba(0, 245, 212, 0.85)";
    ctx.font = "bold 13px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SKILL TEST // 射擊訓練", w * 0.5, deskY + 22);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Chakra Petch', 'Noto Sans TC', sans-serif";
    ctx.fillText("【 開 始 】", w * 0.5, deskY + 50);

    ctx.fillStyle = "#ff4655";
    ctx.font = "bold 14px 'Chakra Petch', sans-serif";
    ctx.fillText("100 HP", w * 0.32, deskY + 45);

    ctx.fillStyle = "#00f5d4";
    ctx.fillText("12 / 36", w * 0.68, deskY + 45);

    // 兩側長條白光 LED 燈柱 (圖 1 中兩側的垂直發光燈條)
    const drawLightColumn = (x, y, colW, colH) => {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#e6f8ff";
      ctx.shadowBlur = 15;
      ctx.fillRect(x, y, colW, colH);
      ctx.strokeStyle = "#82b2c9";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, colW, colH);
      ctx.restore();
    };

    drawLightColumn(w * 0.05, h - 140, 18, 135);
    drawLightColumn(w * 0.95 - 18, h - 140, 18, 135);
  }

  /**
   * 繪製真實第一人稱手槍與特工手套 (Valorant Classic Pistol Viewmodel)
   */
  renderFirstPersonPistol(ctx) {
    const w = this.width;
    const h = this.height;

    // 手槍基準錨點 (畫面右下角)
    const baseGunX = w * 0.72;
    const baseGunY = h + 15;

    // 計算手槍指向準星 (mouseX, mouseY) 的微幅旋轉角度
    const angleToCrosshair = Math.atan2(this.mouseY - baseGunY, this.mouseX - baseGunX);
    const clampAngle = Math.max(-0.6, Math.min(-0.15, angleToCrosshair + 0.1));

    ctx.save();
    // 應用後座力平移 (Recoil Kick)
    ctx.translate(baseGunX - this.gunRecoil * 0.4, baseGunY + this.gunRecoil * 0.6);
    ctx.rotate(clampAngle);

    // 1. 特工戰術手臂 (手臂穿戴深灰特工戰術袖子與青色發光環)
    ctx.fillStyle = "#1e2630";
    ctx.beginPath();
    ctx.moveTo(10, 50);
    ctx.lineTo(80, 180);
    ctx.lineTo(0, 190);
    ctx.lineTo(-40, 60);
    ctx.closePath();
    ctx.fill();

    // 手腕發光手環 (Cyan Glowing Wrist Ring)
    ctx.fillStyle = "#00f5d4";
    ctx.shadowColor = "#00f5d4";
    ctx.shadowBlur = 10;
    ctx.fillRect(-20, 60, 55, 8);
    ctx.shadowBlur = 0;

    // 2. 特工手套 (黑灰戰術手套包覆槍柄)
    ctx.fillStyle = "#2c3642";
    ctx.beginPath();
    ctx.roundRect(-30, -10, 65, 75, 12);
    ctx.fill();

    // 手背護甲片 (Backhand Armor)
    ctx.fillStyle = "#151b22";
    ctx.fillRect(-22, 0, 48, 30);

    // 3. 特戰英豪 Classic 手槍槍身 (高質感槍鐵金屬滑套)
    const gunSlideLength = 175;
    const gunSlideHeight = 44;

    // 槍身主滑套
    ctx.fillStyle = "#1b2129";
    ctx.beginPath();
    ctx.roundRect(-20, -52, gunSlideLength, gunSlideHeight, 4);
    ctx.fill();
    ctx.strokeStyle = "#384758";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 滑套上方金屬高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(-18, -50, gunSlideLength - 10, 4);

    // 滑套後方止滑紋路 (Slide Serrations)
    ctx.fillStyle = "#0d1116";
    for (let sx = -12; sx < 25; sx += 6) {
      ctx.fillRect(sx, -46, 2.5, 26);
    }

    // 槍身下半部與扳機護弓
    ctx.fillStyle = "#262f3a";
    ctx.fillRect(20, -12, 110, 18);

    ctx.strokeStyle = "#262f3a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(35, 2, 16, 0, Math.PI);
    ctx.stroke();

    // 槍身特戰英豪青綠色發光飾條 (Cyan Neon Light on Gun)
    ctx.fillStyle = "#00f5d4";
    ctx.shadowColor = "#00f5d4";
    ctx.shadowBlur = 8;
    ctx.fillRect(35, -34, 75, 3.5);
    ctx.shadowBlur = 0;

    // 4. 照門與準心發光點 (Luminescent Green Sights)
    ctx.fillStyle = "#39ff14";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 6;
    // 準星 (Front Sight)
    ctx.fillRect(gunSlideLength - 26, -58, 4, 7);
    // 照門 (Rear Sight)
    ctx.fillRect(-16, -57, 3, 6);
    ctx.fillRect(-6, -57, 3, 6);
    ctx.shadowBlur = 0;

    // 5. 槍口開火火光 (Muzzle Flash - 開火時瞬間閃爍)
    if (this.gunMuzzleFlash > 0) {
      const fx = gunSlideLength - 15;
      const fy = -42;

      ctx.save();
      ctx.shadowColor = "#ffaa00";
      ctx.shadowBlur = 25;

      const flashGrad = ctx.createRadialGradient(fx + 25, fy, 4, fx + 25, fy, 45);
      flashGrad.addColorStop(0, "#ffffff");
      flashGrad.addColorStop(0.3, "#ffee33");
      flashGrad.addColorStop(0.7, "#ff5500");
      flashGrad.addColorStop(1, "rgba(255, 80, 0, 0)");
      ctx.fillStyle = flashGrad;

      ctx.beginPath();
      ctx.arc(fx + 25, fy, 45, 0, Math.PI * 2);
      ctx.fill();

      // 開火星芒
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx, fy); ctx.lineTo(fx + 55, fy);
      ctx.moveTo(fx + 25, fy - 30); ctx.lineTo(fx + 25, fy + 30);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  renderTarget(ctx, t) {
    ctx.save();

    const glow = Math.sin(t.pulse) * 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius + glow, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(18, 28, 38, 0.9)";
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f5d4";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.stroke();

    // 內部同心靶心
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 70, 85, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 靶心四向刻度
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const rx1 = t.x + Math.cos(a) * (t.radius - 3);
      const ry1 = t.y + Math.sin(a) * (t.radius - 3);
      const rx2 = t.x + Math.cos(a) * (t.radius + 6);
      const ry2 = t.y + Math.sin(a) * (t.radius + 6);
      ctx.beginPath();
      ctx.moveTo(rx1, ry1);
      ctx.lineTo(rx2, ry2);
      ctx.strokeStyle = "#00f5d4";
      ctx.stroke();
    }

    // 標靶中央數字
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 8;
    ctx.fillText(t.text, t.x, t.y);

    ctx.restore();
  }

  renderTacticalCrosshair(ctx, x, y) {
    if (x <= 0 || y <= 0) return;
    ctx.save();
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 1.5;

    const gap = 6;
    const len = 12;

    ctx.beginPath();
    ctx.moveTo(x, y - gap); ctx.lineTo(x, y - gap - len);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + len);
    ctx.moveTo(x - gap, y); ctx.lineTo(x - gap - len, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + len, y);
    ctx.stroke();

    ctx.fillStyle = "#ff4655";
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

window.Level1RangeGame = Level1RangeGame;
