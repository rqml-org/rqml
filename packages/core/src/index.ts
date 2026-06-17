/**
 * @rqml/core: the canonical TypeScript/JavaScript engine for RQML.
 *
 * This entry is WASM-free. XSD validation lives behind the separate
 * `@rqml/core/validate` entry so the libxml2 WASM runtime is only loaded by
 * consumers that actually validate.
 */

export * from "./model/types.js";
export type {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticSource,
  ValidationResult,
} from "./model/diagnostic.js";

export { parse, type ParseResult } from "./parse/parse.js";
export { serialize } from "./parse/serialize.js";

export { lint, type LintOptions, type Strictness } from "./lint/index.js";
export {
  declaredIdIndex,
  requirementIndex,
  resolveTrace,
  type ResolvedEdge,
  type ResolvedEndpoint,
  type TraceResolution,
} from "./trace/index.js";
export {
  impactOf,
  type ImpactedArtifact,
  type ImpactGroup,
  type ImpactReport,
  type ImpactStep,
} from "./trace/impact.js";
export { checkIntegrity } from "./analyze/integrity.js";
export {
  appendTraceEdge,
  updateTraceEdge,
  type LinkRequest,
  type LinkResult,
  type UpdateLinkRequest,
  type UpdateLinkResult,
} from "./edit/link.js";

export {
  buildOutline,
  type DocumentOutline,
  type OutlineField,
  type OutlineNode,
  type OutlineRef,
} from "./export/outline.js";
export {
  outlineToMarkdown,
  toMarkdown,
  type MarkdownOptions,
} from "./export/markdown.js";
export { projectOutline, type ProjectionFilter } from "./export/project.js";
export {
  setStatus,
  STATUS_VALUES,
  type SetStatusRequest,
  type SetStatusResult,
  type StatusValue,
} from "./edit/status.js";
export {
  approvalGate,
  type GateFinding,
  type GateOptions,
  type GateVerdict,
} from "./analyze/gate.js";
export {
  extractArtifact,
  sliceToMarkdown,
  type ArtifactSlice,
  type SliceEdge,
} from "./export/extract.js";
export {
  SKELETON_KINDS,
  skeleton,
  type SkeletonKind,
  type SkeletonOptions,
} from "./export/skeleton.js";
export {
  buildMatrix,
  matrixToMarkdown,
  type ImplementationStatus,
  type MatrixFilter,
  type MatrixRef,
  type MatrixReport,
  type MatrixRow,
  type MatrixSummary,
  type MatrixWarning,
  type VerificationStatus,
} from "./analyze/matrix.js";

export {
  BASELINE_PATH,
  computeBaseline,
  computeCoverage,
  detectDrift,
  implementsLinks,
  loadBaseline,
  saveBaseline,
  type ArtifactCoverage,
  type ArtifactStatus,
  type CoverageReport,
  type DriftBaseline,
  type DriftFinding,
  type DriftOptions,
  type DriftReport,
  type ImplementsLink,
  type PrematureImplementation,
} from "./check/index.js";

export {
  discoverSpecs,
  PREFERRED_SPEC_NAME,
  resolveGoverningSpec,
  type AmbiguousDir,
  type DiscoveredSpec,
  type DiscoverOptions,
  type DiscoveryReport,
  type ResolveOptions,
  type SpecResolution,
} from "./discover/discover.js";
