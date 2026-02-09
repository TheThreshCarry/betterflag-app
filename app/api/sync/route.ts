import { NextRequest, NextResponse } from "next/server";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
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
 * Accepts sync requests from server actions to update Cloudflare KV.
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

  // Validate Cloudflare configuration
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
    return NextResponse.json(
      { error: "Cloudflare KV not configured", code: "KV_NOT_CONFIGURED" },
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

    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(payload.key)}`;

    if (payload.action === "upsert") {
      if (payload.value === undefined) {
        return NextResponse.json(
          { error: "Value required for upsert", code: "MISSING_VALUE" },
          { status: 400 }
        );
      }

      const response = await fetch(baseUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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
      const response = await fetch(baseUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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

  // Validate Cloudflare configuration
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
    return NextResponse.json(
      { error: "Cloudflare KV not configured", code: "KV_NOT_CONFIGURED" },
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
        const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(payload.key)}`;

        try {
          if (payload.action === "upsert" && payload.value !== undefined) {
            const response = await fetch(baseUrl, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload.value),
            });
            return { key: payload.key, success: response.ok };
          }

          if (payload.action === "delete") {
            const response = await fetch(baseUrl, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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
