import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { choice, optionLabel, optionValue, select } from './select.js';

const countries = [
  { value: '', label: 'Choose…' },
  { value: 'BG', label: 'Bulgaria' },
  { value: 'DE', label: 'Germany' },
];

describe('select', () => {
  for (const c of typeContract(select, [
    { options: countries },
    { options: ['a', 'b', 'c', 'd'] },
    { options: ['1'] },
  ]))
    it(c.name, c.run);

  it('checks by value; numbers from JSON read as strings', () => {
    const field = select({ options: countries });
    expect(field.check('BG')).toEqual({ state: 'valid', value: 'BG' });
    expect(field.check('Bulgaria')).toMatchObject({
      stage: 'rule',
      message: 'Choose one of the options.',
    });
    expect(field.check('')).toMatchObject({ message: 'Choose an option.' });
    expect(select({ options: ['0', '1'] }).check(1).state).toBe('valid');
  });

  it('options may depend on the values', () => {
    const field = select({
      options: (v) => (v['country'] === 'BG' ? ['Sofia'] : ['Berlin']),
    });
    expect(field.check('Sofia', { country: 'BG' }).state).toBe('valid');
    expect(field.check('Sofia', { country: 'DE' }).state).toBe('invalid');
  });

  it('takes database ids as values and stores them as strings', () => {
    const field = select({
      options: [
        { value: 17, label: 'Bulgaria' },
        { value: 276, label: 'Germany' },
      ],
    });
    expect(field.check('17')).toEqual({ state: 'valid', value: '17' });
    expect(field.check(276)).toEqual({ state: 'valid', value: '276' });
    expect(field.check('Bulgaria').state).toBe('invalid');
    expect(optionValue(17)).toBe('17');
    expect(optionLabel(17)).toBe('17');
  });

  it('option helpers', () => {
    expect(optionValue('a')).toBe('a');
    expect(optionLabel('a')).toBe('a');
    expect(optionValue({ value: 'v', label: 'L' })).toBe('v');
    expect(optionLabel({ value: 'v', label: 'L' })).toBe('L');
  });
});

describe('choice', () => {
  for (const c of typeContract(choice, [{ options: ['0', '1'] }]))
    it(c.name, c.run);
});
