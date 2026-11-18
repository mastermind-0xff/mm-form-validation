/**
 * Only the changes: the shipped `dist/looks/<look>.css` plus the
 * exported changes, in either order, must give every field in every state the same
 * computed style as the "Whole stylesheet" export. A difference is a bug.
 */
import { expect, pick, settleAnimations, test } from './helpers.js';

const LOOKS = ['edge', 'underline', 'outline', 'icon', 'filled'];

// a trace records every snapshot of these pages: minutes per test
test.use({ trace: 'off' });

/** Everything changed: tokens, light colors, dark colors, the speed. */
const manyChanges = {
  tokens: {
    'pad-x': '20px',
    'pad-y': '13px',
    border: '2px',
    edge: '10px',
    radius: '9px',
    gap: '8px',
    font: 'Georgia, serif',
    'label-size': '1rem',
    'message-size': '0.875rem',
    'message-line': '1.6',
    'message-lines': '2',
    'button-pad-x': '22px',
    'button-pad-y': '12px',
    'button-radius': '14px',
    'button-size': '1.0625rem',
    speed: '450ms',
    ease: 'ease-out',
  },
  colors: {
    light: {
      text: '#101820',
      bg: '#fffaf0',
      fill: '#eef0d0',
      line: '#a0a8b0',
      'line-strong': '#405060',
      hint: '#556677',
      valid: '#118844',
      invalid: '#cc2200',
      'invalid-text': '#aa1100',
      required: '#bb3300',
      button: '#223344',
      'button-text': '#fefefe',
      'button-hover': '#334455',
    },
    dark: {
      text: '#f0f0e0',
      bg: '#101418',
      fill: '#202830',
      line: '#505860',
      'line-strong': '#b0b8c0',
      hint: '#a0a090',
      valid: '#33dd88',
      invalid: '#ff5544',
      'invalid-text': '#ff9988',
      required: '#ffaa99',
      button: '#ddeeff',
      'button-text': '#112233',
      'button-hover': '#eef4ff',
    },
  },
};

/**
 * The awkward ones. Dark equal to light where the shipped dark differs, so the
 * whole sheet has no dark value for them; a light color set to the shipped dark
 * one, dropped as "same as light" by the generator; the speed left alone.
 */
const awkward = {
  tokens: { 'message-lines': '3', border: '3px', edge: '4px' },
  colors: {
    light: {
      'line-strong': '#9aa1ad', // the shipped dark value
      text: '#e6e8eb', // the shipped dark value
      invalid: '#123456',
      valid: '#2ddb94',
    },
    dark: {
      'line-strong': '#9aa1ad',
      text: '#e6e8eb',
      invalid: '#123456', // as light: no dark value in the whole sheet
      hint: '#5f6672', // the shipped light value
    },
  },
};

const DESIGNS = { manyChanges, awkward };

const MODES = {
  light: { darkMode: 'attribute' },
  'light, system dark': { darkMode: 'attribute', colorScheme: 'dark' },
  'dark via data-scheme': { darkMode: 'attribute', scheme: 'dark' },
  'dark via system': { darkMode: 'media', colorScheme: 'dark' },
  'media, system light': { darkMode: 'media', colorScheme: 'light' },
  'reduced motion': { darkMode: 'attribute', reducedMotion: 'reduce' },
  'reduced motion, dark via data-scheme': {
    darkMode: 'attribute',
    scheme: 'dark',
    reducedMotion: 'reduce',
  },
  'reduced motion, dark via system': {
    darkMode: 'media',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  },
  'no dark colors, data-scheme dark': { darkMode: 'none', scheme: 'dark' },
  'no dark colors, system dark': { darkMode: 'none', colorScheme: 'dark' },
};

/** Every state a field can be in, for each kind of control. */
const STATES = [
  ['neutral', ''],
  ['valid', 'data-state="valid"'],
  ['invalid', 'data-state="invalid" data-message="error"'],
  ['hint', 'data-message="hint"'],
];

