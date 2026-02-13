import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { jsonResult, readStringParam } from "./helpers.js";
import { readNews } from "../memory/file-store.js";

const ClassifySchema = Type.Object({
  title: Type.String({ description: "News title" }),
  content: Type.String({ description: "News content" }),
  source: Type.String({ description: "News source" }),
});

const RewriteSchema = Type.Object({
  title: Type.String({ description: "Original title" }),
  content: Type.String({ description: "Original content" }),
});

const DedupeSchema = Type.Object({
  titleHash: Type.String({ description: "Title hash" }),
  contentHash: Type.String({ description: "Content hash" }),
  sourceUrl: Type.String({ description: "Source URL" }),
});

const CLASSIFIER_PROMPT = `Ты — редактор новостей города Сарапул. Оцени важность новости по шкале 1-10.

ВАЖНЫЕ (8-10): открытие/закрытие соцобъектов, изменения в транспорте/ЖКХ, решения администрации, крупные мероприятия, ЧС.
СРЕДНИЕ (4-7): спортивные достижения, культурные события, благоустройство.
НЕВАЖНЫЕ (1-3): афиша без ценности, реклама, рутина, новости не про Сарапул.

Верни только JSON: {"score": N, "is_relevant": true/false, "reason": "..."}`;

const REWRITER_PROMPT = `Ты — редактор новостей города Сарапул. Перепиши новость:

1. Сохрани ВСЕ факты и цифры
2. Пиши простым языком, без канцеляризмов
3. Заголовок до 60 символов, цепляющий
4. Текст до 500 символов
5. 1-2 эмодзи где уместно
6. Не придумывай факты
7. Нейтральный тон

Верни только JSON: {"title": "...", "content": "..."}`;

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in response");
  }

  return JSON.parse(jsonMatch[0]);
}

export function createClassifyNewsTool(): AnyAgentTool {
  return {
    name: "classify_news",
    label: "Classify News",
    description: "Classify news relevance using AI. Returns score 1-10, is_relevant flag, and reason.",
    parameters: ClassifySchema,
    execute: async (_toolCallId, params) => {
      const title = readStringParam(params, "title", { required: true })!;
      const content = readStringParam(params, "content", { required: true })!;
      const source = readStringParam(params, "source", { required: true })!;

      try {
        const result = await callOpenRouter(
          "google/gemini-2.0-flash-lite-001",
          CLASSIFIER_PROMPT,
          `Источник: ${source}\nЗаголовок: ${title}\nТекст: ${content}`,
        );

        return jsonResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ score: 5, is_relevant: true, reason: `Error: ${message}` });
      }
    },
  };
}

export function createRewriteNewsTool(): AnyAgentTool {
  return {
    name: "rewrite_news",
    label: "Rewrite News",
    description: "Rewrite news article using AI. Returns formatted title and content.",
    parameters: RewriteSchema,
    execute: async (_toolCallId, params) => {
      const title = readStringParam(params, "title", { required: true })!;
      const content = readStringParam(params, "content", { required: true })!;

      try {
        const result = await callOpenRouter(
          "anthropic/claude-3.5-haiku",
          REWRITER_PROMPT,
          `Заголовок: ${title}\nТекст: ${content}`,
        );

        return jsonResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ title, content, error: message });
      }
    },
  };
}

export function createDedupeNewsTool(): AnyAgentTool {
  return {
    name: "dedupe_news",
    label: "Check Duplicate News",
    description: "Check if news item is a duplicate. Checks URL, title hash, and content hash.",
    parameters: DedupeSchema,
    execute: async (_toolCallId, params) => {
      const titleHash = readStringParam(params, "titleHash", { required: true })!;
      const contentHash = readStringParam(params, "contentHash", { required: true })!;
      const sourceUrl = readStringParam(params, "sourceUrl", { required: true })!;

      const news = await readNews();

      for (const item of news.items) {
        if (item.sourceUrl === sourceUrl) {
          return jsonResult({
            isDuplicate: true,
            reason: "Same URL",
            duplicateId: item.id,
          });
        }
        if (item.titleHash === titleHash) {
          return jsonResult({
            isDuplicate: true,
            reason: "Same title",
            duplicateId: item.id,
          });
        }
        if (item.contentHash === contentHash) {
          return jsonResult({
            isDuplicate: true,
            reason: "Similar content",
            duplicateId: item.id,
          });
        }
      }

      return jsonResult({ isDuplicate: false });
    },
  };
}
