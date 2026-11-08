import { describe, expect, it } from 'vitest';

import { typeContract } from '../testing/type-contract.js';
import { code } from './code.js';

describe('code', () => {
  for (const c of typeContract(code, [
    {},
    { max: 8 },
    { min: 20, max: 100 },
    { upper: true },
    { chars: 'digits', max: 3 },
    { chars: /[^A-Z0-9]/u, min: 5, max: 40 },
    { chars: /[^A-Z0-9]/u, upper: true, max: 10 },
  ]))
    it(c.name, c.run);

  it('trims and keeps the case', () => {
    expect(code().check('  BFall-2026_x ')).toEqual({
      state: 'valid',
      value: 'BFall-2026_x',
    });
  });

  it('stores upper case when asked', () => {
    expect(code({ upper: true }).check(' bfall ')).toEqual({
      state: 'valid',
      value: 'BFALL',
    });
  });

  it('refuses what a code can not hold, at once', () => {
    const result = code().check('a b');
    expect(result).toMatchObject({
      state: 'invalid',
      stage: 'chars',
      message: 'Spaces are not allowed.',
      incomplete: false,
    });
    expect(code().check('<x>')).toMatchObject({ stage: 'chars' });
  });

  it('takes the length from the arguments', () => {
    expect(code({ min: 3 }).check('ab')).toMatchObject({
      stage: 'length',
      incomplete: true,
    });
    expect(code().check('x'.repeat(65))).toMatchObject({
      stage: 'length',
      incomplete: false,
    });
  });

  it('checks the upper-cased value, which is what is stored', () => {
    // "ß" is "SS" in upper case: 6 characters stored for 3 typed
    expect(
      code({ upper: true, chars: 'text', max: 3 }).check('ßßß')
    ).toMatchObject({
      stage: 'length',
      message: 'At most 3 characters (now 6).',
    });
    expect(code({ chars: 'text', max: 3 }).check('ßßß')).toEqual({
      state: 'valid',
      value: 'ßßß',
    });
    // a set of capitals takes lower case typed into an upper-case code
    expect(code({ upper: true, chars: /[^A-Z]/u }).check('abc')).toEqual({
      state: 'valid',
      value: 'ABC',
    });
    expect(code({ chars: /[^A-Z]/u }).check('abc')).toMatchObject({
      stage: 'chars',
    });
  });
});
