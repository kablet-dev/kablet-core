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

---

# 04. Visitor State & Decisions

## 04.1 Purpose

Visitor State & Decisions defines how Kablet represents its evolving understanding of a customer interaction and how that understanding produces traceable customer-facing decisions.

This foundation provides the bridge between:

- Visitor behavior
- Business Truth
- Kablet Intelligence
- Experience generation
- Actions
- Outcomes
- future learning

Kablet must not treat every customer interaction as an isolated prompt.

It must maintain enough structured state to understand what is happening across the customer journey.

The foundational relationship is:

Visitor
    ↓
Session
    ↓
Signals
    ↓
Visitor State
    ↓
Decision
    ↓
Experience
    ↓
Behavior
    ↓
Outcome

---

## 04.2 Visitor

A Visitor represents a customer-side identity interacting with a Kablet-powered Business experience.

A Visitor is not a Kablet business User.

A Visitor may initially be anonymous.

Over time, Kablet may learn or receive additional identity information according to applicable permissions and privacy constraints.

A Visitor may participate in one or more Sessions.

The Visitor concept exists to provide continuity where appropriate without requiring known customer identity from the beginning.

---

## 04.3 Visitor Identity Is Business-Scoped by Default

Visitor identity must exist within an explicit Business ownership context.

Kablet must not automatically assume that the same person interacting with two different Businesses should become one globally shared customer identity.

Conceptually:

Business A
    ↓
Visitor A

Business B
    ↓
Visitor B

Any future cross-business identity capability would require deliberate authorization, privacy design, and governance.

Cross-business intelligence does not imply cross-business customer identity.

---

## 04.4 Anonymous Visitors Are First-Class Visitors

Kablet must be useful before it knows who a Visitor is.

A Visitor may begin with:

- no name
- no email
- no phone number
- no account
- no prior history

Kablet should still be capable of understanding:

- current intent
- expressed needs
- constraints
- concerns
- behavior
- current journey state

Known identity may enrich Visitor State.

It must not be required for intelligent interaction.

---

## 04.5 Session

A Session represents a bounded period of interaction between a Visitor and a Kablet-powered Business experience.

A Session provides the immediate context in which:

- signals occur
- state evolves
- Decisions are made
- Experiences are presented
- Actions are attempted
- Outcomes may occur

A Visitor may have multiple Sessions over time.

The exact technical rules determining session start, continuation, expiration, and reconnection belong to Technical Architecture.

---

## 04.6 Visitor and Session Are Different

Visitor represents customer continuity.

Session represents an interaction period.

Conceptually:

Visitor
├── Session A
├── Session B
└── Session C

This distinction allows Kablet eventually to understand:

"This Visitor returned."

without pretending that all activity happened in one continuous interaction.

---

## 04.7 Signals

A Signal is information that may contribute to Kablet's understanding of the Visitor or current interaction.

Signals may come from:

- messages
- clicks
- selections
- searches
- form input
- viewed Components
- interaction with Components
- Actions
- referral context
- campaign context
- device context
- session history
- prior permitted history
- external systems
- other authorized observations

Signals are inputs to interpretation.

They are not automatically established facts about the Visitor.

---

## 04.8 Observation and Interpretation Must Remain Distinguishable

Kablet must distinguish what directly happened from what it inferred.

Example:

Observed:

Visitor clicked "Pricing."

Possible interpretation:

Visitor may be price-sensitive.

The observation is evidence.

The interpretation is an inference.

Kablet must not silently convert every inference into established customer truth.

This distinction is necessary for:

- debugging
- confidence
- correction
- experimentation
- future learning

---

## 04.9 Visitor State

Visitor State is Kablet's structured representation of what is currently relevant about the Visitor and their journey.

Visitor State may include:

- context
- intent
- needs
- goals
- constraints
- concerns
- preferences
- eligibility
- journey state
- interaction history
- relevant prior state
- current Experience context
- confidence
- unresolved questions

Visitor State is dynamic.

It may change as new evidence becomes available.

---

## 04.10 Context

Context represents circumstances surrounding the current interaction.

Examples may include:

- entry source
- campaign
- referral
- device
- locale
- language
- time context
- relevant location context
- current Business
- current Property / Location
- current Session
- current Experience

Context may influence a Decision without becoming a permanent characteristic of the Visitor.

---

## 04.11 Intent

Intent represents what Kablet currently understands the Visitor is trying to accomplish.

Examples:

- explore a Service
- compare Products
- understand pricing
- resolve a concern
- book
- buy
- request a quote
- contact the Business
- evaluate suitability

Intent may be:

- explicit
- inferred
- uncertain
- evolving

Kablet must be capable of revising intent as new evidence appears.

---

## 04.12 Needs

Needs represent requirements the Visitor has expressed or that Kablet has reasonably inferred.

Examples:

- wants a particular outcome
- needs a specific feature
- requires weekend availability
- requires delivery to a certain region
- wants a particular Service characteristic

Needs help Kablet determine which Business Truth and Experience capabilities are relevant.

---

## 04.13 Constraints

Constraints represent conditions that restrict acceptable options or Actions.

Examples:

- budget
- timing
- geography
- eligibility
- availability
- product compatibility
- required Business policy
- customer-stated limitation

Constraints may originate from:

- the Visitor
- Business Truth
- Business Rules
- operational systems

The origin of consequential constraints should remain traceable.

---

## 04.14 Concerns

Concerns represent uncertainty, objections, fears, risks, or unanswered questions affecting the Visitor's willingness to proceed.

Examples:

- price concern
- trust concern
- outcome concern
- safety concern
- timing concern
- comparison uncertainty
- commitment concern

Concerns may materially affect Experience strategy.

For example:

Concern:
"Will this look unnatural?"

may cause Kablet to surface:

- relevant explanation
- appropriate Proof
- practitioner information

before asking for booking.

---

## 04.15 Preferences

Preferences represent Visitor-expressed or reasonably inferred choices that may improve relevance.

Examples:

- preferred location
- preferred time
- preferred Product type
- preferred communication method
- preferred option

Preferences must remain distinguishable from hard Constraints.

A preference indicates desirability.

A constraint may determine eligibility.

---

## 04.16 Journey State

Journey State represents Kablet's current understanding of where the Visitor is within the commercial interaction.

Journey State must not require one universal funnel.

Possible states may include concepts such as:

- exploring
- evaluating
- comparing
- resolving uncertainty
- ready for action
- action in progress
- converted
- unable to proceed

The exact vocabulary may vary by vertical or future implementation.

Journey State exists to help Intelligence reason about what should happen next.

It does not prescribe a fixed sequence.

---

## 04.17 State Is Evidence-Based and Revisable

Visitor State is not permanent truth merely because Kablet inferred it once.

New evidence may:

- strengthen
- weaken
- replace
- contradict
- resolve

existing State.

For example:

Initial inference:

Budget-sensitive.

Later statement:

"Price doesn't matter; I just want the best available option."

Kablet should be capable of revising its understanding.

State must therefore support change rather than accumulating assumptions forever.

---

## 04.18 State May Carry Confidence

Where Visitor State is inferred rather than explicitly supplied, Kablet should be capable of representing uncertainty.

Conceptually:

Intent:
Book consultation

Confidence:
High

Concern:
Price sensitivity

Confidence:
Low

The exact confidence representation belongs to Technical Architecture.

The foundational requirement is that uncertain inference must not automatically become indistinguishable from confirmed information.

---

## 04.19 State Must Preserve Relevant Provenance

Where consequential, Kablet should be capable of determining why a State value exists.

For example:

Concern:
Recovery time

Derived from:
Visitor message

Or:

Preferred Location:
Dubai Marina

Derived from:
Explicit selection

Or:

Price sensitivity:
Inferred from pricing interactions

This provenance supports:

- explanation
- correction
- debugging
- learning

---

## 04.20 Explicit Visitor Input Generally Outranks Conflicting Inference

If Kablet infers something about a Visitor and the Visitor later explicitly provides contradictory information, the explicit information should generally supersede the unsupported inference.

For example:

Inferred:
Visitor prefers cheapest option.

Visitor says:
"I don't care about price."

Kablet should not continue operating as though price sensitivity were established.

This principle does not override authoritative Business constraints or independently verified operational facts.

---

## 04.21 State Must Be Relevant, Not an Unlimited Customer Profile

Kablet should maintain information useful to the Business interaction and permitted by applicable rules.

Visitor State must not become an excuse to accumulate unlimited information about individuals.

State design should be guided by:

- relevance
- purpose
- permission
- privacy
- retention requirements
- Business need

The exact privacy implementation belongs to later specifications.

---

## 04.22 Session State and Durable Visitor State Are Different

Some State may be relevant only to the current Session.

Other information may be useful across future Sessions where permitted.

Example:

Session State:
Currently comparing Service A and Service B.

Potential durable State:
Preferred Business location.

Kablet must not automatically make every transient inference a permanent Visitor characteristic.

The boundary between session-scoped and durable state must be explicit.

---

## 04.23 Decision

A Decision is Kablet's explicit representation of a meaningful choice about what should happen next in the customer experience.

A Decision is one of the most important canonical objects in Kablet.

It connects:

State
    ↓
Reasoning Context
    ↓
Chosen Strategy
    ↓
Experience
    ↓
Behavior
    ↓
Outcome

A Decision makes Kablet's adaptive behavior traceable.

---

## 04.24 What Counts as a Meaningful Decision

Not every technical operation requires a canonical Decision.

A meaningful Decision occurs when Kablet intentionally chooses among materially different customer-facing strategies or Actions.

Examples:

- surface Proof before Pricing
- ask a clarifying question
- recommend Service A instead of Service B
- show Pricing immediately
- present a Comparison
- resolve a concern before presenting Booking
- offer an authorized promotion
- surface a particular Action
- change the Experience strategy

Low-level technical behavior such as animation frames or internal rendering mechanics does not require a commercial Decision object.

The exact threshold will be refined later.

---

## 04.25 Decision Inputs

A Decision may depend on:

- Business
- Property / Location
- Business Truth
- Business Rules
- Visitor
- Session
- Visitor State
- current Experience
- interaction history
- available Components
- available Actions
- experiment context
- prior learning
- applicable constraints
- Intelligence implementation

The Decision must preserve sufficient lineage to understand the meaningful context under which it was made.

---

## 04.26 Decision Output

A Decision should represent what Kablet chose.

Conceptually, it may contain:

Decision
├── objective
├── strategy
├── selected Truth
├── selected Components
├── selected Actions
├── Experience Plan
└── relevant rationale / metadata

The exact schema belongs to Technical Architecture.

The foundational requirement is that the Decision be a durable, inspectable representation of Kablet's choice.

---

## 04.27 Decision and Experience Are Different

A Decision represents the choice.

An Experience represents what is presented as a result.

Example:

Decision:

"Address trust concern before asking for booking."

Experience:

Message
Practitioner
Testimonials
Booking Action

This distinction matters because the same Decision strategy may be rendered through different Experiences.

It also allows Kablet to distinguish:

what it intended

from

what was actually rendered.

---

## 04.28 Decision and Reasoning Are Different

Kablet must preserve the Decision and its relevant structured basis.

