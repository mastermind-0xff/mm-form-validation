import { describe, expect, it } from 'vitest';

import { defineForm } from '../core/define-form.js';
import { defineType } from '../core/define-type.js';
import type { FormValues } from '../core/types.js';
import { checkbox } from '../types/checkbox.js';
import { code } from '../types/code.js';
import { confirm } from '../types/confirm.js';
import { email } from '../types/email.js';
import { honeypot } from '../types/honeypot.js';
import { integer } from '../types/integer.js';
import { password } from '../types/password.js';
import { choice, select } from '../types/select.js';
import { personName, place, text } from '../types/text.js';
import { vatNumber } from '../types/vat-number.js';
import { formCases, trapNameProblem } from './form-cases.js';

const isCompany = (v: FormValues) => v['kind'] === '1';

const billing = defineForm({
  kind: choice({ options: ['0', '1'] }),
  country: select({ options: ['BG', 'DE'] }),
  name: personName(),
  company: text({ max: 200, when: isCompany }),
  vat: vatNumber({
    required: false,
    when: isCompany,
    country: (v) => String(v['country']),
  }),
  city: place({ required: isCompany }),
  email: email(),
  password: password(),
  passwordConfirm: confirm(),
  discount: code({ required: false }),
  quantity: integer({ min: 1, max: 99 }),
  extraNote: honeypot(),
  consent: checkbox(),
});

const person = {
  kind: '0',
  country: 'BG',
  name: 'Ana',
  city: '',
  email: 'ana@example.com',
  password: 'long enough',
  passwordConfirm: 'long enough',
  discount: '',
  quantity: 2,
  extraNote: '',
  consent: true,
};

const company = {
  ...person,
  kind: '1',
  company: 'Ana Ltd.',
  vat: 'BG123456789',
  city: 'Sofia',
};

/** The cases of a form that must fail, by the name of the one that fails. */
function failing(cases: ReturnType<typeof formCases>): string[] {
  return cases.flatMap((c) => {
    try {
      c.run();
      return [];
    } catch {
      return [c.name];
    }
  });
}

