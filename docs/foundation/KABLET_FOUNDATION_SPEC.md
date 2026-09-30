# Kablet Foundation Specification

**Version:** 0.1  
**Status:** Draft  
**Product:** Kablet  
**Category:** The AI Frontend for Business  

## Purpose

This document defines the permanent conceptual foundations upon which Kablet is built.

It defines what Kablet is, what its core systems are responsible for, how those systems relate to one another, and the invariants future implementations must preserve.

Technology choices, frameworks, infrastructure providers, database implementations, AI providers, and deployment architecture are intentionally excluded unless required to define a foundational contract.

The purpose of this specification is to define **what Kablet must be before deciding how Kablet will be implemented**.

---

# 00. Foundation Principles

## 00.1 Kablet Is an Intelligent Frontend, Not a Website Builder

Kablet is the AI frontend for business.

Its purpose is not to help businesses manually construct pages, layouts, funnels, or navigation structures.

A traditional website presents a predetermined interface and asks the visitor to navigate it.

Kablet instead understands the visitor's intent and context, then dynamically assembles and adapts the customer-facing experience around what that visitor is trying to accomplish.

The fundamental model is:

Business Truth + Visitor State + Intelligence → Experience → Action → Outcome

Kablet may initially replace or augment websites, but its foundations must not assume that a traditional website is the only customer-facing surface it will ever power.

Future surfaces may include commerce, booking, B2B experiences, voice interactions, AI-agent interactions, and other forms of business-customer interaction.

Therefore, Kablet's foundational abstraction is the **intelligent business frontend**, not the webpage.

---

## 00.2 The Business Controls What Is True; Kablet Controls How It Is Presented

The business is the authority over its own truth.

Business Truth includes information such as:

- identity
- brand
- products
- services
- pricing
- offers
- people
- locations
- policies
- proof
- availability
- business rules
- permitted actions
- conversion objectives

Kablet must never silently redefine business truth in order to improve an experience.

Kablet is responsible for deciding how verified business truth is selected, composed, sequenced, explained, and presented to a visitor.

This creates a permanent separation:

**Business controls WHAT is true.**

**Kablet controls HOW the experience is assembled around that truth.**

Generated experience must never become the canonical source of business truth.

---

## 00.3 There Is No Predetermined Customer Journey

Kablet must not assume that every visitor should follow the same sequence.

Traditional systems commonly encode journeys such as:

Home → Service → Pricing → FAQ → Booking

Kablet instead treats the customer journey as dynamic.

Different visitors may require different sequences based on intent, context, needs, constraints, concerns, behavior, journey state, and prior interaction.

For example:

Visitor A:

Intent → Proof → Pricing → Booking

Visitor B:

Intent → Pricing → Objection Resolution → Proof → Booking

Visitor C:

Intent → Comparison → Recommendation → Booking

The permanent rule is therefore not "no pages" or "no scrolling."

The permanent rule is:

**No predetermined journey.**

Pages, scrolling, navigation, conversation, cards, modals, or other interaction patterns may exist when they are useful.

They are implementation and experience decisions, not foundational constraints.

---

## 00.4 Business Truth and Generated Experience Are Separate Systems

Kablet must maintain a strict conceptual boundary between:

1. what the business knows and authorizes; and
2. what Kablet generates or presents to a visitor.

Business Truth is canonical.

Generated Experience is contextual and temporary.

An experience may reference, select, transform, summarize, sequence, or visually compose Business Truth, but it must not overwrite the underlying truth simply because something was generated for a visitor.

This separation allows Kablet to change its intelligence, rendering systems, AI providers, or experience strategies without corrupting the business's canonical information.

---

## 00.5 Intelligence Does Not Directly Control Arbitrary Interface Code

Kablet intelligence must not require an AI model to generate arbitrary production frontend code in order to control the experience.

Instead, intelligence communicates through a defined **Experience Contract**.

The Experience Contract defines what Kablet is allowed to present and do.

Conceptually:

Intelligence
    ↓
Decision
    ↓
Experience Plan
    ↓
Validated Components / Actions
    ↓
Runtime

The intelligence layer may decide:

- what information should appear
- which component should appear
- which business truth should populate it
- how components should be sequenced
- which actions should be offered
- what should happen next

The runtime is responsible for safely and consistently rendering those decisions.

This keeps Kablet adaptive without making the customer-facing system uncontrolled.

---

## 00.6 AI Is a Capability Inside Kablet, Not Kablet's Source of Truth

Kablet may use large language models, classifiers, predictive systems, rules, retrieval systems, optimization algorithms, proprietary models, or future forms of machine intelligence.

No external AI model is itself "the Kablet Brain."

AI providers are replaceable capabilities.

Kablet owns:

- business state
- visitor state
- experience state
- decision history
- event history
- experiment history
- outcomes
- learned strategies
- optimization knowledge

The runtime and canonical data model must not become structurally dependent on one AI provider, one model family, or one prompting methodology.

Kablet must be capable of changing its intelligence implementation without rebuilding its foundational product model.

---

