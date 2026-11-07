/**
 * `fieldAttributes` (plan §7): the attributes of a field's control, for markup
 * written on a server, so that markup and schema can't drift. A module of its
 * own: a page bundle that only checks forms never carries this table.
 *
 * No `maxlength`, `minlength` or `pattern`: browsers count UTF-16 units where
 * the checks count code points, a hard limit silently cuts a pasted value
 * instead of saying "At most 100 characters (now 104).", and the binding does
 * the checking.
 */
import type { Field, FormValues } from './types.js';

export interface FieldAttributes {
  /** The field is active and required, for these values. */
  readonly required?: true;
  readonly type?: 'email' | 'password';
  readonly inputmode?: 'email' | 'numeric';
  readonly autocapitalize?: 'none' | 'words' | 'characters';
  readonly spellcheck?: 'false';
  readonly autocomplete?: 'off';
  readonly tabindex?: '-1';
}

const WORDS: FieldAttributes = { autocapitalize: 'words', spellcheck: 'false' };
const MACHINE: FieldAttributes = {
  autocapitalize: 'characters',
  spellcheck: 'false',
};

/** By type name. A type that isn't here gets `required` and nothing else. */
const BY_TYPE: Readonly<Record<string, FieldAttributes>> = {
  email: {
    type: 'email',
    inputmode: 'email',
    autocapitalize: 'none',
    spellcheck: 'false',
  },
  password: { type: 'password', autocapitalize: 'none', spellcheck: 'false' },
  confirm: { type: 'password', autocapitalize: 'none', spellcheck: 'false' },
  personName: WORDS,
  place: WORDS,
  streetAddress: WORDS,
  code: MACHINE,
  vatNumber: MACHINE,
  integer: { inputmode: 'numeric' },
  honeypot: { autocomplete: 'off', tabindex: '-1' },
};

/**
 * What to write on the control of `field`, given the values the page starts with
 * (default: none, so a `required` that depends on another field is false). The
 * binding keeps `required` up to date once it runs.
 */
export function fieldAttributes(
  field: Field,
  values: FormValues = {}
): FieldAttributes {
  const required = field.isActive(values) && field.isRequired(values);
  return {
    ...(Object.hasOwn(BY_TYPE, field.type) ? BY_TYPE[field.type] : {}),
    ...(required ? { required: true } : {}),
  };
}
