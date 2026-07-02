# CoCare Deployment Checklist

Use this checklist to deploy CoCare to Vercel with Neon, Google login, Resend email notifications, and mobile web app support.

## 1. Local Preflight

Run these locally before deploying:

```bash
npm run verify:env
npx tsc --noEmit
npm run build
```

If the local dev server gets stuck, switches ports, shows unstyled HTML, or throws missing chunk errors:

```bash
npm run dev:clean
```

Use `http://localhost:3000` for local Google OAuth. If Next starts on `3001`, stop the old server and restart with `npm run dev:clean`.

## 2. Push To GitHub

Create a GitHub repository and push this project.

Do not commit:

- `.env`
- local database URLs
- Google OAuth secrets
- Resend API keys

## 3. Create The Vercel Project

1. Open Vercel.
2. Create `New Project`.
3. Import the GitHub repository.
4. Framework preset: `Next.js`.
5. Install command: `npm install`.
6. Build command: `npm run build`.

## 4. Add Vercel Environment Variables

Add these in Vercel Project Settings -> Environment Variables:

```env
DATABASE_URL=

NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-domain.vercel.app
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

HAYDEN_GOOGLE_EMAIL=
CONSTANCE_GOOGLE_EMAIL=
FAMILY_NAME=CoCare Family

RESEND_API_KEY=
EMAIL_FROM=CoCare Calendar <notifications@your-domain.com>
APP_BASE_URL=https://your-domain.vercel.app

# Optional document uploads.
BLOB_READ_WRITE_TOKEN=
BLOB_STORE_ID=
```

Notes:

- `DATABASE_URL` is the Neon pooled PostgreSQL connection string.
- `NEXTAUTH_SECRET` should be a long random secret.
- `NEXTAUTH_URL` and `APP_BASE_URL` must match the exact production URL users open.
- `HAYDEN_GOOGLE_EMAIL` maps to Hayden / `PARENT_A`.
- `CONSTANCE_GOOGLE_EMAIL` maps to Constance / `PARENT_B`.
- `EMAIL_FROM` should use a Resend verified sender domain for production.
- `onboarding@resend.dev` can be used for limited testing, but it is not the final production sender.
- Document uploads use a private Vercel Blob store. If Blob is not configured, the app still works but upload is disabled.

## 5. Google OAuth Production Setup

In Google Cloud Console, open the OAuth Client for this app.

Add this Authorized JavaScript origin:

```text
https://your-domain.vercel.app
```

Add this Authorized redirect URI:

```text
https://your-domain.vercel.app/api/auth/callback/google
```

If you add a custom domain later, also add:

```text
https://your-custom-domain.com
https://your-custom-domain.com/api/auth/callback/google
```

Then update Vercel:

```env
NEXTAUTH_URL=https://your-custom-domain.com
APP_BASE_URL=https://your-custom-domain.com
```

If the OAuth app is still in Testing mode, add both Hayden and Constance as test users.

## 6. Neon Database Setup

Use Neon for PostgreSQL. After `DATABASE_URL` is configured locally or in the shell, run:

```bash
npx prisma migrate deploy
```

Bootstrap the family data:

```bash
npm run seed
```

`npm run seed` is non-destructive. It creates or updates the base family, Hayden, Constance, Derick, and missing court-order blocks. It preserves:

- change requests
- expenses
- make-up balances
- manual care blocks
- existing request history

After holiday/rule changes, use the app:

```text
Settings -> Rules & holidays -> Apply to calendar
```

## 7. Resend Email Setup

For production email notifications:

1. Open Resend.
2. Add and verify your sender domain.
3. Set `EMAIL_FROM`, for example:

```env
EMAIL_FROM=CoCare Calendar <notifications@your-domain.com>
```

4. Set `RESEND_API_KEY` in Vercel.
5. Set `APP_BASE_URL` to the production app URL.

After deploy, open:

