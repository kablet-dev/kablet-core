# Kablet — Chapter 06: Infrastructure & Operations

**Blueprint status:** STRATEGICALLY LOCKED — Sections 6.1–6.10. This is a design specification, not a claim of deployed or tested infrastructure.

## Governing principles

- Kablet is an ecommerce-first adaptive conversion intelligence platform. Optimize for **verified incremental net revenue per eligible visitor**, subject to safety, merchant authority, privacy, accessibility and experience quality.
- **The merchant owns the truth; Kablet owns the authorized experience.** Shopify or the approved commerce authority owns catalog, prices, inventory, checkout, orders, payments and refunds within its scope. Native storefronts must define equivalent explicit authorities.
- **Two control planes, one execution plane:** Kablet Intelligence Command Center (platform governance), Merchant Business Intelligence Manager (tenant policies and approvals), and Intelligence Execution Plane (visitor-serving decisions).
- Selective AI interprets eligible free-form intent; deterministic low-cost logic handles routine decisions. Natural language is optional, not required for shopping.
- The AI proposes; deterministic validators and explicit authority authorize. Learning and analytics never block checkout.
- Versioned evidence, policy gates, tenant isolation, measurement integrity, rollback and financial-operation independence are hard requirements.

## 6.1 Production Architecture & Service Boundaries — LOCKED (Option A)

**Decision: Modular Core, Independently Scalable Boundaries.** Start with a small number of deployable applications and background workers with explicit module boundaries. Split into independently deployed services only when measured security, isolation, throughput, latency or reliability needs justify operational complexity. Logical roles and AI agents are not automatically separate processes or microservices.

### 6.1.1 Logical architecture

1. **Visitor-facing storefront / experience runtime:** fast mobile-first adaptive canvas, SEO and rendering appropriate to merchant deployment, four governed compositions (Discovery, Comparison, Reassurance, Ready-to-Buy), accessible deterministic fallback. The browser never receives privileged merchant or platform credentials.
2. **Intelligence Execution Plane:** visitor-state validation and versioning; consent-aware signal ingestion; deterministic policy selection; selectively invoked, bounded AI intent interpretation; composition selection and render contracts; authorized commerce action orchestration. It must preserve shopping and cart continuity if AI is unavailable.
3. **Commerce authority and adapters:** Shopify initially, and explicitly authorized native-commerce components later. Product facts, inventory, pricing, taxes, discounts, checkout, payments, orders, refunds and fulfillment must originate from their designated authoritative systems. Adapters enforce versioned capabilities, idempotency, validation, reconciliation and provider receipt boundaries; Kablet never fabricates commercial facts.
4. **Merchant Business Intelligence Manager (merchant control plane):** business objectives, brand and approved policies, permissions, experiment proposals/approvals, recommendations, reporting, merchant-visible incidents and evidence. Merchant authority is tenant-scoped and cannot override platform safety or consent.
5. **Kablet Intelligence Command Center (platform control plane):** global safety boundaries, tenant lifecycle and operational governance, deployments, AI budgets and model governance, validator and experiment integrity, observability, security incidents, rollout/rollback and cost management. Platform operators are audited and restricted by least privilege.
6. **Asynchronous evidence and learning:** durable event ingestion, provider reconciliation, assignment/exposure and outcome ledgers, measurement quality, experiments, Learning Analyst hypothesis generation, governed cross-merchant pattern registry, promotion gate evaluation, reporting projections. This subsystem does not synchronously determine whether a shopper can complete checkout.

### 6.1.2 Initial deployable units (illustrative, not a mandatory vendor stack)

- **Storefront / edge application:** serves approved compositions and essential visitor interactions with caching that respects tenant, consent, locale and policy version.
- **Core API application:** modular domain services for tenant configuration, visitor state, policy decisions, merchant permissions, adapters, approvals and evidence queries; strict interfaces and authorization checks between modules.
- **Background worker(s):** queues for ingestion, webhooks, reconciliation, experiment evaluation, learning, reporting and notification; separate worker queues and resource budgets where contention risks visitor traffic.
- **Data services:** transactional persistence, tenant-scoped durable event/evidence storage, object storage where justified, and optional cache/queue. Concrete vendors and topology remain implementation decisions subject to Chapter 6.2 and operational evaluation.

A logical boundary may be implemented in the same codebase or deployable; independently testable authority and data contracts are mandatory regardless of physical deployment.

### 6.1.3 Request-path and failure rules

- Keep latency-sensitive requests minimal: authenticate/authorize tenant and visitor scope, load current approved policy and relevant state, choose an approved composition deterministically, render and permit authorized provider commerce actions.
- AI interpretation is invoked only for eligible free-form intent with privacy, timeout, rate and cost controls; on timeout, rejection or outage, use safe deterministic experience, never invent product information.
- Event telemetry and experiment assignment must be durable and consistent enough for the declared evidence claims, but analytics processing, Learning Analyst, report generation and aggregate network learning run asynchronously. A telemetry outage must degrade measurement honestly, not block commerce.
- Provider actions use explicit capability permissions, request idempotency keys, timeouts, retries with reconciliation for unknown outcomes, and provider-verified receipts. No automatic replay of uncertain payment or checkout operations.
- Checkout and financial operations remain independent of experience policy rollback. Stop affected new policy exposure and restore a compatible approved composition without canceling orders, undoing payments or replaying checkout actions.
- Changes to policy versions and catalog/schema dependencies must be compatibility-checked; if the last stable policy is incompatible, fall back to a separately approved safe baseline.

### 6.1.4 Isolation, governance and interfaces

- Tenant identity and authority must be enforced at the API, job, database query, cache key, storage object, retrieval context and audit layers. Never rely on a client-supplied tenant identifier alone.
- Authority ordering: platform safety, law and consent > merchant-approved truth/policies > experience stability and accessibility > commercial optimization. No LLM output may approve its own deployment.
- Version interface contracts for visitor state, composition, decision, policy, experiment assignment, provider action, verified outcome and evidence package. Schema evolution must be backward-compatible or use coordinated, reversible migrations.
- The five promotion gates remain AND conditions: trust/authority; experiment validity; commercial evidence; experience quality; deployment authorization/readiness. Rollouts are scoped, progressive, monitored and reversible.
- Cross-merchant data reuse is prohibited unless expressly permitted under the governed aggregate-learning framework; platform-owned engineering patterns and tenant-private intelligence are distinguished.

### 6.1.5 Scaling and service extraction criteria

Extract a service only when a documented constraint makes the separation worthwhile: independently scaling a saturated hot path, containing a security blast radius, isolating noisy workers, reducing fault propagation, meeting regulatory/data residency needs, or establishing a genuinely separate release/ownership cadence. Document expected benefit, interface and data ownership, migration/rollback, operational cost, observability and failure semantics before extraction. Do not create one microservice per AI role.

### 6.1.6 Engineering acceptance tests

1. Visitor discovery, comparison and checkout handoff work with the AI provider unavailable.
2. Learning jobs, experiment analysis and reporting outages do not block live browsing, cart or checkout.
3. Tenant access is denied across API, database, queues, caches, object storage, retrieval and background jobs.
4. Invalid or unapproved policy versions cannot be selected by the execution plane.
5. An LLM instruction cannot alter platform safety policy or authorize promotion.
6. Provider prices, inventory and purchase outcomes are not fabricated or overridden by experience code.
7. Commerce retries are idempotent; unknown payment/action outcomes require reconciliation before retry.
8. Experience rollback preserves legitimate cart, order and payment state and does not reverse or replay transactions.
9. Safe fallback operates when an approved policy is incompatible with changed catalog/schema contracts.
10. Request-path budgets and background worker isolation are measured under representative load.
11. Tenant-scoped cache and CDN variants do not leak policy, visitor or merchant data.
12. Experiment assignment, exposure, decisions, action receipts and outcomes retain immutable versioned audit references.
13. Merchant and platform control planes enforce their distinct approval and operational authorities.
14. Deployable/service separation changes require measured justification, contract tests and a reversible migration plan.

**Out of scope for this section:** choosing final cloud vendors, database products, queue technology, regions, SLO values and costs without deployment evidence. These belong in subsequent Chapter 6 sections.

## 6.2 Data Infrastructure, Storage & Event Pipelines — LOCKED (Option A)

**Decision:** PostgreSQL-Centered Transactional Core + Durable Asynchronous Evidence. Begin with a minimal, enforceable data architecture: PostgreSQL for transactional truth, durable asynchronous inbox/outbox processing, object storage for versioned evidence, and rebuildable analytics projections. Redis, a dedicated warehouse, event broker, vector store, or streaming system are optional additions only when measured load, reliability, security, or analytical requirements justify them.

### 6.2.1 Authoritative data boundaries

Separate (1) operational truth, (2) commercial and experimental evidence, and (3) derived intelligence. Operational state and authorization must be committed transactionally. Shopify is authoritative for supported catalog, prices, inventory, checkout, orders and payment outcomes; Kablet records verified provider receipts and owns only authorized experience state and decision history. For a Kablet-native storefront, explicitly nominate authoritative systems for catalog, stock, order and payments rather than assuming Kablet's experience database is financial truth. Reports are projections, never sources of commerce truth.

### 6.2.2 Initial storage and processing layout

