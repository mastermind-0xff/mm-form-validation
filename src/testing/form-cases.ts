/**
 * The test cases of a whole form (plan §8.2). Like `typeContract`, it returns
 * `{ name, run }` cases that throw on failure, for any test runner. A form is
 * ready for commit when its cases pass.
 */
import type { Form, FormFields, ParseResult } from '../core/define-form.js';
import type { Field, FormValues } from '../core/types.js';
import { assert, show, WRONG_TYPES, type TestCase } from './type-contract.js';

export interface FormSamples {
  /**
   * A body the form accepts, with a value for every active field: `''` for an
   * optional one left empty. A field `when` switches off for this body needs none.
   */
  readonly valid: Readonly<Record<string, unknown>>;
  /** More values each field must refuse, by field. */
  readonly invalid?: Readonly<Record<string, readonly unknown[]>>;
}

/** What can't be a value of any field, not even an inactive one's. */
const JUNK = '\u0007<junk>';

/**
 * Cases for one form and a valid body: the body parses, and parsing its values
 * again gives the same values; each field's type examples, with that field's
 * arguments, pass or fail as they say; a required field emptied fails at
 * `required` and an optional one passes; inactive fields are ignored; wrong raw
 * types fail cleanly; unknown keys don't reach the values; the listed invalid
 * values fail on their field. Gates don't run here: they belong to the
 * application's own tests.
 */
export function formCases<F extends FormFields>(
  form: Form<F>,
  samples: FormSamples
): TestCase[] {
  const cases: TestCase[] = [];
  const add = (name: string, run: () => void) => {
    cases.push({ name, run });
  };
  const valid = samples.valid;
  const parse = (body: unknown): ParseResult<unknown> =>
    form.parse(body, { skipGates: true });
  const errorOf = (body: unknown, name: string) => {
    const result = parse(body);
    return result.ok ? undefined : (
        result.errors.find((error) => error.field === name)
      );
  };
  const view: FormValues = form.view(valid);

  add('the valid sample parses', () => {
    const result = parse(valid);
    assert(
      result.ok,
      `refused: ${result.ok ? '' : JSON.stringify(result.errors)}`
    );
  });

  add('parsing the values again gives the same values', () => {
    const first = parse(valid);
    if (!first.ok) throw new Error('the valid sample does not parse');
    const again = parse(first.values);
    assert(
      again.ok && JSON.stringify(again.values) === JSON.stringify(first.values),
      `changed: ${JSON.stringify(first.values)} → ${JSON.stringify(again)}`
    );
  });

  add('unknown keys do not reach the values', () => {
    const result = parse({ ...valid, unknownKey: 'x' });
    assert(result.ok, 'refused');
    const values = result.values as Readonly<Record<string, unknown>>;
    assert(
      !Object.hasOwn(values, 'unknownKey'),
      'unknownKey reached the values'
    );
    assert(
      Object.keys(values).sort().join() === [...form.names].sort().join(),
      `the values have other fields: ${Object.keys(values).join()}`
    );
  });

  add('a body that is no object has no values, and does not throw', () => {
    for (const body of [null, 'x', 5, []]) parse(body);
  });

  for (const name of form.names) {
    const field = form.fields[name] as Field;
    const label = `${name} (${field.type})`;

    if (!field.isActive(view)) {
      add(`${label}: inactive in this sample, ignored`, () => {
        // junk in it may switch other fields (a `when` that reads it): only
        // this field is asked about
        const junk = parse({ ...valid, [name]: JUNK });
        const error =
          junk.ok ? undefined : junk.errors.find((e) => e.field === name);
        assert(error === undefined, `refused at ${error?.stage ?? ''}`);
        const result = junk.ok ? junk : parse(valid);
        if (!result.ok) return; // 'the valid sample parses' says why
        assert(
          Object.is(
            (result.values as Readonly<Record<string, unknown>>)[name],
            field.empty
          ),
          'the value is not the empty value'
        );
      });
      continue;
    }

    if (!Object.hasOwn(valid, name)) {
      add(`${label}: has a valid sample`, () => {
        throw new Error(`add a valid value for ${name}`);
      });
      continue;
    }

    const examples = field.examples(view);
    const base = { ...valid, ...examples.values };
    for (const value of examples.valid)
      add(`${label}: example ${show(value)} passes`, () => {
        const body = { ...base, [name]: value };
        const error = errorOf(body, name);
        // the field's own rule may narrow what the type accepts, but only
        // its own refusal counts, not the type's stage of the same name
        const rule = field.options.rule;
        assert(
          error === undefined ||
            (error.stage === 'rule' &&
              rule?.(String(field.view(value)), form.view(body)) !== undefined),
          `refused at ${error?.stage ?? ''}: ${error?.message ?? ''}`
        );
      });
    for (const { value, stage } of examples.invalid)
      add(`${label}: example ${show(value)} fails at ${stage}`, () => {
        const error = errorOf({ ...base, [name]: value }, name);
        assert(error !== undefined, 'passed');
        assert(
          error.stage === stage,
          `failed at ${error.stage}: ${error.message}`
        );
      });

    add(
      `${label}: emptied, ${field.isRequired(view) ? 'fails at required' : 'passes'}`,
      () => {
        const without = Object.fromEntries(
          Object.entries(valid).filter(([key]) => key !== name)
        );
        for (const body of [without, { ...valid, [name]: '' }]) {
          const emptied = form.view(body);
          const error = errorOf(body, name);
          if (!field.isActive(emptied)) continue;
          if (field.isRequired(emptied))
            assert(
              error?.stage === 'required',
              `expected required, got ${error?.stage ?? 'no error'}`
            );
          else
            assert(
              error === undefined,
              `expected no error, got ${error?.stage ?? ''}`
            );
        }
      }
    );

    add(`${label}: wrong raw types fail cleanly`, () => {
      for (const raw of WRONG_TYPES) {
        const error = errorOf({ ...valid, [name]: raw }, name);
        assert(
          error?.stage === 'type',
          `${JSON.stringify(raw)}: expected type, got ${error?.stage ?? 'no error'}`
        );
      }
    });
  }

  for (const [name, values] of Object.entries(samples.invalid ?? {})) {
    if (!Object.hasOwn(form.fields, name)) {
      add(`${name}: listed as invalid`, () => {
        throw new Error(`the form has no field ${name}`);
      });
      continue;
    }
    for (const value of values)
      add(`${name}: ${show(value)} is refused`, () => {
        assert(
          errorOf({ ...valid, [name]: value }, name) !== undefined,
          'passed'
        );
      });
  }

  return cases;
}
