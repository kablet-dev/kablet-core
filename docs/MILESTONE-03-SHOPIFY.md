# Milestone 03 Batch A — Shopify foundation

This batch implements the provider-neutral commerce foundation and Shopify connection, catalog, and webhook boundaries. Shopify remains authoritative for current catalog, inventory, checkout, orders, payments, refunds, and cancellations.

## Required configuration

Server-only configuration is required for live installation:

- `CONTROL_DATABASE_URL`: server-only database connection for OAuth completion and signed webhook acceptance.
- `KABLET_CREDENTIAL_KEY`: base64-encoded 32-byte credential-encryption key.
- `KABLET_CREDENTIAL_KEY_VERSION`: active encryption-key version.
- `SHOPIFY_CLIENT_ID`: Shopify app client ID.
- `SHOPIFY_CLIENT_SECRET`: Shopify app secret; never expose it to browsers or logs.
- `SHOPIFY_REDIRECT_URI`: exact registered OAuth callback URL.
- `SHOPIFY_API_VERSION`: explicitly selected Shopify Admin API version.
- `KABLET_WORKER_RUN=true`: enables the durable webhook worker.
- `WORKER_POLL_MS`: optional polling interval; defaults to 5000 ms.

The initial requested Shopify scopes are `read_products` and `read_inventory`. Scope changes require reauthorization and must be reviewed against the provider app configuration.

## Flow boundaries

1. An authenticated merchant with `integration.manage` calls the install route.
2. A random state is stored hashed, tenant-scoped, single-use, and expires after ten minutes.
3. The callback verifies Shopify's query HMAC, consumes the state, exchanges the code server-side, verifies the shop identity through Shopify, checks required scopes, encrypts the token, and stores the tenant-scoped connection.
4. Shopify webhooks are verified against the raw body before parsing. A signed event is durably deduplicated in the inbox before a `202` response.
5. The worker discovers active connections through the server-only control role, claims events under tenant RLS, normalizes supported product events, and marks them processed or retryable/dead-lettered.

Provider tokens are never returned in responses or persisted in audit metadata. The repository's credential authorization boundary must be called immediately before any future provider network execution.

## Verification status

- Provider-neutral contracts: implemented with unit coverage.
- Shopify HMAC, OAuth-state, normalization, and credential-boundary fixtures: implemented with offline unit coverage.
- Disposable PostgreSQL catalog/webhook/RLS/deduplication coverage: implemented and executed only when the CI PostgreSQL job runs.
- Live Shopify OAuth, catalog synchronization, webhook delivery, rate limits, and connection health: pending real Shopify development-store verification.
- Checkout, payment, order, refund, cancellation, and commercial reconciliation: Milestone 03.05–03.06, not implemented by Batch A.
