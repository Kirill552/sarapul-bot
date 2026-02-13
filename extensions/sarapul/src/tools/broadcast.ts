import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { jsonResult, readStringParam } from "./helpers.js";
import {
  readUsers,
  readNews,
  writeNews,
  readSettings,
  writeSettings,
  readPublished,
  writePublished,
  type NewsItem,
} from "../memory/file-store.js";
import { sendTextMax } from "../../../max/src/send.js";
import { Bot as TgBot } from "grammy";

const RunBroadcastSchema = Type.Object({
  type: Type.Optional(
    Type.Union(
      [Type.Literal("morning"), Type.Literal("evening"), Type.Literal("urgent")],
      { description: "Broadcast type (default: morning)" },
    ),
  ),
  newsIds: Type.Optional(Type.Array(Type.String(), { description: "Specific news IDs to broadcast" })),
});

const RATE_LIMIT_MS = 34;

export function createRunBroadcastTool(): AnyAgentTool {
  return {
    name: "run_broadcast",
    label: "Run Broadcast",
    description: "Send news digest to all subscribers. Use for scheduled or urgent broadcasts.",
    parameters: RunBroadcastSchema,
    execute: async (_toolCallId, params) => {
      const type = (readStringParam(params, "type") ?? "morning") as "morning" | "evening" | "urgent";
      const newsIds = params.newsIds as string[] | undefined;

      const users = await readUsers();
      const news = await readNews();
      const settings = await readSettings();

      const subscribers = Object.entries(users).filter(
        ([_, u]) => u.subscribed && !u.blocked,
      );

      const newsToPublish: NewsItem[] = newsIds
        ? news.items.filter((n) => newsIds.includes(n.id))
        : news.items
            .filter((n) => n.status === "filtered")
            .slice(0, settings.maxNewsPerDigest);

      if (newsToPublish.length === 0) {
        return jsonResult({ sent: 0, failed: 0, newsCount: 0, error: "No news to publish" });
      }

      const digest = formatDigest(newsToPublish, type);
      let sent = 0;
      let failed = 0;
      const blockedUsers: string[] = [];

      for (const [userId, userData] of subscribers) {
        try {
          await sendBroadcastMessage(userId, userData.channel, digest);
          sent++;
          userData.lastBroadcast = Date.now();
          await sleep(RATE_LIMIT_MS);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("403") || message.includes("blocked")) {
            userData.blocked = true;
            blockedUsers.push(userId);
          }
          failed++;
        }
      }

      const now = Date.now();
      for (const item of newsToPublish) {
        item.status = "published";
        item.publishedAt = now;
      }

      news.lastParsed = now;
      await writeNews(news);

      settings.lastBroadcast = now;
      await writeSettings(settings);

      const published = await readPublished();
      published.records.push({
        newsId: newsToPublish.map((n) => n.id).join(","),
        broadcastType: type,
        sentAt: now,
        recipientCount: sent,
      });
      await writePublished(published);

      return jsonResult({
        sent,
        failed,
        newsCount: newsToPublish.length,
        blockedUsers,
      });
    },
  };
}

function formatDigest(newsItems: NewsItem[], _type: string): string {
  const date = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Samara",
  });

  const parts = [`📰 Новости Сарапула — ${date}`, ""];

  for (const item of newsItems) {
    parts.push(`🔹 ${item.title}`);
    parts.push(item.content);
    parts.push("");
  }

  return parts.join("\n").trim();
}

async function sendBroadcastMessage(
  userId: string,
  channel: string,
  message: string,
): Promise<void> {
  if (channel === "max") {
    const accountId = process.env.MAX_ACCOUNT_ID ?? "default";
    const result = await sendTextMax({
      accountId,
      chatId: Number(userId),
      text: message,
      format: "markdown",
    });
    if (!result.ok) {
      throw new Error(result.error ?? "Failed to send MAX message");
    }
  } else if (channel === "telegram") {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN not set");
    }
    const bot = new TgBot(token);
    await bot.api.sendMessage(Number(userId), message, { parse_mode: "Markdown" });
  } else {
    throw new Error(`Unsupported channel: ${channel}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
