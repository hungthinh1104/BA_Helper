import { execSync } from 'node:child_process'

export interface DemoSeed {
  analysisId: string
  email: string
  password: string
}

/**
 * Runs the demo seed and returns the fresh WAITING_FOR_REVIEW analysis id
 * ("Scenario A"). Re-run per test so each spec gets an open review queue —
 * the desktop journey finalizes Scenario A to COMPLETED.
 */
export function seedDemo(): DemoSeed {
  const out = execSync('pnpm db:seed:demo', { encoding: 'utf8' })
  const match = /Scenario A \(open review\)\s*:\s*(\S+)/.exec(out)
  if (!match) {
    throw new Error(`Could not parse the Scenario A analysis id from the seed output:\n${out.slice(-800)}`)
  }
  return {
    analysisId: match[1],
    email: 'demo@ba-helper.local',
    password: 'demo-password-2026',
  }
}
