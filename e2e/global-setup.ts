import { execSync } from 'node:child_process'

/** Apply migrations once before the suite (idempotent against the running dev DB). */
export default async function globalSetup(): Promise<void> {
  execSync('pnpm db:migrate', { stdio: 'inherit' })
}
