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

表示されたローカルURLを開いてください。開発サーバーでは下書きも確認でき、記事に「下書き」と表示されます。

| コマンド          | 内容                                         |
| ----------------- | -------------------------------------------- |
| `pnpm dev`        | 下書きを含む開発サーバー                     |
| `pnpm build`      | 公開する静的ファイルを`dist/`へ出力          |
| `pnpm preview`    | ビルド済みサイトの確認。下書きは含まない     |
| `pnpm check`      | Astro・TypeScriptの型検査                    |
| `pnpm test`       | ビルドし、公開ファイルの振る舞いを検証       |
| `pnpm format`     | ソース・Markdownの整形                       |
| `pnpm verify`     | 整形チェック・型検査・テスト                 |
| `pnpm cf:preview` | ビルドし、Cloudflareと同じ設定でローカル配信 |
| `pnpm deploy`     | 検証後、Cloudflareにデプロイ                 |

## ゲームを追加する

`src/content/games/<ゲームID>.json`を作成します。ゲームIDには半角英小文字・数字・ハイフンを使います。
例えば`my-game.json`は、`/games/my-game/`になります。

```json
{
  "title": "ゲームの名前"
}
```

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
draft: true
```

- `game`はゲームのJSONファイル名から拡張子を除いたIDです。
- `slug`には半角英小文字・数字・ハイフンを使います。同じゲーム内で重複できません。
- URLは`/games/my-game/guides/first-guide/`になります。タイトルやMarkdownファイル名を変えても、`game`と`slug`が同じならURLは維持されます。
- 公開するときに`draft: false`へ変更します。`draft`を省略すると下書きです。
- 下書きは開発サーバーでのみ表示され、公開ビルドの記事ページ・一覧・サイトマップには含まれません。
- 記事を更新したら`updatedAt`を追加・変更します。記事一覧は更新日、未指定なら公開日の降順です。
- `gameVersion`は任意で、攻略情報を確認したゲームのバージョンを記録します。
- `publishedAt`は表示用の公開日です。日付による予約公開は行いません。
- 本文は`##`から見出しを書きます。記事タイトルはページ側で表示し、`##`・`###`から目次を生成します。

記事データの型・必須項目・日付の前後関係は`src/content.config.ts`で検証します。
架空のゲーム「サンプルクエスト」と記事は、実際のコンテンツに置き換えてください。
テストは実際のゲーム情報と記事データを読み、公開対象・導線・リンク切れを検証します。
記事の追加・差し替えに合わせてテストを書き換える必要はありません。

### 画像を使う

Markdownの近くに画像を置き、相対パスで参照します。
`src/`内の画像はAstroがビルド時に最適化します。

```markdown
![入口の右側にある宝箱](./images/treasure-chest.png)
```

`public/`にはfaviconなど、加工せずそのまま配信するファイルを置きます。

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

Cloudflareへの接続・公開はまだ行っていません。
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

## 構成

```text
src/
  components/      記事一覧の共通部品
  content/
    games/         ゲーム情報（JSON）
    guides/        攻略記事・画像
  content.config.ts 記事データのスキーマ
  layouts/         共通HTML・メタデータ
  lib/             記事の公開条件・URL・日付表示
  pages/           トップ・ゲーム別一覧・記事・404
  site.ts          サイト名・説明
  styles/          共通CSS
templates/         新規記事のテンプレート
tests/             公開ファイルの検証
```
