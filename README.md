# ShipOS

**You build the product. ShipOS handles the rest.**

ShipOS is a product operations platform for developers and SaaS teams.

It centralizes everything around your product — documentation, changelogs, roadmaps, announcements, feature flags, and releases — into one system, delivered via an SDK and edge infrastructure. Instead of stitching together multiple tools or building this in-house, teams use ShipOS to ship faster, communicate more clearly, and scale with less operational overhead.

---

## Project Structure

```
shipos-app/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── providers.tsx             # Auth UI provider
│   ├── page.tsx                  # Home page
│   ├── globals.css               # Global styles (Tailwind)
│   ├── auth/[path]/              # Auth pages (sign-in, sign-up, etc.)
│   ├── account/[path]/           # Account management pages
│   └── organization/[path]/      # Organization management pages
│
├── lib/
│   ├── auth/                     # Authentication configuration
│   │   ├── index.ts              # Better Auth server config
│   │   └── auth-client.ts        # Auth client for frontend
│   └── db/
│       ├── index.ts              # Database connection (Drizzle + PostgreSQL)
│       └── schema.ts             # Database schema definitions
│
├── workers/
│   └── auth-api-worker/          # Cloudflare Worker for Auth API
│       ├── src/index.ts          # Hono-based API handler
│       └── lib/better-auth.ts    # Worker-specific auth config
│
├── drizzle/                      # Database migrations
│   └── meta/                     # Migration metadata
│
├── auth-schema.ts                # Generated auth schema types
├── drizzle.config.ts             # Drizzle ORM configuration
└── package.json
```

## Tech Stack

| Layer          | Technology                                      |
| -------------- | ----------------------------------------------- |
| Framework      | [Next.js 16](https://nextjs.org) (App Router)   |
| Auth           | [Better Auth](https://better-auth.com)          |
| Auth UI        | [Better Auth UI](https://better-auth-ui.com)    |
| Database       | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Edge Workers   | [Cloudflare Workers](https://workers.cloudflare.com) + [Hono](https://hono.dev) |
| Styling        | [Tailwind CSS v4](https://tailwindcss.com)      |
| Runtime        | [Bun](https://bun.sh)                           |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- PostgreSQL database
- Cloudflare account (for Workers)

### Installation

```bash
# Install dependencies
bun install

# Set up environment variables
cp .example.env .env
# Edit .env with your DATABASE_URL and other secrets
```

### Development

```bash
# Run the Next.js dev server
bun dev

# Run database migrations
bun run drizzle-migrate

# Open Drizzle Studio (database GUI)
bun run drizzle-studio
```

### Auth Worker (Cloudflare)

```bash
cd workers/auth-api-worker

# Install dependencies
bun install

# Run locally
bun run dev

# Deploy to Cloudflare
bun run deploy
```

## Available Scripts

| Script                | Description                              |
| --------------------- | ---------------------------------------- |
| `bun dev`             | Start Next.js development server         |
| `bun build`           | Build for production                     |
| `bun start`           | Start production server                  |
| `bun run drizzle-studio` | Open Drizzle database GUI             |
| `bun run drizzle-migrate` | Run database migrations              |
| `bun run drizzle-generate` | Generate new migration files        |
| `bun run drizzle-push` | Push schema changes to database         |
| `bun run ba-generate` | Generate Better Auth schema types        |

## Next Steps

- [ ] Add [Settings Cards](https://better-auth-ui.com) from Better Auth UI for user profile management
- [ ] Implement email sending for magic links and OTP verification
- [ ] Configure social OAuth providers (Google, GitHub, etc.)
- [ ] Set up organization invitation flows

---

<p align="center">
  <strong>ShipOS</strong> — Ship faster. Communicate clearly. Scale with less overhead.
</p>
