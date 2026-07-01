import { CareBlock, CareCredit, ChangeRequest, Child, User } from "@prisma/client";
import { addDays, endOfDay, format, isSameMonth, setHours, setMinutes, startOfDay } from "date-fns";
import { Check, Pencil, RotateCcw, Save, Send, X } from "lucide-react";
import {
  acceptChangeRequest,
  cancelAcceptedChangeRequest,
  createChangeRequest,
  declineChangeRequest,
  updateChangeRequest,
  withdrawChangeRequest,
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PersonBadge } from "@/components/person-badge";
import { ParentLabels } from "@/lib/parents";

type CareBlockWithChild = CareBlock & { child: Child };
type ChangeRequestWithUsers = ChangeRequest & {
  careBlock: CareBlockWithChild;
  requestedBy: User;
  respondedBy: User | null;
  careCredits?: CareCredit[];
};

type ChangeRequestPanelProps = {
  careBlocks: CareBlockWithChild[];
  requests: ChangeRequestWithUsers[];
  users: User[];
  currentUserId: string;
  defaultDate?: Date | null;
  editingRequest?: ChangeRequestWithUsers | null;
  monthStart: Date;
  requestScope: "day" | "month" | "all";
  requestStatus: "pending" | "accepted" | "all";
  baseQuery: string;
  returnTo: string;
  parentLabels: ParentLabels;
};

function dateTimeLocal(value: Date) {
  return format(value, "yyyy-MM-dd'T'HH:mm");
}

function getDefaultRequestRange(defaultDate: Date | null | undefined, careBlock: CareBlockWithChild | null) {
  if (!defaultDate) {
    return {
      start: setHours(new Date(), 15),
      end: setHours(addDays(new Date(), 2), 20),
    };
  }

  if (!careBlock) {
    return {
      start: setMinutes(setHours(defaultDate, 14), 30),
      end: setHours(addDays(defaultDate, 2), 20),
    };
  }

  const dayStart = startOfDay(defaultDate);
  const dayEnd = endOfDay(defaultDate);
  const startsOnSelectedDay = careBlock.startsAt >= dayStart && careBlock.startsAt <= dayEnd;

  return {
    start: startsOnSelectedDay ? careBlock.startsAt : dayStart,
    end: startsOnSelectedDay ? careBlock.endsAt : dayEnd,
  };
}

function getDefaultMakeUp(
  careBlock: CareBlockWithChild | null,
  proposedParentRole: CareBlock["parentRole"],
  start: Date,
  end: Date,
) {
  if (
    !careBlock ||
    proposedParentRole === "BOTH" ||
    careBlock.parentRole === "BOTH" ||
    careBlock.parentRole === proposedParentRole
  ) {
    return {
      owedByRole: "",
      owedToRole: "",
      days: "",
      hours: "",
      description: null,
    };
  }

  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);

  return {
    owedByRole: proposedParentRole,
    owedToRole: careBlock.parentRole,
    days: days > 0 ? String(days) : "",
    hours: hours > 0 ? String(hours) : "",
    description: `${proposedParentRole} receives ${formatMinutes(minutes)} that was originally ${careBlock.parentRole}.`,
  };
}

function formatMinutes(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);

  return parts.length > 0 ? parts.join(" ") : "0h";
}

