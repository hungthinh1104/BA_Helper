import { execFileSync } from 'node:child_process'
import path from 'node:path'

export interface DemoSeed {
  analysisId: string
  completedAnalysisId: string
  projectId: string
  projectName: string
  requirementId: string
  repositoryId: string
  snapshotId: string
  artifactId: string
  email: string
  password: string
}

/**
 * Runs the demo seed and returns the fresh WAITING_FOR_REVIEW analysis id
 * ("Scenario A"). Re-run per test so each spec gets an open review queue —
 * the desktop journey finalizes Scenario A to COMPLETED.
 */
export function seedDemo(): DemoSeed {
  // Use ts-node directly in the browser harness. The tsx wrapper may call
  // uv_os_get_passwd on constrained CI/Windows workers and fail before the
  // seed process starts; this executes the same seed module without changing
  // production scripts or running target repository code. Avoid invoking
  // pnpm here because its dependency verification can relink node_modules
  // while Playwright servers are already running.
  const repoRoot = path.resolve(__dirname, '../..')
  const apiDirectory = path.join(repoRoot, 'apps/api')
  const tsNodeCli = path.join(repoRoot, 'node_modules/ts-node/dist/bin.js')
  const out = execFileSync(
    process.execPath,
    [tsNodeCli, '--transpile-only', '-r', 'tsconfig-paths/register', '--project', 'tsconfig.json', 'prisma/seed.demo.ts'],
    { cwd: apiDirectory, encoding: 'utf8', timeout: 60_000 },
  )
  const match = /Scenario A \(open review\)\s*:\s*(\S+)/.exec(out)
  const completedAnalysisId = /Scenario B \(finalized\)\s*:\s*(\S+)/.exec(out)?.[1]
  const projectId = /^Project ID:\s*(\S+)/m.exec(out)?.[1]
  const projectName = /^Project\s*:\s*(.+)$/m.exec(out)?.[1]?.trim()
  const requirementId = /^Requirement ID:\s*(\S+)/m.exec(out)?.[1]
  const repositoryId = /^Repository ID:\s*(\S+)/m.exec(out)?.[1]
  const snapshotId = /^Snapshot ID:\s*(\S+)/m.exec(out)?.[1]
  const artifactId = /^Artifact ID:\s*(\S+)/m.exec(out)?.[1]
  if (!match || !completedAnalysisId || !projectId || !projectName || !requirementId || !repositoryId || !snapshotId || !artifactId) {
    throw new Error(`Could not parse the Scenario A analysis id from the seed output:\n${out.slice(-800)}`)
  }
  return {
    analysisId: match[1],
    completedAnalysisId,
    projectId,
    projectName,
    requirementId,
    repositoryId,
    snapshotId,
    artifactId,
    email: 'demo@ba-helper.local',
    password: 'demo-password-2026',
  }
}
