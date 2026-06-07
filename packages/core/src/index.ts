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
export { checkIntegrity } from "./analyze/integrity.js";

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

export {
  computeCoverage,
  detectDrift,
  implementsLinks,
  type ArtifactCoverage,
  type ArtifactStatus,
  type CoverageReport,
  type DriftFinding,
  type DriftOptions,
  type DriftReport,
  type ImplementsLink,
} from "./check/index.js";
