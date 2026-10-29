import { admin } from "@/lib/http/handler";
import { ProposalsService } from "@/modules/proposals/proposals.service";

export const POST = admin(async (c) => ({ status: 201, data: await ProposalsService.publish(c.params.id, await c.json().catch(() => ({})), { userId: c.userId, ...c.meta }) }));
