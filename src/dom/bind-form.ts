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
import { gatesOf, runGates } from '../core/gates.js';
import type { GateSet } from '../core/gates.js';
import type { FieldResult, FormValues, Gate } from '../core/types.js';

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
  /** Default `pause`. */
  readonly timing?: Timing;
  /** For `timing: 'pause'`, and before a gate runs while typing, in ms. Default 1000. */
  readonly pause?: number;
  /** The gates the schema names, by name. One this lacks is left to the server. */
  readonly gates?: GateSet;
  /** The hint while a gate is running. Default "Checking…". */
  readonly checking?: string;
  /**
   * Called with the parsed values when the submitted form is valid (the
   * native submit is prevented). Without it a valid form submits natively.
   */
  readonly onSubmit?: (values: T, event: Event) => void;
}

export interface BoundForm {
  /**
   * Checks every field, shows every problem, focuses the first; `true` when
   * the server will accept the form as well. A required field the page has no
   * control for fails here, and is reported with `console.error`. Gates still
   * running count as passed: use `validateAsync` to wait for them.
   */
  validate(): boolean;
  /** `validate`, after running every gate that has no answer yet. */
  validateAsync(): Promise<boolean>;
  /**
   * The schema's fields as a native submit sends them, by name: strings, a
   * ticked checkbox's `value` (`on` without one). What isn't sent is
   * `undefined`: disabled controls, unticked boxes. The last of a name wins.
   */
  values(): Record<string, unknown>;
  /**
   * Shows errors found elsewhere (the server's) until any field changes: a
   * change elsewhere may fix them (the country a VAT number is checked for),
   * and the checks here show again what is still wrong. Anything but an array
   * (an answer without `errors`) shows nothing.
   */
  showErrors(
    errors:
      | readonly (Pick<FieldError, 'field' | 'message'> & {
          readonly stage?: string;
        })[]
      | undefined
  ): void;
  /** Back to neutral: no states, no messages. */
  reset(): void;
  /**
   * Removes the listeners and timers. The attributes and message lines stay as
   * they are, and `validate` and `values` keep working.
   */
  destroy(): void;
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface Slot {
  readonly name: string;
  readonly controls: readonly Control[];
  readonly box: HTMLElement;
  /** None for a honeypot: nothing about it shows. */
  readonly line: HTMLElement | undefined;
  /** Focused or changed at least once: its state shows. */
  touched: boolean;
  /** Left, changed, submitted or past the pause: unfinished values are errors. */
  shown: boolean;
  /** A message from `showErrors`, until any field changes. */
  server: string | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
  readonly gates: readonly Gate[];
  /** The latest gate run: what it is about, and how it went. */
  check: GateCheck | undefined;
}

interface GateCheck {
  readonly key: string;
  readonly start: () => void;
  readonly controller: AbortController;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** Settles when the gates have answered; `undefined` until they started. */
  running: Promise<void> | undefined;
  /** `undefined` until they answered. `failed` is no verdict: the server decides. */
  outcome: { readonly refused?: string; readonly failed?: boolean } | undefined;
}

let forms = 0;

function isControl(element: Element): element is Control {
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
}

/** The first element for each value of an attribute, in document order. */
function byAttribute(
  root: ParentNode,
  attribute: string
): Map<string, HTMLElement> {
  const found = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    const name = element.getAttribute(attribute) ?? '';
    if (!found.has(name)) found.set(name, element);
  }
  return found;
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

export function bindForm<F extends FormFields>(
  form: HTMLFormElement,
  schema: Form<F>,
  options: BindOptions<ValuesOf<F>> = {}
): BoundForm {
  const {
    timing = 'pause',
    pause = 1000,
    onSubmit,
    gates,
    checking = 'Checking…',
  } = options;
  const id = ++forms;
  const slots: Slot[] = [];
  let focused: Slot | undefined;
  /** A submit is waiting for gates: another click doesn't start a second one. */
  let settling = false;
  /** The gates have passed: the next submit event goes through natively. */
  let release = false;
  let destroyed = false;

  form.noValidate = true;
  // one pass over the form, not one per field: the cost of a large form
  // grew with the square of its fields
  const controlsByName = new Map<string, Control[]>();
  for (const element of form.elements) {
    if (!isControl(element)) continue;
    const same = controlsByName.get(element.name);
    if (same === undefined) controlsByName.set(element.name, [element]);
    else same.push(element);
  }
  const boxes = byAttribute(form, 'data-field');
  const lines = byAttribute(form, 'data-message-for');
  for (const name of schema.names) {
    const controls = controlsByName.get(name);
    const first = controls?.[0];
    const field = schema.fields[name] as FormFields[string];
    if (controls === undefined || first === undefined) continue;
    const box = boxes.get(name) ?? first.parentElement;
    if (box === null) continue;
    // a honeypot's value is sent and checked, but nothing about it shows: no
    // message line inside its label, no state, no focus
    const trap = [field.type, ...field.bases].includes('honeypot');
    let line = trap ? undefined : lines.get(name);
    if (line === undefined && !trap) {
      line = form.ownerDocument.createElement('p');
      line.setAttribute('data-message-for', name);
      box.append(line);
    }
    if (line !== undefined) {
      const lineId = (line.id ||= `fv${id}-${name}`);
      for (const control of controls) {
        const ids = (control.getAttribute('aria-describedby') ?? '').split(
          /\s+/u
        );
        if (!ids.includes(lineId))
          control.setAttribute(
            'aria-describedby',
            [...ids, lineId].join(' ').trim()
          );
      }
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
      gates: gatesOf(field, gates),
      check: undefined,
    });
  }

