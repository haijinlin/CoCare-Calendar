import { ParentRole } from "@prisma/client";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  isSameDay,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";

type GeneratedCareBlock = {
  parentRole: ParentRole;
  startsAt: Date;
  endsAt: Date;
  handoverNote: string | null;
};

type SchoolHolidayInput = {
  start: string | Date;
  end: string | Date;
  year: number;
  label?: string | null;
};

type PublicHolidayInput = {
  date: string | Date;
  parentRole: ParentRole;
  name: string;
};

type CourtOrderScheduleOptions = {
  schoolHolidays?: SchoolHolidayInput[];
  publicHolidays?: PublicHolidayInput[];
};

type DayAssignment = {
  parentRole: ParentRole;
  note: string | null;
  priority: number;
};

const applicant: ParentRole = "PARENT_A";
const respondent: ParentRole = "PARENT_B";
const scheduleStart = dateOnly(2026, 4, 1);
const scheduleEnd = dateOnly(2037, 12, 31);
const schoolHolidayYears = new Set([2026, 2027]);

const vicSchoolHolidays: SchoolHolidayInput[] = [
  { start: "2026-04-03", end: "2026-04-19", year: 2026 },
  { start: "2026-06-26", end: "2026-07-12", year: 2026 },
  { start: "2026-09-18", end: "2026-10-04", year: 2026 },
  { start: "2026-12-18", end: "2027-01-27", year: 2026 },
  { start: "2027-03-26", end: "2027-04-11", year: 2027 },
  { start: "2027-06-25", end: "2027-07-11", year: 2027 },
  { start: "2027-09-17", end: "2027-10-03", year: 2027 },
  { start: "2027-12-17", end: "2028-01-27", year: 2027 },
];

const publicHolidayRotation2026: PublicHolidayInput[] = [
  { date: "2026-06-08", parentRole: respondent, name: "King's Birthday" },
  { date: "2026-09-25", parentRole: applicant, name: "Friday before the AFL Grand Final" },
  { date: "2026-11-03", parentRole: respondent, name: "Melbourne Cup" },
  { date: "2027-01-01", parentRole: applicant, name: "New Year's Day" },
  { date: "2027-01-26", parentRole: respondent, name: "Australia Day" },
  { date: "2027-03-08", parentRole: applicant, name: "Labour Day" },
  { date: "2027-04-25", parentRole: respondent, name: "ANZAC Day" },
  { date: "2027-06-14", parentRole: applicant, name: "King's Birthday" },
  { date: "2027-11-02", parentRole: respondent, name: "Melbourne Cup" },
];

