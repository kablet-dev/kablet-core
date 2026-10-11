# Kablet — Chapter 05: Learning

**Status:** STRATEGICALLY LOCKED — Sections 5.1–5.10. Design decisions only; commercial experiments and outcomes not verified.

## Governing constraints carried forward from Chapters 1–4

- The Learning Engine learns how to **convert better**, not merely how to talk better.
- Verified incremental revenue per visitor is the north-star *hypothesis to measure*, not a result to assume.
- Separate observed behavior, provider-verified commercial outcomes, and credible causal experiment evidence.
- **Non-negotiable precedence:** platform safety, law and consent, merchant policies and commercial truth, accessibility and experience stability **outrank revenue optimization**. A candidate violating these cannot be promoted even if its measured RPV is higher.
- No cross-merchant exposure of personal or merchant-confidential data; any aggregate cross-merchant learning requires explicit governance and privacy controls.
- Policy changes are versioned, auditable, evaluated and rollback-capable; no unconstrained autonomous self-modification.

## 5.1 Learning Objective & Evidence Hierarchy — LOCKED (Option A)

**Decision:** Evidence-Gated Commercial Learning. Kablet learns which governed, approved experiences improve **verified incremental net revenue per eligible visitor (RPV)**, rather than merely improving AI responses, engagement, or raw conversion rate. Natural-language and visual interactions are one coordinated experience, not competing optimization systems.

### Evidence hierarchy
1. **Behavioral evidence:** permitted actual rendered composition exposures, search/filter/compare/policy-panel interactions, dismissals, checkout initiation, and abandonment. Diagnostic and hypothesis-generating only; cannot substantiate revenue or causal lift.
2. **Provider-verified commercial evidence:** authoritative paid order, captured amount, refund/adjustment and relevant net revenue, linked to eligible visitors only where permitted and supportable. Supports outcome reporting, not causal attribution on its own.
3. **Causal evidence:** properly designed controlled comparison of approved experiences with verified outcome measurement, attribution coverage, uncertainty, guardrail metrics, and defensible incremental RPV inference. Only this level can support causal lift claims.

### Metric contract
- Primary: verified **net RPV** for a clearly defined eligible visitor denominator and observation/refund window; show coverage, exclusions and uncertainty.
- Secondary diagnostics: CVR, AOV, checkout starts, comparison usage, latency, accessibility and safety incidents.
- A higher CVR does not imply equal RPV lift. Hypothetical example: control 1,000 visitors / 30 paid orders / $3,600 net revenue = 3.0% CVR and $3.60 RPV; variant 1,000 visitors / 36 orders / $3,960 = 3.6% CVR and $3.96 RPV. Observed CVR +20%, observed RPV +10%; no statistical reliability is established by those numbers alone.

### Non-negotiable authority hierarchy
1. **Platform safety, applicable law, privacy and consent** — cannot be overridden by learning or commercial gains.
2. **Merchant-authorized truth, brand, policies, claims and commerce permissions** — cannot be overridden.
3. **Experience quality, accessibility, performance, stability, and visitor control** — mandatory guardrails, not optimization variables that can be traded away for revenue.
4. **Commercial optimization** — optimize only among eligible, validated, compliant alternatives.

**Hard test:** if hiding the real return policy appears to raise revenue by 18%, the proposal is rejected by deterministic validation; no analyst may override the guardrail to promote it. A merchant can legitimately revise their own policy through the authorized process, but the learning engine cannot conceal or falsify it.

### Evidence-gated improvement lifecycle
Observe permitted events and verified outcomes → diagnose friction → propose falsifiable hypothesis → deterministically validate eligibility → run approved experiment → assess net RPV, coverage, uncertainty and safety → versioned promote/reject → monitor and roll back if necessary. No free-form autonomous rewrite of UI code or uncontrolled policy promotion.

### Boundaries
- Cold-start defaults must work without an established learning advantage.
- Cross-merchant learning is a future governed hypothesis, not permission to reuse identifiable or confidential data.
- Correlation, a single paid order, or an appealing demo is not proof of incremental revenue.
- The Chapter 4.9 guardrails are binding constraints for every experiment and promotion.


## 5.2 Event and Outcome Measurement — LOCKED (Option A)

**Decision:** Evidence-Grade Event & Outcome Ledger. A learning engine fed inaccurate data becomes confidently wrong. Preserve separate records for decisions proposed, compositions actually rendered, visitor interactions, and provider-verified commercial outcomes. A decision is not an exposure; a checkout-start or thank-you page is not a paid order; an observed purchase is not causal lift.

### Versioned event contracts
- Provider-neutral event vocabulary: `session_started`, `decision_proposed`, `composition_rendered`, `product_viewed`, `search_submitted`, `filter_applied`, `comparison_opened`, `policy_viewed`, `cart_updated`, `checkout_started`, `order_paid_verified`, `order_refunded`, `experience_rejected`.
- Every permitted event has a unique event ID, schema version, tenant ID, scoped session ID where permitted, event timestamp and server receipt time, provenance/source, applicable decision/composition/policy/experiment versions, privacy/consent basis, correlation/deduplication IDs, and minimal validated payload.
- `composition_rendered` requires an actual successfully applied and observable composition under a defined exposure criterion, not an AI proposal. Client loss or blocked telemetry must be reflected in coverage, not silently interpreted as non-exposure.
- Separate noncritical asynchronous client behavioral telemetry from durable server-side commerce evidence. Analytics collection failures must not block normal shopping.

