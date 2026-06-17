/**
 * Spec discovery: which `.rqml` spec governs a path, and enumerating every
 * governing spec beneath a root (REQ-CORE-SPEC-DISCOVERY, ADR-0012).
 *
 * Governance is by directory subtree: a spec governs the directory it sits in
 * and every subdirectory beneath it, except subtrees taken over by a nested
 * spec, and never a parent directory. Equivalently, a path is governed by the
 * spec in its nearest ancestor directory (its own, else the closest above it).
 * No content is inherited or merged across a nested-spec boundary.
 *
 * This module is pure filesystem — no git binary, no network, no WASM — so it
 * stays in the dependency-clean `.` entry (REQ-CORE-DEPS, REQ-CORE-NO-LLM).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

/** The conventional primary spec filename, preferred when a directory has several. */
export const PREFERRED_SPEC_NAME = "requirements.rqml";

/** Directories never descended into when enumerating specs. */
const DEFAULT_IGNORED_DIRS = new Set(["node_modules"]);

export interface ResolveOptions {
  /**
   * Upper boundary of the upward walk: resolution never inspects a directory
   * above `root`. When omitted, the boundary is the nearest ancestor holding a
   * VCS marker (`.git`/`.hg`), else the filesystem root.
   */
  root?: string;
}

export interface DiscoverOptions {
  /**
   * Return `true` to skip a directory (and its subtree) during enumeration, by
   * its base name and absolute path. Applied on top of the built-in skips
   * (`node_modules` and dot-directories). Callers layer ignore rules here —
   * e.g. the CLI can pass a `.gitignore`-aware predicate.
   */
  ignore?: (name: string, fullPath: string) => boolean;
}

/** A governing spec and the directory whose subtree it owns. Both absolute. */
export interface DiscoveredSpec {
  specPath: string;
  dir: string;
}

/** A directory holding several `*.rqml` files and no `requirements.rqml`. */
export interface AmbiguousDir {
  dir: string;
  /** Sorted base names of the competing `*.rqml` files. */
  candidates: string[];
}

/** Outcome of resolving the single spec that governs a path. */
export type SpecResolution =
  | { kind: "resolved"; specPath: string; dir: string }
  | { kind: "none" }
  | { kind: "ambiguous"; dir: string; candidates: string[] };

/** Outcome of enumerating governing specs beneath a root. */
export interface DiscoveryReport {
  specs: DiscoveredSpec[];
  ambiguous: AmbiguousDir[];
}

type DirClassification =
  | { kind: "resolved"; name: string }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: string[] };

/**
 * The per-directory naming rule: a directory's spec is `requirements.rqml` if
 * present, else the sole `*.rqml`; several `*.rqml` and no `requirements.rqml`
 * is ambiguous (report, never guess — CRIT-DISCOVERY-AMBIGUOUS). The `.rqml/`
 * governance directory is excluded because only regular files count.
 */
function classifySpecDir(specNames: string[]): DirClassification {
  if (specNames.length === 0) return { kind: "none" };
  if (specNames.includes(PREFERRED_SPEC_NAME)) {
    return { kind: "resolved", name: PREFERRED_SPEC_NAME };
  }
  if (specNames.length === 1) return { kind: "resolved", name: specNames[0] as string };
  return { kind: "ambiguous", candidates: specNames };
}