function dateOnly(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

function datePartsInVictoria(value: Date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function toDate(value: string | Date) {
  if (typeof value === "string") {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return dateOnly(year, month, day);
  }

  const { year, month, day } = datePartsInVictoria(value);
  return dateOnly(year, month, day);
}

function at(date: Date, hours: number, minutes = 0) {
  return setMinutes(setHours(date, hours), minutes);
}

function key(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function setAssignment(
  assignments: Map<string, DayAssignment>,
  date: Date,
  parentRole: ParentRole,
  note: string | null,
  priority: number,
) {
  const dayKey = key(date);
  const current = assignments.get(dayKey);

  if (!current || priority >= current.priority) {
    assignments.set(dayKey, { parentRole, note, priority });
  }
}

function applySchoolHoliday(
  assignments: Map<string, DayAssignment>,
  startDate: Date,
  endDate: Date,
  year: number,
  label?: string | null,
) {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const firstHalfLength = Math.ceil(days.length / 2);

  days.forEach((date, index) => {
    const isFirstHalf = index < firstHalfLength;
    const parentRole =
      year % 2 === 0
        ? isFirstHalf
          ? respondent
          : applicant
        : isFirstHalf
          ? applicant
          : respondent;

    setAssignment(
      assignments,
      date,
      parentRole,
      `${label ? `${label} - ` : ""}School holiday ${isFirstHalf ? "first" : "second"} half`,
      20,
    );
  });
}

function applyAlternateWeekends(assignments: Map<string, DayAssignment>, schoolHolidays: SchoolHolidayInput[]) {
  const firstFriday = dateOnly(2026, 5, 1);
  let isHaydenWeekend = true;

  for (let friday = firstFriday; !isAfter(friday, scheduleEnd); friday = addDays(friday, 7)) {
    const saturday = addDays(friday, 1);
    const sunday = addDays(friday, 2);
    const isSuspendedBySchoolHoliday = [friday, saturday, sunday].some((date) =>
      isSchoolHolidayDate(date, schoolHolidays),
    );

    if (isSuspendedBySchoolHoliday) {
      continue;
    }

    if (isHaydenWeekend) {
      setAssignment(assignments, friday, applicant, "Hayden pickup from school at 3:30pm", 10);
      setAssignment(assignments, saturday, applicant, "Alternate weekend with Hayden", 10);
      setAssignment(assignments, sunday, applicant, "Return to Constance by 8:00pm", 10);
    }

    isHaydenWeekend = !isHaydenWeekend;
  }
}

function isSchoolHolidayDate(date: Date, schoolHolidays: SchoolHolidayInput[]) {
  return schoolHolidays.some((period) => {
    const start = toDate(period.start);
    const end = toDate(period.end);

    return !isBefore(date, start) && !isAfter(date, end);
  });
}

export function hasVicSchoolHolidayData(year: number) {
  return schoolHolidayYears.has(year);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, occurrence: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const offset = (weekday - firstDay.getDay() + 7) % 7;

  return new Date(year, monthIndex, 1 + offset + (occurrence - 1) * 7);
}

function applySpecialDays(assignments: Map<string, DayAssignment>, publicHolidays: PublicHolidayInput[]) {
  for (let year = 2026; year <= 2037; year += 1) {
    const isEvenYear = year % 2 === 0;
    const easter = easterSunday(year);
    const easterDates = eachDayOfInterval({
      start: addDays(easter, -2),
      end: addDays(easter, 1),
    });
    const easterParent = isEvenYear ? respondent : applicant;
    const christmasParent = isEvenYear ? applicant : respondent;

    easterDates.forEach((date) =>
      setAssignment(
        assignments,
        date,
        easterParent,
        `Easter with ${isEvenYear ? "Constance" : "Hayden"} in ${isEvenYear ? "even" : "odd"} years`,
        40,
      ),
    );

    eachDayOfInterval({
      start: new Date(year, 11, 24),
      end: new Date(year, 11, 26),
    }).forEach((date) =>
      setAssignment(
        assignments,
        date,
        christmasParent,
        `Christmas with ${isEvenYear ? "Hayden" : "Constance"} in ${isEvenYear ? "even" : "odd"} years`,
        40,
      ),
    );

    setAssignment(assignments, nthWeekdayOfMonth(year, 4, 0, 2), respondent, "Mother's Day", 40);
    setAssignment(assignments, new Date(year, 5, 28), respondent, "Constance birthday", 45);
    setAssignment(assignments, new Date(year, 7, 1), applicant, "Hayden birthday", 45);
    setAssignment(assignments, nthWeekdayOfMonth(year, 8, 0, 1), applicant, "Father's Day", 40);
    setAssignment(assignments, new Date(year, 9, 3), "BOTH", "Derick birthday 11:30am to 8:30pm", 50);
  }

  publicHolidays.forEach((holiday) => {
    setAssignment(
      assignments,
      toDate(holiday.date),
      holiday.parentRole,
      `${holiday.name} public holiday`,
      30,
    );
  });
}

function isHaydenNonSchoolDayAssignment(assignment: DayAssignment) {
  const note = assignment.note ?? "";

  return (
    assignment.parentRole === applicant &&
    !note.includes("pickup from school") &&
    (note.includes("School holiday") ||
      note.includes("public holiday") ||
      note.includes("Father's Day") ||
      note.includes("Hayden birthday") ||
      note.includes("Easter with Hayden") ||
      note.includes("Christmas with Hayden"))
  );
}

function startsHaydenNonSchoolCare(
  assignments: Map<string, DayAssignment>,
  date: Date,
  assignment: DayAssignment,
) {
  if (!isHaydenNonSchoolDayAssignment(assignment)) return false;

  const previous = assignments.get(key(addDays(date, -1)));

  return !previous || previous.parentRole !== assignment.parentRole;
}

export function generateCourtOrderCareBlocks2026(options: CourtOrderScheduleOptions = {}): GeneratedCareBlock[] {
  const schoolHolidays = [...vicSchoolHolidays, ...(options.schoolHolidays ?? [])];
  const publicHolidays = [...publicHolidayRotation2026, ...(options.publicHolidays ?? [])];
  const assignments = new Map<string, DayAssignment>();

  eachDayOfInterval({ start: scheduleStart, end: scheduleEnd }).forEach((date) => {
    setAssignment(assignments, date, respondent, "Default care with Constance", 0);
  });

  applyAlternateWeekends(assignments, schoolHolidays);

  schoolHolidays.forEach((period) => {
    applySchoolHoliday(
      assignments,
      toDate(period.start),
      toDate(period.end),
      period.year,
      period.label,
    );
  });

  applySpecialDays(assignments, publicHolidays);

  const days = eachDayOfInterval({ start: scheduleStart, end: scheduleEnd });
  const blocks: GeneratedCareBlock[] = [];

  days.forEach((date) => {
    const assignment = assignments.get(key(date));

    if (!assignment) {
      return;
    }

    const startsAt930 = startsHaydenNonSchoolCare(assignments, date, assignment);

    blocks.push({
      parentRole: assignment.parentRole,
      startsAt: assignment.note?.includes("pickup from school")
        ? at(startOfDay(date), 15, 30)
        : startsAt930
          ? at(startOfDay(date), 9, 30)
        : at(startOfDay(date), 0),
      endsAt: assignment.note?.includes("Return to Constance")
        ? at(startOfDay(date), 20)
        : at(addDays(startOfDay(date), 1), 0),
      handoverNote: assignment.note,
    });

    if (assignment.note?.includes("pickup from school")) {
      blocks.push({
        parentRole: respondent,
        startsAt: at(startOfDay(date), 0),
        endsAt: at(startOfDay(date), 15, 30),
        handoverNote: "School day before Hayden pickup",
      });
    }

    if (startsAt930) {
      blocks.push({
        parentRole: respondent,
        startsAt: at(startOfDay(date), 0),
        endsAt: at(startOfDay(date), 9, 30),
        handoverNote: "Non-school day before Hayden pickup",
      });
    }

    if (assignment.note?.includes("Return to Constance")) {
      blocks.push({
        parentRole: respondent,
        startsAt: at(startOfDay(date), 20),
        endsAt: at(addDays(startOfDay(date), 1), 0),
        handoverNote: "Returned to Constance by 8:00pm",
      });
    }
  });

  return mergeAdjacentBlocks(blocks.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()));
}

function mergeAdjacentBlocks(blocks: GeneratedCareBlock[]) {
  return blocks.reduce<GeneratedCareBlock[]>((merged, block) => {
    const previous = merged.at(-1);
    const canMerge =
      previous &&
      previous.parentRole === block.parentRole &&
      previous.handoverNote === block.handoverNote &&
      isSameDay(previous.endsAt, block.startsAt) &&
      differenceInCalendarDays(block.startsAt, previous.endsAt) === 0 &&
      !isBefore(block.startsAt, previous.endsAt);

    if (canMerge) {
      previous.endsAt = block.endsAt;
      return merged;
    }

    merged.push({ ...block });
    return merged;
  }, []);
}
