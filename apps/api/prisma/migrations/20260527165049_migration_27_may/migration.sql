-- CreateEnum
CREATE TYPE "ScanJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScanJobStage" AS ENUM ('WAITING', 'CLONING_REPO', 'RESOLVING_SOURCE_REF', 'DETECTING_PROJECT', 'FILTERING_FILES', 'EXTRACTING_ARTIFACTS', 'BUILDING_GRAPH', 'GENERATING_SUMMARIES', 'DONE');

-- CreateEnum
CREATE TYPE "SnapshotCoverageStatus" AS ENUM ('READY', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ResolvedRefType" AS ENUM ('BRANCH', 'TAG', 'COMMIT');

-- CreateEnum
CREATE TYPE "RequirementReadinessStatus" AS ENUM ('DRAFT', 'READY_FOR_ANALYSIS', 'NEEDS_CLARIFICATION', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImpactAnalysisStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_FOR_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImpactAnalysisStage" AS ENUM ('WAITING', 'RETRIEVING_EVIDENCE', 'EXPANDING_GRAPH', 'RUNNING_AI_REASONING', 'GENERATING_INSIGHTS', 'GENERATING_DOCUMENTS', 'DONE');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('CODE', 'TEST', 'STATIC_ANALYSIS', 'REQUIREMENT_INPUT', 'COVERAGE', 'HUMAN_NOTE');

-- CreateEnum
CREATE TYPE "InsightCertainty" AS ENUM ('EVIDENCED', 'INFERRED', 'UNKNOWN', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('CLAIM', 'UNKNOWN', 'QUESTION', 'ACCEPTANCE_CRITERIA', 'QA_SCENARIO');

-- CreateEnum
CREATE TYPE "TraceabilityLinkType" AS ENUM ('AFFECTED', 'RELATED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IMPACT_REPORT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NEEDS_REVIEW', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TraceabilityLinkBasis" AS ENUM ('EVIDENCED', 'INFERRED');

-- CreateEnum
CREATE TYPE "DependencyEdgeType" AS ENUM ('CALLS', 'REFERENCES', 'IMPORTS', 'TESTS');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryTarget" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "requestedRef" TEXT NOT NULL,
    "resolvedRefType" "ResolvedRefType" NOT NULL,
    "latestObservedCommitSha" TEXT NOT NULL,
    "lastObservedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositorySnapshot" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "analyzerVersion" TEXT NOT NULL,
    "coverageStatus" "SnapshotCoverageStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestedRef" TEXT,
    "status" "ScanJobStatus" NOT NULL,
    "stage" "ScanJobStage" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sourceTargetId" TEXT,
    "snapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeArtifact" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "startLine" INTEGER,
    "endLine" INTEGER,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DependencyEdge" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "fromArtifactId" TEXT NOT NULL,
    "toArtifactId" TEXT NOT NULL,
    "type" "DependencyEdgeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DependencyEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "provenanceKey" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "snapshotId" TEXT,
    "artifactId" TEXT,
    "requirementRevisionId" TEXT,
    "sourcePath" TEXT,
    "startLine" INTEGER,
    "endLine" INTEGER,
    "excerpt" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "isRedacted" BOOLEAN NOT NULL DEFAULT false,
    "redactionMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementRevision" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "readinessStatus" "RequirementReadinessStatus" NOT NULL,
    "validationIssues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactAnalysis" (
    "id" TEXT NOT NULL,
    "requirementRevisionId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "sourceTargetId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "status" "ImpactAnalysisStatus" NOT NULL,
    "stage" "ImpactAnalysisStage" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "acceptedPartialCoverage" BOOLEAN NOT NULL DEFAULT false,
    "coverageWarning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaInsight" (
    "id" TEXT NOT NULL,
    "impactAnalysisId" TEXT NOT NULL,
    "insightKey" TEXT NOT NULL,
    "insightType" "InsightType" NOT NULL,
    "certainty" "InsightCertainty" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightEvidence" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "InsightEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceabilityLink" (
    "id" TEXT NOT NULL,
    "impactAnalysisId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "linkType" "TraceabilityLinkType" NOT NULL,
    "linkBasis" "TraceabilityLinkBasis" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraceabilityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceabilityEvidence" (
    "id" TEXT NOT NULL,
    "traceabilityLinkId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "TraceabilityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "impactAnalysisId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Repository_projectId_canonicalUrl_key" ON "Repository"("projectId", "canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryTarget_repositoryId_targetKey_key" ON "RepositoryTarget"("repositoryId", "targetKey");

-- CreateIndex
CREATE UNIQUE INDEX "RepositorySnapshot_repositoryId_commitSha_analyzerVersion_key" ON "RepositorySnapshot"("repositoryId", "commitSha", "analyzerVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ScanJob_repositoryId_requestKey_key" ON "ScanJob"("repositoryId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CodeArtifact_snapshotId_artifactKey_key" ON "CodeArtifact"("snapshotId", "artifactKey");

-- CreateIndex
CREATE UNIQUE INDEX "DependencyEdge_snapshotId_fromArtifactId_toArtifactId_type_key" ON "DependencyEdge"("snapshotId", "fromArtifactId", "toArtifactId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_provenanceKey_key" ON "Evidence"("provenanceKey");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactAnalysis_requirementRevisionId_snapshotId_sourceTarge_key" ON "ImpactAnalysis"("requirementRevisionId", "snapshotId", "sourceTargetId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "BaInsight_impactAnalysisId_insightKey_key" ON "BaInsight"("impactAnalysisId", "insightKey");

-- CreateIndex
CREATE UNIQUE INDEX "InsightEvidence_insightId_evidenceId_key" ON "InsightEvidence"("insightId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "TraceabilityLink_impactAnalysisId_artifactId_linkType_key" ON "TraceabilityLink"("impactAnalysisId", "artifactId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "TraceabilityEvidence_traceabilityLinkId_evidenceId_key" ON "TraceabilityEvidence"("traceabilityLinkId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_impactAnalysisId_type_status_key" ON "GeneratedDocument"("impactAnalysisId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DomainEvent_idempotencyKey_key" ON "DomainEvent"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryTarget" ADD CONSTRAINT "RepositoryTarget_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositorySnapshot" ADD CONSTRAINT "RepositorySnapshot_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_sourceTargetId_fkey" FOREIGN KEY ("sourceTargetId") REFERENCES "RepositoryTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeArtifact" ADD CONSTRAINT "CodeArtifact_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyEdge" ADD CONSTRAINT "DependencyEdge_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyEdge" ADD CONSTRAINT "DependencyEdge_fromArtifactId_fkey" FOREIGN KEY ("fromArtifactId") REFERENCES "CodeArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyEdge" ADD CONSTRAINT "DependencyEdge_toArtifactId_fkey" FOREIGN KEY ("toArtifactId") REFERENCES "CodeArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CodeArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_requirementRevisionId_fkey" FOREIGN KEY ("requirementRevisionId") REFERENCES "RequirementRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementRevision" ADD CONSTRAINT "RequirementRevision_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_requirementRevisionId_fkey" FOREIGN KEY ("requirementRevisionId") REFERENCES "RequirementRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_sourceTargetId_fkey" FOREIGN KEY ("sourceTargetId") REFERENCES "RepositoryTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaInsight" ADD CONSTRAINT "BaInsight_impactAnalysisId_fkey" FOREIGN KEY ("impactAnalysisId") REFERENCES "ImpactAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightEvidence" ADD CONSTRAINT "InsightEvidence_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "BaInsight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightEvidence" ADD CONSTRAINT "InsightEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceabilityLink" ADD CONSTRAINT "TraceabilityLink_impactAnalysisId_fkey" FOREIGN KEY ("impactAnalysisId") REFERENCES "ImpactAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceabilityLink" ADD CONSTRAINT "TraceabilityLink_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CodeArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceabilityEvidence" ADD CONSTRAINT "TraceabilityEvidence_traceabilityLinkId_fkey" FOREIGN KEY ("traceabilityLinkId") REFERENCES "TraceabilityLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceabilityEvidence" ADD CONSTRAINT "TraceabilityEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_impactAnalysisId_fkey" FOREIGN KEY ("impactAnalysisId") REFERENCES "ImpactAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
