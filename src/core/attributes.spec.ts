import { describe, expect, it } from 'vitest';

import { code } from '../types/code.js';
import { confirm } from '../types/confirm.js';
import { email } from '../types/email.js';
import { honeypot } from '../types/honeypot.js';
import { integer } from '../types/integer.js';
import { password } from '../types/password.js';
import { select } from '../types/select.js';
import { personName, text } from '../types/text.js';
import { fieldAttributes } from './attributes.js';
import { defineType } from './define-type.js';

describe('fieldAttributes', () => {
  it('says required, from the schema', () => {
    expect(fieldAttributes(text())).toEqual({ required: true });
    expect(fieldAttributes(text({ required: false }))).toEqual({});
    expect(fieldAttributes(select({ options: ['a'] }))).toEqual({
      required: true,
    });
  });

  it('follows the values for a required or when that depends on them', () => {
    const company = (v: Readonly<Record<string, unknown>>) => v['kind'] === '1';
    expect(fieldAttributes(text({ required: company }))).toEqual({});
    expect(fieldAttributes(text({ required: company }), { kind: '1' })).toEqual(
      { required: true }
    );
    expect(fieldAttributes(text({ when: company }))).toEqual({});
    expect(fieldAttributes(text({ when: company }), { kind: '1' })).toEqual({
      required: true,
    });
  });

  it('adds what each type needs', () => {
    expect(fieldAttributes(email())).toEqual({
      required: true,
      type: 'email',
      inputmode: 'email',
      autocapitalize: 'none',
      spellcheck: 'false',
    });
    expect(fieldAttributes(password())).toMatchObject({ type: 'password' });
    expect(fieldAttributes(confirm())).toMatchObject({ type: 'password' });
    expect(fieldAttributes(personName())).toMatchObject({
      autocapitalize: 'words',
    });
    expect(fieldAttributes(code())).toMatchObject({
      autocapitalize: 'characters',
    });
    expect(fieldAttributes(integer())).toMatchObject({ inputmode: 'numeric' });
    expect(fieldAttributes(honeypot())).toEqual({
      autocomplete: 'off',
      tabindex: '-1',
    });
  });

  it('gives no length or pattern, which the binding checks instead', () => {
    const attributes = fieldAttributes(text({ min: 3, max: 10 }));
    expect(Object.keys(attributes)).toEqual(['required']);
  });

  it('knows nothing of a type of your own but required', () => {
    const word = defineType({
      name: 'constructor',
      defaults: {},
      stages: [],
      examples: () => ({ valid: [], invalid: [] }),
    });
    expect(fieldAttributes(word())).toEqual({ required: true });
  });
});
