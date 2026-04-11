# AGENTS

## Workspace
- This is a Bun workspace monorepo. Root scripts are the source of truth:
  - `bun run build` builds both packages
  - `bun run build:cli` builds `packages/cli`
  - `bun run build:app` builds `packages/app`
  - `bun run test` runs the CLI test suite only
  - `bun run dev:app` starts the Electron app
  - `bun run jet -- ...` runs the CLI from source without installing it

## Package boundaries
- `packages/cli` is the product core. The Electron app is a thin shell around CLI behavior.
- `packages/app` should not reimplement git/worktree logic in the renderer. App actions go through Electron IPC in `src/main/index.ts`, then into the CLI or native macOS helpers.
- Renderer alias is `@renderer/*` from `packages/app/electron.vite.config.ts` and `packages/app/tsconfig.json`.

## CLI specifics
- Build output is `packages/cli/dist/index.js`.
- Local non-installed CLI testing should use the built path or `bun run jet -- ...`; do not install globally during development.
- CLI tests include real git integration tests. They intentionally isolate all temp repos under `/tmp/jet-worktree-tests` and all temp Jet state under `/tmp/.jet-worktree-tests`.
- Test-only config/worktree overrides are guarded by `JET_TEST_MODE=1`; production behavior must keep using the default user locations.
- CLI integration tests disable git signing prompts in the test helper. Preserve that behavior or local tools like 1Password/GPG can hang the suite.

## App specifics
- Electron preload must stay CommonJS output (`out/preload/index.js`). `electron-vite` is configured explicitly for that in `packages/app/electron.vite.config.ts`; changing preload format breaks the bridge.
- The app bundles a compiled CLI binary for packaged releases via `packages/app/resources/bin/jet`; local dev uses workspace scripts instead.
- Main-process `open` handlers validate that target paths are tracked worktrees before opening IDEs/terminals. Keep that check when extending native integrations.

## UI conventions
- Renderer styling uses Tailwind v4 + shadcn-style local primitives. Prefer extending `packages/app/src/renderer/components/ui/*` and `globals.css` instead of reintroducing component-specific CSS files.
- `components.json` is configured for shadcn with `src/renderer/globals.css` and `@renderer` aliases.

## Verification
- For CLI-only changes: `bun run test && bun run build:cli`
- For app UI/main-process changes: `bun run build:app`
- For cross-cutting changes touching both packages: `bun run test && bun run build`
