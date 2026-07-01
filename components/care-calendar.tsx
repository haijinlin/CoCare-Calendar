import { CareBlock, ChangeRequest, Child, HandoverNote } from "@prisma/client";
import { addDays, format, startOfDay } from "date-fns";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { ParentLabels } from "@/lib/parents";

type CalendarCareBlock = CareBlock & {
  child: Child;
};

type CalendarChangeRequest = ChangeRequest & {
  careBlock: CalendarCareBlock;
};

type CalendarHandoverNote = HandoverNote;

type CalendarDisplay = {
  parentRole: CalendarCareBlock["parentRole"];
  source: CalendarCareBlock["source"];
  note: string | null;
  isPickupDay: boolean;
  isPublicHoliday: boolean;
  changedByAgreement: boolean;
  pickupTime?: Date;
};

type CareCalendarProps = {
  monthStart: Date;
  days: Date[];
  careBlocks: CalendarCareBlock[];
  changeRequests: CalendarChangeRequest[];
  handoverNotes: CalendarHandoverNote[];
  view: "month" | "week";
  selectedDay: Date | null;
  baseQuery: string;
  isCurrentMonth: (day: Date) => boolean;
  parentLabels: ParentLabels;
};

const parentStyles = {
  PARENT_A: "border-blue-200 bg-blue-50 text-blue-950",
  PARENT_B: "border-rose-200 bg-rose-50 text-rose-950",
  BOTH: "border-amber-200 bg-amber-50 text-amber-950",
};

const pickupStyle = "border-emerald-200 bg-emerald-50 text-emerald-950";
const publicHolidayStyle = "border-violet-200 bg-violet-50 text-violet-950";

function blockScore(block: CalendarCareBlock) {
  const note = block.handoverNote ?? "";

  if (block.parentRole === "BOTH") return 100;
  if (note.includes("birthday")) return 90;
  if (note.includes("Christmas") || note.includes("Easter")) return 80;
  if (note.includes("pickup from school") || isMorningHaydenPickup(block)) return 70;
  if (note.includes("Return to Constance")) return 65;
  if (note.includes("public holiday")) return 60;
  if (note.includes("School holiday")) return 50;
  return 10;
}

function shortName(label: string) {
  return label.split(" ")[0] ?? label;
}

function isMorningHaydenPickup(block: Pick<CalendarCareBlock, "parentRole" | "startsAt" | "handoverNote">) {
  const note = block.handoverNote ?? "";

  return (
    block.parentRole === "PARENT_A" &&
    block.startsAt.getHours() === 9 &&
    block.startsAt.getMinutes() === 30 &&
    (note.includes("School holiday") ||
      note.includes("public holiday") ||
      note.includes("Father's Day") ||
      note.includes("Hayden birthday") ||
      note.includes("Easter") ||
      note.includes("Christmas"))
  );
}

function describeDisplay(display: CalendarDisplay, parentLabels: ParentLabels) {
  const note = display.note ?? "";
  const name = shortName(parentLabels[display.parentRole]);

  if (display.changedByAgreement) {
    if (display.isPickupDay) {
      return `Pickup ${format(display.pickupTime ?? new Date(), "h:mm a")} (${name})`;
    }
    if (note.includes("birthday")) return `Changed by agreement - ${note} (${name})`;
    if (note.includes("School holiday first")) {
      return `Changed by agreement - school holiday first half (${name})`;
    }
    if (note.includes("School holiday second")) {
      return `Changed by agreement - school holiday second half (${name})`;
    }
    return `Changed by agreement (${name})`;
  }

  if (note.includes("pickup from school")) return `Pickup 3:30 PM (${name})`;
  if (display.isPickupDay) {
    return `${note.replace(" public holiday", "")} pickup ${format(display.pickupTime ?? new Date(), "h:mm a")} (${name})`;
  }
  if (note.includes("Return to Constance")) return `${name} until 8 PM`;
  if (note.includes("birthday")) return `${note} (${name})`;
  if (note.includes("Christmas")) return `Christmas (${name})`;
  if (note.includes("Easter")) return `Easter (${name})`;
  if (note.includes("public holiday")) return `${note.replace(" public holiday", "")} (${name})`;
  if (note.includes("School holiday first")) return `School holiday first half (${name})`;
  if (note.includes("School holiday second")) return `School holiday second half (${name})`;
  return name;
}

