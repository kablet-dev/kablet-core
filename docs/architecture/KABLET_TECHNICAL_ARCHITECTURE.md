# KABLET TECHNICAL ARCHITECTURE v0.1

**Status:** Draft  
**Foundation Dependency:** Kablet Foundation Specification v0.1  
**Foundation Tag:** `foundation-v0.1`

---

# 00. Architecture Goals & Constraints

## 00.1 Purpose

This document translates the Kablet Foundation Specification v0.1 into a concrete, buildable technical architecture.

The Foundation defines what Kablet means.

Technical Architecture defines how those concepts are implemented.

Every major technical decision in this document must preserve the semantics and invariants established by the Foundation.

The architecture should enable Kablet to ship quickly without sacrificing the structural boundaries required for:

- tenant ownership
- canonical Business Truth
- Visitor State
- explicit Decisions
- dynamic Experiences
- controlled Actions
- Event and Outcome lineage
- experimentation
- learning
- provider replaceability
- historical interpretability

The goal is not to design infrastructure for hypothetical massive scale.

The goal is to build the simplest architecture capable of proving Kablet's core economic hypothesis while preserving the boundaries that would be expensive to reconstruct later.

---

## 00.2 Engineering North Star

The first technical architecture must make this complete loop possible:

Visitor Arrives
    ↓
Session Created
    ↓
Signal Received
    ↓
Visitor State Updated
    ↓
Context Assembled
    ↓
Intelligence Invoked
    ↓
Decision Created
    ↓
Experience Planned
    ↓
Experience Validated
    ↓
Experience Rendered
    ↓
Customer Interacts
    ↓
Action Executed
    ↓
Conversion / Outcome Recorded
    ↓
Decision-to-Outcome Lineage Preserved

The first major engineering milestone is therefore:

**One real Visitor can move from intent to conversion while Kablet captures every meaningful State, Decision, Experience, interaction, Action, and Outcome through canonical platform contracts.**

Anything that does not materially help establish, operate, observe, or protect this loop should face a high bar for inclusion in the initial architecture.

---

## 00.3 Primary Architecture Goals

Technical Architecture v0.1 optimizes for:

1. Correct domain boundaries.
2. Fast product iteration.
3. Low operational complexity.
4. Strong tenant isolation.
5. Explicit canonical data ownership.
6. Reliable Decision-to-Outcome lineage.
7. Replaceable external providers.
8. Observable runtime behavior.
9. Controlled experimentation.
10. Safe incremental extension.
11. Reasonable performance.
12. Clear migration paths.

These goals are more important at this stage than designing for theoretical maximum scale.

---

## 00.4 Build Thinly Against Permanent Boundaries

Kablet should implement the smallest useful version of each required capability.

However, thin implementation must not collapse permanent Foundation boundaries.

For example:

Acceptable:

- one primary database
- one application backend
- a small initial Component registry
- a small initial Action registry
- one Intelligence provider
- simple deterministic validation
- simple Visitor State
- simple experiment assignment
- straightforward Event persistence

Not acceptable:

- storing Business Truth only inside prompts
- treating model conversation history as canonical Visitor State
- treating raw model output as canonical Decision state
- allowing AI to generate arbitrary executable frontend code
- using third-party analytics as Kablet's only Event history
- using frontend filtering as tenant authorization
- coupling the runtime directly to one AI provider
- recording conversions without Decision / Experience lineage

The architecture should be simple in implementation while remaining correct in structure.

---

## 00.5 Prefer a Modular System Before a Distributed System

Foundation boundaries are semantic boundaries.

They do not automatically require separate deployable services.

Technical Architecture v0.1 should prefer cohesive modules with explicit contracts before introducing network boundaries between them.

A module may later become a separate service if demonstrated requirements justify that change.

The initial architecture should avoid distributed-system complexity unless a concrete requirement demands it.

This principle does not yet select a specific monolith or service architecture.

That decision is made in Section 01.

---

## 00.6 Canonical State Must Be Kablet-Owned

Strategically important Kablet state must exist in Kablet-controlled canonical representations.

This includes, where applicable:

- Organizations
- Businesses
- Memberships
- Business Truth
- Visitors
- Sessions
- Visitor State
- Decisions
- Experiences
- Events
- Actions
- Outcomes
- Revenue
- Experiments
- Business-specific learned state

External systems may provide:

- authentication
- AI reasoning
- analytics
- payments
- booking
- CRM
- storage
- observability

