/**
 * The VAT gate of the billing form, on a server of its own per test: the limits
 * live in the server's process. VIES_STUB: a number ending in 00 isn't registered,
 * in 99 the service is down, anything else is valid.
 */
import { control, expect, field, line, openExamples, test } from './helpers.js';

const NOT_REGISTERED = 'This VAT number is not registered.';
const DOWN = 'The VAT service is not answering. Try again in a minute.';
const COOLDOWN = /^Too many checks\. Try again in \d+ s\.$/u;

/** The billing form, filled in as a company in Bulgaria, ready for a number. */
async function openBilling(page, origin) {
  await openExamples(page, origin);
  const form = page.locator('form[data-schema="billing"]');
  await form.locator('label', { hasText: 'A company' }).click();
  await control(page, 'billing', 'country').selectOption('BG');
  await control(page, 'billing', 'firstName').fill('Ana');
  await control(page, 'billing', 'lastName').fill('Ivanova');
  await control(page, 'billing', 'companyName').fill('Ae Sweets Ltd.');
  await control(page, 'billing', 'city').fill('Sofia');
  await control(page, 'billing', 'address1').fill('ul. Vitosha 1');
  return form;
}

/** Counts the requests the page sends to the gate's endpoint. */
function countChecks(page) {
  const seen = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/vat-check'))
      seen.push(JSON.parse(request.postData()).vatNumber);
  });
  return seen;
}

/** Holds the answers of the endpoint until released, in the order asked. */
async function holdChecks(page) {
  const held = [];
  await page.route('**/api/vat-check', (route) => {
    held.push(route);
  });
  return held;
}

async function typeVat(page, value) {
  const vat = control(page, 'billing', 'vatNumber');
  await vat.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.type(value);
}

/** Types a number and leaves the field, which starts the check at once. */
async function enterVat(page, value) {
  await typeVat(page, value);
  await control(page, 'billing', 'city').focus();
}

const vatField = (page) => field(page, 'billing', 'vatNumber');
const vatLine = (page) => line(page, 'billing', 'vatNumber');

test('"Checking…" shows, then a valid number turns green', async ({
  page,
  ownServer,
}) => {
  await openBilling(page, ownServer.url);
  const held = await holdChecks(page);
  await enterVat(page, 'BG123456789');
  await expect(vatLine(page)).toHaveText('Checking…');
  await expect(vatField(page)).not.toHaveAttribute('data-state', /.*/);
  await expect(vatField(page)).toHaveAttribute('data-message', 'hint');
  await expect.poll(() => held.length).toBe(1);
  await held[0].continue();
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid');
  await expect(vatLine(page)).toHaveText('');
});

test('while typing, the check waits for the pause', async ({
  page,
  ownServer,
}) => {
  await openBilling(page, ownServer.url);
  const asked = countChecks(page);
  await typeVat(page, 'BG123456789');
  await expect(vatLine(page)).toHaveText('Checking…');
  expect(asked).toEqual([]);
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid', {
    timeout: 5000,
  });
  expect(asked).toEqual(['BG123456789']);
  await expect(control(page, 'billing', 'vatNumber')).toBeFocused();
});

test('a number ending in 00 is red: not registered', async ({
  page,
  ownServer,
}) => {
  await openBilling(page, ownServer.url);
  await enterVat(page, 'BG123456700');
  await expect(vatLine(page)).toHaveText(NOT_REGISTERED);
  await expect(vatField(page)).toHaveAttribute('data-state', 'invalid');
  await expect(control(page, 'billing', 'vatNumber')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
});

test('a number ending in 99 shows the service message', async ({
  page,
  ownServer,
}) => {
  await openBilling(page, ownServer.url);
  await enterVat(page, 'BG123456799');
  await expect(vatLine(page)).toHaveText(DOWN);
  await expect(vatField(page)).toHaveAttribute('data-state', 'invalid');
});

test('after 3 distinct checks a cooldown, and it asks again by itself when it ends', async ({
  page,
  ownServer,
}) => {
  test.setTimeout(90_000);
  await openBilling(page, ownServer.url);
  const asked = countChecks(page);
  for (const number of ['BG100000001', 'BG100000002', 'BG100000003']) {
    await enterVat(page, number);
    await expect(vatField(page)).toHaveAttribute('data-state', 'valid');
  }
  expect(asked).toHaveLength(3);
  const before = Date.now();
  await enterVat(page, 'BG100000004');
  await expect(vatLine(page)).toHaveText(COOLDOWN);
  await expect(vatField(page)).toHaveAttribute('data-state', 'invalid');
  expect(asked, 'the cooldown sends no request').toHaveLength(3);

  // the real wait: nothing else touches the field
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid', {
    timeout: 45_000,
  });
  expect(asked).toEqual([
    'BG100000001',
    'BG100000002',
    'BG100000003',
    'BG100000004',
  ]);
  await expect(vatLine(page)).toHaveText('');
  expect(Date.now() - before).toBeLessThan(35_000);
});

