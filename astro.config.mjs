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
if (
  process.env.SITE_NOINDEX &&
  !['true', 'false'].includes(process.env.SITE_NOINDEX)
) {
  throw new Error('SITE_NOINDEX は true または false を指定してください。');
}

export default defineConfig({
  site: siteUrl,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { processor: satteri({ hastPlugins: [markdownTables] }) },
  integrations: [
    {
      name: 'site-indexing',
      hooks: {
        'astro:config:setup'({ command, config, updateConfig }) {
          const url = new URL(config.site);
          if (url.protocol !== 'https:' || url.href !== `${url.origin}/`) {
            throw new Error(
              'SITE_URL または --site には https://example.com のようなHTTPSのオリジンを指定してください。',
            );
          }
          const indexable =
            command === 'build' && process.env.SITE_NOINDEX !== 'true';
          updateConfig({
            vite: { define: { __SITE_INDEXABLE__: indexable } },
            integrations: indexable ? [sitemap()] : [],
          });
        },
      },
    },
  ],
});
