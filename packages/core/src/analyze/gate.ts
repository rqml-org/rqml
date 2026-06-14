/**
 * Approval-before-implementation verdict (REQ-CORE-APPROVAL-VERDICT) and the
 * deterministic gate primitive (REQ-ENFORCE-APPROVAL-GATE): identify
 * implementation linked to requirements that are not approved, so external
 * control loops (editor hooks, agent hooks, CI) can block it — with no language
 * model in the verdict path.
 *
 * It is the premature-implementation finding of {@link computeCoverage}
 * (REQ-CORE-STATUS-AWARE) enriched with the implementing artifact's URI and,
 * optionally, scoped to a set of changed paths so a pre-edit hook only blocks
 * the edit at hand. Pure and deterministic; findings are sorted by edge id.
 */

import { computeCoverage } from "../check/coverage.js";
import type { RqmlDocument } from "../model/types.js";

export interface GateFinding {
  /** The implements edge whose requirement endpoint is not approved. */
  edgeId: string;
  /** The non-approved requirement the edge targets. */
  requirementId: string;
  /** The implementing artifact's external locator URI, when present. */
  uri?: string;
}

export interface GateVerdict {
  /** True when at least one finding remains after filtering. */
  blocked: boolean;
  findings: GateFinding[];
}

export interface GateOptions {
  /**
   * Restrict findings to implements edges whose external locator path matches
   * one of these paths (the `#fragment` is ignored). Omit to consider all.
   */
  changedPaths?: string[];
}

function pathOf(uri: string): string {
  const hash = uri.indexOf("#");
  return hash >= 0 ? uri.slice(0, hash) : uri;
}

export function approvalGate(doc: RqmlDocument, opts: GateOptions = {}): GateVerdict {
  const cov = computeCoverage(doc);
  const changed = opts.changedPaths?.filter((p) => p.length > 0);

  const findings: GateFinding[] = [];
  for (const premature of cov.prematureImplementations) {
    const edge = doc.trace.find((e) => e.id === premature.edgeId);
    let uri: string | undefined;
    if (edge) {
      const external =
        edge.from.kind !== "local"
          ? edge.from
          : edge.to.kind !== "local"
            ? edge.to
            : undefined;
      uri = external?.uri;
    }

    if (changed && changed.length > 0) {
      if (uri === undefined) continue;
      const p = pathOf(uri);
      const hit = changed.some((c) => p === c || p.endsWith(c) || c.endsWith(p));
      if (!hit) continue;
    }

    findings.push(
      uri !== undefined
        ? { edgeId: premature.edgeId, requirementId: premature.requirementId, uri }
        : { edgeId: premature.edgeId, requirementId: premature.requirementId },
    );
  }
  findings.sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  return { blocked: findings.length > 0, findings };
}
