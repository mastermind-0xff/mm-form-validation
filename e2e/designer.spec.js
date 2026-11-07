/**
 * The look designer panel: every control really changes what it says, in light and
 * dark, for all five looks. Then Reset, reload, and the exports' Copy, Download and
 * import, which had never run for real.
 */
import { readFile } from 'node:fs/promises';
import {
  control,
  expect,
  openExamples,
  pick,
  settleAnimations,
  test,
} from './helpers.js';

const LOOKS = ['edge', 'underline', 'outline', 'icon', 'filled'];
const SCHEMES = ['light', 'dark'];

const rgb = (hex) =>
  `rgb(${[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

const submit = (page) => page.locator('form[data-schema="signIn"] .fv-submit');

const buttonStyle = (page, property) =>
  submit(page).evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property
  );

const colorControl = (page, name, scheme) =>
  page.getByLabel(`Submit button, ${name}, ${scheme}`, { exact: true });

for (const look of LOOKS)
  for (const scheme of SCHEMES)
    test(`submit button: every control, ${look}, ${scheme}`, async ({
      page,
    }) => {
      await openExamples(page);
      await pick(page, 'look', look);
      await pick(page, 'scheme', scheme);
      const other = scheme === 'light' ? 'dark' : 'light';

      await colorControl(page, 'Color', scheme).fill('#123456');
      await expect
        .poll(() => buttonStyle(page, 'background-color'))
        .toBe(rgb('#123456'));
      await expect
        .poll(() => buttonStyle(page, 'border-top-color'))
        .toBe(rgb('#123456'));

      await colorControl(page, 'Text', scheme).fill('#fedcba');
      await expect.poll(() => buttonStyle(page, 'color')).toBe(rgb('#fedcba'));

      await colorControl(page, 'Hover and pressed', scheme).fill('#654321');
      await page.mouse.move(0, 0);
      await submit(page).hover();
      await expect
        .poll(() => buttonStyle(page, 'background-color'))
        .toBe(rgb('#654321'));
      await page.mouse.move(0, 0);
      await page.locator('h1').hover();
      await expect
        .poll(() => buttonStyle(page, 'background-color'))
        .toBe(rgb('#123456'));

      // the other scheme's control leaves this scheme alone
      await colorControl(page, 'Color', other).fill('#00ff00');
      await settleAnimations(page);
      expect(await buttonStyle(page, 'background-color')).toBe(rgb('#123456'));

      await page.locator('#token-button-pad-x').fill('27');
      await page.locator('#token-button-pad-y').fill('14');
      await page.locator('#token-button-radius').fill('19');
      await page.locator('#token-button-size').fill('1.25');
      await settleAnimations(page);
      expect(await buttonStyle(page, 'padding-left')).toBe('27px');
      expect(await buttonStyle(page, 'padding-right')).toBe('27px');
      expect(await buttonStyle(page, 'padding-top')).toBe('14px');
      expect(await buttonStyle(page, 'padding-bottom')).toBe('14px');
      expect(await buttonStyle(page, 'border-top-left-radius')).toBe('19px');
      expect(await buttonStyle(page, 'font-size')).toBe('20px');
    });

/**
 * What the fields show, in the states that use every token: a red field, a green
 * one, a required one, a hint, a select's arrow. Every computed property, as one
 * string. Selected so that one reading costs little.
 */
const fieldLook = (page) =>
  page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
    const all = [];
    for (const element of document.querySelectorAll(
      'form[data-schema="signIn"] .fv-field, form[data-schema="signIn"] .fv-field *, form[data-schema="billing"] [data-field="country"], form[data-schema="billing"] [data-field="country"] > *, form[data-schema="billing"] [data-field="firstName"], form[data-schema="billing"] [data-field="firstName"] > *'
    ))
      for (const pseudo of [null, '::after']) {
        const style = getComputedStyle(element, pseudo);
        for (let i = 0; i < style.length; i++)
          all.push(`${style.item(i)}:${style.getPropertyValue(style.item(i))}`);
      }
    // sorted: Firefox lists custom properties in an order of its own
    return all.sort().join(';');
  });

/**
 * A red field and a green one, nothing focused, on the timing with no timers: a
 * reading must differ only because of the control just changed.
 */
async function statesForTokens(page) {
  await pick(page, 'timing', 'leave');
  await control(page, 'signIn', 'email').fill('a<');
  await control(page, 'signIn', 'password').fill('secret');
  await control(page, 'signIn', 'password').blur();
}

for (const look of LOOKS)
  for (const scheme of SCHEMES)
    test(`field controls change the fields, ${look}, ${scheme}`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await openExamples(page);
      await pick(page, 'look', look);
      await pick(page, 'scheme', scheme);
      await statesForTokens(page);

      const tokens = await page.evaluate(() =>
        [...document.querySelectorAll('.control')]
          .map((box) => {
            const input = box.querySelector('input[id^="token-"]');
            return {
              id: input.id,
              kind: input.type,
              unused: box.classList.contains('unused'),
              group: input.closest('[data-group]').dataset.group,
              value: input.value,
            };
          })
          .filter((token) => token.group !== 'button')
      );
      expect(tokens.length).toBeGreaterThan(10);
      const changed = [];
      for (const token of tokens) {
        const before = await fieldLook(page);
        const input = page.locator(`#${token.id}`);
        let value;
        if (token.kind === 'number')
          value = String(
            Number(token.value) + (token.id.endsWith('lines') ? 2 : 1)
          );
        else
          value = token.id === 'token-font' ? 'Georgia, serif' : 'ease-in-out';
        await input.fill(value);
        await input.blur();
        const after = await fieldLook(page);
        if (token.unused)
          expect(after, `${token.id} is dimmed, so it does nothing`).toBe(
            before
          );
        else {
          expect(after, `${token.id} changes the fields`).not.toBe(before);
          changed.push(token.id);
        }
      }
      expect(changed.length).toBeGreaterThan(5);

      // the colors of this scheme: the first of each row is light, the second dark
      const colors = await page.evaluate(() =>
        [...document.querySelectorAll('#colors input[type="color"]')].map(
          (input) => ({
            label: input.getAttribute('aria-label'),
            unused:
              input.previousElementSibling?.classList.contains('unused') ||
              input.previousElementSibling?.previousElementSibling?.classList.contains(
                'unused'
              ),
          })
        )
      );
      expect(colors).toHaveLength(20);
      let index = 0;
      for (const { label, unused } of colors) {
        index++;
        const shown = label.endsWith(`, ${scheme}`);
        const before = await fieldLook(page);
        const value = `#${(0x102030 + index * 0x050403).toString(16)}`;
        await page.getByLabel(label, { exact: true }).fill(value);
        const after = await fieldLook(page);
        if (!shown || unused)
          expect(after, `${label} does not touch ${scheme}`).toBe(before);
        else expect(after, `${label} changes the fields`).not.toBe(before);
      }
    });

