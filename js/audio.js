/**
 * audio.js - 特戰英豪風格音效引擎 (Web Audio API 程序化合成)
 * 完全無須外部音檔，支援即時音訊合成、低延遲、跨平台相容
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.referencePlayers = new Map();
    this.activeReference = null;
    this.feedbackGeneration = 0;
    this.feedbackNodes = new Set();
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.42, this.ctx.currentTime);
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -10;
        this.limiter.knee.value = 6;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.002;
        this.limiter.release.value = 0.12;
        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);
      }
    } catch (e) {
      console.warn("Web Audio API 初始化失敗:", e);
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.stopFeedback();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.42, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * 戰術射擊聲 (Valorant Blaster Laser / Shotgun Crack)
   */
  playShoot() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // Broadband attack, low-frequency pressure wave and short indoor reflections.
    const noise = (delay, duration, gainValue, lowpass, highpass) => {
      const frames = Math.ceil(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let previous=0;
      for (let i = 0; i < frames; i++) {
        const white=Math.random()*2-1;
        previous=previous*.6+white*.4;
        data[i]=Math.tanh((white*.7+previous*.3)*2.5)*.8;
      }
      const source = ctx.createBufferSource(); source.buffer = buffer;
      const lo = ctx.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = lowpass;
      const hi = ctx.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = highpass;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, t + delay);
      envelope.gain.exponentialRampToValueAtTime(gainValue, t + delay + 0.0015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration);
      source.connect(hi); hi.connect(lo); lo.connect(envelope); envelope.connect(this.masterGain);
      source.start(t + delay); source.stop(t + delay + duration);
      source.onended = () => { source.disconnect(); hi.disconnect(); lo.disconnect(); envelope.disconnect(); };
    };
    noise(0, 0.055, 0.95, 12000, 650); // sharp muzzle crack
    noise(0.003, 0.105, 0.58, 1400, 80); // body of the report
    noise(0.065, 0.13, 0.16, 4200, 300); // room reflection
    noise(0.13, 0.18, 0.065, 2200, 200); // distant decay
    noise(0.025, 0.025, 0.1, 7500, 3300); // slide/mechanical snap
    const body = ctx.createOscillator(), gain = ctx.createGain();
    body.type = 'sine'; body.frequency.setValueAtTime(95, t);
    body.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    gain.gain.setValueAtTime(0.18, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    body.connect(gain); gain.connect(this.masterGain); body.start(t); body.stop(t + 0.12);
    body.onended = () => { body.disconnect(); gain.disconnect(); };
  }

  /**
   * 特戰英豪經典爆頭「DINK!」金屬清脆擊殺音 (Headshot / 答對音效)
   */
  stopFeedback() {
    this.feedbackGeneration += 1;
    this.activeReference?.pause();
    for (const node of this.feedbackNodes) {
      try { node.osc.stop(); } catch (_) {}
      node.gain.disconnect();
    }
    this.feedbackNodes.clear();
  }

  playReference(key, url, fallback) {
    if (this.muted) return;
    this.stopFeedback();
    const generation=this.feedbackGeneration;
    const recover=error => {
      if (generation !== this.feedbackGeneration || this.muted || error?.name === "AbortError") return;
      fallback();
    };
    if (typeof window.Audio !== "function") {fallback();return;}
    try {
      let player=this.referencePlayers.get(key);
      if (!player) {player=new window.Audio(url);player.preload="auto";this.referencePlayers.set(key,player);}
      this.activeReference=player;player.currentTime=0;player.volume=.45;
      const playing=player.play();playing?.catch(recover);
    } catch (error) {recover(error);}
  }

  playKill(combo) {
    const tier=Math.min(5,Math.max(1,combo));
    this.playReference(tier,`https://www.myinstants.com/media/sounds/valorant-${tier}-${tier===1?"kill":"kills"}.mp3`,()=>this.playKillSynth(tier));
  }

  playKillSynth(tier) {
    if(this.muted) return;this.ensureContext();if(!this.ctx)return;
    const now=this.ctx.currentTime;
    const bases=[659.25,783.99,987.77,1174.66,1318.51];
    const notes=tier===5?[1,1.25,1.5,2]:[1,2.73];
    notes.forEach((ratio,i)=>{
      const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
      const start=now+(tier===5?i*.075:0),duration=tier===5?.42:.18;
      osc.type="sine";osc.frequency.setValueAtTime(bases[tier-1]*ratio,start);
      gain.gain.setValueAtTime(.13/(i+1),start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      osc.connect(gain);gain.connect(this.masterGain);osc.start(start);osc.stop(start+duration);
      const node={osc,gain};this.feedbackNodes.add(node);
      osc.onended=()=>{this.feedbackNodes.delete(node);osc.disconnect();gain.disconnect();};
    });
  }

  /**
   * 射擊失敗 / 答錯音效 (Duck Toy 尖叫鴨音效)
   * 來源: https://www.myinstants.com/en/instant/duck-toy-sound-18073/
   */
  playMiss() {
    this.playReference(
      "duck-toy",
      "sounds/duck-toy-sound.mp3",
      () => this.playReference(
        "duck-toy-remote",
        "https://www.myinstants.com/media/sounds/duck-toy-sound.mp3",
        () => this.playDisconnectSynth()
      )
    );
  }

  playDisconnectSynth() {
    if(this.muted)return;this.ensureContext();if(!this.ctx)return;
    const t=this.ctx.currentTime;
    [784,587,392].forEach((frequency,i)=>{
      const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
      const start=t+i*.075,duration=.13;
      osc.type="sine";osc.frequency.setValueAtTime(frequency,start);
      gain.gain.setValueAtTime(.11,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      osc.connect(gain);gain.connect(this.masterGain);osc.start(start);osc.stop(start+duration);
      const node={osc,gain};this.feedbackNodes.add(node);
      osc.onended=()=>{this.feedbackNodes.delete(node);osc.disconnect();gain.disconnect();};
    });
  }

  playHeadshot() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 雙振盪器合成金屬打擊聲
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    // 高頻清脆金屬鐘音
    osc1.frequency.setValueAtTime(1760, t); // A6
    osc1.frequency.exponentialRampToValueAtTime(2640, t + 0.08);

    osc2.frequency.setValueAtTime(3520, t); // A7
    osc2.frequency.exponentialRampToValueAtTime(1760, t + 0.25);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.35);
    osc2.stop(t + 0.35);
  }

  /**
   * 答對加成音效 (Combo 遞增音階)
   */
  playCombo(comboCount = 1) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const baseFreq = 523.25; // C5
    // 隨連擊次數提升半音
    const semitones = Math.min(12, comboCount * 2);
    const freq = baseFreq * Math.pow(2, semitones / 12);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.2);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  /**
   * 答錯警報音效 (同步使用尖叫鴨音效)
   */
  playError() {
    this.playMiss();
  }

  /**
   * 關卡通關慶祝音效 (Level Cleared Victory Fanfare)
   */
  playVictory() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = startTime + idx * 0.12;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /**
   * 殭屍咆哮 / 逼近警示 (Level 2 3D)
   */
  playZombieGrowl() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(65, t + 0.4);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  /**
   * 介面點擊與倒數嗶聲
   */
  playBeep(high = false) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(high ? 880 : 440, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.08);
  }
}

// 建立全域音效實例
window.Sound = new SoundEngine();
