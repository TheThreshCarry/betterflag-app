#!/usr/bin/env node
/**
 * Auto-bump changed apps' SemVer from Conventional Commits.
 *
 * Runs in CI on push to main (see .github/workflows/version-bump.yml). For the
 * commit range that just landed it:
 *   1. finds which apps changed (by path, apps/<name>/…, ignoring the
 *      generated version.gen.ts so a bump commit can't re-trigger a bump);
 *   2. derives ONE SemVer level from the range's commit messages, per
 *      https://semver.org + Conventional Commits:
 *        - MAJOR  → any `type!:` header or `BREAKING CHANGE` in a body
 *        - MINOR  → any `feat:` / `feat(scope):`
 *        - PATCH  → otherwise (fix, chore, refactor, perf, docs, …)
 *   3. bumps each changed app via scripts/version.mjs (package.json +
 *      version.gen.ts stay in lockstep).
 *
 * Env:
 *   BASE_SHA / HEAD_SHA   commit range (defaults to HEAD~1..HEAD)
 *   DRY_RUN=1             print the plan, change nothing
 *   GITHUB_OUTPUT         when set, writes `bumped=` and `level=` for the workflow
 */
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const APPS = [
  { name: "api", dir: "apps/api" },
  { name: "ingest", dir: "apps/ingest" },
  { name: "mcp", dir: "apps/mcp" },
  { name: "webhooks", dir: "apps/webhooks" },
  { name: "dashboard", dir: "apps/dashboard" },
];

const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
}

/** Resolve the commit range to inspect, tolerating a missing/zero BASE_SHA. */
function commitRange() {
  const head = process.env.HEAD_SHA || "HEAD";
  const base = process.env.BASE_SHA;
  const isZero = (s) => !s || /^0+$/.test(s);
  if (!isZero(base)) {
    try {
      sh(`git cat-file -e ${base}^{commit}`); // reachable in this checkout?
      return `${base}..${head}`;
    } catch {
      // base not present (shallow / first push), fall through
    }
  }
  return `${head}~1..${head}`;
}

/** SemVer bump level implied by the range's Conventional Commit messages. */
function levelFrom(range) {
  const log = sh(`git log --format=%B ${range}`);
  if (/[a-zA-Z]+(\([^)]*\))?!:/.test(log) || /BREAKING[ -]CHANGE/.test(log)) return "major";
  if (/(^|\n)\s*feat(\([^)]*\))?:/.test(log)) return "minor";
  return "patch";
}

const range = commitRange();
const changedFiles = sh(`git diff --name-only ${range}`).split("\n").filter(Boolean);
const isGenerated = (f) => /\/version\.gen\.ts$/.test(f);

const changedApps = APPS.filter((app) =>
  changedFiles.some((f) => f.startsWith(`${app.dir}/`) && !isGenerated(f)),
);

if (changedApps.length === 0) {
  console.log(`no app changes in ${range}, nothing to bump`);
  writeOutput([], "none");
  process.exit(0);
}

const level = levelFrom(range);
console.log(`range ${range} → level ${level.toUpperCase()}; apps: ${changedApps.map((a) => a.name).join(", ")}`);

const bumped = [];
for (const app of changedApps) {
  if (DRY_RUN) {
    console.log(`would bump ${app.name} (${level})`);
  } else {
    console.log(sh(`node scripts/version.mjs bump ${app.name} ${level}`));
  }
  bumped.push(app.name);
}

writeOutput(bumped, level);

function writeOutput(list, lvl) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  appendFileSync(out, `bumped=${list.join(",")}\n`);
  appendFileSync(out, `level=${lvl}\n`);
}