### Authoritative financial outcome ledger
- Shopify/Native provider-confirmed payment/order identities are authoritative. Use idempotent ingestion, tenant-scoped unique constraints, durable processing records, replay-safe updates, and out-of-order event reconciliation. Duplicate webhook deliveries must not duplicate orders or revenue.
- Track captures, partial/full refunds, cancellations and other adjustments as an auditable timeline; define revenue metric precisely (tax, shipping, fees, currencies, time window) and compute refund-aware net captured revenue per eligible visitor.
- Unknown/unreconciled financial states are not successes. Missing critical payment reconciliation records are commerce-integrity incidents: alert and escalate promptly. Missing `product_viewed` is a measurement-quality incident: log, diagnose and reflect reduced coverage; do not equate the two severities.
- AI outages must not interrupt commerce or provider outcome ingestion, subject to underlying provider availability.

### Data-quality gates
- Report attribution coverage, event delivery lag/failure/duplicate rates, experiment assignment and exposure integrity, financial reconciliation lag, refund maturity, missingness and privacy-driven observability limitations.
- Below predeclared measurement-quality thresholds, mark an experiment **inconclusive** or pause it. Never publish or auto-promote a confident RPV-lift claim from broken or materially incomplete measurement.
- Persist experiment assignment consistently and distinguish assignment from exposure and verified purchase. Use lawful, tenant-isolated identity and data retention.

### Mandatory acceptance tests
1. Rejected decision or failed render does not generate a false exposure.
2. Refresh and duplicate/out-of-order webhooks do not double count orders or revenue.
3. Partial refund revises net revenue correctly; outcome maturity is visible.
4. Client analytics failure does not disable browsing, while loss is reflected in coverage.
5. Missing payment reconciliation triggers durable alert/escalation, not silent dashboard success.
6. AI outage leaves commerce outcome processing operational.
7. Declined/withdrawn consent and cross-tenant ID collisions preserve privacy and isolation.
8. Invalid experiment assignment/exposure or inadequate measurement coverage prevents promotion.

## 5.3 Attribution and Identity Boundaries — LOCKED (Option A)

**Decision:** Deterministic, privacy-bounded attribution. A verified paid purchase is distinct from an attributed purchase; an attributed purchase is distinct from an incremental purchase. Never imply one from another.

### Identity boundaries and authoritative joins
- Session identity, permitted merchant-scoped visitor identity, and provider-authoritative order identity are distinct. Never silently merge unrelated merchants' customers or infer cross-device identity.
- On supported checkout paths, issue an opaque, merchant-scoped, integrity-protected, expiring correlation reference tied to an eligible session/experiment assignment. Do not embed raw PII.
- Test the exact Shopify cart/checkout/order lifecycle to establish whether the correlation reference survives into authoritative retrievable order evidence. Never assume a checkout/cart attribute survives a webhook or all provider versions.
- Ingest and reconcile provider-confirmed orders and refunds idempotently. Apply predefined attribution windows and conflict rules. One order is never credited twice.

### Attribution evidence classes
- **Class A: verified deterministic link.** Valid provider-order-to-permitted-session/assignment correlation; eligible for primary linked-outcome reporting.
- **Class B: partial or indirect evidence.** Diagnostics only, clearly labeled; cannot be upgraded to Class A through analyst discretion or dashboard preference.
- **Class C: unmatched.** Preserve authoritative financial outcome; do not invent an originating Kablet session.
- Missing/tampered/expired/conflicting correlation must not produce Class A. Respect consent and identity boundaries.

### Reporting and causal boundaries
Merchant dashboard must separately label (1) total provider revenue, (2) reliably linked eligible-session revenue, (3) experiment-arm revenue with coverage/eligibility definitions, and (4) **estimated incremental revenue only where a credible controlled experiment supports it**, with uncertainty and coverage prominently disclosed. Example amounts are illustrative, never default claims.

Attribution coverage uses a predeclared eligible order universe, not all merchant orders unless all are actually eligible. Show unmatched counts, limitations, cohort/window definitions, and source provenance. Never treat Class A attribution itself as proof of incrementality. Differential missing outcomes between arms may invalidate RPV comparisons; do not simply drop unmatched orders and call the remaining subset causal.

### Required integration and safety tests
1. End-to-end Shopify checkout reference survives into verified order evidence on the actual chosen integration, or mark deterministic attribution unsupported and adjust the rollout.
2. Missing, tampered, replayed, or expired references cannot create false joins.
3. Duplicate and out-of-order webhooks, refunds, and session conflicts remain idempotent and reconciled.
4. Tenant boundaries, consent withdrawal, cookie restrictions, cross-device ambiguity, and attribution windows are enforced.
5. Unmatched outcomes remain visible; low or differential coverage blocks unsupported causal claims and policy promotion.

## 5.4 Controlled Experiments and Incrementality — LOCKED (Option A)

**Decision:** Pre-registered, controlled experimentation. Only valid experiments with provider-verified, refund-aware net revenue per eligible randomized visitor (net RPV) may support causal lift claims or policy promotion. Observed association is not causation.

