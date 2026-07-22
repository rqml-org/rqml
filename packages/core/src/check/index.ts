/**
 * Deterministic spec checks over a parsed RQML model: coverage of the trace
 * graph (REQ-CORE-COVERAGE) and spec/implementation drift (REQ-CORE-DRIFT).
 * Both are pure functions of their inputs and invoke no language model
 * (REQ-CORE-NO-LLM), so they can back a reproducible enforcement gate.
 */
export {
  computeCoverage,
  type ArtifactCoverage,
  type CoverageReport,
  type PrematureImplementation,
} from "./coverage.js";
export {
  BASELINE_PATH,
  computeBaseline,
  decodeBaselineEntry,
  detectDrift,
  encodeBaselineEntry,
  implementsLinks,
  loadBaseline,
  saveBaseline,
  type ArtifactStatus,
  type BaselineEntry,
  type DriftBaseline,
  type DriftFinding,
  type DriftOptions,
  type DriftReport,
  type ImplementsLink,
} from "./drift.js";
export {
  canonicalJson,
  fragmentHashAt,
  fragmentMediaType,
  fragmentOf,
  hasDuplicateKeys,
  parseFragmentPointer,
  resolveJsonFragment,
  type FragmentHash,
  type FragmentResolution,
} from "./fragment.js";
