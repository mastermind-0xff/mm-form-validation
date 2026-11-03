/**
 * `checkbox`: a boolean. Required means it must be ticked (consent, terms).
 * Reads `true`, 1, '1', 'on', 'true' as ticked, and `false`, 0, '0', 'off',
 * 'false', '' or a missing value as not ticked.
 */
import { defineType } from '../core/define-type.js';

const TICKED: readonly unknown[] = [true, 1, '1', 'on', 'true'];
const UNTICKED: readonly unknown[] = [
  undefined,
  false,
  0,
  '',
  '0',
  'off',
  'false',
];

export const checkbox = /* @__PURE__ */ defineType<object, boolean>({
  name: 'checkbox',
  defaults: {},
  read: (raw) =>
    TICKED.includes(raw) ? '1'
    : UNTICKED.includes(raw) ? ''
    : undefined,
  value: (value) => value === '1',
  stages: [],
  messages: { required: 'Please tick this box.' },
  examples: () => ({
    valid: [true, '1', 'on'],
    invalid: [{ value: 'yes', stage: 'type' }],
  }),
});
