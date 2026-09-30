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

---

# 01. Identity & Ownership

## 01.1 Purpose

Identity & Ownership defines who exists inside Kablet, what they own, what they may access, and the boundaries within which data and actions operate.

This foundation exists to ensure that every meaningful object in Kablet has an unambiguous ownership context.

Kablet must support a simple business operating one intelligent frontend without preventing future support for:

- multi-business organizations
- multi-brand groups
- multiple locations
- franchises
- agencies
- enterprise organizations
- teams
- external collaborators
- centralized administration
- delegated access

Identity & Ownership must therefore separate the entity that owns and administers resources from the business whose customer-facing experience Kablet powers.

---

## 01.2 Core Ownership Hierarchy

The canonical ownership hierarchy is:

Organization
    ↓
Business
    ↓
Property / Location

Users participate in this hierarchy through Memberships rather than being the ownership hierarchy themselves.

Conceptually:

Organization
├── Business
│   ├── Property / Location
│   └── Business-Owned Resources
│
└── Membership
    └── User

The hierarchy defines ownership.

Memberships define access.

These concepts must remain separate.

---

## 01.3 Organization

### Definition

An Organization is the primary tenant and ownership boundary inside Kablet.

It represents the entity that owns, administers, or is responsible for one or more Businesses within the platform.

An Organization may represent:

- a company
- a business group
- a holding company
- a franchise operator
- an agency
- an enterprise
- a sole business operator

An Organization exists even when it contains only one Business.

### Why Kablet Needs It

Without Organization as a separate primitive, Kablet would implicitly assume:

one account = one business.

That assumption would eventually break when supporting groups, multiple brands, agencies, franchises, consolidated administration, or enterprise customers.

Organization provides a durable top-level boundary without forcing Business to carry account-level responsibilities.

### Organization May Contain

Conceptually, an Organization may contain or control:

- Businesses
- Organization Memberships
- organization-level configuration
- organization-level permissions
- billing relationships
- administrative policies
- integrations that intentionally operate across Businesses
- organization-level reporting
- organization-level governance

Not every capability must exist in the initial implementation.

The ownership model must nevertheless permit them.

### Invariants

An Organization:

1. has a stable identity;
2. is an explicit tenant boundary;
3. may own one or more Businesses;
4. may have multiple Users through Memberships;
5. must not implicitly gain access to another Organization's private resources;
6. remains conceptually distinct from the Businesses it owns.

---

## 01.4 Business

### Definition

A Business is the commercial entity whose customer-facing experience Kablet understands, operates, and optimizes.

Business is the primary commercial context for the Kablet runtime.

It is the entity about which Business Truth exists and for which customer outcomes are generated.

Examples may include:

- a clinic
- an ecommerce brand
- a SaaS company
- a law firm
- a restaurant
- a professional service business
- another commercial operation

### Organization vs Business

Organization and Business are intentionally separate.

Organization answers:

**Who owns and administers this inside Kablet?**

Business answers:

**Which commercial entity is Kablet representing to customers?**

For example:

Organization: Acme Healthcare Group

Businesses:
- Dubai Skin Clinic
- Abu Dhabi Dental
- Acme Pharmacy

For a simple customer:

Organization: Glow Clinic LLC

Business: Glow Clinic

The fact that an Organization and Business may initially represent the same real-world company does not make them the same Kablet object.

They must remain separate primitives.

### Business Responsibilities

Business is the primary ownership context for concepts such as:

- Business Truth
- customer-facing experiences
- visitor state
- decisions
- actions
- experiments
- conversions
- outcomes
- business-specific learning

Other foundations will define those concepts in detail.

### Invariants

A Business:

1. belongs to exactly one Organization at a given ownership state;
2. has its own stable identity;
3. represents a customer-facing commercial entity;
4. owns or scopes its Business Truth;
5. provides the primary commercial context for runtime decisions;
6. must remain distinguishable from its parent Organization;
7. must not accidentally access another Business's private state merely because both use Kablet.

---

## 01.5 Property / Location

### Definition

A Property / Location represents an operational subdivision of a Business when customer experience, truth, actions, availability, or outcomes vary by that subdivision.

The primitive must not be interpreted only as a physical address.

A Property / Location may represent:

- a physical branch
- a clinic location
- a store
- a service territory
- an operational location
- another business subdivision requiring distinct runtime context

### Why It Exists

A Business may have multiple operational contexts.

For example:

Business: Glow Clinic

Properties / Locations:
- Dubai Marina
- Jumeirah
- Abu Dhabi

Those locations may have different:

- staff
- services
- availability
- pricing
- offers
- booking destinations
- contact information
- policies
- operating hours

Kablet must be capable of understanding those differences without requiring each location to become an entirely separate Business.

### Optionality

A Business does not need multiple Properties / Locations.

The model must support a Business whose experience operates entirely at the Business level.

Property / Location therefore adds scope where needed; it must not create unnecessary complexity for simple businesses.

### Invariants

A Property / Location:

1. belongs to exactly one Business;
2. inherits its Organization context through that Business;
3. may scope Business Truth and operational capabilities;
4. must never become an independent tenant implicitly;
5. exists only when subdivision-specific context is meaningful.

---

## 01.6 User

### Definition

A User represents a human identity capable of authenticating with and interacting with Kablet's business-facing systems.

A User is not itself an Organization or Business.

A User may participate in multiple ownership contexts through Memberships.

### Why Membership Is Separate From User

Kablet must not encode ownership or permissions directly into the User identity.

The same person may eventually be:

- owner of one Organization
- administrator of another
- analyst for a Business
- external collaborator elsewhere

Therefore:

User = identity

Membership = relationship and authority

### Invariants

A User:

1. has a stable identity;
2. may have multiple Memberships;
3. does not inherently own every resource they can access;
4. receives authority through explicit relationships;
5. must not carry tenant-specific permissions globally.

---

## 01.7 Membership

### Definition

A Membership represents the relationship between a User and an ownership scope inside Kablet.

Membership answers:

**Who may act within this scope, and under what authority?**

The initial implementation may support only Organization-level Memberships.

The foundation must permit more granular scopes when needed.

### Membership May Define

A Membership may eventually contain concepts such as:

- scope
- role
- permissions
- status
- invitation state
- activation state
- creation authority
- temporal validity

Exact authorization mechanics belong to the Technical Architecture.

The foundational requirement is that access is explicit rather than inferred from identity alone.

### Invariants

A Membership:

1. connects a User to an explicit scope;
2. defines or references the User's authority within that scope;
3. may be revoked without deleting the User;
4. must not grant authority outside its intended scope;
5. must be distinguishable from ownership itself.

---

## 01.8 Ownership and Access Are Different

Kablet must maintain a permanent distinction between:

**Ownership**

and

**Access**

An Organization may own a Business.

A User may have access to that Organization.

Those statements are not equivalent.

Similarly, a future agency may be allowed to manage another Organization's Business without owning that Business.

Therefore Kablet must not infer:

access = ownership

or:

management authority = data ownership