  const values = (): Record<string, unknown> => {
    // what a native submit sends, so the two sides read the same thing:
    // disabled controls and unticked boxes send nothing, the last of a name wins
    const sent = new Map(new FormData(form));
    return Object.fromEntries(slots.map(({ name }) => [name, sent.get(name)]));
  };

  /** Runs the gates of a slot now, if they are still waiting for the pause. */
  const startCheck = (slot: Slot) => {
    if (slot.check?.outcome === undefined) slot.check?.start();
  };

  const dropCheck = (slot: Slot) => {
    if (slot.check === undefined) return;
    clearTimeout(slot.check.timer);
    slot.check.controller.abort();
    slot.check = undefined;
  };

  /** The gates' verdict on a value that is otherwise valid; starts them if needed. */
  const gateCheck = (
    slot: Slot,
    value: unknown,
    view: FormValues
  ): GateCheck => {
    const field = schema.fields[slot.name] as FormFields[string];
    const args = field.args(view);
    const key = JSON.stringify([value, args]);
    if (slot.check?.key === key) return slot.check;
    dropCheck(slot);
    const controller = new AbortController();
    const check: GateCheck = {
      key,
      controller,
      timer: undefined,
      running: undefined,
      outcome: undefined,
      start: () => {
        clearTimeout(check.timer);
        check.running ??= runGates(slot.gates, String(value), {
          values: view,
          args,
          signal: controller.signal,
        }).then(
          (refusal) => {
            if (slot.check !== check) return;
            check.outcome = refusal ? { refused: refusal.message } : {};
            if (refusal?.retryAfter !== undefined)
              check.timer = setTimeout(() => {
                dropCheck(slot);
                update();
              }, refusal.retryAfter);
            update();
          },
          () => {
            if (slot.check !== check) return;
            check.outcome = { failed: true };
            update();
          }
        );
      },
    };
    slot.check = check;
    if (focused === slot) check.timer = setTimeout(check.start, pause);
    else check.start();
    return check;
  };

  const render = (
    slot: Slot,
    raw: Record<string, unknown>,
    view: FormValues
  ) => {
    const field = schema.fields[slot.name];
    if (field === undefined || slot.line === undefined) return;
    const active = field.isActive(view);
    let state: 'valid' | 'invalid' | undefined;
    let kind: 'hint' | 'error' | undefined;
    let message = '';
    let pending = false;
    if (active) {
      let result: FieldResult<unknown> = field.check(raw[slot.name], view);
      if (result.state === 'valid' && slot.gates.length > 0 && slot.touched) {
        const { outcome } = gateCheck(slot, result.value, view);
        if (outcome?.refused !== undefined)
          result = {
            state: 'invalid',
            stage: 'gate',
            message: outcome.refused,
            incomplete: false,
          };
        else if (outcome === undefined) pending = true;
        else if (outcome.failed) result = { state: 'empty' };
      } else dropCheck(slot);
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
      if (pending && slot.server === undefined) {
        state = undefined;
        message = checking;
      }
      if (state === 'invalid') kind = 'error';
      else if (!message && focused === slot && result.state !== 'valid')
        message = field.hint(view) ?? '';
      if (message && kind === undefined) kind = 'hint';
    }
    if (slot.box.hidden !== !active) slot.box.hidden = !active;
    setAttribute(slot.box, 'data-state', state);
    setAttribute(slot.box, 'data-message', kind);
    const required = active && field.isRequired(view);
    for (const control of slot.controls) {
      if (control.required !== required) control.required = required;
      setAttribute(
        control,
        'aria-invalid',
        state === 'invalid' ? 'true' : undefined
      );
    }
    if (slot.line.textContent !== message) slot.line.textContent = message;
  };