function careMarkerTitle(blocks: CalendarCareBlock[]) {
  return blocks
    .map((block) => {
      const note = block.handoverNote ? ` - ${block.handoverNote}` : "";
      return `${format(block.startsAt, "h:mm a")} to ${format(block.endsAt, "h:mm a")}${note}`;
    })
    .join("\n");
}

function buildDisplay(
  displayBlock: CalendarCareBlock | undefined,
  acceptedRequest: CalendarChangeRequest | undefined,
  dayStart: Date,
  nextDayStart: Date,
): CalendarDisplay | null {
  if (!displayBlock && !acceptedRequest) return null;

  const acceptedCoversDay =
    acceptedRequest &&
    acceptedRequest.proposedStartsAt < nextDayStart &&
    acceptedRequest.proposedEndsAt > dayStart;

  if (acceptedRequest && acceptedCoversDay) {
    const startsDuringDay =
      acceptedRequest.proposedStartsAt > dayStart && acceptedRequest.proposedStartsAt < nextDayStart;
    const originalNote = displayBlock?.handoverNote ?? "";

    return {
      parentRole: acceptedRequest.proposedParentRole,
      source: "MANUAL",
      note: originalNote || acceptedRequest.reason,
      isPickupDay: startsDuringDay,
      isPublicHoliday: originalNote.includes("public holiday"),
      changedByAgreement: true,
      pickupTime: acceptedRequest.proposedStartsAt,
    };
  }

  if (!displayBlock) return null;

  const blockStartsDuringDay =
    displayBlock.startsAt > dayStart && displayBlock.startsAt < nextDayStart;

  return {
    parentRole: displayBlock.parentRole,
    source: displayBlock.source,
    note: displayBlock.handoverNote,
    isPickupDay:
      blockStartsDuringDay &&
      (displayBlock.handoverNote?.includes("pickup from school") ||
        isMorningHaydenPickup(displayBlock)),
    isPublicHoliday: displayBlock.handoverNote?.includes("public holiday") ?? false,
    changedByAgreement: false,
    pickupTime: displayBlock.startsAt,
  };
}

