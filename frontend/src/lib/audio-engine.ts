export interface EQBand {
  frequency: number;
  gain: number;
  type: BiquadFilterType;
  Q: number;
}

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: Record<string, number[]> = {
  flat:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock:       [5, 4, 3, 1.5, -0.5, -1, 1, 3, 4, 5],
  pop:        [-1, -0.5, 0, 2, 4, 4, 2, 0, -0.5, -1],
  jazz:       [4, 3, 1, 2, -1, -1, 0, 1, 3, 4],
  classical:  [5, 4, 3, 2, -1, -1, 0, 2, 3, 4],
  bass_boost: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  treble_boost: [0, 0, 0, 0, 0, 1, 3, 5, 6, 6],
  vocal:      [-2, -1, 0, 3, 5, 5, 3, 1, 0, -1],
};

const BAND_LABELS = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private connected = false;
  private _eqEnabled = false;
  private _eqBands: number[] = EQ_PRESETS.flat;

  private reverbNode: ConvolverNode | null = null;
  private echoNode: DelayNode | null = null;
  private echoFeedback: GainNode | null = null;
  private audio: HTMLAudioElement | null = null;

  public reverbMix: number = 0;
  public echoDelay: number = 0;
  public echoMix: number = 0;
  public speed: number = 1;

  get isReady(): boolean {
    return this.ctx !== null && this.connected;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get masterGain(): GainNode | null {
    return this.gainNode;
  }

  init(audio: HTMLAudioElement): void {
    if (this.ctx) {
      this.reconnect(audio);
      return;
    }

    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaElementSource(audio);
    this.audio = audio;

    this.gainNode = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.filters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = this._eqBands[i] || 0;
      return filter;
    });

    this.echoNode = this.ctx.createDelay(2);
    this.echoFeedback = this.ctx.createGain();
    this.reverbNode = this.ctx.createConvolver();
    this.generateImpulseResponse();

    this.reconnect();
    this.connected = true;
  }

  private generateImpulseResponse(): void {
    if (!this.ctx || !this.reverbNode) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    this.reverbNode.buffer = impulse;
  }

  setReverb(mix: number): void {
    this.reverbMix = Math.max(0, Math.min(1, mix));
    this.reconnectEffects();
  }

  setEcho(delay: number, mix: number): void {
    this.echoDelay = Math.max(0, Math.min(2, delay));
    this.echoMix = Math.max(0, Math.min(1, mix));
    if (this.echoNode) this.echoNode.delayTime.value = this.echoDelay;
    if (this.echoFeedback) this.echoFeedback.gain.value = this.echoMix * 0.5;
    this.reconnectEffects();
  }

  setSpeed(rate: number): void {
    this.speed = Math.max(0.5, Math.min(2, rate));
    if (this.audio) this.audio.playbackRate = this.speed;
  }

  private disconnectAll(): void {
    this.source?.disconnect();
    this.gainNode?.disconnect();
    this.filters.forEach((f) => f.disconnect());
    this.reverbNode?.disconnect();
    this.echoNode?.disconnect();
    this.echoFeedback?.disconnect();
    this.analyser?.disconnect();
  }

  private reconnectEffects(): void {
    this.disconnectAll();
    if (!this.source || !this.ctx || !this.gainNode || !this.analyser) return;

    let lastNode: AudioNode = this.source;

    if (this._eqEnabled) {
      for (const filter of this.filters) {
        lastNode.connect(filter);
        lastNode = filter;
      }
    }

    if (this.reverbMix > 0 && this.reverbNode) {
      const dryGain = this.ctx.createGain();
      const wetGain = this.ctx.createGain();
      dryGain.gain.value = 1 - this.reverbMix * 0.5;
      wetGain.gain.value = this.reverbMix;

      lastNode.connect(dryGain);
      lastNode.connect(this.reverbNode);
      this.reverbNode.connect(wetGain);
      dryGain.connect(this.gainNode);
      wetGain.connect(this.gainNode);
    } else {
      lastNode.connect(this.gainNode);
    }

    if (this.echoMix > 0 && this.echoNode && this.echoFeedback) {
      this.gainNode.connect(this.analyser);
      this.gainNode.connect(this.echoNode);
      this.echoNode.connect(this.echoFeedback);
      this.echoFeedback.connect(this.echoNode);
      this.echoNode.connect(this.analyser);
    } else {
      this.gainNode.connect(this.analyser);
    }

    this.analyser.connect(this.ctx.destination);
  }

  private reconnect(audio?: HTMLAudioElement): void {
    if (audio && this.ctx) {
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
      this.source = this.ctx.createMediaElementSource(audio);
      this.audio = audio;
    }
    this.reconnectEffects();
  }

  setVolume(volume: number): void {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  setEQEnabled(enabled: boolean): void {
    this._eqEnabled = enabled;
    this.reconnect();
  }

  get eqEnabled(): boolean {
    return this._eqEnabled;
  }

  setEQBand(index: number, gain: number): void {
    this._eqBands[index] = gain;
    if (this.filters[index] && this._eqEnabled && this.ctx) {
      this.filters[index].gain.setValueAtTime(gain, this.ctx.currentTime);
    }
  }

  getEQBands(): number[] {
    return [...this._eqBands];
  }

  setEQPreset(preset: string): void {
    const gains = EQ_PRESETS[preset];
    if (!gains) return;
    this._eqBands = [...gains];
    if (this._eqEnabled && this.ctx) {
      this.filters.forEach((filter, i) => {
        filter.gain.setValueAtTime(gains[i], this.ctx!.currentTime);
      });
    }
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  getEQPresetNames(): string[] {
    return Object.keys(EQ_PRESETS);
  }

  getBandLabels(): string[] {
    return BAND_LABELS;
  }

  resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  destroy(): void {
    if (this.ctx) {
      this.disconnectAll();
      this.source = null;
      this.filters = [];
      this.gainNode = null;
      this.analyser = null;
      this.reverbNode = null;
      this.echoNode = null;
      this.echoFeedback = null;
      this.audio = null;
      this.ctx.close();
      this.ctx = null;
      this.connected = false;
    }
  }
}

export const audioEngine = new AudioEngine();
