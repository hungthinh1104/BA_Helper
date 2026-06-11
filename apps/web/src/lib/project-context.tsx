"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { ApiError } from "@/lib/api-error"
import { apiGet, apiPost, getApiBaseUrl } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import {
  currentWorkspaceResponseSchema,
  projectListResponseSchema,
  type CurrentWorkspaceResponse,
  type ProjectListItemResponse,
} from "@ba-helper/contracts"

type ReadyProjectContext = {
  status: "ready"
  apiBaseUrl: string
  projects: ProjectListItemResponse[]
  switchingProjectId: string | null
  switchProject: (projectId: string) => Promise<void>
} & CurrentWorkspaceResponse

type ProjectReadyState = Omit<ReadyProjectContext, "switchProject">

type ProjectContextValue =
  | { status: "loading" }
  | ReadyProjectContext
  | { status: "error"; apiBaseUrl?: string; code: string; message: string }

const ProjectContext = createContext<ProjectContextValue>({ status: "loading" })

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProjectReadyState | { status: "loading" } | { status: "error"; apiBaseUrl?: string; code: string; message: string }>({ status: "loading" })
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (status === "loading") {
      return
    }

    let cancelled = false

    const run = async () => {
      let apiBaseUrl: string | undefined
      try {
        apiBaseUrl = getApiBaseUrl()
        const authHeaders =
          typeof session?.accessToken === "string" && session.accessToken
            ? { Authorization: `Bearer ${session.accessToken}` }
            : undefined
        const workspace = await apiGet(
          "/api/v1/workspace/current",
          currentWorkspaceResponseSchema,
          authHeaders,
        )
        const projectList = authHeaders
          ? await apiGet("/api/v1/projects", projectListResponseSchema, authHeaders)
          : { items: [] }

        if (cancelled) return
        setState({
          status: "ready",
          apiBaseUrl,
          projects: projectList.items,
          switchingProjectId: null,
          ...workspace,
        })
      } catch (e: unknown) {
        if (cancelled) return
        setState({
          status: "error",
          ...formatBootstrapError(e, apiBaseUrl),
        })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [queryClient, session?.accessToken, status])

  const value: ProjectContextValue =
    state.status !== "ready"
      ? state
      : {
          ...state,
          switchProject: async (projectId: string) => {
            const authHeaders =
              typeof session?.accessToken === "string" && session.accessToken
                ? { Authorization: `Bearer ${session.accessToken}` }
                : undefined

            if (!authHeaders) {
              throw new Error("Cannot switch project without an authenticated session.")
            }

            setState((previous) =>
              previous.status === "ready"
                ? { ...previous, switchingProjectId: projectId }
                : previous,
            )

            try {
              const workspace = await apiPost(
                "/api/v1/workspace/select-project",
                { projectId },
                currentWorkspaceResponseSchema,
                authHeaders,
              )
              const projectList = await apiGet(
                "/api/v1/projects",
                projectListResponseSchema,
                authHeaders,
              )

              await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.workspace.current }),
                queryClient.invalidateQueries({ queryKey: queryKeys.workspace.projects }),
                queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.requirements.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.analyses.all }),
              ])

              setState((previous) =>
                previous.status === "ready"
                  ? {
                      ...previous,
                      ...workspace,
                      projects: projectList.items,
                      switchingProjectId: null,
                    }
                  : previous,
              )
            } catch (error) {
              setState((previous) =>
                previous.status === "ready"
                  ? { ...previous, switchingProjectId: null }
                  : previous,
              )
              throw error
            }
          },
        }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectId(): string {
  const value = useContext(ProjectContext)
  if (value.status === "ready") return value.projectId
  return ""
}

export function useOptionalProjectId(): string | undefined {
  const value = useContext(ProjectContext)
  return value.status === "ready" ? value.projectId : undefined
}

export function useProjectStatus(): ProjectContextValue {
  return useContext(ProjectContext)
}

export function useCurrentWorkspace(): CurrentWorkspaceResponse {
  const value = useContext(ProjectContext)
  if (value.status === "ready") {
    return {
      projectId: value.projectId,
      name: value.name,
      mode: value.mode,
      membershipRole: value.membershipRole,
      createdAt: value.createdAt,
    }
  }
  throw new Error(value.status === "error" ? value.message : "Project is not ready.")
}

export function useWorkspaceRuntime() {
  const value = useContext(ProjectContext)
  if (value.status === "ready") {
    return {
      apiBaseUrl: value.apiBaseUrl,
      createdAt: value.createdAt,
      membershipRole: value.membershipRole,
      mode: value.mode,
      name: value.name,
      projectId: value.projectId,
      projects: value.projects,
      switchingProjectId: value.switchingProjectId,
      switchProject: value.switchProject,
    }
  }
  throw new Error(value.status === "error" ? value.message : "Project is not ready.")
}

function formatBootstrapError(
  error: unknown,
  apiBaseUrl?: string,
): { code: string; message: string; apiBaseUrl?: string } {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "API_URL_MISSING":
        return {
          apiBaseUrl,
          code: error.code,
          message: "NEXT_PUBLIC_API_URL is required for production deployments.",
        }
      case "INVALID_API_URL":
        return {
          apiBaseUrl,
          code: error.code,
          message: error.message,
        }
      case "API_UNREACHABLE":
        return {
          apiBaseUrl,
          code: error.code,
          message: `Cannot reach API at ${apiBaseUrl ?? "the configured URL"}.`,
        }
      case "API_WRONG_SERVER":
        return {
          apiBaseUrl,
          code: error.code,
          message: "Configured API URL points to a server that is not the BA Helper API.",
        }
      case "API_CONTRACT_MISMATCH":
        return {
          apiBaseUrl,
          code: error.code,
          message:
            "Workspace bootstrap failed because the backend response no longer matches the shared contract.",
        }
      case "WORKSPACE_MODE_UNSUPPORTED":
        return {
          apiBaseUrl,
          code: error.code,
          message: "Backend workspace mode is unsupported by this web client.",
        }
      default:
        return {
          apiBaseUrl,
          code: error.code,
          message: `Workspace bootstrap rejected: ${error.message}`,
        }
    }
  }

  return {
    apiBaseUrl,
    code: "WORKSPACE_BOOTSTRAP_FAILED",
    message: error instanceof Error ? error.message : "Failed to initialize workspace.",
  }
}
