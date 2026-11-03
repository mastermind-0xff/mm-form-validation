import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { password } from './password.js';

describe('password', () => {
  for (const c of typeContract(password, [
    {},
    { min: 1, max: 12 },
    { min: 12 },
  ]))
    it(c.name, c.run);

  it('is never trimmed or normalized', () => {
    expect(password().check('  secret 1  ')).toEqual({
      state: 'valid',
      value: '  secret 1  ',
    });
    expect(password().check('Café 1234')).toEqual({
      state: 'valid',
      value: 'Café 1234',
    });
  });

  it('says how long it must be', () => {
    expect(password().hint()).toBe('At least 8 characters.');
    expect(password().check('short')).toMatchObject({
      stage: 'length',
      message: 'At least 8 characters.',
      incomplete: true,
    });
  });
});
