import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SERVER_CAPABILITIES } from "../src/capabilities.js";
import { TOOLS, callTool } from "../src/tools.js";

const CLI = fileURLToPath(new URL("../../cli/dist/index.js", import.meta.url));

const SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="MCPTEST-1" status="draft">
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

describe("MCP tools", () => {
  let dir: string;
  let spec: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-mcp-"));
    spec = join(dir, "requirements.rqml");
    writeFileSync(spec, SPEC);
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;\n");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("exposes the agent-loop toolset", () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      "rqml_approve",
      "rqml_check",
      "rqml_discover",
      "rqml_gate",
      "rqml_impact",
      "rqml_link",
      "rqml_matrix",
      "rqml_overview",
      "rqml_show",
      "rqml_skeleton",
      "rqml_status",
      "rqml_trace",
      "rqml_validate",
    ]);
  });

  it("advertises only the tools capability (REQ-MCP-INTERACTION-BOUNDARY)", () => {
    expect(Object.keys(SERVER_CAPABILITIES)).toEqual(["tools"]);
    for (const feature of ["resources", "prompts", "elicitation", "sampling"]) {
      expect(feature in SERVER_CAPABILITIES).toBe(false);
    }
  });

  it("builds a traceability matrix, equal by path and inline (REQ-MCP-PARITY)", async () => {
    const byPath = await callTool("rqml_matrix", { path: spec });
    const inline = await callTool("rqml_matrix", { xml: SPEC });
    expect(byPath).toEqual(inline);
    const m = byPath as { rows: Array<{ id: string }>; markdown: string };
    expect(m.rows.map((r) => r.id)).toContain("REQ-A");
    expect(m.markdown).toContain("Traceability matrix");
  });

  it("projects an overview, equal by path and inline (REQ-LOOP-OVERVIEW)", async () => {
    const byPath = await callTool("rqml_overview", { path: spec });
    const inline = await callTool("rqml_overview", { xml: SPEC });
    expect(byPath).toEqual(inline);
    const o = byPath as {
      outline: { sections: Array<{ title: string }> };
      markdown: string;
    };
    expect(o.outline.sections.some((s) => s.title === "Requirements")).toBe(true);
  });

  it("approves a requirement, writing the spec file (REQ-LOOP-APPROVE)", async () => {
    const r = (await callTool("rqml_approve", {
      path: spec,
      id: "REQ-A",
      status: "review",
    })) as { ok: boolean; previousStatus: string | null };
    expect(r.ok).toBe(true);
    expect(r.previousStatus).toBe("approved");
    expect(readFileSync(spec, "utf8")).toContain(
      'id="REQ-A" type="FR" title="r" status="review"',
    );
  });

  it("returns a read-only gate verdict, equal by path and inline (REQ-ENFORCE-APPROVAL-GATE)", async () => {
    const byPath = await callTool("rqml_gate", { path: spec });
    const inline = await callTool("rqml_gate", { xml: SPEC });
    expect(byPath).toEqual(inline);
    expect((byPath as { blocked: boolean }).blocked).toBe(false);
  });

  it("accepts a path argument equivalent to inline xml (CRIT-MCP-PATH)", async () => {
    const byPath = await callTool("rqml_status", { path: spec });
    const inline = await callTool("rqml_status", { xml: SPEC });
    expect(byPath).toEqual(inline);
  });

  it("resolves a spec input from a file via nearest-wins (REQ-CORE-SPEC-DISCOVERY)", async () => {
    const byFile = await callTool("rqml_status", { file: join(dir, "src", "a.ts") });
    const byPath = await callTool("rqml_status", { path: spec });
    expect(byFile).toEqual(byPath);
  });

  it("rqml_discover enumerates governing specs and resolves a file (REQ-CORE-SPEC-DISCOVERY)", async () => {
    mkdirSync(join(dir, ".git"));
    mkdirSync(join(dir, "packages", "api"), { recursive: true });
    writeFileSync(join(dir, "packages", "api", "requirements.rqml"), SPEC);
    const r = (await callTool("rqml_discover", {
      root: dir,
      file: join(dir, "packages", "api", "src", "x.ts"),
    })) as {
      specs: Array<{ specPath: string }>;
      ambiguous: unknown[];
      governing: { kind: string; specPath?: string };
    };
    expect(r.specs.map((s) => s.specPath).sort()).toEqual(
      [
        join(dir, "requirements.rqml"),
        join(dir, "packages", "api", "requirements.rqml"),
      ].sort(),
    );
    expect(r.ambiguous).toEqual([]);
    expect(r.governing).toMatchObject({
      kind: "resolved",
      specPath: join(dir, "packages", "api", "requirements.rqml"),
    });
  });

  it("agrees with the rqml CLI on the same project (TC-MCP-PARITY)", async () => {
    const mcp = (await callTool("rqml_check", { path: spec })) as {
      verdict: string;
      coverage: unknown;
      drift: unknown;
    };
    const cliOut = execFileSync(
      process.execPath,
      [CLI, "check", "--json", "--base-dir", dir],
      {
        encoding: "utf8",
      },
    );
    const cli = JSON.parse(cliOut) as {
      verdict: string;
      coverage: unknown;
      drift: unknown;
    };
    expect(mcp.verdict).toBe(cli.verdict);
    expect(mcp.coverage).toEqual(cli.coverage);
    expect(mcp.drift).toEqual(cli.drift);
  });

  it("rqml_link writes the spec, records the baseline, and check sees drift after edits", async () => {
    const linked = (await callTool("rqml_link", {
      path: spec,
      artifactId: "REQ-A",
      uri: "src/a.ts",
    })) as { ok: boolean; edgeId: string; baselineRecorded: boolean };
    expect(linked.ok).toBe(true);
    expect(linked.edgeId).toBe("E-IMPL-A");
    expect(linked.baselineRecorded).toBe(true);
    expect(readFileSync(spec, "utf8")).toContain(
      '<edge id="E-IMPL-A" type="implements">',
    );

    const clean = (await callTool("rqml_check", { path: spec })) as { verdict: string };
    expect(clean.verdict).toBe("pass");

    writeFileSync(join(dir, "src", "a.ts"), "export const a = 2;\n");
    const drifted = (await callTool("rqml_check", { path: spec })) as {
      verdict: string;
      drift: { edgeId: string; status: string }[];
    };
    expect(drifted.verdict).toBe("fail");
    expect(drifted.drift).toEqual([
      { edgeId: "E-IMPL-A", requirementId: "REQ-A", uri: "src/a.ts", status: "changed" },
    ]);
  });

  it("rqml_link refuses to run without a path", async () => {
    await expect(
      callTool("rqml_link", { xml: SPEC, artifactId: "REQ-A", uri: "src/a.ts" }),
    ).rejects.toThrow(/path is required/);
  });

  it("rqml_link update repoints the edge and its baseline (CRIT-RELINK-UPDATE)", async () => {
    writeFileSync(join(dir, "src", "b.ts"), "export const b = 1;\n");
    await callTool("rqml_link", { path: spec, artifactId: "REQ-A", uri: "src/a.ts" });

    const updated = (await callTool("rqml_link", {
      path: spec,
      mode: "update",
      artifactId: "REQ-A",
      uri: "src/b.ts",
    })) as {
      ok: boolean;
      edgeId: string;
      previousUri?: string;
      baselineRecorded: boolean;
    };
    expect(updated.ok).toBe(true);
    expect(updated.edgeId).toBe("E-IMPL-A");
    expect(updated.previousUri).toBe("src/a.ts");
    expect(updated.baselineRecorded).toBe(true);

    const xml = readFileSync(spec, "utf8");
    expect(xml).toContain('uri="src/b.ts"');
    expect(xml).not.toContain('uri="src/a.ts"');
    expect(xml.match(/<edge id="E-IMPL-A"/g)).toHaveLength(1);

    // The baseline tracks the new artifact: clean now, drift when b.ts changes.
    const clean = (await callTool("rqml_check", { path: spec })) as { verdict: string };
    expect(clean.verdict).toBe("pass");
    writeFileSync(join(dir, "src", "b.ts"), "export const b = 2;\n");
    const drifted = (await callTool("rqml_check", { path: spec })) as {
      verdict: string;
      drift: { edgeId: string; uri: string }[];
    };
    expect(drifted.verdict).toBe("fail");
    expect(drifted.drift).toEqual([
      { edgeId: "E-IMPL-A", requirementId: "REQ-A", uri: "src/b.ts", status: "changed" },
    ]);
  });

  it("rqml_link refresh blesses an intentional change without touching the spec (CRIT-RELINK-REFRESH)", async () => {
    await callTool("rqml_link", { path: spec, artifactId: "REQ-A", uri: "src/a.ts" });
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 2;\n");
    const drifted = (await callTool("rqml_check", { path: spec })) as { verdict: string };
    expect(drifted.verdict).toBe("fail");

    const before = readFileSync(spec, "utf8");
    const refreshed = (await callTool("rqml_link", {
      path: spec,
      mode: "refresh",
      edgeId: "E-IMPL-A",
    })) as { ok: boolean; mode: string; uri: string; hash: string };
    expect(refreshed.ok).toBe(true);
    expect(refreshed.uri).toBe("src/a.ts");
    expect(readFileSync(spec, "utf8")).toBe(before);

    const clean = (await callTool("rqml_check", { path: spec })) as { verdict: string };
    expect(clean.verdict).toBe("pass");
  });

  it("rqml_link update mode matches the rqml CLI (TC-MCP-PARITY)", async () => {
    writeFileSync(join(dir, "src", "b.ts"), "export const b = 1;\n");
    await callTool("rqml_link", { path: spec, artifactId: "REQ-A", uri: "src/a.ts" });

    const cliDir = mkdtempSync(join(tmpdir(), "rqml-mcp-cli-"));
    try {
      const cliSpec = join(cliDir, "requirements.rqml");
      writeFileSync(cliSpec, readFileSync(spec, "utf8"));
      mkdirSync(join(cliDir, "src"));
      writeFileSync(join(cliDir, "src", "a.ts"), "export const a = 1;\n");
      writeFileSync(join(cliDir, "src", "b.ts"), "export const b = 1;\n");

      await callTool("rqml_link", {
        path: spec,
        mode: "update",
        artifactId: "REQ-A",
        uri: "src/b.ts",
      });
      execFileSync(
        process.execPath,
        [CLI, "link", "REQ-A", "src/b.ts", "--update", "--base-dir", cliDir],
        { encoding: "utf8" },
      );

      expect(readFileSync(spec, "utf8")).toBe(readFileSync(cliSpec, "utf8"));
      expect(readFileSync(join(dir, ".rqml", "baseline.json"), "utf8")).toBe(
        readFileSync(join(cliDir, ".rqml", "baseline.json"), "utf8"),
      );
    } finally {
      rmSync(cliDir, { recursive: true, force: true });
    }
  });

  it("rqml_link validates mode-specific inputs", async () => {
    await expect(callTool("rqml_link", { path: spec, mode: "refresh" })).rejects.toThrow(
      /edgeId is required/,
    );
    await expect(
      callTool("rqml_link", { path: spec, mode: "nope", artifactId: "REQ-A", uri: "x" }),
    ).rejects.toThrow(/unknown link mode/);
    const noEdge = (await callTool("rqml_link", {
      path: spec,
      mode: "update",
      artifactId: "REQ-A",
      uri: "src/a.ts",
    })) as { ok: boolean; error: string };
    expect(noEdge.ok).toBe(false);
    expect(noEdge.error).toMatch(/no trace edge/);
    const noBaseline = (await callTool("rqml_link", {
      path: spec,
      mode: "refresh",
      edgeId: "E-SAT",
    })) as { ok: boolean; error: string };
    expect(noBaseline.ok).toBe(false);
    expect(noBaseline.error).toMatch(/only implements edges carry baselines/);
  });

  it("rqml_show returns the slice with markdown; rqml_impact traverses", async () => {
    const slice = (await callTool("rqml_show", { path: spec, id: "REQ-A" })) as {
      kind: string;
      markdown: string;
    };
    expect(slice.kind).toBe("req");
    expect(slice.markdown).toContain("## REQ-A");

    const impact = (await callTool("rqml_impact", { path: spec, id: "G1" })) as {
      affected: { id: string }[];
    };
    expect(impact.affected.map((a) => a.id)).toContain("REQ-A");
  });

  it("rqml_skeleton returns schema-valid snippets", async () => {
    const result = (await callTool("rqml_skeleton", { kind: "req" })) as {
      snippet: string;
    };
    expect(result.snippet).toContain('<req id="REQ-AREA-001"');
    await expect(callTool("rqml_skeleton", { kind: "nope" })).rejects.toThrow(/kind/);
  });

  it("requires either xml or path", async () => {
    await expect(callTool("rqml_validate", {})).rejects.toThrow(/xml.*path|path.*xml/);
  });
});
