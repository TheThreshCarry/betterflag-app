# Versioning

Every deployable in this monorepo, the four Workers (`edge`, `ingest`, `mcp`,
`webhooks`) and the `dashboard`, carries **its own independent
[SemVer](https://semver.org) version**. That version is stamped onto every log
line, error, and trace the service emits, so any record in Better Stack traces
back to the exact code that produced it.

## Source of truth

For each app the single source of truth is the `version` field in its
`package.json`. A tiny generated file mirrors it into code the service imports:

| App | package.json | generated file |
|-----|--------------|----------------|
| edge | `apps/api/package.json` | `apps/api/src/version.gen.ts` |
| ingest | `apps/ingest/package.json` | `apps/ingest/src/version.gen.ts` |
| mcp | `apps/mcp/package.json` | `apps/mcp/src/version.gen.ts` |
| webhooks | `apps/webhooks/package.json` | `apps/webhooks/src/version.gen.ts` |
| dashboard | `apps/dashboard/package.json` | `apps/dashboard/lib/version.gen.ts` |

`version.gen.ts` is committed and must never be edited by hand, `version:sync`
and `version:bump` regenerate it, and CI (`version:check`) fails if it drifts
from `package.json`.

## How the version reaches logs, errors, and traces

Each service imports its `VERSION` and composes a **release** string via
`formatRelease` from `@betterflag/observability`:

```ts
import { formatRelease, readObservability } from "@betterflag/observability";
import { VERSION } from "./version.gen";

const obs = readObservability(env, "betterflag-api", {
  environment: env.BETTERFLAG_ENV,
  release: formatRelease({
    version: VERSION,            // e.g. "0.1.2"
    gitSha: env.BETTERFLAG_GIT_SHA,  // e.g. "a1b9f3c" (injected at deploy)
    override: env.BETTERFLAG_RELEASE // wins verbatim if set
  }),
});
```

The result is the `release` field on every log record, the `service.version`
resource attribute on every OTLP span, and the error tag on captured
exceptions:

- with a git commit → `0.1.2+a1b9f3c`
- with no commit available → `0.1.2`
- with `BETTERFLAG_RELEASE` set → that exact string

The git SHA is injected at deploy time. Each Worker's `deploy` script passes it
to Wrangler:

```
wrangler deploy --var BETTERFLAG_GIT_SHA:$(git rev-parse --short=7 HEAD)
```

The dashboard picks it up from `BETTERFLAG_GIT_SHA` or Vercel's
`VERCEL_GIT_COMMIT_SHA`. Even with no SHA and no env at all, the committed
`VERSION` is always attached, logs are never version-less.

## Bumping by hand

Run from the repo root:

```
bun run version:list                    # show every app's version
bun run version:bump <app> patch        # 0.1.2 → 0.1.3
bun run version:bump <app> minor        # 0.1.2 → 0.2.0
bun run version:bump <app> major        # 0.1.2 → 1.0.0
bun run version:bump <app> 2.0.0-rc.1   # set an explicit version
bun run version:sync                    # regenerate all version.gen.ts from package.json
bun run version:check                   # CI guard: fail if any version.gen.ts drifted
```

`<app>` is one of `edge`, `ingest`, `mcp`, `webhooks`, `dashboard`. A bump edits
both the `package.json` version and the generated file in one step.

## Automatic bumping (CI)

`.github/workflows/version-bump.yml` bumps versions automatically so no one has
to remember. When code lands on `main` it:

1. finds which apps changed (by path, ignoring the generated files);
2. derives one SemVer level from the range's **Conventional Commit** messages:
   - `feat!:` / `fix!:` / a `BREAKING CHANGE:` footer → **major**
   - `feat:` → **minor**
   - anything else (`fix:`, `chore:`, `refactor:`, `perf:`, `docs:`, …) → **patch**
3. runs `version:bump` for each changed app;
4. commits the bump back to `main` with `[skip ci]` and tags each app
   `<app>-v<version>` (e.g. `edge-v0.1.3`).

The bump commit is loop-safe: it carries `[skip ci]`, and pushes made with
`GITHUB_TOKEN` don't re-trigger `on: push` workflows. The `deploy` workflow then
ships the freshly-versioned worker with its git SHA.

To write good commits, use Conventional Commit prefixes, that's the only signal
the auto-bumper reads to choose major/minor/patch.

### Protected-branch note / PR alternative

`version-bump.yml` pushes directly to `main`. If `main` is protected, either
allow `github-actions[bot]` to bypass it, or move the bump to run on
`pull_request` and push onto the PR's head branch instead (change the trigger to
`on: pull_request`, and in the final step push to
`HEAD:${{ github.head_ref }}`). The detection script `scripts/auto-version.mjs`
is unchanged either way.
