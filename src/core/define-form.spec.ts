import { describe, expect, expectTypeOf, it } from 'vitest';
import { checkbox } from '../types/checkbox.js';
import { choice } from '../types/select.js';
import { place, text } from '../types/text.js';
import { vatNumber } from '../types/vat-number.js';
import { defineForm } from './define-form.js';

const form = defineForm({
  isCompany: choice({ options: ['0', '1'] }),
  name: text({ max: 20 }),
  company: text({ when: (v) => v['isCompany'] === '1' }),
  city: place({ required: (v) => v['isCompany'] === '1' }),
  news: checkbox({ required: false }),
});

describe('defineForm', () => {
  it('parses a valid body into normalized, typed values', () => {
    const result = form.parse({
      isCompany: '1',
      name: '  Ana   Petrova ',
      company: 'Ae Sweets',
      city: 'Sofia',
      news: 'on',
      extra: 'dropped',
    });
    expect(result).toEqual({
      ok: true,
      values: {
        isCompany: '1',
        name: 'Ana Petrova',
        company: 'Ae Sweets',
        city: 'Sofia',
        news: true,
      },
    });
    if (result.ok) {
      expectTypeOf(result.values.news).toEqualTypeOf<boolean>();
      expectTypeOf(result.values.name).toEqualTypeOf<string>();
    }
  });

  it('inactive and optional empty fields get their empty value', () => {
    expect(
      form.parse({ isCompany: '0', name: 'Ana', company: '<script>' })
    ).toEqual({
      ok: true,
      values: {
        isCompany: '0',
        name: 'Ana',
        company: '',
        city: '',
        news: false,
      },
    });
  });

  it('reports every failing field in schema order, and the first', () => {
    const result = form.parse({
      isCompany: '1',
      name: 'x'.repeat(21),
      city: '1',
    });
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: 'name',
          stage: 'length',
          message: 'At most 20 characters (now 21).',
        },
        {
          field: 'company',
          stage: 'required',
          message: 'This field is required.',
        },
        {
          field: 'city',
          stage: 'contains',
          message: 'Use at least one letter.',
        },
      ],
      first: {
        field: 'name',
        stage: 'length',
        message: 'At most 20 characters (now 21).',
      },
    });
  });

  it('reads anything that isn’t a plain object as no values', () => {
    for (const body of [null, 'x', 42, ['a']]) {
      const result = form.parse(body);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.first.field).toBe('isCompany');
    }
  });

  it('ignores inherited properties', () => {
    const body = Object.create({ name: 'Inherited' }) as object;
    const result = form.parse(body);
    expect(!result.ok && result.errors.map((e) => e.field)).toContain('name');
  });

  it('wrong raw types fail cleanly', () => {
    const result = form.parse({ isCompany: '0', name: { $ne: '' } });
    expect(!result.ok && result.first).toEqual({
      field: 'name',
      stage: 'type',
      message: 'Invalid value.',
    });
  });

  describe('a field that can’t be read', () => {
    // what a schema may do without a cast's worth of doubt about the raw body
    const hostile = defineForm({
      a: text({ required: false }),
      tick: checkbox({ required: false }),
      when: text({
        required: false,
        when: (v) => !(v['a'] as string).startsWith('x'),
      }),
      needs: text({
        required: (v) => (v['a'] as string).length > 0,
        rule: (_value, v) => ((v['a'] as string).trim() ? undefined : 'No.'),
      }),
      vat: vatNumber({
        required: false,
        country: (v) => (v['a'] as string).slice(0, 2),
      }),
    });

    it.each([[null], [1], [[]], [['BG']], [{}], [{ $ne: '' }]])(
      'reaches the functions as empty: %j',
      (a) => {
        const result = hostile.parse({ a, needs: 'x', vat: 'BG123' });
        expect(!result.ok && result.first).toEqual({
          field: 'a',
          stage: 'type',
          message: 'Invalid value.',
        });
      }
    );

    it('is its type’s empty value in the view', () => {
      expect(hostile.view({ a: null, tick: [] })).toMatchObject({
        a: '',
        tick: false,
      });
    });

    it('still fails at type when active, and is ignored when not', () => {
      expect(form.parse({ isCompany: '1', name: 'Ana', company: {} })).toEqual(
        expect.objectContaining({
          ok: false,
          first: { field: 'company', stage: 'type', message: 'Invalid value.' },
        })
      );
      expect(form.parse({ isCompany: '0', name: 'Ana', company: {} }).ok).toBe(
        true
      );
    });
  });

  it('check and view take anything, like parse', () => {
    for (const name of [
      'constructor',
      '__proto__',
      'toString',
      'hasOwnProperty',
    ])
      expect(form.check(name as 'name', {})).toBeUndefined();
    for (const raw of [null, undefined, 'x', 42, ['a']]) {
      expect(form.check('name', raw)).toMatchObject({ stage: 'required' });
      expect(form.view(raw)).toMatchObject({ name: '', news: false });
    }
  });

  it('checks one field against the whole form; inactive is undefined', () => {
    expect(form.check('company', { isCompany: '0' })).toBeUndefined();
    expect(form.check('company', { isCompany: '1' })).toMatchObject({
      stage: 'required',
    });
    expect(form.check('city', { isCompany: '0', city: '' })).toEqual({
      state: 'empty',
    });
    expect(form.view({ name: ' a ', news: true, isCompany: 1 })).toEqual({
      isCompany: '1',
      name: 'a',
      company: '',
      city: '',
      news: true,
    });
    expect(form.names).toEqual([
      'isCompany',
      'name',
      'company',
      'city',
      'news',
    ]);
  });
});
