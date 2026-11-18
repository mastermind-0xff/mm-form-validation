/**
 * When a message turns red, with real keyboard input. The clock
 * is real too. Every wait for "not yet" is measured from the page itself, so a slow
 * machine can't turn it into a false failure.
 */
import {
  control,
  expect,
  field,
  line,
  openExamples,
  pick,
  test,
} from './helpers.js';

/**
 * Types with the real keyboard, and gives the time from the last keystroke to the
 * field turning red, measured in the page.
 */
async function typeAndTimeRed(page, form, name, text) {
  const wrapper = field(page, form, name);
  await wrapper.evaluate((element) => {
    const box = element.querySelector('input, textarea');
    let lastInput = 0;
    let red = false;
    box.addEventListener('input', () => {
      lastInput = performance.now();
    });
    new MutationObserver(() => {
      const now = element.getAttribute('data-state') === 'invalid';
      if (now && !red) window.toRed = performance.now() - lastInput;
      red = now;
    }).observe(element, { attributes: true });
  });
  await control(page, form, name).click();
  await page.keyboard.type(text);
}

test.describe('the default timing is pause', () => {
  test('an unfinished value is a hint, and red after the pause', async ({
    page,
  }) => {
    await openExamples(page);
    await expect(page.locator('#timing input[value="pause"]')).toBeChecked();
    await typeAndTimeRed(page, 'signIn', 'email', 'ana');
    const wrapper = field(page, 'signIn', 'email');
    await expect(line(page, 'signIn', 'email')).not.toHaveText('');
    await expect(wrapper).toHaveAttribute('data-state', 'invalid', {
      timeout: 5000,
    });
    await expect(wrapper).toHaveAttribute('data-message', 'error');
    const elapsed = await page.evaluate(() => window.toRed);
    expect(elapsed).toBeGreaterThan(950);
    expect(elapsed).toBeLessThan(2500);
  });

  test('more typing starts the pause again', async ({ page }) => {
    await openExamples(page);
    const wrapper = field(page, 'signIn', 'email');
    await typeAndTimeRed(page, 'signIn', 'email', 'a');
    for (const letter of 'nana') {
      await page.waitForTimeout(400);
      await page.keyboard.type(letter);
    }
    await expect(wrapper).toHaveAttribute('data-state', 'invalid', {
      timeout: 5000,
    });
    const elapsed = await page.evaluate(() => window.toRed);
    expect(elapsed).toBeGreaterThan(950);
  });

  test('leaving turns it red before the pause is over', async ({ page }) => {
    await openExamples(page);
    await typeAndTimeRed(page, 'signIn', 'email', 'ana');
    await page.keyboard.press('Tab');
    await expect(field(page, 'signIn', 'email')).toHaveAttribute(
      'data-state',
      'invalid'
    );
    const elapsed = await page.evaluate(() => window.toRed);
    expect(elapsed).toBeLessThan(900);
  });
});

