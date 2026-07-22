---
id: meta
title: Meta
sidebar_position: 1
description: How to capture document identity and conventions in the meta section.
---

The `meta` section defines the identity of the RQML document and its lifecycle. It is required and must appear first.

## Required elements
- `title`: Human-readable document title.
- `system`: Name or code of the system the specification covers.

## Optional elements
- `summary`: Free-form overview using mixed content for rich text.
- `authors`: One or more `author` entries (each with `name`, optional `role`, `org`, `contact`).
- `dates`: `created`, `updated`, and optional `targetRelease` markers.
- `conventions`: Guidance on normative keywords or ID patterns.
- `profiles`: Zero or more `profile` entries with `@id` and `@type` plus optional description to declare tailoring or domain-specific overlays.

## Attributes
On the root `rqml` element (not inside `meta`):
- `version` (required, must match schema), `docId` (required, `IdType`), `status` (required; `draft|review|approved|deprecated`).

## Authoring tips
- Keep `docId` stable across revisions; track lifecycle via `status` and `dates/updated`.
- Use `conventions` to lock ID formats (e.g., `REQ-<AREA>-NNN`) and normative keywords (MUST/SHOULD).
- When using profiles, document their intent clearly to guide downstream validation and rendering.

## Example
```xml
<rqml xmlns="https://rqml.org/schema/2.2.0" version="2.2.0" docId="PAY-REQS" status="review">
  <meta>
    <title>Payments Service Requirements</title>
    <system>Payments</system>
    <summary>Requirements for the payments API and reconciliation workflows.</summary>
    <authors>
      <author>
        <name>Avery Kim</name>
        <role>Product</role>
        <org>Acme</org>
        <contact>avery@example.com</contact>
      </author>
    </authors>
    <dates>
      <created>2024-10-01</created>
      <updated>2025-01-15</updated>
    </dates>
    <conventions>
      <idConventions>REQ-<area>-NNN, GOAL-<area>-NNN</idConventions>
    </conventions>
  </meta>
  <!-- other sections -->
</rqml>
```

## Code generation examples

LLMs use metadata to generate project infrastructure and documentation:

**Project configuration from system metadata:**
```json
// From meta: system="Payments", title="Payments Service Requirements"
{
  "name": "payments-service",
  "version": "1.0.0",
  "description": "Requirements for the payments API and reconciliation workflows",
  "repository": {
    "type": "git",
    "url": "https://github.com/acme/payments-service"
  },
  "author": "Avery Kim <avery@example.com>",
  "rqml": {
    "docId": "PAY-REQS",
    "status": "review",
    "updated": "2025-01-15"
  }
}
```

**ID generation from conventions:**
```typescript
// From conventions/idConventions: "REQ-<area>-NNN, GOAL-<area>-NNN"
export class RequirementIdGenerator {
  generateId(area: string, type: 'REQ' | 'GOAL'): string {
    const count = this.getNextSequence(area, type);
    return `${type}-${area.toUpperCase()}-${count.toString().padStart(3, '0')}`;
  }
}

// Examples: REQ-AUTH-001, GOAL-PERF-042
```

**Normative keyword validation:**
```typescript
// From conventions/normativeKeywords: RFC 2119
export class StatementValidator {
  validateNormativeLanguage(statement: string): ValidationResult {
    const keywords = ['SHALL', 'MUST', 'SHOULD', 'MAY'];
    const hasNormative = keywords.some(kw => statement.includes(kw));

    if (!hasNormative) {
      return {
        valid: false,
        message: 'Requirement statements must use RFC 2119 keywords (SHALL/MUST/SHOULD/MAY)',
      };
    }

    return { valid: true };
  }
}
```

**Profile-based conditional generation:**
```typescript
// From profiles: type="safety"
export function generateCodeForProfile(profile: Profile, requirements: Requirement[]): string {
  if (profile.type === 'safety') {
    // Generate additional safety checks and assertions
    return generateSafetyCriticalCode(requirements);
  } else if (profile.type === 'mobile') {
    // Generate mobile-optimized implementations
    return generateMobileCode(requirements);
  }
  return generateStandardCode(requirements);
}
```

**Documentation header generation:**
```markdown
<!-- From meta section -->
# Payments Service Requirements

**Document ID**: PAY-REQS
**Status**: Review
**System**: Payments
**Last Updated**: 2025-01-15

## Authors
- Avery Kim (Product, Acme) - avery@example.com

## Summary
Requirements for the payments API and reconciliation workflows.

## Conventions
- **ID Format**: REQ-<area>-NNN, GOAL-<area>-NNN
- **Normative Keywords**: Per RFC 2119 (MUST/SHALL/SHOULD/MAY)
```

## Test generation examples

Metadata informs test organization and documentation:

1. **Test file naming**: Use system name and conventions to generate test file paths
2. **Test metadata**: Embed document status and version in test reports
3. **Author attribution**: Generate test ownership from author information
4. **Convention tests**: Validate that all IDs follow declared conventions
5. **Profile tests**: Generate profile-specific test suites
6. **Status-based execution**: Only run tests for requirements with status=approved

## Theory
- Good meta data underpins change control and provenance—aligns with IEEE 29148 emphasis on traceable requirements specs.
- Status and dating enable configuration management (see ISO/IEC/IEEE 12207 lifecycle processes).
- Profiles express viewpoints or tailoring, similar to viewpoints in ISO/IEC/IEEE 42010 architecture descriptions.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [ISO/IEC/IEEE 12207](https://www.iso.org/standard/63712.html), [ISO/IEC/IEEE 42010](https://www.iso.org/standard/50508.html).
