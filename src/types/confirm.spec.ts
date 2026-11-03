import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { confirm } from './confirm.js';

describe('confirm', () => {
  for (const c of typeContract(confirm, [{}, { of: 'email' }]))
    it(c.name, c.run);

  it('the start of the other value is incomplete, anything else an error', () => {
    const field = confirm();
    const values = { password: 'Secret-123' };
    expect(field.check('Secret', values)).toMatchObject({
      stage: 'rule',
      message: 'The two values differ.',
      incomplete: true,
    });
    expect(field.check('Sx', values)).toMatchObject({ incomplete: false });
    expect(field.check('Secret-123', values).state).toBe('valid');
    expect(field.check('x', {})).toMatchObject({ incomplete: false });
  });
});
