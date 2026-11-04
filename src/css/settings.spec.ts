import { describe, expect, it } from 'vitest';
import {
  COLORS,
  LOOK_FORMAT,
  TOKENS,
  defaultLook,
  parseLook,
} from './settings.js';

const errorsOf = (input: unknown): readonly string[] => {
  const result = parseLook(input);
  return result.ok ? [] : result.errors;
};

const parsed = (input: unknown) => {
  const result = parseLook(input);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result.look;
};

describe('defaultLook', () => {
  it('has every token and color, in both schemes', () => {
    const look = defaultLook();
    expect(Object.keys(look.tokens)).toEqual(Object.keys(TOKENS));
    expect(Object.keys(look.colors.light)).toEqual(Object.keys(COLORS));
    expect(Object.keys(look.colors.dark)).toEqual(Object.keys(COLORS));
  });

  it('is valid, and the same after a trip through JSON', () => {
    const look = defaultLook();
    expect(parsed(JSON.parse(JSON.stringify(look)))).toEqual(look);
  });

  it('gives a new object each time', () => {
    expect(defaultLook().tokens).not.toBe(defaultLook().tokens);
  });
});

describe('parseLook: what is missing', () => {
  it('gets its default', () => {
    expect(parsed({})).toEqual(defaultLook());
  });

  it('leaves the rest of a group as given', () => {
    const look = parsed({
      tokens: { 'pad-x': '24px' },
      colors: { dark: { valid: '#00ff00' } },
    });
    expect(look.tokens['pad-x']).toBe('24px');
    expect(look.tokens['pad-y']).toBe(TOKENS['pad-y'].value);
    expect(look.colors.dark.valid).toBe('#00ff00');
    expect(look.colors.light.valid).toBe(COLORS.valid.light);
  });
});

describe('parseLook: what is given', () => {
  it('keeps every kind of setting', () => {
    const look = parsed({
      format: LOOK_FORMAT,
      version: 1,
      look: 'icon',
      darkMode: 'media',
      inline: 'all',
      split: true,
      timing: 'input',
    });
    expect(look).toMatchObject({
      look: 'icon',
      darkMode: 'media',
      inline: 'all',
      split: true,
      timing: 'input',
    });
  });

  it.each([
    'inherit',
    'system-ui',
    'system-ui, sans-serif',
    "'Segoe UI', Roboto, sans-serif",
    '"Helvetica Neue",Arial',
  ])('accepts the font %s', (font) => {
    expect(parsed({ tokens: { font } }).tokens.font).toBe(font);
  });

  it.each([
    'linear',
    'ease-in-out',
    'cubic-bezier(0.7, 0, 0.3, 1)',
    'cubic-bezier(.2,0,0,1)',
    'cubic-bezier(0.3, -0.5, 0.2, 1.4)',
  ])('accepts the easing %s', (ease) => {
    expect(parsed({ tokens: { ease } }).tokens.ease).toBe(ease);
  });

  it.each([
    ['pad-x', '0px'],
    ['pad-x', '100px'],
    ['pad-x', '12.5px'],
    ['label-size', '1rem'],
    ['message-line', '1.45'],
    ['speed', '0ms'],
  ])('accepts %s: %s, also outside the range of its slider', (name, value) => {
    expect(parsed({ tokens: { [name]: value } }).tokens).toHaveProperty(
      name,
      value
    );
  });
});

