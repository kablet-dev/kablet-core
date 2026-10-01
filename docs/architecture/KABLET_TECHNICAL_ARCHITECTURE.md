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

---

# 01. System Architecture

## 01.1 Purpose

This section defines Kablet's initial application architecture and the major runtime boundaries through which the Foundation Specification will be implemented.

The architecture must support rapid development while preserving clear boundaries between:

- Business administration
- canonical domain state
- customer-facing runtime
- Intelligence
- Experience generation
- Actions
- Events and Outcomes
- integrations
- asynchronous processing

Kablet v0.1 will begin as a:

**Modular Monolith with explicit internal domain boundaries.**

The architecture will also distinguish between two major operational planes:

1. Control Plane
2. Customer Runtime Plane

These are logical boundaries in v0.1.

They are not required to be separate distributed systems initially.

---

## 01.2 Architecture Decision

Kablet v0.1 will use a modular monolith as its primary application architecture.

Conceptually:

                    KABLET APPLICATION

┌───────────────────────────────────────────────────────┐
│                                                       │
│                     CONTROL PLANE                     │
│                                                       │
│  Organization                                         │
│  Business                                             │
│  Membership                                           │
│  Business Truth                                       │
│  Configuration                                        │
│  Integrations                                         │
│  Experiments                                          │
│  Reporting                                            │
│                                                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│                  CUSTOMER RUNTIME                     │
│                                                       │
│  Visitor                                              │
│  Session                                              │
│  Signals                                              │
│  Visitor State                                        │
│  Context Assembly                                     │
│  Intelligence                                         │
│  Decision                                             │
│  Experience                                           │
│  Components                                           │
│  Actions                                              │
│                                                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│                 SHARED DOMAIN CORE                    │
│                                                       │
│  Ownership                                            │
│  Contracts                                            │
│  Events                                               │
│  Outcomes                                             │
│  Authorization                                        │
│  Validation                                           │
│  Versioning                                           │
│                                                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│               INFRASTRUCTURE ADAPTERS                 │
│                                                       │
│  Database                                             │
│  AI Providers                                         │
│  Auth                                                 │
│  Booking                                              │
│  Commerce                                             │
│  Messaging                                            │
│  Storage                                              │
│  Analytics                                            │
│  Observability                                        │
│                                                       │
└───────────────────────────────────────────────────────┘

These boundaries are explicit in code even if they initially execute within the same deployable application.

---

## 01.3 Why a Modular Monolith

Kablet currently requires strong consistency and rapid iteration more than independent service scaling.

Many of Kablet's most important operations cross multiple domain concepts.

For example:

Signal Received
    ↓
Visitor State Updated
    ↓
Decision Created
    ↓
Experience Created
    ↓
Events Recorded

Introducing network boundaries between these operations too early would add:

- distributed transactions
- network failure modes
- serialization boundaries
- additional deployment systems
- more complex testing
- more difficult local development
- harder debugging
- eventual consistency concerns

without currently providing proportional product value.

A modular monolith allows Kablet to preserve domain boundaries while avoiding unnecessary distributed-system complexity.

---

## 01.4 Modular Monolith Does Not Mean Unstructured Monolith

Kablet must not become one application in which any code can directly manipulate any other domain state.

The monolith must preserve explicit modules.

A module should expose controlled interfaces to other modules.

Conceptually:

Module A
    ↓
Public Contract
    ↓
Module B

rather than:

Module A
    ↓
Module B internal tables / implementation details

Logical boundaries are required even when process boundaries are not.

---

## 01.5 Module Ownership

Each major module should own:

- its domain behavior
- its validation
- its internal application services
- its persistence access patterns
- its public contracts

Other modules should interact through intentional interfaces rather than reaching into internal implementation details.

The exact package and directory structure is defined later in Repository Architecture.

---

# 01.A Major System Planes

Kablet v0.1 distinguishes three major logical planes:

1. Control Plane
2. Customer Runtime Plane
3. Learning / Analysis Plane

The first two participate directly in normal product operation.

The third initially consumes evidence and may remain relatively thin.

---

## 01.6 Control Plane

The Control Plane is the Business-facing side of Kablet.

It manages the configuration and authoritative state required for Kablet to operate.

Responsibilities include:

- Organization management
- Business management
- User Membership
- Business Truth
- Business Rules
- locations
- integrations
- available Actions
- Component configuration where applicable
- Experiment configuration
- reporting
- Business settings
- Intelligence configuration where exposed
- operational administration

Conceptually:

BUSINESS OPERATOR
        ↓
   CONTROL PLANE
        ↓
Canonical Business Configuration
        ↓
 CUSTOMER RUNTIME

The Control Plane determines what Kablet is allowed to know and do for a Business.

It does not determine the exact customer journey.

---

## 01.7 Customer Runtime Plane

The Customer Runtime is the customer-facing execution path.

It is responsible for converting Business Truth and Visitor context into adaptive Experiences.

Its critical loop is:

Visitor
    ↓
Session
    ↓
Signal
    ↓
Visitor State
    ↓
Context Assembly
    ↓
Intelligence
    ↓
Decision
    ↓
Experience Plan
    ↓
Validation
    ↓
Experience
    ↓
Interaction
    ↓
Action
    ↓
Outcome

This path is commercially critical.

Its architecture should eventually prioritize:

- low latency
- reliability
- graceful degradation
- tenant safety
- Decision lineage
- Event durability

---

## 01.8 Control Plane and Runtime Have Different Operational Characteristics

The Control Plane and Customer Runtime serve different workloads.

Control Plane:

- authenticated Business Users
- relatively low request volume
- configuration-heavy
- administration-heavy
- tolerant of moderate latency
- complex forms and workflows

Customer Runtime:

- public Visitors
- potentially much higher traffic
- latency-sensitive
- conversion-sensitive
- frequently invokes Intelligence
- generates significant Event volume
- must degrade gracefully

They therefore remain separate architectural concepts even while sharing one application architecture initially.

---

## 01.9 Control Plane Does Not Directly Render Customer Experiences

Business operators configure:

- Truth
- Rules
- capabilities
- authority
- integrations
- experiments

They should not normally construct fixed customer pages that bypass Kablet's Decision system.

The relationship is:

Business Operator
        ↓
Control Plane
        ↓
Business Truth + Rules + Capabilities
        ↓
Customer Runtime
        ↓
Decision
        ↓
Experience

This preserves Kablet's core product thesis.

---

## 01.10 Customer Runtime Does Not Own Business Truth

The Runtime consumes Business Truth.

It does not independently redefine it.

Runtime-generated Experiences may:

- select Truth
- organize Truth
- summarize Truth
- emphasize Truth
- combine Truth
- present authorized generated language around Truth

but authoritative Business state remains owned by the Business Truth module.

---

# 01.B Learning / Analysis Plane

## 01.11 Learning Is a Distinct Logical Plane

Kablet's long-term Intelligence improves from accumulated evidence.

That evidence includes:

- Visitor State
- Decisions
- Experiences
- Component exposures
- interactions
- Actions
- Outcomes
- Experiments

Learning and analysis should therefore be conceptually separated from the synchronous customer Runtime.

Conceptually:

CUSTOMER RUNTIME
        ↓
Canonical Events / Outcomes
        ↓
LEARNING / ANALYSIS
        ↓
Strategies / Evidence
        ↓
Future Intelligence

---

## 01.12 Learning Must Not Block the Customer Runtime

The Runtime should not require heavy analytical processing before responding to a Visitor unless a specific Decision capability requires it.

Where possible:

Runtime produces evidence.

Learning consumes evidence asynchronously.

Learning produces future usable strategies or projections.

This protects Runtime latency and reliability.

---

## 01.13 Learning Plane Is Thin Initially

Kablet v0.1 does not require sophisticated machine-learning infrastructure.

Initially the Learning / Analysis Plane may consist of:

- Event queries
- Outcome analysis
- experiment reporting
- Business-level metrics
- manually reviewed patterns
- simple strategy configuration

The logical boundary exists before the sophisticated machinery does.

---

# 01.C Core Modules

## 01.14 Identity Module

Responsibilities:

- Organization identity
- Business identity
- Property / Location identity
- User identity references
- Membership relationships
- ownership context

It provides the canonical identity relationships used throughout the system.

Authentication implementation remains separate from domain identity.

---

## 01.15 Business Truth Module

Responsibilities:

- canonical Business Truth
- Services
- Products
- Pricing
- Offers
- People
- Proof
- FAQs
- Policies
- Media references
- Locations
- Availability references
- Business Rules
- Action availability
- provenance
- authority

This module is the authoritative Kablet representation of what the Business says is true.

---

## 01.16 Visitor Module

Responsibilities:

- Visitor identity
- anonymous Visitor handling
- Session lifecycle
- Visitor context
- Session context
- relevant continuity

Visitor identity remains Business-scoped by default.

---

## 01.17 Visitor State Module

Responsibilities:

- observations
- inferred State
- intent
- needs
- constraints
- concerns
- preferences
- journey state
- confidence where applicable
- State transitions
- State provenance

The State module owns canonical Kablet Visitor State.

It does not delegate canonical memory to the Intelligence provider.

---

## 01.18 Intelligence Module

Responsibilities:

- Intelligence Interface
- Context Assembly
- provider abstraction
- Intelligence operation selection
- structured output handling
- proposed State updates
- proposed Decisions
- proposed Experience Plans
- failure handling

It does not directly render UI or execute consequential Actions.

---

## 01.19 Decision Module

Responsibilities:

- canonical Decision creation
- Decision validation
- Decision identity
- objective
- strategy
- selected Business Truth
- selected Components
- proposed Actions
- Decision lineage
- Intelligence attribution
- Experiment attribution

Executed Decisions become historical records.

---

## 01.20 Experience Module

Responsibilities:

- Experience Contract
- Experience Plan
- Component selection
- Component instances
- composition
- Experience validation
- Experience identity
- Experience lifecycle

It converts validated Decision intent into a controlled customer-facing representation.

---

## 01.21 Component Module

Responsibilities:

- Component types
- Component contracts
- payload validation
- supported Actions
- presentation variants
- Component versioning
- capability metadata

The Component module defines what the Runtime is capable of presenting.

---

## 01.22 Action Module

Responsibilities:

- Action definitions
- Action availability
- authority requirements
- input validation
- execution orchestration
- idempotency where required
- Action lifecycle
- Action results
- failure handling

The Action module separates Intelligence reasoning from consequential execution.

---

## 01.23 Event Module

Responsibilities:

- canonical Event envelope
- Event vocabulary
- Event validation
- Event persistence
- Event lineage
- Event versioning

The Event module records meaningful domain occurrences.

It is distinct from operational logging.

---

## 01.24 Outcome Module

Responsibilities:

- Conversion
- Outcome
- Revenue references
- Outcome verification
- external Outcome ingestion
- Outcome evolution
- Decision / Experience attribution context

Outcome is modeled separately from raw interaction Events.

---

## 01.25 Experiment Module

Responsibilities:

- Experiment definitions
- variants
- eligibility
- assignment
- exposure
- Outcome association
- experiment status
- experiment version context

The first implementation may be minimal.

Its contracts must preserve correct experimental lineage.

---

## 01.26 Integration Module

Responsibilities:

- external provider connections
- provider adapters
- synchronization
- webhook ingestion
- external identifiers
- provenance
- capability mapping
- integration health

Provider-specific behavior should remain isolated behind adapters where practical.

---

## 01.27 Authorization Module

Responsibilities:

- ownership-aware authorization
- Membership capability evaluation
- resource access decisions
- mutation authority
- delegated authority
- Action authority

Authentication answers:

Who is this actor?

Authorization answers:

May this actor perform this operation in this context?

These remain separate concerns.

---

# 01.D Module Interaction Rules

## 01.28 Modules Interact Through Explicit Contracts

Cross-module behavior should use intentional application interfaces.

For example:

Customer Runtime
    ↓
Business Truth Query Interface
    ↓
Business Truth Module

rather than:

Customer Runtime
    ↓
Direct arbitrary Business Truth persistence access

This improves:

- testability
- replaceability
- domain clarity
- future service extraction

---

## 01.29 Modules May Share One Transactional Database Initially

Logical module ownership does not require separate databases.

Kablet v0.1 may use one primary transactional database while maintaining module-level ownership of persistence behavior.

Conceptually:

               PRIMARY DATABASE

Identity tables             ← Identity Module

Business Truth tables       ← Business Truth Module

Visitor tables              ← Visitor Module

Decision tables             ← Decision Module

Experience tables           ← Experience Module

Event tables                ← Event Module

Outcome tables              ← Outcome Module

Physical co-location does not eliminate logical ownership.

The actual database technology is selected later.

---

## 01.30 Cross-Module Database Access Should Be Controlled

Sharing a database must not become permission for every module to manipulate every table arbitrarily.

The preferred relationship is:

Module A
    ↓
Module B Contract
    ↓
Module B Persistence

There may be justified read models or carefully defined cross-module queries later.

Those should be explicit architectural decisions rather than accidental coupling.

---

## 01.31 Strong Transactions May Span Closely Related Operations

One benefit of the initial modular monolith is the ability to use local transactions for closely related canonical changes.

For example:

Create Decision
+
Create Experience
+
Record required domain Events

may potentially participate in one reliable transactional operation where technically appropriate.

The exact transaction boundaries are defined in Data Architecture.

---

## 01.32 Not Every Module Interaction Requires an Event

Kablet should not turn every internal function call into asynchronous Event communication merely to imitate microservices.

Synchronous module contracts are appropriate when:

- the caller requires the result immediately
- the operation belongs to one transactional flow
- asynchronous decoupling provides no clear benefit

Canonical Events represent meaningful domain occurrences.

They are not a replacement for normal application calls.

---

## 01.33 Asynchronous Work Is Used Where It Provides Real Value

Good candidates may include:

- external synchronization
- webhook follow-up processing
- analytics projection
- email / messaging
- non-critical enrichment
- reporting aggregation
- learning analysis
- retries
- media processing

The exact asynchronous infrastructure is selected later.

---

# 01.E Customer Runtime Request Path

## 01.34 Canonical Runtime Flow

A normal adaptive customer interaction should approximately follow:

1. Resolve Business.
2. Resolve or create Visitor.
3. Resolve or create Session.
4. Receive Signal.
5. Persist meaningful Signal/Event.
6. Update or derive Visitor State.
7. Assemble authorized context.
8. Invoke Intelligence.
9. Validate proposed State changes.
10. Create canonical Decision.
11. Create Experience Plan.
12. Validate Experience.
13. Persist required canonical records.
14. Return Experience to Runtime renderer.
15. Record rendering / exposure Events.
16. Receive subsequent interactions.
17. Execute authorized Actions where requested.
18. Record resulting Outcomes.

Exact implementation may optimize or combine steps.

The semantic ordering must remain understandable.

---

## 01.35 Runtime Must Know Which Business It Is Serving

Before accessing tenant-sensitive runtime state, the system must resolve the relevant Business.

Business resolution may eventually derive from:

- custom domain
- Kablet subdomain
- embedded configuration
- explicit trusted routing context

The exact routing implementation is defined later.

Business resolution must occur before unrestricted tenant data access.

---

## 01.36 Runtime Must Support Anonymous Visitors

The customer-facing Runtime must not require Business-account authentication.

Anonymous Visitors are first-class.

A Runtime Session may therefore begin with:

Business
+
anonymous Visitor identity
+
Session

without requiring personally identifiable information.

---

## 01.37 Runtime Should Minimize Synchronous Dependencies

The customer Runtime is conversion-sensitive.

Its synchronous path should avoid dependencies that do not need to block the response.

For example:

Decision persistence:
critical.

Experience validation:
critical.

Optional analytics projection:
not necessarily critical.

Non-essential reporting aggregation:
not critical.

This distinction informs later async architecture.

---

# 01.F Control Plane Request Path

## 01.38 Canonical Control Plane Flow

A Business-facing operation should approximately follow:

1. Authenticate User.
2. Resolve Organization / Business context.
3. Resolve Membership.
4. Authorize requested capability.
5. Validate input.
6. Apply domain operation.
7. Persist canonical state.
8. Record meaningful Event / audit information where required.
9. Trigger asynchronous side effects where appropriate.
10. Return resulting state.

This keeps Business configuration changes subject to ownership and authority.

---

## 01.39 Control Plane Writes Must Not Bypass Domain Validation

Administrative access does not justify direct arbitrary persistence mutation.

Business Truth changes should still enforce:

- ownership
- source authority
- validation
- provenance
- versioning / revision semantics

The Control Plane is an interface to the domain.

It is not a database editor.

---

# 01.G Infrastructure Boundary

## 01.40 Domain Modules Must Not Depend Directly on Vendor Semantics Where Avoidable

The preferred dependency direction is:

Kablet Domain
    ↓
Kablet Interface
    ↓
Infrastructure Adapter
    ↓
External Provider

Examples:

Intelligence
    ↓
AI Provider Interface
    ↓
Provider Adapter

Action
    ↓
Booking Interface
    ↓
Booking Provider Adapter

Storage
    ↓
Object Storage Interface
    ↓
Storage Provider Adapter

This keeps provider-specific behavior outside permanent domain semantics.

---

## 01.41 Infrastructure Depends on Domain Contracts

Domain contracts should not be designed around provider SDK objects.

Instead:

Domain defines required capability.

Infrastructure implements that capability.

This is especially important for strategically sensitive areas such as:

- Intelligence
- Actions
- canonical persistence
- Events
- authentication integration

---

# 01.H Deployment Shape

## 01.42 Initial Deployment Should Remain Small

Kablet v0.1 should begin with the minimum number of deployable units justified by operational requirements.

A likely conceptual shape is:

┌─────────────────────────────┐
│ Kablet Application          │
│                             │
│ Control Plane               │
│ Customer Runtime            │
│ Domain Modules              │
│ Intelligence Orchestration  │
│ API                         │
└──────────────┬──────────────┘
               │
               ▼
        Primary Database

