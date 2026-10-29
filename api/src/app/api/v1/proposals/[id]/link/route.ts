import { admin } from "@/lib/http/handler";
import { ProposalsService } from "@/modules/proposals/proposals.service";

export const POST = admin(async (c) => ({ status: 201, data: await ProposalsService.regenerateLink(c.params.id, await c.json().catch(() => ({})), { userId: c.userId, ...c.meta }) }));
export const DELETE = admin(async (c) => { await ProposalsService.revokeLink(c.params.id, { userId: c.userId, ...c.meta }); return { data: { revoked: true } }; });
