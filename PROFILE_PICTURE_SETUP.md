# Profile Picture Setup Guide

This guide explains how to set up profile picture uploads using Cloudflare R2.

## Prerequisites

- Cloudflare account
- Cloudflare Workers access
- Cloudflare R2 access

## Step 1: Create R2 Bucket

1. Log in to your Cloudflare dashboard
2. Go to R2 Object Storage
3. Create a new bucket named `shipos-profile-pictures`
4. Enable public access or set up a custom domain (see Step 2)

## Step 2: Configure R2 Public Access

### Option A: Public Bucket (Recommended for Development)

1. In your R2 bucket settings, go to "Settings" > "Public Access"
2. Enable "Allow Access" to make the bucket publicly readable
3. Note the public R2.dev URL (e.g., `https://pub-xxxxx.r2.dev`)

### Option B: Custom Domain (Recommended for Production)

1. In your R2 bucket settings, go to "Settings" > "Custom Domains"
2. Add a custom domain (e.g., `profile-pictures.yourdomain.com`)
3. Add the required DNS records to your domain
4. Update the `publicUrl` in the worker code at:
   ```
   workers/shipos-external-api/src/index.ts
   ```
   Replace:
   ```typescript
   const publicUrl = `https://profile-pictures.yourdomain.com/${key}`;
   ```
   With your actual domain or R2.dev URL.

## Step 3: Update Worker Configuration

The worker configuration is already set up in:
```
workers/shipos-external-api/wrangler.jsonc
```

The R2 binding is configured as:
```json
"r2_buckets": [
  {
    "binding": "PROFILE_PICTURES",
    "bucket_name": "shipos-profile-pictures"
  }
]
```

If you named your bucket differently, update the `bucket_name` here.

## Step 4: Deploy the Worker

1. Navigate to the worker directory:
   ```bash
   cd workers/shipos-external-api
   ```

2. Deploy the worker:
   ```bash
   pnpm deploy
   ```

3. Note the deployed worker URL (e.g., `https://shipos-external-api.your-account.workers.dev`)

## Step 5: Update Environment Variables

Update the `.env` file in the root directory:

```env
WORKER_API_URL="https://shipos-external-api.your-account.workers.dev"
```

For development, you can use:
```env
WORKER_API_URL="http://localhost:8787"
```

## Step 6: Run Locally (Development)

1. Start the worker in development mode:
   ```bash
   cd workers/shipos-external-api
   pnpm dev
   ```

2. Start the Next.js app:
   ```bash
   cd ../..
   pnpm dev
   ```

3. Visit `http://localhost:3000/account/profile` to test profile picture uploads

## Features

### Upload
- Supports JPEG, PNG, WebP, and GIF
- Maximum file size: 5MB
- Automatic file validation
- Unique filename generation with timestamp

### Delete
- Secure deletion with user ownership verification
- Removes file from R2 bucket
- Updates user profile in database

## API Endpoints

### Worker Endpoints (Cloudflare Worker)

1. **POST /profile-picture/upload**
   - Uploads a profile picture to R2
   - Requires: `file` (multipart/form-data), `userId`
   - Returns: `{ success, url, key }`

2. **DELETE /profile-picture/delete**
   - Deletes a profile picture from R2
   - Requires: `{ key, userId }`
   - Returns: `{ success, message }`

3. **GET /profile-picture/:key**
   - Retrieves a profile picture (for testing)
   - Returns: Image file

### Next.js API Routes

1. **POST /api/profile-picture/upload**
   - Proxies upload to worker
   - Requires authentication
   - Handles user session validation

2. **DELETE /api/profile-picture/delete**
   - Proxies delete to worker
   - Requires authentication
   - Handles user session validation

## Usage in Components

Import and use the `ProfilePictureUpload` component:

```tsx
import { ProfilePictureUpload } from "@/components/profile-picture-upload";

<ProfilePictureUpload
  currentImage={user.image}
  userName={user.name}
  onUpdate={(url) => console.log("Updated to:", url)}
/>
```

## Security Considerations

1. **Authentication**: All API routes require user authentication via better-auth
2. **Ownership Verification**: Users can only delete their own profile pictures
3. **File Validation**: File type and size are validated on both client and server
4. **CORS**: CORS is enabled on the worker for Next.js app access

## Troubleshooting

### Issue: Upload fails with "Failed to upload file"
- Check that the R2 bucket exists and is named correctly
- Verify the R2 binding in wrangler.jsonc
- Check worker logs in Cloudflare dashboard

### Issue: Images not displaying
- Verify the public URL in the worker code matches your R2 setup
- Check that public access is enabled on the bucket
- Inspect the returned URL in the upload response

### Issue: "Unauthorized" errors
- Ensure the user is logged in
- Check that the session is valid
- Verify BETTER_AUTH_SECRET is set correctly

## Production Deployment

1. Deploy the Cloudflare Worker:
   ```bash
   cd workers/shipos-external-api
   pnpm deploy
   ```

2. Update production environment variables in your hosting platform:
   ```
   WORKER_API_URL=https://shipos-external-api.your-account.workers.dev
   ```

3. Configure custom domain for R2 bucket (recommended)

4. Update the worker code with your production R2 URL

## File Structure

```
/workers/shipos-external-api/
  ├── src/index.ts              # Worker with R2 upload/delete logic
  ├── wrangler.jsonc            # R2 bucket binding configuration
  └── package.json              # Worker dependencies

/app/api/profile-picture/
  ├── upload/route.ts           # Upload API route
  └── delete/route.ts           # Delete API route

/components/
  └── profile-picture-upload.tsx # Upload UI component

/app/account/profile/
  └── page.tsx                  # Profile settings page
```

## Additional Notes

- Profile pictures are stored in R2 with metadata (userId, originalName, uploadedAt)
- File naming format: `profile-pictures/{userId}-{timestamp}.{extension}`
- The user's `image` field in the database is automatically updated after upload/delete
- Better-auth handles user updates via `authClient.updateUser()`
