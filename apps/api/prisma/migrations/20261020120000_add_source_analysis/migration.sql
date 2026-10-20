-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "analysisRunId" TEXT,
    "sourceType" TEXT NOT NULL,
    "repository" TEXT,
    "ref" TEXT,
    "fileCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "totalBytes" INTEGER NOT NULL,
    "limitations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceImpact" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "snippet" TEXT NOT NULL,
    "call" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "matchedMethod" TEXT NOT NULL,
    "matchedPath" TEXT NOT NULL,
    "operationId" TEXT,
    "confidence" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceImpact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceSnapshot_projectId_idx" ON "SourceSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "SourceSnapshot_analysisRunId_idx" ON "SourceSnapshot"("analysisRunId");

-- CreateIndex
CREATE INDEX "SourceSnapshot_createdAt_idx" ON "SourceSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "SourceFile_snapshotId_idx" ON "SourceFile"("snapshotId");

-- CreateIndex
CREATE INDEX "SourceImpact_snapshotId_idx" ON "SourceImpact"("snapshotId");

-- CreateIndex
CREATE INDEX "SourceImpact_filePath_idx" ON "SourceImpact"("filePath");

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SourceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceImpact" ADD CONSTRAINT "SourceImpact_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SourceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
