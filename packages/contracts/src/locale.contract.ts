import { z } from 'zod';

export const supportedAppLocales = ['en', 'vi-VN', 'ja-JP'] as const;
export type AppLocale = (typeof supportedAppLocales)[number];

export const DEFAULT_APP_LOCALE: AppLocale = 'en';

export const appLocaleSchema = z.enum(supportedAppLocales);

export const appLocaleAliasSchema = z.union([
	appLocaleSchema,
	z.literal('vi'),
	z.literal('ja'),
]);

export function normalizeAppLocale(value: unknown): AppLocale {
	if (value === 'vi' || value === 'vi-VN') return 'vi-VN';
	if (value === 'ja' || value === 'ja-JP') return 'ja-JP';
	if (value === 'en') return 'en';
	return DEFAULT_APP_LOCALE;
}

export function toDomainGlossaryLocale(locale: AppLocale): 'en' | 'vi' {
	return locale === 'vi-VN' ? 'vi' : 'en';
}

