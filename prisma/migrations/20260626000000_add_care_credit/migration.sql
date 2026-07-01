CREATE TABLE "CareCredit" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "owedByRole" "ParentRole" NOT NULL,
    "owedToRole" "ParentRole" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "remainingMinutes" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sourceRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareCredit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareCredit_familyId_status_idx" ON "CareCredit"("familyId", "status");
CREATE INDEX "CareCredit_owedByRole_owedToRole_idx" ON "CareCredit"("owedByRole", "owedToRole");

ALTER TABLE "CareCredit" ADD CONSTRAINT "CareCredit_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareCredit" ADD CONSTRAINT "CareCredit_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "ChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