- **PostgreSQL:** tenant records, merchant settings and policy approvals, visitor state and revisions, immutable experiment assignments, composition and policy version references, action state machines, provider receipt metadata, durable event inbox/outbox, processing checkpoints, and enforcement constraints.
- **Object storage:** access-controlled, versioned experiment evidence packages, immutable audit exports and reproducible analysis artifacts; integrity hashes and retention metadata where required.
- **Durable background jobs:** verified webhook ingestion, deduplication, out-of-order reconciliation, order/refund maturity, analytics projections, experiment evaluation, Learning Analyst jobs, and promotion-gate evidence assembly. A durable queue may use PostgreSQL initially if load and recovery tests permit.
- **Optional cache (e.g., Redis):** ephemeral, tenant-keyed acceleration, rate limits and other disposable data; never sole storage for authorization, experiments, money, or required evidence.
- **Optional analytical infrastructure:** add a warehouse, broker or specialist index only after documenting measurable need and a reversible migration path.

Shopping and checkout cannot wait on reporting projections, learning analysis, or cross-merchant aggregation.

### 6.2.3 Six logical data domains

1. **Tenant and merchant configuration:** tenant identity, integration scopes, approved merchant facts/policies, consent, capabilities, actor, authorization and version history.
2. **Visitor state and decision trace:** purpose-limited pseudonymous identifiers, consent context, state revision, authorized decision inputs, selected policy/composition versions and bounded retention.
3. **Commerce actions and receipts:** capability grants, request identity, idempotency keys, execution attempts, stable external operation identifiers, provider confirmation and reconciliation states.
4. **Experiment and measurement ledger:** predeclared eligibility, immutable randomized assignment, actual exposure separately recorded, outcome and refund evidence, attribution confidence, validator status and audit references.
5. **Learning artifacts:** hypotheses, provenance, knowledge scope, consent/license permissions, aggregate cohort eligibility, uncertainty, evidence packages, validator versions, approval and promotion decisions.
6. **Reporting projections:** explicitly defined and rebuildable merchant revenue, experiment and health metrics, with data freshness, coverage and accounting definitions.

### 6.2.4 Typed event envelope and integrity

Each accepted event must have a schema version, globally unique event ID, tenant ID, event type, occurred/received timestamps, producer identity, privacy classification and consent/authority context as applicable. Visitor and policy events also reference state revision, policy and composition versions, and experiment assignment where applicable. Validate identifiers, allowed values, nullability, timestamp semantics, retention and source signatures at the ingestion boundary. Reject or quarantine invalid events; never silently coerce them into trusted evidence.

**Assignment is not exposure.** A randomized visitor who fails to render the treatment stays in the predeclared intent-to-treat denominator. Exposure events describe actual rendering, not retrospective eligibility. Attribution confidence classes are type- and database-constrained: partial Class B or unmatched Class C cannot be relabeled Class A by UI or analytics code. Provider-verified unmatched orders remain included in relevant provider financial totals.

### 6.2.5 Delivery, idempotency and reconciliation

Assume at-least-once webhook delivery, retries, worker crashes, delayed or reordered events. Use stable event IDs, operation identities, unique constraints, transactional inbox/outbox and idempotent consumers to prevent duplicate **business effects**; do not promise exactly-once network delivery. For external actions, persist execution identity and reconcile unknown outcomes before retrying; never replay a payment, order or checkout action because an analytics job restarted. Apply provider-authoritative state transitions and reconciliation rules to late/out-of-order webhooks.

### 6.2.6 Privacy, retention and lifecycle

Every API query, background job, database access, cache key, object-store path and analytics projection is tenant-scoped and authorization checked. Data domains have purpose-specific retention and deletion policies; visitor events should not be retained indefinitely by default. Merchant disconnection, consent revocation and network-learning opt-out trigger defined restriction, deletion or lawful retention workflows, including handling of derived artifacts and provenance. Aggregation alone is not proof of anonymity or lawful reuse; shared learning requires permitted purpose and disclosure controls.

### 6.2.7 Migrations, replay and recovery

Use explicit event/schema versions, compatible expand-migrate-contract deployment patterns, integrity-preserving migrations and immutable historical assignment/evidence semantics. Analytics projections may be rebuilt from permitted source records; replays must never re-execute provider financial operations. Backup restores and migrations require reconciliation, integrity checks and tenant-isolation validation before sensitive operations resume. Evidence package versions, validator references and reproducibility must survive migration.

### 6.2.8 Engineering acceptance tests — mandatory

1. Every operational record is tenant-scoped and authorized.
2. Duplicate Shopify webhooks cannot duplicate business effects.
3. Out-of-order webhooks reconcile to provider-authoritative state.
4. Worker crashes do not silently lose accepted durable events.
5. Unknown external action outcomes cannot be blindly retried.
6. Experiment assignment remains stable under the declared identity model.
7. Assignment and actual exposure are stored separately.
8. Class B and C attribution cannot be promoted to Class A by a reporting query or model output.
9. Rebuilt reporting projections reconcile with their defined source data.
10. Historical evidence remains interpretable across schema migrations.
11. Domain-specific retention, withdrawal and deletion policies are enforced.
12. Tenants cannot access another tenant's events, evidence, caches or projections.
13. Analytics pipeline failures do not block commerce.
14. Event replay cannot duplicate provider financial operations.
15. Evidence packages preserve provenance, validator versions and reproducibility.
16. Data restoration is integrity- and reconciliation-verified before sensitive workflows resume.

**Implementation note:** Logical domains need not be separate databases or services. Enforce their authority and durability boundaries in code, database constraints and operational tests from day one.


## 6.3 Tenant Security, Privacy & Access Control — LOCKED (Option A)

**Decision: Defense-in-Depth Tenant Isolation + Deterministic Authorization.** Every access is denied unless an independently verified identity and authorization grant permit the specific tenant, resource, operation, purpose and applicable consent scope. AI outputs, visitor content, merchant content, and job payloads never confer authority.

### 6.3.1 Security boundaries and trust model

Protect tenant-to-tenant data; visitor-to-visitor session/cart/identity; merchant-to-platform privileged controls; service-to-service credentials and jobs; and AI-to-authoritative tools, commerce, policies and deployment. Apply least privilege and separation of duties. The hierarchy remains platform safety and consent > merchant-approved policies and truth > authorized execution. The platform's internal Intelligence Command Center and merchant Business Intelligence Manager have distinct permissions; the Execution Plane enforces both.

### 6.3.2 Tenant isolation in every layer

- **API/application:** authenticate actors; derive tenant identity from verified authorization, not user-supplied IDs; authorize action and field scope; fail closed.
- **PostgreSQL:** tenant-aware keys and foreign-key relationships, restricted runtime roles, suitable row-level security, explicit administrative roles and audit trails. RLS complements—not replaces—application authorization.
- **Connection pooling:** set tenant context transactionally, never leak it across pooled connections; regression-test reused connections and exception paths.
- **Workers/queues:** bind authenticated tenant and purpose to durable jobs, reauthorize at execution, reject forged/stale scopes; isolate retries and dead-letter handling.
- **Cache/object storage/search/vector retrieval:** tenant-scoped namespaces, permissions, encryption and cache keys; no cross-tenant retrieval or indexing.
- **Analytics/evidence:** tenant-scoped access to experiments, orders, reports, artifacts and derived projections; no unauthorized joins or export.
- **Control plane:** audited, time-bounded privileged operations where appropriate; prohibit merchants and AI from self-elevating.

### 6.3.3 Merchant and platform roles

Define granular permissions, with role templates such as merchant owner, administrator, analyst, experiment manager and viewer. Limit approvals, integrations, user management, data export and experimentation independently. Sensitive operations may require reauthentication or dual approval according to risk. Platform administrators use separate privileged identities and audited escalation; merchant roles cannot override global safety or privacy controls.

### 6.3.4 AI and untrusted-content security

Treat visitor text, product descriptions, external pages, retrieval results and model responses as untrusted data. No unrestricted LLM database access. Validate model outputs against typed schemas; independently authorize tool calls and destinations; restrict outbound network capabilities; scope retrieval *before* content enters a model; minimize/redact sensitive data sent to processors; enforce deterministic commerce and policy-promotion gates. A successful prompt injection must still lack the capability to exfiltrate data, alter merchant truth or deploy a policy. Test adversarial inputs in CI.

### 6.3.5 Three-layer knowledge boundary

1. **Platform knowledge:** independently developed/validated reusable engineering and UX patterns.
2. **Governed aggregate knowledge:** only permitted contributions with legal/contractual authorization, provenance, context compatibility, privacy review, suppression/minimum cohort controls, allowed-use metadata and withdrawal handling. Aggregation is not automatically anonymity.
3. **Merchant-private intelligence:** raw visitor data, orders, customer identity, private economics, policies and merchant-specific evidence remain tenant-isolated; never silently enter cross-merchant learning.

A scope change is not a string update. Require an authorized, separately validated transformation that produces a new versioned aggregate artifact. Opt-out must be enforced at collection/contribution and downstream processing while honoring applicable retention and withdrawal rules.

### 6.3.6 Secrets, providers and privacy

