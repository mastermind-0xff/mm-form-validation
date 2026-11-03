# @mmutils/form-validation

One field schema for the browser and the server. A form is a list of typed
fields (`text`, `multiline`, `select`, `email`, …) with their own arguments
(length, allowed characters, options). The same code checks a value while the
user types and again when the server receives it, so a value the form accepts
is never refused by the server, and the other way round.

- Checks run in stages: required, characters, length, shape, then the type's
  own rule. Each stage has its own message, so the field can say what is
  still wrong while the user types.
- Optional fields are checked like required ones as soon as they hold a
  value; left empty, they are valid.
- New field types are small objects: a normalizer, the stages and examples of
  valid and invalid values.
- Every type passes the same contract built from its examples.

Work in progress: nothing is published yet.

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
gives the look. `examples/css` has the structure and five looks driven by
`--fv-*` custom properties.

## Examples

```sh
npm run examples
```

Builds the package and serves `examples/` at http://localhost:5178/examples/:
sign-in, register, billing (company fields, a VAT number shaped by the
country) and contact forms, with a switch for the look, the timing of errors
and the scheme, and a server that checks the same schemas.

## License

MIT
