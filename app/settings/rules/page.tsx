import { format } from "date-fns";
import { ArrowLeft, CalendarPlus, History, Mail, Pencil, Trash2 } from "lucide-react";
import { Prisma } from "@prisma/client";
import {
  applyHolidayRulesToCourtOrder,
  createPublicHolidayRule,
  createSchoolHolidayPeriod,
  deletePublicHolidayRule,
  deleteSchoolHolidayPeriod,
  fetchOfficialSchoolHolidayPeriods,
  generateAutoPublicHolidayRules,
  updatePublicHolidayRule,
  updateSchoolHolidayPeriod,
} from "@/app/actions";
import { LogoutButton } from "@/components/logout-button";
import { requireCurrentFamilyMember } from "@/lib/auth";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { fallbackParentLabels } from "@/lib/parents";
import { prisma } from "@/lib/prisma";
import { generateCourtOrderCareBlocks2026 } from "@/lib/court-order-schedule";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export const dynamic = "force-dynamic";

type MemberWithUser = Prisma.FamilyMemberGetPayload<{ include: { user: true } }>;
type AuditLogWithActor = Prisma.AuditLogGetPayload<{ include: { actor: true } }>;

function pageMessage(status: string | undefined) {
  if (status === "school-fetch-failed") {
    return {
      className: "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900",
      message:
        "Official school holiday fetch failed. You can still add or edit the dates manually below.",
    };
  }

  if (status === "public-generate-failed") {
    return {
      className: "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900",
      message:
        "Public holiday generation failed. You can still add or edit public holidays manually below.",
    };
  }

  if (status === "school") {
    return {
      className:
        "rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900",
      message:
        "Official VIC school holiday dates were fetched and saved as AUTO rules. Review them, then Apply to calendar.",
    };
  }

  if (status === "public") {
    return {
      className:
        "rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900",
      message:
        "Standard VIC public holidays were generated and saved as AUTO rules. Review them, then Apply to calendar.",
    };
  }

  if (status === "applied") {
    return {
      className:
        "rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900",
      message:
        "Holiday rules were applied to the calendar. Existing change-request history was preserved.",
    };
  }

  return null;
}

