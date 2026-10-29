import { admin } from "@/lib/http/handler";
import { ProposalsService } from "@/modules/proposals/proposals.service";

export const GET = admin(async (c) => ({ data: await ProposalsService.get(c.params.id) }));
export const PATCH = admin(async (c) => ({ data: await ProposalsService.updateMeta(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
export const DELETE = admin(async (c) => { await ProposalsService.remove(c.params.id, { userId: c.userId, ...c.meta }); return { data: { deleted: true } }; });
