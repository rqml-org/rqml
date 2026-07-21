---
id: trace
title: Trace
sidebar_position: 10
description: Connect goals, scenarios, requirements, interfaces, and tests.
---

The optional `trace` section encodes explicit relationships between artifacts to support impact analysis and coverage.

## Elements
- `edge`: Each edge has `@id`, `@type`, the required endpoints `@from` and `@to`, optional `confidence` (0.0–1.0), optional lifecycle metadata, optional `tags`, and an optional `notes` child.
- Endpoints are **attribute values**, written in a compact micro-syntax: the shape of the value determines whether it is a local, cross-document, or external reference.
- `type` uses `TraceType` enumeration: `refines`, `satisfies`, `dependsOn`, `conflictsWith`, `threatens`, `mitigates`, `verifiedBy`, `covers`, `implements`, `supersedes`, `consumesInterface`, `providesInterface`, `conformsTo`, `deprecates`, `breaks`.

:::note Schema 2.2.0 changed how endpoints are written
Through 2.1.0 an endpoint was a nested element tree — `<from><locator><local id="REQ-A"/></locator></from>`. Since 2.2.0 the same three kinds are expressed as `from` / `to` attribute values, and the nested elements are gone. Nothing about the *meaning* of an edge changed; only its serialization did. Run `rqml migrate` to rewrite an older spec (`--dry-run` previews it first).
:::

### Endpoint kinds

The endpoint kind is inferred from the value, in this order:

| Kind | Value shape | Example | Validation |
|------|-------------|---------|------------|
| local | A bare id: starts with a letter, then letters/digits/`.`/`_`/`-` (2–80 chars) | `REQ-AUTH-001` | Checked against the ids declared in this document |
| doc | `rqml:` + document URI + `#` + target id, plus optional pins | `rqml:goals.rqml#GOAL-SECURITY;version=2.0` | Shape checked; the target document is not resolved |
| external | Any other scheme URI, **or** a schemeless relative path containing `/` | `jira:PROJ-1234`, `src/auth/login.ts#L42` | Not validated |

Because a local id can never contain `:` or `/`, the three shapes are unambiguous.

### Writing endpoints

Record edges with the CLI rather than by hand — it emits the right serialization for whatever schema version your spec declares, and stores the drift baseline in the same step:

```bash
rqml link REQ-AUTH-001 GOAL-AVAIL --type satisfies
rqml link REQ-AUTH-001 src/auth/login.ts            # implements (default)
rqml link REQ-AUTH-001 test/auth.spec.ts --type verifiedBy
```

`rqml link` accepts all fifteen trace types and the `--notes`, `--confidence`, `--tags`, `--by`, and `--status` flags.

### Cross-document pins

A `rqml:` endpoint may carry immutability pins after the target id, each introduced by `;`:

| Pin | Meaning |
|-----|---------|
| `version` | Pin to a released version of the other document |
| `git` | Pin to a Git ref (commit, tag, branch) |
| `docId` | The other document's `docId`, recorded for verification |

```
rqml:contracts/api-spec.rqml#IR-REST-001;git=a1b2c3d;docId=DOC-API
```

The value is split at the **last** `#`, so a document URI may itself contain `#`. Pin values may not contain `;`, `#`, or whitespace.

### Endpoint hints
| Attribute | Purpose |
|-----------|---------|
| `fromKind` / `toKind` | Category hint for that endpoint (e.g. `code`, `test`, `standard`) |
| `fromTitle` / `toTitle` | Human-readable title hint for tooling and renderers |

Hints are advisory: they let a renderer label an endpoint without resolving it.

### Lifecycle metadata
| Attribute | Type | Purpose |
|-----------|------|---------|
| `status` | StatusType | Lifecycle state: `draft`, `review`, `approved`, `deprecated` |
| `createdBy` | string | Who created this trace (person, role, or tool) |
| `createdAt` | dateTime | When this trace was created (ISO 8601) |

Use lifecycle metadata to track trace provenance and filter by reliability:
- `draft` - auto-generated or tentative traces awaiting verification
- `review` - traces under stakeholder review
- `approved` - confirmed traces for reliable impact analysis
- `deprecated` - traces no longer valid but kept for audit history

### Categorization
| Attribute | Type | Purpose |
|-----------|------|---------|
| `tags` | NMTOKENS | Space-separated category tags for filtering |

Use tags to categorize traces for domain-specific filtering and reporting:

