/**
 * `select` (a drop-down) and `choice` (a radio group): the value must be one
 * of the options, checked by value, not by index (plan §12 F2). The empty
 * value ('', a "Choose…" option) is "not chosen".
 */
import { defineType, preset, readScalar } from '../core/define-type.js';

/** An option: its value, or its value and label. */
export type Option =
  string | { readonly value: string; readonly label: string };

export interface SelectArgs {
  readonly options: readonly Option[];
}

export function optionValue(option: Option): string {
  return typeof option === 'string' ? option : option.value;
}

export function optionLabel(option: Option): string {
  return typeof option === 'string' ? option : option.label;
}

export const select = /* @__PURE__ */ defineType<SelectArgs>({
  name: 'select',
  defaults: { options: [] },
  read: readScalar,
  stages: [
    {
      name: 'rule',
      check: (value, { options }) =>
        options.some((option) => optionValue(option) === value) ? undefined : (
          { message: 'Choose one of the options.' }
        ),
    },
  ],
  messages: { required: 'Choose an option.' },
  examples: ({ options }) => {
    const values = options.map(optionValue);
    return {
      valid: values.filter((value) => value !== '').slice(0, 3),
      // longer than every option, so none of them
      invalid: [{ value: `x${values.join('')}`, stage: 'rule' }],
    };
  },
});

/** A radio group: like `select`. */
export const choice = /* @__PURE__ */ preset(select, { name: 'choice' });
