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
const games = await Promise.all(
  (await readdir(gameDir))
    .filter((file) => file.endsWith('.md'))
    .map(async (file) => ({
      id: file.replace(/\.md$/, ''),
      ...(await readMarkdown(new URL(file, gameDir))),
    })),
);
const guideDir = new URL('../src/content/guides/', import.meta.url);
const guides = await Promise.all(
  (await readdir(guideDir, { recursive: true }))
    .filter((file) => file.endsWith('.md'))
    .map((file) => readMarkdown(new URL(file, guideDir))),
);

async function readMarkdown(file) {
  const markdown = await readFile(file, 'utf8');
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(frontmatter, `${file}に記事データがありません`);
  return {
    ...parse(frontmatter[1]),
    body: markdown.slice(frontmatter[0].length),
  };
}

const route = (guide) => `/${guide.game}/guides/${guide.slug}/`;
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

test('トップのゲーム一覧からゲーム別の目次を経由してすべての攻略記事を読める', async () => {
  const home = await readOutput('index.html');
  for (const { id: gameId, body } of games) {
    assert.ok(home.includes(`href="/${gameId}/"`));
    const game = await readOutput(`${gameId}/index.html`);
    assert.deepEqual(
      [...game.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((match) =>
        textContent(match[1]),
      ),
      [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
      `${gameId}の目次の見出しと並び順が一致しません`,
    );
    for (const guide of guides.filter((guide) => guide.game === gameId)) {
      assert.ok(!home.includes(`href="${route(guide)}"`));
      assert.ok(
        game.includes(`href="${route(guide)}"`),
        `${route(guide)}が記事一覧にありません`,
      );
      const article = await readOutput(`${route(guide)}index.html`);
      assert.ok(article.includes(`href="/${gameId}/"`));
      const heading = article.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      assert.ok(heading, `${route(guide)}に記事タイトルがありません`);
      assert.equal(textContent(heading[1]), guide.title);
      const outline = article.match(/<aside\b[^>]*>[\s\S]*?<\/aside>/)?.[0];
      const articleHeadings = [
        ...article.matchAll(/<h[23]\b[^>]*id="([^"]+)"[^>]*>/g),
      ].map((match) => match[1]);
      if (articleHeadings.length > 0) {
        assert.ok(outline, `${route(guide)}に追従ナビがありません`);
        assert.match(outline, /aria-label="目次"/);
        assert.deepEqual(
          [...outline.matchAll(/href="#([^"]+)"/g)].map((match) =>
            decodeURIComponent(match[1]),
          ),
          articleHeadings,
          `${route(guide)}の追従ナビが記事の見出しと一致しません`,
        );
      } else {
        assert.equal(outline, undefined);
      }
      const articleHeader = article.match(
        /<article\b[^>]*>\s*<header\b[^>]*>([\s\S]*?)<\/header>/,
      )?.[1];
      assert.ok(articleHeader, `${route(guide)}に記事ヘッダーがありません`);
      assert.match(articleHeader, /<dt\b[^>]*>最終更新<\/dt>/);
      assert.deepEqual(
        [...articleHeader.matchAll(/<time\b[^>]*datetime="([^"]+)"/g)].map(
          (match) => match[1],
        ),
        [new Date(guide.updatedAt ?? guide.publishedAt).toISOString()],
      );
    }
  }
});

test('パンくず・見出しが正しく、サイト内リンク・画像・目次の参照先が存在する', async () => {
  const files = await readdir(dist, { recursive: true });
  const origin = 'https://local.example.test';
  for (const file of files.filter((file) => file.endsWith('.html'))) {
    const html = await readFile(new URL(file, dist), 'utf8');
    assert.equal(
      [...html.matchAll(/<h1(?:\s|>)/g)].length,
      1,
      `${file}のh1は一つにしてください`,
    );
    const currentPage = html.match(
      /<li[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/li>/,
    );
    if (currentPage) {
      const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      assert.equal(
        textContent(currentPage[1]),
        textContent(heading[1]),
        `${file}のパンくずとページタイトルが一致しません`,
      );
    }
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
    for (const { id: gameId } of games) {
      const url = new URL(`/${gameId}/`, site).href;
      assert.ok(sitemap.includes(url));
      const game = await readOutput(`${gameId}/index.html`);
      assert.ok(game.includes(`<link rel="canonical" href="${url}">`));
    }
    for (const guide of guides) {
      const url = new URL(route(guide), site).href;
      assert.ok(sitemap.includes(url));
      const article = await readOutput(`${route(guide)}index.html`);
      assert.ok(article.includes(`<link rel="canonical" href="${url}">`));
      assert.doesNotMatch(article, /content="noindex/);
    }
    assert.doesNotMatch(sitemap, /\/404(?:\/|\.html)/);
  } else {
    assert.doesNotMatch(html, /rel="canonical"/);
    assert.match(html, /content="noindex, follow"/);
    assert.match(robots, /Disallow: \//);
    assert.ok(!existsSync(new URL('sitemap-index.xml', dist)));
  }
});
