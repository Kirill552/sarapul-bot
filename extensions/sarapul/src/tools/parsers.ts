import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { jsonResult, readNumberParam } from "./helpers.js";
import { parseAdmSarapulHtml, parseRssFeed } from "./parser-utils.js";
import { generateTitleHash, generateContentHash, generateNewsId } from "../utils/hash.js";

const ParseAdmSchema = Type.Object({
  limit: Type.Optional(Type.Number({ description: "Maximum news to parse (default 10)" })),
});

const ParseRsshubSchema = Type.Object({
  channels: Type.Optional(Type.Array(Type.String(), { description: "Telegram channels to parse" })),
  rsshubUrl: Type.Optional(Type.String({ description: "RSSHub URL (default from env)" })),
});

export function createParseAdmSarapulTool(): AnyAgentTool {
  return {
    name: "parse_adm_sarapul",
    label: "Parse adm-sarapul.ru",
    description: "Parse news from adm-sarapul.ru/news/. Returns array of news items with hashes for deduplication.",
    parameters: ParseAdmSchema,
    execute: async (_toolCallId, params) => {
      const limit = readNumberParam(params, "limit") ?? 10;

      try {
        const response = await fetch("https://adm-sarapul.ru/news/", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          return jsonResult({
            error: `HTTP ${response.status}`,
            items: [],
          });
        }

        const html = await response.text();
        const parsed = parseAdmSarapulHtml(html, limit);

        const items = parsed.map((item) => ({
          id: generateNewsId("adm-sarapul", item.url),
          source: "adm-sarapul",
          sourceUrl: item.url,
          title: item.title,
          content: item.content,
          titleHash: generateTitleHash(item.title),
          contentHash: generateContentHash(item.content),
          publishedAt: item.date,
        }));

        return jsonResult({ items, count: items.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ error: message, items: [] });
      }
    },
  };
}

export function createParseRsshubTool(): AnyAgentTool {
  return {
    name: "parse_rsshub",
    label: "Parse RSSHub",
    description: "Parse Telegram channels via RSSHub. Returns array of news items with hashes.",
    parameters: ParseRsshubSchema,
    execute: async (_toolCallId, params) => {
      const rsshubUrl = (params.rsshubUrl as string) ?? process.env.RSSHUB_URL ?? "http://localhost:1200";
      const channels = (params.channels as string[] | undefined) ?? (await import("../memory/file-store.js")).readSettings().then((s) => s.telegramChannels);

      const resolvedChannels = Array.isArray(channels) ? channels : await channels;

      const allItems: Array<{
        id: string;
        source: string;
        sourceUrl: string;
        title: string;
        content: string;
        titleHash: string;
        contentHash: string;
        publishedAt?: number;
      }> = [];

      for (const channel of resolvedChannels) {
        try {
          const response = await fetch(`${rsshubUrl}/telegram/channel/${channel}`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          if (!response.ok) {
            continue;
          }

          const xml = await response.text();
          const parsed = parseRssFeed(xml);

          for (const item of parsed) {
            allItems.push({
              id: generateNewsId("telegram", item.link ?? item.title),
              source: `telegram:${channel}`,
              sourceUrl: item.link ?? "",
              title: item.title,
              content: item.content,
              titleHash: generateTitleHash(item.title),
              contentHash: generateContentHash(item.content),
              publishedAt: item.date,
            });
          }
        } catch {
          continue;
        }
      }

      return jsonResult({ items: allItems, count: allItems.length });
    },
  };
}
