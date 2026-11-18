import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import test from 'node:test';
import { createTestHarness } from 'wrangler';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);
const siteUrl = process.env.SITE_URL || 'https://game.suzukenz.dev';
const noindex = process.env.SITE_NOINDEX === 'true';

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
        } else if (method === 'GET' && path.endsWith('/')) {
          const html = await response.text();
          if (path === '/missing-page/' || noindex) {
            assert.match(
              html,
              /<meta name="robots" content="noindex, follow"/,
              label,
            );
            assert.doesNotMatch(html, /rel="canonical"/, label);
          } else {
            // A missing response header alone does not prove indexability.
            assert.doesNotMatch(
              html,
              /<meta name="robots" content="(?:noindex|none)/i,
              label,
            );
            assert.ok(
              html.includes(
                `<link rel="canonical" href="${new URL(path, siteUrl).href}">`,
              ),
              label,
            );
          }
        } else {
          await response.arrayBuffer();
        }
      }
    }
  }
});
