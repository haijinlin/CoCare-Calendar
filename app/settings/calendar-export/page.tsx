import { addMonths, addYears, format } from "date-fns";
import { ArrowLeft, CalendarPlus, Download, RefreshCw } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { requireCurrentFamilyMember } from "@/lib/auth";
import { fallbackParentLabels } from "@/lib/parents";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CalendarExportPage() {
  const currentMember = await requireCurrentFamilyMember();
  const members = await prisma.familyMember.findMany({
    where: { familyId: DEMO_FAMILY_ID },
    include: { user: true },
  });
  const parentLabels = members.reduce(
    (labels, member) => ({
      ...labels,
      [member.role]: member.user.name,
    }),
    fallbackParentLabels,
  );
  const today = new Date();
  const defaultFrom = format(today, "yyyy-MM-dd");
  const defaultTo = format(addMonths(today, 3), "yyyy-MM-dd");
  const rangeOptions = [
    { label: "Next 1 month", from: defaultFrom, to: format(addMonths(today, 1), "yyyy-MM-dd") },
    { label: "Next 3 months", from: defaultFrom, to: defaultTo },
    { label: "Next 12 months", from: defaultFrom, to: format(addYears(today, 1), "yyyy-MM-dd") },
  ];

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
              <CalendarPlus className="h-4 w-4" />
              Calendar export
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              Export to calendar
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Download Derick&apos;s care schedule as an ICS file. You can import it into Google
              Calendar, Apple Calendar, Outlook, or keep it as a backup.
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

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <form action="/api/calendar-export" method="get" className="grid gap-4">
            <div>
              <div className="text-sm font-medium text-slate-700">Quick ranges</div>
              <p className="mt-1 text-xs text-slate-500">
                Quick downloads use "Only my care schedule". Use the custom form below for Hayden,
                Constance, or all care.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {rangeOptions.map((option) => (
                  <a
                    key={option.label}
                    href={`/api/calendar-export?from=${option.from}&to=${option.to}&scope=mine`}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {option.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                From
                <input
                  type="date"
                  name="from"
                  defaultValue={defaultFrom}
                  className="h-11 rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-slate-500"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                To
                <input
                  type="date"
                  name="to"
                  defaultValue={defaultTo}
                  className="h-11 rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Export
              <select
                name="scope"
                defaultValue="mine"
                className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="mine">Only my care schedule</option>
                <option value="parent-a">Only {parentLabels.PARENT_A}</option>
                <option value="parent-b">Only {parentLabels.PARENT_B}</option>
                <option value="all">All care schedule</option>
              </select>
            </label>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Accepted change requests are included as "Changed by agreement" events. They replace
              the original court-order care for the overlapping time in this export.
            </div>

            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
              <Download className="h-4 w-4" />
              Download ICS
            </button>
          </form>
        </section>

        <section className="rounded-md border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
          <div className="flex gap-3">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Google Calendar sync can come later</div>
              <p className="mt-1 text-violet-900">
                Direct sync would need extra Google Calendar permission. For now, ICS export keeps
                the app simpler and avoids accidental duplicates in your Google Calendar.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

