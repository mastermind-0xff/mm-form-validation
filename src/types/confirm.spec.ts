import { describe, expect, it } from 'vitest';
import { defineForm } from '../core/define-form.js';
import { typeContract } from '../testing/type-contract.js';
import { code } from './code.js';
import { confirm } from './confirm.js';
import { email } from './email.js';
import { password } from './password.js';
import { text } from './text.js';

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

describe('confirm in a form: like with like', () => {
  const register = defineForm({
    email: email(),
    emailAgain: confirm({ of: 'email' }),
    password: password(),
    passwordAgain: confirm(),
  });
  const body = {
    email: 'Ana@X.com',
    emailAgain: 'Ana@X.com',
    password: 'Secret-123',
    passwordAgain: 'Secret-123',
  };

  it('a retyped e-mail is compared as the e-mail field reads it', () => {
    for (const emailAgain of ['Ana@X.com', 'ana@x.com', ' ANA@X.COM '])
      expect(register.parse({ ...body, emailAgain })).toEqual({
        ok: true,
        values: { ...body, email: 'ana@x.com', emailAgain },
      });
    expect(
      register.check('emailAgain', { ...body, emailAgain: 'ana@y.com' })
    ).toMatchObject({ stage: 'rule', incomplete: false });
  });

  it('a retyped password must match exactly: case and spaces count', () => {
    for (const passwordAgain of ['secret-123', 'Secret-123 ', ' Secret-123'])
      expect(
        register.check('passwordAgain', { ...body, passwordAgain })
      ).toMatchObject({ state: 'invalid', stage: 'rule' });
  });

  it('the start of the other value is incomplete after normalizing', () => {
    expect(
      register.check('emailAgain', { ...body, emailAgain: 'ANA@X' })
    ).toMatchObject({ stage: 'rule', incomplete: true });
    expect(
      register.check('emailAgain', { ...body, emailAgain: 'Anna' })
    ).toMatchObject({ stage: 'rule', incomplete: false });
  });

  it('parsing the parsed values again gives the same values', () => {
    const first = register.parse(body);
    expect(first.ok && register.parse(first.values)).toEqual(first);
  });

  it('other normalizing types: whitespace collapsed, a code trimmed', () => {
    const form = defineForm({
      name: text(),
      nameAgain: confirm({ of: 'name' }),
      token: code(),
      tokenAgain: confirm({ of: 'token' }),
    });
    expect(
      form.parse({
        name: 'Ana  Petrova',
        nameAgain: ' Ana Petrova ',
        token: 'Ab-1',
        tokenAgain: 'Ab-1 ',
      }).ok
    ).toBe(true);
    // a code keeps its case, so the confirmation must too
    expect(
      form.check('tokenAgain', {
        name: 'x',
        nameAgain: 'x',
        token: 'Ab-1',
        tokenAgain: 'ab-1',
      })
    ).toMatchObject({ stage: 'rule' });
  });

  it('a missing field, or one only the prototype has, matches nothing', () => {
    for (const of of ['nothing', 'constructor', 'toString']) {
      const form = defineForm({ again: confirm({ of }) });
      expect(form.check('again', { again: 'x' })).toMatchObject({
        stage: 'rule',
        incomplete: false,
      });
    }
  });

  it('a confirm of itself or of another confirm compares their raw values', () => {
    const form = defineForm({
      a: text(),
      b: confirm({ of: 'a' }),
      c: confirm({ of: 'b' }),
      d: confirm({ of: 'd' }),
    });
    expect(form.parse({ a: 'X  y', b: 'X y', c: 'X y', d: 'z' }).ok).toBe(true);
    expect(form.check('c', { a: 'X  y', b: 'X y', c: 'X  y' })).toMatchObject({
      stage: 'rule',
    });
  });
});
