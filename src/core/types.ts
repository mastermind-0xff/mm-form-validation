/**
 * The shapes shared by types, fields and forms (plan §4). The pipeline works
 * on strings: a type reads the raw value into a string, normalizes it, runs
 * its stages on it and only then turns it into the field's value.
 */

/**
 * The values of a form by field name, as the functions of other fields see
 * them (`when`, `required`, dynamic arguments): read and normalized, not yet
 * checked, so possibly invalid. A field that can't be read (`null`, an array:
 * only a hostile client sends those) has its type's empty value, so functions
 * can rely on the type: `v.city.trim()` doesn't throw on `{ "city": null }`.
 * A name that isn't a field of the form is `undefined`.
 */
export type FormValues = Readonly<Record<string, unknown>>;

/** A value, or a function of the other values of the form. */
export type Dynamic<T> = T | ((values: FormValues) => T);

/** What a stage tells its message: limits, counts, the offending character. */
export type Details = Readonly<Record<string, string | number>>;

/** A message, or a function of the stage's details (per-field overrides). */
export type Message = string | ((details: Details) => string);

/** Messages by stage name (`required`, `length`…). */
export type Messages = Readonly<Partial<Record<string, Message>>>;

/** A failed stage: its default message, its details and whether typing on could fix it. */
export interface Problem {
  readonly message: string;
  readonly details?: Details;
  /**
   * Typing more could still make the value valid (too short, shape not
   * finished). The browser shows such a problem as a hint while the user
   * types, and as an error once the field is left. A problem that more
   * typing can't fix (a character that isn't allowed, too long) is an error
   * right away.
   */
  readonly incomplete?: boolean;
}

/** One check of a type, run on the normalized, non-empty string. */
export interface Stage<A> {
  readonly name: string;
  readonly check: (
    value: string,
    args: A,
    values: FormValues
  ) => Problem | undefined;
}

export interface Invalid {
  readonly state: 'invalid';
  readonly stage: string;
  readonly message: string;
  readonly incomplete: boolean;
}

/** The outcome of checking one field. */
export type FieldResult<V> =
  /** optional and empty: valid, nothing to show */
  | { readonly state: 'empty' }
  | { readonly state: 'valid'; readonly value: V }
  | Invalid;

/** Example values of a type, computed from its arguments (plan §8). */
export interface Examples {
  /** Raw values the type accepts. */
  readonly valid: readonly unknown[];
  /** Raw values the type refuses, with the stage each one fails at. */
  readonly invalid: readonly {
    readonly value: unknown;
    readonly stage: string;
  }[];
  /** Other values of the form the examples need (`confirm`: the password). */
  readonly values?: FormValues;
}

/** A field type: what `defineType` turns into a field factory. */
export interface TypeSpec<A extends object, V> {
  readonly name: string;
  /** Every argument of the type with its default. */
  readonly defaults: A;
  /** Raw value (form data, JSON) → string; `undefined` fails at `type`. */
  readonly read?: (raw: unknown) => string | undefined;
  /** Applied before every check; the server keeps the normalized value. */
  readonly normalize?: (value: string) => string;
  /** The checks after `required`, in order; the first failure gives the message. */
  readonly stages: readonly Stage<A>[];
  /** Normalized string → the field's value (default: the string). */
  readonly value?: (value: string) => V;
  /** A last touch on a valid string, with the arguments (the VAT prefix). */
  readonly finish?: (value: string, args: A) => string;
  /** The type's own default messages, by stage (`checkbox`: "Please tick this box."). */
  readonly messages?: Messages;
  /** What the field expects, shown while it is focused and empty. */
  readonly hint?: (args: A) => string | undefined;
  readonly examples: (args: A) => Examples;
}

/** Options every field accepts, next to its type's arguments. */
export interface CommonOptions {
  /** Default `true`. A function makes it depend on the other values. */
  readonly required?: Dynamic<boolean>;
  /**
   * When it returns false the field is inactive: not checked, its value is
   * the type's empty value, and the browser hides it.
   */
  readonly when?: (values: FormValues) => boolean;
  /** Messages by stage, replacing the type's. */
  readonly messages?: Messages;
  /** Replaces the type's hint. */
  readonly hint?: Dynamic<string>;
  /** An extra check after the type's stages (stage `rule`): a message when it fails. */
  readonly rule?: (value: string, values: FormValues) => string | undefined;
}

/** A type's arguments, each also allowed as a function of the other values. */
export type DynamicArgs<A> = { readonly [K in keyof A]?: Dynamic<A[K]> };

export type FieldOptions<A> = CommonOptions & DynamicArgs<A>;

/** A field of a form: a type with its arguments and options. */
export interface Field<V = unknown, A = unknown> {
  readonly type: string;
  readonly options: FieldOptions<A>;
  /** The value when the field is empty or inactive ('' or false). */
  readonly empty: V;
  /** Raw value → what the other fields' functions see (`empty` if unreadable). */
  view(raw: unknown): V;
  /** The arguments, with functions of the other values resolved. */
  args(values?: FormValues): A;
  isActive(values?: FormValues): boolean;
  isRequired(values?: FormValues): boolean;
  /** What the field expects, for the message line while it is empty. */
  hint(values?: FormValues): string | undefined;
  /** Checks one raw value; `values` are the other values of the form. */
  check(raw: unknown, values?: FormValues): FieldResult<V>;
  examples(values?: FormValues): Examples;
}

/** A field factory made by `defineType`: `text({ max: 100 })`. */
export interface FieldType<A extends object, V> {
  (options?: FieldOptions<A>): Field<V, A>;
  readonly spec: TypeSpec<A, V>;
}
