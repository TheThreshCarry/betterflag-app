import { Hono } from "hono";
import { auth } from "../lib/better-auth";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.on(["GET", "POST"], "/api/*", (c) => {
  // This worker is set to handle all the Auth API requests for shipos, it's using better-auth as the auth provider. 
  // so here we'll manage all the webhooks and other events for the auth provider.
  return auth(c.env).handler(c.req.raw);
});

export default app;
