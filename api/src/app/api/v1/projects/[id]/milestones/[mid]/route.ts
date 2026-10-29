import { admin } from "@/lib/http/handler";
import { ProjectsService } from "@/modules/projects/projects.service";

export const PATCH = admin(async (c) => ({ data: await ProjectsService.updateMilestone(c.params.id, c.params.mid, await c.json(), { userId: c.userId, ...c.meta }) }));
export const DELETE = admin(async (c) => { await ProjectsService.deleteMilestone(c.params.id, c.params.mid, { userId: c.userId, ...c.meta }); return { data: { deleted: true } }; });
