/**
 * `defineForm` groups fields into the schema both sides import (plan §4.1):
 * the server calls `parse`, the browser binding checks one field at a time
 * against the values of the whole form.
 */
import type { Field, FieldResult, FormValues } from './types.js';

export type FormFields = Readonly<Record<string, Field>>;

/** The value type of a field: `string` for `text`, `boolean` for `checkbox`. */
export type ValueOf<F> = F extends Field<infer V> ? V : never;

/** The parsed values of a form: every field, inactive and empty ones with their empty value. */
export type ValuesOf<F extends FormFields> = {
  readonly [K in keyof F]: ValueOf<F[K]>;
};

export interface FieldError {
  readonly field: string;
  readonly stage: string;
  readonly message: string;
}

export type ParseResult<T> =
  | { readonly ok: true; readonly values: T }
  | {
      readonly ok: false;
      /** Every failing field, in schema order. */
      readonly errors: readonly FieldError[];
      readonly first: FieldError;
    };

export interface Form<F extends FormFields> {
  readonly fields: F;
  readonly names: readonly (keyof F & string)[];
  /** Raw values by field name → what the fields' functions see. */
  view(raw: unknown): FormValues;
  /** One field against the raw values of the whole form; `undefined` when inactive or unknown. */
  check(name: keyof F & string, raw: unknown): FieldResult<unknown> | undefined;
  /** The server's check of a whole body (JSON or `Object.fromEntries(formData)`). */
  parse(body: unknown): ParseResult<ValuesOf<F>>;
}

/** Own properties of a plain object; anything else reads as no values at all. */
function record(body: unknown): Readonly<Record<string, unknown>> {
  return typeof body === 'object' && body !== null && !Array.isArray(body) ?
      (body as Record<string, unknown>)
    : {};
}

export function defineForm<F extends FormFields>(fields: F): Form<F> {
  const names = Object.keys(fields) as (keyof F & string)[];
  const own = (raw: Readonly<Record<string, unknown>>, name: string) =>
    Object.hasOwn(raw, name) ? raw[name] : undefined;

  const view = (body: unknown): FormValues => {
    const raw = record(body);
    return Object.fromEntries(
      names.map((name) => [name, fields[name]?.view(own(raw, name))])
    );
  };

  return {
    fields,
    names,
    view,
    check: (name, body) => {
      const raw = record(body);
      const values = view(raw);
      // a name may come from a client: `constructor` isn't a field
      const field = own(fields, name) as Field | undefined;
      return field?.isActive(values) ?
          field.check(own(raw, name), values)
        : undefined;
    },
    parse: (body) => {
      const raw = record(body);
      const values = view(raw);
      const parsed: Record<string, unknown> = {};
      const errors: FieldError[] = [];
      for (const name of names) {
        const field = fields[name];
        if (field === undefined) continue;
        parsed[name] = field.empty;
        if (!field.isActive(values)) continue;
        const result = field.check(own(raw, name), values);
        if (result.state === 'valid') parsed[name] = result.value;
        else if (result.state === 'invalid')
          errors.push({
            field: name,
            stage: result.stage,
            message: result.message,
          });
      }
      const first = errors[0];
      return first === undefined ?
          { ok: true, values: parsed as ValuesOf<F> }
        : { ok: false, errors, first };
    },
  };
}
