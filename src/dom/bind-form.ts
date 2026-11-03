/**
 * The browser binding (plan §7): checks a form's fields while the user types,
 * with the schema the server uses. It sets attributes only; the look is the
 * page's CSS:
 *
 * - on the field's wrapper (`[data-field="<name>"]`, else the control's
 *   parent): `data-state="valid" | "invalid"` (none: neutral) and
 *   `data-message="hint" | "error"` (none: no message); `hidden` when the
 *   field is inactive (`when`);
 * - on the controls: `required` (from the schema, also when it depends on
 *   other values), `aria-invalid`, the message line in `aria-describedby`;
 * - the message line (`[data-message-for="<name>"]`, created if missing):
 *   its text.
 */
import type {
  FieldError,
  Form,
  FormFields,
  ValuesOf,
} from '../core/define-form.js';
import type { FormValues } from '../core/types.js';

/**
 * When a value that isn't finished yet (too short, shape incomplete) turns
 * red. In every mode the field is checked on each keystroke: it turns green
 * as soon as it is valid, a problem typing can't fix (a character that isn't
 * allowed, too long) is red at once, and a field that has been red updates
 * live.
 *
 * - `leave`: when the field is left ("reward early, punish late");
 * - `pause`: when the user stops typing for `pause` ms, or leaves;
 * - `input`: at once, on every keystroke (motionbites).
 */
export type Timing = 'leave' | 'pause' | 'input';

export interface BindOptions<T> {
  /** Default `leave`. */
  readonly timing?: Timing;
  /** For `timing: 'pause'`, in ms. Default 1000. */
  readonly pause?: number;
  /**
   * Called with the parsed values when the submitted form is valid (the
   * native submit is prevented). Without it a valid form submits natively.
   */
  readonly onSubmit?: (values: T, event: Event) => void;
}

