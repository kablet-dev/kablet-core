# Kablet Blueprint — Chapter 04: Experience

**Status:** STRATEGICALLY LOCKED — Sections 4.1–4.10. Design decisions only; engineering implementation and production tests not verified.

## 4.1 Experience Vision & Single Canvas — LOCKED (Option A)

**Decision:** One Adaptive Canvas with Governed Compositions, not traditional fixed pages decorated with AI widgets.

- Kablet owns a coordinated customer-facing storefront experience; the merchant owns authoritative business truth, brand and approved policies.
- Context, visitor intent and merchant truth inform a governed experience decision. The runtime selects and arranges approved components; it does not execute arbitrary AI-generated frontend code.
- The canvas supports Discovery, Comparison, Reassurance and Ready-to-Buy compositions as different states of the same merchant storefront, not independent websites.
- Adapt when there is sufficient reason and evidence of visitor need; preserve visual and interaction stability when change would confuse or interrupt the visitor.
- Explicit visitor choices outrank weak inferred signals. Merchant governance, accessibility, measurement and authorization remain in force.
- The initial demo contrasts three visitors at one merchant: exploring, comparing, and ready to purchase. This is a proposed sales demonstration, not proof of conversion lift.
- Competitive differentiation is a hypothesis to validate: whole-experience coordination rather than merely isolated personalized widgets.

## 4.2 Visitor Journey & Intent-Based Compositions — LOCKED (Option A)

**Decision:** Four governed, intent-responsive compositions form the initial experience library: Discovery, Comparison, Reassurance, and Ready to Buy. They are coordinated priorities within one storefront, not four separate websites or mandatory sequential funnel steps.

| Composition | Visitor goal | Prominent | De-emphasized, never inaccessible |
|---|---|---|---|
| Discovery | Find relevant options | Categories, guided exploration, collections, inspiration, clear search | Premature checkout prompts, dense comparisons |
| Comparison | Choose between candidates | Side-by-side verified differences, prices, variants, reviews where substantiated | Unrelated products and promotional clutter |
| Reassurance | Resolve a purchase concern | Accurate returns, shipping, support, evidence-backed reviews, product facts | Extra recommendations and distracting campaigns |
| Ready to Buy | Complete intended purchase | Selected variant, authoritative price and availability, delivery information, clear cart/checkout action | Editorial content and irrelevant recommendations |

**Experience laws:** (1) Intent-led: explicit visitor requests outrank weak inferred signals. (2) Stable: avoid flicker and preserve task, focus, scroll, and input where possible. (3) Reversible: visitors can navigate back or change their mind. (4) Truthful: no invented product facts, testimonials, policies, stock, delivery promises, or scarcity. (5) Conversion-oriented, not coercive: reduce friction without hidden material information or unrequested actions.

**Transitions:** Nonlinear and governed; entry and exit are based on permitted explicit and behavioral signals, sufficient confidence, freshness, hysteresis/stability rules, and user control. Do not recompose on every click. A shopper may start Ready to Buy or move from checkout back to Comparison. Essential navigation, product details, and cart access remain available in all compositions.

**Composition contract:** Each composition has a declared purpose, eligible components, prominence hierarchy, suppressible distractions, entry/exit signals, accessibility and mobile behavior, merchant-policy constraints, versioned decision provenance, and exposure/interaction instrumentation. No arbitrary AI-generated UI code. Behavioral progression is diagnostic; verified paid purchases, net RPV, refund/return guardrails and controlled comparisons determine commercial value.

**Reassurance hypothesis:** Surfacing authoritative answers to real visitor concerns may reduce abandonment; this is a testable hypothesis, not established lift or a guarantee.

**Demonstration:** Same merchant, four visitor goals, four governed experiences. Demo visuals and promotional claims must not imply experimentally proven lift without evidence.

## 4.3 Experience Components & Composition Contracts — LOCKED (Option A)

**Decision:** Governed, reusable Component Library + versioned Composition Contracts. The intelligence proposes structured experience decisions; deterministic validation checks authorization, merchant truth, capability, data freshness, component compatibility and accessibility constraints; the runtime renders approved UI. Never execute arbitrary AI-generated frontend code.