test('a slider moves the token and its number', async ({ page }) => {
  await openExamples(page);
  const slider = page.getByRole('slider', { name: 'Corner radius' }).first();
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#token-radius')).toHaveValue('7');
  const radius = await control(page, 'signIn', 'email').evaluate(
    (element) => getComputedStyle(element).borderTopLeftRadius
  );
  expect(radius).toBe('7px');
});

test('a value the settings refuse is marked and changes nothing', async ({
  page,
}) => {
  await openExamples(page);
  const font = page.locator('#token-font');
  const before = await fieldLook(page);
  await font.fill('}</style><script>');
  await expect(font).toHaveAttribute('aria-invalid', 'true');
  expect(await fieldLook(page)).toBe(before);
});

const setDesign = async (page) => {
  await page.locator('#token-pad-x').fill('25');
  await page.locator('#token-button-radius').fill('20');
  await colorControl(page, 'Color', 'light').fill('#123456');
  await page.getByLabel('Valid, light', { exact: true }).fill('#00aa00');
};

const emailPadding = (page) =>
  control(page, 'signIn', 'email').evaluate(
    (element) => getComputedStyle(element).paddingRight
  );

test('Reset brings back every token and color, not the look', async ({
  page,
}) => {
  await openExamples(page);
  await pick(page, 'look', 'outline');
  await settleAnimations(page);
  const untouched = await fieldLook(page);
  const buttonBefore = await buttonStyle(page, 'background-color');
  await setDesign(page);
  await settleAnimations(page);
  expect(await emailPadding(page)).toBe('25px');
  await page.locator('#reset').click();
  await settleAnimations(page);
  expect(await emailPadding(page)).toBe('16px');
  expect(await fieldLook(page)).toBe(untouched);
  expect(await buttonStyle(page, 'background-color')).toBe(buttonBefore);
  await expect(page.locator('#token-pad-x')).toHaveValue('16');
  await expect(colorControl(page, 'Color', 'light')).toHaveValue('#1f2328');
  await expect(page.locator('#look input[value="outline"]')).toBeChecked();
});

