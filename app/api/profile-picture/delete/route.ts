import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { workerServiceHeaders } from "@/lib/worker-internal";

const log = createLogger("api.profile");
const WORKER_URL = process.env.WORKER_API_URL || "http://localhost:8787";

export async function DELETE(request: NextRequest) {
  try {
    // Get the current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the key from request body
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json(
        { error: "No key provided" },
        { status: 400 }
      );
    }

    // Forward to Cloudflare Worker
    const response = await fetch(`${WORKER_URL}/internal/profile-picture/delete`, {
      method: "DELETE",
      headers: workerServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        key,
        userId: session.user.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    log.error({ err: error }, "profile picture delete error");
    return NextResponse.json(
      { error: "Failed to delete profile picture" },
      { status: 500 }
    );
  }
}
