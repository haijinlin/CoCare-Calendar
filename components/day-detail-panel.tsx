import { CareBlock, CareCredit, ChangeRequest, Child, Expense, HandoverNote, User } from "@prisma/client";
import { format, isSameDay } from "date-fns";
import { CalendarClock, Check, DollarSign, Pencil, Plus, RotateCcw, X } from "lucide-react";
import {
  acceptChangeRequest,
  cancelAcceptedChangeRequest,
  cancelCareCredit,
  createHandoverNote,
  deleteHandoverNote,
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
  careCredits?: CareCredit[];
};
type ExpenseWithUser = Expense & { paidBy: User };
type HandoverNoteWithAuthor = HandoverNote & { author: User };

type DayDetailPanelProps = {
  day: Date | null;
  careBlocks: CareBlockWithChild[];
  requests: ChangeRequestWithDetails[];
  credits: CareCredit[];
  expenses: ExpenseWithUser[];
  handoverNotes: HandoverNoteWithAuthor[];
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

function creditSummary(credits: CareCredit[] | undefined, parentLabels: ParentLabels) {
  const activeCredits = (credits ?? []).filter(
    (credit) => credit.status === "OPEN" || credit.status === "SETTLED",
  );

  if (activeCredits.length === 0) return null;

  return activeCredits
    .map(
      (credit) =>
        `${parentLabels[credit.owedByRole]} owes ${parentLabels[credit.owedToRole]} ${formatMinutes(
          credit.remainingMinutes,
        )}${credit.status === "SETTLED" ? " (settled)" : ""}`,
    )
    .join("; ");
}

function blockPriority(block: CareBlockWithChild) {
  const note = block.handoverNote ?? "";

  if (note.includes("pickup") || note.includes("Pickup")) return 5;
  if (note.includes("birthday")) return 4;
  if (note.includes("holiday")) return 3;
  if (note.includes("Return")) return 2;
  return 1;
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
  handoverNotes,
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
  const courtBlocks = blocksForDay.filter((block) => block.source === "COURT_ORDER");
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
  const notesForDay = handoverNotes.filter((note) => isSameDay(note.noteDate, day));
  const openExpenseTotal = expensesForDay
    .filter((expense) => expense.status === "OPEN")
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  const dayParam = format(day, "yyyy-MM-dd");
  const acceptedRequestForDay = requestsForDay.find((request) => request.status === "ACCEPTED");
  const pendingRequestsForDay = requestsForDay.filter((request) => request.status === "PENDING");
  const headlineBlock = courtBlocks.toSorted((a, b) => blockPriority(b) - blockPriority(a))[0];
  const headlineCare = acceptedRequestForDay
    ? `${parentLabels[acceptedRequestForDay.proposedParentRole]} by accepted change`
    : headlineBlock
      ? parentLabels[headlineBlock.parentRole]
      : "No scheduled care";
  const headlineTime = acceptedRequestForDay
    ? timeRange(acceptedRequestForDay.proposedStartsAt, acceptedRequestForDay.proposedEndsAt)
    : headlineBlock
      ? timeRange(headlineBlock.startsAt, headlineBlock.endsAt)
      : null;
  const headlineNote = acceptedRequestForDay?.reason ?? headlineBlock?.handoverNote ?? null;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <CalendarClock className="h-4 w-4" />
          {format(day, "EEEE d MMM yyyy")}
        </div>
        <a
          href={`/?${baseQuery}&day=${dayParam}&date=${dayParam}&open=changeRequests#change-requests`}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Request change
        </a>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Today summary</div>
          <div className="mt-2 text-sm font-semibold text-slate-950">{headlineCare}</div>
          {headlineTime ? <div className="mt-1 text-sm text-slate-600">{headlineTime}</div> : null}
          {headlineNote ? <div className="mt-1 text-sm text-slate-700">{headlineNote}</div> : null}
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md bg-white px-2 py-2 text-slate-600">
              <div className="font-semibold text-slate-950">{pendingRequestsForDay.length}</div>
              pending
            </div>
            <div className="rounded-md bg-white px-2 py-2 text-slate-600">
              <div className="font-semibold text-slate-950">{notesForDay.length}</div>
              notes
            </div>
            <div className="rounded-md bg-white px-2 py-2 text-slate-600">
              <div className="font-semibold text-slate-950">{creditsForDay.length}</div>
              make-up
            </div>
          </div>
        </div>

        <div id="handover-notes">
          <h3 className="text-xs font-semibold uppercase text-slate-500">Handover notes</h3>
          <form action={createHandoverNote} className="mt-2 space-y-2">
            <input type="hidden" name="noteDate" value={dayParam} />
            <input type="hidden" name="returnTo" value={`${returnTo}#handover-notes`} />
            <textarea
              name="text"
              rows={3}
              placeholder="Add pickup details, clothes, medication, travel notes, or other handover reminders."
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500"
              required
            />
            <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="notifyOtherParent"
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Notify the other parent by email.
                <span className="block text-xs text-slate-500">
                  Email is only a prompt; replies should stay in CoCare.
                </span>
              </span>
            </label>
            <button className="inline-flex h-9 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800">
              Add note
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {notesForDay.map((note) => (
              <div key={note.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div className="whitespace-pre-wrap text-slate-900">{note.text}</div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-amber-900">
                  <span>
                    {note.author.name} - {format(note.createdAt, "d MMM h:mm a")}
                  </span>
                  {note.authorUserId === currentUserId ? (
                    <form action={deleteHandoverNote.bind(null, note.id)}>
                      <input type="hidden" name="returnTo" value={`${returnTo}#handover-notes`} />
                      <ConfirmSubmitButton
                        className="inline-flex h-7 items-center justify-center rounded-md border border-amber-300 px-2 font-medium text-amber-950 hover:bg-amber-100"
                        confirmMessage="Delete this handover note?"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
            {notesForDay.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
                No handover notes.
              </div>
            ) : null}
          </div>
        </div>

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
                {creditSummary(request.careCredits, parentLabels) ? (
                  <div className="mt-2 rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800">
                    Make-up: {creditSummary(request.careCredits, parentLabels)}
                  </div>
                ) : null}
                <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {requestAuditLines(request).map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
                {request.status === "PENDING" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {request.requestedById === currentUserId ? (
                      <a
                        href={`/?${baseQuery}&day=${dayParam}&editRequest=${request.id}&open=changeRequests#change-requests`}
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
