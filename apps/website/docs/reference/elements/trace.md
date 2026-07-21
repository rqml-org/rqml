---
id: element-trace
title: trace
description: Traceability edges between artifacts.
---

## Summary
Optional section to record explicit trace links across the document, to other RQML documents, and to external systems.

## Where it appears
- `rqml > trace`

## Content model
- `edge` (0..n) → `notes` (0..1)

Each edge carries its two endpoints as the required `from` and `to` **attributes**, written in the `TraceEndpointRef` micro-syntax below. Since 2.2.0 there are no endpoint child elements; a document conforming to 2.1.0 or earlier uses a nested `from`/`to` → `locator` → `local`/`doc`/`external` tree instead, and is upgraded with `rqml migrate`.

## Attributes

### edge

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | IdType | yes | Edge identifier. |
| `type` | TraceType | yes | Relation type (see below). |
| `from` | TraceEndpointRef | yes | Source endpoint. |
| `to` | TraceEndpointRef | yes | Target endpoint. |
| `fromKind` | xs:token | no | Category hint for the source (e.g. "req", "code"). |
| `fromTitle` | xs:string | no | Display hint for the source. |
| `toKind` | xs:token | no | Category hint for the target. |
| `toTitle` | xs:string | no | Display hint for the target. |
| `confidence` | ConfidenceType | no | Certainty level (0.0–1.0). Plain decimal — `xs:decimal` rejects exponential notation such as `1e-7`. |
| `status` | StatusType | no | Lifecycle state (draft, review, approved, deprecated). |
| `createdBy` | xs:string | no | Who created this trace (person, role, or tool). |
| `createdAt` | xs:dateTime | no | When this trace was created (ISO 8601). |
| `tags` | xs:NMTOKENS | no | Space-separated category tags for filtering. |

### TraceEndpointRef

A union of three lexical shapes. The kind is determined by the value, tested in this order:

| Kind | Member type | Pattern | Example |
| --- | --- | --- | --- |
| doc | `TraceSchemeRef` | `rqml:` + document URI + `#` + id, then optional pins | `rqml:goals.rqml#GOAL-SEC;version=2.0` |
| external | `TraceSchemeRef` | Any other scheme URI: `[A-Za-z][A-Za-z0-9+.-]*:.+` | `jira:PROJ-1234` |
| external | `TracePathRef` | Schemeless relative path, at least one `/`, no whitespace: `[^:\s]+/[^\s]*` | `src/auth/login.ts#L42` |
| local | `TraceLocalRef` | Bare id: `[A-Za-z][A-Za-z0-9._-]{1,79}` | `REQ-AUTH-001` |

XSD 1.0 has no negative lookahead, so `TraceSchemeRef` cannot exclude the `rqml:` prefix at the schema level. The XSD therefore accepts any scheme URI, and the **processor** distinguishes doc from external and enforces the fragment and pin rules. Schema validity alone is not conformance — run `rqml validate`, which layers referential integrity on top of the XSD.

#### doc endpoint pins

`rqml:<document-uri>#<id>[;version=V][;git=SHA][;docId=D]`

| Pin | Description |
| --- | --- |
| `version` | Pin to a specific released version of the target document. |
| `git` | Pin to a Git ref (commit, tag, branch). |
| `docId` | The target document's `docId`, recorded for verification. |

The value is split at the **last** `#`, so the document URI may itself contain `#`. Each pin may appear at most once, and a pin value may not contain `;`, `#`, or whitespace. An `rqml:` value with no `#<id>` fragment, an unknown pin, or a malformed target id is rejected by the processor.

#### Path endpoints in the repository root

A schemeless value with no `/` matches `TraceLocalRef`, so it would be read as a local id. Prefix such a path with `./` — `./README.md` — to place it in `TracePathRef`. The `./` is syntactic armor: it is stripped when the value is parsed and is not part of the recorded path. `rqml link` applies it automatically.

### TraceType values
| Value | Category | Description |
| --- | --- | --- |
| `refines` | Decomposition | Source refines/decomposes target. |
| `satisfies` | Coverage | Source satisfies/fulfills target. |
| `dependsOn` | Dependency | Source depends on target. |
| `conflictsWith` | Conflict | Source conflicts with target. |
| `threatens` | Risk | Source threatens target (for obstacles/risks). |
| `mitigates` | Risk | Source mitigates target (for risks). |
| `verifiedBy` | Verification | Source is verified by target. |
| `covers` | Coverage | Source covers target (for test coverage). |
| `implements` | Implementation | Source implements target (for code traceability). |
| `supersedes` | Lifecycle | Source replaces target (for deprecation/versioning). |
| `consumesInterface` | Contract | Source consumes interface provided by target. |
| `providesInterface` | Contract | Source provides interface consumed by target. |
| `conformsTo` | Contract | Source conforms to standard/specification target. |
| `deprecates` | Change management | Source deprecates target. |
| `breaks` | Change management | Source breaks backward compatibility with target. |

## Example (minimal — local references)
```xml
<trace>
  <edge id="TR-1" type="satisfies" from="REQ-1" to="GOAL-1"/>
</trace>
```

## Example (typical)
```xml
<trace>
  <edge id="TR-001" type="satisfies" from="REQ-AUTH-001" to="GOAL-AVAIL" confidence="0.9">
    <notes>Primary requirement fulfilling availability goal for payments.</notes>
  </edge>
  <edge id="TR-002" type="verifiedBy" from="TC-AUTH-001" to="REQ-AUTH-001"/>
</trace>
```

