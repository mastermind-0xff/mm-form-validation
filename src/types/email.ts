/**
 * `email`: trimmed and lower-cased, at most 254 characters. The shape is
 * loose: one `@`, and a dot in the domain with two characters or more after
 * it. The characters it refuses, which a shape this loose lets through, are
 * named by the `chars` stage instead of one generic message. It checks the
 * shape only: never hand the value to a shell.
 */
import { nfc } from '../chars.js';
import { defineType } from '../core/define-type.js';
import { charsOf, length, pattern } from '../core/stages.js';

export interface EmailArgs {
  readonly min: number;
  readonly max: number;
}

// `:` too: a mailer reads `a:b@c.cc` as a group and sends to `b@c.cc`. No real
// address needs what can't be seen, or what reads as another address (bidi
// controls, zero width characters): `chars.ts` says more about these classes.
const BAD =
  /[\s<>()",;:\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{NChar}\u115F\u1160\u2800\u3164\uFFA0]|\p{M}{31}/u;
// The domain has a dot after its first character with 2 more after it. Fixed to
// the first such dot, so each value is scanned once: `[^@]+\.` tried every dot
// and scanned to the end from each (100 000 characters took 8 s).
const SHAPE = /^[^@]+@[^@][^@.]*\.[^@]{2,}$/u;
const DOMAIN = '@example.com';

export const email = /* @__PURE__ */ defineType<EmailArgs>({
  name: 'email',
  defaults: { min: 1, max: 254 },
  normalize: (value) => nfc(value).trim().toLowerCase(),
  stages: [
    /* @__PURE__ */ charsOf(BAD),
    length,
    /* @__PURE__ */ pattern(
      SHAPE,
      'Enter a valid e-mail, like name@example.com.'
    ),
  ],
  examples: ({ max }) => {
    const long = max > DOMAIN.length;
    return {
      valid: [
        'name@example.com',
        'Ana.Petrova+news@mail.example.bg',
        ...(long ? ['a'.repeat(max - DOMAIN.length) + DOMAIN] : []),
      ],
      invalid: [
        { value: 'name@example', stage: 'pattern' },
        { value: 'name@', stage: 'pattern' },
        { value: 'name example.com', stage: 'chars' },
        { value: '<name>@example.com', stage: 'chars' },
        ...(long ?
          [
            {
              value: 'a'.repeat(max + 1 - DOMAIN.length) + DOMAIN,
              stage: 'length',
            },
          ]
        : []),
      ],
    };
  },
});
