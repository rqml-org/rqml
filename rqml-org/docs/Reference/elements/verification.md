---
id: element-verification
title: verification
description: Verification artifacts such as test suites and test cases.
---

## Summary
Optional section describing how requirements are validated.

## Where it appears
- `rqml > verification`

## Content model
- `testSuite` (0..n) → `description` (0..1), `members` (0..1) → `ref` (0..n)
- `testCase` (0..n) → `purpose` (0..1), `steps` (0..1), `expected` (0..1), `refs` (0..1) → `ref` (0..n)

## Attributes
| Element | Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| testSuite | `id` | IdType | yes | — | Suite identifier. |
| testSuite | `title` | string | yes | — | Suite title. |
| testCase | `id` | IdType | yes | — | Test identifier. |
| testCase | `type` | TestType (`acceptance|integration|unit|security|performance|inspection`) | yes | — | Test classification. |
| testCase | `title` | string | yes | — | Test title. |

## Example (minimal)
```xml
<verification>
  <testCase id="TC-1" type="unit" title="Does the thing"/>
</verification>
```

## Example (typical)
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

## Notes / LLM hints
- Include `refs` to connect tests to requirements/scenarios for coverage.
- Use `steps` and `expected` to make tests reproducible and observable.
