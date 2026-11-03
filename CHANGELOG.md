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
- `./dom`: `bindForm` with the timings `leave`, `pause` and `input`.
- `examples/`: four forms, five looks, a server running the same schemas
  (`npm run examples`).
