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
});