export function CareCalendar({
  monthStart,
  days,
  careBlocks,
  changeRequests,
  handoverNotes,
  view,
  selectedDay,
  baseQuery,
  isCurrentMonth,
  parentLabels,
}: CareCalendarProps) {
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {weekDays.map((day) => (
          <div key={day} className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayStart = startOfDay(day);
          const nextDayStart = addDays(dayStart, 1);
          const dayKey = format(day, "yyyy-MM-dd");
          const selectedDayKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
          const blocksForDay = careBlocks.filter((block) =>
            block.startsAt < nextDayStart && block.endsAt > dayStart,
          );
          const manualBlocksForDay = blocksForDay.filter((block) => block.source === "MANUAL");
          const notesForDay = handoverNotes.filter((note) =>
            note.noteDate >= dayStart && note.noteDate < nextDayStart,
          );
          const requestsForDay = changeRequests.filter(
            (request) =>
              (request.careBlock.startsAt < nextDayStart && request.careBlock.endsAt > dayStart) ||
              (request.proposedStartsAt < nextDayStart && request.proposedEndsAt > dayStart),
          );
          const pendingRequest = requestsForDay.find((request) => request.status === "PENDING");
          const acceptedRequest = requestsForDay.find((request) => request.status === "ACCEPTED");
          const displayBlock = blocksForDay
            .filter((block) => block.source === "COURT_ORDER")
            .toSorted((a, b) => blockScore(b) - blockScore(a))[0];
          const calendarMarker = pendingRequest ?? acceptedRequest;
          const display = buildDisplay(displayBlock, acceptedRequest, dayStart, nextDayStart);
          const isTodayDate = dayKey === format(new Date(), "yyyy-MM-dd");
          const dayStyle = display
            ? display.isPickupDay
              ? pickupStyle
              : display.isPublicHoliday
                ? publicHolidayStyle
                : parentStyles[display.parentRole]
            : "border-slate-200 bg-white text-slate-900";

          return (
            <div
              key={day.toISOString()}
              className={clsx(
                "relative flex flex-col border-b border-r p-1.5 last:border-r-0 sm:p-2",
                view === "week" ? "min-h-56 sm:min-h-72" : "min-h-32 sm:min-h-36",
                dayStyle,
                isTodayDate && "ring-2 ring-amber-400 ring-inset",
                selectedDayKey === dayKey && "ring-2 ring-slate-950 ring-inset",
                !isCurrentMonth(day) && "opacity-45",
              )}
            >
              <a
                href={`/?${baseQuery}&day=${dayKey}&date=${dayKey}#day-details`}
                className="absolute inset-0 z-0 sm:hidden"
                aria-label={`View details for ${format(day, "d MMM yyyy")}`}
              />
              <div className="mb-2 flex items-center justify-between">
                <a
                  href={`/?${baseQuery}&day=${dayKey}&date=${dayKey}#day-details`}
                  className={clsx(
                    "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold hover:bg-white/70",
                    isTodayDate && "bg-amber-300 text-slate-950 shadow-sm",
                    format(day, "yyyy-MM") === format(monthStart, "yyyy-MM") ? "" : "text-slate-400",
                  )}
                  title="View day details"
                >
                  {format(day, "d")}
                </a>
              </div>

              <div className="min-h-0 flex-1 pb-8">
                {display ? (
                  <div>
                    <div className="text-[11px] font-medium leading-4 opacity-85 sm:text-xs sm:leading-5">
                      {describeDisplay(display, parentLabels)}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">No schedule</div>
                )}
              </div>

              <div className="absolute inset-x-1.5 bottom-1.5 flex min-h-7 items-end justify-between gap-1 sm:inset-x-2 sm:bottom-2">
                <div className="flex min-w-0 max-w-full flex-col items-start gap-1 sm:max-w-[calc(100%-2.25rem)]">
                  {calendarMarker ? (
                    <a
                      href="#change-requests"
                      title={
                        calendarMarker.reason ??
                        `${calendarMarker.status.toLowerCase()} change request`
                      }
                      className={clsx(
                        "relative z-10 inline-flex h-6 max-w-full items-center rounded-full px-2 text-[10px] font-semibold shadow-sm ring-1 ring-black/5 sm:text-[11px]",
                        calendarMarker.status === "PENDING"
                          ? "bg-white text-slate-900"
                          : "bg-slate-900 text-white",
                      )}
                    >
                      <span className="truncate">
                        {calendarMarker.status === "PENDING" ? "Request" : "Changed"}
                      </span>
                    </a>
                  ) : null}
                  {manualBlocksForDay.length > 0 ? (
                    <a
                      href={
                        manualBlocksForDay.length === 1
                          ? `/?month=${format(monthStart, "yyyy-MM")}&edit=${manualBlocksForDay[0].id}#care-block-panel`
                          : `/?${baseQuery}&day=${dayKey}#day-details`
                      }
                      title={careMarkerTitle(manualBlocksForDay)}
                      className="relative z-10 inline-flex h-6 max-w-full items-center rounded-full bg-white px-2 text-[10px] font-semibold text-slate-900 shadow-sm ring-1 ring-black/5 sm:text-[11px]"
                    >
                      <span className="truncate">
                        Manual{manualBlocksForDay.length > 1 ? ` ${manualBlocksForDay.length}` : ""}
                      </span>
                    </a>
                  ) : null}
                  {notesForDay.length > 0 ? (
                    <a
                      href={`/?${baseQuery}&day=${dayKey}&date=${dayKey}#handover-notes`}
                      title={`${notesForDay.length} handover note${notesForDay.length === 1 ? "" : "s"}`}
                      className="relative z-10 inline-flex h-6 max-w-full items-center rounded-full bg-amber-100 px-2 text-[10px] font-semibold text-amber-900 shadow-sm ring-1 ring-amber-200 sm:text-[11px]"
                    >
                      <span className="truncate">
                        Note{notesForDay.length > 1 ? ` ${notesForDay.length}` : ""}
                      </span>
                    </a>
                  ) : null}
                </div>
                <a
                  href={`/?${baseQuery}&day=${dayKey}&date=${dayKey}#change-requests`}
                  className="relative z-10 hidden h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/80 text-slate-700 shadow-sm ring-1 ring-black/5 hover:bg-white sm:inline-flex"
                  title="Request change"
                >
                  <Plus className="h-4 w-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
