---
id: rqml-schema-2-0-1
title: RQML Schema 2.0.1
sidebar_position: 2
---

This page documents RQML schema version 2.0.1 (located at `static/schema/rqml-2.0.1.xsd`, served from `/schema/rqml-2.0.1.xsd` at build time).

## Overview
- Root element `rqml` (type `RqmlDocumentType`) with required `version="2.0.1"`, `docId`, and `status`.
- Global key enforces unique `@id` values across the document; `traceEdge` `from`/`to` attributes must reference existing IDs.

## Meta & Conventions
- `meta` requires `title` and `system`; optional `summary`, `authors` (with name/role/org/contact), `dates`, `conventions`, and `profiles` (each with `@id` and `@type`).
- `IdType` allows human-friendly tokens (e.g., `REQ-LOGIN-001`, `GOAL_AUTH_01`), 2–80 chars, starting with a letter. Status values: `draft`, `review`, `approved`, `deprecated`. Priorities: `must`, `should`, `may`.

## Catalogs, Domain, and Goals
- Optional catalogs: `glossary` (terms with definitions and optional synonyms), `actors`, `stakeholders`, `constraints`, `policies`, `decisions`, `risks`.
- Domain model: `entities` with attributes (`type`, `required`, optional constraints) and `businessRules`.
- Goals: functional (`goal`), quality (`qgoal`), obstacles, and `goalLink` edges using `TraceType` with optional `confidence`.

## Scenarios, Requirements, and Interfaces
- Scenarios: `scenario`, `misuseCase`, `edgeCase` share `@id`, `title`, `narrative`, optional `actorRef` and `refs`.
- Requirements: `requirements` container holds `reqPackage` groups and `req` items. Each requirement has `@id`, `type` (FR/NFR/IR/DR/SR/CR/PR/UXR/OR), `title`, optional `status/priority/ownerRef/appliesTo`, plus `statement`, optional `rationale/notes`, `acceptance` criteria (Given/When/Then elements), and `refs`.
- Interfaces: `api` definitions with `endpoint` children (`@method`, `@path`, optional request/response/errors) and `event` definitions with payload descriptions.

## Verification, Trace, and Governance
- Verification: `testSuite` (with member refs) and `testCase` (`@type` acceptance/integration/unit/security/performance/inspection, plus purpose/steps/expected/refs).
- Traceability: `traceEdge` elements connect any two IDs with a typed relation (`refines`, `satisfies`, `dependsOn`, `conflictsWith`, `threatens`, `mitigates`, `verifiedBy`, `covers`, `implements`).
- Governance: `issue` and `approval` items carry IDs, statuses, roles, and descriptive text.


