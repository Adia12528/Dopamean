# Dopamean Store

Dopamean is a React storefront and studio dashboard backed by an Express API. The API uses local SQLite for development unless `SUPABASE_DB_URL` is configured, in which case it uses Supabase-hosted PostgreSQL.

## Features

- Product catalog, offers, shopping cart, checkout, order tracking, and reviews
- Customer sign-in required to place orders, with saved profile details prefilled at checkout
- Studio dashboard for managing products, orders, offers, and store settings
- Optional Supabase Auth for customer accounts
- Supabase Storage for production image uploads
- Optional Razorpay checkout and payment webhooks
- Separate delivery dashboard

## Requirements

- Node.js 22 or newer
- npm
- For hosted production: a Supabase project, a Vercel project for the frontend, and a Render web service for the API

## Local development

1. Copy `.env.example` to `.env`. Keep `.env` local; it is ignored by Git. Fill in only the values needed for the features you want to run.
2. Install dependencies:

   ```bash
   npm ci
   npm --prefix server ci
   ```

3. Start the API and frontend together:

   ```bash
   npm run dev
   ```

The Vite frontend is available at `http://localhost:5173` and the API at `http://localhost:5000`. Vite proxies `/api` and `/uploads` to the local API. The API uses SQLite by default; configure `SUPABASE_DB_URL` to use PostgreSQL instead.

Run the API or frontend separately with `npm run server` or `npm run client`.

## Environment variables

Use `.env.example` as the local template. Never commit `.env` or put server-only secrets in variables prefixed with `VITE_`; Vite embeds `VITE_` values in the browser bundle.

### API server

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Production | Set to `production` on Render. |
| `PORT` | No | API port; defaults to `5000` locally. Render supplies its own port. |
| `SUPABASE_DB_URL` | Production | PostgreSQL connection string. If omitted locally, the API uses SQLite. |
| `DB_POOL_SIZE` | No | PostgreSQL connection pool size; defaults to `10`. |
| `SUPABASE_URL` | Production | Supabase project URL. |
| `SUPABASE_SECRET_KEY` | Production | Server-only Supabase key for privileged Storage operations. Never expose it to the browser. |
| `SUPABASE_PUBLISHABLE_KEY` | If using customer Supabase Auth | Publishable key used by the API for customer token verification. |
| `SUPABASE_STORAGE_BUCKET` | No | Public Storage bucket for uploaded images; defaults to `media`. |
| `JWT_SECRET` | Production | Admin-session signing secret, at least 32 bytes. |
| `USER_JWT_SECRET` | Production | User-session signing secret, at least 32 bytes and different from `JWT_SECRET`. |
| `ADMIN_PASSCODE` | Production | Initial/admin passcode, at least 12 characters. |
| `CORS_ORIGIN` | Production | Comma-separated HTTPS storefront origins, without paths. |
| `DELIVERY_AGENT_PASSCODE` | No | Optional delivery-agent passcode. |
| `SUPER_ADMIN_ID`, `SUPER_ADMIN_PASSWORD` | No | Optional separate super-admin credentials. Keep the password server-side. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | If using Razorpay | Razorpay API credentials. |
| `RAZORPAY_WEBHOOK_SECRET` | If verifying Razorpay webhooks | Webhook signing secret, not the webhook URL. |
| `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT` | If configuring PayU by environment | PayU India merchant credentials; alternatively, enter them in Studio. |
| `PAYU_CALLBACK_BASE_URL` | If using PayU | Public HTTPS origin of the API, used for PayU success/failure callbacks. |
| `PAYU_CREDENTIALS_ENCRYPTION_KEY` | If saving PayU credentials in Studio | Stable server-only key of at least 32 bytes used to encrypt saved credentials. `JWT_SECRET` is the fallback; rotating the encryption key makes saved PayU credentials unreadable. |

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Production build | HTTPS origin of the deployed API, without a path, query, or credentials. Leave empty locally to use the Vite proxy. |
| `VITE_SUPABASE_URL` | If using customer Supabase Auth | Supabase project URL used by browser sign-in. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | If using customer Supabase Auth | Public Supabase publishable key. Never use a Supabase secret key here. |

