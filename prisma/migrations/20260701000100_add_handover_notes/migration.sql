CREATE TABLE "HandoverNote" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "noteDate" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HandoverNote_familyId_noteDate_idx" ON "HandoverNote"("familyId", "noteDate");
CREATE INDEX "HandoverNote_authorUserId_createdAt_idx" ON "HandoverNote"("authorUserId", "createdAt");

ALTER TABLE "HandoverNote" ADD CONSTRAINT "HandoverNote_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HandoverNote" ADD CONSTRAINT "HandoverNote_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
