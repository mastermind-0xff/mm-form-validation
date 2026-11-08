# Changelog

## 0.1.0 (unreleased)

Nothing released yet. The plan is in `.claude/plan.md` (local).

Fixes from the aesweets review (2026-11-08):

- `honeypot` refuses a filled field (any string, spaces too, a number, `true`) at
  `rule` with "This form could not be sent."; an object, an array or `null` fails at
  `type`. Its value is always '' (was `true` when filled, never refused).
  `fieldAttributes` gives it `autocomplete="off"`, `tabindex="-1"`, `inert`,
  `aria-hidden` and the password managers' opt-outs (`data-1p-ignore`,
  `data-lpignore`, `data-bwignore`, `data-form-type="other"`); the generated CSS has
  `.fv-trap` for its wrapper. `bindForm` sends and checks it but creates no message
  line inside its label and shows no state.
- `fieldAttributes(form, name, values)` replaces `fieldAttributes(field, values)`:
  `when` and `required` run on `form.view(values)`, as the checks see them. The
  attributes follow the field's arguments: `confirm` gets those of the field in `of`,
  `code` gets `autocapitalize="characters"` only with `upper` (else `none`),
  `integer` gets `inputmode="numeric"` only when `min` is 0 or more. A preset gets its
  base type's. `email` no longer gets `type="email"` (the browser's own e-mail rules),
  only `inputmode="email"`.
- Fields have `bases`: the types a preset was made from, nearest first.
- `integer`: empty and optional gives `undefined`, not 0 (the value type is
  `number | undefined`). Out of range is `incomplete` while more digits could still
  bring it into range ("2" on the way to "25"). The message names only the bounds
  given: "Enter a number of at least 1.", "Enter a number of at most 9.".
- `code({ upper: true })` checks `chars` and `length` on the upper-cased value
  ("ßßß" is "SSSSSS").
- `vatNumber` refuses at `rule` a `country` that is neither '' nor two capital
  letters (ISO 3166-1 alpha-2): "The country must be an ISO 3166-1 code, like BG.".
  Names and lower case used to count as outside the EU.
- `streetAddress` no longer needs a letter: Japanese lines are often "1-2-3".
  `personName`, `place` and `streetAddress` keep only the examples that hold with the
  field's own `chars` and `contains`.
- `formCases`: "inactive in this sample" asks only about that field (junk in it may
  switch on another field that reads it); a field's own `rule` excuses a refused
  example only when it is that rule that refuses it. `typeContract` takes an empty
  result for a valid example of an optional field (`honeypot`).
- `showErrors` takes errors without `stage`.
- The message line wraps long words (`overflow-wrap: anywhere`).

- New types: `code` (discount codes, tokens: trimmed, keeps the case unless `upper`),
  `integer` (a number between `min` and `max`), `honeypot` (never refuses: the value
  says whether a bot filled it).
- `fieldAttributes(field, values)`: what to write on a control, from the schema.
- `./testing`: `formCases(form, samples)`, the cases of a whole form.
- `typeContract` reads `max` as a length only for a type with a `length` stage.
- `name`, `place` and `address` accept `´` and `` ` ``, as people type an apostrophe
  (Sant´Angelo, L`Aquila).

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
