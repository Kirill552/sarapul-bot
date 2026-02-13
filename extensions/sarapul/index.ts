import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createSubscribeUserTool, createUnsubscribeUserTool } from "./src/tools/subscribe.js";
import {
  createGetRecentNewsTool,
  createSaveNewsTool,
  createGetBotStatusTool,
  createGetStatsTool,
} from "./src/tools/news-storage.js";
import { createParseAdmSarapulTool, createParseRsshubTool } from "./src/tools/parsers.js";
import {
  createClassifyNewsTool,
  createRewriteNewsTool,
  createDedupeNewsTool,
} from "./src/tools/ai-pipeline.js";
import { createRunBroadcastTool } from "./src/tools/broadcast.js";
import { createRunParseCycleTool } from "./src/tools/parse-cycle.js";
import { ensureDataDir, ensureCronJobs } from "./src/setup.js";

const plugin = {
  id: "sarapul",
  name: "Sarapul News Bot",
  description: "News bot tools for Sarapul city",
  register(api: OpenClawPluginApi) {
    api.registerTool(createSubscribeUserTool());
    api.registerTool(createUnsubscribeUserTool());
    api.registerTool(createGetRecentNewsTool());
    api.registerTool(createSaveNewsTool());
    api.registerTool(createGetBotStatusTool());
    api.registerTool(createGetStatsTool());
    api.registerTool(createParseAdmSarapulTool());
    api.registerTool(createParseRsshubTool());
    api.registerTool(createClassifyNewsTool());
    api.registerTool(createRewriteNewsTool());
    api.registerTool(createDedupeNewsTool());
    api.registerTool(createRunBroadcastTool());
    api.registerTool(createRunParseCycleTool());

    api.on("gateway_start", async () => {
      await ensureDataDir();
      await ensureCronJobs(api);
    });
  },
};

export default plugin;
