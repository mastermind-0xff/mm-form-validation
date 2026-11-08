/**
 * The contract every field type passes (plan §8.1). Runner-agnostic: it
 * returns `{ name, run }` cases that throw on failure, so vitest
 * (`it(c.name, c.run)`) and `node:test` (`test(c.name, c.run)`) both run them.
 */
import { codePoints } from '../chars.js';
import type {
  FieldOptions,
  FieldResult,
  FieldType,
  FormValues,
} from '../core/types.js';

export interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

export function assert(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

/** A value in a case name: quoted, cut after 24 characters. */
export function show(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value !== 'string') return JSON.stringify(value);
  const n = codePoints(value);
  const text =
    n > 24 ? `${Array.from(value).slice(0, 16).join('')}… (${n})` : value;
  return JSON.stringify(text);
}

function describe(options: object): string {
  const text = JSON.stringify(options, (_key, value: unknown) =>
    typeof value === 'function' ? 'ƒ'
    : value instanceof RegExp ? String(value)
    : value
  );
  return text === '{}' ? '' : ` ${text}`;
}

function outcome(result: FieldResult<unknown>): string {
  return result.state === 'invalid' ?
      `invalid at ${result.stage}: ${result.message}`
    : result.state;
}

/** Plain text for `textContent`: one line, no markup. */
function assertPlain(message: string): void {
  assert(message.trim() !== '', 'the message is empty');
  assert(!/[\n\r]/u.test(message), `the message has a line break: ${message}`);
  assert(
    !/<\/?[a-z][^>]*>|&[a-z]+;/iu.test(message),
    `the message looks like HTML: ${message}`
  );
}

/** Raw values no form sends: every field fails them at `type`. */
export const WRONG_TYPES: readonly unknown[] = [{}, [], null];

/**
 * Cases for one type and some argument sets: valid examples pass and stay the
 * same when checked again, invalid ones fail at their stage with a plain-text
 * message that per-field `messages` replace, empty is `required` or `empty`,
 * wrong raw types fail at `type`, the examples reach `max` and `max + 1`, and a
 * value far over `max` fails at `length`.
 */
export function typeContract<A extends object, V>(
  type: FieldType<A, V>,
  optionSets: readonly FieldOptions<A>[] = [{}]
): TestCase[] {
  const cases: TestCase[] = [];
  for (const options of optionSets) {
    const label = `${type.spec.name}${describe(options)}`;
    const add = (name: string, run: () => void) => {
      cases.push({ name: `${label}: ${name}`, run });
    };
    const field = type(options);
    const examples = field.examples();
    const values: FormValues = examples.values ?? {};

    add('has valid examples', () => {
      assert(examples.valid.length > 0, 'no valid examples');
    });

    for (const value of examples.valid)
      add(`valid ${show(value)}`, () => {
        const result = field.check(value, values);
        // a valid example that is meant to be empty (`honeypot`), when optional;
        // not one that normalizing empties, like '   '
        if (
          result.state === 'empty' &&
          !field.isRequired(values) &&
          (value === '' || value === false)
        )
          return;
        assert(
          result.state === 'valid',
          `expected valid, got ${outcome(result)}`
        );
        const again = field.check(result.value, values);
        assert(
          again.state === 'valid' && Object.is(again.value, result.value),
          `checking the value again changed it: ${show(result.value)} → ${again.state === 'valid' ? show(again.value) : outcome(again)}`
        );
      });

    for (const { value, stage } of examples.invalid)
      add(`invalid ${show(value)} at ${stage}`, () => {
        const result = field.check(value, values);
        assert(
          result.state === 'invalid' && result.stage === stage,
          `expected invalid at ${stage}, got ${outcome(result)}`
        );
        assertPlain(result.message);
        const custom = type({
          ...options,
          messages: { ...options.messages, [stage]: 'Custom message.' },
        }).check(value, values);
        assert(
          custom.state === 'invalid' && custom.message === 'Custom message.',
          `the field's message for ${stage} was not used: ${outcome(custom)}`
        );
      });

    add('empty is required when required', () => {
      const required = type({ ...options, required: true });
      for (const raw of ['', undefined]) {
        const result = required.check(raw, values);
        assert(
          result.state === 'invalid' && result.stage === 'required',
          `${show(raw)}: expected required, got ${outcome(result)}`
        );
        assertPlain(result.message);
      }
    });

    add('empty is valid when optional', () => {
      const result = type({ ...options, required: false }).check('', values);
      assert(
        result.state === 'empty',
        `expected empty, got ${outcome(result)}`
      );
    });

    add('wrong raw types fail at type', () => {
      for (const raw of WRONG_TYPES) {
        const result = field.check(raw, values);
        assert(
          result.state === 'invalid' && result.stage === 'type',
          `${show(raw)}: expected type, got ${outcome(result)}`
        );
      }
    });

    const max = (field.args(values) as { readonly max?: unknown }).max;
    // only as a length: an `integer`'s `max` is a value
    if (
      typeof max === 'number' &&
      type.spec.stages.some((stage) => stage.name === 'length')
    ) {
      add(`a value far over max ${max} fails at length`, () => {
        const result = field.check(' '.repeat(max * 4 + 1), values);
        assert(
          result.state === 'invalid' && result.stage === 'length',
          `expected invalid at length, got ${outcome(result)}`
        );
        assertPlain(result.message);
      });
      add(`examples reach max ${max} and ${max + 1}`, () => {
        const length = (value: unknown) =>
          typeof value === 'string' ? codePoints(value) : -1;
        assert(
          examples.valid.some((value) => length(value) === max),
          `no valid example of ${max} characters`
        );
        assert(
          examples.invalid.some(
            (example) =>
              example.stage === 'length' && length(example.value) === max + 1
          ),
          `no invalid example of ${max + 1} characters at length`
        );
      });
    }
  }
  return cases;
}
