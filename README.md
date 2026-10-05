# Kablet Core

Slice 01 establishes the pnpm TypeScript workspace, minimal Next.js web application, worker entry point, typed configuration, Drizzle/PostgreSQL bootstrap, and test tooling.

## Local development

Native PostgreSQL 17 on Windows is the primary local development setup. Keep the PostgreSQL service running on `localhost:5432`, with development database `kablet_dev` owned by the restricted `kablet_dev` role. Integration tests use the separate `kablet_test_manager` role with `CREATEDB` to create unpredictable disposable `kablet_test_<hex>` databases.

Copy `.env.example` to the ignored `.env` file and set the local passwords there. Do not commit `.env` or place credentials in source files, commands, or logs. The application must use `kablet_dev`, never the PostgreSQL administrator role.

From ordinary PowerShell, run:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:migrate
pnpm.cmd db:verify
pnpm.cmd test
pnpm.cmd test:integration
pnpm.cmd test:e2e
```

Docker Compose remains an optional alternative for contributors who use Docker Desktop; it is not required for the native Windows workflow.

## PostgreSQL integration tests

Set `TEST_MANAGER_PASSWORD` in the ignored `.env` file. The integration harness accepts only the local `kablet_test_manager` role connected to the `postgres` database, creates two random `kablet_test_<hex>` databases, migrates and tests them, then verifies ownership before dropping them in `finally` cleanup.

Run `pnpm.cmd test:integration` from ordinary PowerShell. If a run is interrupted, inspect candidates before any cleanup:

```powershell
$env:PGPASSWORD = $env:TEST_MANAGER_PASSWORD
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -p 5432 -U kablet_test_manager -d postgres -c "select datname, pg_get_userbyid(datdba) as owner from pg_database where datname like 'kablet_test_%';"
```

Drop an orphan only after confirming its exact name, owner, and that it is not in use; never use a wildcard or prefix-only deletion. Clear `$env:PGPASSWORD` after inspection.
# Security boundary

Visitor State tenant context is established only by the trusted server-side repository after its authenticated request layer has resolved and authorized the organization and business. Browser or visitor input must never be passed directly to PostgreSQL or used to set `kablet.organization_id` / `kablet.business_id`. The runtime database credentials are server-only; transaction-local settings provide scoping, not authentication.

Existing installations need no role recreation or password rotation. Disposable migration tests require `TEST_ROLE_ADMIN_URL`, a separately supplied role-administrator connection used only to grant `SET ROLE kablet_privacy_owner` for the serialized migration window and revoke it in `finally` immediately afterward. It is not an application credential and is not used for runtime queries. Integration files run sequentially because this membership is cluster-global.

The restricted-role integration checks also require `TEST_APP_PASSWORD` for `kablet_dev`, plus `TEST_UNAUTHORIZED_USER` and `TEST_UNAUTHORIZED_PASSWORD` for an already-provisioned local, non-superuser, non-BYPASSRLS LOGIN role with no authorized-role membership. The harness never creates or drops this global role; provision it once through the local PostgreSQL administrator, grant it only the disposable-database CONNECT/schema USAGE needed by the test, and keep its credentials only in the ignored `.env` file.
