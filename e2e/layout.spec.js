/**
 * Nothing moves: not when a field validates (positions stay, except a message
 * longer than the reserved lines, which is reported: F12 is open), not when the
 * stylesheet arrives late behind an inline block, and no sideways scrolling.
 */
import {
  control,
  expect,
  isPhone,
  openExamples,
  pick,
  settleAnimations,
  test,
} from './helpers.js';

const LOOKS = ['edge', 'underline', 'outline', 'icon', 'filled'];

/** Position and size of everything in the forms, in page coordinates. */
const rects = (page, form) =>
  page.evaluate((schema) => {
    for (const animation of document.getAnimations()) animation.finish();
    const scope =
      schema ?
        `form[data-schema="${schema}"] *`
      : 'form *, form, .card, .fv-submit';
    return (
      [...document.querySelectorAll(scope)]
        // a closed select's options have no layout of their own
        .filter((element) => !element.matches('output, option'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          // not rendered: no place in the page, whatever the scroll position is
          const shown = element.getClientRects().length > 0;
          const name =
            element.getAttribute('name') ??
            element.getAttribute('data-field') ??
            element.getAttribute('data-message-for') ??
            element.tagName;
          return {
            name: `${element.tagName} ${name}`,
            box:
              shown ?
                [
                  rect.left + scrollX,
                  rect.top + scrollY,
                  rect.width,
                  rect.height,
                ]
              : [0, 0, 0, 0],
          };
        })
    );
  }, form);

/** The largest move of anything between two readings, with who moved. */
function moves(before, after) {
  const moved = [];
  before.forEach(({ name, box }, index) => {
    const other = after[index].box;
    const largest = Math.max(...box.map((v, i) => Math.abs(v - other[i])));
    if (largest > 0.01) moved.push(`${name}: ${largest.toFixed(2)} px`);
  });
  return moved;
}

/** The message lines taller than the height reserved for them. */
const overflowing = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.fv-message')]
      .filter(
        (element) =>
          element.getBoundingClientRect().height >
          Number.parseFloat(getComputedStyle(element).minHeight) + 0.5
      )
      .map(
        (element) =>
          `${element.closest('form').dataset.schema}.${element.dataset.messageFor}: "${element.textContent}"`
      )
  );

for (const look of LOOKS)
  for (const form of ['signIn', 'register', 'billing', 'contact'])
    test(`${look}, ${form}: validating moves nothing`, async ({
      page,
    }, testInfo) => {
      await openExamples(page);
      await pick(page, 'look', look);
      await settleAnimations(page);
      if (form === 'billing')
        await page
          .locator('form[data-schema="billing"] label', {
            hasText: 'A private person',
          })
          .click();
      const scope = page.locator(`form[data-schema="${form}"]`);
      const before = await rects(page, form);

      await scope.locator('.fv-submit').click();
      await expect(
        scope.locator('[data-state="invalid"]').first()
      ).toBeVisible();
      const red = await rects(page, form);
      const overflow = await overflowing(page);
      if (overflow.length > 0)
        console.log(
          `[${testInfo.project.name}] ${look} ${form}: messages over the reserved line: ${overflow.join('; ')}`
        );
      const redMoves = moves(before, red);
      if (overflow.length === 0) expect(redMoves).toEqual([]);

      // a valid value in the first text field: green, its message gone
      const text = scope.locator('input.fv-box:visible').first();
      await text.click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(
        (await text.getAttribute('type')) === 'email' ?
          'ana@example.com'
        : 'Ana Ivanova'
      );
      const green = await rects(page, form);
      if (overflow.length === 0) expect(moves(before, green)).toEqual([]);
    });

test('a field left unfinished with a long hint: the same height while it shows', async ({
  page,
}) => {
  await openExamples(page);
  const before = await rects(page, 'signIn');
  await control(page, 'signIn', 'email').click();
  await page.keyboard.type('ana');
  await settleAnimations(page);
  const hint = await rects(page, 'signIn');
  const overflow = await overflowing(page);
  if (overflow.length === 0) expect(moves(before, hint)).toEqual([]);
});

const markup = `
<form>
  <div class="fv-field" data-field="a"><label for="a">Text</label>
    <input class="fv-box" id="a" name="a" required />
    <p class="fv-message" data-message-for="a"></p></div>
  <div class="fv-field" data-field="b"><label for="b">Select</label>
    <select class="fv-box" id="b" name="b"><option>Choose</option></select>
    <p class="fv-message" data-message-for="b"></p></div>
  <div class="fv-field" data-field="c"><label for="c">Area</label>
    <textarea class="fv-box" id="c" name="c"></textarea>
    <p class="fv-message" data-message-for="c"></p></div>
  <fieldset class="fv-field" data-field="d"><legend>Radio</legend>
    <div class="fv-options fv-box">
      <label class="fv-option"><input type="radio" name="d" /> A</label>
      <label class="fv-option"><input type="radio" name="d" /> B</label></div>
    <p class="fv-message" data-message-for="d"></p></fieldset>
  <div class="fv-field" data-field="e">
    <label class="fv-option fv-box"><input type="checkbox" name="e" /> Tick</label>
    <p class="fv-message" data-message-for="e"></p></div>
  <button class="fv-submit" type="submit">Send</button>
</form>
<p id="below">The text below the form.</p>`;

