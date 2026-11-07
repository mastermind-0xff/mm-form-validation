import { describe, expect, it } from 'vitest';

import { defineForm } from '../core/define-form.js';
import { typeContract } from '../testing/type-contract.js';
import { email } from './email.js';
import { honeypot } from './honeypot.js';

describe('honeypot', () => {
  for (const c of typeContract(honeypot)) it(c.name, c.run);

  const form = defineForm({ email: email(), website: honeypot() });

  it('passes empty, and says false', () => {
    for (const body of [
      { email: 'a@example.com' },
      { email: 'a@example.com', website: '' },
    ])
      expect(form.parse(body)).toEqual({
        ok: true,
        values: { email: 'a@example.com', website: false },
      });
  });

  it('never refuses a filled one: the value says so', () => {
    expect(form.parse({ email: 'a@example.com', website: 'x' })).toEqual({
      ok: true,
      values: { email: 'a@example.com', website: true },
    });
  });

  it('takes spaces as filled, since a person never sees the field', () => {
    expect(honeypot().check(' ')).toEqual({ state: 'valid', value: true });
  });

  it('fails at type on what no form sends', () => {
    expect(honeypot().check({})).toMatchObject({ stage: 'type' });
  });
});
