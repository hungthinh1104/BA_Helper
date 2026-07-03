"use client"

import { useEffect, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { messagesByLocale } from "@/i18n/messages"
import { readLocaleFromSearchParams } from "@/i18n/app-locale"

export function AppI18nProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const locale = readLocaleFromSearchParams(searchParams)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  )
}

