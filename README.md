# @mmutils/form-validation

One field schema for the browser and the server. A form is a list of typed
fields (`text`, `multiline`, `select`, `email`, …) with their own arguments
(length, allowed characters, options). The same code checks a value while the
user types and again when the server receives it, so a value the form accepts
is never refused by the server, and the other way round.

- Checks run in stages: required, characters, length, shape, then the type's
  own rule, then your own gates. Each stage has its own message, so the field
  can say what is still wrong while the user types.
- Optional fields are checked like required ones as soon as they hold a
  value; left empty, they are valid.
- New field types are small objects: a normalizer, the stages and examples of
  valid and invalid values.
- Every type passes the same contract built from its examples.

Work in progress: nothing is published yet. Until it is, link a local copy, and build
it first, because `dist` isn't in git:

```sh
npm install && npm run build                 # here, and again after every change here
npm install file:../path/to/mm-form-validation   # in the project that uses it
```

| Entry                              | Holds                                                                |
| ---------------------------------- | -------------------------------------------------------------------- |
| `@mmutils/form-validation`         | `defineForm`, `defineType`, `parseAsync`, the types                  |
| `@mmutils/form-validation/dom`     | `bindForm`, for the browser                                          |
| `@mmutils/form-validation/gates`   | `limitChecks`, `remoteGate`, the VAT check                           |
| `@mmutils/form-validation/testing` | `typeContract`, for any test runner                                  |
| `@mmutils/form-validation/css`     | the look as settings and the CSS generator                           |
| `@mmutils/form-validation/looks/*` | `edge.css`, `underline.css`, `outline.css`, `icon.css`, `filled.css` |

Not built yet: the types `integer`, `code` and `honeypot`, generated test cases for a
whole form, and helpers that write or check a form's markup.

## A form

```js
import {
  checkbox,
  defineForm,
  email,
  password,
  confirm,
} from '@mmutils/form-validation';

export const register = defineForm({
  email: email(),
  password: password(),
  passwordConfirm: confirm({
    of: 'password',
    messages: { rule: 'The two passwords differ.' },
  }),
  consent: checkbox(),
});
```

The server: `register.parse(body)` gives `{ ok: true, values }` (normalized)
or `{ ok: false, errors, first }`.

The browser:

```js
import { bindForm } from '@mmutils/form-validation/dom';

bindForm(formElement, register, { onSubmit: (values) => send(values) });
```

The binding only sets attributes (`data-state`, `data-message`, `required`,
`aria-invalid`, `hidden`) and the text of each message line; the page's CSS
gives the look. Make that CSS in the look designer below, or write your own.

A drop-down is checked by value. The value can be a database id, so a list like the
countries has one source and the rows store the id:

```js
select({ options: countries.map((c) => ({ value: c.id, label: c.name })) });
// shows the name, and parse gives '17' as a string
```

### The markup

The server renders the fields. The binding finds a control by `name`, its wrapper by
`data-field` and its message line by `data-message-for`. The classes belong to the
generated CSS: `fv-box` marks what shows the state.

```html
<div class="fv-field" data-field="email">
  <label for="email">E-mail</label>
  <input class="fv-box" id="email" name="email" type="email" />
  <p class="fv-message" data-message-for="email"></p>
</div>

<fieldset class="fv-field" data-field="kind">
  <legend>Billing as</legend>
  <div class="fv-options fv-box">
    <label class="fv-option">
      <input type="radio" name="kind" value="0" /> A person
    </label>
    <label class="fv-option">
      <input type="radio" name="kind" value="1" /> A company
    </label>
  </div>
  <p class="fv-message" data-message-for="kind"></p>
</fieldset>

<div class="fv-field" data-field="consent">
  <label class="fv-option fv-box">
    <input type="checkbox" name="consent" /> I accept
  </label>
  <p class="fv-message" data-message-for="consent"></p>
</div>
```

Send the empty message lines and `hidden` on fields that start inactive, or the page
shifts when the script runs. The binding sets `required` from the schema when it runs;
write it in the HTML too if the asterisk must show from the first paint.

### Field types