### Component architecture
- **Component registry:** Stable `component_id`, semantic version, allowed props/schema, required and optional data, data provenance/freshness rules, interaction/action capabilities, permitted compositions/slots, responsive/accessibility behavior, error/empty/loading states, analytics events, and rollout status.
- **Initial reusable components:** product card/grid, search and category navigation, guided discovery prompt, comparison tray/table, product facts, verified review display, policy/returns panel, shipping/delivery panel, support entry, variant and quantity selectors, inventory status, cart summary, checkout action and order-status feedback. Reuse components across compositions rather than duplicate implementations.
- **Composition contract:** Stable `composition_id` and version, goal, allowed/required component slots, priority and layout constraints, entry/exit signals, required authoritative data, fallbacks, prohibited claims/actions, merchant permissions, accessibility/mobile requirements, stability rules and instrumentation.
- **Experience decision payload:** Tenant/store ID, session/context revision, intent and evidence/confidence, `composition_id@version`, component references with validated data IDs (not invented facts), layout/priority variant, expiry/freshness, policy version, experiment assignment, decision ID and trace metadata. Server/client validate against current state before committing consequential changes.
- **Runtime pipeline:** collect permitted context → interpret intent → propose structured composition → validate against merchant truth, policies, component schemas, provider capabilities and freshness → render with merchant brand tokens → instrument exposure and interactions → link verified downstream outcomes. Invalid proposals omit unsafe components or fall back to a known-good composition; failures are visible to operators.

### Non-negotiable constraints
1. Product existence, current prices, variants, stock and delivery claims come from authoritative sources; stale values are refreshed or explicitly qualified. Revalidate commercially consequential values at checkout.
2. Ratings/reviews/testimonials are shown only when attributable to a legitimate permitted source; never manufacture or silently summarize unavailable evidence.
3. Components must meet keyboard, focus, screen-reader, responsive/mobile and state-preservation requirements. Invalid layouts cannot ship just because a model selected them.
4. Preserve user-selected product, variant, cart, typed input, task continuity, navigation and clear access to checkout; no flicker or coercive reordering.
5. Version both component and composition; record actual rendered exposure (not merely proposed decision), policy/experiment version and outcome linkage for rollback and learning.
6. CVR differences across versions are observational unless tested with credible controlled assignment, comparable cohorts, sufficient sample, and uncertainty analysis; do not automatically promote a version on raw CVR alone.

### Implementation acceptance criteria
- A developer can render all four compositions from a shared typed component registry and fixed, validated composition contracts.
- Invalid product ID, unsupported attribute, unavailable review, expired price, disallowed component and unauthorized action are each rejected or safely degraded with an auditable reason.
- A viewport resize or composition transition does not lose cart/variant/input state; keyboard and screen-reader flows work in supported devices.
- An experiment logs eligible assignment and **actual exposure** to a specific composition/component version; safe rollback restores the previous approved version.
- Provider or model failure shows a known-good deterministic shopping experience; no arbitrary model-generated code executes.

**Delivery sequencing:** Component registry and a narrow usable vertical slice first, composition validation/runtime second, intelligence-to-composition integration and outcome instrumentation third. The suggested three-sprint schedule is illustrative, not a reliable delivery estimate; implement end-to-end tests throughout rather than deferring them to the last sprint.
## 4.4 Adaptive Navigation & Interaction — LOCKED (Option A)

**Decision:** Intent-aware, stability-first navigation. Kablet preserves recognizable search, product, cart, checkout, back navigation and customer control while adapting the canvas to meaningful intent. Prefer local inline changes over whole-canvas recomposition.

### Intent and navigation hierarchy
- Explicit visitor commands outrank inferred behavior and acquisition context, subject to merchant truth, safety and permissions.
- Behavioral signals (comparison selections, policy views, variant choices) inform intent but do not justify disruptive changes alone. Ad/campaign context is an initial hint, never a mandate.
- Four compositions are non-linear priorities, not a mandatory funnel. Preserve familiar global navigation and deep-linkable products, shareable URLs and meaningful browser history.