Keep Shopify tokens, payment secrets, model keys and service credentials in managed secret storage, never client bundles, prompts or routine logs. Encrypt in transit/at rest, scope tokens narrowly, rotate/revoke credentials, verify webhook signatures and protect against replay. Isolate production from development secrets. Define data inventory, lawful basis/consent as applicable, purpose limitation, field-level minimization, retention/deletion matrix and processor agreements. Keep payment-card data outside the experience layer. Do not promise data never leaves a merchant account: authorized processors and hosting may process it under explicit agreements.

### 6.3.7 Incident containment

On suspected tenant-boundary violation: contain the affected worker/credential/capability; preserve minimized audit evidence; establish impacted tenants, fields and time window; revoke/rotate access; evaluate notification obligations; repair and regression-test; reenable only after security verification. Prefer scoped containment, unless platform-wide risk requires broader action. Security gates block critical releases.

### 6.3.8 Engineering acceptance tests

1. Unauthenticated access to protected tenant resources is denied.
2. Merchant A cannot read/write Merchant B data by changing resource IDs.
3. Ordinary database roles cannot bypass tenant isolation for reads or writes.
4. Pooled connections never retain a previous request's tenant context.
5. Forged/stale background job metadata cannot cross tenant boundaries.
6. Cache, object storage, indexes and retrieval cannot expose other tenants.
7. Merchant roles cannot self-grant platform privileges.
8. Model text cannot authorize commerce actions, policy promotion or cross-tenant retrieval.
9. Prompt injection cannot bypass independent tool permissions or outbound restrictions.
10. Private evidence cannot enter shared knowledge without an authorized transformation.
11. Network-learning opt-out is enforced through downstream processing.
12. Revoked credentials/permissions stop authorizing new actions.
13. Secrets never appear in frontend bundles, model context or routine logs.
14. Webhook authenticity and replay protections are verified.
15. Retention, deletion and withdrawal workflows are auditable and enforceable.
16. An affected capability can be contained without needless tenant-wide outages.
17. Elevated administrative access is restricted, logged and reviewed.
18. Critical security test failures block release or promotion.

**Locked principle:** Kablet does not merely instruct components to behave securely; it limits what each component can technically do.


## 6.4 Deployment, Environments & Release Management — LOCKED (Option A)

**Decision:** Verified CI/CD + Controlled Rollouts + Experiment-Safe Releases. Production releases are successful only if verified, authorized, observable, compatible with active experiments, and recoverable without changing commerce truth.

### 6.4.1 Environments and authority

- **Local:** isolated development, synthetic fixtures and disposable databases; no default production credentials or customer data.
- **Automated test:** disposable CI environments for contract, migration, isolation, commerce idempotency, experiment and security checks.
- **Staging:** production-like topology and monitoring, provider sandboxes or appropriately protected test data, integration and recovery rehearsals.
- **Production:** restricted access, reviewed and traceable release artifacts, controlled rollout and tested recovery. Environment isolation must be technically enforced; staging must not accidentally possess production authority. The environments may use lightweight managed infrastructure rather than four costly clusters.

### 6.4.2 Independently governed change types

1. **Application code:** frontend, runtime, API or worker release; requires CI, compatibility and deployment health gates.
2. **Database schema:** expand/migrate/contract lifecycle; compatibility, backups, backfills and validation.
3. **Experience/policy:** versioned composition and decision rules; Chapter 5.6's five AND gates and merchant/platform approvals remain mandatory.
4. **AI configuration:** model, prompt, interpreter and output-schema changes; version pinning, behavior, safety, cost and experiment-impact checks.
5. **Commerce integration:** Shopify/provider adapter and webhook changes; authorization, receipt, idempotency and reconciliation tests.

A successful application deployment does **not** authorize a policy promotion, a commerce action or a new experiment assignment. Distinct authority and audit records apply.

### 6.4.3 Verified release pipeline

Reviewed source and declared change type → reproducible/traceable build → automated unit, integration, contract, tenant isolation, security, idempotency and schema checks → staging end-to-end shopping and provider sandbox verification → authorized production canary → gated rollout → stable version with monitoring and recovery target. Use protected branches, least-privileged deployment identities, dependency/secret scanning and artifact integrity controls. Emergency changes may use narrowly scoped expedited authority, but require an audit trail and retrospective validation.

### 6.4.4 Experiment-safe deployment contract

Every active experiment pins or records the relevant application, renderer, composition, policy, AI interpreter, event schema, attribution and analysis versions needed to reproduce assignment and treatment. Deployment impact assessment explicitly covers eligibility, randomization, assignment stability, exposure, outcomes, attribution and treatment consistency. Compatible security fixes may proceed with documented validation. Material incompatibility requires pause, restart or invalidation; never silently preserve a causal conclusion after treatment changes. **Safety takes precedence over experiment continuity**: urgent containment is permitted, with documented exposure and inference consequences.

### 6.4.5 Database migration and recovery

Use **expand → migrate → contract**: add compatible structures; run resumable, observable, validated backfills; remove obsolete structures only after all dependent apps/workers are migrated. Test rolling-version compatibility, data reconciliation, locks and migration failure recovery. Application rollback is not a promise that destructive schema changes can be reversed. Maintain compatible stable binaries and safe alternatives where rollback is impossible. Preserve historical experiment evidence and schema interpretability.

### 6.4.6 Feature flags and progressive rollout

Flags may control platform kill switches, tenant enablement, entitlement, release cohorts and experiment allocation, but must not override deterministic authorization, merchant approvals or platform safety. Distinguish code availability from policy activation. Canary rollout may be instance-, tenant- or traffic-scoped depending on the change. An illustrative 1% → 10% → 50% → 100% sequence is configurable, **not universal**. Advance only on predeclared health checks: errors, latency, rendering, mobile/accessibility, cart and checkout continuity, tenant isolation, event integrity and financial reconciliation. Critical safety and financial violations stop rollout regardless of average revenue. A small canary cannot detect every rare defect.

### 6.4.7 Separate recovery operations

- **Application rollback:** restore compatible code; check schema, worker and active-experiment compatibility.
- **Policy rollback:** restore an approved compatible experience baseline; preserve valid visitor/cart state and record affected exposures.
- **Integration containment:** restrict or disable failing external capabilities; reconcile unknown provider outcomes before retry.

None of these operations cancels legitimate payments, refunds completed orders, or replays checkout operations automatically. Maintain last-known-compatible application and policy targets; when unavailable, use a separately tested safe fallback. Record who/what initiated recovery, why, when, scope, impact and validation outcome.

### 6.4.8 Mandatory engineering acceptance tests

1. Development and CI lack default production secret access.
2. Production releases originate from verified traceable artifacts.
3. Failed critical security or tenant-isolation CI gates block release.
4. Code deployment cannot automatically activate an unapproved merchant policy.
5. Active experiments retain version provenance across compatible releases.
6. Material experiment incompatibility is detected and paused/restarted/invalidated.
7. Emergency safety fixes override experiment continuity with audit and impact records.
8. Migrations are tested for forward, mixed-version and rollback compatibility.
9. Destructive changes cannot bypass expand/migrate/contract authorization.
10. Critical safety, financial or experience regressions halt canary progression.
11. Feature flags cannot bypass tenant permissions or merchant approval.
12. Application rollback preserves valid orders and in-progress payment operations.
13. Policy rollback never initiates financial rollback.
14. Integration failures can be contained without needless unrelated outages.
15. Each release is attributable to source commit, artifact, configuration and actor.
16. Recovery procedures are rehearsed in staging.
17. Compatible old/new workers safely coexist during rolling deployments.
18. Changes in measurement semantics cannot silently retain invalid experiment conclusions.

**Locked principle:** A release is successful only when verified, authorized, observable, experiment-compatible and recoverable without damaging commerce truth.


## 6.5 Performance, Edge Delivery & Scalability — LOCKED (Option A)

**Decision:** Fast Baseline + Edge Delivery + Optional AI Enhancement. **The fastest useful experience wins. AI is an accelerator, never a prerequisite for shopping.**

### 6.5.1 Three workload classes and the critical path

- **Class 1 — Immediate shopping:** initial useful render, navigation, product/variant selection, cart and deterministic composition decisions. These cannot synchronously depend on an LLM, Learning Analyst, or successful analytics ingestion.
- **Class 2 — Optional intelligent assistance:** free-form intent, sophisticated comparisons and conversational discovery. Use per-operation timeouts, concurrency budgets, cancellation, visible feedback, schema validation and a safe baseline fallback. A timeout must not block shopping.
- **Class 3 — Asynchronous intelligence:** telemetry processing, Shopify outcome reconciliation, experiments, hypothesis generation, aggregate learning and reporting. Isolate workers and resource pools from critical storefront execution; accepted durable evidence must survive overload.

### 6.5.2 Edge-first useful rendering and adaptive stability

Deliver public static assets and appropriately cacheable catalog content through a CDN/edge. Render a useful, accessible, SEO-capable shopping shell (where required) from verified merchant facts and approved default compositions before optional AI completes. Apply deterministic adaptation from authorized policy and permitted visitor state. Progressive enhancement must not create distracting layout shifts, focus loss, accessibility failures or state resets. Edge compute and caching are performance tools, **not an authorization boundary**: tenant-private content, cart, visitor state, credentials and sensitive decisions cannot enter shared public caches.

