# @mmutils/form-validation

One field schema for the browser and the server. A form is a list of typed
fields (`text`, `multiline`, `select`, `email`, …) with their own arguments
(length, allowed characters, options). The same code checks a value while the
user types and again when the server receives it, so a value the form accepts
is never refused by the server, and the other way round. First used on the
forms of aesweets.com.

## Features

- **One schema, two sides**: the schema is a TypeScript module both sides
  import. It uses no Node and no DOM APIs, so the core runs unchanged in
  browsers and in Node.
- **Checks in stages**: type, required, characters, length, contains, shape,
  the type's own rule, then your own rule and gates. Each stage has its own
  message, so the field can say what is still wrong while the user types.
- **Optional means "empty is valid"**: an optional field is checked like a
  required one as soon as it holds a value.
- **Unicode aware**: names and places accept any script, lengths count code
  points (an emoji counts once), and what nobody can see (zero width
  characters, bidi controls) is refused with a message that names it.
- **A browser binding** that validates while the user types, with three
  timings for when an unfinished value turns red, and sets attributes only:
  the look is your CSS.
- **Gates**: checks of your own ("this e-mail is already registered"), sync
  or async, with a limiter, and a ready-made VAT check against VIES.
- **Looks**: five ready-made stylesheets, and a designer page (in the
  repository) that exports the settings, the CSS, and a brief for whoever
  applies it to a project.
- **New field types are small objects**: a normalizer, the stages and
  examples of valid and invalid values. Every type passes the same contract
  built from its examples, in any test runner.
- **ESM and CommonJS**, with type declarations, and no runtime dependencies.

## Install

```sh
npm install @mmutils/form-validation
```

Requires Node.js 22 or newer on the server. There are no runtime dependencies, so
nothing else is installed with it.

In the browser the code is compiled for ES2022. The newest feature it needs is
`Object.hasOwn` (Chrome and Edge 93, Firefox 92, Safari 15.4). `bindForm` calls
`form.requestSubmit` to send a submit it held back for the gates (Safari 16). The
shipped looks use `:has()` and `color-mix()` (Chrome and Edge 111, Firefox 121, Safari
16.2); older browsers miss the required asterisk, the icon look's icons and some
tints. These versions follow from what the code uses: the browser tests run on current
Chromium, Firefox and WebKit only.

## Entry points

