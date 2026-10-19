-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('completed', 'failed');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "label" TEXT,
    "format" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "openapiVersion" TEXT,
    "title" TEXT,
    "infoVersion" TEXT,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "baselineVersionId" TEXT NOT NULL,
    "candidateVersionId" TEXT NOT NULL,
    "label" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'completed',
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "totalFindings" INTEGER NOT NULL,
    "nonBreakingCount" INTEGER NOT NULL,
    "potentiallyBreakingCount" INTEGER NOT NULL,
    "unknownCount" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "limitations" JSONB,
    "baselineSummary" JSONB,
    "candidateSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "engineId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "path" TEXT,
    "method" TEXT,
    "operationId" TEXT,
    "location" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_projectId_idx" ON "Contract"("projectId");

-- CreateIndex
CREATE INDEX "ContractVersion_contractId_idx" ON "ContractVersion"("contractId");

-- CreateIndex
CREATE INDEX "ContractVersion_checksum_idx" ON "ContractVersion"("checksum");

-- CreateIndex
CREATE INDEX "AnalysisRun_projectId_idx" ON "AnalysisRun"("projectId");

-- CreateIndex
CREATE INDEX "AnalysisRun_createdAt_idx" ON "AnalysisRun"("createdAt");

-- CreateIndex
CREATE INDEX "Finding_analysisRunId_idx" ON "Finding"("analysisRunId");

-- CreateIndex
CREATE INDEX "Finding_risk_idx" ON "Finding"("risk");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_analysisRunId_engineId_key" ON "Finding"("analysisRunId", "engineId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_baselineVersionId_fkey" FOREIGN KEY ("baselineVersionId") REFERENCES "ContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_candidateVersionId_fkey" FOREIGN KEY ("candidateVersionId") REFERENCES "ContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

