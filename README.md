# WalletPass for Logistics

Issue **Google Wallet** passes for logistics parks and high-security restricted areas. Apple Wallet support is built in the codebase but **temporarily unavailable** and will be activated soon.

## Features

- Web studio to design generic, coupon, event ticket, store/loyalty, and boarding / access passes
- Google Wallet “Save to Wallet” links when Issuer ID + service account are configured
- Public pass pages with Add to Google Wallet
- Optional SMS delivery of the pass page link (Twilio or SMSAPI)
- Preview mode when credentials are missing (pass JSON still generated)
- Apple Wallet signing is paused in the product UI/API until activation

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Apple Wallet setup

> **Coming soon.** Pass creation is limited to Google Wallet for now. Apple Wallet configuration is unavailable in the app and will be activated soon. The certificate steps below remain for when the feature is turned back on.

1. In Apple Developer, create a **Pass Type ID**.
2. Create a Pass Type certificate, export as `.p12`, then convert to PEM:

```bash
openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out certs/signerCert.pem
openssl pkcs12 -in Certificates.p12 -nocerts -nodes -out certs/signerKey.pem
# Download Apple WWDR G4 intermediate and save as certs/wwdr.pem
```

3. Set environment variables:

```bash
APPLE_PASS_TYPE_ID=pass.com.your.company
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_ORG_NAME=Your Organization
```

## Google Wallet setup

1. Enable the Google Wallet API in Google Cloud.
2. Create a service account and download the JSON key.
3. In Google Pay & Wallet Console, create an issuer and grant the service account access.
4. Set:

```bash
GOOGLE_ISSUER_ID=3388xxxxxxxx
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

Pass graphics: if the class already exists in Google Pay & Wallet Console, WalletPass for Logistics **reuses its images** and does not overwrite the class. For Generic passes, `heroImage` / `logo` are copied onto each object (required by the API). Optional overrides:

```bash
GOOGLE_HERO_IMAGE_URL=https://your-domain/wallet-assets/logistics-park-gate-hero.png
GOOGLE_LOGO_IMAGE_URL=https://your-domain/path/to/logo.png
```

## SMS setup

When creating a pass, set `recipientPhone` (E.164 like `+48123456789`, or a 9-digit PL number). The server texts the public pass page URL (`/p/:id`) so the recipient can add the pass to Google Wallet.

### Twilio

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_FROM_NUMBER=+15551234567
```

### SMSAPI (Poland)

```bash
SMS_PROVIDER=smsapi
SMSAPI_TOKEN=xxxxxxxx
SMSAPI_FROM=WalletPass for Logistics
```

Optional template (placeholders `{{org}}` and `{{url}}`):

```bash
SMS_MESSAGE_TEMPLATE=WalletPass for Logistics: Your pass from {{org}} — open {{url}}
```

For local testing without a real gateway: `SMS_PROVIDER=log` (message is printed to the server log).

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Credential status (Apple, Google, SMS) |
| `GET` | `/api/passes` | List passes |
| `POST` | `/api/passes` | Create a pass (`recipientPhone`, `sendSms` optional) |
| `POST` | `/api/passes/:id/sms` | Send / resend pass page link by SMS |
| `GET` | `/api/passes/:id` | Pass metadata + URLs |
| `GET` | `/api/passes/:id/apple.pkpass` | Download Apple pass |
| `GET` | `/api/passes/:id/google?redirect=1` | Redirect to Google save URL |
| `GET` | `/p/:id` | Public pass landing page |
| `POST` | `/api/auth/register` | Create account (SendGrid setup email) |
| `POST` | `/api/auth/login` | Log in (session cookie) |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/api/auth/me` | Current session |
| `POST` | `/api/auth/forgot-password` | Password reset email |
| `GET/POST` | `/api/auth/password-setup/:token` | Set / reset password |

Auth pages: `/zarejestruj`, `/zaloguj`, `/przypomnij-haslo`, `/ustaw-haslo/:token`. Accounts are stored under `DATA_DIR/auth` (same volume as passes). Registration emails use SendGrid (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`) — the same relay pattern as LogisYARD.

## Deploy (Railway)

```bash
railway up -y
railway domain
railway variable set PUBLIC_BASE_URL=https://your-domain.up.railway.app
```

`PUBLIC_BASE_URL` must include the scheme (`https://…`). A host-only value like `walletpass-for-logistics.pl` breaks Google Wallet image URLs and Save-to-Wallet links.

### Persist passes across deploys (volume, no database)

Passes are stored as files under `DATA_DIR` (default `/data` in production). Container disk is wiped on every deploy unless you attach a **Railway Volume**:

```bash
# Attach a persistent volume to the WalletPass for Logistics service at /data
railway volume add --service <your-service-name> --mount-path /data
```

Or in the Railway dashboard: **Add volume → mount path `/data`**.

The app auto-detects `RAILWAY_VOLUME_MOUNT_PATH`. Keep `DATA_DIR=/data` (Dockerfile default) so it matches the mount. After the volume is attached, redeploy once — new passes will survive future deploys.

Check status in the studio Setup panel, or:

```bash
curl https://your-domain.up.railway.app/api/status
# look for storage.persistent === true
```

Mount Apple PEMs under `/app/certs` or set the `APPLE_*_PATH` variables. Put the Google service account JSON in `GOOGLE_SERVICE_ACCOUNT_KEY`.

## Scripts

- `npm run dev` — local development
- `npm run build` — compile TypeScript
- `npm start` — run compiled server
