/**
 * The export for whoever applies a look to a project: one Markdown file with
 * the settings, the CSS and how to use them, so an agent needs nothing else.
 */
import { generateChanges, lookChanges, lookSheet } from './changes.js';
import { generateCss } from './generate.js';
import type { InlineLevel, LookSettings } from './settings.js';

const DEFAULT_HREF = '/css/form-fields.css';

/** What each level means, for the designer page and the brief. */
export const INLINE_NOTES: Readonly<Record<InlineLevel, string>> = {
  none: 'Nothing is inlined: the stylesheet must block rendering, or the form paints unstyled and moves.',
  layout:
    'The inline block holds sizes and spacing. Nothing moves when the stylesheet arrives; colors and corners change then.',
  paint:
    'The inline block holds everything the form shows before it is used. Nothing moves or flashes when the stylesheet arrives; states and animations come with it.',
  all: 'The inline block holds the whole stylesheet: for a page that is mostly a form, or a site that inlines all its CSS.',
};

/** What goes into `<head>`: the inline block, then the stylesheet if any. */
export function headSnippet(
  look: LookSettings,
  href: string = DEFAULT_HREF
): string {
  const { inline, stylesheet } = generateCss(look);
  const lines: string[] = [];
  if (inline !== '') lines.push(`<style>${inline}</style>`);
  if (stylesheet !== '')
    lines.push(
      ...(inline === '' ?
        [`<link rel="stylesheet" href="${href}" />`]
      : [
          `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'" />`,
          `<noscript><link rel="stylesheet" href="${href}" /></noscript>`,
        ])
    );
  return `${lines.join('\n')}\n`;
}

const darkNote = (look: LookSettings): string => {
  if (look.darkMode === 'none')
    return '- **Dark themes:** No dark colors were exported: the fields keep the light ones in every theme. If the site has a dark theme, check that they still read well on it.';
  if (look.darkMode === 'media')
    return '- **Dark themes:** Dark colors follow the system (`prefers-color-scheme`). Switch the system to dark and compare. A site with its own theme switch should use its selector there instead.';
  return '- **Dark themes:** Dark colors apply under `<html data-scheme="dark">`. Set that and compare. If the project marks its dark theme another way, change the selector `:root[data-scheme=\'dark\']`, wherever it appears, and nothing else.';
};

const headSection = (look: LookSettings): string =>
  look.inline === 'none' ?
    `## Head

No inline block was asked for. Link the stylesheet the normal way, so it blocks
rendering and the form never paints unstyled:

\`\`\`html
${headSnippet(look)}\`\`\`
`
  : `## Head

${INLINE_NOTES[look.inline]} Put this in the \`<head>\` of every page with a form, before
anything that could paint, and change the \`href\` to where the stylesheet went:

\`\`\`html
${headSnippet(look)}\`\`\`

An inline block only helps when the stylesheet doesn't block rendering, which is
why the link above is a preload that turns into a stylesheet. A site with a
Content Security Policy must allow the block in \`style-src\` (\`'unsafe-inline'\` or
its hash) and the \`onload\` in its script policy; if it can't, use a plain
\`<link rel="stylesheet">\` and leave the block out: that shifts nothing either, it
only paints later.
${
  look.split ?
    '\nThe stylesheet below leaves out what the block holds, so **every page that uses the stylesheet needs the block too**.\n'
  : ''
}`;

const stylesheetSection = (stylesheet: string): string =>
  stylesheet === '' ?
    `## Stylesheet

None: the head block holds everything. Remove the \`<link>\` if a template adds one.
`
  : `## Stylesheet

Save as \`form-fields.css\`.

\`\`\`css
${stylesheet}\`\`\`
`;

