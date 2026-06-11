"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { ApiError } from "@/lib/api-error"
import { apiGet, getApiBaseUrl } from "@/lib/api-client"
import {
  currentWorkspaceResponseSchema,
  type CurrentWorkspaceResponse,
} from "@ba-helper/contracts"

const STORAGE_KEY = "ba_helper:projectId"

type ProjectContextValue =
  | { status: "loading" }
  | ({ status: "ready"; apiBaseUrl: string } & CurrentWorkspaceResponse)
  | { status: "error"; apiBaseUrl?: string; code: string; message: string }

const ProjectContext = createContext<ProjectContextValue>({ status: "loading" })

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProjectContextValue>({ status: "loading" })
  const { data: session, status } = useSession()

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
        const currentWorkspace = await apiGet(
          "/api/v1/workspace/current",
          currentWorkspaceResponseSchema,
          authHeaders,
        )
        if (cancelled) return
        window.localStorage.setItem(STORAGE_KEY, currentWorkspace.projectId)
        setState({ status: "ready", apiBaseUrl, ...currentWorkspace })
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
  }, [session?.accessToken, status])

  const value = useMemo(() => state, [state])
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectId(): string {
  const value = useContext(ProjectContext)
  if (value.status === "ready") return value.projectId
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(STORAGE_KEY) ?? ""
  }
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
          message: `Configured API URL points to a server that is not the BA Helper API. Check NEXT_PUBLIC_API_URL and make sure it targets the backend, not the Next.js web app.`,
        }
      case "API_CONTRACT_MISMATCH":
        return {
          apiBaseUrl,
          code: error.code,
          message: "Workspace bootstrap failed because the backend response no longer matches the shared contract.",
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