| Type            | Value   | Arguments (defaults)                                               |
| --------------- | ------- | ------------------------------------------------------------------ |
| `text`          | string  | `min` 1, `max` 255, `chars` `'text'`, `contains`                   |
| `personName`    | string  | as `text`: `max` 100, `chars` `'name'`, `contains` a letter        |
| `place`         | string  | as `text`: `max` 100, `chars` `'place'`, `contains` a letter       |
| `streetAddress` | string  | as `text`: `min` 3, `chars` `'address'`, `contains` a letter       |
| `multiline`     | string  | `min` 1, `max` 5000, `chars` `'multiline'`, `contains`, `maxLines` |
| `select`        | string  | `options`: values, or `{ value, label }`                           |
| `choice`        | string  | `options`, for radio groups                                        |
| `checkbox`      | boolean | none; required means it must be ticked                             |
| `email`         | string  | `min` 1, `max` 254; lower-cased                                    |
| `password`      | string  | `min` 8, `max` 128; never trimmed                                  |
| `confirm`       | string  | `of`: the field to match, default `'password'`                     |
| `vatNumber`     | string  | `country`: an ISO code; upper-cased, with its prefix               |

Lengths count code points, so an emoji counts once. Character sets: `text`, `multiline`, `name`, `place`, `address`, `digits`, `alnum`, `code`.

Every field also takes:

| Option     | Default | What it does                                                          |
| ---------- | ------- | --------------------------------------------------------------------- |
| `required` | `true`  | `false`, or a function of the other values                            |
| `when`     | always  | a function of the other values; false: unchecked, hidden, empty value |
| `messages` |         | by stage: a string, or a function of the stage's details              |
| `hint`     |         | shown while the field is focused and empty                            |
| `rule`     |         | `(value, values) => message or undefined`, one more synchronous check |
| `gates`    |         | checks of your own, below                                             |

Any argument can be a function of the other values too. Those functions see the values
read and normalized, not yet checked.

### What the binding returns

`bindForm(form, schema, options)` takes `timing` (`'pause'` by default, `'leave'`,
`'input'`), `pause` (1000 ms), `gates`, `checking` and `onSubmit`. Without `onSubmit`, a
valid form submits natively. It returns:

| Method             | Does                                                      |
| ------------------ | --------------------------------------------------------- |
| `validate()`       | checks everything, shows every problem, focuses the first |
| `validateAsync()`  | the same, after waiting for the gates                     |
| `values()`         | the raw values, as a native submit sends them             |
| `showErrors(errs)` | shows the server's `errors` in the same lines             |
| `reset()`          | back to neutral                                           |
| `destroy()`        | removes the listeners and timers                          |

### Testing and new types

A type is an object with its defaults, stages and examples. `typeContract` turns the
examples into test cases for any runner:

```js
import { contains, defineType } from '@mmutils/form-validation';
import { typeContract } from '@mmutils/form-validation/testing';

export const word = defineType({
  name: 'word',
  defaults: { contains: 'letter' },
  normalize: (value) => value.trim(),
  stages: [contains],
  examples: () => ({
    valid: ['abc'],
    invalid: [{ value: '123', stage: 'contains' }],
  }),
});

for (const c of typeContract(word, [{}])) test(c.name, c.run);
```

## Checks of your own: gates

A gate is a function that runs after the type's stages, on a value that is otherwise
valid: "this e-mail is already registered". Give a field as many as you need. They run
one after another and the first refusal is the message.

```js
// the schema, imported by both sides
export const register = defineForm({
  email: email({ gates: ['emailFree'] }),
  username: text({
    // a function runs on both sides
    gates: [
      (value) => (value.startsWith('admin') ? 'That name is reserved.' : null),
    ],
  }),
});
```

A name stands for a gate each side implements, which keeps server code out of the page:

```js
// the server: a name it doesn't provide is an error, never a skipped check
import { parseAsync } from '@mmutils/form-validation';

const result = await parseAsync(register, body, {
  gates: {
    emailFree: async (value) =>
      (await users.has(value)) ? 'Already registered.' : null,
  },
});

// the browser: a name it doesn't provide is left to the server
import { remoteGate } from '@mmutils/form-validation/gates';

bindForm(element, register, {
  gates: { emailFree: remoteGate('/api/email-free') },
  onSubmit,
});
```

