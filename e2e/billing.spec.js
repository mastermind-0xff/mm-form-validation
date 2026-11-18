/**
 * The billing form: inactive fields and the VAT messages per country.
 * Long messages are reported, not refused.
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

const LOOKS = ['edge', 'underline', 'outline', 'icon', 'filled'];
const COMPANY_ONLY = ['companyName', 'entityNumber', 'vatNumber'];

const display = (locator) =>
  locator.evaluate((element) => getComputedStyle(element).display);

const asterisk = (locator) =>
  locator.evaluate((element) => {
    const label = element.querySelector(':scope > label, :scope > legend');
    return getComputedStyle(label, '::after').content;
  });

const choose = (page, text) =>
  page.locator('form[data-schema="billing"] label', { hasText: text }).click();

for (const look of LOOKS) {
  test(`${look}: choosing a company shows its fields and adds asterisks`, async ({
    page,
  }) => {
    await openExamples(page);
    await pick(page, 'look', look);
    for (const name of COMPANY_ONLY) {
      expect(await display(field(page, 'billing', name)), name).toBe('none');
      await expect(field(page, 'billing', name)).toBeHidden();
    }
    // not required until a company is chosen
    for (const name of ['city', 'address1'])
      expect(await asterisk(field(page, 'billing', name)), name).toBe('none');

    await choose(page, 'A company');
    for (const name of COMPANY_ONLY) {
      await expect(field(page, 'billing', name), name).toBeVisible();
      expect(await display(field(page, 'billing', name)), name).toBe('grid');
    }
    for (const name of ['companyName', 'city', 'address1'])
      expect(await asterisk(field(page, 'billing', name)), name).toContain('*');
    // optional stays without one
    for (const name of ['entityNumber', 'vatNumber', 'address2'])
      expect(await asterisk(field(page, 'billing', name)), name).toBe('none');
    await expect(control(page, 'billing', 'city')).toHaveJSProperty(
      'required',
      true
    );

    await choose(page, 'A private person');
    for (const name of COMPANY_ONLY) {
      expect(await display(field(page, 'billing', name)), name).toBe('none');
      await expect(control(page, 'billing', name)).toHaveJSProperty(
        'required',
        false
      );
    }
    expect(await asterisk(field(page, 'billing', 'city'))).toBe('none');
  });

  test(`${look}: the contact form's optional field follows its topic`, async ({
    page,
  }) => {
    await openExamples(page);
    await pick(page, 'look', look);
    const order = field(page, 'contact', 'orderNumber');
    expect(await display(order)).toBe('none');
    await control(page, 'contact', 'topic').selectOption('order');
    expect(await display(order)).toBe('grid');
    await control(page, 'contact', 'topic').selectOption('other');
    expect(await display(order)).toBe('none');
  });
}

test('an inactive field is not sent as invalid: a hidden value does not block', async ({
  page,
}) => {
  await openExamples(page);
  await choose(page, 'A company');
  await control(page, 'billing', 'companyName').fill('<');
  await choose(page, 'A private person');
  await control(page, 'billing', 'country').selectOption('BG');
  await control(page, 'billing', 'firstName').fill('Ana');
  await control(page, 'billing', 'lastName').fill('Ivanova');
  const form = page.locator('form[data-schema="billing"]');
  await form.locator('button.fv-submit').click();
  await expect(form.locator('output')).toContainText('Server: accepted');
  await expect(form.locator('output')).toContainText('"companyName": ""');
});

/** Every country of the page, with the hint its empty, focused field shows. */
const HINTS = {
  AT: 'ATUXXXXXXXX (X = digit)',
  BE: 'BE0XXXXXXXXX or BE1XXXXXXXXX (X = digit)',
  BG: 'BG and 9 or 10 digits: BGXXXXXXXXX',
  CY: 'CYXXXXXXXXL (X = digit, L = letter)',
  CZ: 'CZ and 8 to 10 digits: CZXXXXXXXX',
  DE: 'DE and 9 digits: DEXXXXXXXXX',
  DK: 'DK and 8 digits: DKXXXXXXXX',
  ES: 'ES?XXXXXXX? (X = digit, ? = letter or digit)',
  FR: 'FR??XXXXXXXXX (X = digit, ? = letter or digit)',
  GR: 'EL and 9 digits: ELXXXXXXXXX',
  IE: 'IEXXXXXXXL or IEXXXXXXXLL (X = digit, L = letter)',
  IT: 'IT and 11 digits: ITXXXXXXXXXXX',
  NL: 'NLXXXXXXXXXBXX (X = digit)',
  PL: 'PL and 10 digits: PLXXXXXXXXXX',
  RO: 'RO and 2 to 10 digits: ROXXXXXXXX',
  SE: 'SEXXXXXXXXXX01 (X = digit)',
};

