import { describe, expect, it } from 'vitest';

import { fieldAttributes } from '../core/attributes.js';
import { defineForm } from '../core/define-form.js';
import { preset } from '../core/define-type.js';
import { formCases } from '../testing/form-cases.js';
import { typeContract } from '../testing/type-contract.js';
import { email } from './email.js';
import { honeypot } from './honeypot.js';

describe('honeypot', () => {
  for (const c of typeContract(honeypot)) it(c.name, c.run);

  const form = defineForm({ email: email(), extra_note: honeypot() });

  it("passes empty or missing, and its value is ''", () => {
    for (const body of [
      { email: 'a@example.com' },
      { email: 'a@example.com', extra_note: '' },
      { email: 'a@example.com', extra_note: false },
    ])
      expect(form.parse(body)).toEqual({
        ok: true,
        values: { email: 'a@example.com', extra_note: '' },
      });
  });

  it('refuses a filled one, without saying why', () => {
    for (const extra_note of ['x', ' ', 1, 0, -1.5, true])
      expect(form.parse({ email: 'a@example.com', extra_note })).toEqual({
        ok: false,
        errors: [
          {
            field: 'extra_note',
            stage: 'rule',
            message: 'This form could not be sent.',
          },
        ],
        first: {
          field: 'extra_note',
          stage: 'rule',
          message: 'This form could not be sent.',
        },
      });
  });

  it('is optional by its type: a preset of it too, and from JavaScript', () => {
    const trap = preset(honeypot, { name: 'trap' });
    const fields = defineForm({
      email: email(),
      extra: trap(),
      again: honeypot({ required: undefined } as unknown as object),
      strict: honeypot({ required: true }),
    });
    expect(trap.spec.required).toBe(false);
    expect(fields.parse({ email: 'a@example.com' })).toMatchObject({
      ok: false,
      errors: [{ field: 'strict', stage: 'required' }],
    });
    expect(fieldAttributes(fields, 'extra')).not.toHaveProperty('required');
  });

  it('fails at type on what no form sends', () => {
    for (const raw of [{}, [], null])
      expect(honeypot().check(raw)).toMatchObject({ stage: 'type' });
  });

  describe('a form with a honeypot passes its own cases', () => {
    for (const c of formCases(form, {
      valid: { email: 'a@example.com', extra_note: '' },
    }))
      it(c.name, c.run);
  });
});
