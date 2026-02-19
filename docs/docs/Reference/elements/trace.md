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
- `edge` (0..n) → `from` (1), `to` (1), `notes` (0..1)

Each endpoint (`from` / `to`) contains a `locator` with one of:
- `local` — reference by ID within this document
- `doc` — reference by ID in another RQML document
- `external` — reference by URI to any external artifact

## Attributes

### edge

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | IdType | yes | Edge identifier. |
| `type` | TraceType | yes | Relation type (see below). |
| `confidence` | ConfidenceType | no | Certainty level (0.0–1.0). |
| `status` | StatusType | no | Lifecycle state (draft, review, approved, deprecated). |
| `createdBy` | xs:string | no | Who created this trace (person, role, or tool). |
| `createdAt` | xs:dateTime | no | When this trace was created (ISO 8601). |
| `tags` | xs:NMTOKENS | no | Space-separated category tags for filtering. |

### Locator types

#### local
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | IdType | yes | Target element ID within this document (keyref-validated). |
| `kind` | xs:token | no | Hint for tooling/renderers (e.g., "req", "goal"). |
| `title` | xs:string | no | Display hint for tooling/renderers. |

#### doc
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `uri` | xs:anyURI | yes | URI of the other RQML document. |
| `id` | IdType | yes | Target element ID within that document. |
| `docId` | IdType | no | Document identifier of the other RQML document. |
| `version` | xs:token | no | Pin to a specific version for immutability. |
| `git` | xs:token | no | Pin to a Git ref (commit, tag, branch). |
| `kind` | xs:token | no | Hint for tooling/renderers. |
| `title` | xs:string | no | Display hint for tooling/renderers. |

#### external
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `uri` | xs:anyURI | yes | URI of the external artifact. |
| `kind` | xs:token | no | Hint for tooling/renderers. |
| `title` | xs:string | no | Display hint for tooling/renderers. |

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
  <edge id="TR-1" type="satisfies">
    <from><locator><local id="REQ-1"/></locator></from>
    <to><locator><local id="GOAL-1"/></locator></to>
  </edge>
</trace>
```

## Example (typical)
```xml
<trace>
  <edge id="TR-001" type="satisfies" confidence="0.9">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to><locator><local id="GOAL-AVAIL"/></locator></to>
    <notes>Primary requirement fulfilling availability goal for payments.</notes>
  </edge>
  <edge id="TR-002" type="verifiedBy">
    <from><locator><local id="TC-AUTH-001"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
  </edge>
</trace>
```

## Example (cross-document references)
```xml
<trace>
  <!-- Requirement in this document satisfies a goal in another RQML document -->
  <edge id="TR-010" type="satisfies">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to>
      <locator>
        <doc uri="goals.rqml" docId="DOC-GOALS" id="GOAL-SECURITY" version="2.0"/>
      </locator>
    </to>
  </edge>

  <!-- Pinned to a specific Git commit for immutability -->
  <edge id="TR-011" type="conformsTo">
    <from><locator><local id="REQ-API-001"/></locator></from>
    <to>
      <locator>
        <doc uri="contracts/api-spec.rqml" id="IR-REST-001" git="a1b2c3d"/>
      </locator>
    </to>
  </edge>
</trace>
```

## Example (external references)
```xml
<trace>
  <!-- Requirement implements a Jira story -->
  <edge id="TR-020" type="implements">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to><locator><external uri="jira:PROJ-1234" kind="issue" title="Login flow"/></locator></to>
  </edge>

  <!-- Code file implements a requirement -->
  <edge id="TR-021" type="implements">
    <from><locator><external uri="file:src/auth/login.ts#L42-L87"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
  </edge>

  <!-- Requirement satisfies a regulation -->
  <edge id="TR-022" type="satisfies">
    <from><locator><local id="REQ-GDPR-001"/></locator></from>
    <to><locator><external uri="urn:gdpr:article:17" kind="regulation"/></locator></to>
  </edge>
