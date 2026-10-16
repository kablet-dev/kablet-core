# Kablet Native Store — Focused Build Plan

**Status:** Planning only. No runtime code, migrations, provider credentials or launch claims are introduced by this document.

## 1. Product boundary

Kablet Native Store is the first ecommerce product path. A merchant creates and operates a deliberately limited store on Kablet, while Kablet's existing loop remains the differentiator:

`Visitor signals → Visitor State → governed Decision → Adaptive Experience → deterministic Commerce Action → verified Purchase → Measurement → evidence-based Learning`

The Native Store is not a site-builder-only product and not a chatbot. Shopify Batch A remains preserved as a provider foundation. Shopify Connect Your Store and Batch B are deferred.

## 2. Existing reusable components

| Capability | Repository evidence | Native reuse |
|---|---|---|
| Identity, tenant isolation and approvals | `packages/domain/src/security.ts`, `packages/db/src/security.ts`, security migrations `0019–0030` | Merchant-scoped control-plane mutations, RLS and audit attribution |
| Business truth | `packages/db/src/business-truth.ts`, migration `0001` | Merchant-owned store settings, publication and policy truth |
| Visitor State and sessions | `packages/domain/src/visitor-state.ts`, `packages/db/src/visitor-state.ts`, migrations `0002–0005` | Anonymous shopper state and durable journey lineage |
| Decisions and governance | `packages/domain/src/decision.ts`, `packages/db/src/decision.ts`, `apps/web/lib/policy-governance.ts` | Platform safety → merchant policy → runtime decision enforcement |
| Adaptive experience runtime | `apps/web/components/experience/InteractiveExperience.tsx`, renderer components and `apps/web/lib/interaction-service.ts` | Native storefront compositions and transitions |
| Deterministic actions | `packages/domain/src/action.ts`, `apps/web/lib/action-service.ts` | Cart, reservation, checkout and order mutations behind server authorization |
| Commerce contracts | `packages/domain/src/commerce.ts` | Shared product/variant/money/inventory/provider evidence vocabulary |
| Outcome and measurement foundations | `packages/db/src/measurement.ts`, attribution/conversion modules | Verified purchase lineage, coverage and experiment evidence |
| Shopify adapter patterns | `apps/web/lib/shopify-provider.ts`, `apps/worker/src/shopify-worker.ts`, migration `0031` | Provider boundary, pagination, durable events and recovery patterns; not Native authority |
| Security and verification | `.github/workflows/ci.yml`, `tests/unit`, `tests/integration`, `tests/e2e` | RLS, tenant, browser, migration and regression gates |

## 3. Missing Native capabilities

- Native product, collection, variant, price, inventory and publication persistence with merchant operations.
- Published storefront routing, SSR/crawlable product pages, responsive design and domain strategy.
- Durable carts, line validation, inventory reservation/expiry and idempotent mutations.
- Checkout and payment-provider boundary with server-side verification, unknown outcomes and recovery.
- Native order, refund, cancellation, inventory and merchant operations state machines.
- Native-to-Experience-Runtime capability fixtures for discovery, comparison, reassurance and ready-to-buy states.
- Verified purchase attribution, four distinct revenue quantities and controlled experiment validity checks.
- Launch operations: telemetry, SLOs, restore, support, rollback and pilot controls.

## 4. Architecture boundaries

1. **Authority:** Kablet Native is authoritative for native commerce records. A future external provider remains authoritative for its own connected records; adapters cannot rewrite canonical intelligence or merchant policy.
2. **Security:** Every merchant mutation resolves server-side identity, membership, capability, tenant and approval state. RLS and FORCE RLS remain mandatory where applicable.
3. **Intelligence:** AI may help interpret intent or propose governed experiences. It cannot create inventory, confirm payment, manufacture an order, or claim revenue.
4. **Execution:** Cart, reservation, payment, order, refund and cancellation operations are deterministic, idempotent, auditable and recoverable.
5. **Experience:** The Native Store consumes the existing Experience Runtime. It does not create a Native-only rendering or decision path.
6. **Measurement:** A provider-confirmed/native-confirmed order is evidence of an outcome, not automatically attributable revenue or causal lift.
7. **Privacy:** New visitor-derived commerce data must inherit consent, export, deletion, tenant and downstream-propagation gates.
8. **Conversion Laws:** The native canvas must begin with a useful deterministic experience, reduce unnecessary friction, preserve visitor control, use only approved published truth, and treat verified commerce outcomes—not clicks or visual engagement—as the conversion evidence boundary.