for (const timing of ['leave', 'pause', 'input']) {
  test.describe(`timing ${timing}, switched in the designer`, () => {
    test.beforeEach(async ({ page }) => {
      await openExamples(page);
      await pick(page, 'timing', timing);
      await expect(
        page.locator(`#timing input[value="${timing}"]`)
      ).toBeChecked();
    });

    test('an unfinished value turns red at the right moment', async ({
      page,
    }) => {
      const wrapper = field(page, 'signIn', 'email');
      await typeAndTimeRed(page, 'signIn', 'email', 'ana');
      if (timing === 'input') {
        await expect(wrapper).toHaveAttribute('data-state', 'invalid');
        const elapsed = await page.evaluate(() => window.toRed);
        expect(elapsed).toBeLessThan(500);
        return;
      }
      if (timing === 'pause') {
        await expect(wrapper).toHaveAttribute('data-state', 'invalid', {
          timeout: 5000,
        });
        const elapsed = await page.evaluate(() => window.toRed);
        expect(elapsed).toBeGreaterThan(950);
        return;
      }
      // leave: a hint, however long the wait, until the field is left
      await page.waitForTimeout(1500);
      await expect(wrapper).not.toHaveAttribute('data-state', /.*/);
      await expect(wrapper).toHaveAttribute('data-message', 'hint');
      await page.keyboard.press('Tab');
      await expect(wrapper).toHaveAttribute('data-state', 'invalid');
      await expect(wrapper).toHaveAttribute('data-message', 'error');
    });

    test('a character that is not allowed is red at once', async ({ page }) => {
      const wrapper = field(page, 'signIn', 'email');
      await typeAndTimeRed(page, 'signIn', 'email', 'a<');
      await expect(wrapper).toHaveAttribute('data-state', 'invalid');
      await expect(line(page, 'signIn', 'email')).toHaveText(
        'The character "<" is not allowed.'
      );
      const elapsed = await page.evaluate(() => window.toRed);
      expect(elapsed).toBeLessThan(500);
    });

    test('green as soon as the value is valid', async ({ page }) => {
      const wrapper = field(page, 'signIn', 'email');
      await control(page, 'signIn', 'email').click();
      await page.keyboard.type('ana@example.c');
      await page.keyboard.type('om');
      await expect(wrapper).toHaveAttribute('data-state', 'valid');
      await expect(control(page, 'signIn', 'email')).toBeFocused();
      await expect(line(page, 'signIn', 'email')).toHaveText('');
    });

    test('tabbing through an empty required field says it is required', async ({
      page,
    }) => {
      await control(page, 'signIn', 'email').focus();
      await expect(field(page, 'signIn', 'email')).not.toHaveAttribute(
        'data-state',
        /.*/
      );
      await page.keyboard.press('Tab');
      await expect(control(page, 'signIn', 'password')).toBeFocused();
      await expect(field(page, 'signIn', 'email')).toHaveAttribute(
        'data-state',
        'invalid'
      );
      await expect(line(page, 'signIn', 'email')).toHaveText(
        'Enter your e-mail.'
      );
      await page.keyboard.press('Tab');
      await expect(line(page, 'signIn', 'password')).toHaveText(
        'Enter your password.'
      );
    });

    test('a field that was red updates live, and heals', async ({ page }) => {
      const wrapper = field(page, 'signIn', 'email');
      await typeAndTimeRed(page, 'signIn', 'email', 'ana');
      await page.keyboard.press('Tab');
      await expect(wrapper).toHaveAttribute('data-state', 'invalid');
      await control(page, 'signIn', 'email').click();
      await page.keyboard.press('End');
      await page.keyboard.type('@example.com');
      await expect(wrapper).toHaveAttribute('data-state', 'valid');
    });

    test('an optional field left empty stays neutral', async ({ page }) => {
      await page
        .locator('form[data-schema="billing"] label', {
          hasText: 'A private person',
        })
        .click();
      const box = control(page, 'billing', 'address2');
      await box.focus();
      await page.keyboard.press('Tab');
      await expect(field(page, 'billing', 'address2')).not.toHaveAttribute(
        'data-state',
        /.*/
      );
      await expect(line(page, 'billing', 'address2')).toHaveText('');
    });

    test('a typed optional field is checked like a required one', async ({
      page,
    }) => {
      await page
        .locator('form[data-schema="billing"] label', {
          hasText: 'A private person',
        })
        .click();
      await control(page, 'billing', 'address2').click();
      await page.keyboard.type('a<');
      await expect(field(page, 'billing', 'address2')).toHaveAttribute(
        'data-state',
        'invalid'
      );
    });

    test('a select shows its state on change', async ({ page }) => {
      const select = control(page, 'billing', 'country');
      await select.selectOption('BG');
      await expect(field(page, 'billing', 'country')).toHaveAttribute(
        'data-state',
        'valid'
      );
    });

    test('the password is never trimmed while typing', async ({ page }) => {
      await control(page, 'register', 'password').click();
      await page.keyboard.type('  spaced  ');
      await expect(field(page, 'register', 'password')).toHaveAttribute(
        'data-state',
        'valid'
      );
    });
  });
}
