# KABLET — MASTER BUILD ROADMAP v1.0

**Created:** 2026-10-11  
**Status:** Proposed engineering execution plan based on Codex read-only audit and six locked blueprint chapters. **Not yet approved as a frozen schedule.**  
**Repository baseline:** local commit `aac9677` (not pushed at audit time); working tree also has modified `apps/web/app/api/interaction/start/route.ts`, `packages/db/src/migrate.ts` and untracked `scripts/`.  
**Strategic source of truth:** `01-business.md` through `06-infrastructure.md` and `kablet-blueprint-v1.0-index.md`.  
**Engineering evidence:** user-supplied Codex audit `Pasted text(20261011-115252).txt` (read-only, 2026-10-11).  
**Status caveat:** No independent repo access, running services, Shopify account access or successful current test execution was available to the roadmap author. Statuses below are grounded in the Codex audit, **not independently certified**.

## How to read and maintain this roadmap

- **Strategic LOCKED ≠ engineering DONE.** Locked blueprint sections are requirements, not implementation evidence.
- **Evidence statuses:** `AUDIT-VERIFIED (historical)` = Codex found implementation and pre-existing tests/proofs, but did not execute them in this audit; `IMPLEMENTED–UNVERIFIED` = code exists without sufficient execution proof; `PARTIAL` = incomplete connection; `SCAFFOLD` = demo/interfaces only; `NOT FOUND` = absent from audited repo; `BLOCKED` = verification prevented; `NOT STARTED` = roadmap work not established as completed; `VERIFIED DONE` = fresh passing exit evidence attached after implementation. No roadmap task is `VERIFIED DONE` today.
- **Task status flow:** `NOT STARTED → IN PROGRESS → IMPLEMENTED–UNVERIFIED → VERIFIED DONE`; use `BLOCKED` with owner, reason and unblock action. Record commit, test output, date, reviewer and link to evidence for every transition.
- **Dependency rule:** chapter numbers are a navigation structure, **not** permission to postpone prerequisites. Infrastructure, security, consent, SEO architecture and measurement contracts must be addressed at the slices where needed; Chapters 04–07 contain overlapping workstreams.
- **Pilot vs public release:** Shopify-only **bounded pilot** comes first. First **public release** requires BOTH Shopify-connected headless commerce and minimal operational Kablet-native commerce (Chapter 1 locked decision). Do not silently change this scope.
- **Frontend model:** Kablet **owns the complete adaptive customer-facing frontend**, not an overlay/widget or mere Shopify theme extension. Shopify remains authoritative for connected commerce; checkout may hand off to provider-authorized flow. Any bridge/demo technique is temporary, not a product redefinition.
- **Commercial proof:** A verified order is not necessarily attributable, and attributed revenue is not automatically causal lift. Report valid randomized incremental net RPV only when evidence supports it.
- **Do not assign false percentages.** Progress = completed and independently evidenced tasks / applicable scoped tasks, plus separate launch-gate status. Initial verified completion against this new roadmap is **0 tasks independently certified**, not a claim that no code exists.

## Executive dashboard — initial state

| Dimension | State at audit | Evidence / next action |
|---|---|---|
| Strategic blueprint | **60/60 LOCKED** | Six local Markdown files; not in Codex repo during audit |
| Engineering baseline | **Substantial existing foundation** | Zod/Next/React/Postgres, migrations 0000–0018, visitor/decision/interaction/lead-conversion paths |
| Historical implementation confidence | **Mixed** | Codex marks many narrow modules verified from code and test history; current test execution blocked |
| Current test execution | **BLOCKED** | esbuild `spawn EPERM` on Vitest startup; typechecks passed |
| Shopify ecommerce | **NOT FOUND** | OAuth, catalog, checkout, webhooks, order reconciliation absent |
| Full adaptive ecommerce frontend | **PARTIAL / NOT FOUND** | Narrow React lead demo exists; full headless commerce frontend absent |
| Production AI provider | **NOT FOUND** | Durable executor/accounting exists but demo exact-match interpreter wired for development only |
| Merchant & internal dashboards | **NOT FOUND** | No authenticated merchant/admin surfaces |
| Incremental net RPV experiments | **NOT FOUND** | Exposure and local attribution foundations only |
| Hosting, DNS, CI, monitoring | **NOT FOUND IN REPO** | External resources unverified, not asserted nonexistent |
| First pilot | **NOT READY** | Requires full safe merchant commerce spine and applicable launch gates |
| First public release | **NOT READY** | Requires connected + native paths and all applicable gates |

