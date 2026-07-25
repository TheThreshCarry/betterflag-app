/**
 * Seed ClickHouse `evaluations` with synthetic geo traffic for the analytics map.
 *
 * Usage (from apps/dashboard — bun loads .env / .env.local):
 *   bun run analytics:seed
 *   SEED_COUNT=5000 SEED_COUNTRIES=FR,US,DE bun run analytics:seed
 *   SEED_COUNT=2000 SEED_COUNTRIES=random SEED_COUNTRY_COUNT=25 bun run analytics:seed
 *   SEED_COUNT=10000 SEED_COUNTRIES=all bun run analytics:seed
 *
 * Env:
 *   CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD   (required)
 *   SEED_ORG_ID, SEED_PROJECT_ID                           (required)
 *   SEED_ENV                    default "dev"
 *   SEED_COUNT                  rows to insert (default 1000)
 *   SEED_COUNT_MIN / SEED_COUNT_MAX
 *                               if both set, pick random count in [min, max]
 *                               (overrides SEED_COUNT)
 *   SEED_COUNTRIES              "random" | "all" | "US,FR,DE" (default random)
 *   SEED_COUNTRY_COUNT          when COUNTRIES=random (default 20)
 *   SEED_PERIOD_HOURS           spread timestamps over last N hours (default 24)
 *   SEED_BATCH_SIZE             JSONEachRow insert batch size (default 2000)
 */

type City = { city: string; region: string; lat: number; lng: number };
type CountrySeed = { country: string; cities: City[] };

