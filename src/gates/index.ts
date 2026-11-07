/**
 * `@mmutils/form-validation/gates`: ready-made gates. A limit for any expensive
 * check, a gate that asks your server, and the whole VAT check against VIES.
 */
export { limitChecks } from './limit.js';
export type { LimitedGate, LimitOptions } from './limit.js';
export { remoteGate } from './remote.js';
export type { RemoteOptions } from './remote.js';
export { VIES_URL, answerVatCheck, vatGate, viesGate } from './vies.js';
export type { VatAnswer, VatGateOptions, ViesOptions } from './vies.js';
