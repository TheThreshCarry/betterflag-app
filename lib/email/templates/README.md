# ShipOS Email Templates

Transactional emails are sent via **Resend** using **React Email** components defined in `lib/email/components/`.

The MJML files in this folder are the original design references used to build the React Email components. They are kept for visual reference only and are **not** used at runtime.

## React Email components

| Component | File | Purpose |
|-----------|------|---------|
| `MagicLinkEmail` | `components/magic-link.tsx` | Passwordless sign-in link |
| `OTPEmail` | `components/otp.tsx` | OTP codes for sign-in, email verification, and password reset |
| `VerificationEmail` | `components/verification.tsx` | Link-based email verification and password reset |

Shared layout (logo, card, footer) lives in `components/layout.tsx`.

## Environment variables

```env
RESEND_API_KEY=re_xxxxx
RESEND_FROM="ShipOS <auth@yourdomain.com>"
```

Verify your sending domain at [resend.com/domains](https://resend.com/domains) before going to production.

## Design system

All templates follow a consistent design:

- **Background**: `#f9fafb` (light gray)
- **Card Background**: `#ffffff` with `#e5e7eb` border
- **Primary Text**: `#0f172a` / `#1a1a1a`
- **Secondary Text**: `#6b7280`
- **Primary Button**: `#0f172a` (slate-900)
- **Success/Verification**: `#10b981` (emerald-500)
- **Warning/Reset**: `#f59e0b` (amber-500)
- **Border Radius**: `12px` for cards, `8px` for buttons
- **Font**: SF Pro Display with system fallbacks

## MJML reference folders

```
templates/
├── magic-link/          # Passwordless sign-in via magic link
├── otp-sign-in/         # OTP-based sign-in code
├── otp-verification/    # Email verification OTP (signup)
├── otp-password-reset/  # Password reset OTP code
├── email-verification/  # Email verification link (signup)
├── password-reset/      # Password reset link
└── welcome/             # Welcome email after signup
```

| Template | Data variables |
|----------|----------------|
| `magic-link` | `magicLinkUrl` |
| `otp-sign-in` | `otpCode` |
| `otp-verification` | `otpCode` |
| `otp-password-reset` | `otpCode` |
| `email-verification` | `verificationUrl` |
| `password-reset` | `resetUrl` |
| `welcome` | None (static) |