## Existing assets to reuse — do not rebuild blindly

| Foundation | Codex evidence | Reuse intent | Current caveat |
|---|---|---|---|
| Business truth | `packages/db/src/business-truth.ts`, migration 0001 | Versioned merchant facts | Not a Shopify product/variant model |
| Visitor state | `packages/domain/src/visitor-state.ts`, DB visitor state, migrations 0002–0005 | Tenant-scoped revisions and consent lineage | Production identity/privacy UX incomplete |
| Deterministic decisions | `packages/domain/src/decision.ts`, `packages/db/src/decision.ts` | Governed experience decisions | Not commerce/experiment-aware yet |
| React experience | `ExperienceRenderer.tsx`, `InteractiveExperience.tsx`, renderer map | Composition runtime | Lead/demo vocabulary, not full ecommerce frontend |
| Interaction orchestration | `apps/web/lib/interaction-service.ts`, API routes | Durable visitor action loop | Demo interpreter, integration gaps |
| Action contracts | `packages/domain/src/action.ts`, `apps/web/lib/action-service.ts` | Safe capability execution | No Shopify commerce adapters |
| Measurement | `packages/db/src/measurement.ts`, attribution and conversion modules | Exposure and outcome lineage | Local lead events ≠ verified Shopify net revenue |
| AI executor/accounting | `packages/domain/src/intent-executor.ts`, `packages/db/src/ai-intent.ts`, migrations 0016–0018 | Governed AI calls and costs | No real provider or live visitor runtime wiring |
| Worker | `apps/worker/src/index.ts` | Future durable processing | Idle scaffold |
| Test assets | `tests/unit`, `tests/integration`, `tests/e2e` | Reuse contracts and browser proof | Current Vitest process EPERM; E2E not run in audit |

## Release milestones and gate boundaries

| Milestone | Scope | Evidence needed |
|---|---|---|
| M0 — Trustworthy engineering baseline | Chapter 01 | Executable tests, safe Git state, CI and documented limitations |
| M1 — Secure merchant identity | Chapter 02 + cross-cutting security | Authenticated tenant and approval tests |
| M2 — Verified Shopify commerce truth | Chapter 03 | Scoped install, catalog, durable webhook, reconciled order |
| M3 — Real Kablet-owned frontend | Chapter 04 | Browser discovery→cart→checkout→provider receipt with safe fallback |
| M4 — Governed AI and control planes | Chapter 05 | Real optional AI, merchant approvals, internal oversight |
| M5 — Defensible commercial measurement | Chapter 06 | Verified outcomes, experiment validity and net RPV reporting |
| M6 — Production pilot readiness | Chapter 07 + 08.01 | Tested deployment/restore, 8 pilot launch gates |
| M7 — Bounded Shopify merchant pilot | Chapter 08.02–08.03 | Authorized merchant, monitored live journeys, valid/inconclusive randomized evidence |
| M8 — Dual-path public release | Chapter 08.04–08.07 | Native store operational + Shopify path + public-release gates |

**Fastest meaningful integration proof:** authenticated Shopify test shop → authoritative product → Kablet-owned minimal storefront → governed cart/checkout → provider-confirmed order → reconciled evidence → minimal merchant view. This is a *cross-chapter vertical milestone*, not a substitute for remaining public-release commitments. Production AI and advanced learning are not prerequisites for the earliest safe deterministic commerce proof.