| Tag | Domain | Standards |
|-----|--------|-----------|
| `safety` | Functional safety | IEC 61508, ISO 26262 |
| `security` | Information security | ISO 27001, OWASP |
| `compliance` | Regulatory compliance | GDPR, HIPAA, SOX |
| `performance` | Performance requirements | - |
| `accessibility` | Accessibility | WCAG |

Custom tags can be added for project-specific concerns. A trace can have multiple tags: `tags="safety compliance"`.

## Authoring tips
- Use a bare id for same-document references; the toolchain checks these against the ids you declared.
- Use an `rqml:` endpoint to trace into another RQML document—pin with `version` or `git` for immutability.
- Use a URI or repo-relative path to trace to non-RQML systems (Jira, Git, files, regulations).
- Choose the most specific relation type; prefer `satisfies` for requirement coverage and `mitigates` for risk handling.
- Keep `notes` concise to explain rationale or scope boundaries for the link.
- Use `consumesInterface` / `providesInterface` to model cross-project API contracts.
- Use `conformsTo` to link requirements to external standards and specifications.
- Use `deprecates` and `breaks` to explicitly record change-management impacts.

## Example
```xml
<trace>
  <edge id="TR-001" type="satisfies" from="REQ-AUTH-001" to="GOAL-AVAIL" confidence="0.9">
    <notes>Primary requirement fulfilling availability goal for payments.</notes>
  </edge>
  <edge id="TR-002" type="verifiedBy" from="TC-AUTH-001" to="REQ-AUTH-001"/>
  <edge id="TR-003" type="threatens" from="OBS-DB" to="GOAL-AVAIL"/>
</trace>
```

### With lifecycle metadata
```xml
<trace>
  <!-- Approved trace with full audit trail -->
  <edge id="TR-001" type="satisfies" from="REQ-AUTH-001" to="GOAL-AVAIL"
        status="approved" createdBy="jane.doe" createdAt="2025-03-15T10:30:00Z">
    <notes>Verified in design review DR-2025-03.</notes>
  </edge>

  <!-- Auto-generated trace pending review -->
  <edge id="TR-002" type="satisfies" from="REQ-API-001" to="GOAL-PERF"
        status="draft" createdBy="import-jira" createdAt="2025-03-20T08:00:00Z"/>

  <!-- Deprecated trace kept for history -->
  <edge id="TR-003" type="satisfies" from="REQ-OLD-001" to="GOAL-SECURITY"
        status="deprecated" createdBy="john.smith" createdAt="2024-01-10T14:00:00Z">
    <notes>Superseded by REQ-AUTH-002 after security audit.</notes>
  </edge>
</trace>
```

### With category tags
```xml
<trace>
  <!-- Safety-critical trace for automotive system -->
  <edge id="TR-020" type="satisfies" from="REQ-BRAKE-001" to="GOAL-SAFETY"
        tags="safety" status="approved"/>

  <!-- Security trace for authentication -->
  <edge id="TR-021" type="satisfies" from="REQ-AUTH-001" to="GOAL-SECURITY"
        tags="security compliance"/>

  <!-- Multi-domain trace: safety and compliance -->
  <edge id="TR-022" type="satisfies" from="REQ-AUDIT-001" to="GOAL-COMPLIANCE"
        tags="safety security compliance">
    <notes>Required for both ISO 26262 and SOX compliance.</notes>
  </edge>

  <!-- Performance trace -->
  <edge id="TR-023" type="satisfies" from="REQ-PERF-001" to="GOAL-PERF"
        tags="performance"/>
</trace>
```

### Deprecation with supersedes
When replacing a requirement, mark the old one as deprecated and link with `supersedes`:
```xml
<!-- In requirements section -->
<req id="REQ-AUTH-001" type="FR" title="Password authentication" status="deprecated">
  <statement>The system shall authenticate users via username and password.</statement>
  <notes>Deprecated 2025-03-15. See REQ-AUTH-002.</notes>
</req>
<req id="REQ-AUTH-002" type="FR" title="OAuth authentication" status="approved">
  <statement>The system shall authenticate users via OAuth 2.0 with PKCE.</statement>
</req>

<!-- In trace section -->
<trace>
  <edge id="TR-050" type="supersedes" from="REQ-AUTH-002" to="REQ-AUTH-001">
    <notes>OAuth replaces password auth per security audit 2025-Q1.</notes>
  </edge>
</trace>
```