plus, where required:

Background Worker

and managed external infrastructure.

The exact deployment technology is selected later.

---

## 01.43 Background Worker May Be a Separate Process

Some asynchronous workloads may benefit from a worker process even while remaining inside the same codebase and architecture.

Conceptually:

Same Repository
Same Domain Contracts
Same Modules where appropriate

but:

Web / Runtime Process

and:

Worker Process

may execute independently.

This does not constitute a microservice architecture.

---

## 01.44 Customer Runtime May Be Extracted Later

If Kablet eventually requires independent scaling, deployment, latency optimization, or isolation, the Customer Runtime is a natural candidate for physical extraction.

The logical boundary exists from v0.1 to preserve this option.

Possible future:

Control Plane Service
        │
        ▼
Canonical Platform State
        ▲
        │
Customer Runtime Service

This extraction is not required now.

---

## 01.45 Event Processing May Be Extracted Later

If Event volume eventually requires dedicated infrastructure, Event processing may become a separate operational system.

Because canonical Event contracts already exist, this should not require redefining what an Event means.

The infrastructure changes.

The domain semantics remain stable.

---

## 01.46 Intelligence Orchestration May Be Extracted Later

If Intelligence workloads eventually require:

- independent scaling
- specialized runtime
- separate language
- dedicated inference infrastructure
- strict latency isolation

the Intelligence module may become a separate service.

The Kablet Intelligence Interface should make this possible.

It remains in-process initially unless evidence justifies extraction.

---

# 01.I Dependency Direction

## 01.47 Preferred Dependency Direction

At a high level:

Presentation / API
        ↓
Application Modules
        ↓
Domain Contracts
        ↓
Infrastructure Interfaces
        ↓
Infrastructure Adapters

Cross-cutting capabilities such as:

- authorization
- validation
- observability
- Event recording

must integrate without reversing domain ownership.

---

## 01.48 Customer Runtime Orchestrates; It Does Not Own Everything

The Runtime coordinates multiple modules.

It does not absorb their responsibilities.

For example:

Runtime asks Business Truth for Truth.

Runtime asks Visitor State for State.

Runtime invokes Intelligence.

Runtime persists Decision through Decision domain behavior.

Runtime obtains validated Experience.

Runtime invokes Actions through Action contracts.

This prevents the Runtime from becoming a giant unstructured service.

---

# 01.J Failure Boundaries

## 01.49 Failure Must Be Classified

Failures should be distinguishable by domain area.

Examples:

- Business resolution failure
- authorization failure
- Business Truth failure
- Visitor State failure
- Intelligence failure
- Decision validation failure
- Experience validation failure
- Action failure
- integration failure
- Event persistence failure
- Outcome verification failure

This classification enables appropriate fallback and observability.

---

## 01.50 Intelligence Failure Must Not Corrupt Canonical State

If an Intelligence invocation fails:

- Business Truth remains valid.
- existing Visitor State remains valid.
- prior Decisions remain unchanged.
- prior Experience remains historically valid.

The Runtime may:

- retry
- use fallback
- preserve last valid Experience where appropriate
- return controlled failure behavior

according to later failure policy.

---

## 01.51 Integration Failure Must Remain Local Where Possible

If one external provider fails, unrelated Kablet capabilities should continue where possible.

Example:

Booking provider unavailable

should not make:

FAQ
Proof
Pricing
Visitor State

unavailable unless the customer flow genuinely depends on booking.

---

## 01.52 Event Recording Reliability Depends on Event Criticality

Not all Events have identical durability requirements.

For example:

conversion.completed

may require stronger guarantees than:

component.hovered

if such a low-value Event even exists.

Event Architecture will classify required durability later.

---

# 01.K Future Service Extraction Rule

## 01.53 Services Are Extracted Because of Evidence

A module should become an independent service only when there is a concrete reason such as:

- materially different scaling requirements
- materially different reliability requirements
- security isolation
- deployment independence
- specialized runtime requirements
- operational bottlenecks
- clear organizational ownership

"Microservices are scalable" is not sufficient justification.

---

## 01.54 Extraction Must Preserve Contracts

When a module moves from:

in-process call

to:

network call

its domain meaning should remain stable.

Conceptually:

Today:

Runtime
    ↓
Intelligence Interface
    ↓
In-Process Intelligence Module

Future:

Runtime
    ↓
Intelligence Interface
    ↓
Network Transport
    ↓
Intelligence Service

The transport changes.

The contract remains.

---

# 01.L Architecture Decision Record

## ADR-001 — Start Kablet as a Modular Monolith

### Status

Accepted for Technical Architecture v0.1.

### Context

Kablet requires strong domain consistency, rapid iteration, explicit tenant boundaries, and reliable Decision / Outcome lineage.

The product is pre-scale and must first prove repeatable economic lift.

### Decision

Kablet will begin as a modular monolith with explicit internal module boundaries.

Control Plane and Customer Runtime will remain logically separate but are not required to be separate services initially.

Background processing may run as a separate process while sharing the same codebase and domain contracts.

### Reasons

- lower operational complexity
- easier transactions
- faster development
- easier local development
- easier debugging
- simpler testing
- reduced distributed failure modes
- sufficient for initial scale
- compatible with future service extraction

### Rejected Initial Alternative

Microservices from day one.

Rejected because they introduce substantial operational and consistency complexity without a demonstrated requirement.

### Consequences

Kablet must actively preserve module boundaries inside the monolith.

A shared process and database must not become permission for uncontrolled cross-module coupling.

Future extraction remains possible through explicit contracts.

---

## ADR-002 — Separate Control Plane and Customer Runtime Logically

### Status

Accepted for Technical Architecture v0.1.

### Context

Business administration and customer-facing adaptive execution have different:

- users
- traffic patterns
- latency requirements
- security characteristics
- scaling profiles
- failure tolerance

### Decision

Control Plane and Customer Runtime are separate logical architectural planes from v0.1.

They may initially share:

- repository
- application
- deployment
- database

where appropriate.

### Consequences

Code boundaries must prevent either plane from absorbing the other's domain responsibilities.

The Customer Runtime remains a natural future extraction boundary.

---

## ADR-003 — Keep Learning / Analysis Off the Critical Runtime Path

### Status

Accepted for Technical Architecture v0.1.

### Decision

Heavy analysis and learning should consume canonical evidence outside the normal synchronous customer interaction path unless a specific Decision capability requires synchronous access.

### Consequences

The Runtime produces reliable evidence.

Learning consumes that evidence and influences future Intelligence through explicit strategy or policy interfaces.

---

# 01.M System Architecture Invariants

1. Kablet v0.1 begins as a modular monolith.
2. Modular does not mean unrestricted internal coupling.
3. Control Plane and Customer Runtime are separate logical planes.
4. Learning / Analysis is a separate logical concern.
5. Learning is not required on the critical Runtime path.
6. Domain modules own their behavior and persistence boundaries.
7. Modules interact through explicit contracts.
8. One transactional database may serve multiple modules initially.
9. Shared persistence does not eliminate logical ownership.
10. Not every module interaction requires asynchronous Events.
11. Asynchronous execution is introduced where it provides concrete value.
12. Runtime resolves Business context before unrestricted tenant access.
13. Anonymous Visitors are first-class.
14. Runtime minimizes unnecessary synchronous dependencies.
15. Control Plane operations remain subject to domain validation.
16. External providers enter through infrastructure adapters.
17. Domain semantics do not depend directly on provider SDK representations.
18. Initial deployable-unit count remains small.
19. A worker may be separately deployed without creating microservices.
20. Customer Runtime may be extracted later without redefining domain semantics.
21. Event processing may be extracted later without redefining Event meaning.
22. Intelligence may be extracted later behind the existing Intelligence Interface.
23. Runtime orchestrates domain modules rather than owning their responsibilities.
24. Failures are classified by domain boundary.
25. Intelligence failure does not corrupt canonical state.
26. Integration failures remain local where possible.
27. Event durability is proportional to domain criticality.
28. Services are extracted because of demonstrated requirements.
29. Service extraction preserves Kablet contracts.
30. Deployment topology may evolve without redefining the Foundation.

---

# 01.N Explicitly Not Decided Yet

Section 01 intentionally does not yet select:

- programming language
- frontend framework
- backend framework
- database product
- ORM
- authentication provider
- authorization implementation
- AI provider
- model
- queue provider
- cache
- object storage
- analytics provider
- observability provider
- hosting platform
- deployment platform

Those decisions follow from the system shape defined here.

---

# 01.O Dependency

Section 00 established the technical goals and constraints.

Section 01 establishes the initial system shape:

**A modular monolith with explicit Control Plane, Customer Runtime, Learning / Analysis, domain modules, and infrastructure boundaries.**

The next section selects the concrete technologies that will implement this architecture:

# 02 — Technology Stack

# 02. Technology Stack

## 02.1 Purpose

This section selects the concrete technologies used to implement Kablet Technical Architecture v0.1.

Selections are evaluated against:

- Foundation Specification v0.1.
- Architecture Goals & Constraints (Section 00).
- System Architecture (Section 01).
- Development speed.
- Operational simplicity.
- Type safety.
- Data integrity.
- Provider replaceability.
- Future extensibility.

The objective is to establish one coherent initial engineering stack, not to build infrastructure for hypothetical massive scale.

---

## 02.2 Primary Technology Decision

**Kablet v0.1 will use TypeScript as its primary application language.**

The initial application will share a consistent language across:

- Control Plane.
- Customer Runtime.
- API.
- Intelligence orchestration.
- Experience Contracts.
- Component Contracts.
- Action Contracts.
- Domain modules.
- Background workers.

Python is not required for the first implementation.

It may be introduced later for specialized learning, statistical analysis, or machine-learning workloads where justified.

The initial architecture must not depend on Python merely because Kablet uses AI.

---

## 02.3 Selected Stack

| Layer | Selection | Status |
|---|---|---|
| Primary language | TypeScript | Selected |
| Runtime | Node.js LTS | Selected |
| Frontend | React + Next.js | Selected |
| Application framework | Next.js | Selected |
| API contracts | TypeScript + Zod | Selected |
| Domain validation | Zod + explicit domain rules | Selected |
| Primary database | PostgreSQL | Selected |
| Database access | Drizzle ORM + SQL where necessary | Selected |
| Authentication direction | Managed authentication, adapter-isolated | Provider deferred |
| Authorization | Kablet-owned domain authorization | Selected |
| AI integration | Kablet Intelligence Interface | Selected |
| Initial AI provider | OpenAI adapter | Initial implementation |
| Package manager | pnpm | Selected |
| Repository strategy | TypeScript monorepo | Selected |
| Background execution | Node.js worker when required | Selected |
| Canonical Events | PostgreSQL-backed | Selected |
| Analytics | Canonical Events first | Vendor deferred |
| Caching | Not required initially | Deferred |
| Vector database | Not required initially | Deferred |
| Hosting | Managed infrastructure | Provider deferred |

This table establishes the technology direction.

Later sections define detailed configuration, persistence, security, and deployment decisions.

---

## 02.4 Node.js Runtime

Kablet will use an active or maintenance-supported Node.js LTS release.

The exact major version will be pinned during Repository Architecture.

Production, CI, and local development must use compatible runtime versions.

The application should not rely on experimental runtime features without a documented requirement.

---

## 02.5 Next.js

Next.js will provide the initial application framework.

It will support:

- Business-facing Control Plane.
- Customer-facing Runtime.
- Public application entry points.
- API entry points.
- Server-side application orchestration.
- React rendering.

Next.js is an application delivery framework.

It must not become the owner of Kablet's permanent domain semantics.

Core domain logic must remain independent of:

- Next.js route handlers.
- React Components.
- Server Actions.
- framework-specific request objects.

This preserves future extraction options.

---

## 02.6 Frontend Architecture

React will implement Kablet's initial visual Experience renderer.

The renderer will consume validated Experience Contracts.

It will not execute arbitrary AI-generated React, JavaScript, or HTML.

Conceptually:

Validated Experience Contract
        ↓
React Component Registry
        ↓
Component Instances
        ↓
Customer-facing Experience

The initial frontend must support dynamic composition without requiring a traditional page-builder architecture.

---

## 02.7 Backend Architecture

The backend will initially execute within the TypeScript application architecture.

Domain logic will be organized into explicit modules.

Route handlers and other transport entry points must remain thin.

Their responsibility is to:

1. Receive requests.
2. Establish trusted context.
3. Validate input.
4. Invoke application services.
5. Return structured responses.

They must not become the primary location for Business Truth, Decision, Experience, or Action logic.

---

## 02.8 TypeScript Contracts

TypeScript will provide compile-time contracts across application boundaries.

Zod will provide runtime validation for untrusted and externally supplied data.

This includes:

- API input.
- Intelligence output.
- Experience payloads.
- Component payloads.
- Action input.
- Integration payloads.
- Event payloads where applicable.

TypeScript types alone are insufficient for validating runtime data.

The system must distinguish compile-time correctness from runtime validation.

---

## 02.9 PostgreSQL

PostgreSQL will serve as Kablet's initial primary transactional database.

It will store canonical operational records, including:

- Organizations.
- Businesses.
- Memberships.
- Business Truth.
- Visitors.
- Sessions.
- Visitor State.
- Decisions.
- Experiences.
- Actions.
- Events.
- Outcomes.
- Experiment definitions and assignments.

The database will preserve the ownership and historical lineage established by the Foundation.

A separate event database, vector database, or analytical warehouse is not required initially.

---

## 02.10 Drizzle ORM

Drizzle will provide typed database access and schema management.

Raw SQL remains acceptable where necessary for:

- complex constraints.
- transaction control.
- tenant isolation.
- performance-sensitive queries.
- advanced PostgreSQL capabilities.

The ORM must not replace domain validation or authorization.

Database access should remain behind module-owned persistence interfaces.

---

## 02.11 Authentication

Kablet will use managed authentication rather than implementing a custom credential system from scratch.

The exact provider will be selected in Section 04.

Authentication identity must remain separate from canonical Kablet User identity.

Kablet will preserve its own:

- User.
- Organization.
- Business.
- Membership.
- authorization relationships.

Replacing the authentication provider must not require redefining those domain concepts.

---

## 02.12 Authorization

Authorization is a Kablet-owned application capability.

It will not be delegated exclusively to:

- frontend visibility.
- authentication-provider metadata.
- middleware.
- AI instructions.

The implementation must enforce contextual access based on ownership, Membership, resource, operation, and applicable capability.

Database-level enforcement will be evaluated in the Data and Authorization Architecture sections.

---

## 02.13 Intelligence Technology

Kablet will initially integrate OpenAI through an infrastructure adapter.

The application will communicate with the Kablet Intelligence Interface rather than invoking provider-specific APIs throughout domain modules.

Conceptually:

Customer Runtime
        ↓
Kablet Intelligence Interface
        ↓
Context Assembly
        ↓
Provider Adapter
        ↓
OpenAI

The adapter will translate provider responses into Kablet-owned structured output contracts.

Provider responses must pass Kablet validation before becoming canonical Decisions or Experiences.

No permanent Foundation object will depend on an OpenAI-specific conversation, response, or tool-call representation.

---

## 02.14 Intelligence Model Selection

The exact model and model-routing policy are deferred to Section 05.

The initial architecture should support:

- one default model.
- configurable model identity.
- provider-level error handling.
- structured output.
- request attribution.
- cost and latency observation.
- controlled fallback.

Multi-provider orchestration and complex model routing are not required for the first Runtime.

---

## 02.15 Background Processing

Background processing will use TypeScript and Node.js.

A separate worker process may be introduced when required.

The initial architecture should avoid selecting a complex queue system before concrete asynchronous workloads and reliability requirements are defined.

Candidate workloads include:

- integration synchronization.
- webhook follow-up.
- analytics projection.
- reporting aggregation.
- retryable external operations.
- learning analysis.

Background jobs must preserve tenant and domain context.

---

## 02.16 Event Technology

Kablet's canonical Event Spine will initially use PostgreSQL-backed persistence.

This does not mean every internal operation must communicate through asynchronous Events.

The Event domain model remains distinct from its transport and storage implementation.

A distributed event-streaming platform is not required for v0.1.

---

## 02.17 Analytics Technology

Kablet's canonical Event and Outcome data must exist independently of analytics vendors.

A third-party analytics provider may later be used for:

- product analytics.
- operational funnels.
- dashboards.
- debugging.
- session analysis.

Such a provider will consume permitted projections of canonical Kablet data.

It will not become the authoritative Decision/Outcome system.

---

## 02.18 Caching

Redis or another dedicated caching system is not mandatory for the first implementation.

Caching will be introduced when supported by demonstrated requirements involving:

- latency.
- request volume.
- rate limiting.
- expensive repeated computation.
- session-related performance.
- operational reliability.

Canonical Visitor State must not exist exclusively in an ephemeral cache.

---

## 02.19 Vector Infrastructure

A dedicated vector database is not required initially.

If semantic retrieval becomes necessary, the architecture should first evaluate whether PostgreSQL-based capabilities adequately support the requirement.

The addition of embeddings must not alter Business Truth authority or tenant isolation.

---

## 02.20 Repository and Package Management

Kablet will use a TypeScript monorepo managed with pnpm.

The repository must support:

- shared domain contracts.
- independent module boundaries.
- application code.
- infrastructure adapters.
- tests.
- database migrations.
- architecture documentation.

The exact folder structure and workspace configuration will be defined in Repository Architecture.

A monorepo does not imply that every package must become an independently published library.

---

## 02.21 Testing Direction

The stack must support automated testing of:

- domain rules.
- ownership.
- authorization.
- validation.
- persistence.
- Intelligence adapters.
- Experience Contracts.
- Action execution.
- Event and Outcome lineage.
- end-to-end customer journeys.

Exact testing frameworks will be selected in Section 16.