### 6.5.3 Proposed initial performance budgets

These are **engineering targets pending field validation**, not measured Kablet results or universal guarantees:

| Metric | Initial target / contract |
|---|---|
| Largest Contentful Paint (LCP) | ≤2.5 seconds at p75 for relevant real-user populations |
| Interaction to Next Paint (INP) | ≤200 ms at p75 |
| Cumulative Layout Shift (CLS) | ≤0.1 at p75 |
| Deterministic decision processing | Target ≤50 ms server processing at p95, separately from network/rendering |
| Optional AI | Operation-specific bounded timeout; no core-shopping dependency |
| Analytics in critical path | Zero synchronous dependency on successful analytics ingestion |

Measure by device, network, page/journey type, tenant and release where sufficient data exists. Collect real-user monitoring with appropriate consent and minimization; test representative mobile devices and adverse networks. Monitor tail latency, not only averages. Define a controlled benchmark and baseline for any performance-related commercial claim.

### 6.5.4 Commerce continuity and state invariants

Composition changes must preserve selected variants, quantities, cart contents, visitor context and accessible focus behavior. No adaptation may change merchant-authoritative price/inventory, interrupt checkout or trigger payment retries. Restrict adaptation during sensitive commerce operations. A UI timeout or policy rollback cannot cancel, duplicate, reverse or replay legitimate financial operations; reconcile uncertain provider outcomes separately.

### 6.5.5 Caching, freshness and tenant safety

Use versioned CDN caching for public assets and images. Public catalog caches require merchant scope and freshness/invalidation controls. Merchant policies are versioned and invalidated on change; visitor state is private, short-lived and purpose-limited. Cart/checkout state remains authoritative in the approved provider or secure scoped storage. AI outputs may be cached only with explicit privacy, tenant, context, version, retention and safety constraints. Experiment assignment remains stable through caches and rendering paths. A cache hit never authorizes wrong-tenant disclosure or stale purchase terms.

### 6.5.6 Selective scaling, overload and backpressure

Scale storefront delivery, deterministic APIs, commerce/reconciliation workers, optional AI and background learning according to measured resource demand; do not require a microservice for every role. Apply concurrency caps, provider-aware rate limits, bounded retries, circuit breakers, queues and per-tenant fairness. During bursts, preserve core browsing, authorized commerce, deterministic security and durable accepted events; shed/defer optional AI and noncritical enrichment first. Avoid cascading overload and cross-tenant noisy-neighbor failures. Droppable enrichment must be explicitly distinguished from legally/commercially important records.

### 6.5.7 Performance as a promotion guardrail

Performance, accessibility and continuity are hard quality requirements in the Chapter 5.6 five-gate promotion contract. A commercially promising treatment that violates critical experience guardrails cannot promote. A simpler faster experience may win through a **predeclared non-inferiority** design where commercial acceptability is established; an inconclusive superiority test is not proof of equivalence. Operational drift and regressions invoke Chapter 5.8 monitoring and containment, not unauthorized AI self-correction.

### 6.5.8 Mandatory engineering acceptance tests

1. An approved useful storefront renders without an AI response.
2. Optional AI timeout/failure does not disable browsing, cart or checkout.
3. Core shopping has no synchronous dependency on successful analytics ingestion.
4. CDN/shared caches cannot expose private visitor or merchant information.
5. Cached merchant facts respect tenant, version, invalidation and freshness constraints.
6. Experiment assignments remain stable through edge/application caching.
7. Adaptation preserves variants, cart and critical visitor state.
8. Composition updates respect layout stability, focus and accessibility constraints.
9. Field and lab budgets are evaluated on representative mobile networks/devices.
10. Server decision latency is measured separately from end-to-end latency.
11. AI/learning resource demand cannot starve critical commerce capacity.
12. Provider rate limits trigger bounded retries/backpressure, not request storms.
13. Traffic bursts shed optional intelligence before critical shopping functions.
14. Accepted durable events are not silently discarded under overload.
15. Tenant traffic spikes do not unnecessarily degrade unrelated tenants.
16. Policy promotion enforces performance and accessibility guardrails.
17. Stale prices/inventory cannot be presented as authoritative due to caching.
18. Load tests cover steady-state, bursts, failures and graceful degradation.

**Locked principle:** The fastest useful experience wins; optional AI must never be a prerequisite for ordinary shopping.


## 6.6 Reliability, SLOs & Incident Response — LOCKED (Option A)

**Decision:** Capability-Based SLOs + Deterministic Incident Response. Measure customer-visible shopping capabilities, prioritize safety and commerce, degrade optional intelligence predictably, establish incident ownership and evidence-preserving recovery. Internal SLOs are not contractual SLAs; external-provider availability is not within Kablet's control.

### 6.6.1 Reliability tiers and authority

- **Tier 0 — Safety and commerce integrity:** tenant authorization, consent, authoritative merchant facts, idempotent external actions, transaction integrity and financial reconciliation. Never disable a safety invariant to preserve availability.
- **Tier 1 — Core shopping:** accessible storefront, product discovery, variants, cart and checkout handoff. Highest availability priority after safety.
- **Tier 2 — Adaptive experience:** deterministic composition selection and nonessential experience enhancement. Fall back to an authorized stable baseline when degraded.
- **Tier 3 — Optional intelligence and learning:** AI interpretation, hypotheses, learning jobs and reporting projections. These are deferrable and must not take down core shopping.

A lower-tier outage must not cascade into a higher-tier failure. Protected operations fail closed if authorization is unavailable; optional intelligence fails safely to a usable baseline. Provider errors must not be misrepresented as successful orders or payments.

### 6.6.2 Capability-based measurement and proposed SLOs

An **SLI** is a defined observed measurement; an **SLO** is an internal target; an **SLA** is a contractual commitment requiring separate approval and operational evidence. Proposed *initial*, unverified targets (not guarantees):

| Capability | Candidate internal objective | Measurement boundary |
| --- | --- | --- |
| Core storefront | 99.9% monthly | Eligible useful storefront responses and validated synthetic journeys |
| Deterministic decision service | 99.9% monthly | Valid decision or approved safe fallback |
| Kablet-controlled cart operations | 99.9% monthly | Eligible operations with confirmed successful outcome |
| Critical accepted events | No silent loss | Durable inbox/outbox, reconciliation and recovery checks |
| Tenant isolation | Zero known unauthorized cross-tenant access | Security invariants, detection and incident review; not an uptime percentage |
| AI assistance | Separately established after pilot | Availability, timeout and fallback correctness |
| Reporting freshness | Report-specific | Last successful reconciliation and measured lag |

Each SLI has versioned eligible denominator, success criteria, exclusions, source, aggregation, measurement window, ownership and alerts. 99.9% availability corresponds mathematically to 43 minutes 12 seconds of unsuccessful time in a 30-day month *only for time-based measurement*; event-based SLOs are not interchangeable with minutes. Review objectives against pilot evidence and operating cost. Never promise external Shopify or payment-provider uptime.

### 6.6.3 Real shopping synthetic monitoring

Probe representative safe journeys: load a storefront, view a test product, choose a variant, add to an isolated test cart, validate cart content and price, reach an approved checkout test boundary, and check expected operation/event records. Use sandbox or explicitly segregated production-safe identifiers; never generate real charges, consume live inventory inadvertently, or pollute experiments. Pair synthetic probes with real-user indicators and provider reconciliation; an HTTP 200 alone does not prove a working store.

### 6.6.4 Severity, ownership and response

| Severity | Illustrative condition | Response |
| --- | --- | --- |
| SEV-1 critical | Cross-tenant exposure, unsafe financial operation, widespread checkout corruption | Immediate containment, incident command and escalation |
| SEV-2 high | Significant storefront/cart failure or widespread integration degradation | Urgent mitigation, stakeholder updates and recovery |
| SEV-3 moderate | Isolated noncritical failures, reporting lag, partial rendering issue | Investigate against defined response targets |
| SEV-4 low | Cosmetic or minor diagnostic issue | Normal prioritized backlog |

Define impact-based thresholds, on-call responder, incident commander, communications owner, escalation path and emergency permissions in runbooks. AI may summarize evidence, but cannot downgrade incidents or independently override safety controls. Response sequence: **detect → classify and assign → contain → verify recovery → postmortem and corrective actions**. All changes and timelines are auditable.

### 6.6.5 Error budgets and release restrictions

Set an error-budget policy derived from each defined SLO. Healthy budget permits normal gated releases; elevated burn restricts risky releases; exhausted budget triggers stability-first operation. Predefine burn-rate alerts, evaluation windows, exceptions and who may approve release resumption. Security containment and urgent reliability fixes remain permissible even under freeze. Error budgets never excuse privacy, authorization or transaction violations.

### 6.6.6 Dependency-specific degradation contract

| Failed dependency | Deterministic required behavior |
| --- | --- |
| AI model | Continue approved baseline and deterministic shopping; time out/cancel optional assistance |
| Learning workers | Continue shopping; retain accepted durable work for bounded retry |
| Reporting projections | Mark freshness/staleness or unavailable; never block commerce |
| Decision service | Use approved versioned baseline/cache if authorized and sufficiently fresh; otherwise safe unavailable state |
| Shopify API | Permit truthful cached browsing where safe; suspend dependent mutations and explain status |
| Checkout/payment provider | Do not claim payment or checkout success; preserve reconciliation identifiers |
| Event pipeline backlog | Preserve accepted durable events, enforce backpressure and disclose reporting lag |
| Tenant authorization | Deny protected operation; no permissive fallback |
| Critical price/stock/terms stale | Do not display as current verified facts or permit unsafe purchase action |