export default async function RulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ fetched?: string; error?: string; applied?: string }>;
}) {
  const params = await searchParams;
  const currentMember = await requireCurrentFamilyMember();
  const message = pageMessage(params?.error ?? params?.fetched ?? (params?.applied ? "applied" : undefined));
  let databaseAvailable = true;
  let members: MemberWithUser[] = [];
  let schoolHolidays: Awaited<ReturnType<typeof prisma.schoolHolidayPeriod.findMany>> = [];
  let publicHolidays: Awaited<ReturnType<typeof prisma.publicHolidayRule.findMany>> = [];
  let auditLogs: AuditLogWithActor[] = [];
  let courtOrderCount = 0;
  let referencedCourtOrderCount = 0;

  try {
    [members, schoolHolidays, publicHolidays, auditLogs, courtOrderCount, referencedCourtOrderCount] =
      await Promise.all([
      prisma.familyMember.findMany({
        where: { familyId: DEMO_FAMILY_ID },
        include: { user: true },
        orderBy: { role: "asc" },
      }),
      prisma.schoolHolidayPeriod.findMany({
        where: { familyId: DEMO_FAMILY_ID },
        orderBy: [{ year: "asc" }, { startsOn: "asc" }, { source: "asc" }],
      }),
      prisma.publicHolidayRule.findMany({
        where: { familyId: DEMO_FAMILY_ID },
        orderBy: [{ date: "asc" }, { source: "asc" }],
      }),
      prisma.auditLog.findMany({
        where: { familyId: DEMO_FAMILY_ID },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.careBlock.count({ where: { familyId: DEMO_FAMILY_ID, source: "COURT_ORDER" } }),
      prisma.careBlock.count({
        where: { familyId: DEMO_FAMILY_ID, source: "COURT_ORDER", changeRequests: { some: {} } },
      }),
    ]);
  } catch {
    databaseAvailable = false;
  }
  const parentLabels = members.reduce(
    (labels, member) => ({
      ...labels,
      [member.role]: member.user.name,
    }),
    fallbackParentLabels,
  );
  const manualRuleCount =
    schoolHolidays.filter((holiday) => holiday.source === "MANUAL").length +
    publicHolidays.filter((holiday) => holiday.source === "MANUAL").length;
  const autoRuleCount =
    schoolHolidays.filter((holiday) => holiday.source === "AUTO").length +
    publicHolidays.filter((holiday) => holiday.source === "AUTO").length;
  const previewBlocks = generateCourtOrderCareBlocks2026({
    schoolHolidays: schoolHolidays.map((period) => ({
      start: period.startsOn,
      end: period.endsOn,
      year: period.year,
      label: period.label,
    })),
    publicHolidays: publicHolidays.map((holiday) => ({
      date: holiday.date,
      parentRole: holiday.parentRole,
      name: holiday.name,
    })),
  });

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
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
              Rules & holidays
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Maintain VIC school holidays and public holidays here. Automatic import is a
              convenience, and manual entries remain the fallback when official pages change.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <a
              href="/activity"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <History className="h-4 w-4" />
              Activity
            </a>
            <a
              href="/settings/notifications"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
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

        <section className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
          <div className="font-medium">How this page works</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <p>
              <span className="font-medium">Fetch / Generate</span> updates the saved holiday
              rule list only.
            </p>
            <p>
              <span className="font-medium">Edit</span> turns an auto rule into manual, so future
              automatic updates will not overwrite it.
            </p>
            <p>
              <span className="font-medium">Apply to calendar</span> rebuilds default court-order
              blocks after you review the rules.
            </p>
          </div>
          <p className="mt-2 text-xs text-violet-800">
            AFL Grand Final Friday should still be entered manually once announced.
          </p>
        </section>

        {!databaseAvailable ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Database is currently unavailable, so saved holiday rules cannot be loaded or edited.
          </section>
        ) : null}

        {databaseAvailable && message ? (
          <section className={message.className}>{message.message}</section>
        ) : null}

        {databaseAvailable ? (
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Preview & apply</h2>
                <p className="mt-1 text-sm text-slate-500">
                  This will rebuild unreferenced court-order blocks using the rules below. Blocks
                  linked to change requests are preserved.
                </p>
              </div>
              <form action={applyHolidayRulesToCourtOrder}>
                <ConfirmSubmitButton
                  className="h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
                  confirmMessage="Apply these holiday rules to the calendar? This will rebuild default court-order blocks while preserving change-request history and expenses."
                >
                  Apply to calendar
                </ConfirmSubmitButton>
              </form>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-slate-500">Generated blocks</div>
                <div className="font-semibold text-slate-950">{previewBlocks.length}</div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-slate-500">Current blocks</div>
                <div className="font-semibold text-slate-950">{courtOrderCount}</div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-slate-500">Preserved</div>
                <div className="font-semibold text-slate-950">{referencedCourtOrderCount}</div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-slate-500">Manual rules</div>
                <div className="font-semibold text-slate-950">{manualRuleCount}</div>
                <div className="text-xs text-slate-400">Auto {autoRuleCount}</div>
              </div>
            </div>
          </section>
        ) : null}

        {databaseAvailable ? (
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Recent activity</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Rule and calendar maintenance actions are logged with the parent who performed
                  them.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div className="font-medium text-slate-950">{log.summary}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {log.actor.name} - {format(log.createdAt, "d MMM yyyy h:mm a")}
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                  No activity logged yet.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-950">VIC school holidays</h2>
              <form action={fetchOfficialSchoolHolidayPeriods}>
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <CalendarPlus className="h-4 w-4" />
                  Fetch official
                </button>
              </form>
            </div>

            <form action={createSchoolHolidayPeriod} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="year"
                  type="number"
                  min="2026"
                  max="2037"
                  placeholder="Year"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  required
                />
                <input
                  name="label"
                  placeholder="Winter holidays"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="startsOn"
                  type="date"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  required
                />
                <input
                  name="endsOn"
                  type="date"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  required
                />
              </div>
              <button className="h-10 w-full rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
                Add school holiday
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {schoolHolidays.map((period) => (
                <div key={period.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">{period.label}</div>
                      <div className="text-slate-500">
                        {format(period.startsOn, "d MMM yyyy")} -{" "}
                        {format(period.endsOn, "d MMM yyyy")}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {period.year} - {period.source.toLowerCase()}
                      </div>
                    </div>
                    <form action={deleteSchoolHolidayPeriod.bind(null, period.id)}>
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                  <details className="mt-3">
                    <summary className="inline-flex h-8 cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit details
                    </summary>
                    <form
                      action={updateSchoolHolidayPeriod.bind(null, period.id)}
                      className="mt-3 space-y-3 rounded-md bg-slate-50 p-3"
                    >
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        name="year"
                        type="number"
                        min="2026"
                        max="2037"
                        defaultValue={period.year}
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        required
                      />
                      <input
                        name="label"
                        defaultValue={period.label}
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        name="startsOn"
                        type="date"
                        defaultValue={format(period.startsOn, "yyyy-MM-dd")}
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        required
                      />
                      <input
                        name="endsOn"
                        type="date"
                        defaultValue={format(period.endsOn, "yyyy-MM-dd")}
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        required
                      />
                    </div>
                    <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800">
                      <Pencil className="h-4 w-4" />
                      Save edits
                    </button>
                    </form>
                  </details>
                </div>
              ))}
              {schoolHolidays.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                  No manually maintained school holidays yet.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-950">Public holidays</h2>
              <form action={generateAutoPublicHolidayRules}>
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <CalendarPlus className="h-4 w-4" />
                  Generate standard
                </button>
              </form>
            </div>

            <form action={createPublicHolidayRule} className="mt-4 space-y-3">
              <input
                name="name"
                placeholder="King's Birthday"
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="date"
                  type="date"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  required
                />
                <select
                  name="parentRole"
                  defaultValue="PARENT_B"
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                  required
                >
                  <option value="PARENT_A">{parentLabels.PARENT_A}</option>
                  <option value="PARENT_B">{parentLabels.PARENT_B}</option>
                  <option value="BOTH">Both parents</option>
                </select>
              </div>
              <button className="h-10 w-full rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
                Add public holiday
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {publicHolidays.map((holiday) => (
                <div key={holiday.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">{holiday.name}</div>
                      <div className="text-slate-500">
                        {format(holiday.date, "d MMM yyyy")} - {parentLabels[holiday.parentRole]}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {holiday.source.toLowerCase()}
                      </div>
                    </div>
                    <form action={deletePublicHolidayRule.bind(null, holiday.id)}>
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                  <details className="mt-3">
                    <summary className="inline-flex h-8 cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit details
                    </summary>
                    <form
                      action={updatePublicHolidayRule.bind(null, holiday.id)}
                      className="mt-3 space-y-3 rounded-md bg-slate-50 p-3"
                    >
                    <input
                      name="name"
                      defaultValue={holiday.name}
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                      required
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        name="date"
                        type="date"
                        defaultValue={format(holiday.date, "yyyy-MM-dd")}
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        required
                      />
                      <select
                        name="parentRole"
                        defaultValue={holiday.parentRole}
                        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                        required
                      >
                        <option value="PARENT_A">{parentLabels.PARENT_A}</option>
                        <option value="PARENT_B">{parentLabels.PARENT_B}</option>
                        <option value="BOTH">Both parents</option>
                      </select>
                    </div>
                    <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800">
                      <Pencil className="h-4 w-4" />
                      Save edits
                    </button>
                    </form>
                  </details>
                </div>
              ))}
              {publicHolidays.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                  No manually maintained public holidays yet.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
