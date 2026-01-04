/* eslint-disable @typescript-eslint/no-unused-vars */
import { betterAuth, User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import db, { schema } from "../../lib/db";
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
import { sendMagicLinkEmail, sendOTPEmail, sendVerificationEmail } from "../email";

export const auth = betterAuth({
  appName: "ShipOS",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendVerificationEmail({
        email: user.email,
        url,
        type: "password-reset",
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        email: user.email,
        url,
        type: "email-verification",
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendResetPassword: async ({ user, url }: { user: User; url: string }) => {
      console.log("sendResetPassword", { user, url });
      await sendVerificationEmail({
        email: user.email,
        url,
        type: "password-reset",
      });
    },
    onPasswordReset: async ({ user }: { user: User }) => {
      // your logic here
      console.log(`Password for user ${user.email} has been reset.`);
    },
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
      sendMagicLink: async ({ email, token, url }) => {
        await sendMagicLinkEmail({ email, token, url });
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendOTPEmail({ email, otp, type });
      },
    }),
    nextCookies(), // must be the last plugin
  ],
});
