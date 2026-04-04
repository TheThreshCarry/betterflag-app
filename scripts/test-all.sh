#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting test database containers..."
bun run test:docker:up

echo "==> Running database migrations..."
bun run test:db:migrate

echo "==> Running unit tests..."
bun run test:unit

echo "==> Running integration tests..."
bun run test:integration

echo "==> Running E2E tests..."
bun run test:e2e

echo "==> Tearing down test containers..."
bun run test:docker:down

echo "==> All tests passed!"
