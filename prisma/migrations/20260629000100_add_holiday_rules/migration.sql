CREATE TABLE "SchoolHolidayPeriod" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolHolidayPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicHolidayRule" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "parentRole" "ParentRole" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicHolidayRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchoolHolidayPeriod_familyId_year_idx" ON "SchoolHolidayPeriod"("familyId", "year");
CREATE INDEX "SchoolHolidayPeriod_familyId_startsOn_endsOn_idx" ON "SchoolHolidayPeriod"("familyId", "startsOn", "endsOn");
CREATE INDEX "PublicHolidayRule_familyId_date_idx" ON "PublicHolidayRule"("familyId", "date");

ALTER TABLE "SchoolHolidayPeriod" ADD CONSTRAINT "SchoolHolidayPeriod_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicHolidayRule" ADD CONSTRAINT "PublicHolidayRule_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