Production API startup requires `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `USER_JWT_SECRET`, `ADMIN_PASSCODE`, and `CORS_ORIGIN`. It validates HTTPS origins, signing-secret length, and admin passcode length at startup. Set the same values in the appropriate platform's environment-variable settings; do not commit them.

## Supabase PostgreSQL

1. Create a Supabase project and set a strong database password.
2. In the Supabase dashboard, choose **Connect → Session pooler** and copy the connection string. Replace `[YOUR-PASSWORD]` with the database password; URL-encode reserved characters.
3. Set the connection string as `SUPABASE_DB_URL` in the local `.env` and in Render's environment settings. Do not use a `VITE_` variable for it.
4. Back up the current SQLite database before migrating. With the local database available, run:

   ```bash
   npm --prefix server run migrate:supabase
   ```

   The migration stops if the target database already contains store records. It copies products, offers, orders, reviews, settings, and existing customer password hashes.
5. Start the API. It creates the PostgreSQL tables and indexes automatically. Confirm `/api/health` reports `Supabase PostgreSQL`.

Use the session pooler for hosted environments that need IPv4 connectivity; use the direct connection when the host supports IPv6.

## Customer Supabase Auth

1. In **Authentication → Providers**, enable email sign-in and keep email confirmation enabled.
2. To enable Google, turn on **Google** under **Authentication → Providers**. Create a Google OAuth web client in Google Cloud Console and add the Supabase callback URL shown in the provider settings (usually `https://<project-ref>.supabase.co/auth/v1/callback`) to its authorized redirect URIs. Paste the client ID and secret into Supabase, not the frontend.
3. In **Authentication → URL Configuration**, set the production Site URL and allow the frontend return URLs. OAuth returns to the current page, so allow local frontend URLs such as `http://localhost:5173/**` and the deployed frontend (for example, `https://your-production-domain/**`). For email confirmation, also allow `http://localhost:5173/auth/confirm` and, if used, `http://127.0.0.1:5173/auth/confirm`, plus the deployed frontend's `/auth/confirm` URL.
4. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on the API. Set the same project URL and publishable key as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the frontend.
5. Restart the API and rebuild/redeploy the frontend. The API validates customer access tokens and syncs verified account profiles with PostgreSQL.

Existing customer passwords use the previous application's hash format and cannot be imported into Supabase Auth. Customers need to create an Auth account with their existing email and choose a new password; profile and order history are reconnected by email after verification.

Studio admin access is separate from customer Auth. Keep admin and optional super-admin credentials in server-side settings or deployment secrets.

## Continuous integration

GitHub Actions runs on pushes and pull requests targeting `main`, and can also be started manually from the Actions tab. It uses Node.js 22 and runs:

1. `npm ci`
2. `node --check server/index.js`
3. `npm run lint`
4. `npm run build`

CI validates syntax, lint, and the production frontend build. That build uses `https://api.example.invalid` only to satisfy production URL validation; it is a reserved, non-routable placeholder and must not be used for deployment. CI does not deploy the app or run end-to-end tests. Test checkout, payment, authentication, and order flows separately before production releases.

### Automated versioning and changelogs

The separate **Release Please** workflow watches pushes to `main`. Use Conventional Commit messages so it can determine version bumps:

- `fix: ...` for a patch release.
- `feat: ...` for a minor release.
- `feat!: ...` or a `BREAKING CHANGE:` footer for a major release.
- Other commit types (for example, `docs:` or `chore:`) do not normally trigger a release.

Release Please opens or updates a release pull request. Review and merge it when you want to create the version release. The PR updates the relevant `package.json`, npm lockfile, and `CHANGELOG.md`; merging it creates a GitHub release and component-qualified tag (`dopamean-v...` for the root package and `dopamean-backend-v...` for the backend). Root and backend versions are managed independently. This workflow does not deploy to Vercel or Render.

Before enabling the workflow, create a repository-scoped fine-grained personal access token with **Contents: read/write**, **Pull requests: read/write**, and **Issues: read/write** access, then save it as the `RELEASE_PLEASE_TOKEN` Actions secret. The workflow uses this token so the generated release pull request triggers the existing CI checks. Do not put the token in repository files.

