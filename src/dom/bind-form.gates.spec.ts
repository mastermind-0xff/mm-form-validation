// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineForm } from '../core/define-form.js';
import type { Gate } from '../core/types.js';
import { remoteGate } from '../gates/remote.js';
import { text } from '../types/text.js';
import { bindForm } from './bind-form.js';
import type { BindOptions } from './bind-form.js';

let form: HTMLFormElement;
const input = () => form.querySelector('input')!;
const box = () => form.querySelector('[data-field]')!;
const line = () => form.querySelector('[data-message-for]')!.textContent;

function focus() {
  input().focus();
  input().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}
function type(value: string) {
  input().value = value;
  input().dispatchEvent(new Event('input', { bubbles: true }));
}
function leave() {
  input().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}
const submit = () =>
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

function bind(gate: Gate, options: BindOptions<unknown> = {}) {
  return bindForm(form, defineForm({ a: text({ gates: [gate] }) }), {
    pause: 100,
    ...options,
  });
}

/** A gate whose answer the test gives. */
function controlled() {
  const answers: ((answer: string | undefined) => void)[] = [];
  const gate = vi.fn<Gate>(
    () =>
      new Promise((resolve) => {
        answers.push(resolve);
      })
  );
  return { gate, answers };
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = `<form><div data-field="a"><input name="a"><p data-message-for="a"></p></div></form>`;
  form = document.querySelector('form')!;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('bindForm: gates while typing', () => {
  it('runs after the pause, and says it is checking meanwhile', async () => {
    const { gate, answers } = controlled();
    bind(gate);
    focus();
    type('abc');
    expect(box().getAttribute('data-state')).toBeNull();
    expect(line()).toBe('Checking…');
    expect(box().getAttribute('data-message')).toBe('hint');
    expect(gate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(gate).toHaveBeenCalledOnce();
    answers[0]?.(undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(box().getAttribute('data-state')).toBe('valid');
    expect(line()).toBe('');
  });

  it('shows a refusal in red at once', async () => {
    bind(() => 'Already taken.');
    focus();
    type('abc');
    await vi.advanceTimersByTimeAsync(100);
    expect(box().getAttribute('data-state')).toBe('invalid');
    expect(box().getAttribute('data-message')).toBe('error');
    expect(line()).toBe('Already taken.');
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('does not call a gate for every keystroke', async () => {
    const gate = vi.fn<Gate>();
    bind(gate);
    focus();
    for (const value of ['a', 'ab', 'abc']) {
      type(value);
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(100);
    expect(gate).toHaveBeenCalledOnce();
    expect(gate.mock.calls[0]?.[0]).toBe('abc');
  });

  it('runs at once on leaving', async () => {
    const gate = vi.fn<Gate>();
    bind(gate);
    focus();
    type('abc');
    leave();
    await vi.advanceTimersByTimeAsync(0);
    expect(gate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(500);
    expect(gate).toHaveBeenCalledOnce();
  });

  it('does not run on a value that fails its stages, or untouched', async () => {
    const gate = vi.fn<Gate>();
    input().value = 'prefilled';
    bind(gate);
    await vi.advanceTimersByTimeAsync(500);
    expect(gate).not.toHaveBeenCalled();
    focus();
    type('');
    await vi.advanceTimersByTimeAsync(500);
    expect(gate).not.toHaveBeenCalled();
  });

  it('ignores the answer about a value that has changed, and aborts it', async () => {
    const { gate, answers } = controlled();
    bind(gate);
    focus();
    type('old');
    await vi.advanceTimersByTimeAsync(100);
    type('new');
    expect(gate.mock.calls[0]?.[1].signal?.aborted).toBe(true);
    answers[0]?.('Old is taken.');
    await vi.advanceTimersByTimeAsync(0);
    expect(line()).toBe('Checking…');
    await vi.advanceTimersByTimeAsync(100);
    answers[1]?.(undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(box().getAttribute('data-state')).toBe('valid');
  });

  it('remembers the verdict of the current value', async () => {
    const gate = vi.fn<Gate>();
    bind(gate);
    focus();
    type('abc');
    await vi.advanceTimersByTimeAsync(100);
    leave();
    focus();
    await vi.advanceTimersByTimeAsync(500);
    expect(gate).toHaveBeenCalledOnce();
  });

  it('asks again after retryAfter', async () => {
    const gate = vi
      .fn<Gate>()
      .mockResolvedValueOnce({ message: 'Wait.', retryAfter: 1000 })
      .mockResolvedValue(undefined);
    bind(gate);
    focus();
    type('abc');
    leave();
    await vi.advanceTimersByTimeAsync(0);
    expect(line()).toBe('Wait.');
    await vi.advanceTimersByTimeAsync(1000);
    expect(gate).toHaveBeenCalledTimes(2);
    expect(box().getAttribute('data-state')).toBe('valid');
  });

  it('stays neutral when a gate throws: the server decides', async () => {
    bind(() => {
      throw new Error('offline');
    });
    focus();
    type('abc');
    leave();
    await vi.advanceTimersByTimeAsync(0);
    expect(box().getAttribute('data-state')).toBeNull();
    expect(line()).toBe('');
  });

  it('leaves a named gate it was not given to the server', () => {
    const bound = bindForm(
      form,
      defineForm({ a: text({ gates: ['server-only'] }) })
    );
    focus();
    type('abc');
    expect(box().getAttribute('data-state')).toBe('valid');
    expect(bound.validate()).toBe(true);
  });

  it('uses the gate given by name, and the checking text', () => {
    const { gate } = controlled();
    bindForm(form, defineForm({ a: text({ gates: ['free'] }) }), {
      gates: { free: gate },
      checking: 'One moment…',
    });
    focus();
    type('abc');
    expect(line()).toBe('One moment…');
  });

  it('showErrors wins over a running gate', async () => {
    const { gate } = controlled();
    const bound = bind(gate);
    focus();
    type('abc');
    await vi.advanceTimersByTimeAsync(100);
    bound.showErrors([
      { field: 'a', stage: 'gate', message: 'Server says no.' },
    ]);
    expect(line()).toBe('Server says no.');
    expect(box().getAttribute('data-state')).toBe('invalid');
  });

  it('reset and destroy stop a waiting gate', async () => {
    const gate = vi.fn<Gate>();
    const bound = bind(gate);
    focus();
    type('abc');
    bound.reset();
    await vi.advanceTimersByTimeAsync(500);
    expect(gate).not.toHaveBeenCalled();
    focus();
    type('abcd');
    bound.destroy();
    await vi.advanceTimersByTimeAsync(500);
    expect(gate).not.toHaveBeenCalled();
  });
});

describe('bindForm: gates at submit', () => {
  it('waits for the gates, then calls onSubmit', async () => {
    const { gate, answers } = controlled();
    const onSubmit = vi.fn();
    bind(gate, { onSubmit });
    input().value = 'abc';
    submit();
    await vi.advanceTimersByTimeAsync(0);
    expect(gate).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    answers[0]?.(undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ a: 'abc' });
  });

  it('submits after the timeout when a remote gate never answers', async () => {
    const silent = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        })
    );
    const onSubmit = vi.fn();
    bind(remoteGate('/free', { fetch: silent }), { onSubmit });
    input().value = 'abc';
    submit();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(onSubmit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    // no verdict: the server decides
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('runs at once a gate still waiting for the pause', async () => {
    const gate = vi.fn<Gate>();
    const onSubmit = vi.fn();
    bind(gate, { onSubmit });
    focus();
    type('abc');
    submit();
    await vi.advanceTimersByTimeAsync(0);
    expect(gate).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('blocks on a refusal, marks the field and focuses it', async () => {
    const onSubmit = vi.fn();
    const onInvalid = vi.fn();
    bind(() => 'Taken.', { onSubmit, onInvalid });
    input().value = 'abc';
    submit();
    expect(onInvalid).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(line()).toBe('Taken.');
    expect(document.activeElement).toBe(input());
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(onInvalid).toHaveBeenCalledWith(
      { errors: [{ field: 'a', message: 'Taken.' }] },
      expect.anything()
    );
  });

  it('a second submit while waiting starts nothing', async () => {
    const { gate, answers } = controlled();
    const onSubmit = vi.fn();
    bind(gate, { onSubmit });
    input().value = 'abc';
    submit();
    expect(submit()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    answers[0]?.(undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(gate).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('does not wait when the stages already fail', async () => {
    const gate = vi.fn<Gate>();
    bind(gate);
    expect(submit()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(gate).not.toHaveBeenCalled();
  });

  it('lets a gate that threw through: the server decides', async () => {
    const onSubmit = vi.fn();
    bind(
      () => {
        throw new Error('offline');
      },
      { onSubmit }
    );
    input().value = 'abc';
    submit();
    await vi.advanceTimersByTimeAsync(0);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('submits natively after the gates, once', async () => {
    const native = vi.fn((event: Event) => {
      event.preventDefault();
    });
    form.addEventListener('submit', native);
    const request = vi.spyOn(form, 'requestSubmit').mockImplementation(() => {
      submit();
    });
    bind(() => undefined);
    input().value = 'abc';
    submit();
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledOnce();
    expect(native).toHaveBeenCalledTimes(2);
  });

  it('keeps the retry of a cooldown when a submit comes in between', async () => {
    const gate = vi
      .fn<Gate>()
      .mockResolvedValueOnce({ message: 'Wait.', retryAfter: 1000 })
      .mockResolvedValue(undefined);
    const onSubmit = vi.fn();
    bind(gate, { onSubmit });
    input().value = 'abc';
    submit();
    await vi.advanceTimersByTimeAsync(0);
    expect(onSubmit).not.toHaveBeenCalled();
    submit();
    // the field has focus by now, so the retry also waits for the pause
    await vi.advanceTimersByTimeAsync(1100);
    expect(gate).toHaveBeenCalledTimes(2);
    expect(box().getAttribute('data-state')).toBe('valid');
  });

  it('forgets a submit waiting when destroyed', async () => {
    const { gate, answers } = controlled();
    const onSubmit = vi.fn();
    const bound = bind(gate, { onSubmit });
    input().value = 'abc';
    submit();
    await vi.advanceTimersByTimeAsync(0);
    bound.destroy();
    answers[0]?.(undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('bindForm: bind and destroy', () => {
  it('leaves no listener, timer, line or running gate after 1000 cycles', async () => {
    const listeners = new Map<string, number>();
    const count = (type: string, by: number) =>
      listeners.set(type, (listeners.get(type) ?? 0) + by);
    const add = form.addEventListener.bind(form);
    const remove = form.removeEventListener.bind(form);
    vi.spyOn(form, 'addEventListener').mockImplementation((type, fn) => {
      count(type, 1);
      add(type, fn);
    });
    vi.spyOn(form, 'removeEventListener').mockImplementation((type, fn) => {
      count(type, -1);
      remove(type, fn);
    });
    const signals: AbortSignal[] = [];
    const answers: ((answer: string | undefined) => void)[] = [];
    const gate: Gate = (_value, { signal }) => {
      if (signal) signals.push(signal);
      return new Promise((resolve) => answers.push(resolve));
    };
    for (let i = 0; i < 1000; i++) {
      const bound = bind(gate);
      focus();
      type(`abc${String(i)}`);
      // every other cycle the gate is running, else still waiting for the pause
      if (i % 2 === 0) await vi.advanceTimersByTimeAsync(100);
      bound.destroy();
      expect(vi.getTimerCount()).toBe(0);
    }
    expect(Object.fromEntries(listeners)).toEqual({
      focusin: 0,
      focusout: 0,
      input: 0,
      change: 0,
      submit: 0,
    });
    expect(form.querySelectorAll('[data-message-for]')).toHaveLength(1);
    expect(input().getAttribute('aria-describedby')?.split(' ')).toHaveLength(
      1
    );
    expect(signals).toHaveLength(500);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    // answers that come after destroy change nothing
    const before = box().outerHTML;
    for (const answer of answers) answer('Taken.');
    await vi.advanceTimersByTimeAsync(1000);
    expect(box().outerHTML).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('bindForm: validateAsync', () => {
  it('waits for the gates', async () => {
    const bound = bind(() => 'Taken.');
    input().value = 'abc';
    const result = bound.validateAsync();
    await vi.advanceTimersByTimeAsync(0);
    expect(await result).toBe(false);
    expect(line()).toBe('Taken.');
  });

  it('is true when they pass', async () => {
    const bound = bind(() => undefined);
    input().value = 'abc';
    const result = bound.validateAsync();
    await vi.advanceTimersByTimeAsync(0);
    expect(await result).toBe(true);
  });

  it('is false without running them when the stages fail', async () => {
    const gate = vi.fn<Gate>();
    expect(await bind(gate).validateAsync()).toBe(false);
    expect(gate).not.toHaveBeenCalled();
  });
});
