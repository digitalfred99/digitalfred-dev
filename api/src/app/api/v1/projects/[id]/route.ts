import { admin } from "@/lib/http/handler";
import { ProjectsService } from "@/modules/projects/projects.service";

export const GET = admin(async (c) => ({ data: await ProjectsService.get(c.params.id) }));
export const PATCH = admin(async (c) => ({ data: await ProjectsService.update(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
export const DELETE = admin(async (c) => { await ProjectsService.remove(c.params.id, { userId: c.userId, ...c.meta }); return { data: { deleted: true } }; });
