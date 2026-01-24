---
id: trace
title: Trace
sidebar_position: 10
description: Connect goals, scenarios, requirements, interfaces, and tests.
---

The optional `trace` section encodes explicit relationships between artifacts to support impact analysis and coverage.

## Elements
- `traceEdge`: Each edge has `@id`, `type`, optional `confidence` (0.0–1.0), optional lifecycle metadata, optional `tags`, and optional `notes`.
- Endpoints use `@from`/`@to` for internal references or `@fromUri`/`@toUri` for external systems.
- `type` uses `TraceType` enumeration: `refines`, `satisfies`, `dependsOn`, `conflictsWith`, `threatens`, `mitigates`, `verifiedBy`, `covers`, `implements`.

### Endpoint attributes
| Attribute | Purpose | Validation |
|-----------|---------|------------|
| `from` | Source element ID within this document | Keyref-validated |
| `to` | Target element ID within this document | Keyref-validated |
| `fromUri` | Source as external URI | Not validated |
| `toUri` | Target as external URI | Not validated |

At least one of `from` or `fromUri` should be specified, and at least one of `to` or `toUri`.

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
- Use `@from`/`@to` for internal elements; the schema enforces these via keyrefs.
- Use `@fromUri`/`@toUri` to trace to external systems (Jira, Git, files, regulations).
- Choose the most specific relation type; prefer `satisfies` for requirement coverage and `mitigates` for risk handling.
- Keep `notes` concise to explain rationale or scope boundaries for the link.

## Example
```xml
<trace>
  <traceEdge id="TR-001" from="REQ-AUTH-001" to="GOAL-AVAIL" type="satisfies" confidence="0.9">
    <notes>Primary requirement fulfilling availability goal for payments.</notes>
  </traceEdge>
  <traceEdge id="TR-002" from="TC-AUTH-001" to="REQ-AUTH-001" type="verifiedBy"/>
  <traceEdge id="TR-003" from="OBS-DB" to="GOAL-AVAIL" type="threatens"/>
</trace>
```

### With lifecycle metadata
```xml
<trace>
  <!-- Approved trace with full audit trail -->
  <traceEdge id="TR-001" from="REQ-AUTH-001" to="GOAL-AVAIL" type="satisfies"
             status="approved" createdBy="jane.doe" createdAt="2025-03-15T10:30:00Z">
    <notes>Verified in design review DR-2025-03.</notes>
  </traceEdge>

  <!-- Auto-generated trace pending review -->
  <traceEdge id="TR-002" from="REQ-API-001" to="GOAL-PERF" type="satisfies"
             status="draft" createdBy="import-jira" createdAt="2025-03-20T08:00:00Z"/>

  <!-- Deprecated trace kept for history -->
  <traceEdge id="TR-003" from="REQ-OLD-001" to="GOAL-SECURITY" type="satisfies"
             status="deprecated" createdBy="john.smith" createdAt="2024-01-10T14:00:00Z">
    <notes>Superseded by REQ-AUTH-002 after security audit.</notes>
  </traceEdge>
</trace>
```

### With category tags
```xml
<trace>
  <!-- Safety-critical trace for automotive system -->
  <traceEdge id="TR-020" from="REQ-BRAKE-001" to="GOAL-SAFETY" type="satisfies"
             tags="safety" status="approved"/>

  <!-- Security trace for authentication -->
  <traceEdge id="TR-021" from="REQ-AUTH-001" to="GOAL-SECURITY" type="satisfies"
             tags="security compliance"/>

  <!-- Multi-domain trace: safety and compliance -->
  <traceEdge id="TR-022" from="REQ-AUDIT-001" to="GOAL-COMPLIANCE" type="satisfies"
             tags="safety security compliance">
    <notes>Required for both ISO 26262 and SOX compliance.</notes>
  </traceEdge>

  <!-- Performance trace -->
  <traceEdge id="TR-023" from="REQ-PERF-001" to="GOAL-PERF" type="satisfies"
             tags="performance"/>
</trace>
```

## External references

External references enable tracing between RQML artifacts and external systems like issue trackers, version control, code files, and regulatory documents.

### External reference examples
```xml
<trace>
  <!-- Requirement implements a Jira story -->
  <traceEdge id="TR-010" from="REQ-AUTH-001" toUri="jira:PROJ-1234" type="implements"/>

  <!-- Git commit implements a requirement -->
  <traceEdge id="TR-011" fromUri="git:a1b2c3d4e5f6" to="REQ-AUTH-001" type="implements"/>

  <!-- Code file implements a requirement -->
  <traceEdge id="TR-012" fromUri="file:src/auth/login.ts#L42-L87" to="REQ-AUTH-001" type="implements"/>

  <!-- Requirement satisfies a GDPR article -->
  <traceEdge id="TR-013" from="REQ-GDPR-001" toUri="urn:gdpr:article:17" type="satisfies"/>

  <!-- External Confluence doc refines a goal -->
  <traceEdge id="TR-014" fromUri="confluence:12345678" to="GOAL-SECURITY" type="refines"/>

  <!-- GitHub PR implements multiple requirements -->
  <traceEdge id="TR-015" fromUri="github:acme/api/pull/99" to="REQ-API-001" type="implements"/>
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

## Theory
- Traceability supports impact analysis, coverage, and compliance—core to IEEE 29148 and safety standards like IEC 61508/ISO 26262.
- Relation types encode rationale (satisfies/refines/mitigates) and help tools visualize coverage graphs.
- Confidence values express uncertainty, enabling risk-aware decisions during change.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [IEC 61508](https://webstore.iec.ch/publication/5510), [ISO 26262](https://www.iso.org/standard/68383.html), [An Analysis of Traceability](https://dl.acm.org/doi/10.1145/167088.167111).
