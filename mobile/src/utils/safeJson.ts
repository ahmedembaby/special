export function safeJsonParse<T>(input: string | null | undefined, fallback: T): T {
  if (input == null) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}