## 00.7 Every Meaningful Experience Change Must Be Represented by a Decision

When Kablet meaningfully changes what a visitor experiences, the system must be capable of representing that change as a **Decision**.

A Decision connects:

State Before
    ↓
Knowledge Available
    ↓
Decision
    ↓
Experience Produced
    ↓
Visitor Behavior
    ↓
Outcome

A Decision should make it possible to answer:

- What did Kablet decide?
- When did it decide it?
- What information was available?
- What visitor state existed?
- What business truth was relevant?
- What experience resulted?
- What happened afterward?

This decision lineage is foundational to explainability, debugging, experimentation, optimization, and future learning.

---

## 00.8 Every Meaningful Decision Must Be Traceable to Its Outcome

Kablet must preserve the relationship between what it decided and what happened afterward.

It is insufficient to record only:

"Visitor booked."

Kablet must eventually be capable of reconstructing:

Context
    ↓
Visitor State
    ↓
Decision
    ↓
Experience
    ↓
Interaction
    ↓
Action
    ↓
Conversion
    ↓
Revenue / Outcome

This relationship forms the foundation of Kablet's long-term data advantage.

The system should be designed from the beginning so that future learning systems can ask:

**Under these conditions, which decisions and experiences produced which outcomes?**

---

## 00.9 Outcomes Matter More Than Engagement

Kablet is not primarily optimizing for clicks, messages, session duration, component interaction, or other engagement metrics.

Those signals may be useful inputs.

The primary optimization target is the business-defined outcome.

Examples include:

- purchase
- booking
- qualified lead
- quote request
- signup
- completed application
- revenue
- another explicitly defined business objective

Kablet's intelligence must ultimately learn from outcomes rather than assuming that increased interaction means increased value.

The long-term optimization objective is increased business value per relevant visitor, subject to business rules and constraints.

---

## 00.10 Learning Must Distinguish Correlation From Causal Evidence

Observed behavior does not automatically prove that a Kablet decision caused an outcome.

For example:

Visitors who view testimonials may convert more frequently.

That does not necessarily mean showing testimonials caused the increase.

Kablet must preserve a distinction between:

- observation
- hypothesis
- experiment
- evidence
- learned strategy

Where possible, controlled experimentation should be used to determine whether an experience change actually improves the desired outcome.

The Learning Brain must not treat every observed correlation as established optimization knowledge.

---

## 00.11 Kablet Must Learn at Multiple Levels Without Collapsing Their Boundaries

Kablet's long-term intelligence may operate at several levels.

### Business-Level Intelligence

Knowledge specific to one business.

Example:

A particular clinic's visitors respond better to practitioner proof before pricing.

### Vertical-Level Intelligence

Generalized knowledge derived across similar businesses, where permitted and appropriately governed.

Example:

High-trust aesthetic procedures frequently benefit from proof before a booking request.

### Network-Level Intelligence

Abstract patterns that may generalize across business categories.

Example:

High uncertainty may increase the value of proof before a conversion request.

These levels must remain conceptually distinct.

Business-specific information must not automatically become shared knowledge.

Any future aggregation or generalized learning must respect privacy, permissions, contractual requirements, data governance, and tenant boundaries.

---

## 00.12 Kablet Owns Its Decision and Outcome Data Model

Third-party analytics, AI, experimentation, observability, or data platforms may assist Kablet.

They must not become the sole canonical owner of Kablet's strategic data.

Kablet must retain its own durable representation of the information required to understand:

- visitors
- sessions
- context
- intent
- state
- decisions
- experiences
- interactions
- actions
- experiments
- conversions
- outcomes
- revenue
- learnings

External tools may receive copies or projections of this information.

They must not become the only place where Kablet's decision/outcome history exists.

---

## 00.13 Tenant Ownership and Isolation Are Foundational

Kablet is a multi-business platform.

Every tenant-owned object must have clear ownership.

Business data, customer data, configuration, private knowledge, and operational state must not become ambiguously shared across tenants.

Future shared intelligence must be deliberately derived through explicitly designed learning and governance mechanisms.

It must not result from accidental cross-tenant access.

Tenant isolation is therefore a foundational property, not a feature to add later.

---

## 00.14 Actions Must Be Authorized and Constrained

Kablet may eventually perform consequential actions such as:

- creating bookings
- submitting leads
- modifying carts
- initiating checkout
- processing transactions
- creating CRM records
- requesting quotes
- communicating with external systems
- invoking business APIs

Intelligence may decide that an action is appropriate.

That does not mean intelligence automatically has unrestricted authority to execute it.

Actions must operate through defined capabilities with explicit validation, authorization, business rules, and observable outcomes.

Conceptually:

Intelligence proposes
    ↓
Kablet validates
    ↓
Authorized capability executes
    ↓
Outcome is recorded

This boundary protects businesses, customers, and the integrity of Kablet's runtime.

---

## 00.15 Generated Output Must Be Validated Before It Becomes Runtime Behavior

AI output is not inherently trusted.

Any intelligence-generated decision that affects the customer experience or invokes an action must conform to Kablet's contracts and constraints before execution.

