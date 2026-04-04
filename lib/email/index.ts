import { LoopsClient } from "loops";
import { createLogger } from "@/lib/logger";

const log = createLogger("email");
const loops = new LoopsClient(process.env.LOOPS_API_KEY as string);

// Transactional email IDs from Loops dashboard
// You'll need to create these transactional emails in Loops and add their IDs here
const TRANSACTIONAL_IDS = {
  magicLink: process.env.LOOPS_MAGIC_LINK_ID || "magic_link",
  otpSignIn: process.env.LOOPS_OTP_SIGNIN_ID || "otp_sign_in",
  otpVerification: process.env.LOOPS_OTP_VERIFICATION_ID || "otp_verification",
  otpPasswordReset: process.env.LOOPS_OTP_PASSWORD_RESET_ID || "otp_password_reset",
  emailVerification: process.env.LOOPS_EMAIL_VERIFICATION_ID || "email_verification",
  passwordReset: process.env.LOOPS_PASSWORD_RESET_ID || "password_reset",
};

export async function sendMagicLinkEmail({
  email,
  url,
  token,
}: {
  email: string;
  url: string;
  token: string;
}) {
  try {
    log.info({ email, type: "magic-link" }, "sending magic link email");
    const resp = await loops.sendTransactionalEmail({
      transactionalId: TRANSACTIONAL_IDS.magicLink,
      email,
      dataVariables: {
        magicLinkUrl: url,
        token,
      },
    });

    if (!resp.success) {
      log.error({ email, type: "magic-link", resp }, "magic link email failed");
      throw new Error("Failed to send magic link email");
    }

    log.info({ email, type: "magic-link" }, "magic link email sent");
    return resp;
  } catch (error) {
    log.error({ email, type: "magic-link", err: error }, "magic link email error");
    throw error;
  }
}

export async function sendOTPEmail({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password";
}) {
  try {
    let transactionalId: string;

    switch (type) {
      case "sign-in":
        transactionalId = TRANSACTIONAL_IDS.otpSignIn;
        break;
      case "email-verification":
        transactionalId = TRANSACTIONAL_IDS.otpVerification;
        break;
      case "forget-password":
        transactionalId = TRANSACTIONAL_IDS.otpPasswordReset;
        break;
      default:
        transactionalId = TRANSACTIONAL_IDS.otpVerification;
    }

    log.info({ email, type, transactionalId }, "sending OTP email");

    const resp = await loops.sendTransactionalEmail({
      transactionalId,
      email,
      dataVariables: {
        otp,
        otpCode: otp,
        type,
      },
    });

    if (!resp.success) {
      log.error({ email, type, resp }, "OTP email failed");
      throw new Error("Failed to send OTP email");
    }

    log.info({ email, type }, "OTP email sent");
    return resp;
  } catch (error) {
    log.error({ email, type, err: error }, "OTP email error");
    throw error;
  }
}

// Send verification email (for signup email verification and password reset)
export async function sendVerificationEmail({
  email,
  url,
  type,
}: {
  email: string;
  url: string;
  type: "email-verification" | "password-reset";
}) {
  try {
    const transactionalId =
      type === "email-verification"
        ? TRANSACTIONAL_IDS.emailVerification
        : TRANSACTIONAL_IDS.passwordReset;

    log.info({ email, type }, "sending verification email");

    const resp = await loops.sendTransactionalEmail({
      transactionalId,
      email,
      dataVariables: {
        verificationUrl: url,
        resetUrl: url,
        url,
      },
    });

    if (!resp.success) {
      log.error({ email, type, resp }, "verification email failed");
      throw new Error("Failed to send verification email");
    }

    log.info({ email, type }, "verification email sent");
    return resp;
  } catch (error) {
    log.error({ email, type, err: error }, "verification email error");
    throw error;
  }
}

// Helper to sync a user to Loops contacts when they sign up
export async function syncUserToLoops({
  email,
  userId,
  name,
}: {
  email: string;
  userId: string;
  name?: string;
}) {
  try {
    log.info({ email, userId }, "syncing user to Loops");
    const resp = await loops.updateContact({
      email,
      userId,
      properties: {
        firstName: name?.split(" ")[0] || "",
        lastName: name?.split(" ").slice(1).join(" ") || "",
      },
    });

    if (!resp.success) {
      log.error({ email, userId, resp }, "failed to sync user to Loops");
    }

    return resp;
  } catch (error) {
    log.error({ email, userId, err: error }, "error syncing user to Loops");
  }
}

export { loops };

