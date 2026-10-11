# Kablet Blueprint — Chapter 3: Execution

**Status:** STRATEGICALLY LOCKED — Sections 3.1–3.10. Design decisions only; engineering implementation and production tests not verified.

## 3.1 Execution Vision & Architecture — LOCKED (Option A)

**Founding principle:** One Execution Engine. Multiple Commerce Providers. One Consistent Customer Experience.

Intelligence proposes structured actions; the shared Execution Engine validates authorization, merchant business truth, current state, and freshness; a provider-specific adapter performs the action; the system verifies the actual result before presenting success. Intelligence never directly modifies orders, charges cards, or changes inventory.

### Day 1 commerce paths

1. **Connected Shopify:** Kablet owns the adaptive shopping journey and cart presentation where supported; Shopify remains authoritative for catalog, inventory, checkout, payment, and orders. Initial checkout is Shopify's supported checkout flow, with explicit handoff and verified order events. Kablet does not falsely claim control of Shopify-hosted checkout UI.
2. **Kablet Native:** Kablet provides its own branded checkout interface and core commerce backend; an integrated compliant payment service processes sensitive payments. Kablet need not become a payment processor or store raw card details.

Both paths share provider-neutral intelligence, experience, action contracts, permissions, event semantics, and outcome reporting; adapters contain backend-specific details. Checkout completion and attribution require reliable verification, not mere client-side success messages. Provider integrations, including payment-provider choice and specific Shopify API behavior, must be verified during implementation.

### Five execution laws

- **Authorized:** Validate permissions and appropriate confirmations before actions.
- **Validated:** Check authoritative products, variants, prices, inventory and current state.
- **Idempotent:** Use stable operation identities and provider-appropriate deduplication to reduce accidental duplicate effects.
- **Verifiable:** Never claim success until authoritative evidence supports it.
- **Recoverable:** Explicitly reconcile uncertain outcomes and support safe retries, failure states, and recovery.

These laws reduce risks but do not promise perfect protection against all external failures.

## 3.2 Commerce Provider Abstraction — LOCKED (Option A)

**Founding rule:** INTENT ≠ ACTION ≠ OUTCOME. A visitor's wish is not an authorized action; an attempted action is not a verified result. For example, purchase intent ≠ checkout creation ≠ confirmed paid order.

**Provider-neutral contracts:** Intelligence and the Experience Runtime depend on common typed commerce capabilities, structured action requests, execution receipts, and verified outcome records, not Shopify-specific entities or assumptions. One Execution Engine mediates permissions, validation, freshness, idempotency, provider routing, verification, and reconciliation. Shopify and Kablet Native implement separate adapters behind this boundary; additional providers can be introduced without redesigning the intelligence system, subject to their real capabilities and integration complexity.

**Capability Registry:** Track provider, API/version, merchant-specific configuration, permission scope, available operations, required visitor confirmation, freshness, verification method, and availability. Examples: catalog read, variant availability, cart update, checkout creation, order verification, refund initiation. The registry is a preflight gate, **not a substitute for authoritative checks at execution time**; permissions or inventory may change between discovery and execution. Unsupported or unauthorized actions must be rejected or routed to an approved alternative, never simulated as successful.

**Verification discipline:** Adapter responses and trusted provider events must be reconciled into explicit outcome states (e.g., succeeded, failed, pending/unknown). A created checkout or redirected visitor is not a paid order. Webhooks must be authenticated, deduplicated, and reconciled with provider records when necessary. Retries require stable operation identity and safe handling of unknown outcomes; idempotency reduces but cannot absolutely eliminate duplicates.

**Design constraints:** Provider-specific behavior stays inside adapters; capability differences remain visible instead of forcing lowest-common-denominator assumptions. Do not promise fixed integration durations. All provider capabilities and checkout flows require implementation-time validation against supported provider APIs and permissions.

## 3.3 Shopify Headless Integration — LOCKED (Option A)

**Strategy:** Controlled headless integration, not immediate full storefront replacement. Shopify stays the authoritative commerce backend for existing merchants. Kablet operates the adaptive storefront for selected paid/social traffic while the existing Shopify canonical organic-search storefront remains intact initially. Broader storefront migration requires separate merchant approval, SEO and attribution validation, and proven operational readiness.

### Merchant onboarding and activation

