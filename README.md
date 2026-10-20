# Dopamean Store

React storefront and Studio dashboard with an Express API. Local development uses SQLite; when `SUPABASE_DB_URL` is configured, the server uses Supabase-hosted PostgreSQL.

## Local development

1. Copy `.env.example` to `.env` and replace the placeholder secrets.
2. Install the frontend dependencies with `npm install`.
3. Install the backend dependencies with `npm --prefix server install`.
4. Start both the API backend and the storefront frontend together with a single command:
   ```bash
   npm run dev
   ```
   *(Or individually: `npm run server` and `npm run client`)*

The Vite development server runs on `http://localhost:5173` and proxies `/api` and `/uploads` to `http://localhost:5000`.

## Continuous integration

GitHub Actions runs the CI workflow on pushes and pull requests targeting `main`, and it can also be started manually from the Actions tab. The workflow uses Node.js 22 and runs:

1. `npm ci` to install the exact dependencies from `package-lock.json`.
2. `node --check server/index.js` to validate the API entrypoint syntax.
3. `npm run lint` to lint the project.
4. `npm run build` to type-check and create the production frontend bundle.

The workflow does not deploy the app or run end-to-end tests. The project currently has no automated test script; verify checkout, payment, authentication, and order flows separately before production releases.

## Supabase PostgreSQL setup

1. Create a Supabase project and set a strong database password.
2. In the Supabase dashboard, select **Connect**, choose **Session pooler**, and copy its connection string. Replace `[YOUR-PASSWORD]` with the project database password. Reserved characters in the password must be URL-encoded.
3. Put the complete string in the local `.env` as `SUPABASE_DB_URL=...`. Do not put it in frontend variables or commit it. Use the session pooler for IPv4-only hosts; use the direct connection when the host supports IPv6.
4. While the current SQLite database is still available, take a backup, then run `npm --prefix server run migrate:supabase`. The migration stops if the Supabase database already contains store records; it copies products, offers, orders, reviews, settings, and existing customer password hashes.
5. Start the API with `npm --prefix server start`. It creates the Postgres tables and indexes automatically. Check `/api/health`; it should report `Supabase PostgreSQL`.

## Supabase Auth setup

1. In **Authentication → Providers**, enable Email sign-in and keep email confirmation enabled. In **Authentication → URL Configuration**, set the production Site URL and add the local URL (`http://localhost:5173/**`) plus the production URL to Redirect URLs.
2. Copy the Supabase project URL and its publishable key from **Project Settings → API Keys**. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the API, and the same values as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the storefront in `.env` / deployment settings. A publishable key can be public; never expose a secret/service-role key.
3. Restart both the API and Vite. New customer registration and sign-in will use Supabase Auth. The API validates each Supabase access token and syncs the verified account profile into PostgreSQL. Existing profile/order data with the same email is retained when the customer first signs in after confirming their email.
4. Existing passwords are stored using the old app's hash format and cannot be imported into Supabase Auth. Customers need to create a Supabase Auth account with their existing email and choose a new password. The profile sync reconnects their existing profile and order history by email.

Studio admin access remains separate from customer Auth. Keep `SUPER_ADMIN_ID`, `SUPER_ADMIN_PASSWORD`, and the admin passcode only in server secrets.

## Production deployment

- Deploy the frontend to Vercel and the Express API as a separate Render web service (or provide an equivalent HTTPS API origin). Set the Vercel environment variable `VITE_API_BASE_URL` to the API's HTTPS origin, without a path. Production frontend builds fail if it is missing or invalid; the Vercel SPA rewrite does not proxy API requests.
- Set these API environment variables in Render's secret manager: `NODE_ENV=production`, `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `USER_JWT_SECRET`, `ADMIN_PASSCODE`, and `CORS_ORIGIN`. Use unique randomly generated signing secrets of at least 32 bytes and an initial admin passcode of at least 12 characters. `CORS_ORIGIN` must be the exact HTTPS storefront origin (for example, `https://dopamean.vercel.app`), without a path. Add a comma-separated origin only when you intentionally serve the API from multiple storefronts.
- Create a **public** Supabase Storage bucket (default name `media`) and set `SUPABASE_STORAGE_BUCKET` if you use another name. The API uses `SUPABASE_SECRET_KEY` to upload images and stores their public CDN URLs. Production uploads fail explicitly if storage is unavailable; they never report success after writing to ephemeral local disk. Never expose `SUPABASE_SECRET_KEY` through a `VITE_` variable.
- If customer Supabase Auth is enabled, also set `SUPABASE_PUBLISHABLE_KEY` on the API and `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` on Vercel. Publishable keys are public; secret keys are not.
- For delivery-agent access, set a unique `DELIVERY_AGENT_PASSCODE` or configure one in the studio. Separate super-admin credentials are optional; if configured, keep them in server-side settings or deployment secrets.
- If using Razorpay, set live `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (or configure them in the studio), then configure a Razorpay webhook to call `/api/webhooks/razorpay` for `payment.captured`. Set `RAZORPAY_WEBHOOK_SECRET` to the webhook's signing secret, **not** to the webhook URL. Checkout's SDK is loaded only when a customer chooses Razorpay.
- Set `CORS_ORIGIN` on the API to the Vercel site's exact HTTPS origin. Verify the frontend can reach `/api/health` at the configured API origin after deployment.
- Build the storefront with `npm run build`. Start the API from the `server` directory with `npm start` after installing its dependencies.
- Back up Supabase database data and verify Storage bucket backups/retention separately. Relative `/uploads/...` image paths resolve against the API origin; checked-in seed images are included with the API. Move any older user uploads from `server/uploads` into the configured Storage bucket before deploying to an ephemeral API host.
- Start with a clean production database or explicitly review imported data. Never launch with demo orders or customer records from a development database.

The API fails to start in production if its database, storage, CORS, signing-secret, or initial admin configuration is missing. Keep payment card entry in the payment provider's hosted checkout; do not collect or store card numbers in this application. If any credentials have been shared outside the deployment secret manager, rotate them before launch.
