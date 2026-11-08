import { describe, expect, it } from 'vitest';

import { defineForm } from '../core/define-form.js';
import { formCases } from '../testing/form-cases.js';
import { typeContract } from '../testing/type-contract.js';
import { email } from './email.js';
import { honeypot } from './honeypot.js';

describe('honeypot', () => {
  for (const c of typeContract(honeypot)) it(c.name, c.run);

  const form = defineForm({ email: email(), website: honeypot() });

  it("passes empty or missing, and its value is ''", () => {
    for (const body of [
      { email: 'a@example.com' },
      { email: 'a@example.com', website: '' },
      { email: 'a@example.com', website: false },
    ])
      expect(form.parse(body)).toEqual({
        ok: true,
        values: { email: 'a@example.com', website: '' },
      });
  });

  it('refuses a filled one, without saying why', () => {
    for (const website of ['x', ' ', 1, 0, -1.5, true])
      expect(form.parse({ email: 'a@example.com', website })).toEqual({
        ok: false,
        errors: [
          {
            field: 'website',
            stage: 'rule',
            message: 'This form could not be sent.',
          },
        ],
        first: {
          field: 'website',
          stage: 'rule',
          message: 'This form could not be sent.',
        },
      });
  });

  it('fails at type on what no form sends', () => {
    for (const raw of [{}, [], null])
      expect(honeypot().check(raw)).toMatchObject({ stage: 'type' });
  });

  describe('a form with a honeypot passes its own cases', () => {
    for (const c of formCases(form, {
      valid: { email: 'a@example.com', website: '' },
    }))
      it(c.name, c.run);
  });
});
