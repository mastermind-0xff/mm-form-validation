/**
 * `limitChecks` puts a limit on an expensive gate: the first few checks go, then
 * a cooldown. The same value again is answered from memory and
 * costs nothing. Both sides use it: one browser, or one key per caller on a server.
 */
import type { Gate, GateAnswer, GateContext } from '../core/types.js';

export interface LimitOptions {
  /** Checks allowed in one window. Default 3. */
  readonly free?: number;
  /** Length of the window in ms, from its first check. Default 30 s. */
  readonly cooldown?: number;
  /** How long a final answer is kept, in ms. 0 keeps none. Default 1 h. */
  readonly remember?: number;
  /** Callers and answers kept at most, each: a hostile client can't fill the memory. Default 10 000. */
  readonly maxEntries?: number;
  /** The refusal during a cooldown. Default "Too many checks. Try again in 25 s." */
  readonly message?: (seconds: number) => string;
  /** The clock, for tests. */
  readonly now?: () => number;
}

/** A gate with one limit, or one limit per caller through `for`. */
export interface LimitedGate extends Gate {
  for(caller: string): Gate;
}

/** Forgets the oldest entry of a map at its limit: a Map keeps insertion order. */
function bound(map: Map<string, unknown>, max: number): void {
  if (map.size <= max) return;
  const oldest = map.keys().next();
  if (!oldest.done) map.delete(oldest.value);
}

export function limitChecks(
  gate: Gate,
  options: LimitOptions = {}
): LimitedGate {
  const {
    free = 3,
    cooldown = 30_000,
    remember = 3_600_000,
    maxEntries = 10_000,
    message = (seconds) => `Too many checks. Try again in ${seconds} s.`,
    now = Date.now,
  } = options;
  const windows = new Map<string, { start: number; count: number }>();
  const answers = new Map<string, { until: number; answer: GateAnswer }>();

  const limited = (caller: string): Gate => {
    return async (value: string, context: GateContext) => {
      // shared between callers: the answer about a value is the same for all
      const key = JSON.stringify([value, context.args]);
      const time = now();
      const known = answers.get(key);
      if (known !== undefined && known.until > time) return known.answer;
      answers.delete(key);

      let current = windows.get(caller);
      if (current === undefined || time - current.start >= cooldown) {
        current = { start: time, count: 0 };
        windows.delete(caller);
        windows.set(caller, current);
        bound(windows, maxEntries);
      }
      if (current.count >= free) {
        const wait = current.start + cooldown - time;
        return { message: message(Math.ceil(wait / 1000)), retryAfter: wait };
      }
      current.count++;

      const answer = await gate(value, context);
      // an answer with `retryAfter` holds for now only
      const final =
        typeof answer !== 'object' || answer?.retryAfter === undefined;
      if (remember > 0 && final) {
        answers.set(key, { until: now() + remember, answer });
        bound(answers, maxEntries);
      }
      return answer;
    };
  };

  return Object.assign(limited(''), { for: limited });
}