1. **Connect:** Merchant installs/authorizes Kablet through supported Shopify authorization with least-privilege scopes.
2. **Synchronize:** Read and map authorized catalog, products, variants, prices, availability, images, and relevant policies; check provider capabilities.
3. **Configure:** Merchant sets business goals, brand boundaries, permissions, and approved commercial policies.
4. **Preview:** Kablet composes the adaptive storefront from authoritative merchant information.
5. **Validate:** Test catalog accuracy, variants, current prices, cart, Shopify checkout handoff, trusted order/payment evidence, attribution, SEO separation, and safe fallback.
6. **Publish:** Merchant authorizes selected traffic to Kablet; monitor results and rollback readiness.

**Activation objective:** A same-day activation is an aspirational pilot target, not a guaranteed setup time. Measure actual activation times and blockers rather than promising fixed minutes for onboarding steps.

### Catalog synchronization and price integrity

Use initial sync, supported change events/webhooks, and periodic reconciliation to recover missed changes. Track provenance and freshness. **Price changes are high-risk:** stale product-display prices must not become binding checkout prices. Revalidate current authoritative product variant, price, discounts, availability, taxes/shipping as applicable at checkout initiation; show the customer the provider-authoritative final payable amount and obtain required acceptance before placing an order. Recheck at final provider checkout/payment submission as supported. Do not promise real-time perfect consistency from a cached catalog.

### Checkout and outcomes

Kablet controls discovery, comparison, product pages, cart presentation, and checkout entry for routed visitors; Shopify's supported checkout owns checkout/payment submission. Kablet does not claim to own Shopify-hosted checkout screens. Track checkout creation, redirect, order creation, authorization, capture/payment confirmation, refunds, and cancellations as distinct events. Authenticate and deduplicate Shopify events and reconcile authoritative order/payment status as needed. A click, checkout redirect, or payment submission is not a verified paid order. Verified paid orders support revenue reporting; **incremental** revenue/CVR claims require sound attribution and controlled comparisons.

### Outages and controls

If Shopify data or checkout is unavailable, Kablet must not fabricate inventory, payment, or order success. Only show cached data when allowed and sufficiently fresh for its use; safely block actions needing unavailable live verification. Preserve privacy, domain/session/attribution continuity, SEO canonicals, and merchant-authorized rollback. Validate actual Shopify API availability and permissions during implementation.

## 3.4 Kablet Native Commerce — LOCKED (Option A)

**Decision: Minimum Complete Native Commerce from Day 1.** A merchant without an external store can create, publish, and operate a genuine ecommerce store directly on Kablet, with a Kablet-controlled customer-facing storefront and checkout interface. The initial release targets a deliberately limited set of markets and merchant requirements; it does **not** attempt Shopify feature parity.

### Essential launch capabilities

- **Catalog:** Merchant-managed products, images, descriptions, prices, basic variants and variant-level availability.
- **Inventory:** Authoritative stock tracking, reservation or concurrency controls appropriate to the supported workflow, and protections against invalid overselling; no promise of absolute zero oversells.
- **Shopping:** Durable cart operations, recalculated totals, customer details, shipping selection, and validated checkout.
- **Payments:** At least one supported payment-provider integration using provider-hosted/embedded secure collection or tokenization; Kablet does not store raw card numbers or become the card processor. Actual payment methods and market eligibility require validation.
- **Orders:** Verified order creation and lifecycle states; payment authorization, capture, failure, unknown, refund, and cancellation represented distinctly. Fulfillment only when the relevant order/payment conditions are satisfied.
- **Merchant operations:** Basic shipping zones/rates, supported-market tax setup, order management, authorized refunds, essential notifications, and business policies.
- **Store publishing:** Domain setup, crawlable HTML via SSR/prerendering as appropriate, metadata, canonicals, sitemap, basic structured data, and verified analytics/revenue events.

### Unified architecture

Kablet Native is a **commerce provider implementation behind the same capability registry, action contracts, Execution Engine, and verified outcome semantics** as Shopify. It does not receive a second intelligence system or a separate experience engine. Native-specific operational services are internal provider capabilities; intelligence is not allowed to bypass authorization or payment verification.

### Launch scope boundaries

Defer advanced multi-warehouse fulfillment, broad international tax and currency coverage, large app marketplaces, complex wholesale contracts, hundreds of carrier integrations, and drag-and-drop page building. Day 1 means operationally complete **within the expressly supported launch market and use cases**, not globally complete. Test real paid orders, refunds, failure paths, stock changes, notifications, and merchant recovery before activation.

