import { describe, expect, it, vi } from 'vitest';
import { defineForm } from '../core/define-form.js';
import { parseAsync } from '../core/gates.js';
import { vatNumber } from '../types/vat-number.js';
import { remoteGate } from './remote.js';
import { VIES_URL, answerVatCheck, vatGate, viesGate } from './vies.js';

type Fetch = typeof globalThis.fetch;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const fakeFetch = (answer: () => Response | Promise<Response>) =>
  vi.fn<Fetch>(() => Promise.resolve(answer()));

const bg = { values: {}, args: { country: 'BG' } };

const sent = (fetch: ReturnType<typeof fakeFetch>, call = 0): unknown =>
  JSON.parse(fetch.mock.calls[call]?.[1]?.body as string);

describe('viesGate', () => {
  it('sends the country code and the number apart', async () => {
    const fetch = fakeFetch(() => json({ valid: true }));
    const gate = viesGate({ fetch });
    expect(await gate('BG123456789', bg)).toBeUndefined();
    expect(fetch.mock.calls[0]?.[0]).toBe(VIES_URL);
    expect(sent(fetch)).toEqual({
      countryCode: 'BG',
      vatNumber: '123456789',
    });
  });

  it('sends Greece as EL, as the value holds it', async () => {
    const fetch = fakeFetch(() => json({ valid: true }));
    await viesGate({ fetch })('EL123456789', {
      values: {},
      args: { country: 'GR' },
    });
    expect(sent(fetch)).toMatchObject({ countryCode: 'EL' });
  });

  it('refuses a number VIES does not know, and remembers it', async () => {
    const fetch = fakeFetch(() => json({ valid: false }));
    const gate = viesGate({ fetch });
    expect(await gate('BG123456789', bg)).toBe(
      'This VAT number is not registered.'
    );
    await gate('BG123456789', bg);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('asks nothing for a country outside the EU', async () => {
    const fetch = fakeFetch(() => json({ valid: false }));
    const gate = viesGate({ fetch });
    expect(
      await gate('ABC123', { values: {}, args: { country: 'US' } })
    ).toBeUndefined();
    expect(await gate('ABC123', { values: {}, args: {} })).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['an error status', () => json({ errorWrappers: [] }, 500)],
    ['no verdict in the answer', () => json({ actionSucceed: false })],
    [
      'no connection',
      (): Response => {
        throw new Error('network');
      },
    ],
    ['not JSON', () => new Response('<html>')],
  ])('refuses, for now only, on %s', async (_, answer) => {
    const fetch = fakeFetch(answer);
    const gate = viesGate({ fetch });
    expect(await gate('BG123456789', bg)).toEqual({
      message: 'The VAT service is not answering. Try again in a minute.',
      retryAfter: 60_000,
    });
    await gate('BG123456789', bg);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('with acceptWhenDown lets it pass, says so, and asks again next time', async () => {
    const fetch = fakeFetch(() => json({}, 503));
    const acceptWhenDown = vi.fn();
    const form = defineForm({
      vat: vatNumber({ country: 'BG', gates: ['vies'] }),
    });
    const vies = viesGate({ fetch, acceptWhenDown });
    const parse = () =>
      parseAsync(form, { vat: 'BG123456789' }, { gates: { vies } });
    expect((await parse()).ok).toBe(true);
    expect((await parse()).ok).toBe(true);
    expect(acceptWhenDown).toHaveBeenCalledWith('BG123456789');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('limits each caller, and refuses instead of letting a value through', async () => {
    const fetch = fakeFetch(() => json({ valid: true }));
    const gate = viesGate({ fetch, free: 1 });
    const form = defineForm({
      vat: vatNumber({ country: 'BG', gates: ['vies'] }),
    });
    const parse = (vat: string, caller: string) =>
      parseAsync(form, { vat }, { gates: { vies: gate.for(caller) } });
    expect((await parse('BG123456789', 'one')).ok).toBe(true);
    expect(await parse('BG223456789', 'one')).toMatchObject({
      ok: false,
      first: { stage: 'gate' },
    });
    expect((await parse('BG223456789', 'two')).ok).toBe(true);
    // a number already checked costs the caller nothing
    expect((await parse('BG123456789', 'one')).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('limits all callers together', async () => {
    const fetch = fakeFetch(() => json({ valid: true }));
    const gate = viesGate({ fetch, perMinute: 2 });
    await gate.for('a')('BG123456781', bg);
    await gate.for('b')('BG123456782', bg);
    expect(await gate.for('c')('BG123456783', bg)).toMatchObject({
      message: 'The VAT service is not answering. Try again in a minute.',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('uses the messages given', async () => {
    const gate = viesGate({
      fetch: fakeFetch(() => json({ valid: false })),
      invalid: 'Nope.',
    });
    expect(await gate('BG123456789', bg)).toBe('Nope.');
  });
});

describe('answerVatCheck', () => {
  const answer = (valid: boolean) => {
    const fetch = fakeFetch(() => json({ valid }));
    return { fetch, gate: viesGate({ fetch }) };
  };

  it('answers null for a number that passes', async () => {
    const { gate } = answer(true);
    expect(
      await answerVatCheck(
        gate,
        { country: 'BG', vatNumber: '123456789' },
        'ip'
      )
    ).toEqual({ message: null });
  });

  it('answers the refusal', async () => {
    const { gate } = answer(false);
    expect(
      await answerVatCheck(
        gate,
        { country: 'BG', vatNumber: 'BG123456789' },
        'ip'
      )
    ).toEqual({ message: 'This VAT number is not registered.' });
  });

  it('never bothers VIES with a value of the wrong shape', async () => {
    const { fetch, gate } = answer(true);
    for (const body of [
      { country: 'BG', vatNumber: '12' },
      { country: 'BG', vatNumber: 7 },
      { country: 'BG', vatNumber: '' },
      { country: 7, vatNumber: '123456789' },
      { vatNumber: '123456789' },
      null,
      'BG123456789',
    ]) {
      const { message } = await answerVatCheck(gate, body, 'ip');
      expect(typeof message).toBe('string');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('passes on the time to wait', async () => {
    const gate = viesGate({ fetch: fakeFetch(() => json({}, 500)) });
    expect(
      await answerVatCheck(
        gate,
        { country: 'BG', vatNumber: '123456789' },
        'ip'
      )
    ).toEqual({
      message: 'The VAT service is not answering. Try again in a minute.',
      retryAfter: 60_000,
    });
  });

  it('answers null for a country outside the EU', async () => {
    const { fetch, gate } = answer(false);
    expect(
      await answerVatCheck(gate, { country: 'US', vatNumber: 'ABC123' }, 'ip')
    ).toEqual({ message: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('counts per caller', async () => {
    const fetch = fakeFetch(() => json({ valid: true }));
    const gate = viesGate({ fetch, free: 1 });
    const ask = (vatNumber: string, caller: string) =>
      answerVatCheck(gate, { country: 'BG', vatNumber }, caller);
    await ask('123456781', 'one');
    expect((await ask('123456782', 'one')).retryAfter).toBeGreaterThan(0);
    expect(await ask('123456782', 'two')).toEqual({ message: null });
  });
});

describe('vatGate', () => {
  it('posts the country and the number to your endpoint', async () => {
    const fetch = fakeFetch(() => json({ message: null }));
    const gate = vatGate({ fetch });
    expect(await gate('BG123456789', bg)).toBeUndefined();
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/vat-check');
    expect(sent(fetch)).toEqual({ country: 'BG', vatNumber: 'BG123456789' });
  });

  it('sends nothing for a country outside the EU', async () => {
    const fetch = fakeFetch(() => json({ message: 'no' }));
    const gate = vatGate({ fetch });
    expect(
      await gate('ABC123', { values: {}, args: { country: 'US' } })
    ).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('first few checks, then a cooldown', async () => {
    const fetch = fakeFetch(() => json({ message: null }));
    const gate = vatGate({ fetch, url: '/vat', free: 1, cooldown: 5000 });
    await gate('BG123456781', bg);
    expect(await gate('BG123456782', bg)).toMatchObject({
      message: expect.stringContaining('Too many checks') as string,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('remoteGate', () => {
  it('sends { value } by default, with the signal', async () => {
    const fetch = fakeFetch(() => json({ message: 'taken' }));
    const controller = new AbortController();
    const gate = remoteGate('/free', { fetch });
    expect(
      await gate('a@b.co', { values: {}, args: {}, signal: controller.signal })
    ).toBe('taken');
    expect(sent(fetch)).toEqual({ value: 'a@b.co' });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('uses globalThis.fetch by default', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ message: null }));
    await remoteGate('/free')('a', { values: {}, args: {} });
    expect(fetch).toHaveBeenCalledOnce();
    fetch.mockRestore();
  });

  it('keeps retryAfter from the answer', async () => {
    const gate = remoteGate('/free', {
      fetch: fakeFetch(() => json({ message: 'later', retryAfter: 900 })),
    });
    expect(await gate('a', { values: {}, args: {} })).toEqual({
      message: 'later',
      retryAfter: 900,
    });
  });

  it.each([
    ['null', () => json(null)],
    ['no message', () => json({})],
    ['a message that is no string', () => json({ message: 5 })],
  ])('passes on %s', async (_, answer) => {
    const gate = remoteGate('/free', { fetch: fakeFetch(answer) });
    expect(await gate('a', { values: {}, args: {} })).toBeUndefined();
  });

  it('throws when the server has no answer: no verdict', async () => {
    const gate = remoteGate('/free', { fetch: fakeFetch(() => json({}, 500)) });
    await expect(gate('a', { values: {}, args: {} })).rejects.toThrow('500');
  });
});
