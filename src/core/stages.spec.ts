import { describe, expect, it } from 'vitest';
import {
  chars,
  charsMessage,
  contains,
  length,
  lengthMessage,
  pattern,
  plural,
} from './stages.js';

describe('stages', () => {
  it('plural', () => {
    expect(plural(1, 'character')).toBe('1 character');
    expect(plural(3, 'line')).toBe('3 lines');
  });

  it('chars names the character, or its code point when you can’t see it', () => {
    const check = (value: string) =>
      chars.check(value, { chars: 'name' }, {})?.message;
    expect(check('Ana')).toBeUndefined();
    expect(check('A<')).toBe('The character "<" is not allowed.');
    expect(check('A\u0007')).toBe('The character U+0007 is not allowed.');
    expect(check('A ')).toBe('The character U+00A0 is not allowed.');
    expect(chars.check('A B', { chars: 'code' }, {})?.message).toBe(
      'Spaces are not allowed.'
    );
    expect(chars.check('A<', { chars: 'name' }, {})?.incomplete).toBeFalsy();
  });

  it('length: too short is incomplete, too long is not', () => {
    const args = { min: 3, max: 5 };
    expect(length.check('abc', args, {})).toBeUndefined();
    expect(length.check('ab', args, {})).toEqual({
      message: 'At least 3 characters.',
      details: { min: 3, max: 5, count: 2 },
      incomplete: true,
    });
    expect(length.check('abcdef', args, {})).toMatchObject({
      message: 'At most 5 characters (now 6).',
      incomplete: false,
    });
    expect(length.check('😀😀😀', args, {})).toBeUndefined();
  });

  it('messages from bare details', () => {
    expect(lengthMessage({})).toBe('At most 0 characters (now 0).');
    expect(charsMessage({ char: '<', shown: '"<"' })).toBe(
      'The character "<" is not allowed.'
    );
  });

  it('contains', () => {
    expect(contains.check('1', { contains: undefined }, {})).toBeUndefined();
    expect(contains.check('Å', { contains: 'letter' }, {})).toBeUndefined();
    expect(contains.check('1', { contains: 'letter' }, {})).toEqual({
      message: 'Use at least one letter.',
      details: { kind: 'letter' },
      incomplete: true,
    });
    expect(contains.check('abc', { contains: 'digit' }, {})?.message).toBe(
      'Use at least one digit.'
    );
  });

  it('pattern with a message or a function', () => {
    const plain = pattern(/^\d+$/u, 'Digits only.');
    expect(plain.check('12', {}, {})).toBeUndefined();
    expect(plain.check('1a', {}, {})).toEqual({
      message: 'Digits only.',
      incomplete: true,
    });
    const computed = pattern<{ n: number }>(/^\d{3}$/u, (value, { n }) => ({
      message: `${n - value.length} more.`,
    }));
    expect(computed.check('1', { n: 3 }, {})).toEqual({ message: '2 more.' });
  });

  it('pattern gives the same answer every time, with a g or y flag too', () => {
    for (const flags of ['g', 'y', 'gu']) {
      const stage = pattern(new RegExp('^[0-9]+$', flags), 'Digits only.');
      for (let i = 0; i < 4; i++)
        expect(stage.check('12', {}, {})).toBeUndefined();
      for (let i = 0; i < 4; i++)
        expect(stage.check('1a', {}, {})?.message).toBe('Digits only.');
    }
  });
});
