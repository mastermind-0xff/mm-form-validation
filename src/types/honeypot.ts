/**
 * `honeypot`: a field people don't see, so only a bot fills it (plan §5, user
 * D36 2026-11-08). Filled with anything (a string, spaces too, a number,
 * `true`) it is refused at `rule`, with a message that doesn't tell why;
 * something no form sends (an object, an array, `null`) fails at `type`. Its
 * value is always ''. It isn't required (the type's default, so a preset of it
 * isn't either), unless a field says so.
 *
 * The markup must keep browsers and password managers from filling it, or a
 * person is refused too: `fieldAttributes` gives the control's attributes, and
 * the README the wrapper, the name and the label to use (plan §5).
 */
import { defineType } from '../core/define-type.js';

export const honeypot = /* @__PURE__ */ defineType<object>({
  name: 'honeypot',
  defaults: {},
  required: false,
  read: (raw) => {
    if (raw === false || raw === undefined) return '';
    return (
      typeof raw === 'string' ? raw
      : typeof raw === 'number' || raw === true ? String(raw)
      : undefined
    );
  },
  stages: [
    {
      name: 'rule',
      check: () => ({ message: 'This form could not be sent.' }),
    },
  ],
  examples: () => ({
    valid: ['', false],
    invalid: [
      { value: 'filled by a bot', stage: 'rule' },
      { value: ' ', stage: 'rule' },
      { value: 1, stage: 'rule' },
      { value: 0, stage: 'rule' },
      { value: true, stage: 'rule' },
      { value: {}, stage: 'type' },
    ],
  }),
});
