import { admin } from "@/lib/http/handler";
import { CatalogService } from "@/modules/catalog/catalog.service";

export const GET = admin(async (c) => ({ data: await CatalogService.listTemplates(c.req.nextUrl.searchParams.get("kind")) }));
export const POST = admin(async (c) => ({ status: 201, data: await CatalogService.createTemplate(await c.json(), { userId: c.userId, ...c.meta }) }));
