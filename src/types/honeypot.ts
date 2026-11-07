/**
 * `honeypot`: a field people don't see, so only a bot fills it (plan §5). It
 * never refuses: the parsed value is `true` when it was filled, and the server
 * decides what to do, usually to answer as if all went well and store nothing.
 * A refusal would tell the bot what to change, and would block a person whose
 * browser filled the field by itself, with an error in a field they can't see.
 * It isn't required, unless a field says so.
 */
import { defineType } from '../core/define-type.js';
import type { FieldType } from '../core/types.js';

const type = /* @__PURE__ */ defineType<object, boolean>({
  name: 'honeypot',
  defaults: {},
  read: (raw) => {
    if (raw === true) return '1';
    if (raw === false || raw === undefined) return '';
    return typeof raw === 'string' ? raw : undefined;
  },
  value: (value) => value !== '',
  stages: [],
  examples: () => ({ valid: ['filled by a bot', ' ', true], invalid: [] }),
});

export const honeypot: FieldType<object, boolean> =
  /* @__PURE__ */ Object.assign(
    (options: Parameters<typeof type>[0] = {}) =>
      type({ required: false, ...options }),
    { spec: type.spec }
  );
