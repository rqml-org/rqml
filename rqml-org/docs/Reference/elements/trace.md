---
id: element-trace
title: trace
description: Traceability edges between artifacts.
---

## Summary
Optional section to record explicit trace links across the document and to external systems.

## Where it appears
- `rqml > trace`

## Content model
- `traceEdge` (0..n) → `notes` (0..1)

## Attributes

### traceEdge

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | IdType | yes | Edge identifier. |
| `type` | TraceType | yes | Relation type (see below). |
| `from` | IdType | no | Source element ID within document (keyref-validated). |
| `to` | IdType | no | Target element ID within document (keyref-validated). |
| `fromUri` | xs:anyURI | no | Source as external URI. |
| `toUri` | xs:anyURI | no | Target as external URI. |
| `confidence` | ConfidenceType | no | Certainty level (0.0–1.0). |
| `status` | StatusType | no | Lifecycle state (draft, review, approved, deprecated). |
| `createdBy` | xs:string | no | Who created this trace (person, role, or tool). |
| `createdAt` | xs:dateTime | no | When this trace was created (ISO 8601). |
| `tags` | xs:NMTOKENS | no | Space-separated category tags for filtering. |

**Endpoint rules:** At least one of `from` or `fromUri` should be specified, and at least one of `to` or `toUri`.

### TraceType values
| Value | Description |
| --- | --- |
| `refines` | Source refines/decomposes target. |
| `satisfies` | Source satisfies/fulfills target. |
| `dependsOn` | Source depends on target. |
| `conflictsWith` | Source conflicts with target. |
| `threatens` | Source threatens target (for obstacles/risks). |
| `mitigates` | Source mitigates target (for risks). |
| `verifiedBy` | Source is verified by target. |
| `covers` | Source covers target (for test coverage). |
| `implements` | Source implements target (for code traceability). |
| `supersedes` | Source replaces target (for deprecation/versioning). |

## Example (minimal)
```xml
<trace>
  <traceEdge id="TR-1" from="REQ-1" to="GOAL-1" type="satisfies"/>
</trace>
```

## Example (typical)
```xml
<trace>
  <traceEdge id="TR-001" from="REQ-AUTH-001" to="GOAL-AVAIL" type="satisfies" confidence="0.9">
    <notes>Primary requirement fulfilling availability goal for payments.</notes>
  </traceEdge>
  <traceEdge id="TR-002" from="TC-AUTH-001" to="REQ-AUTH-001" type="verifiedBy"/>
</trace>
```

## Example (external references)
```xml
<trace>
  <!-- Requirement implements a Jira story -->
  <traceEdge id="TR-010" from="REQ-AUTH-001" toUri="jira:PROJ-1234" type="implements"/>

  <!-- Code file implements a requirement -->
  <traceEdge id="TR-011" fromUri="file:src/auth/login.ts#L42-L87" to="REQ-AUTH-001" type="implements"/>

  <!-- Requirement satisfies a regulation -->
  <traceEdge id="TR-012" from="REQ-GDPR-001" toUri="urn:gdpr:article:17" type="satisfies"/>
</trace>
```

## Example (lifecycle metadata)
```xml
<trace>
  <traceEdge id="TR-020" from="REQ-AUTH-001" to="GOAL-SECURITY" type="satisfies"
             status="approved" createdBy="jane.doe" createdAt="2025-03-15T10:30:00Z"/>

  <traceEdge id="TR-021" from="REQ-API-001" to="GOAL-PERF" type="satisfies"
             status="draft" createdBy="import-jira" createdAt="2025-03-20T08:00:00Z"/>
</trace>
```

## Example (category tags)
```xml
<trace>
  <traceEdge id="TR-030" from="REQ-BRAKE-001" to="GOAL-SAFETY" type="satisfies"
             tags="safety"/>

  <traceEdge id="TR-031" from="REQ-AUTH-001" to="GOAL-SECURITY" type="satisfies"
             tags="security compliance"/>
</trace>
```

## Example (deprecation with supersedes)
```xml
<trace>
  <!-- New requirement supersedes deprecated one -->
  <traceEdge id="TR-040" from="REQ-AUTH-002" to="REQ-AUTH-001" type="supersedes">
    <notes>OAuth replaces password auth per security audit 2025-Q1.</notes>
  </traceEdge>
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
- Use `from`/`to` for internal elements (keyref-validated); use `fromUri`/`toUri` for external systems.
- Pick the most specific relation type; use `notes` for rationale when it is not obvious.
- Use `status=approved` to filter for reliable traces in impact analysis.
- Use `supersedes` when deprecating requirements; mark old requirement as `status="deprecated"`.
- Common tags: `safety`, `security`, `compliance`, `performance`, `accessibility`.
