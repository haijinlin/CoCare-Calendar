ALTER TABLE "CareBlock" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

UPDATE "CareBlock"
SET "source" = 'COURT_ORDER'
WHERE "handoverNote" IS NULL
   OR "handoverNote" LIKE 'Default care%'
   OR "handoverNote" LIKE 'School holiday%'
   OR "handoverNote" LIKE 'Hayden pickup%'
   OR "handoverNote" LIKE 'Alternate weekend%'
   OR "handoverNote" LIKE 'Return to Constance%'
   OR "handoverNote" LIKE 'Returned to Constance%'
   OR "handoverNote" LIKE 'School day before Hayden pickup%'
   OR "handoverNote" LIKE 'Easter%'
   OR "handoverNote" LIKE 'Christmas%'
   OR "handoverNote" LIKE '%birthday%'
   OR "handoverNote" LIKE '%public holiday%';
