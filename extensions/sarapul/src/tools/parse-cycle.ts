import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { jsonResult } from "./helpers.js";
import { readNews, writeNews } from "../memory/file-store.js";
import { createParseAdmSarapulTool, createParseRsshubTool } from "./parsers.js";
import { createDedupeNewsTool, createClassifyNewsTool, createRewriteNewsTool } from "./ai-pipeline.js";
import { readSettings } from "../memory/file-store.js";

const RunParseCycleSchema = Type.Object({});

export function createRunParseCycleTool(): AnyAgentTool {
  return {
    name: "run_parse_cycle",
    label: "Run Parse Cycle",
    description: "Run full news pipeline: parse sources → dedupe → classify → rewrite. Returns stats.",
    parameters: RunParseCycleSchema,
    execute: async (_toolCallId, _params) => {
      const settings = await readSettings();
      let parsed = 0;
      let unique = 0;
      let relevant = 0;
      let rejected = 0;

      const parseAdmTool = createParseAdmSarapulTool();
      const parseRsshubTool = createParseRsshubTool();
      const dedupeTool = createDedupeNewsTool();
      const classifyTool = createClassifyNewsTool();
      const rewriteTool = createRewriteNewsTool();

      const allParsedItems: Array<{
        id: string;
        source: string;
        sourceUrl: string;
        title: string;
        content: string;
        titleHash: string;
        contentHash: string;
        publishedAt?: number;
      }> = [];

      const admResult = await parseAdmTool.execute("", { limit: 10 });
      if ("content" in admResult && admResult.content[0]?.type === "text") {
        const data = JSON.parse(admResult.content[0].text) as { items?: typeof allParsedItems; error?: string };
        if (data.items) {
          allParsedItems.push(...data.items);
          parsed += data.items.length;
        }
      }

      const rsshubResult = await parseRsshubTool.execute("", {
        channels: settings.telegramChannels,
      });
      if ("content" in rsshubResult && rsshubResult.content[0]?.type === "text") {
        const data = JSON.parse(rsshubResult.content[0].text) as { items?: typeof allParsedItems; error?: string };
        if (data.items) {
          allParsedItems.push(...data.items);
          parsed += data.items.length;
        }
      }

      const news = await readNews();
      const existingIds = new Set(news.items.map((n) => n.id));
      const uniqueItems = allParsedItems.filter((item) => !existingIds.has(item.id));
      unique = uniqueItems.length;

      for (const item of uniqueItems) {
        const dedupeResult = await dedupeTool.execute("", {
          titleHash: item.titleHash,
          contentHash: item.contentHash,
          sourceUrl: item.sourceUrl,
        });

        if ("content" in dedupeResult && dedupeResult.content[0]?.type === "text") {
          const data = JSON.parse(dedupeResult.content[0].text) as { isDuplicate?: boolean };
          if (data.isDuplicate) {
            continue;
          }
        }

        const classifyResult = await classifyTool.execute("", {
          title: item.title,
          content: item.content,
          source: item.source,
        });

        let score = 5;
        let isRelevant = true;
        let reason = "";

        if ("content" in classifyResult && classifyResult.content[0]?.type === "text") {
          const data = JSON.parse(classifyResult.content[0].text) as {
            score?: number;
            is_relevant?: boolean;
            reason?: string;
          };
          score = data.score ?? 5;
          isRelevant = data.is_relevant ?? true;
          reason = data.reason ?? "";
        }

        if (score >= settings.minRelevanceScore && isRelevant) {
          let finalTitle = item.title;
          let finalContent = item.content;

          const rewriteResult = await rewriteTool.execute("", {
            title: item.title,
            content: item.content,
          });

          if ("content" in rewriteResult && rewriteResult.content[0]?.type === "text") {
            const data = JSON.parse(rewriteResult.content[0].text) as {
              title?: string;
              content?: string;
            };
            if (data.title) {
              finalTitle = data.title;
            }
            if (data.content) {
              finalContent = data.content;
            }
          }

          news.items.push({
            ...item,
            title: finalTitle,
            content: finalContent,
            originalContent: item.content,
            status: "filtered",
            relevanceScore: score,
            isRelevant,
            aiReason: reason,
            createdAt: Date.now(),
          });
          relevant++;
        } else {
          news.items.push({
            ...item,
            originalContent: item.content,
            status: "rejected",
            relevanceScore: score,
            isRelevant,
            aiReason: reason,
            createdAt: Date.now(),
          });
          rejected++;
        }
      }

      news.lastParsed = Date.now();
      await writeNews(news);

      return jsonResult({ parsed, unique, relevant, rejected });
    },
  };
}