Critical PostgreSQL behavior must eventually be tested against real PostgreSQL rather than relying exclusively on mocks.

---

## 02.22 Provider Selection Principle

Managed infrastructure is preferred where it reduces operational complexity.

However, strategic Kablet concepts must remain Kablet-owned.

Acceptable:

Using an external AI provider to perform reasoning.

Not acceptable:

Making the provider's conversation history Kablet's only Visitor State.

Acceptable:

Using managed PostgreSQL.

Not acceptable:

Allowing hosting-specific abstractions to redefine Business ownership.

Acceptable:

Using third-party analytics.

Not acceptable:

Losing canonical Decision/Outcome history when the analytics vendor is removed.

---

# 02.A Technology Dependency Model

The intended dependency direction is:

Next.js / React
       |
       v
Application Services
       |
       v
Kablet Domain Contracts
       |
       v
Infrastructure Interfaces
       |
       v
Infrastructure Adapters
       |
       +-- PostgreSQL / Drizzle
       +-- AI Provider
       +-- Authentication Provider
       +-- External Integrations
       +-- Storage Provider
       +-- Analytics Provider

Domain modules must not depend directly on React, Next.js, or provider SDK representations.

---

# 02.B Explicitly Deferred Technologies

The following are not required selections for this section:

- Redis provider.
- Queue provider.
- Vector database.
- Analytical warehouse.
- Proprietary ML framework.
- Kubernetes.
- Kafka.
- Multi-cloud infrastructure.
- Multi-region database.
- Dedicated inference servers.
- Agent orchestration framework.

They may be introduced through later architecture decisions when justified.

---

# 02.C Architecture Decisions

## ADR-004 — TypeScript-First Application

**Status:** Accepted.

Kablet will use TypeScript across its initial application, Runtime, API, Intelligence orchestration, and domain contracts.

Python may be introduced later for specialized workloads.

Reason: one coherent development environment reduces integration complexity and accelerates initial implementation.

## ADR-005 — React and Next.js

**Status:** Accepted.

React and Next.js will implement the initial Control Plane and customer-facing Runtime.

Core domain semantics remain framework-independent.

## ADR-006 — PostgreSQL as Primary System of Record

**Status:** Accepted.

PostgreSQL will hold canonical operational data, including Decision, Event, and Outcome lineage.

Additional specialized databases require demonstrated need.

## ADR-007 — Drizzle and Zod

**Status:** Accepted.

Drizzle provides typed database access.

Zod provides runtime contract validation.

Neither replaces domain rules or authorization.

## ADR-008 — Provider-Isolated Intelligence

**Status:** Accepted.

The first Intelligence implementation will use an OpenAI adapter behind Kablet's own Intelligence Interface.

Model/provider representations must not become canonical domain objects.

## ADR-009 — Avoid Premature Infrastructure Proliferation

**Status:** Accepted.

Redis, dedicated vector infrastructure, distributed streaming, complex agent frameworks, and proprietary ML infrastructure are deferred until justified by concrete requirements.

---

# 02.D Technology Stack Invariants

1. TypeScript is the primary application language.
2. Node.js is the initial application runtime.
3. React implements the initial visual Experience renderer.
4. Next.js delivers the initial application.
5. Domain contracts remain independent of Next.js and React.
6. PostgreSQL is the primary canonical transactional store.
7. Drizzle does not replace domain validation.
8. Zod validates untrusted runtime data.
9. Authentication-provider identity remains separate from Kablet domain identity.
10. Authorization remains Kablet-owned.
11. Intelligence providers remain behind adapters.
12. Provider output requires Kablet validation.
13. Canonical Visitor State does not reside exclusively in provider memory.
14. Canonical Events remain independent of analytics vendors.
15. Background processing preserves tenant context.
16. Additional infrastructure requires demonstrated need.
17. Technology selections must preserve Foundation v0.1.
18. Provider replacement must not redefine Kablet's canonical domain.

---

# 02.E Dependency

Section 01 established:

**A modular monolith with separate logical Control Plane, Customer Runtime, and Learning / Analysis boundaries.**

Section 02 establishes:

**A TypeScript-first implementation using Node.js, Next.js, React, PostgreSQL, Drizzle, Zod, and provider-isolated Intelligence.**

The next section defines how Kablet's canonical domain is persisted and how its historical lineage is preserved.

# 03 — Data Architecture
---

# 03. Data Architecture

## 03.1 Purpose

This section defines how Kablet v0.1 will persist, protect, retrieve, and evolve its canonical domain data.

It translates the Foundation's data concepts into an initial PostgreSQL-based persistence architecture.

The architecture must support:

- Multi-tenant ownership.
- Canonical Business Truth.
- Historical Business Truth revisions.
- Anonymous Visitors and Sessions.
- Structured Visitor State.
- First-class Decisions.
- Validated Experiences.
- Canonical Events.
- Verified Outcomes.
- Decision-to-Outcome lineage.
- Future experimentation and learning.

The objective is to preserve the right data relationships from day one without prematurely implementing a distributed data platform.

---

## 03.2 Primary Data Architecture Decision

Kablet v0.1 will use PostgreSQL as its primary transactional system of record.

The initial architecture will use:

- One primary PostgreSQL database.
- Logical domain ownership.
- Explicit tenant-scoping rules.
- Relational integrity.
- Typed database access.
- Transactional persistence.
- Append-oriented historical records.
- Versioned domain contracts.
- JSONB where controlled flexibility is appropriate.

A separate operational event database, vector database, analytical warehouse, or distributed data platform is not required initially.

---

# 03.A Canonical Data Ownership

## 03.3 Organization Is the Tenant Boundary

Every tenant-owned canonical resource must have a determinable relationship to an Organization.

Business-scoped resources must additionally resolve to their Business.

Conceptually:

Organization
    |
    +-- Business
          |
          +-- Business Truth
          +-- Visitors
          +-- Sessions
          +-- Visitor State
          +-- Decisions
          +-- Experiences
          +-- Actions
          +-- Events
          +-- Outcomes

Property / Location may further refine the Business context.

The architecture must not assume every Business has only one physical location.

---

## 03.4 Ownership Must Be Explicitly Enforceable

Tenant-sensitive persistence must support reliable ownership validation.

The implementation must not depend on application developers remembering to manually filter every query correctly.

Kablet will use defense in depth:

1. Trusted request-context resolution.
2. Application-level authorization.
3. Tenant-scoped repository operations.
4. PostgreSQL-enforced isolation where applicable.
5. Database constraints supporting ownership consistency.

The exact RLS policies and database-role configuration will be specified in Section 04 and the physical schema design.

---

## 03.5 IDs Are Not Authorization

Possessing a valid Business ID, Visitor ID, Session ID, or Decision ID does not grant access to the corresponding resource.

Database access must be evaluated against trusted ownership and authorization context.

Client-supplied ownership identifiers must never be accepted as proof of authority.

---

## 03.6 Ownership and Authorship Remain Separate

Canonical resources may record:

- Owning Organization.
- Owning Business.
- Creating actor.
- Last modifying actor.
- Source system.

These concepts must not be conflated.

A User creating a Service for a Business does not personally own that Service.

Similarly, an integration importing Business Truth does not become the owner of that Truth.

---

# 03.B Logical Data Domains

## 03.7 Initial Domain Groups

The primary database will organize canonical data around the following logical groups.

| Domain | Primary responsibility |
|---|---|
| Identity | Organization, Business, Property, User, Membership |
| Business Truth | Authoritative commercial information and revisions |
| Visitor | Visitor identity, Sessions and continuity |
| Visitor State | Structured observations and interpretations |
| Decision | Explicit accepted Decisions and their context |
| Experience | Plans, validated Experiences and instances |
| Component | Controlled definitions and version references |
| Action | Action attempts, execution and results |
| Event | Canonical domain occurrences |
| Outcome | Conversions, business results and Revenue |
| Experiment | Definitions, assignments and exposures |
| Integration | External connections, mappings and provenance |
| Intelligence | Configuration and invocation metadata |

These are logical ownership groups, not a requirement to create one PostgreSQL schema per group.

Physical organization will be decided during schema design.

---

## 03.8 Domain-Owned Persistence

Each domain module owns its persistence behavior.

Other modules should access its data through explicit application interfaces where practical.

For example:

Customer Runtime
    ↓
Business Truth Query Interface
    ↓
Business Truth Persistence
    ↓
PostgreSQL

A shared database must not turn domain modules into an unrestricted collection of cross-table queries.

---

## 03.9 Relational Data Is the Default

Stable business relationships should use relational modeling.

Examples include:

- Organization → Business.
- Business → Visitor.
- Visitor → Session.
- Session → Decision.
- Decision → Experience.
- Action → Outcome.

Relational constraints should protect structural correctness where appropriate.

Flexible payload storage should complement these relationships rather than replace them.

---

# 03.C Relational Data and JSONB

## 03.10 JSONB Usage

PostgreSQL JSONB may be used for controlled variable structures such as:

- Versioned Component payloads.
- Experience composition.
- Intelligence metadata.
- Event-specific payloads.
- Structured Decision metadata.
- External integration metadata.

JSONB must not become an excuse to avoid modeling critical domain relationships.

---

## 03.11 Critical Lineage Must Remain Queryable

Important relationships must be available through stable identifiers and queryable structures.

For example, Kablet must be able to identify:

Which Decision produced an Experience?

Which Session contained that Decision?

Which Experiment influenced it?

Which Outcome followed?

These questions must not depend exclusively on parsing arbitrary generated text or unvalidated JSON.

---

## 03.12 JSONB Must Be Validated

JSONB payloads that implement Kablet contracts must be validated against the relevant versioned schema before acceptance.

Examples:

- Experience Plan.
- Component payload.
- Event payload.
- Intelligence result.
- Action input.

The database stores accepted canonical representations, not arbitrary untrusted model output.

---

# 03.D Business Truth Persistence

## 03.13 Canonical Business Truth

Business Truth will be persisted as structured, Business-scoped canonical data.

It must support:

- Entity identity.
- Business ownership.
- Current authoritative value.
- Source provenance.
- Relevant authority.
- Validation.
- Revision history.
- Effective-time context where necessary.

The Business Truth model must remain independent of the method used to ingest it.

---

## 03.14 Source Data Is Not Automatically Canonical Truth

External information may arrive from:

- Manual Business input.
- Website extraction.
- Commerce integrations.
- Booking integrations.
- CRM systems.
- APIs.
- Imported files.

Incoming information must pass through the appropriate normalization, validation, and authority-resolution process before becoming canonical Business Truth.

---

## 03.15 Business Truth Revisions

Kablet must preserve sufficient revision information to interpret historical Decisions correctly.

Example:

A Business offers a service for 399 AED.

A Visitor receives an Experience referencing that price.

Later, the Business changes the price to 449 AED.

The historical Experience must remain interpretable against the 399 AED revision.

Current Business Truth must not silently rewrite historical commercial meaning.

---

## 03.16 Current Truth and Historical Truth

The architecture should distinguish:

Current authoritative representation

from:

Historical revision context.

The implementation may use current-state records together with revision records, snapshots, or another suitable persistence strategy.

The exact physical mechanism is deferred.

---

# 03.E Visitor and Session Persistence

## 03.17 Visitor Identity

Visitors are customer-side identities, distinct from Business Users.

Anonymous Visitors must be supported.

Visitor identity is Business-scoped by default.

The same physical person interacting with two unrelated Businesses must not automatically become one shared Kablet Visitor identity.

---

## 03.18 Session Identity

Sessions represent bounded customer interaction periods.

A Visitor may have multiple Sessions.

Each Session must resolve to the correct Business ownership context.

Session records should support linking relevant:

- Signals.
- State.
- Decisions.
- Experiences.
- Actions.
- Events.
- Outcomes.

Exact session-expiration and continuity rules will be defined during Runtime implementation.

---

# 03.F Visitor State Persistence

## 03.19 Canonical Visitor State

Visitor State must be persisted independently from the AI provider.

It may contain structured representations of:

- Context.
- Intent.
- Needs.
- Constraints.
- Concerns.
- Preferences.
- Journey State.
- Relevant observations.
- Inferences.
- Confidence where applicable.

The State representation must distinguish observed information from inferred information.

---

## 03.20 State Revision Strategy

The initial persistence design must support current State together with enough historical context to interpret accepted Decisions.

A practical implementation may maintain:

- Current State.
- State revision identity.
- Relevant historical revisions or snapshots.
- State-update Events.

The exact balance between full snapshots and incremental history will be decided during physical schema design.

---

## 03.21 State Is Not Conversation History

Provider conversation history may be retained where justified, but it is not the canonical Visitor State model.

Kablet must remain capable of reconstructing the structured context used for meaningful Decisions without relying exclusively on provider-hosted memory.

---

# 03.G Decision Persistence

## 03.22 Decisions Are First-Class Records

Accepted meaningful Decisions must have stable canonical identity.

A Decision record must preserve enough information to establish:

- Owning Business.
- Visitor and Session.
- Relevant State context.
- Decision objective.
- Selected strategy.
- Relevant Business Truth references.
- Intelligence configuration.
- Experiment context where applicable.
- Resulting Experience relationship.
- Decision status and timing.

---

## 03.23 Accepted Decision History Is Immutable in Meaning

Once a Decision has been accepted as an executed historical occurrence, subsequent Intelligence activity must not silently overwrite what that Decision represented.

New information produces new State and new Decisions.

Administrative correction, privacy deletion, and explicit supersession remain separate governed operations.

---

## 03.24 Decision Context Must Be Reconstructable

Kablet must preserve sufficient references, revisions, or accepted context snapshots to understand why a historical Decision was possible.

The system is not required to persist unrestricted private model reasoning.

Structured decision basis and configuration attribution are the relevant canonical artifacts.

---

## 03.25 Decision and Experience Are Separate

A Decision represents what Kablet chose.

An Experience represents the customer-facing realization of that choice.

They must remain separately identifiable.

One Decision may reference its intended Experience Plan and resulting validated Experience.

The physical cardinality and exact persistence structure will be finalized in schema design.

---

# 03.H Experience Persistence

## 03.26 Experience Records

Experience persistence must support:

- Experience identity.
- Business and Session context.
- Originating Decision.
- Contract version.
- Component instances.
- Component payloads.
- Relevant Truth references.
- Presentation variants.
- Validation status.
- Lifecycle timestamps.

---

## 03.27 Planned Is Not Rendered

The database must not treat creation of an Experience Plan as proof that the Visitor actually saw it.

The system must distinguish:

Experience Planned
    ↓
Experience Validated
    ↓
Experience Delivered
    ↓
Experience Rendered
    ↓
Component Exposed
    ↓
Customer Interaction

Delivery and exposure evidence must be recorded according to their actual semantics.

---

## 03.28 Historical Experience Integrity

A historical Experience must remain interpretable even after:

- Business Truth changes.
- Component implementations change.
- presentation variants change.
- Intelligence configuration changes.

The architecture must preserve relevant contract and revision context.

Pixel-perfect historical replay is not a v0.1 requirement.

---

# 03.I Event Persistence

## 03.29 Canonical Event Store

Kablet will initially persist canonical domain Events in PostgreSQL.

Events represent meaningful occurrences rather than arbitrary application logs.

The Event model must support stable identity and versioned semantics.

---

## 03.30 Event Envelope

The canonical Event envelope should support, where applicable:

- Event ID.
- Event type.
- Schema version.
- Occurred timestamp.
- Recorded timestamp.
- Organization.
- Business.
- Property / Location.
- Visitor.
- Session.
- Decision.
- Experience.
- Component.
- Action.
- Experiment.
- Actor or source.
- Validated payload.
- Correlation / causation references.

Not every Event requires every optional reference.

The exact physical schema will be defined later.

---

## 03.31 Append-Oriented Event History

Canonical historical Events should generally be recorded as new occurrences rather than repeatedly rewritten.

Corrections and superseding information must be explicit.

Append-oriented history does not override applicable privacy deletion requirements.

---

## 03.32 Event Idempotency

The architecture must support protection against duplicate Event creation where retries or repeated delivery are possible.

A retried webhook must not automatically become a second real-world conversion.

Exact idempotency keys, uniqueness constraints, and retry policies will be defined during implementation.

---

## 03.33 Occurred Time and Recorded Time

Events must distinguish when an occurrence happened from when Kablet recorded it.

This supports:

- delayed integrations.
- webhook processing.
- asynchronous Actions.
- historical reconstruction.
- accurate reporting.

---

# 03.J Outcome Persistence

## 03.34 Outcomes Are Distinct From Events

An Event records an occurrence.

An Outcome represents a meaningful Business result.

Examples include:

- Appointment completed.
- Lead qualified.
- Purchase completed.
- Subscription started.
- Revenue realized.
- Cancellation.
- Refund.

Outcome records must preserve relevant source and verification context.

---

## 03.35 Conversion Is Not Automatically Revenue

Kablet must distinguish:

- Conversion.
- Estimated value.
- Confirmed Revenue.
- Realized Revenue.
- Refund or reversal.

A booking submission does not automatically establish realized Revenue.

---

## 03.36 Outcome Evolution

Business Outcomes may change after the initial conversion.

For example:

Booking Created
    ↓
Booking Confirmed
    ↓
Appointment Attended
    ↓
Revenue Recorded

The persistence model must support these developments without falsifying the original historical occurrence.

---

## 03.37 Outcome Verification

Outcomes may originate from:

- Kablet-controlled Actions.
- External integrations.
- Verified webhook events.
- Authorized Business updates.

Source provenance and verification status must be retained.

---

# 03.K Decision-to-Outcome Lineage

## 03.38 Canonical Lineage Requirement

Kablet's strategically important persistence relationship is:

Business
    ↓
Visitor
    ↓
Session
    ↓
State Revision
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
    ↓
Revenue

Not every Session will produce every stage.

Missing stages must remain distinguishable from confirmed stages.

---

## 03.39 Lineage Must Be Queryable