function requestAuditLines(request: ChangeRequestWithUsers) {
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

export function ChangeRequestPanel({
  careBlocks,
  requests,
  users,
  currentUserId,
  defaultDate,
  editingRequest,
  monthStart,
  requestScope,
  requestStatus,
  baseQuery,
  returnTo,
  parentLabels,
}: ChangeRequestPanelProps) {
  const currentUser = users.find((user) => user.id === currentUserId);
  const defaultCareBlock = defaultDate
    ? (careBlocks.find((block) => block.source !== "MANUAL" && overlapsDay(block.startsAt, block.endsAt, defaultDate)) ?? null)
    : null;
  const defaultRange = getDefaultRequestRange(defaultDate, defaultCareBlock);
  const defaultParentRole =
    defaultCareBlock?.parentRole === "PARENT_A"
      ? "PARENT_B"
      : defaultCareBlock?.parentRole === "PARENT_B"
        ? "PARENT_A"
        : "PARENT_A";
  const defaultMakeUp = getDefaultMakeUp(
    defaultCareBlock,
    editingRequest?.proposedParentRole ?? defaultParentRole,
    editingRequest?.proposedStartsAt ?? defaultRange.start,
    editingRequest?.proposedEndsAt ?? defaultRange.end,
  );
  const editingCredit = editingRequest?.careCredits?.find((credit) => credit.status === "OPEN");
  const creditDays = editingCredit
    ? Math.floor(editingCredit.remainingMinutes / 1440)
    : defaultMakeUp.days;
  const creditHours = editingCredit
    ? Math.round((editingCredit.remainingMinutes % 1440) / 60)
    : defaultMakeUp.hours;
  const action = editingRequest
    ? updateChangeRequest.bind(null, editingRequest.id)
    : createChangeRequest;
  const scopedRequests = requests.filter((request) => {
    if (requestScope === "all") return true;
    if (requestScope === "day") {
      return defaultDate
        ? overlapsDay(request.proposedStartsAt, request.proposedEndsAt, defaultDate) ||
            overlapsDay(request.careBlock.startsAt, request.careBlock.endsAt, defaultDate)
        : false;
    }

    return (
      isSameMonth(request.proposedStartsAt, monthStart) ||
      isSameMonth(request.proposedEndsAt, monthStart) ||
      isSameMonth(request.careBlock.startsAt, monthStart) ||
      isSameMonth(request.careBlock.endsAt, monthStart)
    );
  });
  const visibleRequests = scopedRequests.filter((request) => {
    if (requestStatus === "pending") return request.status === "PENDING";
    if (requestStatus === "accepted") return request.status === "ACCEPTED";
    return true;
  });
  const selectedDateQuery = defaultDate
    ? `&day=${format(defaultDate, "yyyy-MM-dd")}&date=${format(defaultDate, "yyyy-MM-dd")}`
    : "";
  const requestHref = (
    nextStatus: typeof requestStatus = requestStatus,
    nextScope: typeof requestScope = requestScope,
  ) => `/?${baseQuery}${selectedDateQuery}&requests=${nextScope}&requestStatus=${nextStatus}#change-requests`;
  const statusLinks = [
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "all", label: "All" },
  ] as const;
  const scopeLinks = [
    { value: "day", label: "Day", disabled: !defaultDate },
    { value: "month", label: "Month", disabled: false },
    { value: "all", label: "All", disabled: false },
  ] as const;

  return (
    <section id="change-requests" className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            {editingRequest ? "Edit change request" : "Change requests"}
          </h2>
          {editingRequest ? (
            <p className="mt-1 text-sm text-slate-500">Only pending requests can be edited.</p>
          ) : defaultDate ? (
            <p className="mt-1 text-sm text-slate-500">
              New requests will start from {format(defaultDate, "d MMM yyyy")}.
            </p>
          ) : null}
        </div>
        {editingRequest ? (
          <a
            href={`/?${baseQuery}#change-requests`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Cancel edit"
          >
            <X className="h-4 w-4" />
          </a>
        ) : null}
      </div>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Requested by</span>
            <div className="mt-1 flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              {editingRequest?.requestedBy.name ?? currentUser?.name ?? "Current parent"}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Care with</span>
            <select
              name="proposedParentRole"
              defaultValue={editingRequest?.proposedParentRole ?? defaultParentRole}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              required
            >
              <option value="PARENT_A">{parentLabels.PARENT_A}</option>
              <option value="PARENT_B">{parentLabels.PARENT_B}</option>
              <option value="BOTH">Both parents</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">From</span>
            <input
              name="proposedStartsAt"
              type="datetime-local"
              defaultValue={dateTimeLocal(editingRequest?.proposedStartsAt ?? defaultRange.start)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Until</span>
            <input
              name="proposedEndsAt"
              type="datetime-local"
              defaultValue={dateTimeLocal(editingRequest?.proposedEndsAt ?? defaultRange.end)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              required
            />
          </label>
        </div>

        <textarea
          name="reason"
          defaultValue={editingRequest?.reason ?? ""}
          rows={3}
          placeholder="Reason"
          className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />

        <div className="rounded-md border border-slate-200 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Make-up balance</div>
          {!editingRequest && defaultMakeUp.description ? (
            <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Suggested automatically. You can change it before submitting.
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase text-slate-500">Owed by</span>
              <select
                name="creditOwedByRole"
                defaultValue={editingCredit?.owedByRole ?? defaultMakeUp.owedByRole}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="">No balance</option>
                <option value="PARENT_A">{parentLabels.PARENT_A}</option>
                <option value="PARENT_B">{parentLabels.PARENT_B}</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase text-slate-500">Owed to</span>
              <select
                name="creditOwedToRole"
                defaultValue={editingCredit?.owedToRole ?? defaultMakeUp.owedToRole}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="">No balance</option>
                <option value="PARENT_A">{parentLabels.PARENT_A}</option>
                <option value="PARENT_B">{parentLabels.PARENT_B}</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              name="creditDays"
              type="number"
              min="0"
              step="0.5"
              placeholder="Days"
              defaultValue={creditDays}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            />
            <input
              name="creditHours"
              type="number"
              min="0"
              step="0.5"
              placeholder="Hours"
              defaultValue={creditHours}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          {editingRequest ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {editingRequest ? "Save request" : "Request change"}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase text-slate-500">Requests</h3>
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
              {statusLinks.map((status) => (
                <a
                  key={status.value}
                  href={requestHref(status.value)}
                  className={`inline-flex h-7 items-center rounded px-2 text-xs font-medium ${
                    requestStatus === status.value
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {status.label}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">{visibleRequests.length} shown</div>
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
              {scopeLinks.map((scope) =>
                scope.disabled ? (
                  <span
                    key={scope.value}
                    className="inline-flex h-7 items-center rounded px-2 text-xs font-medium text-slate-300"
                  >
                    {scope.label}
                  </span>
                ) : (
                  <a
                    key={scope.value}
                    href={requestHref(requestStatus, scope.value)}
                    className={`inline-flex h-7 items-center rounded px-2 text-xs font-medium ${
                      requestScope === scope.value
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {scope.label}
                  </a>
                ),
              )}
            </div>
          </div>
        </div>

        {visibleRequests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            currentUserId={currentUserId}
            baseQuery={baseQuery}
            returnTo={returnTo}
            parentLabels={parentLabels}
          />
        ))}
        {visibleRequests.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400">
            No {requestStatus === "all" ? "" : `${requestStatus} `}requests in this view
          </div>
        ) : null}
      </div>
    </section>
  );
}

function overlapsDay(start: Date, end: Date, day: Date) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);

  return start < nextDay && end > dayStart;
}

function RequestCard({
  request,
  currentUserId,
  baseQuery,
  returnTo,
  parentLabels,
}: {
  request: ChangeRequestWithUsers;
  currentUserId: string;
  baseQuery: string;
  returnTo: string;
  parentLabels: ParentLabels;
}) {
  const isRequester = request.requestedById === currentUserId;
  const canRespond = request.status === "PENDING" && !isRequester;
  const canWithdraw = request.status === "PENDING" && isRequester;
  const canEdit = request.status === "PENDING" && isRequester;
  const auditLines = requestAuditLines(request);

  return (
    <div className="rounded-md border border-slate-200 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-slate-950">
          <PersonBadge
            name={parentLabels[request.proposedParentRole]}
            kind={
              request.proposedParentRole === "PARENT_A"
                ? "dad"
                : request.proposedParentRole === "PARENT_B"
                  ? "mum"
                  : "child"
            }
            compact
          />
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {request.status.toLowerCase()}
        </span>
      </div>
      <div className="mt-1 text-slate-500">
        {format(request.proposedStartsAt, "d MMM h:mm a")} -{" "}
        {format(request.proposedEndsAt, "d MMM h:mm a")}
      </div>
      {request.reason ? <div className="mt-2 text-slate-700">{request.reason}</div> : null}
      <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {auditLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>

      {request.status === "PENDING" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {canEdit ? (
            <a
              href={`/?${baseQuery}&editRequest=${request.id}#change-requests`}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </a>
          ) : (
            <div />
          )}
          {canRespond ? (
            <form action={acceptChangeRequest.bind(null, request.id)}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <ConfirmSubmitButton
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                confirmMessage="Accept this change request? The calendar will show this agreed change."
              >
                <Check className="h-4 w-4" />
                Accept
              </ConfirmSubmitButton>
            </form>
          ) : (
            <div />
          )}
          {canRespond ? (
            <form action={declineChangeRequest.bind(null, request.id)}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <ConfirmSubmitButton
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                confirmMessage="Decline this change request?"
              >
                <X className="h-4 w-4" />
                Decline
              </ConfirmSubmitButton>
            </form>
          ) : (
            <div />
          )}
          {canWithdraw ? (
            <form action={withdrawChangeRequest.bind(null, request.id)}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <ConfirmSubmitButton
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                confirmMessage="Withdraw this pending change request?"
              >
                <RotateCcw className="h-4 w-4" />
                Withdraw
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
      ) : null}

      {request.status === "ACCEPTED" ? (
        <form action={cancelAcceptedChangeRequest.bind(null, request.id)} className="mt-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <ConfirmSubmitButton
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            confirmMessage="Cancel this accepted change? The calendar will fall back to the default rule unless another change applies."
          >
            <RotateCcw className="h-4 w-4" />
            Cancel change
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </div>
  );
}
