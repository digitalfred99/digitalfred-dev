import { admin } from "@/lib/http/handler";
import { ProposalsService } from "@/modules/proposals/proposals.service";

export const PUT = admin(async (c) => ({ data: await ProposalsService.saveDraft(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
