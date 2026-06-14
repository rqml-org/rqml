import { describe, expect, it } from "vitest";
import { setStatus } from "../src/edit/status.js";

const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="STATUSTEST-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <requirements>
    <req id="REQ-1" type="FR" title="One" status="draft"><statement>one SHALL work.</statement></req>
  </requirements>
</rqml>`;

describe("setStatus (REQ-CORE-SETSTATUS)", () => {
  it("transitions only the named requirement's status (CRIT-SETSTATUS-INPLACE)", () => {
    const r = setStatus(DOC, { artifactId: "REQ-1", status: "approved" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.previousStatus).toBe("draft");
    // Only the req tag's status changed; the rest (incl. the root status) is byte-identical.
    expect(r.xml).toBe(
      DOC.replace('status="draft"><statement>', 'status="approved"><statement>'),
    );
    expect(r.xml).toContain('docId="STATUSTEST-1" status="draft"'); // root untouched
  });

  it("rejects an invalid status without changing the document", () => {
    const r = setStatus(DOC, { artifactId: "REQ-1", status: "done" });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown artifact", () => {
    const r = setStatus(DOC, { artifactId: "REQ-NOPE", status: "approved" });
    expect(r.ok).toBe(false);
  });

  it("is a no-op when already at the target status", () => {
    const r = setStatus(DOC, { artifactId: "REQ-1", status: "draft" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.xml).toBe(DOC);
  });
});
