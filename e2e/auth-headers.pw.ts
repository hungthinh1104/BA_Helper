import { test, expect } from '@playwright/test'

test('malformed bearer headers remain unauthenticated without crashing the web proxy', async ({ request }) => {
  for (const authorization of ['Bearer %', 'Bearer %E0%A4%A', 'Bearer %GG', 'Bearer invalid-token']) {
    const response = await request.get('/analyses', {
      headers: { authorization }, maxRedirects: 0,
    })
    expect([302, 307]).toContain(response.status())
    expect(new URL(response.headers().location, response.url()).pathname).toBe('/login')
  }
})
