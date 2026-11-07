/**
 * Gates: a field's own checks after every stage has passed (plan §4.7). What no
 * library can know ("this e-mail is taken") or what needs a network (VIES).
 * They run one after another and the first refusal is the field's message.
 */
import type {
  FieldError,
  Form,
  FormFields,
  ParseResult,
  ValuesOf,
} from './define-form.js';
import type { Field, Gate, GateContext, GateRefusal } from './types.js';

/** Gates that a schema names, implemented per side. */
export type GateSet = Readonly<Partial<Record<string, Gate>>>;

/** A field's gates as functions; a name `provided` doesn't hold is left out. */
export function gatesOf(field: Field, provided: GateSet = {}): Gate[] {
  const gates: Gate[] = [];
  for (const gate of field.options.gates ?? []) {
    const found =
      typeof gate !== 'string' ? gate
      : Object.hasOwn(provided, gate) ? provided[gate]
      : undefined;
    if (found !== undefined) gates.push(found);
  }
  return gates;
}

/** The first refusal, or `undefined` when every gate let the value pass. */
export async function runGates(
  gates: readonly Gate[],
  value: string,
  context: GateContext
): Promise<GateRefusal | undefined> {
  for (const gate of gates) {
    const answer = await gate(value, context);
    if (typeof answer === 'string') {
      if (answer !== '') return { message: answer };
    } else if (answer?.message) return answer;
  }
  return undefined;
}

export interface ParseAsyncOptions {
  /** The gates the schema names, by name. */
  readonly gates?: GateSet;
}

/** A gate that threw: the value wasn't checked, so the server doesn't let it pass. */
const GATE_FAILED = 'This could not be checked. Please try again.';

/**
 * `form.parse` plus the gates, for the server. A function and not a method of the
 * form, so that page bundles, which never call it, don't carry it. The gates run
 * only when everything else has passed, so a body that fails on its own costs no
 * network and no database. A gate that throws refuses its field. Rejects when a
 * gate the schema names isn't provided.
 */
export async function parseAsync<F extends FormFields>(
  form: Form<F>,
  body: unknown,
  options: ParseAsyncOptions = {}
): Promise<ParseResult<ValuesOf<F>>> {
  const provided = options.gates ?? {};
  const fields: Readonly<Record<string, Field>> = form.fields;
  for (const name of form.names)
    for (const gate of fields[name]?.options.gates ?? [])
      if (typeof gate === 'string' && !Object.hasOwn(provided, gate))
        throw new Error(`No gate "${gate}" for the field "${name}".`);
  const result = form.parse(body, { skipGates: true });
  if (!result.ok) return result;
  const values = form.view(body);
  const parsed: Readonly<Record<string, unknown>> = result.values;
  const errors = await Promise.all(
    form.names.map(async (name): Promise<FieldError | undefined> => {
      const field = fields[name] as Field;
      const value = parsed[name];
      if (
        !field.options.gates?.length ||
        !field.isActive(values) ||
        value === field.empty
      )
        return undefined;
      let message: string | undefined;
      try {
        message = (
          await runGates(gatesOf(field, provided), String(value), {
            values,
            args: field.args(values),
          })
        )?.message;
      } catch {
        message = GATE_FAILED;
      }
      return message === undefined ? undefined : (
          { field: name, stage: 'gate', message }
        );
    })
  );
  const refused = errors.filter((error) => error !== undefined);
  const first = refused[0];
  return first === undefined ? result : { ok: false, errors: refused, first };
}
