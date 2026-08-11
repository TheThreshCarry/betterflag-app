# Betterflag Alpha Launch - Master Checklist

Target: **Thursday, July 23, 2026, 12:01 AM PT** (T-0). Today = T-14.
Companion docs: `product-hunt-alpha-launch.md` (assets & copy),
blog drafts in `betterflag-landing/content/blog/` (ITR-58).

Rule of thumb: everything in "Product & Dev" and "Billing" must be done by
**T-7** so the last week is only polish, assets, and dry runs.

---

## 1. Product & Dev (deadline T-7)

**Critical path: a trial user must be able to sign up → create project →
create flag → evaluate from SDK → connect MCP → upgrade to paid.**

- [ ] **Full trial walkthrough on a fresh account** (not your dev account):
      signup, onboarding, first flag, SDK evaluation from a real Next.js
      app, MCP connect via OAuth, upgrade. Fix everything that snags.
- [ ] Kill switch drill: `kill_flag` from Claude Code propagates to edge
      globally; measure and record the actual latency (you'll quote it).
- [ ] Plan limits enforced: evaluations metering, overage behavior, project
      caps, agent-key caps per tier; test at the limit, not just under it.
- [ ] Trial expiry path: what happens on day 15 without a card? (Grace
      state, not data loss.)
- [ ] **Deploy pending work from this week:**
  - [ ] betterflag-landing: PostHog `/dock` proxy + instrumentation fix (ITR-55)
  - [ ] betterflag-app dashboard: PostHog wiring - `bun install`, env var, deploy (ITR-57)
  - [ ] betterflag-docs: OG image (ITR-56)
- [ ] SDKs published to npm (`@betterflag/sdk-js`, `@betterflag/sdk-react`) with
      correct READMEs; `npm install` from a clean machine works.
- [ ] Error tracking on all surfaces (dashboard, edge, ingest, mcp,
      webhooks workers); you want stack traces at 12:05 AM, not logs.
- [ ] Rate limiting on auth, waitlist, and newsletter endpoints (HN will
      fuzz them for sport).
- [ ] Load test landing + edge evaluate endpoint (see the PH checklist blog
      post you already wrote; follow your own advice: `hey -z 30s -c 200`).
- [ ] Feature-freeze at T-7. After that, only bug fixes. Ship day is not
      refactor day.

## 2. Infra & Ops (deadline T-5)

- [ ] **Status page live** (Better Stack, already connected): monitors on
      app.betterflag.app, edge, mcp.betterflag.app, docs; status.betterflag.app CNAME.
- [ ] Uptime alerts → phone/Slack, not email. On-call = you; write down the
      escalation ritual anyway (what you check first, in order).
- [ ] Cloudflare: confirm Workers limits/plan headroom for a traffic spike;
      check D1/KV/DO quotas on current tier.
- [ ] Supabase: connection pooling verified, plan headroom, PITR/backups
      enabled and a restore actually tested once.
- [ ] DNS + TLS on all subdomains (www, app, edge, mcp, docs, status, t).
- [ ] Domain email deliverability: SPF/DKIM/DMARC for betterflag.app (lifecycle
      emails + waitlist blast will tank without it); test with
      mail-tester.com.
- [ ] Secrets audit: no keys in repos, prod env vars documented, personal
      tokens rotated out of CI.
- [ ] Rollback plan written: how to revert a bad dashboard deploy and a bad
      worker deploy in <5 min (and, yes, your own kill switches on any
      risky launch-adjacent features).

## 3. Analytics & Funnel (deadline T-5)

- [ ] PostHog events verified end-to-end AFTER the /dock deploys: pageview →
      waitlist/trial signup → activation (first flag) → MCP connected →
      upgrade. One funnel insight + one dashboard; don't overbuild.
- [ ] UTM discipline: `?ref=producthunt`, `?ref=hn`, `?ref=x`; confirm
      PostHog captures ref/UTM on first touch.
- [ ] Server-side capture for the conversion events (signup, upgrade) so ad
      blockers can't blind you on the numbers that matter.
- [ ] Uptime/latency numbers you'll quote publicly (<100ms) re-measured and
      screenshotted; someone on HN will check.

## 4. Billing & Business (deadline T-7)

- [ ] Polar products match the pricing table exactly: $9.99/$25/$95, 14-day
      trial no card, overage prices ($5/$5/$3 per extra 1M).
- [ ] **50%-off-for-life coupon** for alpha/waitlist users: created, tested
      end-to-end, and scoped so it can't leak publicly.
- [ ] Test the full money path with a real card: trial → upgrade → invoice
      → refund. Check the invoice says the right legal entity.
- [ ] Tax handling confirmed (Polar as merchant of record covers VAT/sales
      tax; verify your account is configured for EU + US).
- [ ] Refund policy page (`/refund` exists) matches what Polar actually
      does; terms + privacy reviewed once with fresh eyes (Supabase,
      Cloudflare, PostHog EU, Polar as subprocessors).
- [ ] Support routing: hi@betterflag.app (Spark) tested inbound + outbound;
      saved replies for the obvious five (pricing, trial, migration from
      LaunchDarkly, self-host?, SSO?).
- [ ] Decide the launch-week support SLA for yourself (e.g., <2h during
      waking hours) and block calendar accordingly.

## 5. Marketing & Content (T-7 → T-1)

- [ ] **Remove/replace placeholder "Trusted by founders at" logos**
      (`SocialProofFlags.tsx:18`) - known blocker, do it first.
- [ ] Generate images for the 5 blog drafts (prompts in each folder),
      publish `launchdarkly-alternatives-2026` + `feature-flags-mcp` by
      T-3 so they're indexed before launch traffic.
- [ ] Record the **30-second agent demo clip** (T-10, allow re-shoots):
      Claude Code creates flag → staging → 10% rollout → kill. Captions
      burned in. This is slide 1 of the PH gallery AND the X thread lead.
- [ ] PH listing assets built from `product-hunt-alpha-launch.md`: pick
      tagline, thumbnail GIF, 6 statics with copy overlays (≤3MB each).
- [ ] Waitlist email wave 1 (T-7): "we launch on the 23rd, here's your 50%
      code", sent through the lifecycle/React Email stack, no em dashes.
- [ ] Waitlist email wave 2 (T-0 morning): "we're live on PH" + direct link.
- [ ] X thread + Show HN drafted (kit has them); schedule the X thread,
      post Show HN manually ~8-9 AM ET.
- [ ] Line up 10-15 people who'll genuinely engage on PH launch morning
      (comments > upvotes; never ask for upvotes explicitly, PH penalizes it).
- [ ] MCP registry submissions prepped (submit T+1, not launch day, so
      the listing can link to a live PH page).

## 6. Docs & Onboarding (deadline T-3)

- [ ] docs.betterflag.app covers: 5-min quickstart, JS + React SDK, MCP setup
      (OAuth + agent key), targeting/rollouts, kill switch, pricing/limits
      FAQ. Every code sample copy-paste tested.
- [ ] `llms.txt` current (it exists; verify content matches the pivot).
- [ ] Dashboard empty states point somewhere useful (no dead ends for a
      brand-new account).
- [ ] Onboarding email sequence (lifecycle app) reviewed: day 0 welcome,
      day 3 activation nudge, day 12 trial-ending. Send all to yourself.

## 7. Launch day (T-0, July 23)

- [ ] 12:01 AM PT: listing live; maker comment posted immediately.
- [ ] Verify site, signup, and checkout while traffic ramps (fresh browser,
      ad blocker ON, you know why).
- [ ] Morning: waitlist wave 2, X thread, Show HN (~8-9 AM ET).
- [ ] Reply to every PH comment + HN thread all day; the autonomy/approval
      question in the maker comment is your discussion engine.
- [ ] Watch: error tracker, status page, PostHog live events, Polar
      checkouts. Four tabs, nothing else.
- [ ] Capture screenshots of rank/metrics through the day (you'll want
      them for the retro post regardless of placement).

## 8. Post-launch (T+1 → T+7)

- [ ] T+1: MCP registry submissions; thank-you note to engaged commenters.
- [ ] T+2: personal email to every trial signup (founder voice, one
      question: "what were you hoping this would do?").
- [ ] T+3: launch retro blog post (numbers, honest); it feeds the content
      flywheel either way.
- [ ] T+7: funnel review vs. plan (trial starts, activation %, trial→paid
      trajectory, CAC by ref) and decide the next two weekly posts.
- [ ] Log outcomes in Linear; update the 90-day plan assumptions with real
      numbers.

---

## Known open items feeding this list (from Linear)

- ITR-55 - landing PostHog /dock fix: **needs deploy**
- ITR-56 - docs OG image: **needs deploy**
- ITR-57 - dashboard PostHog: **needs bun install + env + deploy**
- ITR-58 - 5 blog drafts: **need images + publish**
- ITR-59 - PH kit: **needs assets built from prompts + demo clip**
