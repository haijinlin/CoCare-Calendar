import { addDays } from "date-fns";
import { ParentRole } from "@prisma/client";

const sourceUrl = "https://business.vic.gov.au/business-information/public-holidays";

type VicPublicHoliday = {
  name: string;
  date: Date;
  sourceUrl: string;
};

type AssignedVicPublicHoliday = VicPublicHoliday & {
  parentRole: ParentRole;
};

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, occurrence: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const offset = (weekday - firstDay.getDay() + 7) % 7;

  return new Date(year, monthIndex, 1 + offset + (occurrence - 1) * 7);
}

function substituteMonday(date: Date) {
  if (date.getDay() === 6) return addDays(date, 2);
  if (date.getDay() === 0) return addDays(date, 1);

  return date;
}

function addHoliday(holidays: VicPublicHoliday[], name: string, date: Date) {
  holidays.push({ name, date, sourceUrl });
}

// These are the predictable statewide VIC public holidays that can be generated
// without scraping. Easter and Christmas are handled by separate court-order
// rules, and AFL Grand Final Friday is announced yearly, so keep that manual.
export function generateStandardVicPublicHolidays() {
  const holidays: VicPublicHoliday[] = [];

  for (let year = 2026; year <= 2037; year += 1) {
    addHoliday(holidays, "New Year's Day", substituteMonday(new Date(year, 0, 1)));
    addHoliday(holidays, "Australia Day", substituteMonday(new Date(year, 0, 26)));
    addHoliday(holidays, "Labour Day", nthWeekdayOfMonth(year, 2, 1, 2));
    addHoliday(holidays, "ANZAC Day", substituteMonday(new Date(year, 3, 25)));
    addHoliday(holidays, "King's Birthday", nthWeekdayOfMonth(year, 5, 1, 2));
    addHoliday(holidays, "Melbourne Cup", nthWeekdayOfMonth(year, 10, 2, 1));
  }

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function assignPublicHolidayRotation(
  holidays: VicPublicHoliday[],
  firstDate: Date,
  firstParentRole: ParentRole,
): AssignedVicPublicHoliday[] {
  let nextParentRole = firstParentRole;

  return holidays
    .filter((holiday) => holiday.date >= firstDate)
    .map((holiday) => {
      const assigned = { ...holiday, parentRole: nextParentRole };
      nextParentRole = nextParentRole === "PARENT_A" ? "PARENT_B" : "PARENT_A";

      return assigned;
    });
}