test('the same number again sends no request', async ({ page, ownServer }) => {
  await openBilling(page, ownServer.url);
  const asked = countChecks(page);
  await enterVat(page, 'BG123456789');
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid');
  await enterVat(page, 'BG123456700');
  await expect(vatField(page)).toHaveAttribute('data-state', 'invalid');
  await enterVat(page, 'BG123456789');
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid');
  await enterVat(page, 'BG123456700');
  await expect(vatLine(page)).toHaveText(NOT_REGISTERED);
  expect(asked).toEqual(['BG123456789', 'BG123456700']);
});

test('a value changed in the middle of a check does not show the old answer', async ({
  page,
  ownServer,
}) => {
  await openBilling(page, ownServer.url);
  await vatLine(page).evaluate((element) => {
    window.shown = [];
    new MutationObserver(() => window.shown.push(element.textContent)).observe(
      element,
      { childList: true, characterData: true, subtree: true }
    );
  });
  const held = await holdChecks(page);
  await enterVat(page, 'BG123456700');
  await expect.poll(() => held.length).toBe(1);
  await expect(vatLine(page)).toHaveText('Checking…');

  await enterVat(page, 'BG123456789');
  await expect.poll(() => held.length).toBe(2);
  // the old answer arrives first and then the new one; aborted, so it may fail
  await held[0].continue().catch(() => {});
  await held[1].continue();
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid');
  await page.waitForTimeout(200);
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid');
  const shown = await page.evaluate(() => window.shown);
  expect(shown).not.toContain(NOT_REGISTERED);
});

test('the old answer arriving last does not overwrite the new one', async ({
  page,
  ownServer,
}) => {
  await openBilling(page, ownServer.url);
  const held = await holdChecks(page);
  await enterVat(page, 'BG123456700');
  await expect.poll(() => held.length).toBe(1);
  await enterVat(page, 'BG123456789');
  await expect.poll(() => held.length).toBe(2);
  await held[1].continue();
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid');
  await held[0].continue().catch(() => {});
  await page.waitForTimeout(300);
  await expect(vatField(page)).toHaveAttribute('data-state', 'valid');
});

test('submit waits for the gate and then reaches the server', async ({
  page,
  ownServer,
}) => {
  const form = await openBilling(page, ownServer.url);
  const held = await holdChecks(page);
  const posts = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/billing'))
      posts.push(JSON.parse(request.postData()));
  });
  await typeVat(page, 'BG123456789');
  await form.locator('button.fv-submit').click();
  await expect.poll(() => held.length).toBe(1);
  await page.waitForTimeout(300);
  expect(posts, 'nothing goes to the server before the gate answers').toEqual(
    []
  );
  await held[0].continue();
  const output = form.locator('output');
  await expect(output).toContainText('Server: accepted');
  expect(posts).toHaveLength(1);
  expect(posts[0].vatNumber).toBe('BG123456789');
});

test('submit: a refusal from the gate stops it and focuses the field', async ({
  page,
  ownServer,
}) => {
  const form = await openBilling(page, ownServer.url);
  const posts = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/billing')) posts.push(request);
  });
  await typeVat(page, 'BG123456700');
  await form.locator('button.fv-submit').click();
  await expect(vatLine(page)).toHaveText(NOT_REGISTERED);
  await expect(control(page, 'billing', 'vatNumber')).toBeFocused();
  await page.waitForTimeout(300);
  expect(posts).toEqual([]);
});

test('a second click while the gate runs does not send twice', async ({
  page,
  ownServer,
}) => {
  const form = await openBilling(page, ownServer.url);
  const held = await holdChecks(page);
  const posts = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/billing')) posts.push(request);
  });
  await typeVat(page, 'BG123456789');
  const button = form.locator('button.fv-submit');
  await button.click();
  await expect.poll(() => held.length).toBe(1);
  await button.click();
  await held[0].continue();
  await expect(form.locator('output')).toContainText('Server: accepted');
  await page.waitForTimeout(300);
  expect(posts).toHaveLength(1);
  expect(held).toHaveLength(1);
});