but those systems must not silently become the only canonical representation of Kablet's core domain.

---

## 00.7 One Canonical Meaning, Multiple Technical Projections

Canonical domain information may have multiple technical representations.

For example:

Canonical Event
    ↓
Operational Database
    ↓
Analytics Projection
    ↓
Experiment Aggregation

or:

Business Truth
    ↓
Canonical Store
    ↓
Search Projection
    ↓
Intelligence Context

Technical projections may optimize:

- search
- analytics
- caching
- rendering
- retrieval
- reporting

They must not silently redefine canonical domain meaning.

---

## 00.8 Tenant Context Must Be Explicit

Tenant-sensitive operations must execute with determinable ownership context.

The architecture must make it possible to identify, where applicable:

- Organization
- Business
- Property / Location
- actor
- Membership
- Visitor
- Session

Tenant context must survive:

- API requests
- background jobs
- Events
- integrations
- Intelligence calls
- Actions
- analytics processing

The system must not depend on uncontrolled implicit global tenant state.

---

## 00.9 Tenant Isolation Must Be Enforced Server-Side

Tenant isolation cannot depend solely on:

- frontend filtering
- hidden UI
- route structure
- model instructions
- client-provided tenant identifiers

The technical architecture must enforce ownership and authorization on trusted server-side boundaries.

Defense in depth may be added at multiple layers.

The exact enforcement mechanisms are decided later in this document.

---

## 00.10 Business Truth Must Remain Separate From Generated Experience

The architecture must preserve:

Business Truth
    ↓
Intelligence
    ↓
Decision
    ↓
Experience

rather than:

Generated Experience
    =
Business Truth

Customer-facing generated content may reference, summarize, organize, or present canonical Truth.

It must not silently mutate the authoritative Business representation.

---

## 00.11 Visitor State Must Be Kablet State

Visitor State must exist independently from any individual AI provider's conversation or memory system.

An Intelligence provider may receive selected Visitor State.

It does not own that State.

Conceptually:

Signals
    ↓
Kablet Visitor State
    ↓
Context Assembly
    ↓
Intelligence Provider

not:

Signals
    ↓
Provider Conversation History
    ↓
Kablet assumes that is Visitor State

This allows Kablet to:

- change providers
- reconstruct Decisions
- control retention
- inspect State
- validate State updates
- learn from State transitions

---

## 00.12 Decisions Must Be First-Class Technical Objects

Meaningful Intelligence choices must become canonical Decision records.

A Decision must not exist only as:

- a model response
- a log line
- frontend state
- analytics metadata

The architecture must support explicit Decision persistence and lineage.

A Decision should eventually be connectable to:

- Business
- Visitor
- Session
- relevant State
- applicable Business Truth
- Intelligence configuration
- Experiment context
- Experience
- Actions
- Events
- Outcomes

This is one of Kablet's most important technical requirements.

---

## 00.13 Experience Must Be Declarative

Intelligence should describe what customer Experience should be produced through a controlled contract.

It should not directly generate arbitrary executable application code.

The intended boundary is:

Intelligence
    ↓
Structured Decision
    ↓
Experience Plan
    ↓
Validation
    ↓
Controlled Renderer

The runtime owns execution and rendering.

Intelligence owns reasoning and proposal.

---

## 00.14 Components Must Be Controlled Capabilities

Customer-facing Components should come from a known capability set.

Intelligence may select and configure supported Components.

It must not create arbitrary runtime capabilities outside the contract.

The architecture must support:

- Component identity
- Component type
- version
- payload validation
- Business Truth references
- presentation variants
- supported Actions
- exposure measurement

The first implementation may support only a small Component set.

---

## 00.15 Actions Must Be Controlled Capabilities

Consequential operations must execute through explicit Action boundaries.

Examples may include:

- booking
- lead submission
- contact
- checkout
- purchase
- quote request

The architecture must distinguish:

Action Proposed

from:

Action Authorized

from:

Action Started

from:

Action Completed

from:

Outcome Verified

Intelligence must not directly perform arbitrary consequential operations outside the Action layer.

---

## 00.16 Intelligence Proposes; Kablet Validates

This Foundation rule becomes a technical architecture constraint.

Every Intelligence output capable of influencing runtime behavior must pass through Kablet-controlled validation appropriate to that output.

Validation may include:

- schema validation
- ownership validation
- Business Truth reference validation
- Component validation
- Action validation
- Business Rule validation
- authorization validation
- policy validation

