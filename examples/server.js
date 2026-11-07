/**
 * The example pages and their server half (`npm run examples`): serves the
 * pages, the built package (dist) and its sources (for the source maps), and
 * answers `POST /api/<form>` with the same schema the page uses, and
 * `POST /api/vat-check` for the page's VAT gate. Set `VIES_STUB=1` to stay off the
 * real VIES: a number ending in 00 isn't registered, in 99 the service is down.
 * Development only: listens on 127.0.0.1.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { answerVatCheck, viesGate } from '../dist/esm/gates/index.js';
import { parseAsync } from '../dist/esm/index.js';
import { forms } from './forms.js';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 5178);
const served = ['examples', 'dist', 'src'].map((dir) => join(root, dir) + sep);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

async function viesStub(_url, { body }) {
  const { vatNumber } = JSON.parse(body);
  if (vatNumber.endsWith('99')) return new Response('{}', { status: 503 });
  return Response.json({ valid: !vatNumber.endsWith('00') });
}

const vies = viesGate(process.env.VIES_STUB ? { fetch: viesStub } : {});

function reply(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(
    typeof body === 'string' || body instanceof Buffer ?
      body
    : JSON.stringify(body)
  );
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new Error('too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url ?? '/', 'http://localhost');
  } catch {
    return reply(res, 400, 'Bad request', 'text/plain');
  }
  if (url.pathname === '/api/vat-check' && req.method === 'POST') {
    let body;
    try {
      body = await readJson(req);
    } catch {
      return reply(res, 400, { error: 'invalid_json' });
    }
    return reply(
      res,
      200,
      await answerVatCheck(vies, body, req.socket.remoteAddress ?? '')
    );
  }
  if (url.pathname.startsWith('/api/')) {
    const form =
      Object.hasOwn(forms, url.pathname.slice(5)) ?
        forms[url.pathname.slice(5)]
      : undefined;
    if (req.method !== 'POST' || form === undefined)
      return reply(res, 404, { error: 'not_found' });
    let body;
    try {
      body = await readJson(req);
    } catch {
      return reply(res, 400, { error: 'invalid_json' });
    }
    // the same check the page ran: a value the page accepts passes here too
    const result = await parseAsync(form, body, {
      gates: { vies: vies.for(req.socket.remoteAddress ?? '') },
    });
    return reply(res, result.ok ? 200 : 400, result);
  }
  if (url.pathname === '/') {
    res.writeHead(302, { location: '/examples/' });
    return res.end();
  }
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return reply(res, 400, 'Bad request', 'text/plain');
  }
  const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
  if (!served.some((dir) => file.startsWith(dir)))
    return reply(res, 404, 'Not found', 'text/plain');
  try {
    reply(
      res,
      200,
      await readFile(file),
      types[extname(file)] ?? 'application/octet-stream'
    );
  } catch {
    reply(res, 404, 'Not found', 'text/plain');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Examples: http://localhost:${port}/examples/`);
});
