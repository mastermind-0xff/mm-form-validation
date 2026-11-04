import { describe, expect, it } from 'vitest';
import { INLINE_NOTES, agentBrief, headSnippet } from './brief.js';
import { generateCss } from './generate.js';
import {
  DARK_MODES,
  INLINE_LEVELS,
  LOOK_NAMES,
  defaultLook,
  parseLook,
} from './settings.js';
import type { LookSettings } from './settings.js';

const look = (changes: Partial<LookSettings> = {}): LookSettings => ({
  ...defaultLook(),
  ...changes,
});

describe('headSnippet', () => {
  it('puts the block first, then a stylesheet that does not block', () => {
    const settings = look();
    const lines = headSnippet(settings).trimEnd().split('\n');
    expect(lines[0]).toBe(`<style>${generateCss(settings).inline}</style>`);
    expect(lines[1]).toBe(
      `<link rel="preload" href="/css/form-fields.css" as="style" onload="this.onload=null;this.rel='stylesheet'" />`
    );
    expect(lines[2]).toBe(
      '<noscript><link rel="stylesheet" href="/css/form-fields.css" /></noscript>'
    );
    expect(lines).toHaveLength(3);
  });

  it('links the stylesheet the normal way with nothing inline', () => {
    expect(headSnippet(look({ inline: 'none' }))).toBe(
      '<link rel="stylesheet" href="/css/form-fields.css" />\n'
    );
  });

  it('needs no link when everything is inline', () => {
    const settings = look({ inline: 'all', split: true });
    expect(headSnippet(settings)).toBe(
      `<style>${generateCss(settings).inline}</style>\n`
    );
  });

  it('takes the address of the stylesheet', () => {
    expect(headSnippet(look({ inline: 'none' }), '/a/b.css')).toContain(
      'href="/a/b.css"'
    );
  });
});

describe('agentBrief', () => {
  it('holds settings that parse back to the same look', () => {
    const settings = look({ look: 'icon', timing: 'pause', inline: 'layout' });
    const json = /```json\r?\n([\s\S]*?)\r?\n```/.exec(agentBrief(settings));
    const result = parseLook(JSON.parse(json?.[1] ?? 'null'));
    expect(result).toEqual({ ok: true, look: settings });
  });

  it.each(LOOK_NAMES.map((name) => [name]))(
    'holds the CSS of %s to the letter',
    (name) => {
      const settings = look({ look: name });
      const brief = agentBrief(settings);
      expect(brief).toContain(generateCss(settings).stylesheet);
      expect(brief).toContain(headSnippet(settings));
      expect(brief).toContain(`the "${name}" look`);
    }
  );

  it('gives the markup the rules need', () => {
    const brief = agentBrief(look());
    for (const part of [
      'class="fv-field"',
      'data-field=',
      'class="fv-box"',
      'class="fv-message"',
      'data-message-for=',
      'class="fv-options fv-box"',
      'class="fv-option fv-box"',
    ])
      expect(brief).toContain(part);
  });

  it('warns about the shifts CSS cannot prevent', () => {
    const brief = agentBrief(look());
    expect(brief).toContain('`hidden` on the wrapper');
    expect(brief).toContain('The message line, even when empty');
    expect(brief).toContain('layout-shift');
  });

  it('passes on the timing and the lines reserved', () => {
    const base = defaultLook();
    const brief = agentBrief({
      ...base,
      timing: 'input',
      tokens: { ...base.tokens, 'message-lines': '3' },
    });
    expect(brief).toContain("timing: 'input'");
    expect(brief).toContain('reserves 3 line(s)');
  });

  it.each(INLINE_LEVELS.filter((level) => level !== 'none').map((l) => [l]))(
    'explains the level %s',
    (level) => {
      expect(agentBrief(look({ inline: level }))).toContain(
        INLINE_NOTES[level]
      );
    }
  );

  it('asks for a blocking link when nothing is inlined', () => {
    const brief = agentBrief(look({ inline: 'none' }));
    expect(brief).toContain('No inline block was asked for');
    expect(brief).not.toContain('rel="preload"');
  });

  it('says a split stylesheet needs the block', () => {
    expect(agentBrief(look({ split: true }))).toContain(
      'every page that uses the stylesheet needs the block too'
    );
    expect(agentBrief(look())).not.toContain('needs the block too');
  });

  it('has no stylesheet to save when everything is inline', () => {
    const brief = agentBrief(look({ inline: 'all', split: true }));
    expect(brief).toContain('None: the head block holds everything.');
    expect(brief).not.toContain('Save as `form-fields.css`');
  });

  it.each(DARK_MODES.map((mode) => [mode]))(
    'explains the dark mode %s',
    (mode) => {
      const expected = {
        none: 'No dark colors',
        media: 'prefers-color-scheme',
        attribute: 'data-scheme="dark"',
      }[mode];
      expect(agentBrief(look({ darkMode: mode }))).toContain(expected);
    }
  );

  it('refuses settings that would not parse', () => {
    const base = defaultLook();
    expect(() =>
      agentBrief({ ...base, tokens: { ...base.tokens, font: '<' } })
    ).toThrow(TypeError);
  });
});