### Two experiment types, separately identified
- **Platform-level holdout:** Compare Kablet against an appropriate existing merchant Shopify experience, with comparable eligible traffic and outcomes. Supports platform-level merchant sales claims only when causally valid.
- **Within-Kablet policy experiment:** Compare two approved, versioned Kablet policies/compositions. Supports internal policy improvement; does not independently prove Kablet beats Shopify.
- Merchant reporting must distinguish these experiment types and their evidence.

### Immutable prelaunch experiment contract
Before enrollment, record hypothesis, experiment and policy versions, eligibility/exclusions, unit of randomization, stable assignment method and allocation, control and treatment, primary metric and financial definition, purchase/refund maturity windows, sample-size/power assumptions, fixed-horizon stopping date or a formally valid sequential design, analysis and uncertainty method, guardrails, minimum data-quality thresholds, and promotion authority. Freeze and audit amendments; do not opportunistically peek, stop, or change success criteria after seeing outcomes.

### Assignment and analysis
- Randomize before treatment can influence behavior, isolate by merchant and experiment, persist assignments where permitted, and handle return visits/cross-device uncertainty explicitly.
- Distinguish **assigned** from **actually exposed**; record both. The primary analysis is **intention to treat**, including eligible zero-purchase visitors in the original randomized denominator.
- Primary outcome: provider-verified **net revenue per eligible randomized visitor**, with explicit treatment of refunds, cancellations, taxes/shipping, currency, reporting windows, and late adjustments. CVR is secondary.
- Report absolute and relative effect estimates, confidence intervals or another predeclared uncertainty representation, sample sizes, coverage, and limitations. A positive point estimate is not automatically a winner.
- For V1, default to pre-registered fixed-horizon experiments; use sequential testing only with an appropriate formally valid method.

### Named integrity gates and CI tests
1. **Sample ratio mismatch:** detect and investigate unexpected arm imbalance before interpreting results.
2. **Differential attribution loss:** measure arm-specific outcome coverage; missingness cannot be silently discarded or treated as balanced.
3. **Cross-arm contamination:** test sticky assignment, refreshes, repeat visits, and unsupported identity merges.
4. **Post-treatment selection:** ensure the primary analysis never conditions on treatment-influenced clicks, exposures, or conversions.
5. **Concurrent merchant changes:** record price, promotion, catalog, checkout, and policy changes; assess validity and stop/qualify compromised tests.
Additionally test duplicate orders, refunds, zero-purchase denominators, exposure-vs-assignment semantics, tenant isolation, consent handling, and fixed-horizon/stopping-rule enforcement. Every named failure mode has an automated CI test before live experiments.

### Non-negotiable authority and promotion
**Platform safety and consent > merchant truth and approved policies > accessibility, performance, visitor control and stability > commercial optimization.** A variant that hides required or approved return-policy information is rejected **before exposure** even if it shows hypothetical +18% revenue. The deterministic validator sits outside AI; analysts and revenue metrics cannot override its hard constraints. If a violation is detected later, stop and exclude the variant from promotion. Low-quality, missing, biased, or inconclusive evidence also blocks automatic promotion. Preserve versioned rollback and audit history.

### Reporting states
Show **evidence supports improvement**, **inconclusive**, or **harm/guardrail failure**, according to predeclared decision rules. Never advertise incremental lift based only on clicks, attributed purchases, or an unvalidated observed difference.

## 5.5 Learning Analyst and Hypothesis Generation — LOCKED (Option A)

**Principle:** The AI may be creative in generating hypotheses; it must never invent or embellish evidence. Learning includes discovering when to intervene **less**.

### Asynchronous, bounded Learning Analyst
- Operates outside live visitor interaction, over permitted tenant-scoped aggregates and traceable evidence, with no direct authority to change live experiences, launch experiments, or promote policies.
- Produces structured, versioned `LearningHypothesis` proposals containing tenant and hypothesis IDs, evidence references and coverage, observed facts, proposed governed composition/policy change, expected causal mechanism clearly labeled as a hypothesis, eligible population, verified net RPV primary metric, risks and trust constraints, data quality, testability, status, and required approvals.
- Never fabricates statistics, merchant policies, visitor quotations, predicted uplift probabilities, or causal certainty. A hypothesis without verifiable evidence references cannot enter the approved experiment queue.

### Six hypothesis families
1. Discovery friction: relevant products hard to find.
2. Comparison friction: excessive product switching or unclear verified attributes.
3. Reassurance friction: repeated policy, shipping, sizing or compatibility questions.
4. Purchase friction: avoidable variant/cart task difficulty.
5. Experience quality: mobile performance, layout stability or accessibility defects; repair these before revenue experiments.
6. **Unnecessary intervention:** test fewer, simpler, less intrusive adaptations when the visitor is progressing smoothly. Do not reward adaptation frequency as a goal.

### Prioritization and cold start
- First apply deterministic hard eligibility gates: platform safety/consent, merchant truth/permissions, visitor trust, accessibility, performance and stability. Invalid ideas are **rejected**, not merely ranked lower.
- Prioritize eligible hypotheses using documented evidence quality, potential impact, test feasibility, and cost/risk. Heuristic ranking scores are **not** calibrated uplift predictions or success probabilities.
- Sparse data must be described as insufficient; e.g., 12 matching behaviors in 200 sessions do not establish a conversion opportunity. Permit deterministic UX diagnostics and low-risk defaults, never fabricated insight or cross-merchant private-data transfer.

