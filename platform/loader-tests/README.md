# loader-tests

End-to-end Playwright tests for Plasmic SDK packages. Tests verify that Plasmic projects render correctly when integrated into real framework apps (Next.js, React/Vite, TanStack).

## How it works

There are two kinds of Playwright tests:

### Loader tests (`src/playwright-tests/nextjs/`, etc.)

Each test uploads a JSON bundle from `data/` to the local Plasmic server, copies a framework template (e.g. `src/nextjs/template-pages/`) into a temp directory, installs deps with `pnpm install --frozen-lockfile`, builds the app, starts it on a random port, then runs Playwright assertions against it. The supported React 19 and current framework targets are defined in `src/env.ts`.

### E2E codegen/loader tests (`src/playwright-tests/e2e/`)

These tests exercise `create-plasmic-app` end-to-end. Instead of copying a template, each test runs `npx create-plasmic-app` to scaffold a real project (Next.js, React, or TanStack Router), builds it, starts a server, and runs Playwright assertions. Tests cover both codegen and loader schemes. On CI, all changed packages are published to verdaccio first so the scaffolded projects pick up the latest local builds.

### Adding a new loader test

Export a Plasmic project bundle as JSON into `data/`. Then write a Playwright spec in `src/playwright-tests/` by copying boilerplate from a similar test.

### Adding a new e2e test

This should rarely be needed.
Add a new spec file in `src/playwright-tests/e2e/` using `defineE2eTests()` from `e2e-test-utils.ts`. Specify the platform, test cases (scheme, typescript, appDir), and assertion callback. See `e2e-nextjs-codegen.spec.ts` for an example.

Note: These tests were split by platform into multiple files to enable parallel execution.

## pnpm in templates

The framework templates use pnpm with `--frozen-lockfile`. Each template has a
committed `pnpm-workspace.yaml` so commands in that directory use its own
lockfile instead of walking up to the loader-tests workspace. If you update a
template's `package.json`, run `pnpm install` in that template directory and
commit its updated `pnpm-lock.yaml`.

## Running tests

```bash
# All tests
pnpm test

# Specific test file
pnpm test-playwright src/playwright-tests/nextjs/antd5/tabs.spec.ts

# Specific folder
pnpm test-playwright src/playwright-tests/nextjs/antd5/

# Refresh snapshots for a specific spec
PLAYWRIGHT_REPORTER_OPEN=never pnpm test-playwright src/playwright-tests/nextjs/nextjs-wordpress.spec.ts --update-snapshots

# Refresh all Playwright snapshots
pnpm update-snapshots

# Interactive UI mode
pnpm playwright-ui

# To run E2e tests (requires verdaccio with local packages published)
# Publish local packages from the repo root.
(cd ../.. && pnpm local-publish)

# Then, from platform/loader-tests, run Playwright against the local registry.
pnpm run local:playwright-ui
```

On failure, traces and videos are saved to `test-results/`. The HTML report opens automatically, or run `npx playwright show-report`. Each test logs its temp directory path (`tmpdir /tmp/...`) which you can inspect to debug build issues (comment out teardown to keep it around).

## Updating snapshots

Playwright image baselines live in `snapshots/`.

1. Run the target spec with `PLAYWRIGHT_REPORTER_OPEN=never` and `--update-snapshots`, for example `PLAYWRIGHT_REPORTER_OPEN=never pnpm test-playwright src/playwright-tests/nextjs/nextjs-wordpress.spec.ts --update-snapshots`.
2. Review the changed PNGs under `snapshots/`.
3. Re-run the same spec without `--update-snapshots` to confirm the new baselines pass.

Use `pnpm update-snapshots` only when you intend to refresh all Playwright baselines.

## Independent SDK consumption checks

`scripts/verify-cpa-outputs.mjs` verifies the 11 maintained CPA output fixtures with
fresh strict peer installs, production builds and Chromium. It uses a local HTTP
fixture for the Loader API; it does not replace fresh scaffolding or the CLI/server
protocol tests above. Set `CPA_TEST_OUTPUT` to a temporary directory outside this
checkout and `CPA_TEST_USERCONFIG` to an npm configuration whose SDK scopes point
to the isolated loopback registry containing the newly packed SDKs. No external
packages are published by this check.

```sh
CPA_TEST_OUTPUT=/tmp/cpa-consumers CPA_TEST_USERCONFIG=/path/to/test-npmrc node scripts/verify-cpa-outputs.mjs
```

Templates explicitly set `minimumReleaseAge: 0`; they impose no 72-hour age gate.