</trace>
```

## Example (lifecycle metadata)
```xml
<trace>
  <edge id="TR-030" type="satisfies"
        status="approved" createdBy="jane.doe" createdAt="2025-03-15T10:30:00Z">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to><locator><local id="GOAL-SECURITY"/></locator></to>
  </edge>

  <edge id="TR-031" type="satisfies"
        status="draft" createdBy="import-jira" createdAt="2025-03-20T08:00:00Z">
    <from><locator><local id="REQ-API-001"/></locator></from>
    <to><locator><local id="GOAL-PERF"/></locator></to>
  </edge>
</trace>
```

## Example (category tags)
```xml
<trace>
  <edge id="TR-040" type="satisfies" tags="safety">
    <from><locator><local id="REQ-BRAKE-001"/></locator></from>
    <to><locator><local id="GOAL-SAFETY"/></locator></to>
  </edge>

  <edge id="TR-041" type="satisfies" tags="security compliance">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to><locator><local id="GOAL-SECURITY"/></locator></to>
  </edge>
</trace>
```

## Example (deprecation with supersedes)
```xml
<trace>
  <!-- New requirement supersedes deprecated one -->
  <edge id="TR-050" type="supersedes">
    <from><locator><local id="REQ-AUTH-002"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
    <notes>OAuth replaces password auth per security audit 2025-Q1.</notes>
  </edge>
</trace>
```

## Example (contract semantics — new in 2.1.0)
```xml
<trace>
  <!-- Service consumes an interface defined elsewhere -->
  <edge id="TR-060" type="consumesInterface">
    <from><locator><local id="REQ-CHECKOUT-001"/></locator></from>
    <to><locator><local id="API-PAYMENTS"/></locator></to>
  </edge>

  <!-- Service provides an interface for consumers -->
  <edge id="TR-061" type="providesInterface">
    <from><locator><local id="REQ-API-001"/></locator></from>
    <to><locator><local id="EP-CREATE-PAYMENT"/></locator></to>
  </edge>

  <!-- Requirement conforms to an external standard -->
  <edge id="TR-062" type="conformsTo">
    <from><locator><local id="REQ-CRYPTO-001"/></locator></from>
    <to><locator><external uri="urn:nist:fips:140-3" kind="standard"/></locator></to>
  </edge>
</trace>
```

## Example (change management — new in 2.1.0)
```xml
<trace>
  <!-- New API version deprecates old one -->
  <edge id="TR-070" type="deprecates">
    <from><locator><local id="REQ-API-V2"/></locator></from>
    <to><locator><local id="REQ-API-V1"/></locator></to>
    <notes>v2 deprecates v1; v1 sunset date 2026-06-01.</notes>
  </edge>

  <!-- Breaking change: new auth flow breaks old client integration -->
  <edge id="TR-071" type="breaks">
    <from><locator><local id="REQ-AUTH-003"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
    <notes>PKCE-only flow removes implicit grant; clients must migrate.</notes>
  </edge>
</trace>
```

## URI conventions for external references
| System | Pattern | Example |
| --- | --- | --- |
| Jira | `jira:{issue-key}` | `jira:PROJ-1234` |
| GitHub Issue | `github:{owner}/{repo}/issues/{num}` | `github:acme/api/issues/42` |
| GitHub PR | `github:{owner}/{repo}/pull/{num}` | `github:acme/api/pull/99` |
| Git commit | `git:{sha}` | `git:a1b2c3d4e5f6` |
| File + lines | `file:{path}#L{start}-L{end}` | `file:src/auth.ts#L42-L87` |
| Confluence | `confluence:{page-id}` | `confluence:12345678` |
| Regulation | `urn:{standard}:{clause}` | `urn:gdpr:article:17` |

## Notes / LLM hints
- Use `local` locators for same-document references (keyref-validated); use `doc` for cross-RQML-document references; use `external` for non-RQML systems.
- Pick the most specific relation type; use `notes` for rationale when it is not obvious.
- Use `status=approved` to filter for reliable traces in impact analysis.
- Use `supersedes` when deprecating requirements; mark old requirement as `status="deprecated"`.
- Use `deprecates` and `breaks` to record change-management semantics explicitly.
- Use `consumesInterface` / `providesInterface` / `conformsTo` for cross-project and contract-based traceability.
- Common tags: `safety`, `security`, `compliance`, `performance`, `accessibility`.
- The `doc` locator supports `version` and `git` attributes for pinning cross-document references to immutable snapshots.
