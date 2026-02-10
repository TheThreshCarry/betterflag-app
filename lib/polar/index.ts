import { Polar } from "@polar-sh/sdk";

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  // Use 'sandbox' for development and testing.
  // Switch to 'production' when ready to go live.
  server: "sandbox",
});