const fieldsMarkup = STATES.map(
  ([name, attributes], index) => `
  <div class="fv-field" data-field="text-${name}" ${attributes}>
    <label for="text-${index}">Text</label>
    <input class="fv-box" id="text-${index}" name="text-${name}" required />
    <p class="fv-message" data-message-for="text-${name}">A message</p>
  </div>
  <div class="fv-field" data-field="select-${name}" ${attributes}>
    <label for="select-${index}">Select</label>
    <select class="fv-box" id="select-${index}" name="select-${name}">
      <option value="">Choose</option><option value="1">One</option>
    </select>
    <p class="fv-message" data-message-for="select-${name}"></p>
  </div>
  <div class="fv-field" data-field="area-${name}" ${attributes}>
    <label for="area-${index}">Area</label>
    <textarea class="fv-box" id="area-${index}" name="area-${name}"></textarea>
    <p class="fv-message" data-message-for="area-${name}">A message</p>
  </div>
  <fieldset class="fv-field" data-field="radio-${name}" ${attributes}>
    <legend>Radio</legend>
    <div class="fv-options fv-box">
      <label class="fv-option"><input type="radio" name="radio-${name}" required /> A</label>
    </div>
    <p class="fv-message" data-message-for="radio-${name}"></p>
  </fieldset>
  <div class="fv-field" data-field="check-${name}" ${attributes}>
    <label class="fv-option fv-box"><input type="checkbox" name="check-${name}" /> Tick</label>
    <p class="fv-message" data-message-for="check-${name}"></p>
  </div>`
).join('');

const cleanPage = (scheme, head) => `<!doctype html>
<html lang="en"${scheme ? ` data-scheme="${scheme}"` : ''}>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
${head}</head>
<body><form>${fieldsMarkup}
  <div class="fv-field" data-field="off" hidden>
    <label for="off">Off</label><input class="fv-box" id="off" name="off" />
    <p class="fv-message" data-message-for="off"></p>
  </div>
  <button class="fv-submit" type="submit">Send</button>
</form></body></html>`;

/** Opens the markup with the given head, on the server's origin. */
async function openClean(page, scheme, head) {
  const url = `/examples/__clean-${Math.random().toString(36).slice(2)}.html`;
  await page.route(`**${url}`, (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: cleanPage(scheme, head),
    })
  );
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
}

/** Every computed property of every element and pseudo-element, by a stable path. */
const snapshot = async (page, only) =>
  JSON.parse(
    // a string: Playwright's own serializer takes seconds on this many values
    await page.evaluate((selector) => {
      const result = {};
      const elements =
        selector ?
          [...document.querySelectorAll(selector)]
        : [
            document.documentElement,
            ...document.querySelectorAll('body, body *'),
          ];
      for (const element of elements) {
        const path = `${element.tagName}#${element.id}[${element.getAttribute('name') ?? element.getAttribute('data-field') ?? element.getAttribute('data-message-for') ?? element.className}]@${[...element.parentNode.children].indexOf(element)}`;
        for (const pseudo of [null, '::before', '::after']) {
          const style = getComputedStyle(element, pseudo);
          const values = {};
          for (let i = 0; i < style.length; i++) {
            const property = style.item(i);
            values[property] = style.getPropertyValue(property);
          }
          result[`${path}${pseudo ?? ''}`] = values;
        }
      }
      return JSON.stringify(result);
    }, only ?? null)
  );

/**
 * All the states of the page, including the real ones nothing but a person sets:
 * each control focused from the keyboard, the button hovered.
 */
async function captureAll(page) {
  await settleAnimations(page);
  const states = { rest: await snapshot(page) };
  await page.locator('input[name="text-neutral"]').focus();
  for (const name of [
    'text-neutral',
    'select-neutral',
    'area-neutral',
    'radio-neutral',
    'check-neutral',
    'text-valid',
    'text-invalid',
    'select-invalid',
    'area-valid',
  ]) {
    await page.locator(`[name="${name}"]`).focus();
    // focus-visible needs the keyboard: a key press with no effect sets the modality
    await page.keyboard.press('Shift');
    await settleAnimations(page);
    states[`focus ${name}`] = await snapshot(page, `[name="${name}"]`);
  }
  const button = page.locator('.fv-submit');
  await page.locator('input[name="text-neutral"]').focus();
  await page.keyboard.press('Shift');
  await button.focus();
  await page.keyboard.press('Shift');
  await settleAnimations(page);
  states['focus button'] = await snapshot(page, '.fv-submit');
  await button.hover();
  await settleAnimations(page);
  states['hover button'] = await snapshot(page, '.fv-submit');
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  return states;
}