/** Curated ISO-A2 → cities with region (cf.region-style) + coords. */
const COUNTRY_CITIES: CountrySeed[] = [
  {
    country: "US",
    cities: [
      { city: "New York", region: "New York", lat: 40.71, lng: -74.01 },
      { city: "Buffalo", region: "New York", lat: 42.89, lng: -78.88 },
      { city: "San Francisco", region: "California", lat: 37.77, lng: -122.42 },
      { city: "Los Angeles", region: "California", lat: 34.05, lng: -118.24 },
      { city: "Austin", region: "Texas", lat: 30.27, lng: -97.74 },
      { city: "Dallas", region: "Texas", lat: 32.78, lng: -96.8 },
      { city: "Chicago", region: "Illinois", lat: 41.88, lng: -87.63 },
      { city: "Seattle", region: "Washington", lat: 47.61, lng: -122.33 },
    ],
  },
  {
    country: "CA",
    cities: [
      { city: "Toronto", region: "Ontario", lat: 43.65, lng: -79.38 },
      { city: "Ottawa", region: "Ontario", lat: 45.42, lng: -75.7 },
      { city: "Vancouver", region: "British Columbia", lat: 49.28, lng: -123.12 },
      { city: "Montreal", region: "Quebec", lat: 45.5, lng: -73.57 },
    ],
  },
  {
    country: "GB",
    cities: [
      { city: "London", region: "England", lat: 51.51, lng: -0.13 },
      { city: "Manchester", region: "England", lat: 53.48, lng: -2.24 },
      { city: "Edinburgh", region: "Scotland", lat: 55.95, lng: -3.19 },
    ],
  },
  {
    country: "FR",
    cities: [
      { city: "Paris", region: "Île-de-France", lat: 48.86, lng: 2.35 },
      { city: "Versailles", region: "Île-de-France", lat: 48.8, lng: 2.13 },
      { city: "Lyon", region: "Auvergne-Rhône-Alpes", lat: 45.76, lng: 4.84 },
      { city: "Grenoble", region: "Auvergne-Rhône-Alpes", lat: 45.19, lng: 5.72 },
      { city: "Marseille", region: "Provence-Alpes-Côte d'Azur", lat: 43.3, lng: 5.37 },
      { city: "Bordeaux", region: "Nouvelle-Aquitaine", lat: 44.84, lng: -0.58 },
    ],
  },
  {
    country: "DE",
    cities: [
      { city: "Berlin", region: "Berlin", lat: 52.52, lng: 13.41 },
      { city: "Munich", region: "Bavaria", lat: 48.14, lng: 11.58 },
      { city: "Nuremberg", region: "Bavaria", lat: 49.45, lng: 11.08 },
      { city: "Hamburg", region: "Hamburg", lat: 53.55, lng: 9.99 },
    ],
  },
  {
    country: "NL",
    cities: [
      { city: "Amsterdam", region: "North Holland", lat: 52.37, lng: 4.9 },
      { city: "Haarlem", region: "North Holland", lat: 52.39, lng: 4.64 },
      { city: "Rotterdam", region: "South Holland", lat: 51.92, lng: 4.48 },
      { city: "The Hague", region: "South Holland", lat: 52.07, lng: 4.3 },
    ],
  },
  {
    country: "ES",
    cities: [
      { city: "Madrid", region: "Madrid", lat: 40.42, lng: -3.7 },
      { city: "Alcalá de Henares", region: "Madrid", lat: 40.48, lng: -3.36 },
      { city: "Móstoles", region: "Madrid", lat: 40.32, lng: -3.86 },
      { city: "Barcelona", region: "Catalonia", lat: 41.39, lng: 2.17 },
      { city: "Girona", region: "Catalonia", lat: 41.98, lng: 2.82 },
    ],
  },
  {
    country: "IT",
    cities: [
      { city: "Rome", region: "Lazio", lat: 41.9, lng: 12.5 },
      { city: "Milan", region: "Lombardy", lat: 45.46, lng: 9.19 },
      { city: "Bergamo", region: "Lombardy", lat: 45.7, lng: 9.67 },
    ],
  },
  {
    country: "PT",
    cities: [
      { city: "Lisbon", region: "Lisbon", lat: 38.72, lng: -9.14 },
      { city: "Porto", region: "Porto", lat: 41.15, lng: -8.61 },
    ],
  },
  {
    country: "IE",
    cities: [{ city: "Dublin", region: "Leinster", lat: 53.35, lng: -6.26 }],
  },
  {
    country: "SE",
    cities: [
      { city: "Stockholm", region: "Stockholm", lat: 59.33, lng: 18.07 },
      { city: "Gothenburg", region: "Västra Götaland", lat: 57.71, lng: 11.97 },
    ],
  },
  {
    country: "NO",
    cities: [{ city: "Oslo", region: "Oslo", lat: 59.91, lng: 10.75 }],
  },
  {
    country: "DK",
    cities: [{ city: "Copenhagen", region: "Capital Region", lat: 55.68, lng: 12.57 }],
  },
  {
    country: "FI",
    cities: [{ city: "Helsinki", region: "Uusimaa", lat: 60.17, lng: 24.94 }],
  },
  {
    country: "PL",
    cities: [
      { city: "Warsaw", region: "Warsaw", lat: 52.23, lng: 21.01 },
      { city: "Krakow", region: "Krakow", lat: 50.06, lng: 19.94 },
    ],
  },
  {
    country: "CZ",
    cities: [{ city: "Prague", region: "Prague", lat: 50.08, lng: 14.44 }],
  },
  {
    country: "AT",
    cities: [{ city: "Vienna", region: "Vienna", lat: 48.21, lng: 16.37 }],
  },
  {
    country: "CH",
    cities: [
      { city: "Zurich", region: "Zurich", lat: 47.38, lng: 8.54 },
      { city: "Geneva", region: "Geneva", lat: 46.2, lng: 6.14 },
    ],
  },
  {
    country: "BE",
    cities: [{ city: "Brussels", region: "Brussels", lat: 50.85, lng: 4.35 }],
  },
  {
    country: "BR",
    cities: [
      { city: "Sao Paulo", region: "Sao Paulo", lat: -23.55, lng: -46.63 },
      { city: "Rio de Janeiro", region: "Rio de Janeiro", lat: -22.91, lng: -43.17 },
    ],
  },
  {
    country: "MX",
    cities: [
      { city: "Mexico City", region: "Mexico City", lat: 19.43, lng: -99.13 },
      { city: "Guadalajara", region: "Guadalajara", lat: 20.66, lng: -103.35 },
    ],
  },
  {
    country: "AR",
    cities: [{ city: "Buenos Aires", region: "Buenos Aires", lat: -34.6, lng: -58.38 }],
  },
  {
    country: "CL",
    cities: [{ city: "Santiago", region: "Santiago", lat: -33.45, lng: -70.67 }],
  },
  {
    country: "JP",
    cities: [
      { city: "Tokyo", region: "Tokyo", lat: 35.68, lng: 139.69 },
      { city: "Osaka", region: "Osaka", lat: 34.69, lng: 135.5 },
    ],
  },
  {
    country: "KR",
    cities: [{ city: "Seoul", region: "Seoul", lat: 37.57, lng: 126.98 }],
  },
  {
    country: "CN",
    cities: [
      { city: "Shanghai", region: "Shanghai", lat: 31.23, lng: 121.47 },
      { city: "Beijing", region: "Beijing", lat: 39.9, lng: 116.41 },
    ],
  },
  {
    country: "IN",
    cities: [
      { city: "Bengaluru", region: "Bengaluru", lat: 12.97, lng: 77.59 },
      { city: "Mumbai", region: "Mumbai", lat: 19.08, lng: 72.88 },
      { city: "Delhi", region: "Delhi", lat: 28.61, lng: 77.21 },
    ],
  },
  {
    country: "SG",
    cities: [{ city: "Singapore", region: "Singapore", lat: 1.35, lng: 103.82 }],
  },
  {
    country: "AU",
    cities: [
      { city: "Sydney", region: "Sydney", lat: -33.87, lng: 151.21 },
      { city: "Melbourne", region: "Melbourne", lat: -37.81, lng: 144.96 },
    ],
  },
  {
    country: "NZ",
    cities: [{ city: "Auckland", region: "Auckland", lat: -36.85, lng: 174.76 }],
  },
  {
    country: "ZA",
    cities: [
      { city: "Cape Town", region: "Cape Town", lat: -33.92, lng: 18.42 },
      { city: "Johannesburg", region: "Johannesburg", lat: -26.2, lng: 28.05 },
    ],
  },
  {
    country: "NG",
    cities: [{ city: "Lagos", region: "Lagos", lat: 6.45, lng: 3.39 }],
  },
  {
    country: "KE",
    cities: [{ city: "Nairobi", region: "Nairobi", lat: -1.29, lng: 36.82 }],
  },
  {
    country: "EG",
    cities: [{ city: "Cairo", region: "Cairo", lat: 30.04, lng: 31.24 }],
  },
  {
    country: "AE",
    cities: [
      { city: "Dubai", region: "Dubai", lat: 25.2, lng: 55.27 },
      { city: "Abu Dhabi", region: "Abu Dhabi", lat: 24.45, lng: 54.38 },
    ],
  },
  {
    country: "IL",
    cities: [{ city: "Tel Aviv", region: "Tel Aviv", lat: 32.09, lng: 34.78 }],
  },
  {
    country: "TR",
    cities: [{ city: "Istanbul", region: "Istanbul", lat: 41.01, lng: 28.98 }],
  },
  {
    country: "RU",
    cities: [
      { city: "Moscow", region: "Moscow", lat: 55.76, lng: 37.62 },
      { city: "Saint Petersburg", region: "Saint Petersburg", lat: 59.93, lng: 30.34 },
    ],
  },
];

