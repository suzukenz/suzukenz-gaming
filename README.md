# suzukenz gaming

[![Cloudflare build](https://img.shields.io/github/check-runs/suzukenz/suzukenz-gaming/main?nameFilter=Workers%20Builds%3A%20suzukenz-gaming&label=Cloudflare%20build&logo=cloudflare)](https://github.com/suzukenz/suzukenz-gaming/commits/main/)

ゲーム攻略記事をMarkdownとGitで管理し、静的サイトとして公開するプロジェクトです。
Astro + TypeScriptを使用し、Cloudflare Workers Static Assets向けの設定を用意しています。

## ローカルで起動する

Node.js 24系とpnpm 10.33.2を使用します。Nodeの固定バージョンは`.node-version`、pnpmは`package.json`の`packageManager`に記載しています。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

miseでNodeを切り替える場合は、例えば`mise exec node@24.15.0 -- pnpm dev`で起動できます。

表示されたローカルURLを開いてください。

| コマンド          | 内容                                         |
| ----------------- | -------------------------------------------- |
| `pnpm dev`        | 開発サーバーを起動                           |
| `pnpm build`      | 公開する静的ファイルを`dist/`へ出力          |
| `pnpm preview`    | ビルド済みサイトの確認                       |
| `pnpm check`      | Astro・TypeScriptの型検査                    |
| `pnpm test`       | ビルドし、公開ファイルの振る舞いを検証       |
| `pnpm format`     | ソース・Markdownの整形                       |
| `pnpm verify`     | 整形チェック・型検査・テスト                 |
| `pnpm cf:preview` | ビルドし、Cloudflareと同じ設定でローカル配信 |
| `pnpm deploy`     | 検証後、Cloudflareにデプロイ                 |

## ゲームを追加する

`src/content/games/<ゲームID>.md`を作成します。ゲームIDには半角英小文字・数字・ハイフンを使います。
例えば`my-game.md`は、`/my-game/`になります。

```markdown
---
title: ゲームの名前
---

## 個別攻略

- [おすすめの装備](/my-game/guides/equipment/)

## 第1部攻略

- 主人公別のイベント
  - [カイ](/my-game/guides/kai-events/)
  - [セオドラ](/my-game/guides/theodora-events/)
- [クリア前の注意点](/my-game/guides/before-clear/)
```

ゲームのトップはMarkdown本文を目次として表示します。
`##`で分類、箇条書きの入れ子で階層を作り、リンクの順序も自由に決められます。
記事を追加したら、この目次にもリンクを追加してください。記事内の見出しへのリンクも使えます。
本文が空の場合は「攻略メモを準備中です。」と表示します。

## 記事を書く

テンプレートをコピーし、冒頭のメタデータと本文を書き換えます。

```sh
mkdir -p src/content/guides/my-game
cp templates/guide.md src/content/guides/my-game/first-guide.md
```

```yaml
title: 最初に知っておきたいこと
description: 冒険の準備と基本操作についてまとめます。
game: my-game
slug: first-guide
publishedAt: 2026-11-14
```

- `game`はゲームのMarkdownファイル名から拡張子を除いたIDです。
- `slug`には半角英小文字・数字・ハイフンを使います。同じゲーム内で重複できません。
- URLは`/my-game/guides/first-guide/`になります。タイトルやMarkdownファイル名を変えても、`game`と`slug`が同じならURLは維持されます。
- `src/content/guides/`内のすべての記事が、ビルド・デプロイ時に公開されます。
- 記事を更新したら`updatedAt`を追加・変更します。記事ページには「最終更新」として表示し、未指定なら`publishedAt`を使います。
- `gameVersion`は任意で、攻略情報を確認したゲームのバージョンを記録します。
- `publishedAt`は公開メタデータと最終更新日の初期値に使います。日付による予約公開は行いません。
- 本文は`##`から見出しを書きます。記事タイトルはページ側で表示し、`##`・`###`から追従する見出しナビを自動生成します。PCでは右側、スマホでは折りたたみ式で表示します。

記事データの型・必須項目・日付の前後関係は`src/content.config.ts`で検証します。
テストは実際のゲーム情報と記事データを読み、目次の見出し・全記事への導線・パンくずとタイトルの一致・リンク切れを検証します。
記事の追加・差し替えに合わせてテストを書き換える必要はありません。

### 画像を使う

Markdownの近くに画像を置き、相対パスで参照します。
`src/`内の画像はAstroがビルド時に最適化します。

```markdown
![入口の右側にある宝箱](./images/treasure-chest.png)
```

`public/`にはfaviconなど、加工せずそのまま配信するファイルを置きます。

### 表を使う

Markdownの表には、罫線・見出し行の背景・交互の行背景が自動で付きます。
狭い画面では表だけを横スクロールでき、キーボードでは表の領域にフォーカスして左右キーで移動できます。
スクロール領域の名前には、表のキャプション、なければ直前の見出しを使います。
記事側では通常のMarkdown記法で表を書けば適用されます。

## フォント

英数字にはInterのLatinサブセット（可変ウェイト100〜900）を使用します。
`@fontsource-variable/inter`のWOFF2をサイトと一緒に配信し、日本語はシステムフォントへフォールバックします。
本文とサイト名のフォントは`src/styles/global.css`の`--font-sans`で共通管理しています。
フォントのライセンスは`public/fonts/inter-OFL.txt`に同梱しています。

## 公開URLとメタデータ

サイト名と説明は`src/site.ts`で変更できます。
`description`はTOPのゲーム一覧の上と、サイト共通のメタデータに使います。
本番URLの既定値は`https://game.suzukenz.dev`です。`SITE_URL`が未設定または空文字でも、
通常の`pnpm build`はこのURLのcanonical・OGP・サイトマップを生成し、通常ページに`noindex`を付けません。
Cloudflare側で環境変数を追加しなくても本番を検索対象にできます。
URLを変更する場合だけ`.env.example`を`.env`へコピーするか、ビルド環境で`SITE_URL`を上書きします。

```dotenv
SITE_URL=https://game.suzukenz.dev
```

`SITE_URL` と `--site` にはHTTPSのオリジンを指定します。サブパス・クエリ・フラグメント・認証情報を含むURLはビルドエラーになります。
設定するとcanonical・OGPのURL・サイトマップ・robots.txtがそのドメインを使用します。
`pnpm build --site https://example.com` を指定すると、そのビルドではCLIのURLが優先されます。`SITE_NOINDEX=true` は `--site` を指定した場合も有効です。
previewでも`SITE_URL`には本番URLを使い、preview自身をcanonicalにしないでください。
記事のタイトルにはゲーム名も含め、ゲームの目次には固有の説明を出力します。
OGPはタイトル・説明などのテキスト情報を出力します。構造化データはTOPに`WebSite`、
ゲームの目次に`CollectionPage`、記事に`BlogPosting`、目次と記事に`BreadcrumbList`を出力します。
記事の公開日・更新日はMarkdownの値を使い、存在しない著者情報や評価は追加しません。
`pnpm dev`は`SITE_URL`にかかわらずHTMLに`noindex, follow`を付け、canonical・構造化データを出力しません。
検索対象にしない静的ビルドを明示的に作る場合は`SITE_NOINDEX=true pnpm build`を使います。
この場合は全ページに`noindex, follow`を付け、canonical・構造化データ・サイトマップを出力しません。
`SITE_NOINDEX`は未設定・空文字・`false`で通常公開、`true`で検索除外です。それ以外の値はビルドエラーになります。
`SITE_URL`を空にするだけでは検索除外になりません。`pnpm preview`と`pnpm cf:preview`はビルド結果をそのまま配信するため、
ローカル配信でもHTMLから検索除外したい場合は`SITE_NOINDEX=true pnpm cf:preview`のように指定します。
robots.txtはクロールを許可します。`Disallow: /`を併用すると検索エンジンが`noindex`を読めなくなるためです。
404は設定の有無にかかわらず`noindex`で、サイトマップと構造化データの対象外です。

### 公開後の検索確認

1. Google Search Consoleで`https://game.suzukenz.dev`の所有権を確認し、`https://game.suzukenz.dev/sitemap-index.xml`を送信します。
2. URL検査でTOP・ゲームの目次・記事の取得結果、canonical、インデックス可否を確認し、必要に応じて再クロールを依頼します。
3. リッチリザルトテストで記事・パンくずを確認します。`WebSite`のサイト名はGoogleのサイト名ガイドも参照してください。
4. 登録済みのpreviewがあれば、そのURLの`noindex`を確認し再クロールを待ちます。急ぐ場合は対象previewのSearch Console削除ツールを検討します。

コード変更だけで所有権確認やサイトマップ送信は完了しません。検索順位・インデックス登録・リッチリザルトの表示は保証されません。
記事内容の正確さ・更新と、Search Consoleでの継続的な確認も必要です。

- [Googleのnoindexの説明](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [記事の構造化データ](https://developers.google.com/search/docs/appearance/structured-data/article)
- [パンくずの構造化データ](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- [Googleのサイト名](https://developers.google.com/search/docs/appearance/site-names)

## Cloudflareに公開する

Astro側は`output: 'static'`です。SSR用アダプターは不要で、生成された`dist/`だけを配信します。

`wrangler.jsonc`に以下を設定済みです。

- 静的ファイルの配信元：`./dist`
- URL末尾のスラッシュを統一
- 見つからないURLにカスタム404ページとHTTP 404を返す

公開するときは`SITE_URL`とWranglerのプロジェクト名を確認し、次のコマンドを実行します。

```sh
pnpm exec wrangler login
pnpm deploy
```

Git連携でWorkers Buildsを使う場合は、Node.jsを`.node-version`に合わせ、次を設定します。

- 環境変数：通常は不要。公開URLを変える場合だけ`SITE_URL`を上書き。本番に`SITE_NOINDEX=true`を設定しないこと
- ビルドコマンド：`pnpm verify`
- デプロイコマンド：`pnpm exec wrangler deploy`

記事の修正は再ビルド・再デプロイで反映されます。
GitHub Actionsはpush・Pull Requestで検証のみを行います。

### PRブランチのプレビュー

`wrangler.jsonc` の `previews: {}` により、ブランチごとのWorker Previewを利用できます。
静的アセット・互換性設定はトップレベルのままで、本番のデプロイ設定は変更しません。

Cloudflareの対象Workerで **Settings > Build > Branch control > Enable Preview Builds** を有効にし、次の設定を使います。

- Production branch：`main`
- Build command：`pnpm verify`
- Deploy command（本番）：`pnpm exec wrangler deploy`
- Preview command：`pnpm exec wrangler preview`

すでにPreview commandが実行されている場合は、画面設定の変更は不要です。
PRブランチへpushするとプレビュー用ビルドが動き、成功後のURLはCloudflareのPreviewsまたはPRのチェック・コメントから確認できます。
Preview URLは標準で公開されます。秘密情報を記事へ含めないでください。

#### previewの検索除外

この構成はCloudflare **Workers Static Assets + Worker Previews**です。Pagesではありません。
Workersの`workers.dev` Preview URL（ブランチと個別deployment）には、Cloudflareが標準で
`X-Robots-Tag: noindex`を付けます。独自ドメインのPreview URLには自動では付きません。
Pagesにもpreview用の同様の標準ヘッダーがありますが、当サイトの根拠はWorkersの仕様です。

`public/_headers`で`https://:worker.:account.workers.dev/*`に`X-Robots-Tag: noindex`を明示し、
previewと標準のWorkersホスト名を検索対象から外します。
本番の`game.suzukenz.dev`にはこのルールは適用しません。
previewの独自ドメインを追加する場合は、そのホスト名に限定した`_headers`ルールを追加するか、Cloudflare Accessを設定してください。
`noindex`は対応する検索エンジン向けの指示で、アクセス制限ではありません。

配信後は、Cloudflareのチェックに出る実際のpreview URLを指定して確認します。

```sh
curl -sSI https://game.suzukenz.dev/
curl -sSI https://<preview-name>-suzukenz-gaming.xkenji-suzuki.workers.dev/
```

本番の通常ページに`noindex`がなく、previewには`X-Robots-Tag: noindex`があることを確認します。
記事・`robots.txt`・`sitemap-index.xml`も確認し、previewの`robots.txt`がクロールを妨げていないことを確認してください。
同じ静的ファイルを配信するため、previewでもcanonicalとサイトマップ内のURLは本番を指します。
CIは環境変数未設定で `pnpm verify` を実行し、URL上書きと明示的な検索除外は生成ファイルで検証します。
Workersのローカル配信ではホスト名別のヘッダー、本番とpreviewのトップページのnoindex・canonical、存在しないURLの404応答を検証します。

- [Workers Previews](https://developers.cloudflare.com/workers/previews/)
- [Workers previewの独自ドメインと検索除外](https://developers.cloudflare.com/workers/previews/custom-domains/#protect-preview-content)
- [Static Assetsのヘッダールール](https://developers.cloudflare.com/workers/static-assets/headers/)
- [参考：Pages previewの標準ヘッダー](https://developers.cloudflare.com/pages/configuration/preview-deployments/#preview-indexing-by-search-engines)

静的アセットの配信・保存は無料です。Workers Freeのビルド枠は月3,000分、Preview上限は1 Workerあたり100個です。
有料プランへ変更した場合は月6,000ビルド分を超えると従量課金があるため、利用量を確認してください。

- [Previewの設定](https://developers.cloudflare.com/workers/previews/configuration/)
- [ビルドの料金・上限](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)
- [静的アセットの料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## 構成

```text
src/
  components/      記事の見出しナビ
  content/
    games/         ゲーム情報・目次（Markdown）
    guides/        攻略記事・画像
  content.config.ts 記事データのスキーマ
  layouts/         共通HTML・メタデータ
  lib/             記事の取得・URL・日付表示
  pages/           トップ・ゲーム別目次・記事・404
  scripts/         見出しナビのスクロール連動
  site.ts          サイト名・説明
  styles/          共通CSS
templates/         新規記事のテンプレート
tests/             公開ファイルの検証
```
