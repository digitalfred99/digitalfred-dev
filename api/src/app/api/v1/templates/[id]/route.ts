import { admin } from "@/lib/http/handler";
import { CatalogService } from "@/modules/catalog/catalog.service";

export const PATCH = admin(async (c) => ({ data: await CatalogService.updateTemplate(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
export const DELETE = admin(async (c) => { await CatalogService.deleteTemplate(c.params.id, { userId: c.userId, ...c.meta }); return { data: { deleted: true } }; });
