import type { Effect } from './engine.ts';

/** Short procedural voices; no audio assets or network requests. */
export class AudioSystem {
  private context: AudioContext | null = null;
  private musicTimer = 0;
  private note = 0;
  private soundBudget = 5;
  volume = 0.35;
  music = 0.12;
  active = false;

  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      // Audio is optional; unsupported browsers can still play.
    }
  }

  private tone(frequency: number, duration: number, type: OscillatorType, gain: number, slide = 0, music = false) {
    const context = this.context;
    const volume = music ? this.music : this.volume;
    if (!context || context.state !== 'running' || volume === 0) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), context.currentTime + duration);
    envelope.gain.setValueAtTime(gain * volume, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  effects(events: Effect[]) {
    let sounds = 0;
    for (const event of events) {
      if (sounds >= Math.floor(this.soundBudget)) break;
      switch (event.type) {
        case 'shot': this.tone(740, 0.055, 'triangle', 0.07, -480); break;
        case 'explosion': this.tone(95, 0.35, 'sawtooth', 0.15, -70); break;
        case 'chain': this.tone(180, 0.09, 'sawtooth', 0.04, 620); break;
        case 'rail': this.tone(1000, 0.25, 'sawtooth', 0.1, -900); break;
        case 'breach':
        case 'emp': this.tone(240, 0.5, 'square', 0.1, -120); break;
        default: continue;
      }
      sounds++;
    }
    this.soundBudget = Math.max(0, this.soundBudget - sounds);
  }

  update(dt: number) {
    this.soundBudget = Math.min(5, this.soundBudget + dt * 30);
    if (!this.active || !this.music) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.38;
    const notes = [55, 82.41, 110, 65.41, 55, 98, 82.41, 73.42];
    this.tone(notes[this.note++ % notes.length], 0.6, 'triangle', 0.3, 0, true);
    if (this.note % 4 === 0) this.tone(220, 0.8, 'sine', 0.1, 0, true);
  }

  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
