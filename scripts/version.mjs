#!/usr/bin/env node
/**
 * Betterflag version manager, one small, dependency-free CLI that keeps every
 * deployable's version in one place and stamps it into the code that ships.
 *
 * Each app (the four Workers + the dashboard) versions INDEPENDENTLY. The
 * source of truth is that app's package.json `version`. This tool mirrors that
 * value into a committed `version.gen.ts` the app imports, so the running code
 *, and therefore every log line, error, and trace it emits, carries its own
 * version with no env var or build magic required.
 *
 * Usage:
 *   bun run version:list                     # show every app's version
 *   bun run version:bump <app> <patch|minor|major|x.y.z>
 *   bun run version:sync                      # rewrite all version.gen.ts from package.json
 *   bun run version:check                     # fail if any version.gen.ts drifted (CI guard)
 *
 * <app> is one of: api, ingest, mcp, webhooks, lifecycle, dashboard.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every independently-versioned deployable and where its generated file lives. */
const APPS = [
  { name: "api", dir: "apps/api", gen: "src/version.gen.ts" },
  { name: "ingest", dir: "apps/ingest", gen: "src/version.gen.ts" },
  { name: "mcp", dir: "apps/mcp", gen: "src/version.gen.ts" },
  { name: "webhooks", dir: "apps/webhooks", gen: "src/version.gen.ts" },
  { name: "lifecycle", dir: "apps/lifecycle", gen: "src/version.gen.ts" },
  { name: "dashboard", dir: "apps/dashboard", gen: "lib/version.gen.ts" },
];

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function die(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function appByName(name) {
  const app = APPS.find((a) => a.name === name);
  if (!app) {
    die(`unknown app "${name}". Known apps: ${APPS.map((a) => a.name).join(", ")}`);
  }
  return app;
}

function pkgPath(app) {
  return join(ROOT, app.dir, "package.json");
}

function readPkgVersion(app) {
  const raw = readFileSync(pkgPath(app), "utf8");
  const m = raw.match(/"version"\s*:\s*"([^"]+)"/);
  if (!m) die(`no "version" field in ${app.dir}/package.json`);
  return m[1];
}

/** Rewrite only the version line so package.json formatting is preserved. */
function writePkgVersion(app, next) {
  const raw = readFileSync(pkgPath(app), "utf8");
  const updated = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`);
  writeFileSync(pkgPath(app), updated);
}

function genContents(app, version) {
  return `// GENERATED FILE - do not edit by hand.
// Mirrors the "version" field of ${app.dir}/package.json so the running code
// (and every log line, error, and trace it emits) carries its own version.
// Update with:  bun run version:bump ${app.name} <patch|minor|major|x.y.z>
//         or:   bun run version:sync   (after editing package.json directly)
export const VERSION = "${version}";
`;
}

function genPath(app) {
  return join(ROOT, app.dir, app.gen);
}

function currentGenVersion(app) {
  try {
    const raw = readFileSync(genPath(app), "utf8");
    const m = raw.match(/export const VERSION\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function writeGen(app, version) {
  writeFileSync(genPath(app), genContents(app, version));
}

function bumpVersion(current, level) {
  if (SEMVER_RE.test(level)) return level; // explicit target version
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) die(`current version "${current}" is not semver`);
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  if (level === "patch") return `${major}.${minor}.${patch + 1}`;
  die(`invalid bump "${level}", use patch, minor, major, or an explicit x.y.z`);
}

function cmdList() {
  const width = Math.max(...APPS.map((a) => a.name.length));
  for (const app of APPS) {
    const pkg = readPkgVersion(app);
    const gen = currentGenVersion(app);
    const flag = gen === pkg ? "" : `  ⚠ version.gen.ts=${gen ?? "missing"} (run version:sync)`;
    console.log(`${app.name.padEnd(width)}  ${pkg}${flag}`);
  }
}

function cmdSync() {
  for (const app of APPS) {
    const version = readPkgVersion(app);
    writeGen(app, version);
    console.log(`synced ${app.name} → ${version}`);
  }
}

function cmdCheck() {
  let drift = false;
  for (const app of APPS) {
    const pkg = readPkgVersion(app);
    const gen = currentGenVersion(app);
    if (gen !== pkg) {
      drift = true;
      console.error(`drift: ${app.name} package.json=${pkg} version.gen.ts=${gen ?? "missing"}`);
    }
  }
  if (drift) {
    console.error('\nrun "bun run version:sync" and commit the result.');
    process.exit(1);
  }
  console.log("all version.gen.ts files match package.json ✓");
}

function cmdBump(name, level) {
  if (!name || !level) die("usage: version:bump <app> <patch|minor|major|x.y.z>");
  const app = appByName(name);
  const current = readPkgVersion(app);
  const next = bumpVersion(current, level);
  writePkgVersion(app, next);
  writeGen(app, next);
  console.log(`${app.name}: ${current} → ${next}`);
  console.log(`  updated ${app.dir}/package.json and ${app.dir}/${app.gen}`);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "list":
    cmdList();
    break;
  case "sync":
    cmdSync();
    break;
  case "check":
    cmdCheck();
    break;
  case "bump":
    cmdBump(rest[0], rest[1]);
    break;
  default:
    die("usage: version <list|bump|sync|check> [...args]");
}