### Contract semantics (new in 2.1.0)
Use `consumesInterface`, `providesInterface`, and `conformsTo` for cross-project and standards-based traceability:
```xml
<trace>
  <!-- Service consumes an API defined in this document -->
  <edge id="TR-060" type="consumesInterface" from="REQ-CHECKOUT-001" to="API-PAYMENTS"/>

  <!-- Service provides an endpoint for consumers -->
  <edge id="TR-061" type="providesInterface" from="REQ-API-001" to="EP-CREATE-PAYMENT"/>

  <!-- Requirement conforms to an external standard -->
  <edge id="TR-062" type="conformsTo" from="REQ-CRYPTO-001"
        to="urn:nist:fips:140-3" toKind="standard"/>

  <!-- Cross-document interface contract -->
  <edge id="TR-063" type="consumesInterface" from="REQ-CHECKOUT-001"
        to="rqml:payments-api.rqml#EP-CHARGE;version=1.2;docId=DOC-PAY-API"/>
</trace>
```

### Change management (new in 2.1.0)
Use `deprecates` and `breaks` to record change impacts explicitly:
```xml
<trace>
  <!-- New API version deprecates old one -->
  <edge id="TR-070" type="deprecates" from="REQ-API-V2" to="REQ-API-V1">
    <notes>v2 deprecates v1; v1 sunset date 2026-06-01.</notes>
  </edge>

  <!-- Breaking change -->
  <edge id="TR-071" type="breaks" from="REQ-AUTH-003" to="REQ-AUTH-001">
    <notes>PKCE-only flow removes implicit grant; clients must migrate.</notes>
  </edge>
</trace>
```

## Cross-document references

An `rqml:` endpoint traces between separate RQML documents. Use `version` or `git` to pin references for immutability.

```xml
<trace>
  <!-- Reference a goal in another RQML document -->
  <edge id="TR-080" type="satisfies" from="REQ-AUTH-001"
        to="rqml:goals.rqml#GOAL-SECURITY;version=2.0;docId=DOC-GOALS"/>

  <!-- Pinned to a specific Git commit -->
  <edge id="TR-081" type="conformsTo" from="REQ-API-001"
        to="rqml:contracts/api-spec.rqml#IR-REST-001;git=a1b2c3d"/>
</trace>
```

This is the **only** way information crosses a spec boundary. Where a spec file sits determines what it governs, never what it can reference — see the [Monorepo guide](/docs/monorepo).

## External references

External references enable tracing between RQML artifacts and external systems like issue trackers, version control, code files, and regulatory documents.

### External reference examples
```xml
<trace>
  <!-- Requirement implements a Jira story -->
  <edge id="TR-010" type="implements" from="REQ-AUTH-001"
        to="jira:PROJ-1234" toKind="issue" toTitle="Login flow"/>

  <!-- Git commit implements a requirement -->
  <edge id="TR-011" type="implements" from="git:a1b2c3d4e5f6" to="REQ-AUTH-001"/>

  <!-- Code file implements a requirement (repo-relative path) -->
  <edge id="TR-012" type="implements" from="src/auth/login.ts#L42-L87" to="REQ-AUTH-001"/>

  <!-- Requirement satisfies a GDPR article -->
  <edge id="TR-013" type="satisfies" from="REQ-GDPR-001"
        to="urn:gdpr:article:17" toKind="regulation"/>

  <!-- External Confluence doc refines a goal -->
  <edge id="TR-014" type="refines" from="confluence:12345678" to="GOAL-SECURITY"/>

  <!-- GitHub PR implements multiple requirements -->
  <edge id="TR-015" type="implements" from="github:acme/api/pull/99" to="REQ-API-001"/>
</trace>
```

### URI conventions
| System | Pattern | Example |
|--------|---------|---------|
| Repo file | `{path}` (must contain `/`) | `src/auth/login.ts#L42-L87` |
| Jira | `jira:{issue-key}` | `jira:PROJ-1234` |
| GitHub Issue | `github:{owner}/{repo}/issues/{num}` | `github:acme/api/issues/42` |
| GitHub PR | `github:{owner}/{repo}/pull/{num}` | `github:acme/api/pull/99` |
| Git commit | `git:{sha}` | `git:a1b2c3d4e5f6` |
| File + lines | `file:{path}#L{start}-L{end}` | `file:src/auth.ts#L42-L87` |
| Confluence | `confluence:{page-id}` | `confluence:12345678` |
| Regulation | `urn:{standard}:{clause}` | `urn:gdpr:article:17` |
| Full URL | Standard URL | `https://jira.example.com/browse/PROJ-1234` |

These conventions are recommendations; any valid URI is accepted by the schema.

