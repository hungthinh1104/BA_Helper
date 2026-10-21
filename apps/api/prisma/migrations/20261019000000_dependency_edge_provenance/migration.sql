-- Additive: historical edges retain unknown confidence/provenance.
ALTER TABLE "DependencyEdge"
ADD COLUMN "confidence" DOUBLE PRECISION,
ADD COLUMN "metadata" JSONB;

ALTER TABLE "DependencyEdge" ADD CONSTRAINT "DependencyEdge_confidence_range"
CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
