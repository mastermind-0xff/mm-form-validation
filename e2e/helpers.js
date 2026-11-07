/**
 * What the browser specs share: a `test` that fails on any uncaught page error,
 * a server of its own for tests about the server's limits (which live in its
 * process), and the page's controls by what a person would use.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { test as base, expect } from '@playwright/test';

export { expect };

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

/** A separate example server, on the stub: its limits start at zero. */
export async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ['examples/server.js'], {
    env: { ...process.env, PORT: String(port), VIES_STUB: '1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      reject(new Error(`the server exited with ${code}`))
    );
    child.stdout.once('data', resolve);
  });
  child.removeAllListeners('exit');
  return {
    url: `http://127.0.0.1:${port}`,
    stop: () =>
      new Promise((resolve) => {
        child.once('exit', resolve);
        child.kill();
      }),
  };
}

export const test = base.extend({
  /** Uncaught errors in the page fail every test. */
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await use(errors);
      expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],
  /** A server for this test alone. Tests that count checks need it. */
  // eslint-disable-next-line no-empty-pattern -- Playwright reads the fixtures from the pattern
  ownServer: async ({}, use) => {
    const server = await startServer();
    await use(server);
    await server.stop();
  },
});

/** Opens the example page and waits until the forms are bound. */
export async function openExamples(page, origin = '') {
  await page.goto(`${origin}/examples/`);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('form[data-schema]')].every(
      (form) => form.noValidate
    )
  );
}

export const field = (page, form, name) =>
  page.locator(`form[data-schema="${form}"] [data-field="${name}"]`);

export const control = (page, form, name) =>
  page.locator(`form[data-schema="${form}"] [name="${name}"]`);

export const line = (page, form, name) =>
  page.locator(`form[data-schema="${form}"] [data-message-for="${name}"]`);

/** Clicks a segmented control's label, as a person does (its input is invisible). */
export async function pick(page, group, value) {
  await page
    .locator(`#${group} label`, {
      has: page.locator(`input[value="${value}"]`),
    })
    .click();
}

/** Ends every running transition and animation, so computed values are final. */
export async function settleAnimations(page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });
}

export const isPhone = (testInfo) => testInfo.project.name.startsWith('phone');
