/**
 * The settings of a look: what the designer page exports and `generateCss`
 * reads. Plain JSON, so a developer can keep it in a project and an agent can
 * read it. Values end up inside a `<style>` element, so `parseLook` accepts each
 * one only in a shape that can't leave its declaration.
 */

export const LOOK_FORMAT = '@mmutils/form-validation/look';

export const LOOK_NAMES = [
  'edge',
  'underline',
  'outline',
  'icon',
  'filled',
] as const;
export type LookName = (typeof LOOK_NAMES)[number];

/**
 * What goes into the HTML: `layout` is sizes and spacing, `paint` adds what
 * the form shows before it is used, `all` is everything.
 */
export const INLINE_LEVELS = ['none', 'layout', 'paint', 'all'] as const;
export type InlineLevel = (typeof INLINE_LEVELS)[number];

/** `media` follows the system; `attribute` is `<html data-scheme="dark">`. */
export const DARK_MODES = ['none', 'media', 'attribute'] as const;
export type DarkMode = (typeof DARK_MODES)[number];

/** `bindForm`'s option: when an unfinished value turns red. */
export const TIMINGS = ['leave', 'pause', 'input'] as const;
export type Timing = (typeof TIMINGS)[number];

export type TokenGroup = 'spacing' | 'text' | 'motion' | 'button';

