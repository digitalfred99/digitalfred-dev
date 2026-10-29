import { admin } from "@/lib/http/handler";
import { CatalogService } from "@/modules/catalog/catalog.service";

export const GET = admin(async () => ({ data: await CatalogService.listServices() }));
export const POST = admin(async (c) => ({ status: 201, data: await CatalogService.createService(await c.json(), { userId: c.userId, ...c.meta }) }));
