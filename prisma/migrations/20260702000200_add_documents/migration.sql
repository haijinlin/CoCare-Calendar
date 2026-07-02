CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "blobPathname" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Document_familyId_documentDate_idx" ON "Document"("familyId", "documentDate");
CREATE INDEX "Document_uploadedById_createdAt_idx" ON "Document"("uploadedById", "createdAt");

ALTER TABLE "Document" ADD CONSTRAINT "Document_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
