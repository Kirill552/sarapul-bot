import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { generateUserId } from "../utils/hash.js";
import { readUsers, writeUsers, type UserData } from "../memory/file-store.js";
import { jsonResult } from "./helpers.js";

const SubscribeSchema = Type.Object({
  userId: Type.String({ description: "User ID to subscribe" }),
  channel: Type.Union([Type.Literal("max"), Type.Literal("telegram")], {
    description: "Channel type: max or telegram",
  }),
});

const UnsubscribeSchema = Type.Object({
  userId: Type.String({ description: "User ID to unsubscribe" }),
});

export function createSubscribeUserTool(): AnyAgentTool {
  return {
    name: "subscribe_user",
    label: "Subscribe User",
    description: "Subscribe a user to the news broadcast. Use when user sends /start command.",
    parameters: SubscribeSchema,
    execute: async (_toolCallId, params) => {
      const userId = params.userId as string;
      const channel = params.channel as "max" | "telegram";
      const internalId = generateUserId(userId, channel);

      const users = await readUsers();
      const existing = users[internalId];

      if (existing?.subscribed) {
        return jsonResult({
          success: true,
          message: "Пользователь уже подписан",
          userId: internalId,
        });
      }

      const userData: UserData = {
        subscribed: true,
        subscribedAt: Date.now(),
        channel,
        blocked: false,
      };

      if (existing) {
        userData.subscribedAt = existing.subscribedAt;
      }

      users[internalId] = userData;
      await writeUsers(users);

      return jsonResult({
        success: true,
        message: "Пользователь подписан",
        userId: internalId,
      });
    },
  };
}

export function createUnsubscribeUserTool(): AnyAgentTool {
  return {
    name: "unsubscribe_user",
    label: "Unsubscribe User",
    description: "Unsubscribe a user from the news broadcast. Use when user sends /stop command.",
    parameters: UnsubscribeSchema,
    execute: async (_toolCallId, params) => {
      const rawUserId = params.userId as string;

      const users = await readUsers();

      let found = false;
      for (const [internalId, userData] of Object.entries(users)) {
        if (internalId.endsWith(`_${rawUserId}`) || internalId === rawUserId) {
          if (userData.subscribed) {
            userData.subscribed = false;
            found = true;
          }
        }
      }

      if (!found) {
        return jsonResult({
          success: true,
          message: "Пользователь не был подписан",
        });
      }

      await writeUsers(users);

      return jsonResult({
        success: true,
        message: "Пользователь отписан",
      });
    },
  };
}
