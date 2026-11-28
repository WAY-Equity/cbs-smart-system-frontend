# CBS Base — 共通業務データベース デモ

CBSの物件台帳を中心に、作業予定・報告書・見積案件・関連資料を確認する日本語のフロントエンドデモです。すべて架空のデータです。

## 起動

```sh
pnpm install
pnpm dev
```

ビルド・確認：`pnpm build`。Node.js 22.6以降を使用します。

## 操作

- 左メニューから一覧へ移動。物件名、件名、担当者の検索、拠点・状態の絞り込みができます。
- 名称を押すと詳細を表示。物件詳細から作業、報告書、資料を開けます。
- 新規登録・編集で変更を保存。報告書は必要資料が不足すると「確認待ち」「提出済み」へ進めません。
- CSVは現在の絞り込み結果を出力します。
- 左下のリセットで、このブラウザのデモデータを初期状態に戻せます。

## データと保存

React / TypeScript / Vite。ログインにはAuth0のメール確認コードを使用します。業務データ用のAPI・バックエンドはありません。保存先はlocalStorageです。ブラウザ間・端末間では共有されません。実データや機密情報は入力しないでください。添付資料はサンプル本文で、ファイルのアップロード・メール送信・顧客への提出は行いません。「提出済み」はデモ上の状態です。

参考UI：cn-logisticsのサイドナビ、カード、一覧・詳細構成。元プロジェクトの環境変数、顧客データ、認証やバックエンドは使用していません。

業務の根拠と設計上の仮定は [DATA_MODEL.md](DATA_MODEL.md) を参照してください。

## 自動化デモ（CBS説明用）

左メニュー「自動化デモ」から4つの体験を選べます。

1. **E4 清掃報告書**：対象物件・完了作業を選び、写真の配置先を指定 → 下書き作成 → 内容を記入・照合 → 報告書一覧に「確認待ち」で保存。
2. **F1 神戸設備報告書**：点検記録の数値・写真を転記。作成支援と点検担当の確認を分けて表示。
3. **O1 大阪設備報告書**：同じ操作を大阪の物件で体験。点検担当が作成・修正する分担を表示。
4. **G1 勤怠入力・集計**：模擬読取り → スタッフBの原本と転記結果を照合 → B1終了を12:30、B2終了を17:00へ修正 → 両行の原本確認 → 集計 → CSV出力。Aは10時間、Bは8時間。

写真は模式図、原記録は架空です。OCR・画像認識・顧客指定Excelの実生成は実装していません。報告書はサンプル様式で、所見をAI生成せず担当者が記入します。勤務時間は分単位の単純計算で、日跨ぎ・給与・残業・丸め規則は対象外です。勤怠の体験状態は画面を離れると初期化され、確認済みCSVで持ち出せます。報告書は既存のlocalStorageへ保存されます。

## 拠点切り替え

左上の「神戸 / デモ環境」から大阪へ切り替えられます。初回・再読込み時は神戸です。大阪は深色テーマです。各一覧、件数、予定、関連資料は選択した拠点に絞り込みます。自動化デモは神戸にE4・F1、大阪にO1、両方にG1を表示します。保存データは共通のまま保持し、表示だけを切り替えます。

## 本番公開

公開URL: https://d3kk6kbbp4x94g.cloudfront.net/

main への push で GitHub Actions がテストとビルドを行い、プライベート S3 バケットへ公開します。CloudFront がサイトを配信します。AWS インフラは `WAY-Equity/way-infra` の `cbs-smart-system/` で管理します。公開先でもデータは各利用者のブラウザ内に保存されます。公開先のURL変更に伴い、旧URLのブラウザ内データは新URLに自動で引き継がれません。

## 実資料の共有ページ

`?page=upload` に、複数ファイルと説明をまとめて送信する資料共有ページを追加しています。デモのlocalStorageとは独立したGoogle Apps Script / Drive連携です。保存先は専用のGoogle Driveフォルダです。構成・保存先・アクセス制御・検証状況は [uploads/README.md](uploads/README.md) を参照してください。

## Auth0 login

The demo and `?page=upload` entry are behind the CBS Auth0 login screen. The
public SPA configuration is in `src/auth-config.ts`; no client secret is used.
Authorization Code with PKCE uses the official Auth0 React SDK and keeps tokens
in memory. The app checks session validity every minute and on tab visibility.
Login returns to the original local route, including the upload page.
External return URLs and stale OAuth callback parameters are rejected.

Local development uses port **5173**; preview uses **4173** (strict ports). Auth0
callbacks and logout URLs have a trailing `/`, and web origins have no path:

- `http://localhost:5173/`
- `http://127.0.0.1:5173/`
- `http://localhost:4173/`
- `http://127.0.0.1:4173/`
- `https://d3kk6kbbp4x94g.cloudfront.net/`

Auth0 tenant: `dev-m4cnup0ujpc2l7wn.us.auth0.com`. Application: **CBS**, client
`hJYhsluI7zSN0JvevTtUODyMvInFN036`, type Single Page Application. Enable only
the passwordless `email` connection for this application.