test('a reload keeps the design', async ({ page }) => {
  await openExamples(page);
  await pick(page, 'look', 'filled');
  await pick(page, 'scheme', 'dark');
  await pick(page, 'timing', 'input');
  await setDesign(page);
  await settleAnimations(page);
  const styled = await fieldLook(page);
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('form[data-schema]')?.noValidate
  );
  await settleAnimations(page);
  await expect(page.locator('#look input[value="filled"]')).toBeChecked();
  await expect(page.locator('#scheme input[value="dark"]')).toBeChecked();
  await expect(page.locator('#timing input[value="input"]')).toBeChecked();
  await expect(page.locator('#token-pad-x')).toHaveValue('25');
  await expect(colorControl(page, 'Color', 'light')).toHaveValue('#123456');
  expect(await page.locator('html').getAttribute('data-scheme')).toBe('dark');
  expect(await fieldLook(page)).toBe(styled);
  // and the timing is what the panel says: red at once
  await control(page, 'signIn', 'email').click();
  await page.keyboard.type('a');
  await expect(
    page.locator('form[data-schema="signIn"] [data-field="email"]')
  ).toHaveAttribute('data-state', 'invalid');
});

test('the first paint of a reload already has the saved CSS', async ({
  page,
}) => {
  await openExamples(page);
  await page.locator('#token-pad-x').fill('25');
  await settleAnimations(page);
  // the module script is held back: only the inline script of the head has run
  await page.route('**/examples/page.js', () => {});
  await page.reload({ waitUntil: 'commit' });
  await page.waitForSelector('#signin-email');
  await page.waitForFunction(
    () => document.getElementById('fv-css')?.textContent !== ''
  );
  expect(await emailPadding(page)).toBe('25px');
});

const EXPORTS = {
  brief: 'form-look.md',
  settings: 'form-look.json',
  changes: 'form-fields.changes.css',
  stylesheet: 'form-fields.css',
  head: 'form-fields.head.html',
};

for (const [output, file] of Object.entries(EXPORTS))
  test(`a real download: ${file}`, async ({ page }) => {
    await openExamples(page);
    await setDesign(page);
    await pick(page, 'view', 'export');
    await pick(page, 'output', output);
    await expect(page.locator('#output-file')).toHaveText(file);
    const shown = await page.locator('#output-text').textContent();
    expect(shown.length).toBeGreaterThan(50);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#download').click(),
    ]);
    expect(download.suggestedFilename()).toBe(file);
    const path = await download.path();
    expect(await readFile(path, 'utf8')).toBe(shown);
  });

/**
 * Copy, then a real paste. Never in WebKit on Windows: its paste reads the machine's
 * real clipboard, not what `writeText` wrote, so it would read the user's own data
 * (it did, once). What was pasted is compared in the page and never printed.
 */
