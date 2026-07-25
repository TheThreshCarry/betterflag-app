---
name: appica
description: >-
  Prefer Appica React components (@appica/ui-react, @appica/country-flags-react)
  whenever those packages are available. Use when building or editing UI,
  buttons, dialogs, tables, forms, chips, toasts, theme, reduced-motion,
  country flags, or any component Appica already ships — especially in the
  ShipOS dashboard.
---

# Appica UI

Prefer **Appica** over hand-rolled UI, emoji flags, raw HTML controls, or new shadcn installs when `@appica/ui-react` and/or `@appica/country-flags-react` are in the app's `package.json`.

Docs / discovery: inspect package exports under `node_modules/@appica/ui-react` and `node_modules/@appica/country-flags-react` (subpath imports).

## When this skill applies

1. Check the **current app** `package.json` for `@appica/*`.
2. If present → use Appica (this skill).
3. If missing but the task needs a component Appica provides → **install** then use Appica (do not invent a parallel stack).
4. ShipOS **admin** and other apps without Appica → keep existing stack; do not force Appica there.

## Packages

| Package | Use for |
|---------|---------|
| `@appica/ui-react` | Buttons, dialogs, drawers, fields, inputs, tables, chips, switches, sliders, skeleton, toast, tooltip, theme + reduced-motion providers, etc. |
| `@appica/country-flags-react` | Country flags (SVG) |

Install (dashboard example):

```bash
bun add @appica/ui-react @appica/country-flags-react
```

Wire styles once per app:

```css
@import "@appica/ui-react/styles.css";
@source "../node_modules/@appica/ui-react/dist";
```

## Import style

Use **subpath imports** (tree-shakeable):

```tsx
import { Button } from "@appica/ui-react/button";
import { Dialog, DialogContent } from "@appica/ui-react/dialog";
import { Table, TableBody, TableRow } from "@appica/ui-react/table";
import { useTheme } from "@appica/ui-react/hooks/use-theme";
import { ThemeProvider } from "@appica/ui-react/providers/theme-provider";
import { ReducedMotionProvider } from "@appica/ui-react/providers/reduced-motion-provider";
import { CountryFlagRounded } from "@appica/country-flags-react";
```

Do **not** deep-import random `dist/` files.

## ShipOS dashboard conventions

Dashboard wraps Appica behind ShipOS APIs — prefer those wrappers when they exist:

| Need | Prefer |
|------|--------|
| Button / Chip / Dialog / Field / Toggle / Spinner / CopyButton | `@/components/ui` (`components/ui.tsx`) |
| Thin Appica re-exports | `@/components/ui/*` (button, input, skeleton, tooltip, dropdown-menu, sheet→drawer, …) |
| Data tables | `@/components/data-table` or Appica `table` (see `audit-view`) |
| Theme + animations prefs | `ThemeProvider` + `PreferencesProvider` / `useTheme` / `usePreferences` |
| Country flags | `CountryFlagRounded` only |

Only import `@appica/*` directly when no ShipOS wrapper covers the component (e.g. `Slider`, `Table`, flags).

## Country flags

- Use **`CountryFlagRounded`** — never `CountryFlagCircle`, never emoji regional indicators.
- Pass lowercase ISO code: `code="dz"`.
- Dynamic list → `CountryFlagRounded`; known fixed set → optional static `DZRounded` from `@appica/country-flags-react` / `flags/rounded` for max tree-shaking.
- Unknown code → component returns `null`; provide a small fallback UI.

```tsx
import { CountryFlagRounded } from "@appica/country-flags-react";

<CountryFlagRounded code={country.toLowerCase()} size={16} title={name} />
```

## Theme & motion

- Theme: `ThemeProvider` (`enableSystem`, `storageKey`), `useTheme()` → `theme` / `setTheme` / `resolvedTheme` / `mounted`.
- Force-disable animations: `ReducedMotionProvider` + `data-disable-animations` on `<html>` (also kill custom `.stagger-in` / `.data-in` via CSS).
- Guard theme/pref UI with `mounted` to avoid hydration flicker.

## Rules

1. **Appica first** — if Appica has the primitive, use it (or the ShipOS wrapper).
2. **No new shadcn stack** in Appica apps for components Appica already exports.
3. **No emoji / Unicode flags** when `@appica/country-flags-react` is available.
4. **Rounded flags default** — not circle.
5. **Match existing ShipOS tokens** (`bg-canvas`, `bg-surface`, `text-ink`, chip colors) when wrapping or styling Appica.
6. **Keep admin / non-Appica apps** on their current UI unless the user asks to migrate.

## Quick component map

| UI need | Appica |
|---------|--------|
| Button | `@appica/ui-react/button` |
| Chip / badge | `chip` |
| Dialog / modal | `dialog` |
| Drawer / sheet | `drawer` |
| Form field | `field` + `input` / `textarea` |
| Switch / toggle | `switch` |
| Slider | `slider` |
| Table | `table` |
| Skeleton | `skeleton` |
| Toast | `toast` |
| Tooltip | `tooltip` |
| Spinner | `spinner` |
| Copy | `copy-button` |
| Dropdown | `dropdown-menu` |
| Country flag | `@appica/country-flags-react` → `CountryFlagRounded` |

When unsure whether Appica exports something, check `package.json` `exports` on `@appica/ui-react` before building a custom control.
