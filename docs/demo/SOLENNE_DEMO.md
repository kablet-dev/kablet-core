# SOLENNE local demo merchant

SOLENNE is a fictional, local-only premium skincare merchant for reviewing the native adaptive canvas with a realistic catalog.

## Seed

Use a local PostgreSQL database with the normal migrated schema. The seed refuses production, shared, staging, and non-local database URLs:

```powershell
$env:SOLENNE_DEMO_SEED_ENABLED = 'true'
node --env-file=.env scripts/seed-solenne-demo.mjs
```

Browse [http://127.0.0.1:3000/store/solenne-demo](http://127.0.0.1:3000/store/solenne-demo).

The catalog contains three available products, one unavailable product with zero inventory, and one unknown-stock product with a null inventory quantity. All prices, descriptions, availability, and image references are persisted in the native catalog tables; the canvas does not contain SOLENNE-specific product data.

The product descriptions use cosmetic, non-clinical language only. The images are original fictional demo assets; see `apps/web/public/demo/solenne/ASSET_PROVENANCE.md`.
