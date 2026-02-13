import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createSubscribeUserTool, createUnsubscribeUserTool } from "../src/tools/subscribe.js";

const TEST_DATA_DIR = path.join(process.cwd(), `.test-sarapul-subscribe-${Date.now()}-${Math.random().toString(36).slice(2)}`);

describe("subscribe tools", () => {
  beforeEach(async () => {
    process.env.SARAPUL_DATA_DIR = TEST_DATA_DIR;
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.SARAPUL_DATA_DIR;
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true }).catch(() => {});
  });

  describe("subscribe_user", () => {
    it("should subscribe a new user", async () => {
      const tool = createSubscribeUserTool();
      const result = await tool.execute("", { userId: "123", channel: "max" });

      expect(result.content[0]).toMatchObject({ type: "text" });
      const data = JSON.parse(result.content[0].text as string);
      expect(data.success).toBe(true);
      expect(data.message).toContain("подписан");
    });

    it("should handle already subscribed user", async () => {
      const tool = createSubscribeUserTool();
      await tool.execute("", { userId: "123", channel: "max" });
      const result = await tool.execute("", { userId: "123", channel: "max" });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.message).toContain("уже подписан");
    });

    it("should create different internal IDs for different channels", async () => {
      const tool = createSubscribeUserTool();
      const result1 = await tool.execute("", { userId: "123", channel: "max" });
      const result2 = await tool.execute("", { userId: "123", channel: "telegram" });

      const data1 = JSON.parse(result1.content[0].text as string);
      const data2 = JSON.parse(result2.content[0].text as string);
      expect(data1.userId).not.toBe(data2.userId);
    });
  });

  describe("unsubscribe_user", () => {
    it("should unsubscribe a subscribed user", async () => {
      const subscribeTool = createSubscribeUserTool();
      const unsubscribeTool = createUnsubscribeUserTool();

      await subscribeTool.execute("", { userId: "123", channel: "max" });
      const result = await unsubscribeTool.execute("", { userId: "123" });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.success).toBe(true);
      expect(data.message).toContain("отписан");
    });

    it("should handle non-subscribed user", async () => {
      const tool = createUnsubscribeUserTool();
      const result = await tool.execute("", { userId: "nonexistent" });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.success).toBe(true);
      expect(data.message).toContain("не был подписан");
    });
  });
});
