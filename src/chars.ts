/**
 * Named character sets (plan §4.6). Each set is a regex that matches one
 * character the set does **not** allow, so the `chars` stage can name the
 * first offending character. Unicode aware (`u`); inside the classes `-`,
 * `(`, `)` and `/` are escaped, so they also compile with the `v` flag.
 */
/* eslint-disable no-useless-escape -- the escapes keep the classes valid with the v flag (CLAUDE.md) */

// control characters and the bidi overrides and isolates (U+202A–U+202E,
// U+2066–U+2069) that can make text read differently than it is stored
const BIDI = '\\u202A-\\u202E\\u2066-\\u2069';

export const charSets = {
  /** Printable text on one line. */
  text: new RegExp(`[\\p{Cc}${BIDI}]`, 'u'),
  /** `text` plus line breaks and tabs. */
  multiline: new RegExp(`[\\x00-\\x08\\x0B-\\x1F\\x7F-\\x9F${BIDI}]`, 'u'),
  /** Letters (any script), combining marks, space, `'` `’` `-` `.` */
  name: /[^\p{L}\p{M} '’\-.]/u,
  /** `name` plus digits, `(` `)` `,` `/` */
  place: /[^\p{L}\p{M}\p{N} '’\-.\(\),\/]/u,
  /** `place` plus `#` `№` `:` `&` `"` */
  address: /[^\p{L}\p{M}\p{N} '’\-.\(\),\/#№:&"]/u,
  digits: /[^0-9]/u,
  alnum: /[^A-Za-z0-9]/u,
  /** Letters and digits (ASCII), `-` and `_` */
  code: /[^A-Za-z0-9_\-]/u,
} as const;

/** A named set, or a regex that matches one character that isn't allowed. */
export type CharSet = keyof typeof charSets | RegExp;

/** The first character of `value` that `set` doesn't allow. */
export function badChar(value: string, set: CharSet): string | undefined {
  const re = typeof set === 'string' ? charSets[set] : set;
  // `match`, not `exec`: a custom set with the `g` flag keeps no state
  return value.match(re)?.[0];
}

/** Kinds of character a value must contain (`contains`). */
export const kinds = {
  letter: /\p{L}/u,
  digit: /\p{Nd}/u,
} as const;

export type Kind = keyof typeof kinds;

/** Length in code points: an emoji counts once (it is two UTF-16 units in `length`). */
export function codePoints(value: string): number {
  return Array.from(value).length;
}