function differences(expected, actual) {
  const found = [];
  for (const [state, elements] of Object.entries(expected))
    for (const [path, values] of Object.entries(elements))
      for (const [property, value] of Object.entries(values)) {
        const other = actual[state]?.[path]?.[property];
        if (other !== value)
          found.push(`${state} ${path} ${property}: ${value} != ${other}`);
      }
  return found;
}

const countValues = (states) =>
  Object.values(states)
    .flatMap((elements) => Object.values(elements))
    .reduce((sum, values) => sum + Object.keys(values).length, 0);

/** The exports as a person gets them: settings imported in the panel, the output read. */
async function exportsOf(page, settings) {
  await page.goto('/examples/');
  await page.waitForFunction(
    () => document.querySelector('form[data-schema]')?.noValidate
  );
  await pick(page, 'view', 'export');
  await page.locator('#import-text').fill(JSON.stringify(settings));
  await page.locator('#import-apply').click();
  await expect(page.locator('#import-errors')).toHaveText('Imported.');
  const read = async (output) => {
    await pick(page, 'output', output);
    return page.locator('#output-text').textContent();
  };
  return { changes: await read('changes'), whole: await read('stylesheet') };
}

for (const look of LOOKS)
  for (const [modeName, mode] of Object.entries(MODES))
    test(`${look}, ${modeName}: shipped + changes = whole stylesheet`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({
        colorScheme: mode.colorScheme ?? 'light',
        reducedMotion: mode.reducedMotion ?? 'no-preference',
      });
      for (const [designName, design] of Object.entries(DESIGNS)) {
        const settings = { look, darkMode: mode.darkMode, ...design };
        const { changes, whole } = await exportsOf(page, settings);
        expect(changes).toContain('html:root');

        await openClean(page, mode.scheme, `<style>${whole}</style>`);
        const expected = await captureAll(page);
        expect(countValues(expected)).toBeGreaterThan(5000);

        const shipped = `<link rel="stylesheet" href="/dist/looks/${look}.css" />`;
        const styles = `<style>${changes}</style>`;
        for (const [order, head] of [
          ['shipped first', shipped + styles],
          ['changes first', styles + shipped],
        ]) {
          await openClean(page, mode.scheme, head);
          const found = differences(expected, await captureAll(page));
          expect(
            found.slice(0, 25),
            `${designName}, ${order}: ${found.length} differences`
          ).toEqual([]);
        }
      }
    });

test('this comparison can fail: a changed design differs from the shipped look', async ({
  page,
}) => {
  const { whole } = await exportsOf(page, { look: 'edge', ...manyChanges });
  await openClean(page, undefined, `<style>${whole}</style>`);
  const expected = await captureAll(page);
  await openClean(
    page,
    undefined,
    '<link rel="stylesheet" href="/dist/looks/edge.css" />'
  );
  const found = differences(expected, await captureAll(page));
  expect(found.length).toBeGreaterThan(100);
});

test('data-scheme="dark" on a page that follows the system: as the whole sheet', async ({
  page,
}) => {
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    const settings = { look: 'edge', darkMode: 'media', ...manyChanges };
    const { changes, whole } = await exportsOf(page, settings);
    await openClean(page, 'dark', `<style>${whole}</style>`);
    const expected = await captureAll(page);
    await openClean(
      page,
      'dark',
      `<link rel="stylesheet" href="/dist/looks/edge.css" /><style>${changes}</style>`
    );
    const found = differences(expected, await captureAll(page));
    expect(found.slice(0, 25), `system ${colorScheme}`).toEqual([]);
  }
});

test('no changes at all: the export says so and the shipped sheet is the whole one', async ({
  page,
}) => {
  for (const look of LOOKS) {
    const { changes, whole } = await exportsOf(page, { look });
    expect(changes).toContain('nothing to change');
    const shipped = await (
      await page.request.get(`/dist/looks/${look}.css`)
    ).text();
    expect(shipped, look).toBe(whole);
  }
});
