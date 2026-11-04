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
});
