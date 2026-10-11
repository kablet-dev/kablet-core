# Kablet Blueprint — Chapter 2: Intelligence

**Status:** COMPLETE — all Sections 2.1–2.10 strategically locked on 2026-10-10. Blueprint decisions, not claims of completed implementation or validated commercial uplift.

## 2.1 Intelligence Vision & Architecture — LOCKED

Kablet is a hybrid conversion intelligence system, not an LLM-driven website. Its coordinated runtime uses deterministic decisions by default, selective real-time AI when ambiguity or complexity justifies it, and asynchronous evidence-based learning. For every capability document the execution mode, trigger, cost, and verified value. No assumed 90/10 AI routing ratio or speculative cost figures are validated targets.

## 2.2 AI Roles & Responsibilities — LOCKED

One coordinated intelligence system with six logical responsibilities, **not six independent autonomous LLM agents**: Context Manager, Intent Interpreter, Decision Strategist, Experience Composer, Action Coordinator, and Learning Analyst. Reasoning, authorized actions, and learning have separate boundaries. Routine context, composition, and commerce execution are deterministic where feasible; ambiguous free-form intent can justify selective AI; analysis of outcomes is asynchronous.

> The number of agents is not the measure of intelligence. The quality of decisions and verified outcomes is.

### Zero-real-time-AI ecommerce example: Instagram summer dresses

1. **Context:** Visitor arrives from a summer-dresses Instagram campaign, on mobile, first visit; read trustworthy campaign attribution, catalog and available products.
2. **Intent:** Infer probable summer-dress interest deterministically from campaign and landing context; this is a revisable hypothesis, not certainty.
3. **Strategy:** Prioritize relevant summer dresses, available social proof, and size guidance.
4. **Composition:** Render a mobile-first, visual canvas using approved components.
5. **Action:** On visitor request, add to cart through the authorized Shopify or Kablet Native commerce adapter and verify the result.
6. **Learning:** Later test whether visible size guidance improves verified purchase outcomes, including revenue per visitor.

**Real-time LLM calls required: zero.**

## 2.3 Intelligence Memory & Context — LOCKED

Use five context categories: business truth, session activity, acquisition source, authorized returning-visitor context, and validated learning evidence. Distinguish currently available context from retained memory. Retain structured information only for appropriate purposes and durations; track source/provenance, freshness, and confidence. Merchant-authoritative prices/inventory/policies govern business truth; explicit visitor preferences override weaker behavioral or campaign-based intent inferences. Keep merchant and visitor data isolated, with privacy and portability safeguards. Deterministic state management is the default; AI interpretation and summarization are selective.

### Compounding merchant-specific intelligence

Privacy-governed, merchant-isolated decision → experience → verified-outcome evidence may yield increasingly effective policies and higher retention. This is a **potential** performance moat, not guaranteed lock-in or a claim that merchant data cannot be exported. Customer data portability must be respected.

## 2.4 Visitor Understanding & Intent — LOCKED

Intent is dynamic, evidence-based, revisable, and vertical-specific within a universal framework. Initial ecommerce intent vocabulary: **Discovery**, **Comparison**, **Reassurance**, **Ready to Buy**, and **Support**. Use deterministic structured signals by default, selective real-time AI for meaningful semantic ambiguity, and conservative neutral experiences when evidence is weak. Visitors retain navigation and control; avoid disruptive or creepy adaptation.

### Reassurance as a merchant-facing capability

Kablet can make relevant sizing, shipping, returns, reviews, and trust information accessible when meaningful signals suggest uncertainty. Time on page alone does not prove hesitation. Test whether reassurance treatments improve verified conversion and revenue; do not promise an unverified uplift.

> A technically accurate intent prediction is not useful if the resulting experience becomes frustrating.

## 2.5 Cold Start Intelligence — LOCKED

