import { createAuthClient } from "better-auth/react";
import {
  lastLoginMethodClient,
  emailOTPClient,
  magicLinkClient,
  usernameClient,
  multiSessionClient,
  twoFactorClient,
  adminClient,
  organizationClient,
  apiKeyClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // No baseURL needed - uses the same domain by default
  plugins: [
    lastLoginMethodClient(),
    emailOTPClient(),
    magicLinkClient(),
    usernameClient(),
    multiSessionClient(),
    twoFactorClient(),
    adminClient(),
    organizationClient(),
    apiKeyClient(),
  ],
});