  function update(): void {
    const raw = values();
    const view = schema.view(raw);
    for (const slot of slots) render(slot, raw, view);
  }

  const slotOf = (target: EventTarget | null) =>
    slots.find((slot) => slot.controls.some((control) => control === target));

  const isRed = (slot: Slot) =>
    !slot.box.hidden && slot.box.getAttribute('data-state') === 'invalid';

  const focusFirstError = () => {
    slots
      .find(isRed)
      ?.controls.find((control) => control.type !== 'hidden')
      ?.focus();
  };

  const clearServerErrors = () => {
    for (const slot of slots) slot.server = undefined;
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
        startCheck(slot);
        break;
      case 'change':
        slot.touched = slot.shown = true;
        clearServerErrors();
        break;
      default: // input
        slot.touched = true;
        clearServerErrors();
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

  /** Shows every problem and focuses the first; what the server will accept, if it will. */
  const check = () => {
    for (const slot of slots) slot.touched = slot.shown = true;
    update();
    focusFirstError();
    const result = schema.parse(values(), { skipGates: true });
    if (!result.ok) {
      // a field the page has no control for: no line to show it in, and without
      // this a submit button that does nothing and says nothing
      const lost = result.errors.filter(
        ({ field }) => !slots.some((slot) => slot.name === field)
      );
      if (lost.length > 0) console.error('bindForm: no control for', lost);
    }
    return result.ok && !slots.some(isRed) ? result : undefined;
  };

  /** Runs now every gate that hasn't answered, and waits for them. */
  const settle = async () => {
    update();
    await Promise.all(
      slots.flatMap((slot) => {
        startCheck(slot);
        return slot.check?.running ?? [];
      })
    );
  };

  const hasGates = slots.some((slot) => slot.gates.length > 0);

  const submit = (event: Event) => {
    if (release) {
      release = false;
      return;
    }
    if (settling) {
      event.preventDefault();
      return;
    }
    const result = check();
    if (result === undefined) {
      event.preventDefault();
      return;
    }
    if (!hasGates) {
      if (onSubmit === undefined) return;
      event.preventDefault();
      onSubmit(result.values, event);
      return;
    }
    event.preventDefault();
    settling = true;
    void settle().then(() => {
      settling = false;
      if (destroyed) return;
      const final = check();
      if (final === undefined) return;
      if (onSubmit !== undefined) {
        onSubmit(final.values, event);
        return;
      }
      release = true;
      form.requestSubmit((event as SubmitEvent).submitter);
    });
  };

  const events = ['focusin', 'focusout', 'input', 'change'] as const;
  for (const type of events) form.addEventListener(type, onEvent);
  form.addEventListener('submit', submit);
  // the script may load after the user started, when it loads on first interaction
  focused = slotOf(form.ownerDocument.activeElement);
  if (focused !== undefined) focused.touched = true;
  update();

  return {
    validate: () => check() !== undefined,
    validateAsync: async () => {
      if (check() === undefined) return false;
      await settle();
      return check() !== undefined;
    },
    values,
    showErrors: (errors) => {
      // an answer without `errors` (a 413, a 429) has nothing to show
      const list: readonly unknown[] = Array.isArray(errors) ? errors : [];
      for (const error of list) {
        const { field, message } = (error ?? {}) as {
          readonly field?: unknown;
          readonly message?: unknown;
        };
        const slot = slots.find((s) => s.name === field);
        if (slot === undefined || typeof message !== 'string') continue;
        slot.server = message;
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
        dropCheck(slot);
      }
      update();
    },
    destroy: () => {
      destroyed = true;
      for (const slot of slots) {
        clearTimeout(slot.timer);
        dropCheck(slot);
      }
      for (const type of events) form.removeEventListener(type, onEvent);
      form.removeEventListener('submit', submit);
    },
  };
}