### Separation of authority
**Learning Analyst (propose) → Deterministic Validator (eligibility) → Experiment Controller (pre-registered test) → Policy Promotion Controller (evidence-gated rollout).** These are separate logical responsibilities, not necessarily four LLMs or microservices. The proposing model cannot authorize its own proposal or bypass subsequent gates.

### Merchant-facing explanation contract
Every recommendation shows **what was observed** (measured source, sample and coverage), **what is proposed** (specific change), **why it may help** (hypothesis, not proven cause), **what will be measured** (verified net RPV and guardrails), and **what remains unknown** (uncertainty, missingness and limits). “Insufficient evidence to recommend a change” is a valid first-class output.

### Required acceptance tests
Traceable permitted evidence; no invented facts or causal claims; insufficient-data labeling; forbidden-tactic rejection before experiment queue; no direct production mutation by Analyst; tenant isolation; deduplication/versioning/audit; accurate treatment of inconclusive and failed experiments; privacy-safe merchant explanations; explicit generation and evaluation of **do-less** hypotheses.

## 5.6 Policy Evaluation and Promotion Gates — LOCKED (A)

**Decision:** Five-Gate, Versioned Policy Promotion. Experiment success makes a candidate eligible for consideration, never automatically authorized for global deployment.

### Five mandatory AND gates
1. **Trust and authority:** platform safety, lawful consent, merchant truth, permissions, truthful claims and visitor control. A policy hiding required return information is rejected even if observed RPV rises 18%; no analyst or LLM override.
2. **Experiment validity:** predeclared design and stopping rule, sound assignment, ITT analysis, sample-ratio checks, comparable attribution coverage, mature outcomes and interpretable uncertainty. Invalid/inconclusive results cannot justify automatic promotion.
3. **Commercial evidence:** verified net RPV satisfies the predeclared statistical/economic decision criterion; engagement and initial order counts alone are insufficient.
4. **Experience quality:** accessibility, mobile performance, state preservation, layout stability, task continuity and checkout reliability pass.
5. **Deployment authority and readiness:** correct merchant/platform approval, tenant and capability scope, immutable versioning, operational observability and tested rollback.

All five gates are necessary; no score aggregation or discretionary bypass. The deterministic Promotion Controller—not an LLM—evaluates machine-readable predicates and authorization. The Learning Analyst may propose but never approve or deploy.

### Immutable policy and evidence contract
Record `policy_id`, immutable `policy_version`, `composition_versions`, `experiment_id`, frozen `evidence_package_id`, `validator_version`, merchant approval reference, rollout configuration version, previous stable version, and decision/audit trail. Approval of an experiment does not imply authorization for unrestricted deployment. Duplicate evaluation jobs must be idempotent; tenant isolation is mandatory.

### Controlled rollout and emergency handling
Use configurable progressive stages (illustratively **1% canary → 10% limited → 50% expanded → 100% full**) with health and approval checks at every stage. Pause or revert for safety/consent violations, unauthorized claims, checkout/cart errors, accessibility/performance regressions, rendering failures or scope drift. AI outages must not disable deterministic selection, emergency controls or rollback. **Experience-policy rollback is separate from financial operations**: stop new exposure and restore a known-good composition while preserving in-progress checkout, paid orders and payment reconciliation; never cancel or replay payments as a side effect.

### Simpler policies are valid winners
An appropriately predeclared **non-inferiority** design with a justified margin may support promoting a simpler policy that preserves acceptable net RPV while improving speed, accessibility or visitor control. Failure to find statistical significance is **not** proof of equivalence. Harmful, invalid and inconclusive experiments remain rejected or unpromoted; no forced winner.

### Authority boundaries and acceptance gates
Platform Intelligence Command Center owns non-overridable safety rules, validator governance, deployment and emergency controls. Merchant Business Intelligence Manager owns tenant-scoped business approvals and permitted strategies. Execution Plane applies only authorized versions. Acceptance tests include LLM approval injection, each failed gate, +18% deceptive-policy rejection, immature/inconclusive outcomes, duplicate jobs, immutable provenance, cross-tenant promotion prevention, staged pause/rollback, active-cart/payment preservation, AI-outage fallback, failed-canary containment and correctly specified non-inferiority.

## 5.7 Cold Start and Cross-Merchant Learning — LOCKED (A)

**Decision:** Privacy-Bounded Evidence Network. Reuse platform-owned engineering knowledge and only lawfully permitted, privacy-protected aggregate evidence; merchant-private intelligence remains tenant-scoped. Network learning proposes candidate tests, never transfers an assumed winner or bypasses five promotion gates.

### Three knowledge layers
1. **Platform knowledge — reusable:** independently developed component quality, accessibility, performance, integration reliability, and generic validated interaction patterns. These must not depend on unauthorized merchant-private data.
2. **Governed aggregate learning — conditional:** context-tagged, permissioned aggregate findings with documented purpose, provenance, cohort sufficiency, disclosure/reidentification protections, statistical uncertainty, retention and withdrawal handling. Aggregation alone is not proof of anonymization or legal reuse.
3. **Merchant-private intelligence — isolated:** raw visitor events, identifiable histories, order-level outcomes, confidential economics, private strategies, merchant-specific policies and experiments. No automatic sharing or cross-merchant identity graph. Authorized tenant processing and narrowly scoped support access are governed separately; do not promise literal zero data movement where contracted processors/infrastructure necessarily process it.

