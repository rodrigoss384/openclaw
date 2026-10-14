# Product Discovery for Frontend Creation

## Purpose

Convert product specifications, business requirements, domain rules, API
contracts, user requests, and existing documentation into explicit frontend
product context.

This reference prevents the agent from treating functional requirements as a
complete user-interface specification.

Functional requirements usually explain:

- what the system must do;
- which data must exist;
- which actions are allowed;
- which rules must be enforced.

They usually do not fully explain:

- what deserves visual prominence;
- how frequently each action is performed;
- which information must be visible immediately;
- which information may be progressively disclosed;
- how dense the interface should be;
- how workflows should be grouped;
- how empty, loading, error, and permission states should behave;
- which terminology users understand;
- which content lengths the layout must support.

Do not start visual direction or implementation until the frontend-relevant
product context is sufficiently explicit.

---

# Required output

Use:

`assets/templates/product-context.template.md`

Create the resulting project artifact at:

`docs/frontend/product-context.md`

If the project already has an equivalent approved artifact, update or reference
it instead of creating a duplicate.

Write the artifact in the language used by the product team unless the user
requests another language.

---

# Discovery principles

## Evidence before inference

Extract information from available evidence before making assumptions.

Possible sources include:

- product requirements;
- feature specifications;
- user stories;
- use cases;
- acceptance criteria;
- API schemas;
- OpenAPI documents;
- generated clients;
- domain entities;
- permission definitions;
- route definitions;
- database documentation;
- existing workflows;
- support documentation;
- screenshots;
- prototypes;
- stakeholder instructions;
- terminology glossaries;
- analytics or usage evidence.

Do not assume that backend entity structure should become frontend navigation
structure.

Do not assume that every database field deserves visual representation.

Do not assume that every API operation deserves a prominent button.

---

## User tasks before screens

Do not begin discovery by listing pages.

First identify:

1. who uses the product;
2. what they are trying to accomplish;
3. how frequently they perform each task;
4. what information they need to decide;
5. what errors would be costly;
6. what interrupts or delays their work;
7. what successful completion looks like.

Screens are implementation structures derived from tasks.

---

## Operational priority before visual priority

A field may be important to the database but secondary to the user's task.

A field may be technically simple but operationally critical.

Classify information and actions by operational relevance, not by schema order.

Use these priority levels:

- `critical`: required to avoid legal, financial, security, or operational harm;
- `primary`: required to complete the main task;
- `supporting`: helps interpretation or decision-making;
- `contextual`: useful in specific situations;
- `administrative`: configuration or maintenance information;
- `technical`: implementation detail not intended for ordinary users.

Technical information must not automatically appear in the user interface.

---

# Discovery workflow

## Step 1 — Inventory available evidence

List every source inspected.

For each source, record:

- path or location;
- type;
- status;
- apparent authority;
- relevant content;
- conflicts;
- staleness risk.

Classify source status as:

- `approved`;
- `draft`;
- `inferred`;
- `deprecated`;
- `unknown`.

Do not silently treat drafts as approved requirements.

---

## Step 2 — Identify product type

Classify the product using the most specific applicable category.

Examples:

- operational B2B application;
- internal administrative system;
- legal case-management system;
- financial operations platform;
- healthcare workflow;
- customer portal;
- analytics dashboard;
- content-management application;
- marketplace;
- collaboration application;
- consumer utility;
- onboarding workflow.

Record whether the interface is primarily:

- task-oriented;
- data-oriented;
- decision-oriented;
- monitoring-oriented;
- content-oriented;
- transaction-oriented.

More than one may apply, but identify the dominant mode.

---

## Step 3 — Identify actors and roles

For each role, document:

- role name;
- level of domain knowledge;
- expected technical knowledge;
- frequency of use;
- environment of use;
- permissions;
- primary tasks;
- sensitive actions;
- information restrictions;
- likely accessibility needs.

Do not use generic personas such as:

> Busy professional who values efficiency.

Use operationally meaningful descriptions.

Example:

> Legal operations analyst who reviews 40–80 active enforcement cases per day,
> prioritizes critical deadlines, updates procedural status, and prepares cases
> for attorney review.

---

## Step 4 — Build the jobs-to-be-done map

For each important job, record:

- trigger;
- desired outcome;
- task frequency;
- urgency;
- input information;
- decision information;
- actions;
- confirmation requirements;
- failure consequences;
- completion evidence.

Example structure:

| Job | Trigger | Frequency | Urgency | Outcome |
|---|---|---:|---|---|
| Review critical deadlines | Beginning of shift | Daily | Critical | No confirmed deadline remains unattended |
| Update case status | New court event | Frequent | High | Case reflects current procedural state |
| Generate management export | Reporting cycle | Monthly | Medium | Management receives consolidated data |

