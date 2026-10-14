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

## 5. Implementation slices and acceptance criteria

### NS-01 — Native commerce authority and catalog truth

Dependencies: Milestone 02 security acceptance and existing `03.01` contracts.

Implement products, collections, variants, money, publication, inventory and freshness with explicit ownership and revision semantics.

Acceptance: merchant CRUD is authenticated and tenant-scoped; invalid price/currency/variant states are rejected; RLS and negative cross-tenant tests pass; unpublished records never appear publicly; catalog revisions are auditable and deterministic.

### NS-02 — First responsive storefront

Dependencies: NS-01, `04.01–04.02` delivery/design decisions.

Implement a Kablet-owned, responsive, crawlable storefront with collection/product/variant views and deterministic no-AI fallback.

Acceptance: one merchant can publish; an anonymous shopper can browse and select a valid variant; browser/mobile/keyboard/a11y/SEO checks pass; no unavailable or stale value is presented as guaranteed.

### NS-03 — Durable cart

Dependencies: NS-01 and NS-02.

Implement tenant-safe cart/session persistence, line validation, idempotent add/update/remove, inventory reservation policy and expiry.

Acceptance: cart survives refresh and adaptation; invalid/obsolete lines fail safely; concurrent updates cannot over-reserve; retries do not duplicate lines or reservations; tenant isolation and replay tests pass.

### NS-04 — Checkout and payment boundary

Dependencies: NS-03 plus owner decisions on geography, currency, merchant of record, Stripe Connect model and compliance.

Implement the payment adapter boundary, server-created payment intent, explicit confirmation, webhook verification and unknown/pending recovery. Never handle raw card data.

Acceptance: disposable/sandbox payment success, decline, duplicate webhook, timeout and unknown outcome are handled; payment state and order state are separate; client redirects cannot confirm success; secrets are server-only.

### NS-05 — Verified orders and merchant operations

Dependencies: NS-04.

Implement atomic order creation, inventory transition, order lifecycle, refund/cancellation states, merchant order view and reconciliation.

Acceptance: only verified provider/native evidence creates a completed order; retries are idempotent; inventory cannot be oversold; refunds/cancellations and delayed outcomes reconcile; merchant can inspect status without secret exposure.

### NS-06 — Adaptive commerce experiences

Dependencies: NS-01 and NS-02; verified catalog truth before product claims.

Add native fixtures and composition rules for discovery, comparison, reassurance and ready-to-buy journeys using Visitor State, Decisions and the existing renderer.

Acceptance: the same visitor can transition through governed compositions; decision and exposure lineage is durable; policy and platform safety outrank runtime suggestions; unsupported intent degrades deterministically.

### NS-07 — Verified measurement and first controlled experiment

Dependencies: NS-05 and `06.01–06.04`.

Link verified orders to visitor/session lineage, expose unmatched coverage, retain four distinct revenue quantities, and run a preregistered control/treatment experiment.

Acceptance: assignment is sticky; exposure and outcome windows are explicit; SRM, contamination, maturity and missing-coverage states block causal claims; results can be `INCONCLUSIVE`; no lift is reported without valid evidence.

### NS-08 — Native pilot readiness

Dependencies: NS-01 through NS-07 and `07`, `08.01`.

Complete monitoring, restore, support, rollback, merchant onboarding, legal/privacy/PCI review and pilot dossier.

Acceptance: named owner, SLOs, backup/restore drill, incident playbook, secret rotation, rollback and merchant sign-off exist; a GO/LIMITED GO/NO-GO decision is reproducible.

## 6. First meaningful milestones

**First working storefront:** NS-01 through NS-03 for one merchant and a small catalog. This proves a real native shopper journey and adaptive runtime integration, but not payment or revenue.

**First verified purchase:** NS-04 and NS-05 with a sandbox payment account, server-verified payment outcome, durable order, inventory transition, merchant order visibility and recovery evidence.

**First adaptive conversion experiment:** NS-06 and NS-07 with a deterministic control, one governed treatment, valid exposure/purchase lineage, coverage diagnostics and an honest valid/inconclusive result.

## 7. Explicit deferrals

- Shopify Connect Your Store and Shopify Batch B, including live Shopify installation and provider-order proof.
- Checkout/payment/order/refund features beyond the Native Store scope.
- Multi-warehouse, broad international tax/currency, complex wholesale, marketplace, broad carrier networks and drag-and-drop site building.
- Production payment credentials and live merchant launch until compliance, legal, support and operational gates pass.
- Cross-vertical booking, B2B lead and SaaS execution features; their compatibility remains a contract requirement, not current implementation scope.

## 8. Risks and unresolved decisions

- Merchant-of-record, Stripe Connect account/charge model, fees, refunds and chargebacks.
- Initial geography, currency, tax and shipping model.
- Inventory reservation TTL and oversell policy.
- Store domains, SSR/hosting and tenant routing.
- Native order state machine and unknown payment recovery owner.
- Merchant onboarding, support and operational ownership.
- Consent scope for visitor commerce data and deletion propagation.
- Experiment estimand, eligible population, attribution window and minimum evidence.

## 9. Required CI and external gates

Every implementation slice requires typecheck, lint, unit tests, PostgreSQL migration/integration tests, relevant browser tests, `git diff --check` and secret scanning. NS-04/NS-05 additionally require controlled payment-provider sandbox evidence. Live payment, merchant pilot, production provisioning and any future Shopify path require external credentials, infrastructure and human acceptance; mocked tests must never be reported as live verification.