test('with the endpoint failing the field stays neutral, and the server decides', async ({
  page,
  ownServer,
}) => {
  const form = await openBilling(page, ownServer.url);
  await page.route('**/api/vat-check', (route) => route.abort());
  await enterVat(page, 'BG123456789');
  await expect(vatLine(page)).toHaveText('');
  await expect(vatField(page)).not.toHaveAttribute('data-state', /.*/);
  await form.locator('button.fv-submit').click();
  await expect(form.locator('output')).toContainText('Server: accepted');
});

test('with the endpoint failing, the server still refuses an unregistered number', async ({
  page,
  ownServer,
}) => {
  const form = await openBilling(page, ownServer.url);
  await page.route('**/api/vat-check', (route) => route.abort());
  await enterVat(page, 'BG123456700');
  await expect(vatField(page)).not.toHaveAttribute('data-state', /.*/);
  await expect(vatLine(page)).toHaveText('');
  await form.locator('button.fv-submit').click();
  await expect(form.locator('output')).toContainText('field(s) refused');
  await expect(vatLine(page)).toHaveText(NOT_REGISTERED);
  await expect(vatField(page)).toHaveAttribute('data-state', 'invalid');
});

const body = (vatNumber) => ({
  isCompany: '1',
  country: 'BG',
  firstName: 'Ana',
  lastName: 'Ivanova',
  companyName: 'Ae Sweets Ltd.',
  entityNumber: '',
  vatNumber,
  city: 'Sofia',
  address1: 'ul. Vitosha 1',
  address2: '',
});

test('a direct POST with an unregistered number is refused', async ({
  request,
  ownServer,
}) => {
  const refused = await request.post(`${ownServer.url}/api/billing`, {
    data: body('BG123456700'),
  });
  expect(refused.status()).toBe(400);
  const answer = await refused.json();
  expect(answer.first).toMatchObject({
    field: 'vatNumber',
    stage: 'gate',
    message: NOT_REGISTERED,
  });
  const down = await request.post(`${ownServer.url}/api/billing`, {
    data: body('BG123456799'),
  });
  expect(down.status()).toBe(400);
  expect((await down.json()).first.message).toBe(DOWN);
  const fine = await request.post(`${ownServer.url}/api/billing`, {
    data: body('BG123456789'),
  });
  expect(fine.status()).toBe(200);
  expect((await fine.json()).values.vatNumber).toBe('BG123456789');
});

test('after 10 checks from one caller the server refuses rather than saves', async ({
  request,
  ownServer,
}) => {
  for (let i = 0; i < 10; i++) {
    const answer = await request.post(`${ownServer.url}/api/billing`, {
      data: body(`BG2000001${i}1`),
    });
    expect(answer.status(), `check ${i + 1}`).toBe(200);
  }
  const eleventh = await request.post(`${ownServer.url}/api/billing`, {
    data: body('BG200000211'),
  });
  expect(eleventh.status()).toBe(400);
  const answer = await eleventh.json();
  expect(answer.ok).toBe(false);
  expect(answer.first).toMatchObject({ field: 'vatNumber', stage: 'gate' });
  expect(answer.first.message).toMatch(COOLDOWN);
  // what is known already costs nothing, and still saves
  const known = await request.post(`${ownServer.url}/api/billing`, {
    data: body('BG200000131'),
  });
  expect(known.status()).toBe(200);
  // the endpoint shares the limit
  const check = await request.post(`${ownServer.url}/api/vat-check`, {
    data: { country: 'BG', vatNumber: 'BG200000212' },
  });
  expect((await check.json()).message).toMatch(COOLDOWN);
});

test('a junk body reaches no gate: shape first', async ({
  request,
  ownServer,
}) => {
  for (let i = 0; i < 15; i++) {
    const answer = await request.post(`${ownServer.url}/api/billing`, {
      data: body('nonsense'),
    });
    expect(answer.status()).toBe(400);
    expect((await answer.json()).first.stage).not.toBe('gate');
  }
  const fine = await request.post(`${ownServer.url}/api/billing`, {
    data: body('BG123456789'),
  });
  expect(fine.status(), 'junk did not use up the limit').toBe(200);
});
