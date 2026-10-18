# Kablet V1 Shipping Plan

**Branch:** `feature/lean-native-store`
**Status:** execution source of truth for the first commercially usable V1
**Relationship:** this plan narrows execution; it does not replace the long-term architecture in [`KABLET-MASTER-COMPLETION-MAP.md`](KABLET-MASTER-COMPLETION-MAP.md).

## How to use this plan

Kablet V1 ships a focused, merchant-grounded adaptive storefront quickly while preserving the platform's long-term contracts and safety boundaries. Work is completed in the five stages below, in order. A stage is complete only when its relevant browser/API → route → service → disposable PostgreSQL → persisted result → rendered response tests pass.

The plan distinguishes local proof, provider sandbox validation, assisted merchant operation, and public self-service launch. Mocked providers are never presented as real provider validation.

## Kablet V1 in plain English

A merchant supplies the truth: products, prices, availability, policies, brand, and permitted actions. Kablet observes permitted visitor context, interprets a request, selects a governed composition, and renders the canvas around that intent.

The canvas is the storefront and the response. A visitor can enter, discover, compare, understand authoritative facts, add to cart, check out, and receive a verified result without Kablet inventing claims or gaining payment authority.

The V1 proof is not an autonomous agent swarm. The six intelligence roles are logical responsibilities in one governed runtime:

1. Context Manager — resumes store-scoped visitor/session context.
2. Intent Interpreter — maps known signals and bounded language to structured intent.
3. Decision Strategist — applies approved deterministic rules.
4. Experience Composer — selects a validated canvas composition.
5. Action Coordinator — exposes only actions the runtime can execute.
6. Learning Analyst — collects evidence and supports manual review; it does not self-modify production rules.

Merchant truth remains authoritative for catalog, price, inventory, shipping, tax, payment, and order state.

## The five locked V1 stages

### Stage 1 — Rule-Based Adaptive Intelligence

Complete the practical V1 intelligence engine using the six logical roles above. Known visitor signals use deterministic merchant-grounded rules. Ambiguous requests may use a narrowly governed real AI provider for interpretation only; the resulting decision and composition remain rule-based, validated, and merchant-constrained.

Stage 1 must support new and returning visitors, discovery, product-specific needs, comparison, reassurance, purchase readiness, and session context. Rules must be selected, prioritized, versioned, and linked to approved canvas compositions.

Autonomous learning, arbitrary AI-generated UI, and six separate agents are explicitly excluded.

### Stage 2 — Complete Customer UI and Design System

Create and polish reusable components and tokens for entry, intelligence rail, product cards, spotlight, comparison, reassurance, cart, checkout, responsive layouts, transitions, loading, empty, and error states. Every state must render real supported intelligence output and merchant-authoritative data.

### Stage 3 — Kablet HQ and Demo Validation

Build a lean private operator interface with merchant/store selection, session exploration, chronological event timelines, visitor context, selected rule, decision reason, composition/exposure lineage, verified outcomes, defined aggregate metrics, rule inspection/editing/validation/versioning/publication/rollback, and manual optimization.

Collect meaningful privacy-safe events, not passwords, payment details, unrestricted keystrokes, or sensitive form contents. Enforce access control, consent/retention boundaries, and tenant isolation. Validate diverse journeys using SOLENNE with connected browser/database tests.

### Stage 4 — Core Commerce Completion

Audit the existing native commerce foundation and finish only V1-critical gaps in catalog, inventory, cart, checkout, provider payments, verified orders, fulfillment, refunds/cancellations, recovery, and merchant policies. Do not rebuild verified functionality. Real provider validation remains mandatory before live payments.

### Stage 5 — Merchant Dashboard and Onboarding

Implement merchant operations and repeatable onboarding for both intended paths:

- Kablet Native Store.
- Shopify/Headless connection.

The stage includes identity, store setup, catalog and policies, payment setup, orders, intelligence controls, publication/readiness, and minimum merchant reporting. Shopify, billing, domain/SEO, security, support, and other launch dependencies must be explicit rather than assumed away.

## Stage 1 evidence and current state

### Already complete from P1 and earlier slices