const FLAG_KEYS = ["checkout-redesign", "new-pricing", "dark-mode", "ai-assistant", "beta-banner"];
const VARIATIONS = ["on", "off", "control", "treatment"];
const REASONS = ["rollout", "rule_match", "default"];
const SDKS = ["js/0.1.1", "react/0.1.1", "node/0.1.1", "python/0.1.0"];

interface EvalRow {
  ts: string;
  org_id: string;
  project_id: string;
  env: string;
  flag_key: string;
  variation: string;
  reason: string;
  actor_kind: string;
  sdk: string;
  user_hash: string;
  country: string;
  region: string;
  city: string;
  lat: number;
  lng: number;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`Invalid ${name}=${raw}`);
    process.exit(1);
  }
  return Math.floor(n);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** ClickHouse DateTime64(3) UTC string. */
function toChTs(ms: number): string {
  return new Date(ms).toISOString().slice(0, -1).replace("T", " ");
}

function resolveCountries(mode: string, randomCount: number): CountrySeed[] {
  const byCode = new Map(COUNTRY_CITIES.map((c) => [c.country, c]));
  const trimmed = mode.trim().toLowerCase();

  if (trimmed === "all") return COUNTRY_CITIES;

  if (trimmed === "random" || trimmed === "") {
    const n = Math.min(Math.max(1, randomCount), COUNTRY_CITIES.length);
    return shuffle(COUNTRY_CITIES).slice(0, n);
  }

  const codes = mode
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  if (codes.length === 0) {
    console.error("SEED_COUNTRIES set is empty");
    process.exit(1);
  }

  const selected: CountrySeed[] = [];
  const missing: string[] = [];
  for (const code of codes) {
    const entry = byCode.get(code);
    if (!entry) missing.push(code);
    else selected.push(entry);
  }
  if (missing.length > 0) {
    console.error(
      `Unknown country code(s): ${missing.join(", ")}. Available: ${[...byCode.keys()].join(", ")}`,
    );
    process.exit(1);
  }
  return selected;
}

