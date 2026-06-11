CREATE TYPE "RepositoryProfileDomain" AS ENUM (
  'BOOKING',
  'PAYMENT',
  'REFUND',
  'NOTIFICATION',
  'INVENTORY',
  'CUSTOM',
  'UNKNOWN'
);

CREATE TYPE "RepositoryProfileLanguage" AS ENUM (
  'TYPESCRIPT',
  'UNKNOWN'
);

CREATE TYPE "RepositoryProfileFramework" AS ENUM (
  'NESTJS',
  'GENERIC_TYPESCRIPT',
  'UNKNOWN'
);

CREATE TYPE "RepositoryProfileArchitectureStyle" AS ENUM (
  'MODULAR_MONOLITH',
  'LAYERED',
  'UNKNOWN'
);

CREATE TABLE "repository_profile" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "domain" "RepositoryProfileDomain" NOT NULL,
  "language" "RepositoryProfileLanguage" NOT NULL,
  "framework" "RepositoryProfileFramework" NOT NULL,
  "architecture_style" "RepositoryProfileArchitectureStyle" NOT NULL,
  "source_roots" JSONB NOT NULL,
  "test_roots" JSONB NOT NULL,
  "diagnostics" JSONB,
  "profile_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "repository_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repository_profile_snapshotId_key" ON "repository_profile"("snapshotId");

ALTER TABLE "repository_profile"
ADD CONSTRAINT "repository_profile_snapshotId_fkey"
FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
