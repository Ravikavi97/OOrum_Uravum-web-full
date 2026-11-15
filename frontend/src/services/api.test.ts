import { describe, expect, it } from 'vitest';
import { parseThemeColors } from './api';

describe('parseThemeColors', () => {
  it('accepts a complete theme made of six-digit hex colors', () => {
    const colors = {
      primaryDark: '#285430',
      accentRed: '#259306',
      background: '#F5EFE3',
      foreground: '#171717',
      cardBg: '#ffffff',
    };

    expect(parseThemeColors(JSON.stringify(colors))).toEqual(colors);
  });

  it('rejects malformed, incomplete, or non-hex theme values', () => {
    expect(parseThemeColors(undefined)).toBeNull();
    expect(parseThemeColors('{')).toBeNull();
    expect(parseThemeColors(JSON.stringify({ primaryDark: '#285430' }))).toBeNull();
    expect(parseThemeColors(JSON.stringify({
      primaryDark: 'url(javascript:alert(1))',
      accentRed: '#259306',
      background: '#F5EFE3',
      foreground: '#171717',
      cardBg: '#ffffff',
    }))).toBeNull();
  });
});
