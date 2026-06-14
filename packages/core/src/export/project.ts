/**
 * Scoped projection (REQ-CORE-PROJECTION): prune a {@link DocumentOutline} to a
 * caller-selected subset — whole sections by title, and/or elements by id —
 * preserving order so the result renders deterministically through
 * {@link outlineToMarkdown}. With no filter the outline is returned unchanged,
 * so the whole-document projection is untouched (ADR-0010).
 *
 * An id keeps its entire subtree, so a package id keeps the whole package while
 * a requirement id keeps just that requirement (with its parent wrappers).
 */

import type { DocumentOutline, OutlineNode } from "./outline.js";

export interface ProjectionFilter {
  /** Keep only top-level sections whose title matches (case-insensitive). */
  sections?: string[];
  /** Keep only elements whose id is in this set, plus the wrappers that contain them. */
  ids?: string[];
}

function pruneById(node: OutlineNode, ids: Set<string>): OutlineNode | undefined {
  if (node.id !== undefined && ids.has(node.id)) return node;
  if (node.children) {
    const kept = node.children
      .map((c) => pruneById(c, ids))
      .filter((c): c is OutlineNode => c !== undefined);
    if (kept.length > 0) return { ...node, children: kept };
  }
  return undefined;
}

/** Return a filtered copy of the outline; the input is not mutated. */
export function projectOutline(
  outline: DocumentOutline,
  filter: ProjectionFilter = {},
): DocumentOutline {
  let sections = outline.sections;
  if (filter.sections && filter.sections.length > 0) {
    const want = new Set(filter.sections.map((s) => s.toLowerCase()));
    sections = sections.filter((s) => want.has(s.title.toLowerCase()));
  }
  if (filter.ids && filter.ids.length > 0) {
    const ids = new Set(filter.ids);
    sections = sections
      .map((s) => pruneById(s, ids))
      .filter((s): s is OutlineNode => s !== undefined);
  }
  return { ...outline, sections };
}
