# Changelog

## Unreleased

First public release. The package was developed in a private repository and used in
one project before this; version 0.0.0 was never published, so nothing below changes
a release you could have installed.

### Core

- `defineType`, `preset`, `defineForm` (`parse`, `check`, `view`). A field is a type
  with its arguments and the options `required`, `when`, `messages`, `hint`, `rule` and
  `gates`; any argument, and `required`, can be a function of the other values.
- Checks run in stages (`type`, `required`, `chars`, `length`, `contains`, `lines`,
  `pattern`, `rule`, `gate`); the first failure gives the message. A problem is
  `incomplete` when typing more could still fix it (too short, a shape not finished).
- Optional means "empty is valid": anything typed into an optional field goes through
  every stage.
- Inactive fields (`when` false) get the type's empty value in the parsed values, so
  they are complete and typed.
- `confirm` compares like with like in a form: the retyped value as the field in `of`
  reads it, so "Ana@x.com" confirms an e-mail stored as "ana@x.com", while a password
  must still match exactly. For that, `Field.check` and a stage's `check` get the
  form's fields as an optional last argument.
- A type may set the default of `required` (`TypeSpec.required`). Fields have `bases`:
  the types a preset was made from, nearest first.
- Character sets (`text`, `multiline`, `name`, `place`, `address`, `digits`, `alnum`,
  `code`), Unicode aware and valid with the `v` flag, so they can go into an HTML
  `pattern`. `contains` asks for a `letter`, a `digit` or a `letterOrDigit`.