This distinction is necessary for future agency, enterprise, franchise, partnership, and delegated-management models.

---

## 01.9 Resource Ownership

Every tenant-sensitive resource must be attributable to an ownership context.

Depending on the resource, that context may include:

- Organization
- Business
- Property / Location

Examples include:

Business Truth
Decision
Experience
Visitor Session
Experiment
Conversion
Outcome

A resource must not become tenant-sensitive merely because a User created it.

For example:

If User A creates a service for Business X, the service belongs to Business X.

It does not belong to User A.

The User may be recorded as the actor responsible for creating or changing it.

Ownership and authorship are different concepts.

---

## 01.10 Ownership Context Must Travel With Runtime Data

Customer-facing runtime data must remain attributable to the Business it belongs to.

A visitor session must not become an anonymous global Kablet session with unclear business ownership.

A Decision must know the commercial context in which it occurred.

An Outcome must remain attributable to the Business whose experience produced it.

Conceptually:

Organization
    ↓
Business
    ↓
Visitor
    ↓
Session
    ↓
State
    ↓
Decision
    ↓
Experience
    ↓
Action
    ↓
Outcome

Property / Location may further scope this chain when relevant.

This ownership lineage is necessary for:

- tenant isolation
- reporting
- experimentation
- debugging
- attribution
- learning
- data governance

---

## 01.11 Business Transfer Must Not Destroy Historical Meaning

Kablet may eventually need to support ownership changes.

For example, a Business may:

- move between Organizations
- be acquired
- change operators
- be transferred between accounts

A future transfer must not silently rewrite historical reality.

Historical Decisions, Events, Outcomes, and other records must remain interpretable according to the ownership context that existed when they occurred.

Current ownership and historical ownership are therefore conceptually distinct.

The exact mechanism for representing ownership history belongs to later architecture.

---

## 01.12 Deletion Must Be Distinguished From Identity

Stable identity and lifecycle state must remain conceptually separate.

Removing access, archiving a Business, closing an Organization, or deactivating a User must not necessarily require erasing the historical identity referenced by Decisions, Events, Outcomes, or audit history.

This does not override legal deletion, privacy, or retention requirements.

It establishes only that operational deletion must not casually destroy referential meaning.

Data retention and privacy rules will be defined separately.

---

## 01.13 Customer Identities Are Not Business Users

The humans operating Kablet for a business and the visitors interacting with a Kablet-powered experience are different identity domains.

Business-facing identity:

User
    ↓
Membership
    ↓
Organization / Business Access

Customer-facing identity:

Visitor
    ↓
Session
    ↓
Customer Experience

A Visitor must not be modeled as a Kablet business User merely because both represent humans.

Visitor identity and session state will be defined under:

**04 — Visitor State & Decisions.**

---

## 01.14 Identity Must Not Depend on Authentication Provider

Authentication technology may change.

Kablet may use:

- email authentication
- social identity providers
- enterprise identity
- passwordless authentication
- another authentication mechanism

Those mechanisms establish or verify identity.

They do not define the Kablet User itself.

Therefore:

Authentication credential ≠ User

The foundational User identity must survive changes to authentication mechanisms and providers.

---

## 01.15 Authorization Must Be Evaluated Against Explicit Context

A valid User identity alone does not authorize an operation.

Kablet must conceptually evaluate:

User
    +
Membership
    +
Requested Resource
    +
Ownership Context
    +
Required Capability
    ↓
Authorization Decision

This principle applies whether authorization is eventually implemented through roles, permissions, policies, capabilities, or another technical mechanism.

The permanent requirement is explicit contextual authorization.

---

## 01.16 Cross-Tenant Intelligence Must Not Bypass Ownership Boundaries

Kablet may eventually derive vertical-level or network-level intelligence from activity across businesses.

That does not make underlying tenant data globally accessible.

Learning across businesses must occur through deliberately designed mechanisms consistent with:

- permissions
- privacy
- contractual obligations
- data governance
- aggregation requirements
- applicable policy

Runtime access to Business A must never implicitly expose Business B's private truth, visitor data, decisions, or outcomes.

Cross-business learning and cross-business data access are fundamentally different concepts.

---

# 01.A Canonical Identity Model

The foundational identity model is:

Organization
│
├── Business
│   │
│   ├── Property / Location
│   │
│   └── Business-Owned Resources
│
└── Membership
    │
    └── User

Where:

Organization
= tenant / ownership boundary

Business
= commercial entity Kablet represents and optimizes

Property / Location
= optional operational subdivision of a Business

User
= authenticated human identity

Membership
= relationship granting authority within an ownership scope

---

# 01.B Core Identity & Ownership Invariants

1. Organization and Business are separate primitives.
2. Organization is the primary tenant and ownership boundary.
3. Business is the primary customer-facing commercial context.
4. A Business belongs to exactly one Organization at a given ownership state.
5. A Property / Location belongs to exactly one Business.
6. Users do not receive tenant authority merely by existing.
7. Authority is granted through explicit Memberships.
8. Ownership and access are different concepts.
9. Ownership and authorship are different concepts.
10. Tenant-sensitive resources have explicit ownership context.
11. Runtime data preserves Business ownership lineage.
12. Current ownership changes must not destroy historical ownership meaning.
13. Business Users and customer Visitors are different identity domains.
14. User identity does not depend on a particular authentication provider.
15. Authorization is contextual.
16. Cross-tenant learning does not imply cross-tenant data access.

---

# 01.C Explicitly Not Defined Here

This section intentionally does not define:

- database tables
- foreign keys
- authentication provider
- login flows
- session tokens
- role names
- detailed permission matrices
- billing implementation
- subscription plans
- invitation UI
- organization-switching UI
- database row-level security
- API authorization middleware
- data-retention periods
- privacy deletion implementation
- agency product features

Those decisions belong to later specifications and technical architecture.

This section defines only the permanent identity and ownership model that those systems must preserve.

---

# 01.D Foundation Dependency

Identity & Ownership establishes the ownership context required by every remaining Kablet foundation.

The next foundation defines what exists inside that context:

**02 — Business Truth.**

---

# 02. Business Truth

## 02.1 Purpose

Business Truth is Kablet's canonical structured representation of what a Business says is true about itself, what it offers, how it operates, and what customers are permitted to do.

Business Truth provides the trusted commercial knowledge upon which Kablet Intelligence operates.

Kablet may decide how Business Truth is selected, explained, composed, sequenced, and presented.

Kablet does not independently redefine authoritative Business Truth.

The foundational boundary is:

**The Business controls WHAT is true.**

**Kablet controls HOW that truth is used to create and optimize the customer experience.**

---

## 02.2 The Business Is the Authority Over Business Truth

The Business, acting through authorized Users and explicitly authorized systems, is the ultimate authority over its Business Truth.

This includes authoritative decisions such as:

- what services exist
- what products exist
- what prices apply
- what offers exist
- which locations operate
- which people represent the Business
- what policies apply
- what availability exists
- what actions customers may perform
- what commercial constraints apply

