import {
  DEFAULT_APP_LOCALE,
  normalizeAppLocale,
  type AppLocale,
} from "@ba-helper/contracts"

export type { AppLocale }

export { DEFAULT_APP_LOCALE, normalizeAppLocale }

export function readLocaleFromSearchParams(searchParams: URLSearchParams | null): AppLocale {
  return normalizeAppLocale(searchParams?.get("locale"))
}

export function setLocaleSearchParam(searchParams: URLSearchParams, locale: AppLocale) {
  if (locale === DEFAULT_APP_LOCALE) {
    searchParams.delete("locale")
  } else {
    searchParams.set("locale", locale)
  }
}

