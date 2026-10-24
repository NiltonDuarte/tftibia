# Technical Decisions

Implementation choices for the Tibia Tactics browser game. Gameplay rules and creature balance live in [GAME_DESIGN.md](GAME_DESIGN.md).

## Decisions

| Area | Decision | Implementation |
|---|---|---|
| Platform | Browser, desktop and mobile | Portrait-first responsive interface |
| Language | TypeScript | Strict type checking |
| UI | React | `useReducer` + context for game state |
| Board | HTML and CSS | CSS Modules; no canvas/game engine |
| Build and package manager | Vite + npm | `package-lock.json`; Node.js 24 LTS in `.nvmrc` |
| Game content | YAML | Files under `src/data/`, parsed by `yaml` |
| Content validation | Zod | Checked by the build script and again at runtime |
| Combat | Plain TypeScript on the main thread | Kept independent from React UI |
| Persistence | Browser local storage | Versioned JSON save format; version 6 stores campaign and PRNG state and migrates earlier saves |
| Backend | None | Client-only MVP |
| Testing | Vitest + Playwright | Unit tests cover deterministic full-campaign runs; Playwright configuration is available for browser flows |
| Code quality | ESLint + Prettier | npm scripts in `package.json` |
| Hosting / CI | GitHub Pages + GitHub Actions | PR checks; deploy main branch after successful build |
| Offline support | Deferred | Regular website; no service worker/PWA in MVP |
| Art assets | Local PNG files | Creature images use stable creature slugs; source notes in `ASSET_SOURCES.md` |
| Analytics | None in MVP | No analytics or crash-reporting dependency |

## Dependency register

Versions are pinned by `package-lock.json`; the ranges below are declared in `package.json`.

| Dependency | Use | Runtime or development |
|---|---|---|
| `react`, `react-dom` | UI and browser rendering | Runtime |
| `yaml` | Parse authored YAML game content | Runtime/build |
| `zod` | Validate game content and save data | Runtime/build |
| `vite`, `@vitejs/plugin-react` | Local server and production build | Development |
| `typescript` | Type checking and compilation | Development |
| `tsx` | Run the YAML content validation script | Development |
| `vitest` | Unit test runner | Development |
| `jsdom` | Browser-like environment for Vitest | Development |
| `@playwright/test` | Browser end-to-end test runner | Development |
| `eslint`, `typescript-eslint`, React ESLint plugins | Linting | Development |
| `prettier` | Formatting | Development |

## Build and deployment

- Install dependencies with `npm ci` on Node.js 24.
- `npm run build` validates YAML content, type-checks the app, and produces the static site in `dist/`.
- `npm run lint` checks source files.
- GitHub Actions runs install, lint, unit-test command, and build steps on pull requests. A successful push to `main` publishes `dist/` to GitHub Pages.
- Vite uses the repository name as its Pages base path when running in GitHub Actions; local development uses `/`.

## Implemented MVP architecture

- `src/game/engine.ts` owns the pure deterministic game reducer; `src/game/GameContext.tsx` binds commands to React and local saves.
- `src/game/balance.ts` runs full campaigns with seeded strategy policies and records per-seed outcomes for the sortable Balance Lab.
- `src/game/combat.ts` resolves position-aware automatic battles and calculates active synergies; it returns a structured room-coordinate event timeline for the animated board.
- `src/content/` parses YAML and validates it against Zod schemas.
- `src/data/` holds the initial campaign, vocations, upgrades, creatures, and synergy definitions.
- `src/App.tsx` renders the vocation selection, branching route map, preparation/shop, battle report, and reward flow.
- `src/game/stateSchema.ts` defines the versioned save shape, legacy migration, battle-event data, and local-storage read/write behavior.

## Technical decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-10-24 | React + TypeScript + Vite + npm, rendered with HTML/CSS | Browser-first prototype with fast iteration and no dedicated game engine. |
| 2026-10-24 | YAML content validated by Zod at build time and runtime | Make balancing data editable while guarding against malformed content. |
| 2026-10-24 | Reducer/context state and versioned local JSON saves | Keep the client-only campaign state predictable and reloadable. |
| 2026-10-24 | Plain TypeScript automatic combat simulation on discrete sqm coordinates | Keep combat rules independent of rendering; each creature occupies one room tile and advances by neighboring tile steps. |
| 2026-10-24 | Seeded campaign and strategy decision streams | Make full-run balance comparisons reproducible for a given seed, vocation, and strategy. |
| 2026-10-24 | GitHub Pages deployment through GitHub Actions | Host the static game and automate PR checks and main-branch deploys. |
| 2026-10-24 | Local PNG creature portraits with stable slugs | Avoid runtime image dependencies and provide predictable asset paths. |

## References

- [TibiaDraptor Bestiary](https://tibiadraptor.com/bestiary) — creature image and Bestiary class reference.
- [Game design scaffold](GAME_DESIGN.md) — gameplay decisions and open questions.