/** The whole brief, generated from the settings it describes. */
export function agentBrief(look: LookSettings): string {
  const { stylesheet } = generateCss(look);
  return `# Form fields: the "${look.look}" look

Exported from the look designer of \`@mmutils/form-validation\`, to apply this look
to the forms of a project. Everything needed is in this file.

## What to do

1. Get the CSS in one of two ways. **The package is installed and its stylesheet can
   be linked:** use Only the changes. **Otherwise,** or when the CSS goes into the
   HTML: copy Stylesheet as it is. Don't write it again from the settings: the rules
   depend on their order, and a slip shows up as a layout shift. If the project's
   conventions ask for something else (other class names, CSS modules, one build
   that inlines all CSS), keep the rules, their order and the token values, and
   change only what the convention needs.
2. Add the head block to the pages with a form (see Head).
3. Give each field the markup under Markup, and each submit button \`class="fv-submit"\`.
4. Bind each form with \`bindForm(form, schema, { timing: '${look.timing}', onSubmit })\` from
   \`@mmutils/form-validation/dom\`. \`timing\` was chosen together with the look: it
   says when an unfinished value turns red.
5. Go through Checks.

## Markup

\`\`\`html
<div class="fv-field" data-field="email">
  <label for="email">E-mail</label>
  <input class="fv-box" id="email" name="email" type="email" required />
  <p class="fv-message" data-message-for="email"></p>
</div>

<fieldset class="fv-field" data-field="kind">
  <legend>Billing as</legend>
  <div class="fv-options fv-box">
    <label class="fv-option"><input type="radio" name="kind" value="0" required /> A person</label>
    <label class="fv-option"><input type="radio" name="kind" value="1" required /> A company</label>
  </div>
  <p class="fv-message" data-message-for="kind"></p>
</fieldset>

<div class="fv-field" data-field="consent">
  <label class="fv-option fv-box"><input type="checkbox" name="consent" required /> I accept</label>
  <p class="fv-message" data-message-for="consent"></p>
</div>
\`\`\`

\`<select>\` and \`<textarea>\` take \`class="fv-box"\` like an input. What keeps the
page still, in the HTML the server sends and not added later by a script:

- **The message line, even when empty.** It reserves its height. A missing one is
  created by the binding, and everything below it moves.
- **\`hidden\` on the wrapper of a field that starts inactive** (\`when\` is false).
  The binding hides it only when its script runs, and no CSS can make up for that.
- **\`required\` on required controls**, so the asterisks are there from the start.
- Label, box and message as direct children of the wrapper: the rules use \`>\`.

A message longer than the reserved lines still pushes what is below it. This look
reserves ${look.tokens['message-lines']} line(s) (\`--fv-message-lines\`). In a narrow column, shorten the
message or raise that token for the column.

## Only the changes

Link \`${lookSheet(look.look)}\` and add this, in any order:

\`\`\`css
${generateChanges(look)}\`\`\`

${headSection(look)}
${stylesheetSection(stylesheet)}
## Settings

The source of everything above, with only what differs from the defaults. Keep it
next to the CSS: to change the look, import
it in the designer (\`npm run examples\` in the repository of the package, Export,
Import settings), or generate the CSS in code when the project has the package:

\`\`\`js
import { generateCss, parseLook } from '@mmutils/form-validation/css';

const result = parseLook(JSON.parse(settingsText));
if (!result.ok) throw new Error(result.errors.join('\\n'));
const { stylesheet, inline } = generateCss(result.look);
\`\`\`

\`\`\`json
${JSON.stringify(lookChanges(look), null, 2)}
\`\`\`

## Checks

- **No shift while loading:** block or delay the stylesheet (DevTools, Network) and
  load the page. The fields must sit where they sit with it. A
  \`PerformanceObserver\` on \`layout-shift\` should add up to 0 until the first input.
- **No shift while validating:** tab through an empty required field, then type a
  wrong and a right value. The message and the state color change; nothing moves.
- **The look itself:** compare a field with the settings above: the tokens are the
  \`--fv-*\` custom properties of the same names.
${darkNote(look)}
- **Budgets:** if the project has CSS budgets, check the inline block and the
  stylesheet against them.
`;
}
