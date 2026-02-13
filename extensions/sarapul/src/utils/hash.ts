import crypto from "node:crypto";

export function generateHash(text: string): string {
  return crypto.createHash("md5").update(text.toLowerCase().trim()).digest("hex").slice(0, 16);
}

export function generateTitleHash(title: string): string {
  return generateHash(title);
}

export function generateContentHash(content: string): string {
  const normalized = content.trim().slice(0, 200);
  return generateHash(normalized);
}

export function generateNewsId(source: string, sourceUrl: string): string {
  const hash = generateHash(`${source}:${sourceUrl}`);
  return `news_${hash}`;
}

export function generateUserId(rawId: string | number, channel: string): string {
  return `${channel}_${rawId}`;
}