Circuit breakers, timeouts, queue limits, rate limits, kill switches and provider isolation must operate without LLM dependence. Protect tenant blast radius and core capacity; do not drop accepted critical events as a load-shedding shortcut.

### 6.6.7 Recovery, experiment integrity and merchant communication

Recovery is not complete on HTTP health alone: rerun affected synthetic shopping journeys, verify tenant authorization, check cart/checkout and provider reconciliation, validate durable-event completeness, and assess data integrity. Track incident times, affected tenants, policy versions, assignment/exposure asymmetry, missing outcomes and concurrent changes. A treatment-skewed outage may invalidate an experiment; do not silently discard outage data, alter predeclared exclusions or retain invalid lift claims. Safety intervention overrides experiment continuity but must be recorded.

Communicate merchant-relevant impact, affected functions, verified containment, next update cadence and known uncertainty. Do not invent recovery ETAs or assure payment safety without evidence. Apply applicable contractual/legal notifications. Postmortems document timeline, customer impact, contributing conditions, successful/failed containment, commerce/evidence reconciliation, owners, deadlines and regression tests. Practice incidents and runbooks before relying on them in production.

### 6.6.8 Mandatory engineering acceptance tests

1. Customer-visible success—not only HTTP status—defines storefront availability.
2. Synthetic and operational signals detect broken cart/checkout paths.
3. Tier 3 outages cannot automatically disable Tier 1 shopping.
4. Tenant authorization failure denies protected operations.
5. Optional AI failure yields usable authorized deterministic fallback.
6. Confirmed safety or financial-integrity failures trigger containment regardless of commercial metrics.
7. External-provider failures are distinguishable from Kablet-controlled faults.
8. AI cannot downgrade incident severity or override incident authority.
9. High-severity incidents have assigned owner, escalation and timestamped timeline.
10. Kill switches and rollback do not depend on the failed AI service.
11. Recovery verification includes synthetic shopping and relevant financial reconciliation.
12. Experiment assignment, exposure and outcome impacts are recorded for incidents.
13. Invalidated experiments cannot remain published as valid evidence.
14. Error-budget release restrictions do not prevent emergency safety fixes.
15. Merchant incident notices avoid unverified recovery and financial assertions.
16. Incident evidence and corrective actions have scoped access, retention and audit trail.
17. On-call procedures are exercised through simulated incidents.
18. SLI/SLO denominators, exclusions, windows and calculation versions are auditable.

**Locked principle:** Reliability means customer-visible capabilities remain safe, failures are contained and recoverable, and neither transaction integrity nor experimental evidence is sacrificed to preserve an uptime headline.


## 6.7 AI and Infrastructure Cost Governance — LOCKED (Option A)

**Decision:** Selective AI + Per-Tenant Cost Ledger + Enforced Budgets. Kablet optimizes merchant-verified incremental net revenue per eligible visitor while independently ensuring sustainable platform unit economics. The merchant's verified revenue uplift is not Kablet's recognized revenue, nor necessarily merchant profit. AI is an optional accelerator; ordinary shopping and deterministic decisions must not depend on an LLM. Costs cannot be reduced by violating consent, tenant isolation, commerce integrity, or evidence durability.

### 6.7.1 Cost classes and authority

Three cost priority tiers govern overload and spending controls: (1) safety and core commerce—storefront, deterministic decisions, authorized cart/checkout handoff, authentication, financial idempotency and required reconciliation; (2) essential measurement—durable event intake, assignment/outcome integrity, provider verification and audit evidence; (3) optional intelligence—AI interpretation, nonessential enrichment, hypothesis generation and discretionary analysis. Protect reserved resources for the first two; contain tier three first. A hard optional-AI budget must never shut down authorized ordinary shopping or silently lose accepted critical events. Tenant, feature, workload and platform cost controls are deterministic, not LLM-discretionary.

### 6.7.2 Cost ledger, measurement and allocation

Record cost by platform, merchant and workload, distinguishing directly metered costs, estimates and shared allocations. Categories include AI provider inference (model, version, input/output tokens, retries, provider pricing version, estimated or billed cost), compute, databases, storage/backups, CDN/egress, integration usage, observability and attributable operational services. Every call or job carries validated tenant, feature and purpose scope, with minimal privacy-safe metadata; raw visitor content is not needed for billing. Reconcile internal metering with provider invoices under defined tolerances, currency, billing period, credit/discount and late-adjustment rules. Version allocation methods and label estimates explicitly. Aggregate tenant cost cannot be inferred solely from visitor count; intensity of optional assistance, retries and workload mix matter.

### 6.7.3 Selective inference and routing

Route known intent and approved compositions through deterministic rules at zero LLM calls. For ambiguous free-form intent or complex guidance, evaluate authorization, user benefit, context adequacy, budget, privacy, latency, provider health and deterministic fallback before a bounded model call. The AI interpreter returns schema-validated suggestions, never autonomous authority over catalog facts, pricing, inventory, transactions, experiments or safety rules. Constrain tokens, execution steps, tool invocations, retries, parallelism and deadlines; disallow recursive uncontrolled tool loops. Safe caching requires tenant/context/policy/model compatibility, bounded freshness and privacy authorization. Model routing is versioned and evaluated against structured-output quality, intent accuracy, safety, language support, latency, provider reliability, actual cost and retry burden. Cheapest per-token is not necessarily cheapest per useful successful decision.

### 6.7.4 Budgets, anomalies and overrides

Enforce layered soft thresholds (alerts and forecasts), hard limits for *new optional* work (deny, downgrade or deterministic fallback), and protected operational capacity. Support platform-wide, per-tenant, feature, provider/model and job-class budgets with defined reset windows and accounting lag. Apply concurrency ceilings, rate limits, bounded queues and provider circuit breakers to prevent runaway cost and noisy-neighbor damage. Budget increases and emergency overrides require a specifically authorized actor, reason, scope, expiry and immutable audit trail; an LLM cannot self-authorize an increase. Monitor spend anomalies, provider-price changes, retries, logs, database queries and network egress. Forecasts must identify uncertainty and metering lag.

### 6.7.5 Unit economics and reporting

Track direct service cost per merchant, per 1,000 eligible visitors, per successful optional-AI interaction and per governed workload. Track merchant subscription/usage revenue **recognized by Kablet** separately from merchant gross merchandise value, Shopify revenue and causally estimated merchant uplift. Internal contribution margin is recognized Kablet revenue minus defined direct service costs; define allocation and accounting rules consistently and keep broader operating expenses separate where appropriate. Report actual vs estimated usage, unit cost, forecast, budget consumption, exceptions and data freshness. Merchant-facing usage or billing is scoped to authorized information, not automatically the platform's internal margin ledger. No fictional cost example is a production result.

### 6.7.6 Experiment and release integrity

AI model, prompt, routing, cache, timeout and budget changes can alter treatment. Version these inputs and evaluate compatibility with active experiments under 6.4 and Chapter 5. If a budget changes treatment mid-experiment, record assignment/exposure asymmetry, affected cohorts and dates, and assess validity. Never silently exclude expensive visitors, revise denominators, infer causal lift from tracked conversions, or conceal treatment changes. Cost savings do not bypass Chapter 5's five AND policy-promotion gates or merchant-approved boundaries. Optimize AI spending against measured quality and *verified* commercial evidence where available, without assuming every AI call has proven incremental value.

### 6.7.7 Illustrative economics, not a vendor quote

At 100,000 monthly visitors, 10% triggering one AI call at an assumed $0.003 per call yields 10,000 calls and $30 estimated monthly inference cost. At 100% triggering five calls, the same assumed unit cost yields 500,000 calls and $1,500. Both exclude retries, other models, compute, storage, network, taxes, credits and changes in provider pricing. The illustration demonstrates sensitivity to routing and invocation frequency, not measured Kablet cost or a pricing promise.

### 6.7.8 Mandatory engineering acceptance tests

1. Every AI call has an authorized tenant, workload, model/configuration version and metering scope.
2. Internal token and provider-cost records reconcile to provider bills within specified tolerances.
3. Shared-cost allocations are labeled as estimates, with versioned methodology.
4. Known deterministic tasks function without mandatory LLM calls.
5. Optional AI requests obey platform, tenant, feature and provider budgets.
6. AI output cannot approve or increase its own spending allowance.
7. Exhausting an optional AI budget leaves core browsing and commerce functional.
8. Safety, required financial reconciliation and durable evidence capacity are protected from inference spikes.
9. AI retries, recursion, tool calls and concurrent execution have enforced ceilings.
10. Model routing and configuration changes are versioned, tested and auditable.
11. Model evaluation covers quality, safety, latency, reliability and *total* effective cost.
12. Learning and enrichment jobs support bounded batch execution and backpressure.
13. Budget-induced treatment changes are recorded and assessed for experiment validity.
14. Cost reports distinguish metered actuals, estimates, allocations and delayed adjustments.
15. Merchant incremental RPV is never represented as Kablet revenue or merchant profit.
16. Per-tenant anomalies alert and allow authorized, scoped containment.
17. Abuse prevention preserves tenant boundaries, privacy and consent.
18. Budget overrides require scoped authority, expiry, justification and audit.
19. Cost controls never silently drop accepted critical events or skip required reconciliation.
20. Per-merchant and platform-level direct service economics are reproducible from versioned records.

