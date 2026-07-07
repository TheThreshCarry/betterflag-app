# @shipos/sdk

Feature flags for Node and the browser, by [ShipOS](https://shipos.app).
Zero dependencies. Never throws. Works offline.

## Quickstart

```bash
npm i @shipos/sdk
```

```ts
import { createClient } from "@shipos/sdk";

const shipos = createClient({ key: "sos_sdk_your_key_here" });

const enabled = await shipos.flag("new-checkout", { userId: "u_42", default: false });
if (enabled) renderNewCheckout();
```

That's it, no init ceremony, no waiting. Grab an SDK key from your ShipOS
dashboard (Project → Environment → API keys). SDK keys are publishable:
they can only evaluate flags, so they're safe to ship to browsers.

## Offline defaults: `flag()` never throws

Every call takes a `default`. If the network is down, the edge returns an
error, or the flag doesn't exist, you get your default back, always:

```ts
// Airplane mode? Edge outage? Typo'd key? You still get `false` here.
const enabled = await shipos.flag("new-checkout", { userId: "u_42", default: false });
```

No try/catch around flag checks, ever. Errors are reported to your optional
`onError` callback instead of being thrown at call sites.

Flags are any JSON type, not just booleans:

```ts
const theme = await shipos.flag("theme", { userId: "u_42", default: "light" });
const limit = await shipos.flag("rate-limit", { default: 100 });
const cfg = await shipos.flag("retry-config", { default: { retries: 3 } });
```

## Identify a user once with `signIn`

Instead of passing `userId` and attributes on every call, identify the user
once (PostHog-style) and every subsequent evaluation targets them:

```ts
shipos.signIn("user-123", { plan: "pro", region: "eu" });

// Both evaluated for user-123 with { plan, region }, no need to repeat it.
const checkout = await shipos.flag("new-checkout", { default: false });
const all = await shipos.allFlags();

shipos.signOut(); // back to anonymous
```

A per-call `userId`/`attributes` still wins over the signed-in identity, and
per-call attributes are merged over the identity's. `signIn` is purely local -
ShipOS targets users at evaluation time, so there's no network round-trip -
and it clears the evaluation cache so flags re-evaluate for the new user.

## Node example

```ts
import { createClient } from "@shipos/sdk";

const shipos = createClient({
  key: process.env.SHIPOS_SDK_KEY!,
  onError: (err) => console.warn("[shipos]", err),
});

export async function handler(req: Request): Promise<Response> {
  const useV2 = await shipos.flag("api-v2", {
    userId: req.headers.get("x-user-id") ?? undefined,
    attributes: { region: "eu" },
    default: false,
  });
  return useV2 ? handleV2(req) : handleV1(req);
}
```

The background refresh timer is `unref`'d, the client never holds your
process open. No `close()` needed before exit (it exists if you want it).

## Browser example

```ts
import { createClient } from "@shipos/sdk";

const shipos = createClient({
  key: "sos_sdk_...", // publishable
  defaults: { "new-checkout": false, theme: "light" }, // served when offline
});

shipos.on("update", async () => {
  // config changed in the dashboard, re-read what you care about
  applyTheme(await shipos.flag("theme", { userId, default: "light" }));
});
```

Building with React? Use [`@shipos/react`](https://www.npmjs.com/package/@shipos/react)
instead, hooks, SSR safety, and live updates wired up for you.

## How it works

- Evaluations go to `POST edge.shipos.app/v1/evaluate` and are cached
  in-memory per `(flag, userId, attributes)` for `refreshInterval` (min 5s),
  so hot flags cost zero network calls.
- In the background the client polls `GET /v1/snapshot` with `If-None-Match`;
  a `304` costs almost nothing. When the config version changes, the cache is
  cleared and `'update'` fires.
- `await shipos.ready()` if you want to block until the first config fetch
  settles (it resolves on failure too, never rejects).

## API

| Method | Returns | Notes |
| --- | --- | --- |
| `flag(key, { userId?, attributes?, default })` | `Promise<T>` | The flag's value, or `default` on any failure. Never throws. |
| `flagDetail(key, opts?)` | `Promise<EvaluationResult>` | Full result: `value`, `reason`, `variation`, `ruleId?`, `bucket?`. |
| `allFlags(context?)` | `Promise<Record<string, JsonValue>>` | Every flag in the environment. Client `defaults` (or `{}`) on failure. |
| `signIn(userId, metadata?)` | `void` | Set the ambient user merged into every evaluation. Clears the cache and fires `'update'`. |
| `signOut()` | `void` | Clear the ambient user set by `signIn`. Evaluations are anonymous again. |
| `getUser()` | `{ userId, attributes? } \| null` | The current identity, or `null` when anonymous. |
| `on("update", cb)` | `() => void` | Fires after a config change (or `signIn`/`signOut`); returns unsubscribe. |
| `ready()` | `Promise<void>` | Resolves after the first snapshot fetch settles. Never rejects. |
| `close()` | `void` | Stops polling, drops listeners. |

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `key` | `string` |, (required) | SDK key (`sos_sdk_...`). Publishable. |
| `baseUrl` | `string` | `https://edge.shipos.app` | Edge API origin. |
| `refreshInterval` | `number` | `30000` | Snapshot poll cadence and evaluation-cache TTL, in ms (TTL clamped to ≥5000). `0` disables polling. |
| `defaults` | `Record<string, JsonValue>` | `{}` | Offline fallbacks by flag key: returned by `allFlags()` on failure and used by `flagDetail()` when no per-call default is given. |
| `fetch` | `typeof fetch` | global `fetch` | Custom fetch (tests, polyfills, proxies). |
| `onError` | `(err: unknown) => void` |, | Observes every swallowed error. |

## Docs

Full documentation, targeting rules, and the edge API reference live at
[docs.shipos.app](https://docs.shipos.app).

MIT © 2026 ShipOS
