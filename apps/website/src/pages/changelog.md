---
title: Changelog
---

# Changelog

All notable changes to the RQML schema are documented here.

---

## 2.2.0
_July 2026_

### Compact trace edges (breaking)
Trace edge endpoints move from nested elements to `from` / `to` attributes. The `locator`, `local`, `doc`, and `external` elements are removed.

```xml
<!-- 2.1.0 -->
<edge id="TR-001" type="satisfies">
  <from><locator><local id="REQ-A"/></locator></from>
  <to><locator><local id="GOAL-B"/></locator></to>
</edge>

<!-- 2.2.0 -->
<edge id="TR-001" type="satisfies" from="REQ-A" to="GOAL-B"/>
```

The three endpoint kinds are unchanged in meaning; the kind is now inferred from the value's shape:

- a bare id is **local** — `REQ-A`
- an `rqml:` URI is a **cross-document** reference — `rqml:goals.rqml#GOAL-B;version=2.0`
- any other scheme URI, or a relative path containing `/`, is **external** — `jira:PROJ-1`, `src/auth.ts`

The locator's `kind` and `title` hints become per-side `fromKind` / `fromTitle` / `toKind` / `toTitle` attributes. `confidence`, `status`, `createdBy`, `createdAt`, `tags`, and `<notes>` are unchanged.

No other part of the schema changed, and no functionality was added or removed — this release is a serialization change only. It shrinks the trace section by about 40%; how much that saves overall depends on how trace-heavy the document is (7–13% of total bytes on the specs we measured).

### Migrating
`rqml migrate` rewrites a 2.0.1 or 2.1.0 document in place; `--dry-run` previews it. See the [Migration guide](/docs/migration).

### Fixed
- The XSD's `allIds` identity constraint used an unprefixed selector, so it never fired. Its selector is namespace-qualified in 2.2.0, and duplicate ids are now caught.
- The inert trace keyrefs are removed. Endpoint integrity is enforced by the processor — `rqml validate` — since XSD 1.0 cannot express the endpoint grammar.

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