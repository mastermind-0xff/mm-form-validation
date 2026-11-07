/**
 * Settings to CSS. The designer page styles its own forms with this output, so
 * what a developer sees there is what the project gets.
 */
import {
  AT_RULES,
  BASE_RULES,
  ICON_INVALID,
  ICON_VALID,
  LOOK_RULES,
  arrowImage,
} from './rules.js';
import type { AtRule, Rule } from './rules.js';
import { parseLook } from './settings.js';
import type { ColorName, InlineLevel, LookSettings } from './settings.js';

export interface GeneratedCss {
  /** The file to link. Empty when everything went into the HTML. */
  readonly stylesheet: string;
  /** The minified part for a `<style>` in the HTML, empty for `none`. */
  readonly inline: string;
  /** The `--fv-*` names this look uses. A control for any other does nothing. */
  readonly tokens: readonly string[];
}

/**
 * What decides the size and place of things. An inline block with these
 * declarations gives the page its final geometry; the rest can arrive later.
 * `border` keeps its color with it: a width needs a style, and the shorthand
 * holds all three.
 */
export const LAYOUT_PROPERTIES: ReadonlySet<string> = new Set([
  'align-items',
  'align-self',
  'appearance',
  'border',
  'border-bottom-width',
  'border-width',
  'box-sizing',
  'content',
  'display',
  'flex-wrap',
  'font',
  'font-family',
  'font-size',
  'font-weight',
  'gap',
  'grid-area',
  'height',
  'justify-self',
  'line-height',
  'margin',
  'margin-right',
  'min-height',
  'min-width',
  'padding',
  'padding-left',
  'padding-right',
  'width',
]);

/** Not before the form is in use: changes that animate are for later. */
const MOTION_PROPERTIES: ReadonlySet<string> = new Set([
  'animation',
  'transition',
]);

