import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic } from "../model/diagnostic.js";
import type { RqmlDocument } from "../model/types.js";

/** An `implements` edge whose code-side endpoint is an external locator. */
export interface ImplementsLink {
  edgeId: string;
  /** The local (requirement) endpoint id, when the edge has one. */
  requirementId?: string;
  /** The external artifact URI: a file, symbol (`path#symbol`), or test URI. */
  uri: string;
}

/**
 * State of a linked artifact. The default filesystem resolver distinguishes
 * `present` from `missing`; a richer resolver with an approval baseline can also
 * return `changed` (the artifact exists but differs since the requirement was
 * last approved, per REQ-CORE-DRIFT). Anything other than `present` is drift.
 */
export type ArtifactStatus = "present" | "missing" | "changed";

export interface DriftFinding extends ImplementsLink {
  status: Exclude<ArtifactStatus, "present">;
}

export interface DriftReport {
  /** Every `implements` link with an external endpoint, sorted by edge id. */
  links: ImplementsLink[];
  /** Links whose artifact is missing or changed, sorted by edge id. */
  drifted: DriftFinding[];
  diagnostics: Diagnostic[];
}

export interface DriftOptions {
  /** Base directory relative `file:`/path locators resolve against. Defaults to `process.cwd()`. */
  baseDir?: string;
  /**
   * Recorded content hashes per implements edge (REQ-CORE-DRIFT-BASELINE).
   * When present, the default resolver reports `changed` for a link whose
   * artifact exists but no longer matches its recorded hash.
   */
  baseline?: DriftBaseline;
  /**
   * Pluggable artifact resolver. Injected in tests and non-filesystem hosts so
   * drift detection stays deterministic and side-effect-free by default
   * (REQ-CORE-DRIFT, REQ-CORE-NO-LLM). Defaults to a filesystem existence check
   * plus a baseline hash comparison when a baseline is provided.
   */
  resolve?: (link: ImplementsLink) => ArtifactStatus;
}

/**
 * Content hashes (sha256 hex) per implements-edge id, recorded when a link is
 * created or its requirement approved (REQ-CORE-DRIFT-BASELINE).
 */
export type DriftBaseline = Record<string, string>;

/** Conventional baseline location, relative to the project base directory. */
export const BASELINE_PATH = ".rqml/baseline.json";

function hashFileAt(filePath: string): string | undefined {
  try {
    return createHash("sha256").update(readFileSync(filePath)).digest("hex");
  } catch {
    return undefined;
  }
}

/**
 * Hash every filesystem-resolvable implements link of the document, producing
 * the baseline that future drift runs compare against. Deterministic for a
 * given document and filesystem state.
 */
export function computeBaseline(
  doc: RqmlDocument,
  options: { baseDir?: string } = {},
): DriftBaseline {
  const baseDir = options.baseDir ?? process.cwd();
  const baseline: DriftBaseline = {};
  for (const link of implementsLinks(doc)) {
    const filePath = filePathFromUri(link.uri, baseDir);
    if (filePath === undefined) continue;
    const hash = hashFileAt(filePath);
    if (hash !== undefined) baseline[link.edgeId] = hash;
  }
  return baseline;
}

/** Read the baseline store under `baseDir`, or `undefined` when absent/invalid. */
export function loadBaseline(baseDir: string): DriftBaseline | undefined {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(join(baseDir, BASELINE_PATH), "utf8"),
    );
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    const out: DriftBaseline = {};
    for (const [edgeId, hash] of Object.entries(parsed)) {
      if (typeof hash === "string") out[edgeId] = hash;
    }
    return out;
  } catch {
    return undefined;
  }
}

/** Write the baseline store with sorted keys so repeated saves diff cleanly. */
export function saveBaseline(baseDir: string, baseline: DriftBaseline): void {
  const path = join(baseDir, BASELINE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  const sorted = Object.fromEntries(
    Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** Extract every `implements` edge that links a requirement to external code. */
export function implementsLinks(doc: RqmlDocument): ImplementsLink[] {
  const out: ImplementsLink[] = [];
  for (const edge of doc.trace) {
    if (edge.type !== "implements") continue;
    const external =
      edge.from.kind === "external"
        ? edge.from
        : edge.to.kind === "external"
          ? edge.to
          : undefined;
    if (external === undefined) continue;
    const local =
      edge.from.kind === "local"
        ? edge.from.id
        : edge.to.kind === "local"
          ? edge.to.id
          : undefined;
    const link: ImplementsLink = { edgeId: edge.id, uri: external.uri };
    if (local !== undefined) link.requirementId = local;
    out.push(link);
  }
  return out.sort((a, b) => a.edgeId.localeCompare(b.edgeId));
}

/**
 * Resolve an artifact URI to a local filesystem path, or `undefined` if the URI
 * is not filesystem-checkable (e.g. `urn:`, `https:`). The fragment of a
 * `path#symbol` locator is dropped — existence is checked at file granularity.
 */
function filePathFromUri(uri: string, baseDir: string): string | undefined {
  const noFragment = uri.split("#")[0] ?? uri;
  if (noFragment.startsWith("file://")) return fileURLToPath(noFragment);
  if (noFragment.startsWith("file:")) {
    const path = noFragment.slice("file:".length);
    return isAbsolute(path) ? path : resolvePath(baseDir, path);
  }
  // A bare relative or absolute path (no scheme).
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(noFragment)) {
    return isAbsolute(noFragment) ? noFragment : resolvePath(baseDir, noFragment);
  }
  return undefined;
}

function filesystemResolver(baseDir: string, baseline?: DriftBaseline) {
  return (link: ImplementsLink): ArtifactStatus => {
    const filePath = filePathFromUri(link.uri, baseDir);
    // Non-filesystem URIs can't be checked offline; treat as present, not drift.
    if (filePath === undefined) return "present";
    if (!existsSync(filePath)) return "missing";
    const recorded = baseline?.[link.edgeId];
    if (recorded !== undefined) {
      const current = hashFileAt(filePath);
      if (current !== undefined && current !== recorded) return "changed";
    }
    return "present";
  };
}

/**
 * Detect spec/implementation drift by resolving the external locators of
 * `implements` edges and reporting links whose artifact is missing or changed
 * (REQ-CORE-DRIFT). Deterministic for a given document, base directory, and
 * resolver.
 */
export function detectDrift(doc: RqmlDocument, options: DriftOptions = {}): DriftReport {
  const baseDir = options.baseDir ?? process.cwd();
  const resolve = options.resolve ?? filesystemResolver(baseDir, options.baseline);

  const links = implementsLinks(doc);
  const drifted: DriftFinding[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const link of links) {
    const status = resolve(link);
    if (status === "present") continue;
    drifted.push({ ...link, status });
    diagnostics.push({
      source: "drift",
      severity: "error",
      rule: status === "missing" ? "missing-implementation" : "changed-implementation",
      message:
        status === "missing"
          ? `implements edge "${link.edgeId}" points at "${link.uri}", which does not exist.`
          : `implements edge "${link.edgeId}" points at "${link.uri}", which has changed since approval.`,
    });
  }

  return { links, drifted, diagnostics };
}