**Product principle:** Minimum complete commerce, not minimum impressive demo. Building Native from Day 1 is a locked strategic requirement; expanding Native's breadth is evidence-gated.

## 3.5 Cart, Checkout & Payment Execution — LOCKED (Option A)

**Decision: Verified Transaction Lifecycle.** Cart, checkout, payment attempt, and order are separate, authoritative state machines. The Execution Engine enforces merchant and visitor authorization, validates current product variants, inventory, prices, taxes, shipping, and payable totals; requires explicit purchase confirmation; assigns stable operation and transaction identities; and records receipts, verification, reconciliation, and recovery outcomes. **INTENT ≠ ACTION ≠ OUTCOME.** Creating a checkout, redirecting, or initiating payment is not a verified paid order.

**Payment and order integrity:** Never report payment captured or order paid until authoritative provider evidence is verified and linked to the appropriate order. Authenticate, deduplicate, and durably process webhooks; supplement them with provider API status checks and periodic reconciliation for missing, delayed, out-of-order, or disputed events. Unknown payment outcomes must not trigger blind retries. Idempotency keys and stable transaction identities reduce duplication but do not guarantee that double charges are impossible. Keep authorized, captured, refunded, canceled, disputed, and net revenue separately defined; experiment-based incremental uplift requires valid comparison, not just paid-order counts.

**Locked V1 merchant-owned payment strategy:**
- **Shopify-connected:** Existing Shopify-supported checkout and merchant payment setup handle checkout/payment. Kablet does not directly process these payments; it verifies orders and payment state through permitted Shopify events/APIs.
- **Kablet Native:** Merchant connects an eligible **merchant-owned Stripe account via Stripe Connect** for the initial supported markets. Kablet controls the checkout interface and order lifecycle, while Stripe-hosted/embedded secure payment collection and processing handle sensitive payment data. Kablet should avoid holding merchant funds and should choose a Connect charge/account model consistent with merchant-of-record, settlement, refunds, fees, risk, and regional eligibility; this model must be explicitly validated before launch. Provider-specific logic stays behind a payment adapter. Stripe is the V1 Native implementation, not a universal requirement for every future market.
- **Platform GMV participation:** Deferred to a later commercial phase (tentatively Phase 3); not a V1 revenue assumption. Adding application fees later is **not merely a configuration switch**: Connect charge types, merchant agreements, disclosures, tax treatment, payout flows, platform liability, and regional rules must be assessed.

**Non-negotiable caveats:** Stripe Connect does not automatically eliminate Kablet's PCI-DSS obligations, security responsibilities, refund/chargeback exposure, or other regulatory/compliance duties; scope depends on integration design and contractual roles. A webhook alone is not universally sufficient proof of an ultimately settled transaction; validate signatures, event status, object identity, and authoritative current state as required. No raw card data in Kablet systems. Verify Stripe Connect availability and permitted flows in launch markets before promising onboarding.

**Engineering principles:** Authorized · Validated · Idempotent · Verifiable · Recoverable. **Intelligence can guide a purchase. The customer authorizes it. The commerce and payment systems verify it.**

## 3.6 Orders, Inventory & Fulfillment — LOCKED (Option A)

**Decision: Authoritative Order & Inventory Lifecycle.** Payment, order, inventory, and fulfillment states are separate but reconciled. **An AI suggestion is not an operational fact.** AI may propose actions, but only explicit authorized workflows with verified provider receipts may change orders, inventory, refunds, or fulfillment records. Never equate paid with shipped, or shipped with delivered.

**Shopify-connected merchants:** Shopify remains authoritative for catalog availability, orders, payment state, and fulfillment. Kablet uses supported provider APIs, authenticated events, and reconciliation. Do not invent stock guarantees from cached reads or assume Kablet can override Shopify checkout's inventory decisions. Handle provider limitations explicitly.

**Kablet Native — CRITICAL ENGINEERING GATE BEFORE FIRST REAL ORDER: inventory concurrency.** Two customers can attempt to purchase the last unit simultaneously. Implement database-enforced atomic reservation/stock decrement or equivalent transactionally correct concurrency controls, with explicit reservation expiry/release, payment-failure recovery, cancellation/refund stock policies, idempotency, and reconciliation. Test concurrent checkout races and uncertain payment outcomes. Only confirmed allocation and payment/order evidence can produce a successful paid-order claim. Preventing oversells requires handling not only database races but payment and reservation lifecycle coordination; a database lock alone is insufficient. Never charge a second customer on the assumption that cached availability means stock is reserved. If a payment succeeds but stock cannot be fulfilled, handle the discrepancy through an explicit verified recovery/refund workflow and honest customer communication.

