/**
 * Traceability matrix derivation (REQ-CORE-MATRIX): one row per requirement,
 * carrying its lifecycle status, the goals it satisfies, the code that
 * implements it, the tests that verify it, and the coverage warnings on it.
 *
 * It is a presentation of {@link computeCoverage} plus resolved endpoint titles
 * from {@link resolveTrace}/{@link collectTitles} — derived once here so the
 * CLI, the MCP server, and the editor render one source and never disagree
 * about spec health (REQ-CORE-API, REQ-MCP-PARITY). Pure and deterministic:
 * rows follow coverage's sorted requirement order and every cell is stable.
 */

import { computeCoverage } from "../check/coverage.js";
import { collectTitles } from "../export/outline.js";
import { type RqmlDocument, allRequirements } from "../model/types.js";
import { type ResolvedEndpoint, resolveTrace } from "../trace/index.js";

/** A reference to a goal, a code artifact, or a test from a matrix row. */
export interface MatrixRef {
  /** Local id, or the URI (doc locators as `uri#id`) for external targets. */
  id: string;
  title?: string;
  /** True when the reference points at a doc/external artifact, not a local id. */
  external?: boolean;
  /** True when a local reference resolves to no declared element. */
  broken?: boolean;
}

export type VerificationStatus = "verified" | "unverified";
export type ImplementationStatus = "implemented" | "unimplemented" | "premature";

/** Stable warning codes a row can carry, suitable for filtering. */
export type MatrixWarning =
  | "unverified"
  | "unimplemented"
  | "orphan"
  | "premature"
  | "broken-trace";

export interface MatrixRow {
  id: string;
  title: string;
  /** Requirement type (FR / NFR / IR / DR / SR / CR / PR / UXR / OR). */
  type: string;
  /** Lifecycle status (draft / review / approved / deprecated). */
  status: string;
  priority?: string;
  /** Upstream goals/scenarios this requirement satisfies (outgoing satisfies). */
  goals: MatrixRef[];
  /** Code artifacts implementing this requirement (incoming implements). */
  implementations: MatrixRef[];
  /** Tests verifying this requirement (outgoing verifiedBy). */
  tests: MatrixRef[];
  verification: VerificationStatus;
  implementation: ImplementationStatus;
  warnings: MatrixWarning[];
}

export interface MatrixSummary {
  total: number;
  verified: number;
  unverified: number;
  implemented: number;
  unimplemented: number;
  premature: number;
  orphans: number;
  brokenTraces: number;
}

export interface MatrixReport {
  rows: MatrixRow[];
  summary: MatrixSummary;
}

/** Optional row selection. A row is kept only if it matches every set filter. */
export interface MatrixFilter {
  /** Keep rows whose requirement status is in this set. */
  status?: string[];
  /** Keep rows whose requirement type is in this set. */
  type?: string[];
  /** Keep rows carrying at least one of these warning codes. */
  warning?: string[];
}

function refFromEndpoint(
  ep: ResolvedEndpoint,
  titleById: Map<string, string>,
): MatrixRef {
  const loc = ep.locator;
  if (loc.kind === "local") {
    const ref: MatrixRef = { id: loc.id };
    const title = ep.requirement?.title ?? loc.title ?? titleById.get(loc.id);
    if (title !== undefined) ref.title = title;
    if (ep.target === undefined) ref.broken = true;
    return ref;
  }
  const ref: MatrixRef = {
    id: loc.kind === "doc" ? `${loc.uri}#${loc.id}` : loc.uri,
    external: true,
  };
  if (loc.title !== undefined) ref.title = loc.title;
  return ref;
}

function matches(row: MatrixRow, filter: MatrixFilter | undefined): boolean {
  if (filter === undefined) return true;
  if (filter.status && !filter.status.includes(row.status)) return false;
  if (filter.type && !filter.type.includes(row.type)) return false;
  if (
    filter.warning &&
    !filter.warning.some((w) => row.warnings.includes(w as MatrixWarning))
  )
    return false;
  return true;
}

/**
 * Build the traceability matrix for a parsed document, optionally filtered.
 * The summary counts the rows actually included.
 */
