# YALIX CRM Cloudflare Worker — staging scaffold

This directory is an isolated scaffold for the D1 migration. It is not deployed and does not change the current GitHub Pages/Firebase CRM.

## Current endpoints

- `GET /health` — public health response.
- `GET /api/me` — verifies a Firebase ID token, then checks the user's active record in D1.
- `GET /api/products` — admin-only read of D1 products.

All other methods/routes are intentionally not implemented yet. No lead/company/contact writes are available.

## Before local testing

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the ID shown for the `yalix-crm-staging` database in Cloudflare. Never guess the ID.
3. Install dependencies from this directory with `npm install`.
4. Confirm the D1 schema exists. Seed `users` and `authorized_users` from verified Firebase records before testing authenticated endpoints.
5. Use a Firebase ID token obtained by the existing Firebase client SDK; never put service-account keys or ID tokens in source control.

## Security design

- Firebase ID tokens are verified server-side with Google's published secure-token signing keys and strict issuer/audience checks.
- Authorization is read from D1 records; a frontend role or email alone is not trusted.
- CORS uses an explicit origin allowlist.
- The Worker returns no-store JSON and does not expose internal exceptions.

## Important limitations

- This is an initial scaffold, not production-ready migration code.
- D1 tables currently have no migrated Firebase records, so authenticated requests will fail closed until the verified user rows are seeded.
- The current frontend still uses Firestore directly. Do not point the live frontend at this Worker until CRUD coverage, authorization tests, import/export tests, and rollback are completed.
- No deploy workflow, Cloudflare secrets, production route, or live CRM files are changed by this scaffold.
