// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldAttributes } from '../core/attributes.js';
import { defineForm } from '../core/define-form.js';
import type { Field } from '../core/types.js';
import { checkbox } from '../types/checkbox.js';
import { confirm } from '../types/confirm.js';
import { choice, select } from '../types/select.js';
import { email } from '../types/email.js';
import { honeypot } from '../types/honeypot.js';
import { password } from '../types/password.js';
import { place, text } from '../types/text.js';
import { bindForm, type BindOptions } from './bind-form.js';

const schema = defineForm({
  kind: choice({ options: ['person', 'company'] }),
  name: text({ max: 10 }),
  email: email(),
  password: password({ required: false }),
  company: text({ when: (v) => v['kind'] === 'company' }),
  city: place({ required: (v) => v['kind'] === 'company' }),
  country: select({ options: ['BG', 'DE'] }),
  terms: checkbox(),
});

const MARKUP = `
  <fieldset data-field="kind">
    <input type="radio" name="kind" value="person">
    <input type="radio" name="kind" value="company">
    <p data-message-for="kind" id="kind-msg"></p>
  </fieldset>
  <div data-field="name"><input name="name" aria-describedby="name-help"><p data-message-for="name"></p></div>
  <div data-field="email"><input name="email"></div>
  <div><input name="password" type="password"></div>
  <div data-field="company"><input name="company"><p data-message-for="company"></p></div>
  <div data-field="city"><input name="city"><p data-message-for="city"></p></div>
  <div data-field="country"><select name="country"><option value="">Choose</option><option>BG</option><option>DE</option></select></div>
  <div data-field="terms"><input type="checkbox" name="terms"></div>
  <button>Send</button>`;

let form: HTMLFormElement;

