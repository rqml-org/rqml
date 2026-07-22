# ADR-0018: Fragment scope downgrades a drift alarm, it never replaces the detector

- Status: Accepted
- Date: 2026-07-22
- Classification: discretionary_design_choice
- Related requirements: REQ-CORE-DRIFT, REQ-CORE-DRIFT-BASELINE, REQ-CORE-NO-LLM, REQ-ENFORCE-DETERMINISM
- Related ADRs: ADR-0003 (deterministic checking), ADR-0017 (compact trace edges)
- Affected components: core (drift, baseline), cli (link, check)

## Context

A drift baseline hashes the whole file at a locator's path. The `#fragment` of
`packages/cli/package.json#bin` is used only to *find* the file — never to
scope the hash. So any edit anywhere in the file drifts an edge that claims to
be about one symbol.

Measured consequence: four consecutive releases turned `main`'s gate red on the
same three edges, because the release bumps `version` in two manifests. Across
one working session roughly twenty-six re-pins were needed, and **none** of them
caught an unintended change. `packages/cli/package.json#bin` has thirteen
whole-file changes in its history and zero changes to the `bin` value.

The cost is not the re-pinning, which is one command. It is that a gate whose
red light is almost always noise trains its readers — increasingly agents — to
re-pin reflexively without reading. That converts the enforcement guarantee
into a ritual, and the one time in fifty that red means "an agent rewrote the
function this requirement is about" it is blessed with the same keystroke.

## Decision drivers

- The enforcement guarantee is the product. Under-detection is categorically
  worse than over-detection: today's behaviour is noisy but never wrong.
- `@rqml/core` is dependency-clean and language-agnostic; it cannot acquire a
  parser per language, and RQML locators may point at any artifact.
- Existing baselines are whole-file hashes in a flat `edgeId → string` map,
  committed across seven repositories.
- An older `@rqml/core` reading a newer baseline must fail loudly, never pass
  silently.

## Options considered

### Option 1: Replace the whole-file hash with a fragment hash
Hash only the span the locator names.

**Pros**
- Removes the noise completely for fragment-scoped edges.

**Cons**
- **Fails open.** A resolver that picks the wrong span produces a stable hash
  over the wrong bytes, so real drift passes silently — the one outcome the
  product cannot afford.
- Invalidates every existing fragment-scoped baseline at once.
- Needs a resolver for TypeScript, JavaScript, XSD and JSON to cover the real
  corpus; git shipped `xfuncname` drivers for ~25 languages over twenty years
  and never wrote one for JS, TS or JSON.

### Option 2: Ignore volatile fields globally (e.g. never hash `version`)
**Pros**
- Cheapest; kills the release noise directly.

**Cons**
- A global semantic carve-out in a standard: "version bytes are never evidence,
  for anyone." Wrong for a user whose requirement genuinely is about a version.

### Option 3: Two hashes; fragment scope only downgrades (chosen)
Store the whole-file hash *and* the fragment hash. The whole-file hash remains
the sole detector. When it fires, the fragment hash is consulted only to decide
whether the change touched the declared evidence.

**Pros**
- **Fails closed.** The layer can only downgrade an alarm it can positively
  prove irrelevant. Unresolvable fragment, unknown media type, malformed file —
  every uncertainty leaves the alarm standing.
- Detection is never weakened: whole-file still runs, unchanged.
- Migration is free — existing bare hashes *are* the file hash.
- Zero cost in the common case: the fragment is resolved only when the file
  hash already differs, so parsing is never on the hot path.

**Cons**
- Two hashes per narrowed edge, and a third outcome for readers to learn.
- A change outside the fragment is reported as advisory rather than blocking,
  which is a real reduction in what blocks (not in what is detected).

## Decision

Adopt **Option 3**, restricted to media types that can be resolved *exactly*.

**Scope is declared by the locator, not inferred.** An edge is narrowed only
when its locator carries a `#fragment` and the media type has defined fragment
semantics. Writing `package.json#bin` is the author asserting that the `bin`
entry is the evidence. An edge with no fragment is never narrowed — which is
why `REQ-CORE-NO-LLM`, a prohibition whose evidence must include
`postinstall`, `peerDependencies`, `optionalDependencies` and
`bundledDependencies`, keeps whole-file evidence automatically. Narrowing that
one to `#dependencies` would blind the product's central "no model in the
engine" claim, and the design forbids it by construction.

**Only JSON in this release.** `JSON.parse` is exact, built in, and dependency
free. TypeScript, JavaScript and XSD fragments are *not* interpreted: those
edges keep whole-file evidence, i.e. exactly today's behaviour. All three
recurring incidents are JSON manifests, so the tractable tier is also the
paying one.

**Outcomes.** `present` (file unchanged) · `changed` — the declared evidence
changed, blocking, as today · `context-changed` — the file changed and the
declared evidence is byte-identical, advisory at standard strictness and
blocking at certified · unresolvable fragment → `changed`, never a pass.

**Encoding.** Baseline values stay strings in the same flat map: a bare
64-hex value means whole-file scope, and `f1:<spanHash>:<fileHash>` means
fragment scope. A nested envelope was rejected because `loadBaseline` keeps
only string values, so an older core would read `{}`, find no entry for any
edge, and silently report every artifact as present — the exact failure this
ADR exists to prevent. With a prefixed string an older core compares `f1:…`
against a sha256, mismatches, and reports drift.

**JSON hashing is canonical, not byte-exact:** the extracted value is
re-serialized with object keys sorted recursively before hashing, so
re-indenting a manifest or reordering its keys is not drift. This asymmetry is
deliberate and applies only to JSON, where the parse is exact.

## Consequences

### Positive
- The release papercut disappears for `#bin`-style edges without weakening any
  check.
- Red regains meaning; advisory findings carry the "something moved around your
  evidence" signal without blocking.
- No migration: legacy values keep working untouched, and narrowing happens the
  next time an edge's baseline is written.

### Negative
- A change outside a narrowed fragment no longer blocks at standard strictness.
  Certified restores blocking for teams that want the stricter reading.
- Two edges (`E-IMPL-CORE-DEPS`, `E-IMPL-CORE-NO-LLM`) are unhelped by design;
  their durable fix is to pin the evidence to an assertion test, tracked
  separately.
- **Writing runs ahead of reading.** Fail-closed cuts both ways: an `f1:` value
  committed before the version that understands it is installed reports drift
  to every older reader. Verified in practice — re-pinning `E-IMPL-CLI-BINARY`
  on this branch reddened the gate under the published 0.10.0 CLI while passing
  under the branch build. So the rollout order is fixed: **publish, then
  re-pin.** A repository adopting fragment scope must have every gate — CI,
  editor hooks, contributors' global installs — on a version that can read the
  value before any edge is refreshed. Nothing breaks silently, but a premature
  re-pin turns the gate red for everyone else, which is the noise this ADR set
  out to remove.

## Supersession

None. Extends ADR-0003's deterministic-checking posture.
