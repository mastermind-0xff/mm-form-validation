/**
 * `vatNumber`: a company's VAT number for its country (plan §5, moved from
 * aesweets' `checkVatNumber`, 2026-11-03). Upper case, without spaces, dots
 * or dashes, stored with the country prefix (added when only the national
 * part was typed). In the EU the prefix must be the country's own (EL for
 * Greece, GR accepted) and the rest must have the country's VIES format;
 * elsewhere any 4–20 letters and digits.
 *
 * While the user types, the message shows the shape still missing (user,
 * item 4): "BG and 9 or 10 digits: BG1234XXXXX". In the masks `X` is a digit,
 * `L` a letter, `?` a letter or a digit; other letters are literal.
 */
import { defineType } from '../core/define-type.js';
import { charsStage } from '../core/stages.js';
import type { Problem } from '../core/types.js';

export interface VatNumberArgs {
  /** ISO 3166-1 code of the company's country (often a function of the values). */
  readonly country: string;
}

type Format = readonly [
  national: RegExp,
  description: string,
  mask: string,
  maxLength: number,
];

/** EU member states (ISO code) → the VIES format of the part after the prefix. */
export const EU_VAT_FORMATS: Readonly<Record<string, Format>> = {
  AT: [/^U\d{8}$/u, 'U and 8 digits', 'UXXXXXXXX', 9],
  BE: [/^[01]\d{9}$/u, '10 digits starting with 0 or 1', '0XXXXXXXXX', 10],
  BG: [/^\d{9,10}$/u, '9 or 10 digits', 'XXXXXXXXX', 10],
  CY: [/^\d{8}[A-Z]$/u, '8 digits and a letter', 'XXXXXXXXL', 9],
  CZ: [/^\d{8,10}$/u, '8 to 10 digits', 'XXXXXXXX', 10],
  DE: [/^\d{9}$/u, '9 digits', 'XXXXXXXXX', 9],
  DK: [/^\d{8}$/u, '8 digits', 'XXXXXXXX', 8],
  EE: [/^\d{9}$/u, '9 digits', 'XXXXXXXXX', 9],
  ES: [
    /^(?:[A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z])$/u,
    'a letter or digit, 7 digits and a letter or digit',
    '?XXXXXXX?',
    9,
  ],
  FI: [/^\d{8}$/u, '8 digits', 'XXXXXXXX', 8],
  FR: [
    /^[0-9A-HJ-NP-Z]{2}\d{9}$/u,
    '2 letters or digits and 9 digits',
    '??XXXXXXXXX',
    11,
  ],
  GR: [/^\d{9}$/u, '9 digits', 'XXXXXXXXX', 9],
  HR: [/^\d{11}$/u, '11 digits', 'XXXXXXXXXXX', 11],
  HU: [/^\d{8}$/u, '8 digits', 'XXXXXXXX', 8],
  IE: [
    /^(?:\d{7}[A-W][A-IW]?|\d[A-Z]\d{5}[A-W])$/u,
    '7 digits and 1 or 2 letters',
    'XXXXXXXL',
    9,
  ],
  IT: [/^\d{11}$/u, '11 digits', 'XXXXXXXXXXX', 11],
  LT: [/^(?:\d{9}|\d{12})$/u, '9 or 12 digits', 'XXXXXXXXX', 12],
  LU: [/^\d{8}$/u, '8 digits', 'XXXXXXXX', 8],
  LV: [/^\d{11}$/u, '11 digits', 'XXXXXXXXXXX', 11],
  MT: [/^\d{8}$/u, '8 digits', 'XXXXXXXX', 8],
  NL: [/^\d{9}B\d{2}$/u, '9 digits, B and 2 digits', 'XXXXXXXXXBXX', 12],
  PL: [/^\d{10}$/u, '10 digits', 'XXXXXXXXXX', 10],
  PT: [/^\d{9}$/u, '9 digits', 'XXXXXXXXX', 9],
  RO: [/^[1-9]\d{1,9}$/u, '2 to 10 digits', 'XXXXXXXX', 10],
  SE: [/^\d{10}01$/u, '12 digits ending in 01', 'XXXXXXXXXX01', 12],
  SI: [/^\d{8}$/u, '8 digits', 'XXXXXXXX', 8],
  SK: [/^\d{10}$/u, '10 digits', 'XXXXXXXXXX', 10],
};

