import { SpecialEvent, User } from "@prisma/client";
import { format, isSameMonth } from "date-fns";
import { Check, RotateCcw, Send, X } from "lucide-react";
import {
  acceptSpecialEvent,
  cancelSpecialEvent,
  createSpecialEvent,
  declineSpecialEvent,
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type SpecialEventWithUsers = SpecialEvent & {
  organizer: User;
  invitee: User;
  respondedBy: User | null;
};

type SpecialEventPanelProps = {
  events: SpecialEventWithUsers[];
  currentUserId: string;
  defaultDate?: Date | null;
  monthStart: Date;
  focusEventId?: string | null;
  returnTo: string;
};

function dateTimeLocal(value: Date) {
  return format(value, "yyyy-MM-dd'T'HH:mm");
}

function defaultEventRange(defaultDate: Date | null | undefined) {
  const start = defaultDate ? new Date(defaultDate) : new Date();
  start.setHours(16, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 2);

  return { start, end };
}

function statusClass(status: SpecialEvent["status"]) {
  if (status === "ACCEPTED") return "bg-teal-50 text-teal-700";
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  if (status === "DECLINED") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
}

export function SpecialEventPanel({
  events,
  currentUserId,
  defaultDate,
  monthStart,
  focusEventId,
  returnTo,
}: SpecialEventPanelProps) {
  const range = defaultEventRange(defaultDate);
  const visibleEvents = events.filter(
    (event) =>
      isSameMonth(event.startsAt, monthStart) ||
      isSameMonth(event.endsAt, monthStart) ||
      event.status === "PENDING",
  );

  return (
    <section id="special-events" className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">Special events</h2>
        <p className="mt-1 text-sm text-slate-500">
          Invite the other parent to join an activity. This does not change care time.
        </p>
      </div>

      <form action={createSpecialEvent} className="mt-4 space-y-3">
        <input type="hidden" name="returnTo" value={`${returnTo}#special-events`} />
        <label className="block">
          <span className="text-xs font-medium uppercase text-slate-500">Title</span>
          <input
            name="title"
            placeholder="School concert"
            className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            required
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">From</span>
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={dateTimeLocal(range.start)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Until</span>
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={dateTimeLocal(range.end)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              required
            />
          </label>
        </div>
        <input
          name="location"
          placeholder="Location"
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
        />
        <textarea
          name="notes"
          rows={3}
          placeholder="Details or invitation note"
          className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
          <Send className="h-4 w-4" />
          Send invitation
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {visibleEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            currentUserId={currentUserId}
            isFocused={event.id === focusEventId}
            returnTo={returnTo}
          />
        ))}
        {visibleEvents.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400">
            No special events for this view
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EventCard({
  event,
  currentUserId,
  isFocused,
  returnTo,
}: {
  event: SpecialEventWithUsers;
  currentUserId: string;
  isFocused: boolean;
  returnTo: string;
}) {
  const isInvitee = event.inviteeUserId === currentUserId;
  const canRespond = event.status === "PENDING" && isInvitee;
  const canCancel =
    (event.status === "PENDING" || event.status === "ACCEPTED") &&
    (event.organizerUserId === currentUserId || event.inviteeUserId === currentUserId);

  return (
    <div
      id={`event-${event.id}`}
      className={`scroll-mt-4 rounded-md border p-3 text-sm ${
        isFocused
          ? "border-violet-300 bg-violet-50 shadow-sm ring-2 ring-violet-200"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-950">{event.title}</div>
          <div className="mt-1 text-slate-500">
            {format(event.startsAt, "d MMM h:mm a")} - {format(event.endsAt, "d MMM h:mm a")}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${statusClass(event.status)}`}>
          {event.status.toLowerCase()}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Invited by {event.organizer.name} to {event.invitee.name}
      </div>
      {event.location ? <div className="mt-2 text-sm text-slate-700">{event.location}</div> : null}
      {event.notes ? <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{event.notes}</div> : null}
      {event.responseNote ? (
        <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Response note: {event.responseNote}
        </div>
      ) : null}

      {canRespond ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <form action={acceptSpecialEvent.bind(null, event.id)}>
            <input type="hidden" name="returnTo" value={`${returnTo}#special-events`} />
            <ConfirmSubmitButton
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
              confirmMessage="Accept this special event invitation?"
            >
              <Check className="h-4 w-4" />
              Accept
            </ConfirmSubmitButton>
          </form>
          <form action={declineSpecialEvent.bind(null, event.id)}>
            <input type="hidden" name="returnTo" value={`${returnTo}#special-events`} />
            <ConfirmSubmitButton
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
              confirmMessage="Decline this special event invitation?"
            >
              <X className="h-4 w-4" />
              Decline
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : null}

      {canCancel ? (
        <form action={cancelSpecialEvent.bind(null, event.id)} className="mt-3">
          <input type="hidden" name="returnTo" value={`${returnTo}#special-events`} />
          <ConfirmSubmitButton
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            confirmMessage="Cancel this special event?"
          >
            <RotateCcw className="h-4 w-4" />
            Cancel event
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </div>
  );
}
