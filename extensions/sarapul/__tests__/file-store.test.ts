import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { readJsonFile, writeJsonFile, getDataDir } from "../src/memory/file-store.js";

const TEST_DIR = path.join(process.cwd(), `.test-sarapul-temp-${Date.now()}-${Math.random().toString(36).slice(2)}`);

describe("file-store", () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it("should write and read JSON file", async () => {
    const filePath = path.join(TEST_DIR, "test.json");
    const data = { foo: "bar", num: 42 };

    await writeJsonFile(filePath, data);
    const result = await readJsonFile(filePath, {});

    expect(result).toEqual(data);
  });

  it("should return default value when file does not exist", async () => {
    const filePath = path.join(TEST_DIR, "nonexistent.json");
    const defaultValue = { default: true };

    const result = await readJsonFile(filePath, defaultValue);

    expect(result).toEqual(defaultValue);
  });

  it("should create file with default value when not exists", async () => {
    const filePath = path.join(TEST_DIR, "created.json");
    const defaultValue = { created: true };

    await readJsonFile(filePath, defaultValue);

    const content = await fs.readFile(filePath, "utf-8");
    expect(JSON.parse(content)).toEqual(defaultValue);
  });

  it("should write atomically (temp file then rename)", async () => {
    const filePath = path.join(TEST_DIR, "atomic.json");
    const data = { atomic: true };

    await writeJsonFile(filePath, data);

    const tempExists = await fs.stat(`${filePath}.tmp`).catch(() => null);
    expect(tempExists).toBeNull();
  });

  it("should pretty-print JSON with 2-space indent", async () => {
    const filePath = path.join(TEST_DIR, "pretty.json");
    const data = { nested: { deep: { value: 1 } } };

    await writeJsonFile(filePath, data);

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("\n  ");
  });

  it("should expand tilde in data dir from env", () => {
    process.env.SARAPUL_DATA_DIR = "~/custom-data";
    const result = getDataDir();
    expect(result).not.toContain("~");
    expect(result).toContain("custom-data");
    delete process.env.SARAPUL_DATA_DIR;
  });
});
