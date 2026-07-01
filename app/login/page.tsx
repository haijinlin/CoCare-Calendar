import { LogIn } from "lucide-react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const dynamic = "force-dynamic";

function errorMessage(error: string | undefined) {
  if (!error) return null;

  if (error === "OAuthCallback") {
    return "Google sign-in callback failed. Check the OAuth client secret and redirect URI in Google Cloud Console.";
  }

  if (error === "AccessDenied" || error === "not-allowed") {
    return "This Google account is not approved for Derick's CoCare calendar.";
  }

  return "Google sign-in failed. Please try again.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const message = errorMessage(params?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <LogIn className="h-4 w-4" />
          Co-parenting calendar
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Use your approved Google account. The app maps Hayden and Constance by email, so requests
          and approvals are recorded against the correct parent.
        </p>

        {message ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {message}
            {params?.email ? (
              <div className="mt-1 text-xs text-red-800">
                Google returned: {params.email}
              </div>
            ) : null}
            {params?.error === "OAuthCallback" ? (
              <div className="mt-2 text-xs text-red-800">
                For local testing, use http://localhost:3000 and make sure Google Cloud has
                http://localhost:3000/api/auth/callback/google as the redirect URI.
              </div>
            ) : null}
            {params?.error === "AccessDenied" || params?.error === "not-allowed" ? (
              <div className="mt-2 text-xs text-red-800">
                Please sign in with the exact Google account approved for Hayden or Constance. If
                this is the right account, check HAYDEN_GOOGLE_EMAIL and CONSTANCE_GOOGLE_EMAIL in
                the app environment settings, then restart or redeploy the app.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5">
          <GoogleSignInButton />
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Access is limited to the two Google emails configured for Hayden and Constance.
        </p>
      </section>
    </main>
  );
}