## 5. Implementation slices and acceptance criteria

### NS-01 — Global-ready native commerce authority and catalog truth

Dependencies: Milestone 02 security acceptance and existing `03.01` contracts.

Implement global merchant registration and country-aware eligibility; products, collections, variants, publication, inventory and freshness with explicit ownership and revision semantics; and one primary selling currency per store. Model merchant country, store currency, customer locale, shipping destination and payment-provider availability separately. Support USD, EUR, GBP, AED, CAD, AUD and other approved ISO 4217 currencies, including zero-decimal conventions, using minor units or another explicitly precision-safe representation. Support merchant-configured shipping destinations, zones and rates while keeping future tax-provider integration behind a boundary.

Acceptance: merchant CRUD and eligibility are authenticated and tenant-scoped; no UAE-specific assumption exists; invalid price/currency/variant states and floating-point money are rejected; zero-decimal and fractional currencies are represented correctly; RLS and negative cross-tenant tests pass; unpublished records never appear publicly; catalog revisions and shipping configuration are auditable and deterministic.

Operational requirement for the current one-variant foundation: inventory writes must be invoked only by a merchant-authorized server-side control path that has already resolved organization, business, membership, capability, and approval context. The repository mutation is tenant-scoped and RLS-protected, but it is not itself a merchant UI or actor-authentication boundary. Public storefront requests must remain read-only.

### NS-02 — First globally accessible responsive storefront

Dependencies: NS-01, `04.01–04.02` delivery/design decisions.

Implement a Kablet-owned, responsive, internationally accessible and crawlable storefront with collection/product/variant views, locale-aware presentation that does not silently convert currency, and deterministic no-AI fallback. Accessibility and storefront reachability must remain distinct from payment availability or legal eligibility.

Acceptance: one merchant can publish; an anonymous shopper can browse and select a valid variant; browser/mobile/keyboard/a11y/SEO checks pass; no unavailable or stale value is presented as guaranteed.

### NS-03 — Durable cart with currency and price integrity

Dependencies: NS-01 and NS-02.

Implement tenant-safe cart/session persistence, line validation against the store's primary currency and authoritative catalog revision, idempotent add/update/remove, inventory reservation policy and expiry. Do not introduce shopper-side FX or multi-currency checkout in this slice.

Acceptance: cart survives refresh and adaptation; amounts preserve original currency and precision; invalid/obsolete lines fail safely; concurrent updates cannot over-reserve; retries do not duplicate lines or reservations; tenant isolation and replay tests pass.

#### NS-03.1 — Native cart contract and persistence foundation

Approved cart decisions for the first native slice: anonymous carts persist for 30 days since last valid activity within the same browser; cross-device recovery is deferred; cart lines snapshot SKU, amount, currency, and price revision while current title and image remain catalog truth; stale-price lines remain visible with original and current prices; explicit price acceptance must match the exact current amount, currency, and revision and becomes invalid after any later price change; new unpublished, unavailable, or insufficient-stock additions are rejected; existing invalid lines remain visible with honest status; cart operations never reserve or decrement inventory; cart data follows privacy, minimization, and retention requirements; expired status is enforced on access and cleanup may be deferred.

Implemented in the schema foundation: versioned `native-cart.v1`, `native-cart-line.v1`, and `native-cart-mutation.v1` contracts plus migration `0037_native_cart_foundation.sql`. The migration adds tenant/store-owned carts, cart lines, and idempotency mutation records with opaque token-hash storage, optimistic cart versions, 30-day-compatible expiry fields, SKU/price/revision snapshots, explicit price-acceptance fields, referential integrity, uniqueness constraints, indexes, FORCE RLS, and server-role grants. This slice does not implement cart services, cookies, APIs, canvas rendering, inventory reservation, checkout, payment, or orders.

Price-acceptance invariant: an acceptance is valid only when its stored amount, currency, and price revision exactly equal the current authoritative catalog price. A later catalog revision invalidates the acceptance; no client-provided amount or tenant identifier is authoritative.

Security invariant: cart tables have no anonymous database grants. Future cart service operations must resolve the opaque browser secret, store, organization, and business server-side before setting RLS context. Cart creation and modification must remain deterministic native cart operations, separate from the future checkout/payment action-capability path.

#### NS-03.2 — Native cart API and browser identity boundary

