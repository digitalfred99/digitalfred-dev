import { admin } from "@/lib/http/handler";
import { ExportsService } from "@/modules/documents/exports.service";

export const GET = admin(async (c) => { const r = await ExportsService.costLinesCsv(c.params.id, c.req.nextUrl.searchParams.get("version")); return new Response(r.csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${r.filename}"`, "cache-control": "no-store" } }); });
