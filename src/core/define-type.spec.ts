import { describe, expect, it, vi } from 'vitest';
import { text } from '../types/text.js';
import { defineType, preset, readScalar, readString } from './define-type.js';
import { length } from './stages.js';

describe('readers', () => {
  it('readString: strings, missing is empty, the rest is the wrong type', () => {
    expect(readString('a')).toBe('a');
    expect(readString(undefined)).toBe('');
    expect(readString(1)).toBeUndefined();
    expect(readString(null)).toBeUndefined();
  });

  it('readScalar: also finite numbers', () => {
    expect(readScalar(1)).toBe('1');
    expect(readScalar(Number.NaN)).toBeUndefined();
    expect(readScalar('x')).toBe('x');
  });
});

describe('defineType', () => {
  const upper = defineType<{ readonly max: number }>({
    name: 'upper',
    defaults: { max: 3 },
    normalize: (value) => value.trim().toUpperCase(),
    stages: [
      {
        name: 'length',
        check: (value, { max }) =>
          value.length > max ?
            { message: `Max ${max}.`, details: { max, count: value.length } }
          : undefined,
      },
    ],
    finish: (value) => `${value}!`,
    hint: ({ max }) => `Up to ${max}.`,
    examples: () => ({ valid: ['ab'], invalid: [] }),
  });

  it('runs read → normalize → required → stages → rule → finish', () => {
    const field = upper();
    expect(field.check(' ab ')).toEqual({ state: 'valid', value: 'AB!' });
    expect(field.check(42)).toEqual({
      state: 'invalid',
      stage: 'type',
      message: 'Invalid value.',
      incomplete: false,
    });
    expect(field.check('  ')).toMatchObject({
      stage: 'required',
      message: 'This field is required.',
      incomplete: true,
    });
    expect(field.check('abcd')).toMatchObject({
      stage: 'length',
      message: 'Max 3.',
    });
    expect(field.view(' ab ')).toBe('AB');
    expect(field.view(42)).toBe('');
    expect(field.empty).toBe('');
    expect(field.type).toBe('upper');
  });

  it('optional and empty is `empty`; required may depend on the values', () => {
    expect(upper({ required: false }).check('')).toEqual({ state: 'empty' });
    const field = upper({ required: (v) => v['other'] === 'yes' });
    expect(field.check('', { other: 'yes' }).state).toBe('invalid');
    expect(field.check('', { other: 'no' }).state).toBe('empty');
    expect(field.isRequired({ other: 'yes' })).toBe(true);
    expect(field.isRequired()).toBe(false);
  });

  it('arguments may be functions of the values', () => {
    const field = upper({ max: (v) => Number(v['limit']) });
    expect(field.args({ limit: 5 })).toEqual({ max: 5 });
    expect(field.check('abcd', { limit: 5 }).state).toBe('valid');
    expect(field.check('abcd', { limit: 2 }).state).toBe('invalid');
    expect(upper().args()).toEqual({ max: 3 });
  });

  it('when', () => {
    const field = upper({ when: (v) => v['on'] === true });
    expect(field.isActive({ on: true })).toBe(true);
    expect(field.isActive({})).toBe(false);
    expect(upper().isActive()).toBe(true);
  });

  it('per-field messages: strings or functions of the details', () => {
    const field = upper({
      messages: {
        required: 'Enter it.',
        length: (d) => `${d['count']} is more than ${d['max']}.`,
        type: 'Nope.',
      },
    });
    expect(field.check('')).toMatchObject({ message: 'Enter it.' });
    expect(field.check('abcde')).toMatchObject({
      message: '5 is more than 3.',
    });
    expect(field.check(null)).toMatchObject({ message: 'Nope.' });
  });

  it('a field rule runs after the stages, on the normalized value', () => {
    const field = upper({
      rule: (value, v) => (value === v['taken'] ? 'Taken.' : undefined),
    });
    expect(field.check('ab', { taken: 'AB' })).toMatchObject({
      stage: 'rule',
      message: 'Taken.',
      incomplete: false,
    });
    expect(field.check('ab', { taken: 'CD' }).state).toBe('valid');
    expect(field.check('abcd', { taken: 'ABCD' })).toMatchObject({
      stage: 'length',
    });
  });

  it('hint: the type’s, or the field’s (also a function of the values)', () => {
    expect(upper().hint()).toBe('Up to 3.');
    expect(upper({ max: 9 }).hint()).toBe('Up to 9.');
    expect(upper({ hint: 'Mine.' }).hint()).toBe('Mine.');
    expect(upper({ hint: (v) => String(v['h']) }).hint({ h: 'x' })).toBe('x');
    expect(text().hint()).toBeUndefined();
  });

  it('examples with the resolved arguments', () => {
    expect(upper().examples()).toEqual({ valid: ['ab'], invalid: [] });
    expect(upper.spec.name).toBe('upper');
  });
});

