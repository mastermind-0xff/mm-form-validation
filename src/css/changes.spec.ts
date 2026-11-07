import { describe, expect, it } from 'vitest';
import { generateChanges, lookChanges, lookSheet } from './changes.js';
import { generateCss } from './generate.js';
import { LOOK_NAMES, defaultLook, parseLook } from './settings.js';
import type { LookName, LookSettings } from './settings.js';

const look = (change: Partial<LookSettings> = {}): LookSettings => ({
  ...defaultLook(),
  ...change,
});

const shipped = (name: LookName) =>
  generateCss(look({ look: name, inline: 'none' })).stylesheet;

type Page = 'light' | 'dark attribute' | 'dark system' | 'reduced motion';

/**
 * The value of every token on a page, by the rules of the cascade: only what
 * these sheets use, `:root` and `html:root` blocks, some inside an `@media`.
 */
function tokensOn(page: Page, ...sheets: string[]): Map<string, string> {
  const applies = (media: string | undefined, selector: string) => {
    if (media?.includes('prefers-color-scheme') && page !== 'dark system')
      return false;
    if (media?.includes('prefers-reduced-motion') && page !== 'reduced motion')
      return false;
    return !selector.includes('data-scheme') || page === 'dark attribute';
  };
  const weight = (selector: string) =>
    (selector.includes('html') ? 1 : 0) +
    (selector.includes('data-scheme') ? 10 : 0);
  const best = new Map<string, { value: string; weight: number }>();
  for (const sheet of sheets) {
    let media: string | undefined;
    for (const line of sheet.split('\n')) {
      const text = line.trim();
      if (text.startsWith('@media')) media = text;
      else if (line === '}') media = undefined;
      const open = /^(?:html)?:root\S*(?:\[.*\])? \{$/.exec(text);
      if (open) current = applies(media, text) ? weight(text) : undefined;
      else if (text === '}') current = undefined;
      const declaration = /^--fv-([\w-]+): (.*);$/.exec(text);
      if (declaration && current !== undefined) {
        const [, name = '', value = ''] = declaration;
        const known = best.get(name);
        if (known === undefined || current >= known.weight)
          best.set(name, { value, weight: current });
      }
    }
  }
  return new Map([...best].map(([name, { value }]) => [name, value]));
}
let current: number | undefined;

const lookFrom = (input: unknown): LookSettings => {
  const result = parseLook(input);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result.look;
};

const designs: readonly [string, LookSettings][] = LOOK_NAMES.flatMap(
  (name) => {
    const base = defaultLook();
    const tokens = {
      ...base.tokens,
      'pad-x': '20px',
      edge: '3px',
      speed: '500ms',
      'button-radius': '20px',
    };
    const colors = {
      light: {
        ...base.colors.light,
        valid: '#00aa00',
        'line-strong': '#112233',
        button: '#aa0000',
      },
      dark: {
        ...base.colors.dark,
        valid: '#00bb00',
        invalid: '#ff0000',
        button: '#bb0000',
      },
    };
    const made: readonly (readonly [string, Partial<LookSettings>])[] = [
      ['defaults', {}],
      ['tokens', { tokens }],
      ['colors', { colors }],
      ['all', { tokens, colors }],
      ['system dark', { colors, darkMode: 'media' }],
      ['no dark', { colors, darkMode: 'none' }],
    ];
    return made.map(([what, change]): [string, LookSettings] => [
      `${name}: ${what}`,
      look({ look: name, ...change }),
    ]);
  }
);

describe('generateChanges on the shipped stylesheet', () => {
  it.each(designs)(
    '%s gives the same tokens as the whole sheet',
    (_, design) => {
      const pages: Page[] = ['light', 'dark attribute', 'reduced motion'];
      if (design.darkMode === 'media') pages[1] = 'dark system';
      const whole = generateCss({ ...design, inline: 'none' }).stylesheet;
      const changes = generateChanges(design);
      for (const page of pages)
        expect(
          Object.fromEntries(tokensOn(page, shipped(design.look), changes))
        ).toEqual(Object.fromEntries(tokensOn(page, whole)));
    }
  );

  it('holds nothing for the defaults', () => {
    expect(generateChanges(defaultLook())).toBe(
      `/* ${lookSheet('edge')} as it is: nothing to change. */\n`
    );
  });

  it('holds only what differs', () => {
    const changes = generateChanges(
      look({ tokens: { ...defaultLook().tokens, 'pad-x': '20px' } })
    );
    expect(changes).toContain('--fv-pad-x: 20px;');
    expect(changes.match(/--fv-/g)).toHaveLength(1);
  });

  it('leaves out a token the look does not use', () => {
    const changes = generateChanges(
      look({
        look: 'outline',
        tokens: { ...defaultLook().tokens, edge: '3px' },
      })
    );
    expect(changes).not.toContain('--fv-edge');
  });

  it('draws the arrow again when its color changes', () => {
    const base = defaultLook();
    const changes = generateChanges(
      look({
        colors: {
          ...base.colors,
          light: { ...base.colors.light, 'line-strong': '#112233' },
        },
      })
    );
    expect(changes).toContain('--fv-arrow:');
    expect(changes).toContain('%23112233');
  });

  it('keeps reduced motion when the speed changes', () => {
    const changes = generateChanges(
      look({ tokens: { ...defaultLook().tokens, speed: '500ms' } })
    );
    expect(changes).toContain('@media (prefers-reduced-motion: reduce)');
    expect(changes).toContain('--fv-speed: 0ms;');
  });

  it('outweighs the sheet, so the order of the two does not matter', () => {
    const changes = generateChanges(
      look({ tokens: { ...defaultLook().tokens, 'pad-x': '20px' } })
    );
    expect(changes).toContain('html:root {');
  });

  it('refuses what parseLook refuses', () => {
    expect(() =>
      generateChanges(
        look({
          tokens: { ...defaultLook().tokens, 'pad-x': '1px}body{color:red' },
        })
      )
    ).toThrow(TypeError);
  });
});

describe('lookChanges', () => {
  it('holds only the look for the defaults', () => {
    expect(lookChanges(defaultLook())).toEqual({
      format: '@mmutils/form-validation/look',
      version: 1,
      look: 'edge',
    });
  });

  it('holds what differs', () => {
    const base = defaultLook();
    expect(
      lookChanges(
        look({
          look: 'icon',
          darkMode: 'none',
          inline: 'all',
          split: true,
          timing: 'input',
          tokens: { ...base.tokens, edge: '3px' },
          colors: {
            light: { ...base.colors.light, button: '#aa0000' },
            dark: { ...base.colors.dark, button: '#bb0000' },
          },
        })
      )
    ).toEqual({
      format: '@mmutils/form-validation/look',
      version: 1,
      look: 'icon',
      darkMode: 'none',
      inline: 'all',
      split: true,
      timing: 'input',
      tokens: { edge: '3px' },
      colors: { light: { button: '#aa0000' }, dark: { button: '#bb0000' } },
    });
  });

  it('holds one scheme when only one differs', () => {
    const base = defaultLook();
    expect(
      lookChanges(
        look({
          colors: {
            ...base.colors,
            dark: { ...base.colors.dark, button: '#bb0000' },
          },
        })
      ).colors
    ).toEqual({ dark: { button: '#bb0000' } });
  });

  it.each(designs)('%s reads back whole', (_, design) => {
    expect(lookFrom(JSON.parse(JSON.stringify(lookChanges(design))))).toEqual(
      design
    );
  });
});
