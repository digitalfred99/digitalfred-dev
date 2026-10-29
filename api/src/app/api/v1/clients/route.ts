import { admin } from "@/lib/http/handler";
import { ClientsService } from "@/modules/clients/clients.service";

export const GET = admin(async (c) => ClientsService.list(c.req.nextUrl.searchParams));
export const POST = admin(async (c) => ({ status: 201, data: await ClientsService.create(await c.json(), { userId: c.userId, ...c.meta }) }));