A valid model response is not automatically a valid Kablet operation.

---

## 00.17 Intelligence Providers Must Be Replaceable

The Kablet runtime must not depend directly on one provider's proprietary representation of:

- conversation
- tools
- memory
- structured output
- model identity

Provider-specific behavior should sit behind Kablet-owned interfaces.

The architecture should permit:

Provider A
    ↓
Kablet Intelligence Interface

to later become:

Provider B
    ↓
Kablet Intelligence Interface

without redefining canonical:

- Visitor State
- Decision
- Experience
- Event
- Outcome

Provider replacement may require implementation work.

It must not require redefining the Kablet domain.

---

## 00.18 Context Assembly Must Be Explicit

Intelligence should not receive unrestricted database access.

Kablet must assemble the context appropriate for each Intelligence operation.

Context Assembly should consider:

- ownership
- authorization
- Business
- Business Truth
- Visitor State
- current Experience
- relevant history
- available Components
- available Actions
- Business Rules
- Experiment context
- prior learning
- current objective

The initial implementation may be simple.

The boundary must nevertheless exist from the beginning.

---

## 00.19 Events Must Be Canonical Domain Records

Kablet requires its own Event and Outcome Spine.

Third-party analytics may receive projections of those Events.

They must not become the sole canonical source of strategically important customer behavior.

The architecture must support semantic Events such as:

- Session activity
- Signals
- State changes
- Decisions
- Experience lifecycle
- Component exposure
- interactions
- Actions
- Conversions
- Outcomes
- Revenue
- Experiments

Exact schemas are defined later.

---

## 00.20 Outcome Lineage Is More Important Than Raw Event Volume

Kablet's strategic dataset is not merely:

"lots of analytics Events."

The valuable relationship is:

Context
    ↓
State
    ↓
Decision
    ↓
Experience
    ↓
Exposure
    ↓
Interaction
    ↓
Action
    ↓
Outcome

The technical architecture must prioritize preserving this lineage over collecting indiscriminate telemetry.

---

## 00.21 Historical Meaning Must Survive Change

The implementation must support the Foundation Versioning Rules.

Historical Decisions and Outcomes must remain interpretable against the relevant historical:

- Business Truth
- Visitor State
- Experience Contract
- Component versions
- Action versions
- Intelligence configuration
- Experiment context
- policies

The architecture does not necessarily need full snapshots of everything.

It must preserve enough version/revision context to prevent historical meaning from being silently rewritten.

---

## 00.22 Events Should Be Append-Oriented

Historical domain Events represent things that occurred.

The architecture should generally prefer preserving those occurrences rather than mutating history in place.

Corrections should be represented explicitly where appropriate.

This principle does not require full event sourcing.

Canonical current state may still use ordinary mutable persistence where appropriate.

---

## 00.23 Unknown Is Better Than Fabricated History

If historical data was not captured, the system should represent that absence honestly.

For example:

- unknown exposure
- unknown confidence
- unavailable historical metadata

must be preferable to inventing values during migration or reconstruction.

---

## 00.24 External Systems Enter Through Controlled Boundaries

Integrations should communicate with Kablet through explicit adapters or interfaces.

Provider-specific concepts should not spread unnecessarily through Kablet Core.

Conceptually:

External Provider
    ↓
Adapter
    ↓
Kablet Contract
    ↓
Canonical Domain

This applies to:

- AI
- booking
- commerce
- payments
- CRM
- messaging
- analytics
- storage

---

## 00.25 External Input Is Untrusted

Information arriving from:

- browsers
- mobile clients
- public APIs
- webhooks
- integrations
- AI providers

must be treated as untrusted until validated appropriately.

The architecture must not infer authority merely because a payload contains a valid-looking identifier.

---

## 00.26 Background Work Must Preserve Domain Context

Asynchronous execution must preserve enough context to safely perform work.

Where relevant, jobs should be attributable to:

- Organization
- Business
- resource
- operation
- initiating actor or system
- authority context
- correlation / lineage context

The exact job infrastructure is selected later.

---

## 00.27 Observability Is Required From the Beginning

Kablet's first runtime must be diagnosable.

The architecture must eventually make it possible to inspect:

- request failures
- Intelligence failures
- validation failures
- Action failures
- integration failures
- Event recording failures
- latency
- Decision lineage
- Experience lineage
- Outcome lineage

Observability is not the same as the canonical Event Spine.

