import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { email } from './email.js';

describe('email', () => {
  for (const c of typeContract(email, [{}, { max: 100 }])) it(c.name, c.run);

  it('trims and lower-cases', () => {
    expect(email().check('  Ana@Example.COM ')).toEqual({
      state: 'valid',
      value: 'ana@example.com',
    });
  });

  it('an unfinished address is incomplete, a bad character is not', () => {
    expect(email().check('ana@exam')).toMatchObject({
      stage: 'pattern',
      message: 'Enter a valid e-mail, like name@example.com.',
      incomplete: true,
    });
    expect(email().check('ana,b@example.com')).toMatchObject({
      stage: 'chars',
      message: 'The character "," is not allowed.',
      incomplete: false,
    });
  });

  it.each([
    ['a bidi override', 'x\u202Emoc.elpmaxe@a.cc', '\u202E'],
    ['a zero width space', 'adm\u200Bin@example.com', '\u200B'],
    ['a soft hyphen', 'ad\u00ADmin@example.com', '\u00AD'],
    ['a joiner in the domain', 'x@exam\u200Dple.com', '\u200D'],
    ['a surrogate without a pair', 'a\uD800@b.cc', '\uD800'],
    ['private use', 'a\uE000@b.cc', '\uE000'],
    ['a noncharacter', 'a\uFFFF@b.cc', '\uFFFF'],
    ['a Hangul filler', 'a\u3164b@c.cc', '\u3164'],
  ])('refuses %s', (_name, value, char) => {
    expect(email().check(value)).toMatchObject({
      stage: 'chars',
      incomplete: false,
    });
    expect(email().check(value)).toHaveProperty(
      'message',
      `The character U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} is not allowed.`
    );
  });

  it('refuses a colon: a mailer reads it as a group or a port', () => {
    for (const value of ['a:victim@example.com', 'x@example.com:25'])
      expect(email().check(value)).toMatchObject({
        stage: 'chars',
        message: 'The character ":" is not allowed.',
      });
  });

  it('keeps addresses in other scripts', () => {
    for (const value of ['ана@пример.бг', 'josé@example.com', 'a+b@c.co.uk'])
      expect(email().check(value).state).toBe('valid');
  });

  it('stays fast on a long run of combining marks', () => {
    const start = performance.now();
    const result = email({ max: 1_000_000 }).check(
      `a${'\u0301\u0323'.repeat(51_000)}@example.com`
    );
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result).toMatchObject({ state: 'invalid', stage: 'chars' });
  });

  it('a short max leaves out the long examples', () => {
    const examples = email({ max: 10 }).examples();
    expect(examples.valid).toHaveLength(2);
  });

  it('checks the shape in linear time, even with a large max', () => {
    // each dot of the domain used to start a scan to the end: quadratic
    const start = performance.now();
    const result = email({ max: 100_000 }).check(`a@${'x.'.repeat(49_990)}@`);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result).toMatchObject({ state: 'invalid', stage: 'pattern' });
  });

  it('accepts the same shapes as the quadratic check did', () => {
    const before = /^[^@]+@[^@]+\.[^@]{2,}$/u;
    let all = [''];
    for (let n = 1; n <= 8; n++) {
      all = all.flatMap((s) => ['a', '.', '@'].map((c) => s + c));
      for (const value of all)
        expect([value, email().check(value).state === 'valid']).toEqual([
          value,
          before.test(value),
        ]);
    }
  });
});
