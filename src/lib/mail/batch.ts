export function uniqueEmails(
  values: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const email = value?.trim().toLowerCase() ?? "";
    if (!email.includes("@") || seen.has(email)) {
      continue;
    }
    seen.add(email);
    result.push(email);
  }
  return result;
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export const RESEND_BATCH_SIZE = 50;
