/**
 * Only what differs from the defaults, as settings and as CSS. The
 * package ships a stylesheet per look (`@mmutils/form-validation/looks/edge.css`);
 * the changes go on top of it, in either order: `html:root` outweighs its `:root`.
 */
import { tokenValues, darkValues, generateCss } from './generate.js';
import { LOOK_FORMAT, defaultLook, parseLook } from './settings.js';
import type { LookName, LookSettings } from './settings.js';

const differing = (
  now: Readonly<Record<string, string>>,
  before: Readonly<Record<string, string>>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(now).filter(([name, value]) => value !== before[name])
  );

const isEmpty = (record: object): boolean => Object.keys(record).length === 0;

/** The settings of a look that aren't defaults, which `parseLook` reads back whole. */
export interface LookChanges {
  readonly format: typeof LOOK_FORMAT;
  readonly version: 1;
  readonly look: LookName;
  readonly darkMode?: LookSettings['darkMode'];
  readonly inline?: LookSettings['inline'];
  readonly split?: boolean;
  readonly timing?: LookSettings['timing'];
  readonly tokens?: Readonly<Record<string, string>>;
  readonly colors?: {
    readonly light?: Readonly<Record<string, string>>;
    readonly dark?: Readonly<Record<string, string>>;
  };
}

export function lookChanges(look: LookSettings): LookChanges {
  const base = defaultLook();
  const tokens = differing(look.tokens, base.tokens);
  const light = differing(look.colors.light, base.colors.light);
  const dark = differing(look.colors.dark, base.colors.dark);
  return {
    format: LOOK_FORMAT,
    version: 1,
    look: look.look,
    ...(look.darkMode !== base.darkMode && { darkMode: look.darkMode }),
    ...(look.inline !== base.inline && { inline: look.inline }),
    ...(look.split !== base.split && { split: look.split }),
    ...(look.timing !== base.timing && { timing: look.timing }),
    ...(!isEmpty(tokens) && { tokens }),
    ...((!isEmpty(light) || !isEmpty(dark)) && {
      colors: {
        ...(!isEmpty(light) && { light }),
        ...(!isEmpty(dark) && { dark }),
      },
    }),
  };
}

const block = (
  selector: string,
  values: Readonly<Record<string, string>>,
  indent = ''
): string =>
  `${indent}${selector} {\n${Object.entries(values)
    .map(([name, value]) => `${indent}  --fv-${name}: ${value};\n`)
    .join('')}${indent}}`;

/** The path of the stylesheet a look's changes go on top of. */
export const lookSheet = (look: LookName): string =>
  `@mmutils/form-validation/looks/${look}.css`;

/**
 * Ready-to-use CSS with only what differs from the look's shipped stylesheet.
 * Tokens the look doesn't use are left out.
 */
export function generateChanges(settings: LookSettings): string {
  const checked = parseLook(settings);
  if (!checked.ok) throw new TypeError(checked.errors.join(' '));
  const look = checked.look;
  const base: LookSettings = { ...defaultLook(), look: look.look };
  const used = new Set(generateCss(look).tokens);
  const only = (values: ReadonlyMap<string, string>) =>
    Object.fromEntries([...values].filter(([name]) => used.has(name)));

  const light = only(tokenValues(look));
  const before = only(tokenValues(base));
  const shippedDark = only(darkValues(base));
  const wantedDark = look.darkMode === 'none' ? {} : only(darkValues(look));

  const parts: string[] = [];
  const lightChanges = differing(light, before);
  if (!isEmpty(lightChanges)) parts.push(block('html:root', lightChanges));

  if (look.darkMode === 'media') {
    // the shipped sheet's attribute rule outweighs `html:root`: on a page that has
    // the attribute anyway, only the system may decide, as in the whole sheet
    const attribute = "html:root[data-scheme='dark']";
    const undone = (values: Readonly<Record<string, string>>) =>
      Object.fromEntries(
        Object.keys(shippedDark).map((name) => [
          name,
          values[name] ?? (light[name] as string),
        ])
      );
    parts.push(block(attribute, undone(light)));
    parts.push(
      `@media (prefers-color-scheme: dark) {\n${block('html:root', wantedDark, '  ')}\n\n${block(attribute, undone(wantedDark), '  ')}\n}`
    );
  }
  // under the attribute, a color has its shipped dark value if it has one, else
  // the light one: what differs from that is what has to be said
  const shown = { ...light, ...shippedDark };
  const wanted = { ...light, ...wantedDark };
  const darkChanges = differing(wanted, shown);
  if (look.darkMode !== 'media' && !isEmpty(darkChanges))
    parts.push(block("html:root[data-scheme='dark']", darkChanges));

  // the shipped rule for reduced motion is weaker than a changed speed
  if (lightChanges['speed'] !== undefined)
    parts.push(
      `@media (prefers-reduced-motion: reduce) {\n${block('html:root', { speed: '0ms' }, '  ')}\n}`
    );

  const sheet = lookSheet(look.look);
  return parts.length === 0 ?
      `/* ${sheet} as it is: nothing to change. */\n`
    : `/* What differs from ${sheet}. Load both, in any order. */\n\n${parts.join('\n\n')}\n`;
}
