import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isValid,
  subMonths,
  subWeeks,
  addWeeks,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CareCalendar } from "@/components/care-calendar";
import { CareCreditPanel } from "@/components/care-credit-panel";
import { ChangeRequestPanel } from "@/components/change-request-panel";
import { DayDetailPanel } from "@/components/day-detail-panel";
import { ExpensePanel } from "@/components/expense-panel";
import { LogoutButton } from "@/components/logout-button";
import { PersonBadge } from "@/components/person-badge";
import { generateCourtOrderCareBlocks2026, hasVicSchoolHolidayData } from "@/lib/court-order-schedule";
import { requireCurrentFamilyMember } from "@/lib/auth";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { fallbackParentLabels } from "@/lib/parents";
import { prisma } from "@/lib/prisma";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{
    month?: string;
    week?: string;
    view?: string;
    editRequest?: string;
    date?: string;
    day?: string;
    error?: string;
    requests?: string;
    requestStatus?: string;
    expenseStatus?: string;
    open?: string;
    focusRequest?: string;
  }>;
}) {
  const params = await searchParams;
  const currentMember = await requireCurrentFamilyMember();
  const view = params?.view === "week" ? "week" : "month";
  const parsedMonth = params?.month ? new Date(`${params.month}-01T00:00:00`) : new Date();
  const selectedMonth = isValid(parsedMonth) ? parsedMonth : new Date();
  const parsedWeek = params?.week ? new Date(`${params.week}T00:00:00`) : selectedMonth;
  const selectedWeek = isValid(parsedWeek) ? parsedWeek : selectedMonth;
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarStart = view === "week" ? startOfWeek(selectedWeek, { weekStartsOn: 1 }) : monthStart;
  const calendarEnd = view === "week" ? endOfWeek(selectedWeek, { weekStartsOn: 1 }) : monthEnd;
  const gridStart = startOfWeek(calendarStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(calendarEnd, { weekStartsOn: 1 });

  const data = await loadCalendarData(gridStart, gridEnd);
  const { family, children, careBlocks, members, requests, credits, expenses, handoverNotes, databaseAvailable } =
    data;

  const parentLabels = members.reduce(
    (labels, member) => ({
      ...labels,
      [member.role]: member.user.name,
    }),
    fallbackParentLabels,
  );
  const users = members.map((member) => member.user);
  const childName = children[0]?.name ?? "Derick";
  const selectedYear = monthStart.getFullYear();
  const hasSchoolHolidayData = hasVicSchoolHolidayData(selectedYear);
  const parsedDefaultDate = params?.date ? new Date(`${params.date}T00:00:00`) : null;
  const defaultCareBlockDate =
    parsedDefaultDate && isValid(parsedDefaultDate) ? parsedDefaultDate : null;
  const parsedSelectedDay = params?.day ? new Date(`${params.day}T00:00:00`) : null;
  const selectedDay = parsedSelectedDay && isValid(parsedSelectedDay) ? parsedSelectedDay : null;
  const formDefaultDate = defaultCareBlockDate ?? selectedDay;
  const formDefaultDateKey = formDefaultDate ? format(formDefaultDate, "yyyy-MM-dd") : "none";
  const editingRequest = params?.editRequest
    ? requests.find((request) => request.id === params.editRequest && request.status === "PENDING")
    : null;
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const yearOptions = Array.from({ length: 12 }, (_, index) => 2026 + index);
  const prevHref =
    view === "week"
      ? `/?view=week&week=${format(subWeeks(selectedWeek, 1), "yyyy-MM-dd")}&month=${format(monthStart, "yyyy-MM")}`
      : `/?view=month&month=${format(subMonths(monthStart, 1), "yyyy-MM")}`;
  const nextHref =
    view === "week"
      ? `/?view=week&week=${format(addWeeks(selectedWeek, 1), "yyyy-MM-dd")}&month=${format(monthStart, "yyyy-MM")}`
      : `/?view=month&month=${format(addMonths(monthStart, 1), "yyyy-MM")}`;
  const thisMonth = format(new Date(), "yyyy-MM");
  const thisWeek = format(new Date(), "yyyy-MM-dd");
  const baseQuery =
    view === "week"
      ? `view=week&week=${format(selectedWeek, "yyyy-MM-dd")}&month=${format(monthStart, "yyyy-MM")}`
      : `view=month&month=${format(monthStart, "yyyy-MM")}`;
  const requestScope =
    params?.requests === "day" || params?.requests === "all" ? params.requests : "month";
  const requestStatus =
    params?.requestStatus === "accepted" || params?.requestStatus === "all"
      ? params.requestStatus
      : "pending";
  const expenseStatus =
    params?.expenseStatus === "settled" || params?.expenseStatus === "all"
      ? params.expenseStatus
      : "open";
  const openPanel = params?.open;
  const openCreditCount = credits.filter((credit) => credit.status === "OPEN").length;
  const pendingRequestCount = requests.filter((request) => request.status === "PENDING").length;
  const openExpenseCents = expenses
    .filter((expense) => expense.status === "OPEN")
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  const dayQuery = selectedDay
    ? `&day=${format(selectedDay, "yyyy-MM-dd")}&date=${format(selectedDay, "yyyy-MM-dd")}`
    : "";
  const returnTo = `/?${baseQuery}${dayQuery}`;

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <BrandMark />
            <div className="flex flex-wrap items-center gap-2">
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
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
                {view === "week"
                  ? `${format(gridStart, "d MMM")} - ${format(gridEnd, "d MMM yyyy")}`
                  : format(monthStart, "MMMM yyyy")}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                <PersonBadge name={parentLabels.PARENT_A} kind="dad" />
                <PersonBadge name={parentLabels.PARENT_B} kind="mum" />
                <PersonBadge name={childName} kind="child" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[auto,1fr] sm:items-center md:flex md:flex-wrap md:justify-end">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-10 shrink-0 rounded-md border border-slate-200 bg-white p-1">
                  <a
                    href={`/?view=month&month=${format(monthStart, "yyyy-MM")}`}
                    className={`inline-flex items-center rounded px-3 text-sm font-medium ${
                      view === "month"
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Month
                  </a>
                  <a
                    href={`/?view=week&week=${format(selectedWeek, "yyyy-MM-dd")}&month=${format(monthStart, "yyyy-MM")}`}
                    className={`inline-flex items-center rounded px-3 text-sm font-medium ${
                      view === "week"
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Week
                  </a>
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <a
                    href={prevHref}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    title={view === "week" ? "Previous week" : "Previous month"}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </a>
                  <a
                    href={
                      view === "week"
                        ? `/?view=week&week=${thisWeek}&month=${thisMonth}`
                        : `/?view=month&month=${thisMonth}`
                    }
                    className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Today
                  </a>
                  <a
                    href={nextHref}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    title={view === "week" ? "Next week" : "Next month"}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <form action="/" className="flex min-w-0 items-center gap-2">
                <input type="hidden" name="view" value={view} />
                {view === "week" ? (
                  <input type="hidden" name="week" value={format(selectedWeek, "yyyy-MM-dd")} />
                ) : null}
                <select
                  name="month"
                  defaultValue={format(monthStart, "yyyy-MM")}
                  className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500 sm:w-36 sm:flex-none"
                >
                  {yearOptions.flatMap((year) =>
                    Array.from({ length: 12 }, (_, index) => {
                      const value = `${year}-${String(index + 1).padStart(2, "0")}`;
                      return (
                        <option key={value} value={value}>
                          {format(new Date(year, index, 1), "MMM yyyy")}
                        </option>
                      );
                    }),
                  )}
                </select>
                <button className="h-10 shrink-0 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800">
                  Go
                </button>
              </form>
              <div className="grid gap-2 sm:col-span-2 md:col-span-1 md:flex">
                <a
                  href="/settings"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-4"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </a>
              </div>
            </div>
          </div>
        </header>

        {!databaseAvailable ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Database is currently unavailable, so the calendar is showing the local court-order
            generated schedule. Create, edit, request, and expense actions need Neon to be reachable.
          </div>
        ) : null}

        {params?.error === "missing-court-order-block" ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            No court-order care block was found for that request start time. Use a date with a generated
            court-order schedule, or add the missing court-order data before requesting a change.
          </div>
        ) : null}

        {params?.error === "change-request-overlap" ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            That change request overlaps an existing pending or accepted change. Resolve the existing
            request first or choose a different time.
          </div>
        ) : null}

        {params?.error === "action-not-allowed" ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            That action is not available for your account or for the current request status.
          </div>
        ) : null}

        {params?.error === "invalid-note" ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            Enter a handover note before saving.
          </div>
        ) : null}

        {!hasSchoolHolidayData ? (
          <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
            VIC school holiday dates are not configured for {selectedYear} yet. Default care,
            alternate weekends, birthdays, Easter, and Christmas are shown, but school holiday
            overrides may be incomplete.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <CareCalendar
            monthStart={monthStart}
            days={days}
            careBlocks={careBlocks}
            changeRequests={requests}
            handoverNotes={handoverNotes}
            view={view}
            selectedDay={selectedDay}
            baseQuery={baseQuery}
            isCurrentMonth={(day) => isSameMonth(day, monthStart)}
            parentLabels={parentLabels}
          />
          <aside className="flex flex-col gap-4">
            <div id="day-details" className="scroll-mt-4">
              <DayDetailPanel
                day={selectedDay}
                careBlocks={careBlocks}
                requests={requests}
                credits={credits}
                expenses={expenses}
                handoverNotes={handoverNotes}
                currentUserId={currentMember.userId}
                baseQuery={baseQuery}
                returnTo={returnTo}
                parentLabels={parentLabels}
              />
            </div>
            <CollapsiblePanel
              id="change-requests"
              title={editingRequest ? "Edit change request" : "Change requests"}
              summary={
                pendingRequestCount === 1
                  ? "1 pending"
                  : `${pendingRequestCount} pending`
              }
              defaultOpen={
                openPanel === "changeRequests" ||
                Boolean(editingRequest) ||
                pendingRequestCount > 0
              }
            >
              <ChangeRequestPanel
                key={`change-request-${editingRequest?.id ?? formDefaultDateKey}`}
                careBlocks={careBlocks}
                requests={requests}
                users={users}
                currentUserId={currentMember.userId}
                defaultDate={formDefaultDate}
                editingRequest={editingRequest}
                monthStart={monthStart}
                requestScope={requestScope}
                requestStatus={requestStatus}
                focusRequestId={params?.focusRequest ?? null}
                baseQuery={baseQuery}
                returnTo={`${returnTo}#change-requests`}
                parentLabels={parentLabels}
              />
            </CollapsiblePanel>
            <CollapsiblePanel
              title="Make-up balance"
              summary={`${openCreditCount} open`}
              defaultOpen={openCreditCount > 0}
            >
              <CareCreditPanel credits={credits} parentLabels={parentLabels} returnTo={returnTo} />
            </CollapsiblePanel>
            <CollapsiblePanel
              title="Expenses"
              summary={`$${(openExpenseCents / 100).toFixed(2)} open`}
              defaultOpen={openExpenseCents > 0}
            >
              <ExpensePanel
                expenses={expenses}
                users={users}
                currentUser={currentMember.user}
                defaultDate={formDefaultDate}
                expenseStatus={expenseStatus}
                returnTo={returnTo}
              />
            </CollapsiblePanel>
          </aside>
        </div>
      </div>
    </main>
  );
}