The deployed Actions are versioned in `auth0/`: `post-login.cjs` is attached to
Post Login; `pre-registration.cjs` is attached to Pre User Registration. Both
are scoped to the CBS client and require the exact invited email addresses.
Post Login additionally requires `email_verified === true` and the email
connection. Keep all three email allowlists synchronized: `auth0/pre-registration.cjs`,
`auth0/post-login.cjs`, and `uploads/Code.gs` (`ALLOWED_EMAILS`). When adding or
removing someone, update all three, redeploy both Auth0 Actions, and publish a new
Apps Script deployment version. Otherwise login and upload access can disagree.
Keep the Apps Script check: the tenant UserInfo endpoint alone does not restrict
tokens to the CBS application.

Auth0 configuration completed on 2026-11-27: Identifier First is enabled and
the email connection's blanket signup block is replaced by the deployed
eight-address registration allowlist (approved by the owner). The email
connection is enabled only for CBS. Database and Google connections are disabled
for CBS. The hosted login-id screen uses the CBS logo and Japanese
wording, with signup link text removed. The same allowlist is enforced again
after email verification on every login. A live uninvited-address attempt
was denied. Both Actions now return the Japanese message
“このメールアドレスではログインできません。ご案内済みのメールアドレスをご使用ください。”


Japanese (`ja`) is enabled in the tenant supported languages. The CBS SDK
already sends `ui_locales=ja`; enabling the locale prevents fallback to English.
Japanese login-id custom text is recorded in `auth0/login-id.ja.json`. The
passwordless email-code screen uses Auth0’s built-in Japanese translations,
including validation errors, edit, continue, and resend controls. These hosted
settings and translated Actions are live; local UI copy removals await deployment.

This is a static fictional-data demo. Auth0 gates the normal application UI;
static assets are still public. The Apps Script upload service retains its
server-side Auth0 UserInfo validation and the same eight-email allowlist. Future business APIs must independently
validate Auth0 tokens and enforce authorization server-side.

### Deployment verification — 2026-11-27

Published the tested build to the existing `site-e91f237` bucket and CloudFront
`E22CAQUIC8KOUP`; entry-page invalidation completed. Public HTML and JavaScript
matched the local build byte-for-byte. Live verification completed email OTP
login as `ju@wayequity.co`, returned to the authenticated demo, and verified
logout and anonymous protection of `?page=upload`. Localhost reached the hosted
email OTP screen and a non-allowlisted address was denied by the live guard.
All 15 automated tests passed. No OTP or token is stored in repository files.

### Japanese OTP email template

The Japanese subject and CBS-branded body are saved on the passwordless email
connection and recorded in `auth0/passwordless-email.ja.subject.txt` and
`auth0/passwordless-email.ja.html`. The three-minute expiry matches the existing
180-second connection setting. **Delivery is pending a custom email provider:**
Auth0's built-in development sender ignores custom email templates. Auth0 still uses its built-in provider while WAY SES production approval is pending.
Do not claim Japanese email delivery until a provider is connected and tested.


### WAY SES setup — 2026-11-27

- Region: `ap-northeast-1`; account: `089601768612`.
- Sender planned: `CBSスマートシステム <cbs@wayequity.co>`.
- Created SES domain identity `wayequity.co` with 2048-bit Easy DKIM and added
  its three CNAME verification records to Route 53 zone `Z0793828332JATNBWFS1S`.
- Enabled account-level suppression for both bounces and complaints.
- Submitted a transactional production-access request; AWS review is pending.
- Prepared `auth0/ses-send-policy.json` to restrict a dedicated Auth0 IAM user's
  send permission to this sender and the eight invited recipients. This policy
  is not attached yet; no new access keys have been created.
- Do not activate SES in Auth0 while the account is in sandbox: CBS recipients
  are outside the verified WAY domain and would lose OTP delivery.
- After approval: confirm DKIM success, provision a dedicated send-only IAM user,
  securely connect its credentials to Auth0's Amazon SES provider, set the sender
  on both provider and passwordless connection, and verify receipt of a Japanese
  OTP through the actual Auth0 flow. Never store AWS keys in this repository.


### Feedback portal deployment

Set the repository-level Actions variable `CBS_FEEDBACK_ORIGIN` to the deployed portal origin (currently `https://d23dpjv1ust0j7.cloudfront.net`). The build workflow passes it as `VITE_CBS_FEEDBACK_ORIGIN`; production builds require an HTTPS URL. For a local production build, set that environment variable before `pnpm build`. Local development defaults to `http://127.0.0.1:5174`.

Deploy the portal's matching `cbs-feedback-init` listener before this frontend. It validates the parent window and configured origin, then replies with ready and current answer state; referrer headers are not used. The feedback portal still uses separate HTTP Basic authentication. Browsers that block authentication inside a cross-origin iframe may prevent the form from loading; the separate-tab fallback has been removed from the UI.

Pull-request builds without repository variables use `https://feedback.invalid` only for validation. PR artifacts are never deployed; main/release builds still require the real portal variable.

Uploads use the existing Auth0 login. Tokens are passed in memory through an origin-checked, frame-bound message bridge, never in URLs. Apps Script verifies each token through the fixed Auth0 UserInfo endpoint and requires a verified passwordless identity in the eight-email allowlist. Closing the popup preserves the form and does not cancel an upload.

Auth0 intentionally uses its `localstorage` cache to survive refreshes. Cached tokens are readable by same-origin JavaScript and persist across browser sessions; shared-computer users should log out when finished. Normal token expiry still applies; the eight-email allowlist remains enforced by Auth0.
