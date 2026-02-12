import { NextRequest, NextResponse } from "next/server";

const WORKER_API_URL = process.env.WORKER_API_URL;
const SERVICE_SECRET = process.env.SERVICE_SECRET;
const SYNC_WEBHOOK_SECRET = process.env.SYNC_WEBHOOK_SECRET;

type SyncPayload = {
  type: "apikey" | "flags" | "config";
  action: "upsert" | "delete";
  key: string;
  value?: unknown;
};

/**
 * Sync Webhook API Route
 *
 * POST /api/sync
 *
 * Accepts sync requests from server actions to update Cloudflare KV
 * via the Worker's internal service routes.
 * Protected by service-level secret (x-sync-secret header).
 */
export async function POST(request: NextRequest) {
  // Authenticate using service-level secret
  const secret = request.headers.get("x-sync-secret");
  if (!secret || secret !== SYNC_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized", code: "INVALID_SECRET" },
      { status: 401 }
    );
  }

  // Validate Worker configuration
  if (!WORKER_API_URL || !SERVICE_SECRET) {
    return NextResponse.json(
      { error: "Worker KV sync not configured", code: "KV_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  try {
    const payload: SyncPayload = await request.json();

    // Validate payload
    if (!payload.type || !payload.action || !payload.key) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const kvUrl = `${WORKER_API_URL}/internal/kv/${encodeURIComponent(payload.key)}`;

    if (payload.action === "upsert") {
      if (payload.value === undefined) {
        return NextResponse.json(
          { error: "Value required for upsert", code: "MISSING_VALUE" },
          { status: 400 }
        );
      }

      const response = await fetch(kvUrl, {
        method: "PUT",
        headers: {
          "x-service-secret": SERVICE_SECRET,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload.value),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`KV write failed: ${error}`);
        return NextResponse.json(
          { error: "Failed to write to KV", code: "KV_WRITE_FAILED" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, action: "upsert", key: payload.key });
    }

    if (payload.action === "delete") {
      const response = await fetch(kvUrl, {
        method: "DELETE",
        headers: {
          "x-service-secret": SERVICE_SECRET,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`KV delete failed: ${error}`);
        return NextResponse.json(
          { error: "Failed to delete from KV", code: "KV_DELETE_FAILED" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, action: "delete", key: payload.key });
    }

    return NextResponse.json(
      { error: "Invalid action", code: "INVALID_ACTION" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Batch Sync Webhook API Route
 *
 * PUT /api/sync
 *
 * Accepts batch sync requests for multiple keys.
 */
export async function PUT(request: NextRequest) {
  // Authenticate using service-level secret
  const secret = request.headers.get("x-sync-secret");
  if (!secret || secret !== SYNC_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized", code: "INVALID_SECRET" },
      { status: 401 }
    );
  }

  // Validate Worker configuration
  if (!WORKER_API_URL || !SERVICE_SECRET) {
    return NextResponse.json(
      { error: "Worker KV sync not configured", code: "KV_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  try {
    const payloads: SyncPayload[] = await request.json();

    if (!Array.isArray(payloads) || payloads.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload - expected array", code: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      payloads.map(async (payload) => {
        const kvUrl = `${WORKER_API_URL}/internal/kv/${encodeURIComponent(payload.key)}`;

        try {
          if (payload.action === "upsert" && payload.value !== undefined) {
            const response = await fetch(kvUrl, {
              method: "PUT",
              headers: {
                "x-service-secret": SERVICE_SECRET!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload.value),
            });
            return { key: payload.key, success: response.ok };
          }

          if (payload.action === "delete") {
            const response = await fetch(kvUrl, {
              method: "DELETE",
              headers: {
                "x-service-secret": SERVICE_SECRET!,
              },
            });
            return { key: payload.key, success: response.ok };
          }

          return { key: payload.key, success: false, error: "Invalid action" };
        } catch {
          return { key: payload.key, success: false, error: "Request failed" };
        }
      })
    );

    const allSuccess = results.every((r) => r.success);
    return NextResponse.json({
      success: allSuccess,
      results,
    });
  } catch (error) {
    console.error("Batch sync error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