Task frequency influences interface prominence.

A daily task should generally require fewer navigation steps than a monthly
configuration task.

---

## Step 5 — Map journeys and workflows

For each primary journey, identify:

1. entry point;
2. orientation information;
3. user decision;
4. primary action;
5. system feedback;
6. exception paths;
7. completion state;
8. next likely task.

Mark where users:

- compare information;
- filter;
- search;
- review;
- create;
- edit;
- approve;
- reject;
- upload;
- export;
- communicate;
- wait for processing;
- recover from errors.

Do not reduce a workflow to a sequence of routes only.

Record the information and decisions required at each step.

---

## Step 6 — Define information architecture

Derive product areas from user tasks and domain concepts.

For each area, identify:

- purpose;
- owning task;
- target roles;
- child areas;
- entry points;
- cross-links;
- frequency;
- sensitivity.

Avoid navigation that mirrors backend modules without user justification.

Avoid creating a top-level item for every entity.

Prefer grouping by user intent.

Example:

Instead of:

- Process;
- ProcessDocument;
- ProcessCommunication;
- ProcessDeadline;
- ProcessAudit;

prefer user-oriented groups such as:

- Case overview;
- Financial;
- Activity and communication;
- Documents;
- Deadlines;
- Audit and intelligence.

---

## Step 7 — Create the screen inventory

Only after tasks and information architecture are understood, identify likely
screens.

For each screen, record:

- screen ID;
- name;
- route or route concept;
- product area;
- primary user;
- primary task;
- dominant content;
- primary action;
- recipe candidate;
- expected density;
- implementation status;
- dependencies.

Do not implement this inventory during discovery.

It is a planning artifact.

---

## Step 8 — Establish content hierarchy

For each important screen or workflow, classify content as:

### Level 1 — Orientation

Information needed to understand:

- where the user is;
- which entity or context is active;
- whether immediate attention is required.

### Level 2 — Decision

Information required to make the screen's main decision.

### Level 3 — Action support

Information needed while executing the primary action.

### Level 4 — Context

Useful supporting detail.

### Level 5 — Audit or technical detail

Information needed infrequently, for accountability or troubleshooting.

Do not give every level equal visual weight.

---

## Step 9 — Define domain terminology

Create a domain dictionary containing:

- internal name;
- user-facing label;
- definition;
- acceptable abbreviation;
- prohibited label;
- context-specific variations.

Example:

| Internal value | User-facing label | Notes |
|---|---|---|
| `cumprimento_sentenca` | Cumprimento de sentença | Never expose snake_case |
| `hasCriticalDeadline` | Possui prazo crítico | Prefer a status badge or filter label |
| `tenant` | Organização | Use “tenant” only in technical administration contexts |

Do not mechanically title-case internal identifiers.

A translation layer may require domain interpretation.

---

## Step 10 — Define data formatting rules

Document user-facing formats for:

- dates;
- date and time;
- time zones;
- currency;
- percentages;
- decimal values;
- identifiers;
- phone numbers;
- document numbers;
- file sizes;
- durations;
- negative values;
- unavailable data;
- not-applicable data;
- values awaiting calculation.

Distinguish:

- unknown;
- not informed;
- not applicable;
- not calculated;
- zero;
- unavailable;
- permission restricted.

Do not represent all of these as `-`.

---

## Step 11 — Analyze data shape and magnitude

Layout requirements depend on realistic data characteristics.

For each important collection or field, estimate:

- minimum item count;
- typical item count;
- high item count;
- minimum text length;
- typical text length;
- maximum realistic text length;
- optionality;
- uniqueness;
- grouping;
- sorting requirements;
- filtering requirements;
- pagination requirements;
- freshness requirements.

Example:

| Data | Typical | High | Layout consequence |
|---|---:|---:|---|
| Active cases | 300 | 20,000 | Server pagination and robust filtering |
| Tags per case | 2–4 | 15 | Collapsed badge group |
| Defendant name | 25 chars | 180 chars | Wrapping and truncation policy |
| Timeline entries | 20 | 1,500 | Incremental loading or pagination |

Do not validate a layout only with ideal data.

---

## Step 12 — Map actions

Classify each action as:

- primary;
- secondary;
- tertiary;
- contextual;
- destructive;
- irreversible;
- bulk;
- system-generated;
- automated suggestion;
- human confirmation.

For each action, record:

- eligible roles;
- prerequisites;
- confirmation requirements;
- pending behavior;
- success feedback;
- error recovery;
- audit requirement;
- whether undo is possible.

One screen should not contain several visually dominant primary actions without
a clear hierarchy.

---

## Step 13 — Build the permissions matrix