It does not require storing unrestricted internal model reasoning.

The system needs durable commercial traceability such as:

- relevant State
- objective
- strategy
- selected information
- selected capabilities
- model / policy metadata where useful
- outcome linkage

The foundational data moat should depend on structured decision lineage rather than private or provider-specific reasoning traces.

---

## 04.29 Decision Objective Must Be Explicit

A meaningful Decision should be connected to an objective.

Examples:

- understand intent
- resolve uncertainty
- increase confidence
- help comparison
- determine eligibility
- progress toward booking
- progress toward purchase
- complete an Action

This allows future learning systems to distinguish decisions intended to achieve different purposes.

---

## 04.30 Decisions Must Respect Business Authority

Visitor State does not override Business Truth.

If a Visitor wants something the Business does not offer, Kablet must not invent it.

If the Visitor requests an unauthorized discount, Kablet must not create one unless delegated authority permits it.

Decision-making therefore operates inside:

Business Truth
+
Business Rules
+
Authorized Capabilities
+
Visitor State

Optimization occurs within those boundaries.

---

## 04.31 Decisions Must Be Immutable Historical Records

Once a Decision has materially influenced an Experience, the historical Decision should not be silently rewritten because Kablet later learns something new.

New understanding should produce a new State and, where appropriate, a new Decision.

Conceptually:

State v1
    ↓
Decision A
    ↓
Experience A

New Signal
    ↓
State v2
    ↓
Decision B
    ↓
Experience B

Decision A remains historically meaningful.

This is necessary for trustworthy learning and debugging.

---

## 04.32 Decision Lineage Must Preserve Historical Context

A historical Decision must remain interpretable against the relevant context that existed when it occurred.

This includes sufficient relationships to reconstruct meaningful inputs such as:

- applicable Business Truth
- Visitor State
- Experience context
- available capabilities
- experiment assignment
- applicable policies or constraints

Later changes must not make historical Decisions appear to have been made using information that did not exist at the time.

---

## 04.33 Intelligence Implementation Must Be Attributable

Kablet may use different intelligence mechanisms over time.

A Decision may be produced by:

- deterministic rules
- LLM
- experiment policy
- recommendation system
- proprietary model
- hybrid system
- future intelligence architecture

Where useful for evaluation and debugging, Kablet should be capable of identifying which intelligence configuration produced a Decision.

The runtime must not depend on that implementation.

The historical record should nevertheless be able to attribute it.

---

## 04.34 Decisions May Be Candidates Before Selection

Future Kablet Intelligence may evaluate multiple possible strategies.

For example:

Candidate A:
Show price first.

Candidate B:
Show proof first.

Candidate C:
Ask one more question.

The system may select one candidate according to:

- policy
- experiment
- learned strategy
- constraints
- optimization objective

Not every candidate must become a canonical executed Decision.

The executed Decision must remain distinguishable from alternatives considered or experiment variants available.

---

## 04.35 Experiment Context Is Part of Decision Context

A Decision may be influenced by an Experiment.

For example:

Experiment:
Proof-before-price vs Price-before-proof

Assignment:
Variant B

Decision:
Present Price before Proof

The Decision must remain attributable to that experiment context.

Otherwise Kablet cannot correctly evaluate whether an outcome resulted from normal policy or experimental treatment.

Detailed experimentation mechanics belong to later foundations.

---

## 04.36 Decisions Must Connect to Actual Exposure

A Decision cannot be evaluated solely from what it intended.

Kablet must eventually distinguish:

Decision created
    ↓
Experience planned
    ↓
Experience validated
    ↓
Experience rendered
    ↓
Experience viewed
    ↓
Experience interacted
    ↓
Outcome

If a Decision selected a Proof Component but the Visitor never saw it, future learning should not blindly treat the Decision as successfully exposed.

This relationship will be implemented through the Event & Outcome Spine.

---

## 04.37 Decisions Must Connect to Outcomes

The canonical learning relationship is:

Visitor State
    ↓
Decision
    ↓
Experience
    ↓
Exposure
    ↓
Behavior
    ↓
Outcome

Kablet's long-term intelligence depends on preserving this relationship.

A Decision without outcome lineage is useful for debugging.

A Decision with outcome lineage becomes useful for optimization and learning.

---

## 04.38 No-Conversion Is Also Information

A successful conversion is not the only meaningful result.

Kablet may need to understand outcomes such as:

- Visitor abandoned
- Action failed
- Visitor rejected recommendation
- Visitor continued exploring
- Visitor returned later
- no conversion occurred within a defined attribution window

Absence of conversion must be interpreted carefully.

It must not automatically prove that a Decision was poor.

The Event & Outcome foundation will define outcome representation more precisely.

---

## 04.39 State and Decision Must Support Learning Without Requiring Learning on Day One

The first Kablet implementation does not need sophisticated machine learning.

It may use:

- simple rules
- LLM reasoning
- deterministic policies
- basic experiments

However, it must preserve the structured relationship:

Context
→ State
→ Decision
→ Experience
→ Outcome

This allows future intelligence to learn from historical Kablet operation without requiring the early product to already contain the final Learning Brain.

---

## 04.40 State Must Not Be Coupled to One AI Model

Visitor State is a Kablet concept.

It must not exist only inside an AI provider's conversation history or prompt context.

An AI model may help interpret signals and update State.

Kablet owns the resulting structured State.

This allows:

- model replacement
- multi-model systems
- deterministic logic
- historical reconstruction
- independent experimentation

The AI provider is a processor.

Kablet owns the state.

---

## 04.41 Decisions Must Not Exist Only Inside AI Output

Similarly, a Decision must not exist only as transient model-generated text.

Once accepted as a meaningful runtime Decision, it becomes a Kablet object with Kablet identity and lineage.

This is necessary for:

- attribution
- debugging
- experiments
- learning
- observability
- future proprietary intelligence

---

## 04.42 Visitor Correction Must Be Possible

Where Kablet exposes or relies upon Visitor-understandable information, future Experiences should permit correction when appropriate.

For example:

Kablet:
"It sounds like you're mainly concerned about recovery time."

Visitor:
"No, my main concern is price."

The new signal should be capable of correcting State.

Kablet must not defend stale inference against explicit customer correction.

---

## 04.43 State Transitions Must Be Observable

Meaningful State changes should be capable of producing observable records.

Examples:

intent changed
concern identified
constraint added
preference confirmed
journey state changed

The exact Event vocabulary belongs to Foundation 05.

The foundational requirement is that important State transitions can be reconstructed rather than existing only transiently in memory.

---

## 04.44 Decisions Must Be Observable

Meaningful Decisions should produce observable records.

At minimum, Kablet must eventually be capable of connecting:

Decision identity
Business
Visitor
Session
State context
Experience
Experiment context
Outcome

This is a core requirement of the future Kablet Data Brain.

---

# 04.A Canonical Visitor Model

The foundational Visitor model is:

Business
   ↓
Visitor
   ↓
Session
   ↓
Signals
   ↓
Visitor State
   │
   ├── Context
   ├── Intent
   ├── Needs
   ├── Constraints
   ├── Concerns
   ├── Preferences
   ├── Journey State
   ├── Confidence
   └── Relevant History

Visitor State evolves as new Signals arrive.

---

# 04.B Canonical Decision Model

The foundational Decision model is:

Business Truth
      +
Business Rules
      +
Visitor State
      +
Current Experience
      +
Available Components
      +
Available Actions
      +
Experiment Context
      +
Prior Learning
      ↓
Intelligence
      ↓
Decision
      │
      ├── Objective
      ├── Strategy
      ├── Relevant Inputs
      ├── Selected Truth
      ├── Selected Capabilities
      └── Experience Plan
      ↓
Validation
      ↓
Experience

---

# 04.C Canonical Learning Lineage

The most strategically important lineage is:

Context
   ↓
Signal
   ↓
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
Action
   ↓
Outcome

Kablet must preserve enough identity and linkage across this chain for future systems to evaluate:

**Under this context and Visitor State, what Decision was made, what Experience was actually delivered, and what happened afterward?**

This relationship is the foundation of Kablet's long-term learning system and decision/outcome data advantage.

---

# 04.D State vs Decision vs Experience

These concepts must remain separate.

Visitor State:

"What does Kablet currently understand?"

Decision:

"What has Kablet chosen to do about it?"

Experience:

"What did Kablet present as a result?"

Outcome:

"What happened afterward?"

Example:

Visitor State:
- interested in Botox
- concerned about unnatural results
- location: Dubai
- booking intent: moderate

Decision:
- resolve outcome concern before pushing booking

Experience:
- contextual explanation
- natural-result testimonial
- practitioner proof
- consultation action

Outcome:
- Visitor begins booking

The separation between these concepts is permanent.

---

# 04.E Core Visitor State & Decision Invariants

1. Visitor and business User are different identity domains.
2. Visitor identity is Business-scoped by default.
3. Anonymous Visitors are first-class Visitors.
4. Visitor and Session are separate concepts.
5. Signals are observations, not automatically established Visitor facts.
6. Observation and inference remain distinguishable.
7. Visitor State is structured and dynamic.
8. Intent may evolve.
9. Needs, Constraints, Concerns, and Preferences remain semantically distinct.
10. Journey State does not impose a universal funnel.
11. Inferred State is revisable.
12. Uncertain State may carry confidence.
13. Consequential State preserves provenance where appropriate.
14. Explicit Visitor correction generally supersedes conflicting unsupported inference.
15. State collection is purpose-bound rather than unlimited profiling.
16. Session State and durable Visitor State remain distinguishable.
17. Meaningful customer-facing choices are represented as Decisions.
18. Decision and Experience are separate concepts.
19. Decision and internal reasoning traces are separate concepts.
20. Decisions have objectives.
21. Decisions operate inside Business authority and constraints.
22. Executed Decisions are immutable historical records.
23. Historical Decisions preserve meaningful context.
24. Intelligence implementation may be attributed without coupling runtime to it.
25. Experiment context participates in Decision lineage.
26. Intended Experience and actual exposure are distinguishable.
27. Decisions connect to Outcomes.
28. Non-conversion may also provide information.
29. Kablet owns Visitor State rather than outsourcing it to an AI provider.
30. Kablet owns canonical Decisions rather than leaving them inside transient AI output.
31. Meaningful State transitions are observable.
32. Meaningful Decisions are observable.
33. Context → State → Decision → Experience → Outcome lineage is preserved.

---

# 04.F Explicitly Not Defined Here

This section intentionally does not define:

- cookies
- browser identifiers
- fingerprinting
- authentication mechanisms for customers
- exact session timeout
- identity-resolution algorithms
- CRM identity matching
- State database schemas
- exact confidence scoring
- intent taxonomy
- journey-state taxonomy
- prompt memory
- vector memory
- long-term memory implementation
- model context windows
- model provider
- recommendation algorithms
- Decision JSON schema
- attribution windows
- experimentation statistics
- machine-learning models
- privacy retention periods

Those belong to Technical Architecture, privacy design, vertical specifications, or later intelligence systems.

This section defines the permanent conceptual relationship between Visitor understanding, Decisions, Experiences, and Outcomes.

