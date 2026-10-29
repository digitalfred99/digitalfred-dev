import { admin } from "@/lib/http/handler";
import { ProposalsService } from "@/modules/proposals/proposals.service";

export const GET = admin(async (c) => ({ data: await ProposalsService.listVersions(c.params.id) }));