**Locked principle:** Every AI call must earn its place. Every merchant must have understandable service economics. No cost optimization may compromise commerce truth, privacy, authorization or experiment integrity.


## 6.8 Integrations, Webhooks & Provider Operations — LOCKED (Option A)

**Decision:** Governed Provider Adapters + Durable Webhooks + Verified Reconciliation. Shopify is the first production commerce integration. This section specifies an engineering contract; it does not claim a live Shopify integration has passed its readiness gate.

### 6.8.1 Trust boundary and ownership

An integration is a governed trust boundary, not simply an API connection. Every provider operation must be authenticated, tenant-scoped, explicitly authorized, versioned, observable, and reconciled when its outcome is uncertain. Shopify remains authoritative for its product and variant identifiers, merchant-controlled prices, inventory/availability under supported provider semantics, carts and checkout operations, orders, refunds, cancellations, and provider-controlled payment state. Kablet owns authorized adaptive compositions, consent-scoped visitor decision state, experiment assignments, and the provenance of its evidence conclusions. Kablet never fabricates provider truth or silently substitutes cached or AI-generated facts for authoritative commerce records. A future Kablet-native storefront requires separately established authoritative commerce boundaries, not assumptions copied from Shopify.

### 6.8.2 Provider adapter contract

The execution plane submits typed capability requests through a deterministic authorization and validation boundary to versioned provider adapters. The adapter translates provider-specific API semantics into typed request/receipt/error contracts; it does not grant new authority. Each request carries verified tenant scope, approved capability and version, merchant policy and consent context where applicable, actor/visitor confirmation when required, fresh visitor state revision, stable external operation identity, and bounded timeouts. Returned receipts distinguish confirmed success, confirmed rejection, and unknown outcomes, with raw provider evidence references retained under appropriate privacy controls. No LLM receives unrestricted provider credentials, unrestricted database access, or authority to approve financial actions. Unsupported provider capabilities remain disabled.

### 6.8.3 Shopify merchant onboarding and activation

The onboarding lifecycle is: (1) authenticated merchant authorization through provider-supported installation; (2) least-privilege scope and capability validation; (3) resumable, paginated initial catalog/configuration synchronization; (4) supported webhook subscription registration and signature-verification setup; (5) durable synchronization checkpoint and provider reconciliation baseline; (6) operational readiness verification for freshness, authorization, fallback, error handling, and commerce actions; (7) separately approved merchant activation. Installed does not mean ready. Tokens are stored in managed secret storage and must not appear in browser bundles, prompts, ordinary logs, or unrelated tenant processes. Scope changes, uninstall, and credential revocation immediately constrain new operations.

### 6.8.4 Webhook intake, ordering, and durable processing

Webhook pipeline: authenticate signature and source according to provider documentation; resolve tenant from trusted integration mapping; validate event schema and size; durably commit to tenant-scoped inbox; acknowledge only according to verified durable-acceptance policy; deduplicate on provider-supported stable identifiers and scoped uniqueness constraints; process asynchronously and idempotently; reconcile provider-authoritative state when notification ordering or freshness matters; update versioned projections and audit references. Assume duplicate, delayed, out-of-order, and missing deliveries; do not assume globally ordered or exactly-once transport. Where webhook payloads can be stale, re-fetch or reconcile against authoritative provider state before changing critical projections. Failed events enter observable bounded retry/dead-letter and repair workflows without silently disappearing.

### 6.8.5 Commerce action lifecycle and idempotency

An authorized action transitions through requested, validated/authorized, submitted, and terminal confirmed/failed or explicitly unknown/reconciliation-needed states, consistent with the locked action lifecycle. Record stable operation keys, attempt identities, request fingerprints, provider references, receipts, and verified reconciliation results. A timeout is not proof of failure. For operations capable of duplicate business effects, retry only if provider-supported idempotency guarantees or a verified reconciliation strategy make it safe; otherwise quarantine or disable the operation until resolved. If provider APIs cannot support adequate safety for a sensitive capability, do not expose that capability. Application, policy, and integration rollbacks cannot automatically cancel, refund, or replay legitimate transactions.

### 6.8.6 Rate limits, outage isolation, and backpressure

Apply provider-specific concurrency and rate budgets, bounded exponential backoff with jitter when safe, retry classifications, circuit breakers, queue prioritization for required reconciliation, and tenant-isolated capacity. Provider outages must not trigger retry storms or exhaust unrelated merchants' workers. Optional intelligence degrades before core browsing and authorized commerce. If checkout or payment verification is unavailable, surface accurate unavailability or unknown status, never a fabricated purchase confirmation. Track permission errors, rate-limit responses, queue age, webhook lag, unresolved actions, and recovery checkpoints.

### 6.8.7 Freshness and commercial accuracy

Classify provider facts by risk. Critical price, variant availability, inventory, and checkout terms require provider-appropriate freshness/verification before sensitive actions; catalog descriptions and merchant policies require versioned synchronization and invalidation; public images and static metadata may use safe caching; orders, refunds, and cancellations require authoritative reconciliation with explicit outcome maturity and lag. TTLs are provider- and operation-specific, not universal. During synchronization delays, allow safe browsing where possible but never label stale critical facts as current or substitute guessed values. Edge and cache keys must enforce tenant scope.

### 6.8.8 Measurement and attribution boundary

A verified provider order is commercially real even without deterministic visitor linkage. Include it in the applicable provider revenue totals but do not invent session attribution. Preserve Class A verified deterministic linkage, Class B partial diagnostic evidence, and Class C unmatched records as structurally distinct types. Reconcile orders, refunds, cancellations, duplicates, and delayed events against the Chapter 5 experiment contract. A causal incremental-RPV claim requires a valid randomized comparison, correct eligible denominators, consistent measurement across arms, and the predeclared analysis; webhook receipt alone does not establish attribution or causal lift.

### 6.8.9 Disconnect, revocation, and lifecycle changes

On uninstall, authorization withdrawal, or revoked scopes: stop new protected provider actions; invalidate relevant capabilities and credentials; pause or reconcile queued operations under documented rules; remove or disable stale storefront integrations; preserve legally or contractually necessary audit and reconciliation evidence under access and retention limits; execute permitted deletion/restriction workflows; record unresolved provider outcomes. Disconnect must never itself cancel legitimate provider orders or initiate unauthorized refunds. Provider adapter and API-version upgrades require compatibility tests, controlled rollout, and experiment-impact assessment.

### 6.8.10 Operational visibility and first merchant proof gate

The internal Intelligence Command Center reports, per tenant/provider, connection authorization and scopes, last successful catalog synchronization, webhook processing freshness, event failures, provider rate limits, action outcome counts, unresolved reconciliation, and verified order/refund coverage with timestamps and confidence/coverage labels. Merchant-facing status shows meaningful issues without leaking credentials or other tenants' information. Before the first real Shopify RPV proof, verify one merchant's authentic installation, genuine catalog and prices, actual checkout flow, authorized action lifecycle, provider-confirmed orders/refunds, reliable experiment assignment and measurement, safe fallbacks, and reproducible reconciliation. Passing this gate establishes integration readiness, **not** positive incremental revenue.

### 6.8.11 Mandatory engineering acceptance tests

1. Installation never grants privileges beyond verified provider authorization.
2. Every provider operation is tenant-scoped, capability-authorized, and policy-valid.
3. Forged or invalid webhooks cannot update trusted state.
4. Duplicate webhook deliveries never duplicate business effects.
5. Out-of-order notifications cannot overwrite newer authoritative facts silently.
6. Durably accepted webhooks survive worker crashes and can be replayed safely.
7. Provider timeouts produce explicit unknown outcomes where appropriate.
8. Unknown non-idempotent operations cannot be blindly retried.
9. Operation identifiers, idempotency keys, and receipts are stable and auditable.
10. Rate limiting invokes bounded retries/backpressure rather than request storms.
11. Provider outages cannot produce false purchase/payment confirmations.
12. Critical prices and availability pass defined freshness checks.
13. Interrupted synchronization resumes from validated checkpoints.
14. Orders, refunds, and cancellations reconcile with provider-authoritative records.
15. Unmatched provider orders cannot become Class A attributed outcomes by inference.
16. Revoked credentials and scopes prevent new unauthorized operations.
17. Uninstall respects pending-action reconciliation and retention/deletion rules.
18. One merchant's provider failures cannot exhaust all tenants' processing capacity.
19. Adapter and provider API upgrades pass contract and experiment compatibility checks.
20. First merchant commercial proof is blocked until the full end-to-end integration readiness gate passes.

**Locked principle:** Kablet may adapt the experience, but it must never improvise the truth of an external commerce operation.


## 6.9 Observability, Auditability & Disaster Recovery — LOCKED (Option A)

