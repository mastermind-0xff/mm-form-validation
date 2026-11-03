/**
 * The example page: binds each form to its schema, sends valid forms (or,
 * with "Send as is", the raw values) to the example server and shows its
 * answer, and switches the look, the timing and the tokens.
 */
import { bindForm } from '../dist/esm/dom/index.js';
import { optionLabel, optionValue } from '../dist/esm/index.js';
import { countries, forms } from './forms.js';

const root = document.documentElement;

const stored = (key, fallback) => {
  try {
    return localStorage.getItem(`fv-demo-${key}`) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key, value) => {
  try {
    if (value === undefined) localStorage.removeItem(`fv-demo-${key}`);
    else localStorage.setItem(`fv-demo-${key}`, value);
  } catch {
    // private mode: the choice lasts until the page reloads
  }
};

// the drop-down lists the values the schema accepts: one list for both
for (const select of document.querySelectorAll('[data-options="countries"]'))
  for (const option of countries)
    select.add(new Option(optionLabel(option), optionValue(option)));

/** A group of radio buttons in the toolbar, remembered between visits. */
function choose(name, fallback, apply) {
  const value = stored(name, fallback);
  const input = document.querySelector(
    `input[name="${name}"][value="${value}"]`
  );
  if (input) input.checked = true;
  apply(input ? value : fallback);
  document.getElementById(name).addEventListener('change', (event) => {
    store(name, event.target.value);
    apply(event.target.value);
  });
}

choose('look', 'edge', (look) => {
  root.dataset.look = look;
});
choose('scheme', 'light', (scheme) => {
  root.dataset.scheme = scheme;
});

// the tokens: each control sets one --fv-* custom property
const tokens = [...document.querySelectorAll('[data-token]')];
const defaults = new Map(tokens.map((input) => [input, input.value]));
const showToken = (input) => {
  const output = document.querySelector(
    `output[data-for="${input.dataset.token}"]`
  );
  if (output) output.textContent = `${input.value}${input.dataset.unit ?? ''}`;
};
const setToken = (input) => {
  const value = `${input.value}${input.dataset.unit ?? ''}`;
  const changed = input.value !== defaults.get(input);
  if (changed) root.style.setProperty(input.dataset.token, value);
  else root.style.removeProperty(input.dataset.token);
  store(`token${input.dataset.token}`, changed ? input.value : undefined);
  showToken(input);
};
for (const input of tokens) {
  input.value = stored(`token${input.dataset.token}`, input.value);
  setToken(input);
  input.addEventListener('input', () => setToken(input));
}
document.getElementById('reset-tokens').addEventListener('click', () => {
  for (const input of tokens) {
    input.value = defaults.get(input);
    setToken(input);
  }
});

/** Sends values to the example server; its errors go into the message lines. */
async function send(name, values, bound, output) {
  output.dataset.ok = '';
  output.textContent = 'Sending…';
  let answer;
  try {
    const response = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    answer = await response.json();
  } catch {
    output.textContent = 'No server: run npm run examples.';
    return;
  }
  output.dataset.ok = String(answer.ok);
  if (answer.ok) {
    output.textContent = `Server: accepted. Stored values:\n${JSON.stringify(answer.values, null, 2)}`;
    return;
  }
  bound.showErrors(answer.errors);
  output.textContent = [
    `Server: ${answer.errors.length} field(s) refused.`,
    ...answer.errors.map((e) => `${e.field} (${e.stage}): ${e.message}`),
  ].join('\n');
}

const bound = new Map();

function bindAll(timing) {
  for (const binding of bound.values()) binding.destroy();
  for (const form of document.querySelectorAll('form[data-schema]')) {
    const name = form.dataset.schema;
    const output = form.querySelector('output');
    const binding = bindForm(form, forms[name], {
      timing,
      onSubmit: (values) => send(name, values, binding, output),
    });
    bound.set(form, binding);
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const form = button?.form;
  if (!form || !bound.has(form)) return;
  const binding = bound.get(form);
  const output = form.querySelector('output');
  if (button.dataset.action === 'raw')
    send(form.dataset.schema, binding.values(), binding, output);
  else {
    form.reset();
    binding.reset();
    output.textContent = '';
    output.dataset.ok = '';
  }
});

choose('timing', 'leave', bindAll);