### Mandatory transition safeguards
1. **Transition hysteresis:** Avoid flip-flopping on weak or ambiguous signals. Change composition only when explicit intent or sufficiently strong, fresh evidence warrants it.
2. **Task protection:** Never interrupt checkout, typing, payment confirmation, or other critical tasks with disruptive recomposition. Preserve keyboard focus, input, scroll and cart/variant selections where feasible.
3. **Local adaptation first:** Answer a shipping/returns question in a contextual panel rather than rebuilding the entire canvas when the current task remains valid.
4. **Reversible:** Visitor can dismiss panels, backtrack, change selection, search broadly and return to a prior meaningful view. No trapped flows.
5. **Authoritative state:** Variant changes invalidate stale actions; checkout handoff, refresh and reconnect must not invent payment outcomes or silently reset transaction state.

### Demonstration scenario and required UX copy
- A visitor ready to purchase a $120 serum asks about returns. Show an inline policy panel with the actual merchant policy while preserving the selected 50 ml variant and checkout action. Do not automatically replace the entire screen with Reassurance composition.
- Where payment status is uncertain, preserve the Chapter 3.9 UX copy: “We're checking your payment status. Please don't submit another payment yet. We'll update your order status as soon as it's confirmed.”

### Interaction QA acceptance tests
- Compare products and navigate back without losing selected comparison items.
- Ask a returns question during Ready to Buy: contextual policy panel opens, selected variant and purchase action remain intact.
- Change variant while an action is pending: stale action is rejected or recomputed using current state.
- Browser Back and deep links restore meaningful view/state in supported scenarios.
- Refresh/reconnect during checkout preserves recoverable state, reconciles payment status and never falsely declares success or failure.
- Keyboard navigation, focus, screen-reader announcements and mobile responsiveness survive panel openings and governed transitions.
- AI outage does not prevent ordinary deterministic shopping navigation and commerce where external commerce providers remain operational.

**Principle:** “The best adaptive experience isn't the one that changes most often. It's the one that makes the next useful action easier while preserving the customer's sense of control.”

## 4.5 Product Discovery, Comparison & Reassurance — LOCKED (Option A)

**Decision:** Unified Natural Language + Visual Shopping. Browsing, tapping, filtering, searching, comparing and buying are first-class visual interactions; natural language is an optional accelerator, not a requirement. Both input modalities modify the same tenant-scoped visitor state and the same governed canvas. No chat-first gate. Do not treat illustrative 80/20 interaction proportions as observed usage or a design quota.

### Shared interaction contract
- **Input:** typed request, tap, search, filter, selected products, merchant catalog, session context and consent-permitted history.
- **Interpretation:** deterministic parsing/filtering when sufficient; selective AI interpretation for genuine ambiguous natural-language intent, subject to budgets and fallback.
- **Validation:** catalog-backed product IDs, supported attributes, price and availability freshness, merchant policies, component contract, consent and authorization. Never fabricate product records, review claims, suitability guarantees or policies.
- **State:** stable selected products/variants, cart, applied filters, query, comparison tray, panel visibility, intent provenance, composition and version. Visual and language controls operate on this one state model.
- **Output:** validated visual component update, with optional concise explanatory copy. Prefer local changes; never require a chat response to browse or transact.
- **Measurement:** eligible exposure and rendered component version, query/filter use, comparison selection, policy panel exposure and downstream provider-verified purchase/RPV. Interaction metrics are diagnostic, not causal proof.

### Flow A — Discovery: “Something for sensitive skin under $50”
1. Visitor enters the request or uses visible filters. Extract candidate `skin_type=sensitive`, `price_max=50` in the merchant's supported currency, preserving provenance and interpretation confidence.
2. Resolve the request against merchant-defined product attributes. “Sensitive skin” cannot be assumed from marketing prose or inferred medical suitability; if no validated field exists, ask a concise clarification or present transparently unfiltered relevant results rather than pretending a filter was applied.
3. Query actual catalog product IDs and eligible variants, with supported price and availability. Show product cards, active filter chips, clear/reset control, sort and browse navigation. Price limits and currency handling must be explicit; stale prices revalidated before consequential action.
4. If zero matches, say so and offer transparent adjacent filters or broader browsing; never invent products or silently remove a budget constraint.
5. Visitor continues by tapping a card, modifying a filter or asking a follow-up. All paths preserve one state; AI outage retains visual catalog/search/filter shopping.
**Acceptance:** exact constraint preservation or explicit disclosure; no phantom products; zero-results recovery; visual and typed filters synchronize; mobile/keyboard accessible; versioned exposure captured.

