# Repository Guidelines

## About the project
- The project is a documentation site for the XML-schema contained in the /schemas directory

## Project Structure & Module Organization
- Docusaurus site rooted here; config lives in `docusaurus.config.ts` and sidebar ordering in `sidebars.ts`.
- Content lives in `docs` (documentation) and `blog` (posts); static assets (images, favicons, etc.) sit in `static`.
- Frontend code is in `src`: `pages/` for routes (`index.tsx`, markdown pages), `components/` for shared React pieces (paired with CSS modules), and `css/` for global theme overrides.
- Build artifacts land in `.docusaurus/` and `build/` (created by Docusaurus; keep out of version control).

## Build, Test, and Development Commands
- Install: `npm install` (Node 20+). Use the existing `package-lock.json` for consistency.
- Develop: `npm run start` to launch the dev server with live reload at `http://localhost:3000`.
- Build: `npm run build` generates the static site into `build/`.
- Serve built site: `npm run serve` to preview the `build/` output locally.
- Clean: `npm run clear` drops cached `.docusaurus` data when encountering stale builds.
- Type safety: `npm run typecheck` runs `tsc` for the project types.

## Coding Style & Naming Conventions
- TypeScript + React with functional components; prefer `ReactNode` return types.
- Use CSS modules (`*.module.css`) colocated with components; keep class names descriptive and scoped.
- Component files use PascalCase (e.g., `HomepageFeatures/index.tsx`), and utility files use camelCase.
- Imports favor existing aliases (e.g., `@site/static/...`, `@theme/...`); keep relative paths shallow.
- Indentation follows the current codebase (2 spaces). No formatter is enforced here—match nearby style and run Prettier if available locally.

## Testing Guidelines
- There is no dedicated test suite yet. Before opening a PR, run `npm run build` and `npm run typecheck` to catch regressions.
- When adding React logic, prefer small components with prop typing to keep runtime behavior predictable.

## Commit & Pull Request Guidelines
- Commits in history are short and imperative (e.g., “Renamed schema project folder”); follow that style and keep scope focused.
- For PRs, include: what changed, why it helps, and any screenshots for visual updates. Link issues when applicable and note any follow-up work.
- Verify local build/typecheck results in the PR description. Mention if caches were cleared or other steps were required.
