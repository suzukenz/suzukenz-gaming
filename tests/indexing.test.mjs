import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import test from 'node:test';
import { createTestHarness } from 'wrangler';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);
const siteUrl = process.env.SITE_URL || 'https://game.suzukenz.dev';
const noindex = process.env.SITE_NOINDEX === 'true';

test('Workersの本番・previewで検索ヘッダー、配信HTML、404応答が正しい', async (t) => {
  const server = createTestHarness({
    workers: [{ configPath: './wrangler.jsonc' }],
  });
  t.after(() => server.close());
  await server.listen();

  const production = 'https://game.suzukenz.dev';
  const preview = 'https://branch-suzukenz-gaming.xkenji-suzuki.workers.dev';
  for (const origin of [production, preview]) {
    const response = await server.fetch(origin + '/', { redirect: 'manual' });
    assert.equal(response.status, 200, origin);
    const header = response.headers.get('x-robots-tag') ?? '';
    if (origin === preview) {
      assert.match(header, /\bnoindex\b/i, origin);
    } else {
      assert.doesNotMatch(header, /\b(?:noindex|none)\b/i, origin);
    }

    const html = await response.text();
    if (noindex) {
      assert.match(
        html,
        /<meta name="robots" content="noindex, follow"/,
        origin,
      );
      assert.doesNotMatch(html, /rel="canonical"/, origin);
    } else {
      assert.doesNotMatch(
        html,
        /<meta name="robots" content="(?:noindex|none)/i,
        origin,
      );
      assert.ok(
        html.includes(
          `<link rel="canonical" href="${new URL('/', siteUrl).href}">`,
        ),
        origin,
      );
    }
  }

  for (const hostname of [
    'suzukenz-gaming.xkenji-suzuki.workers.dev',
    'a1b2c3d4-suzukenz-gaming.xkenji-suzuki.workers.dev',
  ]) {
    const asset = await server.fetch(`https://${hostname}/favicon.svg`, {
      method: 'HEAD',
      redirect: 'manual',
    });
    assert.equal(asset.status, 200, hostname);
    assert.match(
      asset.headers.get('x-robots-tag') ?? '',
      /\bnoindex\b/i,
      hostname,
    );
  }

  const missing = await server.fetch(preview + '/__missing__/', {
    redirect: 'manual',
  });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('x-robots-tag') ?? '', /\bnoindex\b/i);
  assert.match(
    await missing.text(),
    /<meta name="robots" content="noindex, follow"/,
  );
});