function jitterCoord(value: number): number {
  // ~±0.02° (~2 km) so cities aren't a single pixel stack
  return Math.round((value + (Math.random() - 0.5) * 0.04) * 100) / 100;
}

function buildRows(opts: {
  count: number;
  countries: CountrySeed[];
  orgId: string;
  projectId: string;
  env: string;
  periodHours: number;
}): EvalRow[] {
  const now = Date.now();
  const windowMs = opts.periodHours * 60 * 60 * 1000;
  const rows: EvalRow[] = [];

  for (let i = 0; i < opts.count; i++) {
    const country = pick(opts.countries);
    const city = pick(country.cities);
    const ts = now - Math.floor(Math.random() * windowMs);
    rows.push({
      ts: toChTs(ts),
      org_id: opts.orgId,
      project_id: opts.projectId,
      env: opts.env,
      flag_key: pick(FLAG_KEYS),
      variation: pick(VARIATIONS),
      reason: pick(REASONS),
      actor_kind: "sdk",
      sdk: pick(SDKS),
      user_hash: String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
      country: country.country,
      region: city.region,
      city: city.city,
      lat: jitterCoord(city.lat),
      lng: jitterCoord(city.lng),
    });
  }
  return rows;
}

async function insertBatch(
  url: string,
  user: string,
  password: string,
  rows: readonly EvalRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const endpoint = `${url.replace(/\/$/, "")}/?query=${encodeURIComponent(
    "INSERT INTO evaluations FORMAT JSONEachRow",
  )}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: rows.map((row) => JSON.stringify(row)).join("\n"),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ClickHouse insert failed: ${res.status} ${detail.slice(0, 500)}`);
  }
}

async function main(): Promise<void> {
  const url = requiredEnv("CLICKHOUSE_URL");
  const user = process.env.CLICKHOUSE_USER ?? "default";
  const password = process.env.CLICKHOUSE_PASSWORD ?? "";
  const orgId = requiredEnv("SEED_ORG_ID");
  const projectId = requiredEnv("SEED_PROJECT_ID");
  const env = process.env.SEED_ENV?.trim() || "dev";
  const countMinRaw = process.env.SEED_COUNT_MIN;
  const countMaxRaw = process.env.SEED_COUNT_MAX;
  let count = intEnv("SEED_COUNT", 1000);
  if (countMinRaw !== undefined && countMinRaw !== "" && countMaxRaw !== undefined && countMaxRaw !== "") {
    const min = intEnv("SEED_COUNT_MIN", 0);
    const max = intEnv("SEED_COUNT_MAX", 0);
    if (max < min) {
      console.error(`SEED_COUNT_MAX (${max}) < SEED_COUNT_MIN (${min})`);
      process.exit(1);
    }
    count = min + Math.floor(Math.random() * (max - min + 1));
    console.log(`Picked SEED_COUNT=${count} from [${min}, ${max}]`);
  }
  const countryMode = process.env.SEED_COUNTRIES?.trim() || "random";
  const countryCount = intEnv("SEED_COUNTRY_COUNT", 20);
  const periodHours = intEnv("SEED_PERIOD_HOURS", 24);
  const batchSize = Math.max(1, intEnv("SEED_BATCH_SIZE", 2000));

  if (count === 0) {
    console.log("SEED_COUNT=0 — nothing to insert.");
    return;
  }

  const countries = resolveCountries(countryMode, countryCount);
  console.log(
    `Seeding ${count} evaluations → org=${orgId} project=${projectId} env=${env}`,
  );
  console.log(
    `Countries (${countries.length}, mode=${countryMode}): ${countries
      .map((c) => c.country)
      .join(", ")}`,
  );
  console.log(`Period: last ${periodHours}h · batch size ${batchSize}`);

  const rows = buildRows({ count, countries, orgId, projectId, env, periodHours });

  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await insertBatch(url, user, password, batch);
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${count}`);
  }

  const byCountry = new Map<string, number>();
  for (const row of rows) {
    byCountry.set(row.country, (byCountry.get(row.country) ?? 0) + 1);
  }
  console.log("Done. Per-country:");
  for (const [code, n] of [...byCountry.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}\t${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
