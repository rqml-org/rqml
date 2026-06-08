import type { RqmlDocument } from "../model/types.js";

/**
 * Forward-compatibility stash, keyed by the parsed document. Now that every
 * section of the schema is modeled, this holds only what the model does not
 * recognize: unknown root attributes and unknown top-level elements (e.g. a
 * section added by a newer schema). The serializer re-emits these verbatim so a
 * parse → serialize round-trip of a forward-version document does not silently
 * drop content. For fully-modeled documents the stash is empty, and documents
 * built by hand simply have no entry.
 */
const rawSections = new WeakMap<RqmlDocument, Record<string, unknown>>();

export function setRawSections(
  doc: RqmlDocument,
  sections: Record<string, unknown>,
): void {
  rawSections.set(doc, sections);
}

export function getRawSections(doc: RqmlDocument): Record<string, unknown> | undefined {
  return rawSections.get(doc);
}
