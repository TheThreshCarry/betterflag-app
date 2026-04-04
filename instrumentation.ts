import { registerOTel } from "@vercel/otel"

export function register() {
  registerOTel({
    serviceName: "shipos-app",
    attributes: {
      environment: process.env.NODE_ENV ?? "development",
    },
  })
}
