# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).
Each publishable package (`@rqml/schema`, `@rqml/core`, `rqml`, `@rqml/mcp`) is
versioned independently of the RQML *language* version (per `DEC-VERSION-DECOUPLE`
/ `REQ-VERSION-DECOUPLE`).

Add a changeset with `pnpm changeset`, version with `pnpm version-packages`, and
publish with `pnpm release`. The documentation site (`@rqml/website`) is private
and ignored.
