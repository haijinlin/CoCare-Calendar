"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  careCreditSchema,
  changeRequestSchema,
  careBlockSchema,
  expenseSchema,
  publicHolidayRuleSchema,
  schoolHolidayPeriodSchema,
  specialEventSchema,
} from "@/lib/care-blocks";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { requireCurrentFamilyMember } from "@/lib/auth";
import {
  calendarUrl,
  notificationEmailForRole,
  sendNotificationEmail,
} from "@/lib/email-notifications";
import { prisma } from "@/lib/prisma";
import { generateCourtOrderCareBlocks2026 } from "@/lib/court-order-schedule";
import { fetchOfficialVicSchoolHolidays } from "@/lib/official-vic-school-terms";
import {
  assignPublicHolidayRotation,
  generateStandardVicPublicHolidays,
} from "@/lib/vic-public-holidays";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function redirectTarget(formData?: FormData) {
  if (!formData) return "/";

  const value = getString(formData, "returnTo");
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  return value;
}

function withError(target: string, error: string) {
  const [pathAndQuery, hash] = target.split("#", 2);
  const separator = pathAndQuery.includes("?") ? "&" : "?";
  return `${pathAndQuery}${separator}error=${error}${hash ? `#${hash}` : ""}`;
}

function blobUploadConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function safeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function findCareBlockForChangeRequest(careBlockId: string | undefined, proposedStartsAt: Date) {
  if (careBlockId) {
    return prisma.careBlock.findFirst({
      where: { id: careBlockId, familyId: DEMO_FAMILY_ID },
    });
  }

  return prisma.careBlock.findFirst({
    where: {
      familyId: DEMO_FAMILY_ID,
      source: "COURT_ORDER",
      startsAt: { lte: proposedStartsAt },
      endsAt: { gt: proposedStartsAt },
    },
    orderBy: { startsAt: "desc" },
  });
}

async function hasManualCareBlockOverlap({
  childId,
  startsAt,
  endsAt,
  excludeId,
}: {
  childId: string;
  startsAt: Date;
  endsAt: Date;
  excludeId?: string;
}) {
  const conflict = await prisma.careBlock.findFirst({
    where: {
      familyId: DEMO_FAMILY_ID,
      childId,
      source: "MANUAL",
      id: excludeId ? { not: excludeId } : undefined,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });

  return Boolean(conflict);
}

async function hasChangeRequestOverlap({
  startsAt,
  endsAt,
  excludeId,
}: {
  startsAt: Date;
  endsAt: Date;
  excludeId?: string;
}) {
  const conflict = await prisma.changeRequest.findFirst({
    where: {
      familyId: DEMO_FAMILY_ID,
      status: { in: ["PENDING", "ACCEPTED"] },
      id: excludeId ? { not: excludeId } : undefined,
      proposedStartsAt: { lt: endsAt },
      proposedEndsAt: { gt: startsAt },
    },
    select: { id: true },
  });

  return Boolean(conflict);
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localMonthKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function changeRequestCalendarPath(
  request: { id: string; proposedStartsAt: Date; status?: string },
  requestStatus?: "pending" | "accepted" | "all",
) {
  const day = localDateKey(request.proposedStartsAt);
  const month = localMonthKey(request.proposedStartsAt);
  const status =
    requestStatus ??
    (request.status === "PENDING"
      ? "pending"
      : request.status === "ACCEPTED"
        ? "accepted"
        : "all");

  return `/?view=month&month=${month}&day=${day}&date=${day}&requests=day&requestStatus=${status}&open=changeRequests&focusRequest=${request.id}#request-${request.id}`;
}

function dayDetailsCalendarPath(date: Date) {
  const day = localDateKey(date);
  const month = localMonthKey(date);

  return `/?view=month&month=${month}&day=${day}&date=${day}#handover-notes`;
}

function specialEventCalendarPath(event: { id: string; startsAt: Date }) {
  const day = localDateKey(event.startsAt);
  const month = localMonthKey(event.startsAt);

  return `/?view=month&month=${month}&day=${day}&date=${day}&open=specialEvents&focusEvent=${event.id}#event-${event.id}`;
}

function localDateTimeLabel(date: Date) {
  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parentRoleLabel(role: string) {
  if (role === "PARENT_A") return "Hayden Lin";
  if (role === "PARENT_B") return "Constance Xie";
  return "Both parents";
}

function otherParentRole(role: string) {
  return role === "PARENT_A" ? "PARENT_B" : "PARENT_A";
}

function minutesLabel(minutes: number) {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.round((minutes % (24 * 60)) / 60);
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  return parts.join(" ") || "0 hours";
}

function durationLabel(startsAt: Date, endsAt: Date) {
  return minutesLabel(Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000)));
}

function makeUpLine({
  minutes,
  owedByRole,
  owedToRole,
}: {
  minutes: number;
  owedByRole: string;
  owedToRole: string;
}) {
  if (minutes <= 0 || !owedByRole || !owedToRole || owedByRole === owedToRole) {
    return "Make-up balance: none";
  }

  return `Make-up balance: ${parentRoleLabel(owedByRole)} owes ${parentRoleLabel(owedToRole)} ${minutesLabel(minutes)}`;
}

function publicHolidayRuleKey(holiday: { name: string; date: Date }) {
  return `${holiday.name.trim().toLowerCase()}|${localDateKey(holiday.date)}`;
}

function schoolHolidayRuleKey(period: {
  year: number;
  label: string;
  startsOn: Date;
  endsOn: Date;
}) {
  return [
    period.year,
    period.label.trim().toLowerCase(),
    localDateKey(period.startsOn),
    localDateKey(period.endsOn),
  ].join("|");
}

async function recordAuditLog({
  actorUserId,
  action,
  entityType,
  entityId,
  summary,
}: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
}) {
  await prisma.auditLog.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      actorUserId,
      action,
      entityType,
      entityId,
      summary,
    },
  });
}

