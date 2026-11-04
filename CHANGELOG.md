# Changelog

## 0.1.0 (unreleased)

Nothing released yet. The plan is in `.claude/plan.md` (local).

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
- `examples/`: four forms, five looks, a server running the same schemas
  (`npm run examples`).
- Limits on hostile values, on both sides: a value more than 4 times over `max`
  fails at `length` before it is normalized, and 31 or more combining marks in a
  row are refused at `chars`.
- Free text and e-mail refuse what can't be seen: format characters (the joiners
  U+200C and U+200D stay, except in `email`), surrogates without a pair, private
  use, noncharacters, Hangul fillers, blank Braille. `email` also refuses `:`.
