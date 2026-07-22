import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic } from "../model/diagnostic.js";
import type { RqmlDocument } from "../model/types.js";
import { fragmentHashForUri, fragmentOf } from "./fragment.js";

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
 * last approved, per REQ-CORE-DRIFT).
 *
 * `context-changed` is the one non-`present` status that is not drift: the file
 * changed, but the locator names a fragment whose content is provably identical,
 * so the declared evidence did not move (REQ-CORE-DRIFT-SCOPE). It can only ever
 * soften an alarm the whole-file hash already raised.
 */
export type ArtifactStatus = "present" | "missing" | "changed" | "context-changed";

export interface DriftFinding extends ImplementsLink {
  status: Exclude<ArtifactStatus, "present">;
}

export interface DriftReport {
  /** Every `implements` link with an external endpoint, sorted by edge id. */
  links: ImplementsLink[];
  /** Links whose artifact is missing or changed, sorted by edge id. Drift. */
  drifted: DriftFinding[];
  /**
   * Links whose file changed around an unchanged fragment, sorted by edge id.
   * Kept out of {@link drifted} so existing consumers' blocking logic is
   * unchanged; callers that want the stricter reading (certified) block on this
   * list as well (REQ-CORE-DRIFT-SCOPE).
   */
  contextChanged: DriftFinding[];
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
 * Recorded content hashes per implements-edge id, written when a link is
 * created or its requirement approved (REQ-CORE-DRIFT-BASELINE).
 *
 * Values stay flat strings — see {@link decodeBaselineEntry} for why the
 * fragment-scoped form is a prefixed string rather than a nested object.
 */
export type DriftBaseline = Record<string, string>;

/** Conventional baseline location, relative to the project base directory. */
export const BASELINE_PATH = ".rqml/baseline.json";

/** What one baseline value records about an artifact. */
export interface BaselineEntry {
  /** sha256 of the whole file: always present, always the detector. */
  fileHash: string;
  /** sha256 of the fragment's canonical content, when the locator named one. */
  spanHash?: string;
}

/** Marks a value that carries a fragment hash as well as a file hash. */
const SCOPED_PREFIX = "f1:";
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Render a baseline entry. Whole-file scope keeps the bare hash it has always
 * been, so no existing baseline needs migrating and no existing reader changes.
 */
export function encodeBaselineEntry(entry: BaselineEntry): string {
  return entry.spanHash === undefined
    ? entry.fileHash
    : `${SCOPED_PREFIX}${entry.spanHash}:${entry.fileHash}`;
}

/**
 * Read a baseline value, or `undefined` when it is not a form this version
 * understands — which callers must treat as drift, never as a pass.
 *
 * The scoped form is a prefixed string rather than a nested object so that an
 * older `@rqml/core` degrades safely: {@link loadBaseline} keeps only string
 * values, so an object envelope would be dropped, leaving that edge with no
 * recorded hash at all and reporting it as present. A string it cannot parse
 * simply fails to equal the file's sha256, and the edge is reported as changed
 * (ADR-0018).
 */
export function decodeBaselineEntry(value: string): BaselineEntry | undefined {
  if (SHA256_HEX.test(value)) return { fileHash: value };
  if (!value.startsWith(SCOPED_PREFIX)) return undefined;
  const [spanHash, fileHash, ...extra] = value.slice(SCOPED_PREFIX.length).split(":");
  if (extra.length > 0 || spanHash === undefined || fileHash === undefined)
    return undefined;
  if (!SHA256_HEX.test(spanHash) || !SHA256_HEX.test(fileHash)) return undefined;
  return { fileHash, spanHash };
}

function hashFileAt(filePath: string): string | undefined {
  try {
    return createHash("sha256").update(readFileSync(filePath)).digest("hex");
  } catch {
    return undefined;
  }
}

/**
 * Everything worth recording about one artifact: the whole-file hash, plus the
 * fragment hash when the locator names a fragment that resolves exactly.
 */
function measure(uri: string, filePath: string): BaselineEntry | undefined {
  const fileHash = hashFileAt(filePath);
  if (fileHash === undefined) return undefined;
  const spanHash = fragmentHashForUri(uri, filePath);
  return spanHash === undefined ? { fileHash } : { fileHash, spanHash };
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
    const entry = measure(link.uri, filePath);
    if (entry !== undefined) baseline[link.edgeId] = encodeBaselineEntry(entry);
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

    // No recorded hash means the link was never approved against a baseline;
    // existence is all this run can honestly assert.
    const recorded = baseline?.[link.edgeId];
    if (recorded === undefined) return "present";

    // Past this point a hash was recorded, so every uncertainty is drift: a
    // value written by a newer version, or a file that exists but cannot be
    // read, is precisely when a silent pass would be most misleading.
    const entry = decodeBaselineEntry(recorded);
    if (entry === undefined) return "changed";
    const current = hashFileAt(filePath);
    if (current === undefined) return "changed";
    if (current === entry.fileHash) return "present";

    // The file changed. Only a fragment recorded at approval time can narrow
    // that, and only when it still resolves to identical content today.
    if (entry.spanHash === undefined) return "changed";
    const span = fragmentHashForUri(link.uri, filePath);
    if (span === undefined) return "changed";
    return span === entry.spanHash ? "context-changed" : "changed";
  };
}

function diagnosticFor(link: ImplementsLink, status: DriftFinding["status"]): Diagnostic {
  if (status === "missing") {
    return {
      source: "drift",
      severity: "error",
      rule: "missing-implementation",
      message: `implements edge "${link.edgeId}" points at "${link.uri}", which does not exist.`,
    };
  }
  if (status === "changed") {
    return {
      source: "drift",
      severity: "error",
      rule: "changed-implementation",
      message: `implements edge "${link.edgeId}" points at "${link.uri}", which has changed since approval.`,
    };
  }
  return {
    source: "drift",
    severity: "warning",
    rule: "context-changed-implementation",
    message: `implements edge "${link.edgeId}" points at "${link.uri}": the file changed, but the "${fragmentOf(link.uri) ?? ""}" fragment it names did not, so this is not implementation drift. Run \`rqml link --refresh ${link.edgeId}\` to re-record the file hash and clear the notice.`,
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
  const contextChanged: DriftFinding[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const link of links) {
    const status = resolve(link);
    if (status === "present") continue;
    const finding: DriftFinding = { ...link, status };
    if (status === "context-changed") contextChanged.push(finding);
    else drifted.push(finding);
    diagnostics.push(diagnosticFor(link, status));
  }

  return { links, drifted, contextChanged, diagnostics };
}