/** Exists only after the binding ran or the user acted. */
const INTERACTION = /\[data-(?:state|message)|:focus-visible|:hover|:active/;

const inlines = (level: InlineLevel, property: string): boolean =>
  level === 'layout' ?
    LAYOUT_PROPERTIES.has(property)
  : !MOTION_PROPERTIES.has(property);

/** Splits rules by declaration, keeping their order on both sides. */
function partition(
  rules: readonly Rule[],
  level: InlineLevel
): { inline: Rule[]; rest: Rule[] } {
  if (level === 'none') return { inline: [], rest: [...rules] };
  if (level === 'all') return { inline: [...rules], rest: [] };
  const inline: Rule[] = [];
  const rest: Rule[] = [];
  for (const rule of rules) {
    if (INTERACTION.test(rule.selector)) {
      rest.push(rule);
      continue;
    }
    const entries = Object.entries(rule.declarations);
    const part = (keep: boolean): Record<string, string> =>
      Object.fromEntries(
        entries.filter(([property]) => inlines(level, property) === keep)
      );
    const kept = part(true);
    const others = part(false);
    const moved = Object.keys(kept).length > 0;
    if (moved) inline.push({ selector: rule.selector, declarations: kept });
    // a comment describes the whole rule: it stays only on a whole rule
    if (Object.keys(others).length > 0)
      rest.push(
        moved ? { selector: rule.selector, declarations: others } : rule
      );
  }
  return { inline, rest };
}

/**
 * Drops what a look replaces: with the same selector, the later declaration of a
 * property always wins. The output gets smaller, and a token that only such a
 * declaration used counts as unused, so its control says it does nothing here.
 */
function withoutReplaced(rules: readonly Rule[]): Rule[] {
  const key = (rule: Rule, property: string) => `${rule.selector}|${property}`;
  const last = new Map<string, Rule>();
  for (const rule of rules)
    for (const property of Object.keys(rule.declarations))
      last.set(key(rule, property), rule);
  return rules.map((rule) => ({
    ...rule,
    declarations: Object.fromEntries(
      Object.entries(rule.declarations).filter(
        ([property]) => last.get(key(rule, property)) === rule
      )
    ),
  }));
}

const VAR = /var\(--fv-([\w-]+)/g;

function usedNames(rules: readonly Rule[]): Set<string> {
  const names = new Set<string>();
  for (const rule of rules)
    for (const value of Object.values(rule.declarations))
      for (const match of value.matchAll(VAR)) names.add(match[1] as string);
  return names;
}

export function tokenValues(look: LookSettings): Map<string, string> {
  return new Map([
    ...Object.entries(look.tokens),
    ...Object.entries(look.colors.light),
    ['arrow', arrowImage(look.colors.light['line-strong'])],
    ['icon-valid', ICON_VALID],
    ['icon-invalid', ICON_INVALID],
  ]);
}

/** What changes in dark: the colors that differ, and the arrow drawn with them. */
export function darkValues(look: LookSettings): Map<string, string> {
  const { light, dark } = look.colors;
  const values = new Map<string, string>();
  for (const [name, value] of Object.entries(dark))
    if (value !== light[name as ColorName]) values.set(name, value);
  if (dark['line-strong'] !== light['line-strong'])
    values.set('arrow', arrowImage(dark['line-strong']));
  return values;
}

const vars = (
  values: ReadonlyMap<string, string>,
  names: ReadonlySet<string>
): Record<string, string> =>
  Object.fromEntries(
    [...values]
      .filter(([name]) => names.has(name))
      .map(([name, value]) => [`--fv-${name}`, value])
  );

type Item = Rule | AtRule;

const isAtRule = (item: Item): item is AtRule => 'at' in item;

function printRule(rule: Rule, minify: boolean, indent = ''): string {
  const entries = Object.entries(rule.declarations);
  if (minify) {
    const selector = rule.selector.replace(/\s*([>,])\s*/g, '$1');
    const body = entries
      .map(([key, value]) => `${key}:${value.replace(/,\s+/g, ',')}`)
      .join(';');
    return `${selector}{${body}}`;
  }
  const comment =
    rule.comment === undefined ? '' : `${indent}/* ${rule.comment} */\n`;
  const body = entries
    .map(([key, value]) => `${indent}  ${key}: ${value};\n`)
    .join('');
  return `${comment}${indent}${rule.selector} {\n${body}${indent}}`;
}

function printItem(item: Item, minify: boolean): string {
  if (!isAtRule(item)) return printRule(item, minify);
  if (minify)
    return `${item.at}{${item.rules.map((rule) => printRule(rule, true)).join('')}}`;
  const body = item.rules
    .map((rule) => printRule(rule, false, '  '))
    .join('\n');
  return `${item.at} {\n${body}\n}`;
}

/** One sheet: the tokens its rules use, the dark colors, then the rules. */
function printSheet(
  look: LookSettings,
  rules: readonly Rule[],
  atRules: readonly AtRule[],
  names: ReadonlySet<string>,
  minify: boolean
): string {
  const items: Item[] = [];
  const light = vars(tokenValues(look), names);
  if (Object.keys(light).length > 0)
    items.push({ selector: ':root', declarations: light });
  const dark = vars(darkValues(look), names);
  if (Object.keys(dark).length > 0) {
    if (look.darkMode === 'attribute')
      items.push({ selector: ":root[data-scheme='dark']", declarations: dark });
    if (look.darkMode === 'media')
      items.push({
        at: '@media (prefers-color-scheme: dark)',
        rules: [{ selector: ':root', declarations: dark }],
      });
  }
  items.push(...rules, ...atRules);
  return items
    .map((item) => printItem(item, minify))
    .join(minify ? '' : '\n\n');
}

const header = (look: LookSettings): string =>
  `/*
 * Form fields, the "${look.look}" look. Generated by @mmutils/form-validation/css
 * from its settings; change those and generate again, or set the --fv-* tokens.
 *
 * The binding sets attributes only; these rules style them:
 *   [data-field]                     the field's wrapper
 *   [data-state="valid" | "invalid"] on the wrapper (none: neutral)
 *   [data-message="hint" | "error"]  on the wrapper (none: no message)
 *   :required                        on the controls, from the schema
 *   .fv-box                          the element that shows the state
 *   .fv-message                      the message line under the box
 *   .fv-submit                       the submit button
 */\n\n`;

/**
 * Settings to CSS. Everything is checked first: the output goes into a
 * `<style>`, so no value reaches it unchecked, whoever built the object.
 */
export function generateCss(settings: LookSettings): GeneratedCss {
  const checked = parseLook(settings);
  if (!checked.ok) throw new TypeError(checked.errors.join(' '));
  const look = checked.look;

  const rules = withoutReplaced([...BASE_RULES, ...LOOK_RULES[look.look]]);
  const { inline, rest } = partition(rules, look.inline);
  const allNames = usedNames(rules);
  const inlineNames = usedNames(inline);

  const inlineCss =
    look.inline === 'none' ?
      ''
    : printSheet(
        look,
        inline,
        look.inline === 'all' ? AT_RULES : [],
        inlineNames,
        true
      );

  // a split sheet holds what the inline block doesn't, its tokens included
  const sheetRules = look.split ? rest : rules;
  const sheetNames =
    look.split ?
      new Set([...usedNames(rest)].filter((name) => !inlineNames.has(name)))
    : allNames;
  const sheet =
    sheetRules.length === 0 ?
      ''
    : `${header(look)}${printSheet(look, sheetRules, AT_RULES, sheetNames, false)}\n`;

  const known = tokenValues(look);
  return {
    stylesheet: sheet,
    inline: inlineCss,
    tokens: [...allNames].filter((name) => known.has(name)),
  };
}
