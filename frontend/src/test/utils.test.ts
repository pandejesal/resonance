import { describe, it, expect } from 'vitest';
import { formatDuration, shuffleArray, getArtworkUrl, formatFileSize, formatNumber, formatDurationLong, cn, generateGradient, getDominantColor } from '../lib/utils';

describe('formatDuration', () => {
  it('should format 0 milliseconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('should format seconds correctly', () => {
    expect(formatDuration(30000)).toBe('0:30');
    expect(formatDuration(45000)).toBe('0:45');
  });

  it('should format minutes and seconds correctly', () => {
    expect(formatDuration(60000)).toBe('1:00');
    expect(formatDuration(90000)).toBe('1:30');
    expect(formatDuration(125000)).toBe('2:05');
  });

  it('should format hours correctly', () => {
    expect(formatDuration(3600000)).toBe('1:00:00');
    expect(formatDuration(3661000)).toBe('1:01:01');
    expect(formatDuration(7200000)).toBe('2:00:00');
  });

  it('should handle edge cases', () => {
    expect(formatDuration(1000)).toBe('0:01');
    expect(formatDuration(59999)).toBe('0:59'); // 59.999 seconds rounds to 59 seconds
  });
});

describe('formatDurationLong', () => {
  it('should format 0 as 0 minutes', () => {
    expect(formatDurationLong(0)).toBe('0 minutes');
  });

  it('should format minutes correctly', () => {
    expect(formatDurationLong(60000)).toBe('1 minute');
    expect(formatDurationLong(300000)).toBe('5 minutes');
  });

  it('should format hours correctly', () => {
    expect(formatDurationLong(3600000)).toBe('1 hour');
    expect(formatDurationLong(3660000)).toBe('1 hour, 1 minute');
    expect(formatDurationLong(7200000)).toBe('2 hours');
  });
});

describe('formatNumber', () => {
  it('should format small numbers as is', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(999)).toBe('999');
  });

  it('should format thousands with K', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(100000)).toBe('100.0K');
  });

  it('should format millions with M', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
  });
});

describe('shuffleArray', () => {
  it('should return an array of the same length', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    expect(shuffled.length).toBe(original.length);
  });

  it('should contain all original elements', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    original.forEach(item => {
      expect(shuffled).toContain(item);
    });
  });

  it('should not modify the original array', () => {
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];
    shuffleArray(original);
    expect(original).toEqual(originalCopy);
  });

  it('should handle empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it('should handle single element array', () => {
    expect(shuffleArray([1])).toEqual([1]);
  });
});

describe('getArtworkUrl', () => {
  it('should return correct URL format', () => {
    const trackId = 'abc123';
    const url = getArtworkUrl(trackId);
    expect(url).toContain('/api/tracks/');
    expect(url).toContain('/artwork');
    expect(url).toContain('abc123');
  });

  it('should handle special characters in track ID', () => {
    const trackId = 'abc-123_456';
    const url = getArtworkUrl(trackId);
    expect(url).toBeTruthy();
  });
});

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10240)).toBe('10 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
    expect(formatFileSize(10485760)).toBe('10 MB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
    expect(formatFileSize(1610612736)).toBe('1.5 GB');
  });
});

describe('cn (class name utility)', () => {
  it('should merge class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBeTruthy();
  });
});

describe('generateGradient', () => {
  it('should return a gradient string', () => {
    const gradient = generateGradient('test');
    expect(gradient).toContain('linear-gradient');
    expect(gradient).toContain('hsl');
  });

  it('should generate consistent gradients for same input', () => {
    const gradient1 = generateGradient('test123');
    const gradient2 = generateGradient('test123');
    expect(gradient1).toBe(gradient2);
  });
});

describe('getDominantColor', () => {
  it('should return an RGB object', () => {
    const color = getDominantColor('test');
    expect(color).toHaveProperty('r');
    expect(color).toHaveProperty('g');
    expect(color).toHaveProperty('b');
  });

  it('should return valid RGB values', () => {
    const color = getDominantColor('test');
    expect(color.r).toBeGreaterThanOrEqual(0);
    expect(color.r).toBeLessThanOrEqual(255);
    expect(color.g).toBeGreaterThanOrEqual(0);
    expect(color.g).toBeLessThanOrEqual(255);
    expect(color.b).toBeGreaterThanOrEqual(0);
    expect(color.b).toBeLessThanOrEqual(255);
  });
});
