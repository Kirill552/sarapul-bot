import { describe, it, expect } from "vitest";
import { generateHash, generateTitleHash, generateContentHash, generateNewsId, generateUserId } from "../src/utils/hash.js";

describe("hash", () => {
  it("should generate consistent MD5 hash", () => {
    const text = "Test News Title";
    const hash1 = generateHash(text);
    const hash2 = generateHash(text);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
  });

  it("should normalize case before hashing", () => {
    const upper = generateHash("TEST TITLE");
    const lower = generateHash("test title");
    const mixed = generateHash("Test Title");

    expect(upper).toBe(lower);
    expect(lower).toBe(mixed);
  });

  it("should trim whitespace before hashing", () => {
    const withSpaces = generateHash("  title  ");
    const withoutSpaces = generateHash("title");

    expect(withSpaces).toBe(withoutSpaces);
  });

  it("should generate title hash", () => {
    const hash = generateTitleHash("Breaking News: Something Happened");

    expect(hash).toHaveLength(16);
    expect(typeof hash).toBe("string");
  });

  it("should generate content hash with trimming", () => {
    const content = "  Test content  ";
    const hash = generateContentHash(content);

    expect(hash).toHaveLength(16);
  });

  it("should truncate long content for hashing", () => {
    const longContent = "a".repeat(500);
    const truncated = "a".repeat(200);
    const hash1 = generateContentHash(longContent);
    const hash2 = generateContentHash(truncated);

    expect(hash1).toBe(hash2);
  });

  it("should generate news ID from source and URL", () => {
    const id = generateNewsId("adm-sarapul", "https://example.com/news/123");

    expect(id).toMatch(/^news_[a-f0-9]{16}$/);
  });

  it("should generate same ID for same inputs", () => {
    const id1 = generateNewsId("adm-sarapul", "https://example.com/news/123");
    const id2 = generateNewsId("adm-sarapul", "https://example.com/news/123");

    expect(id1).toBe(id2);
  });

  it("should generate different IDs for different inputs", () => {
    const id1 = generateNewsId("adm-sarapul", "https://example.com/news/1");
    const id2 = generateNewsId("adm-sarapul", "https://example.com/news/2");

    expect(id1).not.toBe(id2);
  });

  it("should generate user ID with channel prefix", () => {
    const userId = generateUserId("123456", "max");

    expect(userId).toBe("max_123456");
  });

  it("should handle numeric user IDs", () => {
    const userId = generateUserId(789, "telegram");

    expect(userId).toBe("telegram_789");
  });
});