### Governed pattern registry
Every reusable pattern is immutable/versioned and records mechanism, compatible context (category, price band, purchase complexity, visitor intent, attributes, policy dependencies), UI and trust constraints, source eligibility and provenance, evidence quality, uncertainty, and transfer status. Distinguish **platform technically validated**, **commercially promising for testing**, and **merchant-specific commercially validated**. A winner at Merchant A cannot auto-promote at Merchant B. Transfer requires compatibility evaluation, permission checks, and merchant-specific evidence through 5.4/5.6.

### Four evidence-readiness stages
1. **Zero evidence:** merchant-approved truth, safe default four compositions, platform engineering improvements; no merchant-specific uplift claims.
2. **Early observations:** permitted behavioral diagnostics, sparse-data warnings, no invented trends or premature causal conclusions.
3. **Experiment eligible:** adequate traffic, comparable outcome coverage, lawful permissions, and valid predeclared design; not a fixed arbitrary session threshold.
4. **Merchant-validated:** credible merchant-specific experiment and five-gate promotion with versioning, monitoring and rollback.

### Opt-out and privacy contract
Declining optional cross-merchant contribution does not break storefront, checkout, permitted merchant-scoped learning or general platform updates. Enforce purpose and contribution permissions at source and artifact production, tenant isolation, small-cell and repeated-query leakage defenses, data minimization, contractual rights, deletion/withdrawal and derived-artifact lifecycle as applicable. Never promise universal legal compliance or anonymity from aggregation alone. Merchant-private data cannot be silently repurposed for competitors.

### Acceptance tests
Tenant-isolated raw data; opt-out exclusion; permission gating before aggregate derivation; small-cohort/repeated-query disclosure checks; no confidential merchant details in registry; no cross-tenant auto-promotion; safe cold-start without invented personalization; sparse-data uncertainty; provenance and context compatibility on transfer; lawful retention/deletion/withdrawal propagation; reusable platform improvements without private data; network pipeline failure never blocks shopping or checkout.
## 5.8 Drift, Monitoring and Rollback — LOCKED (A)

**Decision:** Deterministic Safety Monitoring + Evidence-Based Retesting. Detect changes to visitor mix, merchant/catalog truth, commercial performance, and integrations; distinguish actionable operational incidents from measurement degradation and uncertain commercial drift. The Learning Analyst may diagnose and recommend but cannot improvise live policy changes or bypass validation.

### Four drift domains
1. **Visitor drift:** device, acquisition channel, geography where permitted, intent, seasonality, and repeat/new visitor composition.
2. **Merchant/catalog drift:** product attributes, inventory, pricing, promotions, shipping and return policies, merchandising goals, and authorization changes.
3. **Performance drift:** changes in verified net RPV, task completion, accessibility, latency, intervention burden and stability; distinguish observational change from causal effect.
4. **Integration/infrastructure drift:** Shopify and other provider contracts, checkout correlation, webhook behavior, browser/runtime changes, AI models, event schemas and component versions.

A detected change is an investigation trigger, not proof a policy caused a decline. Use a valid ongoing holdout or new pre-registered experiment where causal re-evaluation is required; do not infer causality from before/after trends.

### Three independent monitoring loops
- **Operational safety (immediate):** deterministic checks for consent/trust violations, false merchant claims, broken cart or checkout state, severe accessibility or performance failures, rendering errors and financial integrity incidents. Trigger containment, safe fallback and escalation without an LLM dependency.
- **Measurement integrity (continuous):** order reconciliation, attribution coverage and class changes, event loss, duplicate/delayed webhooks, sample-ratio mismatch, differential outcome capture, assignment and exposure consistency. Quarantine invalid conclusions, stop affected promotion, and escalate provider-authoritative payment reconciliation failures as operational issues—not merely missing analytics.
- **Commercial learning (evidence-driven):** monitor net RPV, eligible populations, behavior and context mix; produce uncertainty-qualified investigations and hypotheses. No automatic winner replacement on a revenue dip.

### Severity and response contract
**Critical:** confirmed unsafe claim, serious consent violation, cart/checkout corruption or transaction-integrity threat → immediately stop affected exposure or capability and escalate. **High:** widespread failures or broken payment reconciliation → contain and reconcile. **Medium:** attribution degradation or meaningful quality regression → pause affected experiment, analysis or rollout and investigate. **Informational:** uncertain behavior/intent shifts → observe or propose retest. Thresholds, scope, escalation ownership and action rules are versioned and deterministic. Safety incidents can require intervention with few affected visitors; commercial monitoring must account for low traffic, seasonality, multiple alerts and normal variation.

Four authorized responses: **observe**, **pause**, **rollback**, **retest**. Safety failures may justify immediate containment; commercial uncertainty generally calls for diagnosis or controlled retesting, not unproven autonomous optimization. A monitoring or AI-analysis outage cannot disable independent deterministic emergency controls.