| Capability | Evidence | Status |
|---|---|---|
| Store-scoped anonymous visitor/session bootstrap | `apps/web/lib/native-intelligence-api.ts`, `packages/db/src/interaction.ts`, `packages/db/src/visitor-state.ts` | DONE |
| Persisted observations and Visitor State revisions | `packages/domain/src/visitor-state.ts`, `packages/db/src/visitor-state.ts` | DONE for current native signals |
| Governed deterministic Decision and composition | `packages/domain/src/decision.ts`, `packages/domain/src/experience.ts`, `packages/db/src/native-intelligence.ts`, `apps/web/lib/native-canvas.ts` | DONE for entry/discovery/comparison |
| Native canvas rendering and authorized actions | `apps/web/components/native/AdaptiveNativeCanvas.tsx`, `NativeWorkspace.tsx`, `NativeGuidance.tsx` | DONE for implemented compositions |
| Merchant-grounded guidance contract | `packages/domain/src/native-guidance.ts`, `packages/db/src/native-intelligence.ts` | DONE for bounded discovery, product, comparison, and reassurance guidance |
| Route and browser boundary | `apps/web/app/api/store/[storeSlug]/intelligence/route.ts`, `tests/e2e/solenne-demo.spec.ts` | DONE; reported 37/37 |
| PostgreSQL intelligence boundary | `tests/integration/native-intelligence.integration.test.ts` | DONE; reported 5/5 |
| Exposure, experiment, and verified-order lineage | `packages/db/src/native-experiment.ts`, `packages/db/src/native-attribution.ts`, migrations `0052`–`0054` | DONE for existing offline foundation |
| Evidence collection for manual review | `packages/db/src/native-evidence.ts`, `packages/domain/src/native-evidence.ts`, `apps/web/app/api/store/[storeSlug]/evidence/route.ts` | DONE for bounded event capture and lineage review; operator UI remains future work |

P1 evidence is Codex-reported and preserved from the preceding work: Playwright 37/37, PostgreSQL intelligence integration 5/5, and web/domain/DB typechecks passing. This plan does not rerun those suites.

### Remaining Stage 1 milestones

#### S1-M1 — Versioned rule catalog and composition policy

**Purpose:** make rule selection explicit, prioritized, explainable, versioned, and associated with approved compositions.

**Reuse:** `packages/domain/src/decision.ts`, `experience.ts`, `native-guidance.ts`; `packages/db/src/native-intelligence.ts`; `apps/web/lib/native-canvas.ts`; existing merchant policy and experiment constraints.

**Implemented behavior:** `packages/domain/src/native-rule.ts` defines the closed `native-rule.v1` contract and condition vocabulary. `packages/db/src/native-rule.ts` provides draft → validate → approve → activate, disable, and rollback operations. Migration `0055_native_rule_catalog.sql` stores immutable, tenant/store-scoped versions, enforces active-key uniqueness, protects definitions with a trigger, and records selected rule lineage on `visitor_decisions`.

**Boundaries:** native intelligence route → rule resolver → Decision persistence → composition response → exposure. The resolver must be store/tenant scoped and must never authorize price, inventory, payment, or order state.

**Connected tests:** `tests/integration/native-intelligence.integration.test.ts` proves control-plane lifecycle, runtime authoring denial, same-priority deterministic tie-breaking, selected-rule Decision lineage, rollback/disable behavior, and disposable PostgreSQL isolation. `tests/e2e/native-intelligence.spec.ts` proves the real route response carries the active rule and rendered discovery composition; the full disposable orchestration passed 38/38, including P1, cart, checkout, experiments, and SOLENNE regressions.

**Acceptance:** satisfied for the implemented closed vocabulary: one deterministic rule resolution produces one explainable approved composition and records rule identifier/version; invalid, inactive, or unavailable rules fall back safely without blocking shopping. Rules do not select products, authorize commerce, or override experiment/payment/order authority.

**Exclusions:** dashboard UI, autonomous promotion, LLM calls, arbitrary UI generation, and experiment redesign.

**Dependencies:** P1 contracts. **Status: DONE for the bounded rule catalog and composition boundary; HQ management UI and broader S1 coverage remain future work.**

#### S1-M2 — Complete V1 intent and context coverage

**Purpose:** extend the bounded vocabulary from current discovery/comparison/guidance behavior to product-specific needs, reassurance, purchase readiness, returning context, and safe clarification.

**Reuse:** `AdaptiveNativeCanvas.tsx`, `NativeGuidance.tsx`, Visitor State repositories, native catalog/policy repositories, and existing workspace compositions.

**Implemented behavior:** the existing rule evaluator now covers explicit discovery preferences and purchase-readiness guidance in addition to discovery, comparison, product, and reassurance. Guidance-only Decisions include a validated request fingerprint, so different modes do not accidentally reuse stale rule lineage while identical requests remain idempotent. Unknown inventory returns safe uncertainty and never becomes cart authorization.