Operational telemetry and business-domain Events must remain conceptually distinct.

---

## 00.28 Experimentation Must Be Architecturally Possible

The initial runtime must not be designed in a way that makes controlled experimentation difficult to add.

The architecture should support future relationships such as:

Experiment
    ↓
Assignment
    ↓
Decision
    ↓
Experience
    ↓
Exposure
    ↓
Outcome

The first implementation does not require sophisticated experimentation mathematics.

It requires correct experimental lineage.

---

## 00.29 Learning Must Be Possible Without Being Required on Day One

The architecture must preserve the data needed for future learning.

It does not need proprietary machine learning in the first release.

Initially:

Events
+
Decisions
+
Experiences
+
Outcomes
+
Experiments

may provide enough evidence for:

- manual analysis
- deterministic policies
- simple optimization
- basic learned strategies

More sophisticated learning can be introduced later behind existing boundaries.

---

## 00.30 Business-Specific Learning Comes Before Network Complexity

The initial architecture should prioritize learning within one Business.

Conceptually:

Business A
    ↓
Decisions
    ↓
Outcomes
    ↓
Business A Strategy Improvement

Vertical and network-level learning remain future-compatible capabilities.

The MVP does not need to implement cross-tenant learning infrastructure.

---

## 00.31 Privacy Must Be Preserved Through Architecture

Privacy must not depend solely on policy documents.

Technical Architecture must support:

- tenant isolation
- purpose-bound context
- minimized model context
- controlled integration access
- data retention
- eventual deletion
- auditability
- restricted privileged access

Exact legal and retention policies are outside this document unless required for implementation.

---

## 00.32 Secrets Must Remain Outside Domain Context

Credentials and privileged infrastructure secrets must not become ordinary:

- Business Truth
- Visitor State
- Event payload
- Intelligence context

Capabilities should use secrets internally through controlled infrastructure.

Intelligence should normally receive the capability rather than the credential.

---

## 00.33 Security Must Exist on Trusted Boundaries

Security-sensitive validation must occur on trusted server-side infrastructure.

The architecture must not depend on:

- frontend validation
- obscured identifiers
- model obedience
- client-side state

for security guarantees.

---

## 00.34 Prefer Boring Infrastructure Where It Is Sufficient

Kablet's competitive advantage should come from:

- Decision quality
- customer Experience
- Outcome measurement
- experimentation
- accumulated learning

not unnecessary infrastructure novelty.

Where mature conventional technology satisfies Foundation requirements, it should be preferred over infrastructure complexity that does not improve the product hypothesis.

---

## 00.35 Avoid Premature Microservices

Technical Architecture v0.1 should not introduce separate services merely because Kablet has distinct conceptual modules.

Separate deployment boundaries create costs in:

- transactions
- consistency
- debugging
- local development
- deployment
- observability
- testing
- latency
- operational complexity

Service extraction should follow demonstrated technical or organizational need.

---

## 00.36 Avoid Premature Event Infrastructure

Kablet requires canonical Events.

That does not automatically mean Kablet requires:

- Kafka
- distributed streaming
- complex event buses

in the first implementation.

The Event model and Event infrastructure are separate decisions.

The initial implementation should choose the simplest reliable transport and persistence capable of satisfying current requirements.

---

## 00.37 Avoid Premature Machine-Learning Infrastructure

Kablet's long-term moat may include proprietary learning.

That does not justify building:

- training clusters
- feature stores
- complex ML pipelines
- online model serving infrastructure

before sufficient Decision / Outcome data exists.

The architecture should collect the right evidence first.

---

## 00.38 Avoid Premature Global Scale Architecture

The initial architecture does not need to solve:

- millions of Businesses
- billions of daily Events
- global active-active databases
- massive distributed inference

before Kablet has validated repeatable conversion lift.

However, obvious architectural dead ends should still be avoided.

---

## 00.39 Provider Lock-In Must Be Deliberate

Using managed providers is acceptable and often desirable.

Kablet should not rebuild commodity infrastructure merely to avoid all dependency.

However, provider lock-in affecting strategic Kablet concepts should be recognized explicitly.

The architecture should distinguish:

Acceptable operational dependency

from:

Strategic domain dependency.

For example:

using a managed database provider

is different from:

allowing an AI vendor's conversation object to become Kablet's canonical Visitor model.

---

## 00.40 Reliability Must Follow Business Criticality

Not every Kablet operation requires identical reliability guarantees.