Kablet may assist with creating, importing, organizing, validating, extracting, or maintaining this information.

Assistance does not transfer authority from the Business to Kablet.

Kablet must not silently invent or materially change authoritative Business Truth merely because the system predicts that doing so could improve conversion.

For example, Kablet may decide that a price should be presented earlier in an experience.

It may not independently change that price from 399 AED to 299 AED.

---

## 02.3 Delegated Authority

The Business may explicitly delegate limited authority to Kablet for defined classes of change.

For example, a Business may authorize Kablet to:

- select among approved offers
- apply an approved discount within a defined range
- change availability according to an authorized external system
- activate or deactivate predefined promotions under specified conditions
- perform another explicitly permitted commercial action

Delegation must be intentional and constrained.

Conceptually:

Business Authority
        ↓
Delegated Capability
        ↓
Defined Constraints
        ↓
Kablet Decision
        ↓
Validation
        ↓
Authorized Change / Action

Delegated authority must never be inferred merely because Kablet technically has the ability to perform an action.

The permanent rule is:

**Capability does not imply authority.**

Where authority has not been delegated, Kablet may recommend a change but must not silently make the authoritative change.

---

## 02.4 Business Truth Is Not Website Content

Business Truth must not be modeled merely as pages, text blocks, or website content.

A traditional website might contain:

"Laser Hair Removal starts from 399 AED."

Kablet should be capable of understanding the underlying commercial structure:

Service
    name: Laser Hair Removal

Price
    amount: 399
    currency: AED
    qualification: starting_from

The sentence shown to a visitor is an Experience representation.

The underlying structured information is Business Truth.

This separation allows the same truth to support many different customer experiences without duplicating or rewriting the canonical business information.

---

## 02.5 Canonical Business Truth Model

Business Truth may include the following foundational domains:

Business Truth
│
├── Brand
├── Services
├── Products
├── Pricing
├── Offers
├── People
├── Proof
├── FAQs
├── Policies
├── Media
├── Locations
├── Availability
├── Actions
└── Business Rules

These domains describe the business.

They do not prescribe how the customer experience must be laid out.

The model must be extensible so future vertical-specific truth can be added without redefining the core concept of Business Truth.

---

## 02.6 Brand

Brand represents the authorized identity and presentation constraints of the Business.

Brand may include:

- business name
- public display name
- logo
- colors
- typography guidance
- tone
- voice
- approved terminology
- visual assets
- brand rules
- communication constraints

Brand information provides boundaries within which Kablet may generate customer-facing experiences.

Brand does not define a fixed website layout.

---

## 02.7 Services

A Service represents something the Business performs or provides for a customer.

A Service may contain concepts such as:

- name
- description
- category
- benefits
- price relationships
- duration
- eligibility
- requirements
- locations
- providers
- availability
- related proof
- related FAQs
- related policies
- permitted actions

Services must be represented as business entities rather than only as pieces of marketing copy.

This allows Kablet to reason about them and compose different experiences around the same canonical Service.

---

## 02.8 Products

A Product represents something the Business offers as a purchasable or selectable item.

A Product may contain concepts such as:

- name
- description
- variants
- attributes
- price relationships
- inventory state
- availability
- media
- related offers
- related proof
- policies
- permitted actions

Product representation must remain sufficiently generic to support different commerce models without making ecommerce assumptions part of every Business.

---

## 02.9 Pricing

Pricing represents the Business-authorized commercial terms associated with Products, Services, or other purchasable outcomes.

Pricing may eventually support concepts such as:

- fixed price
- starting price
- price range
- recurring price
- promotional price
- package price
- currency
- taxes
- conditions
- effective periods
- location-specific pricing
- customer-specific authorized pricing

Pricing is authoritative Business Truth.

Kablet may determine how and when authorized pricing is presented.

Kablet may not independently alter authoritative pricing unless explicitly delegated authority permits it.

---

## 02.10 Offers

An Offer represents an authorized commercial proposition made available by the Business.

An Offer may include:

- discount
- bundle
- package
- trial
- promotion
- incentive
- eligibility
- conditions
- start time
- expiration
- applicable Products or Services
- applicable Locations
- permitted actions

An Offer must exist as Business Truth before Kablet presents it as an active commercial proposition, unless the Business has explicitly delegated authority to create that class of offer.

Kablet may intelligently decide which authorized Offer is most relevant to a particular visitor.

---

## 02.11 People

People represents individuals the Business has authorized Kablet to represent within customer-facing experiences.

Examples may include:

- practitioners
- consultants
- sales representatives
- instructors
- specialists
- team members

People may contain:

- name
- role
- biography
- credentials
- specialties
- associated Services
- associated Locations
- availability
- approved media
- approved proof

Kablet must not fabricate credentials, roles, qualifications, or associations.

---

## 02.12 Proof

Proof represents Business-authorized evidence that may support customer confidence or decision-making.

Examples may include:

- reviews
- testimonials
- ratings
- certifications
- credentials
- awards
- case studies
- results
- customer counts
- business statistics
- third-party recognition

Proof should preserve sufficient provenance to understand what it represents and where it came from.

Kablet may decide when particular Proof is useful in an experience.

It must not manufacture Proof.

---

## 02.13 FAQs

FAQs represent Business-approved answers to recurring customer questions.

An FAQ may contain:

- question
- approved answer
- related Products
- related Services
- related Locations
- related Policies
- applicability conditions

FAQs are a source of Business Truth.

They do not require Kablet to present a traditional FAQ page.

Kablet may surface the relevant information contextually when a visitor's intent or concern makes it useful.

---

## 02.14 Policies

Policies represent Business-authorized operational or commercial rules communicated to or affecting customers.

Examples may include:

- cancellation
- refund
- return
- shipping
- rescheduling
- payment
- privacy
- eligibility
- warranty
- service conditions

Policies must remain distinguishable from generated explanations of those policies.

Kablet may simplify or contextualize a policy for an experience where permitted, but the canonical policy remains the authoritative source.

---

## 02.15 Media

Media represents Business-authorized assets available to Kablet.

Examples include:

- images
- video
- documents
- logos
- demonstrations
- product photography
- before-and-after material
- downloadable resources

Media should retain ownership context, provenance, metadata, and applicable usage constraints where required.

Kablet may select and compose appropriate Media within customer experiences.

---

## 02.16 Locations

Business Truth may describe operational Locations defined by the Identity & Ownership foundation.

Location-specific truth may include:

- address
- contact information
- operating hours
- Services
- Products
- People
- Pricing
- Offers
- Availability
- Policies
- Actions

Location-specific truth must not require duplication of all Business-level truth.

Kablet should be capable of representing inherited truth together with intentional location-specific differences.

---

## 02.17 Availability

Availability represents whether and under what conditions a Business capability can currently be offered or performed.

Availability may apply to:

- Services
- Products
- People
- Locations
- appointments
- inventory
- delivery
- another operational capability

Availability may be dynamic.

Its authoritative source may therefore be an authorized external operational system rather than manual Business entry.