:::caution A path in the repository root needs `./`
A schemeless value with no `/` — `README.md`, `Makefile` — has the same shape as a local id and would be read as one. Write it as `./README.md` so it is unambiguously a path. `rqml link` adds this for you; the `./` is syntax only and is not part of the recorded path.
:::

## Code generation examples

LLMs use trace edges to generate traceability artifacts and impact analysis code:

**Traceability comments in code:**
```typescript
// Implements REQ-AUTH-001 (satisfies GOAL-AVAIL per TR-001)
// Verified by TC-AUTH-001 (per TR-002)
export class PaymentAuthService {
  async authorizePayment(req: AuthRequest): Promise<Payment> {
    const authResult = await this.acquirer.authorize(req);
    return this.createPayment(authResult);
  }
}
```

**Impact analysis query tool:**
```typescript
// From trace graph: find all artifacts affected by a change
export class ImpactAnalyzer {
  constructor(private traceGraph: TraceGraph) {}

  async findImpactedArtifacts(
    artifactId: string,
    relationTypes: TraceType[] = ['dependsOn', 'satisfies', 'implements']
  ): Promise<ImpactReport> {
    const edges = this.traceGraph.getEdgesFrom(artifactId, relationTypes);

    return {
      directImpacts: edges.map(e => ({
        id: e.to,
        type: e.type,
        confidence: e.confidence,
      })),
      transitiveImpacts: await this.findTransitive(artifactId),
    };
  }
}
```

**Coverage reporting:**
```typescript
// From trace edges: verify all goals have satisfying requirements
export class CoverageAnalyzer {
  analyzeGoalCoverage(): CoverageReport {
    const goals = this.rqml.goals;
    const satisfiesEdges = this.rqml.trace.filter(e => e.type === 'satisfies');

    const uncoveredGoals = goals.filter(goal =>
      !satisfiesEdges.some(edge => edge.to === goal.id)
    );

    return {
      totalGoals: goals.length,
      coveredGoals: goals.length - uncoveredGoals.length,
      uncoveredGoals: uncoveredGoals.map(g => g.id),
      coveragePercentage: ((goals.length - uncoveredGoals.length) / goals.length) * 100,
    };
  }
}
```

**Markdown documentation generation:**
```typescript
// Generate traceability matrix from trace edges
export function generateTraceabilityMatrix(rqml: RQMLDocument): string {
  let markdown = '# Traceability Matrix\n\n';

  for (const req of rqml.requirements) {
    markdown += `## ${req.id}: ${req.title}\n\n`;

    const edges = rqml.trace.filter(e => e.from === req.id || e.to === req.id);
    markdown += '| Relationship | Target | Confidence |\n';
    markdown += '|--------------|--------|------------|\n';

    for (const edge of edges) {
      const target = edge.from === req.id ? edge.to : edge.from;
      markdown += `| ${edge.type} | ${target} | ${edge.confidence || 1.0} |\n`;
    }

    markdown += '\n';
  }

  return markdown;
}
```

## Test generation examples

Trace edges inform intelligent test generation:

1. **Coverage tests**: Verify each requirement with status=approved has at least one verifiedBy edge
2. **Impact-based test selection**: Run tests linked to changed requirements via trace edges
3. **Dependency tests**: Test requirements in dependency order (via dependsOn edges)
4. **Goal validation tests**: Ensure requirements marked as satisfying goals actually do
5. **Regression prioritization**: Weight tests by confidence values on trace edges
6. **Traceability reports**: Generate test-to-requirement mapping for compliance audits
7. **Breaking change tests**: Use `breaks` edges to identify test cases requiring updates
8. **Interface contract tests**: Use `consumesInterface`/`providesInterface` edges to generate contract tests

## Theory
- Traceability supports impact analysis, coverage, and compliance—core to IEEE 29148 and safety standards like IEC 61508/ISO 26262.
- Relation types encode rationale (satisfies/refines/mitigates) and help tools visualize coverage graphs.
- Confidence values express uncertainty, enabling risk-aware decisions during change.
- Typed endpoints (local/doc/external) enable multi-document traceability and integration with external systems without sacrificing validation for local references. Encoding the kind in the value's shape rather than in nested elements keeps an edge to a single line, which matters when a mature spec carries hundreds of them.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [IEC 61508](https://webstore.iec.ch/publication/5510), [ISO 26262](https://www.iso.org/standard/68383.html), [An Analysis of Traceability](https://dl.acm.org/doi/10.1145/167088.167111).
