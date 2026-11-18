/**
 * The shared stages (plan §4.4). A type lists the ones it needs, in order,
 * and adds its own `rule` or `pattern` stages for what is special about it.
 */
import {
  badChar,
  codePoints,
  kinds,
  type CharSet,
  type Kind,
} from '../chars.js';
import type { Details, Problem, Stage } from './types.js';

/** "1 character", "3 characters" */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** How a character reads in a message: "<", or U+0009 for one you can't see. */
function shown(char: string): string {
  return /[\p{C}\p{M}\p{Z}\u115F\u1160\u2800\u3164\uFFA0]/u.test(char) ?
      `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`
    : `"${char}"`;
}

export function charsMessage(details: Details): string {
  return details['char'] === ' ' ?
      'Spaces are not allowed.'
    : `The character ${String(details['shown'])} is not allowed.`;
}

/** Fails on the first character `find` finds in the value. */
function charsCheck<A>(
  find: (value: string, args: A) => string | undefined
): Stage<A> {
  return {
    name: 'chars',
    check: (value, args) => {
      const char = find(value, args);
      if (char === undefined) return undefined;
      const details = { char, shown: shown(char) };
      return { message: charsMessage(details), details };
    },
  };
}

/** Fails on the first character outside the set the arguments name. */
export function charsStage<A>(set: (args: A) => CharSet): Stage<A> {
  return charsCheck((value, args) => badChar(value, set(args)));
}

/**
 * `charsStage` with one regex that matches a character that isn't allowed. A
 * type that names no set uses this, so its bundle doesn't carry `charSets`.
 */
export function charsOf<A>(re: RegExp): Stage<A> {
  // `match`, not `exec`: a regex with the `g` flag keeps no state
  return charsCheck((value) => value.match(re)?.[0]);
}

/** `chars` from the `chars` argument (`text`, `multiline` and their presets). */
export const chars: Stage<{ readonly chars: CharSet }> =
  /* @__PURE__ */ charsCheck((value, args) => badChar(value, args.chars));

export function lengthMessage(details: Details): string {
  const { min = 0, max = 0, count = 0 } = details;
  return Number(count) < Number(min) ?
      `At least ${plural(Number(min), 'character')}.`
    : `At most ${plural(Number(max), 'character')} (now ${count}).`;
}

/** The value has `min` to `max` code points (examples that must fit the arguments). */
export function fits(
  args: { readonly min: number; readonly max: number },
  value: string
): boolean {
  const n = codePoints(value);
  return n >= args.min && n <= args.max;
}

/** `min` to `max` code points. Too short can still be fixed by typing; too long can't. */
export const length: Stage<{ readonly min: number; readonly max: number }> = {
  name: 'length',
  check: (value, { min, max }) => {
    const count = codePoints(value);
    if (count >= min && count <= max) return undefined;
    const details = { min, max, count };
    return {
      message: lengthMessage(details),
      details,
      incomplete: count < min,
    };
  },
};

/** Needs one character of a kind: City "1" fails, "Å" passes (plan §4.6). */
export const contains: Stage<{ readonly contains: Kind | undefined }> = {
  name: 'contains',
  check: (value, args) => {
    const kind = args.contains;
    if (kind === undefined || kinds[kind].test(value)) return undefined;
    return {
      message: `Use at least one ${kind === 'letterOrDigit' ? 'letter or digit' : kind}.`,
      details: { kind },
      incomplete: true,
    };
  },
};

/** The whole value must have a shape; the message says which. */
export function pattern<A>(
  re: RegExp,
  message: string | ((value: string, args: A) => Problem)
): Stage<A> {
  return {
    name: 'pattern',
    check: (value, args) => {
      // `search`, not `test`: a regex with the `g` or `y` flag keeps no state
      if (value.search(re) !== -1) return undefined;
      return typeof message === 'string' ?
          { message, incomplete: true }
        : message(value, args);
    },
  };
}
