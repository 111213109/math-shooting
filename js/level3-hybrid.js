/**
 * level3-hybrid.js - 關卡 3：戰術綜合挑戰 (Level 1 + Level 2 混合與情境判斷)
 * 概念：因倍數與公因公倍數情境判斷口訣與生活應用混合戰術
 * 機制：情境雷達戰術卡片 + 動態無人機靶標射擊
 */

class Level3HybridGame {
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

    // 建立 4 個戰術無人機標靶 (2x2 或環形戰術矩陣)
    const positions = [
      { x: this.width * 0.25, y: this.height * 0.45 },
      { x: this.width * 0.75, y: this.height * 0.45 },
      { x: this.width * 0.35, y: this.height * 0.75 },
      { x: this.width * 0.65, y: this.height * 0.75 }
    ];

    q.options.forEach((opt, idx) => {
      const isCorrect = String(opt).trim() === String(q.answer).trim();
      const basePos = positions[idx] || { x: this.width * 0.5, y: this.height * 0.5 };

      this.targets.push({
        text: String(opt),
        isCorrect: isCorrect,
        x: basePos.x,
        y: basePos.y,
        originX: basePos.x,
        originY: basePos.y,
        radius: 50,
        floatAngle: Math.random() * Math.PI * 2,
        destroyed: false
      });
    });
  }

  handleShoot(x, y) {
    if (!this.active || this.paused || this.transitioning) return;
    // One feedback sound is played after the hit result is known.

    this.gunRecoil = 32;
    this.gunMuzzleFlash = 5;

    let hit = false;
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (t.destroyed) continue;

      const dist = Math.hypot(x - t.x, y - t.y);
      if (dist <= t.radius) {
        hit = true;
        this.processTargetHit(t);
        break;
      }
    }

    if (!hit) {
      window.Sound.playMiss();
      this.createSparks(x, y, "#768079", 5);
    }
  }

  processTargetHit(target) {
    const currentQ = this.questions[this.currentQIndex];

    if (target.isCorrect) {
      this.transitioning = true;
      this.solved += 1;
      if (!this.questionHadError) this.firstTryCorrect += 1;
      this.combo += 1;
      window.Sound.playKill(this.combo);

      const points = 25 + Math.min(10, this.combo * 2);
      this.score += points;

      this.createSparks(target.x, target.y, "#ffd166", 35);
      this.addFloatingText(`CRITICAL HIT! +${points}`, target.x, target.y - 20, "#ffd166");
      this.showKillBanner(`TACTICAL SUCCESS! COMBO x${this.combo}`);

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
      this.addFloatingText("DECISION FAILED! 判斷錯誤", target.x, target.y - 20, "#ff4655");

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

  createSparks(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 3,
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
        level: 3,
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
    // 懸浮無人機小幅呼吸晃動
    this.targets.forEach(t => {
      if (t.destroyed) return;
      t.floatAngle += 0.04;
      t.x = t.originX + Math.cos(t.floatAngle) * 15;
      t.y = t.originY + Math.sin(t.floatAngle * 1.3) * 12;
    });

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 1 / p.life;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    this.gunRecoil *= 0.82;
    if (this.gunMuzzleFlash > 0) this.gunMuzzleFlash--;
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 戰術情境挑戰背景 (高科技戰情室風格)
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 80,
      this.width / 2, this.height / 2, this.width
    );
    grad.addColorStop(0, "#101924");
    grad.addColorStop(1, "#080c10");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 戰情環形圖標
    ctx.strokeStyle = "rgba(255, 209, 102, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.width / 2, this.height / 2, 180, 0, Math.PI * 2);
    ctx.stroke();

    // 繪製目標無人機
    this.targets.forEach(t => {
      if (t.destroyed) return;
      this.renderDroneTarget(ctx, t);
    });

    // 粒子
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 浮動文字
    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = "bold 22px 'Chakra Petch', sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 12;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // 繪製真實第一人稱特工手槍
    this.renderFirstPersonPistol(ctx);

    // 準心
    this.renderTacticalCrosshair(ctx, this.mouseX, this.mouseY);
  }

  renderFirstPersonPistol(ctx) {
    const w = this.width;
    const h = this.height;
    const baseGunX = w * 0.72;
    const baseGunY = h + 15;
    const angleToCrosshair = Math.atan2(this.mouseY - baseGunY, this.mouseX - baseGunX);
    const clampAngle = Math.max(-0.6, Math.min(-0.15, angleToCrosshair + 0.1));

    ctx.save();
    ctx.translate(baseGunX - this.gunRecoil * 0.4, baseGunY + this.gunRecoil * 0.6);
    ctx.rotate(clampAngle);

    // 特工戰術手臂
    ctx.fillStyle = "#1e2630";
    ctx.beginPath();
    ctx.moveTo(10, 50); ctx.lineTo(80, 180); ctx.lineTo(0, 190); ctx.lineTo(-40, 60);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 8;
    ctx.fillRect(-20, 60, 55, 8);
    ctx.shadowBlur = 0;

    // 手套
    ctx.fillStyle = "#2c3642";
    ctx.beginPath();
    ctx.roundRect(-30, -10, 65, 75, 12);
    ctx.fill();

    // 手槍滑套
    const gunSlideLength = 175;
    ctx.fillStyle = "#1b2129";
    ctx.beginPath();
    ctx.roundRect(-20, -52, gunSlideLength, 44, 4);
    ctx.fill();
    ctx.strokeStyle = "#506277";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 能量飾條
    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 8;
    ctx.fillRect(35, -34, 75, 3.5);
    ctx.shadowBlur = 0;

    // 照門與準星
    ctx.fillStyle = "#39ff14";
    ctx.fillRect(gunSlideLength - 26, -58, 4, 7);
    ctx.fillRect(-16, -57, 3, 6);
    ctx.fillRect(-6, -57, 3, 6);

    // 槍口火光
    if (this.gunMuzzleFlash > 0) {
      const fx = gunSlideLength - 15;
      const fy = -42;
      ctx.save();
      const flashGrad = ctx.createRadialGradient(fx + 25, fy, 4, fx + 25, fy, 45);
      flashGrad.addColorStop(0, "#ffffff");
      flashGrad.addColorStop(0.3, "#ffee33");
      flashGrad.addColorStop(0.7, "#ff5500");
      flashGrad.addColorStop(1, "rgba(255, 80, 0, 0)");
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(fx + 25, fy, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  renderDroneTarget(ctx, t) {
    ctx.save();

    // 六角戰術盾形靶面
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = t.x + Math.cos(angle) * t.radius;
      const y = t.y + Math.sin(angle) * t.radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.fillStyle = "rgba(18, 28, 38, 0.9)";
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.stroke();

    // 文字
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px 'Chakra Petch', 'Noto Sans TC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;
    ctx.fillText(t.text, t.x, t.y);

    ctx.restore();
  }

  renderTacticalCrosshair(ctx, x, y) {
    if (x <= 0 || y <= 0) return;
    ctx.save();
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 1.5;

    const gap = 8;
    const len = 14;
    ctx.beginPath();
    ctx.moveTo(x, y - gap); ctx.lineTo(x, y - gap - len);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + len);
    ctx.moveTo(x - gap, y); ctx.lineTo(x - gap - len, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + len, y);
    ctx.stroke();

    ctx.fillStyle = "#ff4655";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

window.Level3HybridGame = Level3HybridGame;
