/**
 * `defineType` turns a type into a field factory: `text({ max:
 * 100 })`. The field runs the same pipeline in the browser and on the server:
 * read → far over `max`? (`length`) → normalize → empty? (`required`) → the
 * type's stages → the field's `rule` → finish → value.
 */
import type {
  Dynamic,
  Examples,
  Field,
  FieldOptions,
  FieldResult,
  FieldType,
  FormValues,
  Invalid,
  Messages,
  Problem,
  TypeSpec,
} from './types.js';

/** Strings as they are; a missing value is empty; anything else is the wrong type. */
export function readString(raw: unknown): string | undefined {
  if (raw === undefined) return '';
  return typeof raw === 'string' ? raw : undefined;
}

/** `readString`, plus finite numbers as their string (JSON clients send `1` for "1"). */
export function readScalar(raw: unknown): string | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) ?
      String(raw)
    : readString(raw);
}

export function resolve<T>(value: Dynamic<T>, values: FormValues): T {
  return typeof value === 'function' ?
      (value as (values: FormValues) => T)(values)
    : value;
}

const EMPTY = { state: 'empty' } as const;

/**
 * How many UTF-16 units a raw value may hold per character of `max` and still
 * be normalized; beyond that it fails at `length` first, so no hostile value
 * makes normalizing the expensive part of a check. Real text at `max` stays
 * under it: an emoji takes 2 units, a decomposed Hangul syllable 3.
 */
const UNITS_PER_CHARACTER = 4;

const DEFAULT_MESSAGES: Messages = {
  type: 'Invalid value.',
  required: 'This field is required.',
};

export function defineType<A extends object, V = string>(
  spec: TypeSpec<A, V>
): FieldType<A, V> {
  const read = spec.read ?? readString;
  const normalize = spec.normalize ?? ((value: string) => value);
  const toValue = spec.value ?? ((value: string) => value as V);
  const argNames = Object.keys(spec.defaults);
  const defaults = spec.defaults as Readonly<Record<string, unknown>>;
  const empty = toValue('');
  const lengthStage = spec.stages.find((stage) => stage.name === 'length');
  const tooLong = (value: string, max: unknown): boolean =>
    lengthStage !== undefined &&
    typeof max === 'number' &&
    value.length > max * UNITS_PER_CHARACTER;

  const factory = (options: FieldOptions<A> = {}): Field<V, A> => {
    const {
      required = spec.required ?? true,
      when,
      messages = {},
      hint,
      rule,
    } = options;
    const given = options as Readonly<Record<string, unknown>>;
    // `view` makes the values: a `max` that depends on them isn't known yet
    const viewMax =
      typeof given['max'] === 'number' ? given['max'] : defaults['max'];

    const fail = (stage: string, problem: Problem): Invalid => {
      const message =
        messages[stage] ?? spec.messages?.[stage] ?? DEFAULT_MESSAGES[stage];
      return {
        state: 'invalid',
        stage,
        message:
          message === undefined ? problem.message
          : typeof message === 'string' ? message
          : message(problem.details ?? {}),
        incomplete: problem.incomplete ?? false,
      };
    };

    const args = (values: FormValues = {}): A => {
      const resolved: Record<string, unknown> = { ...defaults };
      for (const name of argNames) {
        const value = given[name];
        if (value !== undefined) resolved[name] = resolve(value, values);
      }
      return resolved as A;
    };

    const isRequired = (values: FormValues = {}): boolean =>
      resolve(required, values);

    return {
      type: spec.name,
      bases: spec.bases ?? [],
      options,
      empty,
      view: (raw) => {
        const value = read(raw);
        // the field itself still fails at `type`, when it is active
        if (value === undefined) return empty;
        return toValue(tooLong(value, viewMax) ? value : normalize(value));
      },
      args,
      isActive: (values = {}) => when === undefined || when(values),
      isRequired,
      hint: (values = {}) =>
        hint === undefined ? spec.hint?.(args(values)) : resolve(hint, values),
      check: (raw, values = {}, fields): FieldResult<V> => {
        const read_ = read(raw);
        if (read_ === undefined)
          return fail('type', { message: 'Invalid value.' });
        const resolved = args(values);
        const over =
          tooLong(read_, (resolved as { readonly max?: unknown }).max) ?
            lengthStage?.check(read_, resolved, values)
          : undefined;
        if (over !== undefined) return fail('length', over);
        const value = normalize(read_);
        if (value === '')
          return isRequired(values) ?
              fail('required', {
                message: 'This field is required.',
                incomplete: true,
              })
            : EMPTY;
        for (const stage of spec.stages) {
          const problem = stage.check(value, resolved, values, fields);
          if (problem !== undefined) return fail(stage.name, problem);
        }
        const ruleMessage = rule?.(value, values);
        if (ruleMessage !== undefined)
          return fail('rule', { message: ruleMessage });
        return {
          state: 'valid',
          value: toValue(spec.finish ? spec.finish(value, resolved) : value),
        };
      },
      examples: (values = {}) => spec.examples(args(values)),
    };
  };

  return Object.assign(factory, { spec });
}

export interface PresetOptions<A extends object> {
  readonly name: string;
  /** Other defaults for the type's arguments. */
  readonly defaults?: Partial<A>;
  /** Examples added to the type's (they must fit the arguments: see `fits`). */
  readonly examples?: (args: A) => Examples;
  readonly messages?: Messages;
  readonly hint?: (args: A) => string | undefined;
}

/**
 * A type made from another with other defaults:
 * `preset(text, { name: 'place', defaults: { chars: 'place', contains: 'letter' } })`.
 */
export function preset<A extends object, V>(
  type: FieldType<A, V>,
  options: PresetOptions<A>
): FieldType<A, V> {
  const base = type.spec;
  const more = options.examples;
  const hint = options.hint ?? base.hint;
  return defineType<A, V>({
    ...base,
    name: options.name,
    bases: [base.name, ...(base.bases ?? [])],
    defaults: { ...base.defaults, ...options.defaults },
    messages: { ...base.messages, ...options.messages },
    ...(hint && { hint }),
    examples:
      more === undefined ?
        base.examples
      : (args) => {
          const a = base.examples(args);
          const b = more(args);
          return {
            valid: [...a.valid, ...b.valid],
            invalid: [...a.invalid, ...b.invalid],
            values: { ...a.values, ...b.values },
          };
        },
  });
}
