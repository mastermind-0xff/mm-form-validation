/**
 * The first risk: a regex an engine can't compile throws at module load and takes
 * every form with it. Then the character sets, against the server.
 */
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { control, expect, field, openExamples, test } from './helpers.js';

const root = join(import.meta.dirname, '..');

/** Read in a test: the webServer's build runs after this file loads. */
const builtModules = () =>
  readdirSync(join(root, 'dist/esm'), { recursive: true })
    .filter((file) => file.endsWith('.js'))
    .map((file) =>
      `/${relative(root, join(root, 'dist/esm', file))}`.split(sep).join('/')
    );

test('the page loads with no console errors and no page errors', async ({
  page,
  pageErrors,
}) => {
  const problems = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      problems.push(`${message.type()}: ${message.text()}`);
  });
  await openExamples(page);
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
  expect(pageErrors).toEqual([]);
  await expect(page.locator('form[data-schema]')).toHaveCount(4);
});

test('every built module compiles and runs', async ({ page }) => {
  await openExamples(page);
  const modules = builtModules();
  expect(modules.length).toBeGreaterThan(20);
  const failed = await page.evaluate(async (paths) => {
    const results = await Promise.all(
      paths.map((path) =>
        import(path).then(
          () => null,
          (error) => `${path}: ${error}`
        )
      )
    );
    return results.filter((result) => result !== null);
  }, modules);
  expect(failed).toEqual([]);
});

test('the character sets compile with the v flag and work', async ({
  page,
}) => {
  await openExamples(page);
  const results = await page.evaluate(async () => {
    const { badChar } = await import('/dist/esm/chars.js');
    const refused = (value, set) => badChar(value, set) !== undefined;
    return {
      nchar: refused('￾', 'text'),
      nchar2: refused(String.fromCodePoint(0x1fffe), 'text'),
      loneHigh: refused('\uD800', 'text'),
      loneLow: refused('\uDC00', 'text'),
      pairOk: !refused('😀', 'text'),
      joinerInside: !refused('a‍b', 'text'),
      joinerFirst: refused('‍a', 'text'),
      markFirst: refused('́a', 'text'),
      marks31: refused(`a${'́'.repeat(31)}`, 'text'),
      marks30: !refused(`a${'́'.repeat(30)}`, 'text'),
    };
  });
  for (const [name, passed] of Object.entries(results))
    expect.soft(passed, name).toBe(true);
});

test('engines disagree with Node only on code points one of them has not assigned', async ({
  page,
}, testInfo) => {
  // over a million code points, seven sets, on both sides
  test.setTimeout(300_000);
  await openExamples(page);
  const inBrowser = await page.evaluate(async () => {
    const { charSets } = await import('/dist/esm/chars.js');
    const assigned = /\P{Cn}/u;
    const unassigned = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      if (!assigned.test(String.fromCodePoint(cp))) unassigned.push(cp);
    }
    const refused = {};
    for (const [name, set] of Object.entries(charSets)) {
      const list = [];
      for (let cp = 0; cp <= 0x10ffff; cp++) {
        if (cp >= 0xd800 && cp <= 0xdfff) continue;
        // inside a word, so the rules about the start of a value stay out of it
        if (set.test(`a${String.fromCodePoint(cp)}a`)) list.push(cp);
      }
      refused[name] = list;
    }
    return { refused, unassigned };
  });

  const { charSets } = await import('../dist/esm/chars.js');
  const nodeUnassigned = new Set();
  const assigned = /\P{Cn}/u;
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    if (!assigned.test(String.fromCodePoint(cp))) nodeUnassigned.add(cp);
  }
  const browserUnassigned = new Set(inBrowser.unassigned);
  const unexplained = {};
  const counts = {};
  for (const [name, set] of Object.entries(charSets)) {
    const here = new Set(inBrowser.refused[name]);
    let differing = 0;
    const bad = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      if (set.test(`a${String.fromCodePoint(cp)}a`) === here.has(cp)) continue;
      differing++;
      if (!nodeUnassigned.has(cp) && !browserUnassigned.has(cp))
        bad.push(cp.toString(16));
    }
    counts[name] = differing;
    if (bad.length > 0) unexplained[name] = bad.slice(0, 40);
  }
  console.log(
    `[${testInfo.project.name}] code points refused differently from Node ${process.version}:`,
    JSON.stringify(counts),
    `unassigned here ${browserUnassigned.size}, in Node ${nodeUnassigned.size}`
  );
  expect(unexplained).toEqual({});
});

const company = {
  isCompany: '1',
  country: 'BG',
  firstName: 'Ana',
  lastName: 'Ivanova',
  companyName: 'Ae Sweets Ltd.',
  entityNumber: '',
  vatNumber: '',
  city: 'Sofia',
  address1: 'ul. Vitosha 1',
  address2: '',
};

const NAMES = ['山田太郎', 'ジョン・スミス', '约翰·史密斯', 'Тихомир'];
const LATIN = ['Anne-Marie O’Neil', 'Ελένη', 'José María', 'Nguyễn Văn A'];
const INVISIBLE = [
  '­', // soft hyphen
  '‎', // left-to-right mark
  '‮', // right-to-left override
  '​', // zero width space
  '⁠', // word joiner
  '\u{E0041}', // tag character
  '', // private use
  '﷐', // noncharacter
  'ㅤ', // Hangul filler
  '⠀', // blank Braille
];

