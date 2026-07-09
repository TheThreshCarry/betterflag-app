# ShipOS — Product Hunt Alpha Launch Kit

Positioning note for this launch: **lead with agentic-first** (agents create
flags, stage rollouts, pull kill switches over MCP), supported by edge speed
and 5-minute setup. Simple one-meter pricing is the closer, and "unlimited
seats" appears exactly once (pricing slide) — it's a supporting detail here,
not the headline USP.

PH format constraints: tagline ≤60 chars, description ≤500 chars, gallery
images 1270×760, thumbnail 240×240, all assets <3MB.

---

## 1. Listing basics

**Name:** ShipOS

**Tagline (pick one, all ≤60):**

1. `Feature flags your coding agents can ship with` — 47 chars *(recommended)*
2. `Ship, roll out, kill features straight from your agent` — 55 chars
3. `The feature flag platform built for the agent era` — 50 chars

**Topics:** Developer Tools · Artificial Intelligence · SaaS · Tech

**Description (≤500 chars, currently 424):**

> ShipOS is a feature flag platform where the MCP server and REST API are the
> primary interface. Claude Code or Cursor can create flags, stage percentage
> rollouts, target beta users, and pull kill switches — with agent-scoped
> keys, an agent-attributed audit trail, and approval guardrails for prod.
> Flags evaluate from Cloudflare's edge in under 50ms. One simple meter, from
> $9.99/mo. Private alpha: 50% off for life.

**Links:** shipos.app (with `?ref=producthunt`), docs.shipos.app

---

## 2. Maker's first comment

> Hey Product Hunt 👋
>
> I'm Mehdi, and I built ShipOS because of a moment that kept repeating: my
> coding agent would finish a feature in minutes — code written, PR open —
> and then everything stopped so a human (me) could log into a flag
> dashboard and do data entry. Create the flag the agent already named. Wire
> up three environments. Click the rollout slider. The agent did the
> engineering; I did the clicking.
>
> That's backwards. So ShipOS treats the MCP server and the API as the
> product, and the dashboard as the observation layer. From Claude Code or
> Cursor you can create a flag, turn it on in staging, stage a 10% production
> rollout, pin it on for your beta cohort, watch evaluation stats, and kill
> it instantly if something's wrong. Every action is attributed to an
> agent-scoped key in the audit log, and you can require human approval for
> the scary stuff (like prod kill switches) while everything else runs
> autonomously.
>
> Under the hood, flags are served from Cloudflare's edge in under 50ms
> globally, and setup is genuinely five minutes — SDKs for JS, React, and
> Node.
>
> Pricing is deliberately boring: one meter (flag evaluations), public
> prices, from $9.99/mo, no "Contact sales". That's the whole model.
>
> Today we're opening the **private alpha**. Everyone who joins from this
> launch locks in **50% off, for life** — and gets a direct line to me while
> we shape the roadmap.
>
> I'd love the community's take on one question in particular: where should
> the line between agent autonomy and human approval sit by default? I have
> opinions, but I'd rather hear yours.
>
> Ask me anything — I'll be here all day. 🚢

---

## 3. Thumbnail (240×240)

**Option A — animated GIF (recommended):** the ShipOS logo mark on the dark
`#222222` rounded tile; a minimal toggle switch below it flips from off to
on, the knob turning orange `#FF5A1A` on flip; loops every ~2s. Build in
Figma/After Effects from the real logo — don't AI-generate the logo.

**Option B — static prompt:**

> Flat minimal vector icon, warm off-white background #F6F5F3: a single
> rounded-square app tile in near-black #222222 containing a simple white
> geometric flag glyph, with a small orange #FF5A1A toggle switch set to ON
> at its lower right corner. Thin hairline stroke #E8E4DE around the tile,
> generous padding, no gradients, no drop shadows, no text anywhere.

---

## 4. Gallery (1270×760, in order)

Rule for all statics: illustration prompts generate the **background scene
only — no text in the image**. Overlay headline/sub in Figma using the brand
type (Plus Jakarta Sans 600, negative tracking; mono for numbers), ink
`#171717` on the warm canvas, orange reserved for one accent per slide.

Shared style base (append to every prompt): *flat minimal vector
illustration, warm off-white background #F6F5F3, near-black ink line work
#171717, single orange accent #FF5A1A used sparingly, thin hairline strokes
#E8E4DE, generous whitespace, no gradients, no drop shadows, no text or
words anywhere, editorial tech aesthetic, wide 1270x760 composition with
clear space in the upper third for a headline overlay.*

### Slide 1 — the 30-second agent demo (video slot)

