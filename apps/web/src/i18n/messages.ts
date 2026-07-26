import type { AppLocale } from "@ba-helper/contracts"
import en from "../../messages/en.json"
import jaJp from "../../messages/ja-JP.json"
import viVn from "../../messages/vi-VN.json"

export type AppMessages = Record<string, unknown>

export const messagesByLocale: Record<AppLocale, AppMessages> = {
  en,
  "vi-VN": viVn,
  "ja-JP": jaJp,
}