---

# 04.G Foundation Dependency

Identity & Ownership established:

**Whose system and data is this?**

Business Truth established:

**What is authorized and true about the Business?**

Experience & Component Contract established:

**How can Intelligence safely control the customer-facing frontend?**

Visitor State & Decisions establishes:

**What does Kablet understand about this Visitor, and what did Kablet choose to do because of that understanding?**

The next foundation defines how Kablet permanently records what actually happened:

**05 — Event & Outcome Spine.**

---

# 05. Event & Outcome Spine

## 05.1 Purpose

The Event & Outcome Spine is Kablet's canonical record of meaningful activity across the customer journey.

It exists so Kablet can reconstruct:

- what happened
- when it happened
- within which Business
- to which Visitor and Session
- under which Visitor State
- following which Decision
- through which Experience
- involving which Components
- through which Actions
- resulting in which Outcomes
- under which Experiment context

The Event & Outcome Spine is not merely analytics.

It is foundational operational and learning infrastructure.

The permanent relationship is:

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

Kablet must preserve enough structured lineage across this chain to support debugging, measurement, experimentation, attribution, and future learning.

---

## 05.2 Events

An Event represents a meaningful occurrence within Kablet.

Examples may include:

- Session started
- message received
- intent identified
- Visitor State changed
- Decision created
- Experience created
- Component rendered
- Component viewed
- Component interacted with
- Action started
- Action completed
- conversion completed
- revenue recorded
- Experiment assigned
- Experiment exposed

Events provide a chronological record of what occurred.

Events should represent meaningful domain activity rather than arbitrary technical logging.

---

## 05.3 Events Are Not Logs

Technical logs and Kablet Events serve different purposes.

A technical log may record:

- request latency
- server exception
- cache miss
- API timeout

A Kablet Event records meaningful product or business activity.

For example:

decision.created

component.viewed

booking.completed

Both systems may be important.

They must not be treated as interchangeable.

The Event Spine exists to preserve Kablet's domain history.

---

## 05.4 Canonical Event Envelope

Every canonical Event should share a common structural envelope.

Conceptually, an Event may contain:

Event
├── identity
├── type
├── occurred_at
├── recorded_at
├── schema_version
├── Organization context
├── Business context
├── Property / Location context
├── Visitor context
├── Session context
├── Decision context
├── Experience context
├── Component context
├── Action context
├── Experiment context
├── actor / source
└── event-specific payload

Not every Event requires every field.

The common envelope exists so Events can participate in consistent lineage.

The exact technical schema belongs to Technical Architecture.

---

## 05.5 Event Identity

Every canonical Event must have stable identity.

Event identity allows Kablet to:

- reference an Event
- deduplicate Events
- order activity
- correlate systems
- trace causality
- replay or reconstruct history
- debug integrations

Event identity must not depend solely on event type or timestamp.

---

## 05.6 Event Time

Kablet must distinguish, where relevant:

**Occurred Time**

When the activity actually happened.

from

**Recorded Time**

When Kablet received or persisted the Event.

These may differ.

For example, an external booking system may notify Kablet several seconds or minutes after a booking occurred.

Historical analysis must not silently assume ingestion time equals occurrence time.

---

## 05.7 Events Must Be Versioned

Event schemas will evolve.

A historical Event must remain interpretable according to the schema under which it was produced.

Therefore canonical Events require explicit version semantics.

New Event fields should preferably evolve additively.

Breaking semantic changes must be deliberate.

Historical Events must not silently acquire new meaning because the current schema changed.

---

## 05.8 Event Types Must Have Stable Semantics

An Event type must mean something consistent.

For example:

component.viewed

must not mean:

"Component was rendered"

in one implementation and:

"Visitor visibly saw the Component"

in another.

If those concepts are materially different, they should remain distinct Events.

Stable semantics are necessary for trustworthy analytics and learning.

---

## 05.9 Event Vocabulary Must Be Controlled

Kablet should maintain a controlled vocabulary for canonical Events.

Conceptually:

session.started
session.ended

signal.received

visitor_state.updated

decision.created

experience.created
experience.validated
experience.rendered

component.rendered
component.viewed
component.interacted

action.started
action.completed
action.failed

conversion.completed

revenue.recorded

experiment.assigned
experiment.exposed

The exact initial vocabulary will be defined during implementation.

The foundational principle is that canonical event meaning is governed rather than invented ad hoc by individual features.

---

## 05.10 Events Must Preserve Ownership Context

Every tenant-sensitive Event must remain attributable to the appropriate ownership context.

At minimum, Business-owned runtime Events must identify their Business.

Where relevant they may also identify:

- Organization
- Property / Location

An Event must never become a globally ambiguous record detached from the Business in which it occurred.

This is necessary for:

- tenant isolation
- reporting
- learning
- attribution
- deletion
- governance

---

## 05.11 Events Must Preserve Visitor and Session Context

Customer-facing Events should preserve Visitor and Session relationships where applicable.

For example:

component.viewed

should be attributable to:

Business
Visitor
Session
Experience
Component Instance

where those relationships exist.

This allows Kablet to reconstruct actual journeys rather than only aggregate counts.

---

## 05.12 Events Must Preserve Decision Context

Where an Event occurs as a consequence of a Kablet Decision, that relationship should remain traceable.

For example:

Decision D42
    ↓
Experience E18
    ↓
Component C7 rendered
    ↓
Component C7 viewed
    ↓
Booking Action started
    ↓
Booking completed

Without Decision linkage, Kablet may know that a booking happened.

With Decision linkage, Kablet can begin learning which strategies contributed to outcomes.

---

## 05.13 Events Must Preserve Experience Context

Events involving customer-facing presentation should identify the relevant Experience where applicable.

This enables Kablet to distinguish:

what Intelligence planned

from

what the runtime actually delivered.

For example:

Experience planned
    ↓
Validation succeeded
    ↓
Experience rendered
    ↓
Component viewed

If rendering fails, Kablet must not assume the planned Experience was actually delivered.

---

## 05.14 Component Exposure Is Distinct From Component Existence

A Component existing in an Experience does not prove the Visitor saw it.

Kablet should distinguish concepts such as:

Component included
Component rendered
Component viewed
Component interacted

This distinction is essential for trustworthy learning.

A testimonial should not receive causal credit merely because it existed somewhere in an Experience the Visitor never reached or saw.

---

## 05.15 Interaction Events

Interaction Events represent meaningful Visitor engagement with an Experience.

Examples may include:

- Component selected
- option selected
- comparison changed
- question submitted
- recommendation accepted
- CTA clicked
- form progressed
- media engaged

The exact vocabulary will evolve.

Interaction Events should preserve enough semantic context to understand what the Visitor interacted with.

---

## 05.16 Action Events

Action Events represent execution of Business-authorized capabilities.

The canonical lifecycle should be capable of distinguishing:

Action offered
    ↓
Action started
    ↓
Action completed

or:

Action offered
    ↓
Action started
    ↓
Action failed

This distinction matters because intent to act is not equivalent to successful execution.

---

## 05.17 Action Completion Must Reflect Reality

Kablet must not record an Action as completed merely because the customer clicked a button.

For example:

Click "Book Appointment"

does not necessarily mean:

Appointment booked.

The actual outcome may require confirmation from:

- Kablet
- booking provider
- commerce platform
- CRM
- payment system
- another authorized system

The Event model must distinguish initiation from verified completion.

---

## 05.18 Conversion

A Conversion represents completion of a Business-defined meaningful objective.

Examples may include:

- purchase
- appointment booking
- qualified lead
- consultation request
- subscription
- completed application
- quote request

Conversion is not globally identical across every Business.

Each Business may define the outcomes that constitute meaningful conversion.

---

## 05.19 Conversion Must Be Explicitly Defined

Kablet must not assume that every click or Action is a Conversion.

For example:

Business A:

Conversion = completed purchase

Business B:

Conversion = confirmed appointment

Business C:

Conversion = qualified lead

The Business's commercial objective determines the meaning of Conversion.

This definition must be explicit enough for Kablet to optimize against the correct outcome.

---

## 05.20 Outcome

Outcome is the broader representation of what resulted from a customer journey, Action, Decision, or Experience.

An Outcome may include:

- Conversion
- Revenue
- qualified lead
- booking
- purchase
- rejected recommendation
- Action failure
- abandonment
- return visit
- cancellation
- refund
- another business-relevant result

Not every Outcome is positive.

Not every Outcome is final.

Outcome provides the semantic result that future learning systems evaluate.

---

## 05.21 Outcome and Event Are Different

An Event records that something occurred.

An Outcome represents the business meaning of what resulted.

For example:

Event:

booking.completed

Outcome:

Confirmed Appointment
Value: 500 AED
Business Objective: Booking Conversion

The same Event infrastructure may carry information that creates or updates an Outcome.

The concepts must nevertheless remain distinct.

---

## 05.22 Outcomes May Change

Some commercial Outcomes evolve after initial conversion.

For example:

Booking created
    ↓
Booking confirmed
    ↓
Customer attends
    ↓
Revenue realized

Or:

Purchase completed
    ↓
Order fulfilled
    ↓
Order refunded

Kablet must not assume that initial conversion is always the final business result.

Outcome representation must permit lifecycle evolution.

---

## 05.23 Revenue

Revenue represents monetary business value attributable to an Outcome where applicable.

Revenue should preserve concepts such as:

- amount
- currency
- associated Outcome
- Business
- occurrence
- source
- status

The exact financial model belongs to later architecture.

The foundational requirement is that Kablet can eventually distinguish:

Conversion count

from

economic value.

---

## 05.24 Revenue Must Not Be Invented

Kablet must not assume that an Action generated revenue merely because it commonly does.

Revenue should come from:

- verified transaction
- authorized Business system
- explicit Business input
- another trustworthy source

Estimated value may exist.

It must remain distinguishable from verified revenue.

---

## 05.25 Estimated and Realized Value Must Be Distinguishable

Some Outcomes may have expected value before actual revenue exists.

For example:

Qualified Lead
Expected Value: 300 AED

Later:

Sale Completed
Realized Revenue: 1,200 AED

Kablet should preserve the distinction between:

estimated value

and

realized value.

This prevents optimization systems from treating forecasts as cash.

---

## 05.26 Attribution

Attribution represents the relationship between Outcomes and the customer journey that preceded them.

Kablet must preserve enough lineage to evaluate relationships among:

- Signals
- State
- Decisions
- Experiences
- Components
- Actions
- Experiments
- Outcomes

Attribution must not be reduced to:

"last click wins."

Different analytical and causal models may be used later.

The foundational requirement is preservation of the underlying lineage needed to evaluate them.

---

## 05.27 Attribution Is Not Automatically Causation

If a Visitor saw Component A and later converted, that does not prove Component A caused the Conversion.

Kablet must distinguish:

observed sequence

from

causal evidence.

Controlled experiments and appropriate analytical methods may provide stronger causal evidence.

The Event Spine preserves what happened.

The experimentation and learning systems determine what can reasonably be concluded from it.

---

## 05.28 Experiment Assignment

When a Visitor or Session participates in an Experiment, assignment must be recorded.

Conceptually:

