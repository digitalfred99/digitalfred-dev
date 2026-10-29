import { admin } from "@/lib/http/handler";
import { ClientsService } from "@/modules/clients/clients.service";

export const GET = admin(async (c) => ({ data: await ClientsService.get(c.params.id) }));
export const PATCH = admin(async (c) => ({ data: await ClientsService.update(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
export const DELETE = admin(async (c) => { await ClientsService.remove(c.params.id, { userId: c.userId, ...c.meta }); return { data: { deleted: true } }; });
