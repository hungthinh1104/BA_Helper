-- Keep bounded production-artifact discovery and outgoing graph reads index-backed.
CREATE INDEX "CodeArtifact_snapshotId_artifactType_artifactKey_idx"
ON "CodeArtifact"("snapshotId", "artifactType", "artifactKey");

CREATE INDEX "DependencyEdge_snapshotId_fromArtifactId_type_idx"
ON "DependencyEdge"("snapshotId", "fromArtifactId", "type");
