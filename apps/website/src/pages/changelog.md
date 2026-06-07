---
title: Changelog
---

# Changelog

All notable changes to the RQML schema are documented here.

---

## 2.1.0
_February 2026_

### Trace redesign
- Renamed `traceEdge` to `edge` with structured endpoints (`from`/`to` containing `locator` elements)
- Added three locator types: `local` (same document), `doc` (cross-document), `external` (URI-based)
- Cross-document references support `version` and `git` pinning for immutability

### New TraceType values
- `consumesInterface` — source consumes interface provided by target
- `providesInterface` — source provides interface consumed by target
- `conformsTo` — source conforms to standard/specification target
- `deprecates` — source deprecates target
- `breaks` — source breaks backward compatibility with target

### Removed
- `RefType` and `RefsType` — inline `refs` elements removed from `scenario`, `req`, `transition`, `testCase`, `actor`, and `testSuite` (use trace edges instead)
- `fromUri` / `toUri` attributes on trace edges (replaced by `external` locator)

---

## 2.0.1
_December 2025_

Initial public release of the new LLM-first RQML schema.


---

## 1.0.0
_June 2000_

Original release of RQML - the first XML standard to capture software intent in a structured, machine-readable form - at the [University of York department of computer science](https://www.york.ac.uk/computer-science/). It was way ahead of its time.