Kablet must distinguish current authoritative availability from generated assumptions.

If reliable availability is unknown, Kablet must not represent guessed availability as established truth.

---

## 02.18 Actions

An Action represents something the Business authorizes a customer to do.

Examples may include:

- book
- buy
- call
- message
- request a quote
- submit a lead
- schedule a consultation
- start checkout
- request information
- apply
- subscribe

An Action may contain:

- type
- target
- applicable entity
- eligibility
- constraints
- required information
- execution capability
- expected outcome

Actions define what customer-facing experiences are permitted to offer.

The Experience layer decides when and how an authorized Action should be surfaced.

The Action & Transaction systems eventually determine how it is executed.

---

## 02.19 Business Rules

Business Rules represent explicit constraints or requirements imposed by the Business.

Examples may include:

- Service A is available only at Location X
- Product B cannot be shipped to Region Y
- Offer C applies only to new customers
- Consultation is required before Treatment D
- discounts may not exceed 10%
- bookings require a deposit

Business Rules constrain Kablet's intelligence.

Optimization must occur inside these rules rather than silently violating them.

---

## 02.20 Source Data Is Not Automatically Business Truth

Kablet may receive information from many sources.

Examples include:

Manual Entry
Website
Commerce Platform
CRM
Booking System
POS
ERP
CSV
API
External Database
AI Extraction

Information obtained from a source is not automatically canonical Business Truth merely because Kablet can access it.

Conceptually:

Source Data
    ↓
Ingestion
    ↓
Normalization
    ↓
Validation / Resolution
    ↓
Business Truth

The exact ingestion architecture will be defined later.

The foundational principle is that source information and canonical Business Truth are separate concepts.

---

## 02.21 Business Truth Must Preserve Provenance

Where meaningful, Kablet should be capable of identifying where Business Truth originated and how it became authoritative.

Provenance may eventually include concepts such as:

- source type
- source system
- source reference
- created by
- modified by
- imported at
- synchronized at
- verified at
- override relationship
- authority status

For example:

Price: 249 AED
Source: Shopify
External Reference: Product 48291
Synchronization: Active

Or:

Price: 229 AED
Source: Manual Override
Changed By: Authorized User
Overrides: Synchronized Price

The precise technical representation belongs to later architecture.

The permanent requirement is that Kablet must not lose meaningful source lineage when that lineage affects trust, synchronization, debugging, or authority.

---

## 02.22 Source Precedence Must Be Explicit

Multiple authorized sources may disagree.

For example:

Website: 299 AED
Commerce System: 249 AED
Manual Override: 229 AED

Kablet must not resolve meaningful conflicts through hidden assumptions.

Precedence must be governed by explicit Business configuration, source authority rules, synchronization rules, or authorized resolution.

A possible future policy may be:

Manual Override
    >
Authorized Commerce System
    >
Imported Website Content

But no universal precedence order is established by this foundation.

Different Businesses and truth domains may require different authority models.

The permanent rule is:

**Conflict resolution must be explicit and traceable.**

---

## 02.23 Manual Business Authority Must Remain Possible

External integrations must not remove the Business's ability to intentionally control its truth.

Where operationally appropriate, authorized Users must be capable of reviewing, correcting, overriding, or changing Business Truth.

If a synchronized source is authoritative for a particular field, Kablet must make that authority clear rather than creating the illusion that a manual change will persist when synchronization will overwrite it.

The system must distinguish:

- editable truth
- synchronized truth
- derived truth
- overridden truth

The exact user interface is outside this foundation.

---

## 02.24 Facts and Business-Provided Claims Must Remain Distinguishable

Not every statement supplied by a Business should be treated as independently established fact.

For example:

"Consultation price is 200 AED"

may be structured commercial truth.

"Our clinic is the best clinic in Dubai"

is a Business-provided claim.

Kablet must be capable of preserving that distinction.

Relevant information may therefore carry semantic status such as:

- structured fact
- Business-provided claim
- customer testimonial
- third-party evidence
- derived information
- system observation

The exact taxonomy may evolve.

The permanent requirement is that Kablet must not silently convert promotional claims into independently verified facts.

---

## 02.25 Generated Content Is Not Canonical Business Truth

Kablet Intelligence may generate:

- explanations
- summaries
- recommendations
- comparisons
- responses
- headlines
- calls to action
- contextual descriptions

Those outputs do not automatically become Business Truth.

For example:

Business Truth:

Service: Laser Hair Removal
Price: 399 AED
Duration: 45 minutes

Generated Experience:

"Get started with a 45-minute laser session from 399 AED."

The generated sentence is an experience artifact.

The underlying Service, Price, and Duration remain canonical Business Truth.

This boundary prevents generated language from contaminating the business knowledge layer.

---

## 02.26 Derived Information Must Retain Its Derivation

Kablet may derive useful information from authoritative truth.

For example:

Price: 1,200 AED
Installments: 4

Derived display value:

300 AED per installment

Derived information may be useful in customer experiences.

It must remain distinguishable from source Business Truth and, where consequential, be reproducible from the information that produced it.

Derived information must not silently replace its authoritative inputs.

---

## 02.27 Truth May Have Scope

Not all Business Truth applies everywhere.

Truth may be scoped by concepts such as:

- Business
- Property / Location
- Product
- Service
- Person
- customer eligibility
- geography
- channel
- effective period
- other authorized conditions

For example:

Business-level price:
399 AED

Dubai location price:
449 AED

Kablet must be capable of determining which authorized truth applies to the current customer context.

Specific scoped truth may override broader truth according to explicit rules.

---

## 02.28 Truth May Have Time

Business Truth may change.

Examples include:

- prices
- promotions
- staff
- availability
- operating hours
- policies
- inventory

Kablet must not assume that the current value was always true or will remain true indefinitely.

Where historically important, Business Truth should preserve enough temporal meaning to determine what was authoritative when a Decision or Outcome occurred.

This is essential for reconstructing historical decisions.

---

## 02.29 Historical Decisions Must Be Reconstructable Against Historical Truth

If Kablet made a Decision when a Product cost 199 AED and the Business later changes the price to 249 AED, historical analysis must not incorrectly assume the Decision occurred using the new price.

The system must therefore preserve sufficient lineage between:

Decision
    ↓
Relevant Business Truth
    ↓
Truth Version / State
    ↓
Experience
    ↓
Outcome

The exact storage strategy belongs to Technical Architecture.

The foundational requirement is historical interpretability.

---

## 02.30 Business Truth Must Be Machine-Usable

Business Truth exists not only for display to humans.

It must be structured sufficiently for Kablet Intelligence to reason about:

- relationships
- eligibility
- constraints
- alternatives
- prices
- offers
- actions
- availability
- proof
- policies
- operational context

Unstructured text may exist as part of Business Truth.

However, critical commercial concepts must not depend exclusively on parsing arbitrary prose every time the runtime needs them.

The structure should become richer as Kablet's capabilities expand.

---

## 02.31 Business Truth Must Be Extensible

