"use client"

import { useSearchParams } from "next/navigation"
import { DEFAULT_APP_LOCALE, readLocaleFromSearchParams, setLocaleSearchParam } from "./app-locale"

export function useLocalizedHref() {
  const searchParams = useSearchParams()
  const locale = readLocaleFromSearchParams(searchParams)

  return (pathname: string) => {
    if (locale === DEFAULT_APP_LOCALE) return pathname

    const params = new URLSearchParams()
    setLocaleSearchParam(params, locale)
    return `${pathname}?${params.toString()}`
  }
}