## Known decision questions to resolve at implementation time

1. **Headless delivery:** merchant domain/subdomain, routing, SSR strategy, Shopify APIs, SEO and checkout continuity. Do not choose theme overlay by default.
2. **Pilot traffic design:** preserve incumbent merchant site where needed; design eligible cohort and holdout without pretending observational exposure proves causal lift.
3. **Infrastructure vendor and region:** choose based on constraints, cost, data location, recovery and operational capability; no vendor selection inferred from audit.
4. **Provider-specific contracts:** verify Shopify scopes, rate limits, webhooks and commerce APIs against current provider documentation during implementation.
5. **Native commerce:** required for first public release, but implementation can begin after Shopify pilot if schedule permits; any change requires explicit blueprint revision.
6. **Commerce revenue definition:** lock gross/net accounting, taxes, shipping, discounts, refunds, currency, attribution maturity and experiment estimand before reporting lift.
7. **External infrastructure unknowns:** confirm domain ownership, Shopify account, deployed services, billing and legal readiness separately; absence in repo is not proof of absence in the world.
8. **Test runner EPERM:** resolve on approved local/CI environment; no false negative or false pass.

## Status update protocol — every Codex slice

For each task update `Status`, `Evidence`, `Commit`, `Date`, `Remaining risks`, and `Next dependency`. Keep this file versioned. Never overwrite a historical failure or remove an unresolved blocker without evidence. Require explicit approval for changes to locked product scope. Link implementation commits and CI reports rather than pasting secrets or customer data.

---

# Chapter 01 — Repository Baseline, Testability & Engineering Discipline

**Outcome:** Establish a reproducible, trustworthy baseline without treating the checkpoint as production-ready.

**Chapter status:** NOT COMPLETE. Task-level statuses below reflect **new roadmap exit gates**, not denial of existing reusable code.

## 01.01 — Inventory and preserve Git state

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Review aac9677, modified start route, migration hardening, and untracked scripts; preserve separately; avoid secret/fixture staging.
- **Definition of done:** Git status and exact diff inventory; scoped commits only after approval; no work lost.
- **Blueprint / audit references:** Audit C/H; B6.4.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 01.02 — Restore executable test harness

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Diagnose Windows esbuild spawn EPERM in a permitted environment; establish reproducible pnpm typecheck/unit/integration/e2e commands without changing production data.
- **Definition of done:** Actual test outputs and environment notes; blocked tests remain blocked, never assumed passed.
- **Blueprint / audit references:** Audit F; B6.4.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 01.03 — Close adaptive interaction coverage gaps

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Add direct free-text service tests, API dispatch, no-interpreter behavior, runtime composition guard, idempotent retry, browser accessibility.
- **Definition of done:** Passing service/API/e2e evidence; explicit demo-only guard.
- **Blueprint / audit references:** Audit C/F; B2.4 B4.4.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 01.04 — Validate local migration and seed safeguards

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Review role grants/revocation, nonproduction refusal, .env writes, seed idempotency; test only on disposable approved database.
- **Definition of done:** Failure-mode tests and reviewed commit split; no shared/production mutation.
- **Blueprint / audit references:** Audit H; B6.2 B6.3.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 01.05 — Create baseline CI and evidence manifest

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Set up reproducible lint/typecheck/test/build pipeline, secret scanning, branch protection, artifact versioning.
- **Definition of done:** CI green on a reproducible runner; failing checks block merge; exact build recorded.
- **Blueprint / audit references:** Audit D/F; B6.4.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

# Chapter 02 — Identity, Tenant Security & Commerce Authority

**Outcome:** Secure the tenant and merchant authority boundaries before handling real merchant connections.

**Chapter status:** NOT COMPLETE. Task-level statuses below reflect **new roadmap exit gates**, not denial of existing reusable code.

