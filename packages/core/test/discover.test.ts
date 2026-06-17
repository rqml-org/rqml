import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { discoverSpecs, resolveGoverningSpec } from "../src/discover/discover.js";

/**
 * Build a fixture monorepo tree (filenames only — discovery never reads spec
 * content). Returns the absolute root. The root carries a `.git` marker so the
 * default (no explicit `root`) walk has a deterministic boundary.
 *
 *   root/                        .git, requirements.rqml, .rqml/baseline.json
 *     packages/
 *       api/                     requirements.rqml          (nested override)
 *         src/index.ts
 *       web/                     app.rqml                   (sole *.rqml)
 *       shared/src/              (no spec — governed by root)
 *       gov/.rqml/               (.rqml dir only — not a spec)
 *     examples/                  a.rqml, b.rqml             (ambiguous)
 *     node_modules/pkg/          requirements.rqml          (must be skipped)
 */
function makeTree(): string {
  const root = mkdtempSync(join(tmpdir(), "rqml-discover-"));
  const spec = (dir: string, name = "requirements.rqml") => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), "<rqml/>\n");
  };

  mkdirSync(join(root, ".git"), { recursive: true });
  mkdirSync(join(root, ".rqml"), { recursive: true });
  writeFileSync(join(root, ".rqml", "baseline.json"), "{}\n");
  spec(root);

  spec(join(root, "packages", "api"));
  mkdirSync(join(root, "packages", "api", "src"), { recursive: true });
  writeFileSync(join(root, "packages", "api", "src", "index.ts"), "export {};\n");

  spec(join(root, "packages", "web"), "app.rqml");

  mkdirSync(join(root, "packages", "shared", "src"), { recursive: true });
  mkdirSync(join(root, "packages", "gov", ".rqml"), { recursive: true });

  spec(join(root, "examples"), "a.rqml");
  writeFileSync(join(root, "examples", "b.rqml"), "<rqml/>\n");

  spec(join(root, "node_modules", "pkg"));

  return root;
}

let root: string;
beforeAll(() => {
  root = makeTree();
});

describe("resolveGoverningSpec", () => {
  it("nearest wins: a nested spec governs over an ancestor (CRIT-DISCOVERY-NEAREST)", () => {
    const r = resolveGoverningSpec(join(root, "packages", "api", "src", "index.ts"), {
      root,
    });
    expect(r).toEqual({
      kind: "resolved",
      dir: join(root, "packages", "api"),
      specPath: join(root, "packages", "api", "requirements.rqml"),
    });
  });

  it("governs its whole subtree, never a parent (CRIT-DISCOVERY-SUBTREE)", () => {
    // A subdirectory with no nearer spec is governed by the ancestor (root) spec.
    const sub = resolveGoverningSpec(join(root, "packages", "shared", "src"), { root });
    expect(sub).toMatchObject({ kind: "resolved", dir: root });

    // A parent of the api unit does NOT resolve to the api spec.
    const parent = resolveGoverningSpec(join(root, "packages"), { root });
    expect(parent).toMatchObject({ kind: "resolved", dir: root });
    expect(parent).not.toMatchObject({ dir: join(root, "packages", "api") });
  });

  it("reports an ambiguous directory rather than guessing (CRIT-DISCOVERY-AMBIGUOUS)", () => {
    const r = resolveGoverningSpec(join(root, "examples"), { root });
    expect(r).toEqual({
      kind: "ambiguous",
      dir: join(root, "examples"),
      candidates: ["a.rqml", "b.rqml"],
    });
  });

  it("prefers requirements.rqml, else the sole *.rqml", () => {
    expect(resolveGoverningSpec(root, { root })).toMatchObject({
      kind: "resolved",
      specPath: join(root, "requirements.rqml"),
    });
    expect(resolveGoverningSpec(join(root, "packages", "web"), { root })).toMatchObject({
      kind: "resolved",
      specPath: join(root, "packages", "web", "app.rqml"),
    });
  });

  it("never mistakes the .rqml/ governance directory for a spec", () => {
    const govDir = join(root, "packages", "gov");
    expect(resolveGoverningSpec(govDir, { root: govDir })).toEqual({ kind: "none" });
  });

  it("never crosses above the explicit root boundary", () => {
    // shared/ has no spec; with the boundary set at shared, the root spec above
    // is out of reach.
    const r = resolveGoverningSpec(join(root, "packages", "shared", "src"), {
      root: join(root, "packages", "shared"),
    });
    expect(r).toEqual({ kind: "none" });
  });

  it("uses a .git marker as the default boundary and resolves a file or a directory", () => {
    const fromFile = resolveGoverningSpec(
      join(root, "packages", "api", "src", "index.ts"),
    );
    const fromDir = resolveGoverningSpec(join(root, "packages", "api"));
    expect(fromFile).toMatchObject({ dir: join(root, "packages", "api") });
    expect(fromDir).toEqual(fromFile);
  });

  it("stops at the .git boundary and returns none when no spec exists below it", () => {
    const repo = mkdtempSync(join(tmpdir(), "rqml-nospec-"));
    mkdirSync(join(repo, ".git"), { recursive: true });
    mkdirSync(join(repo, "sub"), { recursive: true });
    expect(resolveGoverningSpec(join(repo, "sub"))).toEqual({ kind: "none" });
  });

  it("never escapes the explicit root, even for a path outside it (boundary containment)", () => {
    // packages/api holds a spec, but the boundary here is examples/; a path under
    // api is not within that boundary, so it must resolve to none rather than
    // climbing to api's (out-of-bounds) spec.
    expect(
      resolveGoverningSpec(join(root, "packages", "api", "src", "x.ts"), {
        root: join(root, "examples"),
      }),
    ).toEqual({ kind: "none" });
  });

  it('does not treat a bare ".rqml" file as a spec', () => {
    const d = mkdtempSync(join(tmpdir(), "rqml-bare-"));
    writeFileSync(join(d, ".rqml"), "<rqml/>\n");
    expect(resolveGoverningSpec(d, { root: d })).toEqual({ kind: "none" });
  });
});

describe("discoverSpecs", () => {
  it("enumerates every governing spec, skips node_modules and dot-dirs, reports ambiguity", () => {
    const report = discoverSpecs(root);

    expect(report.specs.map((s) => s.specPath)).toEqual([
      join(root, "requirements.rqml"),
      join(root, "packages", "api", "requirements.rqml"),
      join(root, "packages", "web", "app.rqml"),
    ]);
    // node_modules/pkg/requirements.rqml is never enumerated.
    expect(report.specs.some((s) => s.dir.includes("node_modules"))).toBe(false);
    // The examples/ directory is surfaced as ambiguous, not as a spec.
    expect(report.ambiguous).toEqual([
      { dir: join(root, "examples"), candidates: ["a.rqml", "b.rqml"] },
    ]);
  });

  it("honors the ignore predicate", () => {
    const report = discoverSpecs(root, { ignore: (name) => name === "web" });
    expect(report.specs.some((s) => s.dir.endsWith(join("packages", "web")))).toBe(false);
    expect(report.specs.some((s) => s.dir.endsWith(join("packages", "api")))).toBe(true);
  });
});
