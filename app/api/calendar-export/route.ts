import { addDays, isValid } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import {
  buildCalendarExportEvents,
  buildIcsCalendar,
  CalendarExportScope,
} from "@/lib/calendar-export";
import { getCurrentFamilyMember } from "@/lib/auth";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { fallbackParentLabels } from "@/lib/parents";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return isValid(parsed) ? parsed : fallback;
}

function parseScope(value: string | null): CalendarExportScope {
  if (value === "all" || value === "mine" || value === "parent-a" || value === "parent-b") {
    return value;
  }

  return "mine";
}

function filenamePart(value: string) {
  return value.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

export async function GET(request: NextRequest) {
  const currentMember = await getCurrentFamilyMember();

  if (!currentMember) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const searchParams = request.nextUrl.searchParams;
  const startsAt = parseDate(searchParams.get("from"), today);
  const endsAt = addDays(parseDate(searchParams.get("to"), addDays(today, 365)), 1);
  const scope = parseScope(searchParams.get("scope"));

  if (endsAt <= startsAt) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  const [members, careBlocks, acceptedRequests] = await Promise.all([
    prisma.familyMember.findMany({
      where: { familyId: DEMO_FAMILY_ID },
      include: { user: true },
    }),
    prisma.careBlock.findMany({
      where: {
        familyId: DEMO_FAMILY_ID,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      orderBy: { startsAt: "asc" },
      include: { child: true },
    }),
    prisma.changeRequest.findMany({
      where: {
        familyId: DEMO_FAMILY_ID,
        status: "ACCEPTED",
        proposedStartsAt: { lt: endsAt },
        proposedEndsAt: { gt: startsAt },
      },
      orderBy: { proposedStartsAt: "asc" },
      include: { careBlock: { include: { child: true } } },
    }),
  ]);

  const parentLabels = members.reduce(
    (labels, member) => ({
      ...labels,
      [member.role]: member.user.name,
    }),
    fallbackParentLabels,
  );
  const events = buildCalendarExportEvents({
    careBlocks,
    acceptedRequests,
    startsAt,
    endsAt,
    scope,
    currentRole: currentMember.role,
    parentLabels,
  });
  const ics = buildIcsCalendar(events);
  const from = request.nextUrl.searchParams.get("from") ?? "today";
  const to = request.nextUrl.searchParams.get("to") ?? "next-year";
  const filename = `cocare-${filenamePart(scope)}-${filenamePart(from)}-${filenamePart(to)}.ics`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
