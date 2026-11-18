import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { dev } from 'astro';

test('開発サーバーは本番URLが既定でもnoindexを返す', async (t) => {
  const server = await dev({ server: { host: '127.0.0.1', port: 0 } });
  t.after(() => server.stop());
  const origin = `http://127.0.0.1:${server.address.port}`;
  const files = await readdir(new URL('../dist/', import.meta.url), {
    recursive: true,
  });
  const paths = [
    '/',
    ...files
      .filter((file) => file.endsWith('/index.html'))
      .map((file) => `/${file.replace(/index\.html$/, '')}`),
  ];
  for (const path of paths) {
    const response = await fetch(new URL(path, origin));
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<meta name="robots" content="noindex, follow"/, path);
    assert.doesNotMatch(html, /rel="canonical"|application\/ld\+json/, path);
  }
  const robots = await fetch(new URL('/robots.txt', origin));
  assert.equal(robots.status, 200);
  assert.equal(await robots.text(), 'User-agent: *\nAllow: /\n');
});
