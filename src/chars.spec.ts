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

  describe.each(['text', 'multiline'] as const)('%s', (set) => {
    it.each([
      ['a zero width space', '\u200B'],
      ['a soft hyphen', '\u00AD'],
      ['a word joiner', '\u2060'],
      ['a left-to-right mark', '\u200E'],
      ['a byte order mark', '\uFEFF'],
      ['a bidi override', '\u202E'],
      ['a tag character', '\u{E0041}'],
      ['private use', '\uE000'],
      ['a surrogate without a pair', '\uD800'],
      ['a noncharacter', '\uFFFF'],
      ['another noncharacter', '\uFDD0'],
      ['an astral noncharacter', '\u{1FFFE}'],
      ['a Hangul filler', '\u3164'],
      ['a Hangul choseong filler', '\u115F'],
      ['a Hangul jungseong filler', '\u1160'],
      ['a halfwidth Hangul filler', '\uFFA0'],
      ['a blank Braille pattern', '\u2800'],
    ])('refuses %s', (_name, char) => {
      expect(badChar(`a${char}b`, set)).toBe(char);
    });

    it.each([
      ['a joiner', '\u200D'],
      ['a non-joiner', '\u200C'],
      ['a combining mark', '\u0301'],
      ['a variation selector', '\uFE0F'],
    ])('refuses %s at the start, not after a character', (_name, char) => {
      expect(badChar(char, set)).toBe(char);
      expect(badChar(`${char}a`, set)).toBe(char);
      expect(badChar(`a${char}`, set)).toBeUndefined();
    });

    it.each([
      ['a family emoji (joiners)', '👨\u200D👩\u200D👧'],
      ['a heart (variation selector)', '❤\uFE0F'],
      ['a keycap', '1\uFE0F\u20E3'],
      ['a flag', '🇧🇬'],
      ['Persian (non-joiner)', 'می\u200Cخواهم'],
      ['Hindi (joiner)', 'क्\u200Dष'],
      ['Arabic', 'شركة'],
      ['symbols', '© № € → ½'],
    ])('accepts %s', (_name, value) => {
      expect(badChar(value, set)).toBeUndefined();
    });

    it('accepts unassigned code points: engines disagree on which those are', () => {
      expect(badChar('a\u0378b', set)).toBeUndefined();
    });
  });

  it.each(['name', 'place', 'address'] as const)(
    '%s refuses the Hangul fillers, which are letters by category',
    (set) => {
      for (const char of ['\u3164', '\u115F', '\u1160', '\uFFA0'])
        expect(badChar(`a${char}b`, set)).toBe(char);
      expect(badChar('한글', set)).toBeUndefined();
    }
  );

  it('takes a custom regex, also with the g flag', () => {
    const vowels = /[aeiou]/gu;
    expect(badChar('xyz', vowels)).toBeUndefined();
    expect(badChar('xaz', vowels)).toBe('a');
    expect(badChar('xaz', vowels)).toBe('a');
  });
});

describe('apostrophes as people type them', () => {
  it('passes in names, places and addresses', () => {
    for (const set of ['name', 'place', 'address'] as const)
      for (const value of ["D'Angelo", 'D’Angelo', 'Sant´Angelo', 'L`Aquila'])
        expect(badChar(value, set)).toBeUndefined();
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

  it('looks for a long run only where a run starts: runs of 30 cost little', () => {
    // `\p{M}{31}` tried from every mark (30 steps a character) took 3.3 s here,
    // tried where a run starts 0.6 s
    const runs = `a${marks(30)}`.repeat(32_000);
    const start = performance.now();
    expect(nfc(runs)).not.toBe(runs);
    for (const set of sets) expect(badChar(runs, set)).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('names the same character as the sets that tried every mark', () => {
    const free =
      '^[\\p{M}\\u200C\\u200D]|\\p{M}{31}|(?![\\u200C\\u200D])[\\p{Cf}\\p{Cs}\\p{Co}\\p{NChar}\\u115F\\u1160\\u2800\\u3164\\uFFA0]';
    /* eslint-disable no-useless-escape -- copied as they were, v-flag escapes included */
    const before = {
      text: new RegExp(`${free}|\\p{Cc}`, 'u'),
      multiline: new RegExp(`${free}|[\\x00-\\x08\\x0B-\\x1F\\x7F-\\x9F]`, 'u'),
      name: /[^\p{L}\p{M} '’´`\-.·・]|[\u115F\u1160\u3164\uFFA0]|\p{M}{31}/u,
      place:
        /[^\p{L}\p{M}\p{N} '’´`\-.·・\(\),\/（），、]|[\u115F\u1160\u3164\uFFA0]|\p{M}{31}/u,
      address:
        /[^\p{L}\p{M}\p{N} '’´`\-.·・\(\),\/（），、#№:&"〒−－]|[\u115F\u1160\u3164\uFFA0]|\p{M}{31}/u,
    };
    /* eslint-enable no-useless-escape */
    const pool = ['a', '<', '1', ' ', '\u0323', '\u200D', '\u202E', '\u0007'];
    let seed = 1;
    const random = (n: number) => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed % n;
    };
    for (let i = 0; i < 20_000; i++) {
      // runs of marks around 31 long, other characters before, after, inside
      let value = '';
      while (value.length < 80)
        value +=
          random(2) === 0 ?
            '\u0301'.repeat(random(40))
          : `${pool[random(pool.length)]}${i % 2 === 0 ? '\uD800' : ''}`;
      for (const set of sets)
        expect([set, value, badChar(value, set)]).toEqual([
          set,
          value,
          value.match(before[set])?.[0],
        ]);
    }
  });
});

describe('codePoints', () => {
  it('counts an emoji once and combining marks apart', () => {
    expect(codePoints('abc')).toBe(3);
    expect(codePoints('😀')).toBe(1);
    expect('😀'.length).toBe(2);
    expect(codePoints('e\u0301')).toBe(2);
  });

  it('counts like Array.from, also on surrogates without a pair', () => {
    for (const value of [
      '',
      '\ud83d\ude00\ud83d\ude00',
      'a\ud83d\ude00b',
      '\uD83D',
      '\uDE00',
      '\uDE00\uD83D',
      'a\uD83Db',
      '\uD83D\uD83D\uDE00',
      '\ud83d\ude00\uDE00',
    ])
      expect(codePoints(value)).toBe(Array.from(value).length);
  });
});
