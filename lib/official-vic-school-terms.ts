import { addDays, format, subDays } from "date-fns";

const sourceUrl = "https://www.vic.gov.au/school-term-dates-and-holidays-victoria";

const monthIndexes: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

type TermDate = {
  start: Date;
  finish: Date;
};

type TermDatesByYear = Record<number, TermDate[]>;

export type OfficialSchoolHolidayPeriod = {
  year: number;
  label: string;
  startsOn: Date;
  endsOn: Date;
  sourceUrl: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseDate(year: number, day: string, month: string) {
  const monthIndex = monthIndexes[month.toLowerCase()];
  if (monthIndex === undefined) {
    throw new Error(`Unknown month: ${month}`);
  }

  return new Date(year, monthIndex, Number(day));
}

function textFromHtml(html: string) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTerms(text: string) {
  const years: TermDatesByYear = {};

  for (let year = 2026; year <= 2030; year += 1) {
    const startMarker = `${year} Victorian school term dates`;
    const nextMarker = `${year + 1} Victorian school term dates`;
    const startIndex = text.indexOf(startMarker);

    if (startIndex === -1) continue;

    const nextIndex = text.indexOf(nextMarker, startIndex + startMarker.length);
    const section = text.slice(startIndex, nextIndex === -1 ? undefined : nextIndex);
    const termPattern =
      /Term\s+([1-4])\s+[A-Za-z]+\s+(\d{1,2})\s+([A-Za-z]+)(?:\s+\(students start\s+[A-Za-z]+\s+(\d{1,2})\s+([A-Za-z]+)[^)]+\))?\s+([A-Za-z]+)\s+(\d{1,2})\s+([A-Za-z]+)/g;
    const terms: TermDate[] = [];
    let match: RegExpExecArray | null;

    while ((match = termPattern.exec(section)) !== null) {
      const termNumber = Number(match[1]);
      const startDay = match[4] ?? match[2];
      const startMonth = match[5] ?? match[3];
      const finishDay = match[7];
      const finishMonth = match[8];

      terms[termNumber - 1] = {
        start: parseDate(year, startDay, startMonth),
        finish: parseDate(year, finishDay, finishMonth),
      };
    }

    if (terms.filter(Boolean).length === 4) {
      years[year] = terms;
    }
  }

  return years;
}

function holidayLabel(index: number) {
  if (index === 0) return "Autumn holidays";
  if (index === 1) return "Winter holidays";
  if (index === 2) return "Spring holidays";
  return "Summer holidays";
}

export async function fetchOfficialVicSchoolHolidays() {
  const response = await fetch(sourceUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch VIC school term dates: ${response.status}`);
  }

  const text = textFromHtml(await response.text());
  const termsByYear = parseTerms(text);
  const periods: OfficialSchoolHolidayPeriod[] = [];

  for (let year = 2026; year <= 2030; year += 1) {
    const terms = termsByYear[year];
    if (!terms) continue;

    for (let index = 0; index < 3; index += 1) {
      periods.push({
        year,
        label: holidayLabel(index),
        startsOn: addDays(terms[index].finish, 1),
        endsOn: subDays(terms[index + 1].start, 1),
        sourceUrl,
      });
    }

    const nextYearTerms = termsByYear[year + 1];
    if (nextYearTerms) {
      periods.push({
        year,
        label: holidayLabel(3),
        startsOn: addDays(terms[3].finish, 1),
        endsOn: subDays(nextYearTerms[0].start, 1),
        sourceUrl,
      });
    }
  }

  if (periods.length === 0) {
    throw new Error("No VIC school holiday periods could be parsed from the official page.");
  }

  return periods.map((period) => ({
    ...period,
    key: `${period.year}-${period.label}-${format(period.startsOn, "yyyy-MM-dd")}`,
  }));
}