async function notificationEmailForFamilyUser(userId: string) {
  const member = await prisma.familyMember.findFirst({
    where: { familyId: DEMO_FAMILY_ID, userId },
    select: { role: true, user: { select: { email: true } } },
  });

  return member ? (notificationEmailForRole(member.role) ?? member.user.email) : null;
}

export async function createCareBlock(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = careBlockSchema.parse({
    childId: getString(formData, "childId"),
    parentRole: getString(formData, "parentRole"),
    startsAt: getString(formData, "startsAt"),
    endsAt: getString(formData, "endsAt"),
    handoverNote: getString(formData, "handoverNote") || null,
  });

  if (
    await hasManualCareBlockOverlap({
      childId: parsed.childId,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
    })
  ) {
    redirect(withError(redirectTarget(formData), "care-block-overlap"));
  }

  const block = await prisma.careBlock.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      childId: parsed.childId,
      parentRole: parsed.parentRole,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      source: "MANUAL",
      handoverNote: parsed.handoverNote,
    },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CREATE",
    entityType: "CareBlock",
    entityId: block.id,
    summary: `Added manual care block for ${parentRoleLabel(block.parentRole)} (${localDateTimeLabel(block.startsAt)} to ${localDateTimeLabel(block.endsAt)}).`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function updateCareBlock(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const existingBlock = await prisma.careBlock.findFirst({
    where: { id, familyId: DEMO_FAMILY_ID, source: "MANUAL" },
    select: { id: true },
  });

  if (!existingBlock) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  const parsed = careBlockSchema.parse({
    childId: getString(formData, "childId"),
    parentRole: getString(formData, "parentRole"),
    startsAt: getString(formData, "startsAt"),
    endsAt: getString(formData, "endsAt"),
    handoverNote: getString(formData, "handoverNote") || null,
  });

  if (
    await hasManualCareBlockOverlap({
      childId: parsed.childId,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      excludeId: id,
    })
  ) {
    redirect(withError(redirectTarget(formData), "care-block-overlap"));
  }

  const block = await prisma.careBlock.update({
    where: { id, familyId: DEMO_FAMILY_ID },
    data: { ...parsed, source: "MANUAL" },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "UPDATE",
    entityType: "CareBlock",
    entityId: block.id,
    summary: `Edited manual care block for ${parentRoleLabel(block.parentRole)} (${localDateTimeLabel(block.startsAt)} to ${localDateTimeLabel(block.endsAt)}).`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function deleteCareBlock(id: string, formData?: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const existingBlock = await prisma.careBlock.findFirst({
    where: { id, familyId: DEMO_FAMILY_ID, source: "MANUAL" },
    select: { id: true },
  });

  if (!existingBlock) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  const block = await prisma.careBlock.delete({
    where: { id, familyId: DEMO_FAMILY_ID },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "DELETE",
    entityType: "CareBlock",
    entityId: block.id,
    summary: `Deleted manual care block for ${parentRoleLabel(block.parentRole)} (${localDateTimeLabel(block.startsAt)} to ${localDateTimeLabel(block.endsAt)}).`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function createChangeRequest(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = changeRequestSchema.parse({
    careBlockId: getString(formData, "careBlockId") || undefined,
    requestedById: currentMember.userId,
    proposedParentRole: getString(formData, "proposedParentRole"),
    proposedStartsAt: getString(formData, "proposedStartsAt"),
    proposedEndsAt: getString(formData, "proposedEndsAt"),
    reason: getString(formData, "reason") || null,
  });

  if (
    await hasChangeRequestOverlap({
      startsAt: parsed.proposedStartsAt,
      endsAt: parsed.proposedEndsAt,
    })
  ) {
    redirect(withError(redirectTarget(formData), "change-request-overlap"));
  }

  const careBlock = await findCareBlockForChangeRequest(parsed.careBlockId, parsed.proposedStartsAt);

  if (!careBlock) {
    redirect(withError(redirectTarget(formData), "missing-court-order-block"));
  }

  const creditDays = Number(getString(formData, "creditDays") || "0");
  const creditHours = Number(getString(formData, "creditHours") || "0");
  const creditOwedByRole = getString(formData, "creditOwedByRole");
  const creditOwedToRole = getString(formData, "creditOwedToRole");
  const creditMinutes = Math.round(creditDays * 24 * 60 + creditHours * 60);

  const request = await prisma.$transaction(async (tx) => {
    const createdRequest = await tx.changeRequest.create({
      data: {
        familyId: DEMO_FAMILY_ID,
        careBlockId: careBlock.id,
        requestedById: parsed.requestedById,
        proposedParentRole: parsed.proposedParentRole,
        proposedStartsAt: parsed.proposedStartsAt,
        proposedEndsAt: parsed.proposedEndsAt,
        reason: parsed.reason,
      },
    });

    if (
      creditMinutes > 0 &&
      (creditOwedByRole === "PARENT_A" || creditOwedByRole === "PARENT_B") &&
      (creditOwedToRole === "PARENT_A" || creditOwedToRole === "PARENT_B") &&
      creditOwedByRole !== creditOwedToRole
    ) {
      await tx.careCredit.create({
        data: {
          familyId: DEMO_FAMILY_ID,
          owedByRole: creditOwedByRole,
          owedToRole: creditOwedToRole,
          minutes: creditMinutes,
          remainingMinutes: creditMinutes,
          reason: parsed.reason,
          sourceRequestId: createdRequest.id,
        },
      });
    }

    return createdRequest;
  });

  const recipientRole = otherParentRole(currentMember.role);
  const recipientEmail = notificationEmailForRole(recipientRole);
  await sendNotificationEmail({
    to: recipientEmail ?? "",
    subject: "New care schedule change request",
    text: [
      `${currentMember.user.name} requested a care schedule change.`,
      "",
      `Original care: ${parentRoleLabel(careBlock.parentRole)}`,
      `Proposed care: ${parentRoleLabel(request.proposedParentRole)}`,
      `From: ${localDateTimeLabel(request.proposedStartsAt)}`,
      `Until: ${localDateTimeLabel(request.proposedEndsAt)}`,
      `Duration: ${durationLabel(request.proposedStartsAt, request.proposedEndsAt)}`,
      makeUpLine({
        minutes: creditMinutes,
        owedByRole: creditOwedByRole,
        owedToRole: creditOwedToRole,
      }),
      request.reason ? `Reason: ${request.reason}` : null,
      "",
      `Open this request: ${calendarUrl(changeRequestCalendarPath(request, "pending"))}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function updateChangeRequest(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = changeRequestSchema.parse({
    careBlockId: getString(formData, "careBlockId") || undefined,
    requestedById: currentMember.userId,
    proposedParentRole: getString(formData, "proposedParentRole"),
    proposedStartsAt: getString(formData, "proposedStartsAt"),
    proposedEndsAt: getString(formData, "proposedEndsAt"),
    reason: getString(formData, "reason") || null,
  });

  const existingRequest = await prisma.changeRequest.findFirstOrThrow({
    where: { id, familyId: DEMO_FAMILY_ID, status: "PENDING", requestedById: currentMember.userId },
  });

  if (
    await hasChangeRequestOverlap({
      startsAt: parsed.proposedStartsAt,
      endsAt: parsed.proposedEndsAt,
      excludeId: existingRequest.id,
    })
  ) {
    redirect(withError(redirectTarget(formData), "change-request-overlap"));
  }

  const careBlock = await findCareBlockForChangeRequest(parsed.careBlockId, parsed.proposedStartsAt);

  if (!careBlock) {
    redirect(withError(redirectTarget(formData), "missing-court-order-block"));
  }

  const creditDays = Number(getString(formData, "creditDays") || "0");
  const creditHours = Number(getString(formData, "creditHours") || "0");
  const creditOwedByRole = getString(formData, "creditOwedByRole");
  const creditOwedToRole = getString(formData, "creditOwedToRole");
  const creditMinutes = Math.round(creditDays * 24 * 60 + creditHours * 60);

  await prisma.$transaction(async (tx) => {
    await tx.changeRequest.update({
      where: { id: existingRequest.id },
      data: {
        careBlockId: careBlock.id,
        requestedById: parsed.requestedById,
        proposedParentRole: parsed.proposedParentRole,
        proposedStartsAt: parsed.proposedStartsAt,
        proposedEndsAt: parsed.proposedEndsAt,
        reason: parsed.reason,
      },
    });

    await tx.careCredit.updateMany({
      where: { familyId: DEMO_FAMILY_ID, sourceRequestId: id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });

    if (
      creditMinutes > 0 &&
      (creditOwedByRole === "PARENT_A" || creditOwedByRole === "PARENT_B") &&
      (creditOwedToRole === "PARENT_A" || creditOwedToRole === "PARENT_B") &&
      creditOwedByRole !== creditOwedToRole
    ) {
      await tx.careCredit.create({
        data: {
          familyId: DEMO_FAMILY_ID,
          owedByRole: creditOwedByRole,
          owedToRole: creditOwedToRole,
          minutes: creditMinutes,
          remainingMinutes: creditMinutes,
          reason: parsed.reason,
          sourceRequestId: id,
        },
      });
    }
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function acceptChangeRequest(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const request = await prisma.changeRequest.findFirst({
    where: {
      id,
      familyId: DEMO_FAMILY_ID,
      status: "PENDING",
      requestedById: { not: currentMember.userId },
    },
    include: { requestedBy: true, careBlock: true },
  });

  if (!request) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  const updatedRequest = await prisma.changeRequest.update({
    where: { id: request.id },
    data: { status: "ACCEPTED", respondedById: currentMember.userId },
  });

  await sendNotificationEmail({
    to: (await notificationEmailForFamilyUser(request.requestedById)) ?? "",
    subject: "Care schedule change accepted",
    text: [
      `${currentMember.user.name} accepted your care schedule change request.`,
      "",
      `Original care: ${parentRoleLabel(request.careBlock.parentRole)}`,
      `Accepted care: ${parentRoleLabel(updatedRequest.proposedParentRole)}`,
      `From: ${localDateTimeLabel(updatedRequest.proposedStartsAt)}`,
      `Until: ${localDateTimeLabel(updatedRequest.proposedEndsAt)}`,
      `Duration: ${durationLabel(updatedRequest.proposedStartsAt, updatedRequest.proposedEndsAt)}`,
      "",
      `Open this request: ${calendarUrl(changeRequestCalendarPath(updatedRequest, "accepted"))}`,
    ].join("\n"),
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function cancelAcceptedChangeRequest(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const request = await prisma.changeRequest.findFirst({
    where: {
      id,
      familyId: DEMO_FAMILY_ID,
      status: "ACCEPTED",
      OR: [{ requestedById: currentMember.userId }, { respondedById: currentMember.userId }],
    },
    include: { requestedBy: true, respondedBy: true, careBlock: true },
  });

  if (!request) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const cancelledRequest = await tx.changeRequest.update({
      where: { id: request.id },
      data: {
        status: "CANCELLED",
        respondedById: currentMember.userId,
        responseNote: getString(formData, "responseNote") || "Cancelled after approval.",
      },
    });

    await tx.careCredit.updateMany({
      where: { familyId: DEMO_FAMILY_ID, sourceRequestId: id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });

    return cancelledRequest;
  });

  const recipientEmail =
    request.requestedById === currentMember.userId
      ? request.respondedById
        ? await notificationEmailForFamilyUser(request.respondedById)
        : null
      : await notificationEmailForFamilyUser(request.requestedById);
  await sendNotificationEmail({
    to: recipientEmail ?? "",
    subject: "Accepted care schedule change cancelled",
    text: [
      `${currentMember.user.name} cancelled an accepted care schedule change.`,
      "",
      `Care was: ${parentRoleLabel(updatedRequest.proposedParentRole)}`,
      `From: ${localDateTimeLabel(updatedRequest.proposedStartsAt)}`,
      `Until: ${localDateTimeLabel(updatedRequest.proposedEndsAt)}`,
      `Duration: ${durationLabel(updatedRequest.proposedStartsAt, updatedRequest.proposedEndsAt)}`,
      "",
      `Open this request: ${calendarUrl(changeRequestCalendarPath(updatedRequest, "all"))}`,
    ].join("\n"),
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function withdrawChangeRequest(id: string, formData?: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const request = await prisma.changeRequest.findFirst({
    where: { id, familyId: DEMO_FAMILY_ID, status: "PENDING", requestedById: currentMember.userId },
    select: { id: true },
  });

  if (!request) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  await prisma.$transaction(async (tx) => {
    await tx.changeRequest.update({
      where: { id: request.id },
      data: {
        status: "CANCELLED",
        responseNote: "Withdrawn before response.",
      },
    });

    await tx.careCredit.updateMany({
      where: { familyId: DEMO_FAMILY_ID, sourceRequestId: id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function declineChangeRequest(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const request = await prisma.changeRequest.findFirst({
    where: {
      id,
      familyId: DEMO_FAMILY_ID,
      status: "PENDING",
      requestedById: { not: currentMember.userId },
    },
    include: { requestedBy: true, careBlock: true },
  });

  if (!request) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const declinedRequest = await tx.changeRequest.update({
      where: { id: request.id },
      data: {
        status: "DECLINED",
        respondedById: currentMember.userId,
        responseNote: getString(formData, "responseNote") || null,
      },
    });

    await tx.careCredit.updateMany({
      where: { familyId: DEMO_FAMILY_ID, sourceRequestId: id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });

    return declinedRequest;
  });

  await sendNotificationEmail({
    to: (await notificationEmailForFamilyUser(request.requestedById)) ?? "",
    subject: "Care schedule change declined",
    text: [
      `${currentMember.user.name} declined your care schedule change request.`,
      "",
      `Original care: ${parentRoleLabel(request.careBlock.parentRole)}`,
      `Requested care: ${parentRoleLabel(updatedRequest.proposedParentRole)}`,
      `From: ${localDateTimeLabel(updatedRequest.proposedStartsAt)}`,
      `Until: ${localDateTimeLabel(updatedRequest.proposedEndsAt)}`,
      `Duration: ${durationLabel(updatedRequest.proposedStartsAt, updatedRequest.proposedEndsAt)}`,
      updatedRequest.responseNote ? `Note: ${updatedRequest.responseNote}` : null,
      "",
      `Open this request: ${calendarUrl(changeRequestCalendarPath(updatedRequest, "all"))}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function createExpense(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = expenseSchema.parse({
    paidById: currentMember.userId,
    title: getString(formData, "title"),
    amount: getString(formData, "amount"),
    incurredOn: getString(formData, "incurredOn"),
    notes: getString(formData, "notes") || null,
  });

  const expense = await prisma.expense.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      paidById: parsed.paidById,
      title: parsed.title,
      amountCents: Math.round(parsed.amount * 100),
      incurredOn: parsed.incurredOn,
      notes: parsed.notes,
    },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CREATE",
    entityType: "Expense",
    entityId: expense.id,
    summary: `Added expense "${expense.title}" for $${(expense.amountCents / 100).toFixed(2)}.`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function settleExpense(id: string, formData?: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const expense = await prisma.expense.update({
    where: { id, familyId: DEMO_FAMILY_ID },
    data: { status: "SETTLED" },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "SETTLE",
    entityType: "Expense",
    entityId: expense.id,
    summary: `Marked expense "${expense.title}" as settled.`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function deleteExpense(id: string, formData?: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const expense = await prisma.expense.delete({
    where: { id, familyId: DEMO_FAMILY_ID },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "DELETE",
    entityType: "Expense",
    entityId: expense.id,
    summary: `Deleted expense "${expense.title}" for $${(expense.amountCents / 100).toFixed(2)}.`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function createHandoverNote(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const noteDate = new Date(`${getString(formData, "noteDate")}T00:00:00`);
  const text = getString(formData, "text").trim();
  const shouldNotify = getString(formData, "notifyOtherParent") === "on";

  if (!text || Number.isNaN(noteDate.getTime())) {
    redirect(withError(redirectTarget(formData), "invalid-note"));
  }

  const note = await prisma.handoverNote.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      authorUserId: currentMember.userId,
      noteDate,
      text,
    },
  });

  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CREATE",
    entityType: "HandoverNote",
    entityId: note.id,
    summary: `Added handover note for ${localDateKey(note.noteDate)}.`,
  });

  if (shouldNotify) {
    const recipientRole = otherParentRole(currentMember.role);
    await sendNotificationEmail({
      to: notificationEmailForRole(recipientRole) ?? "",
      subject: `New handover note for ${localDateKey(note.noteDate)}`,
      text: [
        `${currentMember.user.name} added a handover note for ${localDateKey(note.noteDate)}.`,
        "",
        text,
        "",
        `Open the day details: ${calendarUrl(dayDetailsCalendarPath(note.noteDate))}`,
        "",
        "Please reply or add follow-up notes in CoCare so the note stays with the calendar.",
      ].join("\n"),
    });
  }

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function deleteHandoverNote(id: string, formData?: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const note = await prisma.handoverNote.findFirst({
    where: { id, familyId: DEMO_FAMILY_ID },
    select: { id: true, authorUserId: true, noteDate: true },
  });

  if (!note || note.authorUserId !== currentMember.userId) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  await prisma.handoverNote.delete({
    where: { id: note.id },
  });

  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "DELETE",
    entityType: "HandoverNote",
    entityId: note.id,
    summary: `Deleted handover note for ${localDateKey(note.noteDate)}.`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function createCareCredit(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = careCreditSchema.parse({
    owedByRole: getString(formData, "owedByRole"),
    owedToRole: getString(formData, "owedToRole"),
    days: getString(formData, "days") || "0",
    hours: getString(formData, "hours") || "0",
    reason: getString(formData, "reason") || null,
  });
  const minutes = Math.round(parsed.days * 24 * 60 + parsed.hours * 60);

  const credit = await prisma.careCredit.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      owedByRole: parsed.owedByRole,
      owedToRole: parsed.owedToRole,
      minutes,
      remainingMinutes: minutes,
      reason: parsed.reason,
    },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CREATE",
    entityType: "CareCredit",
    entityId: credit.id,
    summary: `Added make-up balance: ${parentRoleLabel(credit.owedByRole)} owes ${parentRoleLabel(credit.owedToRole)} ${minutesLabel(credit.minutes)}.`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function settleCareCredit(id: string, formData?: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const credit = await prisma.careCredit.update({
    where: { id, familyId: DEMO_FAMILY_ID },
    data: { status: "SETTLED", remainingMinutes: 0 },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "SETTLE",
    entityType: "CareCredit",
    entityId: credit.id,
    summary: `Settled make-up balance: ${parentRoleLabel(credit.owedByRole)} owed ${parentRoleLabel(credit.owedToRole)} ${minutesLabel(credit.minutes)}.`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function cancelCareCredit(id: string, formData?: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const credit = await prisma.careCredit.update({
    where: { id, familyId: DEMO_FAMILY_ID },
    data: { status: "CANCELLED" },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CANCEL",
    entityType: "CareCredit",
    entityId: credit.id,
    summary: `Cancelled make-up balance: ${parentRoleLabel(credit.owedByRole)} owed ${parentRoleLabel(credit.owedToRole)} ${minutesLabel(credit.minutes)}.`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function createSpecialEvent(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = specialEventSchema.parse({
    title: getString(formData, "title"),
    startsAt: getString(formData, "startsAt"),
    endsAt: getString(formData, "endsAt"),
    location: getString(formData, "location") || null,
    notes: getString(formData, "notes") || null,
  });
  const inviteeRole = otherParentRole(currentMember.role);
  const invitee = await prisma.familyMember.findFirstOrThrow({
    where: { familyId: DEMO_FAMILY_ID, role: inviteeRole },
    include: { user: true },
  });

  const event = await prisma.specialEvent.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      organizerUserId: currentMember.userId,
      inviteeUserId: invitee.userId,
      title: parsed.title,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      location: parsed.location,
      notes: parsed.notes,
    },
  });

  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CREATE",
    entityType: "SpecialEvent",
    entityId: event.id,
    summary: `Created special event invitation "${event.title}" for ${localDateKey(event.startsAt)}.`,
  });

  await sendNotificationEmail({
    to: invitee.user.email,
    subject: `Special event invitation: ${event.title}`,
    text: [
      `${currentMember.user.name} invited you to a special event with Derick.`,
      "",
      `Event: ${event.title}`,
      `From: ${localDateTimeLabel(event.startsAt)}`,
      `Until: ${localDateTimeLabel(event.endsAt)}`,
      event.location ? `Location: ${event.location}` : null,
      event.notes ? `Notes: ${event.notes}` : null,
      "",
      `Open the invitation: ${calendarUrl(specialEventCalendarPath(event))}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function acceptSpecialEvent(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const event = await prisma.specialEvent.findFirst({
    where: { id, familyId: DEMO_FAMILY_ID, status: "PENDING", inviteeUserId: currentMember.userId },
    include: { organizer: true },
  });

  if (!event) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  const updatedEvent = await prisma.specialEvent.update({
    where: { id: event.id },
    data: { status: "ACCEPTED", respondedById: currentMember.userId },
  });

  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "ACCEPT",
    entityType: "SpecialEvent",
    entityId: event.id,
    summary: `Accepted special event invitation "${event.title}".`,
  });

  await sendNotificationEmail({
    to: event.organizer.email,
    subject: `Special event accepted: ${event.title}`,
    text: [
      `${currentMember.user.name} accepted your special event invitation.`,
      "",
      `Event: ${event.title}`,
      `From: ${localDateTimeLabel(event.startsAt)}`,
      `Until: ${localDateTimeLabel(event.endsAt)}`,
      event.location ? `Location: ${event.location}` : null,
      "",
      `Open the event: ${calendarUrl(specialEventCalendarPath(updatedEvent))}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function declineSpecialEvent(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const event = await prisma.specialEvent.findFirst({
    where: { id, familyId: DEMO_FAMILY_ID, status: "PENDING", inviteeUserId: currentMember.userId },
    include: { organizer: true },
  });

  if (!event) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  const updatedEvent = await prisma.specialEvent.update({
    where: { id: event.id },
    data: {
      status: "DECLINED",
      respondedById: currentMember.userId,
      responseNote: getString(formData, "responseNote") || null,
    },
  });

  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "DECLINE",
    entityType: "SpecialEvent",
    entityId: event.id,
    summary: `Declined special event invitation "${event.title}".`,
  });

  await sendNotificationEmail({
    to: event.organizer.email,
    subject: `Special event declined: ${event.title}`,
    text: [
      `${currentMember.user.name} declined your special event invitation.`,
      "",
      `Event: ${event.title}`,
      `From: ${localDateTimeLabel(event.startsAt)}`,
      `Until: ${localDateTimeLabel(event.endsAt)}`,
      updatedEvent.responseNote ? `Note: ${updatedEvent.responseNote}` : null,
      "",
      `Open the event: ${calendarUrl(specialEventCalendarPath(updatedEvent))}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function cancelSpecialEvent(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const event = await prisma.specialEvent.findFirst({
    where: {
      id,
      familyId: DEMO_FAMILY_ID,
      status: { in: ["PENDING", "ACCEPTED"] },
      OR: [{ organizerUserId: currentMember.userId }, { inviteeUserId: currentMember.userId }],
    },
    include: { organizer: true, invitee: true },
  });

  if (!event) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  const updatedEvent = await prisma.specialEvent.update({
    where: { id: event.id },
    data: {
      status: "CANCELLED",
      respondedById: currentMember.userId,
      responseNote: getString(formData, "responseNote") || "Cancelled.",
    },
  });
  const recipient = event.organizerUserId === currentMember.userId ? event.invitee : event.organizer;

  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CANCEL",
    entityType: "SpecialEvent",
    entityId: event.id,
    summary: `Cancelled special event "${event.title}".`,
  });

  await sendNotificationEmail({
    to: recipient.email,
    subject: `Special event cancelled: ${event.title}`,
    text: [
      `${currentMember.user.name} cancelled a special event.`,
      "",
      `Event: ${event.title}`,
      `From: ${localDateTimeLabel(event.startsAt)}`,
      `Until: ${localDateTimeLabel(event.endsAt)}`,
      updatedEvent.responseNote ? `Note: ${updatedEvent.responseNote}` : null,
      "",
      `Open the event: ${calendarUrl(specialEventCalendarPath(updatedEvent))}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function uploadDocument(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const documentDate = new Date(`${getString(formData, "documentDate")}T00:00:00`);
  const title = getString(formData, "title").trim();
  const notes = getString(formData, "notes").trim() || null;
  const file = getFile(formData, "file");
  const allowedTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);
  const maxSizeBytes = 10 * 1024 * 1024;

  if (!blobUploadConfigured()) {
    redirect(withError(redirectTarget(formData), "file-upload-not-configured"));
  }

  if (!title || Number.isNaN(documentDate.getTime()) || !file || file.size === 0) {
    redirect(withError(redirectTarget(formData), "invalid-document"));
  }

  if (file.size > maxSizeBytes) {
    redirect(withError(redirectTarget(formData), "document-too-large"));
  }

  if (file.type && !allowedTypes.has(file.type)) {
    redirect(withError(redirectTarget(formData), "document-type-not-supported"));
  }

  try {
    const pathname = [
      "documents",
      DEMO_FAMILY_ID,
      localDateKey(documentDate),
      `${Date.now()}-${safeFileName(file.name || "document")}`,
    ].join("/");
    const blob = await put(pathname, file, {
      access: "private",
      addRandomSuffix: true,
    });

    try {
      const document = await prisma.document.create({
        data: {
          familyId: DEMO_FAMILY_ID,
          uploadedById: currentMember.userId,
          documentDate,
          title,
          fileName: file.name || "document",
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          blobPathname: blob.pathname,
          notes,
        },
      });

      await recordAuditLog({
        actorUserId: currentMember.userId,
        action: "CREATE",
        entityType: "Document",
        entityId: document.id,
        summary: `Uploaded document "${document.title}" for ${localDateKey(document.documentDate)}.`,
      });
    } catch (error) {
      console.error("[document metadata create failed]", error);
      try {
        await del(blob.pathname);
      } catch (deleteError) {
        console.error("[orphan blob cleanup failed]", deleteError);
      }
      redirect(withError(redirectTarget(formData), "document-upload-failed"));
    }
  } catch (error) {
    console.error("[document upload failed]", error);
    redirect(withError(redirectTarget(formData), "document-upload-failed"));
  }

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function deleteDocument(id: string, formData?: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const document = await prisma.document.findFirst({
    where: { id, familyId: DEMO_FAMILY_ID, uploadedById: currentMember.userId },
  });

  if (!document) {
    redirect(withError(redirectTarget(formData), "action-not-allowed"));
  }

  await prisma.document.delete({ where: { id: document.id } });

  try {
    await del(document.blobPathname);
  } catch (error) {
    console.error("[blob delete failed]", error);
  }

  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "DELETE",
    entityType: "Document",
    entityId: document.id,
    summary: `Deleted document "${document.title}" for ${localDateKey(document.documentDate)}.`,
  });

  revalidatePath("/");
  redirect(redirectTarget(formData));
}

export async function createSchoolHolidayPeriod(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = schoolHolidayPeriodSchema.parse({
    year: getString(formData, "year"),
    label: getString(formData, "label"),
    startsOn: getString(formData, "startsOn"),
    endsOn: getString(formData, "endsOn"),
  });

  const period = await prisma.schoolHolidayPeriod.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      year: parsed.year,
      label: parsed.label,
      startsOn: parsed.startsOn,
      endsOn: parsed.endsOn,
      source: "MANUAL",
    },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CREATE",
    entityType: "SchoolHolidayPeriod",
    entityId: period.id,
    summary: `Added school holiday ${period.label} (${localDateKey(period.startsOn)} to ${localDateKey(period.endsOn)}).`,
  });

  revalidatePath("/settings/rules");
  redirect("/settings/rules");
}

export async function updateSchoolHolidayPeriod(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = schoolHolidayPeriodSchema.parse({
    year: getString(formData, "year"),
    label: getString(formData, "label"),
    startsOn: getString(formData, "startsOn"),
    endsOn: getString(formData, "endsOn"),
  });

  const period = await prisma.schoolHolidayPeriod.update({
    where: { id, familyId: DEMO_FAMILY_ID },
    data: {
      year: parsed.year,
      label: parsed.label,
      startsOn: parsed.startsOn,
      endsOn: parsed.endsOn,
      source: "MANUAL",
      sourceUrl: null,
    },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "UPDATE",
    entityType: "SchoolHolidayPeriod",
    entityId: period.id,
    summary: `Edited school holiday ${period.label} (${localDateKey(period.startsOn)} to ${localDateKey(period.endsOn)}).`,
  });

  revalidatePath("/settings/rules");
  redirect("/settings/rules");
}

export async function deleteSchoolHolidayPeriod(id: string) {
  const currentMember = await requireCurrentFamilyMember();
  const period = await prisma.schoolHolidayPeriod.delete({
    where: { id, familyId: DEMO_FAMILY_ID },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "DELETE",
    entityType: "SchoolHolidayPeriod",
    entityId: period.id,
    summary: `Deleted school holiday ${period.label} (${localDateKey(period.startsOn)} to ${localDateKey(period.endsOn)}).`,
  });

  revalidatePath("/settings/rules");
  redirect("/settings/rules");
}

export async function fetchOfficialSchoolHolidayPeriods() {
  const currentMember = await requireCurrentFamilyMember();
  let fetched = false;
  let autoCount = 0;

  try {
    const periods = await fetchOfficialVicSchoolHolidays();
    const manualPeriods = await prisma.schoolHolidayPeriod.findMany({
      where: { familyId: DEMO_FAMILY_ID, source: "MANUAL" },
      select: { year: true, label: true, startsOn: true, endsOn: true },
    });
    const manualKeys = new Set(manualPeriods.map(schoolHolidayRuleKey));
    const autoPeriods = periods.filter(
      (period) =>
        !manualKeys.has(
          schoolHolidayRuleKey({
            year: period.year,
            label: period.label,
            startsOn: period.startsOn,
            endsOn: period.endsOn,
          }),
        ),
    );

    await prisma.$transaction(async (tx) => {
      await tx.schoolHolidayPeriod.deleteMany({
        where: { familyId: DEMO_FAMILY_ID, source: "AUTO" },
      });

      if (autoPeriods.length > 0) {
        await tx.schoolHolidayPeriod.createMany({
          data: autoPeriods.map((period) => ({
            familyId: DEMO_FAMILY_ID,
            year: period.year,
            label: period.label,
            startsOn: period.startsOn,
            endsOn: period.endsOn,
            source: "AUTO",
            sourceUrl: period.sourceUrl,
          })),
        });
      }
    });
    autoCount = autoPeriods.length;
    await recordAuditLog({
      actorUserId: currentMember.userId,
      action: "FETCH",
      entityType: "SchoolHolidayPeriod",
      entityId: null,
      summary: `Fetched official VIC school holidays and saved ${autoCount} auto rule${autoCount === 1 ? "" : "s"}.`,
    });
    fetched = true;
  } catch {
    redirect("/settings/rules?error=school-fetch-failed");
  }

  if (fetched) {
    revalidatePath("/settings/rules");
    redirect("/settings/rules?fetched=school");
  }
}

export async function createPublicHolidayRule(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = publicHolidayRuleSchema.parse({
    name: getString(formData, "name"),
    date: getString(formData, "date"),
    parentRole: getString(formData, "parentRole"),
  });

  const holiday = await prisma.publicHolidayRule.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: parsed.name,
      date: parsed.date,
      parentRole: parsed.parentRole,
      source: "MANUAL",
    },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "CREATE",
    entityType: "PublicHolidayRule",
    entityId: holiday.id,
    summary: `Added public holiday ${holiday.name} (${localDateKey(holiday.date)}).`,
  });

  revalidatePath("/settings/rules");
  redirect("/settings/rules");
}

export async function updatePublicHolidayRule(id: string, formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const parsed = publicHolidayRuleSchema.parse({
    name: getString(formData, "name"),
    date: getString(formData, "date"),
    parentRole: getString(formData, "parentRole"),
  });

  const holiday = await prisma.publicHolidayRule.update({
    where: { id, familyId: DEMO_FAMILY_ID },
    data: {
      name: parsed.name,
      date: parsed.date,
      parentRole: parsed.parentRole,
      source: "MANUAL",
      sourceUrl: null,
    },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "UPDATE",
    entityType: "PublicHolidayRule",
    entityId: holiday.id,
    summary: `Edited public holiday ${holiday.name} (${localDateKey(holiday.date)}).`,
  });

  revalidatePath("/settings/rules");
  redirect("/settings/rules");
}

export async function generateAutoPublicHolidayRules() {
  const currentMember = await requireCurrentFamilyMember();
  let generated = false;
  let generatedCount = 0;

  try {
    const generatedPublicHolidays = assignPublicHolidayRotation(
      generateStandardVicPublicHolidays(),
      new Date(2026, 5, 8),
      "PARENT_B",
    );
    const manualPublicHolidays = await prisma.publicHolidayRule.findMany({
      where: { familyId: DEMO_FAMILY_ID, source: "MANUAL" },
      select: { name: true, date: true },
    });
    const manualKeys = new Set(manualPublicHolidays.map(publicHolidayRuleKey));
    const publicHolidays = generatedPublicHolidays.filter(
      (holiday) => !manualKeys.has(publicHolidayRuleKey(holiday)),
    );

    await prisma.$transaction(async (tx) => {
      await tx.publicHolidayRule.deleteMany({
        where: { familyId: DEMO_FAMILY_ID, source: "AUTO" },
      });

      if (publicHolidays.length > 0) {
        await tx.publicHolidayRule.createMany({
          data: publicHolidays.map((holiday) => ({
            familyId: DEMO_FAMILY_ID,
            name: holiday.name,
            date: holiday.date,
            parentRole: holiday.parentRole,
            source: "AUTO",
            sourceUrl: holiday.sourceUrl,
          })),
        });
      }
    });
    generatedCount = publicHolidays.length;
    await recordAuditLog({
      actorUserId: currentMember.userId,
      action: "GENERATE",
      entityType: "PublicHolidayRule",
      entityId: null,
      summary: `Generated ${generatedCount} standard VIC public holiday auto rule${generatedCount === 1 ? "" : "s"}.`,
    });
    generated = true;
  } catch {
    redirect("/settings/rules?error=public-generate-failed");
  }

  if (generated) {
    revalidatePath("/settings/rules");
    redirect("/settings/rules?fetched=public");
  }
}

export async function deletePublicHolidayRule(id: string) {
  const currentMember = await requireCurrentFamilyMember();
  const holiday = await prisma.publicHolidayRule.delete({
    where: { id, familyId: DEMO_FAMILY_ID },
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "DELETE",
    entityType: "PublicHolidayRule",
    entityId: holiday.id,
    summary: `Deleted public holiday ${holiday.name} (${localDateKey(holiday.date)}).`,
  });

  revalidatePath("/settings/rules");
  redirect("/settings/rules");
}

export async function applyHolidayRulesToCourtOrder() {
  const currentMember = await requireCurrentFamilyMember();
  const [child, schoolHolidays, publicHolidays] = await Promise.all([
    prisma.child.findFirstOrThrow({
      where: { familyId: DEMO_FAMILY_ID },
      orderBy: { createdAt: "asc" },
    }),
    prisma.schoolHolidayPeriod.findMany({
      where: { familyId: DEMO_FAMILY_ID },
      orderBy: [{ year: "asc" }, { startsOn: "asc" }, { source: "asc" }],
    }),
    prisma.publicHolidayRule.findMany({
      where: { familyId: DEMO_FAMILY_ID },
      orderBy: [{ date: "asc" }, { source: "asc" }],
    }),
  ]);
  const generatedBlocks = generateCourtOrderCareBlocks2026({
    schoolHolidays: schoolHolidays.map((period) => ({
      start: period.startsOn,
      end: period.endsOn,
      year: period.year,
      label: period.label,
    })),
    publicHolidays: publicHolidays.map((holiday) => ({
      date: holiday.date,
      parentRole: holiday.parentRole,
      name: holiday.name,
    })),
  })
    .map((block) => ({
      familyId: DEMO_FAMILY_ID,
      childId: child.id,
      source: "COURT_ORDER",
      ...block,
    }));

  await prisma.$transaction(async (tx) => {
    await tx.careBlock.updateMany({
      where: {
        familyId: DEMO_FAMILY_ID,
        source: "COURT_ORDER",
        changeRequests: { some: {} },
      },
      data: { source: "COURT_ORDER_ARCHIVE" },
    });

    await tx.careBlock.deleteMany({
      where: {
        familyId: DEMO_FAMILY_ID,
        source: "COURT_ORDER",
      },
    });

    if (generatedBlocks.length > 0) {
      await tx.careBlock.createMany({ data: generatedBlocks });
    }
  });
  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "APPLY",
    entityType: "CourtOrderSchedule",
    entityId: child.id,
    summary: `Applied holiday rules to calendar and generated ${generatedBlocks.length} court-order block${generatedBlocks.length === 1 ? "" : "s"}.`,
  });

  revalidatePath("/");
  revalidatePath("/settings/rules");
  redirect("/settings/rules?applied=1");
}

export async function sendTestNotificationEmail(formData: FormData) {
  const currentMember = await requireCurrentFamilyMember();
  const role = getString(formData, "role");

  if (role !== "PARENT_A" && role !== "PARENT_B") {
    redirect("/settings/notifications?error=invalid-recipient");
  }

  const result = await sendNotificationEmail({
    to: notificationEmailForRole(role) ?? "",
    subject: "Care Calendar test notification",
    text: [
      "This is a test notification from Care Calendar.",
      "",
      `Sent by: ${currentMember.user.name}`,
      `Recipient: ${parentRoleLabel(role)}`,
      "",
      `Open the calendar: ${calendarUrl("/")}`,
    ].join("\n"),
  });

  await recordAuditLog({
    actorUserId: currentMember.userId,
    action: "TEST",
    entityType: "EmailNotification",
    entityId: null,
    summary: `Sent test email to ${parentRoleLabel(role)}: ${result.status}.`,
  });

  revalidatePath("/settings/notifications");

  if (result.status === "sent") {
    redirect("/settings/notifications?sent=1");
  }

  redirect(
    `/settings/notifications?error=${result.status}&detail=${encodeURIComponent(result.reason)}`,
  );
}
