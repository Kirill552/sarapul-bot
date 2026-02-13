import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { getDataDir, writeSettings, DEFAULT_SETTINGS } from "./memory/file-store.js";

export async function ensureDataDir(): Promise<void> {
  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    await fs.mkdir(dataDir, { recursive: true });
  }

  const settingsPath = path.join(dataDir, "settings.json");
  if (!existsSync(settingsPath)) {
    await writeSettings(DEFAULT_SETTINGS);
  }
}

type CronJob = {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: { kind: "cron"; expr: string; tz?: string };
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payload: { kind: "agentTurn"; message: string };
  state: Record<string, unknown>;
};

type CronStoreFile = {
  version: 1;
  jobs: CronJob[];
};

const EXPECTED_CRON_JOBS: Array<Omit<CronJob, "createdAtMs" | "updatedAtMs" | "state">> = [
  {
    id: "sarapul-parse-morning",
    name: "Sarapul Morning Parse",
    enabled: true,
    schedule: { kind: "cron", expr: "0 8 * * *", tz: "Europe/Samara" },
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "Запусти парсинг новостей: вызови run_parse_cycle" },
  },
  {
    id: "sarapul-broadcast-morning",
    name: "Sarapul Morning Broadcast",
    enabled: true,
    schedule: { kind: "cron", expr: "30 8 * * *", tz: "Europe/Samara" },
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "Запусти утреннюю рассылку: вызови run_broadcast с type=morning" },
  },
  {
    id: "sarapul-parse-evening",
    name: "Sarapul Evening Parse",
    enabled: true,
    schedule: { kind: "cron", expr: "0 18 * * *", tz: "Europe/Samara" },
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "Запусти парсинг новостей: вызови run_parse_cycle" },
  },
  {
    id: "sarapul-broadcast-evening",
    name: "Sarapul Evening Broadcast",
    enabled: true,
    schedule: { kind: "cron", expr: "30 18 * * *", tz: "Europe/Samara" },
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "Запусти вечернюю рассылку: вызови run_broadcast с type=evening" },
  },
];

function resolveCronStorePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const configDir = process.env.XDG_CONFIG_HOME
    ? path.join(process.env.XDG_CONFIG_HOME, "openclaw")
    : path.join(home, ".config", "openclaw");
  return path.join(configDir, "cron", "jobs.json");
}

async function loadCronStore(storePath: string): Promise<CronStoreFile> {
  try {
    const raw = await fs.readFile(storePath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: number; jobs?: unknown[] };
    return {
      version: 1,
      jobs: (Array.isArray(parsed.jobs) ? parsed.jobs : []) as CronJob[],
    };
  } catch (err) {
    if ((err as { code?: string }).code === "ENOENT") {
      return { version: 1, jobs: [] };
    }
    throw err;
  }
}

async function saveCronStore(storePath: string, store: CronStoreFile): Promise<void> {
  const dir = path.dirname(storePath);
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
  const tmp = `${storePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmp, storePath);
}

export async function ensureCronJobs(_api: OpenClawPluginApi): Promise<void> {
  const storePath = resolveCronStorePath();
  const store = await loadCronStore(storePath);
  const existingIds = new Set(store.jobs.map((j) => j.id));

  let added = 0;
  const now = Date.now();

  for (const expected of EXPECTED_CRON_JOBS) {
    if (existingIds.has(expected.id)) {
      continue;
    }
    store.jobs.push({
      ...expected,
      createdAtMs: now,
      updatedAtMs: now,
      state: {},
    });
    added++;
  }

  if (added > 0) {
    await saveCronStore(storePath, store);
    console.log(`[sarapul] Created ${added} cron jobs`);
  } else {
    console.log(`[sarapul] All cron jobs already exist`);
  }
}