Kablet cannot know every future vertical-specific concept in advance.

The foundation must therefore support extension.

For example, future verticals may introduce:

Clinic:
Treatment
Practitioner
Consultation Requirement

Ecommerce:
Variant
Inventory
Shipping Method

SaaS:
Plan
Feature
Usage Limit

Hospitality:
Room Type
Stay Policy
Occupancy

These concepts should extend Kablet's Business Truth model without requiring the foundational definition of Business Truth to be replaced.

---

## 02.32 Intelligence May Recommend Truth Changes

Kablet's Learning Brain may eventually identify opportunities such as:

- an offer appears ineffective
- customers repeatedly ask for information that is missing
- pricing information creates confusion
- an FAQ should be added
- a Service description appears incomplete
- a different approved commercial configuration may perform better

Kablet may present these findings as recommendations to the Business.

A recommendation does not itself modify authoritative Business Truth.

Conceptually:

Observed Outcomes
      ↓
Learning
      ↓
Recommendation
      ↓
Business Approval
      ↓
Business Truth Change

Unless explicit delegated authority exists, approval remains with the Business.

---

## 02.33 Business Truth Changes Must Be Attributable

Meaningful changes to authoritative Business Truth should be attributable to an actor or authorized source.

A change may originate from:

- an authorized User
- an authorized external system
- an approved synchronization
- an explicitly delegated Kablet capability

Kablet should eventually be capable of answering:

- what changed?
- when?
- from what?
- to what?
- who or what changed it?
- under what authority?
- which later Decisions used the new truth?

This lineage supports trust, debugging, auditing, and learning.

---

## 02.34 Business Truth Is Business-Specific by Default

Business Truth belongs to its Business ownership context.

The fact that Kablet knows Business A's prices, services, customers, policies, or performance does not make those facts available to Business B.

Cross-business intelligence may derive generalized patterns according to the governance principles defined elsewhere.

Underlying private Business Truth remains tenant-bound unless explicitly authorized otherwise.

---

# 02.A Canonical Business Truth Model

The foundational model is:

Business
   │
   ▼
Business Truth
   │
   ├── Brand
   ├── Services
   ├── Products
   ├── Pricing
   ├── Offers
   ├── People
   ├── Proof
   ├── FAQs
   ├── Policies
   ├── Media
   ├── Locations
   ├── Availability
   ├── Actions
   └── Business Rules

Business Truth may be populated through:

Manual Input
External Systems
Imports
APIs
Synchronization
AI-Assisted Extraction

But all paths converge on the same canonical Business Truth layer.

The runtime consumes Business Truth rather than coupling itself directly to every source system.

---

# 02.B Authority Model

The foundational authority model is:

Business / Authorized Operator
            │
            │ defines or authorizes
            ▼
      Business Truth
            │
            ▼
    Kablet Intelligence
            │
            │ selects / composes /
            │ explains / sequences /
            │ recommends / optimizes
            ▼
    Customer Experience

Where explicitly delegated:

Business
   ↓
Delegated Authority
   ↓
Constraints
   ↓
Kablet Intelligence
   ↓
Validated Change / Action

The permanent rule is:

**Kablet optimizes inside authority. It does not manufacture authority.**

---

# 02.C Truth Lifecycle

A generalized Business Truth lifecycle is:

Source
   ↓
Ingestion
   ↓
Normalization
   ↓
Validation / Resolution
   ↓
Authoritative Business Truth
   ↓
Version / State
   ↓
Runtime Consumption
   ↓
Decision
   ↓
Experience
   ↓
Outcome

Changes may then occur through:

Business Change
External Synchronization
Authorized Override
Approved Recommendation
Explicit Delegation

The resulting Truth becomes available to future Decisions while historical lineage remains interpretable.

---

# 02.D Core Business Truth Invariants

1. The Business is the ultimate authority over Business Truth.
2. Authorized systems may maintain Truth where the Business has delegated that authority.
3. Kablet must not silently change authoritative Truth merely to improve conversion.
4. Capability does not imply authority.
5. Delegated authority must be explicit and constrained.
6. Business Truth is structured business knowledge, not website layout.
7. Source Data is not automatically canonical Business Truth.
8. Meaningful Truth preserves provenance.
9. Conflicting sources require explicit and traceable resolution.
10. Manual business authority remains possible where operationally appropriate.
11. Business-provided claims are distinguishable from independently established facts.
12. Generated Experience does not automatically become Business Truth.
13. Derived information remains distinguishable from authoritative inputs.
14. Truth may be scoped.
15. Truth may change over time.
16. Historical Decisions must remain interpretable against the Truth available when they occurred.
17. Business Truth must be machine-usable.
18. Business Truth must support vertical extension.
19. Kablet may recommend changes without silently applying them.
20. Meaningful Truth changes are attributable.
21. Business Truth is tenant-bound by default.

---

# 02.E Explicitly Not Defined Here

This section intentionally does not define:

- database tables
- database schemas
- ingestion pipelines
- synchronization workers
- external connector implementations
- specific commerce integrations
- specific CRM integrations
- vector databases
- embedding strategies
- retrieval architecture
- AI extraction prompts
- administrative forms
- Business onboarding UI
- approval workflow UI
- detailed version-storage implementation
- conflict-resolution algorithms
- caching
- search infrastructure
- specific vertical schemas

Those belong to Technical Architecture or later domain specifications.

This section defines the permanent authority, structure, provenance, and lifecycle principles of Business Truth.

---

# 02.F Foundation Dependency

Business Truth establishes what Kablet is allowed to know and represent about a Business.

Identity & Ownership established:

**Whose truth is this?**

Business Truth establishes:

**What is true, who authorized it, and under what conditions does it apply?**

The next foundation defines the controlled language through which Kablet turns that Truth into customer-facing experiences:

**03 — Experience & Component Contract.**

---

# 03. Experience & Component Contract

## 03.1 Purpose

The Experience & Component Contract defines the controlled language through which Kablet Intelligence creates and modifies customer-facing experiences.

Kablet Intelligence must be capable of dynamically deciding:

- what should appear
- what should disappear
- what should be emphasized
- what information should be presented
- what sequence should be used
- what actions should be offered
- how the experience should adapt as the visitor's state changes

However, intelligence must not require unrestricted control over production interface code.

The Experience Contract therefore establishes a boundary between:

**Decision-making**

and

**Rendering**

Conceptually:

Intelligence
    ↓
Decision
    ↓
Experience Plan
    ↓
Validated Experience Contract
    ↓
Runtime
    ↓
Rendered Customer Experience

Kablet Intelligence controls the experience through this contract.

The runtime controls safe and deterministic execution of the contract.

---

## 03.2 Experience

An Experience represents the customer-facing state Kablet intentionally presents to a Visitor at a particular point in the journey.

An Experience may contain:

- explanatory content
- Business Truth
- Products
- Services
- Pricing
- Offers
- Proof
- People
- Media
- questions
- recommendations
- comparisons
- Actions
- interactive Components
- other permitted customer-facing elements