describe('parseLook: what would leave its declaration', () => {
  const hostile = [
    '</style><script>alert(1)</script>',
    'x;}body{display:none}',
    'red;background:url(//evil.example)',
    'x}',
    'x{',
    '"unclosed',
    "'unclosed",
    '/* comment',
    'expression(alert(1))',
    'x\ny',
  ];

  it.each(hostile)('refuses %s as a font', (value) => {
    expect(errorsOf({ tokens: { font: value } })).toHaveLength(1);
  });

  it.each(hostile)('refuses %s as an easing', (value) => {
    expect(errorsOf({ tokens: { ease: value } })).toHaveLength(1);
  });

  it.each(hostile)('refuses %s as a size', (value) => {
    expect(errorsOf({ tokens: { 'pad-x': value } })).toHaveLength(1);
  });

  it.each(hostile)('refuses %s as a color', (value) => {
    expect(errorsOf({ colors: { light: { bg: value } } })).toHaveLength(1);
  });

  it('refuses a color that is not plain hex', () => {
    for (const value of ['red', '#fff', '#12345g', 'rgb(0,0,0)'])
      expect(errorsOf({ colors: { dark: { bg: value } } })).toHaveLength(1);
  });

  it('refuses a size in another unit', () => {
    for (const value of ['10em', '10', '-1px', '1e3px'])
      expect(errorsOf({ tokens: { 'pad-x': value } })).toHaveLength(1);
  });

  it('refuses a value that is too long, before reading it', () => {
    const font = 'a'.repeat(201);
    expect(errorsOf({ tokens: { font } })[0]).toContain('short string');
    expect(
      parsed({ tokens: { font: 'a'.repeat(200) } }).tokens.font
    ).toHaveLength(200);
  });

  it('stays fast on a long hostile value', () => {
    const start = performance.now();
    parseLook({
      tokens: { font: `${'a, '.repeat(60)}<`, ease: '-'.repeat(200) },
    });
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe('parseLook: mistakes', () => {
  it.each([[null], [undefined], [[]], ['edge'], [1], [true]])(
    'refuses %j as settings',
    (input) => {
      expect(errorsOf(input)).toEqual(['The settings must be a JSON object.']);
    }
  );

  it('names an unknown setting instead of ignoring it', () => {
    expect(errorsOf({ lok: 'edge' })).toEqual(['Unknown setting "lok".']);
    expect(errorsOf({ tokens: { pad: '1px' } })).toEqual([
      'tokens: unknown name "pad".',
    ]);
    expect(errorsOf({ colors: { light: { blue: '#000000' } } })).toEqual([
      'colors.light: unknown name "blue".',
    ]);
    expect(errorsOf({ colors: { dim: {} } })).toEqual([
      'colors: unknown scheme "dim".',
    ]);
  });

  it('refuses another format or version', () => {
    expect(errorsOf({ format: 'other' })[0]).toContain('format');
    expect(errorsOf({ version: 2 })[0]).toContain('version 1');
  });

  it.each([
    ['look', 'neon'],
    ['darkMode', 'auto'],
    ['inline', 'some'],
    ['timing', 'never'],
    ['look', 1],
  ])('refuses %s: %j', (key, value) => {
    expect(errorsOf({ [key]: value })[0]).toContain(`${key}: `);
  });

  it('refuses the wrong shapes', () => {
    expect(errorsOf({ split: 'yes' })).toEqual([
      'split: expected true or false.',
    ]);
    expect(errorsOf({ tokens: [] })).toEqual(['tokens: expected an object.']);
    expect(errorsOf({ colors: 1 })).toEqual(['colors: expected an object.']);
    expect(errorsOf({ colors: { dark: 'x' } })).toEqual([
      'colors.dark: expected an object.',
    ]);
    expect(errorsOf({ tokens: { 'pad-x': 16 } })).toEqual([
      'tokens.pad-x: number is not a short string.',
    ]);
  });

  it('reports every mistake at once', () => {
    expect(errorsOf({ lok: 1, look: 'neon', version: 2 })).toHaveLength(3);
  });

  it('is not fooled by __proto__ and friends', () => {
    const input: unknown = JSON.parse(
      '{"__proto__":{"look":"icon"},"tokens":{"__proto__":"1px","constructor":"1px"}}'
    );
    expect(errorsOf(input)).toHaveLength(3);
    expect(({} as Record<string, unknown>).look).toBeUndefined();
  });

  it('never throws, whatever it is given', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    for (const value of [circular, () => 1, Symbol('x'), 1n, new Map()])
      expect(parseLook({ look: value, tokens: value }).ok).toBe(false);
    expect(parseLook(circular).ok).toBe(false);
  });
});