Per the launch playbook this is the centerpiece: screen recording of Claude
Code creating `checkout-v2`, enabling staging, staging a 10% prod rollout,
then `kill_flag`. No static prompt — real product footage. Captions burned in.

### Slide 2 — hero claim

- **Overlay:** `Feature flags your agents can ship with` / sub: `MCP + REST
  as the primary interface. The dashboard is for watching.`
- **Prompt:** A minimal terminal window in thin ink outline on the left
  connected by a single flowing line to a wall panel of toggle switches on
  the right; one toggle orange and ON; a small calm human figure observes
  from a distance holding a coffee cup.

### Slide 3 — the full loop, no dashboard

- **Overlay:** `Create → stage → roll out → kill` / sub: `One session in
  Claude Code or Cursor. Zero tabs.`
- **Prompt:** Four small scenes in a horizontal storyboard strip, thin
  hairline dividers between them: (1) a hand-shaped robot gripper placing a
  small flag onto a pedestal, (2) the flag inside a glass staging bell jar,
  (3) the flag multiplied across a grid of tiny user dots with a pie-slice
  filled orange, (4) a large lever pulled down. Even rhythm, diagram-like.

### Slide 4 — guardrails & audit

- **Overlay:** `Autonomy with a paper trail` / sub: `Agent-scoped keys,
  agent-attributed audit log, human approval where you want it.`
- **Prompt:** A long unfurling receipt/scroll in ink outline listing
  abstract rows (dashes and dots, no letters); alongside it a small robot
  and a human figure each pressing their own distinct stamp onto separate
  rows; one stamped row highlighted orange; a small shield glyph at top.

### Slide 5 — edge speed

- **Overlay:** `Evaluated at the edge in <50ms` / sub: `Served from
  Cloudflare's network, everywhere your users are.`
- **Prompt:** A globe drawn from thin latitude/longitude hairlines with
  small ink dots scattered across continents; from each dot a very short
  straight spark line; exactly one dot enlarged with an orange pulse ring
  around it; a tiny stopwatch glyph floating upper right.

### Slide 6 — pricing

- **Overlay:** `One meter. Public prices.` / sub: `From $9.99/mo — unlimited
  flags, environments, and seats. Pay for evaluations, not headcount.`
  *(the single seats mention of the launch)*
- **Prompt:** One large clean utility meter with a simple dial, its needle
  resting in an orange-marked zone, mounted alone on a wall; beneath it a
  single small price tag shape (blank); pointedly minimal — one object, lots
  of negative space.

### Slide 7 — alpha offer / CTA

- **Overlay:** `Private alpha, open today` / sub: `Founding users lock in
  50% off, for life.`
- **Prompt:** A velvet rope and two stanchion posts in thin ink outline with
  the rope unhooked and hanging open; beyond it a doorway glowing warm
  orange around its edges; a small paper ticket on the floor in front. Calm,
  inviting, uncluttered.

---

## 5. Supporting posts (launch day)

**X thread opener:**

> Today ShipOS is live on Product Hunt 🚢
>
> It's a feature flag platform where your coding agent is a first-class
> operator: Claude Code creates the flag, stages the rollout, and pulls the
> kill switch — audited, scoped, reversible.
>
> 30-second demo below. Alpha users get 50% off for life. 👇

**Show HN title:** `Show HN: ShipOS – feature flags managed by coding agents over MCP`

**Show HN text (short, technical, no marketing tone):**

> I kept watching my agent finish a feature and then wait for me to click
> around a flag dashboard. So I built a flag platform where the MCP server
> has full API parity: create_flag, set_rollout, set_targeting, kill_flag,
> evaluation stats, audit log. Agent keys are scoped and every action is
> attributed; you can require human approval per action type (e.g. prod
> kills). Evaluation happens on Cloudflare workers at the edge, <50ms.
> Curious what HN thinks about the autonomy/approval line for prod changes.

---

## 6. Pre-flight checklist

- [ ] Record + edit the 30s agent demo clip (slide 1) with burned-in captions
- [ ] Generate statics from prompts, overlay copy in Figma, export ≤3MB
- [ ] Thumbnail GIF from real logo assets
- [ ] Replace/remove placeholder "Trusted by founders at" names on landing (pre-launch blocker per project context)
- [ ] `?ref=producthunt` UTM on all listing links; verify PostHog captures it
- [ ] Waitlist → alpha email flow tested (50%-for-life coupon wired in Polar)
- [ ] Publish `launchdarkly-alternatives-2026` + `feature-flags-mcp` blog drafts before launch day for the traffic spike
- [ ] Schedule launch 12:01 AM PT; maker comment posted immediately after
