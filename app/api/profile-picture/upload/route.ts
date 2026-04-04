import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { workerServiceHeaders } from "@/lib/worker-internal";

const log = createLogger("api.profile");
const WORKER_URL = process.env.WORKER_API_URL || "http://localhost:8787";

export async function POST(request: NextRequest) {
  try {
    // Get the current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Create new FormData to forward to worker
    const workerFormData = new FormData();
    workerFormData.append("file", file);
    workerFormData.append("userId", session.user.id);

    // Forward to Cloudflare Worker
    const response = await fetch(`${WORKER_URL}/internal/profile-picture/upload`, {
      method: "POST",
      headers: workerServiceHeaders(),
      body: workerFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Update user's image in database
    // This will be handled by the client after receiving the URL

    return NextResponse.json(data);
  } catch (error) {
    log.error({ err: error }, "profile picture upload error");
    return NextResponse.json(
      { error: "Failed to upload profile picture" },
      { status: 500 }
    );
  }
}