## 02.01 — Merchant and operator identity

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Implement merchant sign-in/session lifecycle and separate platform operator identities; avoid assuming existing tenant IDs are authentication.
- **Definition of done:** Authenticated flows, session expiry/revocation, negative authorization tests.
- **Blueprint / audit references:** Audit G; B6.3.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 02.02 — Membership, RBAC and approvals

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Organization/business membership, roles, scoped permissions, merchant approval evidence and internal break-glass constraints.
- **Definition of done:** Cross-tenant denial, approval provenance, support-access expiry tests.
- **Blueprint / audit references:** B2.7 B6.3.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 02.03 — Consent, privacy and lifecycle

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Implement consent collection, visitor privacy controls, retention/deletion/export workflows and safe model context boundaries.
- **Definition of done:** Consent gate, deletion propagation, revoked-access and restore tests.
- **Blueprint / audit references:** Audit D; B4.9 B6.3.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 02.04 — Secret and provider credential boundary

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Encrypted token storage, key rotation, provider scopes, environment separation, audit records.
- **Definition of done:** Secret never exposed in logs; revocation and least-privilege tests.
- **Blueprint / audit references:** B3.7 B6.3 B6.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 02.05 — Audit trail and merchant-policy enforcement

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Connect persisted policy versions to authenticated approval and runtime enforcement.
- **Definition of done:** Actor/version/action lineage verified; unsafe changes rejected.
- **Blueprint / audit references:** Audit E/F; B2.7 B6.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

# Chapter 03 — Shopify Commerce Foundation & Durable Provider Operations

**Outcome:** Establish verified Shopify truth and resilient provider integration, not just catalog screenshots.

**Chapter status:** NOT COMPLETE. Task-level statuses below reflect **new roadmap exit gates**, not denial of existing reusable code.

## 03.01 — Commerce provider abstraction and Shopify contracts

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Define normalized shop, product, variant, price, inventory, cart, order and provider receipt contracts without losing provider-specific authority.
- **Definition of done:** Contract tests; no invented prices, stock, or payment statuses.
- **Blueprint / audit references:** B3.2 B3.3.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 03.02 — Shopify installation and shop identity

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Authorized merchant install/OAuth, scoped shop association, token lifecycle and connection health.
- **Definition of done:** One test shop connects/disconnects; tenant scoping and revoked-token tests.
- **Blueprint / audit references:** Audit E-A; B6.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 03.03 — Catalog sync and freshness

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Resumable paginated initial sync, versioned incremental updates, inventory/price freshness and stale-state handling.
- **Definition of done:** Product/variant correctness, replay and freshness tests.
- **Blueprint / audit references:** Audit E-A; B3.3 B6.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 03.04 — Durable webhook inbox and worker

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Authenticated webhook verification, durable acceptance, dedupe, ordering protection, retries, dead letters and tenant isolation.
- **Definition of done:** Forged/duplicate/out-of-order/crash tests; worker actually processes jobs.
- **Blueprint / audit references:** Audit G; B6.2 B6.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 03.05 — Commerce actions and safe checkout handoff

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Governed cart/add-to-cart and Shopify checkout handoff; stable operation IDs, unknown outcome handling, idempotency and visitor confirmation.
- **Definition of done:** Sandbox end-to-end checkout path; no blind retry or fabricated confirmation.
- **Blueprint / audit references:** B3.5 B3.7 B3.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 03.06 — Order, refund and cancellation reconciliation

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Authoritative provider order ingestion, currency/tax/discount/shipping/refund semantics, evidence references and reconciliation lag.
- **Definition of done:** Provider-reconciled order and refund facts; mismatches flagged.
- **Blueprint / audit references:** Audit E-C/D; B3.6 B3.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

# Chapter 04 — Full Adaptive Ecommerce Frontend & Experience Design

**Outcome:** Build the actual Kablet-owned shopper frontend and its visual design, not a Shopify theme widget masquerading as the product.

**Chapter status:** NOT COMPLETE. Task-level statuses below reflect **new roadmap exit gates**, not denial of existing reusable code.