Distinguish merchant cold start, first-time visitor cold start, and learning cold start. Kablet should be useful from visitor one using merchant catalog/policies, landing context, available acquisition signals, device context, and safe deterministic baseline policies. Use real-time AI only where genuine ambiguity merits its cost. Improve merchant-specific policies through controlled experiments and verified outcomes; maintain reliable fallbacks. Low-traffic merchants may need longer to verify small conversion effects; do not invent statistical certainty.

> Kablet is useful from visitor one. It gets better from there.

### The Network Intelligence Advantage — LOCKED AS STRATEGIC HYPOTHESIS

As the network grows, new merchants **may** start with stronger baseline policies informed by privacy-protected, validated aggregate evidence from comparable merchants. Existing merchants may also benefit as broadly applicable policies improve. For example, learning from fashion merchants could inform a new fashion store's baseline where catalog, audience, and shopping contexts are comparable; it must not automatically be imposed on an electronics merchant. This is a **potential data/network learning effect** requiring empirical validation, not a guaranteed moat or proof of superior performance today.

**Non-negotiable boundaries:** No raw visitor data shared between merchants; privacy, consent, tenant isolation, and applicable law govern any aggregation; evidence quality and relevance must be checked before policy promotion; retain merchant-specific evaluation and rollback; do not overclaim that competitors cannot reproduce patterns.

**Chapter 5 handoff:** Define the cross-merchant aggregation mechanism, experiment quality standards, cohort comparability, policy promotion gates, governance, privacy protections, and proof that network-derived baselines outperform non-network baselines.

## 2.6 Decision Engine & Experience Selection — LOCKED

**Option A: Governed Decision Engine.** Filter unsafe, unavailable or unauthorized experience candidates; rank eligible choices using current visitor context and merchant objectives; select with approved versioned policies. Output a structured experience decision to the separate Experience Runtime; do not generate arbitrary frontend code in the decision path. Decision engine manifesto: **constrained, explainable, stable, measurable, safely improvable**. Record evidence, provenance, policy version, eligible alternatives and outcome linkage. A decision preceding a purchase establishes chronology, not causal uplift; experiments establish incremental effect. Use deterministic selection by default and selective AI only when justified.


## 2.7 Intelligence Authority & Control Planes — LOCKED

**Option A: Two Control Planes + One Execution Plane.** Kablet internal **Intelligence Command Center** governs platform-wide safety, model quality, costs, observability, tenant oversight, policy suspension and rollback. Merchant-facing **Business Intelligence Manager** governs each merchant's objectives, authoritative business truth, permitted actions, strategy boundaries and approvals. **Intelligence Execution Plane** interprets permitted context, chooses approved experiences, requests authorized actions and records evidence. Authority precedence: **platform safety and legal boundaries > merchant-approved policy > runtime decisions**. Enforcement is deterministic and auditable; AI may propose but cannot grant itself authority. Routine adaptations may run under approved policy, whereas new sensitive permissions and material commercial changes require appropriate authorization. Merchant trust positioning: **The Merchant Owns the Truth. Kablet Owns the Experience.** Illustrative demo: an unauthorized discount request must not change price or issue a discount. Provide controlled pause/rollback/recovery, without unverified claims of instant recovery or zero downtime.


## 2.8 AI Budgeting & Cost Control — LOCKED

**Option A: Budget-Governed Hybrid Intelligence.** Founding principle: **Kablet's intelligence must be commercially sustainable by design, not made affordable as an afterthought.** Deterministic-first routing avoids unnecessary inference. Select model by task, quality, latency and cost; reuse valid structured results subject to freshness and privacy. Enforce per-interaction, per-merchant and platform-wide budgets, with observability for invocation rate, cost per eligible session, latency, failure and contribution margin. Essential browsing, catalog, cart and checkout must have tested non-AI fallback paths when optional model inference fails or budgets are exhausted. A model-provider outage must not automatically become a merchant revenue outage; this is a design requirement, not a zero-outage guarantee. Merchant pricing should not depend on opaque raw token charges.

