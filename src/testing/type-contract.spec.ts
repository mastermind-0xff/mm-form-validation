import { describe, expect, it } from 'vitest';
import { defineType } from '../core/define-type.js';
import { text } from '../types/text.js';
import { show, typeContract } from './type-contract.js';

const failures = (cases: ReturnType<typeof typeContract>) =>
  cases.flatMap((c) => {
    try {
      c.run();
      return [];
    } catch (error) {
      return [`${c.name} → ${(error as Error).message}`];
    }
  });

describe('typeContract', () => {
  it('passes a sound type', () => {
    expect(failures(typeContract(text, [{ max: 4 }]))).toEqual([]);
  });

  it('names its cases after the type, the options and the value', () => {
    const names = typeContract(text, [{ max: 4, chars: /[^a]/u }]).map(
      (c) => c.name
    );
    expect(names).toContain('text {"max":4,"chars":"/[^a]/u"}: valid "aaaa"');
    expect(names).toContain(
      'text {"max":4,"chars":"/[^a]/u"}: examples reach max 4 and 5'
    );
    expect(
      typeContract(text, [{ when: () => true }]).map((c) => c.name)
    ).toContain('text {"when":"ƒ"}: has valid examples');
  });

  it('catches examples that lie and types that break the rules', () => {
    const liar = defineType<{ readonly max: number }>({
      name: 'liar',
      defaults: { max: 3 },
      // null read as empty instead of the wrong type, a missing value as the wrong type
      read: (raw) =>
        raw === null ? ''
        : typeof raw === 'string' ? raw
        : undefined,
      // not idempotent: "ok" → "ok!" → "ok!!"
      normalize: (value) => (value === '' ? '' : `${value}!`),
      stages: [
        {
          name: 'rule',
          check: (value) =>
            value.startsWith('<') ? { message: '<b>Bad</b>' } : undefined,
        },
      ],
      examples: () => ({
        valid: ['ok', '<no'],
        invalid: [
          { value: 'fine', stage: 'rule' },
          { value: '<x', stage: 'rule' },
        ],
      }),
    });
    expect(failures(typeContract(liar))).toEqual([
      'liar: valid "ok" → checking the value again changed it: "ok!" → "ok!!"',
      'liar: valid "<no" → expected valid, got invalid at rule: <b>Bad</b>',
      'liar: invalid "fine" at rule → expected invalid at rule, got valid',
      'liar: invalid "<x" at rule → the message looks like HTML: <b>Bad</b>',
      'liar: empty is required when required → undefined: expected required, got invalid at type: Invalid value.',
      'liar: wrong raw types fail at type → null: expected type, got invalid at required: This field is required.',
      'liar: examples reach max 3 and 4 → no invalid example of 4 characters at length',
    ]);

    const entity = defineType({
      name: 'entity',
      defaults: {},
      messages: { required: '&nbsp;' },
      stages: [],
      examples: () => ({ valid: ['a'], invalid: [] }),
    });
    expect(failures(typeContract(entity))).toEqual([
      'entity: empty is required when required → the message looks like HTML: &nbsp;',
    ]);
  });

  it('catches a type without examples and messages that aren’t one line', () => {
    const lines = defineType({
      name: 'lines',
      defaults: {},
      stages: [
        {
          name: 'rule',
          check: (value) =>
            value === 'a' ? { message: 'two\nlines' }
            : value === 'b' ? { message: '  ' }
            : undefined,
        },
      ],
      examples: () => ({
        valid: [],
        invalid: [
          { value: 'a', stage: 'rule' },
          { value: 'b', stage: 'rule' },
        ],
      }),
    });
    const found = failures(typeContract(lines)).join('\n');
    expect(found).toContain('no valid examples');
    expect(found).toContain('the message has a line break');
  });

  it('show', () => {
    expect(show(undefined)).toBe('undefined');
    expect(show(null)).toBe('null');
    expect(show(true)).toBe('true');
    expect(show('abc')).toBe('"abc"');
    expect(show('x'.repeat(30))).toBe(`"${'x'.repeat(16)}… (30)"`);
  });
});