## 04.01 — Frontend delivery architecture and domain strategy

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Select Kablet-owned headless frontend delivery on approved merchant domain/subdomain; define Shopify API boundaries, SSR/SEO and checkout handoff.
- **Definition of done:** Architecture decision record; URL/session/canonical and checkout continuity proof.
- **Blueprint / audit references:** B1.1 B3.3 B4.1 B4.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 04.02 — Visual identity, design system and screen designs

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Create production design tokens, typography, responsive grid, components, empty/loading/error states, and screen-by-screen UX specifications.
- **Definition of done:** Approved mobile/desktop screens, accessibility acceptance and reusable components.
- **Blueprint / audit references:** B4.1 B4.3 B4.7.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 04.03 — Product discovery and browsing

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Build real collections, search/filter/product cards, product details and merchant-truth rendering.
- **Definition of done:** Real synced products visible; authoritative prices/availability; SEO crawlable.
- **Blueprint / audit references:** B4.2 B4.5 B4.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 04.04 — Four adaptive compositions

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Discovery, Comparison, Reassurance, Ready-to-Buy governed compositions; visitor signals and decision lineage; stable UI transitions.
- **Definition of done:** Same visitor can move among permitted compositions; version and exposure tracked.
- **Blueprint / audit references:** B2.6 B4.2 B4.3.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 04.05 — Commerce UX and continuity

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Product variant selection, cart, checkout handoff, recovery, mobile and keyboard accessibility; preserve cart during adaptation.
- **Definition of done:** Real browser tests through Shopify checkout and graceful fallback.
- **Blueprint / audit references:** B4.4 B4.6 B4.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 04.06 — Performance, accessibility and SEO foundation

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** SSR/canonical/meta/structured data, crawlable product pages, web vitals, a11y, consent-aware analytics and resilient no-AI baseline.
- **Definition of done:** Measured field/lab budgets, sitemap/indexing checks, a11y tests.
- **Blueprint / audit references:** B4.8 B6.5.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 04.07 — Controlled Shopify merchant demo

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Run one Kablet-owned full frontend against authorized Shopify test shop, not just the legacy lead demo.
- **Definition of done:** Real product discovery → cart → provider checkout → verified order with evidence.
- **Blueprint / audit references:** B4.10 B6.10.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

# Chapter 05 — Selective AI, Decision Runtime & Control Planes

**Outcome:** Make intent genuinely useful while keeping merchant truth, deterministic policy, and human approval authoritative.

**Chapter status:** NOT COMPLETE. Task-level statuses below reflect **new roadmap exit gates**, not denial of existing reusable code.

## 05.01 — Real intent provider behind existing contract

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Connect provider adapter to durable invocation executor; bounded context, privacy, output validation and provider failure behavior.
- **Definition of done:** Non-demo input understood in controlled evaluation; no invented commerce claims.
- **Blueprint / audit references:** Audit C AI; B2.4 B2.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 05.02 — AI budget, fallback and telemetry

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Per-tenant budget ledger, selective call routing, cost settlement, rate limits, cache/timeout and deterministic fallback.
- **Definition of done:** Budget exhaustion and provider outage cannot block core shopping.
- **Blueprint / audit references:** B2.8 B6.7.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 05.03 — Intent evaluation and experience selection

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Offline fixtures, ambiguity/clarification, cold start, merchant policy restrictions, decision lineage and versioning.
- **Definition of done:** Regression suite and auditable policy-compliant decisions.
- **Blueprint / audit references:** B2.5 B2.6 B2.10.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 05.04 — Merchant Business Intelligence Manager

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Authenticated merchant dashboard for business truth, brand, integration status, policy authoring/approval, budgets, reports and audit.
- **Definition of done:** Merchant can approve a change and see safe runtime effect; tenant-isolated.
- **Blueprint / audit references:** B2.7 B4.7 B5.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 05.05 — Internal Intelligence Command Center

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Internal operations, model/config governance, incident/cost/quality, tenant support controls and audit evidence.
- **Definition of done:** Operator controls distinct from merchant controls; no silent overrides.
- **Blueprint / audit references:** B2.7 B6.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 05.06 — AI governance and release policy

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Separate analyst hypothesis, deterministic validator, experiment controller, policy promotion controller; explicit human authority.
- **Definition of done:** No autonomous unsafe promotion; gated model and policy rollback.
- **Blueprint / audit references:** B5.5 B5.6.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

