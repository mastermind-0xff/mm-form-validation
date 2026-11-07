/**
 * `@mmutils/form-validation/css`: the look of the fields as settings, and the
 * CSS made from them. Used by the designer page and at build time; a form's page
 * bundle never needs it.
 */
export { INLINE_NOTES, agentBrief, headSnippet } from './brief.js';
export { generateChanges, lookChanges, lookSheet } from './changes.js';
export type { LookChanges } from './changes.js';
export { generateCss } from './generate.js';
export type { GeneratedCss } from './generate.js';
export {
  COLORS,
  DARK_MODES,
  INLINE_LEVELS,
  LOOK_FORMAT,
  LOOK_NAMES,
  TIMINGS,
  TOKENS,
  defaultLook,
  parseLook,
} from './settings.js';
export type {
  ColorName,
  DarkMode,
  InlineLevel,
  LookName,
  LookResult,
  LookSettings,
  RangeToken,
  TextToken,
  Timing,
  TokenGroup,
  TokenName,
} from './settings.js';