Experiment
    ↓
Assignment
    ↓
Variant

This allows Kablet to know which treatment the Visitor was intended to receive.

Assignment alone does not prove exposure.

---

## 05.29 Experiment Exposure

Experiment Exposure represents that the relevant experimental treatment was actually delivered according to the Experiment's exposure definition.

For example:

Assigned:
Proof First

but rendering failed.

Then:

Assignment occurred.

Exposure may not have occurred.

Kablet must distinguish these concepts to avoid corrupting experiment results.

---

## 05.30 Experiment Context Must Flow Through Outcome Lineage

Where a Decision or Experience was affected by an Experiment, resulting Events and Outcomes must remain attributable to that context.

Conceptually:

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

This allows future experimentation systems to evaluate results correctly.

---

## 05.31 Event Recording Must Not Depend Solely on Analytics Vendors

Kablet may use third-party analytics products for:

- dashboards
- product analytics
- session replay
- visualization
- operational convenience

Those systems may receive Kablet Events.

They must not become the sole canonical owner of the Event & Outcome Spine.

Kablet must retain durable control over strategically important event and outcome data.

---

## 05.32 External Events May Enter the Spine

Important Outcomes may occur outside the immediate Kablet runtime.

Examples:

- booking confirmed by external booking system
- order completed in commerce platform
- lead qualified in CRM
- sale closed later
- appointment attended
- refund issued

Kablet must be capable of receiving authorized external Events and relating them back to prior Kablet activity where possible.

This is essential because business value often occurs after the initial frontend interaction.

---

## 05.33 External Events Must Preserve Source Provenance

An external Event should preserve sufficient source information to understand:

- which system produced it
- what external object it refers to
- when it occurred
- when Kablet received it
- whether it was verified
- how it relates to Kablet entities

This allows external systems to contribute to Outcome truth without becoming indistinguishable from internally observed activity.

---

## 05.34 Duplicate Events Must Not Create Duplicate Reality

Distributed systems may deliver the same external or internal Event more than once.

Kablet must be designed so duplicate delivery does not necessarily create duplicate business meaning.

For example:

One booking provider webhook delivered three times

must not automatically become:

Three bookings.

The exact idempotency implementation belongs to Technical Architecture.

The foundational invariant is that event delivery count and real-world occurrence count are not assumed to be identical.

---

## 05.35 Events Are Append-Oriented Historical Records

Canonical Events represent occurrences.

Once recorded, historical Events should generally not be silently rewritten to create a different history.

If correction is required, Kablet should prefer explicit corrective or superseding semantics where appropriate.

This preserves trustworthy chronology.

The exact persistence mechanism belongs to Technical Architecture.

---

## 05.36 Outcomes May Be Updated Through New Evidence

Unlike immutable occurrence history, Kablet's understanding of an Outcome may evolve.

For example:

Order completed
    ↓
Revenue recorded
    ↓
Refund issued

The refund does not erase the original purchase Event.

It adds new information that changes the commercial interpretation of the Outcome.

This distinction allows historical events to remain intact while business state evolves.

---

## 05.37 Event Ordering Must Tolerate Delayed Information

Events may arrive out of chronological order.

For example:

Purchase occurred at 10:00.

External provider notification reached Kablet at 10:02.

Another related Event may arrive later.

Kablet must not require ingestion order to equal real-world occurrence order.

Occurred time, recorded time, identity, and lineage must provide enough information to reconstruct meaningful sequence.

---

## 05.38 The Spine Must Support End-to-End Reconstruction

For a meaningful customer journey, Kablet should eventually be capable of reconstructing something like:

Visitor V12
    ↓
Session S31 started
    ↓
Message received
    ↓
Intent identified
    ↓
State updated
    ↓
Decision D44 created
    ↓
Experience E27 created
    ↓
Proof Component rendered
    ↓
Proof Component viewed
    ↓
Booking Action offered
    ↓
Booking Action started
    ↓
Booking completed
    ↓
Revenue recorded

This reconstruction is one of the core requirements of the Kablet platform.

---

## 05.39 The Spine Must Support Aggregation Without Losing Raw Meaning

Kablet will eventually need metrics such as:

- conversion rate
- revenue per Visitor
- revenue per Session
- booking rate
- Component exposure rate
- Decision strategy performance
- experiment lift
- abandonment rate

These are derived measurements.

The underlying canonical Events and Outcomes should preserve sufficient meaning so new metrics can be computed later without depending exclusively on previously aggregated summaries.

---

## 05.40 Metrics Are Derived, Not Canonical Reality

A metric such as:

Conversion Rate = 8.2%

is a derived interpretation over Events and Outcomes.

It is not itself the underlying customer history.

Kablet should distinguish:

canonical occurrences

from

derived analytics.

This allows definitions and analytical methods to evolve without rewriting history.

---

## 05.41 Event Collection Must Be Purposeful

Kablet should not record every technically observable action merely because it can.

Canonical Events should support legitimate purposes such as:

- runtime operation
- debugging
- attribution
- measurement
- experimentation
- learning
- governance

Excessive meaningless telemetry increases cost, complexity, and privacy exposure without strengthening Kablet's intelligence.

The Event Spine should favor meaningful semantic Events over indiscriminate data collection.

---

## 05.42 Privacy and Retention Apply to the Event Spine

Event history may contain customer-related information.

Its existence as learning infrastructure does not exempt it from:

- privacy requirements
- retention rules
- deletion obligations
- access controls
- tenant boundaries
- data minimization

The exact policies and implementation belong to later specifications.

The foundational requirement is that learning value does not override legitimate data governance.

---

## 05.43 Sensitive Payloads Must Not Be Required for Event Identity

Canonical Event lineage should rely on stable Kablet identifiers rather than requiring raw sensitive customer content to be duplicated across every Event.

For example, Events may reference:

Visitor ID
Session ID
Decision ID
Experience ID

rather than repeatedly copying complete customer messages or personal information into every Event payload.

This reduces unnecessary duplication and improves governance.

---

## 05.44 Events Must Support Future Learning

The Event Spine must preserve the relationship required by future Kablet Intelligence:

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
Outcome

Future learning systems may ask:

- Which strategy works under which State?
- Which Component sequences improve booking?
- Which concerns require additional Proof?
- When should pricing appear?
- Which Decision policies increase revenue?
- Which strategies work only for a particular Business?
- Which patterns generalize across a vertical?

The early Kablet implementation does not need to answer all of these questions.

It must avoid destroying the data relationships required to answer them later.

---

## 05.45 Events Must Support Business-Level Learning

Business-specific Events and Outcomes may support learning unique to one Business.

For example:

Business A may learn that visitors concerned about recovery respond well to practitioner proof.

That learning belongs primarily to Business A's operating context.

The Event Spine must preserve enough Business ownership context to support this level of learning.

---

## 05.46 Events May Support Future Vertical Learning

Where permitted by privacy, contracts, governance, and data-use rules, Kablet may derive generalized vertical intelligence from appropriately governed data.

The underlying Event Spine must preserve tenant boundaries even if future learning systems derive aggregate patterns.

Cross-business learning must not require uncontrolled cross-business runtime access.

---

## 05.47 Events May Support Future Network-Level Learning

Future Kablet systems may derive abstract commercial principles that generalize across verticals.

For example:

High uncertainty may increase the value of Proof before an Action request.

Such learning should emerge from appropriately governed evidence.

It must not require exposing one Business's private customer history to another Business.

The Event Spine supplies structured evidence.

Governed learning systems determine what may be generalized.

---

## 05.48 Canonical Data and Analytical Projections Are Different

Kablet may eventually project canonical Events into:

- analytics databases
- warehouses
- dashboards
- search systems
- machine-learning datasets
- experiment datasets
- real-time streams

Those are representations optimized for particular uses.

They must remain conceptually distinguishable from the canonical Event & Outcome record.

This allows infrastructure to evolve without changing the meaning of Kablet's historical business data.

---

## 05.49 The Event Spine Is a Platform Contract

Every future Kablet subsystem that performs meaningful customer-facing or business-facing activity must consider whether it participates in the Event & Outcome Spine.

This includes future:

- commerce systems
- booking systems
- agent systems
- voice interfaces
- messaging interfaces
- recommendation systems
- integrations
- automation
- optimization engines

The Event Spine is therefore not a feature owned by an analytics module.

It is a platform-wide contract.

---

# 05.A Canonical Event Model

Conceptually:

Event
│
├── Event Identity
├── Event Type
├── Schema Version
├── Occurred Time
├── Recorded Time
├── Ownership Context
│   ├── Organization
│   ├── Business
│   └── Property / Location
├── Journey Context
│   ├── Visitor
│   ├── Session
│   ├── State
│   ├── Decision
│   └── Experience
├── Interaction Context
│   ├── Component Instance
│   └── Action
├── Experiment Context
├── Source / Actor
└── Event Payload

Only applicable relationships need to be populated for a given Event.

---

# 05.B Canonical Outcome Model

Conceptually:

Outcome
│
├── Outcome Identity
├── Business
├── Visitor / Session Context
├── Outcome Type
├── Status
├── Conversion Relationship
├── Value
│   ├── Estimated Value
│   └── Realized Revenue
├── Currency
├── Source
├── Relevant Actions
├── Relevant Decisions
├── Relevant Experiences
├── Experiment Context
└── Outcome Lifecycle

The exact schema belongs to Technical Architecture.

---

# 05.C Canonical Causal Lineage

The strategically important Kablet lineage is:

Business
   ↓
Visitor
   ↓
Session
   ↓
Context / Signals
   ↓
Visitor State
   ↓
Decision
   ↓
Experience Plan
   ↓
Validated Experience
   ↓
Rendered Experience
   ↓
Component Exposure
   ↓
Interaction
   ↓
Action
   ↓
Conversion
   ↓
Outcome
   ↓
Revenue

Experiment context may intersect the chain at the Decision and Experience layers.

External systems may contribute Action, Conversion, Outcome, or Revenue Events.

Kablet must preserve enough linkage to reconstruct the chain without claiming that chronological association alone proves causation.

---

# 05.D Event Families

The canonical Event vocabulary may evolve around families such as:

Session Events

Signal Events

Visitor State Events

Decision Events

Experience Events

Component Events

Action Events

Conversion Events

Outcome Events

Revenue Events

Experiment Events

Integration Events

The exact Event types inside each family belong to later technical specifications.

The family structure exists to preserve semantic organization.

---

# 05.E Core Event & Outcome Invariants