const OTHER = /^[A-Z0-9]{4,20}$/u;
const OTHER_MESSAGE = 'Enter a valid VAT number: 4 to 20 letters and digits.';

/** VIES writes Greece as EL. */
export function vatPrefix(country: string): string {
  return country === 'GR' ? 'EL' : country;
}

interface Split {
  readonly format: Format;
  readonly prefix: string;
  /** The value starts with the country's own prefix. */
  readonly own: boolean;
  readonly national: string;
}

function split(value: string, country: string): Split | undefined {
  const code = country.toUpperCase();
  const format = EU_VAT_FORMATS[code];
  if (format === undefined) return undefined;
  const prefix = vatPrefix(code);
  const own =
    value.startsWith(prefix) || (code === 'GR' && value.startsWith('GR'));
  return { format, prefix, own, national: own ? value.slice(2) : value };
}

/** The mask with the typed characters in place: "BG1234XXXXX" (all ASCII). */
function filled(prefix: string, [, , mask, max]: Format, national: string) {
  // the message goes back to the client: no more of the value than can fit
  return national.length > max ?
      `${prefix}${national.slice(0, max)}…`
    : prefix + national + mask.slice(national.length);
}

function shape(prefix: string, format: Format, national = ''): string {
  return `${prefix} and ${format[1]}: ${filled(prefix, format, national)}`;
}

export const vatNumber = /* @__PURE__ */ defineType<VatNumberArgs>({
  name: 'vatNumber',
  defaults: { country: '' },
  normalize: (value) => value.toUpperCase().replace(/[\s.-]/gu, ''),
  stages: [
    charsStage(() => /[^A-Z0-9]/u),
    {
      // another country's prefix: no more typing fixes that
      name: 'rule',
      check: (value, { country }) => {
        const s = split(value, country);
        if (s === undefined || s.own || s.format[0].test(value)) return;
        if (!/^[A-Z]{2}/u.test(value)) return;
        return {
          message: `VAT numbers in this country start with ${s.prefix}.`,
          details: { prefix: s.prefix },
        };
      },
    },
    {
      name: 'pattern',
      check: (value, { country }): Problem | undefined => {
        const s = split(value, country);
        if (s === undefined) {
          if (OTHER.test(value)) return;
          return { message: OTHER_MESSAGE, incomplete: value.length < 4 };
        }
        if (s.format[0].test(s.national)) return;
        return {
          message: shape(s.prefix, s.format, s.national),
          details: { prefix: s.prefix, format: s.format[1] },
          incomplete: s.national.length < s.format[3],
        };
      },
    },
  ],
  finish: (value, { country }) => {
    const s = split(value, country);
    return s === undefined ? value : s.prefix + s.national;
  },
  hint: ({ country }) => {
    const code = country.toUpperCase();
    const format = EU_VAT_FORMATS[code];
    return format === undefined ?
        '4 to 20 letters and digits.'
      : shape(vatPrefix(code), format);
  },
  examples: ({ country }) => {
    const s = split('', country);
    if (s === undefined)
      return {
        valid: ['ABC123', 'abc-123', 'X'.repeat(20)],
        invalid: [
          { value: 'AB1', stage: 'pattern' },
          { value: 'X'.repeat(21), stage: 'pattern' },
          { value: 'AB<12', stage: 'chars' },
        ],
      };
    const { prefix } = s;
    const national = sample(s.format[2]);
    const foreign = prefix === 'DE' ? 'AT' : 'DE';
    return {
      valid: [
        prefix + national,
        national,
        `${prefix.toLowerCase()} ${national.slice(0, 3)} ${national.slice(3)}`,
      ],
      invalid: [
        { value: prefix + national.slice(0, 1), stage: 'pattern' },
        { value: `${prefix}${national}12345`, stage: 'pattern' },
        { value: foreign + national, stage: 'rule' },
        { value: `${prefix}12<3`, stage: 'chars' },
      ],
    };
  },
});

/** A national part that fits a mask: X → digits 1, 2, 3…; L → L; ? → A. */
export function sample(mask: string): string {
  let digit = 0;
  return mask.replace(/[X?]/gu, (c) =>
    c === '?' ? 'A' : String(++digit % 10)
  );
}
