const MAX_CHUNK_CHARS = 700;
const CHUNK_OVERLAP_CHARS = 100;

export function chunkText(content: string): string[] {
  const text = content.replace(/\r\n/g, "\n").trim();

  if (!text) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(
      start + MAX_CHUNK_CHARS,
      text.length
    );

    // Prefer ending a chunk at a natural text boundary.
    if (end < text.length) {
      const searchArea = text.slice(
        start,
        end
      );

      const minimumBoundary =
        Math.floor(MAX_CHUNK_CHARS * 0.6);

      const candidates = [
        searchArea.lastIndexOf("\n"),
        searchArea.lastIndexOf(". "),
        searchArea.lastIndexOf("? "),
        searchArea.lastIndexOf("! "),
        searchArea.lastIndexOf(" "),
      ];

      const bestBoundary = Math.max(...candidates);

      if (bestBoundary >= minimumBoundary) {
        end = start + bestBoundary + 1;
      }
    }

    const chunk = text.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    // Preserve some text for the next chunk.
    start = Math.max(
      end - CHUNK_OVERLAP_CHARS,
      start + 1
    );
  }

  return chunks;
}