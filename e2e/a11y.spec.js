/** The accessibility basics of the binding: what a screen reader is told. */
import { control, expect, field, line, openExamples, test } from './helpers.js';

test('aria-invalid follows the state', async ({ page }) => {
  await openExamples(page);
  const box = control(page, 'signIn', 'email');
  await expect(box).not.toHaveAttribute('aria-invalid', /.*/);
  await box.click();
  await page.keyboard.type('a<');
  await expect(box).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('ana@example.com');
  await expect(field(page, 'signIn', 'email')).toHaveAttribute(
    'data-state',
    'valid'
  );
  await expect(box).not.toHaveAttribute('aria-invalid', /.*/);
});

test('aria-describedby names the message line, and it reads the message', async ({
  page,
}) => {
  await openExamples(page);
  const box = control(page, 'signIn', 'email');
  const id = await line(page, 'signIn', 'email').getAttribute('id');
  expect(id).toBeTruthy();
  await expect(box).toHaveAttribute('aria-describedby', id);
  await box.focus();
  await page.keyboard.press('Tab');
  await expect(box).toHaveAccessibleDescription('Enter your e-mail.');
});

test('every control of a radio group points at the same line', async ({
  page,
}) => {
  await openExamples(page);
  const id = await line(page, 'billing', 'isCompany').getAttribute('id');
  const radios = control(page, 'billing', 'isCompany');
  await expect(radios).toHaveCount(2);
  for (const radio of await radios.all())
    await expect(radio).toHaveAttribute('aria-describedby', id);
});

test('ids stay unique across the page, though forms share field names', async ({
  page,
}) => {
  await openExamples(page);
  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(
      (element) => element.id
    );
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicates).toEqual([]);
});

test('submit by click: focus moves to the first invalid field', async ({
  page,
}) => {
  await openExamples(page);
  const form = page.locator('form[data-schema="register"]');
  await form.locator('button.fv-submit').click();
  await expect(control(page, 'register', 'email')).toBeFocused();
  for (const name of ['email', 'password', 'passwordConfirm', 'consent'])
    await expect(control(page, 'register', name), name).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  await expect(control(page, 'register', 'newsletter')).not.toHaveAttribute(
    'aria-invalid',
    /.*/
  );
});

test('submit by Enter: focus moves past valid fields to the first invalid one', async ({
  page,
}) => {
  await openExamples(page);
  await control(page, 'register', 'email').click();
  await page.keyboard.type('ana@example.com');
  await page.keyboard.press('Enter');
  await expect(control(page, 'register', 'password')).toBeFocused();
  await expect(control(page, 'register', 'email')).not.toHaveAttribute(
    'aria-invalid',
    /.*/
  );
});

test('a radio group and a select take the focus when they are first', async ({
  page,
}) => {
  await openExamples(page);
  const form = page.locator('form[data-schema="billing"]');
  await form.locator('button.fv-submit').click();
  await expect(control(page, 'billing', 'isCompany').first()).toBeFocused();
  await form.locator('label', { hasText: 'A private person' }).click();
  await form.locator('button.fv-submit').click();
  await expect(control(page, 'billing', 'country')).toBeFocused();
});

test('a hidden field never takes the focus', async ({ page }) => {
  await openExamples(page);
  const form = page.locator('form[data-schema="billing"]');
  await form.locator('label', { hasText: 'A company' }).click();
  await control(page, 'billing', 'companyName').fill('<');
  await form.locator('label', { hasText: 'A private person' }).click();
  await control(page, 'billing', 'country').selectOption('BG');
  await form.locator('button.fv-submit').click();
  await expect(control(page, 'billing', 'firstName')).toBeFocused();
});

test('the server’s errors land in the same lines and take the focus', async ({
  page,
}) => {
  await openExamples(page);
  const form = page.locator('form[data-schema="signIn"]');
  await control(page, 'signIn', 'password').fill('x');
  await form.locator('button[data-action="raw"]').click();
  await expect(form.locator('output')).toContainText('field(s) refused');
  await expect(line(page, 'signIn', 'email')).toHaveText('Enter your e-mail.');
  await expect(control(page, 'signIn', 'email')).toBeFocused();
  await expect(control(page, 'signIn', 'email')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
});

test('the look keeps a visible focus ring for keyboard users', async ({
  page,
}) => {
  await openExamples(page);
  await control(page, 'signIn', 'email').focus();
  await page.keyboard.press('Tab');
  const box = control(page, 'signIn', 'password');
  await expect(box).toBeFocused();
  const outline = await box.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).toBe('solid');
  expect(outline.width).toBe('2px');
});