### Safe rollback and financial independence
On a predefined trigger, stop new assignments to the affected immutable policy version; preserve existing visitor/cart/checkout state where technically feasible; restore a **compatible, approved, tested** last-known-good policy or separately validated safe baseline; record trigger, affected tenant/traffic scope, versions, approvals, timing and recovery evidence; quarantine the failed version until revalidated. Never blindly restore an incompatible old policy. **Experience-policy rollback is not financial rollback:** do not cancel completed orders, undo captures, duplicate checkout actions, or replay in-progress payment operations. Commerce-provider authority and financial reconciliation remain separate. Rollback procedures must be tested under failure conditions.

### Incident ownership and merchant transparency
Platform Intelligence Command Center owns global safety and incident controls; merchant Business Intelligence Manager provides merchant-scoped visibility and authorized decisions; Execution Plane enforces approved versions and safe fallback. Merchant-facing reports state the affected experience, observed symptom, containment status, approved fallback and known business implications without unsupported assurances. Internal traces retain deeper telemetry and audit evidence. Cross-tenant containment must be scoped to the actual risk; do not disable unrelated merchants unnecessarily.

### Mandatory CI and operational acceptance tests
1. Confirmed unsafe claims trigger deterministic containment independent of RPV and AI availability.
2. Broken checkout composition can be disabled without an LLM.
3. Payment reconciliation failures escalate as high-severity financial-integrity incidents.
4. Falling RPV does not produce an unsupported causal conclusion or automatic replacement.
5. Attribution degradation blocks invalid experiment conclusions and promotion.
6. Low-volume statistical noise does not repeatedly force rollbacks.
7. Rollback restores a compatible, authorized baseline; incompatible prior versions are rejected.
8. Existing carts and payment operations are not blindly canceled, undone or replayed.
9. Incident trigger, scope, versions, actions and approvals are auditable.
10. Rejected or rolled-back policies cannot silently redeploy.
11. Tenant-scoped failures do not disable unrelated tenants absent justified shared risk.
12. Safety controls work during monitoring/AI-analysis outages.
13. Remediated versions require regression tests and renewed applicable promotion gates.
14. Operational incidents and learning hypotheses remain separate records and authority paths.
## 5.9 Merchant Reporting and Explainability — LOCKED (Option A)

**Decision: Evidence-First Business Intelligence.** Kablet's merchant-facing product is a business decision interface, not an analytics warehouse. Its five questions are: what did the store earn, what can Kablet reliably measure, did Kablet causally improve revenue, what evidence-backed action is recommended, and is the experience operating safely? Every material figure and claim is traceable to a defined, versioned evidence source.

### Four distinct revenue quantities (non-additive)
1. **Total Shopify revenue** — provider-authoritative merchant revenue for a stated accounting basis and period; reconcile to the relevant provider reports.
2. **Tracked-traffic revenue** — provider-verified revenue associated with the precisely defined trackable cohort; display denominator, linkage method and coverage.
3. **Experiment-arm revenue** — verified revenue within the predeclared eligible experimental cohorts, reported by assignment and outcome window.
4. **Estimated incremental revenue** — causal estimate derived *only* from a valid randomized experiment, with uncertainty interval, population, timeframe, coverage, outcome maturity, analysis method and limitations visible.

These are **overlapping descriptions, not additive revenue streams**. Never collapse them into one 'Kablet revenue' number. Illustrative figures ($45,000 / $38,000 / $22,000 / $4,200) are synthetic and must never be displayed as real performance. An attribution-coverage percentage alone does not justify an incremental-revenue estimate.

### Attribution, financial truth, and causality boundaries
Keep verified purchases, deterministically session-linked purchases, diagnostic partial-evidence purchases, and unmatched provider-verified purchases separately labeled. **Class B attribution must be structurally unable to populate Class A verified-link fields or totals**: enforce via typed records, database constraints, verified-only query interfaces and tests, not only UI copy or analyst policy. No analyst, model, or dashboard configuration may upgrade a Class B diagnostic into Class A. Preserve Class C unmatched orders and the eligible reconciliation universe. Attribution does not prove causality. A platform-level randomized holdout (Kablet vs an appropriate existing storefront) supports platform-impact claims; within-Kablet policy experiments support optimization claims. **Do not conflate the two.**

### Experiment evidence cards and outcome states
Every experiment report shows the actual control and treatment, predeclared hypothesis and primary verified net RPV metric, assignment unit, eligible population, counts, dates and outcome/refund maturity window, absolute and relative effect estimate, uncertainty interval, analysis/stopping method, sample-ratio and contamination checks, differential missingness/attribution coverage, concurrent merchant changes, safety/performance guardrails, evidence-package version, and decision: **win, lose, inconclusive, invalid**. An observed positive difference is not automatically a winner. If evidence is insufficient or invalid, show **'No supported lift conclusion'** and prohibit promotion and causal marketing claims. Distinguish provisional from mature outcomes.

### Merchant recommendations and explainability
The recommendation feed follows a stable five-part contract: **what we observed** (specific measurement and coverage); **what we propose** (authorized testable change); **why it may help** (explicitly hypothetical mechanism); **what we will measure** (verified net RPV plus guardrails); **what we do not know** (uncertainty, sample, missingness). Merchant review and permissions are separate from the AI recommendation. Explain live composition decisions from recorded policy, authorized signals and versions; experiment decisions from immutable experiment contracts and evidence; promotions from all five gate records, approvals, rollout and rollback targets. An LLM may translate structured records into readable language but cannot invent missing reasons, metrics, policy approvals or causal explanations.

