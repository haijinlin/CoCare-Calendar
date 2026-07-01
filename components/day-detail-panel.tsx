import { CareBlock, CareCredit, ChangeRequest, Child, Expense, User } from "@prisma/client";
import { format, isSameDay } from "date-fns";
import { CalendarClock, Check, DollarSign, Pencil, Plus, RotateCcw, X } from "lucide-react";
import {
  acceptChangeRequest,
  cancelAcceptedChangeRequest,
  cancelCareCredit,
  declineChangeRequest,
  settleCareCredit,
  withdrawChangeRequest,
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ParentLabels } from "@/lib/parents";

type CareBlockWithChild = CareBlock & { child: Child };
type ChangeRequestWithDetails = ChangeRequest & {
  careBlock: CareBlockWithChild;
  requestedBy: User;
  respondedBy: User | null;
};
type ExpenseWithUser = Expense & { paidBy: User };

type DayDetailPanelProps = {
  day: Date | null;
  careBlocks: CareBlockWithChild[];
  requests: ChangeRequestWithDetails[];
  credits: CareCredit[];
  expenses: ExpenseWithUser[];
  currentUserId: string;
  baseQuery: string;
  returnTo: string;
  parentLabels: ParentLabels;
};

function overlapsDay(start: Date, end: Date, day: Date) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);

  return start < nextDay && end > dayStart;
}

