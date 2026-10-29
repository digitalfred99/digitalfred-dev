import { admin } from "@/lib/http/handler";
import { ProjectsService } from "@/modules/projects/projects.service";

export const PATCH = admin(async (c) => ({ data: await ProjectsService.updateRequirement(c.params.id, c.params.rid, await c.json(), { userId: c.userId, ...c.meta }) }));
export const DELETE = admin(async (c) => { await ProjectsService.deleteRequirement(c.params.id, c.params.rid, { userId: c.userId, ...c.meta }); return { data: { deleted: true } }; });