The database architecture must eventually support questions such as:

- Which Decisions were produced for a Business?
- Which Experiences resulted from those Decisions?
- Which Experiences were actually exposed?
- Which Components received interaction?
- Which Actions were attempted?
- Which Actions completed?
- Which Outcomes were verified?
- Which Decisions participated in an Experiment?
- Which Business Truth revisions informed a Decision?

These relationships are essential to Kablet's future Learning Brain.

---

## 03.40 Attribution Is Not Causation

The persistence model must preserve relationships without automatically declaring that a Decision caused a Conversion.

Controlled experiments and appropriate analysis are required to establish incremental effects.

---

# 03.L Transaction Architecture

## 03.41 PostgreSQL Transactions

Operations that must succeed or fail together should use appropriate PostgreSQL transactions.

Examples may include:

- Creating canonical State revisions.
- Accepting Decisions.
- Persisting associated Experiences.
- Recording required domain Events.
- Recording verified Action results and Outcomes.

Exact transaction boundaries will be defined at implementation level.

---

## 03.42 External Calls Must Not Be Treated as Database Transactions

External AI, booking, commerce, and messaging calls cannot be assumed to participate in a local PostgreSQL transaction.

The architecture must account for partial failures and retries.

Long-running external calls should not unnecessarily hold database transactions open.

---

## 03.43 Transactional Outbox Direction

When a canonical database change must reliably trigger asynchronous work, Kablet should use a transactional outbox pattern or an equivalent reliability mechanism.

Conceptually:

Database Transaction
    |
    +-- Canonical Domain Change
    |
    +-- Outbox Record
              |
              v
       Background Processing

This avoids the failure mode in which a canonical change commits but its required asynchronous notification is silently lost.

The exact implementation belongs to the Event and Async Architecture sections.

---

## 03.44 Idempotent Consequential Operations

Duplicate-sensitive operations must support idempotency where appropriate.

This is particularly important for:

- Booking creation.
- Payment-related Actions.
- Lead creation.
- Webhook processing.
- Conversion recording.
- External Outcome ingestion.

Retries must not be interpreted automatically as new commercial activity.

---

# 03.M Historical Versioning

## 03.45 Version Dimensions

Persistence must distinguish, where applicable:

- Record identity.
- Data revision.
- Schema version.
- Contract version.
- Intelligence configuration version.
- Experiment version.
- Relevant policy version.

These dimensions are not interchangeable.

---

## 03.46 Historical Interpretation

A Decision created yesterday must not silently inherit today's:

- Price.
- Offer.
- Visitor State.
- Component definition.
- Experiment configuration.
- Intelligence configuration.

The architecture must preserve sufficient historical references or snapshots to interpret that Decision accurately.

---

## 03.47 Unknown Historical Data

If historical information was not captured, the system must represent it as unknown rather than fabricate it during migration or reconstruction.

---

# 03.N Data Access Architecture

## 03.48 Repository Boundaries

Domain modules will use controlled persistence interfaces.

A repository or equivalent data-access abstraction should enforce appropriate query context.

Tenant-sensitive operations must not expose unrestricted access merely because a record ID is known.

---

## 03.49 Administrative Access

Privileged platform administration must use explicit authorization and auditability.

Administrative capabilities must not silently bypass tenant isolation.

---

## 03.50 Background Data Access

Background workers must receive sufficient trusted ownership context to perform their operations safely.

Tenant context must not disappear when execution moves outside an HTTP request.

---

# 03.O Data Growth and Evolution

## 03.51 Start With One Primary Database

Kablet v0.1 will not introduce multiple operational databases without a demonstrated requirement.

PostgreSQL is sufficient as the initial canonical persistence platform.

---

## 03.52 Indexing

Indexes should follow actual access patterns.

Important expected query dimensions include:

- Organization.
- Business.
- Visitor.
- Session.
- Decision.
- Experience.
- Event type.
- Occurrence time.
- Outcome.
- Experiment.

Exact indexes belong to physical schema design.

---

## 03.53 Partitioning

Table partitioning is not mandatory from day one.

It may be introduced for high-volume data such as Events when supported by measured volume and operational requirements.

---

## 03.54 Analytical Projections

Future analytical workloads may require:

- Materialized views.
- Reporting tables.
- Read replicas.
- Analytical warehouses.
- Specialized projections.

These remain derived representations of canonical domain data.

---

## 03.55 Future Learning Infrastructure

Future Learning Architecture may introduce:

- Feature extraction.
- Embeddings.
- Vector retrieval.
- Experiment aggregates.
- Learned strategy records.
- Model-training datasets.

These capabilities must preserve ownership, provenance, versioning, and applicable privacy boundaries.

The MVP does not require their full implementation.

---

# 03.P Data Architecture Decision Records

## ADR-010 — PostgreSQL as Canonical Transactional Store

**Status:** Accepted.

Kablet v0.1 will use one primary PostgreSQL database for canonical operational data.

Additional specialized storage systems require demonstrated need.

## ADR-011 — Relational Core With Validated JSONB

**Status:** Accepted.

Stable relationships use relational modeling.

Variable contract payloads may use JSONB with explicit validation and versioning.

Critical lineage must remain queryable.

## ADR-012 — Preserve Historical Decision Context

**Status:** Accepted.

Accepted Decisions must remain interpretable against relevant historical State, Business Truth, Experience, Experiment, and Intelligence configuration.

Current-state mutation must not silently rewrite historical meaning.

## ADR-013 — PostgreSQL-Backed Canonical Events

**Status:** Accepted.

Canonical Events will initially be persisted in PostgreSQL.

A separate distributed event platform is not required for v0.1.

## ADR-014 — Reliable Async Publication

**Status:** Accepted as an architectural requirement.

Canonical changes requiring reliable asynchronous publication will use a transactional outbox or an equivalent mechanism.

The concrete implementation is deferred.

## ADR-015 — Tenant Isolation Through Defense in Depth

**Status:** Accepted.

Tenant isolation must combine trusted context, application authorization, scoped persistence, and appropriate database-level enforcement.

The exact RLS and database-role implementation is defined in Section 04.

---

# 03.Q Data Architecture Invariants

1. PostgreSQL is the initial canonical transactional store.
2. Organization remains the primary tenant boundary.
3. Business remains the primary commercial data context.
4. Ownership and authorship remain separate.
5. IDs do not grant authorization.
6. Domain modules own persistence behavior.
7. Stable domain relationships are relational by default.
8. JSONB payloads require appropriate validation.
9. Critical lineage must remain queryable.
10. Source data is not automatically authoritative Business Truth.
11. Business Truth revisions preserve historical interpretation.
12. Visitor identity is Business-scoped by default.
13. Anonymous Visitors are supported.
14. Visitor State exists independently of AI provider memory.
15. Accepted Decisions are first-class historical records.
16. Decision and Experience remain distinct.
17. Planned Experience is not proof of rendered Experience.
18. Canonical Events are distinct from operational logs.
19. Events use stable identity and versioned semantics.
20. Duplicate delivery must not automatically create duplicate reality.
21. Outcome is distinct from Event.
22. Conversion is distinct from realized Revenue.
23. Outcome provenance must be retained.
24. Decision-to-Outcome lineage must be reconstructable.
25. Attribution must not be mistaken for causation.
26. Related canonical operations use appropriate transactions.
27. External calls are not assumed to participate in database transactions.
28. Required asynchronous publication must be reliable.
29. Consequential operations require appropriate idempotency.
30. Historical meaning must survive current-state changes.
31. Background access preserves tenant context.
32. Analytical projections do not replace canonical records.
33. Future Learning infrastructure must preserve ownership and privacy.
34. Database complexity should grow from demonstrated requirements.

---

# 03.R Explicitly Not Defined Yet

Section 03 does not finalize:

- Exact SQL tables.
- Column names.
- Primary-key representation.
- Foreign-key definitions.
- Index definitions.
- PostgreSQL schema organization.
- RLS policy SQL.
- Database roles.
- Connection-pooling configuration.
- Migration implementation.
- Exact revision-storage strategy.
- Event payload schemas.
- Outbox table schema.
- Retention durations.
- Partitioning strategy.
- Backup configuration.
- Replication configuration.

These decisions will be specified in the relevant technical sections and implementation contracts.

---

# 03.S Dependency

Section 02 selected:

TypeScript, Node.js, Next.js, React, PostgreSQL, Drizzle, Zod, and provider-isolated Intelligence.

Section 03 establishes:

**A PostgreSQL-centered canonical data architecture that preserves tenant ownership, authoritative Business Truth, historical State, first-class Decisions, validated Experiences, canonical Events, verified Outcomes, and reconstructable commercial lineage.**

The next section defines the mechanisms that prevent one actor, Business, Visitor, or integration from accessing or modifying data outside its authority.

# 04 — Authentication & Authorization
---

# 04. Authentication & Authorization

## 04.1 Purpose

This section defines how Kablet v0.1 will authenticate actors, establish trusted ownership context, authorize operations, and enforce tenant isolation.

It translates the Foundation's Identity & Ownership and Privacy & Tenant Isolation principles into concrete technical architecture.

The system must protect:

- Organizations.
- Businesses.
- Business Truth.
- Visitors.
- Sessions.
- Visitor State.
- Decisions.
- Experiences.
- Actions.
- Events.
- Outcomes.
- Integrations.
- Intelligence context.

Authentication, authorization, ownership, and data isolation are related but distinct responsibilities.

---

# 04.A Core Security Model

## 04.2 Authentication

Authentication establishes the identity of an actor.

For example:

Who is attempting to access the Kablet Control Plane?

Authentication does not automatically determine which Businesses that actor may access.

---

## 04.3 Authorization

Authorization determines whether an authenticated or otherwise trusted actor may perform a specific operation on a particular resource.

Conceptually:

Actor
+
Operation
+
Resource
+
Ownership Context
+
Applicable Capability
=
Authorization Decision

Authorization must occur on trusted server-side boundaries.

---

## 04.4 Ownership

Ownership establishes which Organization and Business a resource belongs to.

Ownership must not be inferred solely from:

- The current URL.
- Client-provided IDs.
- Authentication-provider metadata.
- Frontend state.
- AI output.

Canonical Kablet domain relationships determine ownership.

---

## 04.5 Tenant Isolation

Tenant isolation ensures that one Organization cannot access another Organization's private operational data without explicit, authorized arrangements.

Kablet will enforce isolation through multiple layers.

Application authorization and PostgreSQL RLS serve complementary purposes.

Neither frontend filtering nor AI instructions constitute a security boundary.

---

# 04.B Authentication Provider

## 04.6 Initial Provider Selection

Kablet v0.1 will use Supabase Auth as its initial managed authentication provider.

Supabase Auth will handle the initial Business User authentication lifecycle.

This avoids building custom credential infrastructure before Kablet has validated its product.

---

## 04.7 Provider Identity Is Not Kablet Identity

Supabase authentication identity must remain separate from Kablet's canonical User record.

Conceptually:

Supabase Auth Identity
        |
        v
Kablet Identity Mapping
        |
        v
Canonical Kablet User
        |
        v
Membership
        |
        v
Organization / Business Access

A Kablet User may have an associated external authentication identity.

That association must not redefine the canonical Kablet User model.

---

## 04.8 Authentication Adapter

Authentication-provider-specific behavior must remain behind a controlled application boundary.

Domain modules must not directly depend on Supabase Auth SDK objects.

The adapter should support the capabilities required by Kablet, including:

- Session verification.
- Authenticated identity resolution.
- User identity mapping.
- Authentication failure handling.

The exact interface will be defined during implementation.

---

## 04.9 Authentication Scope

The initial managed authentication system serves Business Users accessing the Control Plane.

Anonymous customer Visitors do not require Supabase accounts.

Visitor identity and Session continuity belong to Kablet's customer Runtime architecture.

---

# 04.C Actor Types

## 04.10 Business User

A Business User is a human identity that may receive access to one or more Organizations or Businesses through Memberships.

Authentication establishes who the User is.

Membership and authorization establish what the User may do.

---

## 04.11 Visitor

A Visitor is a customer-side identity interacting with a Business's frontend.

Visitors may be anonymous.

Visitor identity is Business-scoped by default.

A Visitor must not gain Business administration capabilities merely by possessing a valid customer Session.

---

## 04.12 System Actor

A System Actor represents trusted non-human execution.

Examples include:

- Background workers.
- Scheduled jobs.
- Integration processors.
- Internal system operations.

System Actors must operate through explicitly scoped capabilities and trusted execution context.

System identity does not automatically imply unrestricted tenant access.

---

## 04.13 External Integration Actor

An external integration may submit information or trigger an operation through an authenticated integration boundary.

The integration must be associated with its authorized Business context and allowed capabilities.

Webhook payload contents alone must not establish authorization.

---

# 04.D Organization and Membership Authorization

## 04.14 Organization Boundary

Organization remains Kablet's primary tenant ownership boundary.

Every Business belongs to one Organization at a given ownership state.

Organization-level access must be established through explicit Membership or another authorized relationship.

---

## 04.15 Membership Model

Membership connects a User to an authorized organizational or business context.

A Membership must support:

- User identity.
- Organization context.
- Business scope where applicable.
- Granted capabilities.
- Membership status.
- Relevant lifecycle information.

The exact physical schema is defined during implementation.

---

## 04.16 Capabilities

Kablet will use explicit capabilities rather than treating a broad role label as sufficient authorization.

Conceptual capabilities may include:

- Organization management.
- Business management.
- Business Truth reading.
- Business Truth editing.
- Integration management.
- Experiment management.
- Reporting access.
- User management.
- Action configuration.

The exact capability vocabulary will be finalized in the authorization contract.

---

## 04.17 Roles

Roles may provide convenient collections of capabilities.

However:

Role name is not the final authorization decision.

The system must evaluate the applicable capabilities and resource context.

This supports future:

- Multiple Businesses.
- Agencies.
- Enterprise Organizations.
- Delegated administration.
- Restricted operators.

---

## 04.18 Authorization Context

A typical Control Plane operation requires:

Authenticated User
        ↓
Canonical User
        ↓
Membership Resolution
        ↓
Organization / Business Context
        ↓
Capability Evaluation
        ↓
Resource Ownership Validation
        ↓
Authorized Operation

This evaluation must occur server-side.

---

# 04.E PostgreSQL Row-Level Security

## 04.19 RLS Decision

Kablet v0.1 will use PostgreSQL Row-Level Security as an additional tenant-isolation mechanism for tenant-sensitive canonical tables.

RLS complements application authorization.

It does not replace it.

---

## 04.20 Defense in Depth

The intended security model is:

Trusted Actor Resolution
        ↓
Kablet Authorization
        ↓
Tenant-Scoped Application Operation
        ↓
PostgreSQL RLS
        ↓
Database Constraints
        ↓
Canonical Data

Each layer protects against a different class of failure.

---

## 04.21 Database Execution Identity

The application must use database execution identities appropriate to the operation.

Ordinary tenant-scoped application requests must not use an unrestricted database identity that silently bypasses RLS.

Migration and maintenance privileges must be separated from normal runtime privileges.

---

## 04.22 Trusted Tenant Context

Where RLS relies on database session or transaction context, that context must be established by trusted server-side code.

Client-provided Organization or Business identifiers are untrusted until resolved and authorized.

A validated identifier is not, by itself, proof of authorization.

---

## 04.23 Transaction-Scoped Context

If PostgreSQL session settings are used to communicate tenant context to RLS policies, the implementation should prefer transaction-local settings.

Tenant context must not leak between unrelated requests through pooled database connections.

The precise SQL and connection-pooling strategy will be defined during implementation.

---

## 04.24 RLS Default-Deny Principle

Tenant-sensitive tables should deny unauthorized access by default.

Policies must explicitly define permitted access.

The absence of a tenant context must not accidentally result in unrestricted data access.

---

## 04.25 RLS and Relational Constraints

RLS controls permitted row access.

Relational constraints protect structural consistency.

Both are necessary.

For example, database constraints should help prevent records from being linked across incompatible ownership scopes.

RLS alone does not establish the correctness of every relationship.

---

## 04.26 RLS Testing

RLS behavior must be tested against real PostgreSQL.

Tests must verify that:

- Tenant A cannot read Tenant B's records.
- Tenant A cannot modify Tenant B's records.
- Unauthorized inserts fail.
- Cross-tenant relationship attempts fail where prohibited.
- Missing tenant context fails safely.
- Background operations preserve correct tenant scope.
- Connection reuse does not leak tenant context.

Mock-only tests are insufficient for these guarantees.

---

# 04.F Business-Level Isolation

## 04.27 Organization Access Does Not Erase Business Scope

An Organization may own multiple Businesses.

The architecture must distinguish Organization-wide access from Business-specific access.

A User authorized for Business A must not automatically receive access to Business B merely because both share an Organization.

The applicable Membership and capability model determines access.

---

## 04.28 Business-Scoped Resources

Visitor-related records must resolve to their owning Business.

This includes:

- Visitors.
- Sessions.
- Visitor State.
- Decisions.
- Experiences.
- Actions.
- Events.
- Outcomes.

Business scope must be preserved through internal operations and background processing.

---

# 04.G Customer Runtime Security

## 04.29 Anonymous Visitor Sessions

The public customer Runtime must support anonymous Visitors.

Anonymous access does not mean unrestricted access.

A Visitor Session must be associated with the correct Business and permitted customer-facing operations.

---

## 04.30 Public Business Truth

Some Business Truth is intentionally customer-facing.

The Runtime may expose authorized public information through controlled application interfaces.

Public access to selected Business Truth must not grant access to:

- Internal Business configuration.
- Private operational records.
- Other Visitors.
- Decision histories.
- Integration credentials.
- Administrative capabilities.

---

## 04.31 Visitor Session Protection

Visitor Session identifiers and credentials must be generated and handled securely.

The implementation must not assume that knowledge of an arbitrary Session ID establishes ownership of that Session.

