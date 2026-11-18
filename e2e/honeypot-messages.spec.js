/**
 * The honeypot as the README writes it: out of sight,
 * out of the tab order and the accessibility tree, never given a message line,
 * and a filled one stops the submit. And the message line: a message of
 * the reserved height moves nothing, a longer one grows the line and pushes the
 * next field down, without overlapping or clipping, at phone width too.
 */
import { expect, test } from './helpers.js';

/**
 * A page with the shipped CSS of the default look, a form whose controls get
 * their attributes from `fieldAttributes` (as a server writes them), bound.
 */
async function openForm(page) {
  await page.goto('/examples/css/demo.css');
  await page.route('**/examples/__trap.html', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Honeypot</title><style id="css"></style></head><body>
      <form id="f" novalidate style="max-width: 420px; padding: 0 16px">
        <div class="fv-field" data-field="email"><label for="email">E-mail</label>
          <input class="fv-box" id="email" name="email" autocomplete="email" />
          <p class="fv-message" data-message-for="email"></p></div>
        <div class="fv-trap" aria-hidden="true"><label for="hp-x">Leave this empty</label>
          <input id="hp-x" name="extra_hp" /></div>
        <div class="fv-field" data-field="name"><label for="name">Name</label>
          <input class="fv-box" id="name" name="name" autocomplete="name" />
          <p class="fv-message" data-message-for="name"></p></div>
        <button class="fv-submit" type="submit">Send</button>
      </form>
      <script type="module">
        const core = await import('/dist/esm/index.js');
        const { bindForm } = await import('/dist/esm/dom/index.js');
        const css = await import('/dist/esm/css/index.js');
        document.getElementById('css').textContent =
          css.generateCss(css.defaultLook()).stylesheet;
        const schema = core.defineForm({
          email: core.email(),
          extra_hp: core.honeypot(),
          name: core.text({ max: 100 }),
        });
        for (const name of schema.names) {
          const control = document.querySelector('[name="' + name + '"]');
          for (const [key, value] of Object.entries(core.fieldAttributes(schema, name)))
            control.setAttribute(key, value === true ? '' : value);
        }
        window.sent = [];
        window.blocked = [];
        window.bound = bindForm(document.getElementById('f'), schema, {
          onSubmit: (values) => window.sent.push(values),
          onInvalid: (blocked) => window.blocked.push(blocked),
        });
        window.ready = true;
      </script></body></html>`,
    })
  );
  await page.goto('/examples/__trap.html');
  await page.waitForFunction(() => window.ready === true);
}

test.describe('the honeypot', () => {
  test('has the attributes that keep autofill and password managers away', async ({
    page,
  }) => {
    await openForm(page);
    const trap = page.locator('[name="extra_hp"]');
    for (const [name, value] of [
      ['autocomplete', 'new-password'],
      ['tabindex', '-1'],
      ['inert', ''],
      ['aria-hidden', 'true'],
      ['data-1p-ignore', ''],
      ['data-lpignore', 'true'],
      ['data-bwignore', ''],
      ['data-form-type', 'other'],
    ])
      await expect(trap).toHaveAttribute(name, value);
    await expect(trap).not.toHaveAttribute('required');
    await expect(trap).not.toHaveAttribute('aria-describedby');
  });

  test('is out of sight, out of reach of the mouse and the keyboard, and out of the accessibility tree', async ({
    page,
    browserName,
  }) => {
    await openForm(page);
    const box = await page.locator('.fv-trap').boundingBox();
    expect(box.width).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
    // the clipped pixel takes no clicks: a click there doesn't focus it
    await page.mouse.click(box.x + 0.5, box.y + 0.5);
    expect(await page.evaluate(() => document.activeElement?.name)).not.toBe(
      'extra_hp'
    );
    // a script can't focus it either (inert)
    await page.locator('[name="extra_hp"]').evaluate((el) => el.focus());
    expect(await page.evaluate(() => document.activeElement?.name)).not.toBe(
      'extra_hp'
    );
    // Tab goes from the e-mail straight to the name
    await page.locator('#email').focus();
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    expect(await page.evaluate(() => document.activeElement?.name)).toBe(
      'name'
    );
    // two text boxes for assistive tech, not three
    await expect(page.getByRole('textbox')).toHaveCount(2);
    await expect(
      page.getByRole('textbox', { name: 'Leave this empty' })
    ).toHaveCount(0);
  });

  test('gets no message line, and a filled one stops the submit: onInvalid says so without naming it', async ({
    page,
  }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await openForm(page);
    await page.locator('#email').fill('ana@example.com');
    await page.locator('#name').fill('Ana');
    await page.locator('.fv-submit').click();
    expect(await page.evaluate(() => window.sent)).toEqual([
      { email: 'ana@example.com', extra_hp: '', name: 'Ana' },
    ]);
    // a bot that fills every input
    await page
      .locator('[name="extra_hp"]')
      .evaluate((el) => (el.value = 'https://spam.example'));
    await page.locator('.fv-submit').click();
    expect(await page.evaluate(() => window.sent.length)).toBe(1);
    expect(await page.evaluate(() => window.blocked)).toEqual([
      { errors: [], trap: 'This form could not be sent.' },
    ]);
    await expect(page.locator('.fv-trap p')).toHaveCount(0);
    await expect(page.locator('.fv-trap [data-state]')).toHaveCount(0);
    await expect(page.locator('[data-state="invalid"]')).toHaveCount(0);
    expect(errors).toEqual([]);
    // a field to fix as well: it gets the focus and its message, onInvalid both
    await page.locator('#email').fill('ana@');
    await page.locator('.fv-submit').click();
    await expect(page.locator('#email')).toBeFocused();
    expect(await page.evaluate(() => window.blocked.at(-1))).toEqual({
      errors: [
        {
          field: 'email',
          message: 'Enter a valid e-mail, like name@example.com.',
        },
      ],
      trap: 'This form could not be sent.',
    });
    expect(await page.evaluate(() => window.sent.length)).toBe(1);
  });
});

test.describe('the message line', () => {
  const layout = (page) =>
    page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.finish();
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      };
      const line = document.querySelector('[data-message-for="email"]');
      return {
        line: rect('[data-message-for="email"]'),
        reserved: Number.parseFloat(getComputedStyle(line).minHeight),
        clipped:
          line.scrollHeight > line.clientHeight + 0.5 ||
          line.scrollWidth > line.clientWidth + 0.5,
        nameLabel: rect('label[for="name"]'),
        name: rect('#name'),
        button: rect('.fv-submit'),
        pageWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
      };
    });

  test('one line moves nothing; a longer message pushes the next field down, with no overlap, clipping or sideways scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openForm(page);
    const before = await layout(page);

    await page.evaluate(() =>
      window.bound.showErrors([{ field: 'email', message: 'Enter an e-mail.' }])
    );
    const short = await layout(page);
    expect(short.line.height).toBeCloseTo(before.reserved, 0);
    expect(short.nameLabel.top).toBeCloseTo(before.nameLabel.top, 1);
    expect(short.button.top).toBeCloseTo(before.button.top, 1);

    const long =
      'This message is long on purpose: it takes three or more lines at phone width, and one word is https://example.com/a-very-long-unbroken-address-that-must-wrap-too.';
    await page.evaluate(
      (message) => window.bound.showErrors([{ field: 'email', message }]),
      long
    );
    const grown = await layout(page);
    const extra = grown.line.height - before.reserved;
    expect(extra).toBeGreaterThan(before.reserved);
    expect(grown.clipped).toBe(false);
    expect(grown.line.bottom).toBeLessThanOrEqual(grown.nameLabel.top + 0.5);
    expect(grown.nameLabel.top - before.nameLabel.top).toBeCloseTo(extra, 0);
    expect(grown.button.top - before.button.top).toBeCloseTo(extra, 0);
    expect(grown.pageWidth).toBeLessThanOrEqual(grown.viewport);

    // fixed: back to the reserved height, everything where it was
    await page.locator('#email').fill('ana@example.com');
    const back = await layout(page);
    expect(back.nameLabel.top).toBeCloseTo(before.nameLabel.top, 1);
    expect(back.button.top).toBeCloseTo(before.button.top, 1);
  });
});