For each role and capability, define:

- can view;
- can create;
- can edit;
- can approve;
- can delete;
- can export;
- can administer;
- can view sensitive data.

Also define the frontend behavior when access is absent:

- hide;
- disable with explanation;
- show read-only;
- show permission message;
- redirect.

Do not choose between hiding and disabling arbitrarily.

The decision depends on whether awareness of the capability is useful and
whether disclosing its existence is safe.

---

## Step 14 — Build the state matrix

Every important screen, component, query, and mutation must consider relevant
states.

### Query states

- idle, when applicable;
- initial loading;
- partial loading;
- refreshing;
- success with data;
- success with zero data;
- stale data;
- warning;
- recoverable error;
- blocking error;
- offline or unavailable;
- unauthorized;
- forbidden.

### Mutation states

- default;
- invalid;
- pending;
- success;
- partial success;
- conflict;
- recoverable failure;
- irreversible failure;
- retrying;
- cancelled.

### Content states

- ideal content;
- long content;
- missing optional content;
- restricted content;
- many items;
- one item;
- zero items;
- duplicate-looking items;
- mixed statuses.

Do not postpone state design until after the ideal screen is complete.

---

## Step 15 — Create realistic fixtures

Define a small fixture set for isolated frontend development and testing.

At minimum include:

1. typical case;
2. empty case;
3. long-content case;
4. high-density case;
5. warning case;
6. error case;
7. restricted-permission case.

Fixtures must:

- use domain-plausible values;
- use realistic content lengths;
- avoid real personal or confidential data;
- preserve API shape where known;
- clearly identify themselves as non-production fixtures.

When the build is a prototype, demo, or pilot meant for viewing by an
external stakeholder (not only local development), the non-production origin
of the data must also be disclosed in the rendered interface itself — a
visible environment/synthetic-data indicator defined in the visual direction
— in addition to the fixture's own source-code self-identification. Source
comments are not sufficient disclosure for a build a stakeholder will see
running.

---

## Step 16 — Identify constraints and risks

Document:

- supported browsers;
- target devices;
- minimum viewport;
- expected zoom;
- localization requirements;
- offline requirements;
- latency expectations;
- accessibility target;
- security constraints;
- regulatory constraints;
- audit requirements;
- legacy integration constraints;
- performance constraints.

Record which constraints are verified and which are assumptions.

---

# Assumption policy

Classify assumptions by impact.

## Low-impact assumption

May proceed when the decision is:

- reversible;
- local;
- convention-based;
- unlikely to alter user workflow.

Record it in the artifact.

Example:

> Assume standard desktop-first operational use with responsive support down to
> tablet until device analytics become available.

## Medium-impact assumption

May proceed only with an explicit proposed default and visible warning.

Example:

> Assume exports are secondary actions and place them in an overflow menu.

## High-impact assumption

Stop and request a decision.

Examples:

- which role may approve a legal deadline;
- whether destructive actions are reversible;
- whether a mobile workflow is required;
- whether users need to compare entities side by side;
- whether an automated recommendation can trigger a mutation;
- whether restricted data may be shown.

---

# Discovery completion gate

Discovery is complete only when the artifact identifies:

- product type;
- primary users;
- primary jobs;
- critical journeys;
- information architecture;
- screen inventory;
- domain terminology;
- content hierarchy;
- action hierarchy;
- permissions;
- query and mutation states;
- realistic content characteristics;
- constraints;
- assumptions;
- unresolved decisions.

Use one of these statuses:

- `APPROVED_FOR_DESIGN_DIRECTION`;
- `APPROVED_WITH_ASSUMPTIONS`;
- `BLOCKED_BY_PRODUCT_DECISIONS`.

Do not use `APPROVED_FOR_DESIGN_DIRECTION` when high-impact questions remain.

---

# Anti-patterns

Do not:

- create pages directly from database tables;
- expose every API field because it exists;
- use generic personas;
- use lorem ipsum;
- equate task frequency with business importance without evidence;
- assume desktop or mobile without documenting it;
- invent product terminology;
- convert internal enum values mechanically;
- define only the happy path;
- treat permissions as a backend-only concern;
- begin design direction while product context is materially ambiguous;
- create UI components during discovery mode.

---

# Required discovery report

At the end of discovery mode, report:

## Evidence inspected

Files, specifications, contracts, and other sources.

## Product model

Users, tasks, journeys, terminology, and information architecture.

## Frontend implications

Content hierarchy, density, actions, states, data magnitude, and permissions.

## Assumptions

Low- and medium-impact assumptions made.

## Blocking decisions

High-impact questions that require human input.

## Artifact

Path to `docs/frontend/product-context.md`.

## Gate status

One of the discovery statuses defined above.
