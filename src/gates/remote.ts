/**
 * `remoteGate`: a browser gate that asks your own server. It answers with JSON,
 * `{ "message": string | null, "retryAfter"?: ms }`. No answer (a network error,
 * a 500) throws, which the binding reads as "no verdict": the field stays neutral
 * and the server decides at submit.
 */
import type { Gate, GateContext } from '../core/types.js';
import { limitChecks } from './limit.js';
import type { LimitedGate, LimitOptions } from './limit.js';

export interface RemoteOptions extends LimitOptions {
  /** What to send, as JSON. Default `{ value }`. */
  readonly body?: (value: string, context: GateContext) => unknown;
  /** Replaces `globalThis.fetch`. */
  readonly fetch?: typeof globalThis.fetch;
}

export function remoteGate(
  url: string,
  options: RemoteOptions = {}
): LimitedGate {
  const { body = (value) => ({ value }), fetch: send, ...limit } = options;
  const ask: Gate = async (value, context) => {
    const response = await (send ?? globalThis.fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body(value, context)),
      ...(context.signal && { signal: context.signal }),
    });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    const answer = (await response.json()) as {
      readonly message?: unknown;
      readonly retryAfter?: unknown;
    } | null;
    if (typeof answer?.message !== 'string') return undefined;
    return typeof answer.retryAfter === 'number' ?
        { message: answer.message, retryAfter: answer.retryAfter }
      : answer.message;
  };
  return limitChecks(ask, limit);
}
