---
id: trace
title: Trace
sidebar_position: 10
description: Connect goals, scenarios, requirements, interfaces, and tests.
---

The optional `trace` section encodes explicit relationships between artifacts to support impact analysis and coverage.

## Elements
- `edge`: Each edge has `@id`, `type`, optional `confidence` (0.0–1.0), optional lifecycle metadata, optional `tags`, and optional `notes`.
- Endpoints are structured: each `from` and `to` contains a `locator` with one of `local`, `doc`, or `external`.
- `type` uses `TraceType` enumeration: `refines`, `satisfies`, `dependsOn`, `conflictsWith`, `threatens`, `mitigates`, `verifiedBy`, `covers`, `implements`, `supersedes`, `consumesInterface`, `providesInterface`, `conformsTo`, `deprecates`, `breaks`.

### Endpoint types

| Locator | Purpose | Validation |
|---------|---------|------------|
| `local` | Reference by `@id` within this document | Keyref-validated |
| `doc` | Reference by `@id` in another RQML document (addressed by `@uri` / `@docId`) | Not validated by schema |
| `external` | Reference by `@uri` to any external artifact | Not validated by schema |

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
- Use `local` for same-document references; the schema enforces these via keyrefs.
- Use `doc` to trace to artifacts in other RQML documents—pin with `version` or `git` for immutability.
- Use `external` to trace to non-RQML systems (Jira, Git, files, regulations).
- Choose the most specific relation type; prefer `satisfies` for requirement coverage and `mitigates` for risk handling.
- Keep `notes` concise to explain rationale or scope boundaries for the link.
- Use `consumesInterface` / `providesInterface` to model cross-project API contracts.
- Use `conformsTo` to link requirements to external standards and specifications.
- Use `deprecates` and `breaks` to explicitly record change-management impacts.

## Example
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
  <edge id="TR-003" type="threatens">
    <from><locator><local id="OBS-DB"/></locator></from>
    <to><locator><local id="GOAL-AVAIL"/></locator></to>
  </edge>
</trace>
```

### With lifecycle metadata
```xml
<trace>
  <!-- Approved trace with full audit trail -->
  <edge id="TR-001" type="satisfies"
        status="approved" createdBy="jane.doe" createdAt="2025-03-15T10:30:00Z">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to><locator><local id="GOAL-AVAIL"/></locator></to>
    <notes>Verified in design review DR-2025-03.</notes>
  </edge>

  <!-- Auto-generated trace pending review -->
  <edge id="TR-002" type="satisfies"
        status="draft" createdBy="import-jira" createdAt="2025-03-20T08:00:00Z">
    <from><locator><local id="REQ-API-001"/></locator></from>
    <to><locator><local id="GOAL-PERF"/></locator></to>
  </edge>

  <!-- Deprecated trace kept for history -->
  <edge id="TR-003" type="satisfies"
        status="deprecated" createdBy="john.smith" createdAt="2024-01-10T14:00:00Z">
    <from><locator><local id="REQ-OLD-001"/></locator></from>
    <to><locator><local id="GOAL-SECURITY"/></locator></to>
    <notes>Superseded by REQ-AUTH-002 after security audit.</notes>
  </edge>
</trace>
```

### With category tags
```xml
<trace>
  <!-- Safety-critical trace for automotive system -->
  <edge id="TR-020" type="satisfies" tags="safety" status="approved">
    <from><locator><local id="REQ-BRAKE-001"/></locator></from>
    <to><locator><local id="GOAL-SAFETY"/></locator></to>
  </edge>

  <!-- Security trace for authentication -->
  <edge id="TR-021" type="satisfies" tags="security compliance">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to><locator><local id="GOAL-SECURITY"/></locator></to>
  </edge>

  <!-- Multi-domain trace: safety and compliance -->
  <edge id="TR-022" type="satisfies" tags="safety security compliance">
    <from><locator><local id="REQ-AUDIT-001"/></locator></from>
    <to><locator><local id="GOAL-COMPLIANCE"/></locator></to>
    <notes>Required for both ISO 26262 and SOX compliance.</notes>
  </edge>

  <!-- Performance trace -->
  <edge id="TR-023" type="satisfies" tags="performance">
    <from><locator><local id="REQ-PERF-001"/></locator></from>
    <to><locator><local id="GOAL-PERF"/></locator></to>
  </edge>
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
  <edge id="TR-050" type="supersedes">
    <from><locator><local id="REQ-AUTH-002"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
    <notes>OAuth replaces password auth per security audit 2025-Q1.</notes>
  </edge>
