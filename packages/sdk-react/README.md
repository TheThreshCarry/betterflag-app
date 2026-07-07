# @shiposapp/react

React hooks for [ShipOS](https://shipos.app) feature flags. SSR-safe,
`useSyncExternalStore`-based, live-updating. Built on
[`@shiposapp/sdk`](https://www.npmjs.com/package/@shiposapp/sdk), same guarantee:
hooks never throw on network failure, they fall back to your defaults.

```bash
npm i @shiposapp/react
```

## Quickstart

```tsx
import { ShipOSProvider, useFlag } from "@shiposapp/react";

function App() {
  return (
    <ShipOSProvider clientKey="sos_sdk_..." user={{ userId: "u_42" }}>
      <Checkout />
    </ShipOSProvider>
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

import { ShipOSProvider } from "@shiposapp/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ShipOSProvider
      clientKey={process.env.NEXT_PUBLIC_SHIPOS_SDK_KEY!} // publishable
      user={{ userId: "u_42", attributes: { plan: "pro" } }}
    >
      {children}
    </ShipOSProvider>
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

import { useFlag } from "@shiposapp/react";

export function PromoBanner() {
  const promo = useFlag("summer-promo", false);
  if (!promo) return null;
  return <div className="banner">Summer sale is live</div>;
}
```

### Identify the user after login

When the user isn't known at provider-mount time (they log in later), call
`signIn` on the client from `useShipOS()`. Every hook under the provider
re-evaluates for the new user automatically:

```tsx
"use client";

import { useEffect } from "react";
import { useShipOS } from "@shiposapp/react";

export function useSyncShipOSIdentity(user: { id: string; plan: string } | null) {
  const shipos = useShipOS();
  useEffect(() => {
    if (user) shipos.signIn(user.id, { plan: user.plan });
    else shipos.signOut();
  }, [shipos, user]);
}
```

Leave the provider's `user` prop unset when you drive identity this way. A
per-hook `overrides` argument still wins over the signed-in user.

### Server-side usage (RSC, route handlers, middleware)

Hooks are client-only. In React Server Components, route handlers, and
server actions, use `@shiposapp/sdk` directly:

```tsx
// app/page.tsx (server component)
import { createClient } from "@shiposapp/sdk";

const shipos = createClient({ key: process.env.SHIPOS_SDK_KEY! });

export default async function Page() {
  const enabled = await shipos.flag("new-hero", { default: false });
  return enabled ? <NewHero /> : <Hero />;
}
```

Tip: pass server-evaluated values to the provider's `bootstrap` prop
(e.g. from `await shipos.allFlags(ctx)`) so the first client render already
shows real values instead of defaults, still hydration-safe.

## API

| Export | Signature | Notes |
| --- | --- | --- |
| `ShipOSProvider` | `{ client } \| { clientKey, baseUrl?, defaults?, refreshInterval? }` plus `user?`, `bootstrap?` | Creates and owns the client when given `clientKey` (closed on unmount); never closes a caller-supplied `client`. |
| `useFlag` | `(key, defaultValue, overrides?) => T` | Value only. `overrides: { userId?, attributes? }` replaces the provider `user` for this call. |
| `useFlagDetail` | `(key, defaultValue, overrides?) => { value, reason, loading }` | `loading` is `true` until the first evaluation settles. |
| `useShipOS` | `() => ShipOSClient` | Escape hatch to the underlying client. Throws a helpful error outside the provider. |
| `createFlagStore` | `(client, key, default, context?, bootstrap?)` | The pure subscription store behind the hooks (advanced/testing). |

`createClient`, `ShipOSClient`, and the wire types are re-exported from
`@shiposapp/sdk` for convenience.

## Docs

Full documentation at [docs.shipos.app](https://docs.shipos.app).

MIT © 2026 ShipOS
