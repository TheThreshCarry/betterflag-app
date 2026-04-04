import { redis } from "@/lib/redis"
import { createLogger } from "@/lib/logger"

const log = createLogger("cache")
const TTL = 300 // 5 minutes

function listKey(orgId: string | null) {
  return `ct:org:${orgId ?? "_null"}:list`
}

function byIdKey(id: string) {
  return `ct:id:${id}`
}

function slugKey(orgId: string | null, slug: string) {
  return `ct:org:${orgId ?? "_null"}:slug:${slug}`
}

export async function getCachedContentTypes<T>(
  orgId: string | null,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) return fetcher()

  const key = listKey(orgId)
  const cached = await redis.get(key)
  if (cached) {
    log.debug({ key, orgId }, "cache HIT content-types list")
    return JSON.parse(cached) as T
  }

  log.debug({ key, orgId }, "cache MISS content-types list, fetching from DB")
  const data = await fetcher()
  await redis.set(key, JSON.stringify(data), "EX", TTL)
  log.debug({ key, ttl: TTL }, "cache SET content-types list")
  return data
}

export async function getCachedContentType<T>(
  id: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) return fetcher()

  const key = byIdKey(id)
  const cached = await redis.get(key)
  if (cached) {
    log.debug({ key, id }, "cache HIT content-type by id")
    return JSON.parse(cached) as T
  }

  log.debug({ key, id }, "cache MISS content-type by id, fetching from DB")
  const data = await fetcher()
  if (data) await redis.set(key, JSON.stringify(data), "EX", TTL)
  return data
}

export async function getCachedContentTypeBySlug<T>(
  orgId: string | null,
  slug: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) return fetcher()

  const key = slugKey(orgId, slug)
  const cached = await redis.get(key)
  if (cached) {
    log.debug({ key, orgId, slug }, "cache HIT content-type by slug")
    return JSON.parse(cached) as T
  }

  log.debug({ key, orgId, slug }, "cache MISS content-type by slug, fetching from DB")
  const data = await fetcher()
  if (data) await redis.set(key, JSON.stringify(data), "EX", TTL)
  return data
}

export async function invalidateContentTypeCache(
  orgId: string | null,
  id?: string,
  slug?: string
) {
  if (!redis) return

  const keys = [listKey(orgId)]
  if (id) keys.push(byIdKey(id))
  if (slug) keys.push(slugKey(orgId, slug))

  await redis.del(...keys)
  log.info({ keys, orgId }, "cache invalidated")
}
