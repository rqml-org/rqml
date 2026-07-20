import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runApprove } from "../src/commands/approve.js";
import { runCheck } from "../src/commands/check.js";
import { runGate } from "../src/commands/gate.js";
import { runImpact } from "../src/commands/impact.js";
import { runLink } from "../src/commands/link.js";
import { runMatrix } from "../src/commands/matrix.js";
import { runMigrate } from "../src/commands/migrate.js";
import { runOverview } from "../src/commands/overview.js";
import { runShow } from "../src/commands/show.js";
import { runSkeleton } from "../src/commands/skeleton.js";
import { EXIT, UsageError } from "../src/runtime.js";

const SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="CLITEST-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <goal id="G1" title="g"><statement>s</statement></goal>
  </goals>
  <requirements>
    <req id="REQ-A" type="FR" title="r" status="approved"><statement>s</statement></req>
  </requirements>
  <trace>
    <edge id="E-SAT" type="satisfies">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
  </trace>
</rqml>`;

describe("loop commands", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-cli-cmd-"));
    writeFileSync(join(dir, "requirements.rqml"), SPEC);
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;\n");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("link appends a validated edge and records the baseline (CRIT-LINK-ROUNDTRIP)", async () => {
    const code = await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    expect(code).toBe(EXIT.OK);

    const spec = readFileSync(join(dir, "requirements.rqml"), "utf8");
    expect(spec).toContain(
      '<edge id="E-IMPL-A" type="implements" status="draft" createdBy="rqml">',
    );
    expect(spec).toContain('<external uri="src/a.ts" kind="code"/>');

    const baseline = JSON.parse(
      readFileSync(join(dir, ".rqml", "baseline.json"), "utf8"),
    ) as Record<string, string>;
    expect(Object.keys(baseline)).toEqual(["E-IMPL-A"]);
    expect(baseline["E-IMPL-A"]).toMatch(/^[0-9a-f]{64}$/);

    // The check gate stays green right after linking…
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.OK);
  });

  it("migrate rewrites the spec to 2.2.0 and check stays green (CRIT-MIGRATE-BASELINE)", async () => {
    // A 2.1.0 spec with a recorded implements link and baseline…
    await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.OK);

    // …migrates in place: compact edges, 2.2.0 namespace, no false drift.
    const code = await runMigrate(["--base-dir", dir]);
    expect(code).toBe(EXIT.OK);
    const spec = readFileSync(join(dir, "requirements.rqml"), "utf8");
    expect(spec).toContain('version="2.2.0"');
    expect(spec).toContain('<edge id="E-SAT" type="satisfies" from="REQ-A" to="G1"/>');
    expect(spec).toContain('from="src/a.ts" fromKind="code" to="REQ-A"');
    expect(spec).not.toContain("<locator>");
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.OK);

    // A second run is a no-op.
    expect(await runMigrate(["--base-dir", dir])).toBe(EXIT.OK);
    expect(readFileSync(join(dir, "requirements.rqml"), "utf8")).toBe(spec);
  });

  it("migrate preserves pre-existing drift instead of blessing it (CRIT-MIGRATE-BASELINE)", async () => {
    await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    // The linked artifact drifts BEFORE migration…
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 2;\n");
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.CHECK);

    // …and migration must not convert that red check to green.
    expect(await runMigrate(["--base-dir", dir])).toBe(EXIT.OK);
    expect(readFileSync(join(dir, "requirements.rqml"), "utf8")).toContain(
      'version="2.2.0"',
    );
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.CHECK);
  });

  it("check reports changed artifacts after linking (CRIT-DRIFT-CHANGED)", async () => {
    await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 2;\n");
    // …and exits non-zero once the linked artifact drifts.
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.CHECK);
  });

  it("link refuses unknown artifacts without touching the spec", async () => {
    const code = await runLink(["REQ-NOPE", "src/a.ts", "--base-dir", dir]);
    expect(code).toBe(EXIT.VALIDATION);
    expect(readFileSync(join(dir, "requirements.rqml"), "utf8")).toBe(SPEC);
  });

  it("link records verifiedBy edges without a baseline entry", async () => {
    writeFileSync(join(dir, "src", "a.test.ts"), "test\n");
    const code = await runLink([
      "REQ-A",
      "src/a.test.ts",
      "--type",
      "verifiedBy",
      "--base-dir",
      dir,
    ]);
    expect(code).toBe(EXIT.OK);
    const spec = readFileSync(join(dir, "requirements.rqml"), "utf8");
    expect(spec).toContain(
      '<edge id="E-VER-A" type="verifiedBy" status="draft" createdBy="rqml">',
    );
  });

  it("link --update repoints an edge and refreshes its baseline (CRIT-RELINK-UPDATE)", async () => {
    await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    const bContent = "export const b = 1;\n";
    writeFileSync(join(dir, "src", "b.ts"), bContent);

    const code = await runLink(["REQ-A", "src/b.ts", "--update", "--base-dir", dir]);
    expect(code).toBe(EXIT.OK);

    const spec = readFileSync(join(dir, "requirements.rqml"), "utf8");
    expect(spec).toContain('<external uri="src/b.ts" kind="code"/>');
    expect(spec).not.toContain('uri="src/a.ts"');
    expect(spec.match(/id="E-IMPL-A"/g)).toHaveLength(1);

    const baseline = JSON.parse(
      readFileSync(join(dir, ".rqml", "baseline.json"), "utf8"),
    ) as Record<string, string>;
    expect(baseline["E-IMPL-A"]).toBe(
      createHash("sha256").update(bContent).digest("hex"),
    );

    // The repointed link tracks the new artifact: drifting the old one is fine…
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 99;\n");
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.OK);
    // …drifting the new one is caught.
    writeFileSync(join(dir, "src", "b.ts"), "export const b = 2;\n");
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.CHECK);
  });

  it("link --update refuses a missing edge without touching the spec", async () => {
    const code = await runLink(["REQ-A", "src/a.ts", "--update", "--base-dir", dir]);
    expect(code).toBe(EXIT.VALIDATION);
    expect(readFileSync(join(dir, "requirements.rqml"), "utf8")).toBe(SPEC);
  });

  it("link --refresh blesses an intentional change (CRIT-RELINK-REFRESH)", async () => {
    await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    const specAfterLink = readFileSync(join(dir, "requirements.rqml"), "utf8");

    writeFileSync(join(dir, "src", "a.ts"), "export const a = 2;\n");
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.CHECK);

    const code = await runLink(["--refresh", "E-IMPL-A", "--base-dir", dir]);
    expect(code).toBe(EXIT.OK);
    // The spec document is byte-identical; only the baseline store changed.
    expect(readFileSync(join(dir, "requirements.rqml"), "utf8")).toBe(specAfterLink);
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.OK);
  });

  it("link --refresh rejects unknown edges and unhashable artifacts", async () => {
    await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    expect(await runLink(["--refresh", "E-NOPE", "--base-dir", dir])).toBe(
      EXIT.VALIDATION,
    );
    rmSync(join(dir, "src", "a.ts"));
    expect(await runLink(["--refresh", "E-IMPL-A", "--base-dir", dir])).toBe(
      EXIT.VALIDATION,
    );
  });

  it("show extracts a known artifact and rejects an unknown id", async () => {
    expect(await runShow(["REQ-A", "--base-dir", dir])).toBe(EXIT.OK);
    expect(await runShow(["NOPE", "--base-dir", dir])).toBe(EXIT.USAGE);
  });

  it("impact answers for a known artifact and rejects an unknown id", async () => {
    expect(await runImpact(["G1", "--base-dir", dir])).toBe(EXIT.OK);
    expect(await runImpact(["NOPE", "--base-dir", dir])).toBe(EXIT.USAGE);
  });

  it("skeleton prints snippets and rejects unknown kinds", async () => {
    expect(await runSkeleton(["req"])).toBe(EXIT.OK);
    await expect(runSkeleton(["nope"])).rejects.toThrow(UsageError);
  });

  it("matrix renders rows and filters by warning (CRIT-MATRIX-SURFACE)", async () => {
    const out: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string | Uint8Array) => {
      out.push(String(s));
      return true;
    }) as typeof process.stdout.write;
    const rows = (): string[] => {
      const j = JSON.parse(out.join("")) as { rows: Array<{ id: string }> };
      out.length = 0;
      return j.rows.map((r) => r.id);
    };
    try {
      expect(await runMatrix(["--base-dir", dir, "--json"])).toBe(EXIT.OK);
      expect(rows()).toEqual(["REQ-A"]);
      // REQ-A is approved, satisfies G1, but has no verifiedBy edge → unverified.
      expect(
        await runMatrix(["--base-dir", dir, "--warning", "unverified", "--json"]),
      ).toBe(EXIT.OK);
      expect(rows()).toEqual(["REQ-A"]);
      expect(
        await runMatrix(["--base-dir", dir, "--warning", "premature", "--json"]),
      ).toBe(EXIT.OK);
      expect(rows()).toEqual([]);
    } finally {
      process.stdout.write = orig;
    }
  });

  it("overview projects the spec and scopes by section (REQ-LOOP-OVERVIEW)", async () => {
    const out: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string | Uint8Array) => {
      out.push(String(s));
      return true;
    }) as typeof process.stdout.write;
    const sections = (): string[] => {
      const o = JSON.parse(out.join("")) as { sections: Array<{ title: string }> };
      out.length = 0;
      return o.sections.map((s) => s.title);
    };
    try {
      expect(await runOverview(["--base-dir", dir, "--json"])).toBe(EXIT.OK);
      expect(sections()).toContain("Requirements");
      expect(await runOverview(["--base-dir", dir, "--section", "Goals", "--json"])).toBe(
        EXIT.OK,
      );
      expect(sections()).toEqual(["Goals"]);
    } finally {
      process.stdout.write = orig;
    }
  });

  it("approve transitions a requirement's status (REQ-LOOP-APPROVE)", async () => {
    expect(await runApprove(["REQ-A", "--status", "review", "--base-dir", dir])).toBe(
      EXIT.OK,
    );
    expect(readFileSync(join(dir, "requirements.rqml"), "utf8")).toContain(
      'id="REQ-A" type="FR" title="r" status="review"',
    );
  });

  it("approve rejects an unknown id without writing the spec", async () => {
    const before = readFileSync(join(dir, "requirements.rqml"), "utf8");
    expect(await runApprove(["REQ-NOPE", "--base-dir", dir])).toBe(EXIT.VALIDATION);
    expect(readFileSync(join(dir, "requirements.rqml"), "utf8")).toBe(before);
  });

  it("gate blocks non-approved implementation and clears once approved (REQ-ENFORCE-APPROVAL-GATE)", async () => {
    const GATE_SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="GATECLI-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <requirements>
    <req id="REQ-B" type="FR" title="b" status="draft"><statement>b SHALL.</statement></req>
  </requirements>
  <trace>
    <edge id="E-IMPL-B" type="implements">
      <from><locator><external uri="src/b.ts" kind="code"/></locator></from>
      <to><locator><local id="REQ-B"/></locator></to>
    </edge>
  </trace>
</rqml>`;
    writeFileSync(join(dir, "requirements.rqml"), GATE_SPEC);
    expect(await runGate(["--base-dir", dir])).toBe(EXIT.CHECK);
    expect(await runApprove(["REQ-B", "--base-dir", dir])).toBe(EXIT.OK);
    expect(await runGate(["--base-dir", dir])).toBe(EXIT.OK);
  });
});
