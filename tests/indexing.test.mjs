import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { createTestHarness } from 'wrangler';

test('Workers配信で本番に検索除外ヘッダーを付けず、workers.devは全パスでnoindexになる', async (t) => {
  const server = createTestHarness({
    workers: [{ configPath: './wrangler.jsonc' }],
  });
  t.after(() => server.close());
  await server.listen();

  const files = await readdir(new URL('../dist/', import.meta.url), {
    recursive: true,
  });
  const paths = [
    '/',
    ...files
      .filter((file) => file.endsWith('/index.html'))
      .map((file) => `/${file.replace(/index\.html$/, '')}`),
    '/robots.txt',
    '/favicon.svg',
    ...files
      .filter((file) => /^sitemap.*\.xml$/.test(file))
      .map((file) => `/${file}`),
    '/missing-page/',
  ];
  // The same built assets are served on production, branch and deployment URLs.
  for (const hostname of [
    'game.suzukenz.dev',
    'suzukenz-gaming.xkenji-suzuki.workers.dev',
    'seo-technical-seo-preview-noindex-suzukenz-gaming.xkenji-suzuki.workers.dev',
    'a1b2c3d4-suzukenz-gaming.xkenji-suzuki.workers.dev',
  ]) {
    for (const path of paths) {
      for (const method of ['GET', 'HEAD']) {
        const response = await server.fetch(`https://${hostname}${path}`, {
          method,
          redirect: 'manual',
        });
        const label = `${method} ${hostname}${path}`;
        assert.equal(
          response.status,
          path === '/missing-page/' ? 404 : 200,
          label,
        );
        if (hostname.endsWith('.workers.dev')) {
          assert.match(
            response.headers.get('x-robots-tag') ?? '',
            /\bnoindex\b/i,
            label,
          );
        } else {
          assert.doesNotMatch(
            response.headers.get('x-robots-tag') ?? '',
            /\b(?:noindex|none)\b/i,
            label,
          );
        }
        if (method === 'GET' && path === '/robots.txt') {
          assert.doesNotMatch(await response.text(), /Disallow:/i, label);
        } else {
          await response.arrayBuffer();
        }
      }
    }
  }
});
