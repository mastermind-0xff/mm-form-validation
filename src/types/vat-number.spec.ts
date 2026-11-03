import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { EU_VAT_FORMATS, sample, vatNumber, vatPrefix } from './vat-number.js';

const EU = Object.keys(EU_VAT_FORMATS);

describe('vatNumber', () => {
  for (const c of typeContract(vatNumber, [
    ...EU.map((country) => ({ country })),
    { country: 'US' },
    { country: '' },
    { country: 'bg' },
  ]))
    it(c.name, c.run);

  it.each(EU)('%s: the mask sample fits the format', (country) => {
    const [national, , mask, max] = EU_VAT_FORMATS[country]!;
    expect(national.test(sample(mask))).toBe(true);
    expect(mask.length).toBeLessThanOrEqual(max);
  });

  it('adds the prefix, drops spaces, dots and dashes', () => {
    const bg = vatNumber({ country: 'BG' });
    expect(bg.check('123 456.789')).toEqual({
      state: 'valid',
      value: 'BG123456789',
    });
    expect(bg.check('bg-1234567890')).toEqual({
      state: 'valid',
      value: 'BG1234567890',
    });
  });

  it('Greece: EL, GR accepted', () => {
    const gr = vatNumber({ country: 'GR' });
    expect(gr.check('GR123456789')).toEqual({
      state: 'valid',
      value: 'EL123456789',
    });
    expect(gr.check('EL123456789').state).toBe('valid');
    expect(vatPrefix('GR')).toBe('EL');
  });

  it('another country’s prefix is an error at once (the aesweets case)', () => {
    expect(vatNumber({ country: 'BG' }).check('DE3456789')).toMatchObject({
      stage: 'rule',
      message: 'VAT numbers in this country start with BG.',
      incomplete: false,
    });
  });

  it('shows the shape still missing while typing', () => {
    const bg = vatNumber({ country: 'BG' });
    expect(bg.hint()).toBe('BG and 9 or 10 digits: BGXXXXXXXXX');
    expect(bg.check('BG1234')).toMatchObject({
      stage: 'pattern',
      message: 'BG and 9 or 10 digits: BG1234XXXXX',
      incomplete: true,
    });
    expect(bg.check('12345678901')).toMatchObject({
      message: 'BG and 9 or 10 digits: BG12345678901',
      incomplete: false,
    });
    expect(vatNumber({ country: 'NL' }).check('NL12345')).toMatchObject({
      message: 'NL and 9 digits, B and 2 digits: NL12345XXXXBXX',
    });
  });

  it('outside the EU: 4 to 20 letters and digits', () => {
    const us = vatNumber({ country: 'US' });
    expect(us.hint()).toBe('4 to 20 letters and digits.');
    expect(us.check('AB1')).toMatchObject({
      stage: 'pattern',
      incomplete: true,
    });
    expect(us.check('X'.repeat(21))).toMatchObject({ incomplete: false });
    expect(us.check('ab-12')).toEqual({ state: 'valid', value: 'AB12' });
  });

  it('follows the country of the form', () => {
    const field = vatNumber({ country: (v) => String(v['country']) });
    expect(field.check('123456789', { country: 'BG' })).toEqual({
      state: 'valid',
      value: 'BG123456789',
    });
    expect(field.check('123456789', { country: 'DK' }).state).toBe('invalid');
    expect(field.hint({ country: 'DK' })).toBe('DK and 8 digits: DKXXXXXXXX');
  });

  it('refuses characters other than letters and digits', () => {
    expect(vatNumber({ country: 'BG' }).check('BG12/34')).toMatchObject({
      stage: 'chars',
      message: 'The character "/" is not allowed.',
    });
  });
});
