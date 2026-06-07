---
id: governance
title: Governance
sidebar_position: 11
description: Track issues, approvals, and lifecycle controls for the specification.
---

The optional `governance` section captures change control and accountability for the RQML document.

## Elements
- `issue`: Items with `@id`, optional `status` (`draft|review|approved|deprecated`), optional `owner`, plus `statement` and optional `notes`.
- `approval`: Items with `@id`, `role`, optional `status`, and optional `description`.

## Authoring tips
- Use `issue` to log open questions, decisions needed, or deviations; update `status` as they progress.
- Capture sign-offs with `approval`, listing the role (not necessarily a person) responsible for acceptance.
- Keep this section current during reviews to make the document’s governance auditable.

## Example
```xml
<governance>
  <issue id="ISS-PCI" status="review" owner="Compliance">
    <statement>Confirm PCI scope for stored tokens.</statement>
    <notes>Pending decision on vault provider.</notes>
  </issue>
  <approval id="APR-SEC" role="Security Lead" status="draft">
    <description>Security sign-off required before launch.</description>
  </approval>
</governance>
```

## Code generation examples

LLMs generate governance infrastructure from governance specifications:

**Issue tracking integration:**
```typescript
// From governance issues: create tracking records
export class GovernanceTracker {
  async syncIssues(rqml: RQMLDocument): Promise<void> {
    for (const issue of rqml.governance.issues) {
      await this.issueTracker.createOrUpdate({
        id: issue.id,
        title: issue.statement,
        status: this.mapStatus(issue.status),
        owner: issue.owner,
        notes: issue.notes,
        labels: ['rqml-governance', 'specification'],
      });
    }
  }
}
```

**Approval workflow enforcement:**
```typescript
// From governance approvals: enforce sign-off requirements
export class ApprovalGate {
  async checkApprovalStatus(rqml: RQMLDocument): Promise<ApprovalStatus> {
    const requiredApprovals = rqml.governance.approvals.filter(
      a => a.status !== 'approved'
    );

    if (requiredApprovals.length > 0) {
      throw new GovernanceError('Pending approvals', {
        required: requiredApprovals.map(a => ({
          id: a.id,
          role: a.role,
          description: a.description,
        })),
      });
    }

    return { approved: true, timestamp: new Date() };
  }
}
```

**Compliance audit logging:**
```typescript
// Generate audit trail from governance changes
export class GovernanceAuditor {
  async logGovernanceChange(
    docId: string,
    change: GovernanceChange
  ): Promise<void> {
    await this.auditLog.record({
      docId,
      timestamp: new Date(),
      type: change.type, // 'issue' | 'approval'
      artifactId: change.id,
      status: change.status,
      owner: change.owner,
      description: change.statement || change.description,
      // For compliance reporting (ISO 9001, SOX, etc.)
      retentionYears: 7,
    });
  }
}
```

**Issue resolution workflow:**
```typescript
// From ISS-PCI: Track decision resolution
export interface IssueResolution {
  issueId: string;
  resolution: string;
  resolvedBy: string;
  resolvedAt: Date;
  updatedArtifacts: string[]; // IDs of requirements/decisions affected
}

export class IssueResolver {
  async resolveIssue(issueId: string, resolution: IssueResolution): Promise<void> {
    // Update issue status to 'approved' (resolved)
    await this.updateRQML(doc => {
      const issue = doc.governance.issues.find(i => i.id === issueId);
      if (issue) {
        issue.status = 'approved';
        issue.notes = `${issue.notes}\n\nResolved: ${resolution.resolution}`;
      }
    });

    // Notify stakeholders
    await this.notifyOwner(resolution);
  }
}
```

## Test generation examples

Governance section drives compliance and workflow validation:

1. **Approval gate tests**: Verify deployment blocked when approvals are pending
2. **Issue workflow tests**: Test issue lifecycle from draft through resolution
3. **Compliance tests**: Verify audit trail completeness for regulatory requirements
4. **Access control tests**: Ensure only authorized roles can approve specifications
5. **Notification tests**: Verify stakeholders are notified of governance changes
6. **Status transition tests**: Test valid/invalid status transitions for issues and approvals

## Theory
- Governance enforces accountability and change control, aligning with configuration management in ISO/IEC/IEEE 12207.
- Issues capture outstanding concerns; approvals provide evidence for audits and regulated contexts (e.g., ISO 9001).
- Clear ownership reduces drift and supports continuous compliance in agile environments.
- Bibliography: [ISO/IEC/IEEE 12207](https://www.iso.org/standard/63712.html), [ISO 9001](https://www.iso.org/standard/62085.html), [CMMI for Development](https://cmmiinstitute.com/cmmi/dev).