test('the real clipboard: what Copy wrote is what a paste gives', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'WebKit on Windows pastes from the real OS clipboard, which belongs to the user; the next test covers its Copy button'
  );
  await context
    .grantPermissions(['clipboard-read', 'clipboard-write'])
    .catch(() => {});
  await openExamples(page);
  await setDesign(page);
  await pick(page, 'view', 'export');
  await pick(page, 'output', 'settings');
  const shown = await page.locator('#output-text').textContent();
  await page.locator('#copy').click();
  await expect(page.locator('#output-status')).toHaveText('Copied.');
  await page.locator('#import-text').focus();
  await page.keyboard.press('ControlOrMeta+v');
  await expect
    .poll(() =>
      page.locator('#import-text').evaluate((box, text) => {
        const same = box.value === text;
        box.value = '';
        return same;
      }, shown)
    )
    .toBe(true);
});

test('Copy says it copied, and nothing is thrown', async ({
  page,
  context,
}) => {
  await context
    .grantPermissions(['clipboard-read', 'clipboard-write'])
    .catch(() => {});
  await openExamples(page);
  await pick(page, 'view', 'export');
  await page.locator('#copy').click();
  await expect(page.locator('#output-status')).toHaveText('Copied.');
});

test('exported settings import back whole, in a browser that has never seen them', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await openExamples(page);
  await pick(page, 'look', 'icon');
  await pick(page, 'darkMode', 'media');
  await pick(page, 'timing', 'leave');
  await setDesign(page);
  await page.getByLabel('Valid, dark', { exact: true }).fill('#00bb00');
  await pick(page, 'view', 'export');
  await pick(page, 'inline', 'all');
  await page.locator('#split').check();
  const read = async (target, output) => {
    await pick(target, 'output', output);
    return target.locator('#output-text').textContent();
  };
  const originals = {};
  for (const output of ['settings', 'changes', 'stylesheet', 'head', 'brief'])
    originals[output] = await read(page, output);
  const saved = await page.evaluate(() => localStorage.getItem('fv-demo-look'));

  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto(new URL('/examples/', page.url()).href);
  await fresh.waitForFunction(
    () => document.querySelector('form[data-schema]')?.noValidate
  );
  await pick(fresh, 'view', 'export');
  await fresh.locator('#import-text').fill(originals.settings);
  await fresh.locator('#import-apply').click();
  await expect(fresh.locator('#import-errors')).toHaveText('Imported.');
  for (const output of Object.keys(originals))
    expect(await read(fresh, output), output).toBe(originals[output]);
  expect(await fresh.evaluate(() => localStorage.getItem('fv-demo-look'))).toBe(
    saved
  );

  // and from a saved brief
  const other = await context.newPage();
  await other.goto(new URL('/examples/', page.url()).href);
  await other.waitForFunction(
    () => document.querySelector('form[data-schema]')?.noValidate
  );
  await pick(other, 'view', 'export');
  await other.locator('#import-text').fill(originals.brief);
  await other.locator('#import-apply').click();
  await expect(other.locator('#import-errors')).toHaveText('Imported.');
  expect(await read(other, 'settings')).toBe(originals.settings);
  await context.close();
});

test('an import that is not settings is refused, and changes nothing', async ({
  page,
}) => {
  await openExamples(page);
  await pick(page, 'view', 'export');
  await pick(page, 'output', 'settings');
  const before = await page.locator('#output-text').textContent();
  for (const text of [
    'not json',
    '{"tokens":{"radius":"1px}</style>"}}',
    '{"colors":{"light":{"text":"red"}}}',
    '{"nope":1}',
  ]) {
    await page.locator('#import-text').fill(text);
    await page.locator('#import-apply').click();
    await expect(page.locator('#import-errors li').first()).not.toHaveClass(
      'ok'
    );
    await expect(page.locator('#import-errors li').first()).not.toHaveText('');
  }
  await expect(page.locator('#output-text')).toHaveText(before);
});
