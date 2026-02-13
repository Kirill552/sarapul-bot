export function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function readStringParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean; label?: string },
): string | undefined {
  const { required = false, label = key } = options ?? {};
  const raw = params[key];
  if (typeof raw !== "string") {
    if (required) {
      throw new Error(`${label} required`);
    }
    return undefined;
  }
  const value = raw.trim();
  if (!value && required) {
    throw new Error(`${label} required`);
  }
  return value || undefined;
}

export function readNumberParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean; label?: string; integer?: boolean },
): number | undefined {
  const { required = false, label = key, integer = false } = options ?? {};
  const raw = params[key];
  let value: number | undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    value = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed) {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed)) {
        value = parsed;
      }
    }
  }
  if (value === undefined) {
    if (required) {
      throw new Error(`${label} required`);
    }
    return undefined;
  }
  return integer ? Math.trunc(value) : value;
}
