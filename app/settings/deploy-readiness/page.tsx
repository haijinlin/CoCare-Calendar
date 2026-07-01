import { ArrowLeft, CheckCircle2, CircleAlert, CircleX, ServerCog } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { requireCurrentFamilyMember } from "@/lib/auth";
import { getDeployReadiness, ReadinessStatus } from "@/lib/deploy-readiness";

export const dynamic = "force-dynamic";

const statusStyles: Record<ReadinessStatus, string> = {
  ok: "border-teal-200 bg-teal-50 text-teal-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-red-200 bg-red-50 text-red-950",
};

const statusIcons = {
  ok: CheckCircle2,
  warning: CircleAlert,
  error: CircleX,
};

function statusText(status: ReadinessStatus) {
  if (status === "ok") return "Ready";
  if (status === "warning") return "Needs review";
  return "Blocked";
}

export default async function DeployReadinessPage() {
  const currentMember = await requireCurrentFamilyMember();
  const readiness = await getDeployReadiness();
  const StatusIcon = statusIcons[readiness.status];

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
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <ServerCog className="h-4 w-4" />
              Deploy readiness
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              Environment check
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Confirm the production settings needed for database access, login, and email
              notifications. Secret values are never shown here.
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

        <section className={`rounded-md border px-4 py-3 text-sm ${statusStyles[readiness.status]}`}>
          <div className="flex items-center gap-2">
            <StatusIcon className="h-4 w-4 shrink-0" />
            <div className="font-semibold">{statusText(readiness.status)}</div>
          </div>
          <p className="mt-1">
            Last checked {new Date(readiness.timestamp).toLocaleString("en-AU")}. The public JSON
            endpoint is available at <span className="font-medium">/api/health</span>.
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="grid divide-y divide-slate-100">
            {readiness.checks.map((check) => {
              const Icon = statusIcons[check.status];

              return (
                <div key={check.key} className="flex items-start gap-3 px-4 py-3">
                  <Icon
                    className={
                      check.status === "ok"
                        ? "mt-0.5 h-4 w-4 shrink-0 text-teal-600"
                        : check.status === "warning"
                          ? "mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                          : "mt-0.5 h-4 w-4 shrink-0 text-red-600"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-medium text-slate-950">{check.label}</div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        {check.status}
                      </div>
                    </div>
                    <div className="mt-1 break-words text-sm text-slate-500">{check.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