function CollapsiblePanel({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm marker:hidden">
        <span className="font-semibold text-slate-950">{title}</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {summary}
          <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

async function loadCalendarData(gridStart: Date, gridEnd: Date) {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const [family, children, careBlocks, members, requests, credits, expenses, handoverNotes] = await Promise.all([
      prisma.family.findUnique({ where: { id: DEMO_FAMILY_ID } }),
      prisma.child.findMany({ where: { familyId: DEMO_FAMILY_ID }, orderBy: { name: "asc" } }),
      prisma.careBlock.findMany({
        where: {
          familyId: DEMO_FAMILY_ID,
          source: "COURT_ORDER",
          startsAt: { lt: addDays(gridEnd, 1) },
          endsAt: { gt: gridStart },
        },
        orderBy: { startsAt: "asc" },
        include: { child: true },
      }),
      prisma.familyMember.findMany({
        where: { familyId: DEMO_FAMILY_ID },
        orderBy: { role: "asc" },
        include: { user: true },
      }),
      prisma.changeRequest.findMany({
        where: { familyId: DEMO_FAMILY_ID },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          requestedBy: true,
          respondedBy: true,
          careCredits: true,
          careBlock: { include: { child: true } },
        },
      }),
      prisma.careCredit.findMany({
        where: { familyId: DEMO_FAMILY_ID },
        orderBy: { createdAt: "desc" },
      }),
      prisma.expense.findMany({
        where: { familyId: DEMO_FAMILY_ID },
        orderBy: { incurredOn: "desc" },
        include: { paidBy: true },
      }),
      prisma.handoverNote.findMany({
        where: {
          familyId: DEMO_FAMILY_ID,
          noteDate: { gte: gridStart, lt: addDays(gridEnd, 1) },
        },
        orderBy: { createdAt: "desc" },
        include: { author: true },
      }),
    ]);

    return {
      family,
      children,
      careBlocks,
      members,
      requests,
      credits,
      expenses,
      handoverNotes,
      databaseAvailable: true,
    };
  } catch {
    const now = new Date();
    const child = {
      id: "demo-child",
      familyId: DEMO_FAMILY_ID,
      name: "Derick",
      createdAt: now,
      updatedAt: now,
    };
    const parentA = {
      id: "parent-a",
      email: "parent-a@example.com",
      name: "Hayden Lin",
      createdAt: now,
      updatedAt: now,
    };
    const parentB = {
      id: "parent-b",
      email: "parent-b@example.com",
      name: "Constance Xie",
      createdAt: now,
      updatedAt: now,
    };
    const members = [
      {
        id: "member-a",
        familyId: DEMO_FAMILY_ID,
        userId: parentA.id,
        role: "PARENT_A" as const,
        createdAt: now,
        updatedAt: now,
        user: parentA,
      },
      {
        id: "member-b",
        familyId: DEMO_FAMILY_ID,
        userId: parentB.id,
        role: "PARENT_B" as const,
        createdAt: now,
        updatedAt: now,
        user: parentB,
      },
    ];

    const careBlocks = generateCourtOrderCareBlocks2026()
      .filter((block) => block.startsAt < addDays(gridEnd, 1) && block.endsAt > gridStart)
      .map((block, index) => ({
        id: `generated-${index}`,
        familyId: DEMO_FAMILY_ID,
        childId: child.id,
        createdAt: now,
        updatedAt: now,
        child,
        source: "COURT_ORDER",
        ...block,
      }));

    return {
      family: {
        id: DEMO_FAMILY_ID,
        name: process.env.FAMILY_NAME?.trim() || "CoCare Family",
        createdAt: now,
        updatedAt: now,
      },
      children: [child],
      careBlocks,
      members,
      requests: [],
      credits: [],
      expenses: [],
      handoverNotes: [],
      databaseAvailable: false,
    };
  }
}