**Decision: End-to-End Observability + Protected, Tamper-Evident Evidence + Verified Recovery.** Instrument operational behavior across Kablet's storefront, execution plane, internal Intelligence Command Center, merchant Business Intelligence Manager, durable workers and Shopify adapters. Protect high-impact audit records, rehearse restoration, and do not declare recovery until tenant authority, external commerce outcomes, and experimental evidence have been verified. Implement these capabilities pragmatically for the first merchant rather than building an oversized operations organization.

### 6.9.1 Distinct purposes and boundaries

- **Observability:** metrics, distributed traces, and structured logs explain operational health, latency, failures, queue lag, costs and provider dependencies.
- **Auditability:** durable, access-controlled records establish who or what acted, under which authority, against which policy and code versions, with what provider receipt and evidence. General diagnostic logs are not the authoritative audit ledger.
- **Disaster recovery:** backups, restoration, reconciliation and controlled reactivation establish a verified operational state after infrastructure or data loss.
- Correlation uses opaque scoped identifiers (tenant, request, trace, decision, action, provider operation, experiment and release), timestamps and schema versions. Correlation must not become a cross-tenant access path.
- Internal operators receive role-scoped operational access; merchants can see only their authorized tenant's data. Neither control plane may bypass the platform's security hierarchy.

### 6.9.2 Instrumentation and operational indicators

- **Metrics:** eligible storefront and cart success, latency distributions, deterministic-decision fallback rates, optional AI timeouts, authorization denials, provider errors, webhook acceptance/processing lag, unresolved unknown action outcomes, experiment assignment/exposure integrity, cost, database and worker saturation, and backup/restore verification.
- **Traces:** propagate bounded correlation across request, policy authorization, decision, adapter attempt, provider response and reconciliation; record failures and time spent at each boundary without exposing sensitive payloads.
- **Structured logs:** severity, environment, component, error category, version and safe correlation identifiers. Apply redaction, access controls, retention and sampling rules; never log raw payment credentials, secrets, unnecessary PII, or unrestricted AI prompts by default.
- Monitor real shopping journeys, not merely HTTP status. Alert on customer-visible failures and Tier 0 integrity invariants. Distinguish provider-caused failures from Kablet-controlled failures.
- Observability outages must not block core shopping. Critical evidence required by the transaction or authorization contract must still be durably recorded or the protected operation must fail safely.

### 6.9.3 Auditable decision and action provenance

Create actor-attributed, versioned records for merchant policy approvals and changes, experiment contracts and launches, AI/model configurations, permissions, sensitive capability execution, provider receipts, emergency overrides, policy promotion/rollback, published experiment conclusions, and recovery actions.

Each high-impact record must identify: tenant and authorized scope; human/service actor; action and outcome; prior/new policy or configuration version as relevant; timestamp; authorization and approval evidence; stable action or provider operation identity; and associated immutable or tamper-evident evidence references. Use append-only application semantics and protected storage/verification where supported. Do not claim cryptographic immutability without an implemented verification mechanism. Record retention and lawful deletion requirements must be reconciled explicitly.

For a composition decision, reconstruct from permitted visitor-state revision, recorded signals, eligible compositions, policy/interpreter/decision versions, deterministic reason codes, experiment assignment and confirmed exposure (if any). LLM explanations may summarize recorded evidence only; missing reasoning or evidence must be labeled unknown, never invented.

### 6.9.4 Recovery classes and measurable objectives

Set RPO (maximum tolerated recoverable data-loss window) and RTO (target restoration time) per capability. **Initial planning candidates, not production guarantees:**

| Domain | Candidate RPO | Candidate RTO | Verification |
|---|---|---|---|
| Critical operational state | ≤5 minutes | ≤1 hour | Restored authorization, schema and transaction checks |
| Durable commerce-action ledger | As close to zero as technically demonstrable | ≤1 hour | Provider identity and outcome reconciliation |
| Experiment assignments and evidence | ≤5 minutes with explicit gap assessment | ≤4 hours | Assignment, exposure and outcome integrity checks |
| Rebuildable reporting projections | Rebuild from retained sources | ≤24 hours | Source-to-projection reconciliation |
| Optional learning workloads | Durable checkpoint-based resume | ≤24 hours | No fabricated or duplicate learning evidence |

Targets are revised using measured drills, provider limitations, deployment topology and cost. Zero-loss claims require evidence and suitable architecture, not aspiration.

### 6.9.5 Backup and restore controls

- Encrypt and automate backups; support point-in-time recovery where feasible; restrict credentials and protect backup copies against accidental deletion or compromise.
- Define retention, location, privacy and legal requirements. Restoration from older copies must not silently reinstate revoked access, deleted data, or superseded merchant policies.
- Validate backup integrity regularly; perform scheduled restoration drills in isolated environments, measure achieved RPO/RTO, and record failures and corrective actions.
- Preserve durable inbox/outbox, operation identity and reconciliation checkpoints independently enough to support safe reconstruction, according to tested failure scenarios.
- A successful backup job is not evidence of successful restoration. A restarted API is not evidence of business recovery.

### 6.9.6 Controlled recovery sequence

1. Declare severity and incident ownership; contain further corruption or unauthorized effects.
2. Establish affected tenants, data domains, versions, evidence windows and the last verified recovery point.
3. Restore infrastructure and data into a controlled environment; check schema, credentials, tenant isolation and authorization.
4. Reconcile Shopify-authoritative orders, refunds, cancellations and any unknown external action outcomes using stable provider references. **Never blindly replay external commerce or financial commands.**
5. Replay only validated, authorized, idempotent internal events and rebuild projections from preserved sources.
6. Check experiment assignment/exposure gaps, treatment-control asymmetry, attribution completeness and validity against frozen contracts. Recovered provider outcomes do not retroactively create missing exposure events or Class A attribution.
7. Run synthetic shopping, security and integrity tests; verify provider readiness, metrics and backlog state.
8. Obtain the required recovery approval, restore traffic gradually, communicate verified impact and monitor recurrence.
9. Preserve the incident timeline, decision records, root-cause review and accountable corrective actions.

A provider may have continued processing orders during Kablet downtime; provider truth must be reconciled without duplicate side effects. An experiment whose evidence is materially incomplete must be labeled invalid or inconclusive, not silently repaired with fabricated observations.

### 6.9.7 Command Center and merchant visibility

The internal Intelligence Command Center surfaces capability SLOs, active incidents, traceable failures, queue/reconciliation lag, unresolved operations, provider health, experiment integrity, backup status, last successful restore drill and cost anomalies. Each metric needs a timestamp, definition and freshness indication. Merchant views expose only relevant tenant-scoped status, impact and verified recovery information; never secrets or unrelated merchant telemetry. Recovery and audit actions follow the platform safety > merchant authority > runtime decision hierarchy.

### 6.9.8 Mandatory engineering acceptance tests

1. Core shopping operations emit meaningful metrics, traces and structured error records.
2. Correlation works across permitted components without unnecessary personal-data leakage.
3. Tenants cannot access each other's logs, traces, audits or evidence.
4. High-impact platform and merchant actions create attributable audit records.
5. Audit records retain authority, versions, timestamps and provider references.
6. Ordinary operators cannot silently alter or erase protected historical evidence.
7. AI-generated explanations cannot invent unrecorded decision reasons.
8. Monitoring detects customer-visible commerce failures missed by HTTP health checks.
9. Backups are encrypted, access-controlled and checked on a defined schedule.
10. Restore drills measure achieved recovery against versioned RPO/RTO targets.
11. Restoration cannot silently reactivate revoked permissions or bypass deletion restrictions.
12. Event replay cannot duplicate external commerce effects.
13. Unknown provider outcomes are reconciled before sensitive operations resume.
14. Experiment assignment and exposure gaps remain visible after recovery.
15. Recovery cannot fabricate missing exposures, conversions or attribution.
16. Invalid experiments cannot be published as valid after restoration.
17. Reporting projections can be rebuilt from preserved authorized sources.
18. Disaster recovery procedures define owners, approval, escalation and communication.
19. Restored systems pass tenant security and synthetic shopping verification before full traffic resumes.
20. The incident and recovery timeline remains auditable with corrective actions.

**Locked principle:** Kablet is not recovered when its servers restart. It is recovered when its authority, commerce state, and evidence have been verified.


## 6.10 Production Readiness & Launch Gates — LOCKED (Option A)

**Decision:** Evidence-Gated Launch + Narrow Shopify Pilot + Verified Commercial Proof. This is a strategic and engineering acceptance specification, **not a declaration that Kablet is production-ready or that tests have passed**.

### Purpose and non-negotiable distinction

Kablet earns permission to serve real customers by demonstrating security, commerce integrity, operational readiness, and merchant authorization. It earns permission to claim incremental commercial impact only through valid experimental evidence. A functional demo, connected Shopify account, attractive dashboard, or positive observational sales trend does not establish either claim.

**Three milestones:** (1) **Engineering-ready:** critical architecture, tests, access boundaries, deploy/rollback and recovery paths validated in controlled environments. (2) **Merchant pilot-ready:** one authorized real Shopify merchant, bounded production exposure, real shopping journeys, verified provider reconciliation, safety monitoring and working fallback. (3) **Commercial proof-ready:** pre-registered randomized baseline-versus-Kablet test with verified incremental net revenue per eligible visitor (RPV), validated assignment, exposure, outcome linkage, guardrails and uncertainty. These milestones have separate evidence and approvals. An operationally successful pilot can yield inconclusive commercial evidence; that is not a license to claim lift.