| Entry                              | Holds                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@mmutils/form-validation`         | `defineForm`, `defineType`, `preset`, `parseAsync`, `fieldAttributes`, the field types, the stages, character sets |
| `@mmutils/form-validation/dom`     | `bindForm`, for the browser                                                                                        |
| `@mmutils/form-validation/gates`   | `limitChecks`, `remoteGate`, the VAT check (`viesGate`, `answerVatCheck`, `vatGate`)                               |
| `@mmutils/form-validation/testing` | `typeContract`, `formCases`, `trapNameProblem`, for any test runner                                                |
| `@mmutils/form-validation/css`     | the look as settings and the CSS generator                                                                         |
| `@mmutils/form-validation/looks/*` | `edge.css`, `underline.css`, `outline.css`, `icon.css`, `filled.css`                                               |

Page bundles stay small: the package is built one file per module, so a bundler
keeps only the field types a form imports, and `parseAsync`, `fieldAttributes`
and `./css` are not in the bundle unless imported.

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

The server: `register.parse(body)` takes a JSON body or
`Object.fromEntries(formData)` and gives `{ ok: true, values }` (normalized, typed:
`values.email` is a `string`, `values.consent` a `boolean`) or
`{ ok: false, errors, first }`. `errors` lists every refused field in schema order,
each `{ field, stage, message }`; `first` is the first of them. A key that is not a
field of the form never reaches `values`.

The browser:

```js
import { bindForm } from '@mmutils/form-validation/dom';

bindForm(formElement, register, { onSubmit: (values) => send(values) });
```

The binding only sets attributes (`data-state`, `data-message`, `required`,
`aria-invalid`, `aria-describedby`, `hidden`) and the text of each message line; the
page's CSS gives the look. Link one of the shipped looks, make your own in the look
designer (below), or write the CSS yourself.

A drop-down is checked by value. The value can be a database id, so a list like the
countries has one source and the rows store the id:

```js
select({ options: countries.map((c) => ({ value: c.id, label: c.name })) });
// shows the name, and parse gives '17' as a string
```

### The markup

The server renders the fields. The binding finds a control by `name`, its wrapper by
`data-field` (else the control's parent) and its message line by `data-message-for`
(it creates one when the page has none). The classes belong to the
generated CSS: `fv-box` marks what shows the state.

```html
<div class="fv-field" data-field="email">
  <label for="email">E-mail</label>
  <input class="fv-box" id="email" name="email" autocomplete="email" />
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

`fieldAttributes(form, name, values)` gives what to write on a field's control, from the
schema, so markup and schema can't drift: `required`, and from the type and its
arguments `type`, `inputmode`, `autocapitalize`, `spellcheck` (a preset gets its base
type's). `values` are the raw values the page starts with; `when`, `required` and the
arguments see them as the checks do (`form.view`). It gives no `maxlength`: browsers count
UTF-16 units, the checks count code points, and a hard limit cuts a pasted value without
a word where the field would say "At most 100 characters (now 104).". `true` stands for
an attribute without a value (`required`, `inert`). A page bundle that doesn't import it
doesn't carry it.

```js
import { fieldAttributes } from '@mmutils/form-validation';

fieldAttributes(register, 'email');
// { inputmode: 'email', autocapitalize: 'none', spellcheck: 'false', required: true }
```

| Type                                   | Attributes                                                 |
| -------------------------------------- | ---------------------------------------------------------- |
| `email`                                | `inputmode="email"`, no capitals, no spellcheck; no `type` |
| `password`                             | `type="password"`, no capitals, no spellcheck              |
| `confirm`                              | those of the field named in `of`, and its own `required`   |
| `personName`, `place`, `streetAddress` | `autocapitalize="words"`, no spellcheck                    |
| `code`                                 | `autocapitalize="characters"` with `upper`, else `none`    |
| `vatNumber`                            | `autocapitalize="characters"`, no spellcheck               |
| `integer`                              | `inputmode="numeric"` when `min` is 0 or more              |
| `honeypot`                             | see "A honeypot"                                           |

No `type="email"`: it brings the browser's own e-mail rules (a Unicode local part
refused, the domain turned into punycode in `.value`), a check only the browser runs.
`inputmode="email"` keeps the e-mail keyboard on phones. Put `autocomplete="email"` on it
yourself, like every `autocomplete`: it depends on what the field is for. An `integer`
that may be negative gets no `inputmode`: iOS's numeric keyboard has no minus key.

#### A honeypot

A `honeypot` is a field people don't see: a filled one is refused (stage `rule`, "This
form could not be sent.", which doesn't say why). People must never fill it, so keep
browsers and password managers away from it. A browser that fills it anyway refuses a
real person, the way a bot is refused. That has happened: Firefox filled a honeypot named
`website` on a password reset form with the person's saved e-mail.

```html
<form>
  <label for="email">E-mail</label>
  <input id="email" name="email" autocomplete="username" />
  <label for="password">Password</label>
  <input
    id="password"
    name="password"
    type="password"
    autocomplete="new-password"
  />
  <!-- after the real fields -->
  <div class="fv-trap" aria-hidden="true">
    <label for="extra-note">Leave this empty</label>
    <input
      id="extra-note"
      name="extra_note"
      autocomplete="new-password"
      tabindex="-1"
      inert
      aria-hidden="true"
      data-1p-ignore
      data-lpignore="true"
      data-bwignore
      data-form-type="other"
    />
  </div>
  <button>Create account</button>
</form>
```

- **The control's attributes** are what `fieldAttributes` gives for it:
  - `autocomplete="new-password"`, not `off`. Firefox's password manager takes a text
    field with `off`, `on` or no `autocomplete` as a possible username, whether it can be
    seen or not; one with `new-password` it never takes. Chrome's password manager
    ignores `new-password` on a field that isn't a password. Bitwarden counts a text
    field with `new-password` as a password field (for show-password buttons), but fills
    only the fields it can see, and a `new-password` one only with a generated password:
    the honeypot stays empty there too.
  - No `type`, so a text field. Bitwarden takes a hidden `type="email"` or `type="tel"`
    field of the same form as the username; a hidden text field it doesn't.
  - `tabindex="-1"` and `inert`, so neither Tab nor a click nor a script can focus it.
    Chrome's autofill doesn't fill a field that can't take focus, and its password
    manager takes one as the username only when no field that can is there.
  - `aria-hidden="true"` on the control itself: Firefox's address autofill skips a field
    with it (it doesn't look at the wrapper), and 1Password asks for it on fields that
    aren't visible.
  - The opt-outs of 1Password (`data-1p-ignore`), LastPass (`data-lpignore`), Bitwarden
    (`data-bwignore`, honored only when its settings allow it) and Dashlane
    (`data-form-type="other"`).
- **Put it after the real fields, never before or between the fields of a sign-in or a
  password form.** Firefox, Chrome and Bitwarden look for the username among the text
  fields _before_ the first password field. Firefox takes the nearest one unless another
  looks like a username or an e-mail; it doesn't check whether the field can be seen.
  Bitwarden looks at hidden fields too when it offers to save a login. A form with only
  password fields (a reset form) is the worst place: a honeypot before them is the only
  candidate, most likely how the `website` field above was filled.
- **Give the real fields their `autocomplete` tokens**, so no heuristic has to guess:
  `username` or `email` on the account's e-mail, `current-password` on a sign-in
  password, `new-password` on a new one and its confirmation, and the address and name
  tokens on billing fields. In Firefox a field with `username` ends the search, and one
  with `email` wins over the nearest text field.
- **The name, id and label guess nothing an autofill could fill.** Browsers and password
  managers match words in them, in many languages, and some form fillers keep a whole
  contact card: no `name`, `email`, `email2`, `mail`, `phone`, `tel`, `mobile`, `fax`,
  `address`, `street`, `city`, `town`, `zip`, `postal`, `country`, `state`, `region`,
  `company`, `organization`, `url`, `website`, `homepage`, `link`, `user`, `login`,
  `account`, `password`, `pass`, `pin`, `otp`, `code`, `card`, `cc`, `birth`, `title` or
  `search`. Nor anything that tells a bot what it is: `hp`, `honeypot`, `trap`, `bot`,
  `spam`, `fake`, `captcha`, `hidden`, `empty`, `leave`. `fax_number`, suggested
  elsewhere, is a contact field like any other. `formCases` fails for a honeypot whose
  name has one of these words (the longer ones anywhere, as the heuristics match them:
  `velocity` has `city`); check the id with `trapNameProblem(id)` from `./testing`. Not
  the label: screen readers skip it (`aria-hidden`), and a person who sees the field
  without the CSS must read "Leave this empty", which `trapNameProblem` refuses. Autofill
  reads the label too, so keep the words of the first list out of it by hand.
- **One honeypot name per form, never a name a real field uses**, on that form or anywhere
  else on the site. Autofill and form history remember values by name: a value typed into
  a real field of the same name elsewhere is one a browser may offer here. Different names
  on each form also keep a bot from learning one name for the whole site.
- `.fv-trap` (in the generated CSS) clips it to one pixel where it stands. Not `hidden`,
  `display: none` or `type="hidden"`, which bots skip. Not `left: -9999px` either: it
  hides no better (Bitwarden treats both as hidden) and scrolls a right-to-left page
  sideways. `aria-hidden` on the wrapper keeps the label from screen readers.
- `bindForm` sends and checks its value but shows nothing about it: no message line
  (none is created inside its label), no state, no focus. A filled one stops the submit
  and calls `onInvalid` with `trap` set to its message, so the page can say "This form
  could not be sent." where it says the form's outcome (see "The binding").
  The field isn't named.
- The server's `errors` name the field that was refused. Answer a refused honeypot
  without them, so a bot isn't told which field to leave empty. And log it: a honeypot
  refuses silently, so a log is the only way to find out it refuses people. Log that it
  happened, the form, the time and the browser (user agent), not the value: it may be a
  person's saved e-mail or password. Whether it looks like an e-mail is worth keeping:
  bots write anything, autofill writes what it saved.

  ```js
  // a honeypot, or a preset of one
  const isTrap = ({ type, bases = [] }) =>
    [type, ...bases].includes('honeypot');
  const result = form.parse(body);
  if (!result.ok) {
    const trap = result.errors.find(({ field }) => isTrap(form.fields[field]));
    if (trap) {
      const value = String(body[trap.field]);
      log.warn('honeypot', {
        form: 'register',
        userAgent: request.headers['user-agent'],
        looksLikeEmail: value.includes('@'),
      });
      return reply(400, { error: 'invalid_input' });
    }
    return reply(400, { error: 'invalid_input', errors: result.errors });
  }
  ```

- `inert` keeps the control out of reach, not out of the form: a native submit and
  `new FormData(form)` still send it, so the server sees what a bot wrote into it. A
  bot that drives a real browser through clicks and keys can't fill it either, and so
  isn't caught by it; one that sets `.value` or posts the form itself is.
- Browsers without `inert` (Chrome before 102, Firefox before 112, Safari before 15.5)
  rely on the rest. What a saved password or address does to the form can't be tested
  automatically: try the form once with a password manager and saved addresses before it
  goes live.

### Field types

| Type            | Value   | Arguments (defaults)                                                            |
| --------------- | ------- | ------------------------------------------------------------------------------- |
| `text`          | string  | `min` 1, `max` 255, `chars` `'text'`, `contains`; spaces collapsed, trimmed     |
| `personName`    | string  | as `text`: `max` 100, `chars` `'name'`, `contains` a letter                     |
| `place`         | string  | as `text`: `max` 100, `chars` `'place'`, `contains` a letter                    |
| `streetAddress` | string  | as `text`: `min` 3, `chars` `'address'`, `contains` a letter or digit ("1-2-3") |
| `multiline`     | string  | `min` 1, `max` 5000, `chars` `'multiline'`, `contains`, `maxLines`              |
| `select`        | string  | `options`: values, or `{ value, label }`                                        |
| `choice`        | string  | `options`, for radio groups                                                     |
| `checkbox`      | boolean | none; required means it must be ticked                                          |
| `email`         | string  | `min` 1, `max` 254; trimmed, lower-cased                                        |
| `password`      | string  | `min` 8, `max` 128; never trimmed                                               |
| `confirm`       | string  | `of`: the field to match, default `'password'`; compared as that field reads it |
| `vatNumber`     | string  | `country`: ISO 3166-1 alpha-2 (`BG`) or ''; upper-cased, prefixed               |
| `code`          | string  | `min` 1, `max` 64, `chars` `'code'`, `upper` false; trimmed                     |
| `integer`       | number  | `min`, `max` (any safe integer); from a number or digits; empty: `undefined`    |
| `honeypot`      | string  | none; refuses anything filled in; always ''; not required                       |

Lengths count code points, so an emoji counts once. Character sets (`chars`): `text`,
`multiline`, `name`, `place`, `address`, `digits`, `alnum`, `code`. `text` and `multiline` take any
printable character; `digits`, `alnum` and `code` are ASCII only. Kinds for `contains`: `letter`, `digit`,
`letterOrDigit`. `maxLines` limits a `multiline` to that many lines.

A required `integer` without `when` is typed `number` in the parsed values; one with
`required: false`, a function for `required`, or `when` is `number | undefined`, as it
can be empty or inactive. A `preset` of `integer` is `number | undefined` either way.

`code({ upper: true })` checks and stores the value in upper case, but the functions of
the other fields, its own `rule` and a `confirm` of it see it as typed.

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

### Stages and messages

A value goes through these stages, and the first that fails gives the message and the
`stage` of the error:

| Stage      | Fails when                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `type`     | the raw value can't be read as the type's (an object, `null`: only a hostile client)                                              |
| `length`   | far over `max` (more than 4 times, in UTF-16 units), before anything is normalized                                                |
| `required` | the field is required and empty                                                                                                   |
| `chars`    | a character is not in the set; the message names it                                                                               |
| `length`   | fewer than `min` or more than `max` code points                                                                                   |
| `contains` | the value has no character of the kind asked for                                                                                  |
| `lines`    | a `multiline` has more than `maxLines` lines                                                                                      |
| `pattern`  | the value doesn't have the type's shape (`email`, `vatNumber`, `integer`)                                                         |
| `rule`     | the type's own check (`select`, `confirm`, `integer`'s range, `vatNumber`'s country and prefix, `honeypot`) or the field's `rule` |
| `gate`     | one of the field's gates refused it (below)                                                                                       |

A type lists its own stages in its own order. Each has a default message in English,
plain text (it goes into `textContent`). Replace one per field with `messages`, by stage
name, as a string or as a function of the stage's details (`min`, `max`, `count`, `char`…):

```js
text({
  max: 100,
  messages: {
    required: 'Enter your city.',
    length: ({ max, count }) => `At most ${max} characters, not ${count}.`,
  },
});
```

A problem is `incomplete` when typing more could still fix it (too short, a shape not
finished, the start of a password being retyped). The browser shows it as a hint while the
user types and as an error once the field is left; a problem typing can't fix (a character
that isn't allowed, too long) is an error at once. `timing` (below) decides when an
incomplete one turns red.

A field whose `when` is false is inactive: not checked, hidden by the binding, and its
value in `values` is the type's empty value (`''`, `false`, `undefined`).

### The binding

`bindForm(form, schema, options)` takes `timing`, `pause` (1000 ms), `gates`, `checking`,
`onSubmit` and `onInvalid`. `onSubmit(values, event)` gets the parsed values of a valid form
(the native submit is prevented); without it a valid form submits natively.

In every timing a field is checked on each keystroke: it turns green as soon as it is valid,
a problem typing can't fix is red at once, and a field that has been red updates live.
`timing` is when an unfinished value (too short, a shape not complete) turns red:

- `'pause'` (the default): when the user stops typing for `pause` ms, or leaves the field;
- `'leave'`: when the field is left;
- `'input'`: at once, on every keystroke.

Until then it shows a hint that says what is still missing.

`onInvalid(blocked, event)` is called when a submit is blocked, after the fields show
their messages and the first refused one has focus (also when gates refuse after the
submit waited for them; `validate()` doesn't call it). It is for the form-level word:
the refused field reads its own message, so the page needn't repeat it.

- `blocked.errors`: the refused fields people see, in schema order, `{ field, message }`
  with the message each shows (a server's message still shown, too); then a required
  field the page has no control for, if any (also reported with `console.error`).
- `blocked.trap`: set when a honeypot was filled, to its message from the schema ("This
  form could not be sent.", or its `messages.rule`). The honeypot is never in `errors`
  and isn't named, so nothing in the page points at it.

```js
bindForm(formElement, register, {
  onSubmit: (values) => send(values),
  onInvalid: ({ errors, trap }) => {
    if (trap)
      status.textContent = trap; // nothing to fix that people can see
    else if (errors.length > 1)
      status.textContent = 'Please check the marked fields.';
  },
});
```

It returns:

| Method             | Does                                                      |
| ------------------ | --------------------------------------------------------- |
| `validate()`       | checks everything, shows every problem, focuses the first |
| `validateAsync()`  | the same, after waiting for the gates                     |
| `values()`         | the raw values, as a native submit sends them             |
| `showErrors(errs)` | shows `{ field, message }` errors (the server's) in place |
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

What `defineType` takes:

| Property    | Holds                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------- |
| `name`      | the type's name (the `type` of its fields)                                                   |
| `defaults`  | every argument of the type with its default (`{ min: 1, max: 255 }`)                         |
| `stages`    | the checks after `required`, in order: `{ name, check(value, args, values, fields?) }`       |
| `examples`  | `(args) => { valid, invalid: [{ value, stage }], values? }`: what `typeContract` runs        |
| `normalize` | applied before every check; the server keeps the normalized value                            |
| `read`      | raw value (form data, JSON) to a string; `undefined` fails at `type`                         |
| `value`     | the normalized string to the field's value (`integer`: a number)                             |
| `finish`    | a last touch on a valid string, with the arguments (`vatNumber` adds the prefix)             |
| `messages`  | the type's own default messages by stage (`checkbox`: "Please tick this box.")               |
| `hint`      | `(args) => text`, shown while the field is focused and empty                                 |
| `required`  | the default of its fields' `required`, as `honeypot` sets `false`; a preset of it keeps that |

A stage's `check` returns `undefined` when the value passes, or `{ message, details?,
incomplete? }`. The shared stages are exported: `chars` (and `charsStage` for a set of
your own), `length`, `contains`, `pattern(regex, message)`, and `plural` for messages.

`preset` makes a type from another with other defaults, the way `place` is made from
`text`:

```js
import { preset, text } from '@mmutils/form-validation';

export const zipCode = preset(text, {
  name: 'zipCode',
  defaults: { chars: 'digits', min: 4, max: 10 },
});
```

`formCases` does the same for a whole form. A form is ready for commit when they pass:
the sample parses and parses again to the same values; each field's type examples, with
that field's arguments, pass or fail as they say; a required field emptied fails at
`required` and an optional one passes; inactive fields are ignored; wrong raw types fail
cleanly; unknown keys don't reach the values; a honeypot's name has no word autofill
matches (`trapNameProblem`). Gates don't run.

```js
import { formCases } from '@mmutils/form-validation/testing';

for (const c of formCases(register, {
  // a value for every active field: '' for an optional one left empty
  valid: {
    email: 'ana@example.com',
    password: 'long enough',
    passwordConfirm: 'long enough',
    consent: true,
  },
  invalid: { email: ['ana@example'] }, // more values a field must refuse
}))
  test(c.name, c.run);
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
  and doesn't count. `.for(caller)` keeps one limit per caller on a server. Defaults:
  3 checks, a 30 s cooldown, answers remembered for an hour. `maxEntries` (10,000)
  bounds the memory, `message(seconds)` words the refusal.
- `remoteGate(url, options)` is a browser gate that POSTs `{ value }` as JSON to your
  server and reads `{ "message": string | null, "retryAfter"?: ms }` back. A network
  error, a non-2xx answer or no answer within `timeout` (15 s) leaves the field
  neutral: the server decides at submit, and a server that hangs can't hold the submit
  for good. `options` are those of `limitChecks`, `body(value, context)` for what to
  send, `timeout` and `fetch`. It includes `limitChecks`.

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
| Options           | `free`, `cooldown`, `timeout`            | `free`, `cooldown`, `perMinute`, `timeout`         |
| Waits             | 15 s, then no verdict                    | 10 s for VIES, then "VIES is down"                 |
| Same number again | from memory, for an hour                 | from memory, for a day (`remember`)                |
| Over the limit    | "Try again in 25 s", then asks by itself | refuses the form: never saved unchecked            |
| VIES is down      | shows the server's answer                | refuses, "try again" (or `acceptWhenDown`)         |

`country` must give an ISO 3166-1 alpha-2 code in capitals (`BG`; `GR` for Greece, `GB`
for the United Kingdom), or '' when none is chosen, which checks the number as one from
outside the EU. Anything else (a name like `Bulgaria`, `bg`, the EU's own `EL` or `UK`,
a lookup that found nothing) refuses the field at `rule`: "The country must be an ISO
3166-1 code, like BG.". That is a mistake in the form, not the visitor's, and it shows
instead of skipping VIES without a word. If your select holds names or ids, map them to
codes in the function.

`vatGate({ url })` asks `/api/vat-check` unless you say otherwise. Its `timeout` (15 s)
is longer than `viesGate`'s (10 s), so a slow VIES comes back as the server's answer.
`viesGate` also takes `invalid` and `unavailable` (the two messages) and `url`
(`VIES_URL`).

The caller (`req.ip` above) is what the per-caller limit counts, so make it something
the client can't choose: the socket address, or the address set by a proxy you run
(with Express, `trust proxy` naming that proxy, not `true`). A client that picks its
own key, such as a made-up `X-Forwarded-For`, has no limit, and long keys cost memory.
Count IPv6 clients by their /64 prefix: one machine often has a whole /64.

Numbers outside the EU pass, as VIES doesn't know them. Only VIES's verdicts count:
an answer like `MS_UNAVAILABLE`, `TIMEOUT` or `MS_MAX_CONCURRENT_REQ` is "VIES is
down", never remembered. VIES is often down for one country or another, and the 120
checks a minute in all, which keep your server in good standing with VIES, are shared:
a dozen callers with 10 new numbers each use them up, and everyone else hears "try
again" for the rest of the minute. For a checkout, take the order anyway and check the
number later:

```js
const vies = viesGate({ acceptWhenDown: (number) => queue(number) });
```

A "not registered" answer is remembered for a day for everyone, so a number registered
this morning may be refused until tomorrow. Lower `remember` if that matters.

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

To keep the package out of the first page load, bind on the first sign of use. A submit
that comes before the binding waits for it and then goes through it, so the form never
submits unchecked:

```js
export function lateForm(form, loadSchema, onSubmit) {
  let binding;
  let held = false; // one held submit, however often it is clicked
  const bound = () => {
    if (binding) return binding;
    const loading = Promise.all([
      import('@mmutils/form-validation/dom'),
      loadSchema(),
    ]).then(([{ bindForm }, schema]) => {
      form.removeEventListener('submit', early);
      return bindForm(form, schema, { onSubmit });
    });
    // once per load: the next use tries again
    loading.catch(() => {
      if (binding === loading) binding = undefined;
    });
    return (binding = loading);
  };
  function early(event) {
    event.preventDefault();
    if (held) return;
    held = true;
    bound().then(
      () => form.requestSubmit(event.submitter),
      () => {
        held = false; // and say in the page that the form could not load
      }
    );
  }
  form.addEventListener('submit', early);
  for (const type of ['focusin', 'pointerdown'])
    form.addEventListener(type, () => bound().catch(() => {}), {
      passive: true,
    });
  if (form.contains(document.activeElement)) bound().catch(() => {});
  return {
    showErrors: (errors) => bound().then((bound) => bound.showErrors(errors)),
  };
}
```

The listeners are not `{ once: true }`, so a load that failed is tried again on the next
focus or press; a held submit is sent once.

## Good to know

**On the server**

- Put a body limit in front of `parse`. Checks stay fast on hostile values, but
  they still read what they are given.
- A value more than 4 times over `max` (in UTF-16 units) fails at `length` before
  it is normalized, so one padded with thousands of spaces is refused, also in an
  optional field. Real text at `max` stays under the limit.
- `vatNumber`, `integer`, `select` and `confirm` have no `length` stage (an
  `integer`'s `max` bounds the number, not the text). Their checks take time in
  proportion to the value, so the body limit is what bounds them.
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
- A `honeypot` field has no state and no message line; filled, it stops the submit and
  calls `onInvalid` with `trap` (see "A honeypot").
- A message line keeps the height of `--fv-message-lines` lines (default 1): a message
  that fits moves nothing; a longer one grows the line and pushes what follows down,
  and a long word wraps rather than overflow.
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

The designer and the example forms are in the repository, not in the npm package. Clone
it and run:

```sh
git clone https://github.com/mastermind-0xff/mm-form-validation.git
cd mm-form-validation
npm install
npm run examples
```

It builds the package and serves http://localhost:5178/examples/: four real forms
(sign-in, register, billing with company fields and a VAT number shaped by the
country, contact), a server that checks the same schemas, and a panel to design
how the fields look.

- **Design:** one of five looks (edge, underline, outline, icon, filled), spacing,
  text, light and dark colors, the submit button (`class="fv-submit"`), motion, and
  when an unfinished value turns red. The forms use the CSS that gets exported, so
  what you see is what you get. A control the chosen look doesn't use is dimmed, and
  its token is left out of the CSS.
- **Export:** an agent brief (one Markdown file with the settings, the CSS, the
  markup and how to check the result, so an agent in another project needs nothing
  else), the settings as JSON with only what differs from the defaults, the CSS with
  only those changes, the whole stylesheet, and the block for `<head>`.
- **Import:** paste or load the settings or a saved brief to carry on where you
  left off.

The server is for your own machine only: it doesn't check `Host` or `Content-Type`, so
a web page you visit meanwhile can post to it. Unless you are testing VIES itself, set
`VIES_STUB=1` in the environment (`VIES_STUB=1 npm run examples`): the VAT check then
answers from a stub, where a number ending in `00` is not registered and one ending in
`99` finds VIES down, and never asks the real VIES.

### Only the changes

The package ships a stylesheet per look, with the default settings (dark colors apply
under `<html data-scheme="dark">`). Link it, and add what you exported, in any order:

```html
<link rel="stylesheet" href="/css/edge.css" />
<link rel="stylesheet" href="/css/form-fields.changes.css" />
```

Here `/css/edge.css` is `node_modules/@mmutils/form-validation/dist/looks/edge.css`,
copied or served by your build; `import '@mmutils/form-validation/looks/edge.css'` works
in a bundler that handles CSS.

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

For the edge look these come to about 0.7, 1.1 and 1.5 KB gzipped, against 2.3 KB
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

## Development

```sh
npm install
npm run check          # prettier, eslint, tsc, vitest
npm run build          # dist/esm, dist/cjs, dist/types, dist/looks
npm run coverage       # coverage of src
npm run examples       # the look designer and the example forms
npm run test:browsers  # Playwright: Chromium, Firefox, WebKit (long; install once with npx playwright install)
```

## AI use

@mmutils/form-validation is developed with AI assistance: most of the code, tests and
documentation was written with AI. The author designs the features, makes the decisions
and reviews the changes, and every change passes the same checks (formatting, lint,
strict type checking and tests) before it is committed.

## License

[MIT](LICENSE)
