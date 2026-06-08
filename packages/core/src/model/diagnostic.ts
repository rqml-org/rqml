/** Normalized problem report produced by parsing, validation, lint, or check. */
export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticSource =
  | "parse"
  | "validate"
  | "lint"
  | "trace"
  | "coverage"
  | "drift";

export interface Diagnostic {
  source: DiagnosticSource;
  severity: DiagnosticSeverity;
  message: string;
  /** 1-based line number in the source document, when known. */
  line?: number;
  /** 1-based column number in the source document, when known. */
  column?: number;
  /** Stable rule identifier (lint) or schema/edge id, when applicable. */
  rule?: string;
}

export interface ValidationResult {
  valid: boolean;
  /** Schema version used for validation. */
  schemaVersion: string;
  diagnostics: Diagnostic[];
}
