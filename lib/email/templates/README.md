# ShipOS Email Templates

This folder contains MJML templates for all authentication-related transactional emails, organized into folders ready to zip and upload to Loops.

## Folder Structure

```
templates/
├── magic-link/          # Passwordless sign-in via magic link
│   ├── index.mjml
│   └── logo.png
├── otp-sign-in/         # OTP-based sign-in code
│   ├── index.mjml
│   └── logo.png
├── otp-verification/    # Email verification OTP (signup)
│   ├── index.mjml
│   └── logo.png
├── otp-password-reset/  # Password reset OTP code
│   ├── index.mjml
│   └── logo.png
├── email-verification/  # Email verification link (signup)
│   ├── index.mjml
│   └── logo.png
├── password-reset/      # Password reset link
│   ├── index.mjml
│   └── logo.png
└── welcome/             # Welcome email after signup
    ├── index.mjml
    └── logo.png
```

## Data Variables

| Template | Data Variables |
|----------|----------------|
| `magic-link` | `magicLinkUrl` |
| `otp-sign-in` | `otpCode` |
| `otp-verification` | `otpCode` |
| `otp-password-reset` | `otpCode` |
| `email-verification` | `verificationUrl` |
| `password-reset` | `resetUrl` |
| `welcome` | None (static) |

## How to Upload to Loops

1. **Zip each folder** individually:
   ```bash
   cd templates
   zip -r magic-link.zip magic-link/
   zip -r otp-sign-in.zip otp-sign-in/
   # ... repeat for each folder
   ```

2. **Create Transactional Emails in Loops**:
   - Go to your [Loops Dashboard](https://app.loops.so)
   - Navigate to Transactional → Create New
   - Upload the zip file
   - Set up the data variables as shown in the table above

3. **Update Environment Variables**:
   Add the transactional email IDs to your `.env`:
   ```env
   LOOPS_MAGIC_LINK_ID=your_magic_link_id
   LOOPS_OTP_SIGNIN_ID=your_otp_signin_id
   LOOPS_OTP_VERIFICATION_ID=your_otp_verification_id
   LOOPS_OTP_PASSWORD_RESET_ID=your_otp_password_reset_id
   LOOPS_EMAIL_VERIFICATION_ID=your_email_verification_id
   LOOPS_PASSWORD_RESET_ID=your_password_reset_id
   LOOPS_WELCOME_ID=your_welcome_id
   ```

## Design System

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

## Quick Zip All Script

```bash
cd templates
for dir in */; do
  if [ -d "$dir" ]; then
    zip -r "${dir%/}.zip" "$dir"
  fi
done
```

