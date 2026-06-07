---
id: user-guide
title: RQML User guide
sidebar_label: User guide
sidebar_position: 3
---

RQML - Requirements Markup Language - is an XML standard for documenting software requirements. RQML is designed to be:

- **Easy for humans** to read and write (both as plain XML and via tools).
- **Context-rich for LLMs**, so code generation has the domain, intent, constraints, and verification baked in.
- **Traceable**, so you can connect goals → requirements → tests and understand impact.

RQML documents can be short and high level for simple projects, or long and extremely detailed when projects call for it. 

The long term goal of RQML is to become _your pane of control when creating software_ - you (and perhaps an LLM) write the requirements and LLMs write the code.

## Overview of an RQML requriements specification document

### 0. Front Matter
- Title page (system name, version, status, owner)
- Document control (authors, reviewers, change history)
- How to read this document (audience, conventions)
- Scope of this document (what’s included / excluded)

### 1. Executive Summary
- Problem statement
- Vision / intended outcomes
- High-level success criteria
- Current status and milestones (if relevant)

### 2. Glossary and Shared Language
- Glossary (terms, acronyms)
- Domain vocabulary and synonyms (important for LLM consistency)
- Ubiquitous language notes (bounded contexts, naming rules)

### 3. Context and Domain
- Business context / background
- Users and stakeholders (personas, roles)
- Operating environment (deployment, devices, regions, languages)
- Assumptions and dependencies (upstream/downstream systems)

### 4. Product Scope
- In-scope capabilities
- Out-of-scope / non-goals
- Constraints (technical, organizational, budget/time, platforms)
- Regulatory/compliance boundaries

### 5. Goals and Intent (Goal-Oriented Requirements)
- Goal model overview (top-level goals)
- Stakeholder goals (by role)
- Quality goals (e.g., “fast”, “safe”, “auditable”)
- Goal refinement (subgoals, obstacles/risks, mitigations)
- Rationale and trade-offs (why decisions were made)

### 6. System Overview
- System boundary description (what is the system)
- Major components / modules (conceptual)
- External integrations (services, vendors, legacy systems)
- Key workflows at a glance (happy paths)

### 7. Domain Model
- Core entities and relationships (conceptual model)
- State machines for key entities (e.g., Order: Draft→Paid→Shipped)
- Business rules catalog (invariants, validations)
- Data definitions (field meanings, units, formats)

### 8. Users, Permissions, and Security Model
- Roles and permissions matrix
- Authentication and session rules
- Authorization principles (RBAC/ABAC)
- Security requirements (encryption, secrets handling, audit)
- Audit logging expectations

### 9. Functional Requirements (Capability Catalog)
Organize by feature area (or bounded context):
- Feature group A
  - Functional requirements (shall/MUST statements)
  - Preconditions / triggers
  - Main behavior
  - Edge cases / error handling
  - Acceptance criteria
- Feature group B
  - …

### 10. User Stories and Epics (Agile View)
- Epics (goal-aligned)
- Stories (INVEST-style)
- Story acceptance criteria (Given/When/Then)
- Story-to-requirement trace links (coverage)

### 11. Use Cases (Behavioral View)
For each use case:
- Name, primary actor, stakeholders
- Preconditions
- Main success scenario
- Alternative flows
- Exception flows
- Postconditions
- Notes and open questions

### 12. Non-Functional Requirements (Quality Attributes)
Structured as measurable requirements:
- Performance (latency, throughput, concurrency, SLAs)
- Reliability & availability (SLOs, failover behavior)
- Scalability (growth assumptions, limits)
- Maintainability (modularity, logging, observability)
- Usability & accessibility (WCAG targets)
- Portability (browsers, OS, deployment targets)
- Data retention and privacy (GDPR-like requirements)
- Supportability (runbooks, metrics, alerts)

### 13. Interfaces and Integration Contracts
- API overview (internal/external)
- Endpoints/contracts (request/response semantics)
- Error model (codes, retry rules, idempotency)
- Eventing / messaging (events, schemas, ordering)
- Integration constraints (rate limits, auth, timeouts)

### 14. UI and Interaction Requirements (if applicable)
- Navigation model
- Screen/page list with intent
- UI behaviors (forms, validation, empty states)
- Accessibility and localization rules
- Content rules (copy tone, formatting)

### 15. Reporting, Analytics, and Observability
- Required reports and definitions
- Metrics catalog (business + technical)
- Logs/traces requirements
- Audit requirements (what must be recorded)

### 16. Test and Verification Model
- Acceptance test suite outline (by requirement/use case/story)
- Test data requirements
- Traceability to requirements
- Definition of Done criteria

### 17. Traceability and Coverage
- Trace model (Goal → Epic → Story → Use Case → Requirement → Test)
- Coverage expectations (must/may levels)
- Impact analysis rules (what changes when X changes)