**Boundaries:** browser signal → intelligence API → persisted observation/state → rule resolution → authorized composition/guidance → rendered canvas; commerce remains independently available if intelligence is unavailable.

**Journey coverage:**

| Journey | Result | Evidence |
|---|---|---|
| New visitor discovery | DONE | `tests/e2e/native-intelligence.spec.ts`, `tests/e2e/native-store.spec.ts` |
| Explicit availability preference | DONE | `native.discovery.available` rule, focused PostgreSQL test, browser-rendered guidance test |
| Specific product need | DONE | Product-specific guidance and spotlight actions in `packages/db/src/native-intelligence.ts`, SOLENNE spotlight E2E |
| Returning visitor context | DONE | Persisted visitor intent is recovered without skipping cinematic entry |
| Comparison | DONE | Governed comparison composition and factual comparison E2E |
| Reassurance | DONE | Active-policy and missing-policy fallback tests |
| Purchase readiness | DONE | `purchase_readiness` guidance, sellability/unknown-stock guards, SOLENNE browser test |
| Intent change | DONE | Explicit signal updates state/rule/composition; stale-response protection remains green |
| Unsupported or unclear input | DONE | Deterministic safe discovery fallback with no fabricated claims |

**Connected tests:** `tests/integration/native-intelligence.integration.test.ts` covers preference selection, returning context, purchase readiness, unknown inventory, idempotency, rule lineage, and rollback. The complete disposable orchestration passed 40/40, including browser-rendered composition differences, stale-session recovery, race protection, cart/checkout, experiments, and SOLENNE.

**Acceptance:** satisfied for the bounded V1 vocabulary: each supported journey has a server-authorized composition or guidance response, preserves relevant visitor context, fails closed when merchant truth is missing, keeps explicit intent ahead of weaker context, and does not produce fabricated claims.

**Exclusions:** model-provider integration, support ticketing, new commerce authority, and autonomous personalization.

**Dependencies:** S1-M1 and existing Customer Experience components. **Status: DONE for the bounded V1 journey vocabulary; S1-M3 remains responsible for governed ambiguity interpretation beyond deterministic rules.**

#### S1-M3 — Narrow governed ambiguity interpretation

**Purpose:** support ambiguous free text that deterministic rules cannot classify, without allowing a model to decide composition or commerce.

**Reuse:** existing AI invocation/accounting foundations in `packages/db/src/ai-intent.ts`, existing security/consent contracts, S1 rule resolver, and deterministic fallback.

**Implemented behavior:** `packages/domain/src/native-ai-interpretation.ts` defines a closed intent-only output and deterministic-first vocabulary. `apps/web/lib/native-ai-interpreter.ts` provides a server-only OpenAI-compatible adapter with bounded text, structured JSON-schema output, a 2.5 second timeout, and no product/catalog data in the prompt. Ambiguous requests use the existing `packages/domain/src/intent-executor.ts` and `packages/db/src/ai-intent.ts` claim/settle boundary, including tenant-scoped daily/monthly reservations, idempotency, privacy lineage, and safe unknown/failure settlement. `apps/web/lib/native-intelligence-api.ts` connects raw visitor text to that interpreter and then maps only validated intent into the existing native rule resolver.

**Invocation policy:** deterministic phrases are resolved without a provider call. AI is disabled unless `KABLET_AI_INTERPRETATION_ENABLED=true` and `KABLET_AI_PROVIDER_API_KEY` are configured server-side. `KABLET_AI_PROVIDER_MODEL` and optional `KABLET_AI_PROVIDER_BASE_URL` select the configured model/endpoint; the default endpoint is OpenAI's API. The provider receives only bounded visitor text and the closed allowed-intent vocabulary—never checkout, address, payment, raw catalog, or credential data.

**Fallback behavior:** disabled or unavailable configuration returns the existing bounded discovery clarification; timeout/provider failure/malformed output settles as failed/unknown through the accounting executor and returns safe deterministic guidance. Valid output is still only an interpretation: the versioned native rule catalog selects the composition. The model cannot select products, prices, policies, components, actions, or commerce state.

**Boundaries:** browser text → server redaction/authorization → provider interpretation → validated structured intent → deterministic rule resolver → Decision/composition. Provider output must never directly render UI or authorize commerce.

