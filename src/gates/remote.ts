/**
 * `remoteGate`: a browser gate that asks your own server. It answers with JSON,
 * `{ "message": string | null, "retryAfter"?: ms }`. No answer (a network error,
 * a 500, nothing within `timeout`) throws, which the binding reads as "no
 * verdict": the field stays neutral and the server decides at submit.
 */
import type { Gate, GateContext } from '../core/types.js';
import { limitChecks } from './limit.js';
import type { LimitedGate, LimitOptions } from './limit.js';

export interface RemoteOptions extends LimitOptions {
  /** What to send, as JSON. Default `{ value }`. */
  readonly body?: (value: string, context: GateContext) => unknown;
  /**
   * How long the server may take, in ms; then no verdict. Default 15 s. A
   * submit waits for the gates, so without it a server that never answers
   * would leave the button doing nothing.
   */
  readonly timeout?: number;
  /** Replaces `globalThis.fetch`. */
  readonly fetch?: typeof globalThis.fetch;
}

export function remoteGate(
  url: string,
  options: RemoteOptions = {}
): LimitedGate {
  const {
    body = (value) => ({ value }),
    timeout = 15_000,
    fetch: send,
    ...limit
  } = options;
  const ask: Gate = async (value, context) => {
    // not `AbortSignal.timeout` or `AbortSignal.any`: Safari 15.4 has neither
    const controller = new AbortController();
    const stop = () => {
      controller.abort();
    };
    const { signal } = context;
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener('abort', stop);
    if (signal?.aborted) stop();
    try {
      const response = await (send ?? globalThis.fetch)(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body(value, context)),
        signal: controller.signal,
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
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
    }
  };
  return limitChecks(ask, limit);
}
