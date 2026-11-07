# Changelog

## 0.1.0 (unreleased)

Nothing released yet. The plan is in `.claude/plan.md` (local).

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
