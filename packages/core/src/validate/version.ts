import {
  DEFAULT_SCHEMA_VERSION as SCHEMA_DEFAULT_VERSION,
  resolveSchema,
  supportedSchemaVersions as schemaVersions,
} from "@rqml/schema";

/**
 * Schema resolution delegates to @rqml/schema, the single canonical source of
 * every bundled XSD (REQ-SCHEMA-CANONICAL). The text is inlined into this
 * package at build time, so validation stays offline with no filesystem or
 * network access.
 */

/** Schema version used when a document declares none and none is forced. */
export const DEFAULT_SCHEMA_VERSION: string = SCHEMA_DEFAULT_VERSION;

/** Return the bundled XSD text for a version, or undefined if unsupported. */
export function schemaFor(version: string): string | undefined {
  return resolveSchema(version);
}

/** Versions for which a schema is bundled, newest-supported last. */
export function supportedSchemaVersions(): string[] {
  return schemaVersions();
}

/**
 * Detect the RQML schema version a document declares, without a full parse.
 *
 * Prefers the default-namespace URI (`xmlns="https://rqml.org/schema/<v>"`),
 * which is the authoritative version marker (REQ-CORE-SCHEMA-DETECT), and falls
 * back to the root `version` attribute for robustness.
 */
export function extractDocumentVersion(xml: string): string | undefined {
  const tag = xml.match(/<rqml\b[^>]*>/);
  if (!tag) return undefined;
  const ns = tag[0].match(/xmlns\s*=\s*"https:\/\/rqml\.org\/schema\/([^"]+)"/);
  if (ns?.[1]) return ns[1];
  const ver = tag[0].match(/\bversion\s*=\s*"([^"]*)"/);
  return ver?.[1];
}
