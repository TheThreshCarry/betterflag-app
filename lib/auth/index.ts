/* eslint-disable @typescript-eslint/no-unused-vars */
import { betterAuth, User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import db, { schema } from "../../lib/db";
import { user as userTable } from "../auth/auth-schema";
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
import {
  polar,
  checkout,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";
import { polarClient } from "../polar";
import {
  onCustomerStateChanged,
  onOrderPaid,
  onSubscriptionCreated,
  onSubscriptionCanceled,
  onSubscriptionRevoked,
} from "../polar/webhook-handlers";
import { sendMagicLinkEmail, sendOTPEmail, sendVerificationEmail } from "../email";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth");

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
      log.info({ userId: user.id, email: user.email }, "sending password reset email");
      await sendVerificationEmail({
        email: user.email,
        url,
        type: "password-reset",
      });
    },
    onPasswordReset: async ({ user }: { user: User }) => {
      log.info({ userId: user.id, email: user.email }, "password reset completed");
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create a Polar customer for the new user.
          // If this fails, rollback by deleting the user so we don't end up
          // with a local user that has no billing customer.
          try {
            await polarClient.customers.create({
              email: user.email,
              name: user.name,
              externalId: user.id,
            });
          } catch (error) {
            log.error({ userId: user.id, err: error }, "failed to create Polar customer");

            if (process.env.NODE_ENV === "production") {
              try {
                await db.delete(userTable).where(eq(userTable.id, user.id));
                log.warn({ userId: user.id }, "rolled back user after Polar failure");
              } catch (deleteError) {
                log.error({ userId: user.id, err: deleteError }, "failed to rollback user after Polar failure");
              }

              throw new Error(
                "Unable to complete sign-up. Please try again later."
              );
            }

            log.warn({ userId: user.id }, "skipping Polar customer creation in non-production environment");
          }
        },
      },
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
    polar({
      client: polarClient,
      // We handle customer creation ourselves in databaseHooks above
      // so we can rollback the user if Polar fails.
      createCustomerOnSignUp: false,
      use: [
        checkout({
          products: [
            {
              productId: process.env.POLAR_PRO_PRODUCT_ID!,
              slug: "pro",
            },
            {
              productId: process.env.POLAR_TEAM_PRODUCT_ID!,
              slug: "team",
            },
          ],
          successUrl: "/dashboard/settings/billing?checkout_id={CHECKOUT_ID}",
          authenticatedUsersOnly: true,
        }),
        portal(),
        usage(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!,
          onCustomerStateChanged,
          onOrderPaid,
          onSubscriptionCreated,
          onSubscriptionCanceled,
          onSubscriptionRevoked,
        }),
      ],
    }),
    nextCookies(), // must be the last plugin
  ],
});
