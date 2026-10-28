import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, jest } from "@jest/globals"

let mockPathname = "/"

jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }))
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} onClick={(event) => { event.preventDefault(); mockPathname = href }}>{children}</a>
  ),
}))
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
jest.mock("@/i18n/navigation", () => ({ useLocalizedHref: () => (path: string) => path }))
jest.mock("@/hooks/api/use-system", () => ({ useSystemReadiness: () => ({ isLoading: false, isError: false, isSuccess: true }) }))
jest.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, logout: jest.fn() }) }))
jest.mock("@/lib/project-context", () => ({
  useWorkspaceRuntime: () => ({
    name: "Workspace",
    projectId: "project-1",
    membershipRole: "ANALYST",
    mode: "DEV",
    projects: [],
    switchingProjectId: null,
    switchProject: jest.fn(),
  }),
}))
jest.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => <button>Theme</button> }))
jest.mock("@/components/i18n/locale-switcher", () => ({ LocaleSwitcher: () => <button>Locale</button> }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppTopbar } = require("./app-topbar") as typeof import("./app-topbar")

describe("AppTopbar mobile navigation", () => {
  afterEach(() => {
    cleanup()
    mockPathname = "/"
  })

  it("closes the navigation sheet after selecting a route", async () => {
    const view = render(<AppTopbar isMobile />)

    fireEvent.click(screen.getByRole("button", { name: "toggleMenu" }))
    expect(await screen.findByRole("dialog", { name: "navigationMenu" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "repositories" }))
    view.rerender(<AppTopbar isMobile />)

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "navigationMenu" })).toBeNull()
    })
  })
})
