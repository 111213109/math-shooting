/**
 * level2-3d.js - 關卡 2：3D 特戰英豪真實靶場與殭屍防衛戰 (Three.js Realistic Valorant Range & PvZ-Style Zombies)
 * 特色：
 * 1. 真實特戰英豪靶場地圖（原汁原味木造桁架屋頂、天花板掛式計分板、地面發光橙色導引軌道、前方指揮操作台與雙側垂直燈柱）
 * 2. 真實第一人稱特工持槍視角（特戰經典手槍 Classic + 戰術手套持槍手腕、武器晃動 Sway、後座力抬槍 Recoil、開火槍口火光 Muzzle Flash）
 * 3. 忠實參考 PvZ 經典特徵生動殭屍（綠皮大頭、不對稱凸眼珠、暴牙張嘴、破爛咖啡色西裝與紅領帶、殘破褲子、滑稽跛行步伐）
 * 4. 戰術雷達小地圖 (Minimap) 即時偵測殭屍推進距離
 */

class Level2ZombieGame {
  constructor(canvasContainer, onScoreUpdate, onWrongAnswer, onLevelComplete) {
    this.container = canvasContainer;
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
    this.barrierHp = 100;
    this.wrongQuestionIds = [];

    // Three.js 核心組件
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = null;
    this.mouse = null;
    this.clock = null;

    // 物件群
    this.zombies = [];
    this.labelLayer = null;
    this.sparks = [];
    this.shells = [];

    // 第一人稱武器與手臂
    this.weaponGroup = null;
    this.weaponRecoil = 0;
    this.weaponRecoilRot = 0;
    this.muzzleFlashSprite = null;
    this.muzzleLight = null;

    // 動態計分板與雷達
    this.overheadScoreboardTexture = null;
    this.radarCanvas = document.getElementById("radarCanvas");
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext("2d") : null;

    this.yaw = 0;
    this.pitch = -0.007;
    this.dragAim = false;
    this.aimReady = false;
    this.lastShotTime = 0;
    this.pointerWasLocked = false;
    this.aimKick = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.animationId = null;

    try {
      this.initThree();
      this.bindEvents();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  initThree() {
    if (typeof THREE === "undefined") {
      console.error("Three.js 尚未載入！");
      return;
    }

    const width = this.container.clientWidth || 900;
    const height = this.container.clientHeight || 550;

    // 1. 場景配置
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1612); // 特戰靶場溫潤暖色調陰影
    this.scene.fog = new THREE.FogExp2(0x1a1612, 0.018);

    // 2. 相機 (第一人稱真實特工視角)
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    this.camera.position.set(0, 3.2, 14.5);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.scene.add(this.camera);

    // 3. 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 清除舊畫布
    const oldCanvas = this.container.querySelector("canvas#gameCanvas3D");
    if (oldCanvas) oldCanvas.remove();

    this.renderer.domElement.id = "gameCanvas3D";
    this.container.appendChild(this.renderer.domElement);
    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "target-label-layer";
    this.container.appendChild(this.labelLayer);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clock = new THREE.Clock();

    // 4. 構建特戰英豪真實訓練靶場地圖
    this.buildValorantRangeMap();

    // 5. 構建第一人稱真實手槍與特工手套
    this.buildFirstPersonWeapon();
  }

  /**
   * 構建特戰英豪真實訓練靶場內部環境 (參考圖片 1)
   */
  buildValorantRangeMap() {
    // ---- A. 照明系統 (暖木天花板射燈 + 特戰英豪戰術青綠光) ----
    const ambientLight = new THREE.AmbientLight(0xf4ebd9, 0.9);
    this.scene.add(ambientLight);

    const mainSun = new THREE.DirectionalLight(0xfff1dc, 1.4);
    mainSun.position.set(15, 30, 20);
    mainSun.castShadow = true;
    this.scene.add(mainSun);

    const blueBacklight = new THREE.DirectionalLight(0x00f5d4, 0.4);
    blueBacklight.position.set(-15, 10, -25);
    this.scene.add(blueBacklight);

    // ---- B. 地面 (混凝土靶場地板 + 橙黃色戰術導引光軌) ----
    const floorGeo = new THREE.PlaneGeometry(50, 70);
    const floorTexture = this.createConcreteFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.75,
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -10);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 地面中心橙色導引發光條 (參考圖 1 中的瞄準感度橙色光軌)
    const orangeLineMat = new THREE.MeshBasicMaterial({ color: 0xff7b00 });
    const lineCenter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 38), orangeLineMat);
    lineCenter.position.set(0, 0.02, -5);
    this.scene.add(lineCenter);

    const lineLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 34), orangeLineMat);
    lineLeft.position.set(-4.5, 0.02, -5);
    lineLeft.rotation.y = -0.06;
    this.scene.add(lineLeft);

    const lineRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 34), orangeLineMat);
    lineRight.position.set(4.5, 0.02, -5);
    lineRight.rotation.y = 0.06;
    this.scene.add(lineRight);

    // ---- C. 遠處後牆與兩側石木結構牆 ----
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xbaa48e,
      roughness: 0.9
    });

    // 後牆
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(50, 18, 2), wallMat);
    backWall.position.set(0, 9, window.Game.currentLevel === 2 ? -42 : -64);
    this.scene.add(backWall);

    // 後牆靶位木板標記 (參考圖 1 中的兩塊長方木板)
    const woodBoardMat = new THREE.MeshStandardMaterial({ color: 0x8a5d3b, roughness: 0.7 });
    const board1 = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 0.3), woodBoardMat);
    board1.position.set(-6, 8, window.Game.currentLevel === 2 ? -40.8 : -62.8);
    this.scene.add(board1);

    const board2 = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 0.3), woodBoardMat);
    board2.position.set(6, 8, window.Game.currentLevel === 2 ? -40.8 : -62.8);
    this.scene.add(board2);

    // 左右側牆
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(2, 18, 70), wallMat);
    leftWall.position.set(-25, 9, -10);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(2, 18, 70), wallMat);
    rightWall.position.set(25, 9, -10);
    this.scene.add(rightWall);

    // ---- D. 天花板原木桁架梁與大型通風管道 (Timber Roof Trusses) ----
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x6e4526, roughness: 0.7 });
    for (let z = -35; z <= 12; z += 11) {
      // 橫梁
      const beam = new THREE.Mesh(new THREE.BoxGeometry(50, 1.2, 1.2), timberMat);
      beam.position.set(0, 15, z);
      this.scene.add(beam);

      // 斜支撐木桁架
      const braceL = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 0.8), timberMat);
      braceL.position.set(-16, 12.5, z);
      braceL.rotation.z = -Math.PI / 4;
      this.scene.add(braceL);

      const braceR = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 0.8), timberMat);
      braceR.position.set(16, 12.5, z);
      braceR.rotation.z = Math.PI / 4;
      this.scene.add(braceR);
    }

    // 吊掛天花板大型金屬通風管 (參考圖 1 頂部灰色金屬管)
    const ductMat = new THREE.MeshStandardMaterial({ color: 0x4a5563, metalness: 0.6, roughness: 0.4 });
    const ventDuct = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 16), ductMat);
    ventDuct.rotation.x = Math.PI / 2;
    ventDuct.position.set(8, 14.2, -10);
    this.scene.add(ventDuct);

    // ---- E. 天花板中央懸吊電子計分板 (Scoreboard Hanging Display) ----
    const scoreboardGroup = this.createOverheadScoreboard();
    scoreboardGroup.position.set(0, 10.8, -18);
    this.scene.add(scoreboardGroup);

    // ---- F. 玩家前方操作台與雙側戰術直立燈柱 (Console Booth Table) ----
    // 恰如圖 1 視角下緣之操控台與兩側發光燈板
    const consoleGroup = this.createFrontConsoleBooth();
    consoleGroup.position.set(0, 1.2, 12.6);
    this.scene.add(consoleGroup);

    // 側邊軍用裝備箱與彈藥箱
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3d4b3b, roughness: 0.6 });
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), crateMat);
    crate1.position.set(-18, 1.25, -20);
    this.scene.add(crate1);

    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 2.5), crateMat);
    crate2.position.set(18, 1, -15);
    this.scene.add(crate2);
  }

  /**
   * 建立前置操作台與兩側特戰英豪直立燈柱 (參考圖 1)
   */
  createFrontConsoleBooth() {
    const group = new THREE.Group();

    // 黑色金屬斜面操控台
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1a212b, metalness: 0.8, roughness: 0.25 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 2.2), tableMat);
    table.position.set(0, 0, 0);
    table.rotation.x = -0.15;
    group.add(table);

    // 台面戰術介面貼圖 (標示「開始 / 射擊訓練」)
    const screenTexture = this.createConsoleScreenTexture();
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.4), screenMat);
    screen.position.set(0, 0.45, 1.05);
    screen.rotation.x = -0.55;
    group.add(screen);

    // 兩側長條高亮 LED 燈柱 (圖 1 中兩側的明亮白/青垂直燈箱)
    const lightBarGeo = new THREE.BoxGeometry(0.35, 3.2, 0.35);
    const lightBarMat = new THREE.MeshBasicMaterial({ color: 0xecf8ff });

    const leftLight = new THREE.Mesh(lightBarGeo, lightBarMat);
    leftLight.position.set(-6.5, 0.8, 0.8);
    group.add(leftLight);

    const rightLight = new THREE.Mesh(lightBarGeo, lightBarMat);
    rightLight.position.set(6.5, 0.8, 0.8);
    group.add(rightLight);

    return group;
  }

  /**
   * 懸掛式天花板計分顯示板 (參考圖 1 頂部顯示幕)
   */
  createOverheadScoreboard() {
    const group = new THREE.Group();

    // 鋼索吊掛
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const cableL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5), cableMat);
    cableL.position.set(-4, 3, 0);
    group.add(cableL);

    const cableR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5), cableMat);
    cableR.position.set(4, 3, 0);
    group.add(cableR);

    // 顯示板主體框
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x11161d, metalness: 0.9, roughness: 0.2 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.6, 0.5), frameMat);
    group.add(frame);

    // 顯示螢幕畫布貼圖
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0c141d";
    ctx.fillRect(0, 0, 512, 140);
    ctx.strokeStyle = "#32495d";
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 132);

    ctx.fillStyle = "#73889b";
    ctx.font = "bold 20px 'Chakra Petch', sans-serif";
    ctx.fillText("SCORE // 戰術積分", 40, 40);
    ctx.fillText("STREAK // 連擊次數", 300, 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px sans-serif";

    ctx.fillText("00", 90, 110);
    ctx.fillText("x0", 350, 110);

    this.scoreboardCanvas = canvas;
    this.scoreboardCtx = ctx;
    this.overheadScoreboardTexture = new THREE.CanvasTexture(canvas);

    const screenMat = new THREE.MeshBasicMaterial({ map: this.overheadScoreboardTexture });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 2.2), screenMat);
    screen.position.set(0, 0, 0.28);
    group.add(screen);

    return group;
  }

  updateScoreboard(score, streak) {
    if (!this.scoreboardCtx || !this.overheadScoreboardTexture) return;
    const ctx = this.scoreboardCtx;

    ctx.fillStyle = "#0c141d";
    ctx.fillRect(0, 0, 512, 140);
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 132);

    ctx.fillStyle = "#73889b";
    ctx.font = "bold 20px 'Chakra Petch', sans-serif";
    ctx.fillText("SCORE // 戰術積分", 40, 40);
    ctx.fillText("STREAK // 連擊次數", 300, 40);

    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 60px 'Chakra Petch', sans-serif";
    const sStr = String(score).padStart(2, "0");
    ctx.fillText(sStr, 70, 108);

    ctx.fillStyle = "#ffd166";
    ctx.fillText(`x${streak}`, 340, 108);

    this.overheadScoreboardTexture.needsUpdate = true;
  }

  /**
   * 建立真實第一人稱手槍 (Valorant Classic Pistol) 與特工戰術手套持槍手臂
   */
  buildFirstPersonWeapon() {
    this.weaponGroup = new THREE.Group();

    // 1. 槍身滑套 (Pistol Slide - 槍鐵深灰高反光)
    const slideMat = new THREE.MeshStandardMaterial({
      color: 0x1b2028,
      metalness: 0.85,
      roughness: 0.25
    });
    const slide = new THREE.Mesh(this.softBox(0.18, 0.18, 0.85), slideMat);
    this.slideMesh = slide;
    slide.position.set(0, 0.08, 0);
    this.weaponGroup.add(slide);

    // 頂部照門與準星 (Iron Sights with Glowing Dots)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.04), dotMat);
    frontSight.position.set(0, 0.18, -0.4);
    this.weaponGroup.add(frontSight);

    const rearSightL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.03), dotMat);
    rearSightL.position.set(-0.04, 0.175, 0.38);
    const rearSightR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.03), dotMat);
    rearSightR.position.set(0.04, 0.175, 0.38);
    this.weaponGroup.add(rearSightL);
    this.weaponGroup.add(rearSightR);

    // 槍口開口 (Muzzle Opening)
    const barrelHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12),
      new THREE.MeshBasicMaterial({ color: 0x050505 })
    );
    barrelHole.rotation.x = Math.PI / 2;
    barrelHole.position.set(0, 0.08, -0.43);
    this.weaponGroup.add(barrelHole);

    // 2. 下槍身與扳機護弓 (Lower Frame & Trigger Guard)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x242d38, roughness: 0.5 });
    const lowerFrame = new THREE.Mesh(this.softBox(0.16, 0.12, 0.75), frameMat);
    lowerFrame.position.set(0, -0.04, -0.02);
    this.weaponGroup.add(lowerFrame);

    const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.18), frameMat);
    triggerGuard.position.set(0, -0.12, 0.02);
    this.weaponGroup.add(triggerGuard);

    // 3. 握把 (Pistol Grip)
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x12171e, roughness: 0.8 });
    const grip = new THREE.Mesh(this.softBox(0.15, 0.42, 0.22), gripMat);
    grip.position.set(0, -0.22, 0.22);
    grip.rotation.x = 0.22;
    this.weaponGroup.add(grip);

    // 4. 特戰英豪能量光條細節 (Cyan Neon Circuit on Pistol)
    const energyStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.125, 0.02, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
    );
    energyStripe.position.set(0, 0.02, -0.05);
    this.weaponGroup.add(energyStripe);

    const blackMetal = new THREE.MeshStandardMaterial({color:0x10151c,metalness:.7,roughness:.35});
    const steel = new THREE.MeshStandardMaterial({color:0x78848e,metalness:.88,roughness:.28});
    // Serrated rear slide, ejection port, textured grip and actual open trigger guard.
    for (let side of [-1,1]) {
      for (let i=0;i<7;i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(.006,.14,.011),steel);
        rib.position.set(side*.093,.08,.12+i*.032); this.weaponGroup.add(rib);
      }
      for (let i=0;i<8;i++) {
        const gripRib = new THREE.Mesh(this.softBox(.156,.012,.18),blackMetal);
        gripRib.position.set(0,-.13-i*.035,.24); gripRib.rotation.x=.22; this.weaponGroup.add(gripRib);
      }
    }
    const port = new THREE.Mesh(this.softBox(.008,.06,.16),blackMetal);
    port.position.set(.094,.11,-.08); this.weaponGroup.add(port);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.028,.028,.88,20),steel);
    barrel.rotation.x=Math.PI/2; barrel.position.set(0,.064,-.035); this.weaponGroup.add(barrel);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(.1,.015,8,24),blackMetal);
    guard.rotation.y=Math.PI/2; guard.scale.set(1,.8,1); guard.position.set(0,-.13,-.06); this.weaponGroup.add(guard);
    triggerGuard.visible=false;
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(.022,.075,.025),steel);
    trigger.position.set(0,-.115,-.02); trigger.rotation.x=-.3; this.weaponGroup.add(trigger);
    const magPlate = new THREE.Mesh(this.softBox(.17,.035,.24),blackMetal);
    magPlate.position.set(0,-.44,.25); magPlate.rotation.x=.22; this.weaponGroup.add(magPlate);

    // 5. 特工戰術手套持槍手臂 (Tactical Gloved Hand & Arm) - 忠實參考圖 1 手腕與手套
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x2a333d, roughness: 0.65 });
    const armorPadMat = new THREE.MeshStandardMaterial({ color: 0x141a21, roughness: 0.4 });
    const cyanStripeMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });

    // 手掌手背
    const hand = new THREE.Mesh(this.softBox(0.18, 0.22, 0.32), gloveMat);
    hand.position.set(0.04, -0.2, 0.25);
    this.weaponGroup.add(hand);

    // 手背護甲片 (Backhand Armor Pad)
    const handArmor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.2), armorPadMat);
    handArmor.position.set(0.04, -0.09, 0.26);
    this.weaponGroup.add(handArmor);

    // 手套手指握拳握住槍把
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.12), gloveMat);
    fingers.position.set(-0.06, -0.22, 0.16);
    fingers.rotation.x = 0.22;
    fingers.visible = false;
    for(let i=0;i<4;i++) {
      const finger = new THREE.Mesh(this.softBox(.095,.054,.16),gloveMat);
      finger.position.set(-.045,-.14-i*.065,.175); finger.rotation.x=.22;
      this.weaponGroup.add(finger);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(.032,10,8),armorPadMat);
      knuckle.position.set(-.094,-.14-i*.065,.24); this.weaponGroup.add(knuckle);
    }

    // 手腕護腕與青綠色戰術發光手環 (Wristband with Cyan Stripe)
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 16), gloveMat);
    forearm.position.set(0.12, -0.48, 0.62);
    forearm.rotation.x = -0.55;
    forearm.rotation.z = -0.15;
    this.weaponGroup.add(forearm);

    const wristCyanRing = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.175, 0.05, 16), cyanStripeMat);
    wristCyanRing.position.set(0.1, -0.38, 0.52);
    wristCyanRing.rotation.x = -0.55;
    wristCyanRing.rotation.z = -0.15;
    this.weaponGroup.add(wristCyanRing);

    // 6. 槍口開火火光 (Muzzle Flash Sprite & PointLight)
    this.muzzleFlashSprite = this.createMuzzleFlashSprite();
    this.muzzleFlashSprite.position.set(0, 0.08, -0.65);
    this.muzzleFlashSprite.visible = false;
    this.weaponGroup.add(this.muzzleFlashSprite);

    this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 10);
    this.muzzleLight.position.set(0, 0.08, -0.6);
    this.weaponGroup.add(this.muzzleLight);

    // 7. 將武器掛接於第一人稱相機下 (維持真實右下角特戰英豪持槍姿態)
    this.weaponGroup.position.set(0.42, -0.32, -0.72);
    this.weaponGroup.rotation.set(-0.04, 0.06, -0.03);
    this.camera.add(this.weaponGroup);
  }

  createMuzzleFlashSprite() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, "#ffee55");
    grad.addColorStop(0.7, "#ff5500");
    grad.addColorStop(1, "rgba(255, 80, 0, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    // 十字火星星芒
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(60, 10, 8, 108);
    ctx.fillRect(10, 60, 108, 8);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.65, 0.65, 1);
    return sprite;
  }

  createConcreteFloorTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#55524d";
    ctx.fillRect(0, 0, 512, 512);

    // 混凝土斑駁雜訊與地磚板塊接縫
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    for (let i = 0; i < 4000; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    ctx.strokeStyle = "rgba(40, 38, 35, 0.4)";
    ctx.lineWidth = 3;
    for (let x = 0; x <= 512; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 128) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 6);
    return tex;
  }

  createConsoleScreenTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#16202c";
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 500, 116);

    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 20px 'Chakra Petch', sans-serif";
    ctx.fillText("SKILL TEST // 射擊訓練", 20, 36);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px 'Chakra Petch', sans-serif";
    ctx.fillText("[ 開 始 ]", 180, 88);

    ctx.fillStyle = "#ff4655";
    ctx.font = "bold 18px 'Chakra Petch', sans-serif";
    ctx.fillText("100 HP", 30, 95);
    ctx.fillText("12 / 36", 420, 95);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * 忠實參考 PvZ 經典特徵生動殭屍 (參考圖片 2)
   * 綠皮大頭、滑稽大小凸眼、暴牙大嘴、破舊棕西裝與紅色領帶、殘破長褲
   */
  createPvZStyleZombie(numberText, isCorrect) {
    const group = new THREE.Group();

    // 殭屍特徵色票
    const greenSkinMat = new THREE.MeshStandardMaterial({ color: 0x7da560, roughness: 0.8 });
    const brownSuitMat = new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.9 });
    const whiteShirtMat = new THREE.MeshStandardMaterial({ color: 0xe0dacb });
    const redTieMat = new THREE.MeshStandardMaterial({ color: 0xd93829 });
    const bluePantsMat = new THREE.MeshStandardMaterial({ color: 0x2e3d4d });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2a1a14 });

    // 1. 軀幹 (破爛棕色西裝外套)
    const torso = new THREE.Mesh(this.softBox(1.4, 1.8, 0.9), brownSuitMat);
    torso.position.y = 2.1;
    group.add(torso);

    // 露出白色襯衫胸口與領口
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.1), whiteShirtMat);
    shirt.position.set(0, 2.3, 0.46);
    group.add(shirt);

    // 紅色小領帶 (PvZ 招牌紅領帶，前飄懸垂)
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.08), redTieMat);
    tie.position.set(0, 2.1, 0.52);
    tie.rotation.x = 0.1;
    group.add(tie);

    // 2. PvZ 經典綠皮大頭 (大頭、微向前傾)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 3.4, 0.1);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(.83,28,20), greenSkinMat);
    headMesh.scale.set(.84,.96,.85);
    headGroup.add(headMesh);

    // 眼睛 1 (左邊大凸眼珠，黃白眼球 + 黑色細小瞳孔，略呈鬥雞眼滑稽神態)
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xfffde8 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), eyeWhiteMat);
    eyeL.position.set(-0.35, 0.16, 0.68);
    headGroup.add(eyeL);

    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pupilMat);
    pupilL.position.set(-0.32, 0.18, 0.9);
    headGroup.add(pupilL);

    // 眼睛 2 (右邊稍小凸眼珠，經典 PvZ 大小眼)
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 16), eyeWhiteMat);
    eyeR.position.set(0.36, 0.12, 0.66);
    headGroup.add(eyeR);

    const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), pupilMat);
    pupilR.position.set(0.34, 0.08, 0.84);
    headGroup.add(pupilR);

    // 大嘴巴與外露的歪斜黃白色暴牙 (Gaping Mouth & Crooked Teeth)
    const mouthCavity = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 0.2), new THREE.MeshBasicMaterial({ color: 0x1c0b0b }));
    mouthCavity.position.set(0, -0.35, 0.62);
    headGroup.add(mouthCavity);

    // 歪牙齒
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.08), toothMat);
    tooth1.position.set(-0.2, -0.28, 0.68);
    headGroup.add(tooth1);

    const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), toothMat);
    tooth2.position.set(0.16, -0.28, 0.68);
    headGroup.add(tooth2);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),greenSkinMat);
    nose.scale.set(.7,1.15,1.2);nose.position.set(.015,-.035,.73);headGroup.add(nose);
    const eyebrowMat=new THREE.MeshStandardMaterial({color:0x486343,roughness:.9});
    [-1,1].forEach(side => {
      const brow=new THREE.Mesh(this.softBox(.4,.09,.1),eyebrowMat);
      brow.position.set(side*.35,.44,.64);brow.rotation.z=side*.13;headGroup.add(brow);
      const cheek=new THREE.Mesh(new THREE.SphereGeometry(.14,12,10),greenSkinMat);
      cheek.scale.set(1,.65,.45);cheek.position.set(side*.44,-.21,.67);headGroup.add(cheek);
      const lapel=new THREE.Mesh(this.softBox(.19,.8,.08),brownSuitMat);
      lapel.position.set(side*.38,2.46,.5);lapel.rotation.z=side*.3;group.add(lapel);
      for(let i=0;i<4;i++) {
        const finger=new THREE.Mesh(this.softBox(.058,.065,.32),greenSkinMat);
        finger.position.set(side*.95+(i-1.5)*.074,2.38,1.76);finger.rotation.x=.12;group.add(finger);
      }
    });
    for(let i=0;i<3;i++) {
      const button=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),shoeMat);
      button.position.set(.15,1.9+i*.22,.535);group.add(button);
    }
    const stitches=new THREE.MeshStandardMaterial({color:0x9daf77,roughness:1});
    for(let i=0;i<4;i++) {
      const stitch=new THREE.Mesh(new THREE.BoxGeometry(.075,.025,.015),stitches);
      stitch.position.set(-.5+i*.035,.35-i*.07,.63);stitch.rotation.z=.45;headGroup.add(stitch);
    }
    group.add(headGroup);

    // 3. 雙臂伸向前方 (典型殭屍撲人姿態)
    const armL = new THREE.Mesh(this.softBox(0.32, 0.32, 1.5), brownSuitMat);
    armL.position.set(-0.95, 2.4, 0.75);
    armL.rotation.x = 0.08;
    group.add(armL);

    // 綠色手掌露出
    const handL = new THREE.Mesh(this.softBox(0.34, 0.28, 0.35), greenSkinMat);
    handL.position.set(-0.95, 2.4, 1.55);
    group.add(handL);

    const armR = new THREE.Mesh(this.softBox(0.32, 0.32, 1.5), brownSuitMat);
    armR.position.set(0.95, 2.3, 0.75);
    armR.rotation.x = -0.05;
    group.add(armR);

    const handR = new THREE.Mesh(this.softBox(0.34, 0.28, 0.35), greenSkinMat);
    handR.position.set(0.95, 2.3, 1.55);
    group.add(handR);

    // 4. 雙腿 (殘破深藍長褲，一腳露綠膝蓋)
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.3, 0.45), bluePantsMat);
    legL.position.set(-0.4, 0.65, 0);
    group.add(legL);

    const shoeL = new THREE.Mesh(this.softBox(0.5, 0.3, 0.75), shoeMat);
    shoeL.position.set(-0.4, 0.15, 0.1);
    group.add(shoeL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.3, 0.45), bluePantsMat);
    legR.position.set(0.4, 0.65, 0);
    group.add(legR);

    // 右膝蓋破損處露出的綠色膝蓋 (PvZ 特色破洞)
    const kneeGreen = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.25, 0.46), greenSkinMat);
    kneeGreen.position.set(0.4, 0.65, 0);
    group.add(kneeGreen);

    const shoeR = new THREE.Mesh(this.softBox(0.5, 0.3, 0.75), shoeMat);
    shoeR.position.set(0.4, 0.15, 0.1);
    group.add(shoeR);

    // 5. 頭頂 3D 浮動戰術數值看板 (清晰明瞭的大字標靶看板)
    const badgeSprite = this.createPvZNumberBadgeSprite(numberText);
    badgeSprite.position.set(0, 4.8, 0);
    group.add(badgeSprite);

    // 6. 射擊判定碰撞箱 (HitBox)
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 6.5, 2.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.y = 2.8;
    group.add(hitBox);

    return {
      mesh: group,
      hitBox: hitBox,
      headGroup: headGroup,
      badge: badgeSprite,
      labelHeight: 5.2,
      numberText: numberText,
      isCorrect: isCorrect,
      legL,
      legR,
      armL,
      armR,
      walkPhase: Math.random() * Math.PI * 2,
      alive: true
    };
  }

  createPvZNumberBadgeSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 560;
    const ctx = canvas.getContext("2d");
    ctx.scale(4,4);

    // 特戰青色發光戰術外框
    ctx.fillStyle = "rgba(12, 20, 28, 0.92)";
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 6;
    ctx.shadowColor = "#00f5d4";
    ctx.shadowBlur = 0;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(8, 8, 240, 124, 18);
    } else {
      ctx.rect(8, 8, 240, 124);
    }
    ctx.fill();
    ctx.stroke();

    // 靶心角標
    ctx.strokeStyle = "#ff4655";
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, 20, 20);
    ctx.strokeRect(218, 18, 20, 20);

    // 數值
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px sans-serif";
    const badgeSize = Math.min(64, 64 * 210 / Math.max(1, ctx.measureText(String(text)).width));
    ctx.font = `bold ${badgeSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00f5d4";
    ctx.shadowBlur = 0;
    ctx.fillText(text, 128, 70);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped:false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4.2, 2.1, 1);
    return sprite;
  }

  softBox(w,h,d) {
    const bevel = Math.min(w,h,d)*.12;
    const shape = new THREE.Shape();
    const x=w/2-bevel,y=h/2-bevel;
    shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:d-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1});
    geometry.translate(0,0,-d/2+bevel);geometry.computeVertexNormals();return geometry;
  }

  createTrainingDrone(text,isCorrect) {
    const mesh=new THREE.Group();
    const frame=new THREE.MeshStandardMaterial({color:0x233b50,metalness:.75,roughness:.35});
    const accent=new THREE.MeshBasicMaterial({color:window.Game.currentLevel===3?0xffd166:0x55e5d2});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,.075,10,48),accent);
    ring.position.y=2.7;mesh.add(ring);
    const core=new THREE.Mesh(this.softBox(1.5,1.3,.35),frame);core.position.y=2.7;mesh.add(core);
    const badge=this.createPvZNumberBadgeSprite(text);badge.position.set(0,2.75,.28);badge.scale.set(3.5,1.75,1);mesh.add(badge);
    for(let side of [-1,1]) {
      const wing=new THREE.Mesh(this.softBox(.65,.14,.4),frame);wing.position.set(side*1.35,2.7,0);mesh.add(wing);
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),accent);lamp.position.set(side*1.5,2.7,.25);mesh.add(lamp);
    }
    const hitBox=new THREE.Mesh(new THREE.BoxGeometry(4.2,3.8,1.5),new THREE.MeshBasicMaterial({visible:false}));hitBox.position.y=2.7;mesh.add(hitBox);
    return {mesh,hitBox,ring,badge,labelHeight:2.75,drone:true,numberText:text,isCorrect,alive:true,walkPhase:Math.random()*6};
  }

  ejectShell() {
    if(!this.weaponGroup) return;
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.04,8),new THREE.MeshStandardMaterial({color:0xd7af62,metalness:.85,roughness:.3}));
    this.weaponGroup.localToWorld(shell.position.set(.13,.14,.05));
    const velocity=new THREE.Vector3(1.7,1.8,.3).applyQuaternion(this.camera.quaternion);
    this.scene.add(shell);this.shells.push({mesh:shell,velocity,life:1.1});
  }

  captureAim() {
    if (!this.active || this.paused) return;
    if (window.Game.touchDevice) { this.enableDragAim(); return; }
    this.dragAim = false;
    const canvas = this.renderer.domElement;
    if (!canvas.requestPointerLock) { this.enableDragAim(); return; }
    try {
      const request = canvas.requestPointerLock();
      request?.catch(() => this.enableDragAim());
    } catch (e) { this.enableDragAim(); }
  }

  enableDragAim() {
    this.dragAim = true;
    this.aimReady = true;
    document.getElementById("aimOverlay").classList.remove("active");
    document.getElementById("fpsCrosshair").style.display = "block";
    document.getElementById("controlHint").textContent = window.Game.touchDevice ? "拖曳畫面瞄準 · 右下角開火 · 可橫向遊玩" : "右鍵拖曳轉動視角 · 左鍵射擊中央準星";
  }

  turnView(dx, dy) {
    if (!this.active || this.paused) return;
    const sensitivity = Number(document.getElementById("aimSensitivity").value || 2) * 0.001;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -1.15, 1.15);
    this.swayX = THREE.MathUtils.clamp(dx * .001, -.09, .09);
    this.swayY = THREE.MathUtils.clamp(dy * .001, -.08, .08);
    // Update before raycasting; camera children (weapon) follow this rotation.
    this.camera.rotation.set(this.pitch + this.aimKick, this.yaw, 0, "YXZ");
    this.camera.updateMatrixWorld(true);
  }

  bindEvents() {
    this.session.listen(window, "resize", () => {
      if (!this.active || !this.renderer) return;
      const width = this.container.clientWidth, height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    this.session.listen(document, "pointerlockchange", () => {
      const locked = this.renderer && document.pointerLockElement === this.renderer.domElement;
      const lost = this.pointerWasLocked && !locked;
      if (lost) this.pointerReleasedAt = performance.now();
      this.pointerWasLocked = locked;
      if (locked) {
        this.aimReady = true;
        document.getElementById("aimOverlay").classList.remove("active");
        document.getElementById("fpsCrosshair").style.display = "block";
        document.getElementById("controlHint").textContent = "滑鼠轉動視角 · 左鍵射擊中央準星 · Esc 釋放滑鼠並暫停";
      } else if (lost && this.active && !this.paused && !window.Game.finishing) {
        window.Game.togglePause();
      }
    });
    this.session.listen(document, "pointerlockerror", () => this.enableDragAim());
    this.session.listen(document, "mousemove", e => {
      if (this.renderer && document.pointerLockElement === this.renderer.domElement) this.turnView(e.movementX || 0, e.movementY || 0);
      else if (this.dragAim && (e.buttons & 2)) this.turnView(e.movementX || 0, e.movementY || 0);
    });
    this.session.listen(this.container, "contextmenu", e => e.preventDefault());
    this.session.listen(this.container, "mousedown", e => {
      if (e.target !== this.renderer.domElement || e.button !== 0 || !this.active || this.paused) return;
      if (!this.aimReady) { this.captureAim(); return; }
      this.handleShoot();
    });
    let aimPointer = null;
    const canvas = this.renderer.domElement;
    this.session.listen(canvas, "pointerdown", e => {
      if (e.pointerType === "mouse" || !this.active || this.paused || aimPointer) return;
      e.preventDefault(); this.enableDragAim();
      aimPointer = {id:e.pointerId,x:e.clientX,y:e.clientY};
      canvas.setPointerCapture?.(e.pointerId);
    });
    this.session.listen(canvas, "pointermove", e => {
      if (!aimPointer || e.pointerId !== aimPointer.id) return;
      e.preventDefault(); this.turnView(e.clientX-aimPointer.x,e.clientY-aimPointer.y);
      aimPointer.x=e.clientX;aimPointer.y=e.clientY;
    });
    const releaseAim = e => {
      if (aimPointer?.id !== e.pointerId) return;
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      aimPointer = null;
    };
    this.session.listen(canvas, "pointerup", releaseAim);
    this.session.listen(canvas, "pointercancel", releaseAim);
    this.session.listen(canvas, "lostpointercapture", releaseAim);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.active || !this.renderer) return;
        const width=this.container.clientWidth,height=this.container.clientHeight;
        if (!width || !height) return;
        this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);
      });
      this.resizeObserver.observe(this.container);
    }
  }

  start(questions) {
    this.questions = questions || [];
    this.currentQIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.barrierHp = 100;
    this.wrongQuestionIds = [];
    this.active = true;
    this.paused = false;

    this.updateHpUI();
    this.updateScoreboard(this.score, this.combo);
    this.loadQuestionWave(this.currentQIndex);

    if (this.clock) this.clock.start();
    this.loop();
  }

  stop() {
    this.active = false;
    if (this.renderer && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.resizeObserver?.disconnect();
    this.session.dispose();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.clearZombies();
  }

  dispose() {
    this.stop();
    this.scene?.traverse(obj => {
      obj.geometry?.dispose();
      const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      mats.forEach(mat => { Object.values(mat).forEach(v => { if (v?.isTexture) v.dispose(); }); mat.dispose(); });
    });
    this.labelLayer?.remove();
    this.shells=[];
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  pause() {
    this.paused = true;
    if (this.renderer && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
  }

  resume() {
    this.clock?.getDelta();
    this.paused = false;
    if (!this.dragAim) this.captureAim();
  }

  clearZombies() {
    this.zombies.forEach(z => {
      this.scene.remove(z.mesh);
      z.mesh.traverse(obj => { obj.geometry?.dispose(); if (obj.material) { const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach(m => { m.map?.dispose(); m.dispose(); }); } });
    });
    this.zombies = [];
    this.labelLayer?.replaceChildren();
  }

  loadQuestionWave(index) {
    if (index >= this.questions.length) {
      this.finishLevel();
      return;
    }

    this.clearZombies();
    this.transitioning = false;
    this.questionHadError = false;
    window.Game?.updateQuestionProgress(index, this.questions.length);
    const q = this.questions[index];
    const legend = document.getElementById("answerLegend");
    legend.replaceChildren();
    q.options.forEach((option, i) => {
      const chip = document.createElement("div"); chip.className = "answer-chip";
      const key = document.createElement("b"); key.textContent = "ABCD"[i] || String(i+1);
      const value = document.createElement("span"); value.textContent = String(option);
      chip.appendChild(key); chip.appendChild(value); legend.appendChild(chip);
    });
    document.getElementById("missionConcept").textContent = q.category || "讀懂題意，再瞄準答案";

    const promptBar = document.getElementById("missionPromptText");
    if (promptBar) {
      promptBar.textContent = q.prompt.replace(/^【[^】]+】/, "");
    }

    // No extra sound on wave transitions.

    // 建立 4 隻 PvZ 綠皮西裝殭屍奔向防線
    const portrait = (window.Game.touchDevice && window.innerWidth < 700 && window.innerHeight > window.innerWidth) || this.container.clientWidth / this.container.clientHeight < 0.85;
    const zombieWave = window.Game.currentLevel === 2;
    const xOffsets = portrait ? [-6,6,-6,6] : (zombieWave ? [-9,-3,3,9] : [-10,10,-10,10]);
    q.options.forEach((opt, idx) => {
      const isCorrect = String(opt).trim() === String(q.answer).trim();
      const zDistance = zombieWave ? -22-Math.random()*2 : -55;
      const xPos = xOffsets[idx];

      const badgeText = "ABCD"[idx] + (String(opt).length <= 6 ? " · " + String(opt) : "");
      const zombieObj = window.Game.currentLevel === 2 ? this.createPvZStyleZombie(badgeText, isCorrect) : this.createTrainingDrone(badgeText, isCorrect);
      zombieObj.numberText = String(opt);
      const yPos = zombieWave ? (portrait ? (idx < 2 ? 6 : 0) : 0) : (idx < 2 ? 5 : -8);
      zombieObj.mesh.position.set(xPos, yPos, zDistance);
      zombieObj.originY = yPos;
      zombieObj.badge.visible = false;
      const label = document.createElement("div"); label.className = "target-label";
      const key = document.createElement("span"); key.textContent = "ABCD"[idx];
      const number = document.createElement("strong"); number.textContent = String(opt).length <= 6 ? String(opt) : "選項 " + "ABCD"[idx];
      if (zombieWave) {
        label.classList.add("zombie-letter");label.appendChild(key);
      } else {label.appendChild(key);label.appendChild(number);}
      this.labelLayer.appendChild(label); zombieObj.label = label;
      zombieObj.speed = zombieWave ? .017+Math.random()*.004 : 0;
      zombieObj.motionTime = 0;
      zombieObj.motionPhase = idx * 1.4;
      zombieObj.motionRange = window.Game.currentLevel === 1 ? (portrait ? 2.5 : 4) : (portrait ? 1.2 : 1.8);
      zombieObj.originX = xPos;

      this.scene.add(zombieObj.mesh);
      this.zombies.push(zombieObj);
    });
  }

  handleShoot() {
    if (!this.active || this.paused || this.transitioning || !this.aimReady) return;
    const shotTime = performance.now();
    if (shotTime - this.lastShotTime < 180) return;
    this.lastShotTime = shotTime;
    this.aimKick = .014;
    this.mouse.set(0, 0);
    this.camera.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    // 武器擊發音效
    // One feedback sound is played after the hit result is known.

    // 1. 武器後座力跳動 (Weapon Recoil Kick)
    this.weaponRecoil = 0.16;
    this.weaponRecoilRot = 0.22;

    // 2. 槍口火光閃爍 (Muzzle Flash)
    if (this.muzzleFlashSprite && this.muzzleLight) {
      this.muzzleFlashSprite.visible = true;
      this.muzzleLight.intensity = 3.5;
      this.session.later(() => {
        this.muzzleFlashSprite.visible = false;
        this.muzzleLight.intensity = 0;
      }, 55);
    }

    // 3. 射擊射線碰撞偵測
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitBoxes = this.zombies.filter(z => z.alive).map(z => z.hitBox);
    const intersects = this.raycaster.intersectObjects(hitBoxes, true);
    // The visible answer card is also a target, with a small forgiving edge margin.
    if (!intersects.length) {
      const width=this.container.clientWidth,height=this.container.clientHeight;
      let closest=null,closestDistance=Infinity;
      for (const z of this.zombies.filter(z=>z.alive)) {
        const point=new THREE.Vector3(z.mesh.position.x,z.mesh.position.y+z.labelHeight,z.mesh.position.z);
        const screen=point.clone().project(this.camera);
        if (screen.z < -1 || screen.z > 1) continue;
        const dx=screen.x*width/2,dy=screen.y*height/2;
        const halfWidth=(z.label?.offsetWidth || 100)/2+8;
        const halfHeight=(z.label?.offsetHeight || 70)/2+8;
        const distance=dx*dx+dy*dy;
        if(Math.abs(dx)<=halfWidth && Math.abs(dy)<=halfHeight && distance<closestDistance) {
          closest={object:z.hitBox,point};closestDistance=distance;
        }
      }
      if(closest) intersects.push(closest);
    }

    const muzzleWorldPos = new THREE.Vector3();
    if (this.muzzleFlashSprite) {
      this.muzzleFlashSprite.getWorldPosition(muzzleWorldPos);
    } else {
      muzzleWorldPos.set(0.4, 2.5, 13.5);
    }

    let targetPoint = new THREE.Vector3();

    if (intersects.length > 0) {
      targetPoint.copy(intersects[0].point);
      const hitBox = intersects[0].object;
      const zombie = this.zombies.find(z => z.hitBox === hitBox);
      if (zombie) {
        this.processZombieHit(zombie, targetPoint);
      }
    } else {
      const ray = this.raycaster.ray;
      targetPoint.copy(ray.origin).add(ray.direction.clone().multiplyScalar(50));
      window.Sound.playMiss();
    }

    // 發射發光雷射曳光彈
    this.createLaserTracer(muzzleWorldPos, targetPoint);
    this.ejectShell();
  }

  createLaserTracer(start, end) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffdfb0, transparent: true, opacity: 0.45, linewidth: 1 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.session.later(() => {
      this.scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 75);
  }

  processZombieHit(zombie, hitPoint) {
    const currentQ = this.questions[this.currentQIndex];

    if (zombie.isCorrect) {
      this.transitioning = true;
      this.solved += 1;
      if (!this.questionHadError) this.firstTryCorrect += 1;
      this.combo += 1;
      window.Sound.playKill(this.combo);

      const points = 25 + Math.min(10, this.combo * 2);
      this.score += points;

      this.create3DExplosion(zombie.mesh.position, 0x00f5d4);
      this.showKillBanner(this.combo >= 5 ? `ACE! 五連擊 ×${this.combo}` : `精準命中 · ${this.combo} 連擊`);

      zombie.label.style.display = "none";
      zombie.alive = false;
      this.scene.remove(zombie.mesh);

      this.updateScoreboard(this.score, this.combo);

      if (this.onScoreUpdate) {
        this.onScoreUpdate(this.score, this.combo);
      }

      this.session.later(() => {
        if (!this.active) return;
        this.currentQIndex += 1;
        this.loadQuestionWave(this.currentQIndex);
      }, 750);

    } else {
      window.Sound.playMiss();
      this.combo = 0;
      // Health is managed once by GameEngine.onWrongAnswer.
      this.updateHpUI();
      this.updateScoreboard(this.score, this.combo);

      this.create3DExplosion(zombie.mesh.position, 0xff4655);
      this.questionHadError = true;
      this.wrongQuestionIds.push(currentQ.id);

      if (this.onScoreUpdate) {
        this.onScoreUpdate(this.score, this.combo);
      }

      this.pause();
      if (this.onWrongAnswer) {
        this.onWrongAnswer(currentQ, zombie.numberText);
      }
    }
  }

  processZombieBreach() {
    if (!this.active || this.paused || this.transitioning) return;
    this.transitioning = true;
    const question=this.questions[this.currentQIndex];
    this.questionHadError=true;
    this.wrongQuestionIds.push(question.id);
    this.combo=0;
    window.Sound.playMiss();
    this.updateScoreboard(this.score,this.combo);
    this.onScoreUpdate?.(this.score,this.combo);
    window.Game.onZombieBreach(question);
    if (!this.active) return;
    this.showKillBanner("喪屍突破防線 · 本題答錯 −20 HP");
    this.session.later(()=>{
      if (!this.active) return;
      this.currentQIndex+=1;
      this.loadQuestionWave(this.currentQIndex);
    },250);
  }

  create3DExplosion(pos, colorHex) {
    const count = 35;
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions.push(pos.x, pos.y + 2.5, pos.z);
      velocities.push(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 8
      );
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.6,
      transparent: true,
      opacity: 1
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.sparks.push({
      mesh: pSystem,
      velocities,
      life: 35
    });
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

  updateHpUI() {
    const hpFill = document.getElementById("barrierHpFill");
    const hpText = document.getElementById("barrierHpText");
    if (hpFill) {
      hpFill.style.width = `${this.barrierHp}%`;
      if (this.barrierHp <= 30) {
        hpFill.classList.add("danger");
      } else {
        hpFill.classList.remove("danger");
      }
    }
    if (hpText) {
      hpText.textContent = `${this.barrierHp}%`;
    }
  }

  finishLevel() {
    if (!this.active) return;
    this.stop();
    if (this.onLevelComplete) {
      const normalizedScore = Math.round(this.firstTryCorrect / (this.questions.length || 1) * 100);
      this.onLevelComplete({
        level: window.Game.currentLevel,
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

    if (!this.paused && this.aimReady) {
      this.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.updateTargetLabels();
    this.renderRadar();

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update() {
    const delta = Math.min(0.05, this.clock ? this.clock.getDelta() : 0.016);
    for(let i=this.shells.length-1;i>=0;i--) {
      const shell=this.shells[i]; shell.life-=delta; shell.velocity.y-=9.8*delta;
      shell.mesh.position.addScaledVector(shell.velocity,delta);
      shell.mesh.rotation.x+=delta*10; shell.mesh.rotation.z+=delta*7;
      if(shell.life<=0) {this.scene.remove(shell.mesh);shell.mesh.geometry.dispose();shell.mesh.material.dispose();this.shells.splice(i,1);}
    }
    this.aimKick *= Math.exp(-18 * delta);
    this.swayX *= Math.exp(-10 * delta);
    this.swayY *= Math.exp(-10 * delta);
    this.camera.rotation.set(this.pitch + this.aimKick, this.yaw, 0, "YXZ");

    // 1. 武器晃動 (Weapon Sway) 與後座力回彈平滑插值
    if (this.weaponGroup) {
      const targetSwayX = 0.36 - this.swayX;
      const targetSwayY = -0.30 + this.swayY;

      this.weaponGroup.position.x += (targetSwayX - this.weaponGroup.position.x) * 0.12;
      this.weaponGroup.position.y += (targetSwayY - this.weaponGroup.position.y) * 0.12;

      // 後座力彈簧阻尼回復
      this.weaponRecoil *= 0.82;
      this.weaponRecoilRot *= 0.82;

      this.weaponGroup.position.z = -0.72 + this.weaponRecoil;
      this.weaponGroup.rotation.x = -0.04 + this.weaponRecoilRot + this.swayY;
      this.weaponGroup.rotation.y += (-this.swayX - this.weaponGroup.rotation.y) * 0.12;
    }

    if (this.slideMesh) this.slideMesh.position.z = this.weaponRecoil * 0.65;

    // 2. PvZ 殭屍滑稽跛行與撲擊前進動畫
    this.zombies.forEach(z => {
      if (!z.alive || this.transitioning) return;
      z.motionTime += delta * (window.Game?.runPractice ? .7 : 1);
      if (z.drone) {
        z.mesh.position.x = z.originX + Math.sin(z.motionTime*.8+z.motionPhase)*z.motionRange;
      } else {
        z.mesh.position.z += z.speed * delta * 60 * (window.Game?.runPractice ? .5 : 1);
      }
      z.walkPhase += 0.08 * delta * 60;
      if (z.drone) {
        z.mesh.position.y = (z.originY || 0) + Math.sin(z.walkPhase) * 0.15;

        z.ring.rotation.z += delta * .4;
      }

      // 頭部左右擺晃
      if (z.headGroup) {
        z.headGroup.rotation.z = Math.sin(z.walkPhase * 0.8) * 0.14;
        z.headGroup.rotation.y = Math.cos(z.walkPhase * 0.5) * 0.1;
      }

      // 腿部跛行 (Asymmetric Limp)
      if (z.legL && z.legR) {
        z.legL.rotation.x = Math.sin(z.walkPhase) * 0.5;
        z.legR.rotation.x = -Math.sin(z.walkPhase) * 0.35 + 0.1;
      }

      // 手臂上下擺抓
      if (z.armL && z.armR) {
        z.armL.rotation.x = 0.1 + Math.cos(z.walkPhase) * 0.2;
        z.armR.rotation.x = -0.05 - Math.cos(z.walkPhase) * 0.2;
      }

      // 逼近操作台防線 (z >= 11)
      if (z.mesh.position.z >= 11.2) {
        this.processZombieBreach();
      }
    });

    // 3. 爆炸粒子更新
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      const positions = sp.mesh.geometry.attributes.position.array;
      for (let j = 0; j < sp.velocities.length; j += 3) {
        positions[j] += sp.velocities[j] * delta;
        positions[j + 1] += sp.velocities[j + 1] * delta;
        positions[j + 2] += sp.velocities[j + 2] * delta;
        sp.velocities[j + 1] -= 9.8 * delta;
      }
      sp.mesh.geometry.attributes.position.needsUpdate = true;
      sp.mesh.material.opacity = sp.life / 35;
      sp.life -= 1;
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        sp.mesh.material.dispose();
        this.sparks.splice(i, 1);
      }
    }
  }

  /**
   * 戰術動態小地圖雷達 (Minimap)
   */
  updateTargetLabels() {
    if (!this.labelLayer || !this.camera) return;
    const width=this.container.clientWidth,height=this.container.clientHeight;
    this.camera.updateMatrixWorld(true);
    for (const z of this.zombies) {
      if (!z.label) continue;
      const point=new THREE.Vector3(z.mesh.position.x,z.mesh.position.y+z.labelHeight,z.mesh.position.z).project(this.camera);
      const visible=z.alive && point.z >= -1 && point.z <= 1 && Math.abs(point.x)<1.2 && Math.abs(point.y)<1.2;
      z.label.style.display=visible ? "flex" : "none";
      if (visible) {
        const distance=this.camera.position.distanceTo(z.mesh.position);
        const scale=z.drone ? Math.max(.60,Math.min(1,44.5/distance)) : 1;
        z.label.style.transform=z.drone ? `translate(-50%,-50%) scale(${scale})` : "translate(-50%,-100%)";
        z.label.style.marginTop=z.drone ? "0px" : "-8px";
        z.label.style.left=((point.x+1)*width/2)+"px";z.label.style.top=((1-point.y)*height/2)+"px";}
    }
  }

  renderRadar() {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // 圓環雷達格線
    ctx.strokeStyle = "rgba(0, 245, 212, 0.28)";
    ctx.lineWidth = 1;
    [0.35, 0.68, 0.95].forEach(r => {
      ctx.beginPath();
      ctx.arc(cx, cy, (w / 2) * r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 中心特工標記 (特戰英豪三角形圖標)
    ctx.fillStyle = "#00f5d4";
    ctx.beginPath();
    const px = cx;
    const py = cy + (h / 2) * 0.65;
    ctx.moveTo(px, py - 6);
    ctx.lineTo(px - 5, py + 5);
    ctx.lineTo(px + 5, py + 5);
    ctx.closePath();
    ctx.fill();

    // 殭屍紅點位置即時追蹤
    this.zombies.forEach(z => {
      if (!z.alive) return;
      const rx = cx + (z.mesh.position.x / 24) * (w / 2.3);
      const rz = cy - ((z.mesh.position.z + 10) / 45) * (h / 2.3);

      ctx.fillStyle = "#ff4655";
      ctx.beginPath();
      ctx.arc(rx, rz, 4, 0, Math.PI * 2);
      ctx.shadowColor = "#ff4655";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }
}

window.Level2ZombieGame = Level2ZombieGame;
