import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { checkbox } from './checkbox.js';

describe('checkbox', () => {
  for (const c of typeContract(checkbox)) it(c.name, c.run);

  it('reads the usual ticked and unticked values', () => {
    const field = checkbox({ required: false });
    for (const raw of [true, 1, '1', 'on', 'true'])
      expect(field.check(raw)).toEqual({ state: 'valid', value: true });
    for (const raw of [false, 0, '0', 'off', 'false', '', undefined])
      expect(field.check(raw)).toEqual({ state: 'empty' });
    expect(field.empty).toBe(false);
  });

  it('required means ticked', () => {
    expect(checkbox().check(false)).toMatchObject({
      stage: 'required',
      message: 'Please tick this box.',
    });
  });
});