An Experience is contextual.

It is produced for a particular customer situation and may change as Kablet learns more about the Visitor.

An Experience is not Business Truth.

It is a contextual presentation of Business Truth and other permitted experience information.

---

## 03.3 Experience Is State, Not a Page

Kablet must not define Experience as equivalent to a webpage.

A webpage is one possible rendering model.

An Experience represents the current customer-facing state regardless of how it is visually rendered.

For example:

Visitor expresses interest in laser treatment.

Kablet may produce:

Experience
├── Short response
├── Relevant Service
├── Practitioner proof
├── Starting price
└── Book Consultation action

After the Visitor asks about recovery:

Experience
├── Recovery explanation
├── Relevant FAQ
├── Supporting proof
└── Book Consultation action

The URL may not change.

No traditional page transition may occur.

The Experience has nevertheless changed.

---

## 03.4 Experience Plan

An Experience Plan represents Kablet Intelligence's intended customer-facing response to a Decision.

The Experience Plan describes what the runtime should attempt to present or change.

It may include concepts such as:

- response
- Components
- Component ordering
- Business Truth references
- Actions
- emphasis
- visibility
- composition
- continuation behavior
- replacement behavior

The Experience Plan is declarative.

It describes the intended experience rather than instructing the runtime how to manipulate low-level interface code.

---

## 03.5 Component

A Component is a controlled customer-facing capability that the Kablet runtime knows how to render and operate.

Examples may include:

- Message
- Service Card
- Product Card
- Price
- Offer
- Proof
- Testimonial
- Person
- Comparison
- FAQ
- Media
- Recommendation
- Booking
- Checkout
- Lead Form
- Contact Action
- Option Selector
- Question
- Location
- Availability

The exact initial Component library will be defined later.

The foundational requirement is that Components are known capabilities with defined contracts.

---

## 03.6 Intelligence Selects Components; It Does Not Invent Runtime Capabilities

Kablet Intelligence may select from Components and capabilities made available to it.

For example:

Available Components:

ServiceCard
PriceCard
ProofCard
FAQCard
BookingAction

Intelligence may decide:

1. show ServiceCard
2. show ProofCard
3. show PriceCard
4. offer BookingAction

It may not decide:

"Create a completely new executable component with arbitrary JavaScript and run it."

New Component capabilities must enter Kablet through controlled platform extension.

This separates intelligence flexibility from runtime safety.

---

## 03.7 Components Are Semantic, Not Merely Visual

A Component should represent meaningful customer-facing capability rather than only visual styling.

For example:

Price

is semantically different from:

Testimonial

even if both could technically be displayed inside similar rectangular UI containers.

Semantic Components allow Kablet Intelligence to reason about what each element means and when it may be useful.

Visual design may evolve independently.

Therefore:

Component meaning
≠
Component appearance

---

## 03.8 Components May Have Multiple Renderings

A semantic Component may support different valid visual representations.

For example:

Proof may render as:

- compact review
- testimonial card
- rating summary
- evidence carousel
- expanded case study

The Experience Contract should identify the semantic intent.

The runtime and presentation system may determine the appropriate supported rendering according to:

- device
- available space
- brand
- experience context
- tested variation
- accessibility
- other valid presentation conditions

This allows visual evolution without changing the meaning of the underlying Component.

---

## 03.9 Component Payload

Each Component receives a defined payload.

The payload contains the information required to render and operate that Component.

Conceptually:

Component
    type: Price
    payload:
        amount
        currency
        qualifier
        source_reference

Or:

Component
    type: Testimonial
    payload:
        quote
        author
        rating
        proof_reference

Payloads must conform to the contract defined for their Component type.

The runtime must reject or safely handle invalid payloads.

---

## 03.10 Components Should Prefer References to Canonical Truth

Where a Component represents Business Truth, the Experience Contract should preserve a relationship to the canonical Truth that produced it.

For example:

Experience Component
    type: Service
    source: Service_123

rather than requiring intelligence to recreate the entire Service as arbitrary generated text.

The runtime may resolve the referenced Business Truth into the information needed for rendering.

Generated presentation may exist around that Truth.

The canonical source relationship should remain available where meaningful.

This improves:

- consistency
- traceability
- freshness
- debugging
- attribution
- historical reconstruction

---

## 03.11 Generated Content Must Remain Distinguishable From Referenced Truth

An Experience may contain both:

- canonical Business Truth
- generated explanatory content

Those must remain conceptually distinguishable.

Example:

Business Truth:

Price = 399 AED

Generated explanation:

"This option starts from 399 AED and may suit visitors looking for..."

The generated explanation is not the authoritative Price.

The Experience Contract should preserve enough structure to distinguish generated language from canonical referenced Truth.

---

## 03.12 Composition

Composition defines how Components form an Experience.

Composition may include concepts such as:

- order
- grouping
- hierarchy
- prominence
- relationship
- replacement
- insertion
- removal
- persistence

For example:

Experience
├── Message
├── Service
├── Proof
├── Price
└── Booking Action

Another Visitor may receive:

Experience
├── Message
├── Comparison
├── FAQ
├── Proof
└── Booking Action

The same Component library can therefore create substantially different journeys.

---

## 03.13 Composition Must Not Become a Fixed Funnel

The Experience Contract must allow Kablet to compose different sequences dynamically.

It must not encode one permanent funnel such as:

Hero
↓
Benefits
↓
Testimonials
↓
Pricing
↓
CTA

Such a sequence may be produced when appropriate.

It must not become the foundational customer journey.

The Experience Contract exists specifically to permit adaptive composition.

---

## 03.14 Experience Changes May Be Incremental

Kablet should not require regeneration of the entire frontend whenever the Visitor state changes.

An Experience may evolve incrementally.

For example:

Current Experience:

Service
Proof
Price

Visitor asks:

"Can I do this tomorrow?"

Kablet may add:

Availability
Booking Action

without necessarily destroying the useful existing context.

The Experience Contract must therefore support the concept of experience transitions rather than only complete page replacement.

---

## 03.15 Experience Operations

The contract may eventually support controlled operations such as:

- present
- append
- insert
- replace
- remove
- update
- emphasize
- collapse
- expand
- persist

The exact operation vocabulary will be defined during Technical Architecture.

The foundational principle is that intelligence modifies the experience through known operations rather than arbitrary interface manipulation.

---

## 03.16 Actions Are Distinct From Components

A Component presents or facilitates part of the customer experience.

An Action represents something the customer may actually do.

For example:

BookingCard

may be a Component.

BookAppointment

is an Action.

ProductCard

may be a Component.

AddToCart

is an Action.

This distinction allows presentation and business capability to evolve independently.

Components may expose Actions.

Actions remain governed by Business Truth, authorization, validation, and execution constraints.

---

## 03.17 Intelligence May Surface Only Available Actions

The Experience Contract must not allow intelligence to invent business capabilities.

If Business Truth permits:

- Book
- Call
- WhatsApp

Kablet may intelligently decide which of those Actions to surface.