1. Canonical Events represent meaningful domain occurrences.
2. Events and technical logs are different systems.
3. Events have stable identity.
4. Occurred time and recorded time may differ.
5. Event schemas are versioned.
6. Event types have controlled, stable semantics.
7. Tenant-sensitive Events preserve ownership context.
8. Customer Events preserve Visitor and Session context where applicable.
9. Decision-related Events preserve Decision lineage.
10. Experience-related Events preserve Experience lineage.
11. Component existence, rendering, viewing, and interaction are distinguishable.
12. Action initiation and Action completion are distinguishable.
13. Completion reflects verified reality rather than mere intent where verification is required.
14. Conversion is Business-defined.
15. Outcome and Event are separate concepts.
16. Outcomes may evolve as new evidence arrives.
17. Revenue and Conversion are different concepts.
18. Estimated value and realized revenue are distinguishable.
19. Attribution does not automatically imply causation.
20. Experiment assignment and Experiment exposure are distinguishable.
21. Experiment context remains connected to Outcomes.
22. Kablet retains canonical Event and Outcome data independently of analytics vendors.
23. Authorized external Events may participate in the Spine.
24. External Events preserve provenance.
25. Duplicate delivery must not create duplicate business reality.
26. Canonical Events are append-oriented historical records.
27. Outcome interpretation may evolve without rewriting occurrence history.
28. Event processing tolerates delayed and out-of-order information.
29. End-to-end customer journeys are reconstructable.
30. Derived metrics remain distinguishable from canonical Events.
31. Event collection is purposeful rather than indiscriminate.
32. Privacy and retention constraints apply to Event data.
33. Sensitive content need not be duplicated merely to preserve lineage.
34. The Spine preserves the relationships required for future learning.
35. Business, vertical, and network learning remain governable layers.
36. Analytical projections are distinguishable from canonical data.
37. The Event & Outcome Spine is a platform-wide contract.

---

# 05.F Explicitly Not Defined Here

This section intentionally does not define:

- Event database technology
- message broker
- queue technology
- streaming platform
- warehouse
- analytics provider
- observability provider
- event transport
- webhook implementation
- exact Event JSON schemas
- exact Event type list
- partitioning
- retention periods
- data warehouse transformations
- attribution algorithm
- experiment statistics
- causal inference algorithms
- revenue recognition accounting
- financial reporting rules
- machine-learning pipelines
- identity resolution
- session replay technology

Those belong to Technical Architecture and later domain specifications.

This section defines the permanent semantic spine that those implementations must preserve.

---

# 05.G Foundation Dependency

Identity & Ownership established:

**Whose data and system is this?**

Business Truth established:

**What is authorized and true about the Business?**

Experience & Component Contract established:

**What customer-facing experience may Kablet create?**

Visitor State & Decisions established:

**What did Kablet understand and decide?**

Event & Outcome Spine establishes:

**What actually happened afterward, and how do we preserve that history?**

The next foundation defines the replaceable boundary through which reasoning systems operate on all of the above:

**06 — Intelligence Interface.**

---

# 06. Intelligence Interface

## 06.1 Purpose

The Intelligence Interface defines the permanent boundary between Kablet's product state and the reasoning systems used to make customer-facing decisions.

Its purpose is to allow Kablet to use intelligence without making the platform structurally dependent on:

- one AI provider
- one model
- one prompt
- one reasoning technique
- one optimization algorithm
- one experimentation strategy

The Intelligence Interface receives authorized Kablet context and produces structured Kablet Decisions.

The foundational relationship is:

Kablet Context
      ↓
Intelligence Interface
      ↓
Reasoning / Policy
      ↓
Structured Decision
      ↓
Validation
      ↓
Experience / Action

The intelligence implementation may evolve.

The interface and Kablet-owned state remain stable.

---

## 06.2 Kablet Intelligence

Kablet Intelligence is the platform capability responsible for deciding what Kablet should do next within an authorized customer interaction.

It may use:

- deterministic rules
- large language models
- classifiers
- retrieval
- experiment policies
- optimization algorithms
- recommendation systems
- proprietary models
- vertical-specific intelligence
- business-specific learning
- combinations of these systems

Kablet Intelligence is therefore broader than any individual AI model.

An external model may participate in Intelligence.

It is not itself the Kablet Brain.

---

## 06.3 The Intelligence Interface Is a Platform Boundary

Customer-facing runtime systems should interact with Intelligence through a defined Kablet contract.

Conceptually:

Runtime
    ↓
Intelligence Request
    ↓
Intelligence Interface
    ↓
Intelligence Implementation
    ↓
Intelligence Result
    ↓
Validation
    ↓
Runtime

The runtime should not need to know:

- which model was called
- which provider hosted it
- which prompt was used
- whether rules participated
- whether retrieval participated
- whether an experiment influenced selection

Those are intelligence implementation concerns.

---

## 06.4 Intelligence Input

An Intelligence Request may include authorized context such as:

- Organization context
- Business context
- Property / Location context
- relevant Business Truth
- applicable Business Rules
- Visitor
- Session
- Visitor State
- current Experience
- relevant interaction history
- available Components
- available Actions
- Experiment context
- relevant prior learning
- current objective
- capability constraints

Not every Decision requires every category of context.

The Intelligence Interface should provide only the context required for the task.

---

## 06.5 Context Assembly

Context Assembly is the process of constructing the relevant information required for an Intelligence Decision.

Kablet should not assume that all Business Truth, all Visitor history, all Events, and all learned knowledge should be sent into every intelligence operation.

Context Assembly determines what information is relevant and authorized for the current Decision.

Conceptually:

Business Truth ────────┐
Visitor State ─────────┤
Experience State ──────┤
Recent Events ─────────┤
Experiment Context ────┼──→ Context Assembly
Prior Learning ────────┤
Available Components ──┤
Available Actions ─────┤
Business Rules ────────┘
                              ↓
                    Intelligence Request

The exact retrieval and context-selection implementation belongs to Technical Architecture.

---

## 06.6 Context Must Respect Ownership Boundaries

Context Assembly must preserve tenant isolation.

An Intelligence Request for Business A must not accidentally include private Business Truth, Visitor information, Decisions, Outcomes, or operational data belonging to Business B.

Future vertical-level or network-level learning may contribute generalized knowledge according to explicit governance.

Generalized learning does not authorize raw cross-tenant context leakage.

---

## 06.7 Context Must Respect Business Authority

Intelligence receives Business Truth as authoritative input.

It may reason over that Truth.

It may not silently redefine it.

For example:

Business Truth:
Price = 399 AED

Intelligence may decide:

"Show price now."

It may not decide:

"Change price to 299 AED."

unless explicit delegated authority permits that class of change.

The Intelligence Interface must therefore communicate both:

what capabilities exist

and

what authority applies.

---

## 06.8 Available Components Are Intelligence Capabilities

The Intelligence Interface must tell Intelligence what customer-facing Components it may use.

Conceptually:

Available Components:

- Message
- Service
- Price
- Proof
- Comparison
- FAQ
- Booking

Intelligence selects among those capabilities.

It does not invent arbitrary executable frontend capabilities outside the Experience Contract.

Adding a Component therefore expands the expressive vocabulary available to Intelligence.

---

## 06.9 Available Actions Are Intelligence Capabilities

The Intelligence Interface must also provide the Actions currently available and authorized.

Examples:

- Book
- Buy
- Call
- Message
- Request Quote

Intelligence may decide when an available Action is appropriate.

It must not fabricate unavailable business capabilities.

Available Action does not necessarily mean immediately executable.

Eligibility, authorization, and runtime validation may still apply.

---

## 06.10 Intelligence Objective

An Intelligence Request should have a meaningful objective or task.

Examples:

- understand Visitor intent
- update Visitor State
- determine next Experience strategy
- resolve a concern
- choose relevant Business Truth
- recommend among Services
- decide whether to surface an Action
- select an Experiment strategy
- generate permitted explanatory content

Explicit objectives reduce ambiguity about what the Intelligence operation is expected to accomplish.

---

## 06.11 Intelligence May Perform Different Classes of Work

Not all Intelligence operations are equivalent.

Kablet may eventually distinguish capabilities such as:

Interpretation

Understanding signals and updating structured Visitor State.

Retrieval

Selecting relevant Business Truth or learned knowledge.

Decision

Choosing what should happen next.

Generation

Producing permitted customer-facing language.

Optimization

Selecting among strategies based on evidence or learned policy.

Recommendation

Suggesting changes to the Business or runtime strategy.

These capabilities may use different models or systems.

The Intelligence Interface must not assume that one giant model call must perform all intelligence functions forever.

---

## 06.12 Intelligence Output Must Be Structured

Meaningful Intelligence output must not depend exclusively on free-form natural-language text.

Customer-facing language may be natural language.

Operational decisions must be represented through structured Kablet contracts.

Conceptually:

Intelligence Result
├── Decision
├── State Updates
├── Experience Plan
├── Selected Business Truth
├── Selected Components
├── Proposed Actions
├── Generated Content
└── Relevant Metadata

The exact schema belongs to Technical Architecture.

The foundational requirement is that software can validate and interpret the result deterministically.

---

## 06.13 Decision Output

When Intelligence makes a meaningful customer-facing choice, it should produce or contribute to a canonical Decision as defined in Foundation 04.

The Decision should preserve sufficient information to understand:

- objective
- relevant State
- selected strategy
- relevant Truth
- selected capabilities
- Experiment context
- resulting Experience Plan

The Decision becomes Kablet-owned history after acceptance.

---

## 06.14 State Updates Are Proposed Before Acceptance

Intelligence may infer changes to Visitor State.

For example:

Current State:
Intent uncertain

New Signal:
"I want to book Botox next week."

Proposed State Update:
Intent = book Service
Timing constraint = next week

Intelligence proposes the update.

Kablet validates and persists accepted State according to its contracts.

This preserves the principle:

**Intelligence proposes. Kablet validates.**

---

## 06.15 Experience Plans Are Proposed Before Runtime

Intelligence may produce an Experience Plan.

The plan does not bypass the Experience Contract.

It must be validated for:

- supported Components
- valid payloads
- Business Truth references
- available Actions
- Business Rules
- ownership
- permissions
- contract version

Only a valid Experience Plan may become runtime behavior.

---

## 06.16 Proposed Actions Are Not Automatically Executed

Intelligence may propose that an Action should occur or be offered.

For example:

Offer booking.

Start checkout.

Request lead information.

Apply authorized discount.

A proposed Action does not itself constitute execution.

Conceptually:

Intelligence
    ↓
Proposed Action
    ↓
Authorization
    ↓
Validation
    ↓
Execution
    ↓
Verified Result

This boundary becomes increasingly important as Kablet gains more autonomous capabilities.

---

## 06.17 Consequential Actions Require Explicit Capability Boundaries

Actions capable of producing consequential business effects must operate through defined capabilities.

Examples include:

- creating bookings
- creating orders
- charging money
- applying discounts
- changing Business Truth
- creating CRM records
- sending communications
- cancelling transactions

Intelligence must not obtain unrestricted infrastructure access merely because it can reason about these actions.

The permanent rule is:

**Reasoning authority and execution authority are separate.**

---

## 06.18 Intelligence Must Operate Under Constraints

An Intelligence Request may include constraints derived from:

- Business Rules
- Business Truth
- delegated authority
- Visitor eligibility
- privacy requirements
- Component capabilities
- Action capabilities
- Experiment policy
- platform policy
- runtime state

Intelligence is an optimizer inside these boundaries.

It is not authorized to remove the boundaries in pursuit of conversion.

---

## 06.19 Conversion Optimization Is Constrained Optimization

Kablet exists to improve business outcomes.

That objective does not supersede:

- Business Truth
- Business Rules
- customer authorization
- delegated authority
- privacy
- platform constraints
- valid Action boundaries

