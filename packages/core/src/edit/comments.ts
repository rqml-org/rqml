/**
 * Comment masking for textual XML edits. The textual mutation primitives
 * (edit/link.ts, edit/migrate.ts) locate spans with regexes over the raw
 * document; without masking, an edge id inside an XML comment (the natural
 * "disable an edge, keep it for reference" pattern) matches before the live
 * edge and the edit lands inside the comment — silently, since comment
 * content is invisible to reparse, integrity, and XSD validation alike.
 *
 * `maskComments` blanks the INTERIOR of every `<!-- … -->` with spaces while
 * preserving byte offsets exactly, so match indices found on the masked text
 * can be applied directly to the original.
 */
export function maskComments(xml: string): string {
  let out = "";
  let cursor = 0;
  for (;;) {
    const open = xml.indexOf("<!--", cursor);
    if (open < 0) {
      out += xml.slice(cursor);
      return out;
    }
    const close = xml.indexOf("-->", open + 4);
    // An unterminated comment masks to the end of the document — the parser
    // will reject the document anyway; never let a regex read into it.
    const interiorEnd = close < 0 ? xml.length : close;
    out += xml.slice(cursor, open + 4);
    out += xml.slice(open + 4, interiorEnd).replace(/[^\n]/g, " ");
    if (close < 0) return out;
    out += "-->";
    cursor = close + 3;
  }
}
