import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createGetRecentNewsTool, createSaveNewsTool, createGetBotStatusTool, createGetStatsTool } from "../src/tools/news-storage.js";
import { readNews, writeNews, readUsers, writeUsers, DEFAULT_NEWS, DEFAULT_USERS } from "../src/memory/file-store.js";

function getTestDir() {
  return path.join(process.cwd(), `.test-sarapul-news-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe("news-storage tools", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = getTestDir();
    process.env.SARAPUL_DATA_DIR = testDir;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.SARAPUL_DATA_DIR;
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe("get_recent_news", () => {
    it("should return empty array when no news", async () => {
      await writeNews({ ...DEFAULT_NEWS });
      const tool = createGetRecentNewsTool();
      const result = await tool.execute("", {});

      const data = JSON.parse(result.content[0].text as string);
      expect(data.news).toEqual([]);
      expect(data.count).toBe(0);
    });

    it("should return only published news within time range", async () => {
      await writeNews({ ...DEFAULT_NEWS });
      const tool = createGetRecentNewsTool();
      const news = await readNews();
      news.items = [
        {
          id: "1",
          source: "test",
          sourceUrl: "https://example.com/1",
          title: "Old News",
          content: "Old content",
          titleHash: "hash1",
          contentHash: "chash1",
          status: "published",
          publishedAt: Date.now() - 86400000 * 2,
          createdAt: Date.now() - 86400000 * 2,
        },
        {
          id: "2",
          source: "test",
          sourceUrl: "https://example.com/2",
          title: "Recent News",
          content: "Recent content",
          titleHash: "hash2",
          contentHash: "chash2",
          status: "published",
          publishedAt: Date.now() - 3600000,
          createdAt: Date.now() - 3600000,
        },
        {
          id: "3",
          source: "test",
          sourceUrl: "https://example.com/3",
          title: "Unpublished",
          content: "Draft",
          titleHash: "hash3",
          contentHash: "chash3",
          status: "filtered",
          createdAt: Date.now() - 3600000,
        },
      ];
      await writeNews(news);

      const result = await tool.execute("", { limit: 10, hoursBack: 24 });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.count).toBe(1);
      expect(data.news[0].title).toBe("Recent News");
    });

    it("should respect limit parameter", async () => {
      await writeNews({ ...DEFAULT_NEWS });
      const tool = createGetRecentNewsTool();
      const news = await readNews();
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        news.items.push({
          id: `news-${i}`,
          source: "test",
          sourceUrl: `https://example.com/${i}`,
          title: `News ${i}`,
          content: `Content ${i}`,
          titleHash: `hash${i}`,
          contentHash: `chash${i}`,
          status: "published",
          publishedAt: now - i * 1000,
          createdAt: now,
        });
      }
      await writeNews(news);

      const result = await tool.execute("", { limit: 2 });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.count).toBe(2);
    });
  });

  describe("save_news", () => {
    it("should save new items", async () => {
      await writeNews({ ...DEFAULT_NEWS });
      const tool = createSaveNewsTool();
      const result = await tool.execute("", {
        items: [
          {
            id: "new-1",
            source: "test",
            sourceUrl: "https://example.com/1",
            title: "Test News",
            content: "Test content",
            titleHash: "hash1",
            contentHash: "chash1",
          },
        ],
      });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.saved).toBe(1);
      expect(data.skipped).toBe(0);

      const news = await readNews();
      expect(news.items).toHaveLength(1);
      expect(news.items[0].status).toBe("new");
    });

    it("should skip duplicate IDs", async () => {
      await writeNews({ ...DEFAULT_NEWS });
      const existingNews = await readNews();
      existingNews.items.push({
        id: "existing-1",
        source: "test",
        sourceUrl: "https://example.com/existing",
        title: "Existing",
        content: "Content",
        titleHash: "ehash",
        contentHash: "echash",
        status: "published",
        createdAt: Date.now(),
      });
      await writeNews(existingNews);

      const tool = createSaveNewsTool();
      const result = await tool.execute("", {
        items: [
          {
            id: "existing-1",
            source: "test",
            sourceUrl: "https://example.com/existing",
            title: "Duplicate",
            content: "Duplicate content",
            titleHash: "dhash",
            contentHash: "dchash",
          },
          {
            id: "new-1",
            source: "test",
            sourceUrl: "https://example.com/new",
            title: "New",
            content: "New content",
            titleHash: "nhash",
            contentHash: "nchash",
          },
        ],
      });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.saved).toBe(1);
      expect(data.skipped).toBe(1);
    });
  });

  describe("get_bot_status", () => {
    it("should return subscriber count", async () => {
      await writeUsers({ ...DEFAULT_USERS });
      const users = await readUsers();
      users["max_1"] = { subscribed: true, subscribedAt: Date.now(), channel: "max", blocked: false };
      users["max_2"] = { subscribed: true, subscribedAt: Date.now(), channel: "max", blocked: false };
      users["max_3"] = { subscribed: true, subscribedAt: Date.now(), channel: "max", blocked: true };
      users["max_4"] = { subscribed: false, subscribedAt: Date.now(), channel: "max", blocked: false };
      await writeUsers(users);

      const tool = createGetBotStatusTool();
      const result = await tool.execute("", {});

      const data = JSON.parse(result.content[0].text as string);
      expect(data.subscribers).toBe(2);
      expect(data.blocked).toBe(1);
    });
  });

  describe("get_stats", () => {
    it("should return statistics for period", async () => {
      await writeNews({ ...DEFAULT_NEWS });
      const news = await readNews();
      const now = Date.now();
      news.items = [
        { id: "1", source: "test", sourceUrl: "url1", title: "t1", content: "c1", titleHash: "h1", contentHash: "ch1", status: "published", createdAt: now - 1000 },
        { id: "2", source: "test", sourceUrl: "url2", title: "t2", content: "c2", titleHash: "h2", contentHash: "ch2", status: "rejected", createdAt: now - 2000 },
        { id: "3", source: "test", sourceUrl: "url3", title: "t3", content: "c3", titleHash: "h3", contentHash: "ch3", status: "filtered", createdAt: now - 604800000 * 2 },
      ];
      await writeNews(news);

      const tool = createGetStatsTool();
      const result = await tool.execute("", { period: "week" });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.period).toBe("week");
      expect(data.newsTotal).toBe(2);
      expect(data.newsPublished).toBe(1);
      expect(data.newsRejected).toBe(1);
    });
  });
});
