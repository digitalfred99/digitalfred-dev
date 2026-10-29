import { admin } from "@/lib/http/handler";
import { ExportsService } from "@/modules/documents/exports.service";

export const GET = admin(async () => new Response(await ExportsService.proposalsCsv(), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="proposals.csv"', "cache-control": "no-store" } }));
