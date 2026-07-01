import { ArrowLeft, Send } from "lucide-react";
import { sendTestNotificationEmail } from "@/app/actions";
import { LogoutButton } from "@/components/logout-button";
import { requireCurrentFamilyMember } from "@/lib/auth";
import {
  emailNotificationsConfigured,
  notificationEmailForRole,
} from "@/lib/email-notifications";

export const dynamic = "force-dynamic";

function maskEmail(email: string | null) {
  if (!email) return "Not configured";

  const [name, domain] = email.split("@");
  if (!domain) return email;

  return `${name.slice(0, 2)}***@${domain}`;
}

function publicEmailProviderWarning(from: string | undefined) {
  return /@(gmail|outlook|hotmail|yahoo|icloud)\./i.test(from ?? "");
}

function pageMessage(params: { sent?: string; error?: string; detail?: string } | undefined) {
  if (params?.sent) {
    return {
      className: "rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900",
      text: "Test email sent. Check the recipient inbox.",
    };
  }

  if (params?.error === "skipped") {
    return {
      className: "rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
      text: "Email was skipped because notification settings are incomplete.",
    };
  }

  if (params?.error === "failed") {
    return {
      className: "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900",
      text: params.detail
        ? `Email failed to send. ${params.detail}`
        : "Email failed to send. Check RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  if (params?.error === "invalid-recipient") {
    return {
      className: "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900",
      text: "Invalid recipient.",
    };
  }

  return null;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ sent?: string; error?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const currentMember = await requireCurrentFamilyMember();
  const message = pageMessage(params);
  const configured = emailNotificationsConfigured();
  const haydenEmail = notificationEmailForRole("PARENT_A");
  const constanceEmail = notificationEmailForRole("PARENT_B");
  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const emailFrom = process.env.EMAIL_FROM;
  const fromUsesPublicProvider = publicEmailProviderWarning(emailFrom);

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
          <div>
            <a
              href="/settings"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to settings
            </a>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              Email notifications
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Send test emails and confirm that change request notifications are ready.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="min-w-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm"
              title={`Google account: ${currentMember.googleEmail}`}
            >
              <div className="truncate">
                Signed in as{" "}
                <span className="font-medium text-slate-950">{currentMember.user.name}</span>
              </div>
              <div className="hidden text-xs text-slate-400 sm:block">
                {currentMember.googleEmail}
              </div>
            </div>
            <LogoutButton />
          </div>
        </header>

        {message ? <section className={message.className}>{message.text}</section> : null}

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Configuration</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <div className="text-slate-500">Resend API key</div>
              <div className="font-medium text-slate-950">
                {configured ? "Configured" : "Missing"}
              </div>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <div className="text-slate-500">App link used in emails</div>
              <div className="break-all font-medium text-slate-950">{appBaseUrl}</div>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm sm:col-span-2">
              <div className="text-slate-500">Sender</div>
              <div className="break-all font-medium text-slate-950">
                {emailFrom || "Not configured"}
              </div>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <div className="text-slate-500">Hayden recipient</div>
              <div className="font-medium text-slate-950">{maskEmail(haydenEmail)}</div>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <div className="text-slate-500">Constance recipient</div>
              <div className="font-medium text-slate-950">{maskEmail(constanceEmail)}</div>
            </div>
          </div>
          {!configured ? (
            <p className="mt-3 text-sm text-amber-700">
              Add RESEND_API_KEY, EMAIL_FROM, and APP_BASE_URL in `.env` or Vercel before sending
              real emails.
            </p>
          ) : null}
          {fromUsesPublicProvider ? (
            <p className="mt-3 text-sm text-amber-700">
              Gmail, Outlook, Yahoo, and iCloud addresses usually cannot be used as Resend sender
              domains. Use a Resend verified domain sender, or use onboarding@resend.dev for limited
              testing.
            </p>
          ) : null}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Send test email</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <form action={sendTestNotificationEmail}>
              <input type="hidden" name="role" value="PARENT_A" />
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Send className="h-4 w-4" />
                Test Hayden
              </button>
            </form>
            <form action={sendTestNotificationEmail}>
              <input type="hidden" name="role" value="PARENT_B" />
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Send className="h-4 w-4" />
                Test Constance
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
