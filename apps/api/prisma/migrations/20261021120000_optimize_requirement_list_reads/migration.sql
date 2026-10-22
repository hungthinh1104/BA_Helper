CREATE INDEX "Requirement_projectId_createdAt_id_idx"
ON "Requirement"("projectId", "createdAt" DESC, "id" DESC);

CREATE INDEX "RequirementRevision_requirementId_createdAt_id_idx"
ON "RequirementRevision"("requirementId", "createdAt" DESC, "id" DESC);