Session-continuity mechanisms will be specified in the Runtime Architecture.

---

## 04.32 Public Runtime Rate Limiting

Public endpoints require appropriate abuse protection.

Rate limiting and related controls must consider:

- Public Session creation.
- Intelligence invocation.
- Signal submission.
- Action execution.
- Expensive external operations.

The exact technology and thresholds will be defined later.

---

# 04.H Intelligence Authorization

## 04.33 Intelligence Is Not an Authorization Authority

AI-generated output must not grant permissions.

Intelligence may propose an Action.

Kablet must independently determine whether that Action is available and authorized.

---

## 04.34 Context Assembly Enforcement

Context Assembly must select information according to:

- Business ownership.
- Authorization.
- Relevance.
- Purpose.
- Applicable privacy constraints.

Intelligence providers must not receive unrestricted access to Kablet's database.

---

## 04.35 Tool Execution

If Intelligence uses tools, those tools must execute through controlled Kablet capabilities.

Tool execution must preserve:

- Business context.
- Applicable actor authority.
- Action constraints.
- Input validation.
- Auditability.

A model's request to invoke a tool is not sufficient authorization.

---

## 04.36 Business Authority and Visitor Authority

Some operations may require both Business authorization and Visitor confirmation.

For example, a Business may permit appointment booking, but the Visitor must still intentionally submit the required booking information.

The system must not confuse permission to offer an Action with permission to execute it on behalf of a Visitor.

---

# 04.I Background Workers and Integrations

## 04.37 Background Worker Identity

Workers must execute with trusted system identity.

Each tenant-sensitive job must carry or resolve its authorized Business context.

A worker's infrastructure privileges must not become unrestricted domain authority.

---

## 04.38 Job Context

Tenant-sensitive jobs should preserve:

- Organization.
- Business.
- Operation.
- Relevant resource.
- Initiating actor or trusted source.
- Correlation identity.
- Applicable authority.

This context must be validated before consequential execution.

---

## 04.39 Integration Credentials

Integration credentials must be stored and accessed through controlled infrastructure.

They must not be included in ordinary:

- Visitor State.
- Experience payloads.
- Event payloads.
- Intelligence context.

---

## 04.40 Webhook Authentication

External webhook ingestion must verify the sender using the provider's supported authentication or signature mechanism where available.

The receiving system must resolve the authorized integration and Business context before applying canonical changes.

Webhook data remains untrusted input until validated.

---

# 04.J Privileged Operations

## 04.41 Administrative Access

Privileged platform operations must be explicit and auditable.

Platform administration must not silently become ordinary unrestricted tenant access.

The initial implementation should minimize privileged execution paths.

---

## 04.42 Migration Identity

Database migrations require a separate privileged execution context.

Normal application requests must not execute with migration-level privileges.

---

## 04.43 Service Credentials

High-privilege provider credentials must remain server-side.

They must never be exposed through:

- Browser bundles.
- Public Runtime responses.
- Component payloads.
- AI-generated Experiences.
- Client-side configuration.

---

# 04.K Authorization Failure Behavior

## 04.44 Fail Closed

If authorization cannot be established, the operation must not proceed.

Examples include:

- Missing Membership.
- Invalid Session.
- Incorrect Business scope.
- Insufficient capability.
- Invalid integration authority.
- Missing trusted tenant context.

The system must not infer permission from incomplete information.

---

## 04.45 Safe Error Responses

Authorization failures must not unnecessarily reveal private resource existence or tenant information.

Operational logs may retain appropriate diagnostic information subject to access and privacy controls.

---

## 04.46 Authorization Events

Meaningful security-sensitive operations should be observable.

Examples include:

- Membership changes.
- Privileged configuration changes.
- Delegated authority changes.
- Integration authorization changes.
- Repeated unauthorized access attempts.

Security audit records are distinct from ordinary customer interaction Events.

---

# 04.L Architecture Decision Records

## ADR-016 — Supabase Auth as Initial Authentication Provider

**Status:** Accepted for v0.1.

Kablet will use Supabase Auth for initial Business User authentication.

Canonical Kablet User and Membership records remain independent of the provider's domain representation.

Provider-specific behavior will be isolated behind an authentication adapter.

---

## ADR-017 — Kablet-Owned Authorization

**Status:** Accepted.

Authorization is implemented through Kablet's own ownership, Membership, resource, and capability model.

Authentication-provider identity alone does not grant Business access.

---

## ADR-018 — PostgreSQL RLS for Tenant Isolation

**Status:** Accepted.

Tenant-sensitive canonical tables will use PostgreSQL RLS as an additional enforcement layer.

Application authorization remains mandatory.

The exact policy and execution-role implementation will be specified in the physical schema and security implementation.

---

## ADR-019 — Separate Actor Types

**Status:** Accepted.

Business Users, customer Visitors, System Actors, and external Integration Actors remain distinct security concepts.

Their identities and authorities must not be conflated.

---

## ADR-020 — Trusted Context and Default Denial

**Status:** Accepted.

Tenant-sensitive operations require trusted ownership context.

Missing or invalid authorization must fail closed.

Client-supplied identifiers are not sufficient proof of authority.

---

# 04.M Authentication & Authorization Invariants

1. Authentication and authorization remain separate.
2. Supabase Auth is an initial provider, not the canonical Kablet identity model.
3. Organization is the primary tenant boundary.
4. Business-level scope remains enforceable.
5. User access is established through Membership and applicable capabilities.
6. Ownership does not automatically imply access.
7. IDs are not authorization credentials.
8. Business Users and Visitors remain distinct.
9. System Actors operate through scoped authority.
10. External integrations require authenticated and authorized boundaries.
11. Authorization is enforced server-side.
12. PostgreSQL RLS provides additional tenant isolation.
13. Ordinary application access must not silently bypass RLS.
14. Missing tenant context fails safely.
15. Database connection reuse must not leak tenant context.
16. RLS behavior must be tested against real PostgreSQL.
17. Public Visitor access does not grant administrative authority.
18. Intelligence does not grant permissions.
19. Intelligence tool calls require independent authorization.
20. Consequential Actions respect Business and applicable Visitor authority.
21. Workers preserve trusted tenant context.
22. Integration credentials remain outside ordinary domain and model context.
23. Webhook payloads remain untrusted until authenticated and validated.
24. Privileged administration is explicit and auditable.
25. Migration privileges remain separate from runtime privileges.
26. High-privilege credentials never enter client-side execution.
27. Authorization failure must fail closed.
28. Security-sensitive operations must be observable.
29. Authentication-provider replacement must not redefine Foundation identity concepts.
30. Tenant isolation must survive every execution boundary.

---

# 04.N Explicitly Not Finalized Yet

This section does not define:

- Exact Supabase Auth configuration.
- Exact login and onboarding screens.
- MFA policy.
- Exact Membership table schema.
- Final capability vocabulary.
- Exact RLS SQL policies.
- Database role definitions.
- JWT claim design.
- Session-cookie implementation.
- Visitor Session token format.
- Rate-limit thresholds.
- Integration credential encryption implementation.
- Security audit retention.
- Enterprise SSO.
- Agency access implementation.

These will be finalized through the relevant implementation contracts and security specifications.

---

# 04.O Dependency

Section 03 established Kablet's canonical PostgreSQL data architecture.

Section 04 establishes:

**Managed authentication, Kablet-owned authorization, explicit actor separation, server-enforced ownership, and PostgreSQL RLS as defense in depth.**

The next section defines how Kablet assembles authorized context, invokes reasoning systems, validates their output, and produces canonical Decisions without surrendering control to an AI provider.

# 05 — Intelligence Architecture
---

# 05. Intelligence Architecture

## 05.1 Purpose

This section defines the initial technical architecture of Kablet Intelligence.

It implements the permanent Intelligence Interface established in Foundation Specification v0.1.

The architecture must allow Kablet to:

- Interpret customer Signals.
- Maintain structured Visitor State.
- Assemble relevant Business context.
- Determine the next commercial objective.
- Propose Decisions.
- Generate controlled Experience Plans.
- Select available Components.
- Propose authorized Actions.
- Validate Intelligence output.
- Preserve Decision attribution.
- Handle provider failures.
- Incorporate future learned strategies.

The Intelligence system must remain independent of any individual model provider.

---

# 05.A Fundamental Architecture

## 05.2 Intelligence Is a Kablet Subsystem

Kablet Intelligence is not equivalent to an external LLM.

It is a Kablet-owned subsystem that coordinates:

1. Context Assembly.
2. Interpretation.
3. Decision policy.
4. External reasoning.
5. Structured output.
6. Validation.
7. Decision acceptance.
8. Experience planning.
9. Failure handling.

An external AI model may perform some of these operations.

It does not own the entire subsystem.

---

## 05.3 Two Intelligence Responsibilities

Kablet distinguishes two major intelligence responsibilities.

### Runtime Brain

Determines what should happen for a particular Visitor during a particular interaction.

It consumes relevant current context and proposes the next Decision.

### Learning Brain

Consumes accumulated historical evidence to improve future decision strategies.

It analyzes relationships between:

- Visitor context.
- State.
- Decisions.
- Experiences.
- Exposure.
- Interaction.
- Actions.
- Outcomes.
- Experiments.

The Runtime Brain is required for the initial customer-facing product.

The Learning Brain begins with a minimal implementation and evolves as evidence accumulates.

---

## 05.4 Canonical Intelligence Flow

The initial flow is:

Visitor Signal
       |
       v
Signal Validation
       |
       v
Visitor State Interpretation
       |
       v
Proposed State Update
       |
       v
State Validation
       |
       v
Context Assembly
       |
       v
Kablet Intelligence Interface
       |
       v
Reasoning / Decision Proposal
       |
       v
Structured Intelligence Result
       |
       v
Kablet Validation
       |
       v
Accepted Decision
       |
       v
Validated Experience Plan
       |
       v
Customer Runtime

State interpretation and Decision generation may share an underlying provider invocation where appropriate.

However, their canonical outputs and validation responsibilities remain distinct.

---

# 05.B Intelligence Module Boundaries

## 05.5 Initial Internal Modules

The Intelligence subsystem will contain the following logical capabilities:

| Module | Responsibility |
|---|---|
| Context Assembler | Select relevant authorized information |
| Signal Interpreter | Interpret incoming Visitor Signals |
| State Proposal | Propose structured State updates |
| Decision Policy | Determine eligible strategies and constraints |
| Intelligence Orchestrator | Coordinate reasoning operations |
| Provider Adapter | Communicate with external AI |
| Output Parser | Decode structured provider output |
| Intelligence Validator | Validate proposed results |
| Decision Acceptance | Convert valid proposals into canonical Decisions |
| Fallback Handler | Recover from failed or invalid Intelligence operations |
| Configuration Registry | Identify applicable Intelligence configuration |

These are logical responsibilities.

They do not require separate deployable services or separate packages from day one.

---

## 05.6 Module Ownership

The Intelligence subsystem owns reasoning orchestration.

It does not own:

- Canonical Business Truth.
- Canonical Visitor identity.
- Canonical Visitor State persistence.
- Customer-facing rendering.
- Consequential Action execution.
- Canonical Outcome verification.

It interacts with those domains through explicit interfaces.

---

# 05.C Context Assembly

## 05.7 Context Assembly Is Mandatory

The Runtime must not send unrestricted database contents to an AI provider.

Context Assembly creates the relevant information package required for a particular Intelligence operation.

The initial Context Assembler will operate inside the TypeScript application.

---

## 05.8 Context Sources

An Intelligence request may require:

- Organization and Business context.
- Relevant Property / Location.
- Business objective.
- Authorized Business Truth.
- Business Rules.
- Visitor context.
- Current Visitor State.
- Current Experience.
- Relevant Session history.
- Available Components.
- Available Actions.
- Experiment context.
- Applicable Intelligence configuration.
- Prior learned strategy where available.

Only necessary and authorized information should be included.

---

## 05.9 Context Selection

Context Assembly must consider:

1. Ownership.
2. Authorization.
3. Relevance.
4. Current objective.
5. Applicable Business constraints.
6. Privacy.
7. Available capabilities.
8. Context size and operational cost.

More context is not automatically better context.

---

## 05.10 Business Truth References

Where possible, Context Assembly should preserve stable references to canonical Business Truth.

For example:

Service ID
+
Service name
+
Authorized price
+
Relevant revision

This allows a proposed Decision to reference the actual canonical information that informed it.

---

## 05.11 Historical Context

The Intelligence system may receive selected historical information where relevant.

It must distinguish:

- Current Visitor State.
- Historical Visitor Signals.
- Prior Decisions.
- Prior Experiences.
- Verified Outcomes.
- Inferred information.

Historical information must not automatically override current authoritative Business Truth.

---

## 05.12 Context Assembly Security

Context Assembly must operate under trusted Business context.

A model must not be allowed to request unrestricted information from another Business.

Retrieval and context selection must preserve the same ownership boundaries established in Sections 03 and 04.

---

# 05.D Intelligence Interface

## 05.13 Kablet-Owned Interface

The Runtime communicates with Kablet Intelligence through an internal TypeScript contract.

It must not depend directly on the OpenAI SDK.

Conceptually:

Customer Runtime
       |
       v
Kablet Intelligence Interface
       |
       v
Intelligence Orchestrator
       |
       v
Provider Adapter

The exact TypeScript interface will be defined during implementation contracts.

---

## 05.14 Intelligence Request

A conceptual Intelligence Request contains:

- Request identity.
- Business context.
- Session context.
- Current Visitor State reference.
- Current Experience reference.
- Objective.
- Selected Business Truth.
- Applicable constraints.
- Available Components.
- Available Actions.
- Experiment context.
- Relevant learned strategy.
- Intelligence configuration reference.

The request should carry structured information rather than relying on an uncontrolled natural-language prompt containing the entire application state.

---

## 05.15 Intelligence Result

A conceptual Intelligence Result may contain:

- Proposed State updates.
- Proposed Decision objective.
- Proposed strategy.
- Selected Business Truth references.
- Proposed Experience Plan.
- Selected Components.
- Proposed Actions.
- Generated customer-facing content.
- Relevant confidence metadata.
- Operational metadata.

This is a proposal until Kablet accepts and validates it.

---

## 05.16 Proposed Is Not Canonical

The following must remain distinct:

Provider Output

Intelligence Proposal

Validated Proposal

Accepted Decision

Canonical Experience

A successful API response from an AI provider does not automatically create an accepted Kablet Decision.

---

# 05.E Provider Architecture

## 05.17 Initial Provider

Kablet v0.1 will initially implement an OpenAI provider adapter.

The adapter will handle:

- Provider request construction.
- Model invocation.
- Structured output handling.
- Provider errors.
- Timeout handling.
- Token and cost metadata where available.
- Provider response normalization.

OpenAI-specific objects must not spread into Kablet's permanent domain models.

---

## 05.18 Provider Interface

The internal provider interface should support an operation conceptually equivalent to:

Structured Intelligence Input
        |
        v
Provider Invocation
        |
        v
Structured Provider Result

The interface must not assume every future provider has identical:

- Conversation objects.
- Tool formats.
- Model parameters.
- Response metadata.
- Structured-output capabilities.

Provider adapters translate these differences.

---

## 05.19 Model Configuration

The selected model must be configurable rather than hardcoded throughout the application.

An Intelligence configuration may identify:

- Provider.
- Model.
- Operation type.
- Prompt/template version.
- Output contract version.
- Applicable decision policy.
- Timeout.
- Retry policy.
- Relevant generation parameters.

Exact model selection and parameter values will be finalized during implementation.

---

## 05.20 Model Routing

The initial system may use one primary model.

Complex routing is not required for MVP.

Future routing may distinguish:

- Signal interpretation.
- State extraction.
- Decision generation.
- Content generation.
- Complex reasoning.
- Low-cost routine operations.

All routes must preserve the same Kablet-owned Intelligence boundary.

---

# 05.F Structured Output

## 05.21 Structured Output Is Required

The Intelligence subsystem must request structured results for operations that influence canonical State, Decisions, Experiences, or Actions.

Free-form generated text must not be interpreted as unrestricted executable instructions.

---

## 05.22 Zod Validation

Kablet will use Zod to validate applicable Intelligence output contracts.

The provider adapter may use provider-native structured-output capabilities where supported.

However, provider-side schema enforcement does not replace Kablet's own validation.

---

## 05.23 Structural Validation

Structural validation verifies that the proposed result matches its expected contract.

Examples:

- Required fields exist.
- Field types are valid.
- Component types are recognized.
- Operations belong to supported vocabularies.
- Payload structures are valid.

---

## 05.24 Semantic Validation

Semantic validation verifies that the proposed result is permissible within Kablet's domain.

Examples:

- Referenced Service exists.
- Referenced Truth belongs to the correct Business.
- Price matches authoritative Truth.
- Proposed Component is available.
- Proposed Action is authorized.
- Business Rules are respected.
- Experience operations are supported.

A structurally valid JSON object may still be semantically invalid.

---

## 05.25 Authorization Validation

Authorization validation must not be delegated solely to the AI model.

Any consequential proposed Action must pass Kablet's trusted authorization boundary.

---

# 05.G Decision Architecture

## 05.26 Decision Policy

The Decision Policy determines which strategies are eligible for a given context.

Initially, this may combine:

- Deterministic rules.
- Business constraints.
- Available capabilities.
- AI reasoning.
- Experiment assignment.

The policy must not assume every Decision is produced exclusively by an LLM.

---

## 05.27 Decision Objective

Meaningful Decisions should identify their intended objective.

Examples:

- Clarify intent.
- Resolve a concern.
- Present relevant proof.
- Compare options.
- Recommend a Service.
- Explain pricing.
- Present an authorized offer.
- Initiate an available conversion Action.

The objective is part of the structured Decision representation.

---

## 05.28 Decision Acceptance

After validation, an Intelligence proposal may become an accepted canonical Decision.

