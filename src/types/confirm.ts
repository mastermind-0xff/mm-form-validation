/**
 * `confirm`: must equal another field (`of`, default 'password'), e.g. the
 * retyped password. In a form it is compared as the other field reads it:
 * "Ana@x.com" confirms an e-mail stored as "ana@x.com", while a password,
 * never normalized, must match exactly. While the user types, a value that is
 * still the start of the other one is incomplete (a hint), anything else is an
 * error at once.
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
      check: (value, { of }, values, fields) => {
        const other = values[of];
        // like with like: this value normalized by the other field's own type
        const target =
          fields !== undefined && Object.hasOwn(fields, of) ?
            fields[of]
          : undefined;
        const mine = target === undefined ? value : target.view(value);
        return mine === other ? undefined : (
            {
              message: 'The two values differ.',
              incomplete:
                typeof mine === 'string' &&
                typeof other === 'string' &&
                other.startsWith(mine),
            }
          );
      },
    },
  ],
  examples: ({ of }) => ({
    values: { [of]: 'Secret-123' },
    valid: ['Secret-123'],
    // they differ however the other field normalizes (a case difference
    // doesn't, against an e-mail: confirm.spec.ts)
    invalid: [
      { value: 'Secret-12', stage: 'rule' },
      { value: 'Secret-124', stage: 'rule' },
    ],
  }),
});
