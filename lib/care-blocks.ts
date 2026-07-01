import { z } from "zod";

export const careBlockSchema = z
  .object({
    childId: z.string().min(1),
    parentRole: z.enum(["PARENT_A", "PARENT_B", "BOTH"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    handoverNote: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "End date must be after start date.",
    path: ["endsAt"],
  });

export type CareBlockInput = z.infer<typeof careBlockSchema>;

export const changeRequestSchema = z
  .object({
    careBlockId: z.string().optional(),
    requestedById: z.string().min(1),
    proposedParentRole: z.enum(["PARENT_A", "PARENT_B", "BOTH"]),
    proposedStartsAt: z.coerce.date(),
    proposedEndsAt: z.coerce.date(),
    reason: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => data.proposedEndsAt > data.proposedStartsAt, {
    message: "Proposed end date must be after start date.",
    path: ["proposedEndsAt"],
  });

export const expenseSchema = z.object({
  paidById: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  amount: z.coerce.number().positive(),
  incurredOn: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const careCreditSchema = z
  .object({
    owedByRole: z.enum(["PARENT_A", "PARENT_B"]),
    owedToRole: z.enum(["PARENT_A", "PARENT_B"]),
    days: z.coerce.number().min(0).default(0),
    hours: z.coerce.number().min(0).default(0),
    reason: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => data.owedByRole !== data.owedToRole, {
    message: "Owed by and owed to must be different.",
    path: ["owedToRole"],
  })
  .refine((data) => data.days > 0 || data.hours > 0, {
    message: "Enter at least some days or hours.",
    path: ["hours"],
  });

export const schoolHolidayPeriodSchema = z
  .object({
    year: z.coerce.number().int().min(2026).max(2037),
    label: z.string().trim().min(1).max(120),
    startsOn: z.coerce.date(),
    endsOn: z.coerce.date(),
  })
  .refine((data) => data.endsOn >= data.startsOn, {
    message: "End date must be on or after start date.",
    path: ["endsOn"],
  });

export const publicHolidayRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.coerce.date(),
  parentRole: z.enum(["PARENT_A", "PARENT_B", "BOTH"]),
});