### 18. Risk, Open Issues, and Decisions
- Risks and mitigations
- Open questions backlog
- Decision log (ADRs or lightweight decision records)
- Deferred items / parking lot

### 19. Delivery and Migration (if relevant)
- Rollout strategy
- Backward compatibility expectations
- Data migration requirements
- Cutover and rollback requirements

### 20. Appendices
- Reference materials
- Examples (sample scenarios, sample payloads)
- Checklists (security, accessibility, performance)
- Change log (full)

---

## RQML-native outline (schema-oriented)

This variant is organized the way an eventual schema would be: **catalogs** for reusable definitions, **typed requirement items**, and an explicit **trace graph**.

### A. Document Metadata
- Document identity (doc-id, title, version, status)
- Ownership (product owner, tech owner, reviewers)
- Lifecycle (created/updated dates, release target)
- Change log entries (id, author, rationale)
- Conventions (MUST/SHOULD/MAY semantics)

### B. Reference Catalogs
Reusable dictionaries referenced by ID:
- Glossary catalog (term-id → definition, synonyms)
- Stakeholder catalog (stakeholder-id → org/role, concerns)
- Actor/persona catalog (actor-id → goals, skills, pain points)
- System boundary catalog (system-id → includes/excludes)
- Constraint catalog (constraint-id → type, source, severity)
- Policy/compliance catalog (policy-id → obligation, evidence)
- Risk catalog (risk-id → probability/impact, mitigation links)
- Decision catalog (decision-id → context, alternatives, consequences)
- Assumption catalog (assumption-id → statement, confidence, owner)

### C. Context Model
- Domain overview (domain-id, narrative)
- Bounded contexts / subdomains (context-id, responsibilities)
- External systems catalog (extsys-id, owner, SLA expectations)
- Environment profiles (env-id: dev/test/prod assumptions)
- Business processes (process-id: flow summaries)

### D. Goal & Intent Model (Goal-Oriented RE)
- Top-level goals (goal-id, owner, priority)
- Goal decomposition tree (parent/child links)
- Obstacles/threats (obstacle-id → threatens goal-id, mitigation)
- Softgoals / quality goals (qgoal-id)
- Trade-offs and rationale (tradeoff-id, rationale-id)

### E. Scenario Model
- Scenarios (scenario-id, narrative)
- Misuse/failure scenarios (misuse-id)
- Edge-case scenarios (edge-id)
- Example datasets (exampledata-id)

### F. Domain/Data Model
- Entity catalog (entity-id)
- Attribute catalog (attr-id, type, units, validation)
- Relationship catalog (rel-id)
- State machines (stateflow-id)
- Business rules catalog (rule-id, examples)
- Data classification (data-id: PII, retention, encryption)

### G. Requirement Set (core)
- Requirement packages (pkg-id)
- Requirement items (req-id) with types like FR/NFR/IR/DR/SR/CR/PR/UXR/OR
- Requirement relationships: depends-on, refines, conflicts-with, supersedes, etc.

### H. Agile View (Epics & Stories)
- Epics (epic-id) linked to goals
- Stories (story-id) with acceptance criteria (ac-id)

### I. Use Case View
- Use cases (uc-id) with steps, alt flows, exception flows
- Links to rules and requirements

### J. Interface & Contract Model
- APIs (api-id), endpoints (endpoint-id)
- Payload schemas (schema-id)
- Error model (error-id)
- Events (event-id)

### K. UX / UI Model (optional)
- Screens/views (view-id)
- UI rules (uirule-id)
- Accessibility targets (a11y-id)
- Localization rules (i18n-id)

### L. Quality Attributes & Operational Model
- SLOs (slo-id), availability/error budgets
- Observability requirements (obs-id)
- Runbooks (runbook-id)
- Backup/restore (backup-id, RPO/RTO)
- Deployment constraints (deploy-id)

### M. Verification Model
- Verification methods (vm-id)
- Test cases (tc-id) and suites (suite-id)
- Property checks (prop-id)
- Trace: `tc-id verifies req-id`, `req-id supports goal-id`

### N. Traceability Graph
- Explicit trace edges (edge-id, from, to, type, confidence)
- Coverage views (by goal/package/release)
- Impact analysis rules

### O. Releases & Variants
- Releases (rel-id)
- Requirement targeting (applies-to rel/env/variant)
- Feature flags/variants (variant-id)
- Compatibility rules (compat-id)

### P. Governance
- Issues (issue-id)
- Risks (risk-id)
- Decisions (decision-id)
- Approvals (approval-id)

### Q. Appendices / Examples
- Worked examples (scenario → requirements → tests)
- Sample payloads
- Checklists
