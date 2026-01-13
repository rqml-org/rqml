# Contributing to RQML

Thanks for helping improve RQML (Requirements Markup Language)!

## Ways to contribute

- Report bugs or ambiguities in the schema
- Propose improvements or new features
- Improve documentation and examples
- Add conformance tests (if/when present)
- Review open pull requests and RFCs

## Repository layout

- `/rqml-schema` — schema, examples, and (optionally) conformance materials
- `/rqml-org` — documentation site (Docusaurus)
- `/rfc` — RQML change proposals (required for normative changes)

## Quickstart: proposing changes

### Documentation-only change
1. Open a PR with your change.
2. Explain the motivation and any relevant context.
3. A maintainer will review and merge.

### Schema (normative) change
1. Open an issue describing the problem and desired outcome.
2. Create an RFC PR using `/rfc/0001-template.md` as a starting point.
3. After the RFC is accepted, submit an implementation PR (or update the RFC PR if maintainers prefer).

## Developer Certificate of Origin (DCO)

We use the DCO to keep contributions lightweight and legally clear.

To sign off on your commits, include a `Signed-off-by` line in each commit message:
Signed-off-by: Your Name you@example.com

Most git clients can do this automatically:

- `git commit -s -m "Your commit message"`

By signing off, you confirm you have the right to submit the work under the project license.

## Pull request checklist

- [ ] Clearly describe the problem and the solution
- [ ] Include links to related issues/RFCs
- [ ] Add or update examples where helpful
- [ ] For schema changes, consider compatibility and migration impact
- [ ] Ensure commits are DCO-signed (`-s`)

## Reporting security issues

If you believe you’ve found a security issue in reference tooling (if present), please follow `SECURITY.md` (if added). For schema/design concerns, open an issue.

## License

By contributing, you agree your contributions are licensed under the Apache License 2.0.


