/**
 * `multiline`: text with line breaks, e.g. a description (plan §5, the
 * user's "text-multiline"). Line breaks become `\n`, spaces at the end of each
 * line and blank lines around the text are dropped, the value is NFC.
 */
import type { CharSet, Kind } from '../chars.js';
import { defineType } from '../core/define-type.js';
import { chars, contains, fits, length, plural } from '../core/stages.js';
import type { Stage } from '../core/types.js';
import { textExamples } from './text.js';

export interface MultilineArgs {
  readonly min: number;
  readonly max: number;
  readonly chars: CharSet;
  readonly contains: Kind | undefined;
  /** At most this many lines (`undefined`: any number). */
  readonly maxLines: number | undefined;
}

const lines: Stage<{ readonly maxLines: number | undefined }> = {
  name: 'lines',
  check: (value, { maxLines }) => {
    const count = value.split('\n').length;
    if (maxLines === undefined || count <= maxLines) return undefined;
    return {
      message: `At most ${plural(maxLines, 'line')} (now ${count}).`,
      details: { max: maxLines, count },
    };
  },
};

export const multiline = /* @__PURE__ */ defineType<MultilineArgs>({
  name: 'multiline',
  defaults: {
    min: 1,
    max: 5000,
    chars: 'multiline',
    contains: undefined,
    maxLines: undefined,
  },
  normalize: (value) =>
    value
      .normalize('NFC')
      .replace(/\r\n?/gu, '\n')
      .replace(/[^\S\n]+$/gmu, '')
      .trim(),
  stages: [chars, length, contains, lines],
  examples: (args) => {
    const base = textExamples(args);
    const two = 'Line one\nLine two';
    const tooMany =
      args.maxLines === undefined ?
        undefined
      : Array.from({ length: args.maxLines + 1 }, () => 'a').join('\n');
    return {
      valid: [
        ...base.valid,
        ...(fits(args, two) && (args.maxLines ?? 2) >= 2 ? [two] : []),
      ],
      invalid: [
        ...base.invalid,
        ...(tooMany !== undefined && fits(args, tooMany) ?
          [{ value: tooMany, stage: 'lines' }]
        : []),
      ],
    };
  },
});
