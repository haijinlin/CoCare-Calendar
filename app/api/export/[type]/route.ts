import { NextRequest, NextResponse } from "next/server";
import { getCurrentFamilyMember } from "@/lib/auth";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(headers: string[], rows: unknown[][]) {
  return [headers.map(csvValue).join(","), ...rows.map((row) => row.map(csvValue).join(","))].join(
    "\n",
  );
}

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const currentMember = await getCurrentFamilyMember();

  if (!currentMember) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;

  if (type === "change-requests") {
    const requests = await prisma.changeRequest.findMany({
      where: { familyId: DEMO_FAMILY_ID },
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: true,
        respondedBy: true,
        careBlock: { include: { child: true } },
        careCredits: true,
      },
    });

    return csvResponse(
      "change-requests.csv",
      csv(
        [
          "createdAt",
          "status",
          "requestedBy",
          "respondedBy",
          "child",
          "originalParentRole",
          "proposedParentRole",
          "proposedStartsAt",
          "proposedEndsAt",
          "reason",
          "responseNote",
          "makeUpMinutes",
        ],
        requests.map((request) => [
          request.createdAt,
          request.status,
          request.requestedBy.name,
          request.respondedBy?.name,
          request.careBlock.child.name,
          request.careBlock.parentRole,
          request.proposedParentRole,
          request.proposedStartsAt,
          request.proposedEndsAt,
          request.reason,
          request.responseNote,
          request.careCredits.reduce((sum, credit) => sum + credit.minutes, 0),
        ]),
      ),
    );
  }

  if (type === "expenses") {
    const expenses = await prisma.expense.findMany({
      where: { familyId: DEMO_FAMILY_ID },
      orderBy: { incurredOn: "desc" },
      include: { paidBy: true },
    });

    return csvResponse(
      "expenses.csv",
      csv(
        ["incurredOn", "status", "title", "paidBy", "amount", "notes", "createdAt"],
        expenses.map((expense) => [
          expense.incurredOn,
          expense.status,
          expense.title,
          expense.paidBy.name,
          (expense.amountCents / 100).toFixed(2),
          expense.notes,
          expense.createdAt,
        ]),
      ),
    );
  }

  if (type === "audit-log") {
    const logs = await prisma.auditLog.findMany({
      where: { familyId: DEMO_FAMILY_ID },
      orderBy: { createdAt: "desc" },
      include: { actor: true },
    });

    return csvResponse(
      "audit-log.csv",
      csv(
        ["createdAt", "actor", "action", "entityType", "entityId", "summary"],
        logs.map((log) => [
          log.createdAt,
          log.actor.name,
          log.action,
          log.entityType,
          log.entityId,
          log.summary,
        ]),
      ),
    );
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
}