describe('defineType: a value far over max', () => {
  const normalize = vi.fn((value: string) => value.trim());
  const short = defineType<{ readonly min: number; readonly max: number }>({
    name: 'short',
    defaults: { min: 1, max: 3 },
    normalize,
    stages: [length],
    examples: () => ({ valid: ['ab'], invalid: [] }),
  });

  it('fails at length before it is normalized', () => {
    normalize.mockClear();
    expect(short().check('x'.repeat(13))).toMatchObject({
      stage: 'length',
      message: 'At most 3 characters (now 13).',
      incomplete: false,
    });
    expect(normalize).not.toHaveBeenCalled();
    // up to 4 times over, normalizing may still bring it down
    expect(short().check(`  ab${' '.repeat(8)}`)).toEqual({
      state: 'valid',
      value: 'ab',
    });
    expect(normalize).toHaveBeenCalledOnce();
  });

  it('isn’t normalized for the other fields’ functions either', () => {
    normalize.mockClear();
    const padded = `x${' '.repeat(12)}`;
    expect(short().view(padded)).toBe(padded);
    expect(normalize).not.toHaveBeenCalled();
    expect(short({ max: 10 }).view(padded)).toBe('x');
  });

  it('uses the field’s max, also one that depends on the values', () => {
    const field = short({ max: (v) => Number(v['limit']) });
    expect(field.check('x'.repeat(41), { limit: 10 })).toMatchObject({
      stage: 'length',
    });
    normalize.mockClear();
    field.check('x'.repeat(41), { limit: 100 });
    expect(normalize).toHaveBeenCalledOnce();
    // `view` has no values yet: it goes by the type's default
    normalize.mockClear();
    field.view('x'.repeat(13));
    expect(normalize).not.toHaveBeenCalled();
  });

  it('honours the field’s message', () => {
    expect(
      short({ messages: { length: 'Too long.' } }).check('x'.repeat(13))
    ).toMatchObject({ message: 'Too long.' });
  });

  it('leaves types without a length stage alone', () => {
    const free = vi.fn((value: string) => value);
    const field = defineType<{ readonly max: number }>({
      name: 'free',
      defaults: { max: 1 },
      normalize: free,
      stages: [],
      examples: () => ({ valid: ['a'], invalid: [] }),
    })();
    expect(field.check('x'.repeat(100)).state).toBe('valid');
    expect(free).toHaveBeenCalledOnce();
    expect(field.view('x'.repeat(100))).toBe('x'.repeat(100));
    expect(free).toHaveBeenCalledTimes(2);
  });

  it('padding this far over max is refused, also in an optional field', () => {
    const optional = text({ required: false });
    expect(optional.check(' '.repeat(1020))).toEqual({ state: 'empty' });
    expect(optional.check(' '.repeat(1021))).toMatchObject({
      stage: 'length',
      message: 'At most 255 characters (now 1021).',
    });
  });

  it('real text at max still fits: emoji and decomposed Hangul', () => {
    expect(text({ max: 5 }).check('😀'.repeat(5)).state).toBe('valid');
    expect(text({ max: 5 }).check('각'.normalize('NFD').repeat(5))).toEqual({
      state: 'valid',
      value: '각'.repeat(5),
    });
  });
});

describe('preset', () => {
  it('another name and defaults; examples, messages and hint added', () => {
    const short = preset(text, {
      name: 'short',
      defaults: { max: 5 },
      messages: { length: 'Short!' },
      hint: () => 'Five at most.',
      examples: () => ({
        valid: ['hey'],
        invalid: [{ value: 'toolong', stage: 'length' }],
        values: { a: 1 },
      }),
    });
    const field = short();
    expect(field.type).toBe('short');
    expect(field.args()).toMatchObject({ max: 5, chars: 'text' });
    expect(field.check('toolong')).toMatchObject({ message: 'Short!' });
    expect(field.hint()).toBe('Five at most.');
    const examples = field.examples();
    expect(examples.valid).toContain('hey');
    expect(examples.valid).toContain('aaaaa');
    expect(examples.invalid).toContainEqual({
      value: 'toolong',
      stage: 'length',
    });
    expect(examples.values).toEqual({ a: 1 });
  });

  it('keeps the base examples and hint when it adds none', () => {
    const wide = preset(text, { name: 'wide', defaults: { max: 1000 } });
    expect(wide().examples().valid).toEqual(['a', 'a'.repeat(1000)]);
    expect(wide().hint()).toBeUndefined();
  });
});
