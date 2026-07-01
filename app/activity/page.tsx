import { format } from "date-fns";
import { ArrowLeft, Download } from "lucide-react";
import { Prisma } from "@prisma/client";
import { LogoutButton } from "@/components/logout-button";
import { requireCurrentFamilyMember } from "@/lib/auth";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AuditLogWithActor = Prisma.AuditLogGetPayload<{ include: { actor: true } }>;

function actionClass(action: string) {
  if (action === "DELETE" || action === "CANCEL") {
    return "bg-red-50 text-red-700 ring-red-100";
  }

  if (action === "CREATE" || action === "APPLY" || action === "SETTLE") {
    return "bg-teal-50 text-teal-700 ring-teal-100";
  }

  if (action === "UPDATE" || action === "FETCH" || action === "GENERATE") {
    return "bg-blue-50 text-blue-700 ring-blue-100";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default async function ActivityPage() {
  const currentMember = await requireCurrentFamilyMember();
  let databaseAvailable = true;
  let auditLogs: AuditLogWithActor[] = [];

  try {
    auditLogs = await prisma.auditLog.findMany({
      where: { familyId: DEMO_FAMILY_ID },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    databaseAvailable = false;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a
              href="/"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to calendar
            </a>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
              Activity log
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Recent changes to care blocks, change requests, make-up balances, expenses, and rules.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
              title={`Google account: ${currentMember.googleEmail}`}
            >
              <div>
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

        {!databaseAvailable ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Database is currently unavailable, so activity cannot be loaded.
          </section>
        ) : null}

        {databaseAvailable ? (
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Latest activity</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing the most recent {auditLogs.length} logged actions.
                </p>
              </div>
              <a
                href="/settings/rules"
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Rules
              </a>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <a
                href="/api/export/change-requests"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Requests CSV
              </a>
              <a
                href="/api/export/expenses"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Expenses CSV
              </a>
              <a
                href="/api/export/audit-log"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Audit CSV
              </a>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex gap-3 py-3">
                  <div className="pt-0.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ${actionClass(
                        log.action,
                      )}`}
                    >
                      {log.action.toLowerCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-950">{log.summary}</div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{log.actor.name}</span>
                      <span>{format(log.createdAt, "d MMM yyyy h:mm a")}</span>
                      <span>{log.entityType}</span>
                    </div>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
                  No activity logged yet.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
