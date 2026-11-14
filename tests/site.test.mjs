import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import test from 'node:test';
import { parse } from 'yaml';

const dist = new URL('../dist/', import.meta.url);
const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);
const gameDir = new URL('../src/content/games/', import.meta.url);
const games = (await readdir(gameDir))
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));
const guideDir = new URL('../src/content/guides/', import.meta.url);
const guides = await Promise.all(
  (await readdir(guideDir, { recursive: true }))
    .filter((file) => file.endsWith('.md'))
    .map(async (file) => {
      const markdown = await readFile(new URL(file, guideDir), 'utf8');
      const frontmatter = markdown.match(
        /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
      );
      assert.ok(frontmatter, `${file}に記事データがありません`);
      return {
        ...parse(frontmatter[1]),
        body: markdown.slice(frontmatter[0].length),
      };
    }),
);

const published = guides.filter((guide) => guide.draft === false);
const route = (guide) => `/games/${guide.game}/guides/${guide.slug}/`;
const readOutput = (path) =>
  readFile(new URL(path.replace(/^\//, ''), dist), 'utf8');

function textContent(html) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return html
    .replace(/&([a-z]+);/g, (entity, name) => entities[name] ?? entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .trim();
}

test('下書きは記事ページ・一覧・サイトマップを含む公開ファイルに出力しない', async () => {
  const files = await readdir(dist, { recursive: true });
  const outputs = await Promise.all(
    files.filter((file) => /\.(html|xml)$/.test(file)).map(readOutput),
  );
  for (const guide of guides.filter((guide) => guide.draft !== false)) {
    assert.ok(!existsSync(new URL(`${route(guide).slice(1)}index.html`, dist)));
    for (const content of outputs) {
      assert.ok(
        !content.includes(route(guide)),
        `下書き${route(guide)}が公開されています`,
      );
    }
  }
});

test('トップのゲーム一覧からゲーム別の記事一覧を経由して攻略記事を読める', async () => {
  const home = await readOutput('index.html');
  for (const gameId of games) {
    assert.ok(home.includes(`href="/games/${gameId}/"`));
    const game = await readOutput(`games/${gameId}/index.html`);
    for (const guide of published.filter((guide) => guide.game === gameId)) {
      assert.ok(!home.includes(`href="${route(guide)}"`));
      assert.ok(game.includes(`href="${route(guide)}"`));
      const article = await readOutput(`${route(guide)}index.html`);
      assert.ok(article.includes(`href="/games/${gameId}/"`));
      const heading = article.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      assert.ok(heading, `${route(guide)}に記事タイトルがありません`);
      assert.equal(textContent(heading[1]), guide.title);
      if (/^## /m.test(guide.body))
        assert.match(article, /id="contents-title"/);
      assert.ok(
        article.includes(
          `datetime="${new Date(guide.publishedAt).toISOString()}"`,
        ),
      );
    }
  }
});

test('見出しの階層が正しく、サイト内リンク・画像・目次の参照先が存在する', async () => {
  const files = await readdir(dist, { recursive: true });
  const origin = 'https://local.example.test';
  for (const file of files.filter((file) => file.endsWith('.html'))) {
    const html = await readFile(new URL(file, dist), 'utf8');
    assert.equal(
      [...html.matchAll(/<h1(?:\s|>)/g)].length,
      1,
      `${file}のh1は一つにしてください`,
    );
    let previousLevel = 0;
    for (const [, depth] of html.matchAll(/<h([1-6])(?:\s|>)/g)) {
      const level = Number(depth);
      assert.ok(
        level <= previousLevel + 1,
        `${file}の見出し階層が飛んでいます`,
      );
      previousLevel = level;
    }
    const pathname = `/${file.replace(/index\.html$/, '')}`;
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const target = new URL(href, `${origin}${pathname}`);
      if (target.origin !== origin) continue;

      const path = decodeURIComponent(target.pathname).replace(/^\//, '');
      const targetFile = new URL(
        path.endsWith('/') || !path ? `${path}index.html` : path,
        dist,
      );
      assert.ok(existsSync(targetFile), `${file} → ${href} が見つかりません`);
      if (target.hash) {
        const targetHtml = await readFile(targetFile, 'utf8');
        assert.ok(
          targetHtml.includes(
            `id="${decodeURIComponent(target.hash.slice(1))}"`,
          ),
          `${file} → ${href} のアンカーが見つかりません`,
        );
      }
    }
  }
});

test('公開URLの設定に応じてcanonical・サイトマップ・robotsを生成する', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  const robots = await readFile(new URL('robots.txt', dist), 'utf8');
  if (process.env.SITE_URL) {
    const site = new URL(process.env.SITE_URL);
    assert.ok(html.includes(`<link rel="canonical" href="${site}">`));
    assert.doesNotMatch(html, /content="noindex/);
    assert.ok(
      robots.includes(`Sitemap: ${new URL('sitemap-index.xml', site)}`),
    );
    const sitemap = await readFile(new URL('sitemap-0.xml', dist), 'utf8');
    for (const guide of published) {
      assert.ok(sitemap.includes(new URL(route(guide), site).href));
    }
    assert.doesNotMatch(sitemap, /\/404(?:\/|\.html)/);
  } else {
    assert.doesNotMatch(html, /rel="canonical"/);
    assert.match(html, /content="noindex, follow"/);
    assert.match(robots, /Disallow: \//);
    assert.ok(!existsSync(new URL('sitemap-index.xml', dist)));
  }
});
