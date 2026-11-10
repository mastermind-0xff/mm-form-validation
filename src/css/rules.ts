/**
 * The field CSS as data, so the generator can pick what a project needs: one
 * look, the tokens in use, and the part that goes into the HTML. Nothing here
 * has values of its own that a project would change: those are the tokens.
 *
 * The binding sets attributes only; these rules style them:
 *   [data-field]                     the field's wrapper
 *   [data-state="valid" | "invalid"] on the wrapper (none: neutral)
 *   [data-message="hint" | "error"]  on the wrapper (none: no message)
 *   :required                        on the controls, from the schema
 *   .fv-box                          the element that shows the state (an
 *                                    input, a select, a textarea, a group)
 *   .fv-message                      the message line under the box
 *   .fv-submit                       the submit button
 *   .fv-trap                         a honeypot's wrapper (hidden)
 */
import type { LookName } from './settings.js';

export interface Rule {
  readonly selector: string;
  readonly declarations: Readonly<Record<string, string>>;
  readonly comment?: string;
}

export interface AtRule {
  readonly at: string;
  readonly rules: readonly Rule[];
}

/** The same for every look. */
export const BASE_RULES: readonly Rule[] = [
  {
    comment: 'The state color every look uses.',
    selector: '[data-field]',
    declarations: { '--fv-state': 'var(--fv-line)' },
  },
  {
    selector: "[data-field][data-state='valid']",
    declarations: { '--fv-state': 'var(--fv-valid)' },
  },
  {
    selector: "[data-field][data-state='invalid']",
    declarations: { '--fv-state': 'var(--fv-invalid)' },
  },
  {
    selector: '.fv-field',
    declarations: {
      display: 'grid',
      gap: 'var(--fv-gap)',
      'min-width': '0',
      margin: '0',
      padding: '0',
      border: '0',
      'font-family': 'var(--fv-font)',
      color: 'var(--fv-text)',
    },
  },
  {
    comment:
      'Inactive fields: the binding sets `hidden`, which any `display` on the wrapper would override.',
    selector: '[data-field][hidden], .fv-field[hidden]',
    declarations: { display: 'none !important' },
  },
  {
    comment:
      "A honeypot's wrapper: out of sight, 1px and clipped where it stands, not display: none, which some bots skip, nor left: -9999px, which scrolls a right-to-left page sideways. The markup keeps it from the keyboard, autofill and assistive tech.",
    selector: '.fv-trap',
    declarations: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      'clip-path': 'inset(50%)',
      'white-space': 'nowrap',
    },
  },
  {
    selector: '.fv-field > label:not(.fv-option), .fv-field > legend',
    declarations: {
      padding: '0',
      'font-size': 'var(--fv-label-size)',
      'font-weight': '600',
    },
  },
  {
    comment:
      'The asterisk follows the schema: the binding sets `required` on the controls.',
    selector: '.fv-field:has(:required) > :is(label, legend)::after',
    declarations: { content: "' *'", color: 'var(--fv-required)' },
  },
  {
    comment: 'The same spacing for every box: inputs, drop-downs, text areas.',
    selector: '.fv-box',
    declarations: {
      'box-sizing': 'border-box',
      width: '100%',
      margin: '0',
      padding: 'var(--fv-pad-y) var(--fv-pad-x)',
      border: 'var(--fv-border) solid var(--fv-line)',
      'border-radius': 'var(--fv-radius)',
      'background-color': 'var(--fv-bg)',
      color: 'inherit',
      font: 'inherit',
      'line-height': '1.4',
      // nothing that moves the layout: a state change shouldn't lay out every frame
      transition:
        'border-color var(--fv-speed) var(--fv-ease), box-shadow var(--fv-speed) var(--fv-ease), background-color var(--fv-speed) var(--fv-ease)',
    },
  },
  {
    selector: '.fv-box:focus-visible',
    declarations: {
      outline:
        '2px solid color-mix(in srgb, var(--fv-line-strong) 45%, transparent)',
      'outline-offset': '2px',
    },
  },
  {
    selector: 'select.fv-box',
    declarations: {
      appearance: 'none',
      'padding-right': 'calc(var(--fv-pad-x) * 2 + 12px)',
      'background-image': 'var(--fv-arrow)',
      'background-repeat': 'no-repeat',
      'background-position': 'right var(--fv-pad-x) center',
      'background-size': '12px 8px',
    },
  },
  {
    selector: 'textarea.fv-box',
    declarations: { 'min-height': '7.5em', resize: 'vertical' },
  },
  {
    comment:
      'Radio groups and single checkboxes: the options sit in a box too.',
    selector: '.fv-options',
    declarations: { display: 'flex', 'flex-wrap': 'wrap', gap: '8px 20px' },
  },
  {
    selector: '.fv-option',
    declarations: {
      display: 'inline-flex',
      gap: '8px',
      'align-items': 'center',
      'font-size': '0.9375rem',
      cursor: 'pointer',
    },
  },
  {
    selector: '.fv-option input',
    declarations: {
      width: '1.05em',
      height: '1.05em',
      margin: '0',
      'accent-color': 'var(--fv-line-strong)',
    },
  },
  {
    comment:
      'The message line, its height reserved: a message of that many lines moves nothing; a longer one grows the line and pushes what follows down.',
    selector: '.fv-message',
    declarations: {
      'overflow-wrap': 'anywhere',
      'min-height':
        'calc(var(--fv-message-size) * var(--fv-message-line) * var(--fv-message-lines))',
      margin: '0',
      color: 'var(--fv-hint)',
      'font-size': 'var(--fv-message-size)',
      'line-height': 'var(--fv-message-line)',
    },
  },
  {
    selector: "[data-message='hint'] > .fv-message",
    declarations: { animation: 'fv-hint var(--fv-speed) var(--fv-ease)' },
  },
  {
    selector: "[data-message='error'] > .fv-message",
    declarations: {
      color: 'var(--fv-invalid-text)',
      animation: 'fv-error var(--fv-speed) var(--fv-ease)',
    },
  },
  {
    comment: 'The submit button: put class="fv-submit" on it.',
    selector: '.fv-submit',
    declarations: {
      padding: 'var(--fv-button-pad-y) var(--fv-button-pad-x)',
      border: '1px solid var(--fv-button)',
      'border-radius': 'var(--fv-button-radius)',
      'background-color': 'var(--fv-button)',
      color: 'var(--fv-button-text)',
      font: 'inherit',
      'font-size': 'var(--fv-button-size)',
      cursor: 'pointer',
      transition:
        'background-color var(--fv-speed) var(--fv-ease), border-color var(--fv-speed) var(--fv-ease)',
    },
  },
  {
    selector: '.fv-submit:hover, .fv-submit:active',
    declarations: {
      'border-color': 'var(--fv-button-hover)',
      'background-color': 'var(--fv-button-hover)',
    },
  },
  {
    selector: '.fv-submit:focus-visible',
    declarations: {
      outline:
        '2px solid color-mix(in srgb, var(--fv-button) 45%, transparent)',
      'outline-offset': '2px',
    },
  },
];

