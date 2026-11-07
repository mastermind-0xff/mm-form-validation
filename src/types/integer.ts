/**
 * `integer`: a whole number between `min` and `max` (plan §5), from a number or
 * from digits. The value is a number. Empty and optional gives 0, so tell "no
 * value" from zero with a `when` or by reading the raw field.
 */
import { defineType, readScalar } from '../core/define-type.js';

export interface IntegerArgs {
  readonly min: number;
  readonly max: number;
}

const WHOLE = /^-?\d+$/u;

export const integer = /* @__PURE__ */ defineType<IntegerArgs, number>({
  name: 'integer',
  defaults: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
  read: readScalar,
  normalize: (value) => value.trim(),
  value: Number,
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
        if (Number.isSafeInteger(number) && number >= min && number <= max)
          return undefined;
        return {
          message: `Enter a number from ${min} to ${max}.`,
          details: { min, max },
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
      ...(max < Number.MAX_SAFE_INTEGER ?
        [{ value: max + 1, stage: 'rule' }]
      : [{ value: '9007199254740992', stage: 'rule' }]),
      ...(min > Number.MIN_SAFE_INTEGER ?
        [{ value: min - 1, stage: 'rule' }]
      : []),
    ],
  }),
});