- A form with gates must use `parseAsync`: `form.parse` throws rather than skip them.
- On the server, gates run only when everything else passed, so a bad body costs no
  database or network. A gate that throws refuses its field.
- In the browser, a gate waits for the pause while typing and runs at once on leaving
  the field. The line says "Checking…" (option `checking`) until it answers, and the
  answer about an old value is dropped. Submitting waits for the gates. A gate that
  throws leaves the field neutral: the server decides.
- A gate can return `{ message, retryAfter }` (ms) for an answer that holds for now
  only: the browser asks again after that long.
- A gate is asked again when the value or the field's arguments change. If it reads
  other values of the form, make them arguments.
- `limitChecks(gate, { free, cooldown, remember })` limits any expensive gate: the
  first few checks go, then a cooldown; the same value again is answered from memory
  and doesn't count. `.for(caller)` keeps one limit per caller on a server.
  `remoteGate` includes it.

### VAT numbers

`vatNumber` checks the shape for the country. `@mmutils/form-validation/gates` adds
the check that the number exists, against VIES, the EU's service. Browsers can't call
VIES, so the page asks your server:

```js
// the schema
vat: vatNumber({ country: (v) => v.country, required: false, gates: ['vies'] }),

// the server: one per process, it holds the memory and the limits
const vies = viesGate();

app.post('/api/vat-check', async (req, res) =>
  res.json(await answerVatCheck(vies, req.body, req.ip))
);
app.post('/api/billing', async (req, res) => {
  const result = await parseAsync(billing, req.body, {
    gates: { vies: vies.for(req.ip) },
  });
  // …
});

// the browser
bindForm(element, billing, { gates: { vies: vatGate() }, onSubmit });
```

|                   | Browser (`vatGate`)                      | Server (`viesGate`)                                |
| ----------------- | ---------------------------------------- | -------------------------------------------------- |
| Limit             | 3 checks, then 30 s                      | 10 checks a minute per caller, 120 a minute in all |
| Options           | `free`, `cooldown`                       | `free`, `cooldown`, `perMinute`                    |
| Same number again | from memory, for an hour                 | from memory, for a day (`remember`)                |
| Over the limit    | "Try again in 25 s", then asks by itself | refuses the form: never saved unchecked            |
| VIES is down      | shows the server's answer                | refuses, "try again"                               |

`country` must give an ISO code (`BG`). Anything else, like the name `Bulgaria`, counts
as outside the EU: only a loose shape is checked and VIES is never asked. If your select
holds names, map them to codes in the function.

Numbers outside the EU pass, as VIES doesn't know them. VIES is often down for one
country or another; to take the order anyway and check later, give
`viesGate({ acceptWhenDown: (number) => queue(number) })`.

## Loading

Load the form code without blocking the page. A module script is already deferred:

```html
<!-- a page with a form: fetched early, runs after parsing -->
<link rel="modulepreload" href="/js/forms.js" />
<script type="module" src="/js/forms.js"></script>

<!-- the home page, with no form: fetched when idle, for the next page -->
<link rel="prefetch" href="/js/forms.js" />
```

Use `prefetch`, not `preload`, on a page that doesn't run the code: `preload` is
high priority and competes with what that page renders. Give the file a long cache
lifetime and a hash in its name. `bindForm` picks up a field that has focus already.

## Good to know

**On the server**

- Put a body limit in front of `parse`. Checks stay fast on hostile values, but
  they still read what they are given.
- A value more than 4 times over `max` (in UTF-16 units) fails at `length` before
  it is normalized, so one padded with thousands of spaces is refused, also in an
  optional field. Real text at `max` stays under the limit.
- `email` checks the shape only. A value like `` `id`@example.com `` is valid, so
  never hand one to a shell or a command line.
- Free text refuses what can't be seen: zero width characters, soft hyphens, bidi
  controls, Hangul fillers. Text pasted with one of those fails, with a message
  naming the character. The joiners U+200C and U+200D stay, for emoji and for
  scripts that need them.
- Names and addresses accept any script, so a value may be kanji or Cyrillic. Fonts
  and invoices that print them, and whether an invoice needs a Latin spelling, are
  for the application to decide.