export interface BoundForm {
  /** Checks every field, shows every problem, focuses the first; `true` when valid. */
  validate(): boolean;
  /** The raw values of the controls by field name (strings; checkboxes: booleans). */
  values(): Record<string, unknown>;
  /** Shows errors found elsewhere (the server's) until the field changes. */
  showErrors(errors: readonly FieldError[]): void;
  /** Back to neutral: no states, no messages. */
  reset(): void;
  /** Removes the listeners. */
  destroy(): void;
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface Slot {
  readonly name: string;
  readonly controls: readonly Control[];
  readonly box: HTMLElement;
  readonly line: HTMLElement;
  /** Focused or changed at least once: its state shows. */
  touched: boolean;
  /** Left, changed, submitted or past the pause: unfinished values are errors. */
  shown: boolean;
  /** A message from `showErrors`, until the value changes. */
  server: string | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
}

let forms = 0;

function isControl(element: Element): element is Control {
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
}

function byAttribute(
  root: ParentNode,
  attribute: string,
  name: string
): HTMLElement | undefined {
  for (const element of root.querySelectorAll<HTMLElement>(`[${attribute}]`))
    if (element.getAttribute(attribute) === name) return element;
  return undefined;
}

function setAttribute(
  element: Element,
  name: string,
  value: string | undefined
): void {
  if (value === undefined) element.removeAttribute(name);
  else if (element.getAttribute(name) !== value)
    element.setAttribute(name, value);
}

function read(controls: readonly Control[]): unknown {
  const [first] = controls;
  if (first === undefined) return undefined;
  if (first.type === 'checkbox' && controls.length === 1)
    return (first as HTMLInputElement).checked;
  if (first.type === 'radio')
    return (
      controls.find((control) => (control as HTMLInputElement).checked)
        ?.value ?? ''
    );
  return first.value;
}

export function bindForm<F extends FormFields>(
  form: HTMLFormElement,
  schema: Form<F>,
  options: BindOptions<ValuesOf<F>> = {}
): BoundForm {
  const { timing = 'leave', pause = 1000, onSubmit } = options;
  const id = ++forms;
  const slots: Slot[] = [];
  let focused: Slot | undefined;

  form.noValidate = true;
  for (const name of schema.names) {
    const controls = [...form.elements].filter(
      (element): element is Control =>
        isControl(element) && element.name === name
    );
    const [first] = controls;
    if (first === undefined) continue;
    const box = byAttribute(form, 'data-field', name) ?? first.parentElement;
    if (box === null) continue;
    let line = byAttribute(form, 'data-message-for', name);
    if (line === undefined) {
      line = form.ownerDocument.createElement('p');
      line.setAttribute('data-message-for', name);
      box.append(line);
    }
    line.id ||= `fv${id}-${name}`;
    for (const control of controls) {
      const ids = (control.getAttribute('aria-describedby') ?? '').split(
        /\s+/u
      );
      if (!ids.includes(line.id))
        control.setAttribute(
          'aria-describedby',
          [...ids, line.id].join(' ').trim()
        );
    }
    slots.push({
      name,
      controls,
      box,
      line,
      touched: false,
      shown: false,
      server: undefined,
      timer: undefined,
    });
  }

  const values = (): Record<string, unknown> =>
    Object.fromEntries(slots.map((slot) => [slot.name, read(slot.controls)]));

  const render = (
    slot: Slot,
    raw: Record<string, unknown>,
    view: FormValues
  ) => {
    const field = schema.fields[slot.name];
    if (field === undefined) return;
    const active = field.isActive(view);
    let state: 'valid' | 'invalid' | undefined;
    let kind: 'hint' | 'error' | undefined;
    let message = '';
    if (active) {
      const result = field.check(raw[slot.name], view);
      if (slot.server !== undefined) {
        state = 'invalid';
        message = slot.server;
      } else if (slot.touched && result.state === 'valid') state = 'valid';
      else if (slot.touched && result.state === 'invalid') {
        if (slot.shown || !result.incomplete) state = 'invalid';
        // an empty field says nothing until it is left
        if (state === 'invalid' || result.stage !== 'required')
          message = result.message;
      }
      if (state === 'invalid') kind = 'error';
      else if (!message && focused === slot && result.state !== 'valid')
        message = field.hint(view) ?? '';
      if (message && kind === undefined) kind = 'hint';
    }
    slot.box.hidden = !active;
    setAttribute(slot.box, 'data-state', state);
    setAttribute(slot.box, 'data-message', kind);
    const required = active && field.isRequired(view);
    for (const control of slot.controls) {
      control.required = required;
      setAttribute(
        control,
        'aria-invalid',
        state === 'invalid' ? 'true' : undefined
      );
    }
    if (slot.line.textContent !== message) slot.line.textContent = message;
  };

  const update = () => {
    const raw = values();
    const view = schema.view(raw);
    for (const slot of slots) render(slot, raw, view);
  };

  const slotOf = (target: EventTarget | null) =>
    slots.find((slot) => slot.controls.some((control) => control === target));

  const focusFirstError = () => {
    const slot = slots.find(
      (s) => !s.box.hidden && s.box.getAttribute('data-state') === 'invalid'
    );
    slot?.controls[0]?.focus();
  };

  const onEvent = (event: Event) => {
    const slot = slotOf(event.target);
    if (slot === undefined) return;
    switch (event.type) {
      case 'focusin':
        focused = slot;
        slot.touched = true;
        break;
      case 'focusout':
        if (focused === slot) focused = undefined;
        slot.shown = true;
        clearTimeout(slot.timer);
        break;
      case 'change':
        slot.touched = slot.shown = true;
        slot.server = undefined;
        break;
      default: // input
        slot.touched = true;
        slot.server = undefined;
        if (timing === 'input') slot.shown = true;
        else if (timing === 'pause') {
          clearTimeout(slot.timer);
          slot.timer = setTimeout(() => {
            slot.shown = true;
            update();
          }, pause);
        }
    }
    update();
  };

  const validate = (): boolean => {
    for (const slot of slots) slot.touched = slot.shown = true;
    update();
    focusFirstError();
    return !slots.some(
      (slot) =>
        !slot.box.hidden && slot.box.getAttribute('data-state') === 'invalid'
    );
  };

  const submit = (event: Event) => {
    if (!validate()) {
      event.preventDefault();
      return;
    }
    if (onSubmit === undefined) return;
    event.preventDefault();
    const result = schema.parse(values());
    if (result.ok) onSubmit(result.values, event);
  };

  const events = ['focusin', 'focusout', 'input', 'change'] as const;
  for (const type of events) form.addEventListener(type, onEvent);
  form.addEventListener('submit', submit);
  update();

  return {
    validate,
    values,
    showErrors: (errors) => {
      for (const error of errors) {
        const slot = slots.find((s) => s.name === error.field);
        if (slot === undefined) continue;
        slot.server = error.message;
        slot.touched = slot.shown = true;
      }
      update();
      focusFirstError();
    },
    reset: () => {
      for (const slot of slots) {
        clearTimeout(slot.timer);
        slot.touched = slot.shown = false;
        slot.server = undefined;
      }
      update();
    },
    destroy: () => {
      for (const slot of slots) clearTimeout(slot.timer);
      for (const type of events) form.removeEventListener(type, onEvent);
      form.removeEventListener('submit', submit);
    },
  };
}
