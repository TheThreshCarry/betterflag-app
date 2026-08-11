# @betterflag/react

React hooks for [Betterflag](https://betterflag.app) feature flags. SSR-safe,
`useSyncExternalStore`-based, live-updating. Built on
[`betterflag`](https://www.npmjs.com/package/betterflag), same guarantee:
hooks never throw on network failure, they fall back to your defaults.

```bash
npm i @betterflag/react
```

## Quickstart

```tsx
import { BetterFlagProvider, useFlag } from "@betterflag/react";

function App() {
  return (
    <BetterFlagProvider clientKey="bf_sdk_..." user={{ userId: "u_42" }}>
      <Checkout />
    </BetterFlagProvider>
  );
}

function Checkout() {
  const newCheckout = useFlag("new-checkout", false);
  return newCheckout ? <NewCheckout /> : <LegacyCheckout />;
}
```

`useFlag(key, defaultValue)` returns `defaultValue` on the server and on the
first client render (no hydration mismatch), evaluates on mount, and
re-evaluates automatically whenever the flag config changes in the dashboard.

## Next.js App Router

The provider owns a browser-side client, so it lives in a client component:

```tsx
// app/providers.tsx
"use client";

import { BetterFlagProvider } from "@betterflag/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BetterFlagProvider
      clientKey={process.env.NEXT_PUBLIC_BETTERFLAG_SDK_KEY!} // publishable
      user={{ userId: "u_42", attributes: { plan: "pro" } }}
    >
      {children}
    </BetterFlagProvider>
  );
}
```

```tsx
// app/layout.tsx (server component)
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// app/checkout/banner.tsx
"use client";

import { useFlag } from "@betterflag/react";

export function PromoBanner() {
  const promo = useFlag("summer-promo", false);
  if (!promo) return null;
  return <div className="banner">Summer sale is live</div>;
}
```

### Identify the user after login

When the user isn't known at provider-mount time (they log in later), call
`signIn` on the client from `useBetterFlag()`. Every hook under the provider
re-evaluates for the new user automatically:

```tsx
"use client";

import { useEffect } from "react";
import { useBetterFlag } from "@betterflag/react";

export function useSyncBetterFlagIdentity(user: { id: string; plan: string } | null) {
  const betterflag = useBetterFlag();
  useEffect(() => {
    if (user) betterflag.signIn(user.id, { plan: user.plan });
    else betterflag.signOut();
  }, [betterflag, user]);
}
```

Leave the provider's `user` prop unset when you drive identity this way. A
per-hook `overrides` argument still wins over the signed-in user.

### Server-side usage (RSC, route handlers, middleware)

Hooks are client-only. In React Server Components, route handlers, and
server actions, use `betterflag` directly:

```tsx
// app/page.tsx (server component)
import { createClient } from "@betterflag/sdk";

const betterflag = createClient({ key: process.env.BETTERFLAG_SDK_KEY! });

export default async function Page() {
  const enabled = await betterflag.flag("new-hero", { default: false });
  return enabled ? <NewHero /> : <Hero />;
}
```

Tip: pass server-evaluated values to the provider's `bootstrap` prop
(e.g. from `await betterflag.allFlags(ctx)`) so the first client render already
shows real values instead of defaults, still hydration-safe.

## API

| Export | Signature | Notes |
| --- | --- | --- |
| `BetterFlagProvider` | `{ client } \| { clientKey, baseUrl?, defaults?, refreshInterval? }` plus `user?`, `bootstrap?` | Creates and owns the client when given `clientKey` (closed on unmount); never closes a caller-supplied `client`. |
| `useFlag` | `(key, defaultValue, overrides?) => T` | Value only. `overrides: { userId?, attributes? }` replaces the provider `user` for this call. |
| `useFlagDetail` | `(key, defaultValue, overrides?) => { value, reason, loading }` | `loading` is `true` until the first evaluation settles. |
| `useBetterFlag` | `() => BetterFlagClient` | Escape hatch to the underlying client. Throws a helpful error outside the provider. |
| `createFlagStore` | `(client, key, default, context?, bootstrap?)` | The pure subscription store behind the hooks (advanced/testing). |

`createClient`, `BetterFlagClient`, and the wire types are re-exported from
`betterflag` for convenience.

## Docs

Full documentation at [docs.betterflag.app](https://docs.betterflag.app).

MIT © 2026 Betterflag