The foundational principle is:

**Intelligence proposes.  
Contracts constrain.  
Kablet validates.**

Invalid, unsupported, unauthorized, or unsafe outputs must fail predictably rather than becoming uncontrolled runtime behavior.

---

## 00.16 The Runtime Must Degrade Gracefully

Kablet cannot assume that intelligence services, external APIs, integrations, or network dependencies will always succeed.

The customer-facing runtime must have defined fallback behavior.

A temporary AI failure must not necessarily make the business disappear.

A failed recommendation must not corrupt session state.

A failed integration must not be represented as a successful action.

Failures must be observable and recoverable where appropriate.

Reliability of the customer-facing experience is a foundational concern because Kablet may become the primary frontend of a business.

---

## 00.17 Foundational Contracts Must Be Versioned

Kablet will evolve.

Business Truth, Experience Contracts, Decisions, Events, Actions, and Intelligence interfaces will gain new capabilities over time.

Foundational contracts must therefore support explicit evolution.

Changes must not silently alter the meaning of historical data.

Historical decisions and events must remain interpretable according to the contract versions under which they were created.

Kablet should prefer additive, backward-compatible evolution where practical.

Breaking changes must be deliberate and migratable.

---

## 00.18 New Verticals Extend the Foundation; They Do Not Redefine It

Kablet may begin with one narrow vertical.

Its permanent foundations must not assume that every business is:

- a clinic
- an ecommerce store
- a law firm
- a SaaS company
- a booking business
- a lead-generation business

Vertical-specific concepts should extend generic Kablet primitives rather than redefine the core platform.

For example:

Aesthetic treatment may be represented as a type of service.

A legal consultation may also be represented as a type of service.

A physical item may be represented as a product.

A consultation booking and a product purchase may both ultimately produce business-defined outcomes.

The foundation should be general enough to support new verticals while allowing vertical-specific intelligence and experiences to become highly specialized.

---

## 00.19 Build Thinly, Preserve the Permanent Boundaries

Kablet does not need to implement the full long-term platform immediately.

Early implementations may support:

- one business type
- one conversion objective
- a small component library
- limited visitor state
- a simple decision engine
- one integration
- basic experimentation
- limited learning

However, early simplification must not destroy the permanent conceptual boundaries defined in this specification.

The implementation may be small.

The abstraction must remain correct.

---

## 00.20 The Foundation Must Remain Technology-Agnostic

The Kablet product model must not be defined by its current technology stack.

Frameworks, databases, cloud providers, AI models, analytics vendors, and infrastructure systems will change.

The concepts defined here should survive those changes.

Kablet should therefore distinguish:

**Product contracts** — what Kablet means.

from

**Technical implementations** — how those contracts are currently executed.

Technical architecture must implement the foundation.

The foundation must not merely describe the current technical architecture.

---

# 00.A Core Foundation Invariants

The following invariants summarize Section 00 and apply across the platform:

1. Business Truth is canonical.
2. Generated Experience is not Business Truth.
3. The business controls what is true; Kablet controls how it is presented.
4. Customer journeys are dynamic rather than predetermined.
5. Intelligence controls the frontend through explicit contracts.
6. AI providers are replaceable capabilities.
7. Every meaningful experience change is representable as a Decision.
8. Decisions are traceable to resulting interactions and outcomes.
9. Outcomes take precedence over engagement as optimization targets.
10. Observation is not automatically causal learning.
11. Business, vertical, and network intelligence remain distinct.
12. Kablet retains canonical decision and outcome data.
13. Tenant ownership and isolation are explicit.
14. Consequential actions are authorized, constrained, and observable.
15. Intelligence output is validated before execution.
16. Runtime failures degrade predictably.
17. Foundational contracts are versioned.
18. Vertical-specific capabilities extend rather than redefine the core.
19. Early implementations may be thin without violating permanent boundaries.
20. The foundation remains independent of specific technologies.

---

# 00.B Foundational System Loop

At the highest level, Kablet operates as the following closed loop:

Business Truth
      +
Visitor Context
      +
Visitor State
      +
Prior Learning
      ↓
Intelligence
      ↓
Decision
      ↓
Validated Experience Plan
      ↓
Intelligent Frontend
      ↓
Visitor Interaction
      ↓
Action
      ↓
Business Outcome
      ↓
Measurement
      ↓
Experimentation
      ↓
Learning
      ↓
Future Decisions Improve

The long-term value of Kablet comes not from any individual step in this loop, but from owning and improving the entire loop.

---

# 00.C Foundation Boundary

Section 00 intentionally does not define:

- database technology
- database schemas
- programming languages
- frontend frameworks
- backend frameworks
- AI providers or models
- hosting providers
- cloud architecture
- caching technology
- queue technology
- analytics vendors
- authentication providers
- payment providers
- detailed component schemas
- detailed event schemas
- experiment statistics
- machine-learning architecture

Those decisions belong to later foundation sections or the separate Kablet Technical Architecture Specification.

The next section defines the first concrete Kablet foundation:

**01 — Identity & Ownership.**