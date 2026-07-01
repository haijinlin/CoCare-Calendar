import { ParentRole } from "@prisma/client";

export type ParentLabels = Record<ParentRole, string>;

export const fallbackParentLabels: ParentLabels = {
  PARENT_A: "Hayden Lin",
  PARENT_B: "Constance Xie",
  BOTH: "Both",
};