# Chapter 06 — Verified Measurement, Experiments & Commercial Learning

**Outcome:** Move from local lead conversion metrics to defensible Shopify net-revenue outcomes and causal evidence.

**Chapter status:** NOT COMPLETE. Task-level statuses below reflect **new roadmap exit gates**, not denial of existing reusable code.

## 06.01 — Commerce outcome and attribution classes

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Define Class A deterministic, B partial diagnostics, C unmatched; enforce consent, windows, refunds and provider verification.
- **Definition of done:** Unmatched orders never become fabricated Class A conversions.
- **Blueprint / audit references:** B5.2 B5.3.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 06.02 — Merchant revenue reporting

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Separate Shopify total revenue, reliably linked revenue, experimental arm revenue and estimated incremental Kablet revenue.
- **Definition of done:** Reproducible queries, coverage/lag disclosures, refund handling.
- **Blueprint / audit references:** B5.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 06.03 — Experiment contract and randomization

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Pre-register eligibility, unit, variants, holdout, assignment, exposure, outcome window and guardrails.
- **Definition of done:** Sticky assignments; ITT denominator; no post-treatment selection.
- **Blueprint / audit references:** B5.4.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 06.04 — Experiment integrity diagnostics

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** SRM, differential attribution loss, contamination, concurrent merchant changes, delayed outcome maturity.
- **Definition of done:** Invalid experiments fail closed for lift claims.
- **Blueprint / audit references:** B5.4 B5.10.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 06.05 — Incremental net RPV analysis

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Implement net-revenue estimand, confidence intervals, minimum sample/power planning and inconclusive states.
- **Definition of done:** Synthetic known-effect tests and reproducible evidence report.
- **Blueprint / audit references:** B5.1 B5.10.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 06.06 — Evidence-driven learning and promotion

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Governed hypotheses, experiment evaluation, five AND promotion gates, canary/rollback and versioned policies.
- **Definition of done:** Only authorized statistically valid candidates promoted.
- **Blueprint / audit references:** B5.5 B5.6 B5.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 06.07 — Cross-merchant learning and privacy

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Platform patterns vs aggregate consent-governed transfer vs tenant-private knowledge.
- **Definition of done:** No cross-tenant leakage or unsupported transferred lift claim.
- **Blueprint / audit references:** B5.7.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

# Chapter 07 — Production Infrastructure, Public Presence & Operational Readiness

**Outcome:** Make hosting, domains, SEO, security, reliability and cost visible as concrete build work rather than late-stage surprises.

**Chapter status:** NOT COMPLETE. Task-level statuses below reflect **new roadmap exit gates**, not denial of existing reusable code.

