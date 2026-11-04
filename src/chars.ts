/**
 * Named character sets (plan §4.6). Each set is a regex that matches one
 * character the set does **not** allow, so the `chars` stage can name the
 * first offending character. Unicode aware (`u`); inside the classes `-`,
 * `(`, `)` and `/` are escaped, so they also compile with the `v` flag.
 */
/* eslint-disable no-useless-escape -- the escapes keep the classes valid with the v flag (CLAUDE.md) */

// What free text refuses, because nobody can see it or it breaks what handles
// the text later: format characters (zero width, soft hyphen, bidi controls,
// tags) except the two joiners emoji and some scripts need, surrogates without
// a pair, private use, noncharacters, and the letters and symbols drawn as
// nothing (Hangul fillers, blank Braille). Not unassigned code points (\p{Cn}):
// engines disagree on which those are, so the two sides would too. At the start
// of a value a mark or a joiner has nothing to attach to, and alone it would
// fill a required field with nothing to see.
const FREE_TEXT =
  '^[\\p{M}\\u200C\\u200D]|\\p{M}{31}|(?![\\u200C\\u200D])[\\p{Cf}\\p{Cs}\\p{Co}\\p{NChar}\\u115F\\u1160\\u2800\\u3164\\uFFA0]';

export const charSets = {
  /** Printable text on one line. */
  text: new RegExp(`${FREE_TEXT}|\\p{Cc}`, 'u'),
  /** `text` plus line breaks and tabs. */
  multiline: new RegExp(
    `${FREE_TEXT}|[\\x00-\\x08\\x0B-\\x1F\\x7F-\\x9F]`,
    'u'
  ),
  /** Letters (any script, no fillers), combining marks, space, `'` `’` `-` `.` */
  name: /[^\p{L}\p{M} '’\-.]|[\u115F\u1160\u3164\uFFA0]|\p{M}{31}/u,
  /** `name` plus digits, `(` `)` `,` `/` */
  place:
    /[^\p{L}\p{M}\p{N} '’\-.\(\),\/]|[\u115F\u1160\u3164\uFFA0]|\p{M}{31}/u,
  /** `place` plus `#` `№` `:` `&` `"` */
  address:
    /[^\p{L}\p{M}\p{N} '’\-.\(\),\/#№:&"]|[\u115F\u1160\u3164\uFFA0]|\p{M}{31}/u,
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

const MARK_RUN = /\p{M}{31}/u;

/**
 * NFC, but not on 31 or more marks in a row: ICU's reordering is quadratic on
 * a long run, and normalizing comes before every stage (a 100 KB value took
 * seconds). No text needs that many (UAX #15's stream-safe limit is 30), and
 * only marks can reorder, so shorter runs keep it linear. The named sets
 * refuse such a run, at `chars`.
 */
export function nfc(value: string): string {
  return MARK_RUN.test(value) ? value : value.normalize('NFC');
}

/** Length in code points: an emoji counts once (it is two UTF-16 units in `length`). */
export function codePoints(value: string): number {
  // no array: `Array.from` took 1 GB on a 100 MB value
  let count = value.length;
  for (let i = 0; i < value.length - 1; i++)
    if (
      (value.charCodeAt(i) & 0xfc00) === 0xd800 &&
      (value.charCodeAt(i + 1) & 0xfc00) === 0xdc00
    ) {
      count--;
      i++;
    }
  return count;
}
