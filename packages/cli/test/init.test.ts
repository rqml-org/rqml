import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENTS_TEMPLATE } from "@rqml/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyAgentsTemplate, runInit } from "../src/commands/init.js";
import { EXIT } from "../src/runtime.js";

const BEGIN = "<!-- BEGIN RQML";
const END = "<!-- END RQML -->";

/** Count non-overlapping occurrences of `needle` in `text`. */
const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

describe("applyAgentsTemplate — managed-block merge (REQ-CLI-INIT-MERGE)", () => {
  it("creates a marked block when no AGENTS.md exists", () => {
    const { content, action } = applyAgentsTemplate(null);
    expect(action).toBe("created");
    expect(content).toContain(BEGIN);
    expect(content).toContain(END);
    expect(content).toContain("# RQML Agent Guidelines");
    expect(content).toContain("## Strictness: `standard`");
  });

  it("appends the block to an existing file, preserving the user's content", () => {
    const existing = "# Our Project\n\nHand-written agent guidance we rely on.\n";
    const { content, action } = applyAgentsTemplate(existing);
    expect(action).toBe("merged");
    // Every byte of the original survives, ahead of the injected block.
    expect(content.startsWith(existing)).toBe(true);
    expect(content.indexOf("Hand-written agent guidance")).toBeLessThan(
      content.indexOf(BEGIN),
    );
    expect(content).toContain(END);
  });

  it("is idempotent: re-applying a current block changes nothing", () => {
    const once = applyAgentsTemplate("# Mine\n\nstuff\n");
    const twice = applyAgentsTemplate(once.content);
    expect(twice.action).toBe("unchanged");
    expect(twice.content).toBe(once.content);
    // No marker duplication on the second pass.
    expect(occurrences(twice.content, END)).toBe(1);
  });

  it("refreshes a stale block in place without touching surrounding text", () => {
    const merged = applyAgentsTemplate("# Mine\n\nkeep me\n").content;
    const stale = merged.replace(
      "# RQML Agent Guidelines",
      "# RQML Agent Guidelines (old)",
    );
    const { content, action } = applyAgentsTemplate(stale);
    expect(action).toBe("refreshed");
    expect(content).toContain("keep me");
    expect(content).toContain("# RQML Agent Guidelines\n");
    expect(content).not.toContain("(old)");
    expect(occurrences(content, BEGIN)).toBe(1);
  });

  it("preserves a project's declared strictness across a refresh", () => {
    // Adopt, then a team raises strictness to strict inside the block.
    const adopted = applyAgentsTemplate("# Mine\n").content;
    const raised = adopted.replace(
      "## Strictness: `standard`",
      "## Strictness: `strict`",
    );
    // A later `rqml init` (e.g. after a template bump) must not reset it.
    const bumped = raised.replace("## Toolchain", "## Toolchain (vNext)");
    const { content, action } = applyAgentsTemplate(bumped);
    expect(action).toBe("refreshed");
    expect(content).toContain("## Strictness: `strict`");
    expect(content).not.toContain("## Strictness: `standard`");
  });
});

describe("runInit — end to end (REQ-CLI-INIT-MERGE)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-init-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("scaffolds a spec and a fresh AGENTS.md", async () => {
    const code = await runInit(["--base-dir", dir]);
    expect(code).toBe(EXIT.OK);
    expect(existsSync(join(dir, "requirements.rqml"))).toBe(true);
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain(BEGIN);
    expect(agents).toContain(AGENTS_TEMPLATE.split("\n")[0]); // "# RQML Agent Guidelines"
  });

  it("merges into a pre-existing AGENTS.md instead of skipping it", async () => {
    const original = "# Existing\n\nDo not lose this.\n";
    writeFileSync(join(dir, "AGENTS.md"), original);
    const code = await runInit(["--base-dir", dir]);
    expect(code).toBe(EXIT.OK);
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("Do not lose this.");
    expect(agents).toContain(BEGIN);
    // Running again is a no-op on the file.
    const before = readFileSync(join(dir, "AGENTS.md"), "utf8");
    await runInit(["--base-dir", dir]);
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(before);
  });
});