The correct conceptual objective is therefore not:

"maximize conversion at any cost."

It is:

**Improve authorized business outcomes within applicable constraints.**

---

## 06.20 Intelligence Output Must Be Validated

No Intelligence output becomes authoritative merely because an AI or optimization system produced it.

Validation may include:

- structural validation
- contract validation
- ownership validation
- reference validation
- capability validation
- authorization validation
- Business Rule validation
- Action validation
- safety validation where applicable

The exact validation pipeline belongs to Technical Architecture.

---

## 06.21 Deterministic Validation Should Not Be Delegated Back to the Model

Where Kablet can deterministically validate something, it should not rely exclusively on the reasoning model to validate itself.

For example:

Does Service ID exist?

Does it belong to this Business?

Is this Component supported?

Is this Action authorized?

Does this Offer exist?

These questions should be enforced by Kablet software where practical.

The model may reason.

Kablet enforces contracts.

---

## 06.22 Invalid Output Must Fail Predictably

Intelligence may occasionally produce:

- malformed structure
- unsupported references
- invalid Components
- unauthorized Actions
- contradictory State updates
- unavailable Business Truth
- incomplete output

Kablet must assume these failures can occur.

The Intelligence Interface must support predictable failure handling rather than allowing malformed output to reach customers or business systems.

---

## 06.23 Fallback Behavior Is Part of the Interface

A failed Intelligence operation must not automatically destroy the customer experience.

Fallback strategies may eventually include:

- retry
- alternate model
- deterministic rule
- reduced-capability Experience
- last valid Experience
- safe default
- human escalation
- temporary static Business Truth presentation

The exact policy belongs to Technical Architecture.

The foundational requirement is that failure is an expected system state.

---

## 06.24 Intelligence Providers Must Be Replaceable

Kablet must not structurally depend on one external model provider.

A future implementation may use:

Provider A today.

Provider B tomorrow.

A proprietary Kablet model later.

Different providers simultaneously.

The Intelligence Interface isolates the rest of Kablet from those changes.

Provider-specific capabilities may be used internally.

They must not redefine the Kablet product model.

---

## 06.25 Models Must Be Replaceable Independently

Even within one provider, Kablet may use different models for different tasks.

For example:

Fast Model:
intent classification

Reasoning Model:
complex Decision

Generation Model:
customer-facing language

Specialized Model:
vertical recommendation

Kablet should be capable of routing tasks according to capability, cost, latency, quality, or policy.

The foundation does not require one universal model.

---

## 06.26 Prompts Are Implementation, Not Product Contracts

Prompts may be important implementation assets.

They are not the canonical definition of Kablet's product behavior.

If the only place a Business Rule, Decision contract, or Component definition exists is inside a prompt, Kablet's architecture is too dependent on model behavior.

Permanent product constraints belong in Kablet contracts and software-controlled state.

Prompts instruct reasoning within those boundaries.

---

## 06.27 Model Conversation History Is Not Canonical Visitor State

An AI provider may maintain conversational context for operational convenience.

That context must not become the sole source of Visitor State.

Kablet owns structured Visitor State.

If a model conversation disappears, Kablet should still retain the customer state required by its product model, subject to applicable retention rules.

---

## 06.28 Model Output Is Not Canonical Decision History

Similarly, raw model responses are not a substitute for canonical Decisions.

Once Kablet accepts a meaningful Decision:

- it receives Kablet identity
- it participates in lineage
- it can connect to Experience
- it can connect to Events
- it can connect to Outcomes

The provider response may be retained where useful and permitted.

The canonical Decision belongs to Kablet.

---

## 06.29 Intelligence Configuration Must Be Attributable

Where useful for evaluation, a Decision should be attributable to the Intelligence configuration that produced it.

This may eventually include:

- policy version
- model family
- model version
- prompt/configuration version
- retrieval strategy
- experiment policy
- decision engine version

This allows Kablet to evaluate whether changes to Intelligence improve outcomes.

The exact metadata belongs to Technical Architecture.

---

## 06.30 Intelligence Must Be Versionable

Kablet's intelligence behavior will evolve.

Changes may affect:

- interpretation
- context selection
- Decision policy
- prompts
- models
- optimization logic
- learned strategies

Historical Decisions must remain interpretable according to the Intelligence configuration active when they were produced.

Kablet should therefore support explicit versioning of meaningful Intelligence configurations.

---

## 06.31 Intelligence Must Be Observable

Kablet must be capable of observing meaningful Intelligence operations.

Relevant observability may include:

- request identity
- objective
- input context references
- Intelligence configuration
- latency
- success or failure
- Decision produced
- validation result
- fallback used
- cost where relevant

Operational observability must remain distinguishable from canonical business Events.

Both may be connected where useful.

---

## 06.32 Intelligence Cost Is an Operational Concern

AI reasoning may have variable computational cost.

Kablet should eventually be capable of understanding cost by:

- operation
- model
- Business
- Session
- Decision type
- traffic volume

Cost optimization must not require changing the permanent Intelligence Interface.

The platform should be capable of routing routine work to cheaper intelligence and reserving expensive reasoning for cases where it creates sufficient value.

Exact routing policy belongs to Technical Architecture.

---

## 06.33 Intelligence Latency Is a Runtime Constraint

Customer-facing Intelligence operates inside an interactive product.

A theoretically excellent Decision that arrives too slowly may produce a poor Experience.

Kablet should therefore support intelligence architectures that consider:

- latency
- streaming
- caching
- precomputation
- deterministic shortcuts
- asynchronous work
- model routing

These are implementation concerns.

The permanent interface must permit them without changing the product model.

---

## 06.34 Retrieval Is Not Authority

Kablet may retrieve information from:

- Business Truth
- prior Decisions
- prior Outcomes
- vertical knowledge
- generalized learning
- external sources

Retrieval makes information available to Intelligence.

It does not automatically make retrieved information authoritative.

Business Truth authority, source provenance, ownership, and governance rules continue to apply.

---

## 06.35 Prior Learning Is Input, Not Absolute Truth

The Learning Brain may eventually provide strategies such as:

"Visitors with high trust concern often respond well to Proof before Pricing."

This may inform a Decision.

It must not become an immutable rule merely because historical data suggested it.

Learning may be:

- uncertain
- Business-specific
- vertical-specific
- time-sensitive
- experimentally validated
- observational
- outdated

The Intelligence Interface should preserve enough metadata for Decision systems to interpret learned knowledge appropriately.

---

## 06.36 Business-Level Learning Must Remain Identifiable

Learning derived primarily from one Business should remain attributable to that Business context.

For example:

Business A:
Proof-before-price performs strongly.

That does not automatically establish the same strategy for Business B.

The Intelligence Interface should be capable of receiving Business-specific learning separately from broader generalized learning.

---

## 06.37 Vertical Learning Must Remain Distinguishable

Future vertical intelligence may provide patterns derived across similar Businesses.

For example:

Aesthetic clinics:
Practitioner proof often matters when treatment outcome concern is high.

Such learning may influence Decisions where governance permits.

It must remain distinguishable from:

- Business-specific learning
- universal platform rules
- raw tenant data

---

## 06.38 Network-Level Learning Must Remain Distinguishable

Future Kablet intelligence may derive generalized commercial principles across verticals.

For example:

High uncertainty may increase the value of evidence before commitment.

These principles should remain identifiable as generalized learned strategies rather than being confused with Business Truth.

---

## 06.39 Learning Must Not Directly Rewrite Business Truth

Observed performance may suggest changes to:

- pricing
- offers
- descriptions
- FAQs
- Services
- policies

Learning may generate recommendations.

It must not silently rewrite authoritative Business Truth unless explicit delegated authority permits that class of modification.

The Business remains the authority over its Truth.

---

## 06.40 Learning May Change Decision Policy

Unlike Business Truth, Decision policy is a Kablet-controlled optimization domain.

Where evidence supports it, Kablet may change how it chooses among authorized strategies.

For example:

Earlier policy:
Show pricing before proof.

Learned policy:
For high trust concern, show proof before pricing.

This is precisely where Kablet's intelligence should become more capable over time.

The change must remain attributable and measurable.

---

## 06.41 Experimentation May Override Normal Decision Policy

Controlled experiments may intentionally choose a strategy different from the current preferred policy.

Conceptually:

Normal Policy
    ↓
Experiment Assignment
    ↓
Treatment Policy
    ↓
Decision
    ↓
Experience
    ↓
Outcome

Experiment context must remain attached to the resulting Decision and Outcome lineage.

This allows Kablet to discover whether an alternative strategy performs better.

---

## 06.42 Intelligence Must Support Exploration and Exploitation

Long-term optimization may require balancing:

**Exploitation**

Use the strategy currently believed to perform best.

and

**Exploration**

Test plausible alternatives to discover better strategies.

The Intelligence Interface must not assume that every Decision always uses the currently preferred strategy.

Detailed optimization algorithms belong to future learning architecture.

---

## 06.43 Intelligence Must Support Business Overrides

The Business may impose constraints or preferences on Kablet Intelligence.

Examples:

- never show price before consultation
- always disclose a required policy
- do not use a particular Offer
- prioritize a specific Business objective
- disable a particular Action

Such overrides become part of the authorized Decision context.

Kablet optimization occurs within them.

---

## 06.44 Human Review May Participate in Intelligence

Some future Decisions or Business recommendations may require human review.

The Intelligence Interface should not assume every proposed result must be automatically executed.

A possible lifecycle is:

Intelligence
    ↓
Recommendation
    ↓
Human Review
    ↓
Approval
    ↓
Execution

Human review is therefore compatible with Kablet's architecture rather than an exception to it.

---

## 06.45 Intelligence Must Support Progressive Autonomy

Kablet may begin with relatively constrained intelligence.

Over time, businesses may permit greater autonomy.

Conceptually:

Level 1:
Recommend only

Level 2:
Control Experience composition

Level 3:
Select among approved Offers

Level 4:
Perform constrained commercial Actions

Level 5:
Optimize broader customer-facing strategy within delegated authority

The exact autonomy model is not defined here.

The foundation requires that increased autonomy result from explicit capability and authority expansion rather than architectural bypass.

---

## 06.46 Intelligence Must Remain Auditable

For meaningful Decisions, Kablet should eventually be able to answer:

- What was the objective?
- What State existed?
- What Business Truth was relevant?
- What capabilities were available?
- What constraints applied?
- Which Intelligence configuration acted?
- What Decision was produced?
- Was it validated?
- What Experience resulted?
- What Outcome followed?

This auditability is essential for:

- debugging
- experimentation
- business trust
- optimization
- future learning

---

## 06.47 Intelligence Must Not Require Storing Hidden Reasoning

Auditability does not require Kablet to persist unrestricted internal chain-of-thought from AI models.

Kablet's durable intelligence record should rely on structured artifacts such as:

- inputs
- relevant context references
- State
- objective
- Decision
- strategy
- Experience Plan
- validation
- configuration metadata
- Outcome

These provide operational and commercial traceability without making provider-specific hidden reasoning the foundation of Kablet's data model.

---

## 06.48 Intelligence Interface Must Support Future Proprietary Intelligence