export function buildMatrix(doc: RqmlDocument, filter?: MatrixFilter): MatrixReport {
  const cov = computeCoverage(doc);
  const reqById = new Map(allRequirements(doc).map((r) => [r.id, r]));
  const titleById = collectTitles(doc);
  const edgeById = new Map(resolveTrace(doc).edges.map((re) => [re.edge.id, re]));

  const unverified = new Set(cov.unverifiedRequirements);
  const unimplemented = new Set(cov.unimplementedRequirements);
  const orphans = new Set(cov.orphanRequirements);
  const premature = new Set(cov.prematureImplementations.map((p) => p.requirementId));

  const rows: MatrixRow[] = [];
  // cov.requirements is already sorted by requirement id (deterministic).
  for (const ac of cov.requirements) {
    const req = reqById.get(ac.id);
    if (req === undefined) continue;

    const goals = (ac.outgoing.satisfies ?? []).flatMap((edgeId) => {
      const re = edgeById.get(edgeId);
      return re ? [refFromEndpoint(re.to, titleById)] : [];
    });
    const implementations = (ac.incoming.implements ?? []).flatMap((edgeId) => {
      const re = edgeById.get(edgeId);
      return re ? [refFromEndpoint(re.from, titleById)] : [];
    });
    const tests = (ac.outgoing.verifiedBy ?? []).flatMap((edgeId) => {
      const re = edgeById.get(edgeId);
      return re ? [refFromEndpoint(re.to, titleById)] : [];
    });

    const verification: VerificationStatus = unverified.has(ac.id)
      ? "unverified"
      : "verified";
    const implementation: ImplementationStatus = premature.has(ac.id)
      ? "premature"
      : unimplemented.has(ac.id)
        ? "unimplemented"
        : "implemented";

    const warnings: MatrixWarning[] = [];
    if (unverified.has(ac.id)) warnings.push("unverified");
    if (unimplemented.has(ac.id)) warnings.push("unimplemented");
    if (orphans.has(ac.id)) warnings.push("orphan");
    if (premature.has(ac.id)) warnings.push("premature");
    if ([...goals, ...implementations, ...tests].some((r) => r.broken))
      warnings.push("broken-trace");

    const row: MatrixRow = {
      id: ac.id,
      title: req.title,
      type: req.type,
      status: req.status ?? "draft",
      goals,
      implementations,
      tests,
      verification,
      implementation,
      warnings,
    };
    if (req.priority !== undefined) row.priority = req.priority;
    rows.push(row);
  }

  const kept = rows.filter((r) => matches(r, filter));
  const summary: MatrixSummary = {
    total: kept.length,
    verified: kept.filter((r) => r.verification === "verified").length,
    unverified: kept.filter((r) => r.verification === "unverified").length,
    implemented: kept.filter((r) => r.implementation === "implemented").length,
    unimplemented: kept.filter((r) => r.implementation === "unimplemented").length,
    premature: kept.filter((r) => r.implementation === "premature").length,
    orphans: kept.filter((r) => r.warnings.includes("orphan")).length,
    brokenTraces: kept.filter((r) => r.warnings.includes("broken-trace")).length,
  };

  return { rows: kept, summary };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function refLabel(r: MatrixRef): string {
  const base = r.title !== undefined ? `${r.id} (${r.title})` : r.id;
  return r.broken ? `${base} [broken]` : base;
}

/** Render a {@link MatrixReport} to a deterministic markdown table + summary. */
export function matrixToMarkdown(report: MatrixReport): string {
  const s = report.summary;
  const lines: string[] = [
    "# Traceability matrix",
    "",
    `- **Requirements:** ${s.total}`,
    `- **Verified:** ${s.verified} · **Unverified:** ${s.unverified}`,
    `- **Implemented:** ${s.implemented} · **Unimplemented:** ${s.unimplemented} · **Premature:** ${s.premature}`,
    `- **Orphans:** ${s.orphans} · **Broken traces:** ${s.brokenTraces}`,
    "",
    "| ID | Title | Type | Status | Verify | Impl | Goals | Implemented by | Verified by | Warnings |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of report.rows) {
    const cells = [
      row.id,
      row.title,
      row.type,
      row.status,
      row.verification,
      row.implementation,
      row.goals.map(refLabel).join(", "),
      row.implementations.map(refLabel).join(", "),
      row.tests.map(refLabel).join(", "),
      row.warnings.join(", "),
    ].map(escapeCell);
    lines.push(`| ${cells.join(" | ")} |`);
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return `${lines.join("\n")}\n`;
}
