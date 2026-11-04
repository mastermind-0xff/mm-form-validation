import { describe, expect, it } from 'vitest';
import { LAYOUT_PROPERTIES, generateCss } from './generate.js';
import { AT_RULES, BASE_RULES, LOOK_RULES } from './rules.js';
import { COLORS, LOOK_NAMES, defaultLook } from './settings.js';
import type { InlineLevel, LookName, LookSettings } from './settings.js';

interface Declaration {
  readonly at: string;
  readonly selector: string;
  readonly property: string;
  readonly value: string;
}

/** Enough of a parser for what the generator prints; fails on anything else. */
function parseCss(css: string): Declaration[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: Declaration[] = [];
  const stack: string[] = [];
  let position = 0;
  for (;;) {
    const open = text.indexOf('{', position);
    const close = text.indexOf('}', position);
    if (close < 0) {
      expect(text.slice(position).trim()).toBe('');
      expect(open).toBe(-1);
      expect(stack).toEqual([]);
      return found;
    }
    if (open < 0 || close < open) {
      expect(stack.length).toBeGreaterThan(0);
      stack.pop();
      position = close + 1;
      continue;
    }
    const head = text.slice(position, open).trim();
    if (head.startsWith('@')) {
      stack.push(head);
      position = open + 1;
      continue;
    }
    const body = text.slice(open + 1, close);
    expect(body.trim(), `empty rule ${head}`).not.toBe('');
    const selector = head.replace(/\s*([>,])\s*/g, '$1');
    for (const part of body.split(';')) {
      if (part.trim() === '') continue;
      const colon = part.indexOf(':');
      expect(colon).toBeGreaterThan(0);
      found.push({
        at: stack.join(' '),
        selector,
        property: part.slice(0, colon).trim(),
        value: part
          .slice(colon + 1)
          .trim()
          .replace(/,\s+/g, ','),
      });
    }
    position = close + 1;
  }
}

const id = (d: Declaration) => `${d.at}|${d.selector}|${d.property}|${d.value}`;
const isRoot = (d: Declaration) => d.selector.startsWith(':root');

const look = (changes: Partial<LookSettings> = {}): LookSettings => ({
  ...defaultLook(),
  ...changes,
});

const everyLook = LOOK_NAMES.map((name): [LookName] => [name]);
const partLevels: readonly InlineLevel[] = ['layout', 'paint'];
const matrix = LOOK_NAMES.flatMap((name) =>
  partLevels.map((level): [LookName, InlineLevel] => [name, level])
);

/** Every var() must resolve, or have a fallback. */
function dangling(declarations: readonly Declaration[]): string[] {
  const defined = new Set(
    declarations
      .filter((d) => d.property.startsWith('--'))
      .map((d) => d.property)
  );
  const missing = new Set<string>();
  for (const { value } of declarations)
    for (const [, name] of value.matchAll(/var\((--[\w-]+)\)/g))
      if (!defined.has(name as string)) missing.add(name as string);
  return [...missing];
}

