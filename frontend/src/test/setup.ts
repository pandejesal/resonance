import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Audio context for audio engine
class MockAudioContext {
  createMediaElementSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: { value: 1, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createAnalyser = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  }));
  destination = {};
  currentTime = 0;
  state = 'running';
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: MockAudioContext,
});

// Mock HTMLAudioElement
class MockAudioElement {
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
  src = '';
  currentTime = 0;
  duration = 0;
  volume = 1;
  preload = 'auto';
  crossOrigin = 'anonymous';
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

Object.defineProperty(window, 'HTMLAudioElement', {
  writable: true,
  value: MockAudioElement,
});

export {};
