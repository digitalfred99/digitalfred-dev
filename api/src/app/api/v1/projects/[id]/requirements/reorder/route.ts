import { admin } from "@/lib/http/handler";
import { ProjectsService } from "@/modules/projects/projects.service";

export const POST = admin(async (c) => { await ProjectsService.reorderRequirements(c.params.id, await c.json(), { userId: c.userId, ...c.meta }); return { data: { reordered: true } }; });