- Letters come from the JavaScript engine's Unicode tables. A newly encoded letter
  can pass on a newer engine and fail on an older one, in `personName`, `place` and
  `streetAddress`. Nothing can fix that from here.

**In the browser**

- `bindForm` reads a form as a native submit sends it (`new FormData(form)`), so
  markup decides what is checked. A disabled control sends nothing, so a required
  field that is disabled can never pass: use `when` to switch a field off. Of
  several controls of a name, the last wins.
- A checkbox needs no `value`, or one the type reads as ticked (`1`, `on`, `true`).
  With `value="yes"` it fails at `type`, in the browser and on the server.
- A required field with no control in the page blocks the submit and is reported
  with `console.error`.
- `showErrors` messages last until any field changes. The checks then show again
  whatever is still wrong; what only the server knows comes back with the next
  answer.
- `destroy()` removes the listeners and timers. Attributes and message lines stay
  as they are.

## The look designer

```sh
npm run examples
```

Builds the package and serves http://localhost:5178/examples/: four real forms
(sign-in, register, billing with company fields and a VAT number shaped by the
country, contact), a server that checks the same schemas, and a panel to design
how the fields look.

- **Design:** one of five looks (edge, underline, outline, icon, filled), spacing,
  text, light and dark colors, the submit button (`class="fv-submit"`), motion, and
  when an unfinished value turns red. The
  forms use the CSS that gets exported, so what you see is what you get. A control
  the chosen look doesn't use is dimmed, and its token is left out of the CSS.
- **Export:** an agent brief (one Markdown file with the settings, the CSS, the
  markup and how to check the result, so an agent in another project needs nothing
  else), the settings as JSON with only what differs from the defaults, the CSS with
  only those changes, the whole stylesheet, and the block for `<head>`.
- **Import:** paste or load the settings or a saved brief to carry on where you
  left off.

### Only the changes

The package ships a stylesheet per look, with the default settings. Link it, and add
what you exported, in any order:

```html
<link rel="stylesheet" href="…/@mmutils/form-validation/looks/edge.css" />
<link rel="stylesheet" href="/css/form-fields.changes.css" />
```

```css
html:root {
  --fv-pad-x: 20px;
  --fv-valid: #00aa00;
}
```

### CSS in the HTML

When a page is mainly a form, a late stylesheet makes the whole page jump. Choose
what goes into a `<style>` in the HTML, and the rest loads without blocking:

| Inline block    | Holds                                    | Before the stylesheet arrives      |
| --------------- | ---------------------------------------- | ---------------------------------- |
| None            | nothing                                  | the link must block rendering      |
| Layout          | sizes and spacing                        | nothing moves; colors change later |
| Layout + colors | everything shown before the form is used | nothing moves or flashes           |
| Everything      | the whole stylesheet                     | there is nothing to wait for       |

For the edge look these come to about 0.5, 0.9 and 1.2 KB gzipped, against 1.9 KB
for the whole stylesheet. _Leave what is inlined out of the stylesheet_ sends nothing
twice, but then every page that uses the stylesheet needs the block. _Check the layout
shift_ measures every element in the forms with the block alone and with everything,
and reports how far anything moves.

CSS can't prevent every shift. The server must send the message lines, even when
empty, and `hidden` on fields that start inactive: the binding would add both only
when its script runs.

### In code

The panel is a front for `@mmutils/form-validation/css`, which needs neither a
browser nor Node. A form's page bundle never imports it.

```js
import {
  agentBrief,
  generateChanges,
  generateCss,
  headSnippet,
  lookChanges,
  parseLook,
} from '@mmutils/form-validation/css';

const result = parseLook(JSON.parse(settingsText)); // missing values get defaults
if (!result.ok) throw new Error(result.errors.join('\n'));

const changes = generateChanges(result.look); // on top of looks/<look>.css
const short = lookChanges(result.look); // the settings that aren't defaults
const { stylesheet, inline } = generateCss(result.look); // all of it
const head = headSnippet(result.look, '/css/form-fields.css');
const brief = agentBrief(result.look);
```

The output goes into a `<style>`, so `parseLook` accepts each value only in a shape
that can't leave its declaration, and `generateCss` refuses anything else.

## License

MIT
