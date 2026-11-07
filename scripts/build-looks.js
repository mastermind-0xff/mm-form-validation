/**
 * Writes the stylesheet of every look with the default settings to `dist/looks`:
 * what a project links, with its changes from the designer on top (plan §12 F11).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { LOOK_NAMES, defaultLook, generateCss } from '../dist/esm/css/index.js';

const dir = new URL('../dist/looks/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const look of LOOK_NAMES) {
  const { stylesheet } = generateCss({
    ...defaultLook(),
    look,
    inline: 'none',
  });
  writeFileSync(new URL(`${look}.css`, dir), stylesheet);
}
