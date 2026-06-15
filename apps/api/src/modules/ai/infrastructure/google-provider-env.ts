export const GOOGLE_PROVIDER_KEY_ENV_PRIORITY = [
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_AI_API_KEY',
] as const;

export function resolveGoogleProviderApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  for (const key of GOOGLE_PROVIDER_KEY_ENV_PRIORITY) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}