**Native Day 1 fulfillment:** Merchant can see orders requiring action, record processing/shipping/tracking, send essential notifications, and carry out authorized cancellation, refund, and stock-restoration workflows. Physical delivery belongs to merchant or fulfillment partner; delivery claims require appropriate evidence. Maintain separate payment and fulfillment status dimensions, including partial fulfillment, return, dispute, and refund branches.

**Reporting:** Distinguish gross order value, verified captured revenue, refunds, cancellations, disputes, net captured revenue, and actual bank payouts/settlements. **Net captured revenue is captured amounts minus refunds under a defined window; it is not identical to bank deposits**, which can differ because of payment fees, payout timing, reserves, taxes, chargebacks, and other adjustments. Report these transparently. Conversion rate is verified paid purchases per eligible visitor/session under a specified definition; refunds adjust net revenue and may support an additional retained-purchase metric, but must not silently rewrite the definition of CVR. Incremental uplift requires a credible experiment or comparison.

**Required engineering documentation:** Flag inventory concurrency as a release-blocking Kablet Native requirement in engineering specs and AGENTS.md. Include **“An AI suggestion is not an operational fact.”** in engineering principles and merchant-facing explanations, with precise scope and no unsupported absolutes.

## 3.7 Permissions, Confirmations & Action Safety — LOCKED (Option A)

**Decision: Risk-Based Authorized Execution.** Kablet intelligence may propose actions but may never invent permissions or execute consequential actions outside the shared deterministic Execution Gateway. Authority order: platform security/legal boundaries > merchant-approved policies and capabilities > current visitor authorization and runtime decision. Enforce tenant and resource scope, customer identity and order ownership where applicable, least privilege, merchant/provider capability and permission, current policy version, decision freshness, required confirmation, and auditable execution receipts.

**Risk-based interaction:** Viewing public products and presenting comparisons need no special confirmation. Visitor-requested cart updates execute without redundant confirmation after state validation. Placing an order or submitting payment requires explicit customer purchase authorization and any payment-provider authentication. Cancellation and refunds require verified identity/entitlement, merchant policy, appropriate customer confirmation and/or merchant approval, and provider authority. Price and other merchant-truth edits require authorized merchant administration; AI cannot silently change them.

**Explicit visitor agency:** **Kablet never silently executes an action the visitor did not explicitly request or confirm. Proactive suggestions are offers, not automatic executions.** Approved low-risk, non-transactional interface adaptation (such as rearranging product presentation) is not a purchase or account-changing action and may operate under published merchant policies without repetitive prompts. Background maintenance/reconciliation is separately authorized system work, not a visitor-initiated commercial action.

**Stale-decision gate:** Immediately before execution, verify current visitor/session revision, selected product and variant, merchant capability/permission version, resource ownership, order status, price and stock where relevant, and expiry of any confirmation. If the customer switches from medium to large before an add-to-cart action executes, reject or recompute the stale medium request; never silently add the old variant. This is an explicit required regression/concurrency test.

**Merchant controls:** The Business Intelligence Manager exposes permitted capabilities and approved policies; Phase 2 adds configurable approval thresholds and escalation workflows for sensitive operations (for example refunds over an authorized amount). These controls cannot override platform safety rules. A capability missing or unauthorized must produce an honest explanation or approved support handoff, not an invented successful outcome.

**Engineering doctrine:** **The intelligence should be free to help customers, but never free to invent its own permissions.** **An AI suggestion is not an operational fact.** Every consequential action remains Authorized · Validated · Idempotent · Verifiable · Recoverable. Document these principles in AGENTS.md and engineering/onboarding specifications when those artifacts are created or updated; this blueprint does not claim those separate files have already been changed.

## 3.8 Outcome Verification & Attribution — LOCKED (Option A)

**Decision: Evidence-Based Commercial Attribution.** Maintain three explicitly distinct evidence levels: (1) visitor behavior such as views, add-to-carts and checkout starts, (2) authoritative verified paid-order and payment outcomes, and (3) estimated incremental commercial impact from a credible controlled experiment or appropriately qualified comparison. **Behavior ≠ verified transaction ≠ causal uplift.** A checkout initiation, redirect, browser pixel, or thank-you page is not authoritative proof of captured revenue.

