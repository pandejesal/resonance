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

  get isReady(): boolean {
    return this.ctx !== null && this.connected;
  }

  init(audio: HTMLAudioElement): void {
    if (this.ctx) return;

    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaElementSource(audio);

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

    this.reconnect();
    this.connected = true;
  }

  private reconnect(): void {
    if (!this.source || !this.gainNode || !this.analyser || !this.ctx) return;

    this.source.disconnect();
    this.filters.forEach((f) => f.disconnect());

    if (this._eqEnabled) {
      let node: AudioNode = this.source;
      for (const filter of this.filters) {
        node.connect(filter);
        node = filter;
      }
      node.connect(this.gainNode);
    } else {
      this.source.connect(this.gainNode);
    }

    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(volume, this.ctx!.currentTime);
    }
  }

  setEQEnabled(enabled: boolean): void {
    this._eqEnabled = enabled;
    this.reconnect();
  }

  getEQEnabled(): boolean {
    return this._eqEnabled;
  }

  setEQBand(index: number, gain: number): void {
    this._eqBands[index] = gain;
    if (this.filters[index] && this._eqEnabled) {
      this.filters[index].gain.setValueAtTime(gain, this.ctx!.currentTime);
    }
  }

  getEQBands(): number[] {
    return [...this._eqBands];
  }

  setEQPreset(preset: string): void {
    const gains = EQ_PRESETS[preset];
    if (!gains) return;
    this._eqBands = [...gains];
    this.filters.forEach((filter, i) => {
      if (this._eqEnabled) {
        filter.gain.setValueAtTime(gains[i], this.ctx!.currentTime);
      }
    });
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

  resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  destroy(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.connected = false;
    }
  }
}

export const audioEngine = new AudioEngine();