Decision acceptance must preserve:

- Business context.
- Visitor / Session context.
- Relevant State reference.
- Intelligence configuration.
- Selected strategy.
- Relevant Business Truth references.
- Experiment context.
- Resulting Experience relationship.

---

## 05.29 Decision History

Accepted Decisions are historical records.

A later provider response must not silently rewrite an earlier accepted Decision.

New understanding produces new State and new Decisions.

---

# 05.H Experience Generation

## 05.30 Experience Plans

The Intelligence subsystem produces declarative Experience Plans.

It does not produce arbitrary executable frontend code.

An Experience Plan may specify:

- Customer-facing message.
- Selected Component instances.
- Component order.
- Relevant Business Truth references.
- Presentation hints.
- Available Actions.
- Supported Experience operations.

---

## 05.31 Component Registry Awareness

Intelligence must receive the relevant available Component capabilities.

It may select supported Components.

It may not invent an arbitrary Component type and assume the Runtime can render it.

---

## 05.32 Truth-Grounded Generation

Generated customer-facing content must respect canonical Business Truth.

Where an Experience communicates factual Business information, it should remain grounded in authorized Truth references.

The model must not silently invent:

- Prices.
- Discounts.
- Availability.
- Credentials.
- Testimonials.
- Guarantees.
- Business policies.

---

## 05.33 Experience Validation

A proposed Experience must pass the Experience Contract validator before being accepted for delivery.

The validation process belongs to Kablet, not the AI provider.

---

# 05.I Actions and Tool Use

## 05.34 Proposed Actions

Intelligence may propose Actions from the available Action registry.

It must not directly execute arbitrary consequential operations.

---

## 05.35 Action Execution Boundary

The required flow is:

Intelligence Proposes Action
        |
        v
Kablet Validates
        |
        v
Applicable Authorization
        |
        v
Visitor Confirmation Where Required
        |
        v
Action Executor
        |
        v
Verified Result

Reasoning authority and execution authority remain separate.

---

## 05.36 Tool Permissions

Provider tool calls must be mapped to controlled Kablet capabilities.

The existence of a tool in an AI provider request must not automatically authorize its execution.

---

# 05.J Runtime Failure Architecture

## 05.37 Failure Categories

The Intelligence subsystem must distinguish:

- Context Assembly failure.
- Provider timeout.
- Provider unavailable.
- Invalid structured output.
- Semantic validation failure.
- Authorization failure.
- Unsupported Component.
- Unsupported Action.
- Business Truth reference failure.
- Persistence failure.

These failures require different handling.

---

## 05.38 Retry Policy

Retries should be bounded.

The implementation must avoid uncontrolled recursive model calls or repeated expensive provider invocations.

Exact retry limits and timeouts will be configured during implementation.

---

## 05.39 Invalid Output

Invalid Intelligence output must never be rendered or executed merely because the provider returned successfully.

Possible recovery mechanisms include:

- Deterministic correction where safe.
- Bounded retry.
- Controlled fallback.
- Preservation of the last valid Experience where appropriate.
- Explicit failure response.

---

## 05.40 Fallback Experience

Kablet must support a minimal valid customer Experience when advanced Intelligence is unavailable.

The fallback may use:

- Canonical Business information.
- Supported Components.
- Safe customer-facing messaging.
- Available authorized Actions.

A provider outage should not automatically require the entire customer frontend to disappear.

---

## 05.41 Persistence Failure

If required canonical Decision or Experience persistence fails, the Runtime must not silently represent the corresponding historical operation as durably accepted.

Critical persistence failures require explicit handling.

---

# 05.K Intelligence Observability

## 05.42 Invocation Records

Meaningful Intelligence operations should be attributable to an invocation record.

Operational metadata may include:

- Invocation identity.
- Business / Session context.
- Operation type.
- Configuration version.
- Provider.
- Model.
- Start and completion time.
- Latency.
- Token usage where available.
- Estimated cost where available.
- Validation status.
- Failure classification.
- Accepted Decision reference.

Sensitive payload retention must follow applicable privacy policy.

---

## 05.43 Provider Output Is Not Canonical History

Raw provider output may be useful for debugging under controlled retention.

However, Kablet's canonical history consists of accepted structured State, Decisions, Experiences, Events, and Outcomes.

The system must not require indefinite retention of raw provider conversations to interpret its domain history.

---

## 05.44 Intelligence Configuration Versioning

Every accepted Decision should be attributable to the Intelligence configuration materially responsible for producing it.

This supports:

- Debugging.
- Provider comparison.
- Experimentation.
- Historical interpretation.
- Future learning.

---

# 05.L Learning Brain Integration

## 05.45 Initial Learning Boundary

The Runtime Brain will be designed to accept optional learned strategy information.

The Learning Brain will not be required to operate synchronously for every Visitor interaction.

---

## 05.46 Learning Inputs

Future learning may consume:

- Structured Visitor context.
- State revisions.
- Accepted Decisions.
- Validated Experiences.
- Actual exposures.
- Interactions.
- Action results.
- Verified Outcomes.
- Experiment assignments and exposures.

---

## 05.47 Learning Output

Learning should produce controlled artifacts such as:

- Strategy recommendations.
- Business-specific policy improvements.
- Experiment evidence.
- Component effectiveness estimates.
- Decision-policy configuration.

These artifacts may influence future Intelligence through explicit interfaces.

Learning must not silently mutate authoritative Business Truth.

---

## 05.48 Three Learning Levels

The architecture must remain compatible with:

### Business-Level Intelligence

Learns from evidence belonging to a specific Business.

### Vertical Intelligence

May generalize appropriate patterns across Businesses within a category, subject to governance.

### Network-Level Intelligence

May learn abstract commercial interaction principles across categories, subject to privacy and data-use constraints.

Only Business-level learning is an initial implementation priority.

---

## 05.49 Learning Evidence

Observed correlation must not automatically be treated as proof of incremental commercial lift.

Experimentation and appropriate analysis remain necessary.

---

# 05.M Performance and Cost

## 05.50 Intelligence Is a Latency-Sensitive Dependency

Intelligence invocation may be one of the most expensive operations in the customer Runtime.

The implementation should avoid unnecessary repeated calls.

---

## 05.51 Context Efficiency

Context Assembly should provide relevant information rather than unrestricted historical data.

This improves:

- Latency.
- Cost.
- Reliability.
- Privacy.
- Output consistency.

---

## 05.52 Cost Attribution

Where available, provider usage and cost should be attributable to:

- Business.
- Session.
- Intelligence operation.
- Configuration.
- Accepted Decision.

This supports future unit-economics analysis.

---

# 05.N Architecture Decision Records

## ADR-021 — Kablet-Owned Intelligence Interface

**Status:** Accepted.

The Runtime will communicate through a Kablet-owned Intelligence Interface.

Provider SDKs remain infrastructure implementations.

---

## ADR-022 — OpenAI as Initial Reasoning Adapter

**Status:** Accepted for v0.1.

OpenAI will provide the initial external reasoning capability.

Canonical Kablet objects must remain provider-independent.

---

## ADR-023 — Structured Intelligence Output

**Status:** Accepted.

Operations influencing canonical State, Decisions, Experiences, or Actions must produce controlled structured output.

Zod and domain validation will enforce Kablet contracts.

---

## ADR-024 — Separate Proposal From Acceptance

**Status:** Accepted.

Provider output remains a proposal until validated and accepted by Kablet.

Invalid output must not become canonical behavior automatically.

---

## ADR-025 — Explicit Context Assembly

**Status:** Accepted.

The Intelligence provider receives selected authorized context rather than unrestricted application data.

---

## ADR-026 — Separate Runtime and Learning Responsibilities

**Status:** Accepted.

Runtime Intelligence handles current Visitor Decisions.

Learning consumes historical evidence and improves future strategy through controlled interfaces.

Heavy learning processing remains outside the normal synchronous customer path.

---

## ADR-027 — Controlled Intelligence Fallback

**Status:** Accepted.

Provider failures and invalid output must have bounded recovery and controlled fallback behavior.

A failed model invocation must not corrupt canonical Business Truth, Visitor State, or historical Decisions.

---

# 05.O Intelligence Architecture Invariants

1. Kablet Intelligence is not equivalent to an LLM.
2. The Runtime communicates through a Kablet-owned Intelligence Interface.
3. Context Assembly is explicit.
4. Context Assembly preserves tenant isolation.
5. Intelligence receives only authorized relevant context.
6. Canonical Business Truth remains authoritative.
7. Canonical Visitor State remains Kablet-owned.
8. Provider output is a proposal, not a canonical Decision.
9. Proposed State updates require validation.
10. Structured output is required for consequential domain operations.
11. Provider-side schema enforcement does not replace Kablet validation.
12. Structural and semantic validation remain distinct.
13. Intelligence cannot invent unsupported Components.
14. Intelligence cannot invent unauthorized Actions.
15. Intelligence does not directly execute consequential operations.
16. Reasoning authority and execution authority remain separate.
17. Accepted Decisions are first-class historical records.
18. Decision configuration attribution is preserved.
19. Experience Plans are declarative.
20. Arbitrary AI-generated executable frontend code is prohibited.
21. Generated Business claims must respect authoritative Truth.
22. Intelligence failures have bounded recovery behavior.
23. Invalid output must not be executed or rendered automatically.
24. Provider replacement must not redefine canonical domain objects.
25. Runtime and Learning responsibilities remain distinct.
26. Heavy learning does not block normal customer interactions.
27. Business-specific learning remains Business-scoped.
28. Cross-tenant learning requires separate governance.
29. Learning evidence does not automatically establish causation.
30. Provider usage should be observable and attributable.
31. Sensitive model context must follow privacy constraints.
32. Future Intelligence implementations must preserve the same Foundation boundaries.

---

# 05.P Explicitly Not Finalized Yet

This section does not define:

- Exact OpenAI model.
- Exact model parameters.
- Final system prompts.
- Final prompt templates.
- Exact Intelligence Request JSON schema.
- Exact Intelligence Result JSON schema.
- Exact State extraction schema.
- Exact Decision strategy vocabulary.
- Confidence scoring formula.
- Context token budget.
- Retry count.
- Timeout values.
- Provider fallback order.
- Model-routing algorithm.
- Retrieval implementation.
- Embedding model.
- Vector database.
- Proprietary learning algorithm.
- Experiment optimization algorithm.
- Model training or fine-tuning.

These decisions will be finalized through implementation contracts and later learning architecture as evidence requires.

---

# 05.Q Dependency

Section 04 established trusted identity, authorization, and tenant isolation.

Section 05 establishes:

**A Kablet-owned Intelligence subsystem that assembles authorized context, invokes replaceable reasoning providers, validates structured proposals, accepts canonical Decisions, generates controlled Experience Plans, and remains compatible with future learning.**

The next section defines how those validated Experience Plans become actual customer-facing interfaces.

# 06 — Experience Runtime
---

# 06. Experience Runtime

## 06.1 Purpose

This section defines how Kablet converts accepted Decisions and validated Experience Plans into interactive customer-facing interfaces.

It implements the Experience & Component Contract established in Foundation Specification v0.1.

The Experience Runtime must support:

- One adaptive customer-facing canvas.
- Declarative Experience composition.
- Controlled Component rendering.
- Dynamic interface transitions.
- Structured customer interactions.
- Business Truth references.
- Authorized Actions.
- Experience lifecycle tracking.
- Component exposure measurement.
- Session continuity.
- Failure recovery.
- Future multi-surface extension.

The Runtime must remain independent of the external AI provider.

---

# 06.A Fundamental Runtime Model

## 06.2 One Adaptive Canvas

Kablet v0.1 will use a single adaptive customer-facing canvas as its primary web Experience.

The canvas is not a traditional collection of predetermined pages.

It is a controlled interface surface whose content and composition respond to the Visitor's evolving context.

Conceptually:

Visitor
    |
    v
Kablet Canvas
    |
    v
Current Experience
    |
    v
Customer Interaction
    |
    v
New Decision
    |
    v
Experience Transition
    |
    v
Updated Canvas

The canvas persists as the customer interacts.

Its composition may change without requiring conventional page navigation.

---

## 06.3 No Predetermined Journey

Kablet must not require every Visitor to follow the same predefined sequence of pages or funnel steps.

The Runtime should support different Experience compositions for different:

- Intent.
- Needs.
- Constraints.
- Concerns.
- Preferences.
- Journey States.
- Business objectives.

The Intelligence system determines which eligible Experience should be proposed.

The Runtime validates and presents that Experience.

---

## 06.4 No Scrolling Is Not a Foundation Rule

The Runtime should prioritize focused, relevant presentation.

However, it must not impose a universal prohibition on scrolling.

Some Experiences may benefit from:

- Compact single-screen composition.
- Progressive disclosure.
- Vertical sequences.
- Comparisons.
- Expanded proof.
- Multiple options.

The governing principle is:

**No predetermined journey—not no scrolling.**

---

## 06.5 Experience Is Not a Webpage

An Experience represents the current customer-facing state produced by a Kablet Decision.

It may contain:

- Messaging.
- Service information.
- Pricing.
- Proof.
- Recommendations.
- Comparisons.
- Questions.
- Forms.
- Available Actions.
- Media.
- Other supported Components.

An Experience is independent of the particular React implementation used to display it.

---

# 06.B Runtime Architecture

## 06.6 Initial Technology

The initial Experience Runtime will use:

- React.
- Next.js.
- TypeScript.
- Zod.
- Kablet-owned Experience Contracts.

React is responsible for rendering.

Next.js provides application delivery.

Neither defines the permanent semantic meaning of a Kablet Experience.

---

## 06.7 Runtime Pipeline

The intended pipeline is:

Accepted Decision
        |
        v
Experience Plan
        |
        v
Experience Contract Validation
        |
        v
Canonical Experience
        |
        v
Runtime Delivery
        |
        v
Experience State Manager
        |
        v
Component Registry
        |
        v
React Renderer
        |
        v
Customer Canvas

Customer interactions return through a controlled interaction protocol.

---

## 06.8 Runtime Responsibilities

The Experience Runtime owns:

- Receiving validated Experience representations.
- Maintaining the current presentation state.
- Resolving supported Components.
- Rendering Component instances.
- Applying Experience transitions.
- Capturing customer interactions.
- Reporting lifecycle evidence.
- Invoking controlled Runtime APIs.
- Presenting Action status.
- Handling rendering failures.

The Runtime does not own canonical Business Truth or Intelligence reasoning.

---

## 06.9 Server and Client Responsibilities

The initial architecture distinguishes trusted server-side behavior from browser presentation.

### Server

Responsible for:

- Business resolution.
- Trusted Session context.
- Canonical State access.
- Intelligence orchestration.
- Decision acceptance.
- Experience validation.
- Authorized Action execution.
- Canonical persistence.

### Client

Responsible for:

- Rendering validated Experiences.
- Local presentation state.
- Capturing Visitor interactions.
- Reporting exposure evidence.
- Displaying transitions.
- Communicating with trusted Runtime endpoints.

The browser must not become the authority for canonical Decisions, Business Truth, or Action execution.

---

# 06.C Experience Contract

## 06.10 Declarative Representation

Kablet Experiences will use structured declarative contracts.

The contract describes what should be presented.

It does not contain arbitrary executable frontend code.

---

## 06.11 Experience Envelope

A conceptual Experience representation should include:

- Experience identity.
- Business context.
- Session context.
- Originating Decision.
- Contract version.
- Experience revision.
- Component instances.
- Composition information.
- Available interaction references.
- Relevant lifecycle metadata.

The exact TypeScript and Zod schemas will be defined during implementation.

---

## 06.12 Experience Plan vs Canonical Experience

The Intelligence system proposes an Experience Plan.

Kablet validates that plan.

An accepted Experience becomes a canonical representation suitable for Runtime delivery.

The following must remain distinct:

Proposed Experience Plan

Validated Experience

Delivered Experience

Rendered Experience

Exposed Components

Customer Interaction

---

## 06.13 Experience Identity and Revision

An Experience must have stable identity.

Changes to an Experience must preserve sufficient revision context to identify what the Visitor was intended to see at a particular point.

This supports:

- Historical interpretation.
- Interaction validation.
- Debugging.
- Experimentation.
- Exposure attribution.

---

# 06.D Component Registry

## 06.14 Controlled Component Registry

The Runtime will use a controlled registry of supported Component types.

Conceptually:

Component Type
        |
        v
Versioned Contract
        |
        v
Payload Validation
        |
        v
React Implementation

Intelligence may select registered Components.

It may not invent arbitrary executable Components.

---

## 06.15 Component Definition vs Component Instance

A Component Definition describes a supported capability.

A Component Instance represents one use of that capability inside a particular Experience.

For example:

ServiceCard

is a Component type.

A ServiceCard displaying a specific Business service inside Experience X is a Component Instance.

These concepts must remain distinguishable.

---

## 06.16 Initial Component Families

The first Runtime should support a small commercially useful set.

Candidate Component families include:

| Family | Purpose |
|---|---|
| Message | Customer-facing explanation |
| Question | Collect clarification |
| Option Selector | Structured customer choice |
| Service Card | Present a Business service |
| Price | Present authoritative pricing |
| Proof | Present relevant credibility evidence |
| FAQ | Resolve common concerns |
| Comparison | Compare supported options |
| Recommendation | Present a contextual recommendation |
| Lead Form | Collect authorized lead information |
| Booking Action | Initiate an available booking |
| Contact Action | Initiate an available contact method |

This is a candidate capability set, not a requirement to implement every Component in the first engineering slice.

The MVP inventory will be finalized in Section 20.

---

## 06.17 Semantic Meaning vs Appearance

A Component's semantic meaning must remain separate from its visual implementation.

For example:

Service Card

describes a customer-facing commercial capability.

It does not permanently prescribe:

- Card dimensions.
- Typography.
- Animation.
- Color.
- Layout position.

