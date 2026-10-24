-- The code-first comprehension projection traverses reverse CALLS/TESTS edges
-- and then loads same-snapshot evidence by artifact. Keep those bounded reads
-- index-backed without changing persisted identities or response contracts.
CREATE INDEX "DependencyEdge_snapshotId_toArtifactId_type_idx"
ON "DependencyEdge"("snapshotId", "toArtifactId", "type");

CREATE INDEX "Evidence_snapshotId_artifactId_idx"
ON "Evidence"("snapshotId", "artifactId");
