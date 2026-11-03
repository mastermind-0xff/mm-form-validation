// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineForm } from '../core/define-form.js';
import { checkbox } from '../types/checkbox.js';
import { choice, select } from '../types/select.js';
import { email } from '../types/email.js';
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

describe('bindForm: setup', () => {
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
      terms: true,
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
});
