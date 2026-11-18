import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { dev } from 'astro';
import { pagePaths } from './page-paths.mjs';

test('Windowsのビルド出力からもゲーム目次と記事の配信URLを列挙する', () => {
  const files = [
    'index.html',
    'fefw\\index.html',
    'fefw\\guides\\animals\\index.html',
  ];
  assert.deepEqual(pagePaths(files), ['/', '/fefw/', '/fefw/guides/animals/']);
});

test('開発サーバーは本番URLが既定でもnoindexを返す', async (t) => {
  const server = await dev({ server: { host: '127.0.0.1', port: 0 } });
  t.after(() => server.stop());
  const origin = `http://127.0.0.1:${server.address.port}`;
  const files = await readdir(new URL('../dist/', import.meta.url), {
    recursive: true,
  });
  for (const path of pagePaths(files)) {
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