It may not offer:

- Buy Now

if no authorized purchase capability exists.

Available Actions therefore constrain Experience generation.

---

## 03.18 Experience Must Respect Business Rules

Experience optimization occurs inside Business Truth and Business Rules.

If Business Truth states:

Consultation required before Treatment A

Kablet must not optimize the experience by offering an unauthorized direct purchase of Treatment A.

If Offer B applies only to new customers, Kablet must not knowingly present it as available to an ineligible customer.

The Experience Contract must allow the runtime to validate experience decisions against applicable constraints.

---

## 03.19 Experience Must Respect Brand Constraints

Kablet controls experience composition.

It does not mean Kablet ignores the Business's brand.

Generated Experiences must operate within authorized Brand constraints defined in Business Truth.

This may affect:

- typography
- visual language
- tone
- terminology
- imagery
- permitted styles
- communication constraints

Kablet may optimize within the brand system.

It should not silently redefine the Business's identity.

---

## 03.20 Runtime Validation Is Mandatory

An Experience Plan produced by intelligence is a proposal until validated.

Conceptually:

Intelligence
    ↓
Experience Plan
    ↓
Contract Validation
    ↓
Business Rule Validation
    ↓
Capability Validation
    ↓
Runtime
    ↓
Customer

Validation may determine:

- Component type exists
- payload is valid
- referenced Truth exists
- referenced Truth belongs to the correct Business
- Action exists
- Action is permitted
- required constraints are satisfied
- operation is supported

Invalid output must not become uncontrolled runtime behavior.

---

## 03.21 Invalid Intelligence Output Must Fail Predictably

Kablet must assume intelligence can occasionally return:

- malformed output
- unsupported Components
- missing references
- invalid Actions
- contradictory instructions
- incomplete payloads

The runtime must not treat these failures as impossible.

It must safely:

- reject
- repair where deterministic and permitted
- fall back
- preserve the last valid Experience
- request another Decision

according to later-defined policies.

The customer-facing runtime must remain stable even when intelligence output is imperfect.

---

## 03.22 Experience Contracts Must Be Versioned

The Experience Contract will evolve.

New Components, fields, operations, capabilities, and composition models will be introduced.

Experience Contracts must therefore support explicit versions.

A Decision created under one contract version must remain historically interpretable even after newer versions exist.

The runtime must not silently reinterpret historical Experience Plans according to incompatible future semantics.

---

## 03.23 Component Contracts Must Be Versioned

Individual Component types may evolve independently.

For example:

ServiceCard v1

may support:

- name
- description
- price

ServiceCard v2

may additionally support:

- provider
- availability
- comparison metadata

The exact versioning implementation belongs to Technical Architecture.

The permanent requirement is controlled evolution without destroying historical meaning.

---

## 03.24 Components Must Be Extensible

Kablet's initial Component library will be intentionally small.

Future verticals will require specialized capabilities.

Examples:

Clinic:
Treatment Comparison
Practitioner Selector
Consultation Eligibility

Ecommerce:
Variant Selector
Cart
Inventory Notice

SaaS:
Plan Comparison
Feature Matrix
Trial Signup

Hospitality:
Room Selector
Date Availability

These should extend the Component system rather than require a new frontend architecture for every vertical.

---

## 03.25 Vertical Components May Extend Universal Components

Kablet should prefer reusable semantic primitives where possible.

For example:

Comparison

may be universally useful.

A clinic-specific Treatment Comparison may extend or configure that capability rather than requiring every vertical to reinvent comparison from zero.

However, Kablet must not force genuinely different business semantics into overly generic abstractions merely for architectural purity.

The Component system should support both:

- universal primitives
- specialized vertical Components

---

## 03.26 The Component Library Is a Capability Boundary

The available Component library defines what Kablet Intelligence can currently express through the frontend.

Adding a Component therefore expands Kablet's runtime capabilities.

This means Component development is not merely UI work.

It expands the action and experience vocabulary available to the intelligence layer.

The Component registry should eventually allow Intelligence to understand:

- what Components exist
- what each Component means
- what payload each requires
- what Actions each can expose
- what constraints apply
- what contexts each supports

---

## 03.27 The Runtime Must Not Depend on a Specific Intelligence Provider

The Experience Contract is the boundary between intelligence and frontend runtime.

Any intelligence implementation capable of producing a valid contract should be usable.

For example:

Rules Engine
        ↓

LLM
        ↓

Experiment Policy
        ↓

Proprietary Model
        ↓

Hybrid Intelligence
        ↓

Experience Contract
        ↓
Runtime

The frontend runtime must not require knowledge of which AI provider or reasoning mechanism produced the Experience Plan.

---

## 03.28 Intelligence Must Not Depend on Frontend Framework Internals

Similarly, Intelligence should reason in Kablet semantic concepts rather than frontend framework details.

Intelligence should think:

"Show relevant proof before booking."

Not:

"Render React component X with CSS class Y inside DOM node Z."

This preserves separation between:

Experience reasoning

and

technical rendering implementation.

Frontend technology may therefore evolve without requiring Kablet's intelligence model to be rebuilt around framework-specific concepts.

---

## 03.29 Experiences Must Be Observable

Kablet must be capable of observing what Experience was actually presented.

It is insufficient to record only what Intelligence intended to present.

The system must eventually distinguish:

Decision
    ↓
Planned Experience
    ↓
Validated Experience
    ↓
Rendered Experience
    ↓
Viewed / Interacted Experience
    ↓
Outcome

This distinction is essential for debugging and learning.

A Component cannot reasonably receive credit for an outcome if it was planned but never successfully rendered or viewed.

---

## 03.30 Component Exposure Must Be Measurable

Meaningful Component exposure and interaction should be capable of producing Events.

Examples may include:

component.rendered
component.viewed
component.interacted

The exact Event vocabulary belongs to Foundation 05.

The Experience Contract must nevertheless support stable Component identity so Events can reference what was actually experienced.

---

## 03.31 Experience Identity Must Be Traceable

An Experience should have stable identity sufficient to connect it to:

- Visitor
- Session
- Decision
- Contract version
- Components
- Business Truth references
- Actions
- Events
- Outcomes
- Experiments

This does not imply that every tiny visual update must create an entirely new conceptual customer journey.

It establishes that meaningful experience states must be traceable.

---

## 03.32 Component Instances Must Be Distinguishable

A Component type and a Component instance are different concepts.

For example:

Component Type:
Proof

Component Instances:
Proof #A — Sarah testimonial
Proof #B — Google rating
Proof #C — professional certification

Kablet must be capable of knowing which specific instance was presented.

This is required for:

- attribution
- experimentation
- debugging
- optimization
- learning

---

## 03.33 Presentation Variants Must Be Distinguishable From Semantic Content

Kablet may experiment with presentation without changing underlying Business Truth.

For example:

Same Offer
Same Price
Same Action

but:

Variant A:
compact offer card

Variant B:
large offer presentation

The system should distinguish:

semantic content

from

presentation variant

