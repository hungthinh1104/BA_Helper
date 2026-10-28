import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { seedDemo } from './fixtures/seed'
import { login } from './fixtures/auth'

const VIEWPORTS = [320, 375, 768, 1024, 1440]
const ACCESSIBILITY_VIEWPORTS = [375, 1440]
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const THEMES = ['light', 'dark'] as const
const axeSource = readFileSync(resolve(process.cwd(), 'node_modules/axe-core/axe.min.js'), 'utf8')

type AxeNode = {
  target: string[]
  html: string
  failureSummary?: string
}

type AxeViolation = {
  id: string
  impact: string | null
  help: string
  nodes: AxeNode[]
}

type AxeRun = {
  run: (
    context: Document,
    options: { runOnly: { type: 'tag'; values: string[] } },
  ) => Promise<{ violations: AxeViolation[] }>
}

test('critical workspace screens pass responsive overflow and WCAG accessibility checks', async ({ page }) => {
  test.setTimeout(600_000)
  const seed = seedDemo()
  await login(page, seed)

  const screens = [
    { name: 'analysis review', path: `/analyses/${seed.analysisId}?view=review&locale=en-US` },
    { name: 'multi-repo runs', path: '/analyses/runs' },
    { name: 'reports', path: `/reports?analysisId=${seed.completedAnalysisId}` },
    { name: 'print report', path: `/reports/${seed.completedAnalysisId}/print` },
    { name: 'repository detail', path: `/repositories/${seed.repositoryId}` },
    {
      name: 'code comprehension',
      path: `/repositories/${seed.repositoryId}/snapshots/${seed.snapshotId}/artifacts/${seed.artifactId}`,
    },
    { name: 'requirement detail', path: `/requirements/${seed.requirementId}` },
    { name: 'profile settings', path: '/settings/profile' },
    { name: 'member settings', path: '/settings/members' },
  ]
  const overflowIssues: string[] = []
  const accessibilityIssues: string[] = []

  for (const screen of screens) {
    await test.step(`open ${screen.name}`, async () => {
      const response = await page.goto(screen.path, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${screen.path} returned a server error`).toBeLessThan(500)
      await expect(page.locator('main').first()).toBeVisible()
    })

    for (const theme of THEMES) {
      await test.step(`${screen.name} in ${theme} theme`, async () => {
        await page.evaluate((selectedTheme) => localStorage.setItem('theme', selectedTheme), theme)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.locator('main').first()).toBeVisible()
        await expect.poll(() => page.locator('html').evaluate((element) => element.classList.contains('dark')))
          .toBe(theme === 'dark')
      })

      for (const width of VIEWPORTS) {
        await test.step(`${screen.name} ${theme} at ${width}px`, async () => {
          await page.setViewportSize({ width, height: 900 })
          await page.evaluate(() => new Promise<void>((resolveFrame) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
          }))
          const dimensions = await page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          }))
          if (dimensions.documentWidth > dimensions.clientWidth + 1) {
            overflowIssues.push(`${screen.name} ${theme} at ${width}px: page ${dimensions.documentWidth}px, viewport ${dimensions.clientWidth}px`)
          }
        })
      }

      for (const width of ACCESSIBILITY_VIEWPORTS) {
        await test.step(`${screen.name} ${theme} accessibility at ${width}px`, async () => {
          await page.setViewportSize({ width, height: 900 })
          await page.evaluate(() => new Promise<void>((resolveFrame) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
          }))
          await page.addScriptTag({ content: axeSource })
          const violations = await page.evaluate(async (tags) => {
            const axe = (window as unknown as { axe?: AxeRun }).axe
            if (!axe) throw new Error('axe-core did not attach to the page')
            const result = await axe.run(document, { runOnly: { type: 'tag', values: tags } })
            return result.violations
          }, WCAG_TAGS)

          for (const violation of violations) {
            if (violation.impact === 'critical' || violation.impact === 'serious') {
              const details = violation.nodes.slice(0, 3).map((node) => {
                const target = node.target.join(' ')
                const html = node.html.replace(/\s+/g, ' ').slice(0, 140)
                const summary = node.failureSummary?.replace(/\s+/g, ' ').slice(0, 160) ?? ''
                return `${target} ${html} ${summary}`
              }).join(' | ')
              accessibilityIssues.push(
                `${screen.name} ${theme} at ${width}px: ${violation.id} (${violation.impact}) ${violation.help}; ${details}`,
              )
            }
          }
        })
      }
    }
  }

  expect(overflowIssues, 'unexpected horizontal page overflow').toEqual([])
  expect(accessibilityIssues, 'critical or serious WCAG 2.2 A/AA violations').toEqual([])
})