describe('formCases', () => {
  describe('a person', () => {
    for (const c of formCases(billing, {
      valid: person,
      invalid: { city: ['1', '<b>'], quantity: [0, 100] },
    }))
      it(c.name, c.run);
  });

  describe('a company', () => {
    for (const c of formCases(billing, {
      valid: company,
      invalid: { vat: ['DE123456789', 'BG12'] },
    }))
      it(c.name, c.run);
  });

  it('ignores the fields a sample switches off', () => {
    const names = formCases(billing, { valid: person }).map((c) => c.name);
    expect(names).toContain('company (text): inactive in this sample, ignored');
    expect(names).toContain(
      'vat (vatNumber): inactive in this sample, ignored'
    );
  });

  it('fails when a field has no valid value', () => {
    const partial = Object.fromEntries(
      Object.entries(person).filter(([key]) => key !== 'name')
    );
    expect(failing(formCases(billing, { valid: partial }))).toContain(
      'name (personName): has a valid sample'
    );
  });

  it('fails when the sample is not valid', () => {
    const bad = failing(
      formCases(billing, { valid: { ...person, email: 'nope' } })
    );
    expect(bad).toContain('the valid sample parses');
    expect(bad).toContain('parsing the values again gives the same values');
  });

  it('fails when a value listed as invalid passes', () => {
    expect(
      failing(
        formCases(billing, { valid: person, invalid: { city: ['Sofia'] } })
      )
    ).toEqual(['city: "Sofia" is refused']);
  });

  it('fails when the form has no such field', () => {
    expect(
      failing(
        formCases(billing, { valid: person, invalid: { nothing: ['x'] } })
      )
    ).toEqual(['nothing: listed as invalid']);
  });

  it("fails when a honeypot's name is one autofill guesses or one that says what it is", () => {
    for (const name of ['website', 'fax_number', 'email2', 'hp', 'leaveEmpty'])
      expect(
        failing(
          formCases(defineForm({ [name]: honeypot() }), {
            valid: { [name]: '' },
          })
        )
      ).toEqual([
        `${name} (honeypot): its name guesses nothing autofill fills`,
      ]);
    const fine = defineForm({ extra_note: honeypot() });
    expect(failing(formCases(fine, { valid: { extra_note: '' } }))).toEqual([]);
  });

  it('runs no gates', () => {
    const withGate = defineForm({ email: email({ gates: ['emailFree'] }) });
    expect(
      failing(formCases(withGate, { valid: { email: 'ana@example.com' } }))
    ).toEqual([]);
  });

  it('lets a field rule narrow the type examples', () => {
    const narrow = defineForm({
      word: text({
        max: 5,
        rule: (value) => (value === 'aaaaa' ? 'Not that.' : undefined),
      }),
    });
    expect(failing(formCases(narrow, { valid: { word: 'b' } }))).toEqual([]);
  });

  it("does not let a field rule hide the type's own rule stage", () => {
    // a type whose own `rule` stage refuses one of its valid examples
    const odd = defineType({
      name: 'odd',
      defaults: {},
      stages: [
        {
          name: 'rule',
          check: (value: string) =>
            value === '2' ? { message: 'Not 2.' } : undefined,
        },
      ],
      examples: () => ({ valid: ['1', '2'], invalid: [] }),
    });
    const form = defineForm({
      n: odd({ rule: (value) => (value === '3' ? 'Not 3.' : undefined) }),
    });
    expect(failing(formCases(form, { valid: { n: '1' } }))).toEqual([
      'n (odd): example "2" passes',
    ]);
  });

  it('asks only about the inactive field, when another field reads it', () => {
    const form = defineForm({
      kind: choice({ options: ['0', '1'] }),
      note: text({ when: (v) => v['kind'] === '1' }),
      // reads `note`: junk there switches it on
      extra: text({ when: (v) => v['note'] !== '' }),
    });
    expect(failing(formCases(form, { valid: { kind: '0' } }))).toEqual([]);
  });
});

describe('formCases: confirm', () => {
  it('a retyped e-mail passes its cases: it is compared as the e-mail reads it', () => {
    const form = defineForm({
      email: email(),
      emailAgain: confirm({ of: 'email' }),
    });
    expect(
      failing(
        formCases(form, {
          valid: { email: 'Ana@example.com', emailAgain: 'Ana@example.com' },
          invalid: { emailAgain: ['ana@example.org'] },
        })
      )
    ).toEqual([]);
  });
});

describe('trapNameProblem', () => {
  it('names the word autofill matches, or the one that tells a bot', () => {
    for (const [name, word] of [
      ['website', 'website'],
      ['url', 'url'],
      ['email2', 'mail'],
      ['phone', 'phone'],
      ['fax_number', 'fax'],
      ['companyName', 'company'],
      ['zip', 'zip'],
      ['user-id', 'user'],
      ['extra_hp', 'hp'],
      ['honeypot', 'honey'],
      ['leave_empty', 'leave'],
      // the longer words anywhere, as autofill heuristics match them
      ['velocity', 'city'],
    ] as const)
      expect(trapNameProblem(name)).toBe(
        `"${word}" in "${name}": autofill may fill it, or it tells a bot what it is`
      );
  });

  it('splits an acronym from the word after it', () => {
    for (const [name, word] of [
      ['URLField', 'url'],
      ['CCNumber', 'cc'],
      ['HPField', 'hp'],
      ['myURL', 'url'],
      ['FAX2', 'fax'],
    ] as const)
      expect(trapNameProblem(name)).toBe(
        `"${word}" in "${name}": autofill may fill it, or it tells a bot what it is`
      );
  });

  it('takes a name that guesses nothing', () => {
    for (const name of [
      'extra_note',
      'extraNote',
      'remarks',
      'hotelier',
      'XMLNote',
      'subscribe-extra',
      'register-extra',
    ])
      expect(trapNameProblem(name)).toBeUndefined();
  });
});