describe('generateCss: the stylesheet', () => {
  it.each(everyLook)('%s parses, with nothing unresolved', (name) => {
    const { stylesheet } = generateCss(look({ look: name, inline: 'none' }));
    const declarations = parseCss(stylesheet);
    expect(declarations.length).toBeGreaterThan(40);
    expect(dangling(declarations)).toEqual([]);
    expect(stylesheet).not.toContain('undefined');
    expect(stylesheet).not.toContain('data-look');
  });

  it.each(everyLook)('%s has each declaration once', (name) => {
    const rules = parseCss(
      generateCss(look({ look: name, inline: 'none' })).stylesheet
    ).filter((d) => d.at === '' && !isRoot(d));
    const keys = rules.map((d) => `${d.selector}|${d.property}`);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it('keeps what a look keeps: its own rules win over the base', () => {
    const rules = parseCss(
      generateCss(look({ look: 'underline', inline: 'none' })).stylesheet
    );
    const box = rules.filter((d) => d.selector === '.fv-box');
    expect(box.find((d) => d.property === 'border-radius')?.value).toBe('0');
    expect(box.find((d) => d.property === 'padding')?.value).toBe(
      'var(--fv-pad-y) 2px'
    );
    expect(box.find((d) => d.property === 'background-color')?.value).toBe(
      'transparent'
    );
  });

  it('holds the tokens this look uses, and only those', () => {
    const names = (name: LookName) => generateCss(look({ look: name })).tokens;
    expect(names('edge')).toContain('edge');
    expect(names('outline')).not.toContain('edge');
    expect(names('filled')).toContain('fill');
    expect(names('edge')).not.toContain('fill');
    expect(names('icon')).toContain('icon-valid');
    expect(names('edge')).not.toContain('icon-valid');
    // replaced by the look: their controls would do nothing
    expect(names('underline')).not.toContain('radius');
    expect(names('underline')).not.toContain('bg');
    expect(names('underline')).not.toContain('pad-x');
    expect(names('filled')).not.toContain('bg');
    expect(names('filled')).not.toContain('border');
    // local to the rules, not settings
    expect(names('icon')).not.toContain('state');
    expect(names('icon')).not.toContain('shown');
  });

  it('prints only the tokens it reports', () => {
    for (const name of LOOK_NAMES) {
      const { stylesheet, tokens } = generateCss(
        look({ look: name, inline: 'none' })
      );
      const root = parseCss(stylesheet)
        .filter((d) => d.selector === ':root' && d.at === '')
        .map((d) => d.property);
      expect(root.sort()).toEqual(tokens.map((t) => `--fv-${t}`).sort());
    }
  });

  it('carries the values of the settings', () => {
    const base = defaultLook();
    const { stylesheet } = generateCss({
      ...base,
      inline: 'none',
      tokens: { ...base.tokens, 'pad-x': '21px', 'message-lines': '2' },
      colors: {
        ...base.colors,
        light: { ...base.colors.light, valid: '#123456' },
      },
    });
    expect(stylesheet).toContain('--fv-pad-x: 21px;');
    expect(stylesheet).toContain('--fv-message-lines: 2;');
    expect(stylesheet).toContain('--fv-valid: #123456;');
  });

  it('reserves the message lines the settings ask for', () => {
    const message = parseCss(generateCss(look()).stylesheet).find(
      (d) => d.selector === '.fv-message' && d.property === 'min-height'
    );
    expect(message?.value).toContain('var(--fv-message-lines)');
  });

  it('draws the arrow in the color of the line', () => {
    const base = defaultLook();
    const { stylesheet } = generateCss({
      ...base,
      inline: 'none',
      darkMode: 'attribute',
      colors: {
        light: { ...base.colors.light, 'line-strong': '#aabbcc' },
        dark: { ...base.colors.dark, 'line-strong': '#ddeeff' },
      },
    });
    expect(stylesheet).toContain("stroke='%23aabbcc'");
    expect(stylesheet).toContain("stroke='%23ddeeff'");
  });

  it('turns motion off for those who ask for it', () => {
    const declarations = parseCss(generateCss(look()).stylesheet);
    expect(
      declarations.find(
        (d) => d.at === '@media (prefers-reduced-motion: reduce)'
      )
    ).toMatchObject({
      selector: ':root',
      property: '--fv-speed',
      value: '0ms',
    });
  });

  it('says what it is, in a comment only', () => {
    const { stylesheet } = generateCss(look({ look: 'icon' }));
    expect(stylesheet.startsWith('/*')).toBe(true);
    expect(stylesheet).toContain('the "icon" look');
    expect(stylesheet.endsWith('\n')).toBe(true);
  });
});

describe('generateCss: dark colors', () => {
  const dark = (mode: LookSettings['darkMode'], inline: InlineLevel = 'none') =>
    parseCss(
      generateCss(look({ darkMode: mode, inline, split: false })).stylesheet
    );

  it('has none for `none`', () => {
    const declarations = dark('none');
    expect(declarations.some((d) => d.selector.includes('data-scheme'))).toBe(
      false
    );
    expect(
      declarations.some((d) => d.at.includes('prefers-color-scheme'))
    ).toBe(false);
  });

  it('follows the attribute for `attribute`', () => {
    const rules = dark('attribute').filter(
      (d) => d.selector === ":root[data-scheme='dark']"
    );
    expect(rules.find((d) => d.property === '--fv-bg')?.value).toBe(
      COLORS.bg.dark
    );
  });

  it('follows the system for `media`', () => {
    const rules = dark('media').filter(
      (d) => d.at === '@media (prefers-color-scheme: dark)'
    );
    expect(rules.every((d) => d.selector === ':root')).toBe(true);
    expect(rules.find((d) => d.property === '--fv-bg')?.value).toBe(
      COLORS.bg.dark
    );
  });

  it('repeats only what differs and what the look uses', () => {
    const rules = dark('attribute').filter((d) =>
      d.selector.includes('data-scheme')
    );
    // the same green in both schemes
    expect(rules.some((d) => d.property === '--fv-valid')).toBe(false);
    // only the filled look uses the tint
    expect(rules.some((d) => d.property === '--fv-fill')).toBe(false);
  });

  it('has no dark block when nothing differs', () => {
    const base = defaultLook();
    const { stylesheet, inline } = generateCss({
      ...base,
      colors: { light: base.colors.light, dark: base.colors.light },
    });
    expect(stylesheet).not.toContain('data-scheme');
    expect(inline).not.toContain('data-scheme');
  });

  it('holds what the inline block paints, so a dark page starts dark', () => {
    const { inline } = generateCss(look({ inline: 'paint' }));
    const rules = parseCss(inline).filter((d) =>
      d.selector.includes('data-scheme')
    );
    expect(rules.map((d) => d.property)).toContain('--fv-bg');
    expect(rules.map((d) => d.property)).toContain('--fv-arrow');
    // what only shows when a field has a state stays out
    expect(rules.map((d) => d.property)).not.toContain('--fv-invalid');
  });
});

describe('generateCss: the inline block', () => {
  it.each(matrix)('%s/%s is a part of the stylesheet', (name, level) => {
    const { inline, stylesheet } = generateCss(
      look({ look: name, inline: level })
    );
    const full = new Set(parseCss(stylesheet).map(id));
    for (const declaration of parseCss(inline))
      expect(full, id(declaration)).toContain(id(declaration));
  });

  it.each(matrix)('%s/%s resolves on its own', (name, level) => {
    const { inline } = generateCss(look({ look: name, inline: level }));
    expect(dangling(parseCss(inline))).toEqual([]);
  });

  it.each(matrix)(
    '%s/%s leaves out what only matters once in use',
    (name, level) => {
      const { inline } = generateCss(look({ look: name, inline: level }));
      expect(inline).not.toMatch(/data-state|data-message|focus-visible/);
      expect(inline).not.toMatch(/transition|animation|@keyframes/);
    }
  );

  it.each(matrix)('%s/%s holds the whole geometry', (name, level) => {
    const { inline, stylesheet } = generateCss(
      look({ look: name, inline: level })
    );
    const held = new Set(parseCss(inline).map(id));
    const interaction = /\[data-(?:state|message)|:focus-visible/;
    for (const declaration of parseCss(stylesheet))
      if (
        LAYOUT_PROPERTIES.has(declaration.property) &&
        !interaction.test(declaration.selector)
      )
        expect(held, id(declaration)).toContain(id(declaration));
  });

  it('keeps the rule that hides inactive fields', () => {
    for (const level of partLevels)
      expect(generateCss(look({ inline: level })).inline).toContain(
        '.fv-field[hidden]{display:none}'
      );
  });

  it.each(everyLook)('layout, for %s, is only geometry', (name) => {
    const { inline } = generateCss(look({ look: name, inline: 'layout' }));
    const rules = parseCss(inline).filter((d) => !isRoot(d));
    expect(rules.length).toBeGreaterThan(10);
    for (const { property } of rules)
      expect(LAYOUT_PROPERTIES, property).toContain(property);
  });

  it('paint adds to layout', () => {
    const layout = generateCss(look({ inline: 'layout' })).inline;
    const paint = generateCss(look({ inline: 'paint' })).inline;
    expect(paint.length).toBeGreaterThan(layout.length);
    expect(paint).toContain('border-radius');
    expect(layout).not.toContain('border-radius');
    expect(paint).toContain('--fv-arrow');
    expect(layout).not.toContain('--fv-arrow');
  });

  it('is minified: no comments, no line breaks', () => {
    for (const level of ['layout', 'paint', 'all'] as const) {
      const { inline } = generateCss(look({ inline: level }));
      expect(inline).not.toContain('/*');
      expect(inline).not.toContain('\n');
      expect(inline).not.toContain('> ');
    }
  });

  it('can never close its <style>', () => {
    for (const level of ['layout', 'paint', 'all'] as const)
      for (const name of LOOK_NAMES)
        expect(
          generateCss(look({ look: name, inline: level })).inline
        ).not.toMatch(/<(?!svg)/i);
  });

  it('`none` is empty, and the stylesheet is whole', () => {
    const none = generateCss(look({ inline: 'none' }));
    expect(none.inline).toBe('');
    expect(generateCss(look({ inline: 'none', split: true })).stylesheet).toBe(
      none.stylesheet
    );
  });

  it('`all` is the whole stylesheet, keyframes and all', () => {
    const { inline, stylesheet } = generateCss(look({ inline: 'all' }));
    expect(new Set(parseCss(inline).map(id))).toEqual(
      new Set(parseCss(stylesheet).map(id))
    );
    expect(inline).toContain('@keyframes fv-error');
    expect(inline).toContain('prefers-reduced-motion');
  });
});

describe('generateCss: a split stylesheet', () => {
  it.each(matrix)('%s/%s loses nothing and repeats nothing', (name, level) => {
    const whole = generateCss(look({ look: name, inline: level }));
    const split = generateCss(look({ look: name, inline: level, split: true }));
    const parts = [
      ...parseCss(split.inline).filter((d) => !isRoot(d)),
      ...parseCss(split.stylesheet).filter((d) => !isRoot(d)),
    ]
      .map(id)
      .sort();
    const all = parseCss(whole.stylesheet)
      .filter((d) => !isRoot(d))
      .map(id)
      .sort();
    expect(parts).toEqual(all);
  });

  it.each(matrix)('%s/%s splits the tokens too', (name, level) => {
    const whole = generateCss(look({ look: name, inline: level }));
    const split = generateCss(look({ look: name, inline: level, split: true }));
    const tokens = (css: string) => parseCss(css).filter(isRoot).map(id);
    const fromParts = [...tokens(split.inline), ...tokens(split.stylesheet)];
    expect(fromParts.length).toBe(new Set(fromParts).size);
    expect(fromParts.sort()).toEqual(tokens(whole.stylesheet).sort());
  });

  it.each(matrix)('%s/%s resolves with the block in front', (name, level) => {
    const { inline, stylesheet } = generateCss(
      look({ look: name, inline: level, split: true })
    );
    expect(dangling(parseCss(inline + stylesheet))).toEqual([]);
  });

  // the block comes first in the page: a rule moved into it must not end up in
  // front of a rule it used to come after and override
  it.each(matrix)('%s/%s keeps the order that matters', (name, level) => {
    const { inline } = generateCss(look({ look: name, inline: level }));
    const whole = parseCss(
      generateCss(look({ look: name, inline: 'none' })).stylesheet
    ).filter((d) => d.at === '' && !isRoot(d));
    const held = new Set(parseCss(inline).map(id));
    const related = (a: string, b: string) =>
      a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`);
    whole.forEach((later, index) => {
      if (!held.has(id(later))) return;
      for (const earlier of whole.slice(0, index))
        if (!held.has(id(earlier)) && related(earlier.property, later.property))
          expect.fail(
            `${later.selector} ${later.property} moved in front of ${earlier.selector} ${earlier.property}`
          );
    });
  });

  it('is empty when everything is inline', () => {
    const { inline, stylesheet } = generateCss(
      look({ inline: 'all', split: true })
    );
    expect(stylesheet).toBe('');
    expect(inline).not.toBe('');
  });

  it('moves a comment only with a whole rule', () => {
    const { stylesheet } = generateCss(look({ inline: 'paint', split: true }));
    // .fv-box left behind only its transition: its comment was about spacing
    expect(stylesheet).not.toContain('The same spacing for every box');
  });
});

describe('generateCss: the rules', () => {
  // what isn't layout must be listed here, so a new property has to be sorted
  const NOT_LAYOUT = new Set([
    '--fv-icon',
    '--fv-shown',
    '--fv-speed',
    '--fv-state',
    'accent-color',
    'animation',
    'background-color',
    'background-image',
    'background-position',
    'background-repeat',
    'background-size',
    'border-color',
    'border-radius',
    'box-shadow',
    'color',
    'cursor',
    'mask',
    'opacity',
    'outline',
    'outline-offset',
    'pointer-events',
    'resize',
    'scale',
    'transition',
    'translate',
  ]);

  it('sorts every property into layout or not', () => {
    const rules = [
      ...BASE_RULES,
      ...Object.values(LOOK_RULES).flat(),
      ...AT_RULES.flatMap((item) => item.rules),
    ];
    const unsorted = rules
      .flatMap((rule) => Object.keys(rule.declarations))
      .filter((p) => !LAYOUT_PROPERTIES.has(p) && !NOT_LAYOUT.has(p));
    expect(unsorted).toEqual([]);
  });

  it('has no property on both lists', () => {
    expect([...LAYOUT_PROPERTIES].filter((p) => NOT_LAYOUT.has(p))).toEqual([]);
  });

  it('has a block for every look', () => {
    expect(Object.keys(LOOK_RULES).sort()).toEqual([...LOOK_NAMES].sort());
  });
});

describe('generateCss: what it is given', () => {
  it('refuses settings that would not parse, whoever built them', () => {
    const base = defaultLook();
    expect(() =>
      generateCss({
        ...base,
        tokens: { ...base.tokens, font: '</style><script>' },
      })
    ).toThrow(TypeError);
    expect(() => generateCss({ ...base, look: 'neon' as LookName })).toThrow(
      /neon/
    );
  });

  it('gives the same output for the same settings', () => {
    expect(generateCss(defaultLook())).toEqual(generateCss(defaultLook()));
  });
});