/** Directory entries of `dir`, or `[]` when it cannot be read. */
function readDirEntries(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * True for a regular `*.rqml` spec file. Excludes the `.rqml/` governance
 * directory (only regular files count) and a bare `.rqml` file with no base name.
 */
function isSpecFile(entry: { isFile(): boolean; name: string }): boolean {
  return (
    entry.isFile() && entry.name.length > ".rqml".length && entry.name.endsWith(".rqml")
  );
}

/** Sorted base names of regular `*.rqml` files directly in `dir` (never the `.rqml/` dir). */
function specFilesIn(dir: string): string[] {
  return readDirEntries(dir)
    .filter(isSpecFile)
    .map((e) => e.name)
    .sort();
}

/** The nearest ancestor of `fromDir` (inclusive) holding a `.git`/`.hg` marker, else the filesystem root. */
function vcsBoundary(fromDir: string): string {
  let dir = fromDir;
  while (true) {
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, ".hg"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
}

/** Normalize a path to the directory the walk starts from: a file resolves to its directory. */
function startDirOf(fromPath: string): string {
  const abs = resolve(fromPath);
  try {
    return statSync(abs).isDirectory() ? abs : dirname(abs);
  } catch {
    // Non-existent path (e.g. a file about to be created): treat it as a file.
    return dirname(abs);
  }
}

/**
 * Resolve the spec governing `fromPath` by walking upward to the nearest
 * directory that holds a spec, stopping at the boundary (REQ-CORE-SPEC-DISCOVERY).
 * `fromPath` may be a file or a directory. Returns `none` when no spec is found
 * up to and including the boundary, or `ambiguous` when the governing directory
 * holds several `*.rqml` and no `requirements.rqml`.
 */
export function resolveGoverningSpec(
  fromPath: string,
  options: ResolveOptions = {},
): SpecResolution {
  const start = startDirOf(fromPath);
  const bounded = options.root !== undefined;
  const boundary = bounded ? resolve(options.root as string) : vcsBoundary(start);

  let dir = start;
  while (true) {
    // With an explicit root, never inspect a directory outside it — including the
    // case where `fromPath` itself is not a descendant of `root` (the upward walk
    // would otherwise never meet `boundary` and climb to the filesystem root).
    if (bounded && dir !== boundary && !dir.startsWith(boundary + sep)) {
      return { kind: "none" };
    }
    const classified = classifySpecDir(specFilesIn(dir));
    if (classified.kind === "resolved") {
      return { kind: "resolved", specPath: join(dir, classified.name), dir };
    }
    if (classified.kind === "ambiguous") {
      return { kind: "ambiguous", dir, candidates: classified.candidates };
    }
    if (dir === boundary) return { kind: "none" };
    const parent = dirname(dir);
    if (parent === dir) return { kind: "none" };
    dir = parent;
  }
}

/**
 * Enumerate every governing spec in the tree rooted at `root`
 * (REQ-CORE-SPEC-DISCOVERY). Each directory contributes at most one unit spec
 * by the naming rule; directories with several competing `*.rqml` are returned
 * as `ambiguous` rather than guessed. `node_modules` and dot-directories (the
 * `.rqml/` governance folder, `.git`, …) are never descended into; callers can
 * skip more via `options.ignore`. Results are sorted by directory for
 * determinism.
 */
export function discoverSpecs(
  root: string,
  options: DiscoverOptions = {},
): DiscoveryReport {
  const rootAbs = resolve(root);
  const specs: DiscoveredSpec[] = [];
  const ambiguous: AmbiguousDir[] = [];

  const walk = (dir: string): void => {
    const entries = readDirEntries(dir);
    const specNames = entries
      .filter(isSpecFile)
      .map((e) => e.name)
      .sort();
    const classified = classifySpecDir(specNames);
    if (classified.kind === "resolved") {
      specs.push({ specPath: join(dir, classified.name), dir });
    } else if (classified.kind === "ambiguous") {
      ambiguous.push({ dir, candidates: classified.candidates });
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || DEFAULT_IGNORED_DIRS.has(entry.name)) continue;
      const child = join(dir, entry.name);
      if (options.ignore?.(entry.name, child)) continue;
      walk(child);
    }
  };

  walk(rootAbs);
  // Locale-independent (code-point) ordering keeps results deterministic across
  // machines and locales, unlike String.prototype.localeCompare.
  const byDir = (a: DiscoveredSpec | AmbiguousDir, b: DiscoveredSpec | AmbiguousDir) =>
    a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0;
  specs.sort(byDir);
  ambiguous.sort(byDir);
  return { specs, ambiguous };
}