```text
https://your-domain.vercel.app/settings/notifications
```

Send test emails to both parents.

## 8. Deploy

Deploy from Vercel.

First production setup order:

1. Confirm Vercel environment variables are saved for Production.
2. Deploy the Vercel project.
3. Run database migrations against Neon:

```bash
npx prisma migrate deploy
```

4. Bootstrap base family data:

```bash
npm run seed
```

5. Open the deployed app and sign in as Hayden.
6. Open `Settings -> Rules & holidays`.
7. Click `Apply to calendar`.
8. Open deploy readiness:

```text
https://your-domain.vercel.app/settings/deploy-readiness
```

This is a hidden maintenance page. It is intentionally not shown in the main Settings list after deployment.

This page checks:

- database URL
- live database connection
- NextAuth settings
- Google OAuth config
- Hayden and Constance email allow-list
- Resend API key
- sender email
- app base URL

### Optional Vercel Blob Setup

Use this only if you want PDF/photo uploads:

1. In Vercel, open the project.
2. Go to `Storage`.
3. Create or connect a `Blob` store.
4. Choose `Private` access for family documents.
5. Connect the Blob store to this project so Vercel injects Blob environment variables.
6. Redeploy the project.

The Documents upload form is hidden until Blob is configured.

You can also check the JSON endpoint:

```text
https://your-domain.vercel.app/api/health
```

Expected shape:

```json
{
  "ok": true,
  "status": "ok",
  "timestamp": "...",
  "checks": []
}
```

If `status` is `warning`, review the warning but the app may still work. If `ok` is `false`, fix the listed error before inviting Constance.

## 9. Smoke Test

Test these before relying on the production app:

- Hayden can sign in with Google.
- Constance can sign in with Google.
- Unauthorized Google accounts are blocked.
- Calendar opens on desktop and mobile.
- Month view and week view both work.
- Court-order schedule is visible.
- Change request can be created.
- The other parent can accept or decline.
- Accepted change appears on the calendar.
- Accepted change can be cancelled.
- Email notification is received.
- Make-up balance appears when a request records owed time.
- Expense can be added and shown.
- Special event invitations can be created and accepted/declined.
- Document upload is hidden if Blob is not configured.
- If Blob is configured, a PDF/image can be uploaded and opened from Day details.
- Rules & holidays page loads.
- Holiday rules can be applied to calendar.
- Activity page loads.
- CSV exports download.
- Calendar ICS export downloads from `Settings -> Calendar export`.

## 10. Install On Phone

The app includes a manifest, favicon, and mobile icons.

iPhone:

1. Open the production URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Save as `CoCare`.

Android:

1. Open the production URL in Chrome.
2. Tap the menu.
3. Tap Add to Home screen or Install app.

## 11. Common Problems

### Google Login Says Account Is Not Allowed

Check:

- `HAYDEN_GOOGLE_EMAIL`
- `CONSTANCE_GOOGLE_EMAIL`
- the Google account selected in the login popup
- Vercel environment variables have been redeployed after editing

### Google OAuth Redirect Error

Check:

- `NEXTAUTH_URL`
- Google OAuth Authorized redirect URI
- local development uses `http://localhost:3000`
- production uses the exact Vercel/custom domain

### Email Fails To Send

Check:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- Resend domain verification
- `/settings/notifications`
- `/settings/deploy-readiness`

### Database Error

Check:

- `DATABASE_URL`
- Neon project is active
- `npx prisma migrate deploy` has been run
- `npm run seed` has been run
- `/api/health`

### Calendar Rules Look Outdated

Open:

```text
Settings -> Rules & holidays
```

Then use:

```text
Apply to calendar
```

This rebuilds unreferenced generated court-order blocks while preserving request history and manual records.

## Useful Commands

```bash
npm run dev
npm run dev:clean
npm run build
npx tsc --noEmit
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run sync:court-order
npm run verify:env
```
