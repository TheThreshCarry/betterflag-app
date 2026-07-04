import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "@shipos/core";
import { handleRequest } from "../src/index";
import {
  ENV_SLUG,
  PROJECT_ID,
  SDK_KEY,
  SNAPSHOT,
  fakeCtx,
  fakeQueue,
  snapshotRequest,
  standardKv,
} from "./helpers";

describe("GET /v1/snapshot", () => {
  it("requires a valid SDK key", async () => {
    const res = await handleRequest(
      snapshotRequest({}),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("serves the snapshot with a version ETag and no-cache", async () => {
    const res = await handleRequest(
      snapshotRequest({ token: SDK_KEY }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"v42"');
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((await res.json()) as ProjectSnapshot).toEqual(SNAPSHOT);
  });

  it("returns 304 with empty body when If-None-Match matches", async () => {
    const res = await handleRequest(
      snapshotRequest({ token: SDK_KEY, ifNoneMatch: '"v42"' }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe('"v42"');
    expect(await res.text()).toBe("");
  });

  it("serves the full snapshot when If-None-Match is stale", async () => {
    const res = await handleRequest(
      snapshotRequest({ token: SDK_KEY, ifNoneMatch: '"v41"' }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as ProjectSnapshot).version).toBe(42);
  });

  it("serves an empty version-0 snapshot when KV has none", async () => {
    const res = await handleRequest(
      snapshotRequest({ token: SDK_KEY }),
      { CONFIG_KV: await standardKv(undefined, null), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"v0"');
    const body = (await res.json()) as ProjectSnapshot;
    expect(body.version).toBe(0);
    expect(body.projectId).toBe(PROJECT_ID);
    expect(body.environment).toBe(ENV_SLUG);
    expect(body.flags).toEqual({});
  });
});