### Separate control-plane reporting and financial reconciliation
Merchant Business Intelligence Manager shows merchant-scoped outcomes, recommendations, approvals, experiments, coverage and significant incidents. Kablet Intelligence Command Center shows authorized platform-wide telemetry, validator results, integration health, costs, safety incidents and audits. Neither interface bypasses the platform-safety > merchant-truth > experience-quality > commercial-optimization hierarchy. State accounting period/timezone, currency conversion, gross/net definitions, discounts, shipping, taxes, cancellations, refunds, capture/paid state, order/refund-date treatment, delayed webhooks and reconciliation status. Explain definitional differences from Shopify instead of inventing equality. Reporting/analytics failures must not interrupt shopping, carts or provider-authoritative checkout.

### Locked marketing and external-claim constraint
**'Kablet's marketing claims are bounded by its experiment evidence. No case study may state a higher lift than the supporting experiment's point estimate with its stated interval, population, and date range.'** No evidence package means no incremental-impact claim. Every merchant export, case study, sales deck, PDF, AI-generated summary and marketing statement must be generated or validated against the **same immutable, versioned evidence package**, preserving the effect definition, estimate, uncertainty interval, cohort, timeframe, attribution limitations, and maturity. Do not imply guarantees, generalize beyond the studied population, selectively suppress negative outcomes, or describe within-Kablet wins as platform-level lift. Claims require applicable legal and marketing review; an evidence package is necessary but not alone sufficient for regulatory compliance.

### Mandatory CI and acceptance tests
1. Four revenue quantities have distinct types, labels, sources and definitions; cannot be accidentally added or presented as one total.
2. Provider-authoritative revenue reconciles under its declared accounting definition, including refunds and delayed events.
3. Database/type constraints prohibit Class B diagnostic evidence from entering Class A verified-link fields and primary totals.
4. Unmatched verified orders remain in appropriate financial and coverage reporting.
5. Platform-level versus within-Kablet experiment claims cannot be conflated.
6. Incremental revenue claims require valid randomized causal evidence; no observational substitution.
7. Invalid/inconclusive experiments cannot show a winner or authorize promotion.
8. Uncertainty, samples, coverage, outcome maturity, population, methodology and date range survive every export.
9. AI explanations cannot fabricate evidence, authority, causal mechanism or decision rationale.
10. Recommendation cards explicitly separate observation, hypothesis, proposal, metric and unknowns.
11. Tenant permissions prevent cross-merchant reporting leakage.
12. Merchant UI cannot override platform validator or safety controls.
13. Material incidents and measurement limitations are appropriately visible.
14. Evidence packages, policy versions, approval records and report outputs remain traceable.
15. Reporting outages do not disrupt storefront/cart/checkout operations.
16. Marketing/case-study lift cannot exceed the supported point estimate or omit required context; all external claims bind to the same immutable evidence package.

## 5.10 Learning Validation and First RPV Proof — LOCKED (Option A)

**Decision: One Merchant, One Controlled RPV Proof.** Chapter 5's architecture is specified once all ten sections are locked; this does **not** assert engineering implementation, successful real-world tests, or proven commercial uplift. The first proof must be earned by a real, permissioned Shopify merchant, verified end-to-end commerce, a pre-registered randomized platform-level experiment, trustworthy financial outcomes, integrity and guardrail checks, and an immutable auditable evidence package. A positive result is **not** presumed.

### Three distinct levels of proof
1. **Experience proof:** Kablet selects and renders distinct approved shopping compositions based on permitted signals; confirms the adaptive runtime, **not** purchase or revenue impact.
2. **Commerce proof:** A real visitor discovers and compares products, selects variants, proceeds through supported merchant-authoritative checkout, and completes a provider-verified order; confirms commerce workflow, **not** incremental revenue.
3. **Incremental business proof:** A valid randomized platform-level comparison of Kablet against the merchant's appropriate existing storefront estimates the effect on verified **net revenue per randomized eligible visitor (net RPV)**, with predeclared analysis, uncertainty, maturity and integrity gates. Only valid evidence meeting the predefined positive decision rule supports a bounded causal revenue-improvement claim.

A completed order is not a causal effect. An improved engagement metric is not incremental RPV. A within-Kablet policy winner is not proof that Kablet outperforms the original storefront.

### First merchant pilot: narrow, real, authorized
Select **one** real Shopify merchant with a genuine catalog, functional supported checkout, appropriate data-processing permissions, willingness to randomize eligible traffic, and sufficient expected traffic for a feasible experiment. Verify merchant catalog, inventory, price, product attributes, current approved policy content and checkout boundaries. Validate end-to-end supported checkout correlation and provider-authoritative paid orders and refunds on the **actual installed integration**; do not assume Shopify attributes persist into order webhooks. Preserve the merchant's appropriate, compliant existing storefront as control and a single narrowly scoped, stable, version-pinned Kablet journey as treatment. Prove experience and commerce functionality before seeking commercial proof. Do not require every advanced AI, personalization or network-learning feature to be live for the first causal test.

