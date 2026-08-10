export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<{ result?: T, error?: string, attempts: number }> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const result = await operation();
      return { result, attempts };
    } catch (err: any) {
      if (attempts >= maxAttempts) {
        return { error: err.message || 'Unknown error', attempts };
      }
      // Simple exponential backoff or static wait
      await new Promise(r => setTimeout(r, 1000 * attempts));
    }
  }
  return { error: 'Exhausted retries', attempts };
}
