# Validation record

## Campaign difficulty — 2026-10-11

- All **41 deterministic simulation tests passed**, including explicit Easy baseline coverage, all four profiles, count rounding, ordered formations, lane progression, unchanged boss timing/routes, health and shield scaling, reactor capacity, restart retention, and lethal-breach accounting. Strict TypeScript checking and the production build passed. Vite retains its existing large-chunk warning (approximately 799 kB). Local verification used Node 26.11.0 and installed dependencies.
- Twelve scripted campaigns used the same three mixed-tower strategies, starting credits, earned kill/wave rewards, and preparation-only purchases. Results below are simulation evidence, not human playtesting or measured difficulty guarantees. Higher enemy quantities also grant more total kill income.

| Difficulty | Strategy 1 | Strategy 2 | Strategy 3 | Final kills / credits for victories |
| --- | --- | --- | --- | --- |
| Easy | Victory, 20 HP | Victory, 20 HP | Victory, 20 HP | 1073 / 3564 |
| Medium | Victory, 20 HP | Victory, 20 HP | Victory, 20 HP | 1315 / 6964 |
| Hard | Victory, 20 HP | Victory, 20 HP | Victory, 20 HP | 1529 / 9920 |
| Hardcore | Victory, 2 HP | Defeat, wave 3 | Victory, 2 HP | 1736 / 12796 |

- Hardcore strategy 2 ended with 58 kills and 283 credits. A viable earned-credit strategy is retained on every difficulty, with all three original Easy victories preserved.
- All **11 Playwright scenarios passed** locally in 2 minutes, covering all selector options, persistence, default/invalid selection, campaign locking, pause/result restarts, separate best scores, legacy migration, and Hardcore showing 100% at 10/10 HP. The first run was interrupted by a development hot reload during a source edit; the clean run passed without retries.
- Visually inspected the [menu](docs/screenshots/difficulty-menu.png) and [Hardcore HUD](docs/screenshots/hardcore-hud.png) at 1440×900. The selector, launch button, integrity display, and campaign difficulty labels fit without overlap. Larger/smaller viewports were not visually inspected.
- Manual full-campaign browser playtesting and performance profiling remain unverified.

## CI browser timeout fix — 2026-10-11

- GitHub-hosted runs failed all five browser tests at the 30-second limit. Four tests waited to click the intro skip button after it had automatically detached. Startup now waits for the intro button to disappear, covering automatic completion without racing its short lifetime.
- Browser contexts initially use Low quality while preserving persisted settings on reload; the settings scenario still switches to High quality. Linux launches explicitly use SwiftShader for software WebGL. Test and assertion budgets are 60 and 10 seconds respectively; failures remain deployment-blocking without retries.
- After these changes, all five browser scenarios passed locally in 56 seconds; all 26 simulation tests and the type-checked production build passed. [GitHub Actions run 38120378958](https://github.com/JensonChoi/neon-defense/actions/runs/38120378958) also passed installation with `npm ci`, simulation tests, all browser scenarios using Linux SwiftShader, and the production build under Node 24. The validation job completed in 2 minutes 9 seconds. Feature-branch deployment jobs were correctly skipped; actual Pages deployment remains unverified.

## CI/CD verification — 2026-10-10

- `npm test`: all **26 simulation tests passed** on macOS with Node.js 26.11.0, including a new regression test for the exact 70% refund on a once-upgraded laser turret. The first browser run exposed floating-point rounding that returned 118 rather than 119 credits; the refund calculation now multiplies by 7 before dividing by 10.
- `npm run build -- --base=/neon-defense/`: strict TypeScript checking and the complete Vite production build passed using installed dependencies. Generated HTML references the script, stylesheet, and favicon under `/neon-defense/`. Vite reports a bundle-size warning for the approximately 796 kB JavaScript chunk; this is not a build failure.
- After installing Playwright Chromium and allowing local server/browser execution outside the sandbox, `npm run test:e2e`: all **5 browser scenarios passed** in 1.4 minutes. This supersedes the earlier browser execution limitation below.
- Workflow YAML parsed successfully and its triggers/job structure were checked; `git diff --check` passed. CI selects Node 24 from `.nvmrc`; local verification used Node 26 and existing dependencies, rather than a fresh `npm ci` installation.
- The GitHub-hosted workflow and actual Pages deployment have not been run. Pages must be configured to use GitHub Actions and the workflow merged into `main` before deployment. Manual full-campaign browser playtesting and performance profiling remain unverified.

The following sections preserve the initial development record; installation, build, and browser limitations describe that earlier environment.

## Executed

- **25 deterministic simulation tests passed** under Node.js 26.11.0 on macOS.
- Three scripted mixed-tower strategies each completed all 20 waves using only the starting credits and earned rewards. Each finished with 20 reactor HP; this establishes a viable economy, not a substitute for human difficulty testing.
- A campaign with no defenses ended in defeat.
- Strict TypeScript analysis passed using the locally available TypeScript compiler and cached Three.js / React types. Because React DOM types were unavailable, this preliminary check supplied only its `createRoot` interface as a temporary declaration outside the project.

- Vite successfully transformed and bundled the source and stylesheet in a preliminary build with React imports externalized. This checks module resolution and bundling for the installed Three.js stack, but is not a runnable production-build verification.

## Environment-blocked checks

The development sandbox could not resolve `registry.npmjs.org`, could not bind the Vite localhost port (`EPERM`), and could not launch a headless browser. Native Chrome access was also denied. Consequently:

- A normal dependency installation and complete production build have not yet been verified.
- The included Playwright browser scenarios have not yet been executed.
- Visual QA, manual full-campaign playtesting, and 60 FPS profiling remain unverified.
- The initial dependency lockfile must be generated by `npm install` when registry access is available.

Do not interpret the simulation tests as a claim that browser rendering or a 60 FPS target was measured.

## Run on a normal desktop

```bash
npm install
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev
```

Check the menu and battlefield at 1440×900 and 1920×1080. Play through all 20 waves, inspect every tower upgrade and boss EMP, check quality presets, and profile a busy late wave at 1× and 3×. Inspect the browser console for uncaught errors. If low-end performance is poor, select Low quality.
