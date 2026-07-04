# ShipOS Design System

## Overview

ShipOS's marketing surface is a **warm paper canvas** — white page background with large warm-gray panels (`{colors.surface-warm}` #F6F5F3) that carry sections, mockups, and the closing CTA. Ink is near-black charcoal (`{colors.ink}` #171717); the primary CTA is a **dark charcoal button**, not a colored one.

Color arrives through **small multicolor category chips** — pill badges with pastel tinted backgrounds and saturated text (blue, pink, green, orange, gray) used to tag capabilities in the hero and feature rows. Semantic green (`{colors.success}` #00BC72) marks checkmarks and "Included" cells; semantic red/pink (`{colors.error}` #FF2C5F) marks X-marks and "Before" pains. Brand orange (`{colors.brand}` #FF5A1A) is reserved for brand moments: live-status dots, the "Most popular" pricing accent, alpha-discount callouts.

The page rhythm alternates centered and left-aligned sections with **generous whitespace** and **large soft radii** — 24px cards, 28–32px panels, pill chips. Product UI appears inside **macOS-style window mockups** (traffic lights, dark title bar) sitting on soft, wide drop shadows. The tone is playful-but-technical: friendly headlines, boat illustrations, real code.

**Key characteristics:**

- Warm light canvas; sections lift onto `{colors.surface-warm}` panels — never a dark marketing theme (dark appears only inside terminal/window mockups).
- Dark charcoal primary buttons (`{colors.ink}` bg, white text, `{rounded.button}` 16px).
- Multicolor chips are the color system; large fills stay neutral.
- Green ✓ / red ✕ semantic pairing for comparisons and before/after.
- Radii are big and soft: pill chips, 16px buttons, 24px cards, 28–32px panels. Squircle corner smoothing is applied globally.
- Typography is Plus Jakarta Sans throughout — semibold display with gentle `-0.02em` tracking, no uppercase eyebrows.
- macOS window mockups are the product-proof device of every demo section.

## Colors

### Surface
- **Canvas** (`{colors.canvas}`): #FFFFFF — page background.
- **Surface Warm** (`{colors.surface-warm}`): #F6F5F3 — cards, section panels, CTA panel.
- **Surface Warm Alt** (`{colors.surface-warm-alt}`): #F4F3F1 — featured/hovered lift.
- **Border Warm** (`{colors.border-warm}`): #e8e4de — 1px card and panel borders.
- **Window Dark** (`{colors.window-dark}`): #21252b title bars / #16181d terminal bodies — only inside mockups.

### Ink
- **Ink** (`{colors.ink}`): #171717 — headlines, body emphasis, primary button background.
- **Ink Muted** (`{colors.ink-muted}`): #737373 — secondary copy, captions.
- **On Primary**: #FFFFFF — text on dark buttons.

### Category chips (tinted bg at ~8–10% + saturated text)
- **Chip Blue** (`{colors.chip-blue}`): #0067F4 — SDK/config/dev-tooling tags.
- **Chip Pink** (`{colors.chip-pink}`): #FF2C5F — kill-switch/alerts tags.
- **Chip Green** (`{colors.chip-green}`): #00BC72 — agent/MCP/success tags.
- **Chip Orange** (`{colors.chip-orange}`): #FF5A1A — flags/brand tags.
- **Chip Gray** (`{colors.chip-gray}`): #737373 — "more"/neutral tags.

### Semantic
- **Success** (`{colors.success}`): #00BC72 — checkmarks, "Included", After-list.
- **Error** (`{colors.error}`): #FF2C5F / #dc2626 — X-marks, Before-list.
- **Brand** (`{colors.brand}`): #FF5A1A — live dots, most-popular accent, alpha offers.
- **Traffic lights**: #ff6058 / #ffbd2e / #28c840 — mockup window buttons.

## Typography

### Font Family
- **Plus Jakarta Sans** — everything: display, body, buttons, chips.
- **Mono** (Geist Mono / JetBrains Mono) — code inside mockups, flag keys, stat values only.

### Hierarchy

| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `{typography.display-xl}` | 64px | 600 | -0.02em | Hero headline |
| `{typography.display-lg}` | 56px | 600 | -0.02em | Section headlines |
| `{typography.headline}` | 28px | 600 | -0.01em | Card group titles, CTA panel heading |
| `{typography.card-title}` | 20px | 600 | -0.01em | Feature card titles, tier names |
| `{typography.body-lg}` | 18–20px | 400 | 0 | Subheads under headlines |
| `{typography.body}` | 15–16px | 400 | 0 | Default body |
| `{typography.caption}` | 13–14px | 400–500 | 0 | Meta, overage notes, chip labels |
| `{typography.button}` | 15–16px | 500 | 0 | Button labels |
| `{typography.mono}` | 13px | 400 | 0 | Code, flag keys |

### Principles
- No uppercase eyebrows; sections open directly with the headline.
- Display weight 600, body 400 — one family, one voice.
- Gentle tracking (-0.02em max); never Linear-style aggressive negative tracking.
- Mono only for code, keys, and stat values.

## Layout

- Base unit 4px. Container max-width 1200px; horizontal padding 24px mobile / 56px desktop.
- Section vertical padding: 64px mobile / 96px desktop; hero starts ~120–160px from top.
- Card grids 3-up desktop → 2-up tablet → 1-up mobile, 16–24px gaps.
- Alternation: hero left-aligned → centered section → left-aligned demo → centered pricing → centered CTA panel.
- Whitespace is generous; panels (not rules or gaps alone) separate major moments.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | Flat on canvas | Body text, headlines, footer |
| 1 | `{colors.surface-warm}` + 1px `{colors.border-warm}` | Cards, chips, panels |
| 2 | Hover: border darkens to #c8c4be + soft shadow `0 8px 24px rgba(0,0,0,0.04)` | Interactive cards |
| 3 | Mockup shadow `0 12px 48px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.04)` | macOS windows, terminals |

No hard shadows, no glows, no gradients. Depth = warm surface + border + one soft wide shadow under mockups.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.chip}` | 9999px | Category chips, status pills, "Most popular" badge |
| `{rounded.button}` | 16px (`rounded-2xl`) | All buttons, email inputs |
| `{rounded.control}` | 10–12px | Small controls, env switchers, rule rows |
| `{rounded.card}` | 24px | Feature cards, step cards |
| `{rounded.panel}` | 28px | Pricing cards, demo panels |
| `{rounded.hero-panel}` | 20px | Hero terminal/window mockups |
| `{rounded.section-panel}` | 32px | Big section panels, final CTA panel |

Squircle corner-shape + antialiased smoothing applied globally in `globals.css`.

## Components

**`button-primary`** — Dark charcoal CTA.
- Background `{colors.ink}`, white text, `{rounded.button}`, h-12, px-7, weight 500. Hover: 90% opacity.

**`button-secondary`** — Bordered ghost.
- White/transparent bg, 1px `{colors.border-warm}`, ink text, `{rounded.button}`, h-12, px-7. Hover: `{colors.surface-warm}` fill.

**`chip`** — Category pill badge.
- Tinted bg (chip color at 8–10%), saturated chip-color text, `{rounded.chip}`, ~6px 12px padding, 13–14px weight 500. Optional leading icon/dot.

**`waitlist-combo`** — Email input + dark submit button in one row; input `{rounded.button}` with warm border.

**`window-mockup`** — macOS window: dark title bar with traffic lights + filename, optional live dot; content = app UI or terminal session; `{rounded.hero-panel}`, mockup shadow.

**`feature-card`** — `{colors.surface-warm}` bg, `{rounded.card}`, p-6/8, colored icon chip (11×11, `{rounded.control}`, chip-color tint bg + chip-color icon), title + 2-line body. Each card may use a different chip color.

**`pricing-card`** — `{rounded.panel}`, warm bg, 1px warm border; tier name, price (600, sans), dark CTA button, green ✓ feature list, caption overage note under a top border. Featured tier: `{colors.brand}` 2px border + pill badge.

**`before-after-card`** — Paired cards: red ✕ list ("Before") and green ✓ list ("After") with red/green heading labels.

**`comparison-table`** — Feature rows with chip-tagged feature names; ShipOS column green "Included" checks; competitor column muted gray text/prices.

**`step-list`** — Numbered circle + title + body rows, used beside a mockup panel.

**`cta-panel`** — Full-width `{colors.surface-warm}` panel, `{rounded.section-panel}`, centered headline + subcopy + dark CTA (or waitlist combo), 56–80px padding. Light, never dark.

**`stat-row`** — Centered row of mono stat values + muted labels above a hairline.

## Do's and Don'ts

### Do
- Keep the canvas white and lift sections onto warm panels.
- Use dark charcoal for every primary CTA.
- Spend color in small doses: chips, icon tints, ✓/✕, live dots.
- Give every mockup macOS chrome and a soft wide shadow.
- Keep radii big (24px+ for cards) and corners squircle-smoothed.
- Pair green/red only for semantic comparison, never decoration.

### Don't
- Don't ship dark marketing sections — dark lives inside window mockups only.
- Don't use orange (or any chip color) as a button fill or section background.
- Don't add gradients, glows, or atmospheric effects.
- Don't use uppercase eyebrow labels or aggressive negative tracking.
- Don't introduce Linear lavender or any new accent outside the chip set.
- Don't shrink radii below 16px on interactive elements.

## Responsive Behavior

| Breakpoint | Width | Changes |
|---|---|---|
| Desktop | 1280px+ | Default; 3-up grids |
| Tablet | 1024px | Grids 3-up → 2-up |
| Mobile-Lg | 768px | Nav hamburger; grids 1-up; display-xl 64 → 40px |
| Mobile | 480px | Single column; section padding 96 → 64px |

- Buttons hold ≥44px tap height on touch.
- Mockups keep aspect ratio, never crop; chips wrap to multiple rows.
- Pricing cards stack vertically with featured tier first on mobile.