/** The head block and the stylesheet the export gives, generated in the browser. */
const generated = (page, settings) =>
  page.evaluate(async (wanted) => {
    const css = await import('/dist/esm/css/index.js');
    const look = { ...css.defaultLook(), ...wanted };
    return {
      head: css.headSnippet(look, '/examples/__late.css'),
      stylesheet: css.generateCss(look).stylesheet,
    };
  }, settings);

/**
 * Loads a page with the block from the export, its stylesheet held back. Reads the
 * layout, lets the stylesheet arrive, and reads it again.
 */
async function lateStylesheet(page, settings) {
  await page.goto('/examples/css/demo.css');
  const { head, stylesheet } = await generated(page, settings);
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/examples/__late.css', async (route) => {
    await held;
    await route.fulfill({ contentType: 'text/css', body: stylesheet });
  });
  await page.route('**/examples/__late.html', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script>
        window.shifts = [];
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) window.shifts.push(entry.value);
          }).observe({ type: 'layout-shift', buffered: true });
        } catch {}
      </script>${head}</head><body>${markup}</body></html>`,
    })
  );
  await page.goto('/examples/__late.html', { waitUntil: 'commit' });
  await page.waitForSelector('#below');
  await page.waitForFunction(() => document.readyState !== 'loading');
  await page.waitForTimeout(100);
  const before = await rects(page);
  const applied = stylesheet !== '';
  release();
  if (applied)
    await page.waitForFunction(() =>
      [...document.styleSheets].some((sheet) =>
        sheet.href?.endsWith('__late.css')
      )
    );
  await page.waitForTimeout(150);
  const after = await rects(page);
  const below = (reading) =>
    reading.find((entry) => entry.name.includes('BUTTON')).box[1];
  return {
    moved: moves(before, after),
    buttonMoved: Math.abs(below(before) - below(after)),
    shifts: await page.evaluate(() => window.shifts),
  };
}

for (const look of LOOKS)
  for (const inline of ['layout', 'paint', 'all'])
    for (const split of [false, true])
      test(`${look}, inline ${inline}${split ? ', split' : ''}: a late stylesheet moves nothing`, async ({
        page,
      }) => {
        const { moved, shifts } = await lateStylesheet(page, {
          look,
          inline,
          split,
        });
        expect(moved).toEqual([]);
        expect(shifts.reduce((sum, value) => sum + value, 0)).toBe(0);
      });

test('this check can fail: with nothing inline a late stylesheet moves things', async ({
  page,
}) => {
  await page.goto('/examples/css/demo.css');
  const { stylesheet } = await generated(page, {
    look: 'edge',
    inline: 'none',
  });
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/examples/__late.css', async (route) => {
    await held;
    await route.fulfill({ contentType: 'text/css', body: stylesheet });
  });
  await page.route('**/examples/__late.html', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8" />
      <link rel="preload" href="/examples/__late.css" as="style" onload="this.rel='stylesheet'" />
      </head><body>${markup}</body></html>`,
    })
  );
  await page.goto('/examples/__late.html', { waitUntil: 'commit' });
  await page.waitForSelector('#below');
  const before = await rects(page);
  release();
  await page.waitForFunction(() =>
    [...document.styleSheets].some((sheet) =>
      sheet.href?.endsWith('__late.css')
    )
  );
  await page.waitForTimeout(150);
  expect(moves(before, await rects(page)).length).toBeGreaterThan(0);
});

const sideways = (page) =>
  page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((element) => {
        // inside its own scroller, or visually hidden: not the page's problem
        if (element.closest('#output-text, .visually-hidden')) return false;
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          (rect.right > width + 0.5 || rect.left < -0.5)
        );
      })
      .slice(0, 8)
      .map(
        (element) =>
          `${element.tagName}#${element.id}.${element.className} ${Math.round(element.getBoundingClientRect().right)}`
      );
    return {
      width,
      scroll: document.documentElement.scrollWidth,
      bodyScroll: document.body.scrollWidth,
      offenders,
    };
  });

for (const look of LOOKS)
  test(`${look}: no sideways scrolling at phone width, in any view`, async ({
    page,
  }, testInfo) => {
    // the desktop projects are held to the same width
    if (!isPhone(testInfo))
      await page.setViewportSize({ width: 360, height: 740 });
    await openExamples(page);
    await pick(page, 'look', look);
    const check = async (what) => {
      await settleAnimations(page);
      const result = await sideways(page);
      expect(result.scroll, `${what}: ${result.offenders.join('; ')}`).toBe(
        result.width
      );
      expect(result.offenders, what).toEqual([]);
    };
    await check('design view');

    // every form red, with its messages
    await page
      .locator('form[data-schema="billing"] label', { hasText: 'A company' })
      .click();
    for (const form of ['signIn', 'register', 'billing', 'contact'])
      await page.locator(`form[data-schema="${form}"] .fv-submit`).click();
    await check('forms with their errors');

    // long input and a long message
    await control(page, 'billing', 'companyName').fill('W'.repeat(400));
    await check('a very long value');

    await pick(page, 'view', 'export');
    await check('export view');
    for (const output of [
      'settings',
      'changes',
      'stylesheet',
      'head',
      'brief',
    ]) {
      await pick(page, 'output', output);
      await check(`export view, ${output}`);
    }
  });

test('phone: the form controls are big enough to touch', async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo), 'only on the phone profiles');
  await openExamples(page);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('form .fv-box')]
      .filter((element) => element.getBoundingClientRect().height > 0)
      .filter((element) => element.getBoundingClientRect().height < 36)
      .map((element) => element.getAttribute('name') ?? element.className)
  );
  expect(small).toEqual([]);
});
