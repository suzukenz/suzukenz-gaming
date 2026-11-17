import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import markdownTables from './src/lib/markdown-tables.ts';

const envFile = new URL('./.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

const site = process.env.SITE_URL || undefined;
if (site) {
  const url = new URL(site);
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'SITE_URL は https://example.com の形式で指定してください。',
    );
  }
}

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
