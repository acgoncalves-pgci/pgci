import { describe, expect, it } from 'vitest';
import { contrastRatio, readableAccentColor, readableTextColor } from './colorContrast';

describe('WCAG contrast for configurable palettes', () => {
  it('selects readable foregrounds for light, dark and middle backgrounds', () => {
    for (const background of ['#ffffff', '#020907', '#777777', '#f59e0b', '#7c3aed']) {
      expect(contrastRatio(readableTextColor(background), background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('preserves an accessible accent and adjusts a low contrast accent for text', () => {
    expect(readableAccentColor('#17628b', '#ffffff')).toBe('#17628b');
    for (const [accent, background] of [['#ffffff', '#ffffff'], ['#444444', '#020907'], ['#f59e0b', '#fffbeb'], ['#7c3aed', '#ffffff']]) {
      expect(contrastRatio(readableAccentColor(accent, background), background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