</trace>
```

### Contract semantics (new in 2.1.0)
Use `consumesInterface`, `providesInterface`, and `conformsTo` for cross-project and standards-based traceability:
```xml
<trace>
  <!-- Service consumes an API defined in this document -->
  <edge id="TR-060" type="consumesInterface">
    <from><locator><local id="REQ-CHECKOUT-001"/></locator></from>
    <to><locator><local id="API-PAYMENTS"/></locator></to>
  </edge>

  <!-- Service provides an endpoint for consumers -->
  <edge id="TR-061" type="providesInterface">
    <from><locator><local id="REQ-API-001"/></locator></from>
    <to><locator><local id="EP-CREATE-PAYMENT"/></locator></to>
  </edge>

  <!-- Requirement conforms to an external standard -->
  <edge id="TR-062" type="conformsTo">
    <from><locator><local id="REQ-CRYPTO-001"/></locator></from>
    <to><locator><external uri="urn:nist:fips:140-3" kind="standard"/></locator></to>
  </edge>

  <!-- Cross-document interface contract -->
  <edge id="TR-063" type="consumesInterface">
    <from><locator><local id="REQ-CHECKOUT-001"/></locator></from>
    <to>
      <locator>
        <doc uri="payments-api.rqml" docId="DOC-PAY-API" id="EP-CHARGE" version="1.2"/>
      </locator>
    </to>
  </edge>
</trace>
```

### Change management (new in 2.1.0)
Use `deprecates` and `breaks` to record change impacts explicitly:
```xml
<trace>
  <!-- New API version deprecates old one -->
  <edge id="TR-070" type="deprecates">
    <from><locator><local id="REQ-API-V2"/></locator></from>
    <to><locator><local id="REQ-API-V1"/></locator></to>
    <notes>v2 deprecates v1; v1 sunset date 2026-06-01.</notes>
  </edge>

  <!-- Breaking change -->
  <edge id="TR-071" type="breaks">
    <from><locator><local id="REQ-AUTH-003"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
    <notes>PKCE-only flow removes implicit grant; clients must migrate.</notes>
  </edge>
</trace>
```

## Cross-document references

The `doc` locator enables tracing between separate RQML documents. Use `version` or `git` to pin references for immutability.

```xml
<trace>
  <!-- Reference a goal in another RQML document -->
  <edge id="TR-080" type="satisfies">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to>
      <locator>
        <doc uri="goals.rqml" docId="DOC-GOALS" id="GOAL-SECURITY" version="2.0"/>
      </locator>
    </to>
  </edge>

  <!-- Pinned to a specific Git commit -->
  <edge id="TR-081" type="conformsTo">
    <from><locator><local id="REQ-API-001"/></locator></from>
    <to>
      <locator>
        <doc uri="contracts/api-spec.rqml" id="IR-REST-001" git="a1b2c3d"/>
      </locator>
    </to>
  </edge>
</trace>
```

## External references

External references enable tracing between RQML artifacts and external systems like issue trackers, version control, code files, and regulatory documents.

### External reference examples
```xml
<trace>
  <!-- Requirement implements a Jira story -->
  <edge id="TR-010" type="implements">
    <from><locator><local id="REQ-AUTH-001"/></locator></from>
    <to><locator><external uri="jira:PROJ-1234" kind="issue" title="Login flow"/></locator></to>
  </edge>

  <!-- Git commit implements a requirement -->
  <edge id="TR-011" type="implements">
    <from><locator><external uri="git:a1b2c3d4e5f6"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
  </edge>

  <!-- Code file implements a requirement -->
  <edge id="TR-012" type="implements">
    <from><locator><external uri="file:src/auth/login.ts#L42-L87"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
  </edge>

  <!-- Requirement satisfies a GDPR article -->
  <edge id="TR-013" type="satisfies">
    <from><locator><local id="REQ-GDPR-001"/></locator></from>
    <to><locator><external uri="urn:gdpr:article:17" kind="regulation"/></locator></to>
  </edge>

  <!-- External Confluence doc refines a goal -->
  <edge id="TR-014" type="refines">
    <from><locator><external uri="confluence:12345678"/></locator></from>
    <to><locator><local id="GOAL-SECURITY"/></locator></to>
  </edge>

  <!-- GitHub PR implements multiple requirements -->
  <edge id="TR-015" type="implements">
    <from><locator><external uri="github:acme/api/pull/99"/></locator></from>
    <to><locator><local id="REQ-API-001"/></locator></to>
  </edge>
</trace>
```

### URI conventions
| System | Pattern | Example |
|--------|---------|---------|
| Jira | `jira:{issue-key}` | `jira:PROJ-1234` |
| GitHub Issue | `github:{owner}/{repo}/issues/{num}` | `github:acme/api/issues/42` |
| GitHub PR | `github:{owner}/{repo}/pull/{num}` | `github:acme/api/pull/99` |
| Git commit | `git:{sha}` | `git:a1b2c3d4e5f6` |
| File + lines | `file:{path}#L{start}-L{end}` | `file:src/auth.ts#L42-L87` |
| Confluence | `confluence:{page-id}` | `confluence:12345678` |
| Regulation | `urn:{standard}:{clause}` | `urn:gdpr:article:17` |
| Full URL | Standard URL | `https://jira.example.com/browse/PROJ-1234` |

These conventions are recommendations; any valid URI is accepted by the schema.

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
- Structured endpoints (local/doc/external) enable multi-document traceability and integration with external systems without sacrificing schema validation for local references.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [IEC 61508](https://webstore.iec.ch/publication/5510), [ISO 26262](https://www.iso.org/standard/68383.html), [An Analysis of Traceability](https://dl.acm.org/doi/10.1145/167088.167111).
