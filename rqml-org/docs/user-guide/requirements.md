---
id: requirements
title: Requirements
sidebar_position: 6
description: Author normative requirements, packages, and acceptance criteria.
---

The `requirements` section is required and holds the core normative content.

## Structure
- `reqPackage`: Optional grouping container with `@id`, `title`, optional `ownerRef`, optional `description`, and nested `req` items.
- `req`: Individual requirement with attributes:
  - `@id` (`IdType`, unique within document)
  - `@type` (one of `FR`, `NFR`, `IR`, `DR`, `SR`, `CR`, `PR`, `UXR`, `OR`)
  - `@title` (human-readable)
  - Optional `status`, `priority`, `ownerRef`, `appliesTo`
  - Children: `statement` (required), optional `rationale`, `notes`, `acceptance`, `refs`.
- `acceptance`: Contains one or more `criterion` entries, each with optional `@id` and `given`/`when`/`then` text blocks.

## Authoring tips
- Keep `statement` crisp and testable; use `acceptance` to express BDD-style criteria when needed.
- Reuse `@id` references from catalogs, domain entities, and goals via `refs` or `appliesTo`.
- Use `priority` to distinguish `must/should/may` and `status` to track lifecycle (`draft/review/approved/deprecated`).
- Group related requirements into `reqPackage` to clarify ownership and scope.

## Example
```xml
<requirements>
  <reqPackage id="PKG-AUTH" title="Authorization" ownerRef="STK-RISK">
    <description>Payment authorization flow</description>
    <req id="REQ-AUTH-001" type="FR" title="Authorize payment" priority="must">
      <statement>The system SHALL authorize card payments via the acquiring bank.</statement>
      <rationale>Enable online checkout for merchants.</rationale>
      <acceptance>
        <criterion id="CRIT-1">
          <given>An authenticated merchant requests authorization</given>
          <when>The acquirer responds with approval</when>
          <then>The payment is marked authorized with paymentId</then>
        </criterion>
      </acceptance>
      <refs>
        <ref ref="GOAL-AVAIL"/>
        <ref ref="SCN-CHECKOUT"/>
      </refs>
    </req>
  </reqPackage>
</requirements>
```

## Theory
- Requirements should be necessary, verifiable, unambiguous, and feasible (IEEE 29148 qualities).
- Categorizing by type (FR/NFR/etc.) aligns with classic RE taxonomies; acceptance criteria make requirements testable (BDD/Gherkin influence).
- Packaging requirements aids scoping and ownership, echoing Volere and disciplined backlog management.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [Specification by Example](https://www.manning.com/books/specification-by-example), [Volere Template](http://www.volere.org/template.htm).
