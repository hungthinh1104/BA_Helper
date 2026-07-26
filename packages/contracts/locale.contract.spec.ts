import {
	DEFAULT_APP_LOCALE,
	appLocaleSchema,
	normalizeAppLocale,
	toDomainGlossaryLocale,
} from './src';

describe('app locale registry', () => {
	it('keeps English as the default app locale', () => {
		expect(DEFAULT_APP_LOCALE).toBe('en');
		expect(appLocaleSchema.parse('en')).toBe('en');
	});

	it('normalizes short locale aliases to canonical locale ids', () => {
		expect(normalizeAppLocale('vi')).toBe('vi-VN');
		expect(normalizeAppLocale('vi-VN')).toBe('vi-VN');
		expect(normalizeAppLocale('ja')).toBe('ja-JP');
		expect(normalizeAppLocale('ja-JP')).toBe('ja-JP');
	});

	it('falls back deterministically for unsupported UI locales', () => {
		expect(normalizeAppLocale('fr')).toBe('en');
		expect(normalizeAppLocale(null)).toBe('en');
	});

	it('maps app locales to domain glossary locale ids without changing evidence text', () => {
		expect(toDomainGlossaryLocale('en')).toBe('en');
		expect(toDomainGlossaryLocale('vi-VN')).toBe('vi');
		expect(toDomainGlossaryLocale('ja-JP')).toBe('en');
	});
});

