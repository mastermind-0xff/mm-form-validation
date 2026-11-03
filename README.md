# @mmutils/form-validation

One field schema for the browser and the server. A form is a list of typed
fields (`text`, `multiline`, `select`, `email`, …) with their own arguments
(length, allowed characters, options). The same code checks a value while the
user types and again when the server receives it, so a value the form accepts
is never refused by the server, and the other way round.

- Checks run in stages: required, length, characters, shape, then the type's
  own rule. Each stage has its own message, so the field can say what is
  still wrong while the user types.
- Optional fields are checked like required ones as soon as they hold a
  value; left empty, they are valid.
- New field types are small objects: a normalizer, the stages and examples of
  valid and invalid values.
- Every form gets generated test cases from those examples: a form is ready
  when all of them pass.

Work in progress: nothing is published yet.

## License

MIT
