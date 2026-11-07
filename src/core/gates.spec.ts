import { describe, expect, it, vi } from 'vitest';
import { checkbox } from '../types/checkbox.js';
import { email } from '../types/email.js';
import { text } from '../types/text.js';
import { defineForm } from './define-form.js';
import { gatesOf, parseAsync, runGates } from './gates.js';
import type { Gate } from './types.js';

const context = { values: {}, args: {} };

describe('runGates', () => {
  it('stops at the first refusal, in order', async () => {
    const third = vi.fn<Gate>();
    const answer = await runGates(
      [() => undefined, () => Promise.resolve('taken'), third],
      'x',
      context
    );
    expect(answer).toEqual({ message: 'taken' });
    expect(third).not.toHaveBeenCalled();
  });

  it('passes on nothing, null, an empty string and an empty message', async () => {
    const gates: Gate[] = [
      () => undefined,
      () => null,
      () => '',
      () => ({ message: '', retryAfter: 0 }),
    ];
    expect(await runGates(gates, 'x', context)).toBeUndefined();
  });

  it('keeps retryAfter', async () => {
    const refusal = { message: 'wait', retryAfter: 5 };
    expect(await runGates([() => refusal], 'x', context)).toEqual(refusal);
  });
});

describe('gatesOf', () => {
  const own: Gate = () => undefined;
  const named: Gate = () => undefined;
  const field = text({ gates: [own, 'named', 'toString'] });

  it('resolves names and leaves out what is not provided', () => {
    expect(gatesOf(field, { named })).toEqual([own, named]);
    expect(gatesOf(field)).toEqual([own]);
  });

  it('is empty without gates', () => {
    expect(gatesOf(text())).toEqual([]);
  });
});

describe('parseAsync', () => {
  it('works like parse on a form without gates', async () => {
    const form = defineForm({ name: text() });
    expect(await parseAsync(form, { name: ' a ' })).toEqual(
      form.parse({ name: ' a ' })
    );
  });

  it('refuses at stage gate, with the gate message', async () => {
    const form = defineForm({
      email: email({ gates: [(value) => `${value} is taken`] }),
    });
    expect(await parseAsync(form, { email: 'A@b.co' })).toEqual({
      ok: false,
      first: { field: 'email', stage: 'gate', message: 'a@b.co is taken' },
      errors: [{ field: 'email', stage: 'gate', message: 'a@b.co is taken' }],
    });
  });

  it('runs no gate while anything else in the form fails', async () => {
    const gate = vi.fn<Gate>();
    const form = defineForm({
      email: email({ gates: [gate] }),
      name: text(),
    });
    const result = await parseAsync(form, { email: 'a@b.co', name: '' });
    expect(result.ok).toBe(false);
    expect(gate).not.toHaveBeenCalled();
  });

  it('skips empty optional fields and inactive fields', async () => {
    const gate = vi.fn<Gate>();
    const form = defineForm({
      kind: text(),
      optional: text({ required: false, gates: [gate] }),
      off: text({ when: () => false, gates: [gate] }),
      tick: checkbox({ required: false, gates: [gate] }),
    });
    const result = await parseAsync(form, { kind: 'x', off: 'y' });
    expect(result.ok).toBe(true);
    expect(gate).not.toHaveBeenCalled();
  });

  it('gives a gate the value, the other values and the arguments', async () => {
    const gate = vi.fn<Gate>();
    const form = defineForm({
      a: text({
        max: (values) => (values['b'] === 'long' ? 9 : 3),
        gates: [gate],
      }),
      b: text(),
    });
    await parseAsync(form, { a: ' x ', b: 'long' });
    expect(gate.mock.calls[0]?.[0]).toBe('x');
    expect(gate.mock.calls[0]?.[1]).toMatchObject({
      values: { a: 'x', b: 'long' },
      args: { max: 9 },
    });
  });

  it('uses the gates provided for names', async () => {
    const form = defineForm({ email: email({ gates: ['free'] }) });
    const result = await parseAsync(
      form,
      { email: 'a@b.co' },
      { gates: { free: () => 'taken' } }
    );
    expect(result).toMatchObject({ ok: false, first: { message: 'taken' } });
  });

  it('rejects when a named gate is missing: never skipped on the server', async () => {
    const form = defineForm({ email: email({ gates: ['free'] }) });
    await expect(parseAsync(form, { email: 'a@b.co' })).rejects.toThrow(
      'No gate "free" for the field "email".'
    );
    await expect(
      parseAsync(form, { email: 'a@b.co' }, { gates: {} })
    ).rejects.toThrow('No gate');
  });

  it('refuses when a gate throws: unchecked is not valid', async () => {
    const form = defineForm({
      email: email({
        gates: [
          () => {
            throw new Error('database down');
          },
        ],
      }),
    });
    expect(await parseAsync(form, { email: 'a@b.co' })).toMatchObject({
      ok: false,
      first: {
        stage: 'gate',
        message: 'This could not be checked. Please try again.',
      },
    });
  });

  it('reports every field a gate refuses', async () => {
    const form = defineForm({
      a: text({ gates: [() => 'no a'] }),
      b: text({ gates: [() => undefined] }),
      c: text({ gates: [() => Promise.resolve('no c')] }),
    });
    const result = await parseAsync(form, { a: '1', b: '2', c: '3' });
    expect(result).toMatchObject({
      ok: false,
      errors: [
        { field: 'a', message: 'no a' },
        { field: 'c', message: 'no c' },
      ],
    });
  });

  it('keeps the normalized values when the gates pass', async () => {
    const form = defineForm({ a: text({ gates: [() => undefined] }) });
    expect(await parseAsync(form, { a: ' x ' })).toEqual({
      ok: true,
      values: { a: 'x' },
    });
  });
});

describe('parse on a form with gates', () => {
  const form = defineForm({ a: text({ gates: [() => 'no'] }) });

  it('throws rather than skip them', () => {
    expect(() => form.parse({ a: 'x' })).toThrow('use parseAsync');
  });

  it('skips them when asked', () => {
    expect(form.parse({ a: 'x' }, { skipGates: true }).ok).toBe(true);
  });
});
