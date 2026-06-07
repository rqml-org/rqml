/**
 * @rqml/schema — the single canonical source of every RQML schema version.
 *
 * The XSD text is inlined at build time (tsup `.xsd` text loader) so consumers
 * — the @rqml/core engine, the rqml CLI, the @rqml/mcp server, and the VS Code
 * extension that embeds core — get offline, bundler-friendly validation with no
 * filesystem or network access. The same files under `versions/` are published
 * by the documentation site to the stable `https://rqml.org/schema/<version>/`
 * URLs, so there is exactly one source of truth (REQ-SCHEMA-CANONICAL).
 */
import xsd201 from "../versions/2.0.1/rqml-2.0.1.xsd";
import xsd210 from "../versions/2.1.0/rqml-2.1.0.xsd";
import agentsTemplate from "../templates/AGENTS.md";

/** Supported RQML schema versions, oldest first, newest-supported last. */
export const SCHEMA_VERSIONS = ["2.0.1", "2.1.0"] as const;

/** A version string known to have a bundled schema. */
export type SchemaVersion = (typeof SCHEMA_VERSIONS)[number];

/** Schema version used when a document declares none and none is forced. */
export const DEFAULT_SCHEMA_VERSION: SchemaVersion = "2.1.0";

const SCHEMAS: Record<string, string> = {
  "2.0.1": xsd201,
  "2.1.0": xsd210,
};

/** The default RQML `AGENTS.md` template, published at `https://rqml.org/AGENTS.md`. */
export const AGENTS_TEMPLATE: string = agentsTemplate;

/** Return the inlined XSD text for a version, or `undefined` if unsupported. */
export function resolveSchema(version: string): string | undefined {
  return SCHEMAS[version];
}

/** Versions for which a schema is bundled, newest-supported last. */
export function supportedSchemaVersions(): SchemaVersion[] {
  return [...SCHEMA_VERSIONS];
}

/** Narrow an arbitrary string to a {@link SchemaVersion}. */
export function isSchemaVersion(version: string): version is SchemaVersion {
  return version in SCHEMAS;
}

/** The XML namespace for a schema version (the document's default namespace). */
export function schemaNamespace(version: string): string {
  return `https://rqml.org/schema/${version}`;
}

/**
 * The stable published URL of a version's XSD — the immutable `schemaLocation`
 * contract that documents in the wild resolve against. This is the flat
 * `…/schema/rqml-<version>.xsd` form the serializer emits, not a versioned
 * subdirectory.
 */
export function schemaUrl(version: string): string {
  return `https://rqml.org/schema/rqml-${version}.xsd`;
}
