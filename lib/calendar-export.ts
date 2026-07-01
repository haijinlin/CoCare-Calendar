import { CareBlock, ChangeRequest, Child, ParentRole } from "@prisma/client";
import { format } from "date-fns";
import { ParentLabels } from "@/lib/parents";

type CareBlockWithChild = CareBlock & { child: Child };
type AcceptedChangeRequest = ChangeRequest & {
  careBlock: CareBlockWithChild;
};

export type CalendarExportScope = "all" | "mine" | "parent-a" | "parent-b";

export type CalendarExportEvent = {
  id: string;
  parentRole: ParentRole;
  startsAt: Date;
  endsAt: Date;
  summary: string;
  description: string;
};

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function clampStart(value: Date, min: Date) {
  return value < min ? min : value;
}

function clampEnd(value: Date, max: Date) {
  return value > max ? max : value;
}

function roleMatchesScope(role: ParentRole, scope: CalendarExportScope, currentRole: ParentRole) {
  if (role === "BOTH") return scope === "all";
  if (scope === "all") return true;
  if (scope === "mine") return role === currentRole;
  if (scope === "parent-a") return role === "PARENT_A";
  if (scope === "parent-b") return role === "PARENT_B";
  return false;
}

function roleLabel(role: ParentRole, parentLabels: ParentLabels) {
  return parentLabels[role] ?? role;
}

function eventText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function eventDateTime(value: Date) {
  return format(value, "yyyyMMdd'T'HHmmss");
}

function foldLine(line: string) {
  const chunks = [];
  let remaining = line;

  while (remaining.length > 73) {
    chunks.push(remaining.slice(0, 73));
    remaining = ` ${remaining.slice(73)}`;
  }

  chunks.push(remaining);
  return chunks.join("\r\n");
}

function makeUid(prefix: string, id: string, startsAt: Date) {
  return `${prefix}-${id}-${format(startsAt, "yyyyMMddHHmmss")}@cocare.local`
    .toLowerCase()
    .replace(/[^a-z0-9@.-]/g, "-");
}

export function buildCalendarExportEvents({
  careBlocks,
  acceptedRequests,
  startsAt,
  endsAt,
  scope,
  currentRole,
  parentLabels,
}: {
  careBlocks: CareBlockWithChild[];
  acceptedRequests: AcceptedChangeRequest[];
  startsAt: Date;
  endsAt: Date;
  scope: CalendarExportScope;
  currentRole: ParentRole;
  parentLabels: ParentLabels;
}) {
  const events: CalendarExportEvent[] = [];

  for (const block of careBlocks) {
    let remainingSegments = [
      {
        startsAt: clampStart(block.startsAt, startsAt),
        endsAt: clampEnd(block.endsAt, endsAt),
      },
    ];

    for (const request of acceptedRequests) {
      if (!overlaps(block.startsAt, block.endsAt, request.proposedStartsAt, request.proposedEndsAt)) {
        continue;
      }

      remainingSegments = remainingSegments.flatMap((segment) => {
        if (!overlaps(segment.startsAt, segment.endsAt, request.proposedStartsAt, request.proposedEndsAt)) {
          return [segment];
        }

        const parts = [];
        if (segment.startsAt < request.proposedStartsAt) {
          parts.push({ startsAt: segment.startsAt, endsAt: request.proposedStartsAt });
        }
        if (segment.endsAt > request.proposedEndsAt) {
          parts.push({ startsAt: request.proposedEndsAt, endsAt: segment.endsAt });
        }
        return parts;
      });
    }

    for (const segment of remainingSegments) {
      if (
        segment.endsAt <= segment.startsAt ||
        !roleMatchesScope(block.parentRole, scope, currentRole)
      ) {
        continue;
      }

      const parentName = roleLabel(block.parentRole, parentLabels);
      const note = block.handoverNote ? `\n${block.handoverNote}` : "";
      events.push({
        id: makeUid("care", block.id, segment.startsAt),
        parentRole: block.parentRole,
        startsAt: segment.startsAt,
        endsAt: segment.endsAt,
        summary: `Derick with ${parentName}`,
        description: `CoCare schedule.${note}`,
      });
    }
  }

  for (const request of acceptedRequests) {
    const requestStartsAt = clampStart(request.proposedStartsAt, startsAt);
    const requestEndsAt = clampEnd(request.proposedEndsAt, endsAt);

    if (
      requestEndsAt <= requestStartsAt ||
      !roleMatchesScope(request.proposedParentRole, scope, currentRole)
    ) {
      continue;
    }

    const parentName = roleLabel(request.proposedParentRole, parentLabels);
    const reason = request.reason ? `\nNote: ${request.reason}` : "";
    events.push({
      id: makeUid("change", request.id, requestStartsAt),
      parentRole: request.proposedParentRole,
      startsAt: requestStartsAt,
      endsAt: requestEndsAt,
      summary: `Derick with ${parentName}`,
      description: `Changed by agreement in CoCare.${reason}`,
    });
  }

  return events.toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function buildIcsCalendar(events: CalendarExportEvent[]) {
  const now = eventDateTime(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CoCare//Derick Care Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}`,
      `DTSTAMP:${now}Z`,
      `DTSTART;TZID=Australia/Melbourne:${eventDateTime(event.startsAt)}`,
      `DTEND;TZID=Australia/Melbourne:${eventDateTime(event.endsAt)}`,
      `SUMMARY:${eventText(event.summary)}`,
      `DESCRIPTION:${eventText(event.description)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
