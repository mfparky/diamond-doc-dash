import { describe, expect, it } from 'vitest';
import { getContrastTextColor, isValidHexColor, normalizeHex, rgbToHex } from './color-utils';

describe('isValidHexColor', () => {
  it('accepts 6-digit hex with or without a leading #', () => {
    expect(isValidHexColor('#c6f135')).toBe(true);
    expect(isValidHexColor('c6f135')).toBe(true);
  });

  it('rejects 3-digit shorthand, invalid characters, and wrong length', () => {
    expect(isValidHexColor('#fff')).toBe(false);
    expect(isValidHexColor('#gggggg')).toBe(false);
    expect(isValidHexColor('#c6f13')).toBe(false);
    expect(isValidHexColor('')).toBe(false);
  });
});

describe('normalizeHex', () => {
  it('adds a leading # and lowercases', () => {
    expect(normalizeHex('C6F135')).toBe('#c6f135');
    expect(normalizeHex('#C6F135')).toBe('#c6f135');
  });
});

describe('rgbToHex', () => {
  it('converts and clamps out-of-range values', () => {
    expect(rgbToHex(198, 241, 53)).toBe('#c6f135');
    expect(rgbToHex(-10, 300, 0)).toBe('#00ff00');
  });
});

describe('getContrastTextColor', () => {
  it('picks black text on light/bright backgrounds', () => {
    expect(getContrastTextColor('#ffffff')).toBe('#000000');
    expect(getContrastTextColor('#c6f135')).toBe('#000000'); // Athlete volt green
  });

  it('picks white text on dark backgrounds', () => {
    expect(getContrastTextColor('#000000')).toBe('#ffffff');
    expect(getContrastTextColor('#0a0a0a')).toBe('#ffffff');
    expect(getContrastTextColor('#1c1e54')).toBe('#ffffff'); // deep navy
  });

  it('falls back to black text for an invalid color rather than throwing', () => {
    expect(getContrastTextColor('not-a-color')).toBe('#000000');
  });
});