This allows Kablet to evolve presentation without redefining domain meaning.

---

## 06.18 Component Payload Validation

Every Component Instance must have a payload compatible with its registered contract version.

Validation should establish:

- Recognized Component type.
- Supported version.
- Required fields.
- Valid Business Truth references.
- Supported Actions.
- Permitted presentation configuration.

Invalid Components must not be executed or rendered as trusted content.

---

## 06.19 Component Extension

New Components may be introduced through explicit registry extensions.

Extensions must preserve:

- Contract validation.
- Ownership.
- Versioning.
- Action boundaries.
- Event lineage.
- Runtime safety.

A new vertical must not require a parallel Experience Runtime.

---

# 06.E Experience Composition

## 06.20 Composition Model

An Experience may contain multiple Component Instances arranged into a coherent presentation.

Composition may describe:

- Component sequence.
- Grouping.
- Relative emphasis.
- Presentation variants.
- Visibility.
- Supported interactions.

The initial composition model should remain intentionally constrained.

It must not become an unrestricted page-layout programming language.

---

## 06.21 Composition Authority

The Intelligence system proposes eligible composition.

Kablet validates the proposal.

The React renderer determines the concrete implementation.

Conceptually:

Intelligence controls semantic composition.

Renderer controls executable presentation.

---

## 06.22 Business Branding

The Runtime should apply Business-specific branding through controlled presentation configuration.

Brand configuration may include:

- Logo.
- Colors.
- Typography preferences.
- Approved media.
- Other supported design tokens.

Brand configuration must not grant arbitrary code-execution authority.

---

## 06.23 Responsive Rendering

The initial web Runtime must support responsive customer Experiences.

The same semantic Experience may be rendered differently across device sizes.

Responsive presentation must not silently change canonical Business Truth or Action meaning.

---

# 06.F Experience Transitions

## 06.24 Persistent Canvas

The customer canvas should remain active as the Visitor interacts.

New Decisions produce Experience transitions rather than necessarily triggering full page navigation.

---

## 06.25 Controlled Transition Operations

The Experience Runtime should support a limited set of declarative transition operations.

The initial vocabulary may include:

- Replace composition.
- Add Component.
- Update Component.
- Remove Component.
- Change Component order.
- Update customer-facing message.
- Present Action status.

The exact operation schema will be defined during implementation.

---

## 06.26 Transition Validation

Every proposed transition must be validated before application.

Validation must confirm:

- Correct Experience identity.
- Compatible revision.
- Supported operation.
- Valid target Component.
- Valid resulting composition.
- Permitted Action references.

---

## 06.27 Full Replacement Remains Available

Incremental updates should not be mandatory.

Some Decisions may require a substantially different Experience.

The Runtime must support replacing the current composition when appropriate.

---

## 06.28 Avoid Unnecessary Regeneration

A customer interaction should not automatically require regeneration of every visible Component.

The Runtime should preserve valid existing presentation where appropriate.

This supports:

- Lower latency.
- Better continuity.
- Reduced visual disruption.
- Lower Intelligence cost.

---

# 06.G Runtime State

## 06.29 Canonical vs Local State

The Runtime must distinguish canonical domain state from temporary presentation state.

Canonical state includes:

- Visitor State.
- Accepted Decisions.
- Experience identity.
- Experience revisions.
- Action results.
- Canonical Events.

Local presentation state may include:

- Animation progress.
- Temporary focus.
- Expanded panels.
- Input drafts.
- Loading indicators.
- Non-authoritative visual transitions.

Local state must not silently redefine canonical commercial reality.

---

## 06.30 Experience State Manager

The client Runtime should maintain the current validated Experience representation.

It should support:

- Initial hydration.
- Transition application.
- Revision checks.
- Rendering status.
- Interaction references.
- Recovery from rejected updates.

The exact state-management library is deferred.

A separate global-state framework is not mandatory initially.

---

## 06.31 Stale Experience Protection

Customer interactions must identify the relevant Experience and Component revision where appropriate.

The server must not assume that every incoming interaction refers to the latest canonical Experience.

Stale or incompatible interactions require explicit handling.

---

## 06.32 Session Continuity

The Runtime should preserve customer continuity across supported interactions and reloads.

Canonical Session continuity belongs to Kablet's backend.

Browser-local state may assist presentation but must not become the sole canonical Session record.

---

# 06.H Customer Interaction Protocol

## 06.33 Structured Interaction

The Runtime must capture customer interactions through a controlled protocol.

An interaction should identify, where applicable:

- Business.
- Visitor Session.
- Experience.
- Experience revision.
- Component Instance.
- Interaction type.
- Validated payload.
- Occurrence time.
- Correlation identity.

The server must independently resolve and validate trusted ownership context.

---

## 06.34 Interaction Types

Candidate interaction types include:

- Message submitted.
- Option selected.
- Question answered.
- Component activated.
- Form submitted.
- Action requested.
- Comparison selection changed.
- Recommendation selected.

The final vocabulary will be defined through implementation contracts.

---

## 06.35 Interaction Is Not Automatically a Decision

A customer interaction produces a Signal.

Kablet may interpret that Signal, update Visitor State, and create a new Decision.

The Runtime must not conflate:

Interaction

State Update

Decision

Experience Transition

---

## 06.36 Input Validation

Customer input is untrusted.

All submitted interaction payloads must be validated on trusted server-side boundaries.

The Runtime must not treat client-provided Component IDs, Business IDs, or Action references as sufficient authority.

---

# 06.I Experience Lifecycle and Measurement

## 06.37 Lifecycle States

The architecture must distinguish:

- Planned.
- Validated.
- Delivered.
- Rendered.
- Exposed.
- Interacted with.
- Superseded.

These are conceptual lifecycle distinctions.

The physical implementation may use appropriate records and Events rather than one mutable status field for every occurrence.

---

## 06.38 Rendered Is Not Viewed

Successful server delivery does not prove browser rendering.

Successful rendering does not automatically prove that a Component entered the Visitor's visible area.

Exposure measurement must preserve these distinctions.

---

## 06.39 Component Exposure

The Runtime should support reporting actual Component exposure where measurable.

Exposure evidence may include:

- Experience identity.
- Component Instance identity.
- Component version.
- Relevant timestamp.
- Applicable Experiment context.

Exposure rules must be consistent enough to support meaningful analysis.

---

## 06.40 Interaction Attribution

Customer interactions must remain attributable to the Component and Experience that generated them.

This is essential for Kablet's future optimization system.

---

## 06.41 Experiment Exposure

Experiment assignment must not automatically be treated as actual exposure.

The Runtime must preserve the distinction between:

Assigned Variant

Delivered Experience

Observed Exposure

Customer Outcome

---

# 06.J Actions Inside Experiences

## 06.42 Components May Offer Actions

A Component may expose one or more supported Actions.

For example:

Service Card
    |
    +-- Learn More
    +-- Request Booking

The Component presents the capability.

The Action system owns consequential execution.

---

## 06.43 Action Invocation

An Action request must reference an available controlled Action.

The server must validate:

- Business context.
- Session context.
- Action availability.
- Input.
- Authorization.
- Applicable Visitor confirmation.

---

## 06.44 Action Status

The Runtime should support presenting Action lifecycle information.

Examples:

- Requested.
- Processing.
- Completed.
- Failed.
- Requires additional input.

A click must not automatically be represented as successful conversion.

---

# 06.K Rendering Safety

## 06.45 No Arbitrary Executable AI Output

The Runtime must not execute AI-generated:

- JavaScript.
- React source.
- Unrestricted HTML.
- Arbitrary browser instructions.

Intelligence output must remain within controlled Kablet contracts.

---

## 06.46 Content Safety

Generated and externally sourced content must be handled according to its trust level.

Rendering must avoid unsafe interpretation of untrusted markup.

Business-provided media and external URLs require appropriate validation.

---

## 06.47 Component Isolation

A failing Component should not unnecessarily destroy the entire Experience.

The Runtime should support appropriate error boundaries and controlled fallback behavior.

---

# 06.L Runtime Failure and Recovery

## 06.48 Invalid Experience

An invalid Experience must not be delivered as trusted executable presentation.

The system may:

- Reject the proposal.
- Retry Intelligence within bounded limits.
- Use a deterministic fallback.
- Preserve the last valid Experience where appropriate.

---

## 06.49 Transition Failure

If a transition cannot be safely applied, the Runtime should recover using an authoritative validated Experience representation.

It must not silently continue with corrupted composition state.

---

## 06.50 Intelligence Unavailable

If Intelligence becomes unavailable, the Runtime should present a controlled fallback where possible.

The fallback must use authoritative Business information and supported Components.

---

## 06.51 Action Failure

Action failure must be represented accurately.

The Runtime must not claim:

- Booking confirmed.
- Payment completed.
- Lead delivered.
- Conversion achieved.

unless the applicable result has been established.

---

# 06.M Performance

## 06.52 Runtime Responsiveness

The customer-facing canvas is conversion-sensitive.

The implementation should minimize unnecessary:

- Full-page navigation.
- Re-rendering.
- Intelligence calls.
- Large payloads.
- Blocking analytics requests.

---

## 06.53 Progressive Experience Delivery

The architecture should remain compatible with progressive presentation where appropriate.

However, progressive rendering must preserve the distinction between proposed, validated, and accepted canonical Experience state.

Unvalidated model output must not be streamed directly into consequential UI behavior.

---

## 06.54 Rendering Performance

The initial renderer should prioritize:

- Predictable Component behavior.
- Responsive layout.
- Controlled transitions.
- Accessible interaction.
- Small initial Component inventory.

Performance budgets will be established during implementation and testing.

---

# 06.N Future Surface Extension

## 06.55 Web Is the First Surface

Kablet v0.1 will implement the customer-facing Experience Runtime for the web.

The Experience Contract must remain semantically independent of React.

---

## 06.56 Future Surfaces

Potential future surfaces include:

- Mobile applications.
- Messaging.
- Voice.
- Kiosks.
- Embedded Experiences.
- Agent-facing interfaces.

Not every Component will necessarily be supported by every surface.

Surface capability must be explicit.

---

## 06.57 Surface Is Not Experience

The same semantic Decision may be presented through different surface-specific implementations.

Future surfaces should extend Kablet's presentation capabilities without redefining canonical Decisions, Business Truth, or Outcomes.

---

# 06.O Architecture Decision Records

## ADR-028 — Single Adaptive Canvas

**Status:** Accepted.

The initial web Runtime will use one persistent adaptive customer-facing canvas rather than a predetermined collection of customer journeys.

---

## ADR-029 — Declarative Experience Contracts

**Status:** Accepted.

Intelligence produces controlled declarative Experience Plans.

React renders validated Experience Contracts.

Arbitrary AI-generated executable UI is prohibited.

---

## ADR-030 — Controlled Component Registry

**Status:** Accepted.

The Runtime will render supported, versioned Component types through a Kablet-owned registry.

Intelligence may select registered capabilities but may not invent executable Components.

---

## ADR-031 — Controlled Experience Transitions

**Status:** Accepted.

The Runtime will support validated Experience transitions, including incremental composition changes and full replacement where appropriate.

---

## ADR-032 — Separate Canonical and Presentation State

**Status:** Accepted.

Canonical Visitor, Decision, Experience, Action, and Event state remains server-owned.

Temporary visual state may remain client-side.

---

## ADR-033 — Explicit Exposure Measurement

**Status:** Accepted.

Experience delivery, rendering, Component exposure, and customer interaction remain distinguishable occurrences.

Experiment assignment is not automatically treated as exposure.

---

## ADR-034 — Web-First, Surface-Independent Semantics

**Status:** Accepted.

React and Next.js implement the initial web Runtime.

Canonical Experience semantics remain independent of the rendering framework.

---

# 06.P Experience Runtime Invariants

1. The initial customer-facing surface is one adaptive canvas.
2. The customer journey is not predetermined.
3. Scrolling is a presentation decision, not a Foundation prohibition.
4. Experience is distinct from webpage.
5. The Runtime renders validated declarative contracts.
6. Intelligence does not execute arbitrary frontend code.
7. Component types come from a controlled registry.
8. Component Definitions and Instances remain distinct.
9. Component payloads require validation.
10. Component meaning remains separate from appearance.
11. Business branding uses controlled presentation configuration.
12. Experience identity and revision are preserved.
13. Planned Experience is distinct from delivered Experience.
14. Delivered Experience is distinct from rendered Experience.
15. Rendered Experience is distinct from Component exposure.
16. Customer interaction is distinct from Decision.
17. The Runtime supports controlled Experience transitions.
18. Full composition replacement remains available.
19. Existing valid presentation may be preserved when appropriate.
20. Canonical domain state remains server-owned.
21. Local presentation state is non-authoritative.
22. Stale interactions require explicit handling.
23. Customer input is untrusted.
24. Actions execute through the Action system.
25. Action requests are not automatically successful Outcomes.
26. Component and Experience lineage must remain measurable.
27. Experiment assignment and exposure remain distinct.
28. Invalid Experiences must not execute.
29. Rendering failures require controlled recovery.
30. AI provider failure must not automatically destroy the entire customer interface.
31. Web is the first surface, not the permanent semantic boundary.
32. Future surfaces must preserve Foundation contracts.

---

# 06.Q Explicitly Not Finalized Yet

This section does not finalize:

- Exact Experience JSON schema.
- Exact Component payload schemas.
- Final MVP Component inventory.
- Final Experience transition protocol.
- React folder structure.
- CSS framework.
- Animation library.
- State-management library.
- Exact exposure thresholds.
- Exact responsive breakpoints.
- Final Business branding controls.
- Streaming implementation.
- Client transport mechanism.
- Visitor Session token implementation.
- Accessibility acceptance thresholds.
- Component-level performance budgets.

These decisions will be finalized in implementation contracts and the MVP Technical Boundary.

---

# 06.R Dependency

Section 05 established Kablet's Intelligence architecture.

Section 06 establishes:

**A React-based adaptive canvas that consumes validated declarative Experience Contracts, renders controlled Components, applies safe transitions, captures customer interactions, and preserves the evidence connecting Decisions to actual customer exposure.**

The next section defines how customer-facing capabilities produce consequential operations through controlled execution boundaries.

# 07 — Action & Integration Architecture
---

# 07. Action & Integration Architecture

## 07.1 Purpose

This section defines how Kablet converts customer intent and accepted Decisions into controlled business operations.

It establishes the technical boundaries for:

- Action definitions.
- Action availability.
- Action authorization.
- Visitor confirmation.
- Action execution.
- External integrations.
- Execution idempotency.
- Asynchronous completion.
- Result verification.
- Failure and recovery.
- Outcome attribution.

The architecture must allow Kablet to move customers toward commercial outcomes without granting unrestricted execution authority to Intelligence providers or customer-facing Components.

---

# 07.A Fundamental Action Model

## 07.2 Actions Are First-Class Capabilities

An Action represents a controlled operation that Kablet may offer or execute within an authorized Business context.

Examples include:

- Submit a lead.
- Request an appointment.
- Create a booking.
- Initiate a checkout handoff.
- Request a quotation.
- Open an authorized contact channel.
- Submit customer information.
- Retrieve supported availability.

An Action is not equivalent to a button.

A button is one possible customer-facing mechanism for invoking an Action.

---

## 07.3 Action Definition vs Action Execution

Kablet must distinguish:

**Action Definition**

Describes an available operation, its inputs, constraints, authorization requirements, and execution behavior.

**Action Invocation**

Represents a request to perform a particular Action.

**Action Attempt**

Represents a specific execution attempt.

**Action Result**

Represents the observed result of execution.

**Outcome**

Represents a meaningful commercial result established through appropriate evidence.

These concepts must not be conflated.

---

## 07.4 Canonical Action Flow

The intended execution flow is:

Visitor Interaction
        |
        v
Action Request
        |
        v
Action Definition Resolution
        |
        v
Input Validation
        |
        v
Business Context Validation
        |
        v
Authorization & Business Rules
        |
        v
Visitor Confirmation (where required)
        |
        v
Canonical Action Invocation
        |
        v
Action Executor
        |
        v
Internal Operation / Integration Adapter
        |
        v
Execution Result
        |
        v
Result Verification
        |
        v
Canonical Events / Outcome Update

Every consequential operation must pass through the applicable Kablet execution boundary.

---

# 07.B Action Registry

## 07.5 Controlled Action Registry

Kablet will maintain a controlled registry of supported Action types.

Intelligence may propose registered Actions.

The Experience Runtime may present registered Actions.

Neither may invent an arbitrary executable operation.

---

## 07.6 Action Contract

A conceptual Action Definition should include:

- Action type.
- Contract version.
- Input schema.
- Output schema.
- Applicable Business scope.
- Availability requirements.
- Authorization requirements.
- Visitor confirmation requirements.
- Execution adapter.
- Idempotency policy.
- Result classification.
- Relevant Event semantics.

The exact TypeScript and Zod schemas will be finalized during implementation.

---

## 07.7 Action Availability

An Action must be available within the relevant Business context before it can be offered.

Availability may depend on:

- Business configuration.
- Enabled integrations.
- Relevant Business Truth.
- Required information.
- Supported capabilities.
- Applicable rules.
- Operational status.

An Action being implemented in Kablet does not automatically make it available to every Business.

---

## 07.8 Capability Does Not Imply Authority

An enabled Action capability does not authorize every possible invocation.

For example:

A Business may enable appointment booking.

That does not permit Intelligence to create arbitrary appointments without satisfying the Action's required inputs, Business constraints, and applicable Visitor confirmation.

---

# 07.C Initial Action Categories

## 07.9 Informational Actions

Informational Actions retrieve or present permitted information without directly creating a commercial commitment.

Examples:

- Retrieve service information.
- Retrieve authorized availability.
- Open an approved contact destination.

These operations still require appropriate ownership and input validation.

---

## 07.10 Lead Actions

Lead Actions collect and submit customer information through a controlled process.