/** How a box shows its state. A project gets the rules of one look. */
export const LOOK_RULES: Readonly<Record<LookName, readonly Rule[]>> = {
  edge: [
    {
      comment:
        'Edge: a 1px border all around; with a state, part of the left padding becomes a colored bar (the text does not move) and the border takes the color. The bar is an inset shadow, so it animates without a layout on every frame.',
      selector: '.fv-box',
      declarations: {
        'padding-left': 'max(var(--fv-pad-x), var(--fv-edge) + 2px)',
        'box-shadow': 'inset 0 0 0 var(--fv-state)',
      },
    },
    {
      selector: '[data-state] > .fv-box',
      declarations: {
        'border-color': 'var(--fv-state)',
        'box-shadow':
          'inset calc(var(--fv-edge) - var(--fv-border)) 0 0 var(--fv-state)',
      },
    },
  ],
  underline: [
    {
      comment:
        'Underline: no box, a bottom line that thickens and takes the state color.',
      selector: '.fv-box',
      declarations: {
        'border-width': '0 0 var(--fv-border)',
        'border-radius': '0',
        padding: 'var(--fv-pad-y) 2px',
        'background-color': 'transparent',
        'box-shadow': 'inset 0 0 0 transparent',
      },
    },
    {
      selector: 'select.fv-box',
      declarations: {
        'padding-right': '24px',
        'background-position': 'right 4px center',
      },
    },
    {
      selector: '.fv-box:focus-visible',
      declarations: {
        outline: 'none',
        'box-shadow': 'inset 0 -2px 0 var(--fv-line-strong)',
      },
    },
    {
      selector: '[data-state] > .fv-box',
      declarations: {
        'border-color': 'var(--fv-state)',
        'box-shadow': 'inset 0 -2px 0 var(--fv-state)',
      },
    },
  ],
  outline: [
    {
      comment:
        'Outline: the whole border takes the state color, with a soft ring.',
      selector: '[data-state] > .fv-box',
      declarations: {
        'border-color': 'var(--fv-state)',
        'box-shadow':
          '0 0 0 3px color-mix(in srgb, var(--fv-state) 22%, transparent)',
      },
    },
  ],
  icon: [
    {
      comment:
        'Icon: the box stays neutral; a check or a mark at its right end and the message carry the state.',
      selector: '.fv-field:has(> input.fv-box, > select.fv-box)::after',
      declarations: {
        content: "''",
        'grid-area': '2 / 1',
        'justify-self': 'end',
        'align-self': 'center',
        width: '16px',
        height: '16px',
        'margin-right': 'var(--fv-pad-x)',
        'background-color': 'var(--fv-state)',
        mask: 'var(--fv-icon, none) no-repeat center / contain',
        // --fv-shown, not a [data-state] rule: the :has() above outweighs one
        opacity: 'var(--fv-shown, 0)',
        scale: 'calc(0.6 + 0.4 * var(--fv-shown, 0))',
        transition:
          'opacity var(--fv-speed) var(--fv-ease), scale var(--fv-speed) var(--fv-ease)',
        'pointer-events': 'none',
      },
    },
    {
      comment:
        'Every part placed, so the icon shares the box cell instead of taking one.',
      selector: '.fv-field > label',
      declarations: { 'grid-area': '1 / 1' },
    },
    {
      selector: '.fv-field > .fv-box',
      declarations: { 'grid-area': '2 / 1' },
    },
    {
      selector: '.fv-field > .fv-message',
      declarations: { 'grid-area': '3 / 1' },
    },
    {
      selector: '.fv-field:has(> select.fv-box)::after',
      declarations: { 'margin-right': 'calc(var(--fv-pad-x) * 2 + 12px)' },
    },
    {
      selector: "[data-state='valid']",
      declarations: {
        '--fv-icon': 'var(--fv-icon-valid)',
        '--fv-shown': '1',
      },
    },
    {
      selector: "[data-state='invalid']",
      declarations: {
        '--fv-icon': 'var(--fv-icon-invalid)',
        '--fv-shown': '1',
      },
    },
    {
      comment: "Always, so a state change doesn't reflow the text.",
      selector: 'input.fv-box',
      declarations: { 'padding-right': 'calc(var(--fv-pad-x) * 2 + 16px)' },
    },
  ],
  filled: [
    {
      comment:
        'Filled: a tinted background, no border but a bottom line; the state tints the fill and colors the line.',
      selector: '.fv-box',
      declarations: {
        border: '0 solid var(--fv-line)',
        'border-bottom-width': '2px',
        'border-radius': 'var(--fv-radius) var(--fv-radius) 0 0',
        'background-color': 'var(--fv-fill)',
      },
    },
    {
      selector: '[data-state] > .fv-box',
      declarations: {
        'border-color': 'var(--fv-state)',
        'background-color':
          'color-mix(in srgb, var(--fv-state) 9%, var(--fv-fill))',
      },
    },
  ],
};

const fadeIn: Rule = {
  selector: 'from',
  declarations: { opacity: '0', translate: '0 -3px' },
};

/** Two names, so switching from a hint to an error plays it again. */
export const AT_RULES: readonly AtRule[] = [
  { at: '@keyframes fv-hint', rules: [fadeIn] },
  { at: '@keyframes fv-error', rules: [fadeIn] },
  {
    at: '@media (prefers-reduced-motion: reduce)',
    rules: [{ selector: ':root', declarations: { '--fv-speed': '0ms' } }],
  },
];

/** The icons and the arrow are images, so their colors can't be tokens. */
export const ICON_VALID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 8.5l3.2 3.2L13 5' fill='none' stroke='%23000' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
export const ICON_INVALID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='7' fill='none' stroke='%23000' stroke-width='1.6'/%3E%3Cpath d='M8 4.4v4.6' stroke='%23000' stroke-width='1.8' stroke-linecap='round'/%3E%3Ccircle cx='8' cy='11.7' r='1.1'/%3E%3C/svg%3E")`;

export const arrowImage = (color: string): string =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%23${color.slice(1)}' stroke-width='1.6'/%3E%3C/svg%3E")`;
