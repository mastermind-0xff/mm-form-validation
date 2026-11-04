import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { multiline } from './multiline.js';

describe('multiline', () => {
  for (const c of typeContract(multiline, [
    {},
    { max: 200, maxLines: 3 },
    { max: 30, maxLines: 1 },
    { min: 10, max: 1000 },
  ]))
    it(c.name, c.run);

  it('keeps line breaks, drops trailing spaces and blank lines around', () => {
    expect(
      multiline().check('\r\n  First line  \r\nSecond\t\rThird \n\n')
    ).toEqual({ state: 'valid', value: 'First line\nSecond\nThird' });
  });

  it('drops spaces at the end of each line and keeps them elsewhere', () => {
    const value = (raw: string) => {
      const result = multiline().check(raw);
      return result.state === 'valid' ? result.value : result.state;
    };
    expect(value('a  \nb')).toBe('a\nb');
    expect(value('a b  c')).toBe('a b  c');
    expect(value('a \t \n  b')).toBe('a\n  b');
    expect(value('a\u00a0\nb')).toBe('a\nb');
    // a line separator ends a line too, and is itself white space
    expect(value('a \u2028 b')).toBe('a\u2028 b');
    expect(value('a \u2028\u2029 b')).toBe('a\u2029 b');
    expect(value('a\u2028 b')).toBe('a\u2028 b');
    expect(value('a \u2028 \nb')).toBe('a\nb');
  });

  it('stays fast on a long run of spaces that does not end a line', () => {
    const start = performance.now();
    const result = multiline().check(`a${' '.repeat(64_000)}x`);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result).toMatchObject({ state: 'invalid', stage: 'length' });
  });

  it('stays fast on a long run of combining marks', () => {
    const start = performance.now();
    const result = multiline({ max: 1_000_000 }).check(
      `a${'\u0301\u0323'.repeat(51_000)}`
    );
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result).toMatchObject({ state: 'invalid', stage: 'chars' });
  });

  it('counts lines', () => {
    expect(multiline({ maxLines: 2 }).check('a\nb\nc')).toMatchObject({
      stage: 'lines',
      message: 'At most 2 lines (now 3).',
      incomplete: false,
    });
    expect(multiline({ maxLines: 1 }).check('a\nb')).toMatchObject({
      message: 'At most 1 line (now 2).',
    });
  });
});
