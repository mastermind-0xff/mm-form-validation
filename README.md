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
gives the look. Make that CSS in the look designer below, or write your own.

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
  text, light and dark colors, motion, and when an unfinished value turns red. The
  forms use the CSS that gets exported, so what you see is what you get. A control
  the chosen look doesn't use is dimmed, and its token is left out of the CSS.
- **Export:** an agent brief (one Markdown file with the settings, the CSS, the
  markup and how to check the result, so an agent in another project needs nothing
  else), the settings as JSON, the stylesheet, and the block for `<head>`.
- **Import:** paste or load the settings or a saved brief to carry on where you
  left off.

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
  generateCss,
  headSnippet,
  parseLook,
} from '@mmutils/form-validation/css';

const result = parseLook(JSON.parse(settingsText)); // missing values get defaults
if (!result.ok) throw new Error(result.errors.join('\n'));

const { stylesheet, inline } = generateCss(result.look);
const head = headSnippet(result.look, '/css/form-fields.css');
const brief = agentBrief(result.look);
```

The output goes into a `<style>`, so `parseLook` accepts each value only in a shape
that can't leave its declaration, and `generateCss` refuses anything else.

## License

MIT