Kablet's long-term architecture must permit external models to become only one component of a larger proprietary intelligence system.

Future Intelligence may combine:

Business-specific learning
        +
Vertical intelligence
        +
Network-level strategies
        +
Experiment history
        +
Outcome models
        +
Rules
        +
External models
        +
Proprietary models
        ↓
Kablet Decision Engine

The rest of the platform should not need to be rebuilt when this evolution occurs.

This is one of the primary purposes of the Intelligence Interface.

---

# 06.A Canonical Intelligence Input

Conceptually:

Intelligence Request
│
├── Request Identity
├── Objective
├── Ownership Context
│   ├── Organization
│   ├── Business
│   └── Property / Location
├── Visitor Context
│   ├── Visitor
│   ├── Session
│   └── Visitor State
├── Business Context
│   ├── Relevant Business Truth
│   └── Business Rules
├── Experience Context
│   ├── Current Experience
│   ├── Available Components
│   └── Available Actions
├── Experiment Context
├── Relevant Prior Learning
├── Capability Constraints
└── Intelligence Contract Version

Only relevant and authorized context should be included.

---

# 06.B Canonical Intelligence Output

Conceptually:

Intelligence Result
│
├── Result Identity
├── Request Identity
├── Proposed State Updates
├── Decision
│   ├── Objective
│   ├── Strategy
│   ├── Relevant Inputs
│   └── Selected Capabilities
├── Experience Plan
│   ├── Selected Truth
│   ├── Components
│   ├── Composition
│   └── Generated Content
├── Proposed Actions
├── Intelligence Metadata
└── Contract Version

The result then passes through:

Validation
    ↓
Accepted State Changes
    ↓
Canonical Decision
    ↓
Validated Experience
    ↓
Authorized Actions

---

# 06.C Canonical Intelligence Boundary

The permanent boundary is:

KABLET-OWNED STATE
│
├── Business Truth
├── Visitor State
├── Decision History
├── Experience History
├── Event History
├── Outcome History
├── Experiment Context
└── Learned Strategies
        ↓
CONTEXT ASSEMBLY
        ↓
INTELLIGENCE INTERFACE
        ↓
REASONING SYSTEMS
│
├── Rules
├── LLMs
├── Retrieval
├── Experiments
├── Optimizers
├── Proprietary Models
└── Future Intelligence
        ↓
STRUCTURED RESULT
        ↓
KABLET VALIDATION
        ↓
CANONICAL DECISION / EXPERIENCE / ACTION

The reasoning systems are replaceable.

Kablet-owned state and contracts are not delegated to them.

---

# 06.D Intelligence Failure Model

The Intelligence Interface must assume failure is possible.

Conceptually:

Intelligence Request
        ↓
Reasoning Attempt
        ↓
┌──────────────────────┐
│ Valid Result?        │
└──────────┬───────────┘
           │
     Yes   │   No
      ↓    │    ↓
Validation │  Retry / Alternate
      ↓    │    ↓
Runtime    │  Safe Fallback
           │    ↓
           └→ Runtime Continues

Failure handling must preserve:

- valid Business Truth
- current Session integrity
- last valid Experience where appropriate
- Action correctness
- Event lineage

An intelligence failure must not become corrupted business state.

---

# 06.E Core Intelligence Interface Invariants

1. Kablet Intelligence is broader than any individual AI model.
2. Intelligence operates through a Kablet-owned interface.
3. Runtime does not depend directly on a particular intelligence provider.
4. Intelligence receives only relevant and authorized context.
5. Context Assembly preserves ownership boundaries.
6. Business Truth remains authoritative.
7. Available Components constrain what Intelligence can present.
8. Available Actions constrain what Intelligence can propose.
9. Intelligence operations have explicit objectives.
10. Different intelligence tasks may use different reasoning systems.
11. Operational Intelligence output is structured.
12. State updates are proposed before acceptance.
13. Experience Plans are proposed before runtime execution.
14. Proposed Actions are separate from Action execution.
15. Reasoning authority and execution authority are separate.
16. Intelligence optimizes inside explicit constraints.
17. Conversion optimization does not override Business authority or platform constraints.
18. Intelligence output is validated.
19. Deterministic constraints are enforced by Kablet software where practical.
20. Invalid output fails predictably.
21. Fallback behavior is part of the Intelligence boundary.
22. Providers are replaceable.
23. Models are replaceable.
24. Prompts are implementation assets, not foundational product contracts.
25. Model conversation history is not canonical Visitor State.
26. Raw model output is not canonical Decision history.
27. Intelligence configurations are attributable and versionable.
28. Intelligence is observable.
29. Cost and latency may influence implementation without changing the product contract.
30. Retrieval does not create authority.
31. Prior learning is evidence, not absolute truth.
32. Business, vertical, and network learning remain distinguishable.
33. Learning does not silently rewrite Business Truth.
34. Learning may improve Decision policy.
35. Experiment policy may intentionally alter normal Decision policy.
36. Future optimization may balance exploration and exploitation.
37. Business constraints and overrides participate in Decision context.
38. Human review is compatible with the Intelligence architecture.
39. Autonomy expands through explicit authority and capabilities.
40. Meaningful Intelligence behavior is auditable through structured artifacts.
41. Hidden model reasoning is not required as canonical Kablet data.
42. The Interface supports future proprietary Kablet intelligence.

---

# 06.F Explicitly Not Defined Here

This section intentionally does not define:

- AI provider
- model names
- model routing implementation
- prompt templates
- system prompts
- token budgets
- structured-output library
- agent framework
- orchestration framework
- retrieval technology
- vector database
- embedding model
- reranking model
- cache
- model gateway
- model fallback order
- proprietary ML architecture
- training pipeline
- fine-tuning strategy
- reinforcement learning
- bandit algorithm
- experiment algorithm
- confidence formulas
- exact Intelligence Request schema
- exact Intelligence Result schema
- latency thresholds
- cost thresholds

Those decisions belong to Technical Architecture and future Intelligence specifications.

This section defines the permanent interface within which those technologies operate.

---

# 06.G Foundation Dependency

Identity & Ownership established:

**Whose system and data is this?**

Business Truth established:

**What is authorized and true?**

Experience & Component Contract established:

**What may Kablet present and how may Intelligence control the frontend?**

Visitor State & Decisions established:

**What does Kablet understand and what did it choose?**

Event & Outcome Spine established:

**What actually happened and what resulted?**

Intelligence Interface establishes:

**How may replaceable reasoning systems use Kablet-owned context to produce validated Kablet Decisions?**

Together, Foundations 01 through 06 form the permanent conceptual core of Kablet.

---

# 07. Cross-Foundation Contracts

## 07.1 Purpose

Foundations 01 through 06 define distinct Kablet concepts.

Cross-Foundation Contracts define the permanent relationships between those concepts.

Their purpose is to prevent future implementations from collapsing important boundaries for convenience.

The foundational chain is:

Identity & Ownership
        ↓
Business Truth
        ↓
Visitor State
        ↓
Intelligence
        ↓
Decision
        ↓
Experience
        ↓
Interaction / Action
        ↓
Event
        ↓
Outcome

Each foundation owns a different kind of meaning.

Their relationships are explicit.

---

## 07.2 Ownership Is the Root Context

Tenant-sensitive Kablet data must exist within an ownership context established by Foundation 01.

Conceptually:

Organization
    ↓
Business
    ↓
Business-Owned Runtime Data

Business-owned runtime data may include:

- Business Truth
- Visitors
- Sessions
- Decisions
- Experiences
- Events
- Actions
- Outcomes
- Experiments
- learned Business-specific strategies

A subsystem must not create tenant-sensitive records whose ownership cannot be determined.

---

## 07.3 Business Is the Primary Runtime Commercial Context

Organization establishes ownership.

Business establishes the commercial context Kablet is currently powering.

Customer-facing runtime behavior must therefore be attributable to a Business.

Conceptually:

Organization
    ↓
Business
    ↓
Visitor
    ↓
Session
    ↓
Decision
    ↓
Experience
    ↓
Outcome

Property / Location may further scope behavior without replacing the Business as the primary commercial context.

---

## 07.4 Business Truth Feeds Intelligence

Business Truth supplies the authorized commercial knowledge available to Intelligence.

Intelligence may:

- retrieve it
- select it
- reason over it
- compose it
- explain it
- contextualize it

Intelligence may not silently redefine authoritative Business Truth.

The relationship is:

Business Truth
    ↓
Intelligence Context

not:

Intelligence Output
    ↓
Automatic Business Truth

unless an explicitly authorized Business Truth mutation capability exists.

---

## 07.5 Visitor Signals Feed Visitor State

Signals contribute evidence about the current customer interaction.

Conceptually:

Signal
    ↓
Interpretation
    ↓
Proposed State Update
    ↓
Validation / Acceptance
    ↓
Visitor State

Signals do not automatically become permanent Visitor characteristics.

Inference does not automatically become fact.

Visitor State remains Kablet-owned structured state.

---

## 07.6 Visitor State Feeds Decisions

Visitor State supplies Intelligence with the current structured understanding of the Visitor.

A Decision may use:

Business Truth
+
Visitor State
+
Current Experience
+
Available Components
+
Available Actions
+
Applicable Constraints
+
Experiment Context
+
Prior Learning

to determine what should happen next.

A Decision must remain distinguishable from the State that informed it.

---

## 07.7 Intelligence Produces Proposed Decisions

Reasoning systems operate through the Intelligence Interface.

They produce structured proposed results.

Those results become canonical Kablet Decisions only after applicable validation and acceptance.

Conceptually:

Intelligence
    ↓
Proposed Decision
    ↓
Validation
    ↓
Canonical Decision

This preserves the permanent rule:

**Intelligence proposes. Contracts constrain. Kablet validates.**

---

## 07.8 Decisions Produce Experience Plans

A meaningful Decision may produce an Experience Plan.

The Decision describes:

**what Kablet chose to do**

The Experience Plan describes:

**how that choice should be expressed through available customer-facing capabilities**

These concepts must remain separate.

One Decision strategy may support multiple valid Experience representations.

---

## 07.9 Experience Plans Must Pass Through the Experience Contract

An Experience Plan does not directly control arbitrary frontend code.

It passes through Foundation 03.

Conceptually:

Decision
    ↓
Experience Plan
    ↓
Experience Contract
    ↓
Validation
    ↓
Runtime
    ↓
Rendered Experience

This is the permanent boundary between Intelligence and frontend execution.

---

## 07.10 Experiences Reference Business Truth Rather Than Replacing It

Where customer-facing content represents canonical Business Truth, the Experience should preserve meaningful reference to that Truth.

For example:

Business Truth:
Service S17
Price P4

Decision:
Surface Service S17 and Price P4.

Experience:
Service Component → S17
Price Component → P4

The Experience may contain generated presentation around those references.

It does not become the authoritative source of the underlying commercial information.

---

## 07.11 Components Expose Authorized Actions

Components may present Actions to Visitors.

For example:

Service Component
    ↓
Book Consultation

Product Component
    ↓
Buy

Offer Component
    ↓
Claim Offer

The Component does not create the underlying business capability.

The Action must exist within authorized Business capabilities.

---

