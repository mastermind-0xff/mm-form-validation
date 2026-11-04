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

/**
 * Drops the spaces at the end of each line, in one pass over each run of
 * spaces. `/[^\S\n]+$/gmu` does the same but starts again at every space of a
 * run that doesn't end a line: quadratic, and it runs before `length`, so a
 * 16 KB body took over a second on the server. No lookbehind: Safari before
 * 16.4 can't parse one. A single space that doesn't end a line isn't matched,
 * so ordinary text costs what the old regex did.
 */
function trimLineEnds(value: string): string {
  return value.replace(
    /[^\S\n](?:[^\S\n]+|(?=\n|$))/gu,
    (run: string, at: number) => {
      const next = value[at + run.length];
      if (next === undefined || next === '\n') return '';
      // U+2028 and U+2029 end a line too, and are white space themselves
      return run.slice(
        Math.max(run.lastIndexOf('\u2028'), run.lastIndexOf('\u2029'), 0)
      );
    }
  );
}

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
    trimLineEnds(value.normalize('NFC').replace(/\r\n?/gu, '\n')).trim(),
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
