import type { Phenotype } from '../sim/genome';
import type { AudioEvent, CallType } from '../sim/world';

export type ScaleName = 'pentatonic' | 'just' | 'chromatic' | 'whole' | 'free';
const SCALES: Record<Exclude<ScaleName, 'free'>, number[]> = {
  pentatonic: [0, 3, 5, 7, 10],
  just: [0, 2, 4, 5, 7, 9, 11],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  whole: [0, 2, 4, 6, 8, 10],
};

export interface Cam { x: number; y: number; halfW: number; halfH: number; zoom: number }
export interface DroneTarget { id: number; freq: number; wave: OscillatorType; cutoff: number; pan: number; gain: number; detune: number }

interface DroneVoice { o1: OscillatorNode; o2: OscillatorNode; f: BiquadFilterNode; g: GainNode; p: StereoPannerNode; id: number; lfo: OscillatorNode }

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private comp!: DynamicsCompressorNode;
  private dry!: GainNode;
  private revIn!: GainNode;
  private revOut!: GainNode;
  private delIn!: GainNode;
  private delOut!: GainNode;
  private delay!: DelayNode;
  private delFb!: GainNode;
  analyser!: AnalyserNode;
  private noiseBuf!: AudioBuffer;
  private distCurve!: Float32Array<ArrayBuffer>;
  private drones: DroneVoice[] = [];
  private proc: ScriptProcessorNode | null = null;
  private recL: Float32Array[] = [];
  private recR: Float32Array[] = [];
  recording = false;
  voices = 0;
  maxVoices = 32;
  muted = false;
  volume = 0.75;
  reverb = 0.45;
  delayAmt = 0.25;
  scale: ScaleName = 'pentatonic';
  quantize = true;
  tempo = 92;
  droneLevel = 0.5;
  soloIds = new Set<number>();
  eventsPlayed = 0;
  private tbuf = new Float32Array(1024);

  get started() {
    return !!this.ctx;
  }

  async start() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.25;
    this.dry = ctx.createGain();
    this.revIn = ctx.createGain();
    this.revOut = ctx.createGain();
    this.delIn = ctx.createGain();
    this.delOut = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = this.makeIR(4.2);
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = (60 / this.tempo) * 0.75;
    this.delFb = ctx.createGain();
    this.delFb.gain.value = 0.42;
    const delFilt = ctx.createBiquadFilter();
    delFilt.type = 'lowpass';
    delFilt.frequency.value = 2800;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;

    this.dry.connect(this.comp);
    this.revIn.connect(conv).connect(this.revOut).connect(this.comp);
    this.delIn.connect(this.delay);
    this.delay.connect(delFilt).connect(this.delFb).connect(this.delay);
    delFilt.connect(this.delOut).connect(this.comp);
    this.delOut.connect(this.revIn);
    this.comp.connect(this.master);
    this.master.connect(this.analyser);
    this.master.connect(ctx.destination);
    this.setReverb(this.reverb);
    this.setDelay(this.delayAmt);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 6) * 0.8 + (Math.abs(x) > 0.6 ? Math.sign(x) * 0.2 : 0);
    }
    this.distCurve = curve;

    // pooled drone voices
    for (let i = 0; i < 5; i++) {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.07 + i * 0.03;
      lfoG.gain.value = 300;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 6;
      f.frequency.value = 400;
      lfo.connect(lfoG).connect(f.frequency);
      const g = ctx.createGain();
      g.gain.value = 0;
      const p = ctx.createStereoPanner();
      o1.connect(f); o2.connect(f);
      f.connect(g).connect(p);
      p.connect(this.dry);
      const s = ctx.createGain();
      s.gain.value = 0.8;
      p.connect(s).connect(this.revIn);
      o1.start(); o2.start(); lfo.start();
      this.drones.push({ o1, o2, f, g, p, id: -1, lfo });
    }
  }

  private makeIR(sec: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (t < 0.01 ? t * 100 : 1);
      }
    }
    return buf;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05);
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.setVolume(this.volume);
  }
  setReverb(v: number) {
    this.reverb = v;
    if (this.ctx) this.revOut.gain.setTargetAtTime(v * 1.4, this.ctx.currentTime, 0.1);
  }
  setDelay(v: number) {
    this.delayAmt = v;
    if (this.ctx) this.delOut.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }
  setTempo(bpm: number) {
    this.tempo = bpm;
    if (this.ctx) this.delay.delayTime.setTargetAtTime((60 / bpm) * 0.75, this.ctx.currentTime, 0.3);
  }

  level(): number {
    if (!this.ctx) return 0;
    this.analyser.getFloatTimeDomainData(this.tbuf);
    let s = 0;
    for (let i = 0; i < this.tbuf.length; i++) s += this.tbuf[i] * this.tbuf[i];
    return Math.sqrt(s / this.tbuf.length);
  }

  spectrum(out: Uint8Array<ArrayBuffer>) {
    if (this.ctx) this.analyser.getByteFrequencyData(out);
  }

  noteFreq(ph: Phenotype, deg: number): number {
    if (this.scale === 'free') return ph.freq * Math.pow(2, (deg * ph.pitchRange * 1.6) / 12);
    const steps = SCALES[this.scale];
    const L = steps.length;
    const st = 12 * Math.log2(ph.freq / 55);
    const oct = Math.floor(st / 12);
    const within = st - oct * 12;
    let idx = 0, best = 99;
    for (let i = 0; i < L; i++) {
      const d = Math.abs(steps[i] - within);
      if (d < best) { best = d; idx = i; }
    }
    if (Math.abs(12 - within) < best) idx = L; // wrap to next octave root
    const k = oct * L + idx + Math.round(deg);
    const o2 = Math.floor(k / L);
    const i2 = k - o2 * L;
    return 55 * Math.pow(2, (o2 * 12 + steps[i2]) / 12);
  }

  private nextGrid(t: number, div = 4) {
    if (!this.quantize) return t;
    const g = 60 / this.tempo / div;
    return Math.ceil(t / g) * g;
  }

  trigger(ev: AudioEvent, cam: Cam, density = 1) {
    if (!this.ctx || this.muted || ev.muted) return;
    if (this.soloIds.size && !this.soloIds.has(ev.id)) return;
    const dx = ev.x - cam.x, dy = ev.y - cam.y;
    const norm = Math.sqrt((dx / cam.halfW) ** 2 + (dy / cam.halfH) ** 2);
    if (norm > 2) return;
    let gain = 1 / (1 + norm * norm * 2.2);
    gain *= 0.55 + 0.45 * Math.min(1, cam.zoom);
    if (this.soloIds.size) gain = Math.max(gain, 0.6);
    if (Math.random() > density) return;
    if (this.voices >= this.maxVoices && gain < 0.5) return;
    const pan = Math.max(-1, Math.min(1, dx / cam.halfW)) * 0.85;
    this.playCall(ev.ph, ev.type, ev.notes, gain * (0.4 + ev.intensity * 0.6), pan);
    this.eventsPlayed++;
  }

  audition(ph: Phenotype, type: CallType, motif: number[]) {
    if (!this.ctx) return;
    this.playCall(ph, type, motif, 0.9, 0, true);
  }

  playCall(ph: Phenotype, type: CallType, motif: number[], gain: number, pan: number, force = false) {
    const ctx = this.ctx!;
    const now = this.nextGrid(ctx.currentTime + 0.02, type === 'social' ? 4 : 8);
    const beat = 60 / this.tempo;
    const amp = 0.16 * ph.loudness * gain;
    const base = this.noteFreq(ph, 0);
    switch (type) {
      case 'pulse':
        this.note(ph, base, now, ph.attack + ph.decay * 0.5, amp * 0.7, pan, {}, force);
        break;
      case 'social': {
        const sp = Math.max(0.07, Math.min(0.5, (beat / ph.rhythmDiv) * 0.5));
        const notes = motif.length ? motif : [0];
        notes.forEach((d, i) => this.note(ph, this.noteFreq(ph, d), now + i * sp, Math.min(sp * 1.6, ph.attack + ph.decay), amp, pan, {}, force));
        break;
      }
      case 'mating': {
        const f2 = this.noteFreq(ph, 3 + Math.round(ph.pitchRange * 2));
        this.note(ph, base, now, 0.25 + ph.decay * 0.6, amp, pan, { glideTo: f2, vibrato: true }, force);
        this.note(ph, f2, now + 0.22, 0.2 + ph.decay * 0.5, amp * 0.8, pan, { vibrato: true }, force);
        break;
      }
      case 'territory':
        this.note(ph, base / 2, now, 0.12 + ph.decay * 0.3, amp * 1.2, pan, { distort: true, noise: 0.4 }, force);
        this.note(ph, base / 2, now + beat / 4, 0.1 + ph.decay * 0.25, amp, pan, { distort: true, noise: 0.4 }, force);
        break;
      case 'food': {
        const notes = [...(motif.length ? motif : [0])].sort((a, b) => a - b);
        notes.forEach((d, i) => this.note(ph, this.noteFreq(ph, d + 2), now + i * 0.07, 0.08 + ph.decay * 0.2, amp * 0.8, pan, {}, force));
        break;
      }
      case 'distress':
        for (let i = 0; i < 3; i++) this.note(ph, base * 2 * Math.pow(0.84, i), now + i * 0.06, 0.06, amp * 0.9, pan, { noise: 0.5, glideTo: base * 1.4 * Math.pow(0.84, i) }, force);
        break;
    }
  }

  private note(ph: Phenotype, freq: number, when: number, dur: number, amp: number, pan: number,
    o: { glideTo?: number; distort?: boolean; noise?: number; vibrato?: boolean }, force = false) {
    if (!force && this.voices >= this.maxVoices + 8) return;
    const ctx = this.ctx!;
    freq = Math.min(9000, Math.max(25, freq));
    const atk = Math.min(ph.attack, dur * 0.5);
    const end = when + atk + dur + 0.05;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), when + atk + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(Math.min(16000, freq * (1.2 + ph.cutoff * 14)), when);
    filt.frequency.exponentialRampToValueAtTime(Math.min(16000, freq * (1 + ph.cutoff * 4)), end);
    filt.Q.value = 0.5 + ph.resonance * 16;
    const car = ctx.createOscillator();
    car.type = ph.wave;
    car.frequency.setValueAtTime(freq, when);
    if (o.glideTo) car.frequency.exponentialRampToValueAtTime(Math.min(9000, o.glideTo), when + dur * 0.8);
    const nodes: AudioScheduledSourceNode[] = [car];
    if (ph.fmIndex > 0.05) {
      const mod = ctx.createOscillator();
      const mg = ctx.createGain();
      mod.frequency.value = freq * ph.fmRatio;
      mg.gain.setValueAtTime(freq * ph.fmIndex, when);
      mg.gain.exponentialRampToValueAtTime(Math.max(0.01, freq * ph.fmIndex * 0.1), end);
      mod.connect(mg).connect(car.frequency);
      nodes.push(mod);
    }
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5 + ph.rhythmDiv * 1.5;
      lg.gain.value = freq * 0.02;
      lfo.connect(lg).connect(car.frequency);
      nodes.push(lfo);
    }
    let src: AudioNode = car;
    if (o.distort) {
      const ws = ctx.createWaveShaper();
      ws.curve = this.distCurve;
      car.connect(ws);
      src = ws;
    }
    src.connect(filt);
    if (ph.harmonics > 0.45) {
      const h = ctx.createOscillator();
      const hg = ctx.createGain();
      h.type = 'sine';
      h.frequency.value = freq * (ph.harmonics > 0.75 ? 3 : 2);
      hg.gain.value = (ph.harmonics - 0.4) * 0.6;
      h.connect(hg).connect(filt);
      nodes.push(h);
    }
    const nAmt = Math.max(ph.noise > 0.35 ? (ph.noise - 0.35) * 1.4 : 0, o.noise ?? 0);
    if (nAmt > 0.02) {
      const ns = ctx.createBufferSource();
      ns.buffer = this.noiseBuf;
      ns.playbackRate.value = 0.5 + Math.random();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(12000, freq * 2);
      bp.Q.value = 1 + ph.resonance * 6;
      const ng = ctx.createGain();
      ng.gain.value = nAmt * 2.2;
      ns.connect(bp).connect(ng).connect(filt);
      nodes.push(ns);
    }
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    filt.connect(env).connect(p);
    p.connect(this.dry);
    const rs = ctx.createGain();
    rs.gain.value = 0.3 + ph.spectral * 0.2 + (1 - ph.attack) * 0.1;
    p.connect(rs).connect(this.revIn);
    if (ph.rhythmDiv >= 1 && ph.decay < 0.6) {
      const ds = ctx.createGain();
      ds.gain.value = 0.5;
      p.connect(ds).connect(this.delIn);
    }
    this.voices++;
    for (const n of nodes) { n.start(when); n.stop(end + 0.02); }
    car.onended = () => {
      this.voices--;
      env.disconnect();
      p.disconnect();
    };
  }

  updateDrones(targets: DroneTarget[]) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const used = new Set<DroneVoice>();
    const assign: [DroneVoice, DroneTarget][] = [];
    for (const tg of targets) {
      const v = this.drones.find((d) => d.id === tg.id && !used.has(d));
      if (v) { used.add(v); assign.push([v, tg]); }
    }
    for (const tg of targets) {
      if (assign.some((a) => a[1] === tg)) continue;
      const v = this.drones.find((d) => !used.has(d));
      if (!v) break;
      used.add(v);
      v.id = tg.id;
      assign.push([v, tg]);
    }
    for (const d of this.drones) {
      if (!used.has(d)) { d.id = -1; d.g.gain.setTargetAtTime(0, t, 0.8); }
    }
    for (const [v, tg] of assign) {
      if (v.o1.type !== tg.wave) { v.o1.type = tg.wave === 'square' ? 'triangle' : tg.wave; }
      v.o1.frequency.setTargetAtTime(tg.freq, t, 0.5);
      v.o2.frequency.setTargetAtTime(tg.freq * (1.5 + tg.detune * 0.01), t, 0.5);
      v.f.frequency.setTargetAtTime(Math.min(8000, tg.freq * (1.5 + tg.cutoff * 6)), t, 0.4);
      v.p.pan.setTargetAtTime(tg.pan, t, 0.3);
      v.g.gain.setTargetAtTime(this.muted ? 0 : tg.gain * 0.05 * this.droneLevel, t, 0.6);
    }
  }

  startRecording() {
    if (!this.ctx || this.recording) return;
    this.recL = []; this.recR = [];
    const proc = this.ctx.createScriptProcessor(4096, 2, 2);
    proc.onaudioprocess = (e) => {
      if (!this.recording) return;
      this.recL.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      this.recR.push(new Float32Array(e.inputBuffer.getChannelData(1)));
      // keep output silent
      e.outputBuffer.getChannelData(0).fill(0);
      e.outputBuffer.getChannelData(1).fill(0);
    };
    this.master.connect(proc);
    const z = this.ctx.createGain();
    z.gain.value = 0;
    proc.connect(z).connect(this.ctx.destination);
    this.proc = proc;
    this.recording = true;
  }

  recordedSeconds() {
    if (!this.ctx) return 0;
    return (this.recL.length * 4096) / this.ctx.sampleRate;
  }

  stopRecording(): Blob | null {
    if (!this.ctx || !this.recording) return null;
    this.recording = false;
    try { this.master.disconnect(this.proc!); } catch { /* noop */ }
    this.proc?.disconnect();
    this.proc = null;
    return encodeWav(this.recL, this.recR, this.ctx.sampleRate);
  }
}

export function encodeWav(L: Float32Array[], R: Float32Array[], sr: number): Blob {
  const n = L.reduce((a, b) => a + b.length, 0);
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * 4, true);
  let off = 44;
  for (let c = 0; c < L.length; c++) {
    const l = L[c], r = R[c];
    for (let i = 0; i < l.length; i++) {
      v.setInt16(off, Math.max(-1, Math.min(1, l[i])) * 0x7fff, true);
      v.setInt16(off + 2, Math.max(-1, Math.min(1, r[i])) * 0x7fff, true);
      off += 4;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}