### Flow B — Comparison: Select two real products
1. Visitor selects two catalog-backed products by tap or explicit request. A persistent but dismissible comparison tray appears without replacing the entire browsing canvas.
2. Comparison opens side by side (or accessible stacked mobile presentation) using authoritative product identity, variant, price, permitted attributes, and legitimate review evidence where available.
3. Missing attribute is explicitly **“Not specified”**; unknown is not interpreted as inferior. Do not manufacture ratings, ingredient benefits, fit claims, delivery promises or differences.
4. Maintain both selections when viewing details, changing variant, navigating back or opening reassurance. Allow swap/remove and direct purchase of either item with current price/stock revalidation.
5. Unsupported comparison data yields an honest partial comparison, not a fabricated answer.
**Acceptance:** tray non-disruptive; accurate differences; missing-data label; selected variants persist; back/refresh state as supported; stale purchase action invalidation; accessible mobile comparison.

### Flow C — Reassurance: “What if it doesn't fit?”
1. From a product or ready-to-buy view, visitor opens returns/fit/delivery question through a tap or typed request.
2. Present an **in-context, dismissible** policy/FAQ/reviews panel linked to the merchant's approved, current source and relevant product/market conditions. Where policy varies by product, region or promotion, resolve the applicable policy or disclose uncertainty.
3. Preserve product, selected size/variant, price context, cart and visible path to checkout. Don't replace the whole composition unless the visitor explicitly changes goal.
4. If the answer is absent, state that it is unavailable and offer approved support contact; never infer a return guarantee or invent social proof.
5. Visitor may dismiss, continue comparing, or purchase; no automatic checkout or manipulative pressure.
**Acceptance:** accurate cited merchant policy/source reference, preserved purchase context, accessible panel focus/dismissal, no invented guarantees, uncertainty and support fallback.

### Runtime boundaries and failure handling
- Structured requests use versioned component contracts and deterministic validation; arbitrary model-generated UI code is forbidden.
- Model timeout/invalid interpretation falls back to catalog search and filters, comparison of available facts, and directly accessible merchant policies.
- Privacy/consent choices control what visitor data is retained and used. Do not infer sensitive traits from queries beyond what is necessary to answer the immediate request.
- Merchant truth and provider authority govern prices, variants, availability, policy claims and actions. Chapter 3 governs payment and order verification.
- Explicit intent outranks inferred context; transitions use hysteresis, task protection and local adaptation first.

### Engineering QA fixtures
- Query with real matches, zero matches, missing `skin_type`, ambiguous currency and stale catalog price.
- Select two products; compare missing attribute as “Not specified”; navigate Back; change a variant during pending action.
- Ask about returns while ready to buy; panel appears without resetting cart, selected variant, focus or checkout path.
- Typed request and visual filters remain synchronized; AI outage still allows ordinary shopping.
- Audit actual rendered exposure and verified downstream outcome linkage without assuming causation from behavior alone.

**Positioning principle:** “Natural language is an optional accelerator, not a requirement.”

## 4.6 Checkout Handoff & Conversion UX — LOCKED (Option A)

**Decision:** Friction-Minimized, Provider-Authoritative Checkout. Kablet intelligently guides the shopping decision, then provides a stable, predictable, authorized transaction path. No live model response is necessary for core checkout.

### Checkout UX and provider boundaries
- Ready-to-Buy shows exact selected product, variant, quantity, authoritative price, current availability, relevant delivery information, and a clear purchase action. Preserve selected items and shopping context through checkout preparation.
- Before payment authorization, revalidate provider-authoritative variant, inventory, prices, applicable discounts, shipping, taxes and final totals. Show material changes and obtain customer acceptance; never silently substitute a variant or total.
- **Shopify-connected:** prepare the correct cart and hand off to authorized Shopify checkout; do not claim control over Shopify-hosted payment screens. Preserve supported attribution references and report unmatched outcomes transparently.
- **Kablet Native:** render an approved, branded checkout flow; the merchant connects an eligible Stripe account via Stripe Connect and Stripe handles sensitive payment collection. Native commerce coordinates authoritative inventory, payment, and order records. Exact Connect configuration and merchant-of-record obligations require validation.
- Keep product information, merchant policies, cart correction and support reachable without obstructing checkout. Avoid coercive urgency, hidden costs or involuntary purchase actions.

