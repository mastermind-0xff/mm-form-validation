/**
 * The example page: binds each form to its schema, sends valid forms (or,
 * with "Send as is", the raw values) to the example server and shows its
 * answer. The look and the timing come from the designer panel (designer.js).
 */
import { bindForm } from '../dist/esm/dom/index.js';
import { optionLabel, optionValue } from '../dist/esm/index.js';
import { startDesigner } from './designer.js';
import { countries, forms } from './forms.js';

// the drop-down lists the values the schema accepts: one list for both
for (const select of document.querySelectorAll('[data-options="countries"]'))
  for (const option of countries)
    select.add(new Option(optionLabel(option), optionValue(option)));

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
  // an answer without `errors` (invalid_json, a 413, a 429): no field to mark
  const errors = answer.errors ?? [];
  bound.showErrors(errors);
  output.textContent =
    errors.length === 0 ?
      `Server: refused (${answer.error ?? 'no reason given'}).`
    : [
        `Server: ${errors.length} field(s) refused.`,
        ...errors.map((e) => `${e.field} (${e.stage}): ${e.message}`),
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

startDesigner({ onTiming: bindAll });
