# NEON DEFENSE

A complete local, single-player 3D tower defense game built with TypeScript, Three.js, React, and Vite. Defend Neo Tokyo's last power reactor across 20 waves of robots.

## Run locally

Requires **Node.js 22.18+** (Node 24 LTS recommended), npm, and a desktop browser with WebGL 2 / hardware acceleration.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally **http://127.0.0.1:5173**. Choose **Initialize Defense**, click a glowing hexagonal build site, deploy towers, then start the first wave.

```bash
npm run build       # Type-check and produce dist/
npm run preview     # Serve the production build locally
npm run typecheck   # Strict TypeScript check
npm test            # Deterministic simulation and complete-campaign tests
```

For browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright suite starts Vite automatically, or reuses an existing server on port 5173. It covers actual canvas selection and UI construction, upgrades, selling, combat, pause, camera controls, settings, and end screens.

No backend, API keys, external models, textures, fonts, or runtime network requests are required. All game assets are procedural. npm registry access is needed for the initial installation.

## Deploy with GitHub Actions

The [CI and GitHub Pages workflow](.github/workflows/ci-cd.yml) runs on pushes and pull requests. It installs locked dependencies with Node 24, runs simulation and Chromium browser tests, and type-checks and builds the production site. Failed runs retain available browser diagnostics for seven days.

To enable deployment:

1. In the repository's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
2. Merge this workflow into `main` and push changes to `main`. Deployment runs only after validation succeeds.
3. Open **Actions → CI and GitHub Pages** to monitor the run. The deployment job links to the published site, normally **https://jensonchoi.github.io/neon-defense/**.

Once the workflow exists on `main`, you can also select **Run workflow** in Actions with branch `main` to redeploy. Manual runs on other branches validate without publishing. No personal access token or repository secrets are needed; deployment uses the workflow's scoped GitHub token and the `github-pages` environment. Any environment approval rules still apply.

The deployment build takes its asset base path from GitHub Pages metadata, supporting repository URLs and configured custom domains. For a local production preview at the repository path, run `npm run build -- --base=/neon-defense/`, then `npm run preview`, and visit `/neon-defense/` on the preview server.

## How to play

- Begin with **350 credits** and **20 reactor HP**. Survive **20 waves** to win.
- Click a **hexagonal build site**, select a tower, and press **Deploy**. There are 24 sites.
- Click an existing tower to buy up to **three upgrades**, inspect its range, or recycle it for **70% of invested credits**.
- Earn credits from kills and `40 + 5 × wave` credits for clearing each wave.
- Start waves manually. Enable **Auto** to run the 15-second intermission countdown; **Hold** stops it. Auto is off initially.
- Most enemies cost one reactor HP if they escape. Bosses cost **five HP**.
- Bosses arrive on waves **5, 10, 15, and 20**. Their telegraphed EMP disables towers within five units for two seconds. Spread defenses across the route.

| Tower | Base cost | Role |
| --- | ---: | --- |
| Laser turret | 100 | Rapid, accurate energy bolts; handles scouts |
| Missile launcher | 160 | Homing missiles with splash damage |
| Tesla coil | 180 | Lightning chains through nearby enemies |
| Railgun | 220 | High-damage penetrating shots that ignore armor |
| Cryo tower | 120 | Continuous slowing field and minor area damage |

Each upgrade improves damage, range, and attack rate. Missile splash, Tesla chain count, and Cryo slow strength also increase. Cryo slows use the strongest field; they do not multiply. Shields absorb incoming damage before health; armor reduces health damage.

**First-wave advice:** Place laser turrets along the road near entrance 01, particularly the sites beside its first turn. Add a central defense before entrance 02 opens on wave 3 and entrance 03 opens on wave 7. Group-control towers work well with Cryo; Railguns are especially useful along straight roads and against armored mechs.

## Controls

| Input | Action |
| --- | --- |
| Left click | Select build site or tower |
| Right click | Cancel selection |
| Right drag | Rotate camera |
| Mouse wheel | Zoom |
| WASD | Pan |
| Escape | Clear selection, or toggle pause |
| Space | Start wave during preparation; otherwise pause/resume |
| 1 / 2 / 3 | Simulation speed |
| Home | Reset camera |

The game automatically pauses combat when its window loses focus. Sound starts after a user gesture. Settings include quality, sound/music volume, reduced motion, and damage numbers. Settings and personal best scores persist locally when browser storage is available. Active campaigns are not saved.

## Architecture

- `src/game/` contains independent modules for the simulation, configuration, wave compositions, waypoint paths, targeting and damage, projectile movement, upgrades and economy, and procedural sound.
- `src/render/scene.ts` owns the Three.js scene, procedural models, instanced city details, camera, picking, bloom, effects, floating text, and minimap.
- `src/main.tsx` contains the React HUD and menus. React observes immutable snapshots at roughly 12 Hz; entity transforms remain outside React.

Combat uses a fixed 60 Hz simulation accumulator. 1×/2×/3× controls multiply simulated time; pause freezes combat and intermission countdowns. Large frame deltas are capped to prevent runaway catch-up after a suspended tab.

The renderer reuses geometry/materials, instances static city details, and pools projectiles, beam meshes, and floating labels. Particle, beam, and damage-number counts are bounded. Low quality disables bloom, shadows, and rain; medium caps pixel ratio at 1.5; high caps it at 2. System fonts keep startup independent of external services.

Authored routes always reach the reactor and placement never obstructs roads. Enemies prioritize movement along their routes; towers prioritize the target with the shortest remaining path. The map is fixed and the simulation is deterministic. Visual effects may vary randomly.

The development-only `?test=1` bridge supports browser automation and is eliminated from production builds. It is not required for normal play.

## Verification and limitations

The deterministic suite includes full 20-wave runs using three mixed-tower strategies with earned credits, plus a no-defense defeat scenario. It also checks path continuity, construction, exact accounting, targeting, splash and chain attacks, rail penetration, slows, boss EMPs, shields, armor, duplicate rewards, countdowns, speed, and terminal states.

See [VALIDATION.md](VALIDATION.md) for what was actually run in the development environment and remaining browser validation requirements. Desktop keyboard and mouse are the supported input target. Mobile touch controls, multiplayer, and campaign save/load are outside this release.
