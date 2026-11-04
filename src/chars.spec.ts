import { describe, expect, it } from 'vitest';
import { badChar, charSets, codePoints, kinds, nfc } from './chars.js';

describe('charSets', () => {
  it('compile with the v flag too (they may end up in a pattern attribute)', () => {
    for (const re of [...Object.values(charSets), ...Object.values(kinds)])
      expect(() => new RegExp(re.source, 'v')).not.toThrow();
  });

  it.each([
    ['text', 'Ae Sweets Ltd. Café №5 <b>', undefined],
    ['text', 'tab\there', '\t'],
    ['text', 'bidi\u202Eoverride', '\u202E'],
    ['multiline', 'two\nlines\tand a tab', undefined],
    ['multiline', 'bell\u0007', '\u0007'],
    ['name', 'Anne-Marie O’Neil', undefined],
    ['name', 'Тихомир Трифонов', undefined],
    ['name', 'José Ñúñez', undefined],
    ['name', 'Ann3', '3'],
    ['place', 'Frankfurt (Oder), 15230/1', undefined],
    ['place', 'Sofia!', '!'],
    ['address', 'ul. "Vitosha" № 1, ap. 4 & 5: #2', undefined],
    ['address', 'Main St. <1>', '<'],
    ['digits', '0123456789', undefined],
    ['digits', '12a', 'a'],
    ['alnum', 'AZaz09', undefined],
    ['alnum', 'A-1', '-'],
    ['code', 'SUMMER_24-x', undefined],
    ['code', 'NO SPACE', ' '],
  ] as const)('%s: %j → %j', (set, value, bad) => {
    expect(badChar(value, set)).toBe(bad);
  });

  it('takes a custom regex, also with the g flag', () => {
    const vowels = /[aeiou]/gu;
    expect(badChar('xyz', vowels)).toBeUndefined();
    expect(badChar('xaz', vowels)).toBe('a');
    expect(badChar('xaz', vowels)).toBe('a');
  });
});

describe('nfc', () => {
  const marks = (n: number) => '\u0301\u0323'.repeat(n / 2);
  const sets = ['text', 'multiline', 'name', 'place', 'address'] as const;

  it('composes, up to the 30 marks in a row any text needs (UAX #15)', () => {
    expect(nfc('e\u0301')).toBe('é');
    expect(nfc(`a${marks(30)}`)).toBe(`a${marks(30)}`.normalize('NFC'));
  });

  it('leaves a longer run alone: the named sets refuse it', () => {
    const long = `a${marks(32)}`;
    expect(nfc(long)).toBe(long);
    for (const set of sets) {
      expect(badChar(long, set)).toBeDefined();
      expect(badChar(`a${marks(30)}`, set)).toBeUndefined();
    }
  });

  it('stays fast however many marks there are', () => {
    const start = performance.now();
    nfc(`a${marks(200_000)}`);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('codePoints', () => {
  it('counts an emoji once and combining marks apart', () => {
    expect(codePoints('abc')).toBe(3);
    expect(codePoints('😀')).toBe(1);
    expect('😀'.length).toBe(2);
    expect(codePoints('e\u0301')).toBe(2);
  });
});