## 07.01 — Hosting and environment architecture

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Select provider/region based on budget and data needs; production/staging isolation, web, worker, PostgreSQL, storage and CDN.
- **Definition of done:** Documented provider decision and deployed staging architecture.
- **Blueprint / audit references:** B6.1 B6.2.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 07.02 — CI/CD, migrations and release safety

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Reproducible artifacts, approved database migrations, canaries, rollback and versioned policies.
- **Definition of done:** Staging release, failure rollback and migration compatibility drill.
- **Blueprint / audit references:** B6.4.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 07.03 — Domains, DNS, TLS and routing

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Configure kablet.com marketing/app hostnames, merchant frontend domains, certificates, canonical URLs, DNS verification.
- **Definition of done:** HTTPS and domain ownership tests; no tenant/domain confusion.
- **Blueprint / audit references:** B4.8 B6.3.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 07.04 — Public marketing website and SEO

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Design marketing home, product, pricing, docs/help, legal, onboarding, metadata, sitemap, analytics consent and search readiness.
- **Definition of done:** Published, indexed where appropriate, measured performance and conversion paths.
- **Blueprint / audit references:** B1.7 B4.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 07.05 — Telemetry and protected audit

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Metrics/traces/logs, provider and commerce reconciliation dashboards, alerts, decision evidence and redaction.
- **Definition of done:** Incident detection and audit reconstruction drill.
- **Blueprint / audit references:** B6.6 B6.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 07.06 — Backup, disaster recovery and privacy restoration

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Encrypted backups, restore tests, RPO/RTO, revoked-permission and provider reconciliation after restore.
- **Definition of done:** Actual measured restore drill; safe unknown-action handling.
- **Blueprint / audit references:** B6.9.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 07.07 — Operational cost, abuse and SLO governance

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Per-tenant metering, spend caps, rate limits, isolation, support escalation and SLO alerts.
- **Definition of done:** Load, outage, cost and noisy-tenant tests.
- **Blueprint / audit references:** B6.5 B6.6 B6.7.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 07.08 — Commercial administration and onboarding

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Merchant billing/plan management, pricing validation, support, documentation and operational processes.
- **Definition of done:** Authorized merchant can onboard, understand terms and receive support.
- **Blueprint / audit references:** B1.6 B1.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

# Chapter 08 — Shopify Pilot, Native Commerce & First Public Release

**Outcome:** Keep pilot scope distinct from the locked two-path public launch commitment.

**Chapter status:** NOT COMPLETE. Task-level statuses below reflect **new roadmap exit gates**, not denial of existing reusable code.

## 08.01 — Pilot launch dossier and eight gates

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Security, commerce, experience, intelligence, measurement, reliability, recovery and cost evidence with named owners.
- **Definition of done:** All applicable pilot gates passed; merchant authorization and rollback tested.
- **Blueprint / audit references:** B6.10.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 08.02 — One-merchant bounded Shopify pilot

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Authorized real shop, limited eligible traffic, full Kablet-owned frontend, real checkout, monitoring and support.
- **Definition of done:** Verified end-to-end purchase and reconciled outcome; no unsupported lift claim.
- **Blueprint / audit references:** B1.10 B6.10.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 08.03 — Randomized commercial proof

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Approved control vs Kablet treatment, valid instrumentation, net RPV, guardrails and statistical review.
- **Definition of done:** Valid/inconclusive outcome published honestly with coverage and uncertainty.
- **Blueprint / audit references:** B5.10 B6.10.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 08.04 — Minimal Kablet-native commerce domain

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Independent merchant onboarding, catalog/variants/inventory, taxes/shipping rules as applicable, cart/order/fulfillment contracts.
- **Definition of done:** Tenant-safe native commerce domain and operational policies tested.
- **Blueprint / audit references:** B1.5 B3.4 B3.6.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 08.05 — Native checkout, payments and verified outcomes

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Authorized payment provider, safe payment lifecycle, refunds, notifications, reconciliation and secure checkout UX.
- **Definition of done:** Independent native real/sandbox purchase and refund/recovery proof.
- **Blueprint / audit references:** B3.4 B3.5 B3.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 08.06 — Native storefront and self-service merchant path

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Kablet-owned frontend, domain/SEO, merchant setup, reporting and shared governed intelligence/measurement.
- **Definition of done:** Merchant creates and runs minimal native store without Shopify.
- **Blueprint / audit references:** B1.5 B4.1.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 08.07 — First public release gates

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Re-run launch dossier for Shopify-connected and native paths; legal, billing, security, restore, support and merchant acceptance.
- **Definition of done:** Both commerce paths operational and verified; authorized public launch decision.
- **Blueprint / audit references:** B6.10.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

