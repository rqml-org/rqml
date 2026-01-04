---
id: verification
title: Verification
sidebar_position: 8
description: Capture how requirements are tested and inspected.
---

The optional `verification` section records planned and executed checks against requirements.

## Elements
- `testSuite`: Collection with `@id`, `title`, optional `description`, and optional `members` (refs to `testCase` or other items).
- `testCase`: Individual verification item with `@id`, `title`, `type` (`acceptance|integration|unit|security|performance|inspection`), optional `purpose`, `steps`, `expected`, and optional `refs`.

## Authoring tips
- Use `refs` to point from `testCase` to the requirements or scenarios it covers.
- Keep `expected` observable and unambiguous; add `steps` for reproducibility.
- Group related cases into `testSuite` for releases or capabilities, then trace to requirements using the `trace` section.

## Example
```xml
<verification>
  <testSuite id="TS-PAYMENT" title="Payment Flow">
    <members>
      <ref ref="TC-AUTH-001"/>
    </members>
  </testSuite>
  <testCase id="TC-AUTH-001" type="integration" title="Authorize payment success">
    <purpose>Verify successful authorization path.</purpose>
    <steps>Submit POST /payments with valid token and amount.</steps>
    <expected>Response status 201 with paymentId and status=authorized.</expected>
    <refs>
      <ref ref="REQ-AUTH-001"/>
      <ref ref="SCN-CHECKOUT"/>
    </refs>
  </testCase>
</verification>
```

## Theory
- Verification ties requirements to evidence; IEEE 29148 stresses testability and traceability to demonstrate conformance.
- Test types (acceptance, integration, unit, etc.) mirror V-model layering and standard QA practices.
- Suites help organize regression scope and release readiness.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [ISTQB Foundation Syllabus](https://www.istqb.org/certifications/foundation-level/), [V-Model](https://www.iso.org/standard/63712.html) (ISO/IEC/IEEE 12207 context).
