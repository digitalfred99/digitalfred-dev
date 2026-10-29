import { admin } from "@/lib/http/handler";
import { ProposalsService } from "@/modules/proposals/proposals.service";

export const POST = admin(async (c) => ({ data: await ProposalsService.transition(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
