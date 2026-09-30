import type { PageText } from "./parsing";

export interface Chunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
  tokenCount: number;
}

interface ChunkOptions {
  targetWords: number;
  overlapWords: number;
  maxWords: number;
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

// Break text into units no larger than maxWords:
// paragraphs first, then sentences, then raw words.
function splitUnits(text: string, maxWords: number): string[] {
  const units: string[] = [];
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    if (wordCount(paragraph) <= maxWords) {
      units.push(paragraph);
      continue;
    }
    const sentences =
      paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [paragraph];

    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      if (wordCount(sentence) <= maxWords) {
        units.push(sentence);
      } else {
        const words = sentence.split(/\s+/);
        for (let i = 0; i < words.length; i += maxWords) {
          units.push(words.slice(i, i + maxWords).join(" "));
        }
      }
    }
  }
  return units;
}

function overlapTail(text: string, overlapWords: number): string {
  if (overlapWords <= 0) return "";
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(-overlapWords).join(" ");
}

function chunkText(text: string, opts: ChunkOptions): string[] {
  const units = splitUnits(text, opts.maxWords);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  const flush = () => {
    if (current.length > 0) chunks.push(current.join("\n\n"));
  };

  for (const unit of units) {
    const w = wordCount(unit);
    if (currentWords + w > opts.targetWords && current.length > 0) {
      flush();
      const tail = overlapTail(current.join(" "), opts.overlapWords);
      current = tail ? [tail] : [];
      currentWords = tail ? wordCount(tail) : 0;
    }
    current.push(unit);
    currentWords += w;
  }
  flush();
  return chunks;
}

// Chunks never cross page boundaries, so page numbers stay accurate.
export function chunkPages(pages: PageText[], opts: ChunkOptions): Chunk[] {
  const result: Chunk[] = [];
  let index = 0;

  for (const page of pages) {
    for (const content of chunkText(page.text, opts)) {
      result.push({
        chunkIndex: index++,
        pageNumber: page.pageNumber,
        content,
        tokenCount: Math.ceil(wordCount(content) * 1.3), // rough estimate
      });
    }
  }
  return result;
}
