# CoCare Calendar

Co-parenting calendar app for Derick's care schedule, change requests, make-up balances, expenses, and court-order holiday rules.

## Current Features

- Calendar month/week views from 2026 onward.
- Court-order generated care schedule.
- Manual care blocks.
- Change requests with pending, accepted, declined, and cancelled states.
- Parent-specific Google login using Hayden/Constance email allow-listing.
- Email notifications for change request create/respond/cancel events.
- Change request audit display.
- Rules & holidays settings for VIC school holidays and public holidays.
- Rules audit trail.
- Child-related expense tracking.
- CSV export for change requests, expenses, and audit logs.
- ICS calendar export for Google Calendar, Apple Calendar, and Outlook.
- Deploy readiness page for environment, database, login, and email checks.
- `/api/health` endpoint for readiness checks.

## Environment Variables

Create `.env` from `.env.example`.

Required:

```env
DATABASE_URL=

NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

HAYDEN_GOOGLE_EMAIL=
CONSTANCE_GOOGLE_EMAIL=
FAMILY_NAME=CoCare Family

RESEND_API_KEY=
EMAIL_FROM=Care Calendar <notifications@your-domain.com>
APP_BASE_URL=http://localhost:3000
```

Notes:

- `DATABASE_URL` must start with `postgresql://` or `postgres://`. Do not wrap it in quotes.
- `NEXTAUTH_SECRET` should be a long random secret.
- `NEXTAUTH_URL` must match the URL users open in the browser.
- For local development, use `http://localhost:3000`, not `3001` or a LAN IP, unless those URLs are also configured in Google Cloud.
- `HAYDEN_GOOGLE_EMAIL` maps to `PARENT_A`.
- `CONSTANCE_GOOGLE_EMAIL` maps to `PARENT_B`.
- `FAMILY_NAME` controls the saved family display name created by `npm run seed`.
- `RESEND_API_KEY` enables email notifications. If it is empty, the app skips email sending without blocking the request.
- `EMAIL_FROM` must use a sender domain verified in Resend before production email will send.
- `APP_BASE_URL` is used in email links. In production, set it to the same value as `NEXTAUTH_URL`.

## Email Notifications

The app sends email through Resend using the built-in `fetch` API, so no extra npm package is required.

Notifications are sent when:

- A parent creates a change request.
- The other parent accepts or declines it.
- An accepted change is cancelled.

For production:

1. Create a Resend account.
2. Verify your sender domain.
3. Set `RESEND_API_KEY`.
4. Set `EMAIL_FROM`, for example `Care Calendar <notifications@your-domain.com>`.
5. Set `APP_BASE_URL=https://your-domain.com`.
6. Open `/settings/notifications` and send test emails to both parents.

## Mobile Web App

The app includes a web app manifest and mobile metadata, so it can be saved to a phone home screen.

On iPhone:

1. Open the production URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Save it as `CoCare`.

On Android:

1. Open the production URL in Chrome.
2. Tap the menu.
3. Tap Add to Home screen or Install app.

Brand assets live in `public/icons/`. The current brand is a simple `CoCare` wordmark with the slogan `Derick's care calendar`. PNG icons are included for installable mobile web app support.

## Google OAuth Setup

In Google Cloud Console, create an OAuth Client:

- Application type: `Web application`
- Local Authorized JavaScript origin:

```text
http://localhost:3000
```

- Local Authorized redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

If the OAuth app is in Testing mode, add both Hayden and Constance as test users.

For production, add the production domain too:

```text
https://your-domain.com
https://your-domain.com/api/auth/callback/google
```

Then set:

```env
NEXTAUTH_URL=https://your-domain.com
```

## Local Development

Install dependencies:

```bash
npm install
```

Apply migrations and bootstrap base data:

```bash
npx prisma migrate deploy
npm run seed
```

`npm run seed` is non-destructive. It creates or updates the base family, parents, Derick, and missing court-order blocks, but preserves existing requests, expenses, make-up balances, and manual care blocks.

Run the dev server on port 3000:

```bash
npm run dev -- -p 3000
```

If local `.next` cache gets stuck or you see `Cannot find module './xxx.js'`, use:

```bash
npm run dev:clean
```

Open:

```text
http://localhost:3000/login
```

If Next switches to port 3001, stop the old server and restart on 3000. Google OAuth local redirect is configured for port 3000.

## Deployment Checklist

Full deployment steps are in [DEPLOYMENT.md](./DEPLOYMENT.md).

### Vercel

1. Push the project to GitHub.
2. In Vercel, create a new project from the GitHub repo.
3. Framework preset should be `Next.js`.
4. Add these environment variables in Vercel Project Settings:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
HAYDEN_GOOGLE_EMAIL=
CONSTANCE_GOOGLE_EMAIL=
FAMILY_NAME=CoCare Family
RESEND_API_KEY=
EMAIL_FROM=Care Calendar <notifications@your-domain.com>
APP_BASE_URL=https://your-vercel-domain.vercel.app
```

5. In Google Cloud OAuth Client, add production values:

```text
Authorized JavaScript origin:
https://your-vercel-domain.vercel.app

Authorized redirect URI:
https://your-vercel-domain.vercel.app/api/auth/callback/google
```

6. Deploy in Vercel.
7. Run Prisma migrations against Neon from your local terminal:

```bash
npx prisma migrate deploy
```

8. Bootstrap base data once:

```bash
npm run seed
```

9. Check deploy readiness:

```text
https://your-vercel-domain.vercel.app/settings/deploy-readiness
```

The JSON health endpoint is:

```text
https://your-vercel-domain.vercel.app/api/health
```

10. Open `/settings/notifications` and send test emails.

### Preflight

Before deployment, verify local environment variables:

```bash
npm run verify:env
```

Expected successful `/api/health` response shape:

```json
{
  "ok": true,
  "status": "ok",
  "timestamp": "...",
  "checks": []
}
```

## Useful Scripts

```bash
npm run build
npm run dev
npm run dev:clean
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run sync:court-order
npm run verify:env
```

## Production Notes

- Do not commit `.env`.
- Keep Google OAuth credentials private.
- `npm run seed` is safe to rerun; it does not clear live calendar data.
- Rules changes are logged in `AuditLog`.
- Manual holiday rules override generated auto rules.
- Applying holiday rules rebuilds unreferenced default court-order blocks and preserves change-request history.