export interface RangeToken {
  readonly label: string;
  readonly group: TokenGroup;
  readonly value: string;
  readonly unit: 'px' | 'rem' | 'ms' | '';
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface TextToken {
  readonly label: string;
  readonly group: TokenGroup;
  readonly value: string;
  readonly unit?: undefined;
  /** What a person can pick from; anything `check` accepts is fine too. */
  readonly suggestions: readonly string[];
}

const range = (
  label: string,
  group: TokenGroup,
  value: number,
  unit: RangeToken['unit'],
  min: number,
  max: number,
  step = 1
): RangeToken => ({
  label,
  group,
  value: `${value}${unit}`,
  unit,
  min,
  max,
  step,
});

/** Every `--fv-<name>` that isn't a color: its default and its control. */
export const TOKENS = {
  'pad-x': range('Padding left and right', 'spacing', 16, 'px', 6, 32),
  'pad-y': range('Padding top and bottom', 'spacing', 11, 'px', 4, 20),
  border: range('Border', 'spacing', 1, 'px', 0, 4),
  edge: range('Edge bar', 'spacing', 8, 'px', 1, 16),
  radius: range('Corner radius', 'spacing', 6, 'px', 0, 16),
  gap: range('Label, box and message gap', 'spacing', 6, 'px', 0, 16),
  font: {
    label: 'Font',
    group: 'text',
    value: 'inherit',
    suggestions: [
      'inherit',
      'system-ui, sans-serif',
      'Georgia, serif',
      'ui-monospace, monospace',
    ],
  },
  'label-size': range('Label size', 'text', 0.875, 'rem', 0.625, 1.25, 0.0625),
  'message-size': range(
    'Message size',
    'text',
    0.8125,
    'rem',
    0.625,
    1.125,
    0.0625
  ),
  'message-line': range('Message line height', 'text', 1.45, '', 1, 2, 0.05),
  'message-lines': range('Message lines reserved', 'text', 1, '', 1, 4),
  'button-pad-x': range('Padding left and right', 'button', 16, 'px', 6, 40),
  'button-pad-y': range('Padding top and bottom', 'button', 9, 'px', 4, 24),
  'button-radius': range('Corner radius', 'button', 8, 'px', 0, 24),
  'button-size': range('Text size', 'button', 0.875, 'rem', 0.625, 1.5, 0.0625),
  speed: range('Speed', 'motion', 300, 'ms', 0, 1200, 50),
  ease: {
    label: 'Easing',
    group: 'motion',
    value: 'cubic-bezier(0.7, 0, 0.3, 1)',
    suggestions: [
      'cubic-bezier(0.7, 0, 0.3, 1)',
      'cubic-bezier(0.2, 0, 0, 1)',
      'ease',
      'ease-out',
      'linear',
    ],
  },
} as const satisfies Readonly<Record<string, RangeToken | TextToken>>;

export type TokenName = keyof typeof TOKENS;

/** Every color token, with its default in each scheme. */
export const COLORS = {
  text: { label: 'Text', light: '#1f2328', dark: '#e6e8eb' },
  bg: { label: 'Box background', light: '#ffffff', dark: '#1d2129' },
  fill: { label: 'Box tint', light: '#f1f3f5', dark: '#232833' },
  line: { label: 'Line', light: '#c4cad3', dark: '#3c4350' },
  'line-strong': { label: 'Focus, arrow', light: '#6b7280', dark: '#9aa1ad' },
  hint: { label: 'Hint text', light: '#5f6672', dark: '#9aa1ad' },
  valid: { label: 'Valid', light: '#2ddb93', dark: '#2ddb93' },
  invalid: { label: 'Invalid', light: '#e5484d', dark: '#ff6369' },
  'invalid-text': { label: 'Error text', light: '#c62a2f', dark: '#ff8a8f' },
  required: { label: 'Required mark', light: '#c62a2f', dark: '#ff8a8f' },
  button: {
    label: 'Color',
    group: 'button',
    light: '#1f2328',
    dark: '#e6e8eb',
  },
  'button-text': {
    label: 'Text',
    group: 'button',
    light: '#ffffff',
    dark: '#171a20',
  },
  'button-hover': {
    label: 'Hover and pressed',
    group: 'button',
    light: '#3a4048',
    dark: '#ffffff',
  },
} as const;

export type ColorName = keyof typeof COLORS;

export interface LookSettings {
  readonly format: typeof LOOK_FORMAT;
  readonly version: 1;
  readonly look: LookName;
  readonly darkMode: DarkMode;
  readonly inline: InlineLevel;
  /** Leave what is inlined out of the stylesheet: nothing is sent twice. */
  readonly split: boolean;
  readonly timing: Timing;
  readonly tokens: Readonly<Record<TokenName, string>>;
  readonly colors: {
    readonly light: Readonly<Record<ColorName, string>>;
    readonly dark: Readonly<Record<ColorName, string>>;
  };
}

export type LookResult =
  | { readonly ok: true; readonly look: LookSettings }
  | { readonly ok: false; readonly errors: readonly string[] };

const tokenNames = Object.keys(TOKENS) as TokenName[];
const colorNames = Object.keys(COLORS) as ColorName[];

const mapNames = <K extends string, V>(
  names: readonly K[],
  value: (name: K) => V
): Record<K, V> =>
  Object.fromEntries(names.map((name) => [name, value(name)])) as Record<K, V>;

export function defaultLook(): LookSettings {
  return {
    format: LOOK_FORMAT,
    version: 1,
    look: 'edge',
    darkMode: 'attribute',
    inline: 'paint',
    split: false,
    timing: 'pause',
    tokens: mapNames(tokenNames, (name) => TOKENS[name].value),
    colors: {
      light: mapNames(colorNames, (name) => COLORS[name].light),
      dark: mapNames(colorNames, (name) => COLORS[name].dark),
    },
  };
}

const NUMBER = String.raw`\d{1,5}(?:\.\d{1,4})?`;
const SIGNED = String.raw`-?\d{0,3}\.?\d{1,4}`;
const FAMILY = String.raw`[A-Za-z0-9 _-]+`;
const FONT_PART = `(?:${FAMILY}|'${FAMILY}'|"${FAMILY}")`;

const COLOR = /^#[0-9a-f]{6}$/i;
const FONT = new RegExp(`^${FONT_PART}(?:, ?${FONT_PART}){0,9}$`);
const EASE = new RegExp(
  `^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\\(${SIGNED}, ?${SIGNED}, ?${SIGNED}, ?${SIGNED}\\))$`
);
const MAX_VALUE = 200;

const tokenProblem = (name: TokenName, value: string): string | undefined => {
  const token: RangeToken | TextToken = TOKENS[name];
  if (token.unit !== undefined)
    return new RegExp(`^${NUMBER}${token.unit}$`).test(value) ?
        undefined
      : `a number${token.unit === '' ? '' : ` in ${token.unit}`}`;
  if (name === 'font')
    return FONT.test(value) ? undefined : 'a list of font names';
  return EASE.test(value) ? undefined : 'an easing keyword or cubic-bezier()';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const show = (value: unknown): string =>
  typeof value === 'string' ? `"${value.slice(0, 60)}"` : typeof value;

/**
 * Reads settings from a file or a person: what is missing gets its default, so
 * a settings file stays valid when a later version adds a token. Whatever is
 * present must be right: a typo is an error, not a value silently ignored.
 */
export function parseLook(input: unknown): LookResult {
  if (!isRecord(input))
    return { ok: false, errors: ['The settings must be a JSON object.'] };

  const errors: string[] = [];
  const base = defaultLook();

  const known = new Set<string>(Object.keys(base));
  for (const key of Object.keys(input))
    if (!known.has(key)) errors.push(`Unknown setting ${show(key)}.`);

  if (input.format !== undefined && input.format !== LOOK_FORMAT)
    errors.push(`format: expected "${LOOK_FORMAT}".`);
  if (input.version !== undefined && input.version !== 1)
    errors.push('version: this package reads version 1.');

  const oneOf = <T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T
  ): T => {
    const value = input[key];
    if (value === undefined) return fallback;
    if (allowed.includes(value as T)) return value as T;
    errors.push(`${key}: ${show(value)} is not one of ${allowed.join(', ')}.`);
    return fallback;
  };

  const entries = <K extends string>(
    path: string,
    value: unknown,
    names: readonly K[],
    fallback: Readonly<Record<K, string>>,
    problem: (name: K, value: string) => string | undefined
  ): Record<K, string> => {
    const result: Record<K, string> = { ...fallback };
    if (value === undefined) return result;
    if (!isRecord(value)) {
      errors.push(`${path}: expected an object.`);
      return result;
    }
    const allowed = new Set<string>(names);
    for (const [name, entry] of Object.entries(value)) {
      if (!allowed.has(name)) {
        errors.push(`${path}: unknown name ${show(name)}.`);
        continue;
      }
      const wanted =
        typeof entry === 'string' && entry.length <= MAX_VALUE ?
          problem(name as K, entry)
        : 'a short string';
      if (wanted !== undefined)
        errors.push(`${path}.${name}: ${show(entry)} is not ${wanted}.`);
      else result[name as K] = entry as string;
    }
    return result;
  };

  const colorProblem = (_name: ColorName, value: string): string | undefined =>
    COLOR.test(value) ? undefined : 'a color like #1f2328';

  const colors = input.colors;
  if (colors !== undefined && !isRecord(colors))
    errors.push('colors: expected an object.');
  const colorSets = isRecord(colors) ? colors : {};
  for (const key of Object.keys(colorSets))
    if (key !== 'light' && key !== 'dark')
      errors.push(`colors: unknown scheme ${show(key)}.`);

  const split = input.split;
  if (split !== undefined && typeof split !== 'boolean')
    errors.push('split: expected true or false.');

  const look: LookSettings = {
    format: LOOK_FORMAT,
    version: 1,
    look: oneOf('look', LOOK_NAMES, base.look),
    darkMode: oneOf('darkMode', DARK_MODES, base.darkMode),
    inline: oneOf('inline', INLINE_LEVELS, base.inline),
    split: split === true,
    timing: oneOf('timing', TIMINGS, base.timing),
    tokens: entries(
      'tokens',
      input.tokens,
      tokenNames,
      base.tokens,
      tokenProblem
    ),
    colors: {
      light: entries(
        'colors.light',
        colorSets.light,
        colorNames,
        base.colors.light,
        colorProblem
      ),
      dark: entries(
        'colors.dark',
        colorSets.dark,
        colorNames,
        base.colors.dark,
        colorProblem
      ),
    },
  };

  return errors.length > 0 ? { ok: false, errors } : { ok: true, look };
}
