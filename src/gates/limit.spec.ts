import { describe, expect, it, vi } from 'vitest';
import type { Gate } from '../core/types.js';
import { limitChecks } from './limit.js';

const context = { values: {}, args: {} };

function setup(options = {}) {
  let time = 1000;
  const gate = vi.fn<Gate>((value) =>
    value.startsWith('bad') ? 'refused' : undefined
  );
  const limited = limitChecks(gate, {
    free: 2,
    cooldown: 10_000,
    now: () => time,
    ...options,
  });
  return {
    gate,
    limited,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('limitChecks', () => {
  it('lets the first few go, then a cooldown with the time left', async () => {
    const { gate, limited, advance } = setup();
    expect(await limited('a', context)).toBeUndefined();
    expect(await limited('bad', context)).toBe('refused');
    advance(2500);
    expect(await limited('c', context)).toEqual({
      message: 'Too many checks. Try again in 8 s.',
      retryAfter: 7500,
    });
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it('starts again when the window is over', async () => {
    const { gate, limited, advance } = setup();
    await limited('a', context);
    await limited('b', context);
    advance(10_000);
    expect(await limited('c', context)).toBeUndefined();
    expect(gate).toHaveBeenCalledTimes(3);
  });

  it('a cooldown attempt does not extend the cooldown', async () => {
    const { limited, advance } = setup();
    await limited('a', context);
    await limited('b', context);
    advance(9000);
    await limited('c', context);
    advance(1000);
    expect(await limited('c', context)).toBeUndefined();
  });

  it('answers the same value from memory, without counting it', async () => {
    const { gate, limited } = setup();
    expect(await limited('bad', context)).toBe('refused');
    expect(await limited('bad', context)).toBe('refused');
    expect(await limited('bad', context)).toBe('refused');
    expect(await limited('a', context)).toBeUndefined();
    expect(await limited('a', context)).toBeUndefined();
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it('answers from memory during a cooldown too', async () => {
    const { limited } = setup();
    await limited('bad', context);
    await limited('a', context);
    expect(await limited('bad', context)).toBe('refused');
  });

  it('a value with other arguments is another check', async () => {
    const { gate, limited } = setup();
    await limited('a', { values: {}, args: { country: 'BG' } });
    await limited('a', { values: {}, args: { country: 'DE' } });
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it('forgets an answer after `remember`', async () => {
    const { gate, limited, advance } = setup({ remember: 5000 });
    await limited('a', context);
    advance(5000);
    await limited('a', context);
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it('remembers nothing with remember 0', async () => {
    const { gate, limited } = setup({ remember: 0 });
    await limited('a', context);
    await limited('a', context);
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it('does not remember an answer that holds for now only', async () => {
    const gate = vi.fn<Gate>(() => ({ message: 'down', retryAfter: 100 }));
    const limited = limitChecks(gate, { free: 5 });
    await limited('a', context);
    await limited('a', context);
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it('remembers a final refusal given as an object', async () => {
    const gate = vi.fn<Gate>(() => ({ message: 'no' }));
    const limited = limitChecks(gate, { free: 5 });
    await limited('a', context);
    expect(await limited('a', context)).toEqual({ message: 'no' });
    expect(gate).toHaveBeenCalledTimes(1);
  });

  it('does not remember a gate that threw', async () => {
    const gate = vi
      .fn<Gate>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(undefined);
    const limited = limitChecks(gate, { free: 5 });
    await expect(limited('a', context)).rejects.toThrow('down');
    expect(await limited('a', context)).toBeUndefined();
  });

  it('counts per caller, and shares the answers between them', async () => {
    const { gate, limited } = setup();
    await limited.for('one')('a', context);
    await limited.for('one')('b', context);
    expect(await limited.for('one')('c', context)).toMatchObject({
      retryAfter: 10_000,
    });
    expect(await limited.for('two')('c', context)).toBeUndefined();
    expect(await limited.for('two')('a', context)).toBeUndefined();
    expect(gate).toHaveBeenCalledTimes(3);
  });

  it('uses the message given', async () => {
    const { limited } = setup({
      free: 0,
      message: (seconds: number) => `wait ${seconds}`,
    });
    expect(await limited('a', context)).toMatchObject({ message: 'wait 10' });
  });

  it('keeps at most maxEntries callers and answers', async () => {
    const { gate, limited } = setup({ free: 1, maxEntries: 2 });
    await limited.for('one')('a', context);
    await limited.for('two')('b', context);
    await limited.for('three')('c', context);
    // 'a' was forgotten, and so was the caller 'one' with its count
    await limited.for('one')('a', context);
    expect(gate).toHaveBeenCalledTimes(4);
  });
});
