/**
 * `password`: `min` to `max` code points (default 8–128). Never
 * normalized: spaces at either end are part of the password.
 */
import { defineType } from '../core/define-type.js';
import { fits, length, plural } from '../core/stages.js';

export interface PasswordArgs {
  readonly min: number;
  readonly max: number;
}

export const password = /* @__PURE__ */ defineType<PasswordArgs>({
  name: 'password',
  defaults: { min: 8, max: 128 },
  stages: [length],
  hint: ({ min }) => `At least ${plural(min, 'character')}.`,
  examples: (args) => ({
    valid: [
      'x'.repeat(Math.max(args.min, 1)),
      'x'.repeat(args.max),
      ...[' correct horse ', 'пароль-123'].filter((value) => fits(args, value)),
    ],
    invalid: [
      { value: 'x'.repeat(args.max + 1), stage: 'length' },
      ...(args.min > 1 ?
        [{ value: 'x'.repeat(args.min - 1), stage: 'length' }]
      : []),
    ],
  }),
});
