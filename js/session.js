class MissionSession {
  constructor() { this.listeners = []; this.timers = new Set(); }
  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }
  later(callback, delay) {
    const id = setTimeout(() => { this.timers.delete(id); callback(); }, delay);
    this.timers.add(id); return id;
  }
  dispose() {
    this.listeners.forEach(remove => remove()); this.listeners = [];
    this.timers.forEach(clearTimeout); this.timers.clear();
  }
}
window.MissionSession = MissionSession;
