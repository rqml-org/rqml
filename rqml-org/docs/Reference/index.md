---
id: reference-index
title: RQML Reference
sidebar_label: Reference
sidebar_position: 5
description: A–Z index of RQML 2.0.1 elements and attributes, patterns, and versioning notes.
---

RQML schema version **2.0.1** is defined in `static/schema/rqml-2.0.1.xsd` (served at `/schema/rqml-2.0.1.xsd`). Use this page as an entry point to the element/attribute reference.

## Common patterns
- **IDs**: `IdType` tokens, 2–80 chars, start with a letter; allow letters, digits, `.`, `_`, `-`. Keep stable across revisions.
- **References**: `ref`, `goalLink`, `traceEdge`, and `refs` collections all point to existing IDs; the schema enforces this with keyrefs.
- **Language**: Use clear, testable prose; avoid ambiguity. Text blocks allow mixed content for formatting.
- **Cardinality**: Required elements are noted in each element page; optional sections may be omitted entirely.

## Versioning
- Documents set `rqml@version="2.0.1"` (fixed), along with required `docId` and `status`.
- Schema path: `/schema/rqml-2.0.1.xsd`. Validate with `xmllint --schema static/schema/rqml-2.0.1.xsd yourfile.xml --noout`.

## Elements A–Z
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

### D
- [`@docId`](./elements/rqml.md#attributes)

### F
- [`@from`](./elements/trace.md#attributes)

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
- [`@type`](./elements/requirements.md#attributes)
- [`@to`](./elements/trace.md#attributes)

### V
- [`@version`](./elements/rqml.md#attributes)