/** The billing field a value goes in, the value, and whether both sides accept it. */
const CASES = [
  ...[...NAMES, ...LATIN].map((value) => ['firstName', value, true]),
  ...['́', '1', 'a<b', 'a​b', 'aㅤb'].map((value) => [
    'firstName',
    value,
    false,
  ]),
  ['address1', '〒100-0001 千代田区千代田１−１', true],
  ['address1', 'ul. Vitosha 1, ap. 4', true],
  ['address1', '221B Baker Street', true],
  ['address1', '1', false],
  ['address1', 'x<1', false],
  ['city', '千代田区', true],
  ['city', 'Frankfurt am Main', true],
  ['city', '東京（渋谷）', true],
  ['city', 'Å', true],
  ['city', '1', false],
  ['city', '#1 town', false],
  ...INVISIBLE.flatMap((invisible) => [
    ['companyName', `Ae${invisible}Sweets`, false],
    ['address1', `ul.${invisible} Vitosha`, false],
  ]),
  ['companyName', '山田商事株式会社', true],
  ['companyName', 'Café №5', true],
  ['companyName', 'A‍B', true],
];

const show = (value) =>
  JSON.stringify(value).replace(
    /[^\x20-\x7e]/gu,
    (c) => `\\u{${c.codePointAt(0).toString(16)}}`
  );

const post = (page, form, body) =>
  page.evaluate(
    async ([path, data]) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    [`/api/${form}`, body]
  );

test('a byte order mark counts as white space on both sides, and is not stored', async ({
  page,
}) => {
  await openExamples(page);
  await page
    .locator('form[data-schema="billing"] label', { hasText: 'A company' })
    .click();
  const box = control(page, 'billing', 'companyName');
  await box.fill('Ae﻿Sweets');
  await box.blur();
  await expect(field(page, 'billing', 'companyName')).toHaveAttribute(
    'data-state',
    'valid'
  );
  const answer = await post(page, 'billing', {
    ...company,
    companyName: await box.inputValue(),
  });
  expect(answer.values.companyName).toBe('Ae Sweets');
});

test('browser and server agree on the character sets', async ({ page }) => {
  test.setTimeout(240_000);
  await openExamples(page);
  await page
    .locator('form[data-schema="billing"] label', { hasText: 'A company' })
    .click();
  for (const [name, value, accepted] of CASES) {
    const box = control(page, 'billing', name);
    await box.fill(value);
    await box.blur();
    const state = await field(page, 'billing', name).getAttribute('data-state');
    // as the browser would send it: read back from its own control
    const answer = await post(page, 'billing', {
      ...company,
      [name]: await box.inputValue(),
    });
    const label = `${name} ${show(value)}`;
    expect
      .soft(state, `browser, ${label}`)
      .toBe(accepted ? 'valid' : 'invalid');
    expect.soft(answer.ok, `server, ${label}`).toBe(accepted);
    await box.fill(company[name]);
  }
});

test('multiline: both sides keep line breaks and refuse the invisible', async ({
  page,
}) => {
  await openExamples(page);
  for (const [value, accepted] of [
    ['お問い合わせです。\n二行目もあります。', true],
    ['First line here\nSecond line here', true],
    ['Long enough text​ here', false],
    ['Long enough text­ here', false],
  ]) {
    const box = control(page, 'contact', 'message');
    await box.fill(value);
    await box.blur();
    const state = await field(page, 'contact', 'message').getAttribute(
      'data-state'
    );
    const answer = await post(page, 'contact', {
      name: 'Ana',
      email: 'ana@example.com',
      topic: 'other',
      orderNumber: '',
      message: await box.inputValue(),
    });
    expect.soft(state, show(value)).toBe(accepted ? 'valid' : 'invalid');
    expect.soft(answer.ok, show(value)).toBe(accepted);
  }
});

test('real typing: a Japanese name, sent, stored as typed', async ({
  page,
}) => {
  await openExamples(page);
  const form = page.locator('form[data-schema="billing"]');
  await form.locator('label', { hasText: 'A private person' }).click();
  await control(page, 'billing', 'country').selectOption('BG');
  await control(page, 'billing', 'firstName').click();
  await page.keyboard.type('山田');
  await expect(field(page, 'billing', 'firstName')).toHaveAttribute(
    'data-state',
    'valid'
  );
  await control(page, 'billing', 'lastName').click();
  await page.keyboard.type('ジョン・スミス');
  await form.locator('button.fv-submit').click();
  const output = form.locator('output');
  await expect(output).toContainText('Server: accepted');
  await expect(output).toContainText('山田');
  await expect(output).toContainText('ジョン・スミス');
});

test('an e-mail control: the browser and the server agree on what it holds', async ({
  page,
}, testInfo) => {
  await openExamples(page);
  const box = control(page, 'contact', 'email');
  for (const value of [
    '  ana@example.com  ',
    'josé@bücher.example',
    'a@b.co',
  ]) {
    await box.fill(value);
    await box.blur();
    const sent = await box.inputValue();
    const state = await field(page, 'contact', 'email').getAttribute(
      'data-state'
    );
    const answer = await post(page, 'contact', {
      name: 'Ana',
      email: sent,
      topic: 'other',
      orderNumber: '',
      message: 'Long enough message.',
    });
    console.log(
      `[${testInfo.project.name}] e-mail ${show(value)} -> control ${show(sent)}, browser ${state}, server ${answer.ok}`
    );
    expect
      .soft(state === 'valid', `${show(value)} on both sides`)
      .toBe(answer.ok);
  }
});