For example:

A transient analytics projection failure

may be recoverable asynchronously.

A completed customer purchase being lost

is substantially more serious.

Technical Architecture should apply stronger durability and recovery mechanisms to more consequential domain operations.

---

## 00.41 Idempotency Must Exist Where Duplicate Execution Is Dangerous

External systems and distributed operations may retry.

For consequential operations such as:

- booking
- payment
- lead creation
- conversion recording
- webhook processing

the architecture must eventually provide appropriate duplicate-execution protection.

Exact idempotency mechanisms are decided in later sections.

---

## 00.42 Failure Must Degrade Predictably

Failure in one capability should not unnecessarily destroy the entire customer Experience.

Examples:

If Intelligence fails:
→ use controlled fallback where possible.

If optional recommendation fails:
→ core interaction may continue.

If analytics projection fails:
→ canonical Outcome should not disappear.

If one integration fails:
→ unrelated Business Truth should remain intact.

Fallback behavior must be explicit for critical runtime paths.

---

## 00.43 Development Experience Matters

Kablet will initially evolve rapidly.

The architecture should make it straightforward to:

- run locally
- understand module boundaries
- test changes
- inspect data
- reproduce failures
- add Components
- add Actions
- modify Intelligence policies
- run migrations
- deploy safely

Architecture that is theoretically elegant but slows every product experiment is undesirable at this stage.

---

## 00.44 Codex Must Work Against Explicit Contracts

Kablet will be implemented substantially with coding assistance.

The repository and architecture should therefore make boundaries highly explicit.

Codex should receive narrow implementation slices containing:

- scope
- relevant Foundation requirements
- contracts
- schemas
- invariants
- tests
- acceptance criteria

Codex should not be instructed to:

"Build Kablet."

The implementation process should progressively construct Kablet through controlled, testable slices.

---

## 00.45 Every Slice Must Leave the Repository Healthy

Implementation slices should preserve:

- successful build
- successful required tests
- valid migrations
- clean type checking
- linting where configured
- no known broken contracts

Large speculative branches of incomplete architecture should be avoided.

---

## 00.46 Architecture Decisions Must Be Explicit

Major technical choices should record:

- problem
- constraints
- selected approach
- rejected alternatives where material
- consequences
- migration considerations

Not every library requires an Architecture Decision Record.

Strategically important or expensive-to-reverse choices should be documented.

---

## 00.47 Reversibility Matters

Where two technical approaches are otherwise reasonable, preference should generally be given to the option that:

- preserves Foundation semantics
- reduces operational burden
- remains replaceable
- avoids unnecessary irreversible coupling

This is particularly important before product-market fit.

---

## 00.48 Architecture Must Serve the Economic Test

Kablet's architecture ultimately exists to test whether an intelligent adaptive frontend can generate measurable incremental business outcomes.

The system must therefore make it possible to answer:

- What did Kablet understand?
- What did Kablet decide?
- What did the Visitor actually see?
- What did the Visitor do?
- What Outcome occurred?
- What would have happened under the control?
- Did Kablet create measurable lift?

Infrastructure that does not help Kablet reliably answer those questions should not dominate early engineering effort.

---

# 00.A Non-Negotiable Technical Invariants

Technical Architecture v0.1 must preserve the following:

1. Organization remains the tenant ownership boundary.
2. Business remains the primary commercial runtime context.
3. Tenant-sensitive access is enforced on trusted server-side boundaries.
4. Business Truth has a canonical Kablet representation.
5. Business Truth remains separate from generated Experience.
6. Visitor State is Kablet-owned state.
7. Provider conversation history is not canonical Visitor State.
8. Meaningful Decisions are first-class canonical records.
9. Decisions remain attributable to relevant State and context.
10. Experience is produced through controlled declarative contracts.
11. Intelligence cannot directly create arbitrary executable frontend behavior.
12. Components are controlled, versionable capabilities.
13. Actions are controlled, authorized capabilities.
14. Intelligence proposes; Kablet validates.
15. Reasoning authority and execution authority remain separate.
16. AI providers remain replaceable behind Kablet interfaces.
17. Context Assembly is explicit and tenant-aware.
18. Kablet owns canonical Event and Outcome semantics.
19. Decision → Experience → Exposure → Outcome lineage is preserved.
20. Historical meaning survives current-state changes.
21. External providers enter through controlled boundaries.
22. Client and external input is untrusted.
23. Background work preserves ownership context.
24. Operational observability and canonical business Events remain distinct.
25. Experiment assignment, exposure, and Outcome can be connected.
26. Future learning can consume canonical Decision / Outcome history.
27. Cross-tenant learning is not required for MVP.
28. Privacy and tenant isolation are architectural constraints.
29. Secrets remain outside ordinary domain and Intelligence context.
30. Infrastructure complexity must be justified by demonstrated need.
31. Canonical Events do not imply distributed event infrastructure.
32. Future ML does not justify premature ML infrastructure.
33. Managed infrastructure is acceptable when strategic Kablet semantics remain controlled.
34. Consequential operations receive stronger reliability guarantees.
35. Duplicate-sensitive operations support idempotent execution where required.
36. Critical failures have explicit fallback or recovery behavior.
37. Development and testing remain straightforward.
38. Implementation proceeds through narrow, verifiable slices.
39. Major expensive-to-reverse decisions are documented.
40. Architecture remains focused on proving measurable conversion lift.