This enables Kablet to learn whether differences in presentation affect outcomes without incorrectly treating them as different business facts.

---

## 03.34 Conversation Is One Experience Capability, Not the Entire Product

Kablet may use conversational interaction.

Conversation may be important for:

- understanding intent
- answering questions
- discovering constraints
- resolving uncertainty
- guiding decisions

However, Kablet must not be architecturally reduced to a chatbot.

Conversation is one mechanism through which Visitor State and Experience may evolve.

The resulting frontend may contain rich visual and transactional Components.

The foundational model is:

Conversation can control and influence the interface.

Conversation is not necessarily the interface.

---

## 03.35 Experiences Must Support Non-Conversational Interaction

Visitors may communicate intent through:

- text
- clicks
- selections
- filters
- form input
- voice
- behavior
- direct Actions
- other interaction modes

The Experience Contract must not require a chat message before every intelligent adaptation.

Kablet Intelligence should be capable of responding to relevant Visitor State changes regardless of how those changes were produced.

---

## 03.36 The Runtime Must Preserve Customer Continuity

Dynamic adaptation must not make the interface feel randomly unstable.

Kablet should preserve useful context where appropriate.

For example, if a Visitor is comparing two Services, unrelated adaptation should not unexpectedly destroy the comparison state without reason.

The intelligence layer may intentionally transition the Experience.

The runtime must preserve enough continuity for the customer to understand and operate the interface.

The exact UX rules belong to later product design.

---

## 03.37 Accessibility Is a Runtime Constraint

Dynamic intelligence must not bypass accessibility requirements.

Because Kablet controls customer-facing experiences dynamically, supported Components and renderers must be designed so that generated compositions can remain accessible.

Intelligence should not be able to produce arbitrary structures that invalidate the runtime's accessibility guarantees.

Detailed accessibility standards belong to Technical and Product specifications.

The foundational principle is that accessibility is part of valid rendering, not an optional property of manually designed pages.

---

## 03.38 Experience Generation Must Respect Privacy Boundaries

The Experience layer may use Visitor State to adapt what is shown.

That does not authorize unrestricted exposure of internal or sensitive information.

Experience generation must operate within:

- Business Truth visibility rules
- tenant boundaries
- Visitor permissions
- applicable privacy constraints
- action authorization
- data-use constraints

The frontend must never become a mechanism through which internal Business Truth or another tenant's information is accidentally exposed.

---

## 03.39 The Experience Contract Is Not the Learning Brain

The Experience Contract describes what Kablet decided to present.

It does not itself determine whether the experience was effective.

Learning occurs through the relationship:

Visitor State
    ↓
Decision
    ↓
Experience
    ↓
Exposure
    ↓
Interaction
    ↓
Outcome

The Experience Contract supplies the structured middle of that chain.

Foundation 05 will define the Event & Outcome Spine.

The Learning Brain will later use those records to improve future decisions.

---

# 03.A Canonical Experience Model

The foundational model is:

Business Truth
      +
Visitor State
      +
Available Components
      +
Available Actions
      +
Applicable Constraints
      ↓
Kablet Intelligence
      ↓
Decision
      ↓
Experience Plan
      ↓
Validation
      ↓
Experience
      │
      ├── Component Instance
      ├── Component Instance
      ├── Component Instance
      └── Available Action
      ↓
Runtime
      ↓
Customer

---

# 03.B Component Model

Conceptually:

Component Type
    │
    ├── Semantic Purpose
    ├── Payload Contract
    ├── Supported Actions
    ├── Constraints
    ├── Supported Renderings
    └── Version

An Experience contains:

Component Instances
    │
    ├── Type
    ├── Identity
    ├── Payload
    ├── Business Truth References
    ├── Generated Content
    ├── Presentation Variant
    ├── Actions
    └── Position / Composition Context

This model allows Kablet to know both:

**what kind of capability was used**

and

**what specific thing the Visitor actually experienced.**

---

# 03.C Intelligence / Runtime Boundary

The permanent boundary is:

Kablet Intelligence
        │
        │ produces
        ▼
Decision + Experience Plan
        │
        ▼
Contract Validation
        │
        ▼
Authorized Runtime
        │
        ▼
Rendered Experience

Intelligence may determine:

- what should be communicated
- which Truth is relevant
- which Components should appear
- which Actions should be offered
- how the Experience should evolve

Runtime determines:

- whether the contract is valid
- whether references resolve
- whether Actions are permitted
- whether constraints are satisfied
- how supported Components are safely rendered
- how interaction is technically executed

---

# 03.D Core Experience Invariants

1. Experience is contextual and is not Business Truth.
2. Experience is customer-facing state, not necessarily a webpage.
3. Intelligence controls the frontend through explicit contracts.
4. Intelligence does not generate unrestricted executable frontend code.
5. Components are controlled semantic capabilities.
6. Component meaning is separate from visual appearance.
7. Component payloads are validated.
8. Components representing Business Truth preserve canonical references where meaningful.
9. Generated content remains distinguishable from authoritative Truth.
10. Composition is dynamic rather than a fixed funnel.
11. Experiences may evolve incrementally.
12. Actions and Components are separate concepts.
13. Intelligence may surface only authorized Actions.
14. Experiences must respect Business Rules and Brand constraints.
15. Intelligence output is validated before runtime execution.
16. Invalid intelligence output fails predictably.
17. Experience and Component contracts are versioned.
18. Component capabilities are extensible.
19. Runtime does not depend on a specific intelligence provider.
20. Intelligence does not depend on frontend framework internals.
21. Planned, rendered, viewed, and interacted Experiences are distinguishable.
22. Component instances are traceable.
23. Semantic content and presentation variants are distinguishable.
24. Conversation is a capability, not the entire Kablet product.
25. Non-conversational interaction may also drive adaptation.
26. Dynamic adaptation preserves reasonable customer continuity.
27. Valid rendering must respect accessibility constraints.
28. Experience generation respects ownership and privacy boundaries.
29. Experience structure participates in Decision-to-Outcome lineage.

---

# 03.E Explicitly Not Defined Here

This section intentionally does not define:

- React components
- frontend framework
- CSS system
- design system implementation
- animation system
- exact JSON schemas
- structured-output technology
- AI prompting
- streaming implementation
- browser state management
- server rendering strategy
- client rendering strategy
- Component registry implementation
- Component discovery implementation
- exact Component library for MVP
- exact Experience operations
- accessibility implementation details
- event schemas
- experimentation algorithms

Those decisions belong to Technical Architecture and implementation specifications.

This section defines the permanent contract between Kablet Intelligence and the customer-facing runtime.

---

# 03.F Foundation Dependency

Identity & Ownership established:

**Whose system and data is this?**

Business Truth established:

**What is the Business-authorized truth?**

Experience & Component Contract establishes:

**How may Kablet Intelligence safely turn that truth into an adaptive customer-facing experience?**

The next foundation defines the dynamic information Kablet maintains about the customer and the decisions produced from it:

**04 — Visitor State & Decisions.**