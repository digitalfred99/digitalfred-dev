import { admin } from "@/lib/http/handler";
import { ProposalsService } from "@/modules/proposals/proposals.service";

export const GET = admin(async (c) => ProposalsService.list(c.req.nextUrl.searchParams));
export const POST = admin(async (c) => ({ status: 201, data: await ProposalsService.create(await c.json(), { userId: c.userId, ...c.meta }) }));
