CREATE TYPE "SpecialEventStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE "SpecialEvent" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "organizerUserId" TEXT NOT NULL,
  "inviteeUserId" TEXT NOT NULL,
  "respondedById" TEXT,
  "status" "SpecialEventStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "responseNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SpecialEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpecialEvent_familyId_status_idx" ON "SpecialEvent"("familyId", "status");
CREATE INDEX "SpecialEvent_familyId_startsAt_endsAt_idx" ON "SpecialEvent"("familyId", "startsAt", "endsAt");
CREATE INDEX "SpecialEvent_organizerUserId_createdAt_idx" ON "SpecialEvent"("organizerUserId", "createdAt");
CREATE INDEX "SpecialEvent_inviteeUserId_createdAt_idx" ON "SpecialEvent"("inviteeUserId", "createdAt");

ALTER TABLE "SpecialEvent" ADD CONSTRAINT "SpecialEvent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialEvent" ADD CONSTRAINT "SpecialEvent_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialEvent" ADD CONSTRAINT "SpecialEvent_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialEvent" ADD CONSTRAINT "SpecialEvent_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