## 08.08 — Post-release learning and scale

- **Status:** NOT STARTED (roadmap gate; existing code may be PARTIAL or AUDIT-VERIFIED historically).
- **Build / verify:** Track real operating costs, incidents, onboarding, merchant retention and experiments; prioritize next integrations only after evidence.
- **Definition of done:** Versioned roadmap and measured expansion decisions.
- **Blueprint / audit references:** B1.9 B1.10 B5.8.
- **Dependencies:** Validate prerequisites from earlier chapters and cross-cutting security/hosting/consent before implementation; record exact blocked dependencies in slice kickoff.
- **Evidence:** _Pending: commit, test results, demo/receipt where relevant, reviewer, date._

# Appendix A — Prioritized first execution batch

**Next work is NOT to code immediately:** First review and approve this roadmap against the six locked blueprint files, then attach it to the repo so Codex can audit requirements against implementation.

1. Confirm exact Git branch, `aac9677`, and working-tree preservation; decide how to isolate diagnostics, migration and seed changes (01.01).
2. Get a permitted runner/CI environment to execute Vitest and E2E; capture pass/fail and avoid blaming code for `spawn EPERM` (01.02).
3. Close service/route integration tests for the demo guard and free-text flow without building new AI prematurely (01.03).
4. Set up minimal CI and security baseline (01.05); begin tenant auth design (02.01).
5. Plan the **Shopify commerce pilot spine** as a thin integration slice across 02–04 and 06; include one verified order and minimal reporting, not a general platform rewrite.

# Appendix B — Source authority and conflict resolution

**Priority:** six locked blueprint files govern intended product scope; Codex audit governs what exists in code; implementation tests govern whether it works. If sources disagree, do not silently reconcile. Log a change proposal with decision owner and consequences.

**Known mismatches:**
- Codex recommends Shopify theme/app extension or embedding as an option; locked Chapter 1/4 requires Kablet to own the complete frontend. A Shopify-connected headless implementation can still use Shopify for commerce authority and provider checkout.
- Codex's proposed sequence stops at Shopify pilot/public launch; locked Chapter 1/3 requires a **native commerce path before first public release**.
- Codex calls several modules VERIFIED based on historical evidence; current tests did not run. This roadmap reserves `VERIFIED DONE` for fresh, linked evidence.
- Codex did not have the blueprint files. The audit's lack-of-blueprint finding is an access limitation, not missing strategic work.

# Appendix C — Initial audit evidence and limitations

**Audit input:** `Pasted text(20261011-115252).txt`, 1,526 lines, supplied by user. This roadmap summarizes the audit; it does not independently verify repository source or remote services.

**Known Git state:** checkpoint `aac9677` local, not pushed; modified `apps/web/app/api/interaction/start/route.ts`, `packages/db/src/migrate.ts`, untracked `scripts/`.

**Safe checks reported passed:** domain TypeScript, web TypeScript, `git diff --check`. **Blocked:** Vitest startup `Error: spawn EPERM` from esbuild; web build inconclusive; no E2E or database integration tests executed during audit.

**Historical tests:** Codex identified meaningful unit/integration/Playwright suites and local lead-conversion proof. These are valuable reuse assets, not proof of production ecommerce readiness.

**External unknowns:** Hosting, domain/DNS, Shopify developer configuration, backups, observability, pilot merchant, legal, billing and other repositories require separate discovery.

# Appendix D — Roadmap change control

- **New capability:** add a numbered task with blueprint reference, dependency and exit test.
- **Completed slice:** link commit and reproducible evidence; update status and milestone dashboard; do not rewrite history.
- **Scope change:** record proposal, reason, affected chapters, public release/pilot implications, decision and date before changing locked requirements.
- **New blocker:** mark BLOCKED and specify owner, unblock condition and interim safe behavior.
- **Commercial result:** report only verified net revenue, attributable coverage and valid randomized incremental RPV with uncertainty as separate quantities.
