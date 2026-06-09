import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
      "rqml_check",
      "rqml_impact",
      "rqml_link",
      "rqml_show",
      "rqml_skeleton",
      "rqml_status",
      "rqml_trace",
      "rqml_validate",
    ]);
  });

  it("accepts a path argument equivalent to inline xml (CRIT-MCP-PATH)", async () => {
    const byPath = await callTool("rqml_status", { path: spec });
    const inline = await callTool("rqml_status", { xml: SPEC });
    expect(byPath).toEqual(inline);
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
