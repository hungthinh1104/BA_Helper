-- AlterEnum
ALTER TYPE "RepositoryProfileLanguage" ADD VALUE IF NOT EXISTS 'GO';
ALTER TYPE "RepositoryProfileLanguage" ADD VALUE IF NOT EXISTS 'PYTHON';
ALTER TYPE "RepositoryProfileLanguage" ADD VALUE IF NOT EXISTS 'CSHARP';
ALTER TYPE "RepositoryProfileLanguage" ADD VALUE IF NOT EXISTS 'PHP';
ALTER TYPE "RepositoryProfileLanguage" ADD VALUE IF NOT EXISTS 'RUBY';

-- AlterEnum
ALTER TYPE "RepositoryProfileFramework" ADD VALUE IF NOT EXISTS 'NET_HTTP';
ALTER TYPE "RepositoryProfileFramework" ADD VALUE IF NOT EXISTS 'GIN';
ALTER TYPE "RepositoryProfileFramework" ADD VALUE IF NOT EXISTS 'FASTAPI';
ALTER TYPE "RepositoryProfileFramework" ADD VALUE IF NOT EXISTS 'ASPNETCORE';
ALTER TYPE "RepositoryProfileFramework" ADD VALUE IF NOT EXISTS 'LARAVEL';
ALTER TYPE "RepositoryProfileFramework" ADD VALUE IF NOT EXISTS 'RAILS';
