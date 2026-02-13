import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

export async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    if (!existsSync(filePath)) {
      await writeJsonFile(filePath, defaultValue);
      return defaultValue;
    }
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    await writeJsonFile(filePath, defaultValue);
    return defaultValue;
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
  const tempPath = `${filePath}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tempPath, content, "utf-8");
  await fs.rename(tempPath, filePath);
}

export function getDataDir(): string {
  const envDir = process.env.SARAPUL_DATA_DIR;
  if (envDir) {
    return envDir.replace(/^~/, process.env.HOME || process.env.USERPROFILE || "");
  }
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(home, ".openclaw", "sarapul");
}

export function getUsersPath(): string {
  return path.join(getDataDir(), "users.json");
}

export function getNewsPath(): string {
  return path.join(getDataDir(), "news.json");
}

export function getSettingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}

export function getPublishedPath(): string {
  return path.join(getDataDir(), "published.json");
}

export type UserData = {
  subscribed: boolean;
  subscribedAt: number;
  lastBroadcast?: number;
  channel: "max" | "telegram";
  blocked: boolean;
};

export type UsersFile = Record<string, UserData>;

export type NewsItem = {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  content: string;
  originalContent?: string;
  publishedAt?: number;
  relevanceScore?: number;
  isRelevant?: boolean;
  aiReason?: string;
  titleHash: string;
  contentHash: string;
  status: "new" | "filtered" | "rejected" | "published";
  createdAt: number;
};

export type NewsFile = {
  items: NewsItem[];
  lastParsed?: number;
};

export type SettingsFile = {
  telegramChannels: string[];
  broadcastTimes: string[];
  adminUsers: string[];
  lastBroadcast?: number;
  maxNewsPerDigest: number;
  minRelevanceScore: number;
};

export type PublishedRecord = {
  newsId: string;
  broadcastType: "morning" | "evening" | "urgent";
  sentAt: number;
  recipientCount: number;
};

export type PublishedFile = {
  records: PublishedRecord[];
};

export const DEFAULT_USERS: UsersFile = {};
export const DEFAULT_NEWS: NewsFile = { items: [], lastParsed: undefined };
export const DEFAULT_SETTINGS: SettingsFile = {
  telegramChannels: ["admsarapul", "sarapul_news", "glava_sarapul"],
  broadcastTimes: ["08:30", "18:30"],
  adminUsers: [],
  lastBroadcast: undefined,
  maxNewsPerDigest: 3,
  minRelevanceScore: 4,
};
export const DEFAULT_PUBLISHED: PublishedFile = { records: [] };

export async function readUsers(): Promise<UsersFile> {
  return readJsonFile(getUsersPath(), DEFAULT_USERS);
}

export async function writeUsers(data: UsersFile): Promise<void> {
  return writeJsonFile(getUsersPath(), data);
}

export async function readNews(): Promise<NewsFile> {
  return readJsonFile(getNewsPath(), DEFAULT_NEWS);
}

export async function writeNews(data: NewsFile): Promise<void> {
  return writeJsonFile(getNewsPath(), data);
}

export async function readSettings(): Promise<SettingsFile> {
  const envAdmins = process.env.ADMIN_USERS;
  const settings = await readJsonFile(getSettingsPath(), DEFAULT_SETTINGS);
  if (envAdmins && settings.adminUsers.length === 0) {
    settings.adminUsers = envAdmins.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return settings;
}

export async function writeSettings(data: SettingsFile): Promise<void> {
  return writeJsonFile(getSettingsPath(), data);
}

export async function readPublished(): Promise<PublishedFile> {
  return readJsonFile(getPublishedPath(), DEFAULT_PUBLISHED);
}

export async function writePublished(data: PublishedFile): Promise<void> {
  return writeJsonFile(getPublishedPath(), data);
}
