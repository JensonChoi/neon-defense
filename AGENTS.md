# Repository Guidelines

## Project Structure & Module Organization

NEON DEFENSE uses TypeScript, Three.js, React, and Vite. Keep deterministic gameplay in `src/game/`: configuration, waves, paths, combat, projectiles, economy, and the engine. Procedural audio lives there too. `src/render/scene.ts` owns the Three.js battlefield, effects, camera, picking, and minimap. `src/main.tsx` contains React menus and the HUD; `src/style.css` defines their appearance. Static assets belong in `public/`. Simulation tests live in `tests/*.test.ts`; browser scenarios live in `tests/browser/`.

## Build, Test, and Development Commands

Use Node.js 22.18+; `.nvmrc` selects Node 24.

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run dev`: start Vite at `http://127.0.0.1:5173`.
- `npm run typecheck`: check strict TypeScript types.
- `npm test`: run deterministic simulation and campaign tests.
- `npx playwright install chromium`: install the browser required for end-to-end tests.
- `npm run test:e2e`: run Playwright; it starts or reuses Vite.
- `npm run build`: type-check and generate `dist/`.
- `npm run preview`: serve the production build locally.

## Coding Style & Naming Conventions

Use explicit TypeScript types and type-only imports where appropriate. Use two spaces for new code; match surrounding indentation when editing existing files. Name classes and types in PascalCase, functions and variables in camelCase, and configuration constants in UPPER_SNAKE_CASE. Keep module filenames lowercase and descriptive, such as `combat.ts`. No formatter or linter is configured; avoid unrelated formatting changes.

Keep simulation logic independent of React and Three.js. Preserve fixed-step timing, immutable HUD snapshots, bounded effects, and shared rendering resources.

## Testing Guidelines

Simulation tests use Node's built-in test runner, not Vitest. Name files `*.test.ts` and describe observable behavior. Cover changed mechanics, including accounting, targeting, wave progression, and terminal states. No numeric coverage threshold is configured. Use Playwright `*.spec.ts` scenarios for interaction changes. Balance changes should retain a viable earned-credit campaign strategy. Record actual verification and limitations in `VALIDATION.md`; do not claim unmeasured performance.

## Commit & Pull Request Guidelines

There are no commits yet, so no historical convention exists. Use concise imperative subjects, such as `Fix missile target reacquisition`. PRs should explain the gameplay change, list checks performed, link relevant issues, and include screenshots for visual changes. Update documentation for controls or balance changes. Commit dependency lockfile updates; exclude `node_modules/`, `dist/`, and test artifacts.