---

# 00.B Initial Architecture Biases

Before evaluating concrete technologies, Technical Architecture v0.1 begins with the following biases:

### Prefer

- one coherent application architecture
- one primary transactional source of truth
- explicit modules
- typed contracts
- deterministic validation
- managed infrastructure
- server-enforced tenancy
- append-oriented domain Events
- provider adapters
- straightforward local development
- automated tests around Foundation invariants
- incremental deployment
- explicit observability

### Avoid Initially

- microservice proliferation
- Kubernetes
- distributed transactions
- Kafka-class infrastructure without demonstrated need
- agent swarms
- arbitrary AI-generated executable UI
- AI-controlled database access
- complex proprietary ML
- unnecessary vector infrastructure
- multiple databases without a concrete requirement
- infrastructure designed for hypothetical extreme scale

These are biases, not final technology selections.

A later section may override one when supported by a concrete requirement.

---

# 00.C Technical Architecture Decision Test

For every major technology or architecture choice, Kablet should ask:

### Foundation Compatibility

Does it preserve Kablet's domain semantics and invariants?

### Correctness

Can it reliably represent and enforce the required behavior?

### Simplicity

Is it the simplest solution that satisfies current requirements?

### Operability

Can a small team run, debug, and recover it?

### Development Speed

Does it allow Kablet to iterate rapidly?

### Observability

Can failures and Decision / Outcome lineage be inspected?

### Security

Can ownership, authorization, and tenant isolation be enforced correctly?

### Replaceability

Does it create acceptable or dangerous lock-in?

### Evolution

Can the architecture grow without rewriting foundational concepts?

### Economic Relevance

Does the choice help Kablet reach and measure its first real conversion-lift experiment?

---

# 00.D Architecture Priority Order

When trade-offs conflict, Technical Architecture v0.1 should generally prioritize:

1. Domain correctness
2. Tenant safety
3. Data integrity
4. Decision / Outcome lineage
5. Product iteration speed
6. Operational simplicity
7. Observability
8. Performance
9. Scale optimization

This ordering is appropriate for Kablet's current stage.

It may change as the platform matures.

---

# 00.E Definition of Technical Architecture v0.1 Success

Technical Architecture v0.1 is successful when it produces a concrete architecture from which Kablet can be implemented without leaving major foundational questions to individual coding tasks.

It should identify:

- application architecture
- technology stack
- persistence architecture
- tenancy enforcement
- authentication
- authorization
- Intelligence architecture
- Experience runtime
- Action execution model
- Event / Outcome architecture
- integration boundaries
- asynchronous execution
- caching
- storage
- analytics
- observability
- security
- custom domains
- environments
- testing
- deployment
- scaling path
- MVP technical boundary

After this document is complete, Repository Architecture can map these decisions into actual:

- applications
- packages
- modules
- directories
- dependencies
- commands
- configuration

Then the Codex Build Plan can convert that repository architecture into controlled implementation slices.

---

# 00.F Dependency

Foundation Specification v0.1 defines:

**What Kablet is.**

Section 00 defines:

**What the implementation must optimize for and what it is forbidden from accidentally collapsing.**

The next section makes the first major implementation decision:

# 01 — System Architecture

It will determine:

- the initial deployment shape
- modular monolith vs distributed services
- Control Plane vs customer-facing Runtime
- module boundaries
- synchronous vs asynchronous responsibilities
- which boundaries are logical today
- which may become physical services later