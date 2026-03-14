export function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function joinUrl(baseURL: string | undefined, path: string): string {
  if (!baseURL) return path;
  if (isAbsoluteUrl(path)) return path;
  const base = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  const sub = path.startsWith("/") ? path : `/${path}`;
  return `${base}${sub}`;
}

function encodeQueryKey(key: string): string {
  return encodeURIComponent(key).replace(/%5B/g, "[").replace(/%5D/g, "]");
}

function stringifyQueryValue(value: unknown): string {
  if (value === null) return "null";
  if (value instanceof Date) return value.toISOString();
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function appendQuery(
  url: string,
  query?: Record<string, unknown>,
): string {
  if (!query || Object.keys(query).length === 0) return url;

  const parts: string[] = [];
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined) continue;
    const encodedKey = encodeQueryKey(key);

    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        parts.push(`${encodedKey}=${encodeURIComponent(stringifyQueryValue(value))}`);
      }
      continue;
    }

    parts.push(
      `${encodedKey}=${encodeURIComponent(stringifyQueryValue(rawValue))}`,
    );
  }

  if (parts.length === 0) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${parts.join("&")}`;
}

export function buildUrl(
  baseURL: string | undefined,
  path: string,
  query?: Record<string, unknown>,
): string {
  return appendQuery(joinUrl(baseURL, path), query);
}

export function normalizeHeaderRecord(
  headers?: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined || value === null) continue;
    normalized[key] = Array.isArray(value) ? value.join(",") : String(value);
  }
  return normalized;
}

export function getHeaderValue(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

export function removeHeader(
  headers: Record<string, string>,
  name: string,
): void {
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      delete headers[key];
      return;
    }
  }
}