### Non-negotiable checkout engineering rules (also for AGENTS.md)
1. **Zero disruptive AI adaptation during checkout.** Freeze composition experiments and major re-layouts from checkout initiation through transaction resolution. Never interrupt typing, payment authorization, focus, or form progress. Deterministic validation and necessary price/stock corrections remain permitted.
2. **Checkout success screen is not a verified purchase.** A redirect, thank-you page, or checkout-start event does not establish payment or an order. Report verified paid orders and captured revenue only after authoritative provider evidence and reconciliation; handle refunds and disputes separately.
3. **Unknown payment status requires honest pending UX, never a retry prompt.** Keep a durable operation identity and reconcile with provider authority before any retry. Customer copy, verbatim: **“We're checking your payment status. Please don't submit another payment yet. We'll update your order status as soon as it's confirmed.”**

### Transaction UX states
- **Preparing:** validate authoritative cart, totals and availability; provide clear progress and recoverable errors.
- **Ready for confirmation:** display final amount, shipping/tax information and applicable policies; explicit visitor purchase authorization required.
- **Processing:** prevent accidental duplicate submissions; show progress without implying payment completion.
- **Verified success:** only when authoritative order/payment evidence confirms the defined commercial state; show receipt and order reference where available.
- **Confirmed failure:** explain the verified failure and offer a permitted, safe retry path.
- **Unknown/pending:** show the mandatory pending message; preserve operation identity; provide status lookup/support; no new independent payment attempt.

### Measurement and QA contracts
- Record consent-permitted composition exposure, cart and checkout events with version and eligible-session identity; keep checkout-start separate from verified paid-order outcomes and incremental impact.
- Test cart/variant preservation across Shopify handoff, Native checkout, browser Back, refresh, reconnect and price change; test focus and form preservation; verify accessible mobile behavior.
- Test double-click payment, successful payment with lost response, duplicated/delayed webhook, refund adjustment, attribution gap, provider outage, and AI outage. Assert authoritative records, not merely UI appearance.
- No disruptive runtime experiment during checkout; changes to checkout UX follow separately approved, versioned and safety-reviewed releases.

**Experience principle:** “Kablet should be exceptionally intelligent at helping customers decide — and exceptionally predictable when they pay.”

## 4.7 Merchant Brand, Truth & Content Controls — LOCKED (Option A)

**Decision:** Merchant-Owned Truth + Governed Experience Autonomy. The merchant owns commercial facts, policies, permissions, approved claims and brand identity; Kablet controls approved experience composition within platform safety and merchant guardrails.

### Authority and approval
- Merchant authority: product catalog, variants, prices, stock, promotions, return/shipping policies, reviews authorization, brand tokens, business goals and sensitive action permissions.
- Kablet autonomy: selecting/reordering approved components, contextual policy surfacing, verified product comparisons and stable navigation adaptations. No unapproved price changes, discounts, policy changes, invented claims or arbitrary brand alterations.
- Risk-based approval: routine presentation changes operate under prior approval; material commercial changes require merchant authorization and an auditable approval event.

### Merchant Truth Registry contract
- For every material claim or commerce datum record tenant scope, authoritative source/provider, source identifier, version or revision where supported, fetched/validated timestamp, freshness rules, usage permission and provenance.
- Distinguish authoritative provider data from derived or generated explanatory text. Generated text cannot create unsupported product suitability, review authenticity, guarantees or delivery promises.
- Changes to merchant policy or catalog invalidate affected cached/derived content, trigger reconciliation and refresh, and prevent known-stale assertions from being represented as current. Define propagation SLOs and safe degraded behavior; do not promise zero stale exposure.
- Price, stock, and variant data receive stricter authoritative revalidation at consequential action and checkout boundaries.

