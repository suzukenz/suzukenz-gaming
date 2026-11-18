import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import test from 'node:test';
import { parse } from 'yaml';

const dist = new URL('../dist/', import.meta.url);
const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);
const siteUrl = process.env.SITE_URL || 'https://game.suzukenz.dev';
const noindex = process.env.SITE_NOINDEX === 'true';
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

test('記事の表は見出しの対応を保ち、名前付きの領域でキーボード操作できる', async () => {
  for (const guide of guides) {
    const article = await readOutput(`${route(guide)}index.html`);
    const tables = [...article.matchAll(/<table\b[\s\S]*?<\/table>/g)];
    const regions = [
      ...article.matchAll(
        /<div\b([^>]*)>\s*(<table\b[\s\S]*?<\/table>)\s*<\/div>/g,
      ),
    ];
    assert.equal(
      regions.length,
      tables.length,
      `${route(guide)}の表にスクロール領域がありません`,
    );
    for (const [, attributes, table] of regions) {
      assert.match(attributes, /role="region"/);
      assert.match(attributes, /tabindex="0"/);
      assert.match(attributes, /aria-label="[^"]+"/);
      const head = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1];
      assert.ok(head, `${route(guide)}の表に列見出しがありません`);
      for (const [, attributes] of head.matchAll(/<th\b([^>]*)>/g)) {
        assert.match(attributes, /scope="col"/);
      }
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

test('設定なしでも本番のcanonical・サイトマップ・robotsを生成し、明示的なnoindexだけを除外する', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  const robots = await readFile(new URL('robots.txt', dist), 'utf8');
  if (!noindex) {
    const site = new URL(siteUrl);
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
      assert.doesNotMatch(game, /content="noindex/);
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
    assert.match(robots, /Allow: \//);
    assert.doesNotMatch(robots, /Disallow:/);
    assert.ok(!existsSync(new URL('sitemap-index.xml', dist)));
  }
});

test('ページ固有のタイトル・説明・構造化データが本文と一致する', async () => {
  const { site } = await import('../src/site.ts');
  const pages = [
    {
      path: '/',
      title: `ゲーム攻略メモ | ${site.title}`,
      description: site.description,
      type: 'WebSite',
      name: site.title,
    },
    ...games.map((game) => ({
      path: `/${game.id}/`,
      title: `${game.title}攻略メモ | ${site.title}`,
      description: `${game.title}の攻略メモ一覧です。攻略記事を項目別に探せます。`,
      type: 'CollectionPage',
      name: `${game.title}攻略メモ`,
      breadcrumbs: ['トップ', `${game.title}攻略メモ`],
    })),
    ...guides.map((guide) => {
      const game = games.find(({ id }) => id === guide.game);
      return {
        path: route(guide),
        title: `${guide.title} | ${game.title} | ${site.title}`,
        description: guide.description,
        type: 'BlogPosting',
        name: guide.title,
        breadcrumbs: ['トップ', `${game.title}攻略メモ`, guide.title],
        guide,
      };
    }),
  ];
  for (const page of pages) {
    const html = await readOutput(`${page.path}index.html`);
    assert.equal(
      textContent(html.match(/<title>(.*?)<\/title>/s)[1]),
      page.title,
    );
    assert.equal(
      textContent(html.match(/<meta name="description" content="([^"]*)"/)[1]),
      page.description,
    );
    const scripts = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ];
    if (noindex) {
      assert.match(html, /content="noindex, follow"/);
      assert.doesNotMatch(html, /rel="canonical"/);
      assert.equal(scripts.length, 0);
      continue;
    }
    assert.doesNotMatch(html, /content="noindex/);
    assert.equal(scripts.length, 1);
    const data = JSON.parse(scripts[0][1]);
    assert.equal(data['@context'], 'https://schema.org');
    const [entity, breadcrumb] = data['@graph'];
    const url = new URL(page.path, siteUrl).href;
    assert.equal(entity['@type'], page.type);
    assert.equal(entity.name, page.name);
    assert.equal(entity.description, page.description);
    assert.equal(entity.url, url);
    assert.equal(entity.inLanguage, 'ja');
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`));
    if (page.guide) {
      assert.equal(entity.headline, page.guide.title);
      assert.equal(
        entity.datePublished,
        new Date(page.guide.publishedAt).toISOString(),
      );
      assert.equal(
        entity.dateModified,
        new Date(page.guide.updatedAt ?? page.guide.publishedAt).toISOString(),
      );
      assert.equal(entity.mainEntityOfPage, url);
    }
    if (page.breadcrumbs) {
      assert.equal(breadcrumb['@type'], 'BreadcrumbList');
      assert.deepEqual(
        breadcrumb.itemListElement.map(({ name }) => name),
        page.breadcrumbs,
      );
      assert.deepEqual(
        breadcrumb.itemListElement.map(({ position }) => position),
        page.breadcrumbs.map((_, index) => index + 1),
      );
      assert.equal(breadcrumb.itemListElement.at(-1).item, url);
      for (const item of breadcrumb.itemListElement) {
        const target = new URL(item.item);
        assert.equal(target.origin, new URL(siteUrl).origin);
        assert.ok(
          existsSync(new URL(`${target.pathname.slice(1)}index.html`, dist)),
        );
      }
    } else {
      assert.equal(breadcrumb, undefined);
    }
  }
  const notFound = await readOutput('404.html');
  assert.match(notFound, /content="noindex, follow"/);
  assert.doesNotMatch(notFound, /application\/ld\+json/);
});
