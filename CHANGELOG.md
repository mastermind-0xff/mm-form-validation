# Changelog

## 0.1.0 (unreleased)

Nothing released yet. The plan is in `.claude/plan.md` (local).

Breaking for code written against the `aesweets-integration` branch (aesweets links it
locally; nothing was published):

- `fieldAttributes(form, name, values)` replaces `fieldAttributes(field, values)`.
- `integer`'s value type is `number | undefined`: empty and optional gives `undefined`,
  no longer 0. A required one without `when` is typed `number` (above).
- `honeypot` refuses a filled field (stage `rule`, "This form could not be sent.")
  instead of passing with the value `true`. Its value is always ''.
- `fieldAttributes` gives `email` no `type="email"`, only `inputmode="email"`: render
  the control as `type="text"` (the default).
- `streetAddress` needs a letter or a digit, no longer a letter: "1-2-3" passes, "---"
  doesn't.
- `vatNumber` refuses at `rule` a `country` that is neither '' nor an ISO 3166-1 alpha-2
  code in capitals ("The country must be an ISO 3166-1 code, like BG."): a name like
  `Bulgaria`, `bg`, the EU's `EL` and `UK`, or no string at all. Those used to be
  checked as outside the EU, without VIES.

New since the review of the honeypot (branch `honeypot-autofill`, aesweets D45-D47):

- A honeypot's `autocomplete` is `new-password`, no longer `off`: Firefox's password
  manager takes a text field with `off` before a password field as the username, hidden
  or `inert`; one with `new-password` it never does. Chrome ignores `new-password` on a
  field that isn't a password. Rewrite server-rendered markup (`fieldAttributes` gives it).
- `bindForm` option `onInvalid(blocked, event)`, called when a submit is blocked (also
  after gates refused): `blocked.errors` are the refused fields people see with the
  message each shows; `blocked.trap` is set when a honeypot was filled, with its own
  message ("This form could not be sent.", `messages.rule` overrides), naming no field.
  A filled honeypot no longer stops a submit without a word, for pages that listen.
  The type `Blocked` comes from `./dom`.
- A required, always active `integer` is typed `number` in the parsed values (`ValueOf`,
  `ValuesOf`, `onSubmit`); with `required: false`, a function, or `when`, it stays
  `number | undefined`. Types only: `Field` has a third parameter (what a valid parse
  gives), `integer` is an `IntegerType` with two overloads, `ParsedValue` is exported.
  A `preset` of `integer` stays `number | undefined`.
- `./testing`: `trapNameProblem(name)` says why a name is a poor honeypot name (a word
  autofill matches, or one that tells a bot); `formCases` checks every honeypot's name
  with it, so a form with a honeypot named `website`, `fax_number` or `email2` fails.
  It splits names at `_`, `-`, digits and case (`faxNumber`, `URLField`); use it on the
  id too, not on the label ("Leave this empty" is right there).
- README "A honeypot": where it goes (after the real fields, never before a password
  field), the real fields' `autocomplete` tokens, names to avoid, one name per form,
  logging refusals on the server, what the browsers and password managers do.

New since the gates:

- Types: `code` (discount codes, tokens: trimmed, the case kept unless `upper`, which
  checks `chars` and `length` on the upper-cased value: "ßßß" is "SSSSSS"); `integer` (a
  whole number between `min` and `max`, from a number or digits; out of range is
  `incomplete` while more digits could still bring it in, "2" on the way to "25"; the
  message names only the bounds given; "-0" is 0); `honeypot` (refuses anything filled
  in: any string, spaces too, a number, `true`; an object, an array or `null` fails at
  `type`; optional by default, and so is a preset of it).
- `fieldAttributes(form, name, values)`: what to write on a control, from the schema.
  `when`, `required` and the arguments see `values` as the checks do (`form.view`). By
  type and arguments: `email` `inputmode="email"`; `password` `type="password"`;
  `confirm` those of the field in `of`; `code` `autocapitalize="characters"` only with
  `upper` (else `none`); `integer` `inputmode="numeric"` only when `min` is 0 or more;
  a preset its base type's; a honeypot `autocomplete="new-password"`, `tabindex="-1"`, `inert`,
  `aria-hidden` and the password managers' opt-outs (`data-1p-ignore`,
  `data-lpignore`, `data-bwignore`, `data-form-type="other"`).
- `confirm` compares like with like in a form: the retyped value as the field in `of`
  reads it, so "Ana@x.com" confirms an e-mail stored as "ana@x.com", while a password
  must still match exactly. For that, `Field.check` and a stage's `check` get the
  form's fields as an optional last argument.
