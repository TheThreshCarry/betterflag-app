import Redis from "ioredis"
import { createLogger } from "@/lib/logger"

const log = createLogger("redis")
const globalForRedis = globalThis as unknown as { redis?: Redis }

function createRedisClient() {
  const url = process.env.REDIS_URL
  if (!url) {
    log.warn("REDIS_URL not set — Redis disabled")
    return null
  }

  log.info("creating Redis client")
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== "production" && redis) {
  globalForRedis.redis = redis
}
