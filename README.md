# suzukenz gaming

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
公開時には`.env.example`を`.env`へコピーし、実際の公開URLを設定してください。
Cloudflareのビルド環境で`SITE_URL`を設定することもできます。

```dotenv
SITE_URL=https://gaming.your-domain.com
```

`SITE_URL`はHTTPSのオリジンを指定します。サブパス・クエリ・フラグメントは付けません。
設定するとcanonical・OGPのURL・サイトマップ・robots.txtがそのドメインを使用します。
OGPはタイトル・説明などのテキスト情報を出力します。
未設定時には架空のURLを出力せず、`noindex`とクロール拒否のrobots.txtを出力します。

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

- 環境変数：`SITE_URL`に実際の公開URL
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
