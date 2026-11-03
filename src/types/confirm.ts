/**
 * `confirm`: must equal another field (`of`, default 'password'), e.g. the
 * retyped password. While the user types, a value that is still the start of
 * the other one is incomplete (a hint), anything else is an error at once.
 */
import { defineType } from '../core/define-type.js';

export interface ConfirmArgs {
  /** The name of the field to match. */
  readonly of: string;
}

export const confirm = /* @__PURE__ */ defineType<ConfirmArgs>({
  name: 'confirm',
  defaults: { of: 'password' },
  stages: [
    {
      name: 'rule',
      check: (value, { of }, values) => {
        const other = values[of];
        const target = typeof other === 'string' ? other : '';
        return value === target ? undefined : (
            {
              message: 'The two values differ.',
              incomplete: target.startsWith(value),
            }
          );
      },
    },
  ],
  examples: ({ of }) => ({
    values: { [of]: 'Secret-123' },
    valid: ['Secret-123'],
    invalid: [
      { value: 'Secret-12', stage: 'rule' },
      { value: 'secret-123', stage: 'rule' },
    ],
  }),
});
