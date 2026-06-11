"use client"

import { useTheme } from "next-themes"
import { Toaster } from "sonner"

export function AppToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="bottom-right"
      richColors
      theme={resolvedTheme as "light" | "dark" | "system" | undefined}
      toastOptions={{
        classNames: {
          toast: "font-sans text-[13px]",
          description: "text-[12px]",
        },
      }}
    />
  )
}
