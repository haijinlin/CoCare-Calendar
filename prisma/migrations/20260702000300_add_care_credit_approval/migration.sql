ALTER TABLE "CareCredit" ADD COLUMN "requestedById" TEXT;
ALTER TABLE "CareCredit" ADD COLUMN "respondedById" TEXT;

CREATE INDEX "CareCredit_requestedById_createdAt_idx" ON "CareCredit"("requestedById", "createdAt");

ALTER TABLE "CareCredit" ADD CONSTRAINT "CareCredit_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CareCredit" ADD CONSTRAINT "CareCredit_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
