/**
 * `code`: a short machine-made value somebody types or pastes, like a discount
 * code or a token from a link (plan §5). Trimmed, and checked against a small
 * set of characters: ASCII letters, digits, `-` and `_` by default. The case
 * stays as typed, because many tokens are case-sensitive; `upper: true`
 * stores it in upper case.
 */
import type { CharSet } from '../chars.js';
import { defineType } from '../core/define-type.js';
import { chars, length } from '../core/stages.js';
import type { Stage } from '../core/types.js';
import { textExamples } from './text.js';

export interface CodeArgs {
  readonly min: number;
  readonly max: number;
  readonly chars: CharSet;
  /** The parsed value is in upper case. */
  readonly upper: boolean;
}

/** The stage on the value as it will be stored: "ß" is "SS" in upper case. */
const stored = (stage: Stage<CodeArgs>): Stage<CodeArgs> => ({
  name: stage.name,
  check: (value, args, values, fields) =>
    stage.check(args.upper ? value.toUpperCase() : value, args, values, fields),
});

export const code = /* @__PURE__ */ defineType<CodeArgs>({
  name: 'code',
  defaults: { min: 1, max: 64, chars: 'code', upper: false },
  normalize: (value) => value.trim(),
  stages: [stored(chars), stored(length)],
  finish: (value, { upper }) => (upper ? value.toUpperCase() : value),
  examples: ({ min, max, chars: set }) =>
    textExamples({ min, max, chars: set, contains: undefined }),
});
