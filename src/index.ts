/**
 * @mmutils/form-validation: one field schema for the browser and the server
 * (plan `.claude/plan.md`). The core: types, fields, forms, character sets and
 * the built-in field types. The browser binding is `./dom`, the test helpers
 * are `./testing`.
 */
export {
  defineType,
  preset,
  readScalar,
  readString,
  type PresetOptions,
} from './core/define-type.js';
export {
  defineForm,
  type FieldError,
  type Form,
  type FormFields,
  type ParseResult,
  type ValueOf,
  type ValuesOf,
} from './core/define-form.js';
export {
  chars,
  charsStage,
  contains,
  length,
  pattern,
  plural,
} from './core/stages.js';
export { parseAsync } from './core/gates.js';
export type { GateSet, ParseAsyncOptions } from './core/gates.js';
export type {
  CommonOptions,
  Details,
  Dynamic,
  DynamicArgs,
  Examples,
  Field,
  FieldOptions,
  FieldResult,
  FieldType,
  FormValues,
  Gate,
  GateAnswer,
  GateContext,
  GateRefusal,
  Invalid,
  Message,
  Messages,
  Problem,
  Stage,
  TypeSpec,
} from './core/types.js';
export {
  badChar,
  charSets,
  codePoints,
  kinds,
  type CharSet,
  type Kind,
} from './chars.js';

export { fieldAttributes, type FieldAttributes } from './core/attributes.js';

export { checkbox } from './types/checkbox.js';
export { code, type CodeArgs } from './types/code.js';
export { confirm, type ConfirmArgs } from './types/confirm.js';
export { email, type EmailArgs } from './types/email.js';
export { honeypot } from './types/honeypot.js';
export { integer, type IntegerArgs } from './types/integer.js';
export { multiline, type MultilineArgs } from './types/multiline.js';
export { password, type PasswordArgs } from './types/password.js';
export {
  choice,
  optionLabel,
  optionValue,
  select,
  type Option,
  type SelectArgs,
} from './types/select.js';
export {
  personName,
  place,
  streetAddress,
  text,
  type TextArgs,
} from './types/text.js';
export {
  EU_VAT_FORMATS,
  vatNumber,
  vatPrefix,
  type VatNumberArgs,
} from './types/vat-number.js';
