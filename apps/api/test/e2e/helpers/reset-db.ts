import type { PrismaService } from "@ba-helper/backend-runtime";

const MAX_RESET_ATTEMPTS = 3;
const RESET_RETRY_DELAY_MS = 50;

export async function resetDatabase(prisma: PrismaService) {
  // Fetch all table names dynamically
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';
  `;

  // Join table names with double quotes for PostgreSQL
  const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');

  if (tableNames) {
    const truncate = `TRUNCATE TABLE ${tableNames} CASCADE;`;
    for (let attempt = 1; ; attempt += 1) {
      try {
        await prisma.$executeRawUnsafe(truncate);
        return;
      } catch (error) {
        if (attempt >= MAX_RESET_ATTEMPTS || !isTransientResetError(error)) {
          throw error;
        }
        await wait(RESET_RETRY_DELAY_MS * attempt);
      }
    }
  }
}

function isTransientResetError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; message?: unknown };
  };
  const codes = [candidate.code, candidate.meta?.code];
  if (codes.some((code) => code === '40P01' || code === 'P2024')) return true;

  const messages = [candidate.message, candidate.meta?.message]
    .filter((message): message is string => typeof message === 'string')
    .join(' ')
    .toLowerCase();
  return messages.includes('deadlock detected') ||
    messages.includes('timeout exceeded when trying to connect');
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
