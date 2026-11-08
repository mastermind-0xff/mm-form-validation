import { describe, expect, it } from 'vitest';

import { checkbox } from '../types/checkbox.js';
import { code } from '../types/code.js';
import { confirm } from '../types/confirm.js';
import { email } from '../types/email.js';
import { honeypot } from '../types/honeypot.js';
import { integer } from '../types/integer.js';
import { password } from '../types/password.js';
import { select } from '../types/select.js';
import { personName, place, text } from '../types/text.js';
import { vatNumber } from '../types/vat-number.js';
import { fieldAttributes } from './attributes.js';
import { defineForm } from './define-form.js';
import { defineType, preset } from './define-type.js';
import type { Field, FormValues } from './types.js';

/** The attributes of one field in a form of its own. */
const of = (field: Field, values?: unknown) =>
  fieldAttributes(defineForm({ x: field }), 'x', values);

describe('fieldAttributes', () => {
  it('says required, from the schema', () => {
    expect(of(text())).toEqual({ required: true });
    expect(of(text({ required: false }))).toEqual({});
    expect(of(select({ options: ['a'] }))).toEqual({ required: true });
  });

  it('follows the values for a required or when that depends on them', () => {
    const company = (v: FormValues) => v['kind'] === '1';
    const form = defineForm({
      kind: select({ options: ['0', '1'] }),
      a: text({ required: company }),
      b: text({ when: company }),
    });
    expect(fieldAttributes(form, 'a')).toEqual({});
    expect(fieldAttributes(form, 'a', { kind: '1' })).toEqual({
      required: true,
    });
    expect(fieldAttributes(form, 'b')).toEqual({});
    expect(fieldAttributes(form, 'b', { kind: '1' })).toEqual({
      required: true,
    });
  });

  it('runs when and required on the values as the checks see them', () => {
    // a checkbox reads '1' and 'on' as true; a string method needs a string
    const form = defineForm({
      terms: checkbox({ required: false }),
      city: text({ required: false }),
      a: text({ when: (v) => v['terms'] === true }),
      b: text({ required: (v) => String(v['city']).trim() !== '' }),
    });
    const values = { terms: 'on', city: ' Sofia ' };
    for (const name of ['a', 'b'] as const) {
      expect(fieldAttributes(form, name, values)).toEqual({ required: true });
      expect(form.check(name, values)).toMatchObject({ stage: 'required' });
    }
    expect(fieldAttributes(form, 'a', { terms: null })).toEqual({});
    expect(fieldAttributes(form, 'b')).toEqual({});
  });

  it('adds what each type needs', () => {
    expect(of(email())).toEqual({
      required: true,
      inputmode: 'email',
      autocapitalize: 'none',
      spellcheck: 'false',
    });
    expect(of(password())).toMatchObject({ type: 'password' });
    expect(of(personName())).toMatchObject({ autocapitalize: 'words' });
    expect(of(vatNumber())).toMatchObject({ autocapitalize: 'characters' });
  });

  it('never gives type="email": the browser would check what the core does not', () => {
    expect(of(email())).not.toHaveProperty('type');
  });

  it('capitalizes a code only when it is stored in upper case', () => {
    expect(of(code())).toEqual({
      required: true,
      autocapitalize: 'none',
      spellcheck: 'false',
    });
    expect(of(code({ upper: true }))).toMatchObject({
      autocapitalize: 'characters',
    });
    expect(of(code({ upper: () => true }))).toMatchObject({
      autocapitalize: 'characters',
    });
  });

  it('gives a numeric keyboard only when no minus sign is needed', () => {
    expect(of(integer({ min: 0 }))).toMatchObject({ inputmode: 'numeric' });
    expect(of(integer({ min: 1, max: 99 }))).toMatchObject({
      inputmode: 'numeric',
    });
    expect(of(integer())).toEqual({ required: true });
    expect(of(integer({ min: -5 }))).toEqual({ required: true });
  });

  it('gives a confirm the attributes of the field it repeats, but its own required', () => {
    const form = defineForm({
      password: password(),
      passwordAgain: confirm({ required: false }),
      email: email(),
      emailAgain: confirm({ of: 'email' }),
      lost: confirm({ of: 'nothing' }),
      self: confirm({ of: 'self' }),
      loopA: confirm({ of: 'loopB' }),
      loopB: confirm({ of: 'loopA' }),
    });
    expect(fieldAttributes(form, 'passwordAgain')).toEqual({
      type: 'password',
      autocapitalize: 'none',
      spellcheck: 'false',
    });
    expect(fieldAttributes(form, 'emailAgain')).toEqual({
      required: true,
      inputmode: 'email',
      autocapitalize: 'none',
      spellcheck: 'false',
    });
    for (const name of ['lost', 'self', 'loopA'] as const)
      expect(fieldAttributes(form, name)).toEqual({ required: true });
  });

  it("gives a preset its base type's attributes", () => {
    const work = preset(email, { name: 'workEmail' });
    const town = preset(place, { name: 'town' });
    const token = preset(code, { name: 'token', defaults: { upper: true } });
    expect(of(work())).toMatchObject({ inputmode: 'email' });
    expect(of(town())).toMatchObject({ autocapitalize: 'words' });
    expect(of(token())).toMatchObject({ autocapitalize: 'characters' });
    expect(work().bases).toEqual(['email']);
    expect(town().bases).toEqual(['place', 'text']);
  });

  it('keeps a honeypot away from the keyboard, autofill, password managers and assistive tech', () => {
    expect(of(honeypot())).toEqual({
      autocomplete: 'off',
      tabindex: '-1',
      inert: true,
      'aria-hidden': 'true',
      'data-1p-ignore': true,
      'data-lpignore': 'true',
      'data-bwignore': true,
      'data-form-type': 'other',
    });
  });

  it('gives no length or pattern, which the binding checks instead', () => {
    expect(Object.keys(of(text({ min: 3, max: 10 })))).toEqual(['required']);
  });

  it('knows nothing of a type of your own but required', () => {
    const word = defineType({
      name: 'constructor',
      defaults: {},
      stages: [],
      examples: () => ({ valid: [], invalid: [] }),
    });
    expect(of(word())).toEqual({ required: true });
  });

  it('throws on a name the form does not have', () => {
    const form = defineForm({ a: text() });
    expect(() => fieldAttributes(form, 'constructor' as 'a')).toThrow(
      'no field constructor'
    );
  });
});
