import { admin, html } from "@/lib/http/handler";
import { DocumentsService } from "@/modules/documents/documents.service";

/** ?kind=proposal|cost_breakdown|scope|payment_schedule|contract|acceptance_record  &version=latest|draft|<versionId> */
export const GET = admin(async (c) => { const q = c.req.nextUrl.searchParams; return html(await DocumentsService.proposalDocument(c.params.id, q.get("kind"), q.get("version"))); });
