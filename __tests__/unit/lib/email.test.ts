import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  sendMagicLinkEmail,
  sendOTPEmail,
  sendVerificationEmail,
} from "@/lib/email";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_FROM = "ShipOS <test@example.com>";
});

describe("sendMagicLinkEmail", () => {
  it("sends a magic link email via Resend", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });

    const result = await sendMagicLinkEmail({
      email: "user@example.com",
      url: "https://shipos.app/auth/magic?token=abc",
      token: "abc",
    });

    expect(result).toEqual({ id: "msg_1" });
    expect(mockSend).toHaveBeenCalledOnce();

    const call = mockSend.mock.calls[0][0];
    expect(call.to).toEqual(["user@example.com"]);
    expect(call.subject).toBe("Sign in to ShipOS");
    expect(call.react).toBeDefined();
  });

  it("throws when Resend returns an error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "rate limited", name: "rate_limit_exceeded" },
    });

    await expect(
      sendMagicLinkEmail({
        email: "user@example.com",
        url: "https://example.com",
        token: "abc",
      })
    ).rejects.toThrow("Failed to send magic link email: rate limited");
  });
});

describe("sendOTPEmail", () => {
  it("sends a sign-in OTP email", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_2" }, error: null });

    await sendOTPEmail({
      email: "user@example.com",
      otp: "123456",
      type: "sign-in",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("Your ShipOS sign-in code");
    expect(call.to).toEqual(["user@example.com"]);
  });

  it("sends a verification OTP email", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_3" }, error: null });

    await sendOTPEmail({
      email: "user@example.com",
      otp: "654321",
      type: "email-verification",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("Verify your ShipOS email");
  });

  it("sends a password-reset OTP email", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_4" }, error: null });

    await sendOTPEmail({
      email: "user@example.com",
      otp: "999999",
      type: "forget-password",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("Reset your ShipOS password");
  });

  it("throws when Resend returns an error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "bad request", name: "validation_error" },
    });

    await expect(
      sendOTPEmail({ email: "bad", otp: "123", type: "sign-in" })
    ).rejects.toThrow("Failed to send OTP email: bad request");
  });
});

describe("sendVerificationEmail", () => {
  it("sends an email-verification link email", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_5" }, error: null });

    await sendVerificationEmail({
      email: "user@example.com",
      url: "https://shipos.app/verify?token=xyz",
      type: "email-verification",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("Verify your ShipOS account");
    expect(call.to).toEqual(["user@example.com"]);
  });

  it("sends a password-reset link email", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_6" }, error: null });

    await sendVerificationEmail({
      email: "user@example.com",
      url: "https://shipos.app/reset?token=xyz",
      type: "password-reset",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("Reset your ShipOS password");
  });

  it("throws when Resend returns an error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "forbidden", name: "forbidden" },
    });

    await expect(
      sendVerificationEmail({
        email: "user@example.com",
        url: "https://example.com",
        type: "email-verification",
      })
    ).rejects.toThrow("Failed to send verification email: forbidden");
  });
});
