import { Resend } from "resend";
import { createLogger } from "@/lib/logger";
import { MagicLinkEmail } from "./components/magic-link";
import { OTPEmail } from "./components/otp";
import { VerificationEmail } from "./components/verification";

const log = createLogger("email");

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.RESEND_FROM || "ShipOS <contact@shipos.app>";

export async function sendMagicLinkEmail({
  email,
  url,
  token,
}: {
  email: string;
  url: string;
  token: string;
}) {
  log.info({ email, type: "magic-link" }, "sending magic link email");

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject: "Sign in to ShipOS",
    react: MagicLinkEmail({ url }),
  });

  if (error) {
    log.error({ email, type: "magic-link", error }, "magic link email failed");
    throw new Error(`Failed to send magic link email: ${error.message}`);
  }

  log.info({ email, type: "magic-link", id: data?.id }, "magic link email sent");
  return data;
}

const OTP_SUBJECTS: Record<string, string> = {
  "sign-in": "Your ShipOS sign-in code",
  "email-verification": "Verify your ShipOS email",
  "forget-password": "Reset your ShipOS password",
};

export async function sendOTPEmail({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password";
}) {
  log.info({ email, type }, "sending OTP email");

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject: OTP_SUBJECTS[type] ?? "Your ShipOS code",
    react: OTPEmail({ otp, type }),
  });

  if (error) {
    log.error({ email, type, error }, "OTP email failed");
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }

  log.info({ email, type, id: data?.id }, "OTP email sent");
  return data;
}

export async function sendVerificationEmail({
  email,
  url,
  type,
}: {
  email: string;
  url: string;
  type: "email-verification" | "password-reset";
}) {
  log.info({ email, type }, "sending verification email");

  const subject =
    type === "email-verification"
      ? "Verify your ShipOS account"
      : "Reset your ShipOS password";

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject,
    react: VerificationEmail({ url, type }),
  });

  if (error) {
    log.error({ email, type, error }, "verification email failed");
    throw new Error(`Failed to send verification email: ${error.message}`);
  }

  log.info({ email, type, id: data?.id }, "verification email sent");
  return data;
}

export { resend };
