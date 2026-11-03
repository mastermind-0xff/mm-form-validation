/**
 * `email`: trimmed and lower-cased, at most 254 characters; the shape is
 * aesweets' rule (`server/auth/input.ts`), with the characters it refuses
 * named by the `chars` stage instead of one generic message.
 */
import { defineType } from '../core/define-type.js';
import { charsStage, length, pattern } from '../core/stages.js';

export interface EmailArgs {
  readonly min: number;
  readonly max: number;
}

const BAD = /[\s<>()",;\p{Cc}]/u;
const SHAPE = /^[^@]+@[^@]+\.[^@]{2,}$/u;
const DOMAIN = '@example.com';

export const email = /* @__PURE__ */ defineType<EmailArgs>({
  name: 'email',
  defaults: { min: 1, max: 254 },
  normalize: (value) => value.normalize('NFC').trim().toLowerCase(),
  stages: [
    charsStage(() => BAD),
    length,
    pattern(SHAPE, 'Enter a valid e-mail, like name@example.com.'),
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
