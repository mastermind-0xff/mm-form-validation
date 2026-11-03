import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { personName, place, streetAddress, text } from './text.js';

describe('text', () => {
  for (const c of typeContract(text, [
    {},
    { max: 10 },
    { min: 3, max: 5 },
    { chars: 'digits', max: 6 },
    { chars: 'code', contains: 'digit', max: 20 },
    { chars: 'name', contains: 'letter', min: 2, max: 50 },
    { chars: /[^a-z]/u, max: 8 },
  ]))
    it(c.name, c.run);

  it('collapses whitespace, trims, composes (NFC)', () => {
    expect(text().check('  Ae \t Sweets\n Ltd. ')).toEqual({
      state: 'valid',
      value: 'Ae Sweets Ltd.',
    });
    expect(text().check('Café')).toEqual({
      state: 'valid',
      value: 'Café',
    });
  });

  it('a set no filler fits gives no examples', () => {
    expect(text({ chars: /./u }).examples()).toEqual({
      valid: [],
      invalid: [],
    });
  });
});

describe('personName', () => {
  for (const c of typeContract(personName, [{}, { max: 10 }, { min: 2 }]))
    it(c.name, c.run);
});

describe('place', () => {
  for (const c of typeContract(place, [{}, { max: 20 }])) it(c.name, c.run);

  it('City "1" fails, real one-letter places pass', () => {
    expect(place().check('1')).toMatchObject({
      stage: 'contains',
      message: 'Use at least one letter.',
    });
    expect(place().check('Å').state).toBe('valid');
    expect(place().check('Y').state).toBe('valid');
  });
});

describe('streetAddress', () => {
  for (const c of typeContract(streetAddress, [{}, { min: 1, max: 40 }]))
    it(c.name, c.run);

  it('Address "1" fails', () => {
    expect(streetAddress().check('1')).toMatchObject({
      stage: 'length',
      message: 'At least 3 characters.',
      incomplete: true,
    });
    expect(streetAddress().check('221B Baker Street').state).toBe('valid');
  });
});