## 07.12 Intelligence Proposes; Action Systems Execute

Intelligence may decide that an Action should be surfaced or proposed.

Execution remains a separate boundary.

Conceptually:

Intelligence
    ↓
Decision
    ↓
Proposed Action
    ↓
Authorization
    ↓
Validation
    ↓
Execution
    ↓
Result

Reasoning authority must not silently become execution authority.

---

## 07.13 Events Observe the Other Foundations

The Event Spine records meaningful occurrences across Kablet.

Events may observe activity involving:

- Visitor State
- Decisions
- Experiences
- Components
- Actions
- Conversions
- Outcomes
- Experiments

The Event Spine does not replace those domain objects.

For example:

Decision

is a domain object.

decision.created

is an Event describing an occurrence involving that object.

This distinction must remain intact.

---

## 07.14 Outcomes Connect Business Results Back to Decisions

Outcomes provide the commercial result side of the Kablet loop.

Conceptually:

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
Action
    ↓
Outcome

This relationship allows Kablet to evaluate what happened after a Decision.

It does not automatically prove that the Decision caused the Outcome.

---

## 07.15 Experiments Cross Multiple Foundations

Experimentation may affect:

- Intelligence policy
- Decisions
- Experience composition
- presentation variants
- Action strategy

Experiment context must therefore remain traceable across:

Assignment
    ↓
Decision
    ↓
Experience
    ↓
Exposure
    ↓
Outcome

Experiments do not bypass Business Truth, authority, or runtime validation.

---

## 07.16 Learning Consumes History; It Does Not Rewrite History

Future Learning systems may consume:

- Visitor State history
- Decision history
- Experience history
- Event history
- Experiment history
- Outcome history

and derive improved strategies.

Learning may influence future Decisions.

It must not silently rewrite historical Decisions, Events, Experiences, or Outcomes to make past behavior appear different.

Conceptually:

Historical Evidence
        ↓
Learning
        ↓
Learned Strategy
        ↓
Future Decision

---

## 07.17 Learning and Business Truth Remain Separate

Learning may conclude:

"Proof-before-price performs better for this customer state."

That is a learned strategy.

It is not Business Truth.

Business Truth may state:

"Service price is 399 AED."

These concepts must remain separate.

Learned strategy influences **how Kablet operates**.

Business Truth defines **what the Business authorizes as true**.

---

## 07.18 Business-Specific Learning Preserves Business Context

A learned strategy derived from one Business must remain attributable to that Business where applicable.

Business-specific learning may inform that Business's future Decisions.

It must not automatically become a universal platform rule.

Broader generalization requires explicit learning and governance mechanisms.

---

## 07.19 Vertical and Network Learning Do Not Break Tenant Isolation

Kablet may eventually derive generalized patterns across Businesses.

This does not alter the ownership of underlying tenant data.

Conceptually:

Tenant Data
    ↓
Governed Learning
    ↓
Generalized Pattern

not:

Tenant A Data
    ↓
Directly Exposed to Tenant B

The learning layer may generalize permitted knowledge.

The runtime ownership model remains intact.

---

## 07.20 Historical Lineage Crosses Foundation Boundaries

Kablet must preserve enough historical identity to connect meaningful records across foundations.

A future reconstruction should be capable of answering:

Which Business?

Which Visitor?

Which Session?

Which State?

Which Business Truth was relevant?

Which Decision was made?

Which Intelligence configuration produced it?

Which Experience was planned?

Which Experience was actually rendered?

Which Components were viewed?

Which Actions occurred?

Which Experiment applied?

Which Outcome followed?

This does not require every object to duplicate all other objects.

It requires stable references and historical interpretability.

---

## 07.21 Current State and Historical State Must Not Be Confused

Many Kablet concepts evolve:

- Business Truth
- Visitor State
- Experience
- Outcome
- Intelligence configuration

Historical analysis must not blindly join historical activity against only the latest current state.

For example:

Price today:
249 AED

Price when Decision occurred:
199 AED

The historical Decision must remain interpretable against the relevant historical Truth.

This principle applies across foundation boundaries.

---

## 07.22 Canonical Objects and Events Must Not Collapse Into One Model

Kablet contains both:

**Domain Objects**

such as:

- Business
- Service
- Visitor
- Decision
- Experience
- Outcome

and:

**Events**

such as:

- service.updated
- decision.created
- experience.rendered
- conversion.completed

An Event describes something that happened.

It is not automatically the canonical current representation of the domain object involved.

The technical architecture may choose appropriate persistence patterns later.

The conceptual distinction is permanent.

---

## 07.23 IDs Must Support Cross-Foundation Lineage

Canonical Kablet entities require stable identity sufficient for cross-foundation relationships.

For example:

Decision ID
    ↓
Experience ID
    ↓
Component Instance ID
    ↓
Action ID
    ↓
Outcome ID

The exact identifier technology is not defined here.

The requirement is stable, unambiguous referenceability.

---

## 07.24 Cross-Foundation References Must Respect Ownership

A valid identifier alone does not authorize access.

For example:

Business A's Experience must not become able to reference Business B's private Service merely because the Service ID is technically known.

Cross-foundation relationships must preserve:

- ownership
- authorization
- applicable scope

Reference validity and access authority are separate questions.

---

## 07.25 Validation Exists at Boundaries

Validation should occur where one foundation attempts to affect another.

Examples:

Intelligence → Visitor State
Validate proposed State update.

Intelligence → Decision
Validate Decision structure and authority.

Decision → Experience
Validate Experience Contract.

Experience → Action
Validate Action availability.

External System → Outcome
Validate source and relationship.

The exact validation architecture belongs to Technical Architecture.

The permanent principle is that cross-foundation transitions are controlled boundaries.

---

## 07.26 Failure in One Foundation Must Not Corrupt Another

A failure in one subsystem must not silently create invalid canonical state elsewhere.

For example:

AI failure must not corrupt Business Truth.

Rendering failure must not become false Component exposure.

Payment failure must not become realized Revenue.

Webhook duplication must not become duplicate Conversion.

Experiment assignment must not automatically become Experiment exposure.

Each boundary preserves the semantic integrity of the next foundation.

---

## 07.27 The Runtime Loop

The canonical Kablet runtime loop is:

Business Truth
        +
Visitor Context
        +
Visitor State
        +
Prior Learning
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
Rendered Experience
        ↓
Visitor Interaction
        ↓
Authorized Action
        ↓
Outcome
        ↓
Event & Outcome Spine
        ↓
Measurement / Experimentation
        ↓
Learning
        ↓
Future Intelligence

This loop is one of Kablet's permanent architectural concepts.

Its implementation may evolve.

Its semantic boundaries should remain stable.

---

# 07.A Foundation Relationship Map

The six permanent foundations relate as follows:

01 Identity & Ownership
        │
        ├── owns → 02 Business Truth
        │
        ├── scopes → 04 Visitor State & Decisions
        │
        └── scopes → 05 Events & Outcomes
        │
        ▼
02 Business Truth
        │
        └── informs → 06 Intelligence
                         │
04 Visitor State ────────┤
03 Available Experience ─┤
Experiment Context ──────┤
Prior Learning ──────────┘
                         │
                         ▼
                    04 Decision
                         │
                         ▼
                 03 Experience Plan
                         │
                         ▼
                  03 Validated Experience
                         │
                         ▼
                 Customer Interaction
                         │
                         ▼
                  Authorized Action
                         │
                         ▼
                   05 Outcome
                         │
                         ▼
                    05 Events
                         │
                         ▼
                 Future Learning
                         │
                         └────→ 06 Intelligence

---

# 07.B Permanent Separation of Concerns

The following boundaries must remain conceptually separate:

Business Truth
≠
Generated Experience

Visitor Signal
≠
Visitor State

Visitor State
≠
Decision

Decision
≠
Experience

Experience Plan
≠
Rendered Experience

Component
≠
Action

Action Started
≠
Action Completed

Conversion
≠
Revenue

Estimated Value
≠
Realized Revenue

Event
≠
Outcome

Attribution
≠
Causation

Experiment Assignment
≠
Experiment Exposure

Learning
≠
Business Truth

AI Provider
≠
Kablet Intelligence

Reasoning Authority
≠
Execution Authority

Current State
≠
Historical State

These distinctions are foundational contracts.

---

# 07.C Canonical Kablet Loop

The platform's central semantic loop is:

WHAT THE BUSINESS AUTHORIZES
            ↓
WHAT KABLET UNDERSTANDS
            ↓
WHAT KABLET DECIDES
            ↓
WHAT KABLET PRESENTS
            ↓
WHAT THE CUSTOMER EXPERIENCES
            ↓
WHAT THE CUSTOMER DOES
            ↓
WHAT BUSINESS RESULT OCCURS
            ↓
WHAT KABLET LEARNS
            ↓
WHAT KABLET DOES BETTER NEXT TIME

In canonical objects:

Business Truth
    ↓
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
Action
    ↓
Outcome
    ↓
Learning
    ↓
Future Decision

---

# 07.D Cross-Foundation Invariants

1. Ownership context precedes tenant-sensitive runtime data.
2. Business is the primary commercial runtime context.
3. Business Truth feeds Intelligence without surrendering authority to it.
4. Signals inform Visitor State but do not automatically become facts.
5. Visitor State informs Decisions without becoming the Decision itself.
6. Intelligence produces proposals through explicit contracts.
7. Accepted meaningful choices become canonical Decisions.
8. Decisions produce Experience Plans through the Experience Contract.
9. Experiences reference Business Truth rather than replacing it.
10. Components may expose only authorized Actions.
11. Intelligence proposal and Action execution remain separate.
12. Events observe domain activity rather than replacing domain objects.
13. Outcomes connect business results to journey history.
14. Experiment context remains traceable from assignment through Outcome.
15. Learning consumes historical evidence without rewriting history.
16. Learning remains separate from Business Truth.
17. Cross-business learning does not break tenant isolation.
18. Historical relationships remain interpretable against historical context.
19. Domain objects and Events remain conceptually distinct.
20. Stable identity supports cross-foundation lineage.
21. References do not imply authorization.
22. Cross-foundation transitions are validated.
23. Failure in one foundation must not silently corrupt another.
24. The canonical Kablet runtime loop remains reconstructable.

---

# 07.E Explicitly Not Defined Here

This section intentionally does not define:

- database foreign keys
- table relationships
- event transport
- API boundaries
- service boundaries
- module boundaries
- transaction boundaries
- distributed transaction strategy
- queue architecture
- cache architecture
- repository structure
- deployment topology
- concrete validation libraries
- concrete authorization implementation

Those belong to Technical Architecture.

This section defines the semantic contracts those implementations must preserve.

---

# 07.F Foundation Dependency

Foundations 01 through 06 defined Kablet's permanent primitives.

Cross-Foundation Contracts establish:

**How those primitives are allowed to interact without losing their meaning.**

The remaining Foundation Specification sections define the rules that apply across the entire system:

**08 — Data Ownership Rules**

**09 — Versioning Rules**

**10 — Privacy & Tenant Isolation Principles**

**11 — Extension Principles**

**12 — Explicitly Out of Scope for Foundation v0.1**