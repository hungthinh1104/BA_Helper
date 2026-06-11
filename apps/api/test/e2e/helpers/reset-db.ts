import { PrismaService } from '../../../src/modules/prisma/prisma.service';

export async function resetDatabase(prisma: PrismaService) {
  // Fetch all table names dynamically
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';
  `;

  // Join table names with double quotes for PostgreSQL
  const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');

  if (tableNames) {
    // Truncate all tables and cascade to clean everything
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} CASCADE;`);
  }
}
