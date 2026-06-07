import {
  XmlDocument,
  XmlParseError,
  XmlValidateError,
  XsdValidator,
  type ErrorDetail,
} from "libxml2-wasm";
import type { Diagnostic, ValidationResult } from "../model/diagnostic.js";
import {
  DEFAULT_SCHEMA_VERSION,
  extractDocumentVersion,
  schemaFor,
  supportedSchemaVersions,
} from "./version.js";

export { supportedSchemaVersions } from "./version.js";

export interface ValidateOptions {
  /**
   * Force a specific schema version instead of dispatching on the document's
   * own `version` attribute.
   */
  schemaVersion?: string;
}

function detailToDiagnostic(detail: ErrorDetail): Diagnostic {
  const diag: Diagnostic = {
    source: "validate",
    severity: "error",
    message: detail.message.trim(),
  };
  if (typeof detail.line === "number" && detail.line > 0) diag.line = detail.line;
  if (typeof detail.col === "number" && detail.col > 0) diag.column = detail.col;
  return diag;
}

/**
 * Validate a .rqml document string against the bundled XSD schema.
 *
 * The schema version is taken from the document's `version` attribute unless
 * overridden via {@link ValidateOptions.schemaVersion}. Importing this module
 * initializes the libxml2 WASM runtime; the main entry point does not, so the
 * WASM cost is only paid by consumers that actually validate.
 */
export function validate(xml: string, options?: ValidateOptions): ValidationResult {
  const version =
    options?.schemaVersion ?? extractDocumentVersion(xml) ?? DEFAULT_SCHEMA_VERSION;

  const xsdText = schemaFor(version);
  if (xsdText === undefined) {
    const supported = supportedSchemaVersions().join(", ");
    return {
      valid: false,
      schemaVersion: version,
      diagnostics: [
        {
          source: "validate",
          severity: "error",
          message: `No bundled schema for RQML version "${version}". Supported: ${supported}.`,
        },
      ],
    };
  }

  let xsdDoc: XmlDocument | undefined;
  let validator: XsdValidator | undefined;
  let doc: XmlDocument | undefined;
  try {
    xsdDoc = XmlDocument.fromString(xsdText);
    validator = XsdValidator.fromDoc(xsdDoc);

    try {
      doc = XmlDocument.fromString(xml);
    } catch (e) {
      if (e instanceof XmlParseError) {
        return {
          valid: false,
          schemaVersion: version,
          diagnostics: e.details.map(detailToDiagnostic),
        };
      }
      throw e;
    }

    try {
      validator.validate(doc);
      return { valid: true, schemaVersion: version, diagnostics: [] };
    } catch (e) {
      if (e instanceof XmlValidateError) {
        return {
          valid: false,
          schemaVersion: version,
          diagnostics: e.details.map(detailToDiagnostic),
        };
      }
      throw e;
    }
  } finally {
    doc?.dispose();
    validator?.dispose();
    xsdDoc?.dispose();
  }
}
