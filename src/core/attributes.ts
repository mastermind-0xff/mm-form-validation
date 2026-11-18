/**
 * `fieldAttributes`: the attributes of a field's control, for markup
 * written on a server, so that markup and schema can't drift. A module of its
 * own: a page bundle that only checks forms never carries this table.
 *
 * No `maxlength`, `minlength` or `pattern`: browsers count UTF-16 units where
 * the checks count code points, a hard limit silently cuts a pasted value
 * instead of saying "At most 100 characters (now 104).", and the binding does
 * the checking. No `type="email"` either: it brings the browser's own e-mail
 * rules (Unicode local parts refused, the domain turned into punycode in
 * `.value`), a check only one side runs. `inputmode="email"` keeps the keyboard.
 */
import type { Form, FormFields } from './define-form.js';
import type { Field, FormValues } from './types.js';

export interface FieldAttributes {
  /** The field is active and required, for these values. */
  readonly required?: true;
  readonly type?: 'password';
  readonly inputmode?: 'email' | 'numeric';
  readonly autocapitalize?: 'none' | 'words' | 'characters';
  readonly spellcheck?: 'false';
  /**
   * A honeypot: `new-password`, not `off`. Firefox's password manager takes a
   * text field with `off` (or none) as a username, invisible or not; one with
   * `new-password` it never does. Chrome ignores `new-password` on a field that
   * isn't a password.
   */
  readonly autocomplete?: 'new-password';
  readonly tabindex?: '-1';
  /** A honeypot: out of reach of the keyboard, autofill and assistive tech. */
  readonly inert?: true;
  readonly 'aria-hidden'?: 'true';
  /** Password managers' opt-outs: 1Password, LastPass, Bitwarden, Dashlane. */
  readonly 'data-1p-ignore'?: true;
  readonly 'data-lpignore'?: 'true';
  readonly 'data-bwignore'?: true;
  readonly 'data-form-type'?: 'other';
}

type Args = Readonly<Record<string, unknown>>;
type ByType = (args: Args) => FieldAttributes;

const words: ByType = () => ({ autocapitalize: 'words', spellcheck: 'false' });
const machine = (upper: boolean): FieldAttributes => ({
  // a case-sensitive code must not get a capital first letter either
  autocapitalize: upper ? 'characters' : 'none',
  spellcheck: 'false',
});

/** By type name, as functions of the field's resolved arguments. */
const BY_TYPE: Readonly<Record<string, ByType>> = {
  email: () => ({
    inputmode: 'email',
    autocapitalize: 'none',
    spellcheck: 'false',
  }),
  password: () => ({
    type: 'password',
    autocapitalize: 'none',
    spellcheck: 'false',
  }),
  personName: words,
  place: words,
  streetAddress: words,
  code: ({ upper }) => machine(upper === true),
  vatNumber: () => machine(true),
  // iOS's numeric keyboard has no minus key
  integer: ({ min }) =>
    typeof min === 'number' && min >= 0 ? { inputmode: 'numeric' } : {},
  honeypot: () => ({
    autocomplete: 'new-password',
    tabindex: '-1',
    inert: true,
    'aria-hidden': 'true',
    'data-1p-ignore': true,
    'data-lpignore': 'true',
    'data-bwignore': true,
    'data-form-type': 'other',
  }),
};

/** The type's own attributes; a preset gets its base type's. */
function byType(
  form: Form<FormFields>,
  field: Field,
  view: FormValues,
  seen: ReadonlySet<Field>
): FieldAttributes {
  const args = field.args(view) as Args;
  for (const name of [field.type, ...(field.bases ?? [])]) {
    if (name === 'confirm') {
      // like the field it repeats: a retyped password, a retyped e-mail
      const of = typeof args['of'] === 'string' ? args['of'] : '';
      const other =
        Object.hasOwn(form.fields, of) ? form.fields[of] : undefined;
      return other === undefined || seen.has(other) ?
          {}
        : byType(form, other, view, new Set([...seen, other]));
    }
    const make = Object.hasOwn(BY_TYPE, name) ? BY_TYPE[name] : undefined;
    if (make !== undefined) return make(args);
  }
  return {};
}

/**
 * What to write on the control of the field `name` of `form`, given the raw
 * values the page starts with (default: none, so a `required` that depends on
 * another field is false). `when`, `required` and the arguments see those
 * values as the checks do (`form.view`). The binding keeps `required` up to
 * date once it runs.
 */
export function fieldAttributes<F extends FormFields>(
  form: Form<F>,
  name: keyof F & string,
  values: unknown = {}
): FieldAttributes {
  const field: Field | undefined =
    Object.hasOwn(form.fields, name) ? form.fields[name] : undefined;
  if (field === undefined) throw new Error(`The form has no field ${name}.`);
  const view = form.view(values);
  const required = field.isActive(view) && field.isRequired(view);
  return {
    ...byType(
      form as unknown as Form<FormFields>,
      field,
      view,
      new Set([field])
    ),
    ...(required ? { required: true } : {}),
  };
}
