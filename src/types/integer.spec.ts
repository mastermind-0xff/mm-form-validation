import { describe, expect, it } from 'vitest';

import { typeContract } from '../testing/type-contract.js';
import { integer } from './integer.js';

describe('integer', () => {
  for (const c of typeContract(integer, [
    {},
    { min: 1, max: 99 },
    { min: 1 },
    { min: -5, max: 5 },
  ]))
    it(c.name, c.run);

  it('gives a number, from a number or from digits', () => {
    expect(integer().check(12)).toEqual({ state: 'valid', value: 12 });
    expect(integer().check(' 12 ')).toEqual({ state: 'valid', value: 12 });
    expect(integer().check('-3')).toEqual({ state: 'valid', value: -3 });
    expect(integer().check(0)).toEqual({ state: 'valid', value: 0 });
  });

  it('says the range', () => {
    expect(integer({ min: 1, max: 99 }).check(100)).toMatchObject({
      stage: 'rule',
      message: 'Enter a number from 1 to 99.',
    });
  });

  it('refuses what is not a whole number a JavaScript number can hold', () => {
    for (const raw of ['1e3', '0x10', '1,000', 1e21, '9007199254740993'])
      expect(integer().check(raw)).toMatchObject({ state: 'invalid' });
  });

  it('refuses booleans, which JSON clients may send', () => {
    expect(integer().check(true)).toMatchObject({ stage: 'type' });
  });

  it('treats a lone minus as unfinished', () => {
    expect(integer().check('-')).toMatchObject({
      stage: 'pattern',
      incomplete: true,
    });
  });
});