### Brand and publication lifecycle
- Shared merchant design tokens (logo, palette, typography, imagery and approved tone) apply across Discovery, Comparison, Reassurance and Ready-to-Buy compositions.
- Merchant setup: connect or create commerce provider; ingest/validate business truth; fill missing policies/assets; configure goals/permissions; preview representative compositions; approve publication; audit changes and support rollback.
- Do not require manual duplicated Shopify inventory management. Isolate all data and approvals by tenant.

### Engineering acceptance tests
- Merchant updates return policy; old cached and generated explanations are invalidated or clearly qualified and do not continue as verified current policy. Simulate delayed sync, disconnected client and contradictory sources.
- AI proposes unauthorized discount, price, invented review or policy rewrite: deterministic validator rejects it.
- Switching composition retains brand tokens, product truth and merchant-approved content; approval and audit history are inspectable.
- Test tenant isolation, stale price/stock revalidation, source outage fallback and rollback.

**Trust principle:** “The Merchant Owns the Truth. Kablet Owns the Experience.”

## 4.8 Accessibility, Mobile, Performance & SEO — LOCKED (Option A)

**Decision:** Mobile-First, Performance-Budgeted Experience. Performance, accessibility, layout stability and appropriate SEO are launch criteria and business guardrails, not post-launch polish.

### Mobile and Core Web Vitals targets
- At the 75th percentile of eligible real-user visits, target **LCP ≤ 2.5 seconds**, **CLS ≤ 0.1**, and **INP ≤ 200 milliseconds**, segmented by device, route, merchant and experience version. Use lab tests before sufficient field data exists; report limitations rather than asserting unmeasured compliance.
- Set a **stretch goal of useful initial product content in under 2 seconds** on a documented, repeatable throttled-4G mobile profile. Define device class, network latency/throughput, cache state, geography and measurement start/end before treating it as a gate. A sub-2-second target is not a guarantee of being faster than Shopify or any competitor.
- Establish measured route-specific JavaScript, image and third-party-script budgets after profiling the first vertical slice; block material regressions and investigate performance/conversion tradeoffs.

### Rendering and adaptive stability
- **Initial useful storefront rendering must not wait for an AI model.** Server-deliver a usable approved default composition with current permissible merchant facts; hydrate visual shopping interactions progressively; enhance asynchronously where justified.
- Core product discovery, variant selection, cart, checkout and order-state access must have deterministic operation paths independent of real-time AI. Commerce-provider or infrastructure outages can still affect those paths; never promise unconditional availability.
- Prioritize the primary above-the-fold visual; use responsive image sources, modern supported formats, intrinsic dimensions and lazy loading for appropriate offscreen images. Do not lazy-load the primary LCP image indiscriminately.
- Recomposition must preserve focus, selections, form values, scroll context and purchase state; avoid unexpected layout shift, especially during comparison, reassurance and checkout. Protect critical tasks and prefer local adaptations.

### Accessibility
- Target **WCAG 2.2 AA** for applicable storefront experiences, including semantic controls, keyboard access, visible focus, screen-reader announcements, meaningful errors, touch target usability, contrast and reduced-motion preferences.
- Test adaptive transitions with keyboard and assistive technology; a composition is not releasable solely because it renders visually.

### SEO by provider path
- **Connected Shopify:** retain the existing canonical organic Shopify storefront for the selected-traffic initial rollout; document index/noindex and canonical policy for Kablet landing URLs, avoid duplicate-indexing and checkout/domain tracking surprises.
- **Kablet Native:** deliver crawlable product and collection HTML from Day 1 with stable URLs, metadata, canonicals, sitemap and appropriate structured data; product discovery must not depend on an AI session.
- Search crawlers and visitors must receive the same authoritative product facts, even when layout and ordering adapt. Performance and Core Web Vitals may affect search outcomes but cannot guarantee rankings.

