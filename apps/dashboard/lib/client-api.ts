/**
 * Browser-side fetch wrapper for /api/v1. Sends cookies, parses the shared
 * error shape { error: { code, message } } into ApiClientError.
 */

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      // Let the browser set multipart boundary for FormData uploads.
      ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response (should not happen for /api/v1).
  }

  if (!res.ok) {
    const errorBody = (body ?? {}) as ErrorBody;
    throw new ApiClientError(
      res.status,
      errorBody.error?.code ?? "request_failed",
      errorBody.error?.message ?? `Request failed (${res.status})`,
    );
  }

  return body as T;
}