### Immutable pre-registered experiment contract
Before meaningful experiment exposure, freeze and version: the causal hypothesis; control and treatment versions; primary metric **net captured revenue / all randomized eligible visitors**, including zero-purchase visitors; merchant-local reporting timezone and currency/financial definitions; eligibility/exclusions; stable randomized assignment unit and allocation; sample size/power and minimum detectable effect assumptions appropriate to the merchant's revenue variance; outcome/refund maturity window; preselected analysis method and uncertainty interval; predeclared stopping rule and decision criteria; cross-arm contamination controls; exposure and assignment logging; permitted concurrent changes; trust, privacy, accessibility, performance and checkout guardrails; and merchant authorization. No universal visitor-count threshold and no opportunistic winner declaration from repeated peeking. Use intention-to-treat as the primary analysis. Safety monitoring during the test is allowed and required, but not p-hacking.

### Measurement integrity before interpreting uplift
Independently verify randomization and sample-ratio balance, stable assignment, actual exposure versus assignment, tenant isolation, provider-verified order and refund reconciliation, idempotent events, eligible visitor denominators, delayed financial events, attribution confidence and coverage, **differential outcome missingness between arms**, contamination, concurrent merchant/catalog/promotional changes, and outcome maturity. Provider-authoritative orders captured comparably for both arms may support causal estimation even without deterministic session attribution for every order; biased or differential missingness that cannot be resolved may invalidate the result. Never use tracked purchasers alone as the denominator or extrapolate an observed arm difference into a causal win without the specified uncertainty analysis.

### Outcomes and honest decision rules
- **Supported positive effect:** experiment is valid, mature under the predeclared rule, passes integrity and trust checks, and positive effect satisfies the frozen statistical/commercial decision criterion. Report bounded estimated lift with uncertainty, eligible population, dates, limitations; submit any candidate policy to **all five independent Chapter 5.6 promotion gates**. Evidence of lift does not itself authorize deployment.
- **Inconclusive:** valid experiment, insufficient evidence for improvement or harm. Display **'No supported lift conclusion'**; retain approved policy and do not claim uplift.
- **Supported negative effect:** valid evidence meets predefined harm/loss criterion; reject candidate, investigate and retain negative learning evidence.
- **Invalid:** critical randomization, outcome capture, attribution/missingness, contamination or guardrail requirement failed; quarantine the result and do not describe it as a causal win or loss.

Observed differences are not guaranteed future outcomes. A statistically non-significant difference is not proof of equivalence or non-inferiority. A negative or inconclusive first experiment must be reported accurately and cannot be erased to improve the marketing story.

### Versioned First RPV Proof Package
Produce an immutable, access-controlled, reproducible **Kablet First RPV Proof Package** with merchant/integration scope; approved control and treatment versions; frozen hypothesis, metric, randomization, sample/power assumptions, windows and stopping rule; approvals; assignment and exposure integrity; verified order/refund reconciliation; eligible denominators; attribution coverage and missingness diagnostics; net RPV by arm; absolute/relative effect and uncertainty interval; statistical method; outcome maturity; guardrails and incidents; concurrent changes; final outcome; limitations; reproducible analysis artifacts; and bounded approved merchant-facing/case-study claim. The merchant can inspect and challenge the claims without access to other tenants' private information. Sales decks, exports, AI summaries and marketing statements must use the same versioned evidence package and must not claim a larger lift, omit material uncertainty, promise future results, or generalize beyond the supported population and dates.

### Three completion states (never conflate)
- **Blueprint specified:** all ten Chapter 5 decisions and contracts documented and locked.
- **Engineering validated:** the implemented Shopify integration, event ledger, assignment, financial reconciliation, trust validator, promotion gates, monitoring, rollback and CI tests demonstrably pass.
- **Commercially validated:** a real platform-level controlled experiment yields a valid result and an evidence package supporting the exact causal claim made. This state is **not** reached merely by locking Chapter 5, shipping a demo, or completing a purchase.

### Mandatory engineering and CI acceptance tests
1. An adaptive demo cannot be labeled commercial proof.
2. A Shopify paid order cannot be labeled incremental revenue without a valid randomized causal comparison.
3. Frozen experiment contracts and versions cannot be silently changed after the prescribed freeze point.
4. Assignment, exposure, financial outcome ingestion and reconciliation are independently testable.
5. Sample size, power and MDE planning reflect merchant-specific assumptions, not a universal threshold.
6. Analysis and stopping rules are predeclared and followed; opportunistic peeking cannot create winners.
7. Sample-ratio mismatch, differential missingness, cross-arm contamination and concurrent changes are explicitly checked.
8. Duplicate orders, refunds, delayed provider events and outcome maturity are correctly accounted for.
9. Invalid and inconclusive experiments cannot produce positive causal claims or auto-promotion.
10. Valid positive evidence cannot bypass the five policy promotion gates.
11. Merchant-facing and external claims preserve supported estimate, uncertainty, population, dates, limitations and evidence provenance.
12. The proof package is versioned, reproducible, access-controlled and auditable.
13. AI outages cannot alter assignment integrity, disable deterministic safety, or authorize live changes.
14. Negative and inconclusive findings are retained, not suppressed.
15. Results from one merchant are not automatically generalized or auto-promoted to another.

**Locked operating principle:** *First prove the evidence can be trusted. Then establish whether the experience improves revenue. Never reverse that order.*

---

**Chapter 5 status: COMPLETE — 5.1 through 5.10 locked as blueprint decisions.** Engineering implementation and first merchant commercial proof remain separate future milestones.

