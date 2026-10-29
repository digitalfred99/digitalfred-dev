import type { ApiEnvelope, ApiErrorBody } from "@/types/api";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/api/v1`;

type TokenPair = { accessToken: string; refreshToken: string };
let tokens: TokenPair | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;
  code?: string;
  label?: string;
  field?: string;
  details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || "The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.label = body.label;
    this.field = body.field;
    this.details = body.details;
  }
}

export function setTokens(pair: TokenPair | null) {
  tokens = pair;
}

export function hasAccessToken() {
  return Boolean(tokens?.accessToken);
}

async function refreshTokens(): Promise<boolean> {
  if (!tokens?.refreshToken) return false;
  if (!refreshInFlight) {
    const refreshToken = tokens.refreshToken;
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).then(async (response) => {
      if (!response.ok) return false;
      const envelope = await response.json() as ApiEnvelope<TokenPair>;
      setTokens(envelope.data);
      return true;
    }).catch(() => false).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true, anonymous = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (!anonymous && tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401 && retry && tokens?.refreshToken && await refreshTokens()) {
    return request<T>(path, init, false);
  }
  if (response.status === 401) {
    setTokens(null);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("auth:expired"));
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    const body = contentType.includes("application/json")
      ? await response.json() as ApiErrorBody
      : { success: false as const, message: await response.text() || response.statusText };
    throw new ApiError(response.status, body);
  }
  if (contentType.includes("text/")) return await response.text() as T;
  if (response.status === 204) return undefined as T;
  const envelope = await response.json() as ApiEnvelope<T>;
  return envelope.data;
}

function queryString(params?: Record<string, string | number | boolean | null | undefined>) {
  if (!params) return "";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | null | undefined>) =>
    request<T>(`${path}${queryString(params)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  publicGet: <T>(path: string) => request<T>(path, {}, false, true),
  publicPost: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, false, true),
  document: (path: string) => request<string>(path),
  documentBlob: async (path: string) => {
    const html = await request<string>(path);
    return URL.createObjectURL(new Blob([html], { type: "text/html" }));
  },
};

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}