## Example (cross-document references)
```xml
<trace>
  <!-- Requirement in this document satisfies a goal in another RQML document -->
  <edge id="TR-010" type="satisfies" from="REQ-AUTH-001"
        to="rqml:goals.rqml#GOAL-SECURITY;version=2.0;docId=DOC-GOALS"/>

  <!-- Pinned to a specific Git commit for immutability -->
  <edge id="TR-011" type="conformsTo" from="REQ-API-001"
        to="rqml:contracts/api-spec.rqml#IR-REST-001;git=a1b2c3d"/>
</trace>
```

## Example (external references)
```xml
<trace>
  <!-- Requirement implements a Jira story -->
  <edge id="TR-020" type="implements" from="REQ-AUTH-001"
        to="jira:PROJ-1234" toKind="issue" toTitle="Login flow"/>

  <!-- Code file implements a requirement (repo-relative path) -->
  <edge id="TR-021" type="implements" from="src/auth/login.ts#L42-L87"
        fromKind="code" to="REQ-AUTH-001"/>

  <!-- Requirement satisfies a regulation -->
  <edge id="TR-022" type="satisfies" from="REQ-GDPR-001"
        to="urn:gdpr:article:17" toKind="regulation"/>
</trace>
```

## Example (lifecycle metadata)
```xml
<trace>
  <edge id="TR-030" type="satisfies" from="REQ-AUTH-001" to="GOAL-SECURITY"
        status="approved" createdBy="jane.doe" createdAt="2025-03-15T10:30:00Z"/>

  <edge id="TR-031" type="satisfies" from="REQ-API-001" to="GOAL-PERF"
        status="draft" createdBy="import-jira" createdAt="2025-03-20T08:00:00Z"/>
</trace>
```

## Example (category tags)
```xml
<trace>
  <edge id="TR-040" type="satisfies" from="REQ-BRAKE-001" to="GOAL-SAFETY" tags="safety"/>

  <edge id="TR-041" type="satisfies" from="REQ-AUTH-001" to="GOAL-SECURITY"
        tags="security compliance"/>
</trace>
```

## Example (deprecation with supersedes)
```xml
<trace>
  <!-- New requirement supersedes deprecated one -->
  <edge id="TR-050" type="supersedes" from="REQ-AUTH-002" to="REQ-AUTH-001">
    <notes>OAuth replaces password auth per security audit 2025-Q1.</notes>
  </edge>
</trace>
```

## Example (contract semantics — new in 2.1.0)
```xml
<trace>
  <!-- Service consumes an interface defined elsewhere -->
  <edge id="TR-060" type="consumesInterface" from="REQ-CHECKOUT-001" to="API-PAYMENTS"/>

  <!-- Service provides an interface for consumers -->
  <edge id="TR-061" type="providesInterface" from="REQ-API-001" to="EP-CREATE-PAYMENT"/>

  <!-- Requirement conforms to an external standard -->
  <edge id="TR-062" type="conformsTo" from="REQ-CRYPTO-001"
        to="urn:nist:fips:140-3" toKind="standard"/>
</trace>
```

## Example (change management — new in 2.1.0)
```xml
<trace>
  <!-- New API version deprecates old one -->
  <edge id="TR-070" type="deprecates" from="REQ-API-V2" to="REQ-API-V1">
    <notes>v2 deprecates v1; v1 sunset date 2026-06-01.</notes>
  </edge>

  <!-- Breaking change: new auth flow breaks old client integration -->
  <edge id="TR-071" type="breaks" from="REQ-AUTH-003" to="REQ-AUTH-001">
    <notes>PKCE-only flow removes implicit grant; clients must migrate.</notes>
  </edge>
</trace>
```

## URI conventions for external references
| System | Pattern | Example |
| --- | --- | --- |
| Repo file | `{path}` (must contain `/`) | `src/auth/login.ts#L42-L87` |
| Jira | `jira:{issue-key}` | `jira:PROJ-1234` |
| GitHub Issue | `github:{owner}/{repo}/issues/{num}` | `github:acme/api/issues/42` |
| GitHub PR | `github:{owner}/{repo}/pull/{num}` | `github:acme/api/pull/99` |
| Git commit | `git:{sha}` | `git:a1b2c3d4e5f6` |
| File + lines | `file:{path}#L{start}-L{end}` | `file:src/auth.ts#L42-L87` |
| Confluence | `confluence:{page-id}` | `confluence:12345678` |
| Regulation | `urn:{standard}:{clause}` | `urn:gdpr:article:17` |

## Notes / LLM hints
- Record edges with `rqml link <from> <to> --type <type>` rather than writing them by hand: it emits the serialization the document's schema version requires and records the drift baseline in the same step. It accepts all fifteen trace types.
- Use a bare id for same-document references (checked against declared ids); use an `rqml:` endpoint for cross-RQML-document references; use a URI or repo-relative path for non-RQML systems.
- Pick the most specific relation type; use `notes` for rationale when it is not obvious.
- Use `status=approved` to filter for reliable traces in impact analysis.
- Use `supersedes` when deprecating requirements; mark old requirement as `status="deprecated"`.
- Use `deprecates` and `breaks` to record change-management semantics explicitly.
- Use `consumesInterface` / `providesInterface` / `conformsTo` for cross-project and contract-based traceability.
- Common tags: `safety`, `security`, `compliance`, `performance`, `accessibility`.
- A `rqml:` endpoint supports `version` and `git` pins for tying cross-document references to immutable snapshots.
