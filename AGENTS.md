# AGENTS.md

Compact onboarding for coding agents working in `telegram-codex-bridge`.

Product name is **Codex Console**. Package name is still `telegram-codex-bridge` for compatibility. Telegram is the stable first platform pack; Feishu is a current second pack. The codebase is mid-migration toward a platform-neutral Core — do not assume full decoupling has landed.

## Commands

```bash
npm ci                        # install deps (only devDeps + typesafe-i18n + @larksuiteoapi/node-sdk)
npm run check                 # typecheck (tsc --noEmit) — main correctness gate
npm run test                  # run tests via Node built-in test runner (not Jest/Vitest)
npm run build                 # compile to dist/
npm run dev                   # dev mode: tsx src/cli.ts
npm run i18n:generate         # regenerate src/i18n/ after editing locale files
```

CI order: `check -> test -> build`. No linter is configured.

### Live deploy after build

The running service uses `~/.local/share/codex-telegram-bridge/dist`, not the repo `dist/`. After a successful build:

```bash
cp -r dist/* ~/.local/share/codex-telegram-bridge/dist/
ctb service restart
```

### Running a single test

```bash
node --import tsx --test src/path/to/specific.test.ts
```

## TypeScript Strictness

`tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. This means:

- Array/object index access returns `T | undefined` — you must narrow.
- Optional properties typed `T` (not `T | undefined`) cannot be assigned `undefined`.
- ESM-only: `"type": "module"`, `NodeNext` module resolution. All local imports must end in `.js`.

## i18n (typesafe-i18n)

- Base locale is **`zh`** (Chinese), not English. `en` is the additional locale.
- `src/i18n/i18n-types.ts` and `src/i18n/i18n-util.*.ts` are **auto-generated**. Do not edit them.
- After editing `src/i18n/zh/index.ts` or `src/i18n/en/index.ts`, run `npm run i18n:generate`.

## Architecture

```
src/cli.ts              CLI entrypoint (binary: ctb)
src/runtime.ts          bridge runtime bootstrap
src/service.ts          top-level service wiring
src/core/               platform-neutral domain types and workflows
  domain/               shared domain terms, records, context
  interaction-model/    interaction, runtime, terminal semantic views
  workflow/             interaction/runtime/terminal workflow reducers
src/packs/              pack registry, contract, catalog
  telegram/             Telegram pack implementation
  feishu/               Feishu pack implementation
src/telegram/           Telegram Bot API, polling, UI rendering
src/feishu/             Feishu API, polling, card rendering
src/service/            coordinators (session, project, command, runtime, turn, callback)
src/state/              SQLite persistence (store.ts facade, store-*.ts narrow owners)
src/codex/              Codex app-server transport and protocol adoption
src/i18n/               generated i18n code + locale files
src/web/                readonly web preview server
src/project/            filesystem project discovery
src/interactions/       interaction normalization
src/activity/           runtime journal and progress tracking
```

## Code Ownership Routing

For most implementation tasks, go to the narrow owner — not `src/service.ts`.

| Task | Start with |
|---|---|
| CLI command dispatch | `src/cli.ts` |
| install / doctor / update / status | `src/install.ts` |
| config and env parsing | `src/config.ts` |
| file paths (config, state, logs) | `src/paths.ts` |
| startup gating, readiness | `src/readiness.ts` |
| Telegram command registry | `src/telegram/commands.ts` |
| Telegram polling | `src/telegram/poller.ts` |
| Telegram Bot API wrapper | `src/telegram/api.ts` |
| Telegram UI rendering | one `src/telegram/ui-*.ts` file |
| session/project/switch/rename/pin | `src/service/session-project-coordinator.ts` |
| project browse/picker | `src/service/project-browser-coordinator.ts` |
| Codex command orchestration | `src/service/codex-command-coordinator.ts` |
| turn lifecycle | `src/service/turn-coordinator.ts` |
| runtime cards, inspect, status | `src/service/runtime-surface-controller.ts` |
| callback routing | `src/service/callback-router.ts` |
| command routing | `src/service/command-router.ts` |
| rich input (photos, voice) | `src/service/rich-input-adapter.ts` |
| approval/questionnaire flow | `src/service/interaction-broker.ts` |
| Codex app-server protocol | `src/codex/app-server.ts` |
| pack contract/selection | `src/packs/contract.ts`, `src/packs/registry.ts` |
| Core domain types | `src/core/domain/common.ts`, `src/core/domain/records.ts` |
| Core workflows | one file in `src/core/workflow/` |
| SQLite persistence | `src/state/store.ts` then one `src/state/store-*.ts` |

## Docs Routing

When the task is about intended behavior rather than code, use docs:

| Need | Leaf doc |
|---|---|
| v1 scope, trust model | `docs/product/v1-scope.md` |
| Telegram UX flows | `docs/product/chat-and-project-flow.md` |
| auth, project picker, sessions | `docs/product/auth-and-project-flow.md` |
| Codex-backed commands reference | `docs/product/codex-command-reference.md` |
| runtime cards, delivery | `docs/product/runtime-and-delivery.md` |
| callback payloads | `docs/product/callback-contract.md` |
| code organization (prose) | `docs/architecture/current-code-organization.md` |
| platform decoupling status | `docs/architecture/platform-decoupling-status.md` |
| runtime lifecycle, SQLite state | `docs/architecture/runtime-and-state.md` |
| Codex protocol adoption | `docs/architecture/codex-app-server-adoption.md` |
| pack boundary | `docs/architecture/platform-pack-boundary.md` |
| capability matrix | `docs/architecture/platform-capability-matrix.md` |
| install/admin reference | `docs/operations/install-and-admin.md` |

Docs in `docs/research/` are protocol evidence — not proof of shipped UX.
Docs in `docs/roadmap/`, `docs/future/`, `docs/plans/`, `docs/archive/` are planning/history — not current behavior.

## Other Directories

- `scripts/` — GitHub-hosted shell installers (`install-from-github.sh`, `install-skill-from-github.sh`) and web preview scripts
- `skills/` — bundled Codex skills (`telegram-codex-linker/`, `feishu-codex-linker/`, `web-markdown-fetch/`)
- `docs/` — full documentation tree with its own `AGENTS.md` router
- `pack-manifest.json` — declares supported packs and their skill names

## Gotchas

- **Node >= 24 required**. The test runner and ESM support depend on it.
- **No test framework**. Tests use Node's built-in `node:test` with `assert` from `node:assert/strict`. No `describe`/`it` — use `test()` from `node:test`.
- **`src/i18n/` generated files must not be hand-edited**. Run `npm run i18n:generate` after locale changes.
- **Docs and code may drift**. When they conflict, treat it as a real mismatch. If the task is implementation, update code to match current docs. If the task is documentation, update docs to match shipped code.
- **Future intent is not current truth**. `docs/future/` describes a broader Core direction; `src/core/` is what has actually landed.
- Do not assume Feishu supports every Telegram UX surface. Check `docs/architecture/platform-capability-matrix.md`.
