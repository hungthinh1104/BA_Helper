"use client"

import { useLocale, useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { AppLocale } from "@ba-helper/contracts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Languages } from "lucide-react"
import { DEFAULT_APP_LOCALE, normalizeAppLocale, setLocaleSearchParam } from "@/i18n/app-locale"

const LOCALES: AppLocale[] = ["en", "vi-VN", "ja-JP"]

export function LocaleSwitcher() {
  const t = useTranslations("app.locale")
  const locale = normalizeAppLocale(useLocale())
  const router = useRouter()
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()

  const updateLocale = (nextLocale: AppLocale) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    setLocaleSearchParam(params, nextLocale)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 shadow-none"
            aria-label={t("label")}
          />
        }
      >
        <Languages className="size-3.5" />
        <span className="hidden sm:inline">{locale === DEFAULT_APP_LOCALE ? "EN" : locale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup value={locale}>
          <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
          {LOCALES.map((item) => (
            <DropdownMenuRadioItem
              key={item}
              value={item}
              onClick={() => updateLocale(item)}
            >
              {t(item)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

