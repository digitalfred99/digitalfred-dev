import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { handleError } from "@/lib/errors/globalError";
import { ProposalsService } from "@/modules/proposals/proposals.service";

/** Call from a scheduler (e.g. Vercel Cron) with `Authorization: Bearer $CRON_SECRET`. Idempotent. */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET ?? "";
    const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
    const ok = secret.length >= 24 && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
    if (!ok) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: true, data: await ProposalsService.expireDue() });
  } catch (e) { return handleError(e); }
}
export const GET = POST; // Vercel Cron issues GET requests
