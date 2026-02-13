import type { ReplyPayload } from "../types.js";

export function hasLineDirectives(_text: string): boolean {
  return false;
}

export function parseLineDirectives(payload: ReplyPayload): ReplyPayload {
  return payload;
}
