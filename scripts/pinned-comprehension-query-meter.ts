import type { Pool } from 'pg';
import type { PrismaService } from '../packages/backend-runtime/src/index';

export type QueryStats = { queryCount: number; returnedRows: number; nonPromiseQueries: number };

export function installQueryMeter(prisma: PrismaService) {
  const pool = Reflect.get(prisma, 'pool') as Pool | undefined;
  if (!pool) throw new Error('The proof could not access the test database pool for measurement.');
  let active: QueryStats | undefined;
  pool.on('connect', client => {
    const original = client.query.bind(client);
    client.query = ((...args: unknown[]) => {
      const sample = active;
      if (sample) sample.queryCount += 1;
      const queryArgs = [...args];
      const callback = queryArgs.at(-1);
      if (typeof callback === 'function') {
        queryArgs[queryArgs.length - 1] = (...callbackArgs: unknown[]) => {
          const response = callbackArgs[1] as { rows?: unknown[] } | undefined;
          if (sample) sample.returnedRows += response?.rows?.length ?? 0;
          return Reflect.apply(callback, client, callbackArgs);
        };
      }
      const result: unknown = Reflect.apply(original, client, queryArgs);
      if (typeof callback === 'function') return result;
      if (!result || typeof result !== 'object' || !('then' in result) ||
        typeof result.then !== 'function') {
        if (sample) sample.nonPromiseQueries += 1;
        return result;
      }
      return (result as Promise<{ rows?: unknown[] }>).then(response => {
        if (sample) sample.returnedRows += response.rows?.length ?? 0;
        return response;
      });
    }) as typeof client.query;
  });
  return async <T>(operation: () => Promise<T>): Promise<{ result: T; stats: QueryStats }> => {
    const stats = { queryCount: 0, returnedRows: 0, nonPromiseQueries: 0 };
    active = stats;
    try { return { result: await operation(), stats }; }
    finally { active = undefined; }
  };
}