A lead submission must distinguish:

- Form displayed.
- Information entered.
- Submission requested.
- Submission accepted.
- Lead persisted.
- External delivery completed.

Displaying a form or receiving a click is not proof of successful lead creation.

---

## 07.11 Booking Actions

Booking Actions support appointment-related operations.

The architecture must distinguish:

- Booking requested.
- Booking pending.
- Booking confirmed.
- Booking rejected.
- Booking cancelled.
- Appointment attended.

The exact supported lifecycle depends on the underlying Business capability and integration.

---

## 07.12 Commerce Actions

Commerce Actions may support:

- Product selection.
- Checkout initiation.
- External checkout handoff.
- Order-status retrieval.
- Verified purchase feedback.

The initial MVP does not require Kablet to become a payment processor or commerce system of record.

---

## 07.13 Communication Actions

Communication Actions may support approved customer contact mechanisms.

Examples include:

- Email handoff.
- Messaging handoff.
- Contact request.
- Callback request.

Opening an external communication channel must not automatically be counted as a completed lead or conversion.

---

# 07.D Intelligence and Action Authority

## 07.14 Intelligence Proposes Actions

The Intelligence subsystem may select an eligible Action as part of a proposed Decision or Experience Plan.

It must reference the controlled Action Registry.

---

## 07.15 Intelligence Does Not Execute Consequential Actions

An external reasoning provider must not directly receive unrestricted credentials for:

- Booking systems.
- Payment systems.
- CRM systems.
- Messaging providers.
- Business administration.
- Database mutation.

Consequential execution belongs to Kablet's Action system.

---

## 07.16 Action Proposal Validation

A proposed Action must be validated against:

1. Registered Action type.
2. Supported contract version.
3. Correct Business.
4. Applicable Business Rules.
5. Required input.
6. Authorized integration.
7. Available capability.
8. Applicable confirmation requirements.

A valid Intelligence response does not bypass these checks.

---

# 07.E Visitor Confirmation

## 07.17 Confirmation Requirements

Some Actions require an intentional Visitor operation.

Examples include:

- Submitting personal contact information.
- Requesting an appointment.
- Confirming a booking.
- Initiating a purchase.
- Agreeing to applicable terms.

The Action Contract must identify where confirmation is required.

---

## 07.18 Presentation Is Not Consent

Displaying an Action does not establish Visitor consent.

Selecting a recommendation does not automatically authorize every subsequent consequential operation.

The system must preserve the distinction between recommendation, request, and confirmed execution.

---

## 07.19 Confirmation Context

Where required, the Action Invocation should preserve sufficient information to establish what the Visitor intentionally requested.

This may include:

- Action identity.
- Relevant Business.
- Selected service or offer.
- Required submitted information.
- Applicable Experience.
- Confirmation occurrence.

Sensitive information must follow the relevant privacy and retention rules.

---

# 07.F Action Execution Architecture

## 07.20 Action Executor

Kablet will implement a controlled Action Executor inside the TypeScript application architecture.

The executor is responsible for coordinating:

- Validated invocation.
- Trusted execution context.
- Idempotency.
- Adapter selection.
- Execution status.
- Result normalization.
- Failure classification.
- Canonical persistence.

---

## 07.21 Action Handler Interface

Each supported Action type should have a defined execution handler.

Conceptually:

Validated Action Invocation
        |
        v
Action Executor
        |
        v
Registered Action Handler
        |
        v
Internal Domain Operation
        OR
External Integration Adapter

Handlers must not silently bypass applicable authorization or canonical recording requirements.

---

## 07.22 Synchronous and Asynchronous Execution

Not every Action completes during the originating HTTP request.

The architecture must support:

**Synchronous execution**

For operations that can safely return a definitive result within the request lifecycle.

**Asynchronous execution**

For operations requiring delayed processing, external confirmation, webhook feedback, or retryable background work.

---

## 07.23 Execution Status

The initial conceptual status vocabulary should distinguish:

- Requested.
- Validated.
- Accepted.
- Processing.
- Completed.
- Failed.
- Cancelled.
- Awaiting external confirmation.
- Unknown or reconciliation required.

The physical status model will be finalized during implementation.

---

## 07.24 Execution Attempt History

An Action Invocation may require more than one execution attempt.

Retries must remain attributable to the same logical invocation where appropriate.

A second technical attempt must not automatically become a second commercial Action.

---

# 07.G Idempotency

## 07.25 Idempotency Is Mandatory for Consequential Actions

Kablet must protect duplicate-sensitive operations against accidental repeated execution.

Examples include:

- Booking creation.
- Lead submission.
- Order creation.
- Payment-related operations.
- External messaging.
- Webhook-driven updates.

---

## 07.26 Idempotency Identity

An Action Invocation should have a stable identity suitable for deduplication.

The implementation may use an idempotency key derived from trusted invocation context or another controlled mechanism.

The exact strategy will be defined in the Action implementation contract.

---

## 07.27 Retries Are Not New Customer Intent

A network timeout followed by a retry must not automatically create a second booking or lead.

The system must distinguish:

Original Invocation

Execution Attempt 1

Execution Attempt 2

Final Observed Result

---

## 07.28 External Idempotency

Where supported, Kablet should propagate appropriate idempotency identifiers to external providers.

Where an external provider lacks idempotency support, Kablet must account for uncertainty and avoid blindly repeating potentially consequential operations.

---

# 07.H Integration Architecture

## 07.29 Integration Adapters

External Business systems will connect through controlled integration adapters.

Examples include:

- Booking providers.
- CRM systems.
- Commerce platforms.
- Messaging services.
- Payment-status providers.
- Business management systems.

The adapter translates external provider behavior into Kablet-owned integration contracts.

---

## 07.30 Provider Independence

Canonical Kablet Action and Outcome records must not depend on one provider's proprietary object model.

Provider-specific identifiers may be retained as external references.

They must not replace canonical Kablet identity.

---

## 07.31 Integration Connection

An Integration Connection should resolve to:

- Owning Business.
- Provider.
- Connection identity.
- Enabled capabilities.
- Credential reference.
- Configuration.
- Operational status.
- Relevant external resource mappings.

The exact schema will be defined during implementation.

---

## 07.32 Integration Capabilities

An integration must explicitly expose which operations it supports.

For example:

A booking integration may support availability lookup and booking creation but not cancellation.

Kablet must not assume every provider supports an identical capability set.

---

## 07.33 Integration Configuration

Business operators may configure supported integrations through the Control Plane.

Configuration must be validated before activation.

The Customer Runtime must not receive unrestricted integration credentials or internal configuration.

---

# 07.I Integration Credentials and Security

## 07.34 Credential Isolation

Integration credentials must remain in controlled server-side infrastructure.

They must never appear in:

- Customer-facing Experience payloads.
- Browser bundles.
- Intelligence context.
- Ordinary Events.
- Public Runtime responses.

---

## 07.35 Scoped Provider Access

Where supported, integrations should use the minimum provider permissions required for their enabled capabilities.

A booking-only integration should not automatically receive unrestricted Business administration authority.

---

## 07.36 Tenant Isolation

Integration Connections belong to their authorized Business context.

A Business must not invoke another Business's integration merely by supplying its Connection ID.

---

## 07.37 Webhook Verification

Incoming webhooks must pass the provider's applicable verification mechanism before trusted processing.

The receiving system must resolve the authorized Integration Connection and Business context.

Webhook payload data remains untrusted until validated.

---

# 07.J External Result Normalization

## 07.38 Provider Responses Are Evidence

External responses must be normalized into Kablet-owned result contracts.

For example:

Provider Booking Response
        |
        v
Integration Adapter
        |
        v
Normalized Booking Result
        |
        v
Canonical Action Update

The provider's raw response may be retained under appropriate operational and privacy controls.

---

## 07.39 Transport Success Is Not Commercial Success

An HTTP success response does not automatically establish that the intended commercial operation completed.

The adapter must interpret the provider's documented result semantics.

Examples:

- Request accepted.
- Booking pending.
- Booking confirmed.
- Lead created.
- External processing incomplete.

---

## 07.40 External References

Kablet should preserve relevant external identifiers to support:

- Reconciliation.
- Duplicate detection.
- Status updates.
- Cancellation.
- Debugging.
- Outcome verification.

External identifiers must remain scoped to the appropriate provider and Integration Connection.

---

# 07.K Action-to-Outcome Relationship

## 07.41 Action Result Is Not Automatically Outcome

An Action may produce an immediate technical result without producing a verified commercial Outcome.

For example:

Checkout Opened

is not equivalent to:

Purchase Completed.

---

## 07.42 Outcome Verification

The Outcome domain determines whether sufficient evidence exists to establish a meaningful commercial result.

Evidence may originate from:

- Kablet-controlled operations.
- Verified external provider responses.
- Authenticated webhooks.
- Authorized Business updates.
- Reconciliation processes.

---

## 07.43 Delayed Outcomes

Some Outcomes occur after the original customer Session.

Examples include:

- Appointment attendance.
- Lead qualification.
- Order completion.
- Revenue realization.
- Cancellation.
- Refund.

The architecture must preserve the relationship between the original Action and later Outcome developments.

---

## 07.44 Outcome Lineage

Where available, a verified Outcome should remain attributable to:

Business
    |
    v
Visitor / Session
    |
    v
Decision
    |
    v
Experience
    |
    v
Component Interaction
    |
    v
Action Invocation
    |
    v
Execution Result
    |
    v
Outcome

This lineage supports Kablet's future Learning Brain.

---

## 07.45 Attribution Does Not Prove Causation

Linking an Outcome to an Experience or Decision establishes historical attribution.

It does not automatically establish incremental conversion lift.

Controlled experimentation remains a separate analytical responsibility.

---

# 07.L Reliability and Failure Recovery

## 07.46 Failure Categories

The Action system must distinguish:

- Invalid input.
- Unauthorized operation.
- Unavailable capability.
- Integration misconfiguration.
- Provider rejection.
- Provider timeout.
- Network failure.
- Unknown execution result.
- Canonical persistence failure.
- Webhook verification failure.
- Reconciliation failure.

These failures must not all be represented as one generic unsuccessful Action.

---

## 07.47 Unknown External Result

A particularly important failure occurs when an external operation may have succeeded but Kablet did not receive its definitive response.

For example:

Kablet sends a booking request.

The provider creates the booking.

The network connection times out before Kablet receives confirmation.

The system must not automatically retry in a way that creates a duplicate booking.

The appropriate recovery may require:

- Idempotent retry.
- Provider status lookup.
- Webhook confirmation.
- Reconciliation.
- Explicit unresolved status.

---

## 07.48 Retry Policy

Retries must be:

- Bounded.
- Operation-aware.
- Idempotency-aware.
- Observable.
- Appropriate to provider behavior.

A retry policy suitable for an informational lookup may be unsafe for booking creation.

---

## 07.49 Canonical Persistence Failure

If an external operation succeeds but canonical persistence fails, the system must support recovery or reconciliation.

It must not silently discard evidence of the external operation.

The exact recovery mechanism will be defined in the Async and Failure Architecture sections.

---

## 07.50 Integration Unavailable

When an integration becomes unavailable, Kablet should degrade the affected capability rather than unnecessarily destroying the entire customer Experience.

For example:

Booking may become temporarily unavailable while informational Components remain functional.

The Runtime must represent unavailable Actions accurately.

---

# 07.M Transaction and Async Boundaries

## 07.51 Local Transactions

Canonical changes that must succeed together should use appropriate PostgreSQL transactions.

External provider calls must not be assumed to participate in those transactions.

---

## 07.52 Transactional Outbox

Where canonical changes require reliable asynchronous processing, Kablet should use a transactional outbox or an equivalent mechanism.

The outbox must preserve the required Business and correlation context.

---

## 07.53 Background Execution

Background Action processing must preserve:

- Trusted Business context.
- Invocation identity.
- Relevant authorization context.
- Idempotency.
- Execution attempts.
- Correlation identity.
- Result attribution.

Background execution does not remove domain authorization requirements.

---

# 07.N Observability

## 07.54 Action Observability

Consequential Action execution should be observable through structured operational records.

Relevant metadata may include:

- Action Invocation ID.
- Business.
- Action type.
- Execution status.
- Adapter.
- Attempt count.
- Latency.
- Failure classification.
- External reference.
- Correlation ID.
- Result timestamp.

Sensitive customer information must follow applicable privacy controls.

---

## 07.55 Integration Health

Kablet should be able to distinguish:

- Configured integration.
- Connected integration.
- Operational integration.
- Degraded integration.
- Unavailable integration.

The exact health-check implementation is deferred.

---

## 07.56 Action Auditability

Meaningful consequential operations must retain sufficient evidence to explain:

- What was requested.
- Which Business owned the operation.
- What was authorized.
- Which handler executed.
- What external system was contacted.
- What result was observed.
- Whether an Outcome was established.

---

# 07.O Initial MVP Boundary

## 07.57 Start With One Conversion Action

The first implementation should prioritize one complete conversion Action rather than implementing numerous shallow integrations.

The initial vertical and Business will determine the exact Action.

Booking is the preferred reference flow for the first engineering milestone, subject to final MVP scope.

---

## 07.58 First Milestone

The first complete Action implementation must demonstrate:

Visitor Intent
    |
    v
Accepted Decision
    |
    v
Validated Experience
    |
    v
Customer Interaction
    |
    v
Authorized Action
    |
    v
Execution
    |
    v
Verified Result
    |
    v
Canonical Outcome

The entire lineage must be inspectable.

---

## 07.59 Avoid Premature Integration Breadth

The MVP does not require:

- A universal integration marketplace.
- Dozens of booking providers.
- Native payment processing.
- Complex workflow automation.
- A generic no-code integration builder.
- Multi-step autonomous agent execution.
- Enterprise CRM synchronization.

Additional integrations should follow validated customer and product requirements.

---

# 07.P Architecture Decision Records

## ADR-035 — Kablet-Owned Action Registry

**Status:** Accepted.

Kablet will maintain a controlled registry of supported Action types.

Intelligence and Components may reference registered Actions but cannot invent unrestricted executable operations.

---

## ADR-036 — Separate Proposal, Invocation, Attempt, Result, and Outcome

**Status:** Accepted.

The architecture will preserve the distinction between proposed Actions, customer requests, execution attempts, technical results, and verified commercial Outcomes.

---

## ADR-037 — Consequential Action Authorization

**Status:** Accepted.

Consequential Actions require trusted Business context, applicable authorization, validated input, and Visitor confirmation where required.

AI reasoning alone cannot authorize execution.

---

## ADR-038 — Integration Adapter Boundary

**Status:** Accepted.

External systems connect through provider-specific adapters that normalize results into Kablet-owned contracts.

Canonical Action and Outcome records remain provider-independent.

---

## ADR-039 — Idempotent Consequential Execution

**Status:** Accepted.

Duplicate-sensitive Actions require an appropriate idempotency and retry strategy.

A technical retry must not automatically create another commercial operation.

---

## ADR-040 — External Results Require Verification

**Status:** Accepted.

Transport-level success is not automatically a completed commercial Outcome.

The Outcome domain evaluates applicable evidence and verification status.

---

## ADR-041 — One Complete MVP Conversion Flow

**Status:** Accepted.

The initial implementation will prioritize one end-to-end conversion Action with complete canonical lineage before expanding integration breadth.

---

# 07.Q Action & Integration Invariants

1. Actions are controlled Kablet capabilities.
2. Action Definitions and Action Invocations remain distinct.
3. Action Invocations and execution attempts remain distinct.
4. Execution results and commercial Outcomes remain distinct.
5. Intelligence may propose Actions but does not own execution authority.
6. Components present Actions but do not execute unrestricted operations.
7. Action availability is Business-scoped.
8. Capability does not imply authority.
9. Consequential Actions require trusted validation and authorization.
10. Visitor confirmation is required where applicable.
11. Presentation is not consent.
12. Customer input remains untrusted.
13. External integrations operate through controlled adapters.
14. Canonical domain records remain provider-independent.
15. Integration credentials never enter ordinary customer-facing payloads.
16. Integration Connections preserve Business ownership.
17. Webhooks require appropriate authentication and validation.
18. External provider responses are normalized.
19. HTTP success is not automatically commercial success.
20. External identifiers remain scoped and attributable.
21. Consequential operations require appropriate idempotency.
22. Retries do not automatically create new customer intent.
23. Unknown external results require explicit handling.
24. Delayed Outcomes remain linked to originating Actions where possible.
25. Attribution does not automatically establish causation.
26. Background execution preserves trusted Business context.
27. External calls are not assumed to participate in local database transactions.
28. Required asynchronous work must use reliable publication.
29. Action failure must be represented accurately.
30. Integration failure should remain localized where possible.
31. Consequential execution must be observable.
32. The MVP prioritizes one complete conversion flow over integration breadth.

---

# 07.R Explicitly Not Finalized Yet

This section does not finalize:

- Exact Action TypeScript interfaces.
- Final Action Registry vocabulary.
- Exact booking provider.
- Exact CRM provider.
- Exact checkout integration.
- Final Action status enum.
- Idempotency-key format.
- Retry counts.
- Provider timeout values.
- Credential-storage implementation.
- Webhook endpoint structure.
- Outbox table structure.
- Background queue provider.
- Reconciliation schedules.
- Final Outcome verification rules.
- Integration health-check intervals.
- Exact MVP booking contract.

These decisions belong to implementation contracts and the relevant later architecture sections.

---

# 07.S Dependency

Section 06 established Kablet's adaptive customer-facing Experience Runtime.

Section 07 establishes:

**A controlled Action execution system that converts customer interactions into authorized Business operations, integrates with external systems through provider adapters, protects consequential execution through idempotency, and preserves the evidence required to establish verified commercial Outcomes.**

The next section defines how Kablet records these occurrences and connects them into a durable, queryable Event and Outcome history.

# 08 — Event & Outcome Architecture
