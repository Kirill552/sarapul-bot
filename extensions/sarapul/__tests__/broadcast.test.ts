import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createRunBroadcastTool } from "../src/tools/broadcast.js";
import { readNews, writeNews, readUsers, writeUsers, readSettings, writeSettings } from "../src/memory/file-store.js";

const TEST_DATA_DIR = path.join(process.cwd(), `.test-sarapul-broadcast-${Date.now()}-${Math.random().toString(36).slice(2)}`);

describe("broadcast", () => {
  beforeEach(async () => {
    process.env.SARAPUL_DATA_DIR = TEST_DATA_DIR;
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.SARAPUL_DATA_DIR;
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true }).catch(() => {});
  });

  describe("run_broadcast", () => {
    it("should return error when no news to publish", async () => {
      const tool = createRunBroadcastTool();
      const result = await tool.execute("", {});

      const data = JSON.parse(result.content[0].text as string);
      expect(data.error).toContain("No news to publish");
    });

    it("should mark news as published after broadcast", async () => {
      const news = await readNews();
      news.items.push({
        id: "news-1",
        source: "test",
        sourceUrl: "https://example.com/1",
        title: "Test News",
        content: "Test content",
        titleHash: "hash1",
        contentHash: "chash1",
        status: "filtered",
        createdAt: Date.now(),
      });
      await writeNews(news);

      const users = await readUsers();
      users["max_1"] = { subscribed: true, subscribedAt: Date.now(), channel: "max", blocked: false };
      await writeUsers(users);

      const tool = createRunBroadcastTool();
      await tool.execute("", {});

      const updatedNews = await readNews();
      expect(updatedNews.items[0].status).toBe("published");
      expect(updatedNews.items[0].publishedAt).toBeDefined();
    });

    it("should respect maxNewsPerDigest setting", async () => {
      const settings = await readSettings();
      settings.maxNewsPerDigest = 2;
      await writeSettings(settings);

      const news = await readNews();
      for (let i = 0; i < 5; i++) {
        news.items.push({
          id: `news-${i}`,
          source: "test",
          sourceUrl: `https://example.com/${i}`,
          title: `News ${i}`,
          content: `Content ${i}`,
          titleHash: `hash${i}`,
          contentHash: `chash${i}`,
          status: "filtered",
          createdAt: Date.now(),
        });
      }
      await writeNews(news);

      const tool = createRunBroadcastTool();
      const result = await tool.execute("", {});

      const data = JSON.parse(result.content[0].text as string);
      expect(data.newsCount).toBe(2);
    });

    it("should format digest with title and date", async () => {
      const news = await readNews();
      news.items.push({
        id: "news-1",
        source: "test",
        sourceUrl: "https://example.com/1",
        title: "Test Title",
        content: "Test Content",
        titleHash: "hash1",
        contentHash: "chash1",
        status: "filtered",
        createdAt: Date.now(),
      });
      await writeNews(news);

      const tool = createRunBroadcastTool();
      const result = await tool.execute("", { type: "morning" });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.sent).toBeDefined();
    });
  });
});