### Mandatory acceptance and release tests
- Cold and warm mobile loads on defined throttled 4G profiles; measured LCP, CLS, INP; large catalogs; slow devices; third-party script degradation; responsive images and priorities.
- Compare initial render with AI healthy, slow, timed out and fully unavailable: useful content appears without waiting for inference.
- **Explicit mandatory test: AI outage during active checkout.** Simulate loss of all AI providers while a shopper has an in-progress purchase; verify that product/variant state, checkout, payment submission, provider verification and honest pending/confirmation UX remain operational without AI involvement, subject to healthy commerce/payment infrastructure. Verify persisted authoritative records, not just screens.
- Compare mobile and keyboard/screen-reader operation across all four compositions; test dynamic panel opening, browser Back, refresh, focus, reduced motion and no unexpected layout shifts.
- Verify Shopify canonical/noninterference strategy and Native crawlable HTML, URLs, metadata and sitemap. Observe field metrics and guard against promoting a composition that materially degrades mobile performance.

**Business principle:** “Intelligence cannot compensate for a slow, unstable or inaccessible shopping experience.”

## 4.9 Stability, Consent & Experience Guardrails — LOCKED (Option A)

**Decision:** Consent-Aware, Trust-Governed Adaptation. Customer trust, lawful processing, platform safety, accessibility, and merchant-approved commercial truth are **hard constraints above revenue optimization**, not optional penalties in an objective function. This constraint is binding on Chapter 5's Learning Engine, including candidate generation, experiment eligibility, policy promotion, and rollback.

### Six non-negotiable experience guardrails
1. **Visitor control:** normal visual browsing, search, comparison, cart and checkout remain possible without conversation or optional personalization. Dismissal and user-initiated navigation take precedence over weak inferred intent.
2. **Predictable adaptation:** transition hysteresis, local adaptation first, protected typing and checkout, retained selections/focus/navigation state, and no involuntary disruptive recomposition.
3. **Truthful persuasion:** prohibit fabricated reviews, fake scarcity or timers, invented discounts, unsupported efficacy/suitability/delivery claims, concealed fees/return conditions, unauthorized cart additions, and obstructive cancellation/decline flows. Display stock, reviews, discounts, and policies only when supported by suitable merchant-authoritative evidence.
4. **Privacy and consent:** distinguish necessary commerce state from optional personalization and analytics. Apply lawful basis/consent requirements by jurisdiction and processing purpose, with minimization, retention/deletion, tenant isolation and data-access controls. Declining optional tracking must not disable core shopping; do not assume every cookie or all analytics processing has the same legal basis.
5. **Accessibility:** enforce the Chapter 4.8 WCAG 2.2 AA target, focus/keyboard/screen-reader behavior, reduced-motion preferences and touch usability across transitions.
6. **Safe fallback and rollback:** reject invalid compositions, preserve essential task context, use a safe approved deterministic default, and provide versioned kill switches with audit records.

### Deterministic Experience Guardrail Validator
**AI proposes → deterministic validator checks → approved render or rejection/fallback.** Validator operates **outside** the model, is independently testable, and enforces tenant, consent, source/provenance/freshness, merchant approvals, allowed composition/component contracts, commercial claims, stability, accessibility and task-protection constraints. Log proposal identity, policy version, decision/rejection reason, permitted exposure and rollback; avoid logging unnecessary sensitive visitor data. A model's assertion that a claim is safe does not grant authorization.

**Scope of guarantee:** system architecture must block unsupported or unauthorized claims in covered structured rendering paths; don't promise that every possible false statement is physically impossible without complete coverage of free-form text, imported merchant content, third-party scripts and failure modes. Test and disclose coverage and residual risks. Regulatory obligations vary by market; review relevant consumer-protection, privacy and platform rules rather than claiming universal compliance.

### Operational controls and hierarchy
- Merchant or authorized platform operator may disable AI enhancements without disabling deterministic commerce.
- Operators may stop an experiment or roll back a versioned composition and may restrict unsafe commerce capabilities using Chapter 3 execution controls.
- Do not discard unresolved transactions or silently rewrite verified outcomes during rollback.
- **Learning hierarchy:** platform safety/legal/privacy constraints > merchant-approved business policies and commercial truth > visitor consent and experience guardrails > eligible performance/revenue optimization. Reject or roll back any candidate that violates higher-priority constraints even if measured RPV increases. Chapter 5 must implement this as an enforceable policy-promotion gate.

