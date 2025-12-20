import { Hono } from "hono";
import { auth } from "../lib/better-auth";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.on(["GET", "POST"], "/api/*", (c) => {
  return auth(c.env).handler(c.req.raw);
});

export default app;