**Connected tests:** `tests/integration/native-intelligence.integration.test.ts` proves mocked provider output crosses disposable PostgreSQL accounting, visitor/session lineage, and the native rule/composition boundary (9/9 focused tests), including sanitized HTTP failure diagnostics. Existing `tests/integration/postgres.integration.test.ts` covers provider execution settlement, idempotency, budget exhaustion, replay, tenant denial, and timeout/unknown accounting. `tests/e2e/native-intelligence.spec.ts` proves deterministic text routing, genuinely disabled ambiguous fallback, and browser rendering. The opt-in `tests/e2e/native-ai-live-smoke.spec.ts` also passed 1/1 against a real configured OpenAI provider: the provider executed, returned a valid interpretation, and the governed canvas result rendered; disposable PostgreSQL/server cleanup passed. The live smoke is not part of the default suite and does not claim production readiness.

**Acceptance:** ambiguous input either yields a validated supported intent or a safe clarification/baseline; provider failure never blocks shopping and no unvalidated model output reaches the canvas.

**Exclusions:** autonomous agents, generated React, model-selected prices/products, autonomous learning, and production traffic before launch gates.

**Dependencies:** S1-M1, existing privacy/accounting foundation, Platform security, and provider credentials. **Status: DONE for the bounded V1 provider-interpretation slice — mocked failure/accounting coverage and the opt-in real-provider smoke are verified; production provider readiness remains a later launch gate.**

#### S1-M4 — Manual evidence-to-rule review loop

**Purpose:** let an operator inspect evidence and propose/approve rule improvements without self-modifying production behavior.

**Reuse:** measurement, attribution, experiment result queries, Decision/exposure rationale, and the future lean HQ surface.

**Implemented behavior:** migration `0056_native_evidence_events.sql` adds an immutable, tenant/store/session-scoped evidence record with a closed event vocabulary, bounded metadata, idempotency, lineage fields, FORCE RLS, and immutable-row protection. `packages/db/src/native-evidence.ts` appends events and returns a bounded chronological timeline joined to persisted decision/rule/exposure lineage and authoritative verified-order attribution. The public evidence route accepts only safe browser interaction facts; verified purchases are rejected from the browser and read from committed order-attribution records. The control route is read-only and requires `reporting.read` authorization.

**Event vocabulary:** session start/return, intent and preference changes, product impression/view, comparison and clarification selection, cart add/remove, checkout start/failure, decision exposure, AI interpretation outcome, and authoritative verified purchase outcome. Raw keystrokes, payment data, addresses, credentials, and unrestricted request bodies are excluded. Metadata is bounded to a closed JSON-safe shape and events are idempotent within a tenant/session/event-kind key.

**Review contract:** `GET /api/control/evidence` requires organization, business, store, and visitor-session scope plus an authorized control session. Results are limited to 100 rows per page and return a cursor, decision/rule/exposure lineage, and verified outcomes. Missing evidence remains absent/unknown; browser events cannot manufacture a purchase. The existing S1-M1 repository lifecycle remains the manual improvement path: inspect evidence, create a draft rule, validate, approve, activate, or roll back. No storefront request can create or activate a rule.

**Privacy and reliability:** evidence writes are non-blocking for commerce; a failed evidence write creates an explicit evidence gap but cannot authorize a cart, payment, or order. Rows are immutable and tenant-scoped. Retention/deletion must follow the existing control-plane privacy policy before production launch; this slice deliberately does not add an autonomous retention worker or HQ UI.

**Boundaries:** durable visitor/decision/exposure/verified-order evidence → privacy-safe aggregate review → human approval → versioned rule publication → next eligible decision. Existing historical decisions remain immutable.

**Connected tests:** `tests/integration/native-intelligence.integration.test.ts` proves real intelligence → PostgreSQL evidence lineage, ordering, idempotency, metadata bounds, and cross-tenant isolation (9/9 focused native-intelligence tests). `tests/e2e/native-intelligence.spec.ts` proves browser → evidence route → disposable PostgreSQL ingestion, replay idempotency, and rejection of forged verified-purchase events. `tests/unit/control-routes.test.ts` proves the read-only timeline is denied without `reporting.read` and passes only tenant-scoped query inputs (14/14 control-route tests). Existing native intelligence, cart, checkout, attribution, and worker evidence remains preserved.

