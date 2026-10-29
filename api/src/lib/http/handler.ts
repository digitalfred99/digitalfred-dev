import { NextRequest, NextResponse } from "next/server";
import { AppDataSource } from "@/database/data-source";
import { User } from "@/database/entities/User";
import { verifyAccessToken } from "@/lib/jwt";
import { unauthorized, tooMany } from "@/lib/errors/appErrors";
import { handleError } from "@/lib/errors/globalError";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { rateLimit } from "@/lib/security/tokens";

export type Params = Record<string, string>;
export interface Ctx {
  req: NextRequest;
  params: Params;
  /** Present on admin routes only. */
  userId: string;
  meta: { ipAddress?: string; userAgent?: string };
  json: () => Promise<unknown>;
}
type Result = { status?: number; data?: unknown; meta?: Record<string, unknown> } | Response | void;
type RouteCtx = { params: Promise<Params> };

export const requestMeta = (req: NextRequest) => ({
  ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
  userAgent: req.headers.get("user-agent") || undefined,
});

function toResponse(r: Result, defaultStatus: number) {
  if (r instanceof Response) return r;
  const status = r?.status ?? defaultStatus;
  const s = status === 201 ? SuccessCodes.RECORD_CREATED : SuccessCodes.RECORD_FETCHED;
  return customResponse(s.code, s.message, status, r?.data, r?.meta as never);
}

/** Admin route: requires a valid Bearer access token for an active user. */
export function admin(fn: (c: Ctx) => Promise<Result>, defaultStatus = 200) {
  return async (req: NextRequest, rc: RouteCtx) => {
    try {
      const h = req.headers.get("authorization");
      if (!h?.startsWith("Bearer ")) throw unauthorized("Authentication required");
      let payload;
      try { payload = verifyAccessToken(h.slice(7)); } catch { throw unauthorized("Invalid or expired token"); }
      const db = await AppDataSource();
      const user = await db.getRepository(User).findOne({ where: { id: payload.sub, isDeleted: false, isActive: true }, select: { id: true, tokenVersion: true } });
      if (!user || user.tokenVersion !== payload.tv) throw unauthorized("This session is no longer valid");
      const params = await rc.params;
      return toResponse(await fn({ req, params, userId: user.id, meta: requestMeta(req), json: () => req.json() }), defaultStatus);
    } catch (e) { return handleError(e); }
  };
}

/** Public route (client portal / login). Rate limited per IP + route. */
export function pub(fn: (c: Omit<Ctx, "userId">) => Promise<Result>, opts: { limit?: number; windowMs?: number; name: string; defaultStatus?: number } = { name: "pub" }) {
  return async (req: NextRequest, rc: RouteCtx) => {
    try {
      const meta = requestMeta(req);
      if (!rateLimit(`${opts.name}:${meta.ipAddress ?? "unknown"}`, opts.limit ?? 60, opts.windowMs ?? 60_000)) throw tooMany("Too many requests. Please try again shortly.");
      const params = await rc.params;
      return toResponse(await fn({ req, params, meta, json: () => req.json() }), opts.defaultStatus ?? 200);
    } catch (e) { return handleError(e); }
  };
}

export const html = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:" } });