test('the VAT hint follows the select, for every country', async ({
  page,
}, testInfo) => {
  await openExamples(page);
  await choose(page, 'A company');
  const vat = control(page, 'billing', 'vatNumber');
  const message = line(page, 'billing', 'vatNumber');
  const wrapped = [];
  for (const [country, hint] of Object.entries(HINTS)) {
    await control(page, 'billing', 'country').selectOption(country);
    await vat.focus();
    await expect.soft(message, country).toHaveText(hint);
    const size = await message.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      reserved: Number.parseFloat(getComputedStyle(element).minHeight),
      width: element.getBoundingClientRect().width,
    }));
    if (size.height > size.reserved + 0.5)
      wrapped.push(
        `${country} "${hint}" (${size.height} px against ${size.reserved} px, ${Math.round(size.width)} px wide)`
      );
    await vat.blur();
  }
  console.log(
    `[${testInfo.project.name}] VAT hints that wrap past the reserved line: ${wrapped.length}/${Object.keys(HINTS).length}\n  ${wrapped.join('\n  ')}`
  );
});

test('the VAT message changes with the select while a number is typed', async ({
  page,
}) => {
  await openExamples(page);
  await choose(page, 'A company');
  await control(page, 'billing', 'country').selectOption('BG');
  await control(page, 'billing', 'vatNumber').click();
  await page.keyboard.type('BG1234');
  const message = line(page, 'billing', 'vatNumber');
  await expect(message).toHaveText('BG and 9 or 10 digits: BG1234XXXXX');
  // the country changes: the prefix is now another country's, red at once
  await control(page, 'billing', 'country').selectOption('DE');
  await expect(message).toHaveText(
    'VAT numbers in this country start with DE.'
  );
  await expect(field(page, 'billing', 'vatNumber')).toHaveAttribute(
    'data-state',
    'invalid'
  );
  await control(page, 'billing', 'country').selectOption('BG');
  await expect(message).toHaveText('BG and 9 or 10 digits: BG1234XXXXX');
});

test('outside the EU any letters and digits pass, without a check', async ({
  page,
}) => {
  await openExamples(page);
  await choose(page, 'A company');
  let asked = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/vat-check')) asked++;
  });
  await control(page, 'billing', 'country').selectOption('US');
  await control(page, 'billing', 'vatNumber').click();
  await page.keyboard.type('AB1234');
  await page.keyboard.press('Tab');
  await expect(field(page, 'billing', 'vatNumber')).toHaveAttribute(
    'data-state',
    'valid'
  );
  expect(asked).toBe(0);
});

test('report: every message that outgrows its line in a half-width column', async ({
  page,
}, testInfo) => {
  await openExamples(page);
  await choose(page, 'A company');
  await page.locator('form[data-schema="billing"] button.fv-submit').click();
  const overflowing = await page.evaluate(() =>
    [...document.querySelectorAll('.fv-message')]
      .filter(
        (element) =>
          element.getBoundingClientRect().height >
          Number.parseFloat(getComputedStyle(element).minHeight) + 0.5
      )
      .map(
        (element) =>
          `${element.closest('form').dataset.schema}.${element.dataset.messageFor}: ${element.textContent}`
      )
  );
  console.log(
    `[${testInfo.project.name}] messages over the reserved line after an empty submit: ${JSON.stringify(overflowing)}`
  );
});