### Mandatory acceptance tests
- Declined optional personalization and analytics consent: storefront remains shoppable; forbidden collection and processing do not occur.
- Fake scarcity, fabricated review, unsupported refund guarantee, unauthorized discount, hidden fee: validator rejects or prevents display and records reason.
- Repeated weak signals, active typing, payment step, comparison tray, dismissed assistance: no disruptive flip-flop, task interruption or loss of context.
- Cross-tenant information access: denied. Consent changes: future processing updated according to applicable policy.
- Broken composition or unsafe experiment: stop exposure, roll back and verify deterministic storefront/cart/checkout survive.
- Learning policy candidate with higher RPV but trust/privacy/accessibility violations: **promotion denied** and auditable.

**Product principle:** “Privacy restrictions should reduce personalization, not disable shopping.”

## 4.10 Experience Validation & First Live Demo — LOCKED (Option A)

**Decision:** One complete, verified Shopify-connected adaptive commerce experience—not a broad scripted visual prototype. The initial proof uses one merchant, a real authorized Shopify catalog and policies, one coordinated canvas with four governed compositions, shared visitor state, visual-first shopping with optional natural language, and a Shopify-authoritative checkout. Native commerce remains an independent product path with separate launch gates, not a prerequisite for the first Shopify demonstration.

### One continuous visitor demonstration
1. **Discovery:** Enter “something for sensitive skin under $50”; extract only supported constraints, use actual catalog attributes, show visually browsable product results. Never invent product existence or suitability; allow ordinary filters and browsing without AI.
2. **Comparison:** Select two real products; show a local comparison tray with sourced comparable facts. Missing facts read “Not specified.” Preserve selections and meaningful browser navigation.
3. **Reassurance:** Ask about returns; open the authoritative merchant-policy panel within the existing product context. Preserve variant, cart, purchase path and focus. If the policy is incomplete, acknowledge uncertainty and offer support.
4. **Ready to buy:** Revalidate variant, availability, price and terms; transfer correct cart to authorized Shopify checkout. Freeze disruptive adaptation during checkout. Record purchase only after provider-authoritative order/payment verification, not on a redirect or thank-you page.

### Merchant-facing proof
Show merchant-owned catalog and policy provenance, brand consistency across compositions, preview and approval, versioned source/freshness state, experiment/AI disablement, auditability, and verified order plus explicit attribution coverage. Demonstrate policy change propagation and safe stale-content handling without claiming instantaneous global updates.

### Reproducible failure demonstrations
- AI provider outage **including during active checkout**: deterministic storefront, cart and authorized checkout remain operational, provided commerce/payment providers are operational.
- Merchant policy change: invalidate affected content or qualify/fallback safely; never knowingly present stale content as verified current policy.
- Stale variant/price: revalidate and disclose changed totals before authorization.
- Browser Back/refresh: preserve meaningful shopping state; never invent transaction outcome.
- Lost payment response: classify UNKNOWN, reconcile first, never blindly retry or display false success.
- Proposed fake scarcity/unauthorized discount/review: deterministic validator rejects unsupported or unauthorized output.
- Mobile throttling: show actual timing and interaction stability results, not staged performance.

### Three independent proof levels
**Level 1 — Experience proof:** Live continuous working adaptive session using actual merchant data and shared state; not evidence of incremental revenue.
**Level 2 — Commerce and reliability proof:** Verified provider-backed transaction and tested safety, merchant controls, AI-outage resilience, accessibility and mobile budgets; not evidence of causal lift.
**Level 3 — Business proof:** Real eligible traffic in a credible controlled experiment with verified purchases, net revenue, revenue-per-visitor impact, attribution coverage and uncertainty. No causal uplift claims before this evidence exists.

### Mandatory definition of done (all seven)
1. Deployed, usable merchant storefront—not just a video or mockup.
2. Automated critical interaction, accessibility and safety contract tests.
3. Evidence of actual catalog, policy and checkout integrations.
4. Mobile performance and accessibility test results against §4.8 gates, with any unmet critical gate blocking release.
5. Verified commerce outcomes with clear attribution limitations.
6. Merchant approval, rollback and recovery evidence.
7. A reproducible demo script executable by a second engineer with **no hidden manual intervention**.

**Launch rule:** All critical commerce/safety gates in Chapter 3 and the above definition of done must pass for a complete proof claim. A compelling video alone is not proof of a functioning or revenue-improving product.