## Production deployment

### Vercel frontend

1. Connect the repository to Vercel and set `VITE_API_BASE_URL` to the Render API's HTTPS origin, with no path (for example, `https://your-api.onrender.com`).
2. If customer Supabase Auth is enabled, also set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Trigger a new deployment after changing frontend environment variables; Vite embeds these values at build time.

### Render API

1. Deploy the `server` directory as a Node web service. The included `render.yaml` uses `server` as the root, installs locked dependencies with `npm ci`, starts `npm start`, and checks `/api/health`. The configured Render `free` plan may spin down when idle and is not suitable for dependable production checkout; choose an always-on plan if reliable availability is required.
2. Set the production API variables listed above in Render. Use unique random signing secrets of at least 32 bytes and an initial admin passcode of at least 12 characters.
3. Set `CORS_ORIGIN` to the exact HTTPS origin of the storefront (for example, `https://your-site.vercel.app`), with no path. Add other HTTPS origins only when intentionally serving them.
4. Create a **public** Supabase Storage bucket named `media`, or set `SUPABASE_STORAGE_BUCKET` to your chosen bucket. The API verifies the bucket is public before accepting uploads, uses its server-only Supabase secret key, and stores public CDN URLs. Production uploads require Storage; local disk is not a persistent production upload destination. A failed upload must be retried rather than saved as a local path or inline data URL.
5. In Studio → **Delivery Pricing by Pincode**, configure zone charges with comma-separated prefixes or inclusive ranges (for example, `4000-4001, 402`), a fallback charge, and optional exact pincode overrides. Exact overrides take priority, then the longest matching prefix; unmapped pincodes use the fallback, while the existing free-shipping threshold overrides all delivery charges. The initial fallback uses the existing standard shipping fee.
6. If customers may attach an optional UPI payment screenshot, create a separate **private** Storage bucket named `payment-proofs`, or set `SUPABASE_PAYMENT_PROOFS_BUCKET` to its name. Do not make this bucket public: screenshots are served only to authenticated Studio admins. Product and UPI QR images continue to use the public `media` bucket.
7. Set `SUPABASE_PUBLISHABLE_KEY` on the API if customer Supabase Auth is enabled. Optionally configure `DELIVERY_AGENT_PASSCODE` and separate super-admin credentials.
8. If enabling Razorpay, configure the API credentials and a webhook for `/api/webhooks/razorpay` with the `payment.captured` event. Set `RAZORPAY_WEBHOOK_SECRET` to the webhook's signing secret, never its URL. Checkout loads the payment SDK only when a customer selects Razorpay.
9. If enabling PayU India, set `PAYU_CALLBACK_BASE_URL` to the same public HTTPS API origin configured as `VITE_API_BASE_URL` on Vercel, and keep `PAYU_CREDENTIALS_ENCRYPTION_KEY` stable. Add the PayU Merchant Key and Salt in **Studio → Payment Gateways**, test first with PayU test credentials, then switch off test mode only when using live credentials. PayU callbacks are hash-checked and successful transactions are verified with PayU before an order is marked paid. The integration follows PayU's [hosted checkout](https://docs.payu.in/docs/prebuilt-checkout-page-integration), [hash generation](https://docs.payu.in/docs/hash-generation), and [Verify Payment API](https://docs.payu.in/reference/verify_payment_api) requirements.
10. After deployment, verify `/api/health` reports `status: ok` (it checks database access), confirm the storefront can reach the API without CORS errors, and test sign-in, product management, checkout, order tracking, image upload, and payment callbacks with provider test credentials before switching to live payments.

Before launch, back up the database and confirm it contains no development/demo customer or order data. Move older uploads and inline image data URLs into Supabase Storage; relative `/uploads/...` paths must resolve against the API origin until migrated. Review backup and retention settings for both the database and Storage.

Keep payment card entry in the payment provider's hosted checkout; do not collect or store card numbers in this application. If a credential has been shared or committed, rotate it before production. Removing a secret from the latest files does not remove it from Git history.
