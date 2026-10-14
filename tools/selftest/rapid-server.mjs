// Tiny local server for the rapid-action self-test. Binds 127.0.0.1 only, port chosen by the OS.
// Counts POSTs and records per variant ('good' | 'bad'). Not part of the skill's shipped helpers.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const LATENCY_MS = 300; // gives the page a visible in-flight window

export function startRapidServer() {
  const state = {};
  const reset = (v) => { state[v] = { posts: 0, deletes: 0, records: [{ id: 'seed' }], nextId: 1 }; };
  reset('good'); reset('bad');
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
    const m = url.pathname.match(/^\/api\/(good|bad)\/(items)(?:\/([^/]+))?$/);
    if (req.method === 'GET' && /^\/rapid-(good|bad)\.html$/.test(url.pathname)) {
      return send(200, readFileSync(join(here, url.pathname.slice(1)), 'utf8'), 'text/html');
    }
    if (!m) return send(404, { error: 'not found' });
    const [, v, , id] = m;
    const s = state[v];
    if (req.method === 'GET' && !id) return send(200, { count: s.records.length });
    await new Promise((r) => setTimeout(r, LATENCY_MS));
    if (req.method === 'POST' && !id) {
      s.posts++;
      s.records.push({ id: 'n' + s.nextId++ });
      return send(201, { ok: true });
    }
    if (req.method === 'DELETE' && id) {
      s.deletes++;
      const i = s.records.findIndex((r) => r.id === id);
      if (i >= 0) { s.records.splice(i, 1); return send(200, { ok: true }); }
      if (v === 'bad') return send(500, 'TypeError: Cannot read properties of undefined\n    at deleteItem (/srv/app/items.js:42:11)');
      return send(404, { error: 'not found' });
    }
    return send(405, { error: 'method not allowed' });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        state,
        reset,
        count: (v) => state[v].records.length,
        stop: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