- A type may set the default of `required` (`TypeSpec.required`). Fields have `bases`:
  the types a preset was made from, nearest first (optional, so a field from an older
  copy still binds).
- `contains: 'letterOrDigit'`.
- `./testing`: `formCases(form, samples)`, the cases of a whole form (an inactive field
  is asked about alone; a field's own `rule` excuses a refused example only when it is
  that rule that refuses it). `typeContract` reads `max` as a length only for a type
  with a `length` stage, and takes an empty result for a valid example of '' or `false`
  in an optional field.
- `bindForm` keeps a honeypot's value in `values()` and checks it, but shows nothing
  about it: no message line, no state; a filled one stops the submit (and calls
  `onInvalid`, above).
  `showErrors` takes errors without `stage`.
- The generated CSS: `.fv-trap` for a honeypot's wrapper (one clipped pixel, not
  `display: none`); the message line wraps long words (`overflow-wrap: anywhere`), and a
  message longer than its reserved lines grows it and pushes what follows down.
- `name`, `place` and `address` accept `´` and `` ` ``, as people type an apostrophe
  (Sant´Angelo, L`Aquila).
- The examples of `personName`, `place` and `streetAddress` keep only the samples that
  still hold with the field's own `chars` and `contains`.

- Gates: `gates` on any field, functions or names each side implements, run one
  after another after the stages (stage `gate`). `parseAsync(form, body, { gates })`
  on the server; `form.parse` throws on a form with gates. In `bindForm`: the option
  `gates`, a "Checking…" hint, `validateAsync`, submit waits for them.
- New entry `./gates`: `limitChecks` (first few checks, then a cooldown; answers
  remembered), `remoteGate`, and the VAT check against VIES: `viesGate`,
  `answerVatCheck`, `vatGate`.
- `bindForm` and the designer now default to `timing: 'pause'`.
- VAT messages: anything but a plain run of digits shows its masks and what they
  mean: "NLXXXXXXXXXBXX (X = digit)".
- Names and addresses accept Japanese and Chinese punctuation: `・` `·`; `（` `）` `，`
  `、` in places; `〒` `−` `－` in addresses.
- `select` options take numbers, like database ids. The value is still a string.
- The designer has settings for the submit button (`.fv-submit`): color, text, hover
  and pressed, padding, corners, text size.
- The package ships `looks/<look>.css` with the default settings. The designer
  exports only what differs from them: settings (`lookChanges`) and CSS
  (`generateChanges`).
- Inactive fields are hidden with `display: none !important` on `[data-field][hidden]`
  too, so no `display` on a wrapper can show them.

- Core: `defineType`, `preset`, `defineForm` (`parse`, `check`, `view`),
  results in stages (`type`, `required`, `chars`, `length`, `contains`,
  `pattern`, `rule`), `incomplete` problems for hints while typing, per-field
  `required`, `when`, `messages`, `hint`, `rule`, arguments as functions of
  the other values.
- Character sets (`text`, `multiline`, `name`, `place`, `address`, `digits`,
  `alnum`, `code`), Unicode aware, valid with the `v` flag.
- Types: `text`, `personName`, `place`, `streetAddress`, `multiline`,
  `select`, `choice`, `checkbox`, `email`, `password`, `confirm`,
  `vatNumber` (EU formats by country, the shape still missing while typing).
- `./testing`: `typeContract`, runner-agnostic.
- `./dom`: `bindForm` with the timings `leave`, `pause` and `input`. It reads a
  form as a native submit sends it (`new FormData(form)`), and picks up a field
  that already has focus when it loads late.
- `./css`: the look of the fields as settings. `parseLook` checks them,
  `generateCss` makes the stylesheet and the block for the HTML (`none`, `layout`,
  `paint`, `all`), `headSnippet` the `<head>` markup, `agentBrief` one Markdown file
  for whoever applies the look to a project.
- `examples/`: four forms and a server running the same schemas, with the look
  designer: five looks, every token, light and dark colors, export and import, a
  layout shift check (`npm run examples`). Its CSS comes from `./css`.
- A new token, `--fv-message-lines`: how many lines of message each field reserves.
- Limits on hostile values, on both sides: a value more than 4 times over `max`
  fails at `length` before it is normalized, and 31 or more combining marks in a
  row are refused at `chars`.
- Free text and e-mail refuse what can't be seen: format characters (the joiners
  U+200C and U+200D stay, except in `email`), surrogates without a pair, private
  use, noncharacters, Hangul fillers, blank Braille. `email` also refuses `:`.