**Evidence chain:** Persist permitted visitor/session identity, acquisition context, exposure and experiment assignment, versioned experience/decision identifiers, cart and checkout handoff correlation, authoritative commerce order IDs, payment status/amount/currency, verified timestamps, and subsequent refund/cancellation/dispute adjustments. Use authenticated provider notifications with deduplication, durable processing, API verification, and reconciliation. Preserve provenance, event-time vs processing-time, attribution windows, and data-quality flags. Never fabricate matches when browser privacy settings, consent, cross-domain handoffs, or provider limitations prevent them.

**Merchant dashboard — transparency by default:** Display verified paid orders, defined paid-order CVR, captured revenue, refunds, net captured revenue, net revenue per eligible visitor, experiment/control comparisons where valid, and **attribution coverage** prominently by default, including unmatched or delayed outcomes and methodology. Clearly distinguish total provider-verified merchant orders from orders matched to Kablet visitors; the denominator and coverage population must be labeled. Show time window, data freshness, exclusions, currency, missing-data warnings, and statistical uncertainty. Example coverage of 91% is illustrative, not a guaranteed level. Net captured revenue is not necessarily equal to bank deposits or profit.

**Incrementality standard:** Assign eligible visitors consistently to control/treatment before outcome observation, track exposure and assignment, prevent avoidable cohort contamination, and compare equivalent traffic with defined metrics and uncertainty. Report observed RPV differences separately from statistically supported causal estimates. **A verified order proves a transaction occurred; it does not prove Kablet caused it.** The hypothetical $10 vs $11.50 RPV comparison represents +15% observed RPV, not automatically proven lift or forecastable extra revenue. Avoid unqualified causal claims in marketing or merchant reports; refunds and outcome maturity windows may alter estimates.

**Learning interface:** Chapter 5 receives only provenance-aware, quality-labeled behavioral signals and authoritative commercial outcomes, with adjusted revenue and experimental context. A model must not treat add-to-carts as paid orders, optimize solely for misleading short-term conversions, or learn from unmatched events as if they were verified. Retain privacy, tenant isolation, consent, and data minimization constraints.

**Trust principle:** **Show what Kablet observed, what the commerce provider verified, and what the experiment can credibly establish — never blur those claims.**

## 3.9 Failures, Retries & Recovery — LOCKED (Option A)

**Decision: Durable, Reconciliation-First Recovery.** Every consequential commerce operation must have a stable operation identity, durable state, tenant scope, authorized request record, provider correlation IDs, and auditable result evidence. **Confirmed success, confirmed failure, and unknown outcome are distinct states. UNKNOWN is not failure; never blindly retry an unknown operation. Reconcile with the authoritative provider first.** Even confirmed failures must be evaluated against provider semantics and retry safety before a new attempt.

**Mandatory $150 shoe payment failure test:** Customer submits payment; the provider may process it; the network response is lost. The UI must not report failure or success without evidence, nor initiate a new independent charge. Display verbatim when appropriate: **“We're checking your payment status. Please don't submit another payment yet.”** Preserve operation/payment identities, query Stripe/Shopify authoritative state, correlate to the native/provider order, reconcile asynchronous events, then report only the verified result. Provide status recovery and support escalation. Test delayed, duplicated, reordered, missing, and contradictory webhook/API signals, plus user refresh/repeated click, and verify no unguarded duplicate payment initiation.

**Retry discipline:** Classify actions by idempotency and provider guarantees. Safe reads may retry with bounded exponential backoff and jitter; consequential writes require provider-supported idempotency or reconciliation-aware recovery, and must never assume a timeout means no effect. Store webhook receipts durably, authenticate and deduplicate them, process events idempotently, and run periodic reconciliation for missed events. Escalate unresolved payments, stock/payment mismatches, refunds, and order discrepancies to operator/merchant workflows with clear ownership, alerting, and audit trails. Reconciliation itself is an authorized background system operation, not a visitor purchase action.

**Inventory and payment coordination:** Recover expired reservations, failed payments, payment-success/stock-failure discrepancies, cancellation and refund stock policies, and partial order/fulfillment transitions without fabricating success. Kablet Native must validate the full concurrent-stock-and-payment lifecycle before first paid order; Shopify remains the authoritative provider for connected merchants, and Kablet must respect its documented guarantees and constraints.

