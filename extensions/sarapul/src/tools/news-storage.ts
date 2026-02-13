import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { readNews, writeNews, readUsers, readPublished, readSettings, type NewsItem } from "../memory/file-store.js";
import { jsonResult, readNumberParam, readStringParam } from "./helpers.js";

const GetRecentNewsSchema = Type.Object({
  limit: Type.Optional(Type.Number({ description: "Number of news to return (default 3)" })),
  hoursBack: Type.Optional(Type.Number({ description: "Hours to look back (default 24)" })),
});

const GetBotStatusSchema = Type.Object({});

const GetStatsSchema = Type.Object({
  period: Type.Optional(
    Type.Union(
      [Type.Literal("day"), Type.Literal("week"), Type.Literal("month")],
      { description: "Period for statistics (default week)" },
    ),
  ),
});

export function createGetRecentNewsTool(): AnyAgentTool {
  return {
    name: "get_recent_news",
    label: "Get Recent News",
    description: "Get recent news articles from the last 24 hours. Use when user sends /news command.",
    parameters: GetRecentNewsSchema,
    execute: async (_toolCallId, params) => {
      const limit = readNumberParam(params, "limit") ?? 3;
      const hoursBack = readNumberParam(params, "hoursBack") ?? 24;

      const news = await readNews();
      const cutoff = Date.now() - hoursBack * 3600000;

      const recentNews = news.items
        .filter((item) => item.status === "published" && (item.publishedAt ?? 0) > cutoff)
        .toSorted((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
        .slice(0, limit);

      return jsonResult({
        news: recentNews.map((item) => ({
          title: item.title,
          content: item.content,
          source: item.source,
          publishedAt: item.publishedAt,
        })),
        count: recentNews.length,
      });
    },
  };
}

export function createSaveNewsTool(): AnyAgentTool {
  return {
    name: "save_news",
    label: "Save News",
    description: "Save new news items to storage. Internal use for parse cycle.",
    parameters: Type.Object({
      items: Type.Array(Type.Object({
        id: Type.String(),
        source: Type.String(),
        sourceUrl: Type.String(),
        title: Type.String(),
        content: Type.String(),
        titleHash: Type.String(),
        contentHash: Type.String(),
      })),
    }),
    execute: async (_toolCallId, params) => {
      const items = params.items as Array<{
        id: string;
        source: string;
        sourceUrl: string;
        title: string;
        content: string;
        titleHash: string;
        contentHash: string;
      }>;

      const news = await readNews();
      const existingIds = new Set(news.items.map((item) => item.id));

      const newItems: NewsItem[] = items
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          ...item,
          originalContent: item.content,
          status: "new" as const,
          createdAt: Date.now(),
        }));

      news.items.push(...newItems);
      news.lastParsed = Date.now();
      await writeNews(news);

      return jsonResult({
        saved: newItems.length,
        skipped: items.length - newItems.length,
      });
    },
  };
}

export function createGetBotStatusTool(): AnyAgentTool {
  return {
    name: "get_bot_status",
    label: "Get Bot Status",
    description: "Get bot statistics: subscribers, blocked users, news count. Use for /status admin command.",
    parameters: GetBotStatusSchema,
    execute: async () => {
      const users = await readUsers();
      const news = await readNews();
      const settings = await readSettings();

      const now = Date.now();
      const todayStart = new Date(
        new Date(now).toLocaleDateString("en-CA", { timeZone: "Europe/Samara" }),
      ).getTime();

      const subscribers = Object.values(users).filter((u) => u.subscribed && !u.blocked).length;
      const blocked = Object.values(users).filter((u) => u.blocked).length;
      const publishedToday = news.items.filter(
        (item) => item.status === "published" && (item.publishedAt ?? 0) > todayStart,
      ).length;

      return jsonResult({
        subscribers,
        blocked,
        totalNews: news.items.length,
        publishedToday,
        lastParsed: news.lastParsed,
        lastBroadcast: settings.lastBroadcast ?? null,
      });
    },
  };
}

export function createGetStatsTool(): AnyAgentTool {
  return {
    name: "get_stats",
    label: "Get Statistics",
    description: "Get detailed analytics for a period. Use for /stats admin command.",
    parameters: GetStatsSchema,
    execute: async (_toolCallId, params) => {
      const period = readStringParam(params, "period") ?? "week";

      const now = Date.now();
      const periodMs: Record<string, number> = {
        day: 86400000,
        week: 604800000,
        month: 2592000000,
      };
      const cutoff = now - (periodMs[period] ?? periodMs.week);

      const news = await readNews();
      const users = await readUsers();
      const published = await readPublished();

      const periodNews = news.items.filter((item) => item.createdAt > cutoff);
      const periodPublished = published.records.filter((r) => r.sentAt > cutoff);

      const newSubscribers = Object.values(users).filter(
        (u) => u.subscribedAt > cutoff && u.subscribed,
      ).length;
      const lostSubscribers = Object.values(users).filter(
        (u) => !u.subscribed && u.subscribedAt < cutoff,
      ).length;

      return jsonResult({
        period,
        newsTotal: periodNews.length,
        newsPublished: periodNews.filter((n) => n.status === "published").length,
        newsRejected: periodNews.filter((n) => n.status === "rejected").length,
        broadcastsSent: periodPublished.length,
        subscribersGained: newSubscribers,
        subscribersLost: lostSubscribers,
      });
    },
  };
}
