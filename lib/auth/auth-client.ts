import { createAuthClient } from "better-auth/react";
import {
  lastLoginMethodClient,
  emailOTPClient,
  magicLinkClient,
  usernameClient,
  multiSessionClient,
  twoFactorClient,
  adminClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: "http://localhost:3000",
  plugins: [
    lastLoginMethodClient(),
    emailOTPClient(),
    magicLinkClient(),
    usernameClient(),
    multiSessionClient(),
    twoFactorClient(),
    adminClient(),
  ],
});