**Acceptance:** an authorized reviewer can retrieve a bounded chronological session record, explain the involved rule/decision/exposure, distinguish verified outcomes from checkout activity, and use the existing draft → validate → approve → activate/rollback lifecycle; no causal lift is claimed from observational data alone. The HQ interface, richer review queue, and production retention automation remain outside this slice.

**Exclusions:** automated winner promotion, cross-merchant learning, and statistical platform scope.

**Dependencies:** S1-M1, measurement integrity, and Stage 3 HQ. **Status: DONE for the bounded evidence and review boundary; HQ UI, richer analytics, and production retention automation remain future work.**

## Exactly one recommended next milestone

### Stage 2 — Complete Customer UI and Design System

Stage 1 now has the bounded deterministic rule engine, governed ambiguity interpretation, evidence capture, and manual review boundary verified. The next bounded milestone should complete the reusable customer-facing states and responsive/error/loading treatments that expose those capabilities consistently, while preserving merchant authority and the existing native commerce flow. It must not expand the AI provider, add autonomous learning, or claim conversion lift.

## Launch gate after Stage 5

The five stages do not by themselves authorize live traffic. Go/no-go requires all of the following:

- production deployment separation, health/readiness checks, structured monitoring, alerting, and rollback;
- production tenant, authentication, authorization, RLS, privacy, retention, and secret verification;
- tested backups, restore rehearsal, and payment/order recovery ownership;
- real merchant-owned provider sandbox and then controlled live payment validation, including signed webhooks and verified orders;
- merchant authorization, fulfillment/support ownership, incident escalation, and offboarding;
- applicable privacy, consumer, tax, payment, AI, terms, and data-processing requirements reviewed by the responsible parties;
- SaaS billing and entitlements if required by the commercial offer;
- end-to-end activation and purchase proof from published storefront through customer confirmation and merchant order visibility.

These are launch prerequisites, not a reason to restart broad foundation work before the bounded V1 stages deliver value.

## Permanent completion discipline

Every milestone must identify its production boundary and test it as a connected system:

`Browser or public API → route → service → disposable PostgreSQL → persisted state/decision/order → rendered response`

Relevant tests must cover authorization, tenant/store isolation, stale state, missing merchant truth, malformed input, idempotency, concurrency, and failure recovery. External payment or AI providers may be mocked only for offline proof; the appropriate launch gate must separately require real sandbox validation.

No milestone may be marked DONE from a plan, a unit test, or a mocked provider response alone.

## Status tracker

| Stage / milestone | Status | Evidence or exit condition |
|---|---|---|
| Stage 1 — Rule-Based Adaptive Intelligence | DONE | P1 and S1-M1 through S1-M4 are DONE; S1-M3 includes the opt-in real-provider smoke and governed rendered-result evidence |
| S1-M1 — Versioned rule catalog and composition policy | DONE | Migration 0055, native-rule contract/repository, Decision lineage, 1 focused PostgreSQL lifecycle test, and 38/38 disposable browser orchestration pass |
| S1-M2 — Complete V1 intent and context coverage | DONE | Bounded V1 journey matrix implemented; focused PostgreSQL tests pass and full disposable browser orchestration is 40/40 |
| S1-M3 — Narrow governed ambiguity interpretation | DONE | Deterministic-first route, controlled provider adapter, durable accounting, structured validation, safe fallback, 9/9 native-intelligence integration tests, and opt-in real-provider Playwright smoke 1/1 with governed rendered result |
| S1-M4 — Manual evidence-to-rule review loop | DONE | Migration 0056, bounded immutable evidence contract, browser ingestion, authorized read-only timeline, lineage/idempotency/isolation tests, and existing rule lifecycle reuse are verified; HQ UI and production retention automation remain out of scope |
| Stage 2 — Complete Customer UI and Design System | PARTIAL | Native creative workspace exists; V1 completeness and production QA remain |
| Stage 3 — Kablet HQ and Demo Validation | NOT STARTED | Operator surface and review workflow not evidenced as complete |
| Stage 4 — Core Commerce Completion | PARTIAL | Offline native commerce is substantial; real provider, fulfillment, refunds, and operations remain |
| Stage 5 — Merchant Dashboard and Onboarding | NOT STARTED | Self-service Native and Shopify/Headless journeys remain |
| Launch gate | BLOCKED | Requires real-provider, production, security, operational, legal, support, and activation evidence |

Historical department evidence, long-term risks, ownership, and the Native/Headless public-launch requirement remain in [`KABLET-MASTER-COMPLETION-MAP.md`](KABLET-MASTER-COMPLETION-MAP.md).