Implemented in the native storefront API: `GET` and explicit `POST` `/api/store/[storeSlug]/cart`, `POST` `/api/store/[storeSlug]/cart/lines`, `PATCH` and `DELETE` `/api/store/[storeSlug]/cart/lines/[lineId]`, and `POST` `/api/store/[storeSlug]/cart/lines/[lineId]/price-acceptance`. The routes resolve the published store server-side, derive organization/business/store context from that record, and delegate all cart truth to the native cart service. Request bodies are strict JSON with bounded size; mutations require a matching `Origin` and configured host; responses are private and non-cacheable. Cart creation requires a 32-byte base64url idempotency key; migration `0038_native_cart_creation_idempotency.sql` stores its hash for a one-hour bootstrap retry window, uses a PostgreSQL transaction advisory lock for concurrent first requests, and supports retry-issued token aliases without storing plaintext bearer tokens. Alias expiry follows the parent cart's sliding expiry on authorized access and mutations. The key is a high-entropy temporary capability and must be generated per browser/cart bootstrap, never reused across visitors.

The browser token is held only in an HttpOnly, SameSite=Lax cookie whose name is derived from the store slug and whose path is scoped to that store's API route. Cookies are Secure in production and renew for 30 days on authorized access. Invalid or expired read cookies are cleared and return an empty cart; mutation attempts never silently replace an expired cart. Expired token aliases and creation records are cleaned in bounded batches during cart operations; no unbounded cleanup runs on a normal request. A valid creation key cannot recover an expired parent cart. Production deployments must set `KABLET_PUBLIC_ORIGIN` to the canonical HTTPS storefront origin. Trusted forwarded headers are disabled by default. `KABLET_TRUSTED_PROXY_HEADERS=true` is allowed only when a trusted reverse proxy strips client-supplied forwarded headers, writes the canonical `x-forwarded-host`, and is explicitly controlled by the deployment; forwarded headers must never be accepted from an untrusted edge.

### NS-04 — Bring-your-own-payments checkout boundary

Dependencies: NS-03 plus owner decisions on global country/eligibility policy, supported currencies, merchant-owned payment-provider selection, provider country coverage/API/onboarding, seller-of-record responsibilities and compliance.

#### NS-04.1 — Native checkout and reservation contracts/schema

Implemented as the foundational contract/schema slice only: versioned native physical/digital checkout session and immutable line snapshot contracts, explicit shipping/contact and not-yet-calculated charge/tax states, reservation lifecycle contracts, provider-neutral payment and verified-order boundaries, migration `0039_native_checkout_reservation_foundation.sql`, tenant/store composite foreign keys, FORCE RLS, reservation lifecycle protection, and bounded expiration indexes. This slice does not create checkout sessions at runtime, reserve or decrement inventory, start payments, persist payment/order records, or render checkout UI.

Reservation invariant: future runtime reservation operations must lock authoritative native product rows and account for active reservations before creating an expiring reservation. Reservations are not inventory decrements; only authenticated payment verification may permit a later atomic reservation commitment and order-creation slice. Unknown payment outcomes remain explicitly unresolved and cannot become paid or failed by assumption.

#### NS-04.2 — Atomic checkout validation and reservation service

Implemented as a server-side repository/service slice: cart ownership and version are revalidated, published catalog truth and explicit stale-price acceptance are checked, merchant shipping/tax calculation is required and fail-closed, product rows are locked in deterministic order, active reservations are counted transactionally, and confirmed reservations expire after 15 minutes without renewal. Durable reservation idempotency hashes prevent duplicate retries and conflicting key reuse. This slice does not expose an API, start payment, decrement inventory, create orders, or commit reservations as paid.

Implement a provider-neutral BYOP adapter boundary. Start with one provider only after verifying country coverage, API compatibility and merchant onboarding requirements; do not assume Stripe Connect, another platform program or a provider choice before that verification. Prefer merchant-owned accounts and provider-hosted checkout, use supported OAuth/authorization where available, and never handle raw card data. Verify payment server-side through authenticated callbacks/webhooks and reconciliation, with explicit confirmation and unknown/pending recovery.

Acceptance: disposable/sandbox payment success, decline, duplicate webhook, timeout and unknown outcome are handled; payment state, order state, fulfillment state and verified-revenue state are separate; the merchant remains seller of record and Kablet does not hold funds, manage payouts or charge transaction commissions; client redirects cannot confirm success; secrets are server-only; provider approval, PCI, security and legal obligations are documented.

### NS-05 — Verified orders and merchant operations

Dependencies: NS-04.

