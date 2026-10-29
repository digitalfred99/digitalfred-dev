import { admin } from "@/lib/http/handler";
import { ProposalsService } from "@/modules/proposals/proposals.service";

export const GET = admin(async (c) => { const q = c.req.nextUrl.searchParams; return { data: await ProposalsService.compareVersions(c.params.id, q.get("from") ?? "", q.get("to") ?? "") }; });
