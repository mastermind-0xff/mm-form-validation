import { describe, expect, it } from 'vitest';
import { typeContract } from '../testing/type-contract.js';
import { EU_VAT_FORMATS, sample, vatNumber, vatPrefix } from './vat-number.js';

const EU = Object.keys(EU_VAT_FORMATS);

describe('vatNumber', () => {
  for (const c of typeContract(vatNumber, [
    ...EU.map((country) => ({ country })),
    { country: 'US' },
    { country: '' },
  ]))
    it(c.name, c.run);

  it.each(EU)('%s: the mask sample fits the format', (country) => {
    const [national, , masks, max] = EU_VAT_FORMATS[country]!;
    for (const mask of masks.split('|')) {
      expect(national.test(sample(mask))).toBe(true);
      expect(mask.length).toBeLessThanOrEqual(max);
    }
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

  it.each([
    ['AT', 'ATUXXXXXXXX (X = digit)'],
    ['BE', 'BE0XXXXXXXXX or BE1XXXXXXXXX (X = digit)'],
    ['CY', 'CYXXXXXXXXL (X = digit, L = letter)'],
    ['ES', 'ES?XXXXXXX? (X = digit, ? = letter or digit)'],
    ['FR', 'FR??XXXXXXXXX (X = digit, ? = letter or digit)'],
    ['IE', 'IEXXXXXXXL or IEXXXXXXXLL (X = digit, L = letter)'],
    ['NL', 'NLXXXXXXXXXBXX (X = digit)'],
    ['SE', 'SEXXXXXXXXXX01 (X = digit)'],
    ['DE', 'DE and 9 digits: DEXXXXXXXXX'],
    ['LT', 'LT and 9 or 12 digits: LTXXXXXXXXX'],
  ])('%s: the hint says what its marks mean', (country, hint) => {
    expect(vatNumber({ country }).hint()).toBe(hint);
  });

  it('follows the alternative that fits what was typed', () => {
    expect(vatNumber({ country: 'BE' }).check('BE12')).toMatchObject({
      message: 'BE12XXXXXXXX (X = digit)',
    });
  });

  it('uses words when no mask fits, and never echoes a long value', () => {
    const { message } = vatNumber({ country: 'NL' }).check(
      `NL${'1'.repeat(40)}`
    ) as { message: string };
    expect(message).toBe('NL and 9 digits, B and 2 digits');
    expect(vatNumber({ country: 'NL' }).check('NL123456789X12')).toMatchObject({
      message: 'NL and 9 digits, B and 2 digits',
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
      message: 'BG and 9 or 10 digits: BG1234567890…',
      incomplete: false,
    });
    expect(vatNumber({ country: 'NL' }).check('NL12345')).toMatchObject({
      message: 'NL12345XXXXBXX (X = digit)',
    });
  });

  it('echoes no more of the value than the format can hold', () => {
    const result = vatNumber({ country: 'BG' }).check(
      `BG${'1'.repeat(16_000)}`
    );
    expect(result).toMatchObject({
      stage: 'pattern',
      message: `BG and 9 or 10 digits: BG${'1'.repeat(10)}…`,
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

  it('refuses a country that is not an ISO 3166-1 alpha-2 code, before anything else', () => {
    for (const country of ['Bulgaria', 'bg', 'Bg', 'BGR', 'B', '35', ' BG']) {
      const field = vatNumber({ country });
      for (const value of ['BG123456789', 'ABC123', '<'])
        expect(field.check(value)).toEqual({
          state: 'invalid',
          stage: 'rule',
          message: 'The country must be an ISO 3166-1 code, like BG.',
          incomplete: false,
        });
      expect(field.hint()).toBeUndefined();
      expect(field.examples().valid).toEqual([]);
    }
    // empty and optional is still empty; a field message replaces it
    expect(
      vatNumber({ country: 'Bulgaria', required: false }).check('')
    ).toEqual({ state: 'empty' });
    expect(
      vatNumber({
        country: 'bg',
        messages: { rule: 'Choose your country first.' },
      }).check('BG123456789')
    ).toMatchObject({ message: 'Choose your country first.' });
  });

  it('checks an empty country, and a code outside the EU, as outside the EU', () => {
    expect(vatNumber({ country: '' }).check('ABC123')).toMatchObject({
      state: 'valid',
    });
    expect(vatNumber({ country: 'CH' }).check('CHE123')).toMatchObject({
      state: 'valid',
    });
  });
});
