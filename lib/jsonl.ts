export function parseJsonl<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s) as T);
    } catch {
      // Ignore invalid lines.
    }
  }
  return out;
}