function control(name: string): HTMLInputElement {
  return form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
}
function box(name: string): HTMLElement {
  return (
    control(name).closest<HTMLElement>('[data-field]') ??
    control(name).parentElement!
  );
}
function line(name: string): string {
  return form.querySelector(`[data-message-for="${name}"]`)!.textContent;
}
function type(name: string, value: string): void {
  const input = control(name);
  input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function leave(name: string): void {
  control(name).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}
function bind(options: BindOptions<unknown> = {}) {
  return bindForm(form, schema, options);
}

beforeEach(() => {
  document.body.innerHTML = `<form>${MARKUP}</form>`;
  form = document.querySelector('form')!;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('bindForm: DOM writes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves required and hidden alone while they stay the same', () => {
    bind();
    type('name', 'An');
    const required = vi.spyOn(HTMLInputElement.prototype, 'required', 'set');
    const hidden = vi.spyOn(HTMLElement.prototype, 'hidden', 'set');
    type('name', 'Ana');
    expect(required).not.toHaveBeenCalled();
    expect(hidden).not.toHaveBeenCalled();
  });

  it('still writes them when they change', () => {
    bind();
    expect(box('company').hidden).toBe(true);
    expect(control('city').required).toBe(false);
    form.querySelector<HTMLInputElement>('[value="company"]')!.click();
    expect(box('company').hidden).toBe(false);
    expect(control('company').required).toBe(true);
    expect(control('city').required).toBe(true);
    form.querySelector<HTMLInputElement>('[value="person"]')!.click();
    expect(box('company').hidden).toBe(true);
    expect(control('company').required).toBe(false);
    expect(control('city').required).toBe(false);
  });
});

describe('bindForm: setup', () => {
  it('looks through the form once, not once per field', () => {
    const select = vi.spyOn(form, 'querySelectorAll');
    const elements = vi.spyOn(form, 'elements', 'get');
    bind();
    expect(select).toHaveBeenCalledTimes(2);
    expect(elements).toHaveBeenCalledTimes(1);
  });

  it('checks only the fields reached so far', () => {
    const checked = new Set<string>();
    for (const name of schema.names) {
      const field: Field = schema.fields[name];
      const check = field.check.bind(field);
      vi.spyOn(field, 'check').mockImplementation((...args) => {
        checked.add(name);
        return check(...args);
      });
    }
    try {
      control('name').value = 'Ana';
      control('email').value = 'ana@';
      const bound = bind();
      expect([...checked]).toEqual([]);
      type('name', 'Anna');
      expect([...checked]).toEqual(['name']);
      expect(box('email').hasAttribute('data-state')).toBe(false);
      bound.validate();
      expect(checked.size).toBeGreaterThan(1);
      expect(box('email').dataset['state']).toBe('invalid');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('takes the first wrapper and the first line of a name, in document order', () => {
    document.body.innerHTML = `<form>
      <div data-field="other"></div>
      <div id="box-1" data-field="name"><p id="line-1" data-message-for="name"></p></div>
      <div id="box-2" data-field="name"><p id="line-2" data-message-for="name"></p></div>
      <input name="name">
      <input name="email">
    </form>`;
    form = document.querySelector('form')!;
    bindForm(form, defineForm({ name: text(), email: email() })).validate();
    expect(form.querySelector('#box-1')!.getAttribute('data-state')).toBe(
      'invalid'
    );
    expect(form.querySelector('#box-2')!.hasAttribute('data-state')).toBe(
      false
    );
    expect(form.querySelector('#line-1')!.textContent).not.toBe('');
    expect(form.querySelector('#line-2')!.textContent).toBe('');
    // no wrapper, no line: the parent, and a line created there
    expect(form.getAttribute('data-state')).toBe('invalid');
    expect(form.querySelector('[data-message-for="email"]')).not.toBeNull();
  });

  it('keeps all the controls of a name, in document order', () => {
    document.body.innerHTML = `<form>
      <input type="radio" name="kind" value="a">
      <input name="other">
      <input type="radio" name="kind" value="b" checked>
    </form>`;
    form = document.querySelector('form')!;
    const kinds = defineForm({
      kind: choice({ options: ['a', 'b'] }),
      other: text({ required: false }),
    });
    expect(bindForm(form, kinds).values()).toEqual({ kind: 'b', other: '' });
    for (const radio of form.querySelectorAll('[type="radio"]'))
      expect(radio.getAttribute('aria-describedby')).toMatch(/^fv\d+-kind$/u);
  });

  it('takes over from the browser checks and links the message lines', () => {
    bind();
    expect(form.noValidate).toBe(true);
    expect(control('name').getAttribute('aria-describedby')).toMatch(
      /^name-help fv\d+-name$/u
    );
    expect(control('kind').getAttribute('aria-describedby')).toBe('kind-msg');
    // a missing line is created in the wrapper
    const created = box('email').querySelector('[data-message-for="email"]');
    expect(created?.id).toMatch(/^fv\d+-email$/u);
    // the wrapper of a field without data-field is the control's parent
    expect(
      box('password').querySelector('[data-message-for="password"]')
    ).not.toBeNull();
  });

  it('mirrors required from the schema, also when it depends on other values', () => {
    bind();
    expect(control('name').required).toBe(true);
    expect(control('password').required).toBe(false);
    expect(control('city').required).toBe(false);
    expect(box('company').hidden).toBe(true);
    const company =
      form.querySelectorAll<HTMLInputElement>('[name="kind"]')[1]!;
    company.checked = true;
    company.dispatchEvent(new Event('change', { bubbles: true }));
    expect(control('city').required).toBe(true);
    expect(box('company').hidden).toBe(false);
    expect(control('company').required).toBe(true);
  });

  it('starts neutral', () => {
    bind();
    for (const name of schema.names) {
      expect(box(name).hasAttribute('data-state')).toBe(false);
      expect(box(name).hasAttribute('data-message')).toBe(false);
    }
  });
});

describe('bindForm: while typing (timing leave)', () => {
  it('turns green as soon as the value is valid', () => {
    bind();
    type('name', 'Ana');
    expect(box('name').dataset['state']).toBe('valid');
    expect(line('name')).toBe('');
    expect(control('name').hasAttribute('aria-invalid')).toBe(false);
  });

  it('shows an unfinished value as a hint, an error once the field is left', () => {
    bind();
    type('email', 'ana@exa');
    expect(box('email').hasAttribute('data-state')).toBe(false);
    expect(box('email').dataset['message']).toBe('hint');
    expect(line('email')).toBe('Enter a valid e-mail, like name@example.com.');
    leave('email');
    expect(box('email').dataset['state']).toBe('invalid');
    expect(box('email').dataset['message']).toBe('error');
    expect(control('email').getAttribute('aria-invalid')).toBe('true');
    // once red it updates live and turns green the moment it is fixed
    type('email', 'ana@example.com');
    expect(box('email').dataset['state']).toBe('valid');
  });

  it('a problem typing can’t fix is an error at once', () => {
    bind();
    type('name', 'x'.repeat(11));
    expect(box('name').dataset['state']).toBe('invalid');
    expect(line('name')).toBe('At most 10 characters (now 11).');
  });

  it('focusing a required field and leaving it empty says it is required', () => {
    bind();
    control('name').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(line('name')).toBe('');
    leave('name');
    expect(box('name').dataset['state']).toBe('invalid');
    expect(line('name')).toBe('This field is required.');
  });

  it('shows the hint while a field is focused and empty', () => {
    bind();
    control('password').dispatchEvent(
      new FocusEvent('focusin', { bubbles: true })
    );
    expect(line('password')).toBe('At least 8 characters.');
    expect(box('password').dataset['message']).toBe('hint');
    leave('password');
    // optional and empty: neutral
    expect(line('password')).toBe('');
    expect(box('password').hasAttribute('data-state')).toBe(false);
  });

  it('a choice is final: selects and checkboxes show their state on change', () => {
    bind();
    const terms = control('terms');
    terms.checked = true;
    terms.dispatchEvent(new Event('change', { bubbles: true }));
    expect(box('terms').dataset['state']).toBe('valid');
    terms.checked = false;
    terms.dispatchEvent(new Event('change', { bubbles: true }));
    expect(box('terms').dataset['state']).toBe('invalid');
    expect(line('terms')).toBe('Please tick this box.');
  });
});

describe('bindForm: other timings', () => {
  it('input: red on every keystroke', () => {
    bind({ timing: 'input' });
    type('email', 'ana@exa');
    expect(box('email').dataset['state']).toBe('invalid');
  });

  it('pause: red after the user stops typing', () => {
    vi.useFakeTimers();
    bind({ timing: 'pause', pause: 500 });
    type('email', 'ana@exa');
    vi.advanceTimersByTime(400);
    type('email', 'ana@exam');
    vi.advanceTimersByTime(400);
    expect(box('email').hasAttribute('data-state')).toBe(false);
    vi.advanceTimersByTime(100);
    expect(box('email').dataset['state']).toBe('invalid');
  });

  it('pause: leaving cancels the timer', () => {
    vi.useFakeTimers();
    bind({ timing: 'pause' });
    type('email', 'ana@exa');
    leave('email');
    expect(box('email').dataset['state']).toBe('invalid');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('bindForm: submit, server errors, reset, destroy', () => {
  function fill() {
    form.querySelector<HTMLInputElement>('[name="kind"]')!.checked = true;
    control('name').value = 'Ana';
    control('email').value = 'Ana@Example.com';
    form.querySelector('select')!.value = 'BG';
    control('terms').checked = true;
  }

  it('an invalid submit marks every problem and focuses the first', () => {
    const onSubmit = vi.fn();
    const bound = bind({ onSubmit });
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(box('kind').dataset['state']).toBe('invalid');
    expect(box('terms').dataset['state']).toBe('invalid');
    expect(box('company').hasAttribute('data-state')).toBe(false);
    expect(document.activeElement).toBe(control('kind'));
    expect(bound.validate()).toBe(false);
  });

  it('a blocked submit calls onInvalid with what each refused field shows, after focusing the first', () => {
    const onInvalid = vi.fn(() => {
      expect(document.activeElement).toBe(control('name'));
    });
    const bound = bind({ onInvalid });
    fill();
    control('name').value = 'x'.repeat(11);
    control('terms').checked = false;
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onInvalid).toHaveBeenCalledWith(
      {
        errors: [
          { field: 'name', message: 'At most 10 characters (now 11).' },
          { field: 'terms', message: 'Please tick this box.' },
        ],
      },
      event
    );
    // validate shows and focuses, but says nothing to onInvalid
    expect(bound.validate()).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);
    // a valid submit doesn't call it
    control('name').value = 'Ana';
    control('terms').checked = true;
    form.requestSubmit();
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it("a server's message still shown blocks the submit and is passed on", () => {
    const onInvalid = vi.fn();
    const onSubmit = vi.fn();
    const bound = bind({ onInvalid, onSubmit });
    fill();
    bound.showErrors([{ field: 'email', message: 'Taken.' }]);
    form.requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledWith(
      { errors: [{ field: 'email', message: 'Taken.' }] },
      expect.anything()
    );
  });

  it('a valid submit calls onSubmit with the parsed values', () => {
    const onSubmit = vi.fn();
    const bound = bind({ onSubmit });
    fill();
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith(
      {
        kind: 'person',
        name: 'Ana',
        email: 'ana@example.com',
        password: '',
        company: '',
        city: '',
        country: 'BG',
        terms: true,
      },
      event
    );
    expect(bound.values()).toMatchObject({
      email: 'Ana@Example.com',
      terms: 'on',
    });
  });

  it('without onSubmit a valid form submits natively', () => {
    bind();
    fill();
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('shows the server’s errors until the field changes', () => {
    const bound = bind();
    fill();
    bound.showErrors([
      { field: 'email', stage: 'remote', message: 'Already registered.' },
      { field: 'unknown', stage: 'rule', message: 'Ignored.' },
    ]);
    expect(box('email').dataset['state']).toBe('invalid');
    expect(line('email')).toBe('Already registered.');
    expect(document.activeElement).toBe(control('email'));
    type('email', 'other@example.com');
    expect(box('email').dataset['state']).toBe('valid');
  });

  it('a change anywhere clears the server’s messages: the value they judged may be fine now', () => {
    const bound = bind();
    fill();
    bound.showErrors([
      { field: 'email', stage: 'rule', message: 'Already registered.' },
      { field: 'name', stage: 'rule', message: 'Not this name.' },
    ]);
    expect(bound.validate()).toBe(false);
    type('city', 'Sofia');
    expect(line('email')).toBe('');
    expect(line('name')).toBe('');
    expect(box('email').dataset['state']).toBe('valid');
    expect(bound.validate()).toBe(true);
  });

  it('showErrors shows nothing for an answer without errors', () => {
    const bound = bind();
    fill();
    const bad: unknown[] = [undefined, null, 42, 'x', { errors: [] }];
    for (const answer of bad)
      expect(() => {
        bound.showErrors(answer as never);
      }).not.toThrow();
    for (const entry of [
      null,
      5,
      'x',
      {},
      { field: 'email' },
      { field: 'email', message: 7 },
    ])
      expect(() => {
        bound.showErrors([entry] as never);
      }).not.toThrow();
    expect(line('email')).toBe('');
    expect(bound.validate()).toBe(true);
  });

  it('reset goes back to neutral; destroy stops listening', () => {
    const bound = bind();
    type('name', 'x'.repeat(11));
    bound.reset();
    expect(box('name').hasAttribute('data-state')).toBe(false);
    expect(line('name')).toBe('');
    bound.destroy();
    type('name', 'x'.repeat(11));
    expect(box('name').hasAttribute('data-state')).toBe(false);
  });

  it('skips schema fields without a control and ignores events from other elements', () => {
    const wider = defineForm({ name: text(), extra: text() });
    const bound = bindForm(form, wider);
    expect(Object.keys(bound.values())).toEqual(['name']);
    form
      .querySelector('button')!
      .dispatchEvent(new Event('input', { bubbles: true }));
    expect(box('name').hasAttribute('data-state')).toBe(false);
  });

  it('a required field without a control blocks the submit and says so', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {
      // kept out of the test output
    });
    const onSubmit = vi.fn();
    const bound = bindForm(form, defineForm({ name: text(), extra: text() }), {
      onSubmit,
    });
    control('name').value = 'Ana';
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]).toEqual([
      'bindForm: no control for',
      [
        {
          field: 'extra',
          stage: 'required',
          message: 'This field is required.',
        },
      ],
    ]);
    expect(bound.validate()).toBe(false);
    report.mockRestore();
  });

  it('an optional field without a control is fine', () => {
    const report = vi.spyOn(console, 'error');
    const onSubmit = vi.fn();
    bindForm(
      form,
      defineForm({ name: text(), extra: text({ required: false }) }),
      { onSubmit }
    );
    control('name').value = 'Ana';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
    report.mockRestore();
  });
});

describe('bindForm: reads what a native submit sends', () => {
  /** The form as markup, the schema, and what `validate` and the server say. */
  function outcome(markup: string, fields: Parameters<typeof defineForm>[0]) {
    document.body.innerHTML = `<form>${markup}</form>`;
    form = document.querySelector('form')!;
    const shape = defineForm(fields);
    const bound = bindForm(form, shape);
    const sent = Object.fromEntries(new FormData(form));
    return {
      bound,
      valid: bound.validate(),
      server: shape.parse(sent),
    };
  }

  it.each([
    [
      'a hidden value and a ticked checkbox',
      '<input type="hidden" name="c" value="0"><input type="checkbox" name="c" value="1" checked>',
      true,
    ],
    [
      'a hidden value and an unticked checkbox',
      '<input type="hidden" name="c" value="0"><input type="checkbox" name="c" value="1">',
      false,
    ],
    [
      'a ticked checkbox with a value the type doesn’t read as ticked',
      '<input type="checkbox" name="c" value="yes" checked>',
      false,
    ],
    [
      'two checkboxes of a name, none ticked',
      '<input type="checkbox" name="c"><input type="checkbox" name="c">',
      false,
    ],
    [
      'two checkboxes of a name, one ticked',
      '<input type="checkbox" name="c" checked><input type="checkbox" name="c">',
      true,
    ],
    ['one ticked checkbox', '<input type="checkbox" name="c" checked>', true],
    ['one unticked checkbox', '<input type="checkbox" name="c">', false],
  ])('checkbox: %s', (_name, markup, expected) => {
    const { valid, server } = outcome(markup, { c: checkbox() });
    expect(valid).toBe(expected);
    expect(server.ok).toBe(expected);
  });

  it.each([
    ['disabled and filled', '<input name="t" value="Ana" disabled>', false],
    ['disabled and empty', '<input name="t" disabled>', false],
    [
      'two of a name, the second wrong',
      '<input name="t" value="Ana"><input name="t" value="a&lt;b">',
      false,
    ],
    [
      'two of a name, the first wrong',
      '<input name="t" value="a&lt;b"><input name="t" value="Ana">',
      true,
    ],
    ['a text area', '<textarea name="t">Ana</textarea>', true],
    [
      'a drop-down',
      '<select name="t"><option value="">-</option><option selected>Ana</option></select>',
      true,
    ],
    [
      'radio buttons, none checked',
      '<input type="radio" name="t" value="a"><input type="radio" name="t" value="b">',
      false,
    ],
    [
      'radio buttons, one checked',
      '<input type="radio" name="t" value="a"><input type="radio" name="t" value="b" checked>',
      true,
    ],
  ])('a required text: %s', (_name, markup, expected) => {
    const { valid, server } = outcome(markup, {
      t: text({ chars: 'name' }),
    });
    expect(valid).toBe(expected);
    expect(server.ok).toBe(expected);
  });

  it('a disabled optional field is empty, and stays out of the values', () => {
    const { valid, server, bound } = outcome(
      '<input name="a" value="Ana"><input name="b" value="x" disabled>',
      { a: text(), b: text({ required: false }) }
    );
    expect(valid).toBe(true);
    expect(server).toEqual({ ok: true, values: { a: 'Ana', b: '' } });
    expect(bound.values()).toEqual({ a: 'Ana' });
  });

  it('focuses the visible control of a field, not its hidden value', () => {
    const { bound } = outcome(
      '<input type="hidden" name="c" value="0"><input type="checkbox" name="c" value="1">',
      { c: checkbox() }
    );
    bound.validate();
    expect(document.activeElement).toBe(
      form.querySelector('[type="checkbox"]')
    );
  });
});

describe('bindForm: loaded after the user started', () => {
  it('picks up the field that already has focus', () => {
    const input = control('password');
    input.focus();
    expect(document.activeElement).toBe(input);
    bind();
    // a focused, empty field shows what it expects, as if focus came after binding
    expect(line('password')).toBe('At least 8 characters.');
    expect(box('password').dataset['message']).toBe('hint');
  });

  it('shows the state of what was typed in it', () => {
    const input = control('name');
    input.focus();
    input.value = 'Ana';
    bind();
    expect(box('name').dataset['state']).toBe('valid');
  });

  it('leaves the other fields neutral, also when they hold a value', () => {
    control('email').value = 'ana@exa';
    control('name').focus();
    bind();
    expect(box('email').hasAttribute('data-state')).toBe(false);
    expect(line('email')).toBe('');
  });

  it('ignores focus outside the form', () => {
    document.body.insertAdjacentHTML('beforeend', '<input id="outside">');
    document.querySelector<HTMLInputElement>('#outside')!.focus();
    bind();
    for (const name of schema.names)
      expect(box(name).hasAttribute('data-message')).toBe(false);
  });
});

describe('bindForm: a honeypot', () => {
  const trapped = defineForm({ email: email(), extra_note: honeypot() });
  const markup = `<div data-field="email"><input name="email"><p data-message-for="email"></p></div>
    <div class="fv-trap" aria-hidden="true"><label>Leave this empty <input name="extra_note" tabindex="-1" autocomplete="new-password"></label></div>
    <button>Send</button>`;

  beforeEach(() => {
    document.body.innerHTML = `<form>${markup}</form>`;
    form = document.querySelector('form')!;
  });

  // a failed assertion must not leave console.error mocked for later tests
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gets no message line, no state and no describedby', () => {
    const bound = bindForm(form, trapped);
    expect(form.querySelectorAll('[data-message-for]')).toHaveLength(1);
    expect(form.querySelector('label')!.children).toHaveLength(1);
    control('extra_note').value = 'bot';
    expect(bound.validate()).toBe(false);
    expect(control('extra_note').hasAttribute('aria-describedby')).toBe(false);
    expect(control('extra_note').hasAttribute('aria-invalid')).toBe(false);
    expect(form.querySelector('label')!.hasAttribute('data-state')).toBe(false);
    bound.showErrors([{ field: 'extra_note', message: 'No.' }]);
    expect(form.querySelector('label')!.textContent).toBe('Leave this empty ');
  });

  it('is sent and checked: filled, the form does not submit', () => {
    const onSubmit = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bound = bindForm(form, trapped, { onSubmit });
    control('email').value = 'ana@example.com';
    expect(bound.values()).toEqual({
      email: 'ana@example.com',
      extra_note: '',
    });
    form.requestSubmit();
    expect(onSubmit).toHaveBeenCalledWith(
      { email: 'ana@example.com', extra_note: '' },
      expect.anything()
    );
    control('extra_note').value = 'bot';
    expect(bound.values()['extra_note']).toBe('bot');
    form.requestSubmit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // it has a control: nothing to report
    expect(error).not.toHaveBeenCalled();
  });

  it("filled, onInvalid gets the honeypot's message and no field", () => {
    const onInvalid = vi.fn();
    bindForm(form, trapped, { onInvalid });
    control('email').value = 'ana@example.com';
    control('extra_note').value = 'ana@example.com';
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onInvalid).toHaveBeenCalledWith(
      { errors: [], trap: 'This form could not be sent.' },
      event
    );
    // with a field to fix as well: both, and still no word of the honeypot
    control('email').value = 'ana@';
    form.requestSubmit();
    expect(onInvalid).toHaveBeenLastCalledWith(
      {
        errors: [
          {
            field: 'email',
            message: 'Enter a valid e-mail, like name@example.com.',
          },
        ],
        trap: 'This form could not be sent.',
      },
      expect.anything()
    );
    expect(document.activeElement).toBe(control('email'));
  });

  it("says the honeypot's own message, from the schema", () => {
    const onInvalid = vi.fn();
    const own = defineForm({
      email: email(),
      extra_note: honeypot({ messages: { rule: 'Please try again later.' } }),
    });
    bindForm(form, own, { onInvalid });
    control('email').value = 'ana@example.com';
    control('extra_note').value = 'x';
    form.requestSubmit();
    expect(onInvalid).toHaveBeenCalledWith(
      { errors: [], trap: 'Please try again later.' },
      expect.anything()
    );
  });

  it('ignores a message line the page has for it', () => {
    form
      .querySelector('label')!
      .insertAdjacentHTML('beforeend', '<p data-message-for="extra_note"></p>');
    const bound = bindForm(form, trapped);
    control('extra_note').value = 'bot';
    bound.validate();
    expect(
      form.querySelector('[data-message-for="extra_note"]')!.textContent
    ).toBe('');
  });
});

describe('bindForm: showErrors', () => {
  it('takes errors without a stage', () => {
    const bound = bind();
    bound.showErrors([{ field: 'name', message: 'Taken.' }]);
    expect(line('name')).toBe('Taken.');
  });
});

describe('bindForm: confirm', () => {
  const twice = defineForm({
    email: email(),
    emailAgain: confirm({ of: 'email' }),
  });

  beforeEach(() => {
    document.body.innerHTML = `<form>
      <div data-field="email"><input name="email"><p data-message-for="email"></p></div>
      <div data-field="emailAgain"><input name="emailAgain"><p data-message-for="emailAgain"></p></div>
      <button>Send</button></form>`;
    form = document.querySelector('form')!;
  });

  it('compares like with like, as the server does', () => {
    const onSubmit = vi.fn();
    bindForm(form, twice, { onSubmit, timing: 'input' });
    type('email', 'Ana@X.com');
    type('emailAgain', 'ANA@x');
    expect(box('emailAgain').getAttribute('data-state')).toBe('invalid');
    type('emailAgain', 'Ana@X.com ');
    expect(box('emailAgain').getAttribute('data-state')).toBe('valid');
    expect(line('emailAgain')).toBe('');
    form.requestSubmit();
    expect(onSubmit).toHaveBeenCalledWith(
      { email: 'ana@x.com', emailAgain: 'Ana@X.com ' },
      expect.anything()
    );
  });
});

describe('bindForm: a field from an older copy of the package', () => {
  it('binds a field without bases', () => {
    const older: Field = { ...email() };
    delete (older as { bases?: unknown }).bases;
    expect(older).not.toHaveProperty('bases');
    const legacy = defineForm({ email: older });
    document.body.innerHTML = `<form><div data-field="email"><input name="email"><p data-message-for="email"></p></div></form>`;
    form = document.querySelector('form')!;
    const bound = bindForm(form, legacy);
    control('email').value = 'nope';
    expect(bound.validate()).toBe(false);
    expect(line('email')).toBe('Enter a valid e-mail, like name@example.com.');
    expect(fieldAttributes(legacy, 'email')).toMatchObject({
      inputmode: 'email',
    });
  });
});
