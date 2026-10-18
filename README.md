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

- Set `NODE_ENV=production`, `SUPABASE_DB_URL`, `JWT_SECRET`, `USER_JWT_SECRET`, and `ADMIN_PASSCODE` in the deployment platform's secret manager. Use unique, randomly generated values. Do not commit `.env`.
- If using Razorpay, set live `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (or configure them in the studio), then configure a Razorpay webhook to call `/api/webhooks/razorpay` for `payment.captured` and set `RAZORPAY_WEBHOOK_SECRET` to the matching webhook secret.
- Build the storefront with `npm run build`. Start the API from the `server` directory with `npm start` after installing its dependencies.
- Serve the built frontend and API behind the same HTTPS origin, routing `/api` and `/uploads` to Express. The application expects a same-origin API in production.
- Back up Supabase data and uploaded images. The app currently writes uploaded images under `server/uploads`, so the API host must provide persistent storage for that directory or uploads must be moved to Supabase Storage before using ephemeral hosting.
- Start with a clean production database or explicitly review imported data. Never launch with demo orders or customer records from a development database.

The API fails to start in production if its required signing secrets and initial admin passcode are missing. Keep payment card entry in the payment provider's hosted checkout; do not collect or store card numbers in this application.
