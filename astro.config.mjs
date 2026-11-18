import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import markdownTables from './src/lib/markdown-tables.ts';

const envFile = new URL('./.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

// A missing build variable must not silently exclude the production site.
const siteUrl = process.env.SITE_URL || 'https://game.suzukenz.dev';
const url = new URL(siteUrl);
if (
  url.protocol !== 'https:' ||
  url.pathname !== '/' ||
  url.search ||
  url.hash ||
  url.username ||
  url.password
) {
  throw new Error('SITE_URL は https://example.com の形式で指定してください。');
}
if (
  process.env.SITE_NOINDEX &&
  !['true', 'false'].includes(process.env.SITE_NOINDEX)
) {
  throw new Error('SITE_NOINDEX は true または false を指定してください。');
}
const site = process.env.SITE_NOINDEX === 'true' ? undefined : siteUrl;

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { processor: satteri({ hastPlugins: [markdownTables] }) },
  integrations: site
    ? [sitemap({ filter: (page) => !page.endsWith('/404/') })]
    : [],
});