### Eight mandatory production gates

Each gate has a named accountable owner, version-specific test evidence, a pass/fail outcome, open risks and sign-off. **Unrestricted production launch requires all eight gates to pass.** A bounded first pilot may use explicitly approved pilot-specific thresholds; no exception can waive tenant isolation, authorization, consent, financial/transaction integrity or truthful evidence.

1. **Security, Privacy & Tenant Isolation:** Verify tenant-scoped APIs, row-level/data boundaries, worker and cache scoping, least-privilege secrets, merchant roles, consent, revocation and deletion behavior. Cross-tenant leakage or unauthorized access is a hard blocker.
2. **Commerce Integrity:** Prove Shopify-authoritative product/variant/price/inventory handling, cart continuity, checkout handoff, verified provider outcomes, stable operation IDs, safe retries and reconciliation of unknown outcomes. No fabricated order or payment success.
3. **Experience Quality:** Validate the approved Discovery, Comparison, Reassurance and Ready-to-Buy compositions within the pilot's supported scenarios; mobile, accessibility, layout stability, safe adaptation, brand and merchant-fact accuracy, and a useful no-AI baseline.
4. **Intelligence Governance:** Confirm deterministic authorization and policy validation, selective AI routing, structured intent evaluation, bounded model latency/cost, safety filters, fallback and the platform > merchant > runtime authority hierarchy. AI cannot self-approve a policy, release or budget increase.
5. **Measurement & Experiment Integrity:** Validate eligibility, stable assignment, actual exposure, outcome reconciliation, Class A/B/C attribution distinctions, ITT denominator, missingness, sample-ratio mismatch, cross-arm contamination, guardrails and experiment invalidation. Verified Shopify order does not automatically equal attributable order; attribution is not causation.
6. **Performance & Reliability:** Test representative mobile field/lab performance, core shopping success, SLO measurement, synthetic commerce journeys, burst/load behavior, resource isolation, dependency failures, incident response and graceful degradation.
7. **Deployment, Audit & Recovery:** Validate traceable signed/verified build artifacts, reviewed release gates, compatible migrations, canary/kill switch, rollback, protected audit evidence, backup restore drills, tenant-security verification and provider-safe recovery without replaying financial actions.
8. **Cost & Operational Sustainability:** Demonstrate tenant/workload metering, AI budgets, bounded retries and background queues, anomaly alerts, support/on-call ownership and a documented bounded-pilot cost envelope; protect essential commerce and security capacity.

### Minimum viable first merchant: narrow but real

The first launch scope is **one authorized Shopify store** with supported catalog synchronization and product/variant truth; a bounded set of the four governed compositions; deterministic composition selection with optional bounded AI interpretation; genuine customer interactions; provider-authoritative cart/checkout and order outcome verification; stable experiment assignment and exposure evidence; merchant-approved policies; internal monitoring and a tested emergency fallback; measured latency, inference and direct service costs; and a versioned sign-off dossier. **Do not require** multi-provider support, Kablet-native payments, unrestricted autonomous policy promotion or every future intelligence feature. Exclude unsupported commerce capabilities instead of pretending they are safe.

### Staged activation protocol

- **Stage 0 — Local and CI:** Unit, integration, contract, schema, tenant-boundary, idempotency and deterministic decision tests with traceable artifacts.
- **Stage 1 — Production-like staging:** Provider-supported test/sandbox checkout, duplicated/out-of-order webhooks, timeout/unknown outcomes, AI outages, migrations, kill switch and recovery rehearsal. Avoid real charges and polluted commercial data.
- **Stage 2 — Merchant shadow mode:** With explicit merchant authorization and privacy controls, observe eligible signals and evaluate decisions without changing live customer experiences; assess data quality, latency and provider synchronization. Shadow results cannot prove live incremental conversion.
- **Stage 3 — Bounded live pilot:** Activate a precisely defined eligible cohort under merchant-approved policy, with on-call ownership, performance monitoring, deterministic baseline and immediate containment path.
- **Stage 4 — Controlled commercial experiment:** Freeze a pre-registered treatment-versus-approved-baseline contract, randomization unit, eligible visitor denominator, exposure rules, outcome/revenue definition, attribution reconciliation, horizon, confidence/uncertainty analysis and guardrails. Check treatment-control symmetry and concurrent merchant changes.
- **Stage 5 — Evidence review and expansion:** Review operational integrity, net RPV effect with uncertainty, measurement coverage, guardrails, merchant feedback and contribution economics. Expand traffic or merchants only by an authorized versioned decision; inconclusive experiments remain inconclusive.

### Launch dossier and change control

The versioned launch dossier must contain: exact release manifest (commit, artifact, database schema, merchant policy, interpreter/model, composition, event and integration versions); security findings and remediation; commerce journey and provider receipts; experience/accessibility/mobile results; AI evaluation and fallback evidence; pre-registered measurement contract; SLO/load/incident and recovery drill reports; cost budget and alerts; named responders; tested rollback/kill-switch instructions; merchant participation and scope approval; and gate-by-gate approval/limitations. Every item must link to actual tested implementation evidence, not merely a design paragraph. A material post-approval change to code, policy, AI, provider, schema or experiment semantics requires reassessment of the affected gates.

### Hard blockers versus bounded pilot limitations

**Hard blockers:** cross-tenant exposure; missing/invalid authorization or consent; unauthorized provider actions; unverified payment/checkout success presented as fact; unsafe unknown-outcome retries; missing critical commerce reconciliation; irrecoverable safety controls; knowingly fabricated or misrepresented measurement; inability to contain material risk. **Potentially acceptable with explicit scope and controls:** disabled optional AI, limited composition set, small traffic cohort, absent future integrations, bounded and disclosed noncritical reporting lag, or no demonstrated revenue lift yet. An unproven commercial result is acceptable for the pilot but blocks a lift claim.

### Commercial proof contract

Primary outcome: **verified incremental net revenue per eligible visitor** (RPV) relative to an approved randomized baseline, with refunds/returns and measurement maturity handled according to the frozen contract. `RPV = verified net revenue / eligible visitors`. Report treatment/control estimates, uncertainty, predeclared guardrails, eligible population, assignment/exposure validity, attribution coverage, missingness and known limitations. A positive raw difference or observational trend is not causal evidence; a non-significant result is not proof of equivalence. The learning controller may promote only through the five AND gates from 5.6; platform safety always overrides experiment continuity, with audit and validity reassessment.

### Go/no-go authority and operating watch

**Platform safety authority** can block release for non-waivable risks; **merchant authority** approves store participation, permitted experiences and commercial policy; **release owner** attests version-specific evidence, operational staffing, rollback and response. In a small team one person may hold multiple roles, but decisions and evidence remain distinguishable. AI can summarize a dossier, not waive gates or approve itself. The initial **72-hour heightened watch** covers storefront/cart/checkout success, provider reconciliation, authorization errors, AI fallback, latency, cost, event and experiment integrity and merchant feedback; actual staffing/cadence follows traffic and severity. No expansion solely because no complaints arrived.

A failed gate yields a specific blocked status, observed defect, risk owner, required remediation, reproducible regression test, updated evidence and retest decision. Example: a timeout leaves a Shopify cart operation eligible for blind retry -> Gate 2 blocked until the unknown-outcome reconciliation boundary is enforced and tested. Never claim a fictional example is an observed defect.

### Mandatory engineering acceptance tests (22)

1. Each launch gate has an accountable owner and verifiable pass/fail evidence.
2. Evidence is tied to exact release, schema, model, integration and policy versions.
3. Critical tenant isolation, authorization or consent failures block launch.
4. Unsupported provider capabilities cannot be enabled by launch configuration.
5. Realistic cart and checkout tests preserve authoritative provider outcomes.
6. Unknown provider outcomes cannot be represented as successful purchases.
7. A useful approved storefront remains available without optional AI.
8. Approved compositions pass mobile, accessibility and stability tests.
9. AI outputs remain subordinate to deterministic policy and authority checks.
10. Assignment, exposure and outcome instrumentation pass end-to-end tests.
11. Attribution gaps and unknown evidence classes remain explicit.
12. Load, performance and reliability tests meet approved pilot-specific thresholds.
13. Production deployment, canary containment and rollback are rehearsed.
14. Backup restoration and commerce reconciliation are verified.
15. AI and infrastructure usage respect approved pilot budgets.
16. The merchant explicitly approves participation and live experience scope.
17. A tested emergency kill switch restores an authorized safe baseline.
18. Shadow observations cannot be published as randomized causal proof.
19. Commercial lift claims require valid experiment evidence and review.
20. Material post-approval changes trigger appropriate gate reassessment.
21. Pilot expansion requires explicit operational and commercial review.
22. Every launch decision, exception and unresolved limitation is auditable.

**Locked principle:** *Kablet earns the right to launch through verified safety and operational readiness. It earns the right to claim commercial impact through valid evidence.*

**Status:** Specification locked. Actual gate passes, live merchant authorization, experiment results, implementation status and operational readiness **remain unverified until engineering evidence is supplied**.