- Names and places accept `´` and `` ` `` as people type an apostrophe (Sant´Angelo),
  and Japanese and Chinese punctuation: `・` `·`; `（` `）` `，` `、` in places; `〒` `−`
  `－` in addresses.
- Limits on hostile values, on both sides: a value more than 4 times over `max` fails at
  `length` before it is normalized, and 31 or more combining marks in a row are refused
  at `chars`.
- Free text and e-mail refuse what can't be seen: format characters (the joiners U+200C
  and U+200D stay, except in `email`), surrogates without a pair, private use,
  noncharacters, Hangul fillers, blank Braille. `email` also refuses `:`.

### Field types

- `text`, `personName`, `place`, `streetAddress` (a letter or a digit: "1-2-3" passes,
  "---" doesn't), `multiline`, `select`, `choice`, `checkbox`, `email`, `password`,
  `confirm`, `vatNumber`, `code`, `integer`, `honeypot`.
- `select` options take numbers, like database ids. The value is still a string.
- `vatNumber`: EU formats by country, the shape still missing while typing. Anything but
  a plain run of digits shows its masks and what they mean: "NLXXXXXXXXXBXX (X = digit)".
  A `country` that is neither '' nor an ISO 3166-1 alpha-2 code in capitals ("BG"; "GR"
  for Greece, not the EU's "EL"; "GB", not "UK") is refused at `rule`: "The country must
  be an ISO 3166-1 code, like BG.". It is a mistake in the form, not the visitor's, and
  it shows instead of skipping the VIES check without a word.
- `code`: discount codes, tokens. Trimmed, the case kept unless `upper`, which checks
  `chars` and `length` on the upper-cased value ("ßßß" is "SSSSSS").
- `integer`: a whole number between `min` and `max`, from a number or digits. Out of
  range is `incomplete` while more digits could still bring it in ("2" on the way to
  "25"); the message names only the bounds given; "-0" is 0. The value is
  `number | undefined`: empty and optional gives `undefined`, never 0. A required one
  that is always active is typed `number` (`ValueOf`, `ValuesOf`, `onSubmit`); with
  `required: false`, a function or `when` it stays `number | undefined`. `Field` has a
  third type parameter (what a valid parse gives), `integer` is an `IntegerType` with
  two overloads, `ParsedValue` is exported. A `preset` of `integer` stays
  `number | undefined`.
- `honeypot`: a field people don't see. Anything filled in (any string, spaces too, a
  number, `true`) is refused at `rule` with "This form could not be sent.", which
  doesn't say why; an object, an array or `null` fails at `type`. Its value is always
  ''. Optional by default, and so is a preset of it.
- The examples of `personName`, `place` and `streetAddress` keep only the samples that
  still hold with the field's own `chars` and `contains`.

### Gates

- `gates` on any field: functions, or names each side implements, run one after another
  after the stages (stage `gate`). `parseAsync(form, body, { gates })` on the server;
  `form.parse` throws on a form with gates.
- New entry `./gates`: `limitChecks` (the first few checks, then a cooldown; answers
  remembered; one limit per caller with `.for`), `remoteGate`, and the VAT check
  against VIES: `viesGate`, `answerVatCheck`, `vatGate`.

### Browser binding (`./dom`)

- `bindForm` checks a form while the user types, with the timings `leave`, `pause`
  (the default) and `input`. It reads a form as a native submit sends it
  (`new FormData(form)`), picks up a field that already has focus when it loads late,
  and sets attributes only: `data-state`, `data-message`, `required`, `aria-invalid`,
  `hidden`.
- Options `gates` (a name the page doesn't provide is left to the server), `checking`
  (the hint while a gate runs, "Checking…"), `onSubmit` and `onInvalid(blocked, event)`.
  `onInvalid` is called when a submit is blocked: `blocked.errors` are the refused fields
  people see with the message each shows; `blocked.trap` is set when a honeypot was
  filled, with its message, naming no field. The type `Blocked` comes from `./dom`.
- Returns `validate`, `validateAsync` (waits for the gates), `values`, `showErrors`
  (takes errors without `stage`), `reset` and `destroy`.
- A honeypot's value is in `values()` and checked, but nothing about it shows: no
  message line, no state.

### Field attributes

- `fieldAttributes(form, name, values)`: what to write on a control, from the schema, so
  markup and schema can't drift. `when`, `required` and the arguments see `values` as
  the checks do. By type and arguments: `email` `inputmode="email"` (no `type="email"`:
  render the control as `type="text"`); `password` `type="password"`; `confirm` those of
  the field in `of`; `code` `autocapitalize="characters"` only with `upper`, else
  `none`; `integer` `inputmode="numeric"` only when `min` is 0 or more; a preset its
  base type's.
- A honeypot gets `autocomplete="new-password"` (not `off`: Firefox's password manager
  takes a text field with `off` before a password field as the username, hidden or
  `inert`), `tabindex="-1"`, `inert`, `aria-hidden` and the password managers' opt-outs
  (`data-1p-ignore`, `data-lpignore`, `data-bwignore`, `data-form-type="other"`).

### Testing (`./testing`)

- `typeContract(type, optionSets)`: the cases every field type passes, built from its
  examples, for any runner (vitest, `node:test`). It reads `max` as a length only for a
  type with a `length` stage.
- `formCases(form, samples)`: the cases of a whole form. An inactive field is asked about
  alone; a field's own `rule` excuses a refused example only when it is that rule that
  refuses it.
- `trapNameProblem(name)` says why a name is a poor honeypot name (a word autofill
  matches, or one that tells a bot); `formCases` checks every honeypot's name with it,
  so a form with a honeypot named `website`, `fax_number` or `email2` fails. It splits
  names at `_`, `-`, digits and case.

### CSS and looks (`./css`)

- The look of the fields as settings: `parseLook` checks them (each value only in a
  shape that can't leave its declaration), `generateCss` makes the stylesheet and the
  block for the HTML (`none`, `layout`, `paint`, `all`), `headSnippet` the `<head>`
  markup, `agentBrief` one Markdown file for whoever applies the look to a project.
- A stylesheet per look, `looks/<look>.css`, with the default settings: `edge`,
  `underline`, `outline`, `icon`, `filled`. `lookChanges` and `generateChanges` give only
  what differs from them.
- Hooks: `.fv-field`, `.fv-box`, `.fv-message`, `.fv-options`, `.fv-option`,
  `.fv-submit`, `.fv-trap` (a honeypot's wrapper: one clipped pixel, not
  `display: none`), the `--fv-*` tokens (`--fv-message-lines`: how many lines of message
  a field reserves). The message line wraps long words, and a message longer than its
  reserved lines grows it and pushes what follows down. Inactive fields are hidden with
  `display: none !important` on `[data-field][hidden]`.
- The submit button has settings too (`.fv-submit`): color, text, hover and pressed,
  padding, corners, text size.

### Repository

- `examples/`: four forms and a server running the same schemas, with the look
  designer: five looks, every token, light and dark colors, export and import, a layout
  shift check (`npm run examples`). Not part of the npm package.
- Playwright tests in Chromium, Firefox and WebKit (`npm run test:browsers`).
