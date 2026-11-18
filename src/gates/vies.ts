/**
 * The whole VAT check (plan §12 F6). VIES, the EU's service, refuses browsers
 * (its CORS preflight answers 403), so the two sides work like this:
 *
 *   browser: vatGate → your endpoint → answerVatCheck → viesGate → VIES
 *   server:  parseAsync at submit                     → viesGate → VIES
 *
 * The server never saves an unchecked number: its limit answers "try again",
 * it doesn't let the value through. The browser's limit only saves requests.
 */
import type { Gate, GateRefusal } from '../core/types.js';
import { EU_VAT_FORMATS, vatNumber } from '../types/vat-number.js';
import { limitChecks } from './limit.js';
import type { LimitedGate, LimitOptions } from './limit.js';
import { remoteGate } from './remote.js';
import type { RemoteOptions } from './remote.js';

export const VIES_URL =
  'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';

const RETRY_WHEN_DOWN = 60_000;

export interface ViesOptions extends LimitOptions {
  /**
   * Checks across all callers in a minute, so that many callers can't get this
   * server blocked by VIES. Default 120.
   */
  readonly perMinute?: number;
  /** How long VIES may take, in ms. Default 10 s. */
  readonly timeout?: number;
  /** The refusal for a number VIES doesn't know. */
  readonly invalid?: string;
  /** The refusal while VIES doesn't answer. */
  readonly unavailable?: string;
  /**
   * VIES is often down for a country. By default the form is refused until it is
   * back. With this function the value passes instead, and the function is told,
   * so that the application can check the number again later.
   */
  readonly acceptWhenDown?: (vatNumber: string) => void;
  /** Replaces `globalThis.fetch`. */
  readonly fetch?: typeof globalThis.fetch;
  readonly url?: string;
}

const countryOf = (args: unknown): string => {
  const { country } = (args ?? {}) as { readonly country?: unknown };
  return typeof country === 'string' ? country : '';
};

const inEu = (country: string): boolean =>
  Object.hasOwn(EU_VAT_FORMATS, country);

/** Passes without a verdict: not a refusal, and `retryAfter` keeps it from being remembered. */
const UNCHECKED: GateRefusal = { message: '', retryAfter: 0 };

/**
 * The server's gate: one per process, it holds the memory and the limits. Use
 * `.for(caller)` with something that identifies the client, like its IP address.
 * Defaults: 10 checks a minute per caller, answers kept for a day. A number
 * outside the EU passes: VIES knows only EU numbers.
 */
export function viesGate(options: ViesOptions = {}): LimitedGate {
  const {
    perMinute = 120,
    timeout = 10_000,
    invalid = 'This VAT number is not registered.',
    unavailable = 'The VAT service is not answering. Try again in a minute.',
    acceptWhenDown,
    fetch: send,
    url = VIES_URL,
    free = 10,
    cooldown = 60_000,
    remember = 86_400_000,
    ...limit
  } = options;

  const ask: Gate = async (value, { args }) => {
    if (!inEu(countryOf(args))) return undefined;
    let valid: unknown;
    try {
      const response = await (send ?? globalThis.fetch)(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // the stored value starts with the VIES prefix: EL for Greece
        body: JSON.stringify({
          countryCode: value.slice(0, 2),
          vatNumber: value.slice(2),
        }),
        // at most 2^31 - 1 ms: Infinity throws and a longer one fires at once,
        // which would pass every number unchecked with `acceptWhenDown`
        signal: AbortSignal.timeout(Math.min(timeout, 2_147_483_647)),
      });
      if (response.ok) {
        const answer = (await response.json()) as {
          readonly valid?: unknown;
          readonly userError?: unknown;
        };
        // `valid: false` with MS_UNAVAILABLE, TIMEOUT, MS_MAX_CONCURRENT_REQ…
        // is VIES failing, not a verdict: kept for a day, it would refuse a
        // registered number for everyone
        const { userError } = answer;
        if (
          typeof userError !== 'string' ||
          userError === 'VALID' ||
          userError === 'INVALID'
        )
          ({ valid } = answer);
      }
    } catch {
      // no answer: below
    }
    if (valid === true) return undefined;
    if (valid === false) return invalid;
    if (acceptWhenDown === undefined)
      return { message: unavailable, retryAfter: RETRY_WHEN_DOWN };
    acceptWhenDown(value);
    return UNCHECKED;
  };

  const all = limitChecks(ask, {
    ...limit,
    free: perMinute,
    cooldown: 60_000,
    remember: 0,
    message: () => unavailable,
  });
  return limitChecks(all, { ...limit, free, cooldown, remember });
}

/** What an endpoint for `vatGate` sends back, with status 200. */
export interface VatAnswer {
  readonly message: string | null;
  readonly retryAfter?: number;
}

/**
 * The body of your endpoint for `vatGate`: `{ country, vatNumber }` from a client
 * of any kind, so the number's shape is checked before VIES hears of it.
 */
export async function answerVatCheck(
  gate: LimitedGate,
  body: unknown,
  caller: string
): Promise<VatAnswer> {
  const { country, vatNumber: raw } = (
    typeof body === 'object' && body !== null ?
      body
    : {}) as {
    readonly country?: unknown;
    readonly vatNumber?: unknown;
  };
  if (typeof country !== 'string') return { message: 'Invalid value.' };
  const field = vatNumber({ country, required: true });
  const result = field.check(raw);
  if (result.state === 'invalid') return { message: result.message };
  if (result.state !== 'valid') return { message: null };
  const answer = await gate.for(caller)(result.value, {
    values: {},
    args: field.args(),
  });
  if (typeof answer === 'string') return { message: answer };
  if (!answer?.message) return { message: null };
  return {
    message: answer.message,
    ...(answer.retryAfter !== undefined && { retryAfter: answer.retryAfter }),
  };
}

export interface VatGateOptions extends RemoteOptions {
  /** Your endpoint (see `answerVatCheck`). Default `/api/vat-check`. */
  readonly url?: string;
}

/**
 * The browser's gate. Defaults: 3 checks, then 30 s of cooldown. A number outside
 * the EU sends nothing.
 */
export function vatGate(options: VatGateOptions = {}): Gate {
  const { url = '/api/vat-check', ...rest } = options;
  const remote = remoteGate(url, {
    body: (value, { args }) => ({
      country: countryOf(args),
      vatNumber: value,
    }),
    ...rest,
  });
  return (value, context) =>
    inEu(countryOf(context.args)) ? remote(value, context) : undefined;
}