**Mandatory AI-feature engineering gate:** (1) Can this be deterministic? If so, prefer deterministic unless AI has justified incremental value. (2) Model projected cost per 1,000 sessions and define a ceiling. (3) Define and test fallback when AI is unavailable. (4) Specify a measurable commercial/quality hypothesis and controlled validation plan; demand evidence before broad rollout, not before the first experiment. (5) Test latency, errors and commerce continuity. Illustrative 90/10 routing and AI costs are *not* validated operating figures; deterministic infrastructure still has costs.

## 2.9 Intelligence Safety & Reliability — LOCKED

**Option A: Safety Outside the Model.** Five protection layers: (1) authoritative business truth for catalog, prices, stock and policies; (2) deterministic authorization, validation and confirmation for actions; (3) validated structured experience compositions, never arbitrary model-generated frontend code; (4) operational timeouts, rate limits, circuit breakers, observability and safe fallbacks; (5) controlled commercial experiments, guardrails, versioning and rollback. Invalid AI outputs are rejected before execution. Checkout and payment outcomes must be verified with the relevant commerce system. Maintain merchant and platform emergency pause/recovery controls, incident logs and privacy-minimized telemetry.

**Three distinct protections:** AI safety (hallucination, injection, protected information), operational safety (outages, latency, integrations), and commercial safety (unauthorized discounts, invalid orders, harmful experiments). Model instructions alone cannot enforce these boundaries. **Merchant-facing statement:** “Kablet can use AI to become more capable, but its reliability and authority boundaries never depend on AI behaving perfectly.” No claims of absolute immunity, guaranteed instant rollback, or universal uptime.

## 2.10 Intelligence Validation & Evolution — LOCKED

**Option A: Evidence-Governed Continuous Learning.** **Kablet doesn't learn to talk better. It learns to convert better.** Loop: observe permitted signals and verified outcomes → generate a hypothesis → run controlled experiment → verify causal commercial evidence and guardrails → approve/version/deploy/monitor or reject and roll back policy. Separate immediate visitor-level adaptation, merchant-specific optimization, and network-level intelligence. Primary commercial measurement is verified incremental Revenue Per Visitor (RPV), with completed-purchase CVR, average order value, reliability, refunds/cancellations and appropriate measurement-quality guardrails. Engagement or an observed sequence (size guide followed by purchase) is not proof of causal conversion lift.

Every policy requires version, scope, objective, context, evidence, constraints, deployment/rollback history and authorization. Most learning is asynchronous; real-time visitor experiences must not wait on large-scale analysis. No uncontrolled AI self-modification or unauthorized policy changes. Automatic rollout only within pre-authorized, tested low-risk bounds. Network-derived baselines may transfer only from privacy-protected aggregate evidence across genuinely comparable merchants, after validation and with local monitoring; cross-merchant uplift and defensibility remain hypotheses to prove. **Chapter 5 handoff:** experiment design and statistical validity, verified attribution and revenue, network evidence aggregation, policy promotion gates, and impact measurement.

## Chapter 2 — Cross-Cutting Locked Rules

1. One coordinated intelligence system with six logical roles; roles do not imply separate AI agents.
2. Classify every capability as deterministic, selective real-time AI, or asynchronous processing; specify trigger, cost, fallback and validation.
3. Structured memory, merchant isolation, provenance, freshness and visitor control are mandatory.
4. Decision Engine outputs structured governed decisions; Experience Runtime renders them; authorized execution verifies real actions.
5. Platform safety > merchant-approved policy > runtime decision. **The Merchant Owns the Truth. Kablet Owns the Experience.**
6. Safe, useful experiences from visitor one; commercial improvement and cross-merchant network advantages must be demonstrated, never presumed.
7. Chapter 3 owns action/integration contracts and verification; Chapter 4 owns the canvas/runtime; Chapter 5 owns experimentation and learning mechanisms; Chapter 6 owns infrastructure and reliability implementation.
