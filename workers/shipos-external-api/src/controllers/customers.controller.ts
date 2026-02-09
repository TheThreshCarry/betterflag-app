import type { ApiError } from "../types";
import { KVKeys } from "../types";
import { createController, controllerRegistry } from "./index";

/**
 * Customer Identify Request Body
 */
interface CustomerIdentifyRequest {
  /** External ID used to identify the customer */
  externalId: string;
  /** Optional metadata to associate with the customer */
  metadata?: Record<string, unknown>;
}

/**
 * Customer data stored in KV
 */
interface CustomerData {
  externalId: string;
  metadata: Record<string, unknown>;
  identifiedAt: string;
}

/**
 * Customers Controller
 *
 * Handles customer identification endpoints.
 *
 * Endpoints:
 * - POST /customers/identify - Identify a customer by external ID
 */
const customersController = createController(
  {
    name: "customers",
    version: "v1",
    basePath: "/customers",
    description:
      "Customer identification - identify and track customers in your application",
  },
  (router) => {
    /**
     * POST /customers/identify
     * Identifies a customer by external ID with optional metadata.
     * Creates or updates the customer record in KV.
     */
    router.post("/identify", async (c) => {
      const organizationId = c.get("organizationId");

      let body: CustomerIdentifyRequest;

      try {
        body = await c.req.json<CustomerIdentifyRequest>();
      } catch {
        const error: ApiError = {
          error: "Invalid request body",
          code: "INVALID_BODY",
        };
        return c.json(error, 400);
      }

      // Validate externalId
      if (!body.externalId || typeof body.externalId !== "string") {
        const error: ApiError = {
          error: "externalId is required and must be a string",
          code: "INVALID_EXTERNAL_ID",
        };
        return c.json(error, 400);
      }

      // Validate externalId length
      if (body.externalId.length > 255) {
        const error: ApiError = {
          error: "externalId must be 255 characters or less",
          code: "INVALID_EXTERNAL_ID",
        };
        return c.json(error, 400);
      }

      // Validate metadata if provided
      if (body.metadata !== undefined && typeof body.metadata !== "object") {
        const error: ApiError = {
          error: "metadata must be a JSON object",
          code: "INVALID_METADATA",
        };
        return c.json(error, 400);
      }

      const kvKey = KVKeys.customer(organizationId, body.externalId);

      try {
        const customerData: CustomerData = {
          externalId: body.externalId,
          metadata: body.metadata ?? {},
          identifiedAt: new Date().toISOString(),
        };

        await c.env.SHIPOS_KV.put(kvKey, JSON.stringify(customerData));

        return c.json(
          {
            success: true,
            customer: {
              externalId: customerData.externalId,
              metadata: customerData.metadata,
            },
          },
          200
        );
      } catch (err) {
        console.error("Error identifying customer:", err);
        const error: ApiError = {
          error: "Internal server error",
          code: "INTERNAL_ERROR",
        };
        return c.json(error, 500);
      }
    });
  }
);

// Register the controller
controllerRegistry.register(customersController);

export { customersController };
