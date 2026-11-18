/**
 * `integer`: a whole number between `min` and `max`, from a number or
 * from digits. The value is a number; empty and optional gives `undefined`
 * (never 0, which the range may refuse and which isn't what was sent).
 */
import { defineType, readScalar } from '../core/define-type.js';
import type { Field, FieldOptions, FieldType } from '../core/types.js';

export interface IntegerArgs {
  readonly min: number;
  readonly max: number;
}

/**
 * The `integer` factory. Typed only (the same function at run time): a field
 * that is required and always active parses to a `number`; one that may be
 * empty (`required: false` or a function) or inactive (`when`) to
 * `number | undefined`.
 */
export interface IntegerType extends FieldType<
  IntegerArgs,
  number | undefined
> {
  (
    options?: FieldOptions<IntegerArgs> & {
      readonly required?: true;
      readonly when?: undefined;
    }
  ): Field<number | undefined, IntegerArgs, number>;
  (options?: FieldOptions<IntegerArgs>): Field<number | undefined, IntegerArgs>;
}

const WHOLE = /^-?\d+$/u;
const { MIN_SAFE_INTEGER: LOWEST, MAX_SAFE_INTEGER: HIGHEST } = Number;

/**
 * More digits typed after `value` could still bring it into the range: "2" on
 * the way to "25" when `min` is 10. Each digit multiplies its size by ten, so a
 * value already too far from zero can't come back.
 */
function reachable(value: string, min: number, max: number): boolean {
  const negative = value.startsWith('-');
  let low = Math.abs(Number(value));
  let high = low;
  // a safe integer has at most 16 digits
  for (let digits = 0; digits < 16 && low <= HIGHEST; digits++) {
    low *= 10;
    high = high * 10 + 9;
    if (negative ? -low >= min && -high <= max : low <= max && high >= min)
      return true;
  }
  return false;
}

/** "from 1 to 9", "at least 1", "at most 9": no bound that wasn't given. */
function range(min: number, max: number, number: number): string {
  if (min > LOWEST && max < HIGHEST)
    return `Enter a number from ${min} to ${max}.`;
  if (min > LOWEST && number < min) return `Enter a number of at least ${min}.`;
  if (max < HIGHEST && number > max) return `Enter a number of at most ${max}.`;
  // beyond what a JavaScript number holds exactly
  return number > 0 ? 'Enter a smaller number.' : 'Enter a larger number.';
}

export const integer = /* @__PURE__ */ defineType<
  IntegerArgs,
  number | undefined
>({
  name: 'integer',
  defaults: { min: LOWEST, max: HIGHEST },
  read: readScalar,
  normalize: (value) => value.trim(),
  // + 0: "-0" is 0, not -0 (`Object.is` and `deepStrictEqual` tell them apart)
  value: (value) => (value === '' ? undefined : Number(value) + 0),
  stages: [
    {
      name: 'pattern',
      check: (value) =>
        WHOLE.test(value) ? undefined : (
          { message: 'Enter a whole number.', incomplete: value === '-' }
        ),
    },
    {
      name: 'rule',
      check: (value, { min, max }) => {
        const number = Number(value);
        const safe = Number.isSafeInteger(number);
        if (safe && number >= min && number <= max) return undefined;
        return {
          message: range(min, max, number),
          details: { min, max },
          incomplete: safe && reachable(value, min, max),
        };
      },
    },
  ],
  examples: ({ min, max }) => ({
    valid: [min, max, String(min)],
    invalid: [
      { value: '1.5', stage: 'pattern' },
      { value: 'abc', stage: 'pattern' },
      { value: 1.5, stage: 'pattern' },
      ...(max < HIGHEST ?
        [{ value: max + 1, stage: 'rule' }]
      : [{ value: '9007199254740992', stage: 'rule' }]),
      ...(min > LOWEST ? [{ value: min - 1, stage: 'rule' }] : []),
    ],
  }),
}) as IntegerType;
