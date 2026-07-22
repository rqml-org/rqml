---
id: reference-index
title: RQML Reference
sidebar_label: Reference
sidebar_position: 5
description: A–Z index of RQML elements and attributes, patterns, and versioning notes.
---

The current RQML schema is served at `/schema/rqml-2.2.0.xsd`. Use this page as an entry point to the element/attribute reference.

## Common patterns
- **IDs**: `IdType` tokens, 2–80 chars, start with a letter; allow letters, digits, `.`, `_`, `-`. Keep stable across revisions.
- **References**: `goalLink`, `edge` locators, and `testSuite/members` all point to existing IDs; the schema enforces this with keyrefs.
- **Trace endpoints**: `edge` elements use structured `locator` elements with `local` (same document, keyref-validated), `doc` (cross-document), or `external` (non-RQML URI) references.
- **Language**: Use clear, testable prose; avoid ambiguity. Text blocks allow mixed content for formatting.
- **Cardinality**: Required elements are noted in each element page; optional sections may be omitted entirely.

## Versioning
- Documents must set `rqml@version` to match the schema version, along with required `docId` and `status`.
- Validate with `xmllint --schema /path/to/rqml-x.y.z.xsd yourfile.rqml --noout`.

## Elements A–Z
### B
- [`behavior`](./elements/behavior.md)

### C
- [`catalogs`](./elements/catalogs.md)

### D
- [`domain`](./elements/domain.md)

### G
- [`goals`](./elements/goals.md)
- [`governance`](./elements/governance.md)

### I
- [`interfaces`](./elements/interfaces.md)

### M
- [`meta`](./elements/meta.md)

### R
- [`requirements`](./elements/requirements.md)
- [`rqml` (root)](./elements/rqml.md)

### S
- [`scenarios`](./elements/scenarios.md)

### T
- [`trace`](./elements/trace.md)

### V
- [`verification`](./elements/verification.md)

## Attributes A–Z
### A
- [`@appliesTo`](./elements/requirements.md#attributes)
- [`@auth`](./elements/interfaces.md#attributes)

### C
- [`@confidence`](./elements/trace.md#attributes)
- [`@createdAt`](./elements/trace.md#attributes)
- [`@createdBy`](./elements/trace.md#attributes)

### D
- [`@docId`](./elements/rqml.md#attributes)

### I
- [`@id`](./elements/rqml.md#attributes)

### M
- [`@method`](./elements/interfaces.md#attributes)

### O
- [`@ownerRef`](./elements/requirements.md#attributes)

### P
- [`@path`](./elements/interfaces.md#attributes)
- [`@priority`](./elements/goals.md#attributes)
- [`@protocol`](./elements/interfaces.md#attributes)

### S
- [`@status`](./elements/rqml.md#attributes)

### T
- [`@tags`](./elements/trace.md#attributes)
- [`@type`](./elements/requirements.md#attributes)

### V
- [`@version`](./elements/rqml.md#attributes)
