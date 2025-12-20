import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "../../lib/db";
import {
  lastLoginMethod,
  organization,
  admin,
  apiKey,
  username,
  magicLink,
  emailOTP,
  multiSession,
  twoFactor,
} from "better-auth/plugins";

export const auth = betterAuth({
  appName: "ShipOS",
  database: drizzleAdapter(db, {
    provider: "pg", // or "pg" or "mysql"
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    multiSession(),
    twoFactor(),
    lastLoginMethod(),
    organization(),
    admin(),
    apiKey(),
    username(),
    magicLink({
      sendMagicLink: async ({ email, token, url }, ctx) => {
        //TODO: Implement email sending
        // send email to user
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        //TODO: Implement email sending
        if (type === "sign-in") {
          // Send the OTP for sign in
        } else if (type === "email-verification") {
          // Send the OTP for email verification
        } else {
          // Send the OTP for password reset
        }
      },
    }),
  ],
});
