/**
 * Deterministic markdown rendering of a DocumentOutline. Pure: no XML, no WASM.
 * `toMarkdown(doc)` is the one-call convenience used by export pipelines; it is
 * exactly `outlineToMarkdown(buildOutline(doc))`.
 */

import type { RqmlDocument } from "../model/types.js";
import {
  buildOutline,
  type DocumentOutline,
  type OutlineField,
  type OutlineNode,
} from "./outline.js";

export interface MarkdownOptions {
  /** Include the docId/version/status metadata line under the title (default true). */
  includeMetadata?: boolean;
  /** Render trace edges as a table rather than nested blocks (default true). */
  traceAsTable?: boolean;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fieldValue(fields: OutlineField[], label: string): string {
  return fields.find((f) => f.label === label)?.value ?? "";
}

function renderTraceTable(nodes: OutlineNode[]): string[] {
  const lines: string[] = [
    "| ID | Type | From | To | Status | Confidence |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const n of nodes) {
    const cells = [
      n.id ?? "",
      fieldValue(n.fields, "Type"),
      fieldValue(n.fields, "From"),
      fieldValue(n.fields, "To"),
      fieldValue(n.fields, "Status"),
      fieldValue(n.fields, "Confidence"),
    ].map(escapeCell);
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines;
}

function renderNode(node: OutlineNode, depth: number, lines: string[]): void {
  const heading = "#".repeat(Math.min(depth, 6));
  const idSuffix = node.id !== undefined ? ` \`${node.id}\`` : "";
  lines.push(`${heading} ${node.title}${idSuffix}`);
  lines.push("");
  for (const f of node.fields) {
    lines.push(`- **${f.label}:** ${f.value}`);
  }
  if (node.refs && node.refs.length > 0) {
    for (const r of node.refs) {
      const title = r.targetTitle !== undefined ? ` (${r.targetTitle})` : "";
      const flag = r.resolved ? "" : " [unresolved]";
      lines.push(`- _${r.relation}_ → \`${r.targetId}\`${title}${flag}`);
    }
  }
  if (node.fields.length > 0 || (node.refs && node.refs.length > 0)) {
    lines.push("");
  }
  for (const child of node.children ?? []) {
    renderNode(child, depth + 1, lines);
  }
}

/**
 * Render a {@link DocumentOutline} to deterministic markdown: a title and
 * metadata line, then each section as a heading with its element blocks, and the
 * trace section as a resolved `| ID | Type | From | To | … |` table (unless
 * {@link MarkdownOptions.traceAsTable} is false).
 */
export function outlineToMarkdown(
  outline: DocumentOutline,
  opts: MarkdownOptions = {},
): string {
  const includeMetadata = opts.includeMetadata ?? true;
  const traceAsTable = opts.traceAsTable ?? true;
  const lines: string[] = [];

  lines.push(`# ${outline.title}`);
  lines.push("");
  if (includeMetadata) {
    lines.push(
      `- **System:** ${outline.system}`,
      `- **Document:** ${outline.docId} (v${outline.version}, ${outline.status})`,
    );
    lines.push("");
  }
  if (outline.summary !== undefined) {
    lines.push(outline.summary, "");
  }

  for (const section of outline.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const f of section.fields) {
      lines.push(`- **${f.label}:** ${f.value}`);
    }
    if (section.fields.length > 0) lines.push("");

    const children = section.children ?? [];
    const isTrace =
      traceAsTable &&
      children.length > 0 &&
      children.every((c) => c.kind === "edge");
    if (isTrace) {
      lines.push(...renderTraceTable(children));
      lines.push("");
    } else {
      for (const child of children) renderNode(child, 3, lines);
    }
  }

  // Collapse trailing blank lines to exactly one terminal newline.
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return `${lines.join("\n")}\n`;
}

/**
 * One-call convenience that renders a document straight to markdown. Exactly
 * `outlineToMarkdown(buildOutline(doc), opts)` — build the {@link DocumentOutline}
 * yourself if you also need it in another form.
 */
export function toMarkdown(
  doc: RqmlDocument,
  opts: MarkdownOptions = {},
): string {
  return outlineToMarkdown(buildOutline(doc), opts);
}
