import { readFile, writeFile } from 'node:fs/promises';

const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|cookie|database[_-]?url|redis[_-]?url|connection[_-]?string|api[_-]?key|private[_-]?key)/i;
const URL_CREDENTIALS = /((?:postgres(?:ql)?|redis(?:s)?):\/\/)[^\s/@]+@/gi;

export function redactNativeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactNativeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactNativeValue(child),
    ]));
  }
  if (typeof value === 'string') return redactText(value);
  return value;
}

export function redactText(value: string): string {
  return value.replace(URL_CREDENTIALS, '$1[REDACTED]@');
}

export async function redactNativeReport(file: string): Promise<void> {
  let text: string;
  try { text = await readFile(file, 'utf8'); } catch { return; }
  try {
    const parsed: unknown = JSON.parse(text);
    await writeFile(file, `${JSON.stringify(redactNativeValue(parsed), null, 2)}\n`, 'utf8');
  } catch {
    await writeFile(file, `${redactText(text)}\n`, 'utf8');
  }
}