**Failure-mode customer experience:** Communicate unresolved states honestly and without promising a resolution time not established. Do not discard carts or hide unresolved transactions. Where permitted, show cached products with freshness safeguards; block actions requiring unavailable authoritative systems. Provide a status-recovery path and escalation. No misleading green checkmark, “payment failed,” or “order confirmed” while status is unknown.

**AI outage isolation:** Ordinary browsing, variant selection, cart, checkout, payment, and order flows must have approved deterministic paths that do not require a live model call. Degrade advanced AI guidance safely when the model is unavailable. This is an architectural reliability target, not a guarantee of zero outages: core commerce still depends on databases, commerce providers, payment networks, and infrastructure.

**Release requirements:** Test network drops after charge submission, duplicate click/retry, delayed/missing webhook, provider outage, last-item concurrency, recovery job restart, stale action, refund uncertainty, and AI-provider outage. Verify operational alerts, durable records, reconciliation correctness, merchant/customer messaging, and auditability. **Recovery is not an optional reliability feature when real payments and inventory are involved.**

## 3.10 Execution Validation & Launch Readiness — LOCKED (Option A)

**Decision: Evidence-Gated Progressive Launch.** No commerce launch is authorized simply because the happy-path demo or feature checklist works. Require documented, reproducible evidence that all applicable critical gates pass before real merchant/customer exposure, with controlled live verification, monitoring, incident response, and progressive traffic expansion. **No launch deadline should override a critical commerce safety failure.**

**Eight release gates:** (1) authoritative merchant catalog/truth, tenant isolation, credentials and permissions; (2) cart and checkout integrity, authoritative price/stock/tax/shipping/totals, and explicit purchase confirmation; (3) verified payment and order states, idempotency and unknown-outcome reconciliation; (4) **Native inventory concurrency**, atomic reservation/commit/release and payment coordination; (5) failure recovery, missing/duplicate webhooks, stale decisions, durable operations and AI outage fallback; (6) merchant operations including fulfillment, refunds, cancellations, notifications and escalation; (7) measurement integrity, privacy/consent, experiment assignment, refund adjustment and visible attribution coverage; (8) security and operations including secrets, least privilege, monitoring, alerting, backups, rollback and incident procedures. Provider-specific capabilities and legal obligations must be verified for the initial market and scope.

**Mandatory pre-launch scenarios:** duplicate Pay clicks; successful $150 shoe payment with lost network response; last-unit simultaneous purchases (Native); price change before checkout; medium-to-large variant change before action execution; delayed/duplicate/missing provider events; AI-model outage while browsing/cart/checkout still function; refund and revenue correction; revoked merchant capability; checkout attribution loss; service restart during reconciliation; inventory reservation expiration and payment failure. Validate durable backend/provider evidence, not just UI screens. Never mark UNKNOWN as failure or success without reconciliation.

**Evidence package per gate:** Record test and scenario, environment, version, provider/account configuration, observed result, persisted/provider evidence, open risks, mitigation and rollback path, and accountable reviewer approval. Automated tests, provider sandbox testing, controlled authorized live transactions, and operational drills are complementary; one does not substitute for all others.

**Launch statuses:** **GO** when all applicable critical gates pass and residual limitations are documented; **LIMITED GO** only for noncritical gaps with explicit scope restrictions, mitigations, monitoring and authorized sign-off; **NO-GO** for any unresolved critical payment, inventory, authorization, tenant-isolation, transaction recovery or other material safety failure, or insufficient evidence of those controls. Critical gates cannot be waived for schedule pressure.

**Independent launch approvals:** Shopify-connected and Kablet Native are separate release tracks sharing intelligence/experience contracts. A passing, properly isolated Shopify headless pilot may launch while Native remains blocked by an inventory or payment gate. Conversely, each path must pass its own applicable provider, operational, and compliance gates. No implication that both must launch simultaneously to fulfill the product vision.

**Progressive rollout:** Development/automated validation → provider sandbox testing → authorized low-volume real-money verification → limited merchant pilot → staged exposure increase. Observe transaction error and reconciliation queues, inventory discrepancies, verified outcomes, attribution quality, and customer support. Maintain approved traffic rollback or safe degradation; preserve outstanding orders and reconciliation even during incident pause.

**Final engineering principle:** **Ship narrowly and prove safety. Never trade payment integrity, customer authorization, or inventory correctness for launch speed.**

