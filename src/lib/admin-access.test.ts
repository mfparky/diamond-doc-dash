import { describe, it, expect } from 'vitest';
import { isRankingsAdminEmail, isPlatformAdminEmail } from './admin-access';

describe('isRankingsAdminEmail', () => {
  it('allows the hawkscoachmatt address', () => {
    expect(isRankingsAdminEmail('hawkscoachmatt@gmail.com')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isRankingsAdminEmail('HawksCoachMatt@Gmail.com')).toBe(true);
    expect(isRankingsAdminEmail('HAWKSCOACHMATT@GMAIL.COM')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isRankingsAdminEmail('  hawkscoachmatt@gmail.com  ')).toBe(true);
  });

  it('rejects any other email', () => {
    expect(isRankingsAdminEmail('coach@example.com')).toBe(false);
    expect(isRankingsAdminEmail('mfparkinson@gmail.com')).toBe(false);
  });

  it('rejects empty / undefined / null safely', () => {
    expect(isRankingsAdminEmail('')).toBe(false);
    expect(isRankingsAdminEmail(undefined)).toBe(false);
    expect(isRankingsAdminEmail(null)).toBe(false);
  });
});

describe('isPlatformAdminEmail', () => {
  it('allows the hawkscoachmatt address', () => {
    expect(isPlatformAdminEmail('hawkscoachmatt@gmail.com')).toBe(true);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(isPlatformAdminEmail('HawksCoachMatt@Gmail.com')).toBe(true);
    expect(isPlatformAdminEmail('  hawkscoachmatt@gmail.com  ')).toBe(true);
  });

  it('rejects any other email', () => {
    expect(isPlatformAdminEmail('coach@example.com')).toBe(false);
  });

  it('rejects empty / undefined / null safely', () => {
    expect(isPlatformAdminEmail('')).toBe(false);
    expect(isPlatformAdminEmail(undefined)).toBe(false);
    expect(isPlatformAdminEmail(null)).toBe(false);
  });
});
