import { describe, expect, it } from 'vitest';

import { defineForm } from '../core/define-form.js';
import { formCases } from '../testing/form-cases.js';
import { typeContract } from '../testing/type-contract.js';
import { integer } from './integer.js';

describe('integer', () => {
  for (const c of typeContract(integer, [
    {},
    { min: 1, max: 99 },
    { min: 1 },
    { min: -5, max: 5 },
  ]))
    it(c.name, c.run);

  it('gives a number, from a number or from digits', () => {
    expect(integer().check(12)).toEqual({ state: 'valid', value: 12 });
    expect(integer().check(' 12 ')).toEqual({ state: 'valid', value: 12 });
    expect(integer().check('-3')).toEqual({ state: 'valid', value: -3 });
    expect(integer().check(0)).toEqual({ state: 'valid', value: 0 });
  });

  it('says the range', () => {
    expect(integer({ min: 1, max: 99 }).check(100)).toMatchObject({
      stage: 'rule',
      message: 'Enter a number from 1 to 99.',
    });
  });

  it('names only the bounds that were given', () => {
    expect(integer({ min: 1 }).check(0)).toMatchObject({
      message: 'Enter a number of at least 1.',
    });
    expect(integer({ max: 9 }).check(10)).toMatchObject({
      message: 'Enter a number of at most 9.',
    });
    expect(integer({ min: 1 }).check('9007199254740992')).toMatchObject({
      message: 'Enter a smaller number.',
    });
    expect(integer({ max: 9 }).check('-9007199254740992')).toMatchObject({
      message: 'Enter a larger number.',
    });
    expect(integer().check('9007199254740992')).toMatchObject({
      message: 'Enter a smaller number.',
    });
  });

  it('gives undefined, not 0, for an optional one left empty', () => {
    const field = integer({ required: false, min: 1 });
    expect(field.check('')).toEqual({ state: 'empty' });
    expect(field.empty).toBeUndefined();
    const form = defineForm({ quantity: field });
    const parsed = form.parse({ quantity: '' });
    expect(parsed).toEqual({ ok: true, values: { quantity: undefined } });
    if (parsed.ok) expect(form.parse(parsed.values).ok).toBe(true);
  });

  describe('a form with an optional integer passes its own cases', () => {
    const form = defineForm({ quantity: integer({ required: false, min: 1 }) });
    for (const c of formCases(form, { valid: { quantity: '' } }))
      it(c.name, c.run);
  });

  it('is unfinished while more digits could still bring it into the range', () => {
    const tens = integer({ min: 10, max: 99 });
    expect(tens.check('2')).toMatchObject({ stage: 'rule', incomplete: true });
    expect(tens.check('0')).toMatchObject({ incomplete: true });
    expect(tens.check('100')).toMatchObject({ incomplete: false });
    expect(tens.check('-2')).toMatchObject({ incomplete: false });
    const minus = integer({ min: -50, max: -10 });
    expect(minus.check('-2')).toMatchObject({ incomplete: true });
    expect(minus.check('-0')).toMatchObject({ incomplete: true });
    expect(minus.check('-60')).toMatchObject({ incomplete: false });
    expect(minus.check('2')).toMatchObject({ incomplete: false });
    // past what a safe integer holds: nothing to finish
    expect(integer({ min: 1 }).check('9007199254740992')).toMatchObject({
      incomplete: false,
    });
    expect(
      integer({ min: 9007199254740990 }).check('900719925474099')
    ).toMatchObject({ incomplete: true });
    expect(integer({ min: 5, max: 5 }).check('6')).toMatchObject({
      incomplete: false,
    });
  });

  it('refuses what is not a whole number a JavaScript number can hold', () => {
    for (const raw of ['1e3', '0x10', '1,000', 1e21, '9007199254740993'])
      expect(integer().check(raw)).toMatchObject({ state: 'invalid' });
  });

  it('refuses booleans, which JSON clients may send', () => {
    expect(integer().check(true)).toMatchObject({ stage: 'type' });
  });

  it('treats a lone minus as unfinished', () => {
    expect(integer().check('-')).toMatchObject({
      stage: 'pattern',
      incomplete: true,
    });
  });
});