function timeRange(start: Date, end: Date) {
  return `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
}

function formatMinutes(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);

  return parts.length > 0 ? parts.join(" ") : "0h";
}

function statusClass(status: ChangeRequest["status"]) {
  if (status === "ACCEPTED") return "bg-teal-50 text-teal-700";
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  if (status === "DECLINED") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function requestAuditLines(request: ChangeRequestWithDetails) {
  const lines = [`Requested by ${request.requestedBy.name} on ${format(request.createdAt, "d MMM yyyy h:mm a")}`];

  if (request.respondedBy) {
    const verb =
      request.status === "ACCEPTED"
        ? "Accepted"
        : request.status === "DECLINED"
          ? "Declined"
          : request.status === "CANCELLED"
            ? "Cancelled"
            : "Updated";

    lines.push(`${verb} by ${request.respondedBy.name} on ${format(request.updatedAt, "d MMM yyyy h:mm a")}`);
  } else if (request.status === "CANCELLED") {
    lines.push(`Cancelled on ${format(request.updatedAt, "d MMM yyyy h:mm a")}`);
  }

  return lines;
}

export function DayDetailPanel({
  day,
  careBlocks,
  requests,
  credits,
  expenses,
  currentUserId,
  baseQuery,
  returnTo,
  parentLabels,
}: DayDetailPanelProps) {
  if (!day) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <CalendarClock className="h-4 w-4" />
          Day details
        </div>
        <p className="mt-3 text-sm text-slate-500">Select a date to see schedule details.</p>
      </section>
    );
  }

  const blocksForDay = careBlocks.filter((block) => overlapsDay(block.startsAt, block.endsAt, day));
  const courtBlocks = blocksForDay.filter((block) => block.source !== "MANUAL");
  const manualBlocks = blocksForDay.filter((block) => block.source === "MANUAL");
  const requestsForDay = requests.filter(
    (request) =>
      overlapsDay(request.proposedStartsAt, request.proposedEndsAt, day) ||
      overlapsDay(request.careBlock.startsAt, request.careBlock.endsAt, day),
  );
  const requestIdsForDay = new Set(requestsForDay.map((request) => request.id));
  const creditsForDay = credits.filter(
    (credit) => credit.status === "OPEN" && credit.sourceRequestId && requestIdsForDay.has(credit.sourceRequestId),
  );
  const expensesForDay = expenses.filter((expense) => isSameDay(expense.incurredOn, day));
  const openExpenseTotal = expensesForDay
    .filter((expense) => expense.status === "OPEN")
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  const dayParam = format(day, "yyyy-MM-dd");

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <CalendarClock className="h-4 w-4" />
          {format(day, "EEEE d MMM yyyy")}
        </div>
        <a
          href={`/?${baseQuery}&day=${dayParam}&date=${dayParam}#care-block-form`}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Care
        </a>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500">Court order schedule</h3>
          <div className="mt-2 space-y-2">
            {courtBlocks.map((block) => (
              <div key={block.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                <div className="font-medium text-slate-950">{parentLabels[block.parentRole]}</div>
                <div className="text-slate-500">{timeRange(block.startsAt, block.endsAt)}</div>
                {block.handoverNote ? (
                  <div className="mt-1 text-slate-700">{block.handoverNote}</div>
                ) : null}
              </div>
            ))}
            {courtBlocks.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
                No court-order schedule.
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500">Care blocks</h3>
          <div className="mt-2 space-y-2">
            {manualBlocks.map((block) => (
              <a
                key={block.id}
                href={`/?${baseQuery}&day=${dayParam}&edit=${block.id}#care-block-form`}
                className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <div className="font-medium text-slate-950">{parentLabels[block.parentRole]}</div>
                <div className="text-slate-500">{timeRange(block.startsAt, block.endsAt)}</div>
                {block.handoverNote ? (
                  <div className="mt-1 text-slate-700">{block.handoverNote}</div>
                ) : null}
              </a>
            ))}
            {manualBlocks.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
                No manual care blocks.
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500">Change requests</h3>
          <div className="mt-2 space-y-2">
            {requestsForDay.map((request) => (
              <div key={request.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-950">
                    {parentLabels[request.proposedParentRole]}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(request.status)}`}>
                    {request.status.toLowerCase()}
                  </span>
                </div>
                <div className="mt-1 text-slate-500">
                  {format(request.proposedStartsAt, "d MMM h:mm a")} -{" "}
                  {format(request.proposedEndsAt, "d MMM h:mm a")}
                </div>
                {request.reason ? <div className="mt-1 text-slate-700">{request.reason}</div> : null}
                <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {requestAuditLines(request).map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
                {request.status === "PENDING" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {request.requestedById === currentUserId ? (
                      <a
                        href={`/?${baseQuery}&day=${dayParam}&editRequest=${request.id}#change-requests`}
                        className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </a>
                    ) : (
                      <div />
                    )}
                    {request.requestedById !== currentUserId ? (
                      <form action={acceptChangeRequest.bind(null, request.id)}>
                        <input type="hidden" name="returnTo" value={`${returnTo}#day-details`} />
                        <ConfirmSubmitButton
                          className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md bg-teal-700 px-2 text-xs font-medium text-white hover:bg-teal-800"
                          confirmMessage="Accept this change request? The calendar will show this agreed change."
                        >
                          <Check className="h-3.5 w-3.5" />
                          Accept
                        </ConfirmSubmitButton>
                      </form>
                    ) : (
                      <div />
                    )}
                    {request.requestedById !== currentUserId ? (
                      <form action={declineChangeRequest.bind(null, request.id)}>
                        <input type="hidden" name="returnTo" value={`${returnTo}#day-details`} />
                        <ConfirmSubmitButton
                          className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50"
                          confirmMessage="Decline this change request?"
                        >
                          <X className="h-3.5 w-3.5" />
                          Decline
                        </ConfirmSubmitButton>
                      </form>
                    ) : (
                      <div />
                    )}
                    {request.requestedById === currentUserId ? (
                      <form action={withdrawChangeRequest.bind(null, request.id)}>
                        <input type="hidden" name="returnTo" value={`${returnTo}#day-details`} />
                        <ConfirmSubmitButton
                          className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          confirmMessage="Withdraw this pending change request?"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Withdraw
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                ) : null}
                {request.status === "ACCEPTED" ? (
                  <form action={cancelAcceptedChangeRequest.bind(null, request.id)} className="mt-3">
                    <input type="hidden" name="returnTo" value={`${returnTo}#day-details`} />
                    <ConfirmSubmitButton
                      className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      confirmMessage="Cancel this accepted change? The calendar will fall back to the default rule unless another change applies."
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Cancel change
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </div>
            ))}
            {requestsForDay.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
                No change requests.
              </div>
            ) : null}
          </div>
        </div>

        {creditsForDay.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-500">Make-up balance</h3>
            <div className="mt-2 space-y-2">
              {creditsForDay.map((credit) => (
                <div key={credit.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div className="font-medium text-slate-950">
                    {parentLabels[credit.owedByRole]} owes {parentLabels[credit.owedToRole]}{" "}
                    {formatMinutes(credit.remainingMinutes)}
                  </div>
                  {credit.reason ? <div className="mt-1 text-slate-600">{credit.reason}</div> : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <form action={settleCareCredit.bind(null, credit.id)}>
                      <input type="hidden" name="returnTo" value={`${returnTo}#day-details`} />
                      <button className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-teal-200 px-2 text-xs font-medium text-teal-700 hover:bg-teal-50">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Settled
                      </button>
                    </form>
                    <form action={cancelCareCredit.bind(null, credit.id)}>
                      <input type="hidden" name="returnTo" value={`${returnTo}#day-details`} />
                      <button className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50">
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase text-slate-500">Expenses</h3>
            {expensesForDay.length > 0 ? (
              <div className="text-xs font-medium text-slate-500">
                ${(openExpenseTotal / 100).toFixed(2)} open
              </div>
            ) : null}
          </div>
          <div className="mt-2 space-y-2">
            {expensesForDay.map((expense) => (
              <div key={expense.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-950">{expense.title}</div>
                    <div className="text-slate-500">Paid by {expense.paidBy.name}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold text-slate-950">
                      ${(expense.amountCents / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">{expense.status.toLowerCase()}</div>
                  </div>
                </div>
                {expense.notes ? <div className="mt-1 text-slate-700">{expense.notes}</div> : null}
              </div>
            ))}
            {expensesForDay.length === 0 ? (
              <a
                href={`/?${baseQuery}&day=${dayParam}&date=${dayParam}#expenses`}
                className="flex items-center gap-2 rounded-md border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400 hover:bg-slate-50"
              >
                <DollarSign className="h-4 w-4" />
                No expenses for this day.
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