Implement atomic order creation and inventory transition, while keeping payment confirmation, order management, refunds, fulfillment and reconciliation as separate responsibilities and state machines. The merchant remains responsible for fulfillment, refunds, chargebacks and customer obligations under its provider agreement.

Acceptance: only verified provider/native evidence creates a completed order; retries are idempotent; inventory cannot be oversold; refunds/cancellations and delayed outcomes reconcile; merchant can inspect status without secret exposure.

### NS-06 — Adaptive commerce experiences

Dependencies: NS-01 and NS-02; verified catalog truth before product claims.

Add native fixtures and composition rules for discovery, comparison, reassurance and ready-to-buy journeys using Visitor State, Decisions and the existing renderer. The canvas must preserve useful context across transitions, interpret behavioral signals conservatively, and provide a deterministic useful fallback when context or intelligence is unavailable.

Acceptance: the same visitor can transition through governed compositions; decision and exposure lineage is durable; policy and platform safety outrank runtime suggestions; unsupported intent degrades deterministically; no claim, availability, urgency, or recommendation is fabricated; and conversion improvement is not inferred from engagement without verified outcome evidence.

### NS-07 — Verified measurement and first controlled experiment

Dependencies: NS-05 and `06.01–06.04`.

Link verified orders to visitor/session lineage, expose unmatched coverage, retain four distinct revenue quantities in each order's original transaction currency, and run a preregistered control/treatment experiment. Do not aggregate different currencies or claim cross-currency revenue without an explicit FX conversion policy, source, timestamp and audit trail.

Acceptance: assignment is sticky; exposure and outcome windows are explicit; SRM, contamination, maturity and missing-coverage states block causal claims; results can be `INCONCLUSIVE`; no lift is reported without valid evidence.

### NS-08 — Native pilot readiness

Dependencies: NS-01 through NS-07 and `07`, `08.01`.

Complete monitoring, restore, support, rollback, merchant onboarding, legal/privacy/PCI review and pilot dossier.

Acceptance: named owner, SLOs, backup/restore drill, incident playbook, secret rotation, rollback and merchant sign-off exist; a GO/LIMITED GO/NO-GO decision is reproducible.

## 6. First meaningful milestones

**First working storefront:** NS-01 through NS-03 for one merchant and a small catalog. This proves a real native shopper journey and adaptive runtime integration, but not payment or revenue.

**First verified purchase:** NS-04 and NS-05 with a merchant-owned sandbox payment account, provider-hosted/card-data-isolated checkout, server-verified payment outcome, durable order, inventory transition, merchant order visibility and recovery evidence.

**First adaptive conversion experiment:** NS-06 and NS-07 with a deterministic control, one governed treatment, valid exposure/purchase lineage, coverage diagnostics and an honest valid/inconclusive result.

## 7. Explicit deferrals

- Shopify Connect Your Store and Shopify Batch B, including live Shopify installation and provider-order proof.
- Checkout/payment/order/refund features beyond the Native Store scope.
- Multi-warehouse, broad international tax/currency, complex wholesale, marketplace, broad carrier networks and drag-and-drop site building.
- Production payment credentials and live merchant launch until compliance, legal, support and operational gates pass.
- Cross-vertical booking, B2B lead and SaaS execution features; their compatibility remains a contract requirement, not current implementation scope.

## 8. Risks and unresolved decisions

- Initial country eligibility, supported ISO 4217 currencies and zero-decimal handling.
- Payment-provider selection after country coverage, API compatibility and onboarding verification; merchant-owned authorization flow; seller-of-record, refunds, chargebacks and fulfillment responsibilities.
- Shipping destinations, zones and rates; future tax-provider boundary.
- Original-currency revenue reporting and any future FX policy/source.
- Inventory reservation TTL and oversell policy.
- Store domains, SSR/hosting and tenant routing.
- Native order state machine and unknown payment recovery owner.
- Merchant onboarding, support and operational ownership.
- Consent scope for visitor commerce data and deletion propagation.
- Experiment estimand, eligible population, attribution window and minimum evidence.

## 9. Required CI and external gates

Every implementation slice requires typecheck, lint, unit tests, PostgreSQL migration/integration tests, relevant browser tests, `git diff --check` and secret scanning. NS-04/NS-05 additionally require controlled sandbox evidence from the selected merchant-owned payment provider. Live payment, merchant pilot, production provisioning and any future Shopify path require external credentials, infrastructure and human acceptance; mocked tests must never be reported as live verification.
