/**
 * `text`: one line of text (plan §5), and its presets `personName`, `place`
 * and `streetAddress`. Whitespace is collapsed and trimmed, the value is NFC.
 */
import { badChar, kinds, nfc, type CharSet, type Kind } from '../chars.js';
import { defineType, preset } from '../core/define-type.js';
import { chars, contains, fits, length } from '../core/stages.js';
import type { Examples } from '../core/types.js';

export interface TextArgs {
  readonly min: number;
  readonly max: number;
  readonly chars: CharSet;
  /** A kind of character the value must contain (`'letter'`: City "1" fails). */
  readonly contains: Kind | undefined;
}

const FILLERS = ['a', 'x', 'A', '1', 'я'];
// U+0007 is refused by every named set and survives normalizing
const BAD = ['\u0007', '<', '@', '_'];
const NOT_A = { letter: ['.', '-', '1'], digit: ['a', 'x', '.'] } as const;

/**
 * Examples of a text-like value from its arguments: the shortest and the
 * longest valid value, one over `max`, one under `min`, a character the set
 * refuses, a value without the kind `contains` asks for.
 */
export function textExamples(args: TextArgs): Examples {
  const { min, max, chars: set, contains: kind } = args;
  const allowed = (c: string) => badChar(c, set) === undefined;
  const fill = FILLERS.find(
    (c) => allowed(c) && (kind === undefined || kinds[kind].test(c))
  );
  if (fill === undefined) return { valid: [], invalid: [] };
  const bad = BAD.find((c) => !allowed(c));
  const other = kind === undefined ? undefined : NOT_A[kind].find(allowed);
  const atLeast = Math.max(min, 1);
  return {
    valid: [...new Set([fill.repeat(atLeast), fill.repeat(max)])],
    invalid: [
      { value: fill.repeat(max + 1), stage: 'length' },
      ...(min > 1 ? [{ value: fill.repeat(min - 1), stage: 'length' }] : []),
      ...(bad === undefined ? [] : [{ value: bad + fill, stage: 'chars' }]),
      ...(other === undefined ?
        []
      : [{ value: other.repeat(atLeast), stage: 'contains' }]),
    ],
  };
}

export const text = /* @__PURE__ */ defineType<TextArgs>({
  name: 'text',
  defaults: { min: 1, max: 255, chars: 'text', contains: undefined },
  normalize: (value) => nfc(value).replace(/\s+/gu, ' ').trim(),
  stages: [chars, length, contains],
  examples: textExamples,
});

/**
 * Real values of a preset, kept while they still prove their point with the
 * field's arguments (`personName({ chars: 'text' })` takes "Ann3"): valid ones
 * the set, the length and the kind allow; `chars` ones the set refuses;
 * `length` and `contains` ones that fail there and nowhere before.
 */
function samples(
  valid: readonly string[],
  invalid: readonly { readonly value: string; readonly stage: string }[]
) {
  return (args: TextArgs): Examples => {
    const allowed = (value: string) => badChar(value, args.chars) === undefined;
    const kind = args.contains;
    const hasKind = (value: string) =>
      kind === undefined || kinds[kind].test(value);
    const fails: Readonly<Record<string, (value: string) => boolean>> = {
      chars: (value) => !allowed(value),
      length: (value) => allowed(value) && !fits(args, value),
      contains: (value) =>
        allowed(value) && fits(args, value) && !hasKind(value),
    };
    return {
      valid: valid.filter(
        (value) => allowed(value) && fits(args, value) && hasKind(value)
      ),
      invalid: invalid.filter(({ value, stage }) => fails[stage]?.(value)),
    };
  };
}

/** First, last or full name: letters of any script, `'` `’` `-` `.` and spaces. */
export const personName = /* @__PURE__ */ preset(text, {
  name: 'personName',
  defaults: { max: 100, chars: 'name', contains: 'letter' },
  examples: /* @__PURE__ */ samples(
    ['Anne-Marie O’Neil', 'Тихомир', 'José', 'Ng'],
    [
      { value: 'Ann3', stage: 'chars' },
      { value: '<b>', stage: 'chars' },
    ]
  ),
});

/** A city or region: `name` plus digits, `(` `)` `,` `/`, and at least one letter. */
export const place = /* @__PURE__ */ preset(text, {
  name: 'place',
  defaults: { max: 100, chars: 'place', contains: 'letter' },
  examples: /* @__PURE__ */ samples(
    ['Frankfurt am Main', 'Sofia 1000', 'Å', 'Saint-Étienne'],
    [
      { value: '1', stage: 'contains' },
      { value: 'Sofia!', stage: 'chars' },
    ]
  ),
});

/**
 * A street address: `place` plus `#` `№` `:` `&` `"`, at least 3 characters.
 * No letter needed: a Japanese line is often only numbers ("1-2-3").
 */
export const streetAddress = /* @__PURE__ */ preset(text, {
  name: 'streetAddress',
  defaults: { min: 3, max: 255, chars: 'address' },
  examples: /* @__PURE__ */ samples(
    ['ul. Vitosha 1, ap. 4', '221B Baker Street', '1 Rue de l’Église', '1-2-3'],
    [
      { value: '1', stage: 'length' },
      { value: 'Main St. <1>', stage: 'chars' },
    ]
  ),
});